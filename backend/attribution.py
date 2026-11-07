"""Historical account snapshots; campus context is never an author permission."""

CAMPUSES = ('centrale', 'succursale')


def snapshot(account):
    return {key: account[key] for key in ('id', 'username', 'name')}


def resolve(author, accounts=None):
    """Display current identity by ID; keep stored snapshots as portable fallbacks."""
    if isinstance(author, dict) and accounts and author.get('id') in accounts:
        return snapshot(accounts[author['id']])
    return author


def valid(value):
    if isinstance(value, str): return value in CAMPUSES
    return (isinstance(value, dict) and set(value) == {'id', 'username', 'name'}
            and (value['id'] is None or isinstance(value['id'], str) and 1 <= len(value['id']) <= 64)
            and isinstance(value['username'], str) and len(value['username']) <= 64
            and isinstance(value['name'], str) and 1 <= len(value['name'].strip()) <= 100)


def migrate(state, identities=None, mappings=None):
    identities, mappings = identities or {}, mappings or {}
    changed = False

    def author(value, identifier=None, known=False):
        if isinstance(value, dict): return value
        if known:
            # An explicitly unknown creator must not acquire invented authorship.
            return identities.get(identifier, dict(id=identifier, username='', name='Autore non disponibile'))
        return mappings.get(value, dict(id=None, username='', name={'centrale':'Centrale (account storico)', 'succursale':'Succursale (account storico)'}.get(value, 'Autore non disponibile')))

    for entries in state.get('permitCreators', {}).values():
        for key, value in entries.items():
            if isinstance(value, str) and value in CAMPUSES: entries[key] = author(value); changed = True
    for entries in state.get('paidAvailability', {}).values():
        for records in entries.values():
            if not isinstance(records, dict): continue
            for record in records.values():
                if isinstance(record.get('createdFrom'), str):
                    record['createdFrom'] = author(record['createdFrom'],record.get('createdBy'),known=True)
                    changed = True
    for entries in state.get('asg', {}).values():
        for record in entries.values():
            if isinstance(record.get('assignedBy'), str) and record['assignedBy'] in CAMPUSES:
                record['assignedBy'] = author(record['assignedBy']); changed = True
    return changed
