import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import ApproverLayout from "@/components/ApproverLayout";
import BackendStatusBanner from "@/components/BackendStatusBanner";
import { NA_TEXT, formatProjectLabel } from "@/lib/role1TaskLayer";
import { ApproverProjectContext, fetchApproverProjectContext } from "@/lib/approverTaskLayer";

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

  return (
    <ApproverLayout
      title="Period Approval"
      subtitle="Ringkasan period read-only untuk keputusan approval level period."
      projectName={formatProjectLabel(context.project)}
      periodLabel={context.period_label}
      periodStatusLabel={context.period_status_label}
    >
      <BackendStatusBanner mode={context.data_mode} message={context.backend_message} />

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
          BIM score total: <strong>{context.summary.total_score ?? NA_TEXT}</strong>
        </p>
        <p>
          Score level: <strong>{interpretation}</strong>
        </p>
        <p>
          Confidence: <strong>{confidence?.confidence ?? NA_TEXT}</strong>
        </p>
        {confidence ? (
          <p>
            Coverage/Frequency: <strong>{confidence.coverage ?? NA_TEXT}</strong> /{" "}
            <strong>{confidence.frequency ?? NA_TEXT}</strong>
          </p>
        ) : null}
        {!context.summary_available ? (
          <p className="warning-box">Summary backend: {NA_TEXT}</p>
        ) : null}

        <div className="task-grid-3">
          {PERSPECTIVES.map((pid) => (
            <article key={pid} className="summary-card">
              <span>{pid}</span>
              <strong>{breakdownMap.get(pid) ?? NA_TEXT}</strong>
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
          <article className="summary-card">
            <span>Awaiting review</span>
            <strong>{context.evidence_counts.AWAITING_REVIEW}</strong>
          </article>
        </div>
      </section>

      <section className="task-panel">
        <h2>Approval Decision</h2>
        <div className="wizard-actions">
          <Link
            className={`primary-cta ${context.period_locked ? "disabled-link" : ""}`}
            href={context.period_locked ? "#" : `/approve/projects/${projectId}/decision`}
            aria-disabled={context.period_locked}
            onClick={(event) => {
              if (context.period_locked) event.preventDefault();
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
          <p>Last decision: {NA_TEXT}</p>
        )}

        {context.snapshots.length > 0 ? (
          <>
            <p className="prototype-badge">Prototype snapshot (not used for audit/compliance)</p>
            <p>Snapshots: {context.snapshots.length}</p>
          </>
        ) : null}
      </section>
    </ApproverLayout>
  );
}
