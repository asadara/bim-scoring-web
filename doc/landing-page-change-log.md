---
title: Landing Page Change Log
project: BIM Scoring Platform (Web)
status: ACTIVE
owner: AI DevOps / Release Engineer
start_date: 2026-02-11
---

# Landing Page Change Log

Dokumen ini menjadi catatan resmi perubahan untuk pekerjaan landing page, dimulai dari persetujuan user pada 2026-02-11.

## Scope Guardrails

- Tidak mengubah scoring logic backend.
- Tidak mengubah snapshot immutability semantics.
- Tidak mengubah workflow business logic.
- Fokus pada landing page web + deployment alignment frontend.

## Baseline (Sebelum Perubahan)

- API production aktif di Render dan merespons endpoint operasional (`/health`, `/ready`).
- Root API (`/`) menampilkan `Cannot GET /` karena bukan route landing page frontend.
- Repo web memiliki kandidat landing:
  - `bcl/index.html` (static app)
  - `bcl_scoring/src/pages/index.tsx` (Next.js root page)

## Approved Plan Snapshot

1. Lock scope landing page (content + CTA + route root).
2. Audit struktur frontend yang dipilih agar tidak mengganggu flow existing.
3. Implement landing page UI pada root route frontend.
4. Validasi build + smoke check route root.
5. Dokumentasikan hasil dan deployment notes.

## Change Entries

### 2026-02-11  Entry 001

- Status: PLAN APPROVED
- Request: User menyetujui pembuatan landing page dan meminta dokumentasi dimulai dari titik ini.
- Action:
  - Membuat dokumen ini sebagai source of truth perubahan.
  - Menetapkan baseline, guardrails, dan plan snapshot.
- Files changed:
  - `doc/landing-page-change-log.md`
- Validation:
  - Dokumentasi berhasil dibuat.
  - Belum ada perubahan kode aplikasi pada entry ini.

### 2026-02-11  Entry 002

- Status: TARGET FRONTEND LOCKED
- Action:
  - Audit kandidat frontend:
    - `bcl/index.html` -> static dashboard lama
    - `bcl_scoring/src/pages/index.tsx` -> root route Next.js aktif
  - Menetapkan `bcl_scoring` sebagai target implementasi landing page karena route, env model, dan deployment flow sudah sejalan dengan stack aktif.
- Decision:
  - Landing page akan diimplementasikan pada route root `bcl_scoring/src/pages/index.tsx`.
  - Tidak ada perubahan pada backend API, scoring, snapshot, atau workflow.
- Files changed:
  - `doc/landing-page-change-log.md`

### 2026-02-11  Entry 003

- Status: IMPLEMENTED + BUILD VERIFIED
- Action:
  - Mengganti root page Next.js menjadi landing page terstruktur di:
    - `bcl_scoring/src/pages/index.tsx`
  - Menambahkan style landing page non-intrusif di:
    - `bcl_scoring/src/styles/task-layer.css`
  - Menjaga guardrails:
    - tidak ada perubahan backend
    - tidak ada perubahan scoring/snapshot/workflow
- Landing Scope:
  - Hero + environment/API visibility
  - Backend status banner
  - Workflow cards
  - Role entry points
  - Governance notes
- Validation:
  - Build pertama gagal sesuai fail-fast policy karena env wajib belum diset.
  - Build verifikasi sukses dengan env valid:
    - `NEXT_PUBLIC_APP_ENV=development`
    - `NEXT_PUBLIC_BIM_SCORING_API_BASE_URL_DEVELOPMENT=http://localhost:3001`
  - Route root `/` berhasil ter-generate sebagai static page Next.js.
- Files changed:
  - `bcl_scoring/src/pages/index.tsx`
  - `bcl_scoring/src/styles/task-layer.css`
  - `doc/landing-page-change-log.md`

### 2026-02-11  Entry 004

- Status: DEPLOYMENT DOC READY
- Action:
  - Menambahkan checklist deploy landing page khusus Render:
    - `doc/landing-page-render-deploy-checklist.md`
  - Menambahkan pointer checklist pada:
    - `bcl_scoring/README.md`
- Verification:
  - Build artifact `/.next/server/pages/index.html` memuat marker landing:
    - heading `Web Control Center`
    - CTA `Masuk Aplikasi`
  - Ini mengonfirmasi route root frontend `/` telah ter-generate dari build.
- Notes:
  - Verifikasi live runtime URL Render tetap perlu dilakukan di dashboard Render frontend service setelah deploy.
- Files changed:
  - `doc/landing-page-render-deploy-checklist.md`
  - `bcl_scoring/README.md`
  - `doc/landing-page-change-log.md`

### 2026-02-11  Entry 005

- Status: PHASE CHECKPOINT LOGGED
- Action:
  - Menambahkan log status phase lintas checkpoint ke:
    - `doc/phase-status-log.md`
  - Menetapkan status saat ini:
    - frontend live di default Render domain
    - custom domain pending DNS
    - mode aplikasi tetap read-only untuk uji UX
- Files changed:
  - `doc/phase-status-log.md`
  - `doc/landing-page-change-log.md`
