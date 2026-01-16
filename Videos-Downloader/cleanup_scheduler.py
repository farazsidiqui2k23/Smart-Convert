from apscheduler.schedulers.background import BackgroundScheduler
from session_manager import SessionManager
import atexit

class CleanupScheduler:
    """Background job scheduler for session cleanup"""
    
    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self.scheduler.start()
        
        # Shutdown scheduler on app exit
        atexit.register(lambda: self.scheduler.shutdown())
    
    def start(self):
        """Start cleanup jobs"""
        # Run cleanup every 2 minutes
        self.scheduler.add_job(
            func=self.cleanup_expired_sessions,
            trigger='interval',
            minutes=2,
            id='cleanup_job',
            name='Cleanup expired sessions',
            replace_existing=True
        )
        
        print("🧹 Cleanup scheduler started (runs every 2 minutes)")
    
    @staticmethod
    def cleanup_expired_sessions():
        """Clean up all expired sessions"""
        expired_sessions = SessionManager.get_expired_sessions()
        
        if expired_sessions:
            print(f"\n🧹 Found {len(expired_sessions)} expired sessions")
            
            for session_id in expired_sessions:
                success = SessionManager.cleanup_session(session_id)
                if success:
                    print(f"  ✅ Cleaned session:  {session_id}")
                else:
                    print(f"  ⏳ Skipped (download in progress): {session_id}")
        else:
            print("✨ No expired sessions to clean")