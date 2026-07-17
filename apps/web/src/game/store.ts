import { create } from 'zustand';
import {
  applyAction,
  createMatch,
  getLegalActions,
  isGameOver,
  opponentOf,
  STARTER_DECKS,
  type Action,
  type Faction,
  type GameState,
  type PlayerId,
} from '@void-dynasty/engine';
import { chooseNextAction, type Difficulty } from '@void-dynasty/bot';

export type { Difficulty } from '@void-dynasty/bot';

export type Screen = 'deckSelect' | 'rollingForFirst' | 'match' | 'gameOver';

/** How long the "rolling for initiative" screen stays up before the match board appears. */
export const ROLL_ANIMATION_MS = 2200;

export function actionTargetId(action: Action): string | undefined {
  if (action.type === 'playModule') return action.hostInstanceId;
  if (action.type === 'playUnit' || action.type === 'playOrder' || action.type === 'useCaptainAbility') return action.targetInstanceId;
  if (action.type === 'attack') return action.targetInstanceId;
  return undefined;
}

interface PendingSelection {
  /** id used purely so the UI can highlight the thing the player clicked first */
  sourceId: string;
  actions: Action[];
}

export interface CombatEvent {
  attackerInstanceId: string;
  targetId: string; // unit instance id, or 'captain'
  attackerOwnerId: PlayerId;
  targetOwnerId: PlayerId;
  ts: number;
}

const BOT_STEP_DELAY_MS = 550;

function combatEventFor(state: GameState, action: Action): CombatEvent | null {
  if (action.type !== 'attack') return null;
  const attacker = state.players[state.activePlayerId].bays.find((u) => u.instanceId === action.attackerInstanceId);
  if (!attacker) return null;
  return {
    attackerInstanceId: action.attackerInstanceId,
    targetId: action.targetInstanceId,
    attackerOwnerId: attacker.ownerId,
    targetOwnerId: opponentOf(attacker.ownerId),
    ts: Date.now(),
  };
}

interface StoreState {
  screen: Screen;
  state: GameState | null;
  playerFaction: Faction | null;
  difficulty: Difficulty;
  pending: PendingSelection | null;
  botThinking: boolean;
  lastLogIndex: number;
  combatEvent: CombatEvent | null;

  startMatch: (faction: Faction, difficulty: Difficulty) => void;
  rematch: () => void;
  backToDeckSelect: () => void;
  selectSource: (sourceId: string, actions: Action[]) => void;
  selectTarget: (targetId: string) => void;
  cancelPending: () => void;
  endTurn: () => void;
  dispatch: (action: Action) => void;
  runBotTurnIfNeeded: () => void;
}

export const useGameStore = create<StoreState>((set, get) => ({
  screen: 'deckSelect',
  state: null,
  playerFaction: null,
  difficulty: 'normal',
  pending: null,
  botThinking: false,
  lastLogIndex: 0,
  combatEvent: null,

  startMatch: (faction, difficulty) => {
    const opponentFaction: Faction = faction === 'kessler' ? 'voss' : 'kessler';
    const firstPlayerId = Math.random() < 0.5 ? 'player' : 'opponent';
    const state = createMatch({
      playerDeck: STARTER_DECKS[faction],
      opponentDeck: STARTER_DECKS[opponentFaction],
      firstPlayerId,
    });
    // The roll's outcome is already decided above; the "rollingForFirst" screen just dramatizes
    // it for a beat before the board takes over.
    set({
      screen: 'rollingForFirst',
      state,
      playerFaction: faction,
      difficulty,
      pending: null,
      lastLogIndex: state.log.length,
      botThinking: false,
      combatEvent: null,
    });
    setTimeout(() => {
      if (get().screen !== 'rollingForFirst') return;
      set({ screen: 'match' });
      get().runBotTurnIfNeeded();
    }, ROLL_ANIMATION_MS);
  },

  rematch: () => {
    const faction = get().playerFaction;
    const difficulty = get().difficulty;
    if (faction) get().startMatch(faction, difficulty);
  },

  backToDeckSelect: () => set({ screen: 'deckSelect', state: null, playerFaction: null, pending: null }),

  selectSource: (sourceId, actions) => {
    if (actions.length === 0) return;
    if (actions.length === 1) {
      get().dispatch(actions[0]);
      return;
    }
    set({ pending: { sourceId, actions } });
  },

  selectTarget: (targetId) => {
    const pending = get().pending;
    if (!pending) return;
    const action = pending.actions.find((a) => actionTargetId(a) === targetId);
    if (!action) return;
    set({ pending: null });
    get().dispatch(action);
  },

  cancelPending: () => set({ pending: null }),

  endTurn: () => get().dispatch({ type: 'endTurn' }),

  dispatch: (action) => {
    const current = get().state;
    if (!current || current.activePlayerId !== 'player') return;
    const combatEvent = combatEventFor(current, action);
    const next = applyAction(current, action);
    set({ state: next, lastLogIndex: current.log.length, pending: null, ...(combatEvent ? { combatEvent } : {}) });
    if (isGameOver(next)) {
      set({ screen: 'gameOver' });
      return;
    }
    get().runBotTurnIfNeeded();
  },

  runBotTurnIfNeeded: () => {
    const state = get().state;
    if (!state || isGameOver(state) || state.activePlayerId !== 'opponent') return;
    set({ botThinking: true });
    setTimeout(() => {
      const current = get().state;
      if (!current || current.activePlayerId !== 'opponent' || isGameOver(current)) {
        set({ botThinking: false });
        return;
      }
      const action = chooseNextAction(current, 'opponent', get().difficulty);
      const combatEvent = combatEventFor(current, action);
      const next = applyAction(current, action);
      set({ state: next, lastLogIndex: current.log.length, ...(combatEvent ? { combatEvent } : {}) });
      if (isGameOver(next)) {
        set({ screen: 'gameOver', botThinking: false });
        return;
      }
      if (next.activePlayerId === 'opponent') {
        get().runBotTurnIfNeeded();
      } else {
        set({ botThinking: false });
      }
    }, BOT_STEP_DELAY_MS);
  },
}));

export function legalActionsFor(state: GameState) {
  return getLegalActions(state, 'player');
}
