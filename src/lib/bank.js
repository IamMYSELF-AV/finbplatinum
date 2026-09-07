// ─────────────────────────────────────────────────────────────
//  FINB Platinum — banking / economy engine (Firestore)
//  All money moves through validated "order"/"trade"/"claim"
//  documents so firestore.rules can verify every balance change.
// ─────────────────────────────────────────────────────────────
import {
  doc, getDoc, setDoc, updateDoc, addDoc, collection, query, where,
  orderBy, limit, onSnapshot, runTransaction, getDocs, serverTimestamp,
  writeBatch, increment,
} from 'firebase/firestore';
import { db } from '../firebase';
import { generateCardNumber, generateCVV, generateExpiry } from './cards';
import { priceAt, currentTick, STOCKS } from './market';

export const DAY_MS = 86_400_000;
export const dayKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
export const hourKey = (now = Date.now()) =>
  `${dayKey(now)}_${Math.floor(now / 3_600_000)}`;

// ── Profiles ────────────────────────────────────────────────────────────────
export async function createProfile(user, { username, name, googleLinked }) {
  const u = username.trim().toLowerCase().replace(/^@/, '');
  const cardNumber = generateCardNumber();
  const cvv = generateCVV();
  const expiry = generateExpiry();
  const welcome = googleLinked ? 100 : 0;

  await runTransaction(db, async (tx) => {
    const nameRef = doc(db, 'usernames', u);
    const userRef = doc(db, 'users', user.uid);
    const nameSnap = await tx.get(nameRef);
    const userSnap = await tx.get(userRef);
    if (nameSnap.exists()) throw new Error('That username is already taken.');
    if (userSnap.exists()) throw new Error('Profile already exists.');

    tx.set(userRef, {
      username: u,
      name: name.trim(),
      cardNumber,
      balance: welcome,
      streak: 0,
      lastDaily: null,
      googleLinked: !!googleLinked,
      welcomeClaimed: !!googleLinked,
      createdAt: serverTimestamp(),
      createdAtMs: Date.now(),
      lastClaim: null,
      lastOut: null,
      lastIn: null,
    });
    tx.set(doc(db, 'private', user.uid), { cvv, expiry, cardNumber });
    tx.set(nameRef, { uid: user.uid });
    if (welcome) {
      tx.set(doc(collection(db, 'txns')), {
        type: 'bonus', fromUid: 'BANK', toUid: user.uid,
        fromName: 'FINB Platinum', toName: name.trim(),
        fromUsername: 'platinum', toUsername: u,
        amount: welcome, note: 'Welcome bonus — Google account linked',
        partyUids: [user.uid], at: serverTimestamp(), atMs: Date.now(),
      });
    }
  });
  return { cardNumber, cvv, expiry };
}

export function subscribeProfile(uid, cb) {
  return onSnapshot(doc(db, 'users', uid), (snap) => cb(snap.exists() ? snap.data() : null));
}

export function subscribePrivate(uid, cb) {
  return onSnapshot(doc(db, 'private', uid), (snap) => cb(snap.exists() ? snap.data() : null));
}

export async function getPrivate(uid) {
  const s = await getDoc(doc(db, 'private', uid));
  return s.data();
}

// ── Recipient lookup (card number OR @username) ─────────────────────────────
export async function resolveRecipient(text, selfUid) {
  const t = String(text).trim().toLowerCase().replace(/^@/, '').replace(/\s/g, '');
  if (!t) throw new Error('Enter a card number or username.');
  let uid = null;
  if (/^\d{13,16}$/.test(t)) {
    const q = query(collection(db, 'users'), where('cardNumber', '==', t), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) uid = snap.docs[0].id;
  } else {
    const s = await getDoc(doc(db, 'usernames', t));
    if (s.exists()) uid = s.data().uid;
  }
  if (!uid) throw new Error('No account found for that card number or username.');
  if (uid === selfUid) throw new Error('You cannot send credits to yourself.');
  const u = (await getDoc(doc(db, 'users', uid))).data();
  if (!u) throw new Error('Account not found.');
  return { uid, username: u.username, name: u.name, cardNumber: u.cardNumber };
}

// ── Transfers (two-phase order: pending -> settled) ─────────────────────────
async function settleOrder(orderRef, { fromUid, toUid, amount, meta = {} }) {
  await runTransaction(db, async (tx) => {
    const o = (await tx.get(orderRef)).data();
    if (!o || o.status !== 'pending') throw new Error('Order already processed.');
    const fromRef = doc(db, 'users', fromUid);
    const toRef = doc(db, 'users', toUid);
    const from = await tx.get(fromRef);
    const to = await tx.get(toRef);
    if (from.data().balance < amount) throw new Error('Insufficient balance.');

    tx.update(fromRef, {
      balance: from.data().balance - amount,
      lastOut: orderRef.id,
    });
    tx.update(toRef, {
      balance: to.data().balance + amount,
      lastIn: orderRef.id,
    });
    tx.update(orderRef, { status: 'settled', atMs: Date.now() });
    tx.set(doc(collection(db, 'txns')), {
      type: meta.type || 'transfer',
      fromUid, toUid,
      fromName: meta.fromName || from.data().name,
      toName: meta.toName || to.data().name,
      fromUsername: from.data().username,
      toUsername: to.data().username,
      fromCard: from.data().cardNumber,
      toCard: to.data().cardNumber,
      amount, note: meta.note || '',
      partyUids: [fromUid, toUid],
      at: serverTimestamp(), atMs: Date.now(),
      ...(meta.extra || {}),
    });
    if (meta.credReqRef) {
      tx.update(meta.credReqRef, { status: 'paid', paidAt: serverTimestamp() });
    }
  });
}

export async function transfer({ fromUid, toUid, amount, note, credReqId }) {
  amount = Math.round(Number(amount) * 100) / 100;
  if (!(amount > 0)) throw new Error('Enter an amount greater than zero.');
  const orderRef = doc(collection(db, 'orders'));
  await setDoc(orderRef, {
    from: fromUid, to: toUid, amount, note: note || '',
    status: 'pending', at: serverTimestamp(),
  });
  await settleOrder(orderRef, {
    fromUid, toUid, amount,
    meta: { note, credReqRef: credReqId ? doc(db, 'credReqs', credReqId) : null },
  });
}

// ── Friends ─────────────────────────────────────────────────────────────────
export async function addFriend(myUid, username) {
  const them = await resolveRecipient(username, myUid);
  // Already friends / request pending?
  const q = query(
    collection(db, 'friendReqs'),
    where('pair', '==', [myUid, them.uid].sort().join('_'))
  );
  const existing = await getDocs(q);
  if (!existing.empty) {
    const d = existing.docs[0].data();
    if (d.status === 'accepted') throw new Error('You are already friends.');
    throw new Error('A friend request is already pending.');
  }
  const me = (await getDoc(doc(db, 'users', myUid))).data();
  await addDoc(collection(db, 'friendReqs'), {
    from: myUid, to: them.uid,
    fromName: me.name, fromUsername: me.username,
    toName: them.name, toUsername: them.username,
    pair: [myUid, them.uid].sort().join('_'),
    status: 'pending', at: serverTimestamp(), atMs: Date.now(),
  });
  return them;
}

export function subscribeFriendReqs(uid, cb) {
  const q1 = query(collection(db, 'friendReqs'), where('to', '==', uid));
  const q2 = query(collection(db, 'friendReqs'), where('from', '==', uid));
  const all = new Map();
  const flush = () => cb([...all.values()]);
  const un1 = onSnapshot(q1, (s) => { s.docChanges().forEach((c) => {
    if (c.type === 'removed') all.delete(c.doc.id); else all.set(c.doc.id, { id: c.doc.id, ...c.doc.data() });
  }); flush(); });
  const un2 = onSnapshot(q2, (s) => { s.docChanges().forEach((c) => {
    if (c.type === 'removed') all.delete(c.doc.id); else all.set(c.doc.id, { id: c.doc.id, ...c.doc.data() });
  }); flush(); });
  return () => { un1(); un2(); };
}

export async function answerFriendReq(req, accept) {
  await updateDoc(doc(db, 'friendReqs', req.id), {
    status: accept ? 'accepted' : 'declined',
  });
}

// ── Credit requests between friends ─────────────────────────────────────────
export async function requestCredits({ fromUid, toUid, amount, note }) {
  amount = Math.round(Number(amount) * 100) / 100;
  if (!(amount > 0)) throw new Error('Enter an amount greater than zero.');
  const me = (await getDoc(doc(db, 'users', fromUid))).data();
  const them = (await getDoc(doc(db, 'users', toUid))).data();
  await addDoc(collection(db, 'credReqs'), {
    from: fromUid, to: toUid,
    fromName: me.name, fromUsername: me.username,
    toName: them.name, toUsername: them.username,
    amount, note: note || '', status: 'pending',
    at: serverTimestamp(), atMs: Date.now(),
  });
}

export function subscribeCredReqs(uid, cb) {
  const q1 = query(collection(db, 'credReqs'), where('to', '==', uid), orderBy('atMs', 'desc'));
  const q2 = query(collection(db, 'credReqs'), where('from', '==', uid), orderBy('atMs', 'desc'));
  const all = new Map();
  const flush = () => cb([...all.values()].sort((a, b) => b.atMs - a.atMs));
  const un1 = onSnapshot(q1, (s) => { s.docChanges().forEach((c) => {
    if (c.type === 'removed') all.delete(c.doc.id); else all.set(c.doc.id, { id: c.doc.id, ...c.doc.data() });
  }); flush(); });
  const un2 = onSnapshot(q2, (s) => { s.docChanges().forEach((c) => {
    if (c.type === 'removed') all.delete(c.doc.id); else all.set(c.doc.id, { id: c.doc.id, ...c.doc.data() });
  }); flush(); });
  return () => { un1(); un2(); };
}

export async function payCredReq(req) {
  await transfer({
    fromUid: req.to, toUid: req.from, amount: req.amount,
    note: req.note || `Credit request from @${req.fromUsername}`,
    credReqId: req.id,
  });
}

export async function declineCredReq(id) {
  await updateDoc(doc(db, 'credReqs', id), { status: 'declined' });
}

// ── Stock market ────────────────────────────────────────────────────────────
export function subscribePortfolio(uid, cb) {
  return onSnapshot(doc(db, 'portfolios', uid), (s) =>
    cb(s.exists() ? s.data() : { holdings: {}, realized: 0 }));
}

export async function tradeStock({ uid, sym, qty, side }) {
  qty = Math.floor(Number(qty));
  if (!(qty > 0)) throw new Error('Enter a quantity.');
  const stock = STOCKS.find((s) => s.id === sym);
  if (!stock) throw new Error('Unknown stock.');
  const price = priceAt(stock, currentTick());
  const amount = Math.round(price * qty * 100) / 100;

  const tradeRef = doc(collection(db, 'trades'));
  await setDoc(tradeRef, {
    uid, sym, qty, side, price, amount, status: 'pending', atMs: Date.now(),
  });

  await runTransaction(db, async (tx) => {
    const t = await tx.get(tradeRef);
    if (!t.exists() || t.data().status !== 'pending') throw new Error('Trade already processed.');
    const uRef = doc(db, 'users', uid);
    const pRef = doc(db, 'portfolios', uid);
    const u = (await tx.get(uRef)).data();
    const pSnap = await tx.get(pRef);
    const p = pSnap.exists() ? pSnap.data() : { holdings: {}, realized: 0 };
    const holdings = { ...(p.holdings || {}) };
    const h = holdings[sym] || { qty: 0, avg: 0 };

    if (side === 'buy') {
      if (u.balance < amount) throw new Error('Insufficient balance.');
      const newQty = h.qty + qty;
      holdings[sym] = {
        qty: newQty,
        avg: Math.round(((h.avg * h.qty + price * qty) / newQty) * 100) / 100,
      };
      tx.update(uRef, { balance: Math.round((u.balance - amount) * 100) / 100, lastOut: tradeRef.id });
    } else {
      if (h.qty < qty) throw new Error('You do not own that many shares.');
      const newQty = h.qty - qty;
      if (newQty === 0) delete holdings[sym];
      else holdings[sym] = { ...h, qty: newQty };
      tx.update(uRef, {
        balance: Math.round((u.balance + amount) * 100) / 100,
        lastIn: tradeRef.id,
      });
      tx.set(pRef, {
        holdings,
        realized: Math.round(((p.realized || 0) + (price - h.avg) * qty) * 100) / 100,
      }, { merge: true });
      tx.update(tradeRef, { status: 'settled' });
      tx.set(doc(collection(db, 'txns')), {
        type: 'stock', fromUid: uid, toUid: 'MARKET',
        fromName: u.name, toName: stock.name,
        fromUsername: u.username, toUsername: sym,
        amount, note: `Sold ${qty} ${sym} @ ${price}`,
        partyUids: [uid], at: serverTimestamp(), atMs: Date.now(),
      });
      return;
    }
    tx.set(pRef, { holdings, realized: p.realized || 0 }, { merge: true });
    tx.update(tradeRef, { status: 'settled' });
    tx.set(doc(collection(db, 'txns')), {
      type: 'stock', fromUid: uid, toUid: 'MARKET',
      fromName: u.name, toName: stock.name,
      fromUsername: u.username, toUsername: sym,
      amount, note: `Bought ${qty} ${sym} @ ${price}`,
      partyUids: [uid], at: serverTimestamp(), atMs: Date.now(),
    });
  });
}

// ── Earnings claims (daily bonus, spin, hourly, games) ──────────────────────
// Caps are enforced again in firestore.rules.
export const CLAIM_CAPS = {
  login: 200, spin: 500, hourly: 45, welcome: 100,
  dice: 30, memory: 60, catch: 80,
};
export const GAME_PLAY_CAPS = { dice: 25, memory: 20, catch: 15 };

export async function claimOnce(uid, kind, amount, key) {
  const cap = CLAIM_CAPS[kind];
  if (amount > cap) throw new Error('Reward exceeds limit.');
  const claimId = `${uid}_${kind}_${key}`;
  const cRef = doc(db, 'claims', claimId);
  await runTransaction(db, async (tx) => {
    const c = await tx.get(cRef);
    if (c.exists()) throw new Error('Already claimed. Come back later!');
    const uRef = doc(db, 'users', uid);
    const u = (await tx.get(uRef)).data();
    tx.set(cRef, { uid, kind, key, amount, at: serverTimestamp(), atMs: Date.now() });
    tx.update(uRef, {
      balance: Math.round((u.balance + amount) * 100) / 100,
      lastClaim: claimId,
      ...(kind === 'login' ? { lastDaily: key, streak: (u.streak || 0) + 1 } : {}),
    });
    tx.set(doc(collection(db, 'txns')), {
      type: 'game', fromUid: 'BANK', toUid: uid,
      fromName: 'FINB Platinum', toName: u.name,
      fromUsername: 'platinum', toUsername: u.username,
      amount, note:
        kind === 'login' ? 'Daily login bonus'
        : kind === 'spin' ? 'Platinum Spin reward'
        : kind === 'hourly' ? 'Hourly loyalty bonus'
        : 'Game reward',
      partyUids: [uid], at: serverTimestamp(), atMs: Date.now(),
    });
  });
  return amount;
}

// Multi-play games: one claim doc per day with play count + running total.
// `amount` on the doc is the per-play cap (fixed), used by security rules to
// bound the balance delta on every play.
export async function claimGamePlay(uid, kind, amount) {
  const cap = CLAIM_CAPS[kind];
  const maxPlays = GAME_PLAY_CAPS[kind];
  const key = dayKey();
  const claimId = `${uid}_${kind}_${key}`;
  const cRef = doc(db, 'claims', claimId);
  if (amount > cap) amount = cap;
  await runTransaction(db, async (tx) => {
    const c = await tx.get(cRef);
    const uRef = doc(db, 'users', uid);
    const u = (await tx.get(uRef)).data();
    const plays = c.exists() ? c.data().plays : 0;
    const total = c.exists() ? c.data().total : 0;
    if (plays >= maxPlays) throw new Error(`Daily ${kind} plays used up — come back tomorrow!`);
    if (!c.exists()) {
      tx.set(cRef, { uid, kind, key, amount: cap, plays: 1, total: amount, at: serverTimestamp(), atMs: Date.now() });
    } else {
      tx.update(cRef, {
        amount: cap,
        plays: plays + 1,
        total: Math.round((total + amount) * 100) / 100,
      });
    }
    tx.update(uRef, {
      balance: Math.round((u.balance + amount) * 100) / 100,
      lastClaim: claimId,
    });
    tx.set(doc(collection(db, 'txns')), {
      type: 'game', fromUid: 'BANK', toUid: uid,
      fromName: 'FINB Platinum', toName: u.name,
      fromUsername: 'platinum', toUsername: u.username,
      amount, note: 'Game reward',
      partyUids: [uid], at: serverTimestamp(), atMs: Date.now(),
    });
  });
}

// Live state of today's claim doc for a kind (drives daily play counters).
export function subscribeClaimState(uid, kind, cb) {
  const id = `${uid}_${kind}_${dayKey()}`;
  return onSnapshot(doc(db, 'claims', id), (s) =>
    cb(s.exists() ? s.data() : { plays: 0, total: 0 }));
}

// One-shot claim state (daily spin, login, hourly, welcome).
export function subscribeClaimDoc(uid, kind, key, cb) {
  const id = `${uid}_${kind}_${key}`;
  return onSnapshot(doc(db, 'claims', id), (s) => cb(s.exists() ? s.data() : null));
}

// ── Community poll (auto-rotates daily) ─────────────────────────────────────
const POLL_PAIRS = [
  ['🚀 Rocket ships', '✈️ Jet planes'],
  ['🍕 Pizza', '🌮 Tacos'],
  ['🦸 Super speed', '👻 Invisibility'],
  ['🏔️ Mountains', '🏖️ Beaches'],
  ['🤖 Robots', '🐉 Dragons'],
  ['🎮 Video games', '🎬 Movies'],
  ['🌙 Night owl', '🌅 Early bird'],
  ['🍫 Chocolate', '🍬 Gummy candy'],
];

export function pollForDay(key = dayKey()) {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pair = POLL_PAIRS[h % POLL_PAIRS.length];
  return { id: `poll_${key}`, c1: { label: pair[0], votes: 0 }, c2: { label: pair[1], votes: 0 } };
}

export function subscribePoll(cb) {
  const key = dayKey();
  const ref = doc(db, 'polls', `poll_${key}`);
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) return cb({ id: snap.id, ...snap.data() });
    // First visitor of the day creates it (rules: any authed user may create).
    const seed = pollForDay(key);
    setDoc(ref, { ...seed, createdAt: serverTimestamp(), atMs: Date.now() }).catch(() => {});
    cb(seed);
  });
}

export async function votePoll(uid, choice) {
  const key = dayKey();
  const pollId = `poll_${key}`;
  const voteRef = doc(db, 'votes', `${pollId}_${uid}`);
  const existing = await getDoc(voteRef);
  if (existing.exists()) throw new Error('You have already voted today.');
  const b = writeBatch(db);
  b.set(voteRef, { uid, choice, at: serverTimestamp() });
  b.update(doc(db, 'polls', pollId), {
    [choice === 'c1' ? 'c1.votes' : 'c2.votes']: increment(1),
  });
  await b.commit();
}

// ── Transaction feed ────────────────────────────────────────────────────────
export function subscribeTxns(uid, cb, n = 12) {
  const q1 = query(collection(db, 'txns'), where('fromUid', '==', uid), orderBy('atMs', 'desc'), limit(n));
  const q2 = query(collection(db, 'txns'), where('toUid', '==', uid), orderBy('atMs', 'desc'), limit(n));
  const all = new Map();
  const flush = () => cb([...all.values()].sort((a, b) => (b.atMs || 0) - (a.atMs || 0)).slice(0, n));
  const un1 = onSnapshot(q1, (s) => { s.docChanges().forEach((c) => {
    if (c.type === 'removed') all.delete(c.doc.id); else all.set(c.doc.id, { id: c.doc.id, ...c.doc.data() });
  }); flush(); });
  const un2 = onSnapshot(q2, (s) => { s.docChanges().forEach((c) => {
    if (c.type === 'removed') all.delete(c.doc.id); else all.set(c.doc.id, { id: c.doc.id, ...c.doc.data() });
  }); flush(); });
  return () => { un1(); un2(); };
}

export function subscribeLeaderboard(cb) {
  const q = query(collection(db, 'users'), orderBy('balance', 'desc'), limit(15));
  return onSnapshot(q, (s) => cb(s.docs.map((d, i) => ({ rank: i + 1, uid: d.id, ...d.data() }))));
}
