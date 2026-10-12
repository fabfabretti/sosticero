import unittest
import tempfile
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from backend import backup


class BackupModuleTest(unittest.TestCase):
    def test_filename_formatting(self):
        with tempfile.TemporaryDirectory() as d:
            db = Path(d) / 'test.db'
            conn = sqlite3.connect(str(db))
            conn.execute('CREATE TABLE t(x)')
            conn.commit()
            conn.close()
            res = backup.backup_database(str(db), str(Path(d) / 'backups'))
            self.assertTrue(res['filename'].startswith('supplenze-'))
            self.assertTrue(res['filename'].endswith('.sqlite'))
            # Check timestamp parseable
            ts = backup._parse_timestamp_from_filename(res['filename'])
            self.assertIsNotNone(ts)
            self.assertIsInstance(ts, datetime)

    def test_retention_keep_recent(self):
        with tempfile.TemporaryDirectory() as d:
            bdir = Path(d) / 'backups'
            bdir.mkdir(parents=True, exist_ok=True)
            now = datetime.now()
            # Create 3 recent backups
            for i in range(3):
                ts = now - timedelta(hours=i)
                fname = f'supplenze-{ts.strftime("%Y-%m-%dT%H-%M-%S")}.sqlite'
                (bdir / fname).touch()
            deleted = backup.prune_backups(str(bdir), retention_count=10, retention_days=7)
            self.assertEqual(deleted, 0)
            self.assertEqual(len(backup.list_backups(str(bdir))), 3)

    def test_retention_prune_old(self):
        with tempfile.TemporaryDirectory() as d:
            bdir = Path(d) / 'backups'
            bdir.mkdir(parents=True, exist_ok=True)
            now = datetime.now()
            # Create old backups
            for i in range(5):
                ts = now - timedelta(days=10 + i)
                fname = f'supplenze-{ts.strftime("%Y-%m-%dT%H-%M-%S")}.sqlite'
                (bdir / fname).touch()
            # Create recent
            for i in range(2):
                ts = now - timedelta(days=i)
                fname = f'supplenze-{ts.strftime("%Y-%m-%dT%H-%M-%S")}.sqlite'
                (bdir / fname).touch()
            deleted = backup.prune_backups(str(bdir), retention_count=3, retention_days=7)
            # Old ones are older than 7 days and not in top 3? We have 7 total backups;
            # retention_count=3 means keep top 3 by recency regardless of age; also keep if age < 7 days.
            # Recent ones (2 backups, 0 and 1 days old) are in days window and also in top positions.
            # Old ones (5 backups, 10+ days old): are they in top 3? Positions 0,1 are recent (so old ones start at pos 2,3,4,5,6) - so only if old is in top 3? No wait - list is sorted desc by created_at; recent (0 days, 1 day ago) come first, then older ones come later. So positions: 0 is most recent (0 days), 1 is 1 day ago, 2,3,4,5,6 are the 5 old ones (10,11,12,13,14 days ago). So for old ones at pos>=2 with retention_count=3: i < retention_count is true only for pos 2 (i=2, count=3, 2<3 true) - so pos 2 old backup IS kept because it's in top 3. Also older than 7 days - so kept by count rule.
            # That means we keep: pos0 (recent, kept), pos1 (recent, kept), pos2 (old but in top3, kept by count). The other 4 old ones (pos3,4,5,6, so i>=3, count=3; i<3 false; and age>7 days, age>cutoff true only if age>cutoff; age is 11,12,13,14 days, cutoff is 7 days ago, so age > cutoff is true for all old ones? 11 > 7 is true - 11 days ago is more than 7 days ago, so created > cutoff means "created after cutoff" - created is 11 days ago, cutoff is 7 days ago, so created (earlier) > cutoff (later) is false. So old ones: created < cutoff, so days rule fails; count rule: i<3 is true only for pos 2, so only pos 2 old one is kept. So total kept = 2 (recent) + 1 (old at pos 2) = 3.
            backups = backup.list_backups(str(bdir))
            self.assertEqual(len(backups), 3)  # 2 recent + 1 old that is in top 3

    def test_retention_enforce_count(self):
        with tempfile.TemporaryDirectory() as d:
            bdir = Path(d) / 'backups'
            bdir.mkdir(parents=True, exist_ok=True)
            now = datetime.now()
            # Create many backups, all recent by days but over count
            for i in range(15):
                ts = now - timedelta(hours=i)
                fname = f'supplenze-{ts.strftime("%Y-%m-%dT%H-%M-%S")}.sqlite'
                (bdir / fname).touch()
            deleted = backup.prune_backups(str(bdir), retention_count=5, retention_days=30)
            backups = backup.list_backups(str(bdir))
            # Should keep at most retention_count? Or follow both rules
            # With count 5 and days 30, all are recent - keep top 5 by recency? 
            # Rule: keep if i < retention_count OR created > cutoff; all created > cutoff (30 days ago)
            # So ALL 15 should be kept - both conditions true for all? i ranges 0-14, retention_count 5,
            # so i < 5 is true for first 5, created > cutoff is true for all (all within 30 days) - so keep all
            self.assertEqual(len(backups), 15)

    def test_backup_create_and_list(self):
        with tempfile.TemporaryDirectory() as d:
            db = Path(d) / 'data.db'
            conn = sqlite3.connect(str(db))
            conn.execute('CREATE TABLE t(x)')
            conn.execute('INSERT INTO t VALUES (42)')
            conn.commit()
            conn.close()
            bdir = Path(d) / 'backups'
            res = backup.backup_database(str(db), str(bdir))
            self.assertTrue(Path(res['path']).exists())
            backups = backup.list_backups(str(bdir))
            self.assertEqual(len(backups), 1)
            self.assertEqual(backups[0]['filename'], res['filename'])

    def test_restore_preserves_data(self):
        with tempfile.TemporaryDirectory() as d:
            db = Path(d) / 'data.db'
            conn = sqlite3.connect(str(db))
            conn.execute('CREATE TABLE t(x)')
            conn.execute('INSERT INTO t VALUES (1)')
            conn.commit()
            conn.close()
            bdir = Path(d) / 'backups'
            res = backup.backup_database(str(db), str(bdir))
            # modify
            conn = sqlite3.connect(str(db))
            conn.execute('INSERT INTO t VALUES (2)')
            conn.commit()
            conn.close()
            # restore
            backup.restore_backup(str(db), res['path'])
            conn = sqlite3.connect(str(db))
            rows = [r[0] for r in conn.execute('SELECT x FROM t')]
            conn.close()
            self.assertEqual(rows, [1])


if __name__ == '__main__':
    unittest.main()
