import type { GrupoOpciones, Ingrediente, Producto } from '@sabor/types';

import { gruposARow, productoARow, productoDesdeRow, type ProductoRow } from './mapeos';
import { asegurarConfiguracion, ESQUEMA, supabase, supabaseConfigurado } from './supabaseClient';

const COLUMNAS_PRODUCTO =
  'id, nombre, descripcion, imagen, precio, descuento_porcentaje, categoria_base, categorias_momento, rellenos, es_combo, grupos_opciones, acompanamientos, ingredientes, activo, desactivado_hasta, orden';

// Todos los productos (activos e inactivos). El menú del cliente filtra los
// no disponibles con `estaDisponible`; staff los ve todos para gestionarlos.
export async function getProductos(): Promise<Producto[]> {
  asegurarConfiguracion();
  const { data, error } = await supabase
    .from('productos')
    .select(COLUMNAS_PRODUCTO)
    .order('categoria_base')
    .order('orden')
    .order('nombre');
  if (error) throw error;
  return (data as ProductoRow[]).map(productoDesdeRow);
}

export async function getProductoById(id: string): Promise<Producto | null> {
  asegurarConfiguracion();
  const { data, error } = await supabase.from('productos').select(COLUMNAS_PRODUCTO).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? productoDesdeRow(data as ProductoRow) : null;
}

// Crea o actualiza (RF-12). Devuelve el producto guardado.
export async function guardarProducto(producto: Producto): Promise<Producto> {
  asegurarConfiguracion();
  const { data, error } = await supabase
    .from('productos')
    .upsert(productoARow(producto))
    .select(COLUMNAS_PRODUCTO)
    .single();
  if (error) throw error;
  return productoDesdeRow(data as ProductoRow);
}

// Solo las opciones (ej. nuevos precios de relleno), sin pisar otros campos
// que alguien esté editando al mismo tiempo.
export async function guardarOpcionesProducto(id: string, grupos: GrupoOpciones[]): Promise<void> {
  asegurarConfiguracion();
  const { error } = await supabase.from('productos').update({ grupos_opciones: gruposARow(grupos) }).eq('id', id);
  if (error) throw error;
}

export async function eliminarProducto(id: string): Promise<void> {
  asegurarConfiguracion();
  const { error } = await supabase.from('productos').delete().eq('id', id);
  if (error) throw error;
}

// RF-12: disponible / sin stock por hoy / desactivado indefinidamente.
export async function cambiarDisponibilidad(
  id: string,
  modo: 'disponible' | 'sin_stock_hoy' | 'desactivado',
  hasta?: Date
): Promise<void> {
  asegurarConfiguracion();
  const cambios =
    modo === 'disponible'
      ? { activo: true, desactivado_hasta: null }
      : modo === 'sin_stock_hoy'
        ? { activo: true, desactivado_hasta: (hasta ?? new Date()).toISOString() }
        : { activo: false, desactivado_hasta: null };
  const { error } = await supabase.from('productos').update(cambios).eq('id', id);
  if (error) throw error;
}

export async function getIngredientes(): Promise<Ingrediente[]> {
  asegurarConfiguracion();
  const { data, error } = await supabase.from('ingredientes').select('id, nombre, agotado').order('nombre');
  if (error) throw error;
  return data as Ingrediente[];
}

export async function marcarIngredienteAgotado(id: string, agotado: boolean): Promise<void> {
  asegurarConfiguracion();
  const { error } = await supabase.from('ingredientes').update({ agotado }).eq('id', id);
  if (error) throw error;
}

export async function crearIngrediente(nombre: string): Promise<Ingrediente> {
  asegurarConfiguracion();
  const id = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const { data, error } = await supabase
    .from('ingredientes')
    .insert({ id, nombre: nombre.trim() })
    .select('id, nombre, agotado')
    .single();
  if (error) throw error;
  return data as Ingrediente;
}

// Avisa cuando cambia el menú o los ingredientes (RNF-02), para que el
// cliente vea al instante un producto pausado desde recepción.
export function suscribirMenu(onCambio: () => void): () => void {
  if (!supabaseConfigurado) return () => {};
  const canal = supabase
    .channel(`menu-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: ESQUEMA, table: 'productos' }, onCambio)
    .on('postgres_changes', { event: '*', schema: ESQUEMA, table: 'ingredientes' }, onCambio)
    .subscribe();
  return () => {
    void supabase.removeChannel(canal);
  };
}
