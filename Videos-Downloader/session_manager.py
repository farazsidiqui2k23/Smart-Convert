import os
import uuid
import time
import shutil
from datetime import datetime, timedelta
from flask import session
import json

class SessionManager:
    """Manages user sessions and their download folders"""
    
    # Session states
    STATE_ACTIVE = 'ACTIVE'
    STATE_DOWNLOADING = 'DOWNLOADING'
    STATE_COMPLETED = 'COMPLETED'
    STATE_EXPIRED = 'EXPIRED'
    
    # Session timeout (10 minutes)
    TIMEOUT_SECONDS = 600
    
    # In-memory storage (use Redis in production)
    _sessions = {}
    
    @staticmethod
    def create_session():
        """Create a new session"""
        session_id = str(uuid.uuid4())
        
        session_data = {
            'session_id': session_id,
            'state': SessionManager. STATE_ACTIVE,
            'created_at': datetime.now().isoformat(),
            'last_activity': datetime.now().isoformat(),
            'download_folder': None,
            'downloads': [],
            'timeout_at': (datetime.now() + timedelta(seconds=SessionManager.TIMEOUT_SECONDS)).isoformat()
        }
        
        SessionManager._sessions[session_id] = session_data
        session['session_id'] = session_id
        
        return session_id
    
    @staticmethod
    def get_session(session_id):
        """Get session data"""
        return SessionManager._sessions. get(session_id)
    
    @staticmethod
    def update_activity(session_id):
        """Update last activity timestamp"""
        if session_id in SessionManager._sessions:
            SessionManager._sessions[session_id]['last_activity'] = datetime.now().isoformat()
            # Reset timeout if state is ACTIVE
            if SessionManager._sessions[session_id]['state'] == SessionManager.STATE_ACTIVE:
                SessionManager._sessions[session_id]['timeout_at'] = (
                    datetime.now() + timedelta(seconds=SessionManager. TIMEOUT_SECONDS)
                ).isoformat()
    
    @staticmethod
    def set_state(session_id, state):
        """Set session state"""
        if session_id in SessionManager._sessions:
            SessionManager._sessions[session_id]['state'] = state
    
    @staticmethod
    def get_state(session_id):
        """Get session state"""
        session_data = SessionManager. get_session(session_id)
        return session_data['state'] if session_data else None
    
    @staticmethod
    def create_download_folder(session_id):
        """Create unique download folder for session"""
        folder_path = os.path.join('downloads', session_id)
        os.makedirs(folder_path, exist_ok=True)
        
        if session_id in SessionManager._sessions:
            SessionManager._sessions[session_id]['download_folder'] = folder_path
        
        return folder_path
    
    @staticmethod
    def add_download(session_id, download_info):
        """Add download info to session"""
        if session_id in SessionManager._sessions:
            SessionManager._sessions[session_id]['downloads'].append(download_info)
    
    @staticmethod
    def cleanup_session(session_id, force=False):
        """Clean up session folder and data"""
        session_data = SessionManager.get_session(session_id)
        
        if not session_data:
            return
        
        # Check if download is in progress
        state = session_data['state']
        
        if state == SessionManager.STATE_DOWNLOADING and not force:
            # Don't cleanup during download unless forced
            return False
        
        # Delete folder
        folder_path = session_data. get('download_folder')
        if folder_path and os.path.exists(folder_path):
            try:
                shutil.rmtree(folder_path)
                print(f"✅ Cleaned up folder: {folder_path}")
            except Exception as e:
                print(f"❌ Error cleaning folder {folder_path}: {e}")
        
        # Set state to expired
        SessionManager.set_state(session_id, SessionManager. STATE_EXPIRED)
        
        return True
    
    @staticmethod
    def reset_session(session_id):
        """Reset session after download completion (for reuse)"""
        session_data = SessionManager.get_session(session_id)
        
        if not session_data: 
            return False
        
        # Cleanup old folder
        SessionManager.cleanup_session(session_id, force=True)
        
        # Reset session data
        SessionManager._sessions[session_id]. update({
            'state': SessionManager.STATE_ACTIVE,
            'last_activity': datetime.now().isoformat(),
            'download_folder': None,
            'downloads': [],
            'timeout_at': (datetime.now() + timedelta(seconds=SessionManager.TIMEOUT_SECONDS)).isoformat()
        })
        
        return True
    
    @staticmethod
    def extend_timeout(session_id, minutes=10):
        """Extend session timeout (for active downloads)"""
        if session_id in SessionManager._sessions:
            new_timeout = datetime.now() + timedelta(minutes=minutes)
            SessionManager._sessions[session_id]['timeout_at'] = new_timeout.isoformat()
            print(f"⏰ Extended timeout for session {session_id} by {minutes} minutes")
    
    @staticmethod
    def get_expired_sessions():
        """Get list of expired sessions"""
        expired = []
        now = datetime.now()
        
        for session_id, data in SessionManager._sessions.items():
            timeout_at = datetime.fromisoformat(data['timeout_at'])
            state = data['state']
            
            # Expire if timeout reached and not downloading
            if now > timeout_at and state != SessionManager.STATE_DOWNLOADING:
                expired.append(session_id)
            
            # Extend timeout if downloading
            elif now > timeout_at and state == SessionManager.STATE_DOWNLOADING: 
                SessionManager.extend_timeout(session_id, minutes=10)
        
        return expired
    
    @staticmethod
    def get_all_sessions():
        """Get all sessions (for debugging)"""
        return SessionManager._sessions