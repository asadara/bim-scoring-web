
# PMP Area 15 x BIM Scoring Integration Blueprint

Status: ACTIVE  
Owner: BIM / Engineering Digitalization  
Intent: Menjadikan BIM Scoring sebagai source of truth operasional, lalu menghasilkan PMP Area 15 sebagai output governance dan audit.

## 1. Design Position

- PMP Area 15 tetap menjadi kontrol induk resmi proyek.
- BIM Scoring menjadi sistem kerja harian untuk input, scoring, evidence, traceability, audit trail, dan hold point readiness.
- Excel PMP 15 tidak lagi dipakai sebagai media kerja utama.
- Excel PMP 15 hanya menjadi artefak hasil generate saat dibutuhkan oleh audit, hold point, atau departemen lain.

## 2. Core Rule

Tim project hanya boleh bekerja pada satu sistem input:

- isi kontrol BIM Scoring
- lampirkan evidence
- submit untuk review

Sistem kemudian menurunkan secara otomatis:

- status PMP Area 15 planning
- status PMP Area 15 execution
- readiness audit
- readiness hold point
- output ekspor Excel/PDF bila diperlukan

## 3. Target Architecture

### Layer 1. Governance

PMP Area 15 tetap menyatakan:

- requirement apa yang wajib dipenuhi
- kapan diverifikasi
- siapa PIC approval
- kapan hold point boleh dilepas

### Layer 2. Translation Bridge

Bridge ini memetakan:

- kontrol PMP 15
- indikator BIM Scoring
- evidence minimum
- rule translasi status

Bridge ini tidak mengubah metodologi scoring inti.

### Layer 3. Operational Source of Truth

BIM Scoring menyimpan:

- indikator
- score
- evidence linkage
- review outcome
- approval outcome
- audit trail
- snapshot immutable

### Layer 4. Export and Assurance

Sistem menghasilkan:

- summary PMP Area 15
- paket audit
- paket hold point
- format Excel/PDF resmi bila diminta

## 4. Translation Model

Status PMP tidak diinput manual. Status PMP harus dihitung dari:

- indikator yang dipetakan
- score final setelah evidence rules
- evidence readiness
- mandatory control completeness

Aturan minimum:

- `OK`: semua kontrol mandatory terpenuhi, evidence ready, skor kontrol melewati ambang OK
- `MINOR`: kontrol mapped dan scored, tetapi skor belum mencapai ambang OK
- `NOT_OK`: kontrol mapped tetapi performa gagal
- `INCOMPLETE`: mapping ada, tetapi belum semua scored atau evidence belum siap
- `NOT_MAPPED`: bridge belum lengkap; tidak boleh dianggap compliant

Untuk output PMP formal:

- `INCOMPLETE` dikonversi menjadi `NOT_OK`
- `NOT_MAPPED` tidak boleh lolos hold point, meskipun pada ekspor dapat ditandai `N/A` sesuai kebijakan rollout

## 5. Rollout Principle

Implementasi dilakukan additive:

1. blueprint dan bridge backend
2. mapping config per project
3. summary compliance PMP 15 di API
4. review UI dan audit view
5. export generator ke Excel/PDF

Metodologi scoring inti tetap locked:

- 5 perspective
- score 0..5
- evidence tidak menjadi bobot langsung
- approval tetap di level period
- snapshot tetap immutable

## 6. Data Contract Direction

Summary API perlu menyediakan blok tambahan:

```json
{
  "compliance": {
    "pmp_area15": {
      "source_of_truth": "bim_scoring",
      "overall_status": "OK|MINOR|NOT_OK|INCOMPLETE",
      "export_ready": true,
      "hold_point_ready": false,
      "phase_summaries": [],
      "controls": []
    }
  }
}
```

Tujuan blok ini:

- PMP 15 dibaca sebagai ringkasan governance
- BIM Scoring tetap memegang detail teknis
- audit dan hold point membaca basis data yang sama

## 7. Non-Negotiables

- Tidak ada dual entry antara PMP dan BIM Scoring.
- Tidak ada input score manual di artefak ekspor.
- Jika evidence mandatory gagal, kontrol tidak boleh `OK`.
- Jika bridge belum lengkap, sistem harus menunjukkannya secara eksplisit.
- Export tidak boleh menjadi sumber data.

## 8. Practical Meaning

Secara operasional, kalimat kebijakan yang dipakai adalah:

`Pemenuhan dan verifikasi PMP Area 15 dilakukan melalui BIM Scoring sebagai working system resmi, sedangkan format PMP Area 15 dihasilkan otomatis sebagai output governance dan audit.`
