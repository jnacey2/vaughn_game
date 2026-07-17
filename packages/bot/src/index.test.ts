import { describe, expect, it } from 'vitest';
import { applyAction, createMatch, isGameOver, STARTER_DECKS, type GameState, type PlayerId } from '@void-dynasty/engine';
import { chooseNextAction } from './index.js';

function simulateFullBotVsBotMatch(seed: number): GameState {
  let rngState = seed;
  const rng = () => {
    rngState = (rngState * 9301 + 49297) % 233280;
    return rngState / 233280;
  };
  let state = createMatch({ playerDeck: STARTER_DECKS.kessler, opponentDeck: STARTER_DECKS.voss, rng });

  let safety = 0;
  while (!isGameOver(state) && safety < 5000) {
    safety += 1;
    const activeId: PlayerId = state.activePlayerId;
    const action = chooseNextAction(state, activeId);
    state = applyAction(state, action);
  }
  return state;
}

describe('bot vs bot simulation', () => {
  it('always terminates with a winner within a reasonable number of actions', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const finalState = simulateFullBotVsBotMatch(seed);
      expect(isGameOver(finalState)).toBe(true);
      expect(['player', 'opponent']).toContain(finalState.winnerId);
    }
  });
});
