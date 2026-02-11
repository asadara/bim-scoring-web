# BIM Scoring Platform — Architecture Guardrails

Status: **ACTIVE & ENFORCED**  
Scope: **System Integrity / AI-Assisted Development**  
Audience: **Developers & AI Coding Assistants (VS Code)**

Dokumen ini mendefinisikan batas keras (guardrails) yang **TIDAK BOLEH dilanggar**
oleh manusia maupun AI selama pengembangan BIM Scoring Platform.

---

## 1. CORE PRINCIPLES (DO NOT CHANGE)

### Scoring Methodology
- Skoring berbasis **5 Perspektif** (P1–P5).
- Skala indikator **0–5**.
- Bobot perspektif **FIX di level organisasi**.
- Indikator **boleh berbeda per proyek**.
- Indikator tidak relevan **DIKELUARKAN dari perhitungan (bukan nol)**.
- **Formula resmi TIDAK BOLEH diubah.**

### Evidence Rules
- Evidence **TIDAK langsung mengubah skor**.
- Evidence harus selalu terikat ke **indikator**.
- Jumlah evidence **bukan faktor bobot**.
- Evidence berdiri sebagai **bukti**, bukan klaim nilai.

---

## 2. GOVERNANCE SEPARATION (HARD RULE)

### Role Separation (WAJIB)
- **BIM Koordinator Proyek**
  - Create / edit / submit evidence
- **HO Reviewer**
  - Review eligibility evidence
  - Outcome: ACCEPTABLE / NEEDS REVISION / REJECTED
- **Approver (BIM Manager / KaDiv BIM)**
  - Approve / reject period
  - Lock period & trigger snapshot

### Governance Rules
- Review **!=** Approval **!=** Locking
- Approval selalu **di level period**, bukan indikator/evidence.
- Approval bersifat **final** (no undo).
- Snapshot bersifat **immutable**.

---

## 3. PHASE STATUS (LOCKED)

### CLOSED & FROZEN
- Phase 1 — Scoring & Evidence
- Gate C — Configuration & Alignment (reference-only)
- Phase 2A — Controlled Data Entry
- Phase 2B — Review & Eligibility
- Phase 2C — Approval, Locking & Snapshot

### RULE
- **TIDAK BOLEH** mengubah behavior phase yang sudah CLOSED.
- Perubahan hanya boleh **additive**, eksplisit, dan terisolasi.

---

## 4. FRONTEND RULES

- Frontend = **viewer & interaction layer**
- Backend = **truth & contract-first**
- **Tidak ada browser-only code di backend**
- **Tidak ada silent fallback**
- **Tidak ada auto-open file / link**
- **Tidak ada UI yang menyiratkan:**
  - lebih banyak evidence = skor lebih tinggi
  - submit = approve
  - review = approve

---

## 5. DATA & STATE HANDLING

- Jika data tidak tersedia → tampilkan **“Not available”**
- Dilarang membuat:
  - fake data
  - synthetic fallback
  - auto-repair logic
- Semua state harus **traceable & explainable**.

---

## 6. AI CODING INSTRUCTION (MANDATORY)

Untuk setiap AI (Copilot, Cline, dsb.):

- **DO NOT**
  - invent workflow baru
  - menyederhanakan governance
  - menggabungkan role
  - mengubah istilah resmi (Evidence, Review, Approval, Snapshot)
- **MUST**
  - bertanya sebelum asumsi role/permission baru
  - patuh pada phase status
  - menjaga read-only area tetap read-only

Jika ragu → **STOP dan minta konfirmasi manusia**.

---

## 7. SINGLE SOURCE OF TRUTH

- Metodologi scoring: **LOCKED**
- Governance & role: **LOCKED**
- Dokumen ini adalah **guardrail aktif**.

Pelanggaran terhadap dokumen ini dianggap sebagai **architectural defect**,  
bukan sekadar bug implementasi.
