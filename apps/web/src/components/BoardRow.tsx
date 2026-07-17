import { AnimatePresence, motion } from 'framer-motion';
import type { UnitInstance } from '@void-dynasty/engine';
import { CardView } from './CardView';
import { useFlash } from '../game/useFlash';
import type { CombatEvent } from '../game/store';
import './BoardRow.css';

interface UnitSlotProps {
  unit: UnitInstance;
  highlighted: boolean;
  selected: boolean;
  playable: boolean;
  combatEvent: CombatEvent | null;
  onClick: () => void;
}

function UnitSlot({ unit, highlighted, selected, playable, combatEvent, onClick }: UnitSlotProps) {
  const relevantTs = combatEvent && (combatEvent.attackerInstanceId === unit.instanceId || combatEvent.targetId === unit.instanceId) ? combatEvent.ts : undefined;
  const isAttacker = combatEvent?.attackerInstanceId === unit.instanceId;
  const flashing = useFlash(relevantTs);

  return (
    <motion.div
      key={unit.instanceId}
      layout
      initial={{ opacity: 0, scale: 0.4, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.5, rotate: 20, transition: { duration: 0.35 } }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className={`unit-slot ${flashing ? (isAttacker ? 'unit-slot--attacking' : 'unit-slot--hit') : ''}`}
    >
      <CardView defId={unit.defId} size="board" liveUnit={unit} highlighted={highlighted} selected={selected} playable={playable} onClick={onClick} />
    </motion.div>
  );
}

export interface BoardRowProps {
  units: UnitInstance[];
  emptySlots: number;
  side: 'player' | 'enemy';
  highlightedIds: Set<string>;
  selectedId?: string;
  playableIds: Set<string>;
  combatEvent: CombatEvent | null;
  onUnitClick: (unit: UnitInstance) => void;
}

export function BoardRow({ units, emptySlots, side, highlightedIds, selectedId, playableIds, combatEvent, onUnitClick }: BoardRowProps) {
  return (
    <div className={`board-row board-row--${side}`}>
      <AnimatePresence mode="popLayout">
        {units.map((unit) => (
          <UnitSlot
            key={unit.instanceId}
            unit={unit}
            highlighted={highlightedIds.has(unit.instanceId)}
            selected={selectedId === unit.instanceId}
            playable={playableIds.has(unit.instanceId)}
            combatEvent={combatEvent}
            onClick={() => onUnitClick(unit)}
          />
        ))}
      </AnimatePresence>
      {Array.from({ length: emptySlots }).map((_, i) => (
        <div key={`empty-${i}`} className="board-row__empty-slot" />
      ))}
    </div>
  );
}
