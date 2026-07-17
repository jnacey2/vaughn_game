import { getCaptainDef, type CaptainState } from '@void-dynasty/engine';
import { HOUSE_THEME } from '../game/houseTheme';
import { getCardArtUrl } from '../game/cardArt';
import './CaptainPanel.css';

export interface CaptainPanelProps {
  captain: CaptainState;
  side: 'player' | 'enemy';
  clickableAsTarget?: boolean;
  highlighted?: boolean;
  recentlyHit?: boolean;
  onClick?: () => void;
}

export function CaptainPanel({ captain, side, clickableAsTarget, highlighted, recentlyHit, onClick }: CaptainPanelProps) {
  const def = getCaptainDef(captain.defId);
  const theme = HOUSE_THEME[def.faction];
  const art = getCardArtUrl(def.defId);
  const hullPct = Math.max(0, Math.min(100, (captain.hull / captain.maxHull) * 100));

  return (
    // The whole panel (not just the portrait) is clickable as a target — a player aiming for
    // "attack the enemy Captain" shouldn't have to precisely hit a small circular portrait.
    <div
      className={`captain-panel captain-panel--${side} ${clickableAsTarget ? 'captain-panel--clickable' : ''} ${highlighted ? 'captain-panel--highlighted' : ''} ${recentlyHit ? 'captain-panel--hit' : ''}`}
      onClick={clickableAsTarget ? onClick : undefined}
    >
      <div
        className="captain-panel__portrait"
        style={{ borderColor: theme.primary, boxShadow: highlighted ? `0 0 0 4px #ffd166` : `0 0 14px ${theme.glow}66` }}
      >
        {art ? <img src={art} alt={def.name} /> : <div className="captain-panel__placeholder" style={{ background: theme.gradient }} />}
      </div>
      <div className="captain-panel__info">
        <div className="captain-panel__name" style={{ color: theme.glow }}>
          {def.name}
        </div>
        <div className="captain-panel__hullbar">
          <div className="captain-panel__hullbar-fill" style={{ width: `${hullPct}%`, background: hullPct > 30 ? '#4ade80' : '#f87171' }} />
          <span className="captain-panel__hullbar-label">
            {Math.max(captain.hull, 0)} / {captain.maxHull}
          </span>
        </div>
      </div>
    </div>
  );
}
