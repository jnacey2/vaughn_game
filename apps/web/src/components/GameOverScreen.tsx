import { useGameStore } from '../game/store';
import './GameOverScreen.css';

export function GameOverScreen() {
  const state = useGameStore((s) => s.state);
  const rematch = useGameStore((s) => s.rematch);
  const backToDeckSelect = useGameStore((s) => s.backToDeckSelect);

  if (!state) return null;
  const won = state.winnerId === 'player';

  return (
    <div className="game-over">
      <div className={`game-over__panel ${won ? 'game-over__panel--win' : 'game-over__panel--loss'}`}>
        <h1>{won ? 'Victory' : 'Defeat'}</h1>
        <p>{won ? 'The enemy Captain\'s ship falls silent. Your House holds the line.' : 'Your Captain\'s ship falls silent. The line does not hold.'}</p>
        <div className="game-over__actions">
          <button type="button" onClick={rematch}>
            Rematch
          </button>
          <button type="button" className="game-over__secondary" onClick={backToDeckSelect}>
            Choose a Different House
          </button>
        </div>
      </div>
    </div>
  );
}
