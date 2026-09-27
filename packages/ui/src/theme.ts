// Design tokens compartidos por apps/customer, apps/staff y apps/owner.
// Fondo oscuro, letras claras — paleta oficial de Sabor y Sazón.

export const colors = {
  amarillo: '#FFDA3D',
  azul: '#3676FF',
  rojo: '#FF4A4A',
  dorado: '#F2B22C',
  negro: '#1F1E1E',

  background: '#1F1E1E',
  surface: '#2A2929',
  textPrimary: '#FFFFFF',
  textSecondary: '#C9C9C9',

  success: '#3DBE64',
  warning: '#F2B22C',
  danger: '#FF4A4A',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radii = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const typography = {
  fontFamily: 'System',
  h1: { fontSize: 28, fontWeight: '700' as const },
  h2: { fontSize: 22, fontWeight: '700' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
};

export const theme = { colors, spacing, radii, typography };
export type Theme = typeof theme;
