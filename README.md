# Alpaca Paper Agent

Paper-trading-only autonomous market scanner for Alpaca. The trading base URL is hard-coded to Alpaca's paper endpoint.

## Safety
- Paper endpoint only; no live endpoint switch.
- Orders disabled by default.
- Per-position cap and daily drawdown halt.
- Existing positions are not duplicated.
- Health endpoint: /health

Required Railway variables: ALPACA_API_KEY, ALPACA_SECRET_KEY.
Optional: ENABLE_PAPER_ORDERS=true, MAX_POSITION_PCT=0.12, MAX_DAILY_DRAWDOWN_PCT=0.03, SYMBOLS=SPY,QQQ,AMD,NVDA,META,COIN
