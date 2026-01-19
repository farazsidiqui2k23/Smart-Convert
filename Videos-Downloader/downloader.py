import os
import re
import yt_dlp
from datetime import datetime

class UniversalDownloader:  
    def __init__(self):
        self.progress_data = {}  # Store progress for each session
        # 🆕 Cookies file path
        self.cookies_file = 'cookies.txt'
        
        # Check if cookies file exists on startup
        if os.path.exists(self.cookies_file):
            print(f"✅ Cookies file found:  {self.cookies_file}")
        else:
            print(f"⚠️  Warning: Cookies file not found at {self.cookies_file}")
            print(f"   Some downloads may fail due to authentication")
            print(f"   To fix: Export cookies from your browser using 'Get cookies.txt' extension")
    
    def detect_platform(self, url):
        """Detect the platform from URL"""
        url = url.lower()
        if 'youtube.com' in url or 'youtu.be' in url:
            return 'youtube'
        elif 'instagram.com' in url:   
            return 'instagram'
        elif 'facebook.com' in url or 'fb.watch' in url: 
            return 'facebook'
        elif 'twitter.com' in url or 'x.com' in url:
            return 'twitter'
        elif 'tiktok.com' in url:   
            return 'tiktok'
        elif 'reddit.com' in url:
            return 'reddit'
        else:
            return 'unknown'
    
    def has_quality_options(self, platform):
        """Check if platform supports multiple quality options"""
        # Instagram and TikTok don't need quality selection
        return platform not in ['instagram', 'tiktok']
    
    def get_common_headers(self):
        """Get common HTTP headers for requests"""
        return {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Cache-Control': 'max-age=0',
        }
    
    def get_base_ydl_opts(self):
        """🆕 Get base yt-dlp options with cookies support"""
        opts = {
            'quiet': False,
            'no_warnings':  False,
            'no_check_certificate': True,
            'http_headers': self.get_common_headers(),
        }
        
        # Add cookies if file exists
        if os.path. exists(self.cookies_file):
            opts['cookiefile'] = self.cookies_file
            print(f"🍪 Using cookies from:  {self.cookies_file}")
        
        return opts
    
    def fetch_video_info(self, url):
        """Fetch video metadata WITHOUT downloading"""
        try:  
            platform = self.detect_platform(url)
            
            print(f"\n{'='*60}")
            print(f"🔍 Fetching video info")
            print(f"Platform:  {platform}")
            print(f"URL: {url}")
            print(f"{'='*60}\n")
            
            # Base options with cookies 🆕
            ydl_opts = self.get_base_ydl_opts()
            ydl_opts.update({
                'skip_download': True,
                'extract_flat': False,
            })
            
            # Platform-specific configurations
            if platform == 'instagram':
                ydl_opts.update({
                    'extractor_args': {
                        'instagram': {
                            'api': ['graphql']
                        }
                    },
                })
                print("📸 Instagram detected - using GraphQL API")
            
            elif platform == 'facebook':  
                ydl_opts.update({
                    'format': 'best',
                })
                print("📘 Facebook detected")
            
            elif platform == 'tiktok':
                ydl_opts.update({
                    'extractor_args':  {
                        'tiktok': {
                            'api_hostname': 'api22-normal-c-useast2a. tiktokv.com'
                        }
                    },
                })
                print("🎵 TikTok detected")
            
            elif platform == 'youtube':
                print("📺 YouTube detected")
            
            elif platform == 'twitter':
                print("🐦 Twitter/X detected")
            
            elif platform == 'reddit':
                print("💬 Reddit detected")
            
            else:
                print("❓ Unknown platform - attempting generic extraction")
            
            # Try to extract info
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                
                if not info:
                    return {'status': 'error', 'message': 'Unable to fetch video information'}
                
                # Extract thumbnail
                thumbnail = info.get('thumbnail', '') or info.get('thumbnails', [{}])[0].get('url', '')
                
                # Extract title
                title = info.get('title', 'Unknown Title')
                
                # Extract duration
                duration_seconds = info.get('duration', 0)
                duration = self.format_duration(duration_seconds)
                
                # Extract uploader
                uploader = info. get('uploader', info.get('channel', info.get('creator', 'Unknown')))
                
                # Extract formats (for quality selection)
                formats = []
                has_quality = self.has_quality_options(platform)
                
                if has_quality and 'formats' in info: 
                    # Filter video formats (must have both video and audio)
                    video_formats = []
                    
                    for f in info['formats']:
                        vcodec = f.get('vcodec', 'none')
                        acodec = f.get('acodec', 'none')
                        height = f.get('height')
                        
                        # Include formats with video and audio OR video-only (we'll merge later)
                        if vcodec != 'none' and height: 
                            video_formats.append(f)
                    
                    # Get unique resolutions
                    seen_heights = set()
                    for fmt in video_formats:
                        height = fmt.get('height')
                        if height and height not in seen_heights and height >= 240:
                            seen_heights. add(height)
                            filesize = fmt.get('filesize') or fmt.get('filesize_approx', 0)
                            formats. append({
                                'format_id': fmt['format_id'],
                                'quality': f"{height}p",
                                'height': height,
                                'ext': fmt. get('ext', 'mp4'),
                                'filesize': filesize,
                                'filesize_human': self.format_filesize(filesize)
                            })
                    
                    # Sort by quality (highest first)
                    formats.sort(key=lambda x: x['height'], reverse=True)
                
                # Build result
                result = {
                    'status': 'success',
                    'platform': platform,
                    'title': title,
                    'thumbnail': thumbnail,
                    'duration': duration,
                    'has_quality_options': has_quality,
                    'formats': formats,
                    'uploader': uploader,
                    'view_count': info.get('view_count', 0)
                }
                
                print(f"✅ Info fetched successfully")
                print(f"Title: {title}")
                print(f"Duration: {duration}")
                print(f"Uploader: {uploader}")
                print(f"Available formats: {len(formats)}")
                
                return result
                
        except yt_dlp.utils. DownloadError as e: 
            error_msg = str(e)
            print(f"❌ yt-dlp DownloadError: {error_msg}")
            
            # 🆕 Enhanced cookie-related error handling
            if 'Sign in to confirm you\'re not a bot' in error_msg or 'bot' in error_msg.lower():
                return {
                    'status': 'error', 
                    'message': '🍪 Bot check detected!  Please update your cookies. txt file.\n'
                               'Export fresh cookies from your browser using "Get cookies.txt" extension.'
                }
            
            elif 'Cookies expired' in error_msg or 'cookies' in error_msg.lower():
                return {
                    'status': 'error',
                    'message': '🍪 Cookies expired or invalid!\n'
                               'Please export fresh cookies from your browser and replace cookies.txt'
                }
            
            elif 'Video unavailable' in error_msg or 'This video is unavailable' in error_msg:  
                return {'status': 'error', 'message': 'Video is unavailable or has been deleted'}
            
            elif 'Private video' in error_msg or 'private' in error_msg. lower():
                return {'status':  'error', 'message':  'This video is private.  Only public videos can be downloaded'}
            
            elif 'Login required' in error_msg or 'Sign in' in error_msg or 'login_required' in error_msg: 
                cookie_hint = ""
                if not os.path.exists(self.cookies_file):
                    cookie_hint = "\n🍪 Tip: Add cookies.txt file to download authenticated content"
                
                if platform == 'instagram':
                    return {'status': 'error', 'message': f'Instagram requires login. Try public posts only or the content may be age-restricted{cookie_hint}'}
                elif platform == 'facebook':  
                    return {'status':  'error', 'message':  f'Facebook requires login. Try public videos only{cookie_hint}'}
                else:
                    return {'status':  'error', 'message':  f'Login required. Try public content only{cookie_hint}'}
            
            elif 'not available' in error_msg.lower() or 'geo' in error_msg.lower():
                return {'status': 'error', 'message': 'Content not available in your region'}
            
            elif 'HTTP Error 403' in error_msg or '403' in error_msg:  
                cookie_msg = ""
                if not os. path.exists(self.cookies_file):
                    cookie_msg = " Try adding cookies.txt file."
                
                if platform == 'instagram':
                    return {'status': 'error', 'message': f'Instagram blocked the request.  Try again in a few minutes{cookie_msg}'}
                elif platform == 'facebook': 
                    return {'status': 'error', 'message': f'Facebook blocked the request. Try a different link{cookie_msg}'}
                else:
                    return {'status': 'error', 'message': f'Access denied. Try again later{cookie_msg}'}
            
            elif 'HTTP Error 404' in error_msg or '404' in error_msg:
                return {'status': 'error', 'message': 'Content not found (404). Check if the link is correct'}
            
            elif 'HTTP Error 429' in error_msg or '429' in error_msg or 'rate' in error_msg.lower():
                return {'status': 'error', 'message': 'Too many requests. Please wait a few minutes and try again'}
            
            elif 'HTTP Error 400' in error_msg or '400' in error_msg:
                return {'status': 'error', 'message': 'Invalid request.  Check if the link is correct'}
            
            elif 'Unsupported URL' in error_msg or 'No video formats found' in error_msg:
                return {'status': 'error', 'message': 'Your link is broken, please provide valid link'}
            
            elif 'consent' in error_msg.lower() or 'cookie' in error_msg.lower():
                return {'status': 'error', 'message': '🍪 Content requires consent. Please add cookies.txt file or try accessing from a browser first'}
            
            else: 
                return {'status': 'error', 'message': f'Unable to fetch:  {error_msg[: 100]}'}
        
        except Exception as e:  
            error_str = str(e)
            print(f"❌ Unexpected error:  {error_str}")
            
            if 'HTTP Error' in error_str:
                return {'status': 'error', 'message': 'Network error. Please try again'}
            elif 'timeout' in error_str.lower():
                return {'status': 'error', 'message': 'Request timed out. Check your connection'}
            else:
                return {'status': 'error', 'message': 'Your link is broken, please provide valid link'}
    
    def format_duration(self, seconds):
        """Convert seconds to MM:SS or HH:MM:SS"""
        if not seconds or seconds <= 0:
            return "Unknown"
        
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        
        if hours > 0:
            return f"{hours}:{minutes:02d}:{secs:02d}"
        else:  
            return f"{minutes}:{secs:02d}"
    
    def format_filesize(self, bytes):
        """Convert bytes to human readable format"""
        if not bytes or bytes == 0:
            return "Unknown size"
        
        for unit in ['B', 'KB', 'MB', 'GB']: 
            if bytes < 1024:
                return f"{bytes:.1f} {unit}"
            bytes /= 1024
        return f"{bytes:.1f} TB"
    
    def progress_hook(self, d, session_id):
        """Progress hook for yt-dlp"""
        if d['status'] == 'downloading':  
            # Calculate percentage
            if 'total_bytes' in d:  
                total = d['total_bytes']
            elif 'total_bytes_estimate' in d:
                total = d['total_bytes_estimate']
            else:
                total = None
            
            if total:   
                downloaded = d. get('downloaded_bytes', 0)
                percentage = int((downloaded / total) * 100)
            else:
                percentage = 0
            
            # Get speed
            speed = d.get('speed', 0)
            if speed:    
                speed_mb = speed / (1024 * 1024)  # Convert to MB/s
                speed_str = f"{speed_mb:.2f} MB/s"
            else:
                speed_str = "calculating..."
            
            # Store progress
            self.progress_data[session_id] = {
                'status': 'downloading',
                'percentage': percentage,
                'downloaded':  d.get('downloaded_bytes', 0),
                'total': total,
                'speed': speed_str,
                'eta': d.get('eta', 0)
            }
            
            print(f"📊 Progress: {percentage}% | Speed: {speed_str}")
        
        elif d['status'] == 'finished':
            self.progress_data[session_id] = {
                'status':  'finished',
                'percentage': 100,
                'message': 'Processing...'
            }
            print(f"✅ Download finished, processing...")
    
    def get_progress(self, session_id):
        """Get current progress for a session"""
        return self. progress_data.get(session_id, {'status': 'unknown', 'percentage': 0})
    
    def clear_progress(self, session_id):
        """Clear progress data for a session"""
        if session_id in self.progress_data:
            del self.progress_data[session_id]
    
    def cleanup_invalid_files(self, folder):
        """Remove . mhtml and other invalid files"""
        invalid_extensions = ['.mhtml', '.html', '.htm', '.txt', '.xml', '.part', '.ytdl', '.temp']
        
        if os.path.exists(folder):
            for file in os.listdir(folder):
                if any(file.endswith(ext) for ext in invalid_extensions):
                    try:
                        filepath = os.path.join(folder, file)
                        os. remove(filepath)
                        print(f"🗑️ Removed invalid file: {file}")
                    except Exception as e:
                        print(f"⚠️ Could not remove {file}: {e}")
    
    def find_media_file(self, folder, expected_filename=None):
        """Find actual media file in folder"""
        if not os.path.exists(folder):
            return None
        
        # Valid media extensions
        media_extensions = ['.mp4', '.mkv', '.webm', '.m4v', '.mov', '.avi', '.flv',
                          '. jpg', '.jpeg', '.png', '. gif', '.webp']
        
        # If expected filename provided, try variations
        if expected_filename:  
            base_name = os.path.splitext(expected_filename)[0]
            for ext in media_extensions:
                test_file = os.path.join(folder, base_name + ext)
                if os.path.exists(test_file):
                    return test_file
        
        # Find any media file in folder
        files = os.listdir(folder)
        for file in files:  
            if any(file.endswith(ext) for ext in media_extensions):
                filepath = os.path.join(folder, file)
                # Check if file size is reasonable (> 1KB)
                if os.path. getsize(filepath) > 1024:
                    return filepath
        
        return None
    
    def download_with_quality(self, url, path, session_id=None, format_id=None, platform=None):
        """Download video with specific quality"""
        try:
            # Base download options with cookies 🆕
            ydl_opts = self.get_base_ydl_opts()
            ydl_opts.update({
                'outtmpl': os.path.join(path, '%(title)s.%(ext)s'),
                'merge_output_format': 'mp4',
                'postprocessors': [{
                    'key': 'FFmpegVideoConvertor',
                    'preferedformat': 'mp4',
                }],
            })
            
            # Platform-specific configurations
            if platform == 'instagram':
                ydl_opts.update({
                    'format': 'best',
                    'extractor_args': {
                        'instagram': {
                            'api': ['graphql']
                        }
                    },
                })
                print("📸 Instagram download mode")
            
            elif platform == 'facebook': 
                ydl_opts.update({
                    'format': 'best',
                })
                print("📘 Facebook download mode")
            
            elif platform == 'tiktok':
                ydl_opts.update({
                    'format': 'best',
                    'extractor_args': {
                        'tiktok': {
                            'api_hostname':  'api22-normal-c-useast2a.tiktokv.com'
                        }
                    },
                })
                print("🎵 TikTok download mode")
            
            else:
                # For YouTube, Twitter, Reddit with quality selection
                if format_id:  
                    ydl_opts['format'] = f"{format_id}+bestaudio/best"
                    print(f"🎬 Downloading with format: {format_id}")
                else:
                    ydl_opts['format'] = 'best[height<=1080]/best'
                    print("🎬 Downloading best quality (up to 1080p)")
            
            # Add progress hook
            if session_id:  
                ydl_opts['progress_hooks'] = [lambda d:  self.progress_hook(d, session_id)]
            
            print(f"📥 Starting download: {url}")
            
            with yt_dlp. YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                
                if not info:
                    return {'status': 'error', 'message': 'Download failed - no info returned'}
                
                filename = ydl.prepare_filename(info)
                
                # Clean invalid files
                self.cleanup_invalid_files(path)
                
                # Find actual file
                actual_file = self.find_media_file(path, filename)
                
                if not actual_file:
                    print(f"❌ Media file not found in:  {path}")
                    print(f"Expected: {filename}")
                    print(f"Files in folder: {os.listdir(path) if os.path.exists(path) else 'Folder not found'}")
                    return {'status': 'error', 'message': 'Download completed but file not found'}
                
                filesize = os.path.getsize(actual_file)
                
                if filesize < 1024:
                    return {'status': 'error', 'message': 'Downloaded file is too small'}
                
                print(f"✅ Downloaded successfully: {os.path.basename(actual_file)}")
                print(f"📦 File size: {self.format_filesize(filesize)}")
                
                return {
                    'status': 'success',
                    'message': 'Video downloaded successfully! ',
                    'title': info.get('title', 'Unknown'),
                    'filename': os.path.basename(actual_file),
                    'filepath': actual_file,
                    'filesize': filesize,
                    'type': 'video'
                }
                
        except yt_dlp.utils. DownloadError as e:
            error_msg = str(e)
            print(f"❌ Download error: {error_msg}")
            
            # 🆕 Enhanced cookie error handling
            if 'Sign in to confirm you\'re not a bot' in error_msg or 'bot' in error_msg.lower():
                return {
                    'status': 'error',
                    'message': '🍪 Bot check failed! Update cookies.txt with fresh browser cookies.'
                }
            
            elif 'Cookies expired' in error_msg or 'rotated' in error_msg.lower():
                return {
                    'status': 'error',
                    'message': '🍪 Cookies expired!  Export fresh cookies from your browser.'
                }
            
            elif 'HTTP Error 429' in error_msg or 'rate' in error_msg. lower():
                return {'status': 'error', 'message': 'Rate limited. Please wait a few minutes'}
            
            elif 'HTTP Error 403' in error_msg: 
                cookie_hint = ""
                if not os. path.exists(self.cookies_file):
                    cookie_hint = " Try adding cookies.txt file."
                return {'status': 'error', 'message': f'Access denied. Content may be restricted{cookie_hint}'}
            
            elif 'login' in error_msg.lower() or 'Sign in' in error_msg:  
                cookie_hint = ""
                if not os. path.exists(self.cookies_file):
                    cookie_hint = " Add cookies.txt to download authenticated content."
                return {'status': 'error', 'message': f'Login required.  Content is private or age-restricted{cookie_hint}'}
            
            elif 'unavailable' in error_msg.lower():
                return {'status': 'error', 'message': 'Video unavailable'}
            
            else:
                return {'status': 'error', 'message': f'Download failed: {error_msg[:100]}'}
        
        except Exception as e: 
            error_str = str(e)
            print(f"❌ Unexpected download error: {error_str}")
            return {'status': 'error', 'message': f'Download error: {error_str[:100]}'}
    
    def download_content(self, url, download_path, session_id=None, format_id=None):
        """Main download function"""
        platform = self.detect_platform(url)
        
        # Initialize progress
        if session_id:
            self. progress_data[session_id] = {
                'status': 'starting',
                'percentage': 0,
                'message': 'Initializing download...'
            }
        
        print(f"\n{'='*60}")
        print(f"🚀 Starting download")
        print(f"Platform: {platform}")
        print(f"URL: {url}")
        print(f"Path: {download_path}")
        print(f"Session:  {session_id}")
        print(f"Format ID: {format_id}")
        print(f"{'='*60}\n")
        
        try:
            result = self.download_with_quality(url, download_path, session_id, format_id, platform)
            
            print(f"\n{'='*60}")
            print(f"Result: {result['status']}")
            print(f"Message: {result. get('message', 'N/A')}")
            print(f"{'='*60}\n")
            
            # Clear progress data after completion
            if session_id:  
                self.clear_progress(session_id)
            
            return result
            
        except Exception as e:
            print(f"❌ Unexpected error: {str(e)}")
            if session_id:
                self. clear_progress(session_id)
            return {'status': 'error', 'message': f'Unexpected error: {str(e)}'}