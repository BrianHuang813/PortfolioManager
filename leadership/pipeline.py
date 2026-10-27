"""Single daily pipeline: original Fred fetch/rank, then Leadership enrichment."""
import argparse
import json
import logging
import os
from pathlib import Path
import shutil
import sys
import time
from datetime import date, timedelta
import numpy as np
import pandas as pd
import yaml
from market_state import market_state
from utility_rs import utility_rs
from trend_template import trend_template
from rs_line import rs_line
from classifications import classify
from screens import screens
from rs_history import load_history, momentum, save_history
from annual_rs import percentiles
from universe import is_derivative, prune_derivatives

ROOT = Path(__file__).resolve().parent
FRED = ROOT / 'vendor' / 'fred'


def fetch_and_rank(cached=False, config=None, refresh_market=False):
    # Run the unchanged original ranker in its expected working directory.
    previous = Path.cwd()
    os.chdir(FRED)
    sys.path.insert(0, str(FRED))
    try:
        import rs_data
        import rs_ranking
        import yfinance as yf
        yf.set_tz_cache_location(str(FRED / 'tmp' / 'yfinance'))
        if not cached:
            securities = rs_data.get_resolved_securities()
            securities = {t: e for t, e in securities.items() if not is_derivative(e.get('company'))}
            (FRED / 'data').mkdir(exist_ok=True)
            (FRED / 'data' / 'universe.json').write_text(json.dumps(securities), encoding='utf-8')
            rs_data.load_prices_from_yahoo(securities.values())
        if not cached or refresh_market:
            # Original annual inputs remain untouched. A separate longer SPY
            # series makes high events >200 sessions ago observable.
            days = 365 * config['benchmark']['history_years']
            prices = yf.download('SPY', start=date.today() - timedelta(days=days),
                                 end=date.today(), auto_adjust=True, progress=False, ignore_tz=True)
            candles = rs_data.parse_batch_download(prices, ['SPY']).get('SPY', [])
            if not candles:
                raise ValueError('Extended SPY history fetch failed')
            (FRED / 'data' / 'market_history.json').write_text(json.dumps({'candles': candles}), encoding='utf-8')
        logging.info('Excluded %d warrants/rights/units from ranking', prune_derivatives(FRED))
        save_nasdaq100(rs_data)
        rs_ranking.rankings()
    finally:
        os.chdir(previous)


def save_nasdaq100(rs_data):
    """Cache Nasdaq-100 members; if Wikipedia fails, keep the members of the last published snapshot."""
    members = []
    try:
        members = sorted(rs_data.get_nq100_tickers())
        if len(members) < 90:
            raise ValueError(f'only {len(members)} Nasdaq-100 members parsed')
    except Exception as error:
        previous = ROOT.parent / 'public' / 'leadership' / 'latest.json'
        logging.warning('Nasdaq-100 list unavailable (%s); reusing the last published members', error)
        if previous.exists():
            stocks = json.loads(previous.read_text(encoding='utf-8'))['stocks']
            members = sorted(s['Ticker'] for s in stocks if s.get('Nasdaq100'))
    (FRED / 'data' / 'nasdaq100.json').write_text(json.dumps(members), encoding='utf-8')


def read_inputs(directory):
    data = json.loads((directory / 'data' / 'price_history.json').read_text(encoding='utf-8'))
    manifest = directory / 'data' / 'universe.json'
    universe = json.loads(manifest.read_text(encoding='utf-8')) if manifest.exists() else data
    info_file = directory / 'data_persist' / 'ticker_info.json'
    info = json.loads(info_file.read_text(encoding='utf-8')) if info_file.exists() else {}
    frames = {}
    for ticker, entry in data.items():
        candles = pd.DataFrame(entry.get('candles', []))
        if candles.empty:
            continue
        dates = pd.to_datetime(candles['datetime'], unit='s', utc=True).dt.tz_localize(None).dt.normalize()
        candles.index = dates
        candles = candles.sort_index().loc[lambda f: ~f.index.duplicated(keep='last')]
        frames[ticker] = candles
    if 'SPY' not in frames:
        raise ValueError('SPY fetch failed; refusing to publish an incomplete market snapshot')
    benchmark = frames['SPY'].close.astype(float)
    extended = directory / 'data' / 'market_history.json'
    if extended.exists():
        candles = pd.DataFrame(json.loads(extended.read_text(encoding='utf-8'))['candles'])
        candles.index = pd.to_datetime(candles.datetime, unit='s', utc=True).dt.tz_localize(None).dt.normalize()
        benchmark = candles.sort_index().loc[lambda f: ~f.index.duplicated(keep='last'), 'close'].astype(float)
        if benchmark.index[-1] != frames['SPY'].index[-1]:
            raise ValueError('Extended and annual SPY snapshots have different dates')
    close = pd.DataFrame({t: f.close for t, f in frames.items() if t != 'SPY'}).reindex(benchmark.index)
    close = close.where(close > 0)
    volume = pd.DataFrame({t: f.volume if 'volume' in f else pd.Series(dtype=float) for t, f in frames.items() if t != 'SPY'}).reindex(benchmark.index)
    # Keep fetch failures visible as null columns, without ranking them.
    tickers = sorted(set(universe) - {'SPY'})
    close = close.reindex(columns=tickers)
    volume = volume.reindex(columns=tickers)
    return data, universe, info, close, volume, benchmark


def build(directory, config, history_path):
    data, universe, info, close, volume, benchmark = read_inputs(directory)
    state = market_state(benchmark, config)
    original = pd.read_csv(directory / 'output' / 'rs_stocks.csv').set_index('Ticker')
    industries = pd.read_csv(directory / 'output' / 'rs_industries.csv').set_index('Industry')
    frame = pd.DataFrame(index=close.columns)
    frame['Ticker'] = frame.index
    frame['Date'] = state['date']
    for column, key in [('Company', 'shortName'), ('Sector', 'sector'), ('Industry', 'industry'), ('Exchange', 'exchange')]:
        frame[column] = [info.get(t, {}).get('info', {}).get(key) or data.get(t, universe.get(t, {})).get(key) for t in frame.index]
    frame['Company'] = frame.Company.fillna(pd.Series({t: universe[t].get('company') for t in frame.index}))
    frame['Exchange'] = frame.Exchange.fillna(pd.Series({t: universe[t].get('universe') for t in frame.index}))
    frame[['Sector', 'Industry']] = frame[['Sector', 'Industry']].replace(['unknown', 'Unknown', 'n/a', 'N/A', ''], np.nan)
    frame['Price'] = close.iloc[-1]
    frame['Volume'] = volume.iloc[-1]
    frame['Price_Last_Date'] = [str(pd.Timestamp(data[t]['candles'][-1]['datetime'], unit='s').date())
        if data.get(t, {}).get('candles') else None for t in frame.index]
    enough = close.tail(252).notna().sum().eq(252) & (len(close) >= 252)
    frame['Annual_RS'] = original.Percentile.reindex(frame.index).where(enough)
    frame['Annual_RS_Rank'] = original.Rank.reindex(frame.index).where(enough)
    frame['Annual_RS_Eligibility'] = np.where(~enough, 'MISSING_HISTORY',
        np.where(frame.Annual_RS.isna(), 'FRED_EXCLUDED', 'VALID'))
    members_file = directory / 'data' / 'nasdaq100.json'
    members = set(json.loads(members_file.read_text(encoding='utf-8'))) if members_file.exists() else set()
    frame['Nasdaq100'] = frame.index.isin(members)
    frame['Utility_Active'] = state['utility_active']
    frame['Utility_Window'] = state['utility_window']
    frame['Utility_RS'] = utility_rs(close, benchmark, state, config['utility'])
    for n in (50, 150, 200):
        frame[f'MA{n}'] = close.rolling(n).mean().iloc[-1]
    slope = config['trend_template']['ma200_slope_days']
    frame['MA200_20D_Ago'] = close.rolling(200).mean().shift(slope).iloc[-1]
    for name, n, operation in [('High_52W', 252, 'max'), ('Low_52W', 252, 'min'), ('High_200D', 200, 'max')]:
        frame[name] = getattr(close.rolling(n), operation)().iloc[-1]
    frame['Pct_From_52W_High'] = frame.Price / frame.High_52W - 1
    frame['Pct_From_200D_High'] = frame.Price / frame.High_200D - 1
    frame['Pct_Above_52W_Low'] = frame.Price / frame.Low_52W - 1
    frame['Avg_Dollar_Volume_20'] = (close * volume).rolling(20).mean().iloc[-1]
    for column, values in rs_line(close, benchmark, config['rs_line']).items():
        frame[column] = values
    frame['Industry_RS'] = frame.Industry.map(industries['Relative Strength'])
    frame['Industry_RS_Percentile'] = frame.Industry.map(industries.Percentile)
    sector_medians = frame.groupby('Sector').Annual_RS.median()
    frame['Sector_RS'] = frame.Sector.map(sector_medians)
    frame['Sector_RS_Percentile'] = frame.Sector.map(percentiles(sector_medians))
    history = load_history(history_path)
    frame = momentum(frame, history, benchmark.index)
    frame = classify(screens(trend_template(frame, config['trend_template']), config), config['classifications'])
    returns = close.pct_change(fill_method=None).tail(20)
    quality = config['data_quality']
    possible_split = ((returns < quality['daily_return_min']) | (returns > quality['daily_return_max'])).any()
    frame['flag_possible_corporate_action'] = possible_split
    flags = []
    for ticker, row in frame.iterrows():
        warnings = []
        if ticker not in data or not data[ticker].get('candles'):
            warnings.append('PRICE_FETCH_ERROR')
        elif pd.isna(row.Price):
            warnings.append('STALE_PRICE')
        if not enough[ticker]:
            warnings.append('MISSING_HISTORY')
        if possible_split[ticker]:
            warnings.append('POSSIBLE_SPLIT')
        if volume[ticker].tail(20).isna().any() or pd.isna(row.Avg_Dollar_Volume_20):
            warnings.append('MISSING_VOLUME')
        if pd.isna(row.Sector):
            warnings.append('MISSING_SECTOR')
        if pd.isna(row.Industry):
            warnings.append('MISSING_INDUSTRY')
        flags.append('|'.join(warnings) or 'OK')
    frame['data_quality_flag'] = flags
    return frame.reset_index(drop=True), state, history


def publish(frame, state, output, public, directory, history_path, history, elapsed):
    output.mkdir(parents=True, exist_ok=True)
    public.mkdir(parents=True, exist_ok=True)
    utility = frame[frame.Utility_Screen_Pass].sort_values(['Utility_RS', 'Annual_RS_Change_20D'], ascending=False, na_position='last')
    emerging = frame[frame.Emerging_Leader].sort_values(['Utility_RS', 'Annual_RS_Change_20D', 'Annual_RS'], ascending=False, na_position='last')
    for name, table in [('leadership_stocks', frame), ('utility_screen', utility), ('emerging_leaders', emerging)]:
        table.to_csv(output / f'{name}.csv', index=False)
        shutil.copyfile(output / f'{name}.csv', public / f'{name}.csv')
    for name in ('rs_stocks.csv', 'rs_industries.csv', 'rs_stocks_1.csv', 'rs_stocks_2.csv', 'RSRATING.csv'):
        source = directory / 'output' / name
        if source.exists():
            shutil.copyfile(source, output / name)
    summary = dict(run_date=state['date'], universe_size=len(frame),
        processed_tickers=int(frame.Price.notna().sum()), failed_tickers=int(frame.Price.isna().sum()),
        fetch_failed_tickers=int(frame.Price_Last_Date.isna().sum()),
        stale_tickers=int((frame.Price.isna() & frame.Price_Last_Date.notna()).sum()),
        annual_rs_valid_count=int(frame.Annual_RS.notna().sum()), utility_active=state['utility_active'],
        utility_window=state['utility_window'], utility_rs_valid_count=int(frame.Utility_RS.notna().sum()),
        trend_template_pass_count=int(frame.Trend_Template_Pass.sum()), utility_screen_pass_count=len(utility),
        emerging_leader_count=len(emerging), data_quality_warnings=int(frame.data_quality_flag.ne('OK').sum()),
        calculation_seconds=round(elapsed, 3))
    for name, value in [('market_state', state), ('run_summary', summary)]:
        (output / f'{name}.json').write_text(json.dumps(value, indent=2, allow_nan=False), encoding='utf-8')
        shutil.copyfile(output / f'{name}.json', public / f'{name}.json')
    payload = dict(market=state, summary=summary, stocks=json.loads(frame.to_json(orient='records')))
    temporary = public / 'latest.tmp.json'
    temporary.write_text(json.dumps(payload, allow_nan=False), encoding='utf-8')
    temporary.replace(public / 'latest.json')
    save_history(history_path, history, frame)
    logging.info('%s', json.dumps(summary))
    return summary


def main():
    # Fred prints Unicode completion markers; Windows cp950 cannot encode them.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser()
    parser.add_argument('--cached', action='store_true', help='Re-rank the existing Fred price cache without network')
    parser.add_argument('--refresh-market', action='store_true', help='Refresh only the separate SPY cache, including with --cached')
    parser.add_argument('--input', type=Path, help='Offline fixture directory containing Fred data and output schemas')
    parser.add_argument('--output', type=Path, default=ROOT / 'output')
    parser.add_argument('--history', type=Path, default=ROOT / 'history' / 'leadership_history.parquet')
    parser.add_argument('--public', type=Path, default=ROOT.parent / 'public' / 'leadership')
    args = parser.parse_args()
    config = yaml.safe_load((ROOT / 'config.yaml').read_text(encoding='utf-8'))
    if config['benchmark']['symbol'] != 'SPY' or config['annual_rs']['weights'] != dict(p3=.4, p6=.2, p9=.2, p12=.2):
        raise ValueError('MVP requires the unchanged Fred annual weights and SPY benchmark')
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    if not args.input:
        fetch_and_rank(args.cached, config, args.refresh_market)
    started = time.perf_counter()
    directory = args.input or FRED
    frame, state, history = build(directory, config, args.history)
    publish(frame, state, args.output, args.public, directory, args.history, history, time.perf_counter() - started)


if __name__ == '__main__':
    main()
