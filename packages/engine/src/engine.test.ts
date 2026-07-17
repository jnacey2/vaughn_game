import { describe, expect, it } from 'vitest';
import { applyAction } from './engine.js';
import { createMatch } from './state.js';
import { STARTER_DECKS } from './cards/index.js';
import type { GameState } from './types.js';

function newMatch(): GameState {
  return createMatch({ playerDeck: STARTER_DECKS.kessler, opponentDeck: STARTER_DECKS.voss, rng: () => 0.5 });
}

describe('createMatch', () => {
  it('deals opening hands and RP correctly', () => {
    const state = newMatch();
    expect(state.players.player.hand).toHaveLength(3);
    expect(state.players.opponent.hand).toHaveLength(4);
    expect(state.players.player.rp).toBe(1);
    expect(state.players.player.rpCap).toBe(1);
    expect(state.players.player.captain.hull).toBe(25);
    expect(state.activePlayerId).toBe('player');
  });
});

describe('endTurn', () => {
  it('advances RP cap, refills RP, and draws a card for the new active player', () => {
    let state = newMatch();
    const opponentHandBefore = state.players.opponent.hand.length;
    state = applyAction(state, { type: 'endTurn' });
    expect(state.activePlayerId).toBe('opponent');
    expect(state.players.opponent.rpCap).toBe(1);
    expect(state.players.opponent.rp).toBe(1);
    expect(state.players.opponent.hand.length).toBe(opponentHandBefore + 1);
  });

  it('caps RP growth at 10', () => {
    let state = newMatch();
    for (let i = 0; i < 25; i += 1) {
      state = applyAction(state, { type: 'endTurn' });
    }
    expect(state.players.player.rpCap).toBeLessThanOrEqual(10);
    expect(state.players.opponent.rpCap).toBeLessThanOrEqual(10);
  });
});

describe('playing a unit', () => {
  it('deploys a Mining Drone into a bay, spending RP, with Aldric passive +1 Hull', () => {
    let state = newMatch();
    state.players.player.hand = [{ instanceId: 'c1', defId: 'kessler_mining_drone' }];
    state.players.player.rp = 1;
    state = applyAction(state, { type: 'playUnit', cardInstanceId: 'c1' });
    expect(state.players.player.bays).toHaveLength(1);
    expect(state.players.player.bays[0].hull).toBe(4); // 3 base + 1 from Aldric's passive
    expect(state.players.player.rp).toBe(0);
    expect(state.players.player.hand).toHaveLength(0);
  });

  it('rejects playing a card that is not affordable', () => {
    let state = newMatch();
    state.players.player.hand = [{ instanceId: 'c1', defId: 'kessler_dreadnought_prime' }];
    state.players.player.rp = 1;
    expect(() => applyAction(state, { type: 'playUnit', cardInstanceId: 'c1' })).toThrow();
  });
});

describe('combat', () => {
  it('resolves mutual damage between two attacking units and destroys the loser', () => {
    let state = newMatch();
    state.players.player.bays = [
      { instanceId: 'a1', defId: 'kessler_ironclad_skiff', ownerId: 'player', attack: 5, hull: 5, maxHull: 5, shields: 0, keywords: [], attachedModuleInstanceIds: [], canAttack: true, hasAttackedThisTurn: false, cloakedUntilAttacks: false },
    ];
    state.players.opponent.bays = [
      { instanceId: 'b1', defId: 'voss_static_wisp', ownerId: 'opponent', attack: 2, hull: 1, maxHull: 1, shields: 0, keywords: [], attachedModuleInstanceIds: [], canAttack: true, hasAttackedThisTurn: false, cloakedUntilAttacks: false },
    ];
    state = applyAction(state, { type: 'attack', attackerInstanceId: 'a1', targetInstanceId: 'b1' });
    expect(state.players.opponent.bays).toHaveLength(0);
    expect(state.players.player.bays[0].hull).toBe(3); // took 2 damage back
  });

  it('deals damage directly to the enemy Captain', () => {
    let state = newMatch();
    state.players.player.bays = [
      { instanceId: 'a1', defId: 'kessler_ironclad_skiff', ownerId: 'player', attack: 5, hull: 5, maxHull: 5, shields: 0, keywords: [], attachedModuleInstanceIds: [], canAttack: true, hasAttackedThisTurn: false, cloakedUntilAttacks: false },
    ];
    state = applyAction(state, { type: 'attack', attackerInstanceId: 'a1', targetInstanceId: 'captain' });
    expect(state.players.opponent.captain.hull).toBe(20);
  });

  it('forces attacks to target Bulwark units first', () => {
    let state = newMatch();
    state.players.player.bays = [
      { instanceId: 'a1', defId: 'kessler_ironclad_skiff', ownerId: 'player', attack: 5, hull: 5, maxHull: 5, shields: 0, keywords: [], attachedModuleInstanceIds: [], canAttack: true, hasAttackedThisTurn: false, cloakedUntilAttacks: false },
    ];
    state.players.opponent.bays = [
      { instanceId: 'b1', defId: 'voss_static_wisp', ownerId: 'opponent', attack: 2, hull: 1, maxHull: 1, shields: 0, keywords: [], attachedModuleInstanceIds: [], canAttack: true, hasAttackedThisTurn: false, cloakedUntilAttacks: false },
      { instanceId: 'b2', defId: 'kessler_siege_hauler', ownerId: 'opponent', attack: 3, hull: 6, maxHull: 6, shields: 2, keywords: ['bulwark'], attachedModuleInstanceIds: [], canAttack: true, hasAttackedThisTurn: false, cloakedUntilAttacks: false },
    ];
    expect(() => applyAction(state, { type: 'attack', attackerInstanceId: 'a1', targetInstanceId: 'b1' })).toThrow();
    const next = applyAction(state, { type: 'attack', attackerInstanceId: 'a1', targetInstanceId: 'b2' });
    expect(next.players.opponent.bays.find((u) => u.instanceId === 'b2')?.shields).toBe(0);
  });

  it('ends the game when a Captain reaches 0 Hull', () => {
    let state = newMatch();
    state.players.opponent.captain.hull = 5;
    state.players.player.bays = [
      { instanceId: 'a1', defId: 'kessler_dreadnought_prime', ownerId: 'player', attack: 6, hull: 10, maxHull: 10, shields: 3, keywords: ['bulwark'], attachedModuleInstanceIds: [], canAttack: true, hasAttackedThisTurn: false, cloakedUntilAttacks: false },
    ];
    state = applyAction(state, { type: 'attack', attackerInstanceId: 'a1', targetInstanceId: 'captain' });
    expect(state.phase).toBe('gameOver');
    expect(state.winnerId).toBe('player');
  });
});

describe('deck integrity', () => {
  it('starter decks are exactly 30 cards with at most 2 copies of any card', () => {
    for (const deck of Object.values(STARTER_DECKS)) {
      expect(deck.cardDefIds).toHaveLength(30);
      const counts = new Map<string, number>();
      for (const id of deck.cardDefIds) counts.set(id, (counts.get(id) ?? 0) + 1);
      for (const count of counts.values()) expect(count).toBeLessThanOrEqual(2);
    }
  });
});
