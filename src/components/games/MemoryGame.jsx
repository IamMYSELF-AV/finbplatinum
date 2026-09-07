import React from 'react';
import { claimGamePlay, subscribeClaimState, GAME_PLAY_CAPS } from '../../lib/bank.js';
import { useToast } from '../ui.jsx';
import { ProfileCtx } from '../../App.jsx';

const EMOJIS = ['💎', '🚀', '🌈', '⚡', '🔥', '🎯', '🧊', '👑'];

function shuffle(a) {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function newDeck() {
  return shuffle([...EMOJIS, ...EMOJIS]).map((e, i) => ({ i, e, flipped: false, matched: false }));
}

export default function MemoryGame() {
  const { user } = React.useContext(ProfileCtx);
  const toast = useToast();
  const [state, setState] = React.useState({ plays: 0 });
  const [deck, setDeck] = React.useState(newDeck);
  const [picked, setPicked] = React.useState([]);
  const [moves, setMoves] = React.useState(0);
  const [lock, setLock] = React.useState(false);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => subscribeClaimState(user.uid, 'memory', setState), [user.uid]);
  const left = GAME_PLAY_CAPS.memory - (state.plays || 0);

  const flip = (card) => {
    if (lock || card.flipped || card.matched || done) return;
    const nd = deck.map((c) => (c.i === card.i ? { ...c, flipped: true } : c));
    const np = [...picked, card.i];
    setDeck(nd);
    setPicked(np);
    if (np.length === 2) {
      setMoves((m) => m + 1);
      setLock(true);
      const [a, b] = np.map((i) => nd.find((c) => c.i === i));
      if (a.e === b.e) {
        setTimeout(() => {
          const matched = nd.map((c) => (c.i === a.i || c.i === b.i ? { ...c, matched: true } : c));
          setDeck(matched);
          setPicked([]); setLock(false);
          if (matched.every((c) => c.matched)) {
            setDone(true);
            claimGamePlay(user.uid, 'memory', 60)
              .then(() => toast('Board cleared! +◈60 🧠✨'))
              .catch((e) => toast(e.message, 'err'));
          }
        }, 350);
      } else {
        setTimeout(() => {
          setDeck(nd.map((c) => (c.i === a.i || c.i === b.i ? { ...c, flipped: false } : c)));
          setPicked([]); setLock(false);
        }, 750);
      }
    }
  };

  const reset = () => { setDeck(newDeck()); setPicked([]); setMoves(0); setDone(false); setLock(false); };

  return (
    <div className="game-stage">
      <h3>🧠 Memory Match</h3>
      <p className="muted" style={{ fontSize: 13 }}>
        Clear all 8 pairs to win <b>◈60</b> · Moves: <b>{moves}</b> · Rounds won today: <b>{state.plays || 0}/{GAME_PLAY_CAPS.memory}</b>
      </p>
      <div className="memory-grid">
        {deck.map((c) => (
          <div key={c.i}
            className={`mem-card ${c.matched ? 'matched' : c.flipped ? 'flipped' : ''}`}
            onClick={() => flip(c)}>
            {(c.flipped || c.matched) ? c.e : '◈'}
          </div>
        ))}
      </div>
      {done && <button className="btn primary" onClick={reset} disabled={left <= 0}>Play again 🔁</button>}
      {!done && <button className="btn ghost sm" onClick={reset}>Shuffle / restart</button>}
    </div>
  );
}
