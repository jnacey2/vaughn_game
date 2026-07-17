import { useGameStore } from './game/store';
import { DeckSelectScreen } from './components/DeckSelectScreen';
import { RollForFirstScreen } from './components/RollForFirstScreen';
import { MatchScreen } from './components/MatchScreen';
import { GameOverScreen } from './components/GameOverScreen';
import './App.css';

export default function App() {
  const screen = useGameStore((s) => s.screen);

  return (
    <div className="app-root">
      {screen === 'deckSelect' && <DeckSelectScreen />}
      {screen === 'rollingForFirst' && <RollForFirstScreen />}
      {(screen === 'match' || screen === 'gameOver') && <MatchScreen />}
      {screen === 'gameOver' && <GameOverScreen />}
    </div>
  );
}
