import numpy as np


def activation(days, config):
    active = config['activation_days_min'] <= days <= config['activation_days_max']
    return active, days if active else None


def market_state(close, config):
    if len(close) < 252 or close.isna().any() or (close <= 0).any():
        raise ValueError('SPY requires at least 252 valid trading sessions')
    # Find the last historical rolling-high EVENT, not the maximum in today's
    # window. The latter can never express an extended correction >200 days.
    rolling = close.rolling(200, min_periods=200).max()
    events = np.flatnonzero(close.eq(rolling).to_numpy())
    if not len(events):
        raise ValueError('No observable 200D high event; fetch a longer SPY history')
    days = int(len(close) - 1 - events[-1])
    active, window = activation(days, config['utility'])
    return dict(date=str(close.index[-1].date()), benchmark='SPY', close=float(close.iloc[-1]),
                high_200d=float(rolling.iloc[-1]), days_since_200d_high=days,
                drawdown_from_200d_high=float(close.iloc[-1] / rolling.iloc[-1] - 1),
                ma50=float(close.tail(50).mean()), ma200=float(close.tail(200).mean()),
                utility_active=active, utility_window=window,
                state='NORMAL' if days < config['utility']['activation_days_min'] else
                'CORRECTION' if days <= config['utility']['activation_days_max'] else 'EXTENDED_CORRECTION')
