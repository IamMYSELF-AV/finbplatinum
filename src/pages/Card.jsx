import React from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { ProfileCtx } from '../App.jsx';
import { BankCard, useToast } from '../components/ui.jsx';
import { subscribePortfolio } from '../lib/bank.js';
import { currentPrices } from '../lib/market.js';

export default function CardPage() {
  const { user, profile } = React.useContext(ProfileCtx);
  const toast = useToast();
  const [priv, setPriv] = React.useState(null);
  const [reveal, setReveal] = React.useState(false);
  const [portfolio, setPortfolio] = React.useState({ holdings: {} });

  React.useEffect(() => onSnapshot(doc(db, 'private', user.uid), (s) => setPriv(s.data())), [user.uid]);
  React.useEffect(() => subscribePortfolio(user.uid, setPortfolio), [user.uid]);

  const copy = (label, val) => {
    navigator.clipboard?.writeText(String(val));
    toast(`${label} copied to clipboard 📋`);
  };

  const { prices } = currentPrices();
  const invested = Object.entries(portfolio.holdings || {})
    .reduce((s, [sym, h]) => s + (prices[sym] || 0) * h.qty, 0);
  const netWorth = Number(profile.balance || 0) + invested;

  return (
    <div>
      <div className="section-head"><h2>Your Platinum card</h2></div>
      <div className="grid cols-2">
        <div>
          <div style={{ filter: reveal ? 'none' : 'blur(0px)' }}>
            <div className="bankcard" style={!reveal ? { filter: 'blur(6px)' } : undefined}>
              <div className="bc-top">
                <div>
                  <div className="bc-brand">FINB PLATINUM</div>
                  <div className="bc-label" style={{ marginTop: 4 }}>Fake International Bank · Estd 2023</div>
                </div>
                <div className="bc-chip" />
              </div>
              <div>
                <div className="bc-number">{String(profile.cardNumber).replace(/(\d{4})(?=\d)/g, '$1 ')}</div>
                <div className="bc-bottom">
                  <div>
                    <div className="bc-label">Card holder</div>
                    <div className="bc-val">{profile.name}</div>
                  </div>
                  <div>
                    <div className="bc-label">Expires</div>
                    <div className="bc-val">{priv?.expiry || '••/••'}</div>
                  </div>
                  <div>
                    <div className="bc-label">CVV</div>
                    <div className="bc-val">{priv?.cvv || '•••'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <button className="btn ghost block mt" onClick={() => setReveal((r) => !r)}>
            {reveal ? '🙈 Hide card details' : '👁️ Reveal card details'}
          </button>
        </div>

        <div className="card">
          <div className="card-title">👤 Account details</div>
          <div className="list-row">
            <div className="list-icon">@</div>
            <div style={{ flex: 1 }}>
              <div className="faint" style={{ fontSize: 11 }}>USERNAME</div>
              <div style={{ fontWeight: 700 }}>@{profile.username}</div>
            </div>
            <button className="btn ghost sm" onClick={() => copy('Username', '@' + profile.username)}>Copy</button>
          </div>
          <div className="list-row">
            <div className="list-icon">💳</div>
            <div style={{ flex: 1 }}>
              <div className="faint" style={{ fontSize: 11 }}>CARD NUMBER</div>
              <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {String(profile.cardNumber).replace(/(\d{4})(?=\d)/g, '$1 ')}
              </div>
            </div>
            <button className="btn ghost sm" onClick={() => copy('Card number', profile.cardNumber)}>Copy</button>
          </div>
          <div className="list-row">
            <div className="list-icon">📛</div>
            <div style={{ flex: 1 }}>
              <div className="faint" style={{ fontSize: 11 }}>NAME</div>
              <div style={{ fontWeight: 700 }}>{profile.name}</div>
            </div>
          </div>

          <div className="card-title mt2">📊 Net worth</div>
          <div className="spread">
            <span className="muted">Cash</span>
            <b className="gold">◈ {Number(profile.balance).toLocaleString()}</b>
          </div>
          <div className="spread mt" style={{ padding: '4px 0' }}>
            <span className="muted">Invested in stocks</span>
            <b>◈ {invested.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b>
          </div>
          <div className="spread mt" style={{ borderTop: '1px solid var(--stroke)', paddingTop: 12 }}>
            <b>Total net worth</b>
            <b style={{ fontSize: 18 }} className="gold">◈ {netWorth.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b>
          </div>
        </div>
      </div>

      <p className="faint center mt2" style={{ fontSize: 12 }}>
        FINB Platinum is a game simulation — credits have no real-world value. Never share your CVV with other players.
      </p>
    </div>
  );
}
