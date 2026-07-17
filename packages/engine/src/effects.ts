import { getCardDef } from './cards/index.js';
import { nextInstanceId } from './ids.js';
import { opponentOf } from './state.js';
import type { EffectDef, GameState, ModuleInstance, PlayerId, UnitInstance } from './types.js';

export interface EffectContext {
  controllerId: PlayerId;
  /** instance id of the unit/module that "self"-targeted effects refer to, if any */
  selfInstanceId?: string;
  /** player-chosen (or bot-chosen) target instance id for effects that need one */
  chosenTargetInstanceId?: string;
}

export function findUnit(state: GameState, instanceId: string): { unit: UnitInstance; ownerId: PlayerId } | undefined {
  for (const ownerId of Object.keys(state.players) as PlayerId[]) {
    const unit = state.players[ownerId].bays.find((u) => u.instanceId === instanceId);
    if (unit) return { unit, ownerId };
  }
  return undefined;
}

/** Applies damage to a unit (shields first, then hull), destroying it and cleaning up if it dies. */
export function damageUnit(state: GameState, ownerId: PlayerId, unit: UnitInstance, amount: number): void {
  let remaining = amount;
  if (unit.shields > 0) {
    const absorbed = Math.min(unit.shields, remaining);
    unit.shields -= absorbed;
    remaining -= absorbed;
  }
  if (remaining > 0) {
    unit.hull -= remaining;
  }
  if (unit.hull <= 0) {
    destroyUnit(state, ownerId, unit.instanceId);
  }
}

export function destroyUnit(state: GameState, ownerId: PlayerId, instanceId: string): void {
  const player = state.players[ownerId];
  const idx = player.bays.findIndex((u) => u.instanceId === instanceId);
  if (idx === -1) return;
  const [unit] = player.bays.splice(idx, 1);
  player.modules = player.modules.filter((m) => !unit.attachedModuleInstanceIds.includes(m.instanceId));
  player.discard.push({ instanceId: unit.instanceId, defId: unit.defId });
  state.log.push(`${unit.defId} was destroyed.`);

  const def = getCardDef(unit.defId);
  if (def.type === 'unit' && def.ability?.trigger === 'onDeath') {
    resolveEffects(state, def.ability.effects, { controllerId: ownerId, selfInstanceId: instanceId });
  }

  // Captain passive hook: Mira pings the enemy Captain whenever one of her units dies.
  const captainDef = getCardDef(player.captain.defId);
  if (captainDef.type === 'captain' && captainDef.defId === 'captain_mira_kessler_voss') {
    damageCaptain(state, opponentOf(ownerId), 1);
  }
}

export function damageCaptain(state: GameState, playerId: PlayerId, amount: number): void {
  const captain = state.players[playerId].captain;
  captain.hull -= amount;
  state.log.push(`${playerId}'s Captain takes ${amount} damage (${Math.max(captain.hull, 0)} Hull left).`);
  if (captain.hull <= 0 && state.winnerId === null) {
    state.winnerId = opponentOf(playerId);
    state.phase = 'gameOver';
    state.log.push(`${state.winnerId} wins!`);
  }
}

export function healUnit(unit: UnitInstance, amount: number): void {
  unit.hull = Math.min(unit.maxHull, unit.hull + amount);
}

export function drawCard(state: GameState, playerId: PlayerId): void {
  const player = state.players[playerId];
  const card = player.deck.shift();
  if (!card) {
    player.fatigueCounter += 1;
    damageCaptain(state, playerId, player.fatigueCounter);
    return;
  }
  player.hand.push(card);
}

function resolveTargetUnit(state: GameState, controllerId: PlayerId, target: 'enemyUnit' | 'friendlyUnit', chosenTargetInstanceId?: string) {
  if (!chosenTargetInstanceId) return undefined;
  const found = findUnit(state, chosenTargetInstanceId);
  if (!found) return undefined;
  const expectedOwner = target === 'enemyUnit' ? opponentOf(controllerId) : controllerId;
  if (found.ownerId !== expectedOwner) return undefined;
  return found;
}

export function resolveEffects(state: GameState, effects: EffectDef[], ctx: EffectContext): void {
  for (const effect of effects) {
    resolveEffect(state, effect, ctx);
  }
}

function resolveEffect(state: GameState, effect: EffectDef, ctx: EffectContext): void {
  const { controllerId } = ctx;
  switch (effect.kind) {
    case 'damage': {
      if (effect.target === 'enemyCaptain') {
        damageCaptain(state, opponentOf(controllerId), effect.amount);
      } else if (effect.target === 'friendlyCaptain') {
        damageCaptain(state, controllerId, effect.amount);
      } else if (effect.target === 'enemyUnit' || effect.target === 'friendlyUnit') {
        const found = resolveTargetUnit(state, controllerId, effect.target, ctx.chosenTargetInstanceId);
        if (found) damageUnit(state, found.ownerId, found.unit, effect.amount);
      } else if (effect.target === 'self' && ctx.selfInstanceId) {
        const found = findUnit(state, ctx.selfInstanceId);
        if (found) damageUnit(state, found.ownerId, found.unit, effect.amount);
      }
      break;
    }
    case 'heal': {
      if (effect.target === 'friendlyUnit' || effect.target === 'enemyUnit') {
        const found = resolveTargetUnit(state, controllerId, effect.target, ctx.chosenTargetInstanceId);
        if (found) healUnit(found.unit, effect.amount);
      } else if (effect.target === 'self' && ctx.selfInstanceId) {
        const found = findUnit(state, ctx.selfInstanceId);
        if (found) healUnit(found.unit, effect.amount);
      }
      break;
    }
    case 'buff': {
      let found: { unit: UnitInstance; ownerId: PlayerId } | undefined;
      if (effect.target === 'self' && ctx.selfInstanceId) found = findUnit(state, ctx.selfInstanceId);
      else if (effect.target === 'friendlyUnit' || effect.target === 'enemyUnit') found = resolveTargetUnit(state, controllerId, effect.target, ctx.chosenTargetInstanceId);
      if (found) {
        found.unit.attack += effect.attack ?? 0;
        found.unit.maxHull += effect.hull ?? 0;
        found.unit.hull += effect.hull ?? 0;
        found.unit.shields += effect.shields ?? 0;
      }
      break;
    }
    case 'grantKeyword': {
      let found: { unit: UnitInstance; ownerId: PlayerId } | undefined;
      if (effect.target === 'self' && ctx.selfInstanceId) found = findUnit(state, ctx.selfInstanceId);
      else if (effect.target === 'friendlyUnit' || effect.target === 'enemyUnit') found = resolveTargetUnit(state, controllerId, effect.target, ctx.chosenTargetInstanceId);
      if (found && !found.unit.keywords.includes(effect.keyword)) found.unit.keywords.push(effect.keyword);
      break;
    }
    case 'draw': {
      drawCard(state, controllerId);
      break;
    }
    case 'gainRP': {
      state.players[controllerId].rp += effect.amount;
      break;
    }
    case 'damageOwnCaptain': {
      damageCaptain(state, controllerId, effect.amount);
      break;
    }
    default:
      break;
  }
}

export function makeUnitInstance(defId: string, ownerId: PlayerId): UnitInstance {
  const def = getCardDef(defId);
  if (def.type !== 'unit') throw new Error(`${defId} is not a unit card`);
  return {
    instanceId: nextInstanceId('unit'),
    defId,
    ownerId,
    attack: def.attack,
    hull: def.hull,
    maxHull: def.hull,
    shields: def.shields,
    keywords: [...def.keywords],
    attachedModuleInstanceIds: [],
    canAttack: def.keywords.includes('rapidDeploy'),
    hasAttackedThisTurn: false,
    cloakedUntilAttacks: def.keywords.includes('cloak'),
  };
}

export function makeModuleInstance(defId: string, hostInstanceId: string): ModuleInstance {
  return { instanceId: nextInstanceId('module'), defId, hostInstanceId };
}
