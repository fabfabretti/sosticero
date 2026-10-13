import json
import sqlite3
from contextlib import contextmanager, closing

EMPTY = {k: {} for k in ('abs', 'cf', 'dis', 'disSites', 'asg', 'permessi', 'permitRequests', 'permitIds')}


class Store:
    def __init__(self, path):
        self.path = path
        with self.connect() as db:
            db.execute('PRAGMA journal_mode=WAL')
            db.execute('CREATE TABLE IF NOT EXISTS documents (key TEXT PRIMARY KEY, value TEXT NOT NULL)')

    @contextmanager
    def connect(self):
        with closing(sqlite3.connect(self.path, timeout=15)) as db, db:
            db.execute('PRAGMA busy_timeout=15000')
            yield db

    def read(self, db, key, default=None):
        row = db.execute('SELECT value FROM documents WHERE key=?', (key,)).fetchone()
        return json.loads(row[0]) if row else json.loads(json.dumps(default))

    def write(self, db, key, value):
        db.execute('INSERT INTO documents VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', (key, json.dumps(value)))
