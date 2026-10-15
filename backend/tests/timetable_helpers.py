"""Exercise the public preview/confirm flow in timetable replacement tests."""
from datetime import date, timedelta


def import_version(client, raw, effective='2026-10-12'):
    preview = client.post('/api/timetable/preview', params={'effective': effective}, json=raw)
    if preview.status_code != 200:
        return preview
    return client.post('/api/timetable', params=dict(effective=effective, token=preview.json()['token'], confirm='true'), json=raw)
