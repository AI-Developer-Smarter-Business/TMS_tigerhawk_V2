# TigerHawk TMS

Transportation management system (TMS) for port drayage, built with **Next.js 16** (App Router), **React 19**, **TypeScript**, **Supabase**, and **Tailwind CSS**.

---

## Local requirements

- **Node.js** 18 or newer  
- **npm** (or another compatible package manager)  
- A **Supabase** project with migrations applied (`supabase/migrations/`)

### Development on your machine

1. Clone the repository and install dependencies:

   ```bash
   npm install
   ```

2. Copy environment variables and fill them in:

   ```bash
   cp env.example .env.local
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

Useful commands: `npm run build`, `npm run start`, `npm run lint`, `npx tsc --noEmit`.

---

## Successful deployment on Vercel (preview / before production)

Use this flow to validate the build and the app on a **Vercel** URL (`*.vercel.app`) before pointing a custom domain or moving to a **VPS**.

### 1. Code in a Git repository

Vercel deploys from **GitHub**, **GitLab**, or **Bitbucket**. Make sure the branch you deploy builds locally:

```bash
npm run build
```

If the build fails here, it will fail on Vercel.

### 2. Create the project in Vercel

1. Go to [vercel.com](https://vercel.com) and sign in.  
2. **Add New… → Project** and import the repository.  
3. **Framework Preset:** Next.js (auto-detected).  
4. **Root Directory:** repository root (where `package.json` and `app/` live).  
5. **Build Command:** `npm run build` (default).  
6. **Output:** left automatic for Next.js.  
7. **Install Command:** `npm install` (default).

Do not change this unless your monorepo uses a different root folder.

### 3. Environment variables in Vercel

In the project: **Settings → Environment Variables**. Add the **same keys** as in `.env.local`, per environment:

| Variable | Recommended environments for “dev/preview” | Notes |
|----------|---------------------------------------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Preview, Production | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Preview, Production | Anonymous (public) key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Preview, Production | **Secret.** Server / API routes only. |
| `NEXT_PUBLIC_APP_URL` | Preview, Production | **Exact** deployment URL (see step 5). |
| `PORT_HOUSTON_API_URL` | Preview, Production | Port Houston API base URL. |
| `PORT_HOUSTON_AUTH_URL` | Preview, Production | OAuth token URL (required by `lib/port-houston/auth.ts`). |
| `PORT_HOUSTON_CLIENT_ID` | Preview, Production | OAuth client ID. |
| `PORT_HOUSTON_CLIENT_SECRET` | Preview, Production | **Secret.** |
| `PORT_HOUSTON_OPERATOR` | Optional | Code defaults to `POHA` if unset. |
| `RESEND_API_KEY` | Preview, Production | If you send email with Resend. |
| `CRON_SECRET` | Production (and Preview if you test cron manually) | Long random string; Vercel Cron sends it as `Authorization: Bearer …` to the rotation endpoint (see below). |

- Mark keys as **sensitive** when Vercel allows hiding them in logs.  
- After changing variables, **redeploy** so they take effect.

Local reference: `env.example` (includes `PORT_HOUSTON_AUTH_URL` and `CRON_SECRET` commented).

### 4. `NEXT_PUBLIC_APP_URL` on preview

For **each** preview or production URL on Vercel:

- Set `NEXT_PUBLIC_APP_URL` to the public URL **without a trailing slash**, for example:  
  `https://your-project-xxx.vercel.app`

This value is used in invite links, callbacks, and email templates. If it is wrong, magic-link login and email auth can break.

**Practical tip:** on first deployment use the URL Vercel assigns; when you have a final domain, update the variable in **Production** and in **Preview** if previews must redirect correctly too.

### 5. Supabase Auth (required for login on Vercel)

In the Supabase dashboard → **Authentication → URL configuration**:

1. **Site URL:** the main URL users hit (for preview it can be your `https://….vercel.app`).  
2. **Redirect URLs:** add explicitly:
   - `https://YOUR-DEPLOY.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback` (if you still develop locally)

Without this, OAuth and magic links can fail in the deployed environment.

### 6. First deployment and checks

1. Run **Deploy** (or push to the connected branch).  
2. Confirm the build finishes successfully.  
3. Open the deployment URL and verify:
   - home / login loads;
   - dashboard access after sign-in;
   - an API that uses Supabase (e.g. lists you already use locally).

If something fails, check **Runtime Logs** in Vercel and Supabase logs (Auth / API).

### 7. Port Houston cron (`vercel.json`)

The repo defines a cron that calls `/api/port-houston/rotate` every **15 minutes** (see `vercel.json`).

- On **Vercel**, **Cron Jobs** usually run on **Production** deployments, not every Preview. Check Vercel docs and your team plan for whether crons are enabled on your account.  
- The endpoint accepts `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set; without it, Vercel’s cron must send that header if your implementation requires it (or you rely on manual authenticated calls).

The route uses `maxDuration = 60` seconds: on plans with low function timeouts, review whether you need a different plan or logic.

### 8. Before moving to a custom domain or VPS

- Repeat **Supabase Redirect URLs** and **`NEXT_PUBLIC_APP_URL`** with the final domain.  
- Rotate or separate **secrets** between staging and production if applicable.  
- Run `npm run build` again and a test deployment.  
- On a VPS the flow is not Vercel’s: you need Node/PM2/Docker or an orchestrator, equivalent environment variables, and you **do not** use Vercel crons (replace with system cron or another scheduler).

---

## Relevant structure

- `app/` — App Router routes and API routes  
- `components/` — domain UI  
- `lib/` — business logic, Supabase, Port Houston, email  
- `supabase/migrations/` — SQL migrations  
- `vercel.json` — Vercel cron configuration  
- `env.example` — environment variable template

---

## Additional documentation

The `docs/` folder contains project reference material (templates, accessorial examples, etc.).

---

## Geolocation in the TMS

- **Pay-rate origins (`lane_origins`)**  
  Zone maps (e.g. **Pay rates → Rate profiles → Zone Maps**) use stored `latitude` / `longitude`. If they are missing, the UI may offer geocoding or manual coordinates (origin matrix / modals depending on the screen).

- **Origins API** — `GET` / `POST` / `PATCH` at `app/api/drivers/pay-rates/origins/route.ts`  
  - `POST`: if lat/lng are omitted but **city and state** are sent, the server fills coordinates via **Nominatim** (OpenStreetMap).  
  - `PATCH` **without** `origin_id`: backfills **active** origins with null `latitude` and both city and state; throttles to roughly **one request per second** to Nominatim.  
  - `PATCH` with `origin_id` + `latitude` / `longitude`: updates a single origin (manual correction).

- **Load sidebar map** — `components/maps/LoadSidebarMap.tsx`  
  Geocodes pickup / delivery / return **strings in the browser** (Nominatim) and draws driving routes with **OSRM** when multiple points exist. This is separate from stored `lane_origins` coordinates.

- **Practical limits**  
  Nominatim may **miss** incomplete addresses or return a **coarse point** (e.g. city centroid) when the query is ambiguous. Origins without **city + state** cannot be auto-backfilled by the bulk `PATCH`. Follow OpenStreetMap usage policy (do not hammer the public endpoint in production).

- **Data quality and backfill planning**  
  For audit steps, ordered backfill, and edge cases, see **`README_STEPS_NEXTS.md` (Annex A)** and the Trello-style cards in **`TAREAS_TRELLO.md`** (Spanish, copy-paste ready).

---

## Trello tasks

Week 1–3 cards live in **`TAREAS_TRELLO.md`** (Spanish). Use that file when copying titles and bodies into Trello.
