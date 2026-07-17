import type { Faction } from '@void-dynasty/engine';

export interface HouseTheme {
  label: string;
  tagline: string;
  primary: string;
  secondary: string;
  glow: string;
  gradient: string;
}

export const HOUSE_THEME: Record<Faction, HouseTheme> = {
  kessler: {
    label: 'House Kessler',
    tagline: 'The Ironbound',
    primary: '#c97a3d',
    secondary: '#4b4238',
    glow: '#f0a561',
    gradient: 'linear-gradient(160deg, #4b3a2a 0%, #2a2118 60%, #14100c 100%)',
  },
  voss: {
    label: 'House Voss',
    tagline: 'The Unbroken Current',
    primary: '#8b5cf6',
    secondary: '#22d3ee',
    glow: '#a78bfa',
    gradient: 'linear-gradient(160deg, #2c1f4d 0%, #1a1533 60%, #0d0b1a 100%)',
  },
};
