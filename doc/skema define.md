# DEFINE

## A. Tujuan
Menyediakan penilaian kuantitatif implementasi BIM per proyek yang:
- Comparable antar proyek
- Audit-safe
- Evidence-driven
- Mendorong pengurangan risiko dan peningkatan kualitas delivery

---

## B. Scope

### Dinilai
- Kematangan implementasi BIM berbasis manajemen informasi
- Penggunaan nyata BIM dalam proses dan penciptaan nilai (process & value driven)

### Tidak Dinilai
- “Kecantikan model”
- Jumlah view / 3D semata
- Tool atau software spesifik

---

## C. Unit Penilaian
- Default: 1 skor per Project
- Opsional: breakdown per zona / paket / disiplin (jika diperlukan organisasi)

---

## D. Perspektif & Bobot Organisasi (FIXED)

| Perspektif | Bobot |
|------------|--------|
| P1 Governance & Strategy | 15% |
| P2 Process & Workflow | 30% |
| P3 Information & Model Quality | 20% |
| P4 People & Capability | 15% |
| P5 Value, Impact & Risk Reduction | 20% |
| **Total** | **100%** |

Bobot ini berlaku untuk SEMUA proyek dan tidak boleh diubah per proyek.

---

## E. Aturan Indikator (Variable per Proyek)

- Indikator diturunkan dari BIM Use aktif proyek (tercatat dalam EIR / BEP)
- Hanya indikator relevan yang dihitung
- Indikator tidak relevan dikeluarkan dari perhitungan (bukan diberi nilai 0)
- Normalisasi dilakukan di level indikator, bukan bobot

---

## F. Skala Skor Indikator (0–5)

| Skor | Makna |
|------|-------|
| 0 | Tidak ada |
| 1 | Ada tapi tidak dipakai |
| 2 | Dipakai sporadis |
| 3 | Dipakai rutin terbatas |
| 4 | Dipakai konsisten |
| 5 | Dipakai optimal & berdampak |

---

## G. Formula Resmi

### Skor per Perspektif

\[
Skor\_Pi =
\left(
\frac{\sum skor\_indikator}{5 \times n\_indikator}
\right)
\times Bobot\_Pi
\]

### Skor Total BIM Project

\[
BIM\ Score = \sum Skor\_P1..P5
\]

Rentang hasil akhir: **0–100**

---

## H. Role & Akses (Minimal)

- **Admin** (entitas khusus, di luar 3 role operasional):
  - Mengelola konfigurasi/master yang diizinkan organisasi.
  - Menjalankan input data khusus yang memang ditetapkan sebagai kewenangan admin.
- **Role 1 - BIM Koordinator Proyek**:
  - Menulis evidence (draft / submit / revisi) sesuai rule period.
  - Tidak boleh review, approve, atau mengubah aturan scoring.
- **Role 2 - HO Reviewer**:
  - Verifikasi evidence dan memberi outcome review + alasan.
  - Tidak boleh approve period.
- **Role 3 - Approver**:
  - Keputusan final period (approve/reject) + alasan formal.
  - Tidak melakukan input data operasional di luar approval.
- **Viewer**:
  - Read-only untuk dashboard/laporan.

---

## I. Evidence Minimum (Wajib per Input Skor)

Minimal 1 bukti per indikator (pilih salah satu):

- Notulen / undangan rapat + screenshot model / issue list
- Export issue log (BCF / CSV)
- Screenshot CDE state / folder publish
- Laporan clash / 4D / quantity
- RFI / rework log terkait

Semua skor harus dapat ditelusuri ke evidence.

---

## J. Siklus Penilaian

Pilih default organisasi:

- Bulanan, atau
- Per milestone (design freeze / shopdrawing / progress major)
