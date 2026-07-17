// Hero cards (Captains + flagship Dreadnoughts) get bespoke illustrated art, served from
// public/art so the build doesn't need the files to exist at bundle-analysis time. Every
// other card in the MVP starter sets uses a generated procedural placeholder (see
// CardArt.tsx) — swapping in real illustrations later is just a matter of adding an entry
// here and dropping the image into public/art.
export const CARD_ART: Record<string, string> = {
  captain_aldric_kessler: '/art/captain-aldric.webp',
  captain_mira_kessler_voss: '/art/captain-mira.webp',
  kessler_dreadnought_prime: '/art/kessler-dreadnought.webp',
  voss_unbroken_current_prime: '/art/voss-flagship.webp',
  kessler_bastion_cruiser: '/art/kessler-bastion.webp',
  voss_ionstorm_frigate: '/art/voss-ionstorm.webp',
};

export function getCardArtUrl(defId: string): string | undefined {
  return CARD_ART[defId];
}
