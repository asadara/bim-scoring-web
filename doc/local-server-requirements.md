# Local Server Requirements - BIM Scoring Project

Dokumen ini merangkum requirement minimum untuk menjalankan server lokal project:
- `bim-scoring-api` (backend)
- `bim-scoring-web/bcl_scoring` (frontend)

## 1. Software Requirement

- Node.js `>= 20.9.0` (disarankan Node 20 LTS terbaru)
- npm (ikut instalasi Node.js)
- Git
- OS: Windows/macOS/Linux (contoh command di dokumen ini menggunakan PowerShell/terminal umum)

## 2. Service dan Akun yang Dibutuhkan

- 1 Supabase project aktif (untuk Auth + data backend)
- Akses credential berikut:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (untuk backend)
- `SUPABASE_ANON_KEY` (untuk frontend/auth browser)

## 3. Struktur Repo yang Dipakai

- `D:\PROJECTS\bim-scoring-api`
- `D:\PROJECTS\bim-scoring-web\bcl_scoring`

## 4. Konfigurasi Environment

### 4.1 Backend (`bim-scoring-api/.env`)

Copy dari `.env.example`, lalu isi minimal:

```env
APP_ENV=development
PORT=3001

SUPABASE_URL_DEVELOPMENT=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY_DEVELOPMENT=your_supabase_service_role_key
```

Catatan:
- `PORT=3001` disarankan supaya tidak bentrok dengan frontend Next.js (`3000`).
- Backend akan fail-fast jika `APP_ENV` tidak valid atau env wajib kosong.

### 4.2 Frontend (`bim-scoring-web/bcl_scoring/.env.local`)

Copy dari `.env.example`, lalu isi minimal:

```env
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_BIM_SCORING_API_BASE_URL_DEVELOPMENT=http://127.0.0.1:3001

NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_FEATURE_REAL_BACKEND_WRITE=false
```

Catatan:
- Frontend akan fail-fast jika `NEXT_PUBLIC_APP_ENV` atau API base URL untuk env aktif tidak diisi.
- `NEXT_PUBLIC_FEATURE_REAL_BACKEND_WRITE` default aman: `false`.

## 5. Instalasi Dependency

Jalankan terpisah di masing-masing repo:

```bash
# backend
cd D:\PROJECTS\bim-scoring-api
npm ci

# frontend
cd D:\PROJECTS\bim-scoring-web\bcl_scoring
npm ci
```

## 6. Menjalankan Server Lokal

Gunakan 2 terminal:

Terminal 1 (Backend):

```bash
cd D:\PROJECTS\bim-scoring-api
npm run dev
```

Terminal 2 (Frontend):

```bash
cd D:\PROJECTS\bim-scoring-web\bcl_scoring
npm run dev
```

## 7. Validasi Cepat Setelah Start

- Backend health endpoint:
- `http://127.0.0.1:3001/health`
- `http://127.0.0.1:3001/ready`
- Frontend:
- `http://127.0.0.1:3000`

Jika frontend hidup tetapi tidak bisa baca data, cek:
- API base URL di `.env.local`
- kredensial Supabase (`URL`, `ANON KEY`, dan service role key backend)

## 8. Optional Tapi Disarankan untuk Fitur Lengkap

Untuk fitur role mapping/admin/evidence yang lengkap, jalankan SQL baseline di Supabase (lihat repo backend):
- `docs/ops/sql/create-admin-control-layer-postgres.sql`
- `docs/ops/sql/seed-perspectives-indicators-from-doc.sql`
- file SQL tambahan lain di `docs/ops/sql/` sesuai kebutuhan flow.

## 9. Ringkasan Singkat

Minimum agar local server jalan:
1. Node `>=20.9`
2. Supabase URL + keys valid
3. Backend jalan di `3001`
4. Frontend target ke `http://127.0.0.1:3001`
5. Jalankan `npm ci` dan `npm run dev` di kedua repo
