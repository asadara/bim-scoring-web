---
title: Render Supabase Continuity Checkpoint
project: BIM Scoring Platform
status: ACTIVE_INCIDENT_CLOSED
executed_at: 2026-02-18 11:29:18 +07:00
updated_at: 2026-02-20
owner: DevOps / Release
---

# Render + Supabase Continuity Checkpoint

Referensi:
- `doc/render-to-oci-migration-runbook.md`
- `doc/render-to-oci-step3-progress-2026-02-18.md`

## 1) Decision

Per 2026-02-18 11:29:18 +07:00, jalur migrasi OCI di-`HOLD` sementara karena akun OCI belum tersedia.
Mode operasi aktif dikembalikan ke `Render + Supabase` sampai blocker OCI selesai.

## 2) Live Check Evidence

### Web critical routes (Render)

Result:
- `200` `https://bim-scoring-web.onrender.com/`
- `200` `https://bim-scoring-web.onrender.com/projects`
- `200` `https://bim-scoring-web.onrender.com/ho/review`
- `200` `https://bim-scoring-web.onrender.com/approve`
- `200` `https://bim-scoring-web.onrender.com/audit`

### API health/readiness (Render)

Result:
- `TIMEOUT` `https://bim-scoring-api.onrender.com/health` (timeout 20-60 detik)
- `TIMEOUT` `https://bim-scoring-api.onrender.com/ready` (timeout 20-60 detik)

Catatan:
- Timeout terdeteksi dari environment eksekusi checkpoint ini.
- Perlu verifikasi silang di Render dashboard/log untuk memastikan apakah ini incident service, cold-start berkepanjangan, atau isu jaringan dari jalur pengecekan.

### Smoke gate (fail-fast) di mode continuity

Command:

```bash
cd d:/PROJECTS/bim-scoring-web/bcl_scoring
REQUEST_TIMEOUT_MS=15000 npm run smoke:render
```

Result:
- Web checks: `PASS`
- API `/health` dan `/ready`: `TIMEOUT`
- Exit status smoke: `FAIL (2 checks)`

Catatan:
- Script `smoke:render` telah diperbarui agar request fail-fast dengan timeout per endpoint (`REQUEST_TIMEOUT_MS`), sehingga tidak hang lama saat incident.

## 3) Temporary Execution Plan (While OCI Blocked)

1. Pertahankan Render sebagai host aktif web+api.
2. Jalankan check berkala route kritikal web + health/readiness API dengan timeout eksplisit.
3. Tetap jalankan gate kualitas sebelum perubahan:
   - `npm run smoke:render`
   - `npm run e2e`
4. Jika timeout API berlanjut, aktifkan prosedur rollback incident internal (tetap di Render) dan lakukan corrective action sebelum perubahan berikutnya.

## 4) Reopen Conditions for OCI Waves

Wave 1-5 migrasi OCI dibuka kembali jika seluruh syarat berikut terpenuhi:
1. Akun OCI aktif dan dapat dipakai provisioning VM.
2. Domain target final (`api.<domain>`, `app.<domain>`) sudah disetujui.
3. Akses Cloudflare DNS/SSL tersedia.

## 5) Addendum Closure (2026-02-20)

Verifikasi ulang continuity menunjukkan incident timeout API tidak tereproduksi:
1. `GET https://bim-scoring-api.onrender.com/health` -> `200`
2. `GET https://bim-scoring-api.onrender.com/ready` -> `200`
3. `GET https://bim-scoring-api.onrender.com/` + `Accept: text/html` -> `302` ke `https://bimscoringnke.onrender.com`
4. `npm run smoke:render` (WEB=`https://bimscoringnke.onrender.com`, API=`https://bim-scoring-api.onrender.com`) -> `PASS` seluruh checks.

Status incident continuity 2026-02-18: `CLOSED` untuk baseline operasional saat ini.
