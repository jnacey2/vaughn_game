import {
  getCardDef,
  getLegalActions,
  opponentOf,
  type Action,
  type EffectDef,
  type GameState,
  type PlayerId,
  type UnitInstance,
} from '@void-dynasty/engine';

// Rule-based bot AI, offered at three difficulty tiers. Normal mirrors docs/game-design.md
// section 8's priority order:
//   1. Take lethal if available.
//   2. Take favorable combat trades.
//   3. Spend RP on the highest-value affordable play ("curve out").
//   4. Use the Command Ability when affordable and value-positive.
//   5. Otherwise attack into the enemy Captain with anything left.
//   6. End turn.
//
// Easy weakens most of that judgement (mostly random, still finishes obvious lethal so games
// don't stall forever) and Hard sharpens it (accepts even trades, clears Bulwark blockers that
// are the only thing standing between it and lethal).
//
// `chooseNextAction` returns exactly one action per call so the caller (the web UI) can
// animate each step before asking for the next one. Call it repeatedly until it returns
// { type: 'endTurn' }, then apply that too.

export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
};

export const DIFFICULTY_DESCRIPTIONS: Record<Difficulty, string> = {
  easy: 'Plays loosely — good for learning the ropes.',
  normal: 'Solid tactics: takes good trades and curves out its hand.',
  hard: 'Ruthless: clears blockers for lethal and never wastes an edge.',
};

function cardCost(defId: string): number {
  const def = getCardDef(defId);
  if (def.type === 'captain') return 0;
  return def.cost;
}

function unitEffectiveHull(unit: UnitInstance): number {
  return unit.hull + unit.shields;
}

function findLethalCaptainAttack(state: GameState, playerId: PlayerId, actions: Action[]): Action | undefined {
  const enemy = state.players[opponentOf(playerId)];
  const captainAttacks = actions.filter((a): a is Action & { type: 'attack' } => a.type === 'attack' && a.targetInstanceId === 'captain');
  if (captainAttacks.length === 0) return undefined;
  const player = state.players[playerId];
  const totalAvailableDamage = captainAttacks.reduce((sum, a) => {
    const unit = player.bays.find((u) => u.instanceId === a.attackerInstanceId);
    return sum + (unit?.attack ?? 0);
  }, 0);
  if (totalAvailableDamage >= enemy.captain.hull) {
    // Any order is fine mathematically; pick the highest-attack attacker first.
    return captainAttacks
      .slice()
      .sort((a, b) => {
        const ua = player.bays.find((u) => u.instanceId === a.attackerInstanceId)?.attack ?? 0;
        const ub = player.bays.find((u) => u.instanceId === b.attackerInstanceId)?.attack ?? 0;
        return ub - ua;
      })[0];
  }
  return undefined;
}

interface TradeOptions {
  /** Hard mode accepts score === 0 (even trades) since removing board presence still has value. */
  acceptEvenTrades?: boolean;
}

function findBestTrade(state: GameState, playerId: PlayerId, actions: Action[], options: TradeOptions = {}): { action: Action; score: number } | undefined {
  const player = state.players[playerId];
  const enemy = state.players[opponentOf(playerId)];
  let best: { action: Action; score: number } | undefined;

  for (const action of actions) {
    if (action.type !== 'attack' || action.targetInstanceId === 'captain') continue;
    const attacker = player.bays.find((u) => u.instanceId === action.attackerInstanceId);
    const target = enemy.bays.find((u) => u.instanceId === action.targetInstanceId);
    if (!attacker || !target) continue;

    const targetDies = attacker.attack >= unitEffectiveHull(target);
    const attackerDies = target.attack >= unitEffectiveHull(attacker);
    const score = (targetDies ? cardCost(target.defId) + 1 : 0) - (attackerDies ? cardCost(attacker.defId) + 1 : 0);

    if (!best || score > best.score) best = { action, score };
  }

  if (!best) return undefined;
  const accepted = options.acceptEvenTrades ? best.score >= 0 : best.score > 0;
  return accepted ? best : undefined;
}

function findBestPlay(state: GameState, playerId: PlayerId, actions: Action[]): Action | undefined {
  const player = state.players[playerId];

  const candidates = actions.filter((a) => a.type === 'playUnit' || a.type === 'playModule' || a.type === 'playOrder');
  if (candidates.length === 0) return undefined;

  // Prefer healing/repairing when a friendly unit or the Captain is meaningfully damaged;
  // otherwise prefer the highest-cost affordable card (curve out as much RP as possible).
  const damagedUnit = player.bays.find((u) => u.hull < u.maxHull * 0.6);
  if (damagedUnit) {
    const healAction = candidates.find((a) => (a.type === 'playOrder' || a.type === 'playUnit') && 'targetInstanceId' in a && a.targetInstanceId === damagedUnit.instanceId);
    if (healAction) return healAction;
  }

  return candidates
    .slice()
    .sort((a, b) => cardCostForAction(state, playerId, b) - cardCostForAction(state, playerId, a))[0];
}

function cardCostForAction(state: GameState, playerId: PlayerId, action: Action): number {
  if (action.type !== 'playUnit' && action.type !== 'playModule' && action.type !== 'playOrder') return 0;
  const card = state.players[playerId].hand.find((c) => c.instanceId === action.cardInstanceId);
  return card ? cardCost(card.defId) : 0;
}

function findValuePositiveCaptainAbility(state: GameState, playerId: PlayerId, actions: Action[]): Action | undefined {
  const captainActions = actions.filter((a) => a.type === 'useCaptainAbility');
  if (captainActions.length === 0) return undefined;
  const player = state.players[playerId];
  const captainDef = getCardDef(player.captain.defId);
  if (captainDef.type !== 'captain') return undefined;

  // Heal-flavored abilities: use on the most damaged friendly unit, or skip if nobody's hurt.
  const isHeal = captainDef.commandAbility.effects.some((e) => e.kind === 'heal');
  if (isHeal) {
    const target = player.bays.filter((u) => u.hull < u.maxHull).sort((a, b) => a.hull / a.maxHull - b.hull / b.maxHull)[0];
    if (!target) return undefined;
    return captainActions.find((a) => 'targetInstanceId' in a && a.targetInstanceId === target.instanceId);
  }

  // Damage-flavored abilities: use on the highest-value enemy unit it can help kill or dent.
  const enemy = state.players[opponentOf(playerId)];
  if (enemy.bays.length > 0) {
    const best = enemy.bays.slice().sort((a, b) => cardCost(b.defId) - cardCost(a.defId))[0];
    return captainActions.find((a) => 'targetInstanceId' in a && a.targetInstanceId === best.instanceId) ?? captainActions[0];
  }
  return captainActions[0];
}

/** Total direct damage a playOrder/useCaptainAbility action would deal to its target, if any. */
function actionDirectDamageAmount(state: GameState, playerId: PlayerId, action: Action): number {
  let effects: EffectDef[] | undefined;
  if (action.type === 'playOrder') {
    const card = state.players[playerId].hand.find((c) => c.instanceId === action.cardInstanceId);
    const def = card ? getCardDef(card.defId) : undefined;
    effects = def && def.type === 'order' ? def.effects : undefined;
  } else if (action.type === 'useCaptainAbility') {
    const captainDef = getCardDef(state.players[playerId].captain.defId);
    effects = captainDef.type === 'captain' ? captainDef.commandAbility.effects : undefined;
  }
  if (!effects) return 0;
  return effects
    .filter((e): e is EffectDef & { kind: 'damage' } => e.kind === 'damage' && e.target === 'enemyUnit')
    .reduce((sum, e) => sum + e.amount, 0);
}

/**
 * Hard mode only: if a Bulwark unit is the sole thing standing between us and lethal (or is just
 * blocking our attackers this turn), and we hold a removal effect that can outright kill it, use
 * that removal first — legal actions get recomputed after every action, so this can open up the
 * face attack or trade that follows in the same turn.
 */
function findBulwarkClearingRemoval(state: GameState, playerId: PlayerId, actions: Action[]): Action | undefined {
  const player = state.players[playerId];
  const canAttackThisTurn = player.bays.some((u) => u.canAttack && !u.hasAttackedThisTurn);
  if (!canAttackThisTurn) return undefined;

  const enemy = state.players[opponentOf(playerId)];
  const bulwarks = enemy.bays.filter((u) => u.keywords.includes('bulwark'));
  if (bulwarks.length === 0) return undefined;

  for (const action of actions) {
    if (action.type !== 'playOrder' && action.type !== 'useCaptainAbility') continue;
    if (!('targetInstanceId' in action) || !action.targetInstanceId) continue;
    const target = bulwarks.find((u) => u.instanceId === action.targetInstanceId);
    if (!target) continue;
    const dmg = actionDirectDamageAmount(state, playerId, action);
    if (dmg >= unitEffectiveHull(target)) return action;
  }
  return undefined;
}

function chooseEasyAction(state: GameState, playerId: PlayerId): Action {
  const actions = getLegalActions(state, playerId);
  if (actions.length === 0) return { type: 'endTurn' };

  // Still snap up an obvious kill-shot so games against Easy don't drag on forever.
  const lethal = findLethalCaptainAttack(state, playerId, actions);
  if (lethal) return lethal;

  const nonEndTurn = actions.filter((a) => a.type !== 'endTurn');
  if (nonEndTurn.length === 0) return { type: 'endTurn' };

  // Otherwise Easy just picks something at random — no trade math, no curve, no plan — with a
  // small chance to pass early even when it still has plays available.
  if (Math.random() < 0.12) return { type: 'endTurn' };
  return nonEndTurn[Math.floor(Math.random() * nonEndTurn.length)];
}

function chooseNormalAction(state: GameState, playerId: PlayerId): Action {
  const actions = getLegalActions(state, playerId);
  if (actions.length === 0) return { type: 'endTurn' };

  const lethal = findLethalCaptainAttack(state, playerId, actions);
  if (lethal) return lethal;

  const trade = findBestTrade(state, playerId, actions);
  if (trade) return trade.action;

  const play = findBestPlay(state, playerId, actions);
  if (play) return play;

  const ability = findValuePositiveCaptainAbility(state, playerId, actions);
  if (ability) return ability;

  const chipAttack = actions.find((a) => a.type === 'attack');
  if (chipAttack) return chipAttack;

  return { type: 'endTurn' };
}

function chooseHardAction(state: GameState, playerId: PlayerId): Action {
  const actions = getLegalActions(state, playerId);
  if (actions.length === 0) return { type: 'endTurn' };

  const lethal = findLethalCaptainAttack(state, playerId, actions);
  if (lethal) return lethal;

  const bulwarkRemoval = findBulwarkClearingRemoval(state, playerId, actions);
  if (bulwarkRemoval) return bulwarkRemoval;

  // Hard is willing to take even trades — attrition favors whoever keeps more board presence.
  const trade = findBestTrade(state, playerId, actions, { acceptEvenTrades: true });
  if (trade) return trade.action;

  const play = findBestPlay(state, playerId, actions);
  if (play) return play;

  const ability = findValuePositiveCaptainAbility(state, playerId, actions);
  if (ability) return ability;

  const chipAttack = actions.find((a) => a.type === 'attack');
  if (chipAttack) return chipAttack;

  return { type: 'endTurn' };
}

export function chooseNextAction(state: GameState, playerId: PlayerId, difficulty: Difficulty = 'normal'): Action {
  if (difficulty === 'easy') return chooseEasyAction(state, playerId);
  if (difficulty === 'hard') return chooseHardAction(state, playerId);
  return chooseNormalAction(state, playerId);
}
