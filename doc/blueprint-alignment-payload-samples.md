# Blueprint Alignment Payload Samples (Before/After)

Tanggal: 2026-02-12  
Tujuan: Menyediakan contoh payload audit untuk perubahan kontrak remediation blueprint.

Catatan:
1. Sample **after** mengacu pada contract/regression test yang lulus.
2. Sample **before** untuk scoring dihitung dari formula baseline pre-remediation (`weighted_score = avg * weight / 100`).
3. Sample **before** untuk evidence linkage didasarkan pada baseline route yang belum memvalidasi `indicator_ids`.

## 1) Summary Score Scale

### Scenario
- Semua perspektif bernilai 5.
- Bobot organisasi: P1=15, P2=30, P3=20, P4=15, P5=20.

### Before (pre-remediation scale 0-5)

```json
{
  "perspectives": [
    { "perspective_id": "P1", "average_score": 5, "weighted_score": 0.75 },
    { "perspective_id": "P2", "average_score": 5, "weighted_score": 1.5 },
    { "perspective_id": "P3", "average_score": 5, "weighted_score": 1.0 },
    { "perspective_id": "P4", "average_score": 5, "weighted_score": 0.75 },
    { "perspective_id": "P5", "average_score": 5, "weighted_score": 1.0 }
  ],
  "total_score": 5
}
```

### After (post-remediation scale 0-100)

```json
{
  "perspectives": [
    { "perspective_id": "P1", "average_score": 5, "weighted_score": 15 },
    { "perspective_id": "P2", "average_score": 5, "weighted_score": 30 },
    { "perspective_id": "P3", "average_score": 5, "weighted_score": 20 },
    { "perspective_id": "P4", "average_score": 5, "weighted_score": 15 },
    { "perspective_id": "P5", "average_score": 5, "weighted_score": 20 }
  ],
  "total_score": 100
}
```

Evidence:
1. `d:/PROJECTS/bim-scoring-api/src/scoring/engine/calculateScore.cjs`
2. `d:/PROJECTS/bim-scoring-api/test/contract/scoring.engine.scale.contract.test.js`

## 2) Exclude-Unscored Denominator

### Scenario
- Perspektif P1 memiliki dua row: `4` dan `null`.

### Before (null ikut denominator)

```json
{
  "perspective_id": "P1",
  "indicator_count": 2,
  "average_score": 2,
  "weighted_score": 0.3,
  "total_score": 0.3
}
```

### After (null di-exclude dari denominator)

```json
{
  "perspective_id": "P1",
  "indicator_count": 1,
  "average_score": 4,
  "weighted_score": 12,
  "total_score": 12
}
```

Evidence:
1. `d:/PROJECTS/bim-scoring-api/src/scoring/engine/calculateScore.cjs`
2. `d:/PROJECTS/bim-scoring-api/test/contract/scoring.engine.scale.contract.test.js`

## 3) Evidence Write Linkage Enforcement

### Request (tanpa `indicator_ids`)

```json
{
  "idempotency_key": "create-no-indicator",
  "type": "URL",
  "title": "Evidence without indicator reference",
  "uri": "https://example.test/no-indicator"
}
```

### Before

```json
{
  "status": 201,
  "ok": true,
  "note": "Tidak ada validasi wajib indicator_ids pada create evidence route."
}
```

### After

```json
{
  "status": 400,
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "indicator_ids is required and must contain at least one indicator reference"
  }
}
```

Evidence:
1. `d:/PROJECTS/bim-scoring-api/src/app.js`
2. `d:/PROJECTS/bim-scoring-api/test/contract/evidence.write.h8.1.contract.test.js`
