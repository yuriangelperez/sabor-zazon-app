# Verificación — Resumen de ventas con filtros + doble confirmación

Iteración 1 (primera). No existe `review.json`.

## Comandos ejecutados y resultados

El proyecto **no tiene** scripts de `test` ni de `lint` en ningún workspace (verificado leyendo `package.json` de la raíz y de `apps/staff`). El único comando de verificación es `typecheck` (`tsc --noEmit`), presente en `apps/customer`, `apps/owner` y `apps/staff`.

| Comando | Resultado |
|---|---|
| `npm run typecheck --workspace=apps/staff` (línea base, antes de cambios) | Exit 0 — sin errores. Nota: el `plan.md` decía que el build estaba roto por `inicioDelDia` comentada, pero en el estado actual esa función SÍ estaba definida; la línea base ya pasaba limpia. |
| `npm run typecheck --workspace=apps/staff` (tras paso 1: `getPedidosEntre`) | Exit 0 |
| `npm run typecheck --workspace=apps/staff` (tras paso 2: `SelectorFecha`) | Exit 0 |
| `npm run typecheck --workspace=apps/staff` (tras paso 3: `resumen.tsx`) | Exit 0 |
| `npm run typecheck --workspace=apps/staff` (tras paso 4: `TarjetaPedido`) | Exit 0 |
| `npm run typecheck` (raíz, todos los workspaces; `api-client` es compartido) | Exit 0 — `@sabor/customer`, `@sabor/owner` y `@sabor/staff` sin errores |

No se ejecutó `npm run staff:web` (servidor de desarrollo largo y sin navegador interactivo en este entorno). La verificación de comportamiento es por razonamiento sobre el código + spot-check de la capa de datos (ver abajo).

## Qué cambió (resumen)

1. `packages/api-client/src/pedidosService.ts`: se agregó `getPedidosEntre(desde, hasta)` (clon de `getPedidosDesde` con `.lt('creado_en', hasta.toISOString())`, límite superior exclusivo). Se mantiene `getPedidosDesde` sin borrar. Ya queda exportada vía `export * from './pedidosService'`.
2. `apps/staff/components/SelectorFecha.tsx` (nuevo): calendario en hoja inferior (`Modal` + tokens del tema) reutilizando el patrón visual de `packages/ui/src/Selector.tsx` (`fondo`/`hoja`/`agarre`/`titulo`). Modos `simple` / `rango` / `mes`; siempre devuelve `{ desde, hasta }` con `hasta` exclusivo. Sin dependencias nuevas.
3. `apps/staff/app/(tabs)/resumen.tsx`: reescrito. Lista TODOS los pedidos del período con filtros Día / Semana / Mes / Rango (default "Día = hoy"). `rangoActivo = useMemo(...)` según `filtroModo` + fechas; `cargar` llama `getPedidosEntre(rangoActivo.desde, rangoActivo.hasta)`; el `useEffect([cargar])` recarga al cambiar el rango y mantiene `suscribirPedidos(() => void cargar())` para refrescos en tiempo real. Métricas (Vendido/Pedidos/Ticket/Entregados/Delivery-Retiro/Cancelados) calculadas sobre los `pedidos` ya acotados al rango. Se restauró `inicioDelDia` (ahora `inicioDelDia(d: Date)`) y se agregaron `finDelDia`, `rangoDia`, `rangoSemana` (lunes-domingo), `rangoMes`.
4. `apps/staff/components/TarjetaPedido.tsx`: doble confirmación (estado `pasoAccion: 0|1|2`) para las acciones `listo` y `entregado`. "Aceptar" sigue siendo un toque simple. Se reutilizan los estilos `confirmar`/`acciones`/`accion` (patrón de "Rechazar"). `pasoAccion` se reinicia a 0 al colapsar la tarjeta (`alternarAbierta`) y al mostrar el rechazo.

## Razonamiento: cambiar de filtro actualiza la lista y los totales

- `filtroModo` y las fechas (`fechaDia`, `semanaRef`, `mesValor`, `rango`) son estado de React.
- `rangoActivo = useMemo(...)` se recalcula cuando cambia cualquiera de esos valores (deps: `[filtroModo, fechaDia, semanaRef, mesValor, rango]`).
- `cargar = useCallback(async () => { setPedidos(await getPedidosEntre(rangoActivo.desde, rangoActivo.hasta)) ... }, [rangoActivo])` => cuando `rangoActivo` cambia, `cargar` se recrea.
- `useEffect(() => { void cargar(); return suscribirPedidos(() => void cargar()); }, [cargar])` => al recrearse `cargar`, el efecto limpia la suscripción anterior y vuelve a ejecutar `cargar()` con el nuevo rango.
- `stats = useMemo(..., [pedidos])` => al llegar los nuevos pedidos del nuevo rango, `stats` recalcula cantidad/ventas/ticket/entregados/anulados/delivery/retiro.
- `visibles = filtro ? pedidos.filter(...) : pedidos` => la lista de tarjetas refleja los pedidos del nuevo rango.
- Conclusión: cambiar de filtro (Día/Semana/Mes/Rango) o la fecha del período → `rangoActivo` cambia → `cargar` recalcula → `pedidos` nuevos → `stats` y `visibles` se actualizan. ✓

Spot-check de la capa de datos: `getPedidosEntre` aplica `.gte('creado_en', desde.toISOString())` y `.lt('creado_en', hasta.toISOString())` con `.order('creado_en', { ascending: false })` y `.in('pago_estado', PAGOS_VISIBLES)`, igual que `getPedidosDesde`. Los rangos se construyen en hora local y se convierten a ISO solo en el límite de la consulta (como ya hace `inicioDelDia` original), así un día "hoy" queda `desde` = hoy 00:00 local y `hasta` = mañana 00:00 local, que en UTC acota correctamente los `creado_en`.

## Razonamiento: la doble confirmación cancela limpio en cualquier paso

Flujo para `listo` y `entregado` (`esAccionDoble = accion.estado === 'listo' || 'entregado'`):

- `pasoAccion = 0` → se ve el botón principal. `onPress` => `esAccionDoble ? setPasoAccion(1) : void cambiarEstado(...)`. Como es doble, va a paso 1 (NO llama a `cambiarEstado`).
- `pasoAccion = 1` → inline con `mensajePaso1` ("¿Confirmar que el pedido está listo?" / "...fue retirado?" / "...fue entregado?"). Botones "No" (`setPasoAccion(0)`) y "Sí, continuar" (`setPasoAccion(2)`).
- `pasoAccion = 2` → inline con `mensajePaso2` ("¿Estás seguro? Esta acción avisa al cliente y no se puede deshacer."). Botones "No" (`setPasoAccion(0)`) y "Sí, confirmar" (`setPasoAccion(0)` + `void cambiarEstado(pedido.id, accion.estado)`).

Cancelar:
- "No" en paso 1 → `setPasoAccion(0)`, NO llama `cambiarEstado`. Vuelve al botón principal sin cambiar el estado. ✓
- "No" en paso 2 → `setPasoAccion(0)`, NO llama `cambiarEstado`. Vuelve al botón principal sin cambiar el estado. ✓
- Único punto que aplica el cambio: "Sí, confirmar" en paso 2. ✓

"Aceptar" (`accion.estado === 'en_preparacion'`, `esAccionDoble = false`): `onPress` => `void cambiarEstado(pedido.id, 'en_preparacion')` directo, toque simple, sin confirmación (como pide el plan). ✓

Evita estado obsoleto: `alternarAbierta` reinicia `pasoAccion` a 0 al colapsar; el botón "Rechazar pedido" también reinicia `pasoAccion` a 0. El botón principal se oculta durante el rechazo por la guarda `accion && !confirmarRechazo` (sin cambios respecto al original). ✓
