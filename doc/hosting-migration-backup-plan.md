---
title: Hosting Migration Backup Plan
project: BIM Scoring Platform
status: ACTIVE
last_updated: 2026-02-16
owner: DevOps / Release
---

# Hosting Migration Backup Plan

Dokumen ini adalah rencana cadangan jika platform harus dipindahkan dari hosting saat ini (Render) ke provider lain, tanpa mengubah kontrak bisnis dan governance aplikasi.

## 1) Scope

- In scope:
  - Web frontend: `bim-scoring-web` (Next.js).
  - API backend: `bim-scoring-api` (Node.js service).
  - Env/runtime konfigurasi per environment.
  - Release gate, smoke check, rollback plan.
- Out of scope:
  - Perubahan formula scoring.
  - Perubahan workflow review/approval/lock/snapshot.
  - Perubahan semantics audit trail.

## 2) Target Operasional

- Tujuan utama: menjaga continuity service jika hosting saat ini bermasalah (availability, policy, biaya, atau constraint operasional).
- Prinsip:
  - Data plane tetap source of truth yang sama (tidak fork data).
  - Contract API dan UI behavior tidak berubah.
  - Cutover dilakukan bertahap dengan rollback siap pakai.

## 3) Trigger Aktivasi Rencana

Aktifkan migration backup jika salah satu kondisi terjadi:

1. Insiden availability hosting utama melewati SLA internal.
2. Risiko operasional meningkat (deploy block, limit platform, atau reliability issue berulang).
3. Keputusan manajemen untuk pindah provider disetujui formal.

## 4) Checklist Kesiapan (Pre-Migration)

1. Freeze baseline rilis:
   - Tentukan commit/tag API dan Web yang akan dipindahkan.
2. Environment parity:
   - Mapping seluruh env vars produksi (web + api).
   - Verifikasi policy `NEXT_PUBLIC_FEATURE_REAL_BACKEND_WRITE`.
3. Runtime parity:
   - Node version, build command, start command, health endpoint.
4. Security baseline:
   - Secret tidak hardcoded.
   - Secret dipindahkan via secure env management provider target.
5. Validation pack:
   - `npm run smoke:render` untuk baseline current host.
   - `npm run smoke:custom-domain` (setelah cutover domain target).
   - `npm run e2e` untuk flow lintas role.

## 5) Rencana Eksekusi Migrasi

## 5.1 Wave 1 - Standby Environment

1. Provision service API dan Web pada provider target.
2. Deploy artefak commit yang sama dengan produksi aktif.
3. Pasang env vars produksi (tanpa mengaktifkan traffic publik).
4. Jalankan smoke check ke endpoint target provider (host sementara).

Exit criteria Wave 1:
- Health/readiness API `200`.
- Web route kritikal `200` (`/`, `/projects`, `/ho/review`, `/approve`, `/audit`).
- Tidak ada perubahan kontrak payload kritikal.

## 5.2 Wave 2 - Controlled Cutover

1. Turunkan TTL DNS domain produksi (sebelum cutover window).
2. Alihkan domain ke host baru pada window terkontrol.
3. Jalankan smoke check pasca cutover.
4. Jalankan E2E lintas role sebagai verifikasi governance flow.

Exit criteria Wave 2:
- Seluruh smoke check lulus.
- E2E lintas role lulus.
- Monitoring tidak menunjukkan error spike signifikan.

## 5.3 Wave 3 - Stabilization (24-48 jam)

1. Pantau error rate, latency, dan availability.
2. Pantau endpoint `/health` dan `/ready` secara berkala.
3. Konfirmasi tidak ada regression pada review/approval/lock/snapshot.

## 6) Rollback Plan

Jika verifikasi gagal pada wave mana pun:

1. Kembalikan DNS ke host sebelumnya (Render).
2. Re-deploy artefak known-good terakhir di host lama jika perlu.
3. Jalankan smoke check baseline host lama.
4. Catat root cause dan blok cutover ulang sampai corrective action selesai.

## 7) Progress Saat Ini (2026-02-16)

- Status custom domain finalization: `DEFERRED` (sesuai keputusan terbaru).
- Cutover tooling tersedia:
  - `bcl_scoring/scripts/render-smoke-check.mjs`
  - `bcl_scoring/scripts/custom-domain-cutover-check.mjs`
  - `bcl_scoring/scripts/render-custom-domain.mjs`
- CI guard E2E aktif:
  - `.github/workflows/e2e-role-flow.yml`
- Gap utama:
  - Domain produksi final untuk cutover belum ditetapkan.
  - Standby environment di provider target belum diprovision.

## 8) Immediate Next Actions

1. Pilih provider target backup untuk API dan Web.
2. Provision standby host (non-public) untuk API dan Web.
3. Jalankan wave 1 smoke check dan dokumentasikan evidence.
4. Setelah wave 1 lulus, tetapkan jadwal wave 2 cutover terkontrol.
