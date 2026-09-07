import React from 'react';
import { claimGamePlay, subscribeClaimState, GAME_PLAY_CAPS } from '../../lib/bank.js';
import { useToast } from '../ui.jsx';
import { ProfileCtx } from '../../App.jsx';

const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const REWARD = { 4: 10, 5: 20, 6: 30 };

export default function DiceGame() {
  const { user } = React.useContext(ProfileCtx);
  const toast = useToast();
  const [state, setState] = React.useState({ plays: 0 });
  const [face, setFace] = React.useState(5); // index -> face 6
  const [rolling, setRolling] = React.useState(false);

  React.useEffect(() => subscribeClaimState(user.uid, 'dice', setState), [user.uid]);

  const left = GAME_PLAY_CAPS.dice - (state.plays || 0);

  const roll = () => {
    if (rolling || left <= 0) return;
    setRolling(true);
    let ticks = 0;
    const anim = setInterval(() => {
      setFace(Math.floor(Math.random() * 6));
      if (++ticks > 10) {
        clearInterval(anim);
        const result = Math.floor(Math.random() * 6) + 1; // 1..6
        setFace(result - 1);
        setRolling(false);
        if (result >= 4) {
          const reward = REWARD[result];
          claimGamePlay(user.uid, 'dice', reward)
            .then(() => toast(`Rolled ${result}! You win +◈${reward} 🎉`))
            .catch((e) => toast(e.message, 'err'));
        } else {
          // A losing roll still consumes a play (claim with 0 is invalid, so
          // we track attempts with a minimal 1-credit consolation claim).
          claimGamePlay(user.uid, 'dice', 1)
            .then(() => toast(`Rolled ${result} — so close! Consolation +◈1`))
            .catch((e) => toast(e.message, 'err'));
        }
      }
    }, 90);
  };

  return (
    <div className="game-stage">
      <h3>🎲 High Roller</h3>
      <p className="muted" style={{ fontSize: 13 }}>
        Roll 4, 5 or 6 to win <b>◈10 / ◈20 / ◈30</b>. Rolls left today: <b>{Math.max(0, left)}</b>
      </p>
      <div className={`dice-face ${rolling ? 'rolling' : ''}`}>{FACES[face]}</div>
      <button className="btn primary" onClick={roll} disabled={rolling || left <= 0}>
        {left <= 0 ? 'Come back tomorrow 🗓️' : rolling ? 'Rolling…' : 'Roll dice 🎲'}
      </button>
    </div>
  );
}
