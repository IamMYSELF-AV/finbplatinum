import React from 'react';
import { ProfileCtx } from '../App.jsx';
import { resolveRecipient, transfer, subscribeFriendReqs } from '../lib/bank.js';
import { useToast } from '../components/ui.jsx';

export default function Transfer() {
  const { user, profile } = React.useContext(ProfileCtx);
  const toast = useToast();
  const [text, setText] = React.useState('');
  const [recipient, setRecipient] = React.useState(null);
  const [looking, setLooking] = React.useState(false);
  const [notFound, setNotFound] = React.useState(false);
  const [amount, setAmount] = React.useState('');
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [friends, setFriends] = React.useState([]);

  React.useEffect(() => subscribeFriendReqs(user.uid, (reqs) => {
    setFriends(reqs.filter((r) => r.status === 'accepted').map((r) => {
      const themIsTo = r.to === user.uid;
      return {
        uid: themIsTo ? r.from : r.to,
        name: themIsTo ? r.fromName : r.toName,
        username: themIsTo ? r.fromUsername : r.toUsername,
        cardNumber: null,
      };
    }));
  }), [user.uid]);

  const lookup = React.useCallback(async (val) => {
    const v = val.trim();
    if (v.length < 3) { setRecipient(null); setNotFound(false); return; }
    setLooking(true);
    try {
      const r = await resolveRecipient(v, user.uid);
      setRecipient(r); setNotFound(false);
    } catch {
      setRecipient(null); setNotFound(true);
    } finally { setLooking(false); }
  }, [user.uid]);

  React.useEffect(() => {
    const t = setTimeout(() => lookup(text), 450);
    return () => clearTimeout(t);
  }, [text, lookup]);

  const send = async (e) => {
    e.preventDefault();
    if (!recipient) return toast('Pick a valid recipient first.', 'err');
    const amt = Number(amount);
    if (!(amt > 0)) return toast('Enter an amount.', 'err');
    if (amt > profile.balance) return toast('Not enough credits.', 'err');
    setBusy(true);
    try {
      await transfer({ fromUid: user.uid, toUid: recipient.uid, amount: amt, note });
      toast(`Sent ◈ ${amt.toLocaleString()} to ${recipient.name}! 💸`);
      setText(''); setAmount(''); setNote(''); setRecipient(null);
    } catch (err) { toast(err.message, 'err'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div className="section-head"><h2>Send credits</h2></div>
      <div className="grid cols-2">
        <form className="card" onSubmit={send}>
          <div className="field">
            <label>Recipient — card number or @username</label>
            <input className="input" placeholder="e.g. @billgates or 5291 0000 …"
              value={text} onChange={(e) => setText(e.target.value)} autoCapitalize="none" />
            {looking && <div className="faint mt" style={{ fontSize: 13 }}>Looking up…</div>}
            {notFound && !looking && text.trim().length >= 3 &&
              <div className="bad mt" style={{ fontSize: 13 }}>No account found.</div>}
            {recipient && (
              <div className="row mt" style={{ background: 'var(--panel)', padding: 12, borderRadius: 12, border: '1px solid var(--stroke)' }}>
                <div className="avatar">{recipient.name[0]?.toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{recipient.name}</div>
                  <div className="faint" style={{ fontSize: 12 }}>
                    @{recipient.username} · card •••• {recipient.cardNumber?.slice(-4)}
                  </div>
                </div>
                <span className="pill up">✓ Found</span>
              </div>
            )}
          </div>
          <div className="field">
            <label>Amount (you have ◈ {Number(profile.balance).toLocaleString()})</label>
            <input className="input" type="number" min="1" step="1" placeholder="100"
              value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="field">
            <label>Note (optional)</label>
            <input className="input" placeholder="Pizza money 🍕" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <button className="btn primary block" disabled={busy || !recipient}>
            {busy ? 'Sending…' : 'Send credits 💸'}
          </button>
        </form>

        <div className="card">
          <div className="card-title">🤝 Quick send — friends</div>
          {friends.length === 0 && (
            <p className="muted" style={{ fontSize: 14 }}>
              No friends yet. <a href="/friends">Add friends</a> to send credits in one tap.
            </p>
          )}
          {friends.map((f) => (
            <div className="list-row" key={f.uid}>
              <div className="avatar">{f.name[0]?.toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{f.name}</div>
                <div className="faint" style={{ fontSize: 12 }}>@{f.username}</div>
              </div>
              <button className="btn sm" onClick={() => { setText('@' + f.username); setRecipient(null); }}>
                Send
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
