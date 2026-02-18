---
title: Render to OCI Wave 0 Evidence
project: BIM Scoring Platform
status: PARTIAL_PASS
executed_at: 2026-02-16 15:42:13 +07:00
owner: DevOps / Release
---

# Wave 0 Execution Evidence

Referensi runbook: `doc/render-to-oci-migration-runbook.md`

## 1) Freeze Baseline Snapshot

- API repo (`d:/PROJECTS/bim-scoring-api`)
  - `HEAD`: `533f0b2db0a27c109e04d5fcd8d9d0008522ca58`
  - Working tree: clean pada saat snapshot.
- Web repo (`d:/PROJECTS/bim-scoring-web`)
  - `HEAD`: `882bef623f720351ed727d0a88f992a005d4e9a1`
  - Working tree: ada untracked file `doc/render-to-oci-migration-runbook.md`.

## 2) Production Env Inventory (Names Only)

Catatan: nilai secret Render/Supabase tidak diekstrak ke dokumen ini, hanya nama variabel wajib untuk parity saat migrasi.

- API required:
  - `APP_ENV`
  - `SUPABASE_URL_DEVELOPMENT|STAGING|PRODUCTION`
  - `SUPABASE_SERVICE_ROLE_KEY_DEVELOPMENT|STAGING|PRODUCTION`
- Web required:
  - `NEXT_PUBLIC_APP_ENV`
  - `NEXT_PUBLIC_BIM_SCORING_API_BASE_URL_DEVELOPMENT|STAGING|PRODUCTION`
  - Legacy fallback: `NEXT_PUBLIC_API_BASE_URL_DEVELOPMENT|STAGING|PRODUCTION`
- Web optional control:
  - `NEXT_PUBLIC_FEATURE_REAL_BACKEND_WRITE`

## 3) Baseline Health Check (Render Origin)

### API checks

- `GET https://bim-scoring-api.onrender.com/health` -> `200`
  - body: `ok=true`, `environment=production`, `db.status=up`
- `GET https://bim-scoring-api.onrender.com/ready` -> `200`
  - body: `ready=true`, `environment=production`, `db.status=up`

### Web route checks (HTTP status)

- `GET https://bim-scoring-web.onrender.com/` -> `200`
- `GET https://bim-scoring-web.onrender.com/projects` -> `200`
- `GET https://bim-scoring-web.onrender.com/ho/review` -> `200`
- `GET https://bim-scoring-web.onrender.com/approve` -> `200`
- `GET https://bim-scoring-web.onrender.com/audit` -> `200`

## 4) Smoke Script Result

Command:

```bash
cd d:/PROJECTS/bim-scoring-web/bcl_scoring
npm run smoke:render
```

Result: `FAILED (2 checks)`

- PASS:
  - web root
  - legacy route alias
  - dashboard JS asset
  - `/projects`
  - `/audit`
  - API `/health`
  - API `/ready`
- FAIL:
  - `/ho/review` marker check (`Review` / `Role 2`) tidak ditemukan
  - `/approve` marker check (`Approve` / `Approval`) tidak ditemukan

Interpretasi:
- Route `/ho/review` dan `/approve` tetap `HTTP 200`.
- Kegagalan saat ini terlokalisasi pada rule marker konten smoke script, bukan indikasi service down.

## 5) Rollback Trigger Baseline (Wave 0 Confirmation)

Trigger rollback untuk cutover nanti tetap:

1. API `health`/`ready` non-200 atau payload flag gagal.
2. Route kritikal web tidak `200`.
3. Error rate atau timeout naik signifikan setelah cutover.
4. Flow kritikal role (projects/review/approve/audit) gagal di smoke/E2E.

## 6) Gate Decision

- Wave 0 status: `PARTIAL_PASS`
- Alasan:
  - baseline availability API + route web kritikal terkonfirmasi.
  - smoke script butuh penyesuaian marker untuk halaman `/ho/review` dan `/approve` sebelum dipakai sebagai gate otomatis final cutover.
