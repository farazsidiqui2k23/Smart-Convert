from flask import Flask, request, render_template, jsonify, send_file, session
import os
from datetime import timedelta
from session_manager import SessionManager
from cleanup_scheduler import CleanupScheduler
from downloader import UniversalDownloader

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-super-secret-key-change-this-in-production'
app. config['SESSION_TYPE'] = 'filesystem'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=2)

# Create downloads directory
DOWNLOAD_DIR = 'downloads'
if not os.path.exists(DOWNLOAD_DIR):
    os.makedirs(DOWNLOAD_DIR)

# Initialize components
downloader = UniversalDownloader()
scheduler = CleanupScheduler()
scheduler.start()

# Cleanup orphaned folders on startup
def cleanup_orphaned_folders():
    """Clean up any leftover folders from previous runs"""
    if os.path.exists(DOWNLOAD_DIR):
        for folder in os.listdir(DOWNLOAD_DIR):
            folder_path = os.path.join(DOWNLOAD_DIR, folder)
            if os.path.isdir(folder_path):
                try:
                    import shutil
                    shutil. rmtree(folder_path)
                    print(f"🧹 Cleaned orphaned folder: {folder}")
                except Exception as e:
                    print(f"❌ Error cleaning {folder}: {e}")

cleanup_orphaned_folders()

def cleanup_invalid_files(folder):
    """Remove .mhtml and other invalid files from folder"""
    invalid_extensions = ['.mhtml', '.html', '.htm', '.txt', '.xml']
    
    if os. path.exists(folder):
        for file in os.listdir(folder):
            if any(file.endswith(ext) for ext in invalid_extensions):
                try:
                    filepath = os. path.join(folder, file)
                    os.remove(filepath)
                    print(f"🗑️ Removed invalid file: {file}")
                except Exception as e:
                    print(f"⚠️ Could not remove {file}: {e}")

@app.route('/')
def index():
    """Main page"""
    # Create or get session
    session_id = session.get('session_id')
    
    if not session_id or not SessionManager.get_session(session_id):
        session_id = SessionManager.create_session()
        print(f"🆕 New session created: {session_id}")
    else:
        print(f"♻️ Existing session loaded: {session_id}")
    
    return render_template('index.html')

@app.route('/session-info', methods=['GET'])
def session_info():
    """Get current session info"""
    session_id = session.get('session_id')
    
    if not session_id: 
        return jsonify({'error': 'No session found'}), 404
    
    session_data = SessionManager.get_session(session_id)
    
    if not session_data:
        return jsonify({'error': 'Session expired'}), 404
    
    return jsonify({
        'session_id': session_id,
        'state': session_data['state'],
        'downloads': session_data['downloads']
    })

# 🆕 NEW ROUTE:  Fetch video info without downloading
@app.route('/fetch-info', methods=['POST'])
def fetch_info():
    """Fetch video metadata without downloading"""
    try:
        data = request.get_json()
        url = data.get('url', '').strip()
        session_id = session.get('session_id')
        
        if not url: 
            return jsonify({'status': 'error', 'message': 'URL is required'}), 400
        
        if not session_id:
            return jsonify({'status': 'error', 'message': 'Session expired.  Please refresh. '}), 401
        
        # Update activity
        SessionManager.update_activity(session_id)
        
        print(f"🔍 Fetching info for: {url}")
        
        # Fetch video info
        result = downloader.fetch_video_info(url)
        
        if result['status'] == 'success': 
            print(f"✅ Info fetched:  {result.get('title')}")
            
            return jsonify(result)
        else:
            print(f"❌ Fetch failed: {result.get('message')}")
            return jsonify(result), 400
            
    except Exception as e:
        print(f"❌ Server error: {str(e)}")
        return jsonify({'status':  'error', 'message':  'Your link is broken, please provide valid link'}), 500

# MODIFIED: Download route now accepts format_id
@app.route('/download', methods=['POST'])
def download():
    """Handle download requests with optional quality selection"""
    try:
        data = request.get_json()
        url = data.get('url', '').strip()
        format_id = data.get('format_id')  # 🆕 Quality format ID
        session_id = session. get('session_id')
        
        if not url:
            return jsonify({'status': 'error', 'message': 'URL is required'}), 400
        
        if not session_id:
            return jsonify({'status': 'error', 'message': 'Session expired. Please refresh.'}), 401
        
        # Get session state
        state = SessionManager.get_state(session_id)
        
        if not state:
            return jsonify({'status': 'error', 'message': 'Session not found.  Please refresh.'}), 401
        
        # Handle different states
        if state == SessionManager.STATE_DOWNLOADING:
            return jsonify({'status': 'error', 'message': 'Download already in progress'}), 400
        
        elif state == SessionManager.STATE_COMPLETED:
            # Auto-reset session for new download
            print(f"♻️ Resetting completed session:  {session_id}")
            SessionManager.reset_session(session_id)
        
        elif state == SessionManager.STATE_EXPIRED:
            # Auto-renew expired session
            print(f"🔄 Renewing expired session: {session_id}")
            SessionManager.reset_session(session_id)
        
        # Update activity and set state to DOWNLOADING
        SessionManager.update_activity(session_id)
        SessionManager.set_state(session_id, SessionManager.STATE_DOWNLOADING)
        
        # Create download folder
        download_folder = SessionManager.create_download_folder(session_id)
        
        # Detect platform
        platform = downloader. detect_platform(url)
        print(f"📥 Starting download:  {platform} - {url} (Format: {format_id})")
        
        # Download content with selected quality
        result = downloader. download_content(url, download_folder, session_id, format_id)
        
        if result['status'] == 'success': 
            # Clean up any invalid files that might have been created
            cleanup_invalid_files(download_folder)
            
            # Verify the file still exists and is valid
            if not os.path.exists(result['filepath']):
                SessionManager.set_state(session_id, SessionManager.STATE_ACTIVE)
                SessionManager.cleanup_session(session_id, force=True)
                return jsonify({
                    'status': 'error',
                    'message': 'Download completed but file not found'
                }), 400
            
            # Check file size (reject if too small - likely error)
            if result['filesize'] < 1024:  # Less than 1KB
                SessionManager.set_state(session_id, SessionManager.STATE_ACTIVE)
                SessionManager.cleanup_session(session_id, force=True)
                return jsonify({
                    'status': 'error',
                    'message':  'Downloaded file is too small - likely failed'
                }), 400
            
            # Add download info to session
            download_info = {
                'url': url,
                'platform': platform,
                'filename': result. get('filename', 'unknown'),
                'filepath': result. get('filepath', ''),
                'filesize': result.get('filesize', 0),
                'status': 'completed'
            }
            
            SessionManager.add_download(session_id, download_info)
            SessionManager.set_state(session_id, SessionManager.STATE_COMPLETED)
            
            result['platform'] = platform
            result['session_id'] = session_id
            
            print(f"✅ Download completed:  {result. get('filename')}")
            return jsonify(result)
        else:
            # Download failed - reset to ACTIVE
            SessionManager.set_state(session_id, SessionManager.STATE_ACTIVE)
            SessionManager.cleanup_session(session_id, force=True)
            
            print(f"❌ Download failed: {result.get('message')}")
            return jsonify(result), 400
            
    except Exception as e:
        print(f"❌ Server error: {str(e)}")
        # Reset session on error
        if session_id:
            SessionManager.set_state(session_id, SessionManager.STATE_ACTIVE)
            SessionManager.cleanup_session(session_id, force=True)
        return jsonify({'status':  'error', 'message':  f'Server error: {str(e)}'}), 500


@app.route('/download-progress/<session_id>', methods=['GET'])
def download_progress(session_id):
    """Get download progress for a session"""
    try:
        # Verify session
        current_session = session.get('session_id')
        if current_session != session_id:  
            return jsonify({'error': 'Invalid session'}), 403
        
        # Get progress from downloader
        progress = downloader. get_progress(session_id)
        
        return jsonify(progress)
        
    except Exception as e:  
        return jsonify({'error': str(e)}), 500


@app.route('/download-file/<session_id>/<filename>')
def download_file(session_id, filename):
    """Serve downloaded file to user"""
    try:
        # Verify session
        current_session = session.get('session_id')
        if current_session != session_id: 
            return jsonify({'error': 'Invalid session'}), 403
        
        session_data = SessionManager.get_session(session_id)
        if not session_data:
            return jsonify({'error': 'Session not found'}), 404
        
        # Find file
        folder = session_data. get('download_folder')
        if not folder or not os.path.exists(folder):
            return jsonify({'error': 'Download folder not found'}), 404
        
        filepath = os.path.join(folder, filename)
        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404
        
        print(f"📤 Serving file: {filename}")
        
        # Send file
        response = send_file(filepath, as_attachment=True, download_name=filename)
        
        # Cleanup after file is sent
        @response.call_on_close
        def cleanup():
            print(f"🧹 Cleaning up after download: {session_id}")
            SessionManager.cleanup_session(session_id, force=True)
            SessionManager.reset_session(session_id)
        
        return response
        
    except Exception as e:
        print(f"❌ Error serving file: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/cleanup-session', methods=['POST'])
def cleanup_session_endpoint():
    """Manual session cleanup (called when user closes tab)"""
    try:
        session_id = session.get('session_id')
        
        if not session_id:  
            return jsonify({'status': 'error', 'message': 'No session found'}), 404
        
        state = SessionManager.get_state(session_id)
        
        if state == SessionManager.STATE_DOWNLOADING:
            # Don't cleanup if download in progress
            return jsonify({
                'status': 'warning',
                'message': 'Download in progress, cleanup skipped'
            })
        
        # Cleanup
        SessionManager.cleanup_session(session_id, force=True)
        
        return jsonify({'status': 'success', 'message': 'Session cleaned up'})
        
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/bulk-download', methods=['POST'])
def bulk_download():
    """Handle bulk download requests"""
    try: 
        data = request.get_json()
        urls = data.get('urls', [])
        session_id = session.get('session_id')
        
        if not urls:
            return jsonify({'status': 'error', 'message': 'URLs list is required'}), 400
        
        if not session_id:
            return jsonify({'status': 'error', 'message': 'Session expired'}), 401
        
        # Check state
        state = SessionManager.get_state(session_id)
        
        if state == SessionManager.STATE_DOWNLOADING:  
            return jsonify({'status': 'error', 'message': 'Download in progress'}), 400
        
        if state in [SessionManager.STATE_COMPLETED, SessionManager.STATE_EXPIRED]:
            SessionManager.reset_session(session_id)
        
        # Set to downloading
        SessionManager.set_state(session_id, SessionManager.STATE_DOWNLOADING)
        download_folder = SessionManager.create_download_folder(session_id)
        
        results = []
        for url in urls:
            if url.strip():
                result = downloader. download_content(url. strip(), download_folder, session_id)
                result['url'] = url
                results.append(result)
                
                if result['status'] == 'success':
                    SessionManager.add_download(session_id, {
                        'url': url,
                        'filename': result.get('filename'),
                        'filepath': result. get('filepath'),
                        'filesize': result.get('filesize', 0),
                        'status': 'completed'
                    })
        
        # Clean invalid files after all downloads
        cleanup_invalid_files(download_folder)
        
        SessionManager.set_state(session_id, SessionManager.STATE_COMPLETED)
        
        return jsonify({
            'status': 'success',
            'message': f'Processed {len(results)} URLs',
            'results': results
        })
        
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':  
    # print("=" * 60)
    # print("🚀 UNIVERSAL SOCIAL MEDIA DOWNLOADER v2.0")
    # print("=" * 60)
    # print("✨ Session-based downloads with auto-cleanup")
    # print("⏰ 10-minute session timeout")
    # print("🧹 Background cleanup every 2 minutes")
    # print("🔧 Enhanced error handling & file validation")
    # print("=" * 60)
    app.run(debug=True, host='0.0.0.0', port=5000)