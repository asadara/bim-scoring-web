# BCL SCORING — STRUKTUR FINAL INDIKATOR & LOGIC
Versi Final Refactor (Perspektif & Bobot Terkunci)

---

# BOBOT ORGANISASI (TETAP)

| Perspektif | Bobot |
|------------|--------|
| P1 Governance & Strategy | 15% |
| P2 Process & Workflow | 30% |
| P3 Information & Model Quality | 20% |
| P4 People & Capability | 15% |
| P5 Value, Impact & Risk Reduction | 20% |
| **Total** | **100%** |

Bobot berlaku untuk seluruh proyek dan tidak dapat diubah.

---

# SKALA PENILAIAN (0–5)

Setiap indikator dinilai menggunakan skala penuh 0 sampai 5.

| Skor | Penjelasan |
|------|------------|
| 0 | Tidak ada implementasi, tidak tersedia dokumen, atau tidak terdapat bukti pendukung |
| 1 | Terdapat inisiasi awal atau praktik informal tanpa dokumentasi memadai |
| 2 | Implementasi sebagian, belum konsisten, bukti terbatas |
| 3 | Implementasi cukup konsisten, namun belum sepenuhnya sistematis atau belum terdokumentasi lengkap |
| 4 | Implementasi berjalan baik, terdokumentasi, dan dapat diverifikasi |
| 5 | Implementasi sistematis, terukur (measurable), terdokumentasi lengkap, serta dikendalikan secara berkelanjutan |

Skala ini berlaku untuk seluruh indikator tanpa pengecualian.

---

# P1 — GOVERNANCE & STRATEGY (15%)

Fokus: Tata kelola (governance) dan pengendalian implementasi BIM pada tingkat proyek.

P1-01 — Dokumen EIR/BEP tersedia, disetujui, dan memiliki pengendalian revisi (version control)  
P1-02 — Struktur dan aturan Common Data Environment (CDE governance) terdokumentasi dan diterapkan  
P1-03 — Peran dan tanggung jawab BIM ditetapkan secara formal (RACI / responsibility matrix)  
P1-04 — Rencana BIM Use selaras dengan lingkup proyek dan terdokumentasi  
P1-05 — Forum koordinasi BIM memiliki siklus tetap (governance cadence) dan keputusan terdokumentasi (decision log)  
P1-06 — KPI BIM dan kerangka pengukuran kinerja ditetapkan secara jelas  
P1-07 — Risiko terkait BIM terintegrasi dalam risk register proyek  
P1-08 — Kebijakan persetujuan digital (approval workflow) diterapkan dalam CDE sesuai prinsip information container status  

Alignment ISO 19650: Information Requirements, Information Delivery Planning, CDE Principles, Information Management Roles

---

# P2 — PROCESS & WORKFLOW (30%)

Fokus: Pemanfaatan nyata BIM dalam proses perencanaan, desain, dan konstruksi.

P2-01 — Model terfederasi lintas disiplin (federated model) dikelola dan diperbarui secara berkala  
P2-02 — Clash detection dilaksanakan secara berkala dan ditindaklanjuti melalui issue lifecycle tracking  
P2-03 — Sistem manajemen isu (issue management / BCF) berjalan aktif dan terdokumentasi  
P2-04 — Model digunakan sebagai dasar produksi desain/detail/fabrikasi (model-based production)  
P2-05 — Model dimanfaatkan untuk quantity take-off atau dukungan pengendalian biaya (5D use)  
P2-06 — Model digunakan untuk simulasi urutan pekerjaan atau analisis waktu (4D use)  
P2-07 — Model diperbarui sesuai milestone atau progres pekerjaan  
P2-08 — RFI yang terkait model dikelola melalui workflow terstruktur  
P2-09 — Titik pertukaran informasi (information exchange milestones) ditetapkan dan dipatuhi  
P2-10 — Konsistensi antara model dan drawing dijaga melalui prosedur pengendalian revisi  

Alignment ISO 19650: Information Production, Information Exchange, Revision Control, Delivery Phase

---

# P3 — INFORMATION & MODEL QUALITY (20%)

Fokus: Kualitas informasi dan integritas model sebagai information container.

P3-01 — Penerapan naming convention dan metadata sesuai standar proyek  
P3-02 — Level of Information Need (LOIN) dipenuhi sesuai tahapan dan kebutuhan  
P3-03 — Kelengkapan atribut/parameter sesuai dengan tujuan penggunaan (use case-based information completeness)  
P3-04 — Sistem pengendalian revisi dan version integrity berjalan konsisten  
P3-05 — Audit atau validasi model (model validation) dilakukan secara terstruktur  
P3-06 — Tidak terdapat duplikasi information container aktif dalam CDE  
P3-07 — Status information container (WIP / Shared / Published) diterapkan sesuai prosedur  
P3-08 — Clash tingkat tinggi (high-severity) tersisa dalam batas terkendali  
P3-09 — Konsistensi koordinat dan kesehatan model terfederasi (federation health) terverifikasi  
P3-10 — Sistem klasifikasi atau coding diterapkan secara konsisten  

Alignment ISO 19650: Information Container, Naming Rules, Revision Status, Validation, Single Source of Truth

---

# P4 — PEOPLE & CAPABILITY (15%)

Fokus: Kapabilitas sumber daya manusia dan keberlanjutan kompetensi BIM.

P4-01 — Kesesuaian kompetensi personel dengan peran BIM yang ditetapkan  
P4-02 — Pelatihan BIM terdokumentasi dan dapat diverifikasi  
P4-03 — Kegiatan knowledge sharing atau lesson learned dilakukan dan dicatat  
P4-04 — SOP atau prosedur BIM terdokumentasi dan dapat diakses  
P4-05 — Evaluasi kinerja BIM dilakukan secara periodik  
P4-06 — Waktu respons terhadap isu BIM dipantau sesuai Service Level Agreement (SLA)  

Alignment ISO 19650: Organizational Capability, Resource Planning, Continuous Improvement

---

# P5 — VALUE, IMPACT & RISK REDUCTION (20%)

Fokus: Dampak nyata implementasi BIM terhadap kinerja proyek.

P5-01 — Terdapat tren penurunan rework berdasarkan data isu  
P5-02 — Clash tingkat tinggi diselesaikan sebelum tahap konstruksi  
P5-03 — Terdapat tren penurunan deviasi quantity terhadap realisasi  
P5-04 — Terdapat tren penurunan waktu penyelesaian isu (issue aging reduction)  
P5-05 — Risiko jadwal teridentifikasi melalui pemanfaatan model (jika 4D aktif)  
P5-06 — Paket as-built atau asset information diserahkan berbasis model  
P5-07 — Laporan manajemen memanfaatkan data atau visualisasi berbasis model  
P5-08 — Keputusan proyek terdokumentasi menggunakan informasi berbasis model  

Alignment ISO 19650: Information Use, Validation, Asset Information (ISO 19650-3)

---

# FORMULA PERHITUNGAN (SAMA DENGAN FILE ASLI)

1) Data yang disimpan tiap input mingguan:

- project_id
- period_week
- daftar indicator_id → score (0–5)
- evidence per indikator (minimal 1)

2) Perhitungan rata-rata indikator:

Untuk setiap indikator i pada proyek p:

n_i = jumlah submission yang berisi indikator i  
avg_i = (Σ score_i) / n_i  

3) Baseline final yang berlaku:

- Skor indikator = rata-rata kumulatif dari input mingguan
- Skor perspektif & total = turunan dari rata-rata indikator + bobot tetap
- Confidence metric dihitung dari:
  - Coverage (indikator terisi / indikator aktif)
  - Frequency (jumlah minggu input / target minggu)

Output sistem:

- BIM Score (0–100)
- Confidence (0–1 atau %)
- Breakdown per Perspektif
- Breakdown per Indikator
- Audit trail & Evidence link

---

# PRINSIP

- Mapping ISO 19650 bersifat alignment konseptual, bukan klaim compliance otomatis.
- Indikator dapat diaktifkan atau dinonaktifkan sesuai BIM Use proyek.
- Bobot perspektif tidak berubah.
- Skor mencerminkan implementasi berbasis bukti (evidence-based).
- Sistem bersifat comparable antar proyek berbeda kompleksitas.

---

END OF FILE