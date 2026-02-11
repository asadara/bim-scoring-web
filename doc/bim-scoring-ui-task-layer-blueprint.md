---
title: BIM Scoring Platform — UI Task Layer Blueprint
version: 1.0
status: LOCKED
scope: UX / Task Layer / Non-Implementation
owner: BIM Scoring Platform
last_updated: 2026-02-08
---

# BIM Scoring Platform  
## UI Task Layer Blueprint

Dokumen ini mendefinisikan **UI Task Layer** sebagai lapisan antarmuka berbasis tugas
yang menerjemahkan **User Narrative per Role** ke dalam pengalaman pengguna,
tanpa mengubah sistem, metodologi scoring, atau governance.

Dokumen ini **BUKAN** spesifikasi visual, **BUKAN** implementasi UI,
dan **BUKAN** perubahan arsitektur backend.

---

## 1. PRINSIP DASAR (DIKUNCI)

1. UI mengikuti **peran**, bukan fitur.
2. UI berorientasi **tugas**, bukan data mentah.
3. Evidence ≠ Skor (harus selalu terasa di UI).
4. Setiap role memiliki **entry point yang jelas**.
5. Tidak ada UI yang melompati governance.

---

## 2. GLOBAL ENTRY POINT (SEMUA ROLE)

### Landing Setelah Login
UI pertama yang dilihat user **BUKAN dashboard skor**, tetapi:

> **“Apa yang perlu saya lakukan pada period ini?”**

Elemen wajib:
- Role aktif user
- Period aktif
- Status period (OPEN / LOCKED)

---

## 3. UI TASK LAYER — BIM KOORDINATOR PROYEK

### 3.1 Home / Task Panel
**Judul Konseptual:**  
**Evidence Tasks — Proyek**

Elemen:
- Period aktif
- Ringkasan status evidence:
  - Draft
  - Submitted
  - Needs Revision
- CTA utama:
  > **Tambahkan Evidence untuk BIM Use**

Catatan:
- Skor **tidak ditampilkan** sebagai target.

---

### 3.2 Task Flow — Tambahkan Evidence

Urutan konseptual:
1. Pilih BIM Use
2. Pilih indikator
3. Pilih tipe evidence:
   - FILE (referensi / placeholder upload)
   - URL
   - TEXT
4. Isi metadata minimum
5. Simpan sebagai:
   - DRAFT (default)
   - SUBMIT

Copy UI wajib:
> “Evidence yang disubmit akan direview dan tidak langsung memengaruhi skor.”

---

### 3.3 Status & Feedback
Status evidence:
- Draft
- Submitted
- Needs Revision
- Reviewed

Aksi hanya muncul jika sah:
- Revisi hanya jika `NEEDS REVISION`

---

## 4. UI TASK LAYER — HO REVIEWER

### 4.1 Home / Task Panel
**Judul Konseptual:**  
**Evidence Review Tasks**

Elemen:
- Jumlah evidence `SUBMITTED`
- CTA utama:
  > **Review Evidence**

Catatan:
- Tidak ada tombol approval period.

---

### 4.2 Task Flow — Review Evidence
Elemen selalu terlihat:
- Evidence
- Indikator
- BIM Use
- Metadata

Aksi wajib (pilih satu):
- ACCEPTABLE
- NEEDS REVISION
- REJECTED

Field alasan **wajib diisi**.

Copy UI:
> “Review ini tidak mengubah skor dan bukan approval period.”

---

## 5. UI TASK LAYER — APPROVER (BIM MANAGER)

### 5.1 Home / Task Panel
**Judul Konseptual:**  
**Period Approval**

Elemen:
- Ringkasan period
- Skor total & breakdown P1–P5
- Status evidence

CTA tunggal:
> **Approve / Reject Period**

---

### 5.2 Task Flow — Approve Period
Sebelum aksi:
> “Approval akan mengunci period dan membentuk rekam jejak final.”

Aksi:
- APPROVE PERIOD
- REJECT APPROVAL

Field alasan **wajib**.

---

## 6. UI ANTI-PATTERN (DILARANG)

- Satu dashboard untuk semua role
- Tombol upload tanpa konteks BIM Use
- Skor sebagai target proyek
- Progress bar berbasis jumlah evidence
- Wizard lintas role

---

## 7. RELASI DENGAN SYSTEM VIEW

- Dashboard existing = **System / Audit View**
- UI Task Layer = **Human Entry Layer**

Keduanya **berdampingan**, tidak saling menggantikan.

---

## STATUS DOKUMEN

**UI TASK LAYER BLUEPRINT — LOCKED**

Dokumen ini menjadi acuan resmi untuk:
- desain UI berbasis peran,
- mockup UX,
- prototyping frontend,
- dan evaluasi konsistensi pengalaman pengguna.

Perubahan terhadap dokumen ini harus melalui keputusan arsitektural,
bukan eksperimen UI ad-hoc.
