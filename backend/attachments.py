"""Validated raster attachments stored alongside their source records."""
import base64
import binascii
import re
import warnings
from io import BytesIO
from uuid import uuid4

from PIL import Image, UnidentifiedImageError

GROUPS = {'absenceAttachments': 'abs', 'permitAttachments': 'permessi', 'disAttachments': 'dis'}
MAX_BYTES = 5_242_880
MAX_PIXELS = 25_000_000


def validate(value):
    if not isinstance(value, dict) or set(value) != {'mediaType', 'data'}:
        raise ValueError('Allegato non valido.')
    media = value['mediaType']
    encoded = value['data']
    if media not in ('image/png', 'image/jpeg') or not isinstance(encoded, str) or len(encoded) > 4 * ((MAX_BYTES + 2) // 3):
        raise ValueError('Allegato: usa PNG o JPEG, massimo 5 MiB.')
    try:
        content = base64.b64decode(encoded, validate=True)
        if not content or len(content) > MAX_BYTES:
            raise ValueError('Allegato: massimo 5 MiB.')
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as image:
                if image.format != {'image/png': 'PNG', 'image/jpeg': 'JPEG'}[media] or image.width * image.height > MAX_PIXELS or getattr(image, 'n_frames', 1) != 1:
                    raise ValueError('Immagine non valida, animata o oltre 25 megapixel.')
                image.verify()
            with Image.open(BytesIO(content)) as image:
                image.load()
    except (binascii.Error, UnicodeEncodeError, OSError, SyntaxError, UnidentifiedImageError, Image.DecompressionBombWarning, Image.DecompressionBombError) as exc:
        raise ValueError('Immagine non valida.') from exc
    return media, content


def insert(db, value):
    if value is None:
        return None
    media, content = validate(value)
    identifier = uuid4().hex
    db.execute('INSERT INTO attachments VALUES (?,?,?)', (identifier, media, content))
    return identifier


def references(state):
    return {identifier for group in GROUPS for teachers in state.get(group, {}).values() for identifier in teachers.values()}


def prune(db, state):
    used = references(state)
    for (identifier,) in db.execute('SELECT id FROM attachments').fetchall():
        if identifier not in used:
            db.execute('DELETE FROM attachments WHERE id=?', (identifier,))


def export(db, state):
    used = references(state)
    return {identifier: dict(mediaType=media, data=base64.b64encode(content).decode('ascii'))
            for identifier, media, content in db.execute('SELECT id, media_type, content FROM attachments') if identifier in used}


def import_images(db, state, data, schema):
    images = data.get('attachments', {})
    if schema < 3 and (images or any(data.get(group) for group in GROUPS)):
        raise ValueError('Gli allegati richiedono schema 3.')
    if not isinstance(images, dict):
        raise ValueError('Archivio allegati non valido.')
    for group, source in GROUPS.items():
        for day, teachers in state[group].items():
            for teacher, identifier in teachers.items():
                if teacher not in state[source].get(day, {}) or not isinstance(identifier, str) or re.fullmatch(r'[0-9a-f]{32}', identifier) is None:
                    raise ValueError('Riferimento allegato non valido.')
    if set(images) != references(state):
        raise ValueError('Allegati mancanti o senza registrazione.')
    validated = [(identifier, *validate(value)) for identifier, value in images.items()]
    db.execute('DELETE FROM attachments')
    db.executemany('INSERT INTO attachments VALUES (?,?,?)', validated)
