# Revisión RLS y operación (Tarea 22 — cierre)

Documento de apoyo para QA y handoff. **No sustituye** una auditoría de seguridad externa.

## 0. Migraciones relacionadas (operación)

- **Realtime (Tarea 20):** `supabase/migrations/20260505_task20_realtime_task21_indexes_task22_note.sql` añade tablas a la publicación `supabase_realtime` si faltan (ver `hooks/useRealtimeRefresh.ts`).
- **Import CSV / índices (Tarea 21):** `20260430_csv_import_staff_and_report_indexes.sql` define las RPC; la migración `20260505_...` refuerza índices con `IF NOT EXISTS` y avisa si las RPC no están.
- **Esta revisión (Tarea 22):** no sustituye ejecutar esas migraciones en el proyecto Supabase; el checklist de abajo sigue siendo manual donde aplique.

## 1. RLS y datos sensibles

- **Finanzas (`ar_invoices`, `ap_*`, pagos, settlements):** las rutas bajo `app/api/accounts-receivable/*` y `app/api/accounts-payable/*` validan rol (**admin**, **accounting**, **finance**) antes de mutar; el cliente no debe depender solo de la UI para ocultar datos. Revisar en Supabase que las políticas **SELECT** no expongan filas de otra organización si en el futuro el proyecto pasa a multi-tenant (hoy el modelo es principalmente single-org).
- **Cargas (`loads`):** políticas alineadas con **dispatcher** / **admin** y conductor asignado; transiciones críticas pasan por APIs que aplican reglas de negocio (p. ej. holds). Ver migraciones recientes en `supabase/migrations/*rls*` y `20260227_fix_loads_rls_insert_delete.sql`.
- **Conductores y grupos (`drivers`, `driver_groups`):** lectura staff; escritura vía API con **service role** donde aplica. El import CSV staff (`import_*_csv_transaction`) es **SECURITY DEFINER** y solo **`service_role`** tiene **EXECUTE** explícito.
- **Portal cliente / documentos (Testing Plan Phase 9):** validar que **storage** y **RLS** de tablas de documentos no permitan leer BOL/RC/peso de otro cliente; límite de **50 MB** debe cumplirse en API y en políticas de bucket si existen.

## 2. Port Houston — cron y límites de tiempo

- **Ruta:** `POST /api/port-houston/rotate` con `export const maxDuration = 60` (límite del runtime serverless del proveedor).
- **Vercel:** `vercel.json` programa el cron cada **15 minutos** (legado en repo).
- **Netlify:** no ejecuta `vercel.json`; configurar **Scheduled Functions** o un runner externo que llame al endpoint con header **`Authorization: Bearer $CRON_SECRET`**. Comprobar en el panel el **timeout** máximo del tier (puede ser **< 60 s** en planes básicos): si el proveedor corta antes, el rotate puede terminar en **503** o respuesta parcial; revisar logs y reducir `PER_CONTAINER_TIMEOUT_MS` o tamaño de lote si hace falta.
- **Variables críticas:** `PORT_HOUSTON_API_URL`, `PORT_HOUSTON_CLIENT_ID`, credenciales OAuth, `CRON_SECRET` (ver `env.example`).

## 3. Handoff soporte

- Logs: consola del runtime (Vercel/Netlify) y mensajes `[Rotate]` en **`/api/port-houston/rotate`**.
- Estado del rotate: tabla **`port_houston_sync`** clave `rotate_status` y UI **Rotation** en dispatcher si está habilitada.

## 4. Gaps sugeridos como backlog post-lanzamiento

- Pruebas E2E automáticas de Phase 9 (documentos, portal, RLS entre clientes) si aún no están en CI.
- Sustituir o complementar cron heredado de Vercel por un único documento de deploy centrado en **Netlify** cuando el corte de producción esté decidido.
