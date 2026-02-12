# Blueprint Alignment Change Log

Tanggal: 2026-02-12  
Scope: Remediation kesesuaian `doc/bim scoring blue print.md` pada API + Web

## Ringkasan

Remediation blueprint selesai di codebase untuk area scoring scale, exclude-unscored, evidence-indicator linkage, dan interpretasi level skor di UI. Governance write path (review/approval/lock/snapshot) tetap dipertahankan.

## Perubahan Utama

1. Scoring engine diselaraskan ke skala 0-100 dan exclude-unscored:
   - `d:/PROJECTS/bim-scoring-api/src/scoring/engine/calculateScore.cjs`
   - `d:/PROJECTS/bim-scoring-api/src/scoring/SPEC.v1.md`
2. Kontrak keputusan scoring didokumentasikan:
   - `d:/PROJECTS/bim-scoring-api/docs/ops/scoring-contract-alignment-adr-2026-02-12.md`
3. Write path evidence sekarang wajib linkage indikator dan submit tanpa linkage ditolak:
   - `d:/PROJECTS/bim-scoring-api/src/app.js`
   - `d:/PROJECTS/bim-scoring-web/bcl_scoring/src/lib/role1TaskLayer.ts`
4. UI approval/audit menampilkan level interpretasi skor blueprint:
   - `d:/PROJECTS/bim-scoring-web/bcl_scoring/src/pages/approve/projects/[projectId]/index.tsx`
   - `d:/PROJECTS/bim-scoring-web/bcl_scoring/src/pages/audit/snapshots/[snapshotId].tsx`
5. Contract/schema/regression test diselaraskan:
   - `d:/PROJECTS/bim-scoring-api/test/contract/schemas/summary.v2.schema.json`
   - `d:/PROJECTS/bim-scoring-api/tests/contract/schemas/summary.v2.schema.json`
   - `d:/PROJECTS/bim-scoring-api/test/contract/summary.v2.engine.integration.test.js`
   - `d:/PROJECTS/bim-scoring-api/test/contract/scoring.engine.scale.contract.test.js`
   - `d:/PROJECTS/bim-scoring-api/test/contract/evidence.write.h8.1.contract.test.js`

## Validasi

Command:

```bash
node --test test/contract/summary.v2.engine.integration.test.js test/contract/scoring.engine.scale.contract.test.js test/contract/evidence.write.h8.1.contract.test.js test/contract/evidence.approval.h8.3.contract.test.js test/contract/summary.v2.schema.test.js
```

Hasil:
1. `tests=19`
2. `pass=19`
3. `fail=0`

## Catatan Rollout

1. Perubahan di atas sudah siap secara kontrak dan regression test pada workspace dev.
2. Aktivasi di environment produksi tetap mengikuti release gate operasional.

## Eksekusi Rollout (2026-02-12)

1. Push API ke `main`:
   - Commit: `497182e`
   - Repo: `https://github.com/asadara/bim-scoring-api`
2. Push Web ke `main`:
   - Commit: `6c8d92b`
   - Repo: `https://github.com/asadara/bim-scoring-web`
3. Smoke check publik:
   - `https://bim-scoring-web.onrender.com/` -> `200`
   - `https://bim-scoring-web.onrender.com/projects` -> `200`
   - `https://bim-scoring-web.onrender.com/ho/review` -> `200`
   - `https://bim-scoring-web.onrender.com/approve` -> `200`
   - `https://bim-scoring-web.onrender.com/audit` -> `200`
   - `https://bim-scoring-api.onrender.com/health` -> `200`
   - `https://bim-scoring-api.onrender.com/ready` -> `200`
4. Verifikasi pasca-deploy:
   - Summary produksi menunjukkan skala baru (`total_score=6`, `weighted_P1=6`) untuk period sample yang sama.
   - Bundle frontend produksi route approval memuat token label interpretasi (`Score level`).
5. Status rollout gate:
   - `COMPLETE`
