import React from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, linkGoogleAccount } from '../firebase.js';
import {
  claimOnce, subscribeClaimDoc, subscribePoll, votePoll, hourKey, dayKey,
} from '../lib/bank.js';
import { ProfileCtx } from '../App.jsx';
import { useToast, useCountdown } from '../components/ui.jsx';

const HOUR = 3_600_000;

export default function Earn() {
  const { user, profile } = React.useContext(ProfileCtx);
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const [poll, setPoll] = React.useState(null);
  const [voted, setVoted] = React.useState(null);

  const hk = hourKey();
  const dk = dayKey();
  const [hourly, setHourly] = React.useState(null);
  const [welcome, setWelcome] = React.useState(null);

  React.useEffect(() => subscribeClaimDoc(user.uid, 'hourly', hk, setHourly), [user.uid, hk]);
  React.useEffect(() => subscribeClaimDoc(user.uid, 'welcome', 'google', setWelcome), [user.uid]);
  React.useEffect(() => subscribePoll(setPoll), [user.uid]);

  React.useEffect(() => {
    let alive = true;
    getDoc(doc(db, 'votes', `poll_${dk}_${user.uid}`))
      .then((s) => { if (alive) setVoted(s.exists() ? s.data().choice : null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [poll?.id, user.uid, dk]);

  const nextHour = Math.ceil(Date.now() / HOUR) * HOUR;
  const cd = useCountdown(nextHour);

  const claimHourly = async () => {
    setBusy(true);
    try {
      const amount = 15 + Math.floor(Math.random() * 31); // 15–45
      await claimOnce(user.uid, 'hourly', amount, hk);
      toast(`Loyalty bonus: +◈${amount}! ⏳`);
    } catch (e) { toast(e.message, 'err'); }
    finally { setBusy(false); }
  };

  const linkGoogle = async () => {
    setBusy(true);
    try {
      await linkGoogleAccount(auth.currentUser);
      if (!welcome) {
        await claimOnce(user.uid, 'welcome', 100, 'google');
      }
      toast('Google linked — 100 free credits added! 🔗💳');
    } catch (e) {
      toast(e.code === 'auth/popup-closed-by-user' ? 'Linking cancelled.' : e.message, 'err');
    } finally { setBusy(false); }
  };

  const vote = async (choice) => {
    try {
      await votePoll(user.uid, choice);
      setVoted(choice);
      toast('Vote cast! 🗳️ Polls reset every day.');
    } catch (e) { toast(e.message, 'err'); }
  };

  const total = (poll?.c1?.votes || 0) + (poll?.c2?.votes || 0);
  const pct = (v) => (total ? Math.round((v / total) * 100) : 50);

  return (
    <div>
      <div className="section-head">
        <h2>Earn free credits 🎁</h2>
        <span className="muted" style={{ fontSize: 13 }}>The longer you stay, the more you earn</span>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-title">🔗 Google welcome bonus</div>
          <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>
            Link your Google account once and get <span className="gold">100 free credits</span>.
          </p>
          {profile.googleLinked || welcome ? (
            <span className="pill up">✅ Google linked — bonus claimed</span>
          ) : (
            <button className="btn primary block" onClick={linkGoogle} disabled={busy}>
              Link Google & claim ◈100
            </button>
          )}
        </div>

        <div className="card">
          <div className="card-title">⏳ Hourly loyalty bonus</div>
          <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>
            Check in every hour for <b>◈15–45</b> in free credits.
          </p>
          {hourly ? (
            <span className="pill info">Claimed this hour · next in <b className="countdown">{cd}</b></span>
          ) : (
            <button className="btn primary block" onClick={claimHourly} disabled={busy}>
              Claim hourly bonus 🎁
            </button>
          )}
        </div>

        <div className="card">
          <div className="card-title">🔥 Daily login</div>
          <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>
            Claimed on the home screen every day — your streak grows the reward up to ◈50.
          </p>
          <span className="pill info">Current streak: {profile.streak || 0} day{profile.streak === 1 ? '' : 's'}</span>
        </div>

        <div className="card">
          <div className="card-title">🎮 Play games</div>
          <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>
            Spin the wheel, roll dice, match cards and catch gems — all games pay real credits.
          </p>
          <a className="btn block" href="/games">Open the arcade 🎮</a>
        </div>
      </div>

      <div className="section-head"><h2>Community poll 🗳️</h2></div>
      <div className="card">
        {poll ? (
          <>
        <p className="muted" style={{ fontSize: 14, marginBottom: 16 }}>
          A fresh, just-for-fun question every day. Tap your favourite — no credits at stake, just vibes.
        </p>
        {['c1', 'c2'].map((key) => {
          const c = poll[key];
          const isVoted = voted === key;
          return (
            <div key={key} style={{ marginBottom: 12 }}>
              <button
                className="btn block"
                style={{
                  justifyContent: 'space-between',
                  position: 'relative', overflow: 'hidden',
                  background: isVoted
                    ? 'linear-gradient(135deg, rgba(74,222,128,0.25), rgba(74,222,128,0.08))'
                    : undefined,
                }}
                onClick={() => !voted && vote(key)}
                disabled={!!voted}
              >
                <span>{c.label} {isVoted && '✓'}</span>
                {voted && <b>{pct(c.votes)}% · {c.votes} votes</b>}
              </button>
              {voted && (
                <div style={{ height: 6, borderRadius: 99, background: 'var(--panel)', marginTop: 6, overflow: 'hidden' }}>
                  <div style={{
                    width: `${pct(c.votes)}%`, height: '100%',
                    background: key === 'c1' ? 'linear-gradient(90deg,#6f8dff,#67e8f9)' : 'linear-gradient(90deg,#a990ff,#ff9ecb)',
                  }} />
                </div>
              )}
            </div>
          );
        })}
        {voted && <p className="faint center" style={{ fontSize: 12, marginTop: 8 }}>
          {total} total votes · new poll tomorrow
        </p>}
          </>
        ) : <div className="spinner" />}
      </div>
    </div>
  );
}
