import json
from pathlib import Path
import sys
import types
import numpy as np
import pandas as pd
from pipeline import build, parse_nasdaq100, publish, read_inputs
from rs_history import load_history


def fixture_data(path, monkeypatch):
    for directory in ('data', 'data_persist', 'output'):
        (path / directory).mkdir(parents=True)
    dates = pd.bdate_range('2024-01-01', periods=400)
    benchmark = np.r_[np.linspace(80, 120, 376), np.linspace(119, 105, 24)]
    prices = {'SPY': benchmark}
    for i in range(60):
        prices[f'T{i:02}'] = np.linspace(30 + i, 60 + 3 * i, 400)
    prices['IPO'] = np.linspace(50, 60, 150)
    data, metadata = {}, {}
    for ticker, values in prices.items():
        candles = [dict(datetime=int(day.timestamp()), close=float(value), high=float(value), low=float(value), volume=5000000) for day, value in zip(dates[-len(values):], values)]
        data[ticker] = dict(candles=candles, industry='Software' if ticker != 'SPY' else 'Reference', sector='Technology' if ticker != 'SPY' else 'Reference', universe='NASDAQ')
        metadata[ticker] = {'info': dict(sector=data[ticker]['sector'], industry=data[ticker]['industry'], shortName=f'Company {ticker}', exchange='NASDAQ')}
    (path / 'data/price_history.json').write_text(json.dumps(data))
    (path / 'data/universe.json').write_text(json.dumps({**data, 'FAILED': {'universe': 'NASDAQ'}}))
    (path / 'data_persist/ticker_info.json').write_text(json.dumps(metadata))
    # Execute the ENTIRE original ranker against this exact same input/universe.
    stub = types.ModuleType('rs_data')
    stub.TD_API = ''
    stub.cfg = lambda key: {'MIN_PERCENTILE': 0, 'REFERENCE_TICKER': 'SPY', 'USE_ALL_LISTED_STOCKS': True, 'SP500': True, 'SP400': True, 'SP600': True, 'NQ100': True}.get(key)
    stub.read_json = lambda name: json.loads(Path(name).read_text())
    monkeypatch.setitem(sys.modules, 'rs_data', stub)
    monkeypatch.chdir(path)
    (path / 'config.yaml').write_text('{}')
    source = Path(__file__).resolve().parents[1] / 'vendor/fred/rs_ranking.py'
    namespace = {'__file__': str(path / 'rs_ranking.py'), '__name__': 'fred_baseline'}
    exec(compile(source.read_text(encoding='utf-8'), str(source), 'exec'), namespace)
    namespace['rankings']()
    return dates


def test_full_original_pipeline_outputs_and_repeat(tmp_path, monkeypatch, config):
    dates = fixture_data(tmp_path, monkeypatch)
    history_path = tmp_path / 'history/leadership_history.parquet'
    frame, state, history = build(tmp_path, config, history_path)
    assert state['utility_window'] == 24
    original = pd.read_csv(tmp_path / 'output/rs_stocks.csv').set_index('Ticker')
    actual = frame.set_index('Ticker')
    # 60 full-history tickers match original Fred qcut exactly, including the
    # contribution of IPO/reference entries to its cross-sectional universe.
    for ticker in [f'T{i:02}' for i in range(60)]:
        assert actual.loc[ticker, 'Annual_RS'] == original.loc[ticker, 'Percentile']
    assert pd.isna(actual.loc['IPO', 'Annual_RS'])
    assert 'PRICE_FETCH_ERROR' in actual.loc['FAILED', 'data_quality_flag']
    assert 'MISSING_HISTORY' in actual.loc['IPO', 'data_quality_flag']
    assert actual.loc['T00', 'Avg_Dollar_Volume_20'] == np.mean(np.linspace(30, 60, 400)[-20:] * 5000000)
    assert frame.Annual_RS_Change_20D.isna().all()
    output, public = tmp_path / 'results', tmp_path / 'public'
    publish(frame, state, output, public, tmp_path, history_path, history, 1.)
    for name in ('leadership_stocks.csv', 'utility_screen.csv', 'emerging_leaders.csv', 'market_state.json', 'run_summary.json'):
        assert (output / name).exists()
    snapshot = json.loads((public / 'latest.json').read_text())
    assert snapshot['summary']['failed_tickers'] == 1
    assert len(snapshot['stocks']) == 62
    assert 'NaN' not in (public / 'latest.json').read_text()
    again, _, saved = build(tmp_path, config, history_path)
    publish(again, state, output, public, tmp_path, history_path, saved, 1.)
    assert len(load_history(history_path)) == 62
    # An exact 20-session snapshot unlocks emerging-leader momentum.
    previous = frame[['Date', 'Ticker', 'Annual_RS', 'Utility_RS', 'Price']].copy()
    previous.Date = str(dates[-21].date())
    previous.Annual_RS = previous.Annual_RS - 15
    previous.to_parquet(history_path, index=False)
    enriched, _, _ = build(tmp_path, config, history_path)
    assert (enriched.Annual_RS_Change_20D.dropna() == 15).all()


def test_separate_extended_spy_preserves_annual_inputs(tmp_path, monkeypatch, config):
    dates = fixture_data(tmp_path, monkeypatch)
    baseline = json.loads((tmp_path / 'data/price_history.json').read_text())
    earlier = pd.bdate_range(end=dates[0] - pd.offsets.BDay(1), periods=300)
    prefix = [dict(datetime=int(day.timestamp()), close=float(price)) for day, price in zip(earlier, np.linspace(40, 79, 300))]
    (tmp_path / 'data/market_history.json').write_text(json.dumps({'candles': prefix + baseline['SPY']['candles']}))
    *_, benchmark = read_inputs(tmp_path)
    assert len(benchmark) == 700
    frame, state, _ = build(tmp_path, config, tmp_path / 'history.parquet')
    assert state['utility_window'] == 24
    original = pd.read_csv(tmp_path / 'output/rs_stocks.csv').set_index('Ticker')
    assert frame.set_index('Ticker').loc['T00', 'Annual_RS'] == original.loc['T00', 'Percentile']
    assert json.loads((tmp_path / 'data/price_history.json').read_text()) == baseline


def test_nasdaq100_flag_comes_from_cached_member_list(tmp_path, monkeypatch, config):
    fixture_data(tmp_path, monkeypatch)
    (tmp_path / 'data/nasdaq100.json').write_text(json.dumps(['T01', 'T02']))
    frame, _, _ = build(tmp_path, config, tmp_path / 'history.parquet')
    flagged = set(frame.loc[frame.Nasdaq100, 'Ticker'])
    assert flagged == {'T01', 'T02'}
    # Membership never changes the market-wide Annual RS.
    original = pd.read_csv(tmp_path / 'output/rs_stocks.csv').set_index('Ticker')
    assert frame.set_index('Ticker').loc['T01', 'Annual_RS'] == original.loc['T01', 'Percentile']


def test_nasdaq100_defaults_to_false_without_member_list(tmp_path, monkeypatch, config):
    fixture_data(tmp_path, monkeypatch)
    frame, _, _ = build(tmp_path, config, tmp_path / 'history.parquet')
    assert not frame.Nasdaq100.any()


def test_parse_nasdaq100_reads_symbols_from_nasdaq_api_payload():
    payload = {'data': {'data': {'rows': [{'symbol': 'AAPL'}, {'symbol': ' goog '}, {'symbol': 'AAPL'}]}}}
    assert parse_nasdaq100(payload) == ['AAPL', 'GOOG']
