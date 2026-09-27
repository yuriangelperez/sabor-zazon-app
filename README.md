# Sabor y Sazón — Monorepo

Estructura:

- `apps/landing` — Landing en HTML/CSS/JS con los productos; sus botones llevan a la web de pedidos
- `apps/customer` — Web/app de pedidos: menú + carrito + checkout + seguimiento (RF-01 a RF-08)
- `apps/staff` — Portal de recepción de pedidos (RF-09 a RF-13)
- `apps/owner` — Dashboard financiero de la dueña (RF-14 a RF-20)
- `packages/ui` — Theme (colores y Poppins de web-sabor-sazon.vercel.app), encabezado con la bandera y componentes compartidos
- `packages/types` — Tipos compartidos: `Producto`, `Orden`, `Usuario`, `Cupon`
- `packages/api-client` — Cliente único de Supabase
- `packages/utils` — Utilidades (formateo de precios, etc.)

## Primeros pasos (en tu máquina, no acá)

```bash
# 1. Instalar dependencias de todo el workspace
npm install

# 2. Completar las variables de entorno de cada app
cp apps/customer/.env.example apps/customer/.env
cp apps/staff/.env.example apps/staff/.env
cp apps/owner/.env.example apps/owner/.env
# y cargar EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY de tu proyecto Supabase

# 3. Levantar cada app
npm run landing        # landing HTML en http://localhost:3000
npm run customer:web   # web de pedidos, en el navegador (http://localhost:8081)
npm run customer       # app de pedidos, con Expo Go / QR
npm run staff          # recepción: pedidos en vivo + administración del menú
npm run staff:web      # portal de recepción
npm run owner:web      # dashboard financiero
```

## Base de datos (Supabase)

Todo vive en el esquema `saborsazon` (no choca con otros proyectos en `public`).

1. **SQL Editor** → pegar y ejecutar `supabase/migrations/0001_esquema.sql`.
2. **SQL Editor** → pegar y ejecutar `supabase/seed.sql` (menú, zonas de envío,
   ingredientes y datos de transferencia). Se puede volver a correr sin duplicar.
3. **Project Settings → Data API → Exposed schemas** → agregar `saborsazon` y guardar.
4. **Project Settings → API** → copiar *Project URL* y *anon public key* en el
   `.env` de cada app (`apps/customer/.env`, `apps/staff/.env`).
5. **Usuarios de recepción / dueña**: Authentication → Users → *Add user*
   (email + contraseña, marcar *Auto Confirm*). Después, en el SQL Editor:

   ```sql
   update saborsazon.perfiles set rol = 'recepcionista' where email = 'recepcion@tu-mail.com';
   update saborsazon.perfiles set rol = 'duena'         where email = 'duena@tu-mail.com';
   ```

Para cambiar el menú inicial: editar `supabase/catalogo-inicial.ts` y correr
`npm run seed:generar`. Después, el día a día se administra desde la app de staff.

## Por qué esta estructura

- **Cada app es independiente** (bundle propio, login propio) pero comparte
  theme, tipos y el cliente de Supabase vía `packages/*`, así el carrito, el
  producto y la orden se definen una sola vez y no se desincronizan entre
  cliente / staff / dueña.
- Sigue el patrón de `newyou-app`: Expo Router (`app/`), `components/`,
  `hooks/`, `services/`, `stores/` (Zustand), `schemas/` (Zod) dentro de cada
  app.

## Próximos pasos sugeridos (en orden)

1. Crear el proyecto en Supabase y las tablas: `productos`, `opciones_combo`,
   `ordenes`, `items_orden`, `usuarios`, `cupones`, `resenas`.
2. Migrar el contenido de `Web-Sabor-Sazon` a `apps/customer/app/(public)/index.tsx`.
3. Migrar `mockMenu` de `sabor-zazon-app` a Supabase y armar `menuService` en
   `packages/api-client`.
4. Construir `ProductCard`, `QuantityStepper` (`-3+` → agregar) y
   `CategoryTabs` en `packages/ui`.
5. Armar `useCarritoStore` (Zustand + persistencia) en `apps/customer/stores`.
6. Checkout: métodos de pago, delivery/retiro, cupón, propina, PDF.
7. Realtime: `apps/staff` escuchando `ordenes` por Supabase Realtime +
   alerta sonora (RF-11).
8. `apps/owner`: gráficos de ventas, cupones, reembolsos, reseñas.

## Notas de la migración desde los repos actuales

- `sabor-zazon-app` usaba `App.tsx` como entrypoint sin Expo Router: en este
  monorepo cada app usa `index.ts` → `import 'expo-router/entry'` y
  `app/_layout.tsx` como raíz, igual que `newyou-app`.
- El contenido de `src/` de `sabor-zazon-app` se reparte entre
  `apps/customer/{components,hooks,services,stores}` y, si es reutilizable
  por `staff`/`owner`, sube a `packages/`.
# sabor-zazon-app
