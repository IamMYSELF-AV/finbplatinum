import React from 'react';

// ── Tiny toast system ────────────────────────────────────────
export const ToastCtx = React.createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = React.useState([]);
  const push = React.useCallback((msg, type = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type === 'err' ? 'err' : 'ok'}`}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => React.useContext(ToastCtx);

// ── Modal ────────────────────────────────────────────────────
export function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose}>✕</button>
        {title && <h3 style={{ marginBottom: 14 }}>{title}</h3>}
        {children}
      </div>
    </div>
  );
}

// ── Sparkline ────────────────────────────────────────────────
export function Sparkline({ data, up, width = 120, height = 44 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / span) * (height - 6) - 3}`)
    .join(' ');
  const color = up ? '#4ade80' : '#fb7185';

  const id = React.useId();
  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

// ── Platinum credit card visual ──────────────────────────────
export function BankCard({ profile, privateData, balance }) {
  return (
    <div className="bankcard">
      <div className="bc-top">
        <div>
          <div className="bc-brand">FINB · DESIGNER GOLD</div>
          <div className="bc-label" style={{ marginTop: 4 }}>Fake International Bank · Estd 2023</div>
        </div>
        <div className="bc-chip" />
      </div>
      <div>
        <div className="bc-number">{String(profile.cardNumber || '•••• •••• •••• ••••').replace(/(\d{4})(?=\d)/g, '$1 ')}</div>
        <div className="bc-bottom">
          <div>
            <div className="bc-label">Card holder</div>
            <div className="bc-val">{profile.name}</div>
          </div>
          <div>
            <div className="bc-label">Expires</div>
            <div className="bc-val">{privateData?.expiry || '••/••'}</div>
          </div>
          <div>
            <div className="bc-label">CVV</div>
            <div className="bc-val">{privateData?.cvv ? '•••' : '•••'}</div>
          </div>
          <div className="bc-balance">
            <div className="bc-label">Credits</div>
            <div className="bc-val">◈ {Number(balance ?? profile.balance ?? 0).toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Countdown hook ───────────────────────────────────────────
export function useCountdown(targetMs) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, targetMs - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
