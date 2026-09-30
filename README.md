# Portfolio Analytics & Risk Dashboard

A self-contained HTML/CSS/JavaScript portfolio analytics prototype based on **Portfolio Analytics & Risk Dashboard.md**.

## What is implemented

- Holdings and cost/value/P&L
- Asset allocation and target allocation
- Annualized return
- Annualized volatility using `sqrt(w' Σ w) × sqrt(252)`
- Sharpe and Sortino ratios
- Beta and tracking error
- Historical-style VaR 95% and CVaR 95% on the supplied series
- XIRR cash-flow calculator using a bracketed root search
- Maximum drawdown
- HHI concentration and effective number of holdings
- Risk contribution to portfolio volatility
- Correlation heatmap from transparent asset-class correlation assumptions
- Scenario/stress testing
- Drift-band rebalancing table
- Rule-based investor strategy/review framework
- Editable holdings
- CSV import
- CSV report export
- Responsive UI and offline operation

## Important data limitation

The browser app has **no live market-data connection**. The built-in 252-period portfolio and benchmark series are deterministic synthetic demonstration data. Imported holdings update portfolio composition and valuation, while return-based metrics (annualized return, Sharpe, Sortino, VaR/CVaR, drawdown and beta) continue to use the synthetic series until a real historical price/return feed is connected. Portfolio volatility/risk contribution uses transparent asset-class correlation assumptions plus the volatility values in the holdings CSV.

This is deliberate: the application must not present invented market data as real data.

## CSV

Required header:

```text
symbol,name,assetType,sector,quantity,avgCost,currentPrice,beta,volatility,targetPct
```

Example:

```text
ABC,Example Co,Equity,IT,10,1000,1100,1.05,25,15
```

`volatility` and `targetPct` are percentages, not decimals.

## Quantitative methods

- Portfolio variance: `wᵀΣw`
- Annualized volatility: `sqrt(wᵀΣw) * sqrt(252)`
- Sharpe: `(R_p - R_f) / σ_p`
- Sortino: `(R_p - R_f) / downside deviation`
- Beta: `Cov(R_p,R_b) / Var(R_b)`
- Historical VaR: negative 5th percentile of periodic returns
- Historical CVaR: negative mean of returns at/below the VaR quantile
- Maximum drawdown: minimum of `V_t / max(V_≤t) - 1`
- HHI: `Σw_i²`
- Effective holdings: `1 / HHI`
- Risk contribution: `w_i × (Σw)_i / σ_p`

## Decision-support design

The app does not rank securities or predict returns. Its strategy module uses measurable observations:

1. Compare actual allocation with targets.
2. Apply a configurable drift band.
3. Review concentration and tail-loss exposure.
4. Use stress scenarios to understand sensitivity.
5. Consider contribution-based rebalancing before sales when taxes/transaction costs make that appropriate.
6. Review benchmark-relative metrics rather than treating a single ratio as a decision rule.

## Validation

The implementation was designed and checked for:
- zero/empty inputs
- division-by-zero protection
- negative/invalid CSV numbers
- XIRR bracketing failure handling
- responsive canvas resizing
- deterministic demo reproducibility
- no external network dependencies
- HTML/CSS/JS syntax checks with Node-based static execution
- quantitative reference checks against independently calculated expected values

## Production extensions

For a production-grade system, add:
- audited market-data provider
- adjusted close/corporate actions
- transaction-level cash flows and exact XIRR
- tax and fee model
- multi-currency support
- true historical portfolio return reconstruction
- factor model / PCA
- regime-aware stress testing
- constrained mean-variance or risk-parity optimization
- authentication and encrypted storage
- server-side validation and audit logs
