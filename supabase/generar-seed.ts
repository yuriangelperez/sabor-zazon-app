// Genera supabase/seed.sql a partir de catalogo-inicial.ts.
// Uso (desde la raíz del monorepo): npm run seed:generar
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { INGREDIENTES_BASE } from '@sabor/utils';

import { CATALOGO_INICIAL } from './catalogo-inicial';

const texto = (v: string | null | undefined) => (v == null ? 'null' : `'${v.replace(/'/g, "''")}'`);
const arreglo = (v: string[] | undefined) => `array[${(v ?? []).map(texto).join(', ')}]::text[]`;
const json = (v: unknown) => `${texto(JSON.stringify(v ?? []))}::jsonb`;

const productos = CATALOGO_INICIAL.map(
  (p) => `  (${[
    texto(p.id),
    texto(p.nombre),
    texto(p.descripcion),
    texto(String(p.imagen)),
    p.precio,
    p.descuentoPorcentaje ?? 0,
    texto(p.categoriaBase),
    arreglo(p.categoriasMomento),
    arreglo(p.rellenos),
    p.esCombo,
    json(p.gruposOpciones),
    arreglo(p.acompañamientos),
    arreglo(p.ingredientes),
    p.activo,
    p.orden ?? 0,
  ].join(', ')})`
).join(',\n');

const ingredientes = INGREDIENTES_BASE.map((i) => `  (${texto(i.id)}, ${texto(i.nombre)})`).join(',\n');

const sql = `-- =============================================================================
-- Datos iniciales de Sabor y Sazón. ARCHIVO GENERADO: no editar a mano.
-- Se regenera con: npm run seed:generar  (fuente: supabase/catalogo-inicial.ts)
-- Ejecutar en Supabase después de migrations/0001_esquema.sql. Se puede volver
-- a correr: actualiza los productos existentes sin duplicarlos.
-- =============================================================================

-- Configuración del local (datos de la web anterior)
insert into saborsazon.configuracion (id, horario_apertura, horario_cierre, direccion_local, alias_transferencia, cvu, titular_cuenta, recargo_link_pago)
values (1, '10:00', '22:00', 'San Ignacio 663, Manuel Alberti, Pilar', 'yusari.mp', '0000003100050702333676', 'Yusari Angelica Hernandez Silva', 5)
on conflict (id) do nothing;

-- Zonas de delivery (RF-06)
insert into saborsazon.zonas_envio (id, nombre, costo, orden) values
  ('manuel-alberti', 'Manuel Alberti', 5000, 1),
  ('del-viso', 'Del Viso', 6000, 2),
  ('tortuguitas', 'Tortuguitas', 8000, 3)
on conflict (id) do update set nombre = excluded.nombre, costo = excluded.costo, orden = excluded.orden;

-- Ingredientes que se pueden marcar como agotados (RF-12)
insert into saborsazon.ingredientes (id, nombre) values
${ingredientes}
on conflict (id) do update set nombre = excluded.nombre;

-- Menú
insert into saborsazon.productos (
  id, nombre, descripcion, imagen, precio, descuento_porcentaje, categoria_base,
  categorias_momento, rellenos, es_combo, grupos_opciones, acompanamientos,
  ingredientes, activo, orden
) values
${productos}
on conflict (id) do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  imagen = excluded.imagen,
  precio = excluded.precio,
  descuento_porcentaje = excluded.descuento_porcentaje,
  categoria_base = excluded.categoria_base,
  categorias_momento = excluded.categorias_momento,
  rellenos = excluded.rellenos,
  es_combo = excluded.es_combo,
  grupos_opciones = excluded.grupos_opciones,
  acompanamientos = excluded.acompanamientos,
  ingredientes = excluded.ingredientes,
  orden = excluded.orden;
`;

const destino = join(dirname(fileURLToPath(import.meta.url)), 'seed.sql');
writeFileSync(destino, sql);
console.log(`seed.sql generado con ${CATALOGO_INICIAL.length} productos → ${destino}`);
