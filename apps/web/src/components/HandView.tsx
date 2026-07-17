import { AnimatePresence, motion } from 'framer-motion';
import type { CardInDeck } from '@void-dynasty/engine';
import { CardView } from './CardView';
import './HandView.css';

export interface HandViewProps {
  hand: CardInDeck[];
  playableIds: Set<string>;
  selectedId?: string;
  onCardClick: (card: CardInDeck) => void;
}

export function HandView({ hand, playableIds, selectedId, onCardClick }: HandViewProps) {
  return (
    <div className="hand-view">
      <AnimatePresence mode="popLayout">
        {hand.map((card, i) => {
          const mid = (hand.length - 1) / 2;
          const rotate = (i - mid) * 3.5;
          const rise = -Math.abs(i - mid) * 3;
          return (
            <motion.div
              key={card.instanceId}
              layout
              initial={{ opacity: 0, y: 60, scale: 0.6 }}
              animate={{ opacity: 1, y: rise, scale: 1, rotate }}
              exit={{ opacity: 0, y: -80, scale: 0.6, transition: { duration: 0.3 } }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              className="hand-view__card"
              style={{ zIndex: i }}
            >
              <CardView
                defId={card.defId}
                size="hand"
                playable={playableIds.has(card.instanceId)}
                selected={selectedId === card.instanceId}
                faded={!playableIds.has(card.instanceId) && selectedId !== card.instanceId}
                onClick={() => onCardClick(card)}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
