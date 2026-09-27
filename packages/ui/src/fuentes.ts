import {
  Poppins_300Light,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from '@expo-google-fonts/poppins';

// Carga Poppins (la fuente de la marca). Cada app lo llama en su _layout y
// espera a que devuelva `true` antes de mostrar las pantallas.
export function useFuentesSabor(): boolean {
  const [cargadas, error] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });
  // Si la descarga falla seguimos con la fuente del sistema en vez de colgarnos.
  return cargadas || error != null;
}
