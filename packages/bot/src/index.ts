import {
  getCardDef,
  getLegalActions,
  opponentOf,
  type Action,
  type GameState,
  type PlayerId,
  type UnitInstance,
} from '@void-dynasty/engine';

// Rule-based bot AI. Priority order mirrors docs/game-design.md section 8:
//   1. Take lethal if available.
//   2. Take favorable combat trades.
//   3. Spend RP on the highest-value affordable play ("curve out").
//   4. Use the Command Ability when affordable and value-positive.
//   5. Otherwise attack into the enemy Captain with anything left.
//   6. End turn.
//
// `chooseNextAction` returns exactly one action per call so the caller (the web UI) can
// animate each step before asking for the next one. Call it repeatedly until it returns
// { type: 'endTurn' }, then apply that too.

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

function findBestTrade(state: GameState, playerId: PlayerId, actions: Action[]): { action: Action; score: number } | undefined {
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

  return best && best.score > 0 ? best : undefined;
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
    .sort((a, b) => {
      const costA = a.type === 'playOrder' || a.type === 'playUnit' || a.type === 'playModule' ? cardCostForAction(state, playerId, a) : 0;
      const costB = a.type === 'playOrder' || a.type === 'playUnit' || a.type === 'playModule' ? cardCostForAction(state, playerId, b) : 0;
      return costB - costA;
    })[0];
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

export function chooseNextAction(state: GameState, playerId: PlayerId): Action {
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
