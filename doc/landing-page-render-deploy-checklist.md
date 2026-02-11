# Landing Page Render Deploy Checklist

Checklist ini khusus untuk publish landing page web (`bcl_scoring`) ke Render.

## 1) Service Target

- Pastikan yang dideploy adalah service frontend web (bukan API backend).
- Repo path: `bim-scoring-web/bcl_scoring`
- Root route target: `/`

## 2) Build/Start Settings

- Build Command: `npm ci && npm run build`
- Start Command: `npm run start`
- Runtime: Node.js (sesuai Next.js app)

## 3) Required Environment Variables

- `NEXT_PUBLIC_APP_ENV=production`
- `NEXT_PUBLIC_BIM_SCORING_API_BASE_URL_PRODUCTION=<api-production-url>`
- `NEXT_PUBLIC_FEATURE_REAL_BACKEND_WRITE=false` (default aman)

Catatan:
- Jangan expose service role key di frontend.
- Semua `NEXT_PUBLIC_*` dianggap public di browser.

## 4) Deploy Steps

1. Trigger deploy frontend dari branch/commit final.
2. Tunggu build sukses tanpa fail-fast env error.
3. Buka domain default Render frontend.
4. Verifikasi landing root `/` memuat halaman "Web Control Center".

## 5) Smoke Checks

1. `GET /` -> status `200`, tampil CTA "Masuk Aplikasi".
2. Navigasi ke `/projects`, `/ho/review`, `/approve`, `/audit`.
3. Banner backend status tampil tanpa error crash.
4. Tidak ada perubahan endpoint backend/scoring logic.

## 6) Rollback

1. Redeploy artifact frontend sebelumnya yang known-good.
2. Pertahankan config env production tetap benar.
3. Ulang smoke checks minimal di root `/` dan `/projects`.
