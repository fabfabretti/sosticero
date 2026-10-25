"""Authenticated test transport; explicit security tests use FastAPI's raw client."""
import secrets
from fastapi.testclient import TestClient as RawClient

_credentials = {}

class AuthenticatedClient(RawClient):
    def __init__(self, app, *args, campus='centrale', **kwargs):
        kwargs.setdefault('base_url','http://localhost')
        super().__init__(app,*args,**kwargs)
        identities = app.state.identities
        self._identities, self._test_app, self._campus = identities, app, campus
        app.state.test_passwords = _credentials.setdefault(str(identities.path), {})
        if campus not in app.state.test_passwords:
            password = secrets.token_urlsafe(24)
            try: identities.create('test-'+campus,'Test '+campus,campus,password)
            except ValueError: identities.change('test-'+campus,'password',password)
            app.state.test_passwords[campus] = password
        self.headers['Origin'] = 'http://localhost'
        result = super().post('/api/auth/login',json=dict(username='test-'+campus,password=app.state.test_passwords[campus]))
        result.raise_for_status()
        self.headers['X-CSRF-Token'] = result.json()['csrf']
        self.headers['X-Data-Generation'] = str(result.json()['generation'])

    def request(self, method, url, **kwargs):
        if hasattr(self,'_identities') and str(url).startswith('/api/') and '/auth/' not in str(url):
            headers = dict(kwargs.get('headers') or {})
            headers.setdefault('X-Data-Generation', str(self._identities.generation()))
            kwargs['headers'] = headers
        response = super().request(method,url,**kwargs)
        if response.status_code == 401 and '/auth/' not in str(url) and hasattr(self,'_identities'):
            login = super().request('POST','/api/auth/login',json=dict(username='test-'+self._campus,password=self._test_app.state.test_passwords[self._campus]))
            login.raise_for_status()
            self.headers['X-CSRF-Token'] = login.json()['csrf']
            response = super().request(method,url,**kwargs)
        if 'x-data-generation' in response.headers:
            self.headers['X-Data-Generation'] = response.headers['x-data-generation']
        return response
