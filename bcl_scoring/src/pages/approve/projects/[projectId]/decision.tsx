import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import ApproverLayout from "@/components/ApproverLayout";
import BackendStatusBanner from "@/components/BackendStatusBanner";
import { canWriteRole3Approval } from "@/lib/accessControl";
import {
  ApprovalDecision,
  LOCKED_READ_ONLY_ERROR,
  NA_TEXT,
  formatProjectLabel,
  isRealBackendWriteEnabled,
  listPrototypeApprovalDecisions,
  listPrototypeSnapshots,
  normalizePrototypePeriodId,
} from "@/lib/role1TaskLayer";
import {
  APPROVAL_GATE_POLICY,
  ApproverProjectContext,
  applyApproverDecision,
  evaluateApprovalGates,
  fetchApproverProjectContext,
} from "@/lib/approverTaskLayer";
import { useCredential } from "@/lib/useCredential";
import { getRoleLabel } from "@/lib/userCredential";

const DECISIONS: ApprovalDecision[] = ["APPROVE PERIOD", "REJECT APPROVAL"];

export default function ApprovalDecisionPage() {
  const router = useRouter();
  const { projectId } = router.query;
  const credential = useCredential();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<ApproverProjectContext | null>(null);
  const [decision, setDecision] = useState<ApprovalDecision | "">("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formInfo, setFormInfo] = useState<string | null>(null);
  const [bannerHint, setBannerHint] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);

  useEffect(() => {
    if (!router.isReady || typeof projectId !== "string") return;

    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchApproverProjectContext(projectId);
        if (!mounted) return;
        setContext(data);
        setError(null);
      } catch (e) {
        if (!mounted) return;
        setContext(null);
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    const refresh = () => {
      load();
      setHistoryVersion((prev) => prev + 1);
    };

    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      mounted = false;
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [router.isReady, projectId]);

  if (loading) {
    return (
      <main className="task-shell">
        <section className="task-panel">Loading...</section>
      </main>
    );
  }

  if (!context || typeof projectId !== "string") {
    return (
      <main className="task-shell">
        <section className="task-panel">
          <h1>Approve / Reject Period</h1>
          <p className="error-box">{error || "Project context not found."}</p>
          <p>
            <Link href="/approve">Kembali ke Period Approval</Link>
          </p>
        </section>
      </main>
    );
  }

  const projectIdValue = projectId;
  const contextValue = context;
  const locked = contextValue.period_locked;
  const blockedByBackend = isRealBackendWriteEnabled() && contextValue.data_mode === "prototype";
  const canWrite = canWriteRole3Approval(credential.role);
  const approvalGate = evaluateApprovalGates({
    breakdown: contextValue.summary.breakdown,
    confidence_coverage: contextValue.summary.confidence?.coverage ?? null,
    evidence_counts: contextValue.evidence_counts,
  });
  const approveBlockedByPolicy = !approvalGate.is_eligible;
  const periodKey = normalizePrototypePeriodId(contextValue.period_id);

  const decisions = listPrototypeApprovalDecisions()
    .filter(
      (row) =>
        row.project_id === projectIdValue &&
        row.period_id === periodKey
    )
    .sort((a, b) => String(b.decided_at).localeCompare(String(a.decided_at)));

  const snapshots = listPrototypeSnapshots()
    .filter(
      (row) =>
        row.project_id === projectIdValue &&
        row.period_id === periodKey
    )
    .sort((a, b) => String(b.approved_at).localeCompare(String(a.approved_at)));

  async function onConfirm() {
    if (!canWrite) {
      setFormError("Role aktif hanya memiliki read-only access. Konfirmasi keputusan dinonaktifkan.");
      return;
    }

    if (locked || blockedByBackend) {
      setFormError(locked ? LOCKED_READ_ONLY_ERROR : "Backend unavailable");
      return;
    }

    if (!decision) {
      setFormError("Decision wajib dipilih.");
      return;
    }

    if (!reason.trim()) {
      setFormError("Reason wajib diisi.");
      return;
    }

    if (decision === "APPROVE PERIOD" && approveBlockedByPolicy) {
      setFormError(`Tidak dapat APPROVE PERIOD: ${approvalGate.failures.join(" | ")}`);
      return;
    }

    try {
      setIsSubmitting(true);
      await applyApproverDecision({
        project_id: projectIdValue,
        period_id: contextValue.period_id,
        period_version: contextValue.period_version,
        decision,
        reason,
        final_bim_score: contextValue.summary.total_score,
        breakdown: contextValue.summary.breakdown,
        summary_confidence_coverage: contextValue.summary.confidence?.coverage ?? null,
        evidence_counts: contextValue.evidence_counts,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to apply decision.";
      setFormError(message);
      if (message.startsWith("HTTP ") || message === "Backend unavailable") {
        setBannerHint(message);
      }
      return;
    } finally {
      setIsSubmitting(false);
    }

    setFormError(null);
    setBannerHint(null);
    setFormInfo("Keputusan berhasil disimpan.");
    setReason("");
    setDecision("");
    setHistoryVersion((prev) => prev + 1);

    fetchApproverProjectContext(projectIdValue)
      .then((next) => {
        setContext(next);
      })
      .catch(() => {
        setContext((prev) => prev);
      });
  }

  return (
    <ApproverLayout
      title="Approve / Reject Period"
      subtitle="Keputusan final level period untuk legitimasi organisasi."
      projectId={typeof projectId === "string" ? projectId : null}
      projectName={formatProjectLabel(contextValue.project)}
      periodLabel={contextValue.period_label}
      periodStatusLabel={contextValue.period_status_label}
    >
      <BackendStatusBanner mode={contextValue.data_mode} message={bannerHint || contextValue.backend_message} />

      <section className="task-panel">
        <p className="warning-box">Approval akan mengunci period dan membentuk rekam jejak final.</p>
        <p className="inline-note">Snapshot source: backend database.</p>
        {approveBlockedByPolicy ? (
          <p className="warning-box">
            APPROVE PERIOD dinonaktifkan karena gating policy belum terpenuhi.
          </p>
        ) : null}
        {locked ? <p className="warning-box">LOCKED (read-only)</p> : null}
        {!canWrite ? (
          <p className="read-only-banner">
            Mode read-only aktif untuk role <strong>{getRoleLabel(credential.role)}</strong>. Konfirmasi keputusan
            dinonaktifkan.
          </p>
        ) : null}
      </section>

      <section className="task-panel">
        <h2>Approval Gating Policy</h2>
        <div className="task-grid-3">
          <article className="summary-card">
            <span>Coverage</span>
            <strong>
              {approvalGate.metrics.coverage_ratio === null
                ? NA_TEXT
                : `${Math.round(approvalGate.metrics.coverage_ratio * 100)}%`}
            </strong>
            <small>Min {Math.round(APPROVAL_GATE_POLICY.min_coverage_ratio * 100)}%</small>
          </article>
          <article className="summary-card">
            <span>Reviewed Evidence</span>
            <strong>{approvalGate.metrics.reviewed_evidence_count}</strong>
            <small>Min {APPROVAL_GATE_POLICY.min_reviewed_evidence}</small>
          </article>
          <article className="summary-card">
            <span>Scored Perspectives</span>
            <strong>{approvalGate.metrics.scored_perspectives_count}</strong>
            <small>Min {APPROVAL_GATE_POLICY.min_scored_perspectives}</small>
          </article>
          <article className="summary-card">
            <span>Awaiting Review</span>
            <strong>{approvalGate.metrics.awaiting_review_count}</strong>
            <small>Must be 0</small>
          </article>
          <article className="summary-card">
            <span>Gate Status</span>
            <strong>{approvalGate.is_eligible ? "Eligible" : "Blocked"}</strong>
            <small>{approvalGate.is_eligible ? "Approval dapat diproses" : "Periode tetap OPEN"}</small>
          </article>
        </div>
        {!approvalGate.is_eligible ? (
          <div className="warning-box">
            {approvalGate.failures.map((item, index) => (
              <p key={`${item}-${index}`}>{item}</p>
            ))}
          </div>
        ) : null}
      </section>

      <section className="task-panel">
        <h2>Konfirmasi Keputusan</h2>
        <div className="field-grid">
          <label htmlFor="approval-decision">
            Decision
            <select
              id="approval-decision"
              value={decision}
              onChange={(event) => setDecision(event.target.value as ApprovalDecision | "")}
              disabled={!canWrite || locked || blockedByBackend || isSubmitting}
            >
              <option value="">Pilih decision</option>
              {DECISIONS.map((item) => (
                <option
                  key={item}
                  value={item}
                  disabled={item === "APPROVE PERIOD" && approveBlockedByPolicy}
                >
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="approval-reason">
            Reason (required)
            <textarea
              id="approval-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={!canWrite || locked || blockedByBackend || isSubmitting}
              placeholder="Tuliskan alasan keputusan approval"
            />
          </label>
        </div>

        <div className="wizard-actions">
          <button
            type="button"
            className="action-primary"
            onClick={() => void onConfirm()}
            disabled={!canWrite || locked || blockedByBackend || isSubmitting}
          >
            Konfirmasi Keputusan
          </button>
          <Link href={`/approve/projects/${projectIdValue}`}>Back to Period Approval</Link>
        </div>

        {formError ? <p className="error-box">{formError}</p> : null}
        {formInfo ? <p className="task-note">{formInfo}</p> : null}
      </section>

      <section className="task-panel" key={historyVersion}>
        <h3>Decision History</h3>
        {decisions.length === 0 ? <p className="empty-state">No decisions yet.</p> : null}
        {decisions.length > 0 ? (
          <ol className="review-history">
            {decisions.map((entry, idx) => (
              <li key={`${entry.decided_at}-${idx}`}>
                <p>
                  <strong>{entry.decision}</strong>
                </p>
                <p>Reason: {entry.reason || NA_TEXT}</p>
                <p>
                  Decided by: {entry.decided_by || NA_TEXT} | Time: {entry.decided_at || NA_TEXT}
                </p>
              </li>
            ))}
          </ol>
        ) : null}

        <h3>Snapshots</h3>
        {snapshots.length === 0 ? <p className="empty-state">No snapshots yet.</p> : null}
        {snapshots.length > 0 ? (
          <ol className="review-history">
            {snapshots.map((entry, idx) => (
              <li key={`${entry.approved_at}-${idx}`}>
                <p>
                  <strong>{entry.note}</strong>
                </p>
                <p>
                  Approved by: {entry.approved_by || NA_TEXT} | Time: {entry.approved_at || NA_TEXT}
                </p>
                <p>Snapshot ID: {entry.snapshot_id || NA_TEXT}</p>
                <p>Final BIM score: {entry.final_bim_score ?? NA_TEXT}</p>
              </li>
            ))}
          </ol>
        ) : null}
      </section>
    </ApproverLayout>
  );
}
