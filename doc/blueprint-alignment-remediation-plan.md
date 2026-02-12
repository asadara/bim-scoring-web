# Blueprint Alignment Remediation Plan

Status: Completed (Codebase)  
Tanggal: 2026-02-12  
Owner: Engineering (API + Web)  
Scope: Penyelarasan implementasi dengan `doc/bim scoring blue print.md`

## 1. Tujuan

Dokumen ini berisi rencana perbaikan terurut untuk menutup gap kesesuaian terhadap blueprint, dengan fokus:

1. Menyamakan hasil skor akhir ke skala 0-100.
2. Menegakkan rule "exclude unscored / not relevant".
3. Menjaga evidence tetap terikat ke indikator secara end-to-end.
4. Menjaga governance tetap audit-safe (review != approval != lock).

## 2. Ringkasan Gap Saat Ini

1. Skor total engine masih 0-5, belum 0-100.
2. Claim `exclude-unscored` belum konsisten di level kalkulasi denominator.
3. Backend write evidence belum menegakkan linkage indikator.
4. Interpretasi level skor blueprint belum tersedia di API/UI.

## 3. Prinsip Eksekusi

1. Urutan perbaikan harus dari kontrak dan engine dulu, baru UI.
2. Setiap perubahan wajib disertai contract test/golden test.
3. Perubahan governance dan phase locked behavior tidak boleh diubah.
4. Rollout bertahap via feature flag/release gate, bukan big-bang.

## 4. Rencana Perbaikan Terurut

## Step 1 - Lock Kontrak Target (P0)

Tujuan:
1. Menetapkan kontrak final bahwa `total_score` berada pada rentang 0-100.
2. Menetapkan definisi operasional "unscored/not relevant tidak masuk denominator".

Aktivitas:
1. Buat keputusan kontrak tertulis (ADR ringan) di folder `docs/` API.
2. Sinkronkan wording di spec engine, guardrail, dan blueprint implementasi.
3. Tetapkan backward-compat policy untuk consumer lama (jika ada).

Deliverable:
1. Dokumen keputusan kontrak final.
2. Daftar field API yang berubah/tetap.

Definition of Done:
1. Semua owner setuju satu definisi skor (0-100) dan exclude-unscored.
2. Tidak ada dokumen internal yang saling bertentangan.

## Step 2 - Koreksi Engine Scoring (P0)

Tujuan:
1. Menjadikan formula implementasi identik dengan blueprint.
2. Memastikan indikator unscored tidak dihitung sebagai nol terselubung.

Aktivitas:
1. Ubah kalkulasi per perspektif agar denominator hanya indikator scored/relevant.
2. Ubah agregasi akhir agar `total_score` 0-100.
3. Pertahankan bobot organisasi tetap (P1=15, P2=30, P3=20, P4=15, P5=20).

Target area:
1. `bim-scoring-api/src/scoring/engine/calculateScore.cjs`
2. `bim-scoring-api/src/scoring/preprocess/applyEvidenceRules.cjs`
3. `bim-scoring-api/src/scoring/SPEC.v1.md`

Deliverable:
1. Engine output baru yang konsisten 0-100.
2. Audit row tetap memuat `is_scored` dan alasan cap.

Definition of Done:
1. Kasus all-5 menghasilkan `total_score=100`.
2. Kasus unscored menghasilkan indikator excluded dari denominator.
3. Tidak ada regresi pada behavior cap evidence.

## Step 3 - Penyesuaian Contract API + Schema Test (P0)

Tujuan:
1. Menjamin endpoint summary dan indicator-scores mencerminkan behavior baru secara eksplisit.

Aktivitas:
1. Update schema JSON summary dan indicator contract bila diperlukan.
2. Update/ tambah test untuk skenario:
   - all scored
   - partial scored
   - all unscored
3. Regenerate golden payload yang terdampak.

Target area:
1. `bim-scoring-api/src/app.js`
2. `bim-scoring-api/test/contract/schemas/*.json`
3. `bim-scoring-api/test/contract/summary.v2.*.test.js`
4. `bim-scoring-api/test/contract/golden/*.json`

Deliverable:
1. Contract tests pass dengan ekspektasi skala 0-100.
2. Golden snapshot baru tervalidasi.

Definition of Done:
1. CI test contract hijau.
2. Tidak ada endpoint scoring yang ambigu soal skala output.

## Step 4 - Enforce Evidence-Indicator Linkage di Write Path (P0)

Tujuan:
1. Menutup gap antara aturan UI dan backend pada keterikatan evidence ke indikator.

Aktivitas:
1. Tambah validasi payload create/update evidence agar wajib ada referensi indikator.
2. Persist relasi evidence ke indikator/input secara eksplisit.
3. Tolak write tanpa linkage dengan error code yang jelas.

Target area:
1. `bim-scoring-api/src/app.js` (endpoint `/periods/:period_id/evidences*`)
2. Struktur tabel/link yang dipakai (`input_evidence_links` atau relasi setara)
3. `bim-scoring-web/bcl_scoring/src/lib/role1TaskLayer.ts` (payload write)

Deliverable:
1. Write flow backend-only tetap aman dan konsisten dengan rule blueprint.
2. Read endpoint indicator-evidence mencerminkan linkage write terbaru.

Definition of Done:
1. Request write tanpa indikator gagal 4xx (deterministik).
2. Request write valid menghasilkan linkage yang terbaca di endpoint read.

## Step 5 - Sinkronisasi UI dan Label Interpretasi (P1)

Tujuan:
1. Menampilkan skor sesuai skala baru dan menambahkan level interpretasi blueprint.

Aktivitas:
1. Pastikan halaman approval/audit menampilkan `total_score` 0-100.
2. Tambah label level:
   - <40 Symbolic
   - 40-60 Partial
   - 60-75 Functional
   - 75-90 Integrated
   - >90 BIM-Driven
3. Pastikan wording tidak menyalahi guardrail governance.

Target area:
1. `bim-scoring-web/bcl_scoring/src/pages/approve/projects/[projectId]/index.tsx`
2. `bim-scoring-web/bcl_scoring/src/pages/audit/snapshots/[snapshotId].tsx`
3. Komponen presentasi terkait score badge/summary.

Deliverable:
1. UI score + level interpretasi konsisten dengan blueprint.

Definition of Done:
1. Tidak ada mismatch angka antara API dan UI.
2. Label level tampil konsisten di halaman yang menampilkan total score.

## Step 6 - Hardening Regression & Audit Evidence (P1)

Tujuan:
1. Mengunci perbaikan agar tidak regress di release berikutnya.

Aktivitas:
1. Tambah regression test untuk skenario blueprint-critical.
2. Simpan contoh payload before/after untuk audit internal.
3. Update dokumen operasional dan phase status log.

Target area:
1. `bim-scoring-api/test/contract/*`
2. `bim-scoring-web/doc/phase-status-log.md`
3. Dokumen change log release.

Deliverable:
1. Paket bukti validasi pasca-fix (test log + payload sample + changelog).

Definition of Done:
1. Semua test kritis lulus.
2. Evidence perubahan tersimpan dan traceable.

## 5. Urutan Eksekusi Disarankan (Timeline Praktis)

1. Hari 1: Step 1 (kontrak) selesai.
2. Hari 1-2: Step 2 (engine) selesai + unit test dasar.
3. Hari 2-3: Step 3 (contract/schema/golden) selesai.
4. Hari 3-4: Step 4 (linkage write path) selesai.
5. Hari 4: Step 5 (UI sync) selesai.
6. Hari 5: Step 6 (hardening + evidence release) selesai.

## 6. Risiko dan Mitigasi

1. Risiko: Consumer lama mengasumsikan skala 0-5.
Mitigasi: versi kontrak jelas, changelog, dan fallback mapping sementara bila perlu.

2. Risiko: Perubahan linkage write mempengaruhi data lama.
Mitigasi: migrasi/backfill terkontrol dan validasi data historis.

3. Risiko: Ambiguitas definisi relevant vs unscored.
Mitigasi: satu definisi operasional tertulis di Step 1 dan dijadikan dasar test.

## 7. Kriteria Exit (Blueprint Inline)

Proyek dinyatakan inline jika seluruh poin berikut terpenuhi:

1. `total_score` valid pada skala 0-100.
2. Unscored/not relevant benar-benar excluded dari denominator.
3. Bobot perspektif konsisten lintas proyek.
4. Evidence write selalu terikat indikator.
5. UI menampilkan interpretasi level skor sesuai blueprint.
6. Contract test dan regression test kritis lulus penuh.

## 8. Laporan Keberhasilan Perbaikan (Update 2026-02-12)

### Status Eksekusi Step

| Step | Status | Ringkasan Hasil |
|---|---|---|
| Step 1 - Lock Kontrak Target | COMPLETE | Kontrak skor final dikunci ke skala 0-100 + definisi exclude-unscored terdokumentasi. |
| Step 2 - Koreksi Engine Scoring | COMPLETE | Engine menghitung kontribusi per perspektif ke skala 0-100 dan mengecualikan unscored dari denominator. |
| Step 3 - Contract API + Schema Test | COMPLETE | Schema dan contract test diselaraskan ke `total_score` 0-100; integrasi summary disesuaikan dengan evidence-cap aktif. |
| Step 4 - Enforce Evidence Linkage | COMPLETE | Write path evidence kini mewajibkan linkage indikator dan submit tanpa linkage ditolak deterministik. |
| Step 5 - Sinkronisasi UI & Interpretasi | COMPLETE | Halaman approval/audit menampilkan label interpretasi level skor sesuai blueprint. |
| Step 6 - Hardening Regression & Audit Evidence | COMPLETE | Regression pack kritis hijau; payload sample before/after, changelog remediation, dan phase status log sudah diperbarui. |

### Evidence Implementasi (File-Level)

1. Kontrak & ADR:
   - `d:/PROJECTS/bim-scoring-api/docs/ops/scoring-contract-alignment-adr-2026-02-12.md`
   - `d:/PROJECTS/bim-scoring-api/src/scoring/SPEC.v1.md`
2. Engine scoring 0-100 + exclude-unscored:
   - `d:/PROJECTS/bim-scoring-api/src/scoring/engine/calculateScore.cjs`
3. Enforce evidence-indicator linkage (backend + payload frontend):
   - `d:/PROJECTS/bim-scoring-api/src/app.js`
   - `d:/PROJECTS/bim-scoring-web/bcl_scoring/src/lib/role1TaskLayer.ts`
4. UI interpretasi level:
   - `d:/PROJECTS/bim-scoring-web/bcl_scoring/src/pages/approve/projects/[projectId]/index.tsx`
   - `d:/PROJECTS/bim-scoring-web/bcl_scoring/src/pages/audit/snapshots/[snapshotId].tsx`
5. Contract/schema/regression tests:
   - `d:/PROJECTS/bim-scoring-api/test/contract/schemas/summary.v2.schema.json`
   - `d:/PROJECTS/bim-scoring-api/tests/contract/schemas/summary.v2.schema.json`
   - `d:/PROJECTS/bim-scoring-api/test/contract/summary.v2.engine.integration.test.js`
   - `d:/PROJECTS/bim-scoring-api/test/contract/scoring.engine.scale.contract.test.js`
   - `d:/PROJECTS/bim-scoring-api/test/contract/evidence.write.h8.1.contract.test.js`
6. Audit evidence release docs:
   - `d:/PROJECTS/bim-scoring-web/doc/blueprint-alignment-payload-samples.md`
   - `d:/PROJECTS/bim-scoring-web/doc/blueprint-alignment-change-log.md`
   - `d:/PROJECTS/bim-scoring-web/doc/phase-status-log.md`

### Evidence Validasi (Run Terakhir)

1. Command:
   - `node --test test/contract/summary.v2.engine.integration.test.js test/contract/scoring.engine.scale.contract.test.js test/contract/evidence.write.h8.1.contract.test.js test/contract/evidence.approval.h8.3.contract.test.js test/contract/summary.v2.schema.test.js`
2. Hasil:
   - `tests=19, pass=19, fail=0` (TAP, run date: 2026-02-12).

## 9. Status Rollout (Update 2026-02-12)

1. Rollout trigger sudah dijalankan via push ke `main`:
   - API commit: `497182e`
   - Web commit: `6c8d92b`
2. Smoke checks endpoint publik lulus (`200`) untuk route frontend utama dan endpoint API `/health` + `/ready`.
3. Status gate rollout saat ini: `IN PROGRESS` sampai log deploy Render mengonfirmasi commit terbaru sudah terdeploy penuh.
