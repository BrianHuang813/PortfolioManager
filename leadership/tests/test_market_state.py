import numpy as np
import pandas as pd
import pytest
from market_state import activation, market_state


@pytest.mark.parametrize('days,active', [(9, False), (10, True), (200, True), (201, False)])
def test_activation(config, days, active):
    assert activation(days, config['utility']) == (active, days if active else None)


@pytest.mark.parametrize('days', [9, 10, 200, 201])
def test_trading_sessions_since_high(config, days):
    values = np.concatenate([np.linspace(50, 100, 252), np.linspace(99, 60, days)])
    index = pd.bdate_range('2024-01-01', periods=len(values))
    state = market_state(pd.Series(values, index=index), config)
    assert state['days_since_200d_high'] == days
    assert state['utility_active'] == (10 <= days <= 200)


def test_most_recent_equal_high(config):
    close = pd.Series([100.] * 252 + [99., 100., 99.], index=pd.bdate_range('2024-01-01', periods=255))
    assert market_state(close, config)['days_since_200d_high'] == 1


def test_insufficient_benchmark(config):
    with pytest.raises(ValueError):
        market_state(pd.Series([100.] * 200), config)
