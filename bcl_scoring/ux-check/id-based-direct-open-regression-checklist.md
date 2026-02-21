# ID-Based Direct Open Regression Checklist

Purpose:
- Ensure ID-based pages work when opened directly (new tab / refresh) without prior navigation preload.
- Catch regressions where pages depend on stale/missing local browser store.

When to run:
- Before merge/release for changes in `role1TaskLayer`, `role2TaskLayer`, evidence pages, or route wiring.
- After backend changes that affect evidence/project/period read endpoints.

Automated smoke check:
```bash
npm run smoke:id-routes
```

Optional env override:
```bash
WEB_BASE_URL=https://bim-scoring-web.onrender.com API_BASE_URL=https://bim-scoring-api.onrender.com npm run smoke:id-routes
```

What is validated by the script:
- Direct open (no preload) for:
1. `/projects/:projectId`
2. `/projects/:projectId/evidence`
3. `/projects/:projectId/evidence/add?evidenceId=:evidenceId`
4. `/ho/review/projects/:projectId`
5. `/ho/review/projects/:projectId/evidence/:evidenceId`
6. `/approve/projects/:projectId`
7. `/approve/projects/:projectId/awaiting-review`
8. `/approve/projects/:projectId/decision`
- Each route must not show context failure markers such as:
1. `Project context not found.`
2. `Evidence context not found.`
3. `Evidence yang akan direvisi tidak ditemukan`

Manual fallback checks (if automation fails):
1. Open each route in a fresh incognito tab.
2. Hard refresh (`Ctrl+F5`) on each page.
3. Confirm page heading renders and no context-not-found error appears.
4. For HO review detail, verify `Apply Review` section appears.
5. For evidence edit page, verify form is populated for selected `evidenceId`.
