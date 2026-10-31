"""Small Pages Direct Upload adapter; protocol matches Cloudflare's Wrangler uploader."""
import base64
import hashlib
import json
import mimetypes
import os
import re
import time

import requests
from blake3 import blake3


class UploadError(Exception):
    pass


class Cloudflare:
    def __init__(self):
        self.account = os.environ.get('CLOUDFLARE_ACCOUNT_ID', '')
        self.token = os.environ.get('CLOUDFLARE_API_TOKEN', '')
        self.project = os.environ.get('CLOUDFLARE_PAGES_PROJECT', '')
        self.branch = os.environ.get('CLOUDFLARE_PAGES_BRANCH', 'main')
        self.url = f'https://{self.project}.pages.dev'
        self.path = f'/accounts/{self.account}/pages/projects/{self.project}'

    @property
    def configured(self):
        return bool(re.fullmatch(r'[0-9a-f]{32}', self.account) and self.token and
                    re.fullmatch(r'[a-z0-9][a-z0-9-]{0,57}', self.project) and self.branch)

    def api(self, method, path, token=None, **kwargs):
        try:
            response = requests.request(method, 'https://api.cloudflare.com/client/v4' + path,
                headers={'Authorization': 'Bearer ' + (token or self.token)}, timeout=(10, 30),
                allow_redirects=False, **kwargs)
            response.raise_for_status()
            data = response.json()
            if not data.get('success'):
                raise UploadError('Cloudflare ha rifiutato la richiesta.')
            return data.get('result')
        except (requests.RequestException, ValueError, KeyError) as exc:
            raise UploadError('Richiesta Cloudflare non riuscita. Verifica connessione e credenziali.') from exc

    def upload(self, files, release, activating):
        jwt = self.api('GET', self.path + '/upload-token')['jwt']
        assets = {}
        manifest = {}
        for name, content in files.items():
            if name.startswith('_'):
                continue
            encoded = base64.b64encode(content).decode()
            key = blake3((encoded + name.rsplit('.', 1)[-1]).encode()).hexdigest()[:32]
            manifest['/' + name] = key
            assets[key] = dict(key=key, value=encoded, base64=True,
                metadata=dict(contentType=mimetypes.guess_type(name)[0] or 'application/octet-stream'))
        if sum(len(x['value']) for x in assets.values()) > 12 * 1024 * 1024 or len(assets) > 100:
            raise UploadError('Pubblicazione troppo grande.')
        missing = self.api('POST', '/pages/assets/check-missing', token=jwt, json={'hashes': list(assets)})
        if missing:
            self.api('POST', '/pages/assets/upload', token=jwt, json=[assets[key] for key in missing])
        self.api('POST', '/pages/assets/upsert-hashes', token=jwt, json={'hashes': list(assets)})
        form = {k: (k, v) for k, v in files.items() if k in ('_headers', '_redirects')}
        # Persist uncertainty before the request that can activate a new public release.
        activating()
        return self.api('POST', self.path + '/deployments',
            data={'manifest': json.dumps(manifest), 'branch': self.branch, 'commit_message': release}, files=form)['id']

    def verify(self, files, release, seconds=60):
        deadline = time.monotonic() + seconds
        while True:
            try:
                for name in ('release.json', 'centrale.json', 'succursale.json'):
                    response = requests.get(self.url + '/' + name, params={'verify': release, 't': time.time_ns()},
                        headers={'Cache-Control': 'no-cache'}, timeout=(5, 8), allow_redirects=False)
                    response.raise_for_status()
                    if hashlib.sha256(response.content).digest() != hashlib.sha256(files[name]).digest():
                        raise ValueError('Release mismatch')
                return True
            except (requests.RequestException, ValueError):
                if time.monotonic() >= deadline:
                    return False
                time.sleep(min(2, max(0, deadline - time.monotonic())))

    def deployment_failed(self, pending):
        deployments = self.api('GET', self.path + '/deployments', params={'per_page': 25})
        matching = [d for d in deployments if d.get('id') == pending.get('deployment') or
                    d.get('deployment_trigger', {}).get('metadata', {}).get('commit_message') == pending['release']]
        return bool(matching and all(d.get('latest_stage', {}).get('status') in ('failure', 'canceled') for d in matching))
