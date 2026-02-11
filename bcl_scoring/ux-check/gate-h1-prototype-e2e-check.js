function nowIso(offsetMinutes = 0) {
  return new Date(Date.now() + offsetMinutes * 60_000).toISOString();
}

function normalizePeriodId(periodId) {
  return String(periodId || "").trim() || "__NOT_AVAILABLE__";
}

function createStore() {
  return {
    evidenceItems: [],
    reviewEntries: {},
    approvalDecisions: [],
    snapshots: [],
    periodLockState: [],
  };
}

function submitEvidence(store, input) {
  const row = {
    id: input.id,
    project_id: input.project_id,
    period_id: input.period_id || null,
    bim_use_id: input.bim_use_id,
    indicator_ids: input.indicator_ids,
    type: input.type,
    title: input.title,
    description: input.description,
    status: "SUBMITTED",
    created_at: input.created_at || nowIso(),
    updated_at: input.updated_at || nowIso(),
    submitted_at: input.submitted_at || nowIso(),
  };

  const idx = store.evidenceItems.findIndex((item) => item.id === row.id);
  if (idx >= 0) store.evidenceItems[idx] = row;
  else store.evidenceItems.push(row);
}

function applyReview(store, input) {
  const reason = String(input.review_reason || "").trim();
  if (!reason) throw new Error("Reason wajib untuk review.");

  const current = store.reviewEntries[input.evidence_id];
  const history = current?.review_history ? [...current.review_history] : [];
  const entry = {
    review_outcome: input.review_outcome,
    review_reason: reason,
    reviewed_by: input.reviewed_by || "HO Reviewer (Prototype)",
    reviewed_at: input.reviewed_at || nowIso(),
  };
  history.push(entry);
  store.reviewEntries[input.evidence_id] = {
    evidence_id: input.evidence_id,
    review_outcome: entry.review_outcome,
    review_reason: entry.review_reason,
    reviewed_by: entry.reviewed_by,
    reviewed_at: entry.reviewed_at,
    review_history: history,
  };
}

function applyApprovalDecision(store, input) {
  const reason = String(input.reason || "").trim();
  if (!reason) throw new Error("Reason wajib untuk approval.");

  const periodId = normalizePeriodId(input.period_id);
  const locked = store.periodLockState.find(
    (row) => row.project_id === input.project_id && row.period_id === periodId && row.status === "LOCKED"
  );
  if (locked) throw new Error("Period LOCKED; keputusan baru diblok.");

  const decision = {
    project_id: input.project_id,
    period_id: periodId,
    decision: input.decision,
    reason,
    decided_by: input.decided_by || "Approver (Prototype)",
    decided_at: input.decided_at || nowIso(),
  };
  store.approvalDecisions.push(decision);

  if (input.decision === "APPROVE PERIOD") {
    store.periodLockState.push({
      project_id: input.project_id,
      period_id: periodId,
      status: "LOCKED",
      locked_by: input.decided_by || "Approver (Prototype)",
      locked_at: decision.decided_at,
    });

    store.snapshots.push({
      snapshot_id: input.snapshot_id || `snap-${Math.random().toString(36).slice(2, 10)}`,
      project_id: input.project_id,
      period_id: periodId,
      approved_by: input.decided_by || "Approver (Prototype)",
      approved_at: decision.decided_at,
      final_bim_score: input.final_bim_score ?? null,
      breakdown: input.breakdown || [],
      evidence_counts: input.evidence_counts || {
        ACCEPTABLE: 0,
        NEEDS_REVISION: 0,
        REJECTED: 0,
        AWAITING_REVIEW: 0,
      },
      note: "Prototype snapshot (not used for audit/compliance)",
    });
  }
}

function runScenario() {
  const store = createStore();
  const projectId = "project-demo-h1";
  const periodId = "2026-W06";
  const evidenceId = "ev-h1-001";

  console.log("Step 1) Submit evidence");
  submitEvidence(store, {
    id: evidenceId,
    project_id: projectId,
    period_id: periodId,
    bim_use_id: "BIM Use Coordination",
    indicator_ids: ["IND-01"],
    type: "URL",
    title: "Evidence koordinasi",
    description: "Bukti koordinasi model",
    submitted_at: nowIso(0),
  });

  console.log("Step 2) Review evidence (2x untuk cek append-only)");
  applyReview(store, {
    evidence_id: evidenceId,
    review_outcome: "NEEDS REVISION",
    review_reason: "Lengkapi tautan referensi.",
    reviewed_at: nowIso(1),
  });
  applyReview(store, {
    evidence_id: evidenceId,
    review_outcome: "ACCEPTABLE",
    review_reason: "Perbaikan sudah sesuai.",
    reviewed_at: nowIso(2),
  });

  console.log("Step 3) Approval decision (reject lalu approve)");
  applyApprovalDecision(store, {
    project_id: projectId,
    period_id: periodId,
    decision: "REJECT APPROVAL",
    reason: "Masih menunggu validasi akhir.",
    decided_at: nowIso(3),
  });
  applyApprovalDecision(store, {
    project_id: projectId,
    period_id: periodId,
    decision: "APPROVE PERIOD",
    reason: "Semua review final terpenuhi.",
    decided_at: nowIso(4),
    final_bim_score: 82.5,
    breakdown: [
      { perspective_id: "P1", score: 16.5 },
      { perspective_id: "P2", score: 17.0 },
      { perspective_id: "P3", score: 15.5 },
      { perspective_id: "P4", score: 16.5 },
      { perspective_id: "P5", score: 17.0 },
    ],
    evidence_counts: {
      ACCEPTABLE: 1,
      NEEDS_REVISION: 0,
      REJECTED: 0,
      AWAITING_REVIEW: 0,
    },
  });

  console.log("Step 4) Audit reads latest snapshot");
  const latestSnapshot = store.snapshots.slice().sort((a, b) => b.approved_at.localeCompare(a.approved_at))[0] || null;

  const invariants = {
    review_history_append_only:
      (store.reviewEntries[evidenceId]?.review_history || []).length === 2 &&
      store.reviewEntries[evidenceId].review_history[0].review_outcome === "NEEDS REVISION",
    approval_history_append_only: store.approvalDecisions.length === 2,
    period_locked:
      store.periodLockState.some(
        (row) => row.project_id === projectId && row.period_id === normalizePeriodId(periodId) && row.status === "LOCKED"
      ),
    snapshot_exists: Boolean(latestSnapshot),
    snapshot_immutable_shape:
      Boolean(latestSnapshot) &&
      typeof latestSnapshot.snapshot_id === "string" &&
      Array.isArray(latestSnapshot.breakdown),
  };

  console.log("\nFinal state summary:");
  console.log({
    evidence_count: store.evidenceItems.length,
    review_history_count: store.reviewEntries[evidenceId]?.review_history?.length || 0,
    approval_decision_count: store.approvalDecisions.length,
    lock_count: store.periodLockState.length,
    snapshot_count: store.snapshots.length,
    latest_snapshot_id: latestSnapshot?.snapshot_id || null,
    latest_snapshot_period: latestSnapshot?.period_id || null,
  });

  console.log("\nInvariant checks:");
  console.log(invariants);

  const failed = Object.entries(invariants).filter(([, value]) => !value);
  if (failed.length > 0) {
    console.error("\nFAILED invariants:", failed.map(([key]) => key).join(", "));
    process.exitCode = 1;
    return;
  }

  console.log("\nPASS: Gate H1 prototype cohesion checks succeeded.");
}

runScenario();
