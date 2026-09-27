// Design tokens compartidos por apps/customer, apps/staff y apps/owner.
// Son los mismos valores que la landing (apps/landing/styles.css) y que
// web-sabor-sazon.vercel.app: fondo casi negro, acento dorado y la bandera.

export const colors = {
  // Bandera (barra superior)
  amarillo: '#f4d03f',
  azul: '#2980b9',
  rojo: '#e74c3c',

  // Acento principal: botones, precios, títulos de categoría
  acento: '#f5c453',
  sobreAcento: '#000000', // texto encima del acento
  negro: '#000000',

  background: '#09090b',
  surface: '#141416',
  surfaceAlt: '#1d1d20',
  border: '#1f1f23',
  borderStrong: '#2f2f33',
  textPrimary: '#f4f4f5',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',

  success: '#22c55e',
  whatsapp: '#22c55e',
  warning: '#f5c453',
  danger: '#e74c3c',
  cerrado: '#8b1d1d', // banner de local cerrado
} as const;

// Acento con transparencia (fondos de etiquetas y badges).
export function acentoAlpha(alpha: number) {
  return `rgba(245, 196, 83, ${alpha})`;
}

export const fonts = {
  light: 'Poppins_300Light',
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const },
  h2: { fontSize: 22, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
};

export const theme = { colors, fonts, spacing, radii, typography };
export type Theme = typeof theme;
