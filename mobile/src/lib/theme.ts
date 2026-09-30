/**
 * Foster Famous design tokens.
 *
 * These mirror the values in tailwind.config.js. Use the Tailwind classes
 * (bg-cream, text-forest, etc.) for View/Text and these raw values for
 * components that don't support className (LinearGradient, icons, navigators).
 */
export const colors = {
  cream: '#FBF5E9',
  creamDeep: '#F6EEDD',
  beige: '#F0E4CE',
  beigeDark: '#E6D6B8',
  forest: '#14432A',
  forestDeep: '#0B2A1A',
  forestMid: '#1F5D3A',
  forestSoft: '#DDE8DE',
  clay: '#E1712B',
  clayDeep: '#C25A1B',
  claySoft: '#FBE3CE',
  ink: '#1D1B17',
  inkSoft: '#4A463D',
  inkMuted: '#847C6C',
  hairline: '#E5D8C0',
  white: '#FFFFFF',
} as const;

export const fonts = {
  display: 'Fraunces_700Bold',
  displaySemi: 'Fraunces_600SemiBold',
  regular: 'Nunito_400Regular',
  medium: 'Nunito_500Medium',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
} as const;

/** Soft, diffused card shadow used across the app. */
export const softShadow = {
  shadowColor: '#5A4A2E',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.08,
  shadowRadius: 16,
  elevation: 3,
} as const;

export const liftedShadow = {
  shadowColor: '#3A2E18',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.14,
  shadowRadius: 24,
  elevation: 6,
} as const;
