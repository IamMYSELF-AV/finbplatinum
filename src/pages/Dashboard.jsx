import React from 'react';
import { Link } from 'react-router-dom';
import { ProfileCtx } from '../App.jsx';
import { subscribeTxns, subscribeLeaderboard, claimOnce, dayKey } from '../lib/bank.js';
import { BankCard, useToast } from '../components/ui.jsx';

function TxnIcon({ t, me }) {
  const inOut = t.toUid === me ? 'in' : 'out';
  if (t.type === 'stock') return <div className="list-icon">📈</div>;
  if (t.type === 'game' || t.type === 'bonus') return <div className="list-icon">🎁</div>;
  return <div className="list-icon">{inOut === 'in' ? '📥' : '📤'}</div>;
}

export default function Dashboard() {
  const { user, profile } = React.useContext(ProfileCtx);
  const toast = useToast();
  const [txns, setTxns] = React.useState([]);
  const [board, setBoard] = React.useState([]);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => subscribeTxns(user.uid, setTxns), [user.uid]);
  React.useEffect(() => subscribeLeaderboard(setBoard), []);

  const today = dayKey();
  const dailyReady = profile.lastDaily !== today;
  const dailyReward = Math.min(50, 10 + (profile.streak || 0) * 5);

  const claimDaily = async () => {
    setBusy(true);
    try {
      await claimOnce(user.uid, 'login', dailyReward, today);
      toast(`Daily bonus claimed: +${dailyReward} credits! 🔥 Streak ${(profile.streak || 0) + 1}`);
    } catch (e) { toast(e.message, 'err'); }
    finally { setBusy(false); }
  };

  const me = user.uid;

  return (
    <div>
      <div className="hero-banner">
        <h2>Welcome back, {profile.name.split(' ')[0]} ✨</h2>
        <p>
          Your Designer Gold account is live. Trade the markets, spin the wheel, play arcade games
          and grow your credits — liquid gold vibes, zero tension.
        </p>
        <div className="row mt">
          {dailyReady ? (
            <button className="btn primary" onClick={claimDaily} disabled={busy}>
              🔥 Claim daily bonus · +{dailyReward}
            </button>
          ) : (
            <span className="pill info">✅ Daily bonus claimed — streak {profile.streak || 0}</span>
          )}
          <Link className="btn ghost" to="/games">🎮 Play games</Link>
        </div>
      </div>

      <div className="grid cols-2">
        <BankCard profile={profile} balance={profile.balance} />
        <div className="card">
          <div className="card-title">⚡ Quick actions</div>
          <div className="grid cols-2">
            <Link to="/transfer" className="btn">💸 Send credits</Link>
            <Link to="/friends" className="btn">🤝 Friends</Link>
            <Link to="/market" className="btn">📈 Trade stocks</Link>
            <Link to="/earn" className="btn">🎁 Earn free credits</Link>
          </div>
          <div className="card-title mt2">🏆 Platinum leaderboard</div>
          {board.slice(0, 6).map((r) => (
            <div key={r.uid} className={`leaderboard-row ${r.uid === me ? 'me' : ''}`}>
              <div className="lb-rank">{r.rank <= 3 ? ['🥇','🥈','🥉'][r.rank - 1] : r.rank}</div>
              <div className="avatar" style={{ width: 30, height: 30, fontSize: 12 }}>
                {(r.name || '?')[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{r.name}{r.uid === me && ' (You)'}</div>
                <div className="faint" style={{ fontSize: 12 }}>@{r.username}</div>
              </div>
              <div className="gold" style={{ fontWeight: 800 }}>◈ {Number(r.balance).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="section-head">
        <h2>Recent activity</h2>
        <Link to="/card" className="muted" style={{ fontSize: 13 }}>View card details →</Link>
      </div>
      <div className="card">
        {txns.length === 0 && <p className="muted center" style={{ padding: 20 }}>No transactions yet — send some credits or play a game!</p>}
        {txns.map((t) => {
          const isIn = t.toUid === me;
          const other = isIn ? t.fromName : t.toName;
          return (
            <div className="list-row" key={t.id}>
              <TxnIcon t={t} me={me} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {t.type === 'stock' ? t.note
                    : t.type === 'game' || t.type === 'bonus' ? t.note || 'Reward'
                    : isIn ? `From ${other}` : `To ${other}`}
                </div>
                <div className="faint" style={{ fontSize: 12 }}>
                  {t.atMs ? new Date(t.atMs).toLocaleString() : 'just now'}
                </div>
              </div>
              <div className={`txn-amt ${isIn ? 'in' : 'out'}`} style={{ fontWeight: 800 }}>
                {isIn ? '+' : '−'}◈ {Number(t.amount).toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
