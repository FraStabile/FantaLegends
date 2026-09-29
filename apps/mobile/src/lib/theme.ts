import { Platform } from 'react-native';

/** Asta Legends design tokens — dark-first, black / deep navy / white with a gold accent. */
export const C = {
  bg: '#05070D',
  bgElevated: '#0B1220',
  card: '#101A2E',
  cardHigh: '#16233D',
  border: '#1F2E4D',
  borderStrong: '#2C4170',
  text: '#F5F7FB',
  textDim: '#9AA6BF',
  textMute: '#5F6B85',
  gold: '#D4AF37',
  goldBright: '#F2CE5C',
  goldDeep: '#8C6D1A',
  blue: '#3B82F6',
  green: '#22C55E',
  red: '#EF4444',
  orange: '#F97316',
  purple: '#A855F7',
  cyan: '#06B6D4',
  overlay: 'rgba(3,5,10,0.86)',
} as const;

export const RARITY_COLORS = {
  common: '#9AA6BF',
  rare: '#3B82F6',
  epic: '#A855F7',
  legendary: '#D4AF37',
} as const;

export const SLOT_COLORS = { GK: '#F97316', DF: '#3B82F6', MF: '#22C55E', FW: '#EF4444', COACH: '#D4AF37' } as const;

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const R = { sm: 8, md: 14, lg: 20, pill: 999 } as const;

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, Menlo, monospace' });

export const T = {
  hero: { fontSize: 44, fontWeight: '900' as const, color: C.text, letterSpacing: -1 },
  h1: { fontSize: 28, fontWeight: '900' as const, color: C.text, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '800' as const, color: C.text },
  h3: { fontSize: 16, fontWeight: '800' as const, color: C.text },
  body: { fontSize: 15, fontWeight: '500' as const, color: C.text },
  small: { fontSize: 13, fontWeight: '500' as const, color: C.textDim },
  tiny: { fontSize: 11, fontWeight: '700' as const, color: C.textMute, letterSpacing: 1, textTransform: 'uppercase' as const },
  number: { fontVariant: ['tabular-nums' as const], fontFamily: mono },
};
