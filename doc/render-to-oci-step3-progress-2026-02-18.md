---
title: Render to OCI Step 3 Progress Checkpoint
project: BIM Scoring Platform
status: ON_HOLD
executed_at: 2026-02-18 11:29:18 +07:00
owner: DevOps / Release
---

# Step 3 Progress Checkpoint (Wave 0-5)

Referensi utama: `doc/render-to-oci-migration-runbook.md`

## 1) Scope Checkpoint

Checkpoint ini memverifikasi status aktual Step 3 (`Wave 0` sampai `Wave 5`) dengan evidence berbasis command run terbaru di workspace.

Update keputusan:
- Per 2026-02-18 11:29:18 +07:00, Step 3 migrasi OCI masuk status `ON HOLD` sementara karena akun OCI belum siap.
- Operasi berjalan sementara di `Render + Supabase`.

## 2) Repo Baseline

- Web repo (`d:/PROJECTS/bim-scoring-web`)
  - `HEAD`: `e77d7ac6cae9612fdc10af4d79f2853540ca840a`
- API repo (`d:/PROJECTS/bim-scoring-api`)
  - `HEAD`: `533f0b2db0a27c109e04d5fcd8d9d0008522ca58`

## 3) Execution Evidence (2026-02-18)

### Web/API smoke baseline (Render)

Command:

```bash
cd d:/PROJECTS/bim-scoring-web/bcl_scoring
npm run smoke:render
```

Result:
- `PASS` (semua check lulus)
- Web routes: `/`, `/bcl/index.html`, `/projects`, `/ho/review`, `/approve`, `/audit` -> `200`
- API checks: `/health` (`ok=true`), `/ready` (`ready=true`)

### Custom-domain cutover dry-run

Command:

```bash
cd d:/PROJECTS/bim-scoring-web/bcl_scoring
CUSTOM_DOMAIN=bim-scoring-web.onrender.com npm run smoke:custom-domain
```

Result:
- `PASS`
- DNS resolved, TLS valid, HTTP->HTTPS redirect valid
- Route + API checks lulus

### E2E governance flow

Command:

```bash
cd d:/PROJECTS/bim-scoring-web/bcl_scoring
npm run e2e
```

Result:
- `PASS`
- `3 passed`

### API build/test readiness

Command:

```bash
cd d:/PROJECTS/bim-scoring-api
npm test
npm run build
```

Result:
- `npm test`: `PASS` (`tests=99, pass=98, fail=0, skipped=1`)
- `npm run build`: `PASS`
- Policy hardening tambahan lulus:
  - endpoint evidence legacy untuk Admin diset read-only (`403 FORBIDDEN_ROLE`) pada:
    - `/projects/:projectId/evidence/request-upload`
    - `/projects/:projectId/evidence/signed-upload`
    - `/indicator-inputs/:inputId/evidence`

### Render custom-domain control readiness

Command:

```bash
cd d:/PROJECTS/bim-scoring-web/bcl_scoring
npm run render:domain:list
```

Result:
- `BLOCKED`: `RENDER_API_KEY is required`

## 4) Wave Status Decision

| Wave | Status | Decision Note |
|---|---|---|
| Wave 0 | COMPLETE | Baseline availability + smoke lulus penuh. |
| Wave 1 | ON HOLD (BLOCKED) | Menunggu akun OCI aktif. |
| Wave 2 | ON HOLD (BLOCKED) | Bergantung Wave 1. |
| Wave 3 | ON HOLD (BLOCKED) | Bergantung Wave 1-2 + domain final. |
| Wave 4 | DEFERRED | Menunggu jalur OCI dibuka kembali. |
| Wave 5 | DEFERRED | Menunggu eksekusi Wave 4. |

## 5) Blocking Items to Close Step 3

1. Final domain produksi (`api.<domain>`, `app.<domain>`).
2. Akses OCI Console + provisioning VM Always Free.
3. Akses Cloudflare DNS/SSL (`Full (strict)`).
4. Env operasional untuk Render domain control (`RENDER_API_KEY`, `RENDER_WEB_SERVICE_ID`) bila tetap dipakai pada fase transisi.

## 6) Step 4 Readiness

Rollback procedure di runbook siap dipakai; baseline host lama sudah tervalidasi ulang (`smoke:render` pass).

## 7) Post-Rotation Validation Checkpoint (2026-02-18)

- Auth hardening and credential rotation: `COMPLETE`.
  - Google OAuth client lama dihapus, client baru aktif.
  - Supabase secret key lama sudah revoke, key baru sudah aktif.
  - Login flow `employee_number + password` dan `Google OAuth` tervalidasi berhasil di web service aktif.
- Web service produksi aktif: `https://bimscoringnke.onrender.com`.
- API produksi health/readiness: `PASS` (`/health=200`, `/ready=200`).
- Guard policy evidence legacy admin read-only: `PASS` (`403 FORBIDDEN_ROLE`).
- Catatan konfigurasi lanjutan:
  - Root API redirect (`GET /` dengan `Accept: text/html`) masih mengarah ke domain lama `https://bim-scoring-web.onrender.com`.
  - Action required: update env `WEB_APP_URL` di Render API ke domain web aktif `https://bimscoringnke.onrender.com`.
