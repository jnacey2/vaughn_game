// Core data model for Void Dynasty. Mirrors docs/game-design.md — that doc is the source of
// truth for rules; this file is just the TypeScript shape of those rules.

export type Faction = 'kessler' | 'voss';

export type Keyword =
  | 'bulwark' // must be attacked before other friendly units
  | 'cloak' // cannot be attacked/targeted until it attacks or its controller's next turn starts
  | 'rapidDeploy' // no deploy sickness
  | 'boarding' // on destroying an enemy unit in combat, deal 1 to the enemy Captain
  | 'overload'; // flavor/UI flag: this card deals bonus effect at the cost of self-damage (baked into its `effects`)

export type UnitKind = 'ship' | 'creature';

export type EffectTarget =
  | 'enemyCaptain'
  | 'friendlyCaptain'
  | 'enemyUnit' // requires a chosen target instance id
  | 'friendlyUnit' // requires a chosen target instance id
  | 'self'; // the unit/module that owns this ability

export type EffectDef =
  | { kind: 'damage'; amount: number; target: EffectTarget }
  | { kind: 'heal'; amount: number; target: EffectTarget }
  | { kind: 'buff'; attack?: number; hull?: number; shields?: number; target: EffectTarget }
  | { kind: 'grantKeyword'; keyword: Keyword; target: EffectTarget }
  | { kind: 'draw'; amount: number }
  | { kind: 'gainRP'; amount: number }
  | { kind: 'damageOwnCaptain'; amount: number };

export type TriggerType = 'onPlay' | 'onDeath';

export interface AbilityDef {
  trigger: TriggerType;
  effects: EffectDef[];
  description: string;
}

/** Does this ability's effects require the player/bot to choose a target instance? */
export function abilityRequiresTarget(ability: AbilityDef): boolean {
  return ability.effects.some((e) => 'target' in e && (e.target === 'enemyUnit' || e.target === 'friendlyUnit'));
}

interface BaseCardDef {
  defId: string;
  name: string;
  faction: Faction;
  flavor: string;
  /** relative path under the web app's asset root, or undefined to use a generated placeholder */
  art?: string;
}

export interface UnitCardDef extends BaseCardDef {
  type: 'unit';
  unitKind: UnitKind;
  cost: number;
  attack: number;
  hull: number;
  shields: number;
  keywords: Keyword[];
  ability?: AbilityDef;
}

export interface ModuleCardDef extends BaseCardDef {
  type: 'module';
  cost: number;
  attackBonus: number;
  hullBonus: number;
  shieldBonus: number;
  keywordsGranted: Keyword[];
  ability?: AbilityDef; // fires (as onPlay) when the module attaches
}

export interface OrderCardDef extends BaseCardDef {
  type: 'order';
  cost: number;
  effects: EffectDef[];
  description: string;
}

export interface CaptainCardDef extends BaseCardDef {
  type: 'captain';
  hull: number;
  passiveDescription: string;
  commandAbility: {
    cost: number;
    description: string;
    effects: EffectDef[];
  };
}

export type CardDef = UnitCardDef | ModuleCardDef | OrderCardDef | CaptainCardDef;

export function cardRequiresTarget(card: CardDef): boolean {
  if (card.type === 'order') return card.effects.some((e) => 'target' in e && (e.target === 'enemyUnit' || e.target === 'friendlyUnit'));
  if (card.type === 'unit' || card.type === 'module') return card.ability ? abilityRequiresTarget(card.ability) : false;
  return false;
}

// ---------------------------------------------------------------------------
// Runtime (in-match) instances
// ---------------------------------------------------------------------------

export interface UnitInstance {
  instanceId: string;
  defId: string;
  ownerId: PlayerId;
  attack: number;
  hull: number;
  maxHull: number;
  shields: number;
  keywords: Keyword[];
  attachedModuleInstanceIds: string[];
  canAttack: boolean; // false while deploy-sick (unless rapidDeploy)
  hasAttackedThisTurn: boolean;
  cloakedUntilAttacks: boolean; // true while Cloak is still hiding it
}

export interface ModuleInstance {
  instanceId: string;
  defId: string;
  hostInstanceId: string;
}

export interface CardInDeck {
  instanceId: string;
  defId: string;
}

export type PlayerId = 'player' | 'opponent';

export interface CaptainState {
  defId: string;
  hull: number;
  maxHull: number;
  commandAbilityUsedThisTurn: boolean;
}

export interface PlayerState {
  id: PlayerId;
  captain: CaptainState;
  deck: CardInDeck[]; // draw pile, index 0 = top
  hand: CardInDeck[];
  discard: CardInDeck[];
  bays: UnitInstance[]; // max 5
  modules: ModuleInstance[]; // flat list, cross-referenced by attachedModuleInstanceIds
  rpCap: number;
  rp: number;
  fatigueCounter: number;
}

export type GamePhase = 'main' | 'gameOver';

export interface GameState {
  turn: number;
  activePlayerId: PlayerId;
  phase: GamePhase;
  players: Record<PlayerId, PlayerState>;
  winnerId: PlayerId | null;
  log: string[];
}

export const MAX_BAYS = 5;
export const MAX_HAND_SIZE = 10;
export const MAX_RP_CAP = 10;
