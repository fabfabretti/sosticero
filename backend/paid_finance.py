"""Optional funding and recalculable per-assignment prices, in euro cents."""
from . import timetables, appointments

SITES = ('centrale', 'succursale')
CLASSES = ('laureato', 'diplomato')
MAX_CENTS = 999999999999  # Keep money and sums within ordinary UI precision.


def empty():
    return dict(sites={s: dict(budget=None, laureato=None, diplomato=None) for s in SITES}, overrides={})


def cents(value):
    return type(value) is int and 0 <= value <= MAX_CENTS


def validate(config, teachers):
    if not isinstance(config, dict) or set(config) != {'sites', 'overrides'} or not isinstance(config['sites'], dict) or set(config['sites']) != set(SITES) or not isinstance(config['overrides'], dict):
        raise ValueError('Configurazione economica non valida.')
    for entry in config['sites'].values():
        if not isinstance(entry, dict) or set(entry) != {'budget', *CLASSES} or any(v is not None and not cents(v) for v in entry.values()):
            raise ValueError('Importi non validi: usa centesimi interi non negativi.')
    if any(i not in teachers or v not in CLASSES for i, v in config['overrides'].items()):
        raise ValueError('Classificazione economica docente non valida.')
    return config


def validate_prices(state):
    for entries in state['asg'].values():
        for a in entries.values():
            if 'paidPrice' not in a:
                continue
            p = a['paidPrice']
            if a.get('t') != 'PAID' or not isinstance(p, dict) or set(p) != {'cents', 'classification'} or not cents(p['cents']) or p['classification'] not in CLASSES:
                raise ValueError('Costo assegnazione a pagamento non valido.')


def price(assignment, teachers, config):
    teacher = teachers.get(assignment['v'])
    site = assignment.get('paidContext', {}).get('site')
    if not teacher or site not in SITES:
        return False
    classification = config['overrides'].get(assignment['v'], 'diplomato' if teacher.get('role', '').upper() == 'ITP' else 'laureato')
    rate = config['sites'][site][classification]
    if rate is None:
        return False
    assignment['paidPrice'] = dict(cents=rate, classification=classification)
    return True


def recalculate(history, state, config):
    catalog = appointments.catalog(history) if history else {}
    count = 0
    for day, entries in state['asg'].items():
        teachers = dict(catalog, **timetables.dataset(history, day)['teachers']) if history else catalog
        for a in entries.values():
            if a.get('t') == 'PAID':
                previous = a.pop('paidPrice', None)
                price(a, teachers, config)
                count += previous != a.get('paidPrice')
    return count


def summary(state, config):
    def total(sites, budget):
        assignments = [a for entries in state['asg'].values() for a in entries.values() if a.get('t') == 'PAID' and a.get('paidContext', {}).get('site') in sites]
        cost = sum(a['paidPrice']['cents'] for a in assignments if 'paidPrice' in a)
        return dict(cost=cost, unpriced=sum('paidPrice' not in a for a in assignments), budget=budget,
                    remaining=None if budget is None else budget-cost,
                    percent=cost*100/budget if budget else None)
    sites = {s: total([s], config['sites'][s]['budget']) for s in SITES}
    configured = [s for s in SITES if sites[s]['budget'] is not None]
    return dict(sites=sites, overall=total(configured, sum(sites[s]['budget'] for s in configured)) if configured else None,
                configured=configured, all=total(SITES, None))


def warning(state, config, site):
    if site not in SITES:
        return None
    result = summary(state, config)['sites'][site]
    if result['remaining'] is not None and result['remaining'] < 0:
        amount = f"{-result['remaining']/100:.2f}".replace('.', ',')
        return f"Budget {site.capitalize()} superato di € {amount}. Assegnazione salvata."
    return None
