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
