import type { ImageSourcePropType } from 'react-native';
import type { ImagenProducto } from '@sabor/types';

// Fotos de los productos del catálogo inicial, incluidas en las apps.
// En la base de datos estos productos guardan solo la clave (ej. "arepa-pollo");
// los productos nuevos que se cargan desde staff guardan la URL de Supabase Storage.
export const IMAGENES_PRODUCTOS: Record<string, number> = {
  'arepa-pollo': require('../assets/productos/arepa-pollo.jpg'),
  'arepa-queso': require('../assets/productos/arepa-queso.jpg'),
  'arepa-carne': require('../assets/productos/arepa-carne.jpg'),
  'arepa-domino': require('../assets/productos/arepa-domino.jpg'),
  'arepa-catira': require('../assets/productos/arepa-catira.jpg'),
  'arepa-pelua': require('../assets/productos/arepa-pelua.jpg'),
  'arepa-pabellon': require('../assets/productos/arepa-pabellon.jpg'),
  'empanada-pollo': require('../assets/productos/empanada-pollo.jpg'),
  'empanada-queso': require('../assets/productos/empanada-queso.jpg'),
  'empanada-carne': require('../assets/productos/empanada-carne.jpg'),
  'empanada-porotos': require('../assets/productos/empanada-porotos.jpg'),
  'empanada-domino': require('../assets/productos/empanada-domino.jpg'),
  'empanada-catira': require('../assets/productos/empanada-catira.jpg'),
  'empanada-pelua': require('../assets/productos/empanada-pelua.jpg'),
  'empanada-pabellon': require('../assets/productos/empanada-pabellon.jpg'),
  'tequenos-12': require('../assets/productos/tequenos-12.jpg'),
  'tequenos-20': require('../assets/productos/tequenos-20.jpg'),
  'combo-zulia': require('../assets/productos/combo-zulia.jpg'),
  'combo-maracay': require('../assets/productos/combo-maracay.jpg'),
  'combo-caracas': require('../assets/productos/combo-caracas.jpg'),
  'combo-vargas': require('../assets/productos/combo-vargas.jpg'),
};

// URL remota, clave de una foto incluida, o el número de un require().
// Devuelve undefined si no hay imagen (la tarjeta muestra el fondo vacío).
export function fuenteImagen(imagen: ImagenProducto | null | undefined): ImageSourcePropType | undefined {
  if (imagen == null || imagen === '') return undefined;
  if (typeof imagen === 'number') return imagen;
  if (/^(https?:|file:|content:|data:|blob:)/.test(imagen)) return { uri: imagen };
  return IMAGENES_PRODUCTOS[imagen];
}
