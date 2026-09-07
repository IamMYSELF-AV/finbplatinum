import React from 'react';
import { ProfileCtx } from '../App.jsx';
import {
  subscribeFriendReqs, addFriend, answerFriendReq,
  subscribeCredReqs, requestCredits, payCredReq, declineCredReq,
} from '../lib/bank.js';
import { Modal, useToast } from '../components/ui.jsx';

export default function Friends() {
  const { user, profile } = React.useContext(ProfileCtx);
  const toast = useToast();
  const [reqs, setReqs] = React.useState([]);
  const [credReqs, setCredReqs] = React.useState([]);
  const [addText, setAddText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [askOf, setAskOf] = React.useState(null);
  const [askAmt, setAskAmt] = React.useState('');
  const [askNote, setAskNote] = React.useState('');

  React.useEffect(() => subscribeFriendReqs(user.uid, setReqs), [user.uid]);
  React.useEffect(() => subscribeCredReqs(user.uid, setCredReqs), [user.uid]);

  const friends = reqs.filter((r) => r.status === 'accepted').map((r) => {
    const iAmTo = r.to === user.uid;
    return {
      uid: iAmTo ? r.from : r.to,
      name: iAmTo ? r.fromName : r.toName,
      username: iAmTo ? r.fromUsername : r.toUsername,
    };
  });
  const incoming = reqs.filter((r) => r.status === 'pending' && r.to === user.uid);
  const outgoing = reqs.filter((r) => r.status === 'pending' && r.from === user.uid);

  const incomingCred = credReqs.filter((c) => c.to === user.uid && c.status === 'pending');
  const myCredReqs = credReqs.filter((c) => c.from === user.uid && c.status === 'pending');

  const add = async (e) => {
    e.preventDefault();
    if (!addText.trim()) return;
    setBusy(true);
    try {
      const them = await addFriend(user.uid, addText);
      toast(`Friend request sent to ${them.name}! 🤝`);
      setAddText('');
    } catch (err) { toast(err.message, 'err'); }
    finally { setBusy(false); }
  };

  const answer = async (r, accept) => {
    try {
      await answerFriendReq(r, accept);
      toast(accept ? `You are now friends with ${accept ? r.fromName : ''} 🎉` : 'Request declined.');
    } catch (err) { toast(err.message, 'err'); }
  };

  const sendReq = async (e) => {
    e.preventDefault();
    const amt = Number(askAmt);
    if (!(amt > 0)) return toast('Enter an amount.', 'err');
    try {
      await requestCredits({ fromUid: user.uid, toUid: askOf.uid, amount: amt, note: askNote });
      toast(`Credit request sent to ${askOf.name} 🙏`);
      setAskOf(null); setAskAmt(''); setAskNote('');
    } catch (err) { toast(err.message, 'err'); }
  };

  const pay = async (c) => {
    try {
      await payCredReq(c);
      toast(`Paid ◈ ${c.amount} to ${c.fromName} 💸`);
    } catch (err) { toast(err.message, 'err'); }
  };

  return (
    <div>
      <div className="section-head"><h2>Friends</h2></div>

      {incomingCred.length > 0 && (
        <div className="card mb" style={{ borderColor: 'rgba(252,211,77,0.4)' }}>
          <div className="card-title gold">🙏 Credit requests for you</div>
          {incomingCred.map((c) => (
            <div className="list-row" key={c.id}>
              <div className="list-icon">💳</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {c.fromName} <span className="faint">(@{c.fromUsername})</span> asks for{' '}
                  <span className="gold">◈ {Number(c.amount).toLocaleString()}</span>
                </div>
                {c.note && <div className="muted" style={{ fontSize: 12 }}>“{c.note}”</div>}
              </div>
              <button className="btn primary sm" onClick={() => pay(c)}
                disabled={profile.balance < c.amount}>Pay</button>
              <button className="btn ghost sm" onClick={() => declineCredReq(c.id)}>Decline</button>
            </div>
          ))}
        </div>
      )}

      <div className="grid cols-2">
        <form className="card" onSubmit={add}>
          <div className="card-title">➕ Add a friend</div>
          <div className="field">
            <label>Their @username or card number</label>
            <input className="input" placeholder="@elonmusk_tesla12" value={addText}
              onChange={(e) => setAddText(e.target.value)} autoCapitalize="none" />
          </div>
          <button className="btn primary block" disabled={busy}>Send friend request</button>

          {incoming.length > 0 && (
            <>
              <div className="card-title mt2">📨 Incoming requests</div>
              {incoming.map((r) => (
                <div className="list-row" key={r.id}>
                  <div className="avatar">{r.fromName[0]?.toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{r.fromName}</div>
                    <div className="faint" style={{ fontSize: 12 }}>@{r.fromUsername}</div>
                  </div>
                  <button className="btn primary sm" onClick={() => answer(r, true)}>Accept</button>
                  <button className="btn ghost sm" onClick={() => answer(r, false)}>✕</button>
                </div>
              ))}
            </>
          )}
          {outgoing.length > 0 && (
            <>
              <div className="card-title mt2">⏳ Waiting on</div>
              {outgoing.map((r) => (
                <div className="list-row" key={r.id}>
                  <div className="avatar">{r.toName[0]?.toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{r.toName}</div>
                    <div className="faint" style={{ fontSize: 12 }}>@{r.toUsername} · request pending</div>
                  </div>
                </div>
              ))}
            </>
          )}
          {myCredReqs.length > 0 && (
            <>
              <div className="card-title mt2">🙏 Your requests</div>
              {myCredReqs.map((c) => (
                <div className="list-row" key={c.id}>
                  <div className="list-icon">⏳</div>
                  <div style={{ flex: 1, fontSize: 13 }}>
                    Waiting on <b>{c.toName}</b> for <span className="gold">◈ {Number(c.amount).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </form>

        <div className="card">
          <div className="card-title">🤝 Your friends ({friends.length})</div>
          {friends.length === 0 && <p className="muted" style={{ fontSize: 14 }}>Add friends to send credits and request credits without typing numbers.</p>}
          {friends.map((f) => (
            <div className="list-row" key={f.uid}>
              <div className="avatar">{f.name[0]?.toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{f.name}</div>
                <div className="faint" style={{ fontSize: 12 }}>@{f.username}</div>
              </div>
              <a className="btn sm" href={`/transfer?to=@${f.username}`}>Send</a>
              <button className="btn ghost sm" onClick={() => setAskOf(f)}>Request</button>
            </div>
          ))}
        </div>
      </div>

      {askOf && (
        <Modal title={`Request credits from ${askOf.name}`} onClose={() => setAskOf(null)}>
          <form onSubmit={sendReq}>
            <div className="field">
              <label>Amount</label>
              <input className="input" type="number" min="1" placeholder="50"
                value={askAmt} onChange={(e) => setAskAmt(e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label>Note (optional)</label>
              <input className="input" placeholder="Movie night 🎬"
                value={askNote} onChange={(e) => setAskNote(e.target.value)} />
            </div>
            <button className="btn primary block">Send request 🙏</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
