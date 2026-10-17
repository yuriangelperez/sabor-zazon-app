# Plan de implementación — Resumen de ventas con filtros + doble confirmación de estado

> Tarea: mostrar TODOS los pedidos (no solo los de hoy) en el resumen de ventas
> del app de staff, con filtros por día / semana / mes / rango de fechas y
> métricas calculadas según el filtro activo; y agregar confirmación DOBLE
> (dos pasos) antes de marcar un pedido como "listo" o "entregado".

## Nota de base (leer antes de empezar)

- **Backend = Supabase.** Confirmado leyendo `packages/api-client/src/supabaseClient.ts` y `packages/api-client/src/pedidosService.ts`: las consultas usan el cliente de Supabase (`.from('pedidos').select(...).gte('creado_en', ...)`). El esquema es `saborsazon`.
- **El build ya está roto.** `npm run typecheck --workspace=apps/staff` FALLA hoy por un bug preexistente: `app/(tabs)/resumen.tsx` llama a `inicioDelDia()` (línea 28) pero esa función está comentada (líneas 10-14). Este plan lo resuelve en el paso 3 (reescritura de `resumen.tsx`). Los pasos 1 y 2 son **aditivos** (no tocan `resumen.tsx`); su verificación es "no aparecen errores NUEVOS además del `inicioDelDia` ya conocido". El typecheck pasa limpio a partir del paso 3.
- **No hay tests ni lint.** Ningún workspace tiene script de `test` ni de `lint`; no hay framework de pruebas. El comando real de verificación es `typecheck` (`tsc --noEmit`), presente en `apps/customer`, `apps/owner` y `apps/staff`. No se agregan pruebas nuevas (la tarea lo pide).
- **Sin librerías nuevas.** No hay ningún datepicker instalado (`@react-native-community/datetimepicker` ausente; nada en `node_modules`). Por eso se construye un calendario propio con `Modal` + tema, reutilizando el patrón visual de `packages/ui/src/Selector.tsx` (hoja inferior `fondo`/`hoja`/`agarre`/`titulo`).
- **Texto en español.** Todos los comentarios y textos de UI van en español, igual que el resto del proyecto.

## Decisiones de diseño (no hay documento de diseño; se decide aquí)

1. **Filtrado por rango acotado en el servidor, no en el cliente.** Se agrega `getPedidosEntre(desde, hasta)` al api-client (clon de `getPedidosDesde` con `.lt('creado_en', hasta)`), en vez de traer todo y filtrar en la app. Razón: para "mes" o "rango" no conviene traer el historial completo; una consulta acotada evita over-fetching y sigue el patrón existente.
2. **Calendario propio (`SelectorFecha`), no librería.** No hay datepicker instalado y la tarea prohíbe dependencias nuevas. Se arma un bottom-sheet con `Modal` + tokens del tema (`colors`, `radii`, `spacing`, `Text`) imitando a `Selector.tsx`. Soporta `simple` / `rango` / `mes`, y siempre devuelve `{ desde, hasta }` para que `resumen.tsx` sea simple.
3. **Filtro por defecto = "día = hoy".** Conserva el comportamiento actual (pedidos de hoy) y deja los demás modos a un toque.
4. **Doble confirmación inline dentro de `TarjetaPedido`, no un Modal/Alert nuevo.** Se replica el patrón de confirmación que ya existe para "Rechazar" (estado `confirmarRechazo` + estilos `confirmar`/`acciones`), extendido a dos pasos consecutivos (`pasoAccion: 0|1|2`). Solo aplica a `listo` y `entregado` (lo pedido); "Aceptar" sigue siendo un toque simple. Cancelar en cualquier paso no llama a `cambiarEstado`.
5. **No se borra `getPedidosDesde`.** Aunque `resumen.tsx` deja de usarla, se mantiene exportada para minimizar el radio de impacto (es API pública del paquete).

## Funciones / tipos de la capa de datos a reusar

- `getPedidosEntre(desde, hasta)` (nueva, paso 1) — consulta acotada por `creado_en`.
- `suscribirPedidos(onEvento)` y `mensajeError(err)` de `@sabor/api-client` — ya usadas en `resumen.tsx`.
- Tipos `Pedido`, `EstadoPedido` de `@sabor/types`; `ETIQUETA_ESTADO`, `formatPrice` de `@sabor/utils`.
- `Chip`, `Button`, `colors`, `radii`, `spacing`, `Text` de `@sabor/ui`.
- `usePedidosEnVivoStore` (`cambiarEstado`) y `TarjetaPedido` — ya usados; la doble confirmación vive dentro de `TarjetaPedido`.

---

# Pasos

- [ ] 1. Agregar `getPedidosEntre(desde, hasta)` al api-client.
      Clonar `getPedidosDesde` en `packages/api-client/src/pedidosService.ts` y añadir `.lt('creado_en', hasta.toISOString())` (límite superior exclusivo) antes de `.in('pago_estado', PAGOS_VISIBLES)` y `.order('creado_en', { ascending: false })`. Mantener `getPedidosDesde` sin borrar. Ya queda exportada por `export * from './pedidosService'` en `packages/api-client/src/index.ts`.
      Files: `packages/api-client/src/pedidosService.ts`
      Verify: `npm run typecheck --workspace=apps/staff` → no aparecen errores NUEVOS (el único error restante debe seguir siendo el preexistente `inicioDelDia` en `resumen.tsx`).

- [ ] 2. Crear el componente `SelectorFecha` (calendario en hoja inferior).
      Crear `apps/staff/components/SelectorFecha.tsx`: un `Modal` bottom-sheet que reutiliza los estilos visuales de `packages/ui/src/Selector.tsx` (`fondo`, `hoja`, `agarre`, `titulo`) y los tokens del tema (`colors`, `radii`, `spacing`, `Text` de `@sabor/ui`). Props: `titulo: string`, `modo: 'simple' | 'rango' | 'mes'`, `visible: boolean`, `onClose: () => void`, `onConfirm: (rango: { desde: Date; hasta: Date }) => void`, `valorInicial?: { desde: Date; hasta: Date } | null`. Grilla mensual con navegación mes anterior/siguiente, encabezado de días (L D M M J V S) y celdas táctiles. `simple` elige un día; `rango` dos toques (inicio y fin; si fin < inicio, reiniciar inicio); `mes` navega a un mes y confirma con botón "Usar este mes". Siempre devuelve `desde` = inicio a 00:00 y `hasta` = límite superior exclusivo (día siguiente / mes siguiente). Sin dependencias nuevas.
      Files: `apps/staff/components/SelectorFecha.tsx`
      Verify: `npm run typecheck --workspace=apps/staff` → no aparecen errores NUEVOS (archivo aún no importado; solo el `inicioDelDia` preexistente).

- [ ] 3. Reescribir `resumen.tsx`: lista de todos los pedidos con filtros (día/semana/mes/rango) + métricas dinámicas.
      Reescribir `apps/staff/app/(tabs)/resumen.tsx`. Estado de modo de filtro `filtroModo: 'dia' | 'semana' | 'mes' | 'rango'` (default `'dia'`) y estados de fechas: `fechaDia` (default hoy), `semanaRef` (default hoy), `mesValor: { anio: number; mes: number }` (default actual), `rango: { desde: Date; hasta: Date }` (default hoy→hoy). Definir helpers locales `inicioDelDia`, `finDelDia` (día siguiente a 00:00), `rangoDia`, `rangoSemana` (lunes a domingo, base `(getDay()+6)%7`), `rangoMes`, que devuelven `{ desde, hasta }`; esto restaura la `inicioDelDia` que estaba comentada y repara el build. Calcular `rangoActivo = useMemo(...)` desde `filtroModo` + fechas; `cargar` pasa a llamar `getPedidosEntre(rangoActivo.desde, rangoActivo.hasta)`; el `useEffect` vuelve a ejecutar `cargar` cuando cambia `rangoActivo`, manteniendo `suscribirPedidos(() => void cargar())` para refrescos en tiempo real. UI: una fila de `Chip` (o `Selector`) para elegir el modo (Día / Semana / Mes / Rango) y un botón que muestra el período activo ("Hoy · lun 27 oct" / "Semana del 23 al 29 sep" / "Octubre 2025" / "23 sep – 29 oct") que al tocarlo abre `SelectorFecha` en el modo correcto. Métricas: primera etiqueta dinámica ("Vendido en el día / la semana / el mes / el rango"); mantener Pedidos, Ticket promedio, Entregados, Delivery/Retiro, Cancelados calculados sobre los `pedidos` cargados (ya acotados al rango). Texto vacío: "No hay pedidos en este período." Conservar los `Chip` de estado (Todos + estados con conteo > 0) y el render con `TarjetaPedido`.
      Files: `apps/staff/app/(tabs)/resumen.tsx`
      Verify: `npm run typecheck --workspace=apps/staff` → pasa SIN errores (desaparece el `inicioDelDia`). Manual (`npm run staff:web`): cambiar entre día/semana/mes/rango actualiza la lista de pedidos y los totales/métricas.

- [ ] 4. Doble confirmación (dos pasos) para "listo" y "entregado" en `TarjetaPedido`.
      Modificar `apps/staff/components/TarjetaPedido.tsx`. Agregar estado `pasoAccion: 0 | 1 | 2` para la confirmación doble de la acción principal. Cuando `accion.estado` sea `'listo'` o `'entregado'`: el botón principal al tocarlo pone `pasoAccion = 1` (en vez de llamar `cambiarEstado` directo); paso 1 muestra un confirmado inline reutilizando los estilos `confirmar`/`acciones` existentes (patrón de "Rechazar") con mensaje según la acción (`¿Confirmar que el pedido está listo?` / `¿Confirmar que el pedido fue retirado?` / `¿Confirmar que el pedido fue entregado?`) y botones "No" (→ `pasoAccion = 0`) y "Sí, continuar" (→ `pasoAccion = 2`); paso 2 muestra "¿Estás seguro? Esta acción avisa al cliente y no se puede deshacer." con "No" (→ 0) y "Sí, confirmar" (→ `cambiarEstado(pedido.id, accion.estado)` y `pasoAccion = 0`). Cuando `accion.estado` sea `'en_preparacion'` (Aceptar): toque simple directo (sin confirmación). Extender la guarda `&& !confirmarRechazo` del botón principal para ocultarlo también mientras hay confirmación de rechazo, y reiniciar `pasoAccion` a 0 al colapsar la tarjeta o al mostrar el rechazo, para evitar estado obsoleto. Cancelar en cualquier paso NO llama a `cambiarEstado`.
      Files: `apps/staff/components/TarjetaPedido.tsx`
      Verify: `npm run typecheck --workspace=apps/staff` → pasa sin errores. Manual (`npm run staff:web`, tablero `app/(tabs)/index.tsx` y lista de `resumen.tsx`): tocar "Pedido listo" / "Pedido entregado" muestra DOS confirmaciones seguidas; cancelar en el paso 1 o en el paso 2 NO cambia el estado (recargar y comprobar que el pedido sigue en su estado anterior).

- [ ] 5. Verificación final.
      Ejecutar `npm run typecheck --workspace=apps/staff` (o `npm run typecheck` desde la raíz, que cubre customer/owner/staff) → pasa sin errores. Smoke check en `npm run staff:web`: los filtros día/semana/mes/rango recargan lista y métricas; la doble confirmación cancela limpio en cualquiera de los dos pasos sin alterar el estado.
      Files: —
      Verify: `npm run typecheck --workspace=apps/staff` → 0 errores.
