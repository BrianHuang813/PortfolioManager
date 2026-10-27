# Minervini Leadership Engine · MVP v0.1

Python 3.11+ daily research/screening pipeline integrated with the React
dashboard at `/leadership`. No trade execution or combined Leadership score.

## Run locally

```powershell
python -m venv leadership/.venv
leadership/.venv/Scripts/python.exe -m pip install -r leadership/requirements.txt
leadership/.venv/Scripts/python.exe leadership/pipeline.py
```

The development environment provisioned for this implementation already has
`leadership/.venv/Scripts/python.exe`. For subsequent runs:

```powershell
npm run leadership
npm run leadership:cached
npm run leadership:test
npm run dev
```

`--cached` re-ranks the current Fred cache without network access. `--input PATH`
supports offline input in the Fred schema (`data/price_history.json`, optional
`data/universe.json`, `data_persist/ticker_info.json`, and original output CSVs).
`--output`, `--history` and `--public` select output locations.
`--cached --refresh-market` refreshes only the separate SPY market history,
useful when recovering a completed stock download. CLI output uses UTF-8 so
Fred's Unicode completion markers also work on Windows CP950 systems.

## Methodology and compatibility

The production pipeline calls the pinned original `vendor/fred/rs_ranking.py`
and reuses its stock and industry results. Its annual windows contain
63/126/189/252 observations, so their effective endpoint returns span
62/125/188/251 intervals. The ratio is multiplied by 100 and truncated to two
decimal places **before** `pandas.qcut(..., 100, duplicates='drop')`. These
details are deliberately preserved; switching to literal `pct_change(63)`
or a different percentile algorithm changes the ranking.

Fred accepts 120-session stocks in its ranking universe and excludes some
extreme relative scores and stocks lacking both industry and sector. The
original CSVs retain this behavior. Leadership's `Annual_RS` and rank become
null unless 252 current SPY sessions are available, **after** joining the
original rankings. This retains the baseline universe while meeting the new
history requirement. Fetch failures and incomplete histories remain in the
Leadership output, with quality flags; they are not silently dropped.

Original 1M/3M/6M percentile fields are retrospective calculations against the
current fetched universe. They are not a store of daily historical snapshots.
The engine therefore keeps its own daily Parquet snapshots. Momentum looks up
the exact SPY session 5/20/40/60 days earlier. Missing snapshots stay null,
including skipped runs; they never shift to the nearest stored date. Same-day
reruns replace the Date/Ticker key. Utility inactive values remain null.

Yahoo `auto_adjust=True` supplies already adjusted OHLC for both original
Annual RS and the RS Line. A separate three-year SPY cache supports market
state without changing the original annual price cache. Market days since
high use the last `close == rolling(200).max()` event, including repeated
equal highs, measured in trading-session positions. Searching only today's
200-session maximum cannot express the `>200` state. A missing observable
high event causes an explicit error rather than inventing a window.

Utility activates only at 10–200 sessions. Windows use Python `round` on
25%, 50%, 75%, and 100% of the market window (minimum 1); this uses ties-to-even
rounding. Returns use actual W-session intervals, weighted .4/.2/.2/.2,
normalized by SPY and ranked with Fred's qcut convention. Tied scores can
reduce the number of available bins; entirely equal scores have null ranks.

All thresholds live in `config.yaml`. Established leaders do not require
Utility RS. Emerging leaders additionally need Utility >=90 during an active
correction. Fading's optional weak-Utility constraint is disabled by default.
The Utility screen deliberately omits the 52-week-low criterion. General
liquidity is separately exposed as `Liquidity_Pass`, without changing the
specified classification definitions.

## Outputs

`leadership/output/` contains preserved Fred outputs and:

| File | Content |
| --- | --- |
| leadership_stocks.csv | Full universe, all required features, nine `tt_*` conditions and quality flags |
| utility_screen.csv | Passing stocks, Utility RS then Annual RS 20D change descending |
| emerging_leaders.csv | Emerging stocks, Utility RS, 20D change, Annual RS descending |
| market_state.json | SPY date, high, session count, drawdown, MA50/200, Utility activation and descriptive state |
| run_summary.json | Universe/processed/failure counts, valid RS, pass counts, warnings and calculation time |

`history/leadership_history.parquet` stores Date, Ticker, Annual_RS,
Utility_RS, Price with unique Date/Ticker keys. CSV nulls are empty cells;
JSON nulls are literal `null`, never NaN. Price distances and market
drawdowns are fractional values (e.g. -0.10 means -10%). Industry_RS is Fred's
raw industry relative score; Industry_RS_Percentile is its existing percentile.
Sector_RS is the sector median Annual_RS; Sector_RS_Percentile ranks those
medians. Extra fields retain the RS Line distance, 40-session annual lag,
liquidity pass and corporate-action flag. `Annual_RS_Eligibility` distinguishes
valid values, missing history, and Fred's original eligibility exclusions.

`public/leadership/` gets the three Leadership CSVs, market state, summary,
and `latest.json` for the dashboard. The page supports classification tabs,
search, ranking, 50-row pagination, downloads, and all-feature detail. No
generated data shows a clear setup message; synthetic fixtures are never
published as live results.

Quality flags can be combined with `|`: MISSING_HISTORY, POSSIBLE_SPLIT,
MISSING_VOLUME, MISSING_SECTOR, MISSING_INDUSTRY, PRICE_FETCH_ERROR.
`STALE_PRICE` identifies fetched histories without a price on the current
SPY session. `Price_Last_Date` retains the last observed date. Run summaries
separate fetch failures from stale prices; `failed_tickers` is their combined
count of missing current-session prices. No previous close is silently filled.
Adjusted
daily returns below -40% or above +100% in the last 20 sessions trigger the
corporate-action sanity flag. This flag is an observation, not a confirmed
split or an automatic exclusion. Insufficient or stale SPY fails the run.

## Daily automation

`.github/workflows/leadership.yml` extends Fred's weekday 23:30 UTC schedule
as the only daily pipeline in this repository: test → restore previous
history/metadata → original fetch/rank → Leadership → save state → website
build. It uploads `leadership-state`, `leadership-results` and
`leadership-website`. The next run restores the last successful history,
preserving momentum across clean runners. Artifacts retain state for 90 days;
an interruption longer than that requires restoring a backed-up Parquet file.

On main, the workflow commits the refreshed `public/leadership` dataset and
pushes it to the repository, using the existing deployment integration.
The initial dataset is also committed so the first deployment has real data.
The workflow does not write to Fred's external rs-log or TradingView accounts.
The website artifact also contains the current dataset. Optional GitHub
Pages deployment can be enabled using repository variable
`LEADERSHIP_DEPLOY_PAGES=true` and Pages source **GitHub Actions**. No site is
published by local implementation or tests.

## Validation

```powershell
npm run leadership:test
npm test
npm run build
```

Annual compatibility tests execute the pinned original functions on 50
synthetic tickers and the full original ranker on a second 60-stock fixture.
Both compare exact percentiles. Additional tests cover activation boundaries,
trading-session high events including >200, Utility formula/windows/nulls,
RS Line direction/tolerance/leading price, all nine Trend Template conditions,
classification thresholds, Parquet idempotence, missing snapshots, actual
mean(close*volume), fetch failures and full CSV/JSON output.

Live full-universe performance and cloud workflow success must be measured
separately from synthetic tests. First-run historical momentum and emerging
screens can remain empty until sufficient snapshots accumulate. No historical
universe is reconstructed, and no predictive efficacy is claimed.
