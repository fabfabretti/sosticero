"""Legacy workflow clients read a baseline before each deliberate test action."""
from backend.tests.auth_client import AuthenticatedClient as RawClient
from backend import concurrency
from types import SimpleNamespace
from datetime import date


class TestClient(RawClient):
    def post(self, url, **kwargs):
        body = kwargs.get('json')
        route = str(url).split('?')[0].rsplit('/', 1)[-1]
        if isinstance(body, dict) and 'expected' not in body and route in ('entries', 'assignments', 'permessi', 'manual-permits'):
            day = body.get('day')
            response = self.get('/api/day/' + day if day else '/api/permessi')
            if response.status_code == 200:
                data = response.json()
                tokens = data['concurrency']['records']
                if route == 'entries':
                    e = SimpleNamespace(day=date.fromisoformat(day), future=body.get('future', False), until=date.fromisoformat(body['until']) if body.get('until') else None, group=body['group'])
                    refs = [concurrency.key(e.group, d, body['id']) for d in concurrency.entry_days(e, data['state'])]
                elif route == 'assignments':
                    refs = [concurrency.key('asg', day, k) for k in (body['key'], body.get('replace_key')) if k]
                elif route == 'permessi':
                    refs = [concurrency.key('permessi', day, body['id'])]
                    if body.get('original_day'):
                        refs.append(concurrency.key('permessi', body['original_day'], body['original_id']))
                else:
                    refs = [concurrency.key('manualPermits', '', body['id'])]
                kwargs['json'] = dict(body, expected={k: tokens.get(k, 'absent') for k in refs})
        if route == 'hour-types' and isinstance(body, dict) and 'expected' not in body:
            versions = self.get('/api/hour-types').json().get('versions', {})
            kwargs['json'] = dict(body, expected=versions.get(body.get('id')))
        if str(url) == '/api/inbox/connection' and isinstance(body, dict) and 'expected' not in body:
            kwargs['json'] = dict(body, expected=self.get('/api/inbox/connection').json()['version'])
        if str(url) == '/api/inbox/credentials':
            headers = dict(kwargs.get('headers', {}))
            headers['X-Record-Version'] = self.get('/api/inbox/connection').json()['version']
            kwargs['headers'] = headers
        return super().post(url, **kwargs)
