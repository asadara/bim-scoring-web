---
title: Render to OCI Migration Runbook
project: BIM Scoring Platform
status: ACTIVE
last_updated: 2026-02-18
owner: DevOps / Release
---

# Render to OCI Migration Runbook

Dokumen ini adalah urutan migrasi praktis untuk menghilangkan idle cold-start pada Render Free dengan memindahkan API dan Next.js ke OCI Always Free VM.

## 0) Progress Snapshot (R20)

Status checkpoint per 2026-02-18:

Keputusan operasional terbaru (checkpoint 2026-02-18 11:29:18 +07:00):
- Migrasi OCI di-`HOLD` sementara karena akun OCI belum berhasil dibuat.
- Operasi aktif kembali difokuskan ke `Render + Supabase` sampai blocker OCI selesai.

| Wave | Status | Catatan |
|---|---|---|
| Wave 0 (Freeze/Baseline) | COMPLETE | Baseline dan smoke web kritikal sudah tervalidasi. |
| Wave 1 (Provision OCI VM) | ON HOLD (BLOCKED) | Menunggu akun OCI aktif. |
| Wave 2 (Deploy Service di OCI) | ON HOLD (BLOCKED) | Bergantung pada Wave 1. |
| Wave 3 (Nginx/TLS/Cloudflare) | ON HOLD (BLOCKED) | Bergantung pada Wave 1-2 + domain final. |
| Wave 4 (Controlled Cutover) | DEFERRED | Ditunda sampai jalur OCI dibuka kembali. |
| Wave 5 (Stabilization) | DEFERRED | Menunggu eksekusi Wave 4. |

Evidence terbaru:
- `doc/render-to-oci-wave0-evidence-2026-02-16.md`
- `doc/render-to-oci-step3-progress-2026-02-18.md`
- `doc/render-render-supabase-continuity-checkpoint-2026-02-18.md`

## 1) Objective

- Hilangkan waktu tunggu wake-up service pada traffic pertama.
- Tetap pertahankan data plane existing (Supabase) dan source code di GitHub.
- Cutover dengan downtime minimal dan rollback cepat.

## 2) Target Architecture

- Cloudflare (proxy aktif) -> Nginx (VM OCI) -> layanan lokal:
  - Web Next.js: `127.0.0.1:3000`
  - API Node.js: `127.0.0.1:4000`
- Database/Auth tetap di Supabase.
- Render dipertahankan sementara sebagai fallback saat masa stabilisasi.

## 3) Migration Sequence

## 3.1 Wave 0 - Freeze and Baseline (H-1 sampai H-0)

1. Freeze commit yang akan dipindah:
   - `bim-scoring-api`
   - `bim-scoring-web/bcl_scoring`
2. Catat env produksi aktif dari Render dan Supabase.
3. Jalankan baseline check di host lama:
   - API: `GET /health` dan `GET /ready`
   - Web smoke: `npm run smoke:render` dari `bim-scoring-web/bcl_scoring`
4. Tetapkan rollback trigger:
   - health/readiness gagal
   - error rate naik signifikan
   - flow role kritikal gagal (projects/review/approve/audit)

Progress 2026-02-18:
- `COMPLETE` untuk gate baseline availability dan smoke route kritikal.
- Hasil `npm run smoke:render`: seluruh check lulus.

## 3.2 Wave 1 - Provision OCI VM (H-0)

1. Buat VM OCI Always Free (Ubuntu), siapkan static public IP.
2. Network security:
   - buka hanya `22`, `80`, `443`
   - blok port aplikasi internal (`3000`, `4000`) dari public internet
3. Install dependency host:
   - Node.js LTS
   - Nginx
   - Certbot + plugin Nginx
4. Buat direktori deploy:
   - `/opt/bim-scoring/api`
   - `/opt/bim-scoring/web`
5. Clone repo dari GitHub ke direktori deploy.

Progress 2026-02-18:
- `NOT STARTED` (butuh provisioning aktual di OCI Console).
- Checkpoint 2026-02-18 11:29:18 +07:00: `ON HOLD (BLOCKED)` menunggu akun OCI siap.

## 3.3 Wave 2 - Deploy Service di OCI (Belum Cutover DNS)

1. API deploy:
   - isi env API produksi (`APP_ENV=production`, Supabase URL/key produksi)
   - jalankan `npm ci`, `npm run build`, `npm test`
   - jalankan service API di `127.0.0.1:4000` via `systemd`/`pm2`
2. Web deploy:
   - isi env web produksi:
     - `NEXT_PUBLIC_APP_ENV=production`
     - `NEXT_PUBLIC_BIM_SCORING_API_BASE_URL_PRODUCTION=https://api.<domain-anda>`
   - jalankan `npm ci`, `npm run build`
   - jalankan Next.js di `127.0.0.1:3000` via `systemd`/`pm2`
3. Verifikasi lokal VM:
   - `curl http://127.0.0.1:4000/health`
   - `curl http://127.0.0.1:4000/ready`
   - `curl -I http://127.0.0.1:3000`

Progress 2026-02-18:
- `NOT STARTED` di host OCI (belum ada VM target).
- Readiness codebase lokal sudah tervalidasi:
  - API `npm test`: pass (`tests=99, pass=98, fail=0, skipped=1`)
  - API `npm run build`: pass
  - Guardrail policy tambahan: endpoint evidence legacy untuk Admin diset read-only (`/projects/:projectId/evidence/request-upload`, `/projects/:projectId/evidence/signed-upload`, `/indicator-inputs/:inputId/evidence`) dan tervalidasi kontrak `403 FORBIDDEN_ROLE`.
  - Web `npm run e2e`: pass (`3 passed`)
- Checkpoint 2026-02-18 11:29:18 +07:00: `ON HOLD (BLOCKED)` menunggu Wave 1.

## 3.4 Wave 3 - Nginx + TLS + Cloudflare Prep

1. Konfigurasi Nginx reverse proxy:
   - `api.<domain>` -> `127.0.0.1:4000`
   - `app.<domain>` -> `127.0.0.1:3000`
2. Issuing TLS origin via Let's Encrypt (Certbot).
3. Set Cloudflare SSL mode ke `Full (strict)`.
4. Di Cloudflare, buat DNS record `A`:
   - `api.<domain>` -> IP VM (proxy aktif)
   - `app.<domain>` -> IP VM (proxy aktif)
5. Verifikasi eksternal:
   - `https://api.<domain>/health` => `200`
   - `https://api.<domain>/ready` => `200`
   - `https://app.<domain>/` => `200`

Progress 2026-02-18:
- `IN PROGRESS`.
- Tooling cutover check siap dan lulus dry-run di domain Render:
  - `CUSTOM_DOMAIN=bim-scoring-web.onrender.com npm run smoke:custom-domain` -> pass.
- Gap operasional:
  - domain final `api.<domain>`/`app.<domain>` belum ditetapkan.
  - kredensial operasional untuk Render API (`RENDER_API_KEY`, `RENDER_WEB_SERVICE_ID`) belum tersedia di environment eksekusi saat ini.
  - akses OCI/Cloudflare untuk konfigurasi DNS + SSL strict belum tersedia di workspace ini.
- Checkpoint 2026-02-18 11:29:18 +07:00: `ON HOLD (BLOCKED)` menunggu Wave 1-2.

## 3.5 Wave 4 - Controlled Cutover (H-Day)

1. Pastikan Render masih aktif (fallback).
2. Jika domain utama masih ke Render, alihkan DNS ke OCI saat window cutover.
3. Jalankan smoke check pasca-cutover:
   - route web: `/`, `/projects`, `/ho/review`, `/approve`, `/audit`
   - API: `/health`, `/ready`
4. Jalankan E2E lintas role:
   - `npm run e2e` dari `bim-scoring-web/bcl_scoring`
5. Monitoring 1-2 jam pertama:
   - error 5xx
   - timeout
   - latency route kritikal

Progress 2026-02-18:
- `READY, WAITING EXECUTION` (belum dieksekusi karena Wave 1-3 belum final).
- Gate pra-cutover yang sudah lulus:
  - `npm run smoke:render`
  - `CUSTOM_DOMAIN=bim-scoring-web.onrender.com npm run smoke:custom-domain`
  - `npm run e2e`
- Checkpoint 2026-02-18 11:29:18 +07:00: `DEFERRED` sampai jalur OCI dibuka kembali.

## 3.6 Wave 5 - Stabilization (24-48 jam)

1. Pantau health/readiness berkala.
2. Pantau log aplikasi (web+api) dan Nginx.
3. Jika stabil, baru turunkan dependensi ke Render (disable/decommission).
4. Setelah final, rotasi secret yang pernah diekspor untuk migrasi.

Progress 2026-02-18:
- `NOT STARTED` (mulai setelah Wave 4 cutover selesai).
- Checkpoint 2026-02-18 11:29:18 +07:00: `DEFERRED`.

## 4) Rollback Plan (Cepat)

1. Kembalikan DNS domain ke Render origin.
2. Pastikan env web kembali menunjuk API lama (jika sempat berubah).
3. Jalankan smoke check baseline:
   - `npm run smoke:render`
   - `GET /health` dan `GET /ready` API lama
4. Catat root cause, jadwalkan cutover ulang setelah corrective action.

Status 2026-02-18:
- `READY` (prosedur rollback terdokumentasi, baseline smoke lama terverifikasi ulang).

## 5) Production Checklist

1. `NEXT_PUBLIC_FEATURE_REAL_BACKEND_WRITE` sesuai policy produksi.
2. Tidak ada secret di frontend `NEXT_PUBLIC_*`.
3. UFW/NSG hanya expose 22/80/443.
4. Service auto-restart aktif (`systemd`/`pm2`).
5. Sertifikat TLS auto-renew tervalidasi.
6. Backup dokumen env tersimpan aman dan akses terbatas.

## 6) Command Reference (Minimal)

```bash
# API
cd /opt/bim-scoring/api
npm ci
npm run build
npm test
npm run start
```

```bash
# Web
cd /opt/bim-scoring/web/bcl_scoring
npm ci
npm run build
npm run start
```

```bash
# Quick checks
curl -f https://api.<domain>/health
curl -f https://api.<domain>/ready
curl -I https://app.<domain>/
```

## 7) Success Criteria

- Tidak ada cold-start delay dari sisi user saat hit pertama.
- Health/readiness API konsisten `200`.
- Flow role kritikal lulus smoke + E2E.
- Tidak ada regression kontrak API/UI dibanding baseline pra-migrasi.

## 8) Immediate Next Actions (R20)

1. Stabilkan operasi `Render + Supabase` sebagai mode sementara.
2. Jalankan monitoring rutin endpoint kritikal (`/`, `/projects`, `/ho/review`, `/approve`, `/audit`, `/health`, `/ready`) dengan timeout eksplisit.
3. Investigasi timeout API Render yang terdeteksi pada checkpoint 2026-02-18 dan konfirmasi status service dari dashboard Render.
4. Pertahankan gate kualitas sebelum perubahan produksi:
   - `npm run smoke:render`
   - `npm run e2e`
5. Setelah akun OCI siap, buka kembali Wave 1 dan lanjutkan sequence migrasi dari titik hold saat ini.
