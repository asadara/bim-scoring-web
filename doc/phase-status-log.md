---
title: Phase Status Log
project: BIM Scoring Platform
status: ACTIVE
last_updated: 2026-02-18
owner: DevOps / Release
---

# Phase Status Log

Log status phase proyek sampai checkpoint saat ini.

## Current Summary

- Backend API production: LIVE di Render.
- Frontend web landing: LIVE di Render (`https://bim-scoring-web.onrender.com`).
- Blueprint alignment remediation (R1) pada codebase: implementasi Step 1-6 selesai.
- Paket contract/regression blueprint-critical terbaru: lulus (`tests=20, pass=20, fail=0`).
- E2E browser lintas role + hardening scenario (reject flow, post-approval lock, snapshot export): lulus (`npm run e2e`, `3 passed`).
- CI gate Stage 7 aktif: PR gate ke `main` + nightly schedule untuk Playwright E2E (`.github/workflows/e2e-role-flow.yml`).
- Rollout remediation API/Web sudah selesai dan terverifikasi pasca-deploy pada endpoint produksi.
- Landing utama sudah diselaraskan ke dashboard BCL (legacy) pada route root (`/`) dengan kompatibilitas route lama (`/bcl/index.html`).
- Stage 8 custom domain cutover pack siap (checklist + smoke script), aktivasi domain masih menunggu eksekusi DNS provider.
- Dry-run smoke cutover script pada domain default Render lulus (`npm run smoke:custom-domain` dengan `CUSTOM_DOMAIN=bim-scoring-web.onrender.com`).
- Checkpoint R20 terbaru (2026-02-18): Step 3 Wave 0 `COMPLETE`, Wave 3 `IN PROGRESS`, Wave 4 `READY (WAITING EXECUTION)`, Wave 1/2/5 belum mulai.
- Checkpoint 2026-02-18 11:29:18 +07:00: migrasi OCI di-`HOLD` sementara (akun OCI belum aktif), operasi dikembalikan ke mode `Render + Supabase`.
- Checkpoint continuity menunjukkan route web kritikal `200`, namun API Render (`/health`, `/ready`) timeout dari jalur pengecekan saat ini; investigasi dashboard/log Render diperlukan.
- Render API custom domain control aktif (`render:domain:list/add/status/wait`); daftar domain custom saat ini masih kosong.
- Keputusan terbaru: finalisasi custom domain di-skip sementara; fokus Stage 8 dialihkan ke backup plan migrasi hosting.
- Mode operasional frontend saat ini tetap: **read-only / prototype write disabled** untuk uji UI/UX client-side.
- Checkpoint 2026-02-18: policy Admin untuk mutasi evidence di endpoint legacy dikunci `read-only` (semua role termasuk Admin menerima `403 FORBIDDEN_ROLE`), regression API lulus (`tests=99, pass=98, fail=0, skipped=1`).
- Checkpoint 2026-02-18 (post-rotation): login `employee_number + password` dan Google OAuth tervalidasi di web service aktif `https://bimscoringnke.onrender.com`; terdapat gap redirect root API (`/`) yang masih menunjuk domain web lama dan perlu update `WEB_APP_URL`.

## Phase Timeline

| Phase | Status | Ringkasan |
|---|---|---|
| H8.0-H8.5 | CLOSED & LOCKED | Contract dan workflow utama selesai; guardrails tetap berlaku. |
| O1 (Operational Hardening Plan) | COMPLETE | Roadmap hardening operasional selesai disusun. |
| CRP-1 (O1.1 Staging Gate) | COMPLETE | Env separation, config hygiene, logging baseline, health/ready, deployment doc baseline selesai. |
| CRP-2 (O1.2 Production Gate) | COMPLETE | Backup/retention policy + rate limiting policy/baseline selesai. |
| Go-Live Readiness | PRODUCTION-ELIGIBLE | Gate produksi terpenuhi dengan kontrol operasional. |
| Frontend Landing Deployment | COMPLETE | Landing root diterapkan dan deploy ke Render default domain (mode dashboard BCL aktif). |
| Blueprint Alignment Remediation (R1) | COMPLETE (CODEBASE) | Step 1-6 remediation blueprint selesai di workspace dev + evidence dokumentasi tersedia. |
| Remediation Rollout Gate | COMPLETE | Push ke `main` API/Web selesai; smoke checks dan verifikasi pasca-deploy endpoint produksi lulus. |
| Custom Domain Activation | DEFERRED (BY DECISION) | Finalisasi custom domain ditunda sementara untuk memberi prioritas pada rencana backup migrasi hosting. |
| Hosting Migration Backup Plan | IN PROGRESS | Rencana cadangan migrasi hosting disiapkan sebagai jalur continuity jika perlu pindah provider. |
| UX Trial Window | IN PROGRESS | Aplikasi dijalankan read-only untuk ujicoba client-side. |

## Active Decisions

1. Tetap menggunakan domain default Render sementara: `https://bim-scoring-web.onrender.com`.
2. Menjaga `NEXT_PUBLIC_FEATURE_REAL_BACKEND_WRITE=false` selama fase ujicoba UX read-only masih berjalan.
3. Remediation scoring/evidence linkage sudah aktif di produksi; perubahan berikutnya wajib melalui release gate operasional.
4. Guardrail governance tetap: review != approval, approval mengunci period, snapshot immutable, audit append-only.
5. Custom domain cutover ditunda; prioritas deploy dialihkan ke kesiapan backup migrasi hosting.

## Evidence References

- Landing implementation log: `doc/landing-page-change-log.md`
- Hosting migration backup plan: `doc/hosting-migration-backup-plan.md`
- R20 runbook progress checkpoint terbaru: `doc/render-to-oci-step3-progress-2026-02-18.md`
- Render continuity checkpoint (saat OCI hold): `doc/render-render-supabase-continuity-checkpoint-2026-02-18.md`
- Landing deploy checklist: `doc/landing-page-render-deploy-checklist.md`
- Render smoke script (web+api): `bcl_scoring/scripts/render-smoke-check.mjs`
- Custom domain cutover smoke script: `bcl_scoring/scripts/custom-domain-cutover-check.mjs`
- Render custom domain API script: `bcl_scoring/scripts/render-custom-domain.mjs`
- E2E browser spec lintas role: `bcl_scoring/e2e/role-flow.spec.ts`
- E2E CI workflow (PR + nightly): `.github/workflows/e2e-role-flow.yml`
- Frontend operational baseline: `bcl_scoring/README.md`
- Backend write readiness reference: `doc/backend-write-readiness.md`
- Blueprint remediation plan + status step: `doc/blueprint-alignment-remediation-plan.md`
- Blueprint remediation changelog: `doc/blueprint-alignment-change-log.md`
- Blueprint payload samples (before/after): `doc/blueprint-alignment-payload-samples.md`
- Rollout commit (API): `497182e` (`Align scoring contract to 0-100 and enforce evidence linkage`)
- Rollout commit (Web): `6c8d92b` (`Complete blueprint remediation docs and UI score interpretation`)
- Weekly cumulative + confidence commit (API): `97652ac` (`add weekly cumulative scoring and confidence metrics`)
- Landing dashboard BCL commit (Web): `4fa9832` (`serve legacy bcl dashboard as main page`)

## Exit Criteria for Next Phase

- Verifikasi pasca-deploy menunjukkan kontrak scoring/evidence tetap sesuai blueprint.
- Keputusan transisi write-mode disetujui terkontrol (jika diperlukan).
- Checklist keamanan operasional tetap terpenuhi.

## Checkpoint Save (2026-02-12)

1. Commit dan push per-repo sudah selesai:
   - API: `97652ac`
   - Web: `036ab95`, `4fa9832`
2. Landing utama sudah menampilkan dashboard BCL legacy di route root (`/`) dan alias route lama aktif (`/bcl/index.html`).
3. Hardening testing/deploy ditingkatkan:
   - Script smoke check Render ditambahkan di `bcl_scoring/scripts/render-smoke-check.mjs`
   - NPM script: `npm run smoke:render`
4. Hasil smoke check live terbaru:
   - Web routes: `/`, `/bcl/index.html`, `/projects`, `/ho/review`, `/approve`, `/audit` = `200`
   - API checks: `/health` (`ok=true`), `/ready` (`ready=true`)
5. Referensi status detail tahap development disimpan di:
   - `doc/skema development.md` (section `Status Eksekusi` dan `Backlog Prioritas Lanjutan`)
