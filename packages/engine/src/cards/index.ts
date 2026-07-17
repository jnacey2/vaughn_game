import type { CardDef, CaptainCardDef } from '../types.js';
import { KESSLER_CARDS } from './kessler.js';
import { VOSS_CARDS } from './voss.js';
import { CAPTAIN_CARDS } from './captains.js';

export { KESSLER_CARDS } from './kessler.js';
export { VOSS_CARDS } from './voss.js';
export { CAPTAIN_CARDS } from './captains.js';

export const ALL_CARDS: CardDef[] = [...KESSLER_CARDS, ...VOSS_CARDS, ...CAPTAIN_CARDS];

const CARD_BY_ID: Map<string, CardDef> = new Map(ALL_CARDS.map((c) => [c.defId, c]));

export function getCardDef(defId: string): CardDef {
  const card = CARD_BY_ID.get(defId);
  if (!card) throw new Error(`Unknown card defId: ${defId}`);
  return card;
}

export function getCaptainDef(defId: string): CaptainCardDef {
  const card = getCardDef(defId);
  if (card.type !== 'captain') throw new Error(`Card ${defId} is not a captain`);
  return card;
}

export interface StarterDeck {
  faction: 'kessler' | 'voss';
  captainDefId: string;
  cardDefIds: string[]; // 30 entries, 2 copies of each of the 15 unique non-captain cards
}

export const STARTER_DECKS: Record<'kessler' | 'voss', StarterDeck> = {
  kessler: {
    faction: 'kessler',
    captainDefId: 'captain_aldric_kessler',
    cardDefIds: KESSLER_CARDS.flatMap((c) => [c.defId, c.defId]),
  },
  voss: {
    faction: 'voss',
    captainDefId: 'captain_mira_kessler_voss',
    cardDefIds: VOSS_CARDS.flatMap((c) => [c.defId, c.defId]),
  },
};
