import type { Action } from './actions.js';
import { getCardDef } from './cards/index.js';
import { enemyBulwarkUnits, isTargetable, legalAttackTargetIds, resolveAttack } from './combat.js';
import { drawCard, findUnit, makeModuleInstance, makeUnitInstance, resolveEffects } from './effects.js';
import { opponentOf } from './state.js';
import { MAX_BAYS, MAX_HAND_SIZE, MAX_RP_CAP, type GameState, type PlayerId } from './types.js';

export class IllegalActionError extends Error {}

function requireCardInHand(state: GameState, playerId: PlayerId, cardInstanceId: string) {
  const player = state.players[playerId];
  const idx = player.hand.findIndex((c) => c.instanceId === cardInstanceId);
  if (idx === -1) throw new IllegalActionError(`Card ${cardInstanceId} is not in ${playerId}'s hand`);
  return { player, idx, cardInHand: player.hand[idx] };
}

function startTurnFor(state: GameState, playerId: PlayerId): void {
  const player = state.players[playerId];
  player.rpCap = Math.min(MAX_RP_CAP, player.rpCap + 1);
  player.rp = player.rpCap;
  player.captain.commandAbilityUsedThisTurn = false;
  for (const unit of player.bays) {
    unit.canAttack = true;
    unit.hasAttackedThisTurn = false;
    unit.cloakedUntilAttacks = false;
  }
  drawCard(state, playerId);
  if (player.hand.length > MAX_HAND_SIZE) {
    const overflow = player.hand.splice(MAX_HAND_SIZE);
    player.discard.push(...overflow);
    state.log.push(`${playerId} discarded ${overflow.length} card(s) from an over-full hand.`);
  }
}

/** Pure-ish reducer: clones the input state, mutates the clone, and returns it. */
export function applyAction(state: GameState, action: Action): GameState {
  const next = structuredClone(state);
  if (next.phase === 'gameOver') return next;

  const activeId = next.activePlayerId;
  const player = next.players[activeId];

  switch (action.type) {
    case 'playUnit': {
      const { idx, cardInHand } = requireCardInHand(next, activeId, action.cardInstanceId);
      const def = getCardDef(cardInHand.defId);
      if (def.type !== 'unit') throw new IllegalActionError(`${def.defId} is not a unit`);
      if (player.rp < def.cost) throw new IllegalActionError('Not enough Reactor Power');
      if (player.bays.length >= MAX_BAYS) throw new IllegalActionError('No free bays');

      player.hand.splice(idx, 1);
      player.rp -= def.cost;
      const unit = makeUnitInstance(def.defId, activeId);

      // Captain passive: Aldric Kessler grants +1 Hull to units on deploy.
      if (player.captain.defId === 'captain_aldric_kessler') {
        unit.hull += 1;
        unit.maxHull += 1;
      }

      player.bays.push(unit);
      if (def.ability?.trigger === 'onPlay') {
        resolveEffects(next, def.ability.effects, { controllerId: activeId, selfInstanceId: unit.instanceId, chosenTargetInstanceId: action.targetInstanceId });
      }
      next.log.push(`${activeId} deployed ${def.name}.`);
      break;
    }
    case 'playModule': {
      const { idx, cardInHand } = requireCardInHand(next, activeId, action.cardInstanceId);
      const def = getCardDef(cardInHand.defId);
      if (def.type !== 'module') throw new IllegalActionError(`${def.defId} is not a module`);
      if (player.rp < def.cost) throw new IllegalActionError('Not enough Reactor Power');
      const host = player.bays.find((u) => u.instanceId === action.hostInstanceId);
      if (!host) throw new IllegalActionError('Host unit not found in your bays');

      player.hand.splice(idx, 1);
      player.rp -= def.cost;
      const module = makeModuleInstance(def.defId, host.instanceId);
      player.modules.push(module);
      host.attachedModuleInstanceIds.push(module.instanceId);
      host.attack += def.attackBonus;
      host.maxHull += def.hullBonus;
      host.hull += def.hullBonus;
      host.shields += def.shieldBonus;
      for (const kw of def.keywordsGranted) if (!host.keywords.includes(kw)) host.keywords.push(kw);
      if (def.ability?.trigger === 'onPlay') {
        resolveEffects(next, def.ability.effects, { controllerId: activeId, selfInstanceId: host.instanceId, chosenTargetInstanceId: action.targetInstanceId });
      }
      next.log.push(`${activeId} attached ${def.name} to a unit.`);
      break;
    }
    case 'playOrder': {
      const { idx, cardInHand } = requireCardInHand(next, activeId, action.cardInstanceId);
      const def = getCardDef(cardInHand.defId);
      if (def.type !== 'order') throw new IllegalActionError(`${def.defId} is not an order`);
      if (player.rp < def.cost) throw new IllegalActionError('Not enough Reactor Power');

      player.hand.splice(idx, 1);
      player.rp -= def.cost;
      resolveEffects(next, def.effects, { controllerId: activeId, chosenTargetInstanceId: action.targetInstanceId });
      next.log.push(`${activeId} played ${def.name}.`);
      break;
    }
    case 'useCaptainAbility': {
      const captainDef = getCardDef(player.captain.defId);
      if (captainDef.type !== 'captain') throw new IllegalActionError('Invalid captain');
      if (player.captain.commandAbilityUsedThisTurn) throw new IllegalActionError('Command ability already used this turn');
      if (player.rp < captainDef.commandAbility.cost) throw new IllegalActionError('Not enough Reactor Power');

      player.rp -= captainDef.commandAbility.cost;
      player.captain.commandAbilityUsedThisTurn = true;
      resolveEffects(next, captainDef.commandAbility.effects, { controllerId: activeId, chosenTargetInstanceId: action.targetInstanceId });
      next.log.push(`${activeId} used ${captainDef.name}'s command ability.`);
      break;
    }
    case 'attack': {
      const attacker = player.bays.find((u) => u.instanceId === action.attackerInstanceId);
      if (!attacker) throw new IllegalActionError('Attacker not found');
      if (!attacker.canAttack || attacker.hasAttackedThisTurn) throw new IllegalActionError('This unit cannot attack right now');
      const legalTargets = legalAttackTargetIds(next, activeId);
      if (!legalTargets.includes(action.targetInstanceId)) throw new IllegalActionError('Illegal attack target');
      resolveAttack(next, action.attackerInstanceId, action.targetInstanceId);
      break;
    }
    case 'endTurn': {
      const nextActiveId = opponentOf(activeId);
      next.activePlayerId = nextActiveId;
      next.turn += 1;
      startTurnFor(next, nextActiveId);
      next.log.push(`Turn ${next.turn}: ${nextActiveId}'s turn.`);
      break;
    }
    default:
      break;
  }

  return next;
}

// ---------------------------------------------------------------------------
// Legal action enumeration (shared by the bot and by UI affordances)
// ---------------------------------------------------------------------------

export function isGameOver(state: GameState): boolean {
  return state.phase === 'gameOver';
}

export function getLegalActions(state: GameState, playerId: PlayerId): Action[] {
  if (state.phase === 'gameOver' || state.activePlayerId !== playerId) return [];
  const player = state.players[playerId];
  const enemy = state.players[opponentOf(playerId)];
  const actions: Action[] = [];

  for (const cardInHand of player.hand) {
    const def = getCardDef(cardInHand.defId);
    if (def.type === 'unit') {
      if (player.rp < def.cost || player.bays.length >= MAX_BAYS) continue;
      if (def.ability?.trigger === 'onPlay' && def.ability.effects.some((e) => 'target' in e && (e.target === 'friendlyUnit' || e.target === 'enemyUnit'))) {
        const pool = def.ability.effects.find((e) => 'target' in e && e.target === 'friendlyUnit') ? player.bays : enemy.bays;
        for (const target of pool.filter(isTargetable)) {
          actions.push({ type: 'playUnit', cardInstanceId: cardInHand.instanceId, targetInstanceId: target.instanceId });
        }
        if (pool.length === 0) actions.push({ type: 'playUnit', cardInstanceId: cardInHand.instanceId });
      } else {
        actions.push({ type: 'playUnit', cardInstanceId: cardInHand.instanceId });
      }
    } else if (def.type === 'module') {
      if (player.rp < def.cost) continue;
      for (const host of player.bays) {
        actions.push({ type: 'playModule', cardInstanceId: cardInHand.instanceId, hostInstanceId: host.instanceId });
      }
    } else if (def.type === 'order') {
      if (player.rp < def.cost) continue;
      const needsFriendly = def.effects.some((e) => 'target' in e && e.target === 'friendlyUnit');
      const needsEnemy = def.effects.some((e) => 'target' in e && e.target === 'enemyUnit');
      if (needsFriendly) {
        for (const target of player.bays.filter(isTargetable)) actions.push({ type: 'playOrder', cardInstanceId: cardInHand.instanceId, targetInstanceId: target.instanceId });
      } else if (needsEnemy) {
        for (const target of enemy.bays.filter(isTargetable)) actions.push({ type: 'playOrder', cardInstanceId: cardInHand.instanceId, targetInstanceId: target.instanceId });
      } else {
        actions.push({ type: 'playOrder', cardInstanceId: cardInHand.instanceId });
      }
    }
  }

  const captainDef = getCardDef(player.captain.defId);
  if (captainDef.type === 'captain' && !player.captain.commandAbilityUsedThisTurn && player.rp >= captainDef.commandAbility.cost) {
    const needsFriendly = captainDef.commandAbility.effects.some((e) => 'target' in e && e.target === 'friendlyUnit');
    const needsEnemy = captainDef.commandAbility.effects.some((e) => 'target' in e && e.target === 'enemyUnit');
    if (needsFriendly) {
      for (const target of player.bays.filter(isTargetable)) actions.push({ type: 'useCaptainAbility', targetInstanceId: target.instanceId });
    } else if (needsEnemy) {
      for (const target of enemy.bays.filter(isTargetable)) actions.push({ type: 'useCaptainAbility', targetInstanceId: target.instanceId });
    } else {
      actions.push({ type: 'useCaptainAbility' });
    }
  }

  for (const unit of player.bays) {
    if (!unit.canAttack || unit.hasAttackedThisTurn) continue;
    for (const targetId of legalAttackTargetIds(state, playerId)) {
      actions.push({ type: 'attack', attackerInstanceId: unit.instanceId, targetInstanceId: targetId });
    }
  }

  actions.push({ type: 'endTurn' });
  return actions;
}

export { findUnit, enemyBulwarkUnits };
