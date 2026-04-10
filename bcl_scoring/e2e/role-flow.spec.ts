import { expect, test, type Page } from "@playwright/test";

const TRUTH_STORE_KEY = "bim:prototype:truth:v1";
const CREDENTIAL_STORE_KEY = "bim_user_credential_v1";
const DEV_API_OVERRIDE_STORAGE_KEY = "bim_dev_api_base_override_v1";
const PROJECT_ID = "e2e-project-001";
const PERIOD_ID = "2026-W06";
const EVIDENCE_ID = "e2e-ev-001";
const EVIDENCE_ID_2 = "e2e-ev-002";
const EVIDENCE_ID_3 = "e2e-ev-003";
const SCOPE_KEY = `proto:${PROJECT_ID}:${PERIOD_ID}`;
const PERIOD_META_KEY = SCOPE_KEY;

type AppRole = "admin" | "role1" | "role2" | "role3" | "viewer";
type ReviewOutcomeOption = "ACCEPTABLE" | "NEEDS REVISION" | "REJECTED";

function nowIso(minutesOffset = 0) {
  return new Date(Date.now() + minutesOffset * 60_000).toISOString();
}

function buildSeedStore() {
  const createdAt = nowIso(-10);
  const submittedAt = nowIso(-9);
  const updatedAt = nowIso(-8);
  const seededReviewedAt = nowIso(-7);
  const seededApprovedAt = nowIso(-6);

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
      {
        id: EVIDENCE_ID_2,
        project_id: PROJECT_ID,
        period_id: PERIOD_ID,
        scope_key: SCOPE_KEY,
        bim_use_id: "USE-COORD",
        indicator_ids: ["P1-02"],
        type: "TEXT",
        title: "E2E Evidence Seeded #2",
        description: "Seed evidence untuk memenuhi approval gate (reviewed evidence count).",
        external_url: null,
        text_content: "Seeded text evidence",
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
      {
        id: EVIDENCE_ID_3,
        project_id: PROJECT_ID,
        period_id: PERIOD_ID,
        scope_key: SCOPE_KEY,
        bim_use_id: "USE-COORD",
        indicator_ids: ["P1-03"],
        type: "URL",
        title: "E2E Evidence Seeded #3",
        description: "Seed evidence untuk memenuhi approval gate (reviewed evidence count).",
        external_url: "https://example.com/e2e-evidence-3",
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
    review_records: {
      [EVIDENCE_ID_2]: {
        evidence_id: EVIDENCE_ID_2,
        scope_key: SCOPE_KEY,
        review_outcome: "ACCEPTABLE",
        review_reason: "Seed acceptable",
        reviewed_by: "Seeder",
        reviewed_at: seededReviewedAt,
        review_history: [
          {
            review_outcome: "ACCEPTABLE",
            review_reason: "Seed acceptable",
            reviewed_by: "Seeder",
            reviewed_at: seededReviewedAt,
          },
        ],
      },
      [EVIDENCE_ID_3]: {
        evidence_id: EVIDENCE_ID_3,
        scope_key: SCOPE_KEY,
        review_outcome: "REJECTED",
        review_reason: "Seed rejected",
        reviewed_by: "Seeder",
        reviewed_at: seededReviewedAt,
        review_history: [
          {
            review_outcome: "REJECTED",
            review_reason: "Seed rejected",
            reviewed_by: "Seeder",
            reviewed_at: seededReviewedAt,
          },
        ],
      },
    },
    approval_decisions: [],
    snapshots: [
      {
        snapshot_id: "seed-snap-001",
        project_id: PROJECT_ID,
        period_id: PERIOD_ID,
        scope_key: SCOPE_KEY,
        approved_by: "Seeder",
        approved_at: seededApprovedAt,
        final_bim_score: 72,
        breakdown: [
          { perspective_id: "PERS-01", score: 10 },
          { perspective_id: "PERS-02", score: 12 },
          { perspective_id: "PERS-03", score: 18 },
          { perspective_id: "PERS-04", score: 32 },
        ],
        evidence_counts: {
          ACCEPTABLE: 2,
          NEEDS_REVISION: 0,
          REJECTED: 1,
          AWAITING_REVIEW: 0,
        },
        compliance_payload: {
          version: "e2e-role-flow-v1",
          source_of_truth: "prototype-seed",
          intent: "Prototype E2E compliance bridge seed",
          overall_status: "OK",
          overall_export_status: "READY",
          overall_score_100: 92,
          export_ready: true,
          hold_point_ready: true,
          total_bim_score_100: 72,
          phase_summaries: [
            {
              phase: "Planning",
              status: "OK",
              export_status: "READY",
              score_100: 92,
              mandatory_count: 1,
              mapped_count: 1,
              ok_count: 1,
              minor_count: 0,
              not_ok_count: 0,
              incomplete_count: 0,
              not_mapped_count: 0,
            },
          ],
          controls: [
            {
              control_id: "PMP-15-CTRL-001",
              phase: "Planning",
              title: "Project information governance baseline",
              description: "E2E seed for approval gate",
              mandatory: true,
              matched_indicator_count: 1,
              scored_indicator_count: 1,
              evidence_ready_count: 3,
              average_score_0_5: 4.6,
              score_100: 92,
              status: "OK",
              export_status: "READY",
              blockers: [],
            },
          ],
          mapping_status: {
            configured_control_count: 1,
            mandatory_control_count: 1,
            mapped_control_count: 1,
            unmapped_control_count: 0,
          },
        },
        note: "Prototype snapshot (not used for audit/compliance)",
      },
    ],
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

async function setRole(page: Page, role: AppRole, userId: string | null) {
  if (page.url().startsWith("about:")) {
    await page.goto("/", { waitUntil: "domcontentloaded" });
  }
  await page.evaluate(({ key, payload }: {
    key: string;
    payload: {
      role: AppRole;
      user_id: string | null;
      scoped_project_ids: string[];
      pending_role: boolean;
      updated_at: string;
    };
  }) => {
    window.localStorage.setItem(key, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent("bim:credential-updated", { detail: payload }));
  }, {
    key: CREDENTIAL_STORE_KEY,
    payload: {
      role,
      user_id: userId,
      scoped_project_ids: role === "viewer" ? [] : [PROJECT_ID],
      pending_role: false,
      updated_at: new Date().toISOString(),
    },
  });
  await page.waitForFunction(
    ({ key, expectedRole, expectedUserId }: {
      key: string;
      expectedRole: AppRole;
      expectedUserId: string | null;
    }) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { role?: string; user_id?: string | null };
      return parsed.role === expectedRole && (parsed.user_id ?? null) === expectedUserId;
    },
    {
      key: CREDENTIAL_STORE_KEY,
      expectedRole: role,
      expectedUserId: userId,
    }
  );
}

async function applyReview(
  page: Page,
  input: { evidenceId: string; outcome: ReviewOutcomeOption; reason: string }
) {
  await setRole(page, "role2", "u-role2-e2e");
  await page.goto(`/ho/review/projects/${PROJECT_ID}/evidence/${input.evidenceId}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1", { hasText: "Apply Review" })).toBeVisible();
  await page.locator("#review-outcome").selectOption(input.outcome);
  await page.locator("#review-reason").fill(input.reason);
  await page.getByRole("button", { name: "Apply Review" }).click();
  await expect(page.getByText("Review berhasil disimpan.")).toBeVisible();
}

async function approvePeriod(
  page: Page,
  reason: string
) {
  await setRole(page, "role3", "u-role3-e2e");
  await page.goto(`/approve/projects/${PROJECT_ID}/decision`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Konfirmasi Keputusan" })).toBeVisible();
  await page.locator("#approval-decision").selectOption("APPROVE PERIOD");
  await page.locator("#approval-reason").fill(reason);
  await page.getByRole("button", { name: "Konfirmasi Keputusan" }).click();
  await expect(page.getByText("Keputusan berhasil disimpan.")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  const seedStore = buildSeedStore();
  await page.addInitScript((payload) => {
    const marker = "__e2e_seeded_role_flow__";
    if (window.sessionStorage.getItem(marker)) return;
    window.localStorage.clear();
    window.localStorage.setItem(payload.truthKey, JSON.stringify(payload.truthValue));
    window.localStorage.setItem(payload.credentialKey, JSON.stringify(payload.credentialValue));
    window.localStorage.setItem(payload.apiOverrideKey, payload.apiOverrideValue);
    window.dispatchEvent(new CustomEvent("bim:credential-updated", { detail: payload.credentialValue }));
    window.sessionStorage.setItem(marker, "1");
  }, {
    truthKey: TRUTH_STORE_KEY,
    truthValue: seedStore,
    credentialKey: CREDENTIAL_STORE_KEY,
    credentialValue: {
      role: "role1",
      user_id: "u-role1-e2e",
      scoped_project_ids: [PROJECT_ID],
      pending_role: false,
      updated_at: new Date().toISOString(),
    },
    apiOverrideKey: DEV_API_OVERRIDE_STORAGE_KEY,
    apiOverrideValue: "http://127.0.0.1:9",
  });
});

test("role flow e2e: role1 -> role2 -> role3 -> audit", async ({ page }) => {
  await page.goto(`/projects/${PROJECT_ID}/evidence`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "My Evidence List" })).toBeVisible();
  await expect(page.getByText("E2E Evidence Coordination")).toBeVisible();
  await expect(page.getByText("SUBMITTED", { exact: false })).toBeVisible();

  await setRole(page, "role2", "u-role2-e2e");
  await page.goto(`/ho/review/projects/${PROJECT_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Review Evidence" })).toBeVisible();
  await expect(page.getByText("E2E Evidence Coordination")).toBeVisible();
  await page.getByRole("link", { name: "Buka Evidence" }).first().click();

  await expect(page.locator("h1", { hasText: "Apply Review" })).toBeVisible();
  await page.locator("#review-outcome").selectOption("ACCEPTABLE");
  await page.locator("#review-reason").fill("E2E acceptable review");
  await page.getByRole("button", { name: "Apply Review" }).click();
  await expect(page.getByText("Review berhasil disimpan.")).toBeVisible();
  await expect(page.locator("span.status-chip", { hasText: /Reviewed\s+.*ACCEPTABLE/ }).first()).toBeVisible();

  await setRole(page, "role3", "u-role3-e2e");
  await page.goto(`/approve/projects/${PROJECT_ID}/decision`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Konfirmasi Keputusan" })).toBeVisible();
  await page.locator("#approval-decision").selectOption("APPROVE PERIOD");
  await page.locator("#approval-reason").fill("E2E approve period");
  await page.getByRole("button", { name: "Konfirmasi Keputusan" }).click();
  await expect(page.getByText("Keputusan berhasil disimpan.")).toBeVisible();
  await expect(page.locator("p", { hasText: "Snapshot ID:" }).first()).toBeVisible();

  await setRole(page, "viewer", null);
  await page.goto("/audit", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Auditor View" })).toBeVisible();
  await expect(page.getByText("E2E Project", { exact: false }).first()).toBeVisible();
  await page.getByRole("link", { name: /Latest snapshot/i }).first().click();
  await expect(page).toHaveURL(/\/audit\/snapshots\//);

  await expect(page.getByRole("heading", { name: "Read-only Auditor View" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Snapshot Header" })).toBeVisible();
  await expect(page.getByText("Final Score (Read-only)")).toBeVisible();
  await expect(page.getByText(PROJECT_ID, { exact: false }).first()).toBeVisible();
});

test("review reject flow: evidence becomes reviewed and no longer writable", async ({ page }) => {
  await applyReview(page, {
    evidenceId: EVIDENCE_ID,
    outcome: "REJECTED",
    reason: "E2E rejected review",
  });

  await expect(page.locator("span.status-chip", { hasText: /REJECTED/ }).first()).toBeVisible();
  await expect(page.getByText("Reason: E2E rejected review").first()).toBeVisible();
  await expect(page.getByText("Apply Review hanya untuk status SUBMITTED.")).toBeVisible();
  await expect(page.locator("#review-outcome")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Apply Review" })).toBeDisabled();
});

test("post-approval lock: write actions disabled and snapshot export works", async ({ page }) => {
  await applyReview(page, {
    evidenceId: EVIDENCE_ID,
    outcome: "ACCEPTABLE",
    reason: "E2E acceptable review for lock scenario",
  });
  await approvePeriod(page, "E2E approve period for lock scenario");

  const snapshotText = await page.locator("p", { hasText: "Snapshot ID:" }).first().innerText();
  const snapshotId = snapshotText.replace("Snapshot ID:", "").trim();
  expect(snapshotId).not.toEqual("");

  await expect(page.getByText("LOCKED (read-only)")).toBeVisible();
  await expect(page.locator("#approval-decision")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Konfirmasi Keputusan" })).toBeDisabled();

  await setRole(page, "role1", "u-role1-e2e");
  await page.goto(`/projects/${PROJECT_ID}/evidence/add`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Period saat ini LOCKED. Semua input read-only dan aksi Save/Submit dinonaktifkan.")).toBeVisible();
  const saveDraft = page.getByRole("button", { name: "Save Draft" });
  if (await saveDraft.count()) {
    await expect(saveDraft).toBeDisabled();
  }
  const submitForReview = page.getByRole("button", { name: "Submit for Review" });
  if (await submitForReview.count()) {
    await expect(submitForReview).toBeDisabled();
  }

  await setRole(page, "viewer", null);
  await page.goto(`/audit/snapshots/${encodeURIComponent(snapshotId)}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Read-only Auditor View" })).toBeVisible();
  await page.getByRole("button", { name: "Export JSON" }).click();
  await expect(page.getByText("Export JSON selesai (download started).")).toBeVisible();
  await page.getByRole("button", { name: "Export PDF" }).click();
  await expect(page.getByText("PDF generated (download started).")).toBeVisible({ timeout: 15_000 });
});
