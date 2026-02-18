---
title: Render to OCI Migration Runbook
project: BIM Scoring Platform
status: ACTIVE
last_updated: 2026-02-16
owner: DevOps / Release
---

# Render to OCI Migration Runbook

Dokumen ini adalah urutan migrasi praktis untuk menghilangkan idle cold-start pada Render Free dengan memindahkan API dan Next.js ke OCI Always Free VM.

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

## 3.6 Wave 5 - Stabilization (24-48 jam)

1. Pantau health/readiness berkala.
2. Pantau log aplikasi (web+api) dan Nginx.
3. Jika stabil, baru turunkan dependensi ke Render (disable/decommission).
4. Setelah final, rotasi secret yang pernah diekspor untuk migrasi.

## 4) Rollback Plan (Cepat)

1. Kembalikan DNS domain ke Render origin.
2. Pastikan env web kembali menunjuk API lama (jika sempat berubah).
3. Jalankan smoke check baseline:
   - `npm run smoke:render`
   - `GET /health` dan `GET /ready` API lama
4. Catat root cause, jadwalkan cutover ulang setelah corrective action.

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
