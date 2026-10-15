import os
import json
import sqlite3
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple


def _parse_timestamp_from_filename(filename: str) -> Optional[datetime]:
    """Parse backup timestamp from filename.
    
    Expected format: supplenze-YYYY-MM-DDTHH-MM-SS.sqlite
    """
    try:
        # Remove extension and prefix
        if not filename.startswith('supplenze-') or not filename.endswith('.sqlite'):
            return None
        ts_str = filename[10:-7].split('_', 1)[0]  # Remove 'supplenze-' and '.sqlite'
        # Handle format with hyphens (filesystem safe)
        # Try various formats
        for fmt in ['%Y-%m-%dT%H-%M-%S.%f', '%Y-%m-%dT%H-%M-%S', '%Y-%m-%dT%H%M%S', '%Y%m%dT%H%M%S']:
            try:
                return datetime.strptime(ts_str, fmt)
            except ValueError:
                continue
        # Try direct parse if it's ISO format with colons replaced
        return None
    except Exception:
        return None


def _format_timestamp(dt: datetime) -> str:
    """Format timestamp for backup filename."""
    return dt.strftime('%Y-%m-%dT%H-%M-%S')


def _is_valid_sqlite(db_path: Path) -> bool:
    """Check if a file is a valid SQLite database."""
    try:
        conn = sqlite3.connect(str(db_path))
        cur = conn.cursor()
        cur.execute("SELECT sqlite_version()")
        cur.fetchone()
        conn.close()
        return True
    except Exception:
        return False


def backup_database(db_path: str, backup_dir: str) -> Dict:
    """Create a backup of the database using SQLite backup API.
    
    Args:
        db_path: Path to source database
        backup_dir: Directory to store backups
        
    Returns:
        Dict with backup info (filename, size, created_at, path)
    """
    db_path = Path(db_path)
    backup_dir = Path(backup_dir)
    backup_dir.mkdir(parents=True, exist_ok=True)
    
    # Create timestamped filename
    now = datetime.now()
    fd, reserved = tempfile.mkstemp(prefix=f'supplenze-{now.strftime("%Y-%m-%dT%H-%M-%S.%f")}_', suffix='.sqlite', dir=backup_dir)
    os.close(fd)
    backup_path = Path(reserved)
    filename = backup_path.name
    
    # Use SQLite backup API for consistency
    src_conn = sqlite3.connect(str(db_path))
    try:
        dst_conn = sqlite3.connect(str(backup_path))
        try:
            src_conn.backup(dst_conn)
            if dst_conn.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
                raise ValueError('Backup database integrity check failed.')
        except Exception:
            backup_path.unlink(missing_ok=True)
            raise
        finally:
            dst_conn.close()
    finally:
        src_conn.close()
    
    # Get backup info
    stat = backup_path.stat()
    return {
        'filename': filename,
        'size': stat.st_size,
        'created_at': now.isoformat(),
        'path': str(backup_path)
    }


def list_backups(backup_dir: str) -> List[Dict]:
    """List all backups in the backup directory.
    
    Returns:
        List of backup info dicts, sorted by creation time descending
    """
    backup_dir = Path(backup_dir)
    if not backup_dir.exists():
        return []
    
    backups = []
    for f in backup_dir.glob('supplenze-*.sqlite'):
        ts = _parse_timestamp_from_filename(f.name)
        if ts:
            try:
                stat = f.stat()
                backups.append({
                    'filename': f.name,
                    'size': stat.st_size,
                    'created_at': ts.isoformat(),
                    'path': str(f)
                })
            except Exception:
                continue
    
    # Sort by creation time descending
    backups.sort(key=lambda x: x['created_at'], reverse=True)
    return backups


def prune_backups(backup_dir: str, retention_count: int = 10, retention_days: int = 7) -> int:
    """Prune old backups according to retention policy.
    
    Keep backups where (age < retention_days) OR (index < retention_count)
    in terms of recency? The spec says: "keep last N days OR last M backups,
    whichever is greater" - meaning keep backups that are either recent enough
    by days OR are among the most recent M. So a backup is kept if it's newer
    than retention_days ago, OR if it's in the top retention_count by recency.
    
    Args:
        backup_dir: Directory containing backups
        retention_count: Number of most recent backups to always keep
        retention_days: Age threshold in days
        
    Returns:
        Number of backups deleted
    """
    backups = list_backups(backup_dir)
    if not backups:
        return 0
    
    now = datetime.now()
    cutoff = now - timedelta(days=retention_days)
    to_keep = set()
    deleted = 0
    
    # Keep all backups that are among the most recent retention_count OR newer than cutoff
    for i, b in enumerate(backups):
        try:
            created = datetime.fromisoformat(b['created_at'])
        except Exception:
            created = None
        # Retention policy: keep if in top retention_count OR created > cutoff (newer than N days ago)
        if i < retention_count or (created and created > cutoff):
            to_keep.add(b['filename'])
    
    # Delete backups not in to_keep
    backup_dir = Path(backup_dir)
    for b in backups:
        if b['filename'] not in to_keep:
            try:
                (backup_dir / b['filename']).unlink()
                deleted += 1
            except Exception:
                continue
    
    return deleted


def restore_backup(db_path: str, backup_path: str) -> bool:
    """Restore database from backup.
    
    Args:
        db_path: Path to target database
        backup_path: Path to backup file
        
    Returns:
        True if successful
    """
    db_path = Path(db_path)
    backup_path = Path(backup_path)
    
    # Validate backup
    if not backup_path.exists():
        raise FileNotFoundError(f'Backup not found: {backup_path}')
    if not _is_valid_sqlite(backup_path):
        raise ValueError('Invalid or corrupted backup file')
    
    # SQLite coordinates the restore with WAL readers and commits it atomically.
    from contextlib import closing
    with closing(sqlite3.connect(str(backup_path))) as source:
        with closing(sqlite3.connect(str(db_path), timeout=15)) as destination:
            source.backup(destination)
    return True
