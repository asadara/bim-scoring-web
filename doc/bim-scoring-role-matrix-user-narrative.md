---
title: BIM Scoring Platform — Role, Interaction Matrix & User Narrative
version: 1.0
status: LOCKED
scope: Foundation / Governance / Human Layer
owner: BIM Scoring Platform
last_updated: 2026-02-08
---

# BIM Scoring Platform  
## Role Definition, Interaction Matrix & User Narrative

Dokumen ini merupakan **referensi tunggal dan resmi** untuk:
- definisi peran (role),
- interaksi antar peran,
- serta narasi penggunaan sistem (user narrative)

pada **BIM Scoring Platform**.

Dokumen ini **tidak mengatur implementasi teknis**, **tidak mengubah metodologi scoring**, dan **tidak bersifat UI-spec**.  
Fungsinya adalah **fondasi konseptual dan governance** agar sistem tidak melenceng saat digunakan maupun dikembangkan.

---

## A. ROLE DEFINITIONS (FOUNDATION)

### ROLE 1 — BIM Koordinator Proyek

**Posisi**  
Unit operasional terendah dan entry point manusia ke sistem.

**Tujuan**  
Menyediakan evidence pelaksanaan BIM Use yang relevan dan dapat ditelusuri untuk dinilai kelayakannya oleh organisasi.

**Bukan**  
- Penentu skor  
- Penambah indikator  
- Reviewer atau approver  

**Tugas Inti**
1. Mengidentifikasi BIM Use yang dijalankan pada proyek.
2. Memilih indikator yang relevan.
3. Menyiapkan evidence (FILE / URL / TEXT).
4. Mengaitkan (attach) evidence ke indikator.
5. Menyimpan evidence sebagai `DRAFT`.
6. Mengubah status menjadi `SUBMITTED` saat siap.
7. Menindaklanjuti feedback `NEEDS REVISION`.

**Boundary Rules**
- Evidence tidak menambah indikator.
- Evidence tidak otomatis memengaruhi skor.
- Tidak ada perubahan bobot atau metodologi.
- Tidak ada approval atau locking period.

---

### ROLE 2 — BIM Koordinator Pusat / HO Reviewer

**Posisi**  
Penjaga kelayakan evidence dan konsistensi standar BIM organisasi lintas proyek.

**Tujuan**  
Menetapkan apakah evidence yang diajukan proyek layak dipakai sebagai dasar penilaian organisasi.

**Bukan**  
- Approver akhir  
- Pengubah skor  
- Pengubah indikator atau bobot  

**Tugas Inti**
1. Meninjau evidence berstatus `SUBMITTED`.
2. Membaca konteks indikator dan BIM Use proyek.
3. Menilai kelayakan evidence (relevansi, keterlacakan, kecukupan).
4. Menetapkan outcome review:
   - `ACCEPTABLE`
   - `NEEDS REVISION`
   - `REJECTED`
5. Menuliskan alasan review yang jelas.

**Boundary Rules**
- Review tidak mengubah skor.
- Review bukan approval period.
- Review tidak menghapus histori.
- Review tidak mengubah aturan penilaian.

---

### ROLE 3 — BIM Manager / Kepala Divisi BIM (Approver)

**Posisi**  
Otoritas legitimasi organisasi pada level period.

**Tujuan**  
Menetapkan keabsahan hasil penilaian BIM sebagai rekam jejak resmi organisasi.

**Bukan**
- Reviewer teknis evidence  
- Editor evidence  
- Pengatur skor manual  

**Tugas Inti**
1. Membaca ringkasan period.
2. Memastikan proses telah berjalan sah (evidence & review).
3. Mengambil keputusan:
   - `APPROVE PERIOD` atau
   - `REJECT APPROVAL`
4. Menuliskan alasan formal keputusan.

**Boundary Rules**
- Approval selalu pada level period (tidak parsial).
- Approval bersifat final dan tidak dapat di-undo.
- Approval tidak mengubah data atau skor.

---

## B. ROLE INTERACTION MATRIX

### B.1 Artefak Utama

| Artefak | BIM Koordinator Proyek | HO Reviewer | Approver |
|------|------------------------|-------------|----------|
| BIM Use Configuration | R | R | R |
| Indicator Definition | R | R | R |
| Evidence (Draft) | W | – | – |
| Evidence (Submitted) | R | R | – |
| Evidence Review Status | R | W | R |
| Review Reason & History | R | W | R |
| Period Summary (Open) | R | R | R |
| Final Score (Locked) | R | R | R |
| Snapshot Immutable | R | R | R |

**Legend**  
R = Read  
W = Write  
– = No Access  

---

### B.2 Keputusan & Kontrol

| Aksi / Keputusan | Proyek | HO Reviewer | Approver |
|------------------|--------|-------------|----------|
| Create / Edit Evidence | W | – | – |
| Submit Evidence | W | – | – |
| Review Evidence | – | D | – |
| Approve Period | – | – | D |
| Lock Period | – | – | D (system) |

**Legend**  
D = Decide

**Prinsip**
- Tidak ada write-upwards.
- Tidak ada decision overlap.
- Snapshot adalah artefak final (read-only untuk semua role).

---

## C. USER NARRATIVE

### C.1 User Narrative — BIM Koordinator Proyek

**Mulai dari**  
BIM Use yang dijalankan → Evidence.

**Urutan Kerja**
1. Identifikasi BIM Use.
2. Pilih indikator relevan.
3. Siapkan evidence (FILE / URL / TEXT).
4. Attach ke indikator.
5. Simpan sebagai DRAFT.
6. SUBMIT saat siap.
7. Tindak lanjuti hasil review.

**Catatan Penting**
- Mengunggah evidence tidak otomatis menaikkan skor.
- Skor hanya sah setelah review dan approval organisasi.

---

### C.2 User Narrative — HO Reviewer

**Mulai dari**  
Evidence berstatus `SUBMITTED`.

**Urutan Kerja**
1. Baca evidence dan konteksnya.
2. Nilai kelayakan evidence.
3. Tetapkan outcome review.
4. Tulis alasan keputusan.

**Catatan Penting**
- Review tidak mengubah skor.
- Review bukan approval.

---

### C.3 User Narrative — Approver

**Mulai dari**  
Ringkasan period yang telah lengkap secara proses.

**Urutan Kerja**
1. Memastikan proses berjalan sah.
2. Mengambil keputusan approval atau rejection.
3. Menuliskan alasan formal.
4. Period dikunci dan snapshot terbentuk (jika approved).

**Catatan Penting**
- Approval bersifat final.
- Approval tidak mengubah data atau skor teknis.

---

## STATUS DOKUMEN

**FOUNDATION HUMAN & GOVERNANCE LAYER — COMPLETE**

Dokumen ini menjadi **acuan resmi** untuk:
- desain UI Task Layer,
- penyusunan SOP & training,
- pilot internal,
- serta penjagaan konsistensi konsep BIM Scoring Platform.

Perubahan terhadap dokumen ini **harus melalui keputusan arsitektural**, bukan perubahan teknis ad-hoc.
