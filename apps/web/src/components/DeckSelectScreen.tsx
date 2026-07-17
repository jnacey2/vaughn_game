import { getCaptainDef, STARTER_DECKS, type Faction } from '@void-dynasty/engine';
import { HOUSE_THEME } from '../game/houseTheme';
import { CardView } from './CardView';
import { useGameStore } from '../game/store';
import './DeckSelectScreen.css';

const FACTIONS: Faction[] = ['kessler', 'voss'];

export function DeckSelectScreen() {
  const startMatch = useGameStore((s) => s.startMatch);

  return (
    <div className="deck-select">
      <div className="deck-select__hero">
        <h1>VOID DYNASTY</h1>
        <p className="deck-select__subtitle">
          A thousand years after the Sovereign fell, its wreckage still leaks the Aether that makes starflight possible — and the
          Great Houses still bleed each other for the last of it. Choose a House and take their fleet into battle.
        </p>
      </div>
      <div className="deck-select__houses">
        {FACTIONS.map((faction) => {
          const theme = HOUSE_THEME[faction];
          const deck = STARTER_DECKS[faction];
          const captain = getCaptainDef(deck.captainDefId);
          return (
            <div key={faction} className="deck-select__house" style={{ background: theme.gradient, borderColor: theme.primary }}>
              <h2 style={{ color: theme.glow }}>{theme.label}</h2>
              <div className="deck-select__tagline">{theme.tagline}</div>
              <div className="deck-select__captain">
                <CardView defId={captain.defId} size="large" />
              </div>
              <p className="deck-select__flavor">{captain.flavor}</p>
              <button type="button" className="deck-select__play-btn" style={{ background: theme.primary }} onClick={() => startMatch(faction)}>
                Command {theme.label}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
