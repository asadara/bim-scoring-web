import { expect, test } from "@playwright/test";

const TRUTH_STORE_KEY = "bim:prototype:truth:v1";
const PROJECT_ID = "e2e-project-001";
const PERIOD_ID = "2026-W06";
const EVIDENCE_ID = "e2e-ev-001";
const SCOPE_KEY = `proto:${PROJECT_ID}:${PERIOD_ID}`;
const PERIOD_META_KEY = SCOPE_KEY;

function nowIso(minutesOffset = 0) {
  return new Date(Date.now() + minutesOffset * 60_000).toISOString();
}

function buildSeedStore() {
  const createdAt = nowIso(-10);
  const submittedAt = nowIso(-9);
  const updatedAt = nowIso(-8);

  return {
    version: 1,
    evidence_items: [
      {
        id: EVIDENCE_ID,
        project_id: PROJECT_ID,
        period_id: PERIOD_ID,
        scope_key: SCOPE_KEY,
        bim_use_id: "USE-COORD",
        indicator_ids: ["P1-01"],
        type: "URL",
        title: "E2E Evidence Coordination",
        description: "Evidence untuk validasi flow lintas role",
        external_url: "https://example.com/e2e-evidence",
        text_content: null,
        file_view_url: null,
        file_download_url: null,
        file_reference_url: null,
        status: "SUBMITTED",
        review_reason: null,
        review_decision: null,
        reviewer_user_id: null,
        reviewed_at: null,
        version: 1,
        created_at: createdAt,
        updated_at: updatedAt,
        submitted_at: submittedAt,
      },
    ],
    review_records: {},
    approval_decisions: [],
    snapshots: [],
    period_locks: [],
    project_meta: {
      [PROJECT_ID]: {
        project_id: PROJECT_ID,
        project_name: "E2E Project",
        project_code: "E2E-001",
        updated_at: nowIso(-7),
      },
    },
    period_meta: {
      [PERIOD_META_KEY]: {
        project_id: PROJECT_ID,
        period_id: PERIOD_ID,
        scope_key: SCOPE_KEY,
        period_label: "2026 W6",
        updated_at: nowIso(-6),
      },
    },
  };
}

test.beforeEach(async ({ page }) => {
  const seedStore = buildSeedStore();
  await page.addInitScript((payload) => {
    const marker = "__e2e_seeded_role_flow__";
    if (window.sessionStorage.getItem(marker)) return;
    window.localStorage.clear();
    window.localStorage.setItem(payload.key, JSON.stringify(payload.value));
    window.sessionStorage.setItem(marker, "1");
  }, { key: TRUTH_STORE_KEY, value: seedStore });
});

test("role flow e2e: role1 -> role2 -> role3 -> audit", async ({ page }) => {
  await page.goto(`/projects/${PROJECT_ID}/evidence`);
  await expect(page.getByRole("heading", { name: "My Evidence List" })).toBeVisible();
  await expect(page.getByText("E2E Evidence Coordination")).toBeVisible();
  await expect(page.getByText("SUBMITTED", { exact: false })).toBeVisible();

  await page.goto(`/ho/review/projects/${PROJECT_ID}`);
  await expect(page.getByRole("heading", { name: "Review Evidence" })).toBeVisible();
  await expect(page.getByText("E2E Evidence Coordination")).toBeVisible();
  await page.getByRole("link", { name: "Buka Evidence" }).first().click();

  await expect(page.locator("h1", { hasText: "Apply Review" })).toBeVisible();
  await page.getByLabel("ACCEPTABLE").check();
  await page.locator("#review-reason").fill("E2E acceptable review");
  await page.getByRole("button", { name: "Apply Review" }).click();
  await expect(page.getByText("Review berhasil disimpan.")).toBeVisible();
  await expect(page.getByText("Reviewed — ACCEPTABLE")).toBeVisible();

  await page.goto(`/approve/projects/${PROJECT_ID}/decision`);
  await expect(page.getByRole("heading", { name: "Konfirmasi Keputusan" })).toBeVisible();
  await page.getByLabel("APPROVE PERIOD").check();
  await page.locator("#approval-reason").fill("E2E approve period");
  await page.getByRole("button", { name: "Konfirmasi Keputusan" }).click();
  await expect(page.getByText("Keputusan berhasil disimpan.")).toBeVisible();
  await expect(page.getByText("Snapshot ID:")).toBeVisible();

  await page.goto("/audit");
  await expect(page.getByRole("heading", { name: "Read-only Auditor View" })).toBeVisible();
  await expect(page.getByText(PROJECT_ID, { exact: false }).first()).toBeVisible();
  await page.getByRole("link", { name: "Open Snapshot" }).first().click();

  await expect(page.getByRole("heading", { name: "Snapshot Header" })).toBeVisible();
  await expect(page.getByText("Final Score (Read-only)")).toBeVisible();
  await expect(page.getByText(PROJECT_ID, { exact: false }).first()).toBeVisible();
});
