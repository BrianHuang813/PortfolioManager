"""Drops warrants, rights and units (mostly SPAC leftovers) from the ranked universe."""
import json
import re

DERIVATIVE = re.compile(
    r'\bwarrants?\b|\s-\s+(?:Share\s+|Contingent Value\s+)?(?:Rights?|Units?)\b(?!\s+(?:of|representing)\b)',
    re.I)


def is_derivative(company):
    return bool(company) and bool(DERIVATIVE.search(company))


def prune_derivatives(directory):
    """Remove derivatives from universe.json and price_history.json so the ranker never sees them."""
    data = directory / 'data'
    universe_file, prices_file = data / 'universe.json', data / 'price_history.json'
    universe = json.loads(universe_file.read_text(encoding='utf-8'))
    drop = {t for t, entry in universe.items() if is_derivative(entry.get('company'))}
    universe_file.write_text(json.dumps({t: e for t, e in universe.items() if t not in drop}), encoding='utf-8')
    prices = json.loads(prices_file.read_text(encoding='utf-8'))
    prices_file.write_text(json.dumps({t: e for t, e in prices.items() if t not in drop}), encoding='utf-8')
    return len(drop)
