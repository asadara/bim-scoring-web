# Cloudflare Migration Handover - A2.2 Finalization

Tanggal: 2026-03-06

Dokumen ini untuk melanjutkan finalisasi A2.2 dari device lain.

## Status Terbaru

- A2.2 selesai pada 2026-03-06 (final verifikasi pass).
- Version ID gateway: `031a2f8d-7508-4eea-b0bf-30269c6bcb16`.

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
4. Jika sudah redeploy tapi unknown origin masih lolos, cek ulang bahwa variable di-set pada environment **Production** (bukan Preview) dan tanpa tanda kutip tambahan.

## Verifikasi dari Terminal

Jalankan di repo web:

```powershell
cd d:\PROJECTS\bim-scoring-web\bcl_scoring
$env:WEB_BASE_URL='https://bcl-scoring.asadara83.workers.dev'
$env:API_BASE_URL='https://bcl-api-gateway.asadara83.workers.dev'
npm run smoke:cloudflare
$env:EXPECTED_API_HOST='bcl-api-gateway.asadara83.workers.dev'
npm run smoke:live-api-base
npm run smoke:gateway-hardening
```

## Kriteria Selesai

- `smoke:cloudflare` pass.
- `smoke:live-api-base` pass.
- `smoke:gateway-hardening` pass (termasuk unknown origin diblok `403`).
- Tidak ada `onrender.com` di live frontend bundle.
- Catatan validasi CORS hardening:
  - Request origin valid harus kembali dengan `Access-Control-Allow-Origin` spesifik (bukan `*`).
  - Jika masih `*`, berarti `ALLOWED_ORIGINS` belum terbaca sesuai konfigurasi.

## Referensi

- Tracker utama workspace: `d:\PROJECTS\bim-scoring-web\doc\cloudflare-migration-tracker.md`
- Referensi gateway API: `d:\PROJECTS\bim-scoring-api\cloudflare_api_gateway\README.md`
- Script verifikasi live bundle: `d:\PROJECTS\bim-scoring-web\bcl_scoring\scripts\check-live-api-base.mjs`
