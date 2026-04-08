# PMP Area 15 Integration Tracker

Status: ACTIVE  
Scope: Integrasi PMP Area 15 ke BIM Scoring tanpa dual entry  
Tracking mode: staged rollout

## Stage List

| Stage | Status | Outcome |
|---|---|---|
| 0. Blueprint governance | COMPLETE | Blueprint integrasi resmi tersedia. |
| 1. Backend compliance bridge | COMPLETE | API mampu membangun summary PMP 15 dari config + scoring + evidence readiness. |
| 2. Config baseline mapping | COMPLETE | Config project memiliki baseline `pmp_area15` controls untuk planning, execution, dan audit/hold point. |
| 3. Summary contract extension | COMPLETE | Summary response dapat memuat blok `compliance.pmp_area15`. |
| 4. UI compliance visibility | COMPLETE | Ringkasan PMP 15 tampil di approver context, approval decision, dan audit snapshot. |
| 5. Export generator | COMPLETE | Generate Excel PMP Area 15 tersedia dari project workspace dan audit snapshot. |
| 6. Audit and hold point workflow alignment | COMPLETE | Approval gate sekarang membaca `hold_point_ready` dari bridge PMP Area 15. |
| 7. Project action list from PMP blockers | COMPLETE | Workspace project menurunkan daftar aksi langsung dari blocker bridge PMP Area 15. |
| 8. Official control-to-indicator mapping baseline | COMPLETE | Bridge PMP sekarang mengikuti katalog indikator resmi dan mapping per-control eksplisit. |

## Completed This Turn

### Stage 0. Blueprint governance

Done:

- menegaskan posisi PMP sebagai governance layer
- menegaskan BIM Scoring sebagai source of truth operasional
- menegaskan Excel hanya sebagai output ekspor

Reference:

- `doc/pmp-area15-bim-integration-blueprint.md`

### Stage 1. Backend compliance bridge

Done:

- bridge summary `PMP Area 15` dibangun di backend
- bridge membaca config `pmp_area15`
- bridge mengevaluasi mapping, score, evidence readiness, dan status export/hold point

Implementation:

- `bim-scoring-api/src/compliance/buildPmpArea15Summary.js`

### Stage 2. Config baseline mapping

Done:

- baseline control planning, execution, dan audit/hold point ditambahkan ke config project yang tersedia
- mapping bersifat additive dan tidak mengubah engine score

Implementation:

- `bim-scoring-api/src/scoring/config/projects/BIM-BASE.json`
- `bim-scoring-api/src/scoring/config/projects/PRJ-001.json`
- `bim-scoring-api/src/scoring/config/projects/ce100c29-ec41-4334-9f68-6810b293cb96.json`
- `bim-scoring-api/src/scoring/config/projects/07d07ae1-28de-4a12-a342-27c6f052afd4.json`

### Stage 3. Summary contract extension

Done:

- response summary dapat memuat blok `compliance.pmp_area15`
- bridge berjalan additive terhadap response existing

Implementation:

- `bim-scoring-api/src/routes/projectReadRoutes.js`

### Stage 4. UI compliance visibility

Done:

- panel ringkas PMP Area 15 ditambahkan ke halaman context approval
- panel yang sama ditambahkan ke halaman keputusan approval
- audit snapshot sekarang menampilkan governance readout PMP Area 15 dari summary backend

Implementation:

- `bcl_scoring/src/components/PmpArea15CompliancePanel.tsx`
- `bcl_scoring/src/lib/approverTaskLayer.ts`
- `bcl_scoring/src/pages/approve/projects/[projectId]/index.tsx`
- `bcl_scoring/src/pages/approve/projects/[projectId]/decision.tsx`
- `bcl_scoring/src/pages/audit/snapshots/[snapshotId].tsx`
- `bcl_scoring/src/styles/task-layer.css`

### Stage 5. Export generator

Done:

- generator `.xlsx` dibuat dari bridge `compliance.pmp_area15`
- export tersedia di workspace project role 1
- export juga tersedia di audit snapshot untuk kebutuhan governance/audit
- Excel sekarang menjadi artefak hasil generate, bukan media input kerja

Implementation:

- `bcl_scoring/src/lib/pmpArea15Export.ts`
- `bcl_scoring/src/pages/projects/[projectId].tsx`
- `bcl_scoring/src/pages/audit/snapshots/[snapshotId].tsx`
- `bcl_scoring/package.json`
- `bcl_scoring/package-lock.json`

### Stage 6. Audit and hold point workflow alignment

Done:

- approval gate sekarang membaca `hold_point_ready` dari summary PMP Area 15
- jika bridge tidak tersedia atau hold point belum ready, `APPROVE PERIOD` diblokir
- decision page menampilkan status gate PMP secara eksplisit

Implementation:

- `bcl_scoring/src/lib/approverTaskLayer.ts`
- `bcl_scoring/src/pages/approve/projects/[projectId]/decision.tsx`

### Stage 7. Project action list from PMP blockers

Done:

- workspace Role 1 sekarang menampilkan daftar aksi PMP Area 15 yang diturunkan otomatis dari blocker bridge
- blocker evidence, scoring, dan mapping dipisahkan menjadi action card yang lebih operasional
- tim project dapat menindak gap governance tanpa membuka atau mengisi form PMP terpisah

Implementation:

- `bcl_scoring/src/components/PmpArea15ActionList.tsx`
- `bcl_scoring/src/pages/projects/[projectId].tsx`
- `bcl_scoring/src/styles/task-layer.css`

### Stage 8. Official control-to-indicator mapping baseline

Done:

- bridge PMP tidak lagi bergantung hanya pada selector generik berbasis tag/perspective
- active indicator dari database sekarang di-hydrate ke katalog indikator resmi yang mengikuti seed baseline organisasi
- control PMP sekarang dipetakan eksplisit ke `indicator_ids` resmi, termasuk pemisahan execution menjadi implementasi vs efektivitas perubahan

Implementation:

- `bim-scoring-api/src/scoring/config/pmpArea15OfficialBaseline.cjs`
- `bim-scoring-api/src/scoring/runProjectScoring.cjs`
- `bim-scoring-api/test/unit/pmpArea15OfficialBaseline.unit.test.js`

## Next Stage

Priority berikutnya:

1. tambah format export PDF PMP Area 15 bila dibutuhkan governance
2. sinkronkan config proyek dengan penetapan indikator aktif per project agar coverage bridge mencerminkan assignment lapangan yang aktual
