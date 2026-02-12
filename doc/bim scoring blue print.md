# BIM Scoring Methodology  
## Skema Scoring Implementasi BIM Project

---

## 1️⃣ Struktur Dasar (TIDAK BOLEH BERUBAH)

### Perspektif Penilaian (5 Perspektif)

| Kode | Perspektif |
|------|------------|
| P1 | Governance & Strategy |
| P2 | Process & Workflow |
| P3 | Information & Model Quality |
| P4 | People & Capability |
| P5 | Value, Impact & Risk Reduction |

### Parameter Tetap

- Skala skor indikator: **0 – 5**
- Formula & logika perhitungan: **TETAP**
- Bobot perspektif: **DITETAPKAN DI LEVEL ORGANISASI**
- Bobot berlaku untuk **SEMUA proyek**
- Bobot **TIDAK BOLEH diubah per proyek**

---

## 2️⃣ Bobot Perspektif (Contoh Sah & Realistis)

| Perspektif | Bobot |
|------------|--------|
| P1 – Governance | 15% |
| P2 – Process | 30% |
| P3 – Information | 20% |
| P4 – People | 15% |
| P5 – Value | 20% |
| **Total** | **100%** |

📌 Bobot perspektif bersifat **organisasi-level constant**.

---

## 3️⃣ Parameter yang BOLEH Berbeda Antar Proyek

### ✔ Diperbolehkan Berbeda

- BIM Use (sesuai kompleksitas & tujuan proyek)
- Indikator penilaian
- Jumlah indikator
- Evidence / data pendukung

### ❌ Tidak Diperbolehkan Berbeda

- Bobot perspektif

---

## 4️⃣ Prinsip Indikator (PENTING)

1. Indikator diturunkan dari **BIM Use**
2. Hanya indikator yang **relevan** yang dihitung
3. Indikator yang tidak relevan:
   - **Dikeluarkan dari perhitungan**
   - **Bukan diberi nilai 0**

---

## 5️⃣ Rumus Resmi (FINAL)

### Skor per Perspektif

\[
Skor\_Pi =
\left(
\frac{\sum skor\ indikator\ relevan}
{5 \times jumlah\ indikator\ relevan}
\right)
\times Bobot\_Pi
\]

### Skor Total BIM Project

\[
BIM\ Score =
Skor\_P1 + Skor\_P2 + Skor\_P3 + Skor\_P4 + Skor\_P5
\]

➡️ Hasil akhir: **0 – 100**

---

## 6️⃣ Interpretasi Skor (STANDARD)

| Skor | Level | Makna |
|------|--------|--------|
| < 40 | Symbolic BIM | Formalitas |
| 40 – 60 | Partial BIM | Belum sistemik |
| 60 – 75 | Functional BIM | Mendukung proyek |
| 75 – 90 | Integrated BIM | Terintegrasi |
| > 90 | BIM-Driven Project | BIM menjadi core system |

---

## 7️⃣ Prinsip Kunci (TIDAK BOLEH DILANGGAR)

- Indikator boleh berbeda antar proyek
- Bobot perspektif harus sama
- Normalisasi dilakukan di level indikator, bukan bobot

**Jika kalimat ini benar → seluruh sistem scoring valid secara metodologis.**

---

## 8️⃣ Status Metodologi

- ✔ Inline dengan ISO 19650
- ✔ Audit-safe
- ✔ Comparable antar proyek
- ✔ Tidak software-dependent
- ✔ Bisa diintegrasikan ke risk register & KPI
