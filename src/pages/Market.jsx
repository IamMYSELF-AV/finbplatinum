import React from 'react';
import { ProfileCtx } from '../App.jsx';
import { STOCKS, TICK_MS, currentPrices, intradaySeries, dayChange, priceAt, currentTick } from '../lib/market.js';
import { subscribePortfolio, tradeStock } from '../lib/bank.js';
import { Modal, Sparkline, useToast } from '../components/ui.jsx';

function useMarketClock() {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function BigChart({ stock, now }) {
  const series = intradaySeries(stock, 60, now);
  const w = 440, h = 150;
  const min = Math.min(...series), max = Math.max(...series), span = max - min || 1;
  const pts = series.map((v, i) =>
    `${(i / (series.length - 1)) * w},${h - ((v - min) / span) * (h - 16) - 8}`).join(' ');
  const chg = dayChange(stock, now);
  const color = chg.pct >= 0 ? '#4ade80' : '#fb7185';
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 150 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

export default function Market() {
  const { user, profile } = React.useContext(ProfileCtx);
  const toast = useToast();
  const now = useMarketClock();
  const [portfolio, setPortfolio] = React.useState({ holdings: {}, realized: 0 });
  const [selected, setSelected] = React.useState(null);
  const [qty, setQty] = React.useState('1');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => subscribePortfolio(user.uid, setPortfolio), [user.uid]);

  const { prices, tick } = currentPrices(now);
  const secondsLeft = Math.ceil((TICK_MS - (now % TICK_MS)) / 1000);

  const holdingsValue = Object.entries(portfolio.holdings || {}).reduce((sum, [sym, h]) => {
    return sum + (prices[sym] || 0) * h.qty;
  }, 0);
  const holdingsCost = Object.values(portfolio.holdings || {}).reduce((s, h) => s + h.avg * h.qty, 0);
  const unrealized = holdingsValue - holdingsCost;

  const doTrade = async (side) => {
    if (!selected) return;
    setBusy(true);
    try {
      await tradeStock({ uid: user.uid, sym: selected.id, qty: Number(qty), side });
      toast(`${side === 'buy' ? 'Bought' : 'Sold'} ${qty} ${selected.id} ${side === 'buy' ? '📈' : '💰'}`);
      setQty('1');
    } catch (err) { toast(err.message, 'err'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div className="section-head">
        <h2>Platimarkets 📈</h2>
        <span className="muted" style={{ fontSize: 13 }}>
          Prices move automatically · next tick in <b className="countdown">{secondsLeft}s</b>
        </span>
      </div>

      <div className="grid cols-3 mb">
        <div className="card">
          <div className="card-title">💼 Portfolio value</div>
          <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--display)' }}>
            ◈ {holdingsValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className={unrealized >= 0 ? 'good' : 'bad'} style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>
            {unrealized >= 0 ? '▲' : '▼'} {Math.abs(unrealized).toFixed(2)} unrealized
          </div>
        </div>
        <div className="card">
          <div className="card-title">🏦 Cash balance</div>
          <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--display)' }} className="gold">
            ◈ {Number(profile.balance).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>Available to invest</div>
        </div>
        <div className="card">
          <div className="card-title">📊 Realized P/L</div>
          <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--display)' }}
            className={(portfolio.realized || 0) >= 0 ? 'good' : 'bad'}>
            ◈ {Number(portfolio.realized || 0).toFixed(2)}
          </div>
          <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>Closed trades this season</div>
        </div>
      </div>

      <div className="card">
        {STOCKS.map((s) => {
          const price = prices[s.id];
          const chg = dayChange(s, now);
          const series = intradaySeries(s, 24, now);
          const h = portfolio.holdings?.[s.id];
          return (
            <div key={s.id} className="stock-row spread list-row" onClick={() => { setSelected(s); setQty('1'); }}>
              <div className="list-icon" style={{ background: `${s.color}22`, borderColor: `${s.color}55` }}>
                {s.id.slice(0, 2)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {s.name} <span className="faint">· {s.id}</span>
                </div>
                {h && <div className="faint" style={{ fontSize: 12 }}>You own {h.qty} shares · avg ◈ {h.avg}</div>}
              </div>
              <div style={{ width: 110 }}><Sparkline data={series} up={chg.pct >= 0} /></div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>◈ {price.toFixed(2)}</div>
                <span className={`pill ${chg.pct >= 0 ? 'up' : 'down'}`}>
                  {chg.pct >= 0 ? '▲' : '▼'} {Math.abs(chg.pct).toFixed(2)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <Modal title={`${selected.name} (${selected.id})`} onClose={() => setSelected(null)}>
          <BigChart stock={selected} now={now} />
          <div className="spread mt">
            <div>
              <div className="faint" style={{ fontSize: 12 }}>Current price</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>◈ {prices[selected.id].toFixed(2)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="faint" style={{ fontSize: 12 }}>Today</div>
              {(() => { const c = dayChange(selected, now); return (
                <span className={`pill ${c.pct >= 0 ? 'up' : 'down'}`} style={{ fontSize: 14 }}>
                  {c.pct >= 0 ? '▲' : '▼'} {Math.abs(c.pct).toFixed(2)}%
                </span>); })()}
            </div>
          </div>
          {portfolio.holdings?.[selected.id] && (
            <div className="mt" style={{ background: 'var(--panel)', padding: 12, borderRadius: 12, fontSize: 13 }}>
              You hold <b>{portfolio.holdings[selected.id].qty}</b> shares at avg{' '}
              <b>◈ {portfolio.holdings[selected.id].avg}</b> · worth{' '}
              <b className="gold">◈ {(prices[selected.id] * portfolio.holdings[selected.id].qty).toFixed(2)}</b>
            </div>
          )}
          <div className="field mt2">
            <label>Quantity</label>
            <input className="input" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
            <div className="faint mt" style={{ fontSize: 12 }}>
              Cost: <b>◈ {(prices[selected.id] * (Number(qty) || 0)).toFixed(2)}</b>
            </div>
          </div>
          <div className="row">
            <button className="btn primary" style={{ flex: 1 }} disabled={busy} onClick={() => doTrade('buy')}>Buy 📈</button>
            <button className="btn" style={{ flex: 1 }} disabled={busy} onClick={() => doTrade('sell')}>Sell 💰</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
