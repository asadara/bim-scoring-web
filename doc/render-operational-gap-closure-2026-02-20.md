---
title: Render Operational Gap Closure
project: BIM Scoring Platform
status: CLOSED
date: 2026-02-20
owner: DevOps / Release
---

# Render Operational Gap Closure (2026-02-20)

Dokumen ini mencatat penutupan gap operasional yang sebelumnya terbuka pada checkpoint continuity 2026-02-18.

## 1) Scope Gap yang Ditutup

1. Gap timeout endpoint API Render (`/health`, `/ready`) pada jalur pengecekan sebelumnya.
2. Gap redirect root API (`GET /` dengan `Accept: text/html`) yang sebelumnya dilaporkan mengarah ke domain web lama.
3. Keputusan jalur deploy operasional: Render tetap primary, OCI diposisikan sebagai cadangan.

## 2) Evidence Verifikasi Ulang

Waktu verifikasi: 2026-02-20 (workspace check)

1. API health:
   - `GET https://bim-scoring-api.onrender.com/health` -> `200`
2. API readiness:
   - `GET https://bim-scoring-api.onrender.com/ready` -> `200`
3. Root redirect HTML:
   - `GET https://bim-scoring-api.onrender.com/` dengan `Accept: text/html` -> `302`
   - `Location: https://bimscoringnke.onrender.com`
4. Smoke check lintas route web + API:
   - Command:
     - `WEB_BASE_URL=https://bimscoringnke.onrender.com API_BASE_URL=https://bim-scoring-api.onrender.com REQUEST_TIMEOUT_MS=45000 npm run smoke:render`
   - Result:
     - `PASS` (semua checks `OK`)
5. Custom-domain cutover check (di domain Render aktif):
   - Command:
     - `CUSTOM_DOMAIN=bimscoringnke.onrender.com API_BASE_URL=https://bim-scoring-api.onrender.com npm run smoke:custom-domain`
   - Result:
     - `PASS` (DNS/TLS/HTTP redirect + route kritikal + API checks `OK`)

## 3) Keputusan Operasional

1. Jalur deploy aktif tetap `Render + Supabase`.
2. OCI tetap dicatat sebagai jalur cadangan (standby backup), tidak menjadi jalur aktif saat ini.
3. Cutover OCI hanya dibuka kembali jika trigger backup migration terpenuhi.

## 4) Dampak Status

1. Gap operasional timeout/redirect dinyatakan `CLOSED` untuk baseline saat ini.
2. Monitoring rutin endpoint kritikal tetap berjalan dengan timeout eksplisit.
3. Dokumen phase log dan runbook diperbarui agar konsisten dengan keputusan ini.
