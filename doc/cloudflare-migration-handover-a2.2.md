# Cloudflare Migration Handover - A2.2 Finalization

Tanggal: 2026-03-06

Dokumen ini untuk melanjutkan finalisasi A2.2 dari device lain.

## Tujuan A2.2

Menstabilkan API gateway Cloudflare sebagai lapisan domain/API sebelum refactor runtime API penuh.

## Checklist Dashboard

1. Buka Worker `bcl-api-gateway` -> `Settings` -> `Variables and Secrets`.
2. Pastikan variable berikut:
   - `UPSTREAM_BASE_URL=https://bim-scoring-api.onrender.com`
   - `ALLOWED_ORIGINS=https://bcl-scoring.asadara83.workers.dev`
   - `BLOCK_UNKNOWN_ORIGIN=true`
   - `ALLOWED_PATH_PREFIXES=/health,/ready,/version,/projects,/periods,/admin,/auth,/role2,/summary,/summary_snapshots,/summary-snapshots,/snapshots,/v2`
   - `ALLOWED_METHODS=GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS`
3. Redeploy Worker `bcl-api-gateway`.

## Verifikasi dari Terminal

Jalankan di repo web:

```powershell
cd d:\PROJECTS\bim-scoring-web\bcl_scoring
$env:WEB_BASE_URL='https://bcl-scoring.asadara83.workers.dev'
$env:API_BASE_URL='https://bcl-api-gateway.asadara83.workers.dev'
npm run smoke:cloudflare
$env:EXPECTED_API_HOST='bcl-api-gateway.asadara83.workers.dev'
npm run smoke:live-api-base
```

## Kriteria Selesai

- `smoke:cloudflare` pass.
- `smoke:live-api-base` pass.
- Tidak ada `onrender.com` di live frontend bundle.

## Referensi

- Tracker utama workspace: `d:\PROJECTS\cloudflare-migration-tracker.md`
- Audit write-path: `d:\PROJECTS\cloudflare-api-write-path-audit.md`
- Script verifikasi live bundle: `d:\PROJECTS\bim-scoring-web\bcl_scoring\scripts\check-live-api-base.mjs`
