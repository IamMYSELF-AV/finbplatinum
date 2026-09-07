import React from 'react';
import SpinWheel from '../components/games/SpinWheel.jsx';
import DiceGame from '../components/games/DiceGame.jsx';
import MemoryGame from '../components/games/MemoryGame.jsx';
import CatchGame from '../components/games/CatchGame.jsx';

const GAMES = [
  { id: 'spin', emoji: '🎡', name: 'Platinum Spin', desc: 'Spin once a day — win up to 500 credits!', reward: 'Up to ◈500', el: SpinWheel },
  { id: 'dice', emoji: '🎲', name: 'High Roller', desc: 'Roll over 3 to win. 25 rolls a day, up to ◈30 each!', reward: '◈10–30 / win', el: DiceGame },
  { id: 'memory', emoji: '🧠', name: 'Memory Match', desc: 'Clear all 8 pairs to bank ◈60. 20 rounds a day.', reward: '◈60 / clear', el: MemoryGame },
  { id: 'catch', emoji: '💎', name: 'Gem Catcher', desc: 'Catch falling gems for 30 seconds. Up to ◈80 per run!', reward: '◈2 / gem', el: CatchGame },
];

export default function Games() {
  const [active, setActive] = React.useState(null);
  const ActiveEl = GAMES.find((g) => g.id === active)?.el;

  return (
    <div>
      <div className="section-head">
        <h2>Game arcade 🎮</h2>
        <span className="muted" style={{ fontSize: 13 }}>Play more → earn more credits</span>
      </div>

      {!active && (
        <div className="grid cols-2">
          {GAMES.map((g) => (
            <button key={g.id} className="game-tile" onClick={() => setActive(g.id)}>
              <span className="pill info g-reward">{g.reward}</span>
              <div className="g-emoji">{g.emoji}</div>
              <div>
                <h3>{g.name}</h3>
                <p>{g.desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {active && (
        <div>
          <button className="btn ghost sm mb" onClick={() => setActive(null)}>← All games</button>
          <div className="card">
            <ActiveEl gameId={active} />
          </div>
        </div>
      )}
    </div>
  );
}
