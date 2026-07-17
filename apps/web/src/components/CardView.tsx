import { useMemo, type CSSProperties } from 'react';
import { getCardDef, type CardDef, type Keyword, type UnitInstance } from '@void-dynasty/engine';
import { getCardArtUrl } from '../game/cardArt';
import { HOUSE_THEME } from '../game/houseTheme';
import './CardView.css';

const KEYWORD_LABEL: Record<Keyword, string> = {
  bulwark: 'Bulwark',
  cloak: 'Cloak',
  rapidDeploy: 'Rapid Deploy',
  boarding: 'Boarding',
  overload: 'Overload',
};

const TYPE_ICON: Record<CardDef['type'], string> = {
  unit: '',
  module: '⚙',
  order: '✦',
  captain: '★',
};

function unitKindIcon(def: CardDef): string {
  if (def.type !== 'unit') return TYPE_ICON[def.type];
  return def.unitKind === 'ship' ? '🚀' : '👾';
}

export interface CardViewProps {
  defId: string;
  size?: 'hand' | 'board' | 'large';
  playable?: boolean;
  highlighted?: boolean;
  selected?: boolean;
  faded?: boolean;
  onClick?: () => void;
  /** For units on the board — overrides the base stats with live instance state. */
  liveUnit?: UnitInstance;
}

export function CardView({ defId, size = 'hand', playable, highlighted, selected, faded, onClick, liveUnit }: CardViewProps) {
  const def = useMemo(() => getCardDef(defId), [defId]);
  const theme = HOUSE_THEME[def.faction];
  const art = getCardArtUrl(defId);

  const attack = liveUnit?.attack ?? (def.type === 'unit' ? def.attack : def.type === 'module' ? def.attackBonus : undefined);
  const hull = liveUnit?.hull ?? (def.type === 'unit' ? def.hull : def.type === 'module' ? def.hullBonus : def.type === 'captain' ? def.hull : undefined);
  const shields = liveUnit?.shields ?? (def.type === 'unit' ? def.shields : def.type === 'module' ? def.shieldBonus : undefined);
  const keywords = liveUnit?.keywords ?? (def.type === 'unit' ? def.keywords : def.type === 'module' ? def.keywordsGranted : []);
  const cost = def.type === 'captain' ? undefined : def.cost;

  return (
    <button
      type="button"
      className={[
        'card',
        `card--${size}`,
        `card--${def.type}`,
        playable ? 'card--playable' : '',
        highlighted ? 'card--highlighted' : '',
        selected ? 'card--selected' : '',
        faded ? 'card--faded' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ '--house-primary': theme.primary, '--house-secondary': theme.secondary, '--house-glow': theme.glow } as CSSProperties}
      onClick={onClick}
      disabled={!onClick}
      title={def.type === 'order' ? def.flavor : undefined}
    >
      {cost !== undefined && <div className="card__cost">{cost}</div>}
      <div className="card__art" style={!art ? { background: theme.gradient } : undefined}>
        {art ? <img src={art} alt={def.name} loading="lazy" /> : <span className="card__art-icon">{unitKindIcon(def)}</span>}
        {liveUnit?.cloakedUntilAttacks && <span className="card__cloak-badge">CLOAKED</span>}
      </div>
      <div className="card__body">
        <div className="card__name">{def.name}</div>
        {size !== 'board' && <div className="card__flavor">{def.flavor}</div>}
        {size !== 'board' && def.type === 'captain' && <div className="card__ability-text">{def.passiveDescription}</div>}
        {size !== 'board' && def.type === 'captain' && (
          <div className="card__ability-text card__ability-text--command">
            Command ({def.commandAbility.cost}): {def.commandAbility.description}
          </div>
        )}
        {size !== 'board' && def.type === 'order' && <div className="card__ability-text">{def.description}</div>}
        {size !== 'board' && (def.type === 'unit' || def.type === 'module') && def.ability && (
          <div className="card__ability-text">{def.ability.description}</div>
        )}
        {keywords.length > 0 && (
          <div className="card__keywords">
            {keywords.map((k) => (
              <span key={k} className={`card__keyword card__keyword--${k}`}>
                {KEYWORD_LABEL[k]}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="card__stats">
        {attack !== undefined && (
          <span className="card__stat card__stat--attack" title="Attack">
            ATK {attack}
          </span>
        )}
        {shields !== undefined && shields > 0 && (
          <span className="card__stat card__stat--shields" title="Shields">
            SH {shields}
          </span>
        )}
        {hull !== undefined && (
          <span className="card__stat card__stat--hull" title="Hull">
            HP {hull}
          </span>
        )}
      </div>
    </button>
  );
}
