import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import ApproverLayout from "@/components/ApproverLayout";
import BackendStatusBanner from "@/components/BackendStatusBanner";
import { canWriteRole3Approval } from "@/lib/accessControl";
import { NA_TEXT, formatProjectLabel } from "@/lib/role1TaskLayer";
import { ApproverProjectContext, fetchApproverProjectContext } from "@/lib/approverTaskLayer";
import { useCredential } from "@/lib/useCredential";
import { getRoleLabel } from "@/lib/userCredential";

const PERSPECTIVES = ["P1", "P2", "P3", "P4", "P5"];

function scoreInterpretation(totalScore: number | null): string {
  if (totalScore === null || !Number.isFinite(totalScore)) return NA_TEXT;
  if (totalScore < 40) return "Symbolic BIM";
  if (totalScore < 60) return "Partial BIM";
  if (totalScore < 75) return "Functional BIM";
  if (totalScore < 90) return "Integrated BIM";
  return "BIM-Driven Project";
}

export default function ProjectApprovalContextPage() {
  const router = useRouter();
  const { projectId } = router.query;
  const credential = useCredential();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<ApproverProjectContext | null>(null);

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
          <h1>Period Approval</h1>
          <p className="error-box">{error || "Project context not found."}</p>
          <p>
            <Link href="/approve">Kembali ke Period Approval</Link>
          </p>
        </section>
      </main>
    );
  }

  const statusClass =
    context.period_status_label === "LOCKED"
      ? "status-chip status-lock"
      : context.period_status_label === "OPEN"
        ? "status-chip status-open"
        : "status-chip status-na";

  const breakdownMap = new Map(context.summary.breakdown.map((row) => [row.perspective_id, row.score]));
  const interpretation = scoreInterpretation(context.summary.total_score);
  const confidence = context.summary.confidence;
  const summaryPending = !context.summary_available;
  const totalScoreLabel =
    context.summary.total_score !== null && Number.isFinite(context.summary.total_score)
      ? String(context.summary.total_score)
      : "Pending";
  const scoreLevelLabel = interpretation === NA_TEXT ? "Awaiting scoring result" : interpretation;
  const confidenceLabel =
    confidence?.confidence !== null && confidence?.confidence !== undefined
      ? String(confidence.confidence)
      : "Pending";

  return (
    <ApproverLayout
      title="Period Approval"
      subtitle="Ringkasan period read-only untuk keputusan approval level period."
      projectId={typeof projectId === "string" ? projectId : null}
      projectName={formatProjectLabel(context.project)}
      periodLabel={context.period_label}
      periodStatusLabel={context.period_status_label}
    >
      <BackendStatusBanner mode={context.data_mode} message={context.backend_message} />

      <section className="task-panel">
        <div className="wizard-actions">
          <Link href="/approve">Kembali ke Daftar Project Approval</Link>
        </div>
      </section>

      <section className="task-panel">
        <p>
          Period status: <span className={statusClass}>{context.period_status_label || NA_TEXT}</span>
        </p>
        {context.period_status_label === NA_TEXT ? (
          <p className="warning-box">Period status: {NA_TEXT}</p>
        ) : null}
      </section>

      <section className="task-panel">
        <h2>Read-only Summary</h2>
        <p>
          BIM score total: <strong>{totalScoreLabel}</strong>
        </p>
        <p>
          Score level: <strong>{scoreLevelLabel}</strong>
        </p>
        <p>
          Confidence: <strong>{confidenceLabel}</strong>
        </p>
        {confidence ? (
          <p>
            Coverage/Frequency: <strong>{confidence.coverage ?? NA_TEXT}</strong> /{" "}
            <strong>{confidence.frequency ?? NA_TEXT}</strong>
          </p>
        ) : null}
        {summaryPending ? (
          <p className="warning-box">
            Summary belum tersedia dari backend. Lanjutkan review evidence dan gunakan keputusan approval untuk membuat snapshot.
          </p>
        ) : null}

        <div className="task-grid-3">
          {PERSPECTIVES.map((pid) => (
            <article key={pid} className="summary-card">
              <span>{pid}</span>
              <strong>{breakdownMap.get(pid) ?? (summaryPending ? "Pending" : "Not scored")}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="task-panel">
        <h2>Evidence Review Status</h2>
        <div className="task-grid-3">
          <article className="summary-card">
            <span>ACCEPTABLE</span>
            <strong>{context.evidence_counts.ACCEPTABLE}</strong>
          </article>
          <article className="summary-card">
            <span>NEEDS REVISION</span>
            <strong>{context.evidence_counts.NEEDS_REVISION}</strong>
          </article>
          <article className="summary-card">
            <span>REJECTED</span>
            <strong>{context.evidence_counts.REJECTED}</strong>
          </article>
          {context.evidence_counts.AWAITING_REVIEW > 0 ? (
            <Link className="summary-card summary-card-action" href={`/approve/projects/${projectId}/awaiting-review`}>
              <span>Awaiting review</span>
              <strong>{context.evidence_counts.AWAITING_REVIEW}</strong>
              <small>Open pending queue</small>
            </Link>
          ) : (
            <article className="summary-card">
              <span>Awaiting review</span>
              <strong>{context.evidence_counts.AWAITING_REVIEW}</strong>
              <small>No pending review items</small>
            </article>
          )}
        </div>
      </section>

      <section className="task-panel">
        <h2>Approval Decision</h2>
        {!canWriteRole3Approval(credential.role) ? (
          <p className="read-only-banner">
            Mode read-only aktif untuk role <strong>{getRoleLabel(credential.role)}</strong>. Aksi Approve/Reject
            dinonaktifkan.
          </p>
        ) : null}
        <div className="wizard-actions">
          <Link
            className={`primary-cta ${context.period_locked || !canWriteRole3Approval(credential.role) ? "disabled-link" : ""}`}
            href={context.period_locked || !canWriteRole3Approval(credential.role) ? "#" : `/approve/projects/${projectId}/decision`}
            aria-disabled={context.period_locked || !canWriteRole3Approval(credential.role)}
            onClick={(event) => {
              if (context.period_locked || !canWriteRole3Approval(credential.role)) event.preventDefault();
            }}
          >
            Approve / Reject Period
          </Link>
        </div>

        {context.period_locked ? <p className="warning-box">LOCKED (read-only)</p> : null}

        {context.latest_decision ? (
          <p>
            Last decision: {context.latest_decision.decision} | {context.latest_decision.decided_by} | {context.latest_decision.decided_at} | Reason: {context.latest_decision.reason}
          </p>
        ) : (
          <p>Last decision: Belum ada keputusan untuk period ini.</p>
        )}

        {context.snapshots.length > 0 ? (
          <>
            <p className="inline-note">Snapshot source: backend database.</p>
            <p>Snapshots: {context.snapshots.length}</p>
          </>
        ) : null}
      </section>
    </ApproverLayout>
  );
}
