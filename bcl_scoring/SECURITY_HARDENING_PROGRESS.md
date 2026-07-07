# Security Hardening Progress

Tanggal mulai: 2026-07-07

Scope repo ini: frontend Next.js/OpenNext/Cloudflare untuk BIM Scoring.

## Status

| Prioritas | Item | Status | Catatan |
| --- | --- | --- | --- |
| P0 | Patch dependency frontend (`next`, `jspdf`, `wrangler`) | Partial | Updated to patched/current versions, removed vulnerable `xlsx`, and ran `npm audit fix`; residual: Next/PostCSS advisory tied to OpenNext/Next with no safe non-force path. |
| P0 | Server-side auth trust boundary | Pending | Jangan percaya role dari localStorage/header client untuk write/admin. |
| P1 | Production fallback policy | Done | Real backend write defaults to disabled unless explicitly enabled via env. |
| P1 | Prototype/local fallback containment | Pending | Production perlu fail-closed atau banner/blocking eksplisit untuk data non-authoritative. |
| P2 | Lint quality gate | Done | `npm run lint` passes clean after ignoring generated/static artifacts and removing dead admin code. |
| P3 | Next middleware convention | Pending | Next 16 build warns that `middleware` should migrate to `proxy`. |

## Monitoring Notes

- Deployment aktif: Cloudflare/OpenNext.
- Data plane aktif: Supabase.
- Render/onrender: legacy disabled, bukan active runtime.
