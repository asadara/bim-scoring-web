# BIM Scoring Web (`bcl_scoring`)

Frontend operational baseline for CRP-1 staging gate hardening.

## Environment Variables

Use `.env.example` as template.

Required:
- `NEXT_PUBLIC_APP_ENV` = `development` | `staging` | `production`
- `NEXT_PUBLIC_BIM_SCORING_API_BASE_URL_DEVELOPMENT|STAGING|PRODUCTION`  
  (legacy fallback: `NEXT_PUBLIC_API_BASE_URL_DEVELOPMENT|STAGING|PRODUCTION`)

Optional:
- `NEXT_PUBLIC_FEATURE_REAL_BACKEND_WRITE=true|false`

Fail-fast behavior:
- Unknown `NEXT_PUBLIC_APP_ENV` throws startup/runtime config error.
- Missing API base URL for active environment throws startup/runtime config error.

## Feature Flag Behavior

`NEXT_PUBLIC_FEATURE_REAL_BACKEND_WRITE`:
- `production` default: `false`
- `staging` default: `false` (enable only by explicit override)
- `development`: configurable via env override; default remains `false` unless explicitly enabled.

## Deployment Steps (High-Level)

1. Prepare environment variables for target environment.
2. Build frontend artifact: `npm run build`.
3. Deploy artifact to target host.
4. Verify app can reach target API base URL for active environment.
5. Run post-deploy smoke checklist.

### Minimal Deploy Script (Manual Sequence)

```bash
npm ci
npm run build
npm run start
```

## Rollback Steps (High-Level)

1. Repoint to previous known-good frontend artifact.
2. Keep backend/snapshot data untouched by frontend rollback.
3. Re-verify critical pages and API handshake status banner.
4. Confirm write flag remains in intended state (`OFF` unless approved override).

### Rollback Script Outline (Manual Sequence)

```bash
# 1) Re-deploy previous frontend artifact/version
# 2) Restart frontend service
# 3) Re-check backend handshake and critical pages
```

## Pre-Deploy Checklist

1. Validate `NEXT_PUBLIC_APP_ENV` and API base URL variables.
2. Validate `NEXT_PUBLIC_FEATURE_REAL_BACKEND_WRITE` policy for target environment.
3. Run frontend build successfully.
4. Confirm backend endpoints `/health` and `/ready` are reachable from deployed frontend network.
5. Confirm no secrets are hardcoded in source and no secret values in logs.

## Post-Deploy Smoke Checklist

1. Landing page loads with no runtime env configuration error.
2. Backend status/handshake indicates expected availability.
3. Read flows (project/evidence/summary) return expected responses.
4. If write flag enabled for controlled test, one write request succeeds end-to-end.
5. If write flag disabled, UI remains in safe/prototype-mode behavior.

## Known Limitations

- No external APM integration; operational visibility relies on backend structured logs and health/readiness checks.
- Environment validation is runtime/build-time only; no secrets manager integration in frontend.
- This document provides procedure outlines, not deployment automation scripts.

## Landing Page Deployment Note

- Root landing page published from `src/pages/index.tsx`.
- Render deployment checklist is documented at:
  - `../doc/landing-page-render-deploy-checklist.md`

## Explicit Non-Claims

- This repository does **not** claim ISO certification/compliance by itself.
- This repository does **not** add legal or regulatory compliance guarantees.
