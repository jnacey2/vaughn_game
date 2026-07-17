import { damageCaptain, damageUnit, findUnit } from './effects.js';
import { opponentOf } from './state.js';
import type { GameState, PlayerId, UnitInstance } from './types.js';

export function isTargetable(unit: UnitInstance): boolean {
  return !unit.cloakedUntilAttacks;
}

export function enemyBulwarkUnits(state: GameState, attackerOwnerId: PlayerId): UnitInstance[] {
  const enemy = state.players[opponentOf(attackerOwnerId)];
  return enemy.bays.filter((u) => u.keywords.includes('bulwark') && isTargetable(u));
}

export function legalAttackTargetIds(state: GameState, attackerOwnerId: PlayerId): string[] {
  const bulwarks = enemyBulwarkUnits(state, attackerOwnerId);
  if (bulwarks.length > 0) return bulwarks.map((u) => u.instanceId);
  const enemy = state.players[opponentOf(attackerOwnerId)];
  const unitTargets = enemy.bays.filter(isTargetable).map((u) => u.instanceId);
  return [...unitTargets, 'captain'];
}

/** Resolves one unit's attack against either another unit (mutual damage) or the enemy Captain. */
export function resolveAttack(state: GameState, attackerInstanceId: string, targetInstanceId: string | 'captain'): void {
  const found = findUnit(state, attackerInstanceId);
  if (!found) return;
  const { unit: attacker, ownerId } = found;
  const defenderOwnerId = opponentOf(ownerId);

  if (targetInstanceId === 'captain') {
    damageCaptain(state, defenderOwnerId, attacker.attack);
  } else {
    const targetFound = findUnit(state, targetInstanceId);
    if (!targetFound) return;
    const { unit: defender } = targetFound;
    // Simultaneous mutual damage, like a Hearthstone-style trade: snapshot both attack
    // values first so destroying one unit doesn't change what the other deals back.
    const attackerAttack = attacker.attack;
    const defenderAttack = defender.attack;
    const attackerHasBoarding = attacker.keywords.includes('boarding');

    damageUnit(state, defenderOwnerId, defender, attackerAttack);
    const defenderDestroyed = !state.players[defenderOwnerId].bays.some((u) => u.instanceId === targetInstanceId);
    damageUnit(state, ownerId, attacker, defenderAttack);

    if (defenderDestroyed && attackerHasBoarding) {
      damageCaptain(state, defenderOwnerId, 1);
    }
  }

  attacker.hasAttackedThisTurn = true;
  if (attacker.cloakedUntilAttacks) attacker.cloakedUntilAttacks = false;
}
