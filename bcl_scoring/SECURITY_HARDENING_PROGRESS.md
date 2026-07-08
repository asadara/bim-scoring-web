# Security Hardening Progress

Tanggal mulai: 2026-07-07

Scope repo ini: frontend Next.js/OpenNext/Cloudflare untuk BIM Scoring.

## Status

| Prioritas | Item | Status | Catatan |
| --- | --- | --- | --- |
| P0 | Patch dependency frontend (`next`, `jspdf`, `wrangler`) | Done | Added npm `overrides.postcss=8.5.16` so Next/OpenNext resolve to patched PostCSS; `npm audit --omit=dev` now reports 0 vulnerabilities. |
| P0 | Server-side auth trust boundary | Done | Frontend sekarang menyertakan Supabase bearer token ke API; enforcement authoritative berada di Cloudflare Gateway/API repo. |
| P1 | Production fallback policy | Done | Real backend write defaults to disabled unless explicitly enabled via env. |
| P1 | Prototype/local fallback containment | Done | Prototype/local fallback default nonaktif di production dan hanya aktif jika `NEXT_PUBLIC_ALLOW_PROTOTYPE_FALLBACK=true`. |
| P2 | Lint quality gate | Done | `npm run lint` passes clean after ignoring generated/static artifacts and removing dead admin code. |
| P3 | Next middleware convention | Done | Redirect host legacy dipindah dari `middleware.ts` ke konvensi `proxy.ts`. |

## Monitoring Notes

- Deployment aktif: Cloudflare/OpenNext.
- Data plane aktif: Supabase.
- Render/onrender: legacy disabled, bukan active runtime.
