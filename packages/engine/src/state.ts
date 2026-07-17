import { getCaptainDef, type StarterDeck } from './cards/index.js';
import { nextInstanceId, shuffle } from './ids.js';
import type { CardInDeck, GameState, PlayerId, PlayerState } from './types.js';

export interface CreateMatchOptions {
  playerDeck: StarterDeck;
  opponentDeck: StarterDeck;
  /** Injectable RNG for deterministic tests. Defaults to Math.random. */
  rng?: () => number;
  /** Which player goes first. Defaults to 'player'. */
  firstPlayerId?: PlayerId;
}

function buildPlayerState(id: PlayerId, deckDef: StarterDeck, rng: () => number, openingHandSize: number): PlayerState {
  const captainDef = getCaptainDef(deckDef.captainDefId);
  const shuffledDeck: CardInDeck[] = shuffle(
    deckDef.cardDefIds.map((defId) => ({ instanceId: nextInstanceId('card'), defId })),
    rng,
  );
  const hand = shuffledDeck.splice(0, openingHandSize);
  return {
    id,
    captain: {
      defId: captainDef.defId,
      hull: captainDef.hull,
      maxHull: captainDef.hull,
      commandAbilityUsedThisTurn: false,
    },
    deck: shuffledDeck,
    hand,
    discard: [],
    bays: [],
    modules: [],
    rpCap: 0,
    rp: 0,
    fatigueCounter: 0,
  };
}

export function createMatch(options: CreateMatchOptions): GameState {
  const rng = options.rng ?? Math.random;
  const firstPlayerId = options.firstPlayerId ?? 'player';
  const secondPlayerId: PlayerId = firstPlayerId === 'player' ? 'opponent' : 'player';

  const first = buildPlayerState(firstPlayerId, firstPlayerId === 'player' ? options.playerDeck : options.opponentDeck, rng, 3);
  const second = buildPlayerState(secondPlayerId, secondPlayerId === 'player' ? options.playerDeck : options.opponentDeck, rng, 4);

  // "Emergency Thrusters": going second grants +1 RP on your very first turn to offset going second.
  const state: GameState = {
    turn: 1,
    activePlayerId: firstPlayerId,
    phase: 'main',
    players: { [firstPlayerId]: first, [secondPlayerId]: second } as Record<PlayerId, PlayerState>,
    winnerId: null,
    log: [`${firstPlayerId === 'player' ? 'You' : 'The opponent'} go first.`],
  };

  // Start-of-game start phase for the first player only (draw is skipped on the very first turn).
  const activePlayer = state.players[firstPlayerId];
  activePlayer.rpCap = 1;
  activePlayer.rp = 1;

  return state;
}

export function opponentOf(id: PlayerId): PlayerId {
  return id === 'player' ? 'opponent' : 'player';
}
