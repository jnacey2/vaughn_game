import type { CSSProperties } from 'react';
import { getCaptainDef } from '@void-dynasty/engine';
import { useGameStore } from '../game/store';
import { HOUSE_THEME } from '../game/houseTheme';
import { getCardArtUrl } from '../game/cardArt';
import './RollForFirstScreen.css';

/**
 * A short, purely visual "coin flip" between deck select and the match board. The outcome
 * (`state.activePlayerId`) is already decided by the time this screen mounts — this just
 * dramatizes it with a spinning die before the reveal, timed to roughly match
 * `ROLL_ANIMATION_MS` in the store.
 */
export function RollForFirstScreen() {
  const state = useGameStore((s) => s.state);
  const playerFaction = useGameStore((s) => s.playerFaction);

  if (!state || !playerFaction) return null;

  const enemyFaction = playerFaction === 'kessler' ? 'voss' : 'kessler';
  const playerTheme = HOUSE_THEME[playerFaction];
  const enemyTheme = HOUSE_THEME[enemyFaction];
  const myCaptain = getCaptainDef(state.players.player.captain.defId);
  const enemyCaptain = getCaptainDef(state.players.opponent.captain.defId);
  const playerGoesFirst = state.activePlayerId === 'player';

  return (
    <div className="roll-screen">
      <div className="roll-screen__die" aria-hidden="true">
        🎲
      </div>
      <div className="roll-screen__label roll-screen__label--rolling">Rolling for initiative…</div>

      <div className="roll-screen__contenders">
        <div
          className={`roll-screen__contender ${playerGoesFirst ? 'roll-screen__contender--winner' : ''}`}
          style={{ '--house-glow': playerTheme.glow } as CSSProperties}
        >
          <div className="roll-screen__portrait" style={{ borderColor: playerTheme.primary, background: playerTheme.gradient }}>
            {getCardArtUrl(myCaptain.defId) && <img src={getCardArtUrl(myCaptain.defId)} alt={myCaptain.name} />}
          </div>
          <div className="roll-screen__contender-name" style={{ color: playerTheme.glow }}>
            {myCaptain.name}
          </div>
          <div className="roll-screen__contender-house">{playerTheme.label}</div>
        </div>

        <div className="roll-screen__vs">VS</div>

        <div
          className={`roll-screen__contender ${!playerGoesFirst ? 'roll-screen__contender--winner' : ''}`}
          style={{ '--house-glow': enemyTheme.glow } as CSSProperties}
        >
          <div className="roll-screen__portrait" style={{ borderColor: enemyTheme.primary, background: enemyTheme.gradient }}>
            {getCardArtUrl(enemyCaptain.defId) && <img src={getCardArtUrl(enemyCaptain.defId)} alt={enemyCaptain.name} />}
          </div>
          <div className="roll-screen__contender-name" style={{ color: enemyTheme.glow }}>
            {enemyCaptain.name}
          </div>
          <div className="roll-screen__contender-house">{enemyTheme.label}</div>
        </div>
      </div>

      <div className="roll-screen__label roll-screen__label--result">
        {playerGoesFirst ? 'You seize the initiative!' : `${enemyCaptain.name} moves first!`}
      </div>
    </div>
  );
}
