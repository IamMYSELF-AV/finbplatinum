import React from 'react';
import { claimGamePlay, subscribeClaimState, GAME_PLAY_CAPS } from '../../lib/bank.js';
import { useToast } from '../ui.jsx';
import { ProfileCtx } from '../../App.jsx';

const GEMS = ['💎', '💠', '🪙', '⭐'];
const RUN_SECONDS = 30;
const SPAWN_MS = 650;

export default function CatchGame() {
  const { user } = React.useContext(ProfileCtx);
  const toast = useToast();
  const [state, setState] = React.useState({ plays: 0 });
  const [running, setRunning] = React.useState(false);
  const [gems, setGems] = React.useState([]);
  const [score, setScore] = React.useState(0);
  const [timeLeft, setTimeLeft] = React.useState(RUN_SECONDS);
  const idRef = React.useRef(0);

  React.useEffect(() => subscribeClaimState(user.uid, 'catch', setState), [user.uid]);
  const left = GAME_PLAY_CAPS.catch - (state.plays || 0);

  const start = () => {
    if (left <= 0) return;
    setGems([]); setScore(0); setTimeLeft(RUN_SECONDS); setRunning(true);
  };

  React.useEffect(() => {
    if (!running) return;
    const spawn = setInterval(() => {
      idRef.current += 1;
      const id = idRef.current;
      setGems((g) => [...g, {
        id,
        x: 6 + Math.random() * 88,
        dur: 2.4 + Math.random() * 1.4,
        e: GEMS[Math.floor(Math.random() * GEMS.length)],
      }]);
    }, SPAWN_MS);
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(spawn); clearInterval(timer);
          setRunning(false);
          setGems([]);
          setScore((s) => {
            const reward = Math.min(80, s * 2);
            if (reward > 0) {
              claimGamePlay(user.uid, 'catch', reward)
                .then(() => toast(`Run finished! You caught ${s} gems → +◈${reward} 💎`))
                .catch((e) => toast(e.message, 'err'));
            } else {
              claimGamePlay(user.uid, 'catch', 2)
                .then(() => toast('No gems caught — here are +◈2 for trying!'))
                .catch((e) => toast(e.message, 'err'));
            }
            return s;
          });
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { clearInterval(spawn); clearInterval(timer); };
  }, [running, user.uid, toast]);

  const catchGem = (id) => {
    setGems((g) => g.filter((x) => x.id !== id));
    setScore((s) => s + 1);
  };

  return (
    <div className="game-stage">
      <h3>💎 Gem Catcher</h3>
      <p className="muted" style={{ fontSize: 13 }}>
        Tap the falling gems! Each gem = <b>◈2</b>, up to <b>◈80</b> per 30-second run.
        Runs left today: <b>{Math.max(0, left)}</b>
      </p>
      <div className="catch-area">
        {!running && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <button className="btn primary" onClick={start} disabled={left <= 0}>
              {left <= 0 ? 'Come back tomorrow 🗓️' : score > 0 ? `Play again (last: ${score} 💎)` : 'Start 30s run ▶'}
            </button>
          </div>
        )}
        {running && (
          <div style={{ position: 'absolute', top: 10, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', fontWeight: 800, zIndex: 2 }}>
            <span className="gold">💎 {score}</span>
            <span className="countdown">{timeLeft}s</span>
          </div>
        )}
        {gems.map((g) => (
          <div
            key={g.id}
            className="catch-gem"
            style={{
              left: `${g.x}%`, top: '-8%',
              animation: `fall ${g.dur}s linear forwards`,
            }}
            onClick={() => catchGem(g.id)}
            onAnimationEnd={() => setGems((all) => all.filter((x) => x.id !== g.id))}
          >
            {g.e}
          </div>
        ))}
      </div>
    </div>
  );
}
