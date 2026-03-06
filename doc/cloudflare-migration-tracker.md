---
title: Cloudflare Migration Tracker (BIM Scoring Web + API)
status: IN PROGRESS
last_updated: 2026-03-07 00:09:00 +07:00
owner: Engineering / Release
---

# Cloudflare Migration Tracker

Dokumen ini jadi single source of truth rencana + progress migrasi dari Render ke Cloudflare.

## Objective

1. Tahap 1: pindahkan frontend `bim-scoring-web` ke Cloudflare.
2. Tahap 2: lepaskan dependency domain `*.onrender.com` untuk API, lalu migrasi API dari Render secara bertahap.

## Current Baseline (2026-03-06)

- Frontend build lokal sukses (`next build`, Next.js 16.1.6).
- Backend test suite lulus (`node --test`: pass 118, fail 0, skipped 1).
- Konfigurasi API base URL frontend sudah environment-driven (siap diarahkan ke domain baru API).
- API belum siap lift-and-shift langsung ke Workers karena masih ada ketergantungan Node/Express + filesystem config loader.
- Frontend sudah terdeploy ke Cloudflare Workers:
  - URL: `https://bcl-scoring.asadara83.workers.dev`
  - Version ID: `2142fe0d-acb9-4eb3-a6d6-19780cd6609b`

## Work Plan

## Phase 1 - Frontend to Cloudflare (Primary)

- [x] P1.0 Assessment readiness frontend + backend dependency selesai.
- [x] P1.1 Tambah dokumen/konfigurasi deploy Cloudflare untuk frontend (repo changes).
- [x] P1.2 Buat project Cloudflare dari repo `bim-scoring-web` (mode Workers/OpenNext).
- [x] P1.3 Set environment variables frontend di Cloudflare.
- [x] P1.4 Deploy pertama + smoke test route kritikal.
- [ ] P1.5 Mapping custom domain frontend dan verifikasi TLS/DNS.
- [ ] P1.6 Cutover traffic frontend ke Cloudflare.
- [ ] P1.7 Post-cutover monitoring + rollback window close.

## Phase 2 - API De-Render (Staged)

- [x] A2.0 Assessment feasibility migrasi API selesai (bukan lift-and-shift).
- [x] A2.1 Hilangkan exposure `*.onrender.com` dari sisi client (gunakan custom API domain).
- [x] A2.2 Stabilkan lapisan domain/API gateway di Cloudflare (proxy/caching/security baseline).
- [ ] A2.3 Refactor API untuk kompatibilitas runtime Cloudflare (Express/Node-specific parts).
- [ ] A2.4 Migrasi komponen stateful (rate limit/idempotency/cache) ke storage terdistribusi.
- [ ] A2.5 Cutover endpoint read-only dulu, lalu write-path.
- [ ] A2.6 Full cutover API + decommission Render.

## Owner Matrix

- `Codex/Engineering`:
  - Analisis codebase, perubahan repo, skrip smoke, checklist runbook, validasi build/test.
- `Anda (Dashboard Owner)`:
  - Setup resource Cloudflare di dashboard (Pages project, env vars/secrets, DNS/custom domain, token/permission).

## Cloudflare Dashboard Actions Required (Anda)

## Immediate (untuk mulai Tahap 1)

- [x] Login Cloudflare account yang akan dipakai produksi.
- [x] Buka `Workers & Pages` -> `Create` -> `Pages` -> connect ke repo frontend.
- [x] Siapkan environment variables Pages:
  - `NEXT_PUBLIC_APP_ENV`
  - `NEXT_PUBLIC_BIM_SCORING_API_BASE_URL_DEVELOPMENT`
  - `NEXT_PUBLIC_BIM_SCORING_API_BASE_URL_STAGING`
  - `NEXT_PUBLIC_BIM_SCORING_API_BASE_URL_PRODUCTION`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_FEATURE_REAL_BACKEND_WRITE` (default disarankan `false`)
- [ ] Siapkan custom domain frontend (mis. `app.<domain-anda>`), update DNS dan aktifkan proxy Cloudflare.
- [ ] Beri konfirmasi nama project Pages + domain target ke saya untuk saya kunci di tracker.

## Needed Before API De-Render Cutover

- [ ] Siapkan custom API domain (mis. `api.<domain-anda>`) di zone Cloudflare.
- [ ] Tentukan pola transisi:
  - Opsi transisi cepat: domain Cloudflare diarahkan dulu ke Render API (tanpa expose `onrender.com` ke client).
  - Opsi final: API dipindah runtime ke Cloudflare Workers.
- [ ] Aktifkan security baseline untuk API domain (WAF/rate limit policy sesuai kebutuhan).

## Dashboard Actions - Next (Tanpa Custom Domain Dulu)

- [x] Create Worker baru untuk API gateway (nama disarankan: `bcl-api-gateway`).
- [x] Set Worker variable `UPSTREAM_BASE_URL=https://bim-scoring-api.onrender.com`.
- [x] Set Worker variable `ALLOWED_ORIGINS=https://bcl-scoring.asadara83.workers.dev`.
- [x] Deploy Worker dan verifikasi:
  - `GET https://<worker-api>.workers.dev/health` -> `200`
  - `GET https://<worker-api>.workers.dev/ready` -> `200`
- [x] Update env frontend Cloudflare:
  - `NEXT_PUBLIC_BIM_SCORING_API_BASE_URL_PRODUCTION=https://<worker-api>.workers.dev`
- [x] Redeploy frontend lalu smoke check lintas route kritikal.

## Finalisasi A2.2 (Handover Device Lain)

Jika lanjut dari device lain, kerjakan urutan ini:

1. Worker `bcl-api-gateway` -> `Settings` -> `Variables and Secrets`, pastikan:
   - `UPSTREAM_BASE_URL=https://bim-scoring-api.onrender.com`
   - `ALLOWED_ORIGINS=https://bcl-scoring.asadara83.workers.dev`
   - `BLOCK_UNKNOWN_ORIGIN=true`
   - `ALLOWED_PATH_PREFIXES=/health,/ready,/version,/projects,/periods,/admin,/auth,/role2,/summary,/summary_snapshots,/summary-snapshots,/snapshots,/v2`
   - `ALLOWED_METHODS=GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS`
2. Redeploy `bcl-api-gateway`.
3. Verifikasi dari repo web:
   - `WEB_BASE_URL=https://bcl-scoring.asadara83.workers.dev API_BASE_URL=https://bcl-api-gateway.asadara83.workers.dev npm run smoke:cloudflare`
   - `WEB_BASE_URL=https://bcl-scoring.asadara83.workers.dev EXPECTED_API_HOST=bcl-api-gateway.asadara83.workers.dev npm run smoke:live-api-base`
   - `WEB_BASE_URL=https://bcl-scoring.asadara83.workers.dev API_BASE_URL=https://bcl-api-gateway.asadara83.workers.dev npm run smoke:gateway-hardening`
4. Jika tiga smoke pass, tandai A2.2 selesai lalu lanjut A2.3 (runtime compatibility refactor API).

## Progress Log

## 2026-03-06

- [x] Analisis coupling Render pada frontend dan API selesai.
- [x] Validasi readiness frontend untuk tahap 1 selesai.
- [x] Validasi test baseline backend selesai.
- [x] Identifikasi blocker utama migrasi penuh API ke Workers selesai.
- [x] Tracker migrasi ini dibuat sebagai dokumen jejak utama.
- [x] Deploy frontend ke Cloudflare sempat gagal karena mismatch service binding (`WORKER_SELF_REFERENCE` target tidak ditemukan), lalu selesai setelah nama Worker diselaraskan ke `bcl-scoring`.
- [x] Deploy sukses terkonfirmasi dengan URL aktif `https://bcl-scoring.asadara83.workers.dev` dan Version ID `0407f826-bb8c-46e3-a30e-5e7c3e19d48e`.
- [x] PR auto-config Cloudflare di GitHub sudah di-merge (`Add Cloudflare Workers configuration`, PR #1).
- [x] Smoke runtime pasca deploy lulus setelah mitigasi import SSR (`authClient` dimuat dinamis di client).
- [x] Build/deploy pipeline Cloudflare diperbaiki ke `Build command: npm ci` + `Deploy command: npm run deploy`; deploy terbaru sukses (Version ID `2142fe0d-acb9-4eb3-a6d6-19780cd6609b`).
- [x] Mitigasi code-level disiapkan: validasi env dipindah dari SSR module-scope ke client-side (`src/pages/_app.tsx`) untuk mencegah crash `500` di Worker runtime.
- [x] Mitigasi konfigurasi Wrangler disiapkan: `keep_vars=true` ditambahkan di `bcl_scoring/wrangler.jsonc` agar deploy tidak menghapus Variables/Secrets yang di-set di Cloudflare Dashboard.
- [x] Root cause error `500` teridentifikasi dari observability: Worker gagal load external module `@supabase/supabase-js-*` saat SSR.
- [x] Mitigasi SSR import disiapkan:
  - `_app.tsx`: import `authClient` diubah menjadi dynamic import di `useEffect`.
  - `MainNav.tsx`: hapus import statis `authClient`; sign-out pakai dynamic import saat action dijalankan.
- [x] Verifikasi pengguna: deployment frontend Cloudflare sudah berjalan normal (konfirmasi "berhasil").
- [x] Script smoke/cutover diperbarui untuk migrasi Cloudflare: fallback default `onrender.com` dihapus; `API_BASE_URL` sekarang wajib eksplisit.
- [x] README frontend diperbarui untuk command smoke Cloudflare (`smoke:cloudflare`, custom domain smoke, id-route smoke dengan API domain eksplisit).
- [x] Keputusan operasional sementara: custom domain frontend ditunda; traffic tetap pakai `workers.dev` selama tahap stabilisasi.
- [x] Paket transisi API gateway disiapkan di repo API (`bim-scoring-api/cloudflare_api_gateway`) untuk menyembunyikan origin Render dari client tanpa menunggu custom domain.
- [x] Validasi lokal gateway worker lulus (forward path/query + CORS header) sebelum deploy dashboard.
- [x] Worker `bcl-api-gateway` berhasil terdeploy via Cloudflare build pipeline (Version ID `e474af46-8f32-495d-91ab-e15ddcb01170`).
- [x] Runtime fallback gateway ditambahkan (`UPSTREAM_BASE_URL` -> `API_BASE_URL` -> `BIM_SCORING_API_BASE_URL` -> default Render API) untuk mencegah `500` saat variable dashboard belum sinkron.
- [x] Verifikasi eksternal gateway sukses: `GET /health` dan `GET /ready` pada `https://bcl-api-gateway.asadara83.workers.dev` sudah `200`.
- [x] Verifikasi smoke lintas web+api lulus dengan endpoint Cloudflare:
  - `WEB_BASE_URL=https://bcl-scoring.asadara83.workers.dev`
  - `API_BASE_URL=https://bcl-api-gateway.asadara83.workers.dev`
  - Hasil: seluruh check route kritikal + `/health` + `/ready` = `OK`.
- [x] Script verifikasi live bundle ditambahkan: `bcl_scoring/scripts/check-live-api-base.mjs` (`npm run smoke:live-api-base`).
- [x] Verifikasi live bundle terbaru: frontend produksi sudah embed host gateway (`bcl-api-gateway.asadara83.workers.dev`) dan tidak lagi memuat `onrender.com` (`smoke:live-api-base` pass).
- [x] A2.1 dinyatakan selesai: exposure domain API `*.onrender.com` sudah dihapus dari client bundle produksi.
- [x] Hardening baseline gateway diterapkan di kode:
  - kontrol opsional `ALLOWED_METHODS`, `ALLOWED_PATH_PREFIXES`, `BLOCK_UNKNOWN_ORIGIN`
  - tracing `X-BCL-Request-Id` + forward `X-Request-Id` ke upstream
  - guard observability: `/health`, `/ready`, `/version` selalu allowed
- [x] Deploy hardening gateway terpublikasi ke `main`:
  - `39352e2` (`feat(gateway): add hardening controls for origin/method/path and request tracing`)
  - `6988cc7` (`fix(gateway): always allow health and readiness paths`)
- [x] Menunggu aksi dashboard (A2.2): set variable gateway permanen (`UPSTREAM_BASE_URL`, `ALLOWED_ORIGINS`, `ALLOWED_PATH_PREFIXES`, `BLOCK_UNKNOWN_ORIGIN`) lalu verifikasi ulang smoke.
- [x] Re-run verifikasi lintas endpoint Cloudflare:
  - `smoke:cloudflare` pass (web route kritikal + `/health` + `/ready` = `OK`).
  - `smoke:live-api-base` pass (bundle live tetap tidak memuat `onrender.com`).
- [x] Tambah script verifikasi hardening gateway: `npm run smoke:gateway-hardening`.
- [x] Hasil `smoke:gateway-hardening` sempat menunjukkan gap A2.2 (status historis, sudah ditutup):
  - `blocked path` sudah aktif (`403 Path is not allowed`).
  - `unknown origin` belum diblok (`/ready` dari `https://evil.example` masih `200`).
  - Implikasi: `BLOCK_UNKNOWN_ORIGIN` dan/atau `ALLOWED_ORIGINS` di dashboard worker belum efektif; perlu set/redeploy lalu smoke ulang.
- [x] Re-verifikasi pasca build sukses:
  - `smoke:live-api-base` tetap pass.
  - `smoke:cloudflare` sempat timeout intermiten di `/health`, namun cek ulang langsung `/health` memberi `200` konsisten.
- [x] Gap A2.2 sempat terbuka setelah build terbaru (status historis, sudah ditutup):
  - `smoke:gateway-hardening` masih gagal pada skenario unknown origin.
  - Request `Origin: https://evil.example` ke `/ready` masih `200`.
  - Header respons masih `Access-Control-Allow-Origin: *` (indikasi `ALLOWED_ORIGINS` production belum terbaca sebagai allowlist spesifik).
- [x] Redeploy manual gateway dari dashboard berhasil dengan binding runtime vars terkonfirmasi:
  - Version ID: `031a2f8d-7508-4eea-b0bf-30269c6bcb16`
  - Binding terdeteksi: `UPSTREAM_BASE_URL`, `ALLOWED_ORIGINS`, `BLOCK_UNKNOWN_ORIGIN`, `ALLOWED_PATH_PREFIXES`, `ALLOWED_METHODS`
- [x] Verifikasi final A2.2 lulus:
  - `smoke:cloudflare` pass
  - `smoke:live-api-base` pass
  - `smoke:gateway-hardening` pass
  - Cek manual: `Origin: https://evil.example` ke `/ready` sekarang `403 Origin is not allowed`
- [x] Kickoff A2.3 dilakukan:
  - Script audit kompatibilitas runtime ditambahkan di repo API: `npm run audit:cloudflare-compat`
  - Hasil audit mengonfirmasi blocker utama: `express-server`, `fs-usage`, `cjs-bridge`, `process.env` direct usage
  - Rencana teknis A2.3 dibuat: `bim-scoring-api/docs/ops/cloudflare-a2.3-runtime-compat-plan-2026-03-06.md`
- [x] A2.3 Wave 1 dimulai (refactor baseline tanpa ubah perilaku API):
  - Tambah `configureApp(app, { supabaseFactory })` di `src/app.js` untuk memisahkan wiring middleware/route dari instansiasi Express.
  - `createApp()` diubah menjadi wrapper yang memanggil `configureApp(...)` (kompatibel dengan test existing).
  - Validasi lolos: `npm run build`, `node --test test/contract/summary.v2.http.test.js`.
- [x] Audit script A2.3 diperbaiki agar tidak menghitung komentar sebagai hit:
  - `scripts/cloudflare-runtime-compat-audit.mjs` sekarang skip line comment + block comment.
  - Hasil audit lebih akurat; hit `express-server` turun menjadi 2 (`import express`, `app.listen` di `server.js`).
- [x] A2.3 Wave 2 dimulai (abstraksi config loader):
  - `projectConfigProvider.cjs` ditambahkan dengan provider abstraction (`file` + `in-memory`).
  - `loadProjectConfig.cjs` direfactor untuk membaca config melalui `provider.load(projectId)`.
  - `runProjectScoring.cjs` menerima `configProvider` opsional (kompatibel mundur untuk path existing).
  - Unit test baru pass: `test/unit/loadProjectConfig.provider.unit.test.js`.
  - Audit ulang: `fs-usage` turun dari 6 hit -> 3 hit (akses filesystem terpusat di provider file).
- [x] A2.3 Wave 3 dimulai (eliminasi CJS bridge di jalur runtime utama):
  - `createRequire` dihapus dari `src/app.js`; scoring import pindah ke `./scoring/runProjectScoring.js` (ESM).
  - Modul ESM jalur scoring ditambahkan (`runProjectScoring.js` + dependensi config/preprocess/engine adapter/engine).
  - Validasi kontrak summary pass:
    - `summary.v2.http.test.js`
    - `summary.v2.config-resolution.test.js`
    - `summary.v2.engine.integration.test.js`
  - Audit ulang: `cjs-bridge` turun dari 12 hit -> 8 hit (modul `.cjs` legacy masih tersisa untuk kompatibilitas bertahap).
- [x] A2.3 Wave 3 lanjut (pensiun modul CJS legacy selesai):
  - 7 file `.cjs` pada jalur scoring dihapus setelah versi ESM tervalidasi.
  - Test unit/contract yang sebelumnya memakai `createRequire` dipindah ke import ESM.
  - Validasi pass:
    - `test/unit/loadProjectConfig.provider.unit.test.js`
    - `test/contract/scoring.engine.scale.contract.test.js`
    - `test/contract/summary.v2.http.test.js`
  - Audit ulang: rule `cjs-bridge` tidak muncul lagi (0 hit).
- [x] A2.3 blocker cleanup lanjutan:
  - `express-static` dihapus dari `src/app.js`.
  - middleware CORS sementara yang memaksa `Access-Control-Allow-Origin: *` juga dihapus.
  - Audit ulang menunjukkan blocker `express-static` sudah hilang; total rules matched turun menjadi 5.
- [x] A2.3 Wave 4 selesai (runtime config adapter):
  - Adapter env tunggal ditambahkan di `src/runtimeEnv.js` (`Node` + `Worker`).
  - `runtimeConfig.js` direfactor agar seluruh pembacaan env lewat adapter.
  - Route/core yang sebelumnya membaca env langsung sudah dipindah:
    - `src/rateLimit.js`
    - `src/routes/evidenceSupportRoutes.js`
    - `src/routes/projectReadRoutes.js`
    - `src/app.js` (`WEB_APP_URL` melalui `runtimeConfig.webAppUrl`)
  - Audit ulang: `process-env` turun dari 14 hit -> 1 hit (sisa hanya di adapter Node, bukan route/core).
- [x] Penutupan Wave 4 tervalidasi:
  - Build lulus: `npm run build`.
  - Audit runtime lulus dengan snapshot blocker terbaru: `npm run audit:cloudflare-compat`.
  - Contract test kunci lulus:
    - `test/contract/rate-limiting.contract.test.js`
    - `test/contract/evidence.upload.v2.guard.contract.test.js`
    - `test/contract/summary.v2.http.test.js`
- [x] A2.3 Wave 5 selesai (Worker entry read-only pilot):
  - Paket Worker baru ditambahkan: `bim-scoring-api/cloudflare_api_readonly_pilot`
    - `src/index.mjs`
    - `wrangler.toml`
    - `README.md`
  - Policy pilot aktif:
    - method hanya `GET,HEAD,OPTIONS`
    - path di luar allowlist pilot ditolak (`403`)
    - endpoint metadata pilot: `GET /version`
  - Contract test runtime Worker lulus:
    - `test/contract/cloudflare.readonly-pilot.worker.contract.test.js`
    - skenario lulus: `/version`, method guard (`405`), path guard (`403`), proxy read-only path.
- [x] A2.3 auth-offload login (tanpa wakeup Render) selesai di gateway:
  - `cloudflare_api_gateway/src/index.mjs` sekarang menangani native:
    - `POST /auth/account-request`
    - `GET /auth/resolve-role/:userId`
    - `GET /auth/password-email/:employeeNumber`
  - Worker gateway memakai `SUPABASE_SERVICE_ROLE_KEY` untuk akses Supabase REST di path auth.
  - Smoke produksi pasca deploy menunjukkan header `X-BCL-Auth-Source: supabase-worker` pada route auth (indikasi tidak diproxy ke Render).
  - Contract test baru lulus:
    - `test/contract/cloudflare.gateway.auth-offload.contract.test.js`
- [x] A2.3 stabilisasi login pasca offload:
  - `GET /health` dan `GET /version` pada `bcl-api-gateway` dipindah ke edge response langsung (tanpa proxy Render) untuk menghindari wake-up dari backend handshake frontend.
  - Verifikasi runtime OAuth browser:
    - URL authorize Supabase memuat `redirect_to=https://bcl-scoring.asadara83.workers.dev/auth/sign-in`.
    - tidak terdeteksi redirect OAuth ke domain Render.
- [x] Guard domain legacy frontend ditambahkan:
  - Middleware web (`bcl_scoring/src/middleware.ts`) memaksa redirect `308` dari host Render legacy (`bim-scoring-web.onrender.com`, `bimscoringnke.onrender.com`) ke host canonical Cloudflare (`bcl-scoring.asadara83.workers.dev`) dengan path/query tetap.
  - Tujuan: mencegah user kembali masuk ke domain Render setelah login OAuth.
- [x] Offload read route pasca-login selesai:
  - `GET /projects` dan `GET /projects/queue-summary` sekarang ditangani native di gateway Worker (Supabase REST) dengan header `X-BCL-Read-Source: supabase-worker`.
  - Verifikasi gateway:
    - `/projects?limit=1` -> `200` + tanpa `x-render-origin-server`.
    - `/projects/queue-summary` -> `200` + tanpa `x-render-origin-server`.
  - Audit otomatis `npm run audit:render-leak` sekarang PASS (`bundleBlocked=0`, `apiLeak=0`).
- [x] Storage integration pilot (Google Drive auto-share Role 1 -> Role 2) ditambahkan:
  - Backend API baru:
    - `GET /v2/integrations/google-drive/status`
    - `GET /v2/integrations/google-drive/connect-url`
    - `GET /v2/integrations/google-drive/callback`
    - `POST /v2/integrations/google-drive/disconnect`
    - `GET /projects/:projectId/reviewer-role2-emails`
    - `POST /v2/projects/:projectId/evidence/gdrive/share`
  - Frontend Role 1 write flow (`save/submit evidence URL`) sekarang best-effort memicu auto-share endpoint.
  - Guard contract test route baru lulus (`google-drive.autoshare.guard.contract.test.js`).
- [x] Offload dashboard route tambahan untuk menutup ketergantungan Render pada landing dashboard:
  - Gateway `bcl-api-gateway` sekarang handle native via Supabase untuk:
    - `GET /projects/:projectId/periods`
    - `GET /projects/:projectId/periods/:periodId/indicator-scores`
    - `GET /summary/v2/bcl/dashboard`
  - Contract gateway diperluas dan lulus untuk route baru (`cloudflare.gateway.auth-offload.contract.test.js`, total test 10 pass).
  - Tujuan: menghilangkan `503 x-render-routing: suspend-by-user` pada dashboard saat Render API disuspend.

## Evidence

- Frontend runtime env mapping API: `bim-scoring-web/bcl_scoring/src/lib/runtimeEnv.ts`
- API Node server entrypoint: `bim-scoring-api/src/server.js`
- API Node/Express app adapter: `bim-scoring-api/src/app.js`
- Scoring config provider filesystem (sementara): `bim-scoring-api/src/scoring/config/projectConfigProvider.js`
- Existing phase log: `bim-scoring-web/doc/phase-status-log.md`
- Build/deploy log terbaru: `cloudeflare_log/build_cloudflare_log.log`
- API gateway worker (transition): `bim-scoring-api/cloudflare_api_gateway`
- Referensi operasional gateway: `bim-scoring-api/cloudflare_api_gateway/README.md`
- Audit kompatibilitas Worker runtime (A2.3): `bim-scoring-api/scripts/cloudflare-runtime-compat-audit.mjs`
- Runtime env adapter (A2.3 Wave 4): `bim-scoring-api/src/runtimeEnv.js`
- Rencana teknis A2.3: `bim-scoring-api/docs/ops/cloudflare-a2.3-runtime-compat-plan-2026-03-06.md`
- Provider config scoring (A2.3 Wave 2): `bim-scoring-api/src/scoring/config/projectConfigProvider.js`
- Entry scoring ESM (A2.3 Wave 3): `bim-scoring-api/src/scoring/runProjectScoring.js`
- Worker read-only pilot (A2.3 Wave 5): `bim-scoring-api/cloudflare_api_readonly_pilot/src/index.mjs`
- Contract test Worker read-only pilot: `bim-scoring-api/test/contract/cloudflare.readonly-pilot.worker.contract.test.js`
- Auth-native gateway offload: `bim-scoring-api/cloudflare_api_gateway/src/index.mjs`
- Contract test auth offload gateway: `bim-scoring-api/test/contract/cloudflare.gateway.auth-offload.contract.test.js`
- Verifikasi OAuth redirect (browser trace): Supabase authorize `redirect_to` -> `https://bcl-scoring.asadara83.workers.dev/auth/sign-in`
- Redirect guard canonical host frontend: `bim-scoring-web/bcl_scoring/src/middleware.ts`
- Render leak audit command: `bim-scoring-web/bcl_scoring/scripts/render-leak-audit.mjs`
- Google Drive auto-share routes: `bim-scoring-api/src/routes/googleDriveRoutes.js`
- Google Drive token schema: `bim-scoring-api/docs/ops/sql/create-user-google-drive-tokens.sql`
- Google Drive runbook: `bim-scoring-api/docs/ops/google-drive-auto-share.md`
- Frontend trigger auto-share: `bim-scoring-web/bcl_scoring/src/lib/role1TaskLayer.ts`
- Dashboard route offload gateway: `bim-scoring-api/cloudflare_api_gateway/src/index.mjs`

## Update Rule

- Setiap perubahan status wajib update:
  - `last_updated`
  - Checklist item yang berubah
  - 1 entri baru di `Progress Log`
- Jika ada keputusan arsitektur besar, catat ringkas di bagian `Progress Log` dengan tanggal.
