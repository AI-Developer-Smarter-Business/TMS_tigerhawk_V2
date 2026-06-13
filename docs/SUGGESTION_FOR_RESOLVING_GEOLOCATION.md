# SUGGESTION_FOR_RESOLVING_GEOLOCATION

Word export: `SUGGESTION_FOR_RESOLVING_GEOLOCATION.docx` in this folder. Regenerate from repo root: `python scripts/build_geolocation_suggestion_docx.py`.

Short guide: data in Supabase, optional external APIs, and Week‑1 “implementation mode” next steps. **No code changes are implied here**—review this doc before implementing.

---

## 1. What to do in Supabase

- **Primary table for stored coordinates (zone maps, pay origins):** `lane_origins` — columns `latitude`, `longitude` (plus `city`, `state`, `address` for geocoding input).
- **Audit (SQL or Table Editor):** list rows where `latitude` or `longitude` is null; prioritise active rows (`is_active = true`) that have **city + state** (the app’s server backfill uses only those).
- **Fix data:** either run the existing bulk geocode flow (see README → *Geolocation* / `PATCH` on origins API) **or** set `latitude` / `longitude` manually per row for exceptions.
- **Optional schema hardening (future migration):** add something like `coordinate_source` (`nominatim` | `manual` | `import` | `external_api`) and timestamps so you know how each point was obtained—helps regression and support.

You do **not** need a special “Supabase geolocation product”: coordinates are normal columns; RLS and keys stay as today.

---

## 2. Manual tables vs external provider

| Approach | When it fits |
|----------|----------------|
| **Manual / Table Editor / PATCH by `origin_id`** | Few bad rows, ambiguous addresses, or legal need to pin an exact gate/yard. |
| **Free OSM stack (Nominatim + throttling)** | Already used in-repo; fine for moderate volume and US-centric city/state geocoding; respect [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/). |
| **External provider (Google Maps, Mapbox, HERE, etc.)** | High volume, SLA, stricter address parsing, or fewer ambiguous results. You would call their API from **your backend** (not expose keys in the browser), store lat/lng in the same tables, and record `coordinate_source`. |

**Summary:** start with **data completeness in Supabase** + existing Nominatim paths; use **manual** for outliers; **contract a provider** only if free tier / quality / rate limits block the business.

---

## 3. Week 1 — “Implementation mode” (concrete next steps)

Aligned with `README_STEPS_NEXTS.md` (Annex A). Typical order:

1. **Harden `POST` / `PATCH`** (`app/api/drivers/pay-rates/origins/route.ts`): e.g. bounding box for US ops, optional reverse geocode check vs `state`, reject or flag suspicious pairs before write.
2. **Add `coordinate_source`** (migration): every insert/update sets provenance; UI can show “auto vs manual”.
3. **Backfill job or script with logs**: batch by id, 1 req/s (or provider quota), log success/skip/fail per row; idempotent updates; dry-run option if you add a script.
4. **Centralise geocoding on the server** for forms that today call Nominatim from the client—single User-Agent, keys for paid APIs, consistent validation.

---

## 4. UI regression (after any backfill)

Re-test: Rate profiles → **Zone Maps**, lane origin matrix / geocode buttons, load detail **LoadSidebarMap** (good vs messy addresses).

---

## 5. References in this repo

- `README_ENGLISH.md` / `README_SPANISH.md` — section *Geolocation in the TMS*.
- `README_STEPS_NEXTS.md` — **Annex A** (maps & geocoding).
- Code pointers: `app/api/drivers/pay-rates/origins/route.ts`, `components/maps/LoadSidebarMap.tsx`, `components/tables/LaneRateMatrixView.tsx`, `components/tables/RateProfilesView.tsx` + `components/maps/ZoneMap.tsx`.
