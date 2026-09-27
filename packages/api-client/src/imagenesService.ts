import { asegurarConfiguracion, supabase } from './supabaseClient';

const BUCKET = 'saborsazon-productos';

// Sube la foto elegida en el editor de productos al bucket del proyecto y
// devuelve su URL pública (se guarda en productos.imagen).
export async function subirImagenProducto(uri: string, tipo = 'image/jpeg'): Promise<string> {
  asegurarConfiguracion();
  const respuesta = await fetch(uri);
  const contenido = await respuesta.arrayBuffer();
  const extension = tipo.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  const ruta = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const { error } = await supabase.storage.from(BUCKET).upload(ruta, contenido, { contentType: tipo });
  if (error) throw error;

  return supabase.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
}
