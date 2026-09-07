import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
  collection, query, where, limit, serverTimestamp, increment
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const CARDS_COL   = 'FINB credit cards';
const TXN_COL     = 'FINB_transactions';
const STOCK_COL   = 'FINB crediz - Stock Market';
const VB_COL      = 'FINB crediz - Vote Bet';        // reused collection, renamed in UI
const VR_COL      = 'FINB crediz - Vote Records';
const REWARDS_COL = 'FINB_shop_rewards';
const POLL_NAME   = 'Community Poll';                  // kid-friendly name shown in UI

let db = null;

function initFirebase() {
  const cfg = window.FINB_CONFIG;
  if (!cfg || !cfg.projectId) return;
  try {
    const existing = getApps().find(a => a.name === 'addon');
    const app = existing || initializeApp(cfg, 'addon');
    db = getFirestore(app);
  } catch (e) { console.warn('[FINB Addon] Firebase init:', e.message); }
}
function requireDb() {
  if (!db) throw new Error('Firebase is not configured. Please set a valid API key in config.js.');
}
function cardNo() { return localStorage.getItem('finb_session_card'); }

// ─── DOM helpers ──────────────────────────────────────────────────────────────
function el(tag, css, txt) {
  const e = document.createElement(tag);
  if (css) e.setAttribute('style', css);
  if (txt != null) e.textContent = txt;
  return e;
}
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function datePassed(v) {
  if (!v) return false;
  try { return (v?.toDate ? v.toDate() : new Date(v)) <= new Date(); } catch { return false; }
}
function fmtDate(v) {
  if (!v) return 'TBD';
  try { return (v?.toDate ? v.toDate() : new Date(v)).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}); }
  catch { return String(v); }
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  overlay:  'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.88);backdrop-filter:blur(12px);padding:16px;',
  modal:    'background:#0d0d1a;border:1px solid rgba(255,255,255,0.1);border-radius:22px;max-width:580px;width:100%;max-height:90vh;overflow-y:auto;padding:28px 24px;position:relative;',
  closeBtn: 'position:absolute;top:12px;right:14px;background:rgba(255,255,255,0.07);border:none;color:rgba(255,255,255,0.5);width:30px;height:30px;border-radius:50%;font-size:20px;cursor:pointer;line-height:28px;text-align:center;',
  lbWrap:   'margin-top:20px;background:rgba(0,0,0,0.45);border:1px solid rgba(212,168,83,0.25);border-radius:18px;overflow:hidden;',
  lbHead:   'padding:14px 18px 10px;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:rgba(212,168,83,0.85);display:flex;align-items:center;gap:8px;',
  lbRow:    'display:flex;align-items:center;gap:10px;padding:9px 18px;border-top:1px solid rgba(255,255,255,0.04);',
  errBox:   'padding:10px 14px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:10px;color:#f87171;font-size:13px;margin-top:8px;',
  okBox:    'padding:10px 14px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.2);border-radius:10px;color:#34d399;font-size:13px;margin-top:8px;',
  gCard:    'background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:20px;margin-bottom:14px;',
  mGrid:    'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;',
  mItem:    'background:rgba(255,255,255,0.03);border-radius:10px;padding:10px 12px;',
  mLbl:     'font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,0.35);margin-bottom:3px;',
  mVal:     'font-weight:700;font-size:14px;',
  hr:       'border:none;border-top:1px solid rgba(255,255,255,0.07);margin:12px 0;',
  pill:     'display:inline-block;font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:3px 9px;border-radius:99px;',
  candRow:  'display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap;',
  candCard: 'flex:1;min-width:120px;padding:14px;background:rgba(0,0,0,0.3);border:2px solid rgba(255,255,255,0.07);border-radius:12px;',
  voteBtn:  'flex:1;padding:10px 14px;font-weight:700;font-size:13px;border:none;border-radius:10px;cursor:pointer;color:#fff;',
  sec:      'margin-top:20px;padding:18px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.08);border-radius:16px;',
  secT:     'font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,0.35);margin-bottom:12px;',
  holdRow:  'display:flex;align-items:center;gap:10px;padding:12px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.07);border-radius:12px;margin-bottom:8px;',
  numIn:    'width:62px;padding:6px 8px;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#fff;font-size:13px;text-align:center;outline:none;',
  btnGold:  'padding:8px 16px;background:linear-gradient(135deg,#d4a853,#b8860b);color:#000;font-weight:700;font-size:13px;border:none;border-radius:10px;cursor:pointer;white-space:nowrap;',
  tabWrap:  'display:flex;gap:8px;padding:0 4px 4px;margin-bottom:4px;',
  tabOff:   'padding:7px 18px;border:1px solid rgba(255,255,255,0.15);border-radius:99px;font-size:13px;font-weight:600;cursor:pointer;background:transparent;color:rgba(255,255,255,0.5);',
  tabOn:    'padding:7px 18px;border:1px solid rgba(212,168,83,0.5);border-radius:99px;font-size:13px;font-weight:600;cursor:pointer;background:rgba(212,168,83,0.12);color:#fcd34d;',
  rewardBox:'margin-top:12px;padding:14px;background:rgba(212,168,83,0.12);border:1px solid rgba(212,168,83,0.3);border-radius:12px;color:#fcd34d;font-size:13px;font-weight:600;line-height:1.5;',
  votBar:   'height:6px;border-radius:99px;margin-top:6px;background:rgba(255,255,255,0.08);overflow:hidden;',
  votFill:  'height:100%;border-radius:99px;transition:width .5s ease;',
  formGroup: 'margin-bottom:20px;',
  formLabel: 'display:block;margin-bottom:5px;font-size:14px;color:rgba(255,255,255,0.8);',
  formInput: 'width:100%;padding:12px;border:1px solid rgba(255,255,255,0.2);border-radius:8px;background:rgba(255,255,255,0.05);color:#fff;font-size:16px;',
  cardDetails: 'background:rgba(255,255,255,0.05);border-radius:12px;padding:20px;margin-top:20px;',
  cardGrid: 'display:grid;grid-template-columns:1fr 1fr;gap:10px;',
  cardItem: 'background:rgba(255,255,255,0.03);padding:10px;border-radius:8px;',
  cardLabel: 'font-size:12px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.5px;',
  cardValue: 'font-weight:600;margin-top:2px;',
  termsContent: 'color:rgba(255,255,255,0.8);line-height:1.6;max-height:300px;overflow-y:auto;margin-bottom:20px;padding:15px;background:rgba(255,255,255,0.05);border-radius:8px;',
};

// ─── Persistent CSS for the Community Poll card ───────────────────────────────
function injectPollCSS() {
  if (document.getElementById('addon-poll-css')) return;
  const s = document.createElement('style');
  s.id = 'addon-poll-css';
  s.textContent = `
    [data-finb-vb] { opacity:1 !important; cursor:pointer !important;
      border-color:rgba(168,85,247,0.45) !important;
      transition:transform .15s,box-shadow .15s !important; }
    [data-finb-vb]:hover { transform:scale(1.02); box-shadow:0 0 28px rgba(168,85,247,0.22); }
    [data-finb-vb] [data-finb-badge] { display:none !important; }
    [data-finb-vb] [data-finb-soon]  { color:rgba(192,132,252,0.9) !important; }
  `;
  document.head.appendChild(s);
}

// ─── Tag & rename Vote Bet card ───────────────────────────────────────────────
function tagPollCard() {
  const root = document.getElementById('root');
  if (!root) return;
  for (const h4 of root.querySelectorAll('h4')) {
    if (h4.textContent.trim() !== 'Vote Bet') continue;
    // Rename the card title
    h4.textContent = POLL_NAME;
    const card = h4.parentElement;
    if (!card) continue;
    card.dataset.finbVb = '1';
    // Hide "Soon" badge
    const badge = card.querySelector('.absolute span');
    if (badge?.textContent.trim() === 'Soon') badge.parentElement.dataset.finbBadge = '1';
    // Replace "Coming soon" row
    for (const div of card.querySelectorAll('div')) {
      if (div.textContent.includes('Coming soon') && !div.querySelector('h4') && !div.querySelector('p')) {
        div.dataset.finbSoon = '1';
        div.textContent = 'Tap to participate →';
      }
    }
    // Also update the p description if it mentions "Bet"
    for (const p of card.querySelectorAll('p')) {
      if (p.textContent.toLowerCase().includes('bet')) {
        p.textContent = 'Vote for your favourite candidate in community polls.';
      }
    }
  }
}

// ─── Click delegation for Community Poll card ─────────────────────────────────
function setupPollDelegation() {
  document.addEventListener('click', (e) => {
    let node = e.target; let d = 0;
    while (node && node !== document.body && d++ < 12) {
      if (node.nodeType === 1) {
        if (node.dataset?.finbVb) { openPollModal(); e.stopPropagation(); return; }
        if (node.tagName === 'H4' && (node.textContent?.trim() === 'Vote Bet' || node.textContent?.trim() === POLL_NAME)) {
          openPollModal(); e.stopPropagation(); return;
        }
      }
      node = node.parentElement;
    }
  }, true);
}

// ─── Community Poll modal ─────────────────────────────────────────────────────
async function openPollModal() {
  if (document.getElementById('addon-poll-overlay')) return;
  const overlay = el('div', S.overlay); overlay.id = 'addon-poll-overlay';
  const modal   = el('div', S.modal);
  const closeB  = el('button', S.closeBtn, '×');
  closeB.onclick    = () => overlay.remove();
  overlay.onclick   = e => { if (e.target === overlay) overlay.remove(); };

  modal.appendChild(closeB);
  const titleRow = el('div','display:flex;align-items:center;gap:10px;margin-bottom:4px;');
  titleRow.appendChild(el('h2','font-size:22px;font-weight:700;color:#fff;margin:0;', POLL_NAME));
  titleRow.appendChild(el('span', S.pill + 'background:rgba(168,85,247,0.15);color:#c084fc;border:1px solid rgba(168,85,247,0.25);font-size:9px;', '🗳 COMMUNITY'));
  modal.appendChild(titleRow);
  modal.appendChild(el('p','font-size:13px;color:rgba(255,255,255,0.45);margin-bottom:20px;','Vote for your candidate. The one with the most votes wins!'));

  const body = el('div','');
  body.textContent = 'Loading polls…'; body.style.color = 'rgba(255,255,255,0.4)';
  modal.appendChild(body); overlay.appendChild(modal); document.body.appendChild(overlay);

  try {
    requireDb();
    const polls = await loadPolls();
    body.textContent = '';
    if (!polls.length) {
      body.appendChild(el('p','color:rgba(255,255,255,0.4);font-size:14px;text-align:center;padding:20px 0;','No active polls right now. Check back later!'));
    } else {
      for (const p of polls) await renderPoll(p, cardNo(), body);
    }
  } catch (err) {
    body.innerHTML = '';
    body.appendChild(el('p', S.errBox, err.message || 'Failed to load polls.'));
  }
}

async function loadPolls() {
  const snap = await getDocs(collection(db, VB_COL));
  const docs = {};
  snap.forEach(d => { docs[d.id] = d.data(); });

  const polls = [];
  // Primary poll: "game" doc (skip if game === false)
  if (docs['game'] && docs['game'].game !== false) {
    polls.push({ id:'game', prefix:'', data:docs['game'], c1:docs['candidate1']||null, c2:docs['candidate2']||null });
  }
  // Additional polls: game2, game3, …
  for (const id of Object.keys(docs).sort()) {
    const m = id.match(/^game(\d+)$/);
    if (!m) continue;
    const n = m[1];
    if (docs[id].game === false) continue;
    polls.push({ id, prefix:n, data:docs[id], c1:docs[`${n}candidate1`]||null, c2:docs[`${n}candidate2`]||null });
  }
  return polls;
}

async function renderPoll(poll, cn, container) {
  const gd       = poll.data || {};
  const isActive = gd.game === true;
  const annDate  = gd['Winner Announcement Date'];
  const vAmt     = Number(gd['Voting Amount']) || 0;
  const announced = datePassed(annDate);
  const c1Key    = poll.prefix ? `${poll.prefix}candidate1` : 'candidate1';
  const c2Key    = poll.prefix ? `${poll.prefix}candidate2` : 'candidate2';
  const c1Votes  = Number(poll.c1?.votes || 0);
  const c2Votes  = Number(poll.c2?.votes || 0);
  const totalVotes = c1Votes + c2Votes;

  // Determine winner (most votes wins)
  let winnerKey = null;
  if (announced) {
    if (c1Votes > c2Votes)      winnerKey = c1Key;
    else if (c2Votes > c1Votes) winnerKey = c2Key;
    // else: tie
  }

  const userVote = cn ? await getUserVote(cn, poll.id) : null;

  const card = el('div', S.gCard);

  // Header
  const hdr = el('div','display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;');
  const label = poll.id === 'game' ? 'Poll #1' : `Poll #${poll.prefix}`;
  hdr.appendChild(el('span','font-weight:700;color:#fff;font-size:16px;', label));
  const pillCSS = announced
    ? 'background:rgba(250,204,21,0.12);color:#fbbf24;border:1px solid rgba(250,204,21,0.2);'
    : isActive
      ? 'background:rgba(52,211,153,0.1);color:#34d399;border:1px solid rgba(52,211,153,0.2);'
      : 'background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.35);border:1px solid rgba(255,255,255,0.1);';
  hdr.appendChild(el('span', S.pill + pillCSS, announced ? '📊 Results' : isActive ? '🟢 Open' : '⏳ Pending'));
  card.appendChild(hdr);

  // Meta
  const meta = el('div', S.mGrid);
  const addM = (lbl, val, col) => {
    const mi = el('div', S.mItem);
    mi.appendChild(el('div', S.mLbl, lbl));
    mi.appendChild(el('div', S.mVal + `color:${col};`, val));
    meta.appendChild(mi);
  };
  addM('Entry Fee',    `₵${vAmt.toFixed(2)}`,  '#a78bfa');
  addM('Total Votes',  String(totalVotes),       '#4ade80');
  addM('Results Date', fmtDate(annDate),         'rgba(255,255,255,0.7)');
  addM('Status', announced ? 'Announced' : isActive ? 'Voting Open' : 'Pending',
       announced ? '#fbbf24' : isActive ? '#34d399' : 'rgba(255,255,255,0.4)');
  card.appendChild(meta);

  card.appendChild(el('hr', S.hr));
  card.appendChild(el('p','font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,0.35);margin-bottom:10px;','Candidates'));

  // Candidates with vote bars
  const crow = el('div', S.candRow);
  const mkCand = (key, data, isWin, isMe, votes) => {
    const pct  = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
    const bc   = isWin ? 'rgba(250,204,21,0.5)' : isMe ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.07)';
    const c    = el('div', S.candCard + `border-color:${bc};`);
    c.appendChild(el('div','font-weight:700;color:#fff;font-size:15px;margin-bottom:3px;', data?.name || key));
    c.appendChild(el('div','font-size:12px;color:rgba(255,255,255,0.5);line-height:1.5;', data?.description || ''));

    if (announced || (userVote && totalVotes > 0)) {
      const pctRow = el('div','display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:12px;');
      pctRow.appendChild(el('span','color:rgba(255,255,255,0.5);', `${votes} vote${votes !== 1 ? 's' : ''}`));
      pctRow.appendChild(el('span','font-weight:700;color:rgba(255,255,255,0.7);', `${pct}%`));
      c.appendChild(pctRow);
      const bar = el('div', S.votBar);
      const fill = el('div', S.votFill + `width:${pct}%;background:${isWin ? '#fbbf24' : isMe ? '#a78bfa' : 'rgba(255,255,255,0.25)'};`);
      bar.appendChild(fill); c.appendChild(bar);
    }

    const bRow = el('div','margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;');
    if (isMe)  bRow.appendChild(el('span', S.pill + 'background:rgba(168,85,247,0.15);color:#c084fc;border:1px solid rgba(168,85,247,0.2);', '✓ Your Vote'));
    if (isWin) bRow.appendChild(el('span', S.pill + 'background:rgba(250,204,21,0.15);color:#fbbf24;border:1px solid rgba(250,204,21,0.25);', '🏆 Winner'));
    if (announced && winnerKey === null) bRow.appendChild(el('span', S.pill + 'background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.4);', '🤝 Tie'));
    c.appendChild(bRow);
    return c;
  };

  crow.appendChild(mkCand(c1Key, poll.c1, announced && winnerKey === c1Key, userVote?.candidate === c1Key, c1Votes));
  crow.appendChild(mkCand(c2Key, poll.c2, announced && winnerKey === c2Key, userVote?.candidate === c2Key, c2Votes));
  card.appendChild(crow);

  // Info note: credits go to Dev funds, no winning prize
  const note = el('div','font-size:11px;color:rgba(255,255,255,0.25);text-align:center;margin-bottom:10px;');
  note.textContent = `Entry fees go to community funds. This poll is for fun — no cash prizes.`;
  card.appendChild(note);

  // Action area
  const act = el('div','');
  if (announced) {
    const msg = el('div','padding:12px;background:rgba(255,255,255,0.04);border-radius:12px;text-align:center;font-size:14px;');
    if (!userVote) {
      msg.textContent = 'Voting has closed. Here are the results!';
      msg.style.color = 'rgba(255,255,255,0.4)';
    } else if (winnerKey === null) {
      msg.innerHTML = `<strong style="color:#fbbf24;">It's a tie!</strong> Both candidates got equal votes.`;
    } else if (userVote.candidate === winnerKey) {
      msg.innerHTML = `<strong style="color:#34d399;">🎉 Your candidate won!</strong> Great pick!`;
    } else {
      msg.innerHTML = `<strong style="color:#f87171;">Your candidate didn't win</strong> this time.`;
    }
    act.appendChild(msg);
  } else if (!isActive) {
    act.appendChild(el('p','text-align:center;color:rgba(255,255,255,0.3);font-size:13px;padding:8px;', 'This poll hasn\'t opened for voting yet.'));
  } else if (!cn) {
    act.appendChild(el('p','color:rgba(255,255,255,0.35);font-size:13px;text-align:center;', 'Log in to cast your vote.'));
  } else if (userVote) {
    const votedName = userVote.candidate === c1Key ? (poll.c1?.name || c1Key) : (poll.c2?.name || c2Key);
    const p = el('p','font-size:13px;font-weight:600;color:#c084fc;padding:10px;background:rgba(168,85,247,0.08);border-radius:10px;border:1px solid rgba(168,85,247,0.15);text-align:center;');
    p.textContent = `✓ You voted for ${votedName}. Results on ${fmtDate(annDate)}.`;
    act.appendChild(p);
  } else {
    act.appendChild(el('p','font-size:12px;color:rgba(255,255,255,0.4);margin-bottom:10px;', `Entry fee: ₵${vAmt.toFixed(2)} (goes to community funds). Pick your candidate!`));
    const btnRow = el('div','display:flex;gap:10px;');
    const mkVoteBtn = (key, data, color) => {
      const btn = el('button', S.voteBtn + `background:${color};`, `Vote for ${data?.name || key}`);
      const msg = el('div','');
      btn.onclick = async () => {
        btn.disabled = true; btn.textContent = 'Casting vote…'; msg.textContent = '';
        try {
          await castVote(cn, poll.id, key, c1Key, c2Key, vAmt);
          act.innerHTML = '';
          const ok = el('p','font-size:13px;font-weight:600;color:#34d399;padding:10px;background:rgba(52,211,153,0.08);border-radius:10px;border:1px solid rgba(52,211,153,0.15);text-align:center;');
          ok.textContent = `✓ Vote cast for ${data?.name || key}! Results: ${fmtDate(annDate)}.`;
          act.appendChild(ok);
          // Refresh vote counts in UI
          const vLabel = key === c1Key
            ? card.querySelector('.c1-votes')
            : card.querySelector('.c2-votes');
          if (vLabel) vLabel.textContent = parseInt(vLabel.textContent || '0') + 1;
        } catch (err) {
          btn.disabled = false; btn.textContent = `Vote for ${data?.name || key}`;
          msg.setAttribute('style', S.errBox); msg.textContent = err.message || 'Vote failed.';
        }
      };
      const w = el('div','flex:1;'); w.appendChild(btn); w.appendChild(msg);
      return w;
    };
    btnRow.appendChild(mkVoteBtn(c1Key, poll.c1, 'rgba(99,102,241,0.9)'));
    btnRow.appendChild(mkVoteBtn(c2Key, poll.c2, 'rgba(168,85,247,0.9)'));
    act.appendChild(btnRow);
  }
  card.appendChild(act);
  container.appendChild(card);
}

async function getUserVote(cn, gid) {
  try { const s = await getDoc(doc(db, VR_COL, `${gid}_${cn}`)); return s.exists() ? s.data() : null; }
  catch { return null; }
}

async function castVote(cn, pollId, candidate, c1Key, c2Key, vAmt) {
  requireDb();
  // 1. Check user credits
  const cSnap = await getDoc(doc(db, CARDS_COL, cn));
  if (!cSnap.exists()) throw new Error('Card not found.');
  const credits = Number(cSnap.data().Credits ?? cSnap.data().credits ?? 0);
  if (credits < vAmt) throw new Error(`Insufficient credits. Need ₵${vAmt.toFixed(2)}.`);
  const newBal = credits - vAmt;

  // 2. Find Dev funds card
  let devFundsId = null;
  try {
    const allCards = await getDocs(collection(db, CARDS_COL));
    allCards.forEach(d => {
      const n = (d.data().Name || d.data().name || '').trim().toLowerCase();
      if (n === 'dev funds' || n === 'devfunds' || n === 'dev fund') devFundsId = d.id;
    });
  } catch {}

  // 3. Deduct from user
  await updateDoc(doc(db, CARDS_COL, cn), { Credits: newBal });

  // 4. Add to Dev funds if found
  if (devFundsId) {
    const dfSnap = await getDoc(doc(db, CARDS_COL, devFundsId));
    if (dfSnap.exists()) {
      const dfCredits = Number(dfSnap.data().Credits ?? dfSnap.data().credits ?? 0);
      await updateDoc(doc(db, CARDS_COL, devFundsId), { Credits: dfCredits + vAmt });
    }
  }

  // 5. Increment vote count on the candidate document
  const candidateDocId = candidate; // e.g. "candidate1", "2candidate1"
  await updateDoc(doc(db, VB_COL, candidateDocId), { votes: increment(1) });

  // 6. Record vote (prevent double voting)
  await setDoc(doc(db, VR_COL, `${pollId}_${cn}`), {
    cardNumber: cn, gameDocId: pollId, candidate,
    votingAmount: vAmt, timestamp: serverTimestamp()
  });

  // 7. Log transaction
  await addDoc(collection(db, TXN_COL), {
    fromCardNumber: cn,
    toCardNumber: devFundsId || 'COMMUNITY_FUNDS',
    fromName: cSnap.data().Name || 'User',
    toName: 'Community Funds',
    amount: vAmt,
    note: `${POLL_NAME}: voted in ${pollId}`,
    timestamp: serverTimestamp(),
    fromBalanceAfter: newBal
  });
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────
let lbDone = false, lbMode = null;

async function tryLeaderboard() {
  const root = document.getElementById('root');
  if (!root) return;

  // Strategy A: Login/home page — inject in the left branding column
  const h1 = [...root.querySelectorAll('h1')].find(e => e.textContent.includes('Fake International Bank'));
  if (h1) {
    lbDone = false; lbMode = null;
    const col = h1.closest('[class*="col-span-5"]') || h1.closest('[class*="lg:col"]') || h1.parentElement;
    if (col && !col.querySelector('[data-finb-lb]')) buildLeaderboard(col);
    return;
  }

  // Strategy B: Dashboard home — inject after the nav feature section
  if (!cardNo()) return;
  if (root.querySelector('[data-finb-lb]')) return; // still in DOM
  lbDone = false; lbMode = null;

  const credizBtn = [...root.querySelectorAll('button, a, div, span')]
    .find(e => e.textContent.trim() === 'Crediz' && e.tagName !== 'H3');
  if (!credizBtn) return;

  // Walk up to find the content section with multiple children
  let section = credizBtn.parentElement;
  for (let i = 0; i < 10 && section && section !== root; i++) {
    if (section.children.length >= 3 ||
        section.className?.includes('space-y') ||
        section.className?.includes('gap-')) break;
    section = section.parentElement;
  }
  if (!section || section === root) return;

  const container = (section.parentElement && section.parentElement !== root)
    ? section.parentElement : section;

  lbMode = 'dashboard';
  buildLeaderboard(container);
}

function buildLeaderboard(container) {
  const wrap = el('div', S.lbWrap);
  wrap.setAttribute('data-finb-lb', '1');

  const head = el('div', S.lbHead);
  head.innerHTML = '🏆 <span style="letter-spacing:.14em;">LEADERBOARD</span> <span style="opacity:.4;font-size:10px;">TOP 10</span>';
  wrap.appendChild(head);

  const listEl = el('div','');
  // Skeleton rows while loading
  for (let i = 0; i < 5; i++) {
    const row = el('div', S.lbRow + 'opacity:.2;');
    row.appendChild(el('span','width:22px;font-size:13px;text-align:center;','—'));
    row.appendChild(el('span','flex:1;height:13px;background:rgba(255,255,255,0.15);border-radius:4px;',''));
    row.appendChild(el('span','font-size:12px;font-family:monospace;width:70px;',''));
    listEl.appendChild(row);
  }
  wrap.appendChild(listEl);
  container.appendChild(wrap);

  if (!db) {
    listEl.innerHTML = '';
    listEl.appendChild(el('p','color:rgba(255,255,255,0.3);font-size:12px;padding:12px 18px;','Configure Firebase to see rankings.'));
    return;
  }

  getDocs(collection(db, CARDS_COL)).then(snap => {
    const users = [];
    snap.forEach(d => {
      const data = d.data();
      const name = (data.Name || data.name || '').trim();
      // Exclude system accounts
      if (!name || name.toLowerCase().includes('dev fund') || name.toLowerCase() === 'stock_market') return;
      users.push({ name, credits: Number(data.Credits ?? data.credits ?? 0) });
    });
    users.sort((a,b) => b.credits - a.credits);
    const top = users.slice(0, 10);

    listEl.innerHTML = '';
    const medals = ['🥇','🥈','🥉'];
    const myName = null; // future: resolve logged-in user's name for highlighting
    top.forEach((u, i) => {
      const rank  = i + 1;
      const isTop = rank <= 3;
      const gold  = rank === 1;
      const row   = el('div', S.lbRow + (gold ? 'background:rgba(212,168,83,0.06);' : ''));

      const rankEl = el('span',`min-width:26px;font-size:${isTop?17:12}px;text-align:center;${!isTop?'color:rgba(255,255,255,0.25);font-weight:700;':''}`);
      rankEl.textContent = isTop ? medals[i] : String(rank);

      const nameEl = el('span',`flex:1;font-size:${gold?14:13}px;font-weight:${gold?700:500};color:${gold?'#fcd34d':rank<=3?'rgba(255,255,255,0.9)':'rgba(255,255,255,0.75)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:145px;`);
      nameEl.textContent = u.name;

      const credEl = el('span',`font-size:12px;font-weight:700;font-family:monospace;color:${isTop?'#fbbf24':'rgba(255,255,255,0.35)'};white-space:nowrap;`);
      credEl.textContent = `₵${u.credits.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;

      row.appendChild(rankEl); row.appendChild(nameEl); row.appendChild(credEl);
      listEl.appendChild(row);
    });
    if (!top.length) listEl.appendChild(el('p','color:rgba(255,255,255,0.3);font-size:13px;padding:12px 18px;','No users yet.'));
  }).catch(err => {
    listEl.innerHTML = '';
    listEl.appendChild(el('p','color:rgba(255,255,255,0.3);font-size:12px;padding:12px 18px;', err.message || 'Could not load.'));
  });
}

// ─── Stock Market: Market / My Assets tabs ────────────────────────────────────
let assetsSetup = false;

function trySetupAssetsTab() {
  const root = document.getElementById('root');
  if (!root) return;
  const h3 = [...root.querySelectorAll('h3')].find(h => h.textContent.trim() === 'Stock Market');
  if (!h3) { assetsSetup = false; return; }

  // Find .space-y-4 by walking UP from h3, not from root
  let stockList = null;
  let parent = h3.parentElement;
  for (let i = 0; i < 8 && parent && parent !== root; i++) {
    const candidate = parent.querySelector('.space-y-4');
    if (candidate) { stockList = candidate; break; }
    parent = parent.parentElement;
  }
  if (!stockList) {
    // Fallback: try the broader search but skip if it's a leaderboard container
    stockList = root.querySelector('.space-y-4');
  }
  if (!stockList || stockList.querySelector('[data-finb-tabs]')) return;

  assetsSetup = true;

  // ── Tab bar ──
  const tabsEl = el('div', S.tabWrap); tabsEl.setAttribute('data-finb-tabs','1');
  const mktBtn  = document.createElement('button');
  const assetBtn = document.createElement('button');
  mktBtn.setAttribute('style', S.tabOn);   mktBtn.textContent = '📈 Market';
  assetBtn.setAttribute('style', S.tabOff); assetBtn.textContent = '💼 My Assets';

  tabsEl.appendChild(mktBtn); tabsEl.appendChild(assetBtn);

  // ── Assets panel ──
  const assetsPanel = el('div','padding-top:8px;');
  assetsPanel.setAttribute('data-finb-assets','1');
  assetsPanel.style.display = 'none';

  // Insert tab bar before first child; panel at end
  stockList.insertBefore(tabsEl, stockList.firstChild);
  stockList.appendChild(assetsPanel);

  // Track which children are React's market items
  const getMarketItems = () => [...stockList.children].filter(c => c !== tabsEl && c !== assetsPanel);

  const switchTab = (tab) => {
    const isMkt = tab === 'market';
    mktBtn.setAttribute('style',   isMkt ? S.tabOn  : S.tabOff);
    assetBtn.setAttribute('style', isMkt ? S.tabOff : S.tabOn);
    getMarketItems().forEach(c => { c.style.display = isMkt ? '' : 'none'; });
    assetsPanel.style.display = isMkt ? 'none' : 'block';
    if (!isMkt && !assetsPanel.querySelector('[data-finb-holdings]')) loadAssetsPanel(assetsPanel);
  };

  mktBtn.addEventListener('click',   () => switchTab('market'));
  assetBtn.addEventListener('click', () => switchTab('assets'));
}

async function loadAssetsPanel(panel) {
  panel.innerHTML = '';
  const loading = el('p','color:rgba(255,255,255,0.4);font-size:13px;padding:12px 0;','Loading your holdings…');
  panel.appendChild(loading);

  const cn = cardNo();
  if (!cn) { loading.textContent = 'Log in to see your holdings.'; return; }

  try {
    requireDb();
    const companies = await fetchCompanies();
    const holdings  = await calcHoldings(cn, companies);
    const compMap   = {};
    companies.forEach(c => { compMap[c.id] = c; });
    const owned = Object.entries(holdings).filter(([id,q]) => q > 0 && compMap[id]);

    panel.innerHTML = '';
    const wrap = el('div',''); wrap.setAttribute('data-finb-holdings','1');

    if (!owned.length) {
      wrap.appendChild(el('p','color:rgba(255,255,255,0.35);font-size:14px;padding:10px;text-align:center;',"You don't own any shares yet."));
      panel.appendChild(wrap); return;
    }

    const sec = el('div', S.sec);
    sec.appendChild(el('p', S.secT, '💼 My Holdings — Sell at Live Price'));
    for (const [id, qty] of owned) buildHoldingRow(sec, cn, compMap[id], qty);
    wrap.appendChild(sec);
    panel.appendChild(wrap);
  } catch (err) {
    panel.innerHTML = '';
    panel.appendChild(el('p', S.errBox, err.message || 'Failed to load holdings. Make sure Firebase is connected.'));
  }
}

function buildHoldingRow(container, cn, co, qty) {
  const row = el('div', S.holdRow);

  const info   = el('div','flex:1;min-width:0;');
  const nameEl = el('div','font-weight:600;color:#fff;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;', co.name);
  const metaEl = el('div','color:rgba(255,255,255,0.45);font-size:12px;margin-top:1px;');
  metaEl.textContent = `${qty} share${qty!==1?'s':''} · ₵${co.value.toFixed(2)} each`;
  info.appendChild(nameEl); info.appendChild(metaEl);

  const valWrap = el('div','text-align:right;margin-right:8px;min-width:60px;');
  valWrap.appendChild(el('div','font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;','Total'));
  const amtEl = el('div','color:#4ade80;font-weight:700;font-size:13px;');
  amtEl.textContent = `₵${(co.value * qty).toFixed(2)}`;
  valWrap.appendChild(amtEl);

  const qtyIn   = el('input', S.numIn);
  qtyIn.type = 'number'; qtyIn.min = '1'; qtyIn.max = String(qty); qtyIn.value = '1';
  const sellBtn = el('button', S.btnGold, 'Sell');
  const msgEl   = el('div','');

  sellBtn.onclick = async () => {
    const n = parseInt(qtyIn.value, 10);
    if (!n || n < 1)  { msgEl.setAttribute('style',S.errBox); msgEl.textContent='Enter a valid quantity.'; return; }
    if (n > qty)      { msgEl.setAttribute('style',S.errBox); msgEl.textContent=`You only own ${qty} share${qty!==1?'s':''}.`; return; }
    sellBtn.disabled = true; sellBtn.textContent = 'Selling…'; msgEl.textContent = '';
    try {
      const freshSnap = await getDoc(doc(db, STOCK_COL, co.id));
      const liveVal   = Number(freshSnap.data()?.value) || co.value;
      const { newBalance, earnings } = await doSell(cn, {...co, value:liveVal}, n);
      msgEl.setAttribute('style', S.okBox);
      msgEl.textContent = `Sold ${n}× for ₵${earnings.toFixed(2)}. New balance: ₵${newBalance.toFixed(2)}`;
      metaEl.textContent = `${qty-n} share${qty-n!==1?'s':''} · ₵${liveVal.toFixed(2)} each`;
      amtEl.textContent  = `₵${(liveVal*(qty-n)).toFixed(2)}`;
      sellBtn.textContent = 'Sold ✓'; sellBtn.disabled = true;
    } catch (err) {
      sellBtn.disabled = false; sellBtn.textContent = 'Sell';
      msgEl.setAttribute('style',S.errBox); msgEl.textContent = err.message || 'Sell failed.';
    }
  };

  const ctrl = el('div','display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0;');
  ctrl.appendChild(qtyIn); ctrl.appendChild(sellBtn);
  row.appendChild(info); row.appendChild(valWrap); row.appendChild(ctrl);

  const wrapper = el('div',''); wrapper.appendChild(row); wrapper.appendChild(msgEl);
  container.appendChild(wrapper);
}

async function fetchCompanies() {
  requireDb();
  const snap = await getDocs(collection(db, STOCK_COL));
  const list = [];
  snap.forEach(d => {
    if (d.id === 'game') return;
    const data = d.data();
    list.push({ id:d.id, name:data.name||d.id, value:Number(data.value)||0, stocks:Number(data.stocks)||0 });
  });
  return list;
}

async function calcHoldings(cn, companies) {
  requireDb();
  const idMap = {};
  companies.forEach(c => { idMap[c.name.toLowerCase()] = c.id; idMap[c.id.toLowerCase()] = c.id; });
  const h = {};
  const buys = await getDocs(query(collection(db,TXN_COL), where('fromCardNumber','==',cn), where('toCardNumber','==','STOCK_MARKET')));
  buys.forEach(d => {
    const m = (d.data().note||'').match(/^Bought (\d+)× (.+) shares$/);
    if (m) { const id = idMap[m[2].toLowerCase()]; if (id) h[id] = (h[id]||0) + parseInt(m[1],10); }
  });
  const sells = await getDocs(query(collection(db,TXN_COL), where('fromCardNumber','==','STOCK_MARKET'), where('toCardNumber','==',cn)));
  sells.forEach(d => {
    const m = (d.data().note||'').match(/^Sold (\d+)× (.+) shares$/);
    if (m) { const id = idMap[m[2].toLowerCase()]; if (id) h[id] = (h[id]||0) - parseInt(m[1],10); }
  });
  return h;
}

async function doSell(cn, co, qty) {
  requireDb();
  const [cSnap, coSnap] = await Promise.all([getDoc(doc(db,CARDS_COL,cn)), getDoc(doc(db,STOCK_COL,co.id))]);
  if (!cSnap.exists()) throw new Error('Card not found.');
  const liveVal  = Number(coSnap.data()?.value) || co.value;
  const credits  = Number(cSnap.data().Credits ?? cSnap.data().credits ?? 0);
  const earnings = liveVal * qty;
  const newBal   = credits + earnings;
  await Promise.all([
    updateDoc(doc(db,CARDS_COL,cn), { Credits: newBal }),
    updateDoc(doc(db,STOCK_COL,co.id), { stocks: (Number(coSnap.data()?.stocks)||0) + qty })
  ]);
  await addDoc(collection(db,TXN_COL), {
    fromCardNumber:'STOCK_MARKET', toCardNumber:cn,
    fromName:`Stock: ${co.name}`, toName:cSnap.data().Name||'User',
    amount:earnings, note:`Sold ${qty}× ${co.name} shares`,
    timestamp:serverTimestamp(), fromBalanceAfter:0, toBalanceAfter:newBal
  });
  return { newBalance:newBal, earnings };
}

// ─── Shop reward pool ─────────────────────────────────────────────────────────
let shopObsStarted = false, shopClaiming = false;

function watchShopRewards() {
  if (shopObsStarted) return;
  shopObsStarted = true;
  let pending = null;
  const obs = new MutationObserver(() => {
    clearTimeout(pending);
    pending = setTimeout(() => {
      if (shopClaiming || !db) return;
      const root = document.getElementById('root');
      if (!root) return;
      const modal = [...root.querySelectorAll('div')].find(d =>
        Array.from(d.classList).some(c => c.includes('z-[200]')) &&
        d.classList.contains('fixed') &&
        !d.querySelector('[data-finb-reward]')
      );
      if (!modal) return;
      const cn = cardNo(); if (!cn) return;
      shopClaiming = true;
      claimReward(cn).then(text => {
        if (!text) { shopClaiming = false; return; }
        const banner = el('div', S.rewardBox);
        banner.setAttribute('data-finb-reward','1');
        banner.innerHTML = `<div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:rgba(212,168,83,0.55);margin-bottom:5px;">Your Exclusive Reward</div>${esc(text)}`;
        const inner = modal.querySelector('[class*="rounded-3xl"]') ||
                      modal.querySelector('[class*="rounded-2xl"]') || modal;
        inner.appendChild(banner);
        shopClaiming = false;
      }).catch(() => { shopClaiming = false; });
    }, 120);
  });
  obs.observe(document.getElementById('root') || document.body, { childList:true, subtree:true });
}

async function claimReward(cn) {
  try {
    requireDb();
    const snap = await getDocs(query(collection(db, REWARDS_COL), where('used','==',false), limit(20)));
    if (snap.empty) return null;
    const docs = []; snap.forEach(d => docs.push(d));
    const pick = docs[Math.floor(Math.random() * docs.length)];
    await updateDoc(pick.ref, { used:true, claimedBy:cn, claimedAt:serverTimestamp() });
    return pick.data().text || null;
  } catch { return null; }
}

// ─── Auth Modals ──────────────────────────────────────────────────────────────
function validateCardNumber(cardNumber) {
  if (cardNumber.length !== 16) return false;
  const positions = [2, 7, 12, 13];
  for (let pos of positions) {
    if (!/[A-Z]/.test(cardNumber[pos - 1])) return false;
  }
  return true;
}

function validateCVV(cvv) {
  if (cvv.length !== 4) return false;
  return /^[A-Za-z]\d{3}$/.test(cvv);
}

function openRegisterModal() {
  if (document.getElementById('addon-auth-modal')) return;
  const overlay = el('div', S.overlay); overlay.id = 'addon-auth-modal';
  const modal = el('div', S.modal);
  const closeB = el('button', S.closeBtn, '×');
  closeB.onclick = () => overlay.remove();
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

  modal.appendChild(closeB);
  const title = el('h2', 'font-size:24px;font-weight:700;color:#fff;margin-bottom:20px;text-align:center;', 'Register Your Card');
  modal.appendChild(title);

  const messageDiv = el('div', '');
  modal.appendChild(messageDiv);

  // Step 1: Activation Code
  const step1 = el('div', 'id:register-step-1;');
  const fg1 = el('div', S.formGroup);
  fg1.appendChild(el('label', S.formLabel, 'Activation Code'));
  const input1 = el('input', S.formInput + 'id:activation-code;placeholder:Enter activation code;');
  fg1.appendChild(input1);
  step1.appendChild(fg1);
  const btn1 = el('button', S.btnGold + 'width:100%;padding:14px;margin-top:10px;', 'Verify Code');
  btn1.onclick = () => verifyActivationCode(input1.value.trim(), messageDiv, modal, step1);
  step1.appendChild(btn1);
  modal.appendChild(step1);

  // Step 2: Name and Password (hidden initially)
  const step2 = el('div', 'id:register-step-2;display:none;');
  const fg2 = el('div', S.formGroup);
  fg2.appendChild(el('label', S.formLabel, 'Full Name'));
  const input2 = el('input', S.formInput + 'id:full-name;placeholder:Enter your full name;');
  fg2.appendChild(input2);
  step2.appendChild(fg2);
  const fg3 = el('div', S.formGroup);
  fg3.appendChild(el('label', S.formLabel, 'Create Password'));
  const input3 = el('input', S.formInput + 'id:create-password;placeholder:Create a password;type:password;');
  fg3.appendChild(input3);
  step2.appendChild(fg3);
  const btn2 = el('button', S.btnGold + 'width:100%;padding:14px;margin-top:10px;', 'Register Card');
  btn2.onclick = () => registerCard(input1.value.trim(), input2.value, input3.value, messageDiv, modal, step2);
  step2.appendChild(btn2);
  modal.appendChild(step2);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

function openLoginModal() {
  if (document.getElementById('addon-auth-modal')) return;
  const overlay = el('div', S.overlay); overlay.id = 'addon-auth-modal';
  const modal = el('div', S.modal);
  const closeB = el('button', S.closeBtn, '×');
  closeB.onclick = () => overlay.remove();
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

  modal.appendChild(closeB);
  const title = el('h2', 'font-size:24px;font-weight:700;color:#fff;margin-bottom:20px;text-align:center;', 'Login to Your Card');
  modal.appendChild(title);

  const messageDiv = el('div', '');
  modal.appendChild(messageDiv);

  const fg1 = el('div', S.formGroup);
  fg1.appendChild(el('label', S.formLabel, 'Registered Name'));
  const input1 = el('input', S.formInput + 'id:login-name;placeholder:Enter registered name;');
  fg1.appendChild(input1);
  modal.appendChild(fg1);

  const fg2 = el('div', S.formGroup);
  fg2.appendChild(el('label', S.formLabel, 'Card Number'));
  const input2 = el('input', S.formInput + 'id:card-number;placeholder:Enter card number;');
  fg2.appendChild(input2);
  modal.appendChild(fg2);

  const fg3 = el('div', S.formGroup);
  fg3.appendChild(el('label', S.formLabel, 'Password'));
  const input3 = el('input', S.formInput + 'id:login-password;placeholder:Enter password;type:password;');
  fg3.appendChild(input3);
  modal.appendChild(fg3);

  const btn = el('button', S.btnGold + 'width:100%;padding:14px;margin-top:10px;', 'Login');
  btn.onclick = () => loginCard(input1.value.trim(), input2.value.trim(), input3.value, messageDiv, overlay);
  modal.appendChild(btn);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

async function verifyActivationCode(code, messageDiv, modal, step1) {
  messageDiv.innerHTML = '';
  if (!code) {
    messageDiv.setAttribute('style', S.errBox);
    messageDiv.textContent = 'Please enter activation code.';
    return;
  }

  try {
    requireDb();
    const q = query(collection(db, CARDS_COL), where('Activation Code', '==', code));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      messageDiv.setAttribute('style', S.errBox);
      messageDiv.textContent = 'Invalid activation code.';
      return;
    }

    const docSnap = querySnapshot.docs[0];
    const cardData = docSnap.data();

    if (cardData.Name) {
      messageDiv.setAttribute('style', S.errBox);
      messageDiv.textContent = 'This card is already registered.';
      return;
    }

    const cardNumber = docSnap.id;
    if (!validateCardNumber(cardNumber)) {
      messageDiv.setAttribute('style', S.errBox);
      messageDiv.textContent = 'Invalid card format.';
      return;
    }

    if (!validateCVV(cardData.CVV)) {
      messageDiv.setAttribute('style', S.errBox);
      messageDiv.textContent = 'Invalid CVV format.';
      return;
    }

    // Show terms modal
    showTermsModal(modal, step1);

  } catch (error) {
    console.error(error);
    messageDiv.setAttribute('style', S.errBox);
    messageDiv.textContent = 'Verification failed. Please try again.';
  }
}

function showTermsModal(parentModal, step1) {
  const overlay = el('div', S.overlay); overlay.id = 'addon-terms-modal';
  const modal = el('div', S.modal);
  const closeB = el('button', S.closeBtn, '×');
  closeB.onclick = () => overlay.remove();
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

  modal.appendChild(closeB);
  const title = el('h2', 'font-size:24px;font-weight:700;color:#fff;margin-bottom:20px;text-align:center;', 'Terms and Conditions');
  modal.appendChild(title);

  const termsDiv = el('div', S.termsContent);
  termsDiv.innerHTML = `
    <p><strong>1. Educational Purpose:</strong> This website is a fictional banking simulation game designed for educational purposes only. It teaches concepts related to credit cards, investments, and financial management in a safe, risk-free environment.</p>
    <p><strong>2. No Real Money:</strong> All transactions, credits ("liberals"), and activities are entirely fictional. No real currency or financial value is involved.</p>
    <p><strong>3. Safety Measures:</strong> Card numbers must follow specific formats for security simulation. CVV codes have defined patterns. All data is handled securely but remains fictional.</p>
    <p><strong>4. User Responsibility:</strong> Users are responsible for maintaining the confidentiality of their passwords and account information.</p>
    <p><strong>5. Anti-Cheating:</strong> Any attempts to manipulate the system or gain unfair advantages may result in account suspension.</p>
    <p><strong>6. Data Privacy:</strong> We collect only fictional user data necessary for the game. No personal information is shared or sold.</p>
    <p><strong>7. Age Restriction:</strong> This game is intended for users who understand the educational nature of financial simulations.</p>
    <p><strong>8. Liability:</strong> The creators are not liable for any misuse or misunderstanding of the educational content.</p>
    <p>By accepting these terms, you acknowledge that this is a game and agree to use it responsibly for learning purposes.</p>
  `;
  modal.appendChild(termsDiv);

  const btn = el('button', S.btnGold + 'width:100%;padding:14px;margin-top:10px;', 'I Accept');
  btn.onclick = () => {
    overlay.remove();
    parentModal.querySelector('#register-step-1').style.display = 'none';
    parentModal.querySelector('#register-step-2').style.display = 'block';
  };
  modal.appendChild(btn);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

async function registerCard(activationCode, fullName, password, messageDiv, modal, step2) {
  messageDiv.innerHTML = '';
  if (!fullName || !password) {
    messageDiv.setAttribute('style', S.errBox);
    messageDiv.textContent = 'Please fill all fields.';
    return;
  }

  try {
    requireDb();
    const q = query(collection(db, CARDS_COL), where('Activation Code', '==', activationCode));
    const querySnapshot = await getDocs(q);
    const docSnap = querySnapshot.docs[0];
    const cardData = docSnap.data();
    const cardNumber = docSnap.id;

    await updateDoc(doc(db, CARDS_COL, cardNumber), {
      Name: fullName,
      Password: password
    });

    // Show card details
    step2.style.display = 'none';
    const details = el('div', S.cardDetails);
    details.innerHTML = `
      <h3 style="color:#d4a853;margin-bottom:15px;">Your Card Details</h3>
      <div style="${S.cardGrid}">
        <div style="${S.cardItem}"><div style="${S.cardLabel}">Card Number</div><div style="${S.cardValue}">${cardNumber}</div></div>
        <div style="${S.cardItem}"><div style="${S.cardLabel}">Name</div><div style="${S.cardValue}">${fullName}</div></div>
        <div style="${S.cardItem}"><div style="${S.cardLabel}">CVV</div><div style="${S.cardValue}">${cardData.CVV}</div></div>
        <div style="${S.cardItem}"><div style="${S.cardLabel}">Expiry Date</div><div style="${S.cardValue}">${cardData['Expiry date']}</div></div>
        <div style="${S.cardItem}"><div style="${S.cardLabel}">Credits</div><div style="${S.cardValue}">${cardData.Credits}</div></div>
      </div>
      <button style="${S.btnGold}width:100%;padding:14px;margin-top:20px;" onclick="proceedToDashboard('${cardNumber}')">Proceed to Dashboard</button>
    `;
    modal.appendChild(details);
    messageDiv.setAttribute('style', S.okBox);
    messageDiv.textContent = 'Card registered successfully!';

  } catch (error) {
    console.error(error);
    messageDiv.setAttribute('style', S.errBox);
    messageDiv.textContent = 'Registration failed. Please try again.';
  }
}

async function loginCard(name, cardNumber, password, messageDiv, overlay) {
  messageDiv.innerHTML = '';
  if (!name || !cardNumber || !password) {
    messageDiv.setAttribute('style', S.errBox);
    messageDiv.textContent = 'Please fill all fields.';
    return;
  }

  try {
    requireDb();
    const docSnap = await getDoc(doc(db, CARDS_COL, cardNumber));

    if (!docSnap.exists()) {
      messageDiv.setAttribute('style', S.errBox);
      messageDiv.textContent = 'Card not found.';
      return;
    }

    const cardData = docSnap.data();

    if (cardData.Name !== name || cardData.Password !== password) {
      messageDiv.setAttribute('style', S.errBox);
      messageDiv.textContent = 'Invalid credentials.';
      return;
    }

    localStorage.setItem('finb_session_card', cardNumber);
    window.location.href = 'dashboard.html';

  } catch (error) {
    console.error(error);
    messageDiv.setAttribute('style', S.errBox);
    messageDiv.textContent = 'Login failed. Please try again.';
  }
}

function proceedToDashboard(cardNumber) {
  localStorage.setItem('finb_session_card', cardNumber);
  window.location.href = 'dashboard.html';
}

// ─── Inject Auth Buttons ──────────────────────────────────────────────────────
function injectAuthButtons() {
  const root = document.getElementById('root');
  if (!root) return;

  // On login/home page
  const h1 = [...root.querySelectorAll('h1')].find(e => e.textContent.includes('Fake International Bank'));
  if (h1) {
    let container = h1.parentElement;
    if (!container.querySelector('[data-finb-auth]')) {
      const authDiv = el('div', 'data-finb-auth:1;margin-top:30px;text-align:center;');
      const btn1 = el('button', S.btnGold + 'margin-right:20px;padding:15px 30px;', 'Register Card');
      btn1.onclick = openRegisterModal;
      const btn2 = el('button', S.btnGold + 'padding:15px 30px;', 'Login Card');
      btn2.onclick = openLoginModal;
      authDiv.appendChild(btn1);
      authDiv.appendChild(btn2);
      container.appendChild(authDiv);
    }
  }
}

// ─── Main observer ────────────────────────────────────────────────────────────
function startObserver() {
  const root = document.getElementById('root');
  if (!root) return;
  let pending = null;
  const check = () => {
    clearTimeout(pending);
    pending = setTimeout(() => {
      tagPollCard();
      tryLeaderboard();
      trySetupAssetsTab();
      injectAuthButtons();
      // Reset leaderboard flag if navigated back to login
      if (root.querySelector('h1')) { lbDone = false; lbMode = null; }
      // Reset assets flag when stock market not visible
      if (![...root.querySelectorAll('h3')].some(h => h.textContent.trim() === 'Stock Market')) assetsSetup = false;
    }, 100);
  };
  new MutationObserver(check).observe(root, { childList:true, subtree:true });
  check();
  watchShopRewards();
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function main() {
  await new Promise(r => { if (document.readyState==='complete') return r(); window.addEventListener('load',r); });
  injectPollCSS();
  setupPollDelegation();
  initFirebase();
  // Check if already logged in
  if (localStorage.getItem('finb_session_card')) {
    window.location.href = 'dashboard.html';
    return;
  }
  const timer = setInterval(() => {
    if (document.getElementById('root')?.children.length > 0) { clearInterval(timer); startObserver(); }
  }, 150);
}

main();
