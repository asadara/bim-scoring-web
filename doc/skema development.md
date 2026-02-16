# Skema Development — BIM Scoring Platform (Mulai dari Nol)

## 1. Define
- Tetapkan skema scoring (P1–P5, bobot organisasi, indikator)
- Tetapkan kebutuhan role:
  - Admin (entitas khusus, di luar 3 role operasional)
  - Role 1 BIM Koordinator Proyek
  - Role 2 HO Reviewer
  - Role 3 Approver
  - Viewer (read-only)
- Tetapkan batas write per role secara eksplisit (siapa boleh menulis apa)

## 2. Design
- Desain UI (mobile-first, responsive)
- Desain struktur data (project, period, perspektif, indikator, skor, evidence)

## 3. Setup Backend (Cloud)
- Buat project Supabase
- Setup database schema
- Setup authentication
- Setup REST API / policy

## 4. Setup Frontend
- Google App / Web App (HTML–JS / AppSheet / Apps Script)
- Koneksi ke Supabase API

## 5. Implement Logic
- Input indikator/score per periode hanya oleh entitas yang ditetapkan (admin-only bila termasuk write surface admin)
- Hitung skor otomatis sesuai rumus resmi
- Simpan dan tampilkan hasil (per perspektif & total) dengan governance role tetap terjaga

## 6. Integrasi BCL
- Tambahkan link / menu ke webapp scoring
- Pastikan akses terkontrol

## 7. Testing
- Uji fungsi input & perhitungan
- Uji role & akses
- Uji guard: role non-berwenang harus ditolak deterministik (403/423/409 sesuai kontrak)
- Validasi konsistensi skor

## 8. Deploy
- Aktifkan domain / akses produksi
- Pastikan environment stabil

## 9. Iterasi
- Tambah indikator sesuai BIM Use
- Tambah dashboard analitik
- Tambah laporan & export

## Status Eksekusi (Update 2026-02-16)

| Tahap | Status | Evidence Ringkas |
|---|---|---|
| 1. Define | COMPLETE | Role boundary dikunci: Admin entitas khusus, Role 1/2/3 sesuai governance, viewer read-only (`doc/skema define.md`). |
| 2. Design | COMPLETE | Struktur data + UI operasional sudah berjalan; dashboard legacy BCL sudah dipasang sebagai landing utama. |
| 3. Setup Backend (Cloud) | COMPLETE | API live di Render, health/readiness aktif, policy write guard berjalan (`https://bim-scoring-api.onrender.com/health`). |
| 4. Setup Frontend | COMPLETE | Frontend Next.js live di Render, route root menampilkan dashboard utama (`https://bim-scoring-web.onrender.com/`). |
| 5. Implement Logic | COMPLETE | Formula scoring inline blueprint + weekly cumulative + confidence; guard role/write aktif. |
| 6. Integrasi BCL | COMPLETE | Dashboard legacy (`bcl/index.html` + `dashboard.js`) sudah dimount di route root Next.js dan asset dipublish dari `public/bcl`. |
| 7. Testing | COMPLETE (Hardening v2) | Contract/regression API lulus (`tests=20, pass=20, fail=0`); smoke deploy web+api otomatis (`bcl_scoring/scripts/render-smoke-check.mjs`); E2E browser lintas role + multi-skenario reject/lock/export lulus (`npm run e2e`, 3 passed); CI workflow PR gate + nightly schedule aktif (`.github/workflows/e2e-role-flow.yml`). |
| 8. Deploy | PARTIAL (Domain Deferred, Migration Backup Active) | Default Render domain live/stabil; finalisasi custom domain ditunda; fokus deploy diarahkan ke backup plan migrasi hosting (`doc/hosting-migration-backup-plan.md`) sambil mempertahankan write mode controlled (`NEXT_PUBLIC_FEATURE_REAL_BACKEND_WRITE=false`). |
| 9. Iterasi | IN PROGRESS | Dashboard sudah tersedia; ekspansi indikator BIM Use dan paket laporan lanjutan belum selesai penuh. |

## Backlog Prioritas Lanjutan

1. Stage 7 (Testing Hardening+): monitor stabilitas pipeline E2E (flake watch) dan tambah retry policy hanya jika ditemukan noise konsisten.
2. Stage 8 (Deploy Finalization): jalankan Wave 1 migration backup (standby hosting API/Web di provider cadangan) sesuai `doc/hosting-migration-backup-plan.md`, lalu kumpulkan evidence smoke check parity.
3. Stage 8 (Go-Live Write Mode): siapkan release gate untuk transisi terkontrol dari read-only ke backend write mode (dengan rollback plan).
4. Stage 9 (Iterasi Indikator): tambah indikator aktif per BIM Use agar coverage scoring tidak hanya baseline indikator template.
5. Stage 9 (Iterasi Laporan): perluas export management pack (summary score + confidence trend + evidence quality) untuk kebutuhan steering level.
