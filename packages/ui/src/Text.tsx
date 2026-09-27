import { StyleSheet, Text as RNText, TextInput as RNTextInput, type TextInputProps, type TextProps, type TextStyle } from 'react-native';
import { forwardRef } from 'react';

import { fonts } from './theme';

// Poppins viene en un archivo por peso, y en Android `fontWeight` no elige
// entre ellos: hay que pasar la familia exacta. Estos componentes traducen el
// `fontWeight` del estilo a la familia de Poppins correspondiente, así las
// pantallas siguen escribiendo `fontWeight: '700'` como siempre.
function familiaPara(peso: TextStyle['fontWeight']): string {
  switch (String(peso ?? '400')) {
    case '100':
    case '200':
    case '300':
    case 'light':
      return fonts.light;
    case '500':
    case 'medium':
      return fonts.medium;
    case '600':
    case 'semibold':
      return fonts.semibold;
    case '700':
    case '800':
    case '900':
    case 'bold':
      return fonts.bold;
    default:
      return fonts.regular;
  }
}

function conPoppins(style: TextProps['style']) {
  const { fontWeight, fontFamily, ...resto } = StyleSheet.flatten(style) ?? {};
  return [resto, { fontFamily: fontFamily ?? familiaPara(fontWeight) }];
}

export function Text({ style, ...props }: TextProps) {
  return <RNText {...props} style={conPoppins(style)} />;
}

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput({ style, ...props }, ref) {
  return <RNTextInput ref={ref} {...props} style={conPoppins(style)} />;
});
