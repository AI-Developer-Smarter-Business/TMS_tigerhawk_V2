# TigerHawk TMS

Sistema de gestión de transporte (TMS) para drayage portuario, construido con **Next.js 16** (App Router), **React 19**, **TypeScript**, **Supabase** y **Tailwind CSS**.

---

## Requisitos locales

- **Node.js** 18 o superior  
- **npm** (u otro gestor compatible)  
- Proyecto **Supabase** con migraciones aplicadas (`supabase/migrations/`)

### Desarrollo en tu máquina

1. Clona el repositorio e instala dependencias:

   ```bash
   npm install
   ```

2. Copia variables de entorno y complétalas:

   ```bash
   cp env.example .env.local
   ```

3. Arranca el servidor de desarrollo:

   ```bash
   npm run dev
   ```

4. Abre [http://localhost:3000](http://localhost:3000).

Comandos útiles: `npm run build`, `npm run start`, `npm run lint`, `npx tsc --noEmit`.

---

## Despliegue exitoso en Vercel (preview / antes de producción)

Usa este flujo para validar el build y la app en una URL de **Vercel** (`*.vercel.app`) antes de apuntar un dominio propio o mover a un **VPS**.

### 1. Código en un repositorio Git

Vercel despliega desde **GitHub**, **GitLab** o **Bitbucket**. Asegúrate de que la rama que vas a desplegar construye en local:

```bash
npm run build
```

Si el build falla aquí, fallará en Vercel.

### 2. Crear el proyecto en Vercel

1. Entra en [vercel.com](https://vercel.com) e inicia sesión.  
2. **Add New… → Project** e importa el repositorio.  
3. **Framework Preset:** Next.js (detección automática).  
4. **Root Directory:** raíz del repo (donde están `package.json` y `app/`).  
5. **Build Command:** `npm run build` (por defecto).  
6. **Output:** dejado automático por Next.js.  
7. **Install Command:** `npm install` (por defecto).

No cambies esto salvo que tu monorepo use otra carpeta raíz.

### 3. Variables de entorno en Vercel

En el proyecto: **Settings → Environment Variables**. Añade **las mismas claves** que en `.env.local`, por entorno:

| Variable | Entornos recomendados para “dev/preview” | Notas |
|----------|------------------------------------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Preview, Production | URL del proyecto Supabase. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Preview, Production | Clave anónima (pública). |
| `SUPABASE_SERVICE_ROLE_KEY` | Preview, Production | **Secreta.** Solo servidor/API routes. |
| `NEXT_PUBLIC_APP_URL` | Preview, Production | URL **exacta** del despliegue (ver paso 5). |
| `PORT_HOUSTON_API_URL` | Preview, Production | Base URL de la API Port Houston. |
| `PORT_HOUSTON_AUTH_URL` | Preview, Production | URL de token OAuth (requerida por `lib/port-houston/auth.ts`). |
| `PORT_HOUSTON_CLIENT_ID` | Preview, Production | Client ID OAuth. |
| `PORT_HOUSTON_CLIENT_SECRET` | Preview, Production | **Secreto.** |
| `PORT_HOUSTON_OPERATOR` | Opcional | Por defecto el código usa `POHA` si no se define. |
| `RESEND_API_KEY` | Preview, Production | Si usas envío de correo con Resend. |
| `CRON_SECRET` | Production (y Preview si pruebas cron a mano) | Cadena aleatoria larga; Vercel Cron la envía como `Authorization: Bearer …` al endpoint de rotación (ver más abajo). |

- Marca como **sensitive** las claves que Vercel permita ocultar en logs.  
- Tras cambiar variables, **vuelve a desplegar** (redeploy) para que surtan efecto.

Referencia local: `env.example` (incluye `PORT_HOUSTON_AUTH_URL` y `CRON_SECRET` comentados).

### 4. `NEXT_PUBLIC_APP_URL` en preview

Para **cada** URL de preview o de producción en Vercel:

- Pon `NEXT_PUBLIC_APP_URL` igual a la URL pública **sin barra final**, por ejemplo:  
  `https://tu-proyecto-xxx.vercel.app`

Ese valor se usa en enlaces de invitación, callbacks y plantillas de correo. Si está mal, el login por enlace y el auth por email pueden romperse.

**Opción práctica:** en el primer despliegue usa la URL que te asigne Vercel; cuando tengas dominio definitivo, actualiza la variable en **Production** y en **Preview** si las previews también deben redirigir bien.

### 5. Supabase Auth (imprescindible para login en Vercel)

En el panel de Supabase → **Authentication → URL configuration**:

1. **Site URL:** la URL principal que usan los usuarios (para preview puede ser tu `https://….vercel.app`).  
2. **Redirect URLs:** añade explícitamente:
   - `https://TU-DEPLOY.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback` (si sigues desarrollando en local)

Sin esto, OAuth y magic links pueden fallar en el entorno desplegado.

### 6. Primer despliegue y comprobaciones

1. Haz **Deploy** (o push a la rama conectada).  
2. Revisa que el build termine en verde.  
3. Abre la URL del deployment y prueba:
   - carga de la home / login;
   - acceso al dashboard tras autenticar;
   - una API que use Supabase (por ejemplo listados que ya uses en local).

Si algo falla, revisa **Runtime Logs** en Vercel y los logs de Supabase (Auth / API).

### 7. Cron de Port Houston (`vercel.json`)

El repo define un cron que llama a `/api/port-houston/rotate` cada **15 minutos** (ver `vercel.json`).

- En **Vercel**, los **Cron Jobs** suelen ejecutarse en despliegues de **Production**, no en cada Preview. Comprueba en la documentación y en el plan de tu equipo si tu cuenta tiene crons habilitados.  
- El endpoint acepta autenticación con cabecera `Authorization: Bearer <CRON_SECRET>` cuando `CRON_SECRET` está definida; sin eso, el cron de Vercel debe estar configurado para enviar esa cabecera si tu implementación lo exige (o dependerás de invocaciones manuales autenticadas como usuario).

La ruta usa `maxDuration = 60` segundos: en planes con límite bajo de tiempo de función, revisa si necesitas ajustar plan o lógica.

### 8. Antes de pasar a dominio propio o VPS

- Repite la configuración de **Supabase Redirect URLs** y **`NEXT_PUBLIC_APP_URL`** con el dominio final.  
- Rota o separa **secrets** entre staging y producción si aplica.  
- Vuelve a ejecutar `npm run build` y un despliegue de prueba.  
- En VPS, el flujo no es el de Vercel: necesitarías Node/PM2/Docker u orquestador, variables de entorno equivalentes y **no** usarías los crons de Vercel (sustituir por cron del sistema u otro scheduler).

---

## Estructura relevante

- `app/` — rutas App Router y API routes  
- `components/` — UI por dominio  
- `lib/` — lógica de negocio, Supabase, Port Houston, email  
- `supabase/migrations/` — migraciones SQL  
- `vercel.json` — configuración de crons en Vercel  
- `env.example` — plantilla de variables de entorno

---

## Documentación adicional

En la carpeta `docs/` hay material de referencia del proyecto (plantillas, ejemplos de accesoriales, etc.).

---

## Geolocalización en el TMS

- **Orígenes de tarifa (`lane_origins`)**  
  Los mapas de zona (p. ej. en **Pay rates → Rate profiles → Zone Maps**) usan `latitude` / `longitude` guardados en base de datos. Si faltan, la UI puede ofrecer geocodificar o completar coordenadas manualmente (matriz de orígenes / modales según pantalla).

- **API de orígenes** — `GET` / `POST` / `PATCH` en `app/api/drivers/pay-rates/origins/route.ts`  
  - `POST`: si no envías lat/lng pero sí **ciudad y estado**, el servidor intenta rellenar con **Nominatim** (OpenStreetMap).  
  - `PATCH` **sin** `origin_id`: backfill de orígenes **activos** con `latitude` nulo y con ciudad+estado; respeta ~**1 petición por segundo** a Nominatim.  
  - `PATCH` con `origin_id` + `latitude` / `longitude`: actualiza un origen concreto (útil para correcciones manuales).

- **Mapa en el panel de carga** — `components/maps/LoadSidebarMap.tsx`  
  Geocodifica en el **navegador** las cadenas de pickup / delivery / return (Nominatim) y traza rutas por carretera con **OSRM** cuando hay varios puntos. Es independiente de lo que haya guardado en `lane_origins`.

- **Límites prácticos**  
  Nominatim puede **no encontrar** direcciones incompletas o devolver un **punto genérico** (centro de ciudad) si la consulta es ambigua. Sin **ciudad + estado** en un origen, el backfill automático del `PATCH` **no** puede geocodificar. Respeta la política de uso de OSM (no abusar del volumen en producción).

- **Plan de datos y calidad**  
  Para auditoría, backfill ordenado y casos límite, enlaza con **`README_STEPS_NEXTS.md` (Anexo A)** y las tarjetas de geolocalización en **`TAREAS_TRELLO.md`**.

---

## Tareas Trello

Las tarjetas (Semanas 1–3) están en **`TAREAS_TRELLO.md`** en español, listas para copiar a Trello.
