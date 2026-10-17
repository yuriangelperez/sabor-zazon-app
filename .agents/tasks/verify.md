# Verificación — Resumen de ventas con filtros + doble confirmación

Iteración 2. Existe `review.json` con veredicto `CHANGES_REQUESTED` y 5 hallazgos
(1 blocking, 4 non-blocking). Esta iteración corrige TODOS los hallazgos.

## Hallazgos corregidos

1. **(blocking) Consulta sin tope ni detección de truncado** — `getPedidosEntre`
   ahora fija `.limit(LIMITE_PEDIDOS_RANGO)` con `LIMITE_PEDIDOS_RANGO = 5000`
   (exportado desde `@sabor/api-client`). El resumen calcula
   `truncado = pedidos.length >= LIMITE_PEDIDOS_RANGO` y, cuando es true, muestra
   un aviso ámbar: "Período truncado: llegamos al tope de pedidos (5000). Las
   métricas pueden estar incompletas; acortá el rango para ver todo."
   `packages/api-client/src/pedidosService.ts`, `apps/staff/app/(tabs)/resumen.tsx`.
2. **(non-blocking) Lista sin virtualizar** — la lista de `TarjetaPedido` pasó de
   `visibles.map(...)` dentro de un `ScrollView` plano a un `FlatList` con
   `renderItem` (render bajo demanda), `keyExtractor`, `ListHeaderComponent`
   (cabezal con error/aviso/modos/período/métricas/chips) y `ListEmptyComponent`.
   El `refreshControl` (pull-to-refresh) se mantiene sobre el `FlatList`.
   `apps/staff/app/(tabs)/resumen.tsx`.
3. **(non-blocking) Pisado por fetch viejo** — `cargar` usa un contador de
   generación (`generacionRef = useRef(0)`): cada invocación incrementa y
   guarda su `gen`; al resolver, descarta la actualización si
   `gen !== generacionRef.current` (resolución stale). Aplica a `setPedidos`,
   `setError` y `setCargando`. Así un rango viejo no pisa los datos del rango
   nuevo al cambiar de filtro rápido. `apps/staff/app/(tabs)/resumen.tsx`.
4. **(non-blocking) Doble confirmación no se reinicia ante cambio en vivo** —
   `TarjetaPedido` agrega `useEffect(() => setPasoAccion(0), [pedido.estado])`:
   si el estado cambia por realtime mientras hay una confirmación en curso,
   el paso vuelve a 0 y no se avanza al estado siguiente sin querer.
   `apps/staff/components/TarjetaPedido.tsx`.
5. **(non-blocking) Selector de Semana sin aclarar que toma toda la semana** —
   `SelectorFecha` agrega un prop `ayuda?: string` que se muestra bajo el título;
   el resumen pasa `ayuda="Elegí un día; se usa toda su semana (lun–dom)."`
   solo en modo Semana. `apps/staff/components/SelectorFecha.tsx`,
   `apps/staff/app/(tabs)/resumen.tsx`.

## Comandos ejecutados y resultados

El proyecto **no tiene** scripts de `test` ni de `lint` en ningún workspace
(verificado en `package.json` de la raíz y de `apps/staff`). El único comando de
verificación es `typecheck` (`tsc --noEmit`).

| Comando | Resultado |
|---|---|
| `npm run typecheck --workspace=apps/staff` (tras los 5 fixes) | Exit 0 — sin errores |
| `npm run typecheck` (raíz; `--workspaces --if-present` cubre customer/owner/staff; `api-client` es compartido) | Exit 0 — `@sabor/customer`, `@sabor/owner` y `@sabor/staff` sin errores |

No se ejecutó `npm run staff:web` (servidor de desarrollo largo y sin navegador
interactivo en este entorno). La verificación de comportamiento es por
razonamiento sobre el código (ver abajo).

## Razonamiento: cambiar de filtro actualiza la lista y los totales

- `filtroModo` + fechas son estado de React; `rangoActivo = useMemo(...)`
  recalcula al cambiarlos.
- `cargar = useCallback(..., [rangoActivo])` se recrea; `useEffect([cargar])`
  la ejecuta y renueva `suscribirPedidos(() => void cargar())` con el nuevo
  rango. Cada `cargar` recibe su `gen`; si el rango cambió de nuevo antes de
  resolver, la respuesta stale se descarta y no pisa la lista/métricas nuevas.
- `getPedidosEntre` acota con `.gte`/`.lt` sobre `creado_en` y `.limit(5000)`;
  el `truncado` solo se enciende si la respuesta alcanza el tope.
- `stats = useMemo(..., [pedidos])` y `visibles` recalculan con los pedidos del
  nuevo rango; el `FlatList` renderiza `visibles` bajo demanda, y el cabezal
  (métricas/chips/aviso) se actualiza con cada `pedidos` nuevo.
- Conclusión: cambiar Día/Semana/Mes/Rango (o la fecha del período) → `rangoActivo`
  cambia → `cargar` (con guarda de generación) → `pedidos` nuevos → `stats`,
  `visibles`, `truncado` y la lista se actualizan. ✓

## Razonamiento: la doble confirmación cancela limpio en cualquier paso

- `pasoAccion = 0` → botón principal; en `listo`/`entregado` va a paso 1 (NO
  llama a `cambiarEstado`). "Aceptar" (`en_preparacion`) es toque simple directo.
- `pasoAccion = 1` → "No" → `setPasoAccion(0)`; "Sí, continuar" → paso 2.
- `pasoAccion = 2` → "No" → `setPasoAccion(0)`; "Sí, confirmar" →
  `setPasoAccion(0)` + `cambiarEstado(pedido.id, accion.estado)`.
- Único punto que aplica el cambio: "Sí, confirmar" en paso 2. Cancelar en
  paso 1 o 2 NO toca el estado. ✓
- Guarda ante realtime: `useEffect([pedido.estado])` reinicia `pasoAccion` a 0
  si el estado cambia en vivo, evitando saltarse el estado recién llegado. ✓
- `alternarAbierta` y el botón "Rechazar" siguen reiniciando `pasoAccion` a 0;
  el botón principal se oculta durante el rechazo (`accion && !confirmarRechazo`). ✓
