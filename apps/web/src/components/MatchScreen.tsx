import { useMemo } from 'react';
import { getCardDef, getLegalActions, opponentOf, type CardInDeck, type UnitInstance } from '@void-dynasty/engine';
import { DIFFICULTY_LABELS } from '@void-dynasty/bot';
import { actionTargetId, useGameStore } from '../game/store';
import { HOUSE_THEME } from '../game/houseTheme';
import { useFlash } from '../game/useFlash';
import { BoardRow } from './BoardRow';
import { HandView } from './HandView';
import { CaptainPanel } from './CaptainPanel';
import './MatchScreen.css';

export function MatchScreen() {
  const state = useGameStore((s) => s.state);
  const difficulty = useGameStore((s) => s.difficulty);
  const pending = useGameStore((s) => s.pending);
  const combatEvent = useGameStore((s) => s.combatEvent);
  const botThinking = useGameStore((s) => s.botThinking);
  const selectSource = useGameStore((s) => s.selectSource);
  const selectTarget = useGameStore((s) => s.selectTarget);
  const cancelPending = useGameStore((s) => s.cancelPending);
  const endTurn = useGameStore((s) => s.endTurn);

  const legalActions = useMemo(() => (state ? getLegalActions(state, 'player') : []), [state]);

  const enemyId = opponentOf('player');
  const enemyCaptainHitTs = combatEvent && combatEvent.targetId === 'captain' && combatEvent.targetOwnerId === enemyId ? combatEvent.ts : undefined;
  const myCaptainHitTs = combatEvent && combatEvent.targetId === 'captain' && combatEvent.targetOwnerId === 'player' ? combatEvent.ts : undefined;
  const enemyCaptainHit = useFlash(enemyCaptainHitTs);
  const myCaptainHit = useFlash(myCaptainHitTs);

  if (!state) return null;

  const me = state.players.player;
  const enemy = state.players[enemyId];
  const myTheme = HOUSE_THEME[getCardDef(me.captain.defId).faction as 'kessler' | 'voss'];
  const isMyTurn = state.activePlayerId === 'player' && !botThinking;

  const pendingTargetIds = new Set((pending?.actions ?? []).map(actionTargetId).filter((v): v is string => v !== undefined));
  const enemyCaptainTargetable = (pending?.actions ?? []).some((a) => a.type === 'attack' && a.targetInstanceId === 'captain');

  const playableHandCardIds = new Set(
    me.hand
      .filter((card) => legalActions.some((a) => (a.type === 'playUnit' || a.type === 'playModule' || a.type === 'playOrder') && a.cardInstanceId === card.instanceId))
      .map((c) => c.instanceId),
  );
  const attackableUnitIds = new Set(
    me.bays.filter((u) => legalActions.some((a) => a.type === 'attack' && a.attackerInstanceId === u.instanceId)).map((u) => u.instanceId),
  );
  const captainAbilityActions = legalActions.filter((a) => a.type === 'useCaptainAbility');

  function handleHandCardClick(card: CardInDeck) {
    if (!isMyTurn) return;
    if (pending?.sourceId === card.instanceId) {
      cancelPending();
      return;
    }
    const matching = legalActions.filter(
      (a) => (a.type === 'playUnit' || a.type === 'playModule' || a.type === 'playOrder') && a.cardInstanceId === card.instanceId,
    );
    selectSource(card.instanceId, matching);
  }

  function handleFriendlyUnitClick(unit: UnitInstance) {
    if (!isMyTurn) return;
    if (pending) {
      if (pending.sourceId === unit.instanceId) {
        cancelPending();
        return;
      }
      if (pendingTargetIds.has(unit.instanceId)) {
        selectTarget(unit.instanceId);
        return;
      }
      cancelPending();
      return;
    }
    const attackActions = legalActions.filter((a) => a.type === 'attack' && a.attackerInstanceId === unit.instanceId);
    if (attackActions.length > 0) selectSource(unit.instanceId, attackActions);
  }

  function handleEnemyUnitClick(unit: UnitInstance) {
    if (!isMyTurn || !pending) return;
    if (pendingTargetIds.has(unit.instanceId)) selectTarget(unit.instanceId);
    else cancelPending();
  }

  function handleEnemyCaptainClick() {
    if (!isMyTurn || !pending) return;
    if (enemyCaptainTargetable) selectTarget('captain');
    else cancelPending();
  }

  function handleCaptainAbilityClick() {
    if (!isMyTurn) return;
    if (pending?.sourceId === 'captainAbility') {
      cancelPending();
      return;
    }
    selectSource('captainAbility', captainAbilityActions);
  }

  return (
    <div className="match-screen" style={{ background: myTheme.gradient }} onClick={() => pending && cancelPending()}>
      <div className="match-screen__topbar">
        <div className="match-screen__turn-indicator">
          Turn {state.turn} — {isMyTurn ? 'Your move' : botThinking ? "Opponent's fleet is maneuvering…" : "Opponent's move"}
          <span className="match-screen__difficulty-badge">{DIFFICULTY_LABELS[difficulty]}</span>
        </div>
        <div className="match-screen__log" onClick={(e) => e.stopPropagation()}>
          {state.log.slice(-4).map((line, i) => (
            <div key={state.log.length - 4 + i} className="match-screen__log-line">
              {line}
            </div>
          ))}
        </div>
      </div>

      <div className="match-screen__enemy-header" onClick={(e) => e.stopPropagation()}>
        <CaptainPanel captain={enemy.captain} side="enemy" clickableAsTarget={enemyCaptainTargetable} highlighted={enemyCaptainTargetable} onClick={handleEnemyCaptainClick} recentlyHit={enemyCaptainHit} />
        <div className="match-screen__rp">
          Reactor Power: {enemy.rp}/{enemy.rpCap}
        </div>
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        <BoardRow
          units={enemy.bays}
          emptySlots={Math.max(0, 5 - enemy.bays.length)}
          side="enemy"
          highlightedIds={pendingTargetIds}
          playableIds={new Set()}
          combatEvent={combatEvent}
          onUnitClick={handleEnemyUnitClick}
        />
      </div>

      <div className="match-screen__divider" />

      <div onClick={(e) => e.stopPropagation()}>
        <BoardRow
          units={me.bays}
          emptySlots={Math.max(0, 5 - me.bays.length)}
          side="player"
          highlightedIds={pendingTargetIds}
          selectedId={pending?.sourceId}
          playableIds={attackableUnitIds}
          combatEvent={combatEvent}
          onUnitClick={handleFriendlyUnitClick}
        />
      </div>

      <div className="match-screen__player-footer" onClick={(e) => e.stopPropagation()}>
        <CaptainPanel captain={me.captain} side="player" onClick={undefined} recentlyHit={myCaptainHit} />
        <button
          type="button"
          className={`match-screen__ability-btn ${pending?.sourceId === 'captainAbility' ? 'match-screen__ability-btn--selected' : ''}`}
          disabled={!isMyTurn || captainAbilityActions.length === 0}
          onClick={handleCaptainAbilityClick}
        >
          Command Ability{me.captain.commandAbilityUsedThisTurn ? ' (used)' : ''}
        </button>
        <div className="match-screen__rp">
          Reactor Power: {me.rp}/{me.rpCap}
        </div>
        <button type="button" className="match-screen__end-turn" disabled={!isMyTurn} onClick={() => { cancelPending(); endTurn(); }}>
          End Turn
        </button>
      </div>

      <div className="match-screen__hand" onClick={(e) => e.stopPropagation()}>
        <HandView hand={me.hand} playableIds={isMyTurn ? playableHandCardIds : new Set()} selectedId={pending?.sourceId} onCardClick={handleHandCardClick} />
      </div>
    </div>
  );
}
