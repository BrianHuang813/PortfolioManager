import json
import pytest
from universe import is_derivative, prune_derivatives


@pytest.mark.parametrize('name', [
    'Abony Acquisition Corp. I - Warrant',
    'Aclarion, Inc. - Warrant',
    'Rigetti Computing, Inc.  - Redeemable warrants, each whole warrant exercisable for one Class A ordinary share',
    'Aeon Acquisition I Corp. - Rights',
    'Centurion Acquisition Corp. - Units',
    'Hennessy Capital Investment Corp. VIII - Share Rights',
    'Gen Digital Inc. - Contingent Value Rights',
])
def test_derivatives_are_detected(name):
    assert is_derivative(name)


@pytest.mark.parametrize('name', [
    'Plains All American Pipeline, L.P. - Common Units representing Limited Partner Interests',
    'Energy Transfer LP Common Units',
    'Marine Petroleum Trust - Units of Beneficial Interest',
    'Hubbell Inc Common Stock',
    'Under Armour, Inc. Class C Common Stock',
    '',
    None,
])
def test_real_securities_are_kept(name):
    assert not is_derivative(name)


def test_prune_removes_derivatives_from_universe_and_prices(tmp_path):
    (tmp_path / 'data').mkdir()
    universe = {'AAPL': {'company': 'Apple Inc. Common Stock'}, 'ACONW': {'company': 'Aclarion, Inc. - Warrant'}}
    prices = {'AAPL': {'candles': []}, 'ACONW': {'candles': []}}
    (tmp_path / 'data/universe.json').write_text(json.dumps(universe))
    (tmp_path / 'data/price_history.json').write_text(json.dumps(prices))

    prune_derivatives(tmp_path)

    assert list(json.loads((tmp_path / 'data/universe.json').read_text())) == ['AAPL']
    assert list(json.loads((tmp_path / 'data/price_history.json').read_text())) == ['AAPL']
