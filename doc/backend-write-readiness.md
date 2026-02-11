# Backend Write Readiness
## BIM Scoring Platform

> Dokumen ini mendefinisikan kesiapan dan batasan sebelum aktivasi **backend write**  
> (Phase H8). Dokumen ini **tidak berisi implementasi teknis**, hanya keputusan
> arsitektural dan governance agar proses write aman, audit-safe, dan konsisten
> dengan metodologi BIM Scoring yang telah dikunci.

---

## 1. Tujuan Dokumen

Dokumen ini bertujuan untuk:
- Menghindari trial-and-error saat mengaktifkan backend write
- Menjaga separation of duty antar role
- Menjamin audit trail yang dapat ditelusuri
- Mencegah perubahan skor atau keputusan secara implisit

Dokumen ini **wajib disetujui** sebelum Phase H8 dimulai.

---

## 2. Prinsip Dasar (LOCKED)

Prinsip berikut **tidak boleh dilanggar** oleh implementasi backend write:

- Evidence **tidak otomatis** mengubah skor
- Review **bukan** approval
- Approval **mengunci period**
- Snapshot bersifat **append-only dan immutable**
- Tidak ada silent overwrite
- Tidak ada retroactive edit pada period yang sudah LOCKED
- Pemetaan ISO 19650 bersifat **reference only**, bukan klaim kepatuhan

---

## 3. Write Surface (Apa yang Boleh Ditulis)

Backend write **dibatasi hanya pada permukaan berikut**:

### 3.1 Evidence
- Create Evidence (Draft)
- Update Evidence (Revision)
- Submit Evidence (Draft → Submitted)

### 3.2 Review
- Create Review Outcome:
  - `ACCEPTABLE`
  - `NEEDS_REVISION`
  - `REJECTED`
- Review **selalu append-only** (tidak overwrite histori)

### 3.3 Approval
- Approve Period
- Reject Approval (Period tetap OPEN)

### 3.4 Snapshot (System-generated)
- Create Snapshot saat period di-approve
- Snapshot **tidak bisa diedit atau dihapus**

---

## 4. Write Authority (Siapa Boleh Menulis Apa)

| Role | Write Authority | Catatan |
|---|---|---|
| Role 1 — BIM Koordinator Proyek | Evidence (Draft / Submit / Revision) | Tidak boleh review atau approve |
| Role 2 — HO Reviewer | Review Outcome + Reason | Tidak boleh approve period |
| Role 3 — Approver (BIM Manager / KaDiv BIM) | Approval Period + Reason | Keputusan final organisasi |
| System | Snapshot creation | Berdasarkan approval |

Tidak ada role lain yang memiliki hak write.

---

## 5. Failure Semantics (Jika Write Gagal)

### 5.1 Evidence Write Gagal
- Evidence **tidak tersimpan**
- UI menampilkan pesan eksplisit (tidak silent)
- User dapat retry secara manual

### 5.2 Review Write Gagal
- Review outcome **tidak tercatat**
- Evidence tetap pada status sebelumnya
- Tidak boleh ada status setengah jalan

### 5.3 Approval Write Gagal
- Period **tetap OPEN**
- Tidak ada snapshot yang terbentuk
- User diberi pesan kegagalan eksplisit

---

## 6. Lock Enforcement

### 6.1 OPEN Period
- Evidence write: diperbolehkan
- Review write: diperbolehkan
- Approval: diperbolehkan

### 6.2 LOCKED Period
- Semua write **HARUS DITOLAK**
- Backend mengembalikan error eksplisit
- UI berada dalam mode read-only

Lock **tidak dapat dibuka kembali** pada period yang sama.

---

## 7. Audit Guarantees

Backend write **wajib menjamin**:

- Semua keputusan dapat ditelusuri:
  - siapa
  - kapan
  - apa keputusannya
  - alasannya
- Tidak ada penghapusan histori
- Snapshot menjadi referensi final untuk audit
- Auditor hanya membaca snapshot, bukan data mutable

---

## 8. Out of Scope (Tidak Boleh Ada)

Hal berikut **secara eksplisit dilarang** pada Phase H8:

- Perubahan formula scoring
- Perubahan bobot perspektif
- Penambahan indikator baru via UI
- Klaim compliance ISO
- Auto-adjust skor berdasarkan evidence
- Approval parsial per indikator

---

## 9. Kriteria Siap Masuk Phase H8

Phase H8 **boleh dimulai hanya jika**:

- Dokumen ini disetujui
- UX Governance (H6) sudah CLOSED
- Frontend task-layer stabil
- Stakeholder memahami batas write & konsekuensi approval

---

## 10. Penutup

Backend write adalah fase **paling sensitif** dalam BIM Scoring Platform.  
Dokumen ini dibuat untuk memastikan bahwa aktivasi write:

- Disengaja
- Terbatas
- Dapat diaudit
- Tidak mengkhianati metodologi

Jika terjadi konflik keputusan saat implementasi, **dokumen ini menjadi referensi utama**.

---
