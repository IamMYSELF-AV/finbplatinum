import React from 'react';
import { claimOnce, dayKey } from '../../lib/bank.js';
import { useToast } from '../ui.jsx';
import { ProfileCtx } from '../../App.jsx';

// Wedges in credits. Total circle = 360°, 8 wedges of 45°.
const WEDGES = [
  { label: '5', amount: 5, color: '#2a3a6e' },
  { label: '20', amount: 20, color: '#3b5599' },
  { label: '50', amount: 50, color: '#4f6ef0' },
  { label: '5', amount: 5, color: '#2a3a6e' },
  { label: '100', amount: 100, color: '#6f8dff' },
  { label: '10', amount: 10, color: '#3b5599' },
  { label: '500', amount: 500, color: '#fcd34d' },
  { label: '15', amount: 15, color: '#4f6ef0' },
];

export default function SpinWheel() {
  const { user } = React.useContext(ProfileCtx);
  const toast = useToast();
  const [rot, setRot] = React.useState(0);
  const [spinning, setSpinning] = React.useState(false);
  const [result, setResult] = React.useState(null);

  const spin = async () => {
    if (spinning) return;
    setResult(null);
    setSpinning(true);
    const idx = Math.floor(Math.random() * WEDGES.length);
    const wedge = WEDGES[idx];
    // Pointer at top (0°). Wedge i spans [i*45, (i+1)*45) clockwise from top.
    const target = 360 * 6 + (360 - (idx * 45 + 22));
    setRot((r) => r + (target - (r % 360)));
    setTimeout(async () => {
      setSpinning(false);
      try {
        await claimOnce(user.uid, 'spin', wedge.amount, dayKey());
      } catch (e) {
        if (String(e.message).includes('Already claimed')) {
          toast('You already spun today — come back tomorrow! 🗓️', 'err');
          return;
        }
        toast(e.message, 'err');
        return;
      }
      setResult(wedge.amount);
      toast(`You won ${wedge.amount} credits! ${wedge.amount >= 100 ? '🎉 JACKPOT!' : '✨'}`);
    }, 4200);
  };

  const conic = WEDGES.map((w, i) =>
    `${w.color} ${i * 45}deg ${(i + 1) * 45}deg`).join(', ');

  return (
    <div className="game-stage">
      <h3>🎡 Platinum Spin</h3>
      <p className="muted" style={{ fontSize: 13 }}>One free spin every day.</p>
      <div style={{ position: 'relative' }}>
        <div className="spin-pointer">🔻</div>
        <div
          className="spin-wheel"
          style={{
            background: `conic-gradient(${conic})`,
            transform: `rotate(${rot}deg)`,
          }}
        >
          {WEDGES.map((w, i) => {
            const angle = i * 45 + 22;
            return (
              <div key={i} style={{
                position: 'absolute', left: '50%', top: '50%',
                transform: `rotate(${angle}deg) translateY(-88px)`,
                transformOrigin: '0 0',
                fontWeight: 800, fontSize: 15, color: w.amount === 500 ? '#3a2c05' : '#eaf1ff',
              }}>
                {w.label}
              </div>
            );
          })}
          <div style={{
            position: 'absolute', inset: '38%', borderRadius: '50%',
            background: 'linear-gradient(135deg,#f2f7ff,#7f9cf5)',
            display: 'grid', placeItems: 'center', fontSize: 22,
          }}>◈</div>
        </div>
      </div>
      {result != null && <div className="pill up" style={{ fontSize: 16 }}>+◈ {result} credited!</div>}
      <button className="btn primary" onClick={spin} disabled={spinning}>
        {spinning ? 'Spinning…' : 'SPIN 🎡'}
      </button>
    </div>
  );
}
