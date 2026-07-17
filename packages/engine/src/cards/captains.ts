import type { CaptainCardDef } from '../types.js';

// Captain passives (Aldric's +1 Hull on deploy, Mira's retaliation ping) are hardcoded engine
// hooks keyed by defId — see engine.ts `applyCaptainPassiveOn*`. Only 2 captains ship with the
// MVP, so a tiny special-cased hook table is far simpler than a generic passive-effect DSL.
export const CAPTAIN_CARDS: CaptainCardDef[] = [
  {
    type: 'captain',
    defId: 'captain_aldric_kessler',
    name: 'Aldric Kessler',
    faction: 'kessler',
    hull: 25,
    passiveDescription: 'Whenever you deploy a friendly unit, it enters with +1 Hull.',
    commandAbility: {
      cost: 3,
      description: 'Restore 4 Hull to a friendly unit.',
      effects: [{ kind: 'heal', amount: 4, target: 'friendlyUnit' }],
    },
    flavor: "Third son, first to bury his mother, last to believe it was an accident.",
  },
  {
    type: 'captain',
    defId: 'captain_mira_kessler_voss',
    name: 'Mira Kessler-Voss',
    faction: 'voss',
    hull: 25,
    passiveDescription: 'Whenever a friendly unit is destroyed, deal 1 damage to the enemy Captain.',
    commandAbility: {
      cost: 2,
      description: 'Deal 3 damage to an enemy unit. Deal 1 damage to your own Captain.',
      effects: [
        { kind: 'damage', amount: 3, target: 'enemyUnit' },
        { kind: 'damageOwnCaptain', amount: 1 },
      ],
    },
    flavor: 'She took her mother\'s fleet instead of her father\'s name.',
  },
];
