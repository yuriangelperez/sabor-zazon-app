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

## Publicar

### Web (Vercel)

Un proyecto de Vercel por app, todos desde este repo:

| Proyecto | Root Directory | Configuración |
|---|---|---|
| Landing | `apps/landing` | Framework "Other", sin build |
| Pedidos | `apps/customer` | la toma de `apps/customer/vercel.json` |
| Recepción | `apps/staff` | la toma de `apps/staff/vercel.json` |

En pedidos y recepción cargá en **Settings → Environment Variables**
`EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` (el `.env` no se sube).
Después poné la URL de pedidos en `apps/landing/config.js` (`URL_PEDIDOS`).

### App instalable (EAS Build)

```bash
npm install -g eas-cli
eas login
cd apps/staff            # o apps/customer
eas init                 # vincula la app con tu cuenta de expo.dev
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value "https://xxxx.supabase.co" --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "sb_publishable_..." --visibility plaintext
eas build -p android --profile preview      # APK con link de descarga
```

Para la Play Store: repetí `eas env:create` con `--environment production`,
y después `eas build -p android --profile production` + `eas submit -p android`.

### Notificaciones de pedidos (APK de recepción)

Cuando entra un pedido, Supabase manda un push a cada celular de recepción con
sesión iniciada, aunque la app esté cerrada. Una sola vez:

1. Supabase → SQL Editor → correr `supabase/migrations/0002_notificaciones.sql`.
2. [Firebase](https://console.firebase.google.com) → crear proyecto → agregar app
   **Android** con el paquete `com.saborysazon.recepcion` → descargar
   `google-services.json` y guardarlo en `apps/staff/google-services.json`
   (se commitea: EAS solo sube los archivos del repo).
3. Firebase → Configuración del proyecto → Cuentas de servicio →
   **Generar nueva clave privada** (baja un `.json`; ese NO se commitea).
4. `cd apps/staff && eas credentials` → Android → production/preview →
   **Google Service Account → Manage your Google Service Account Key for Push
   Notifications (FCM V1)** → subir el `.json` del paso 3.
5. `eas build -p android --profile preview` e instalar el APK nuevo.

Al entrar, la app pide permiso de notificaciones. El estado se ve en Ajustes →
"Avisos de pedidos". En Expo Go y en la web no hay push (con la app abierta
sigue sonando igual).

### Mercado Pago (tarjeta y link de pago)

Los pedidos con **Tarjeta** o **Mercado Pago** se pagan en Mercado Pago
(Checkout Pro). Recepción ve el pedido y recibe el aviso recién cuando el
pago se aprueba. El Access Token vive solo en Supabase (Edge Functions), nunca
en la app.

1. Supabase → SQL Editor → correr `supabase/migrations/0003_mercadopago.sql`.
2. [Mercado Pago Developers](https://www.mercadopago.com.ar/developers/panel/app)
   → **Crear aplicación** → tipo *Pagos online* → *Checkout Pro*.
   En **Credenciales** copiá el **Access Token** (primero el de prueba).
3. Supabase → Edge Functions → **Secrets** → agregar:
   - `MP_ACCESS_TOKEN` = el Access Token
   - `APP_URL` = `https://sabor-zazon-app-rr3c.vercel.app`
4. Subir las funciones (desde la raíz del repo):
   ```bash
   npx supabase login
   npx supabase link --project-ref mpjtxylzmoubywznqdqr
   npx supabase functions deploy mp-pago --no-verify-jwt
   npx supabase functions deploy mp-webhook --no-verify-jwt
   ```
5. (Opcional) Mercado Pago → tu app → **Webhooks** → URL
   `https://mpjtxylzmoubywznqdqr.supabase.co/functions/v1/mp-webhook`, evento **Pagos**.
   Copiá la clave secreta y guardala en Supabase como `MP_WEBHOOK_SECRET`.
   No es obligatorio: cada pago ya le dice a Mercado Pago a dónde avisar.

**Probar:** con el Access Token de prueba, pagá con una
[tarjeta de prueba](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/your-integrations/test/cards)
(titular `APRO` = aprobado, `OTHE` = rechazado). Para cobrar de verdad,
cambiá `MP_ACCESS_TOKEN` por el de producción.
