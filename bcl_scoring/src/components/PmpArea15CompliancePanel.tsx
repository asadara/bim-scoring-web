import {
  NA_TEXT,
} from "@/lib/role1TaskLayer";
import {
  PmpArea15ComplianceSummary,
  PmpArea15Status,
} from "@/lib/approverTaskLayer";

type PmpArea15CompliancePanelProps = {
  summary: PmpArea15ComplianceSummary | null;
  title?: string;
  showControls?: boolean;
};

function formatBooleanLabel(value: boolean): string {
  return value ? "Ready" : "Blocked";
}

function formatPhaseLabel(value: string): string {
  const text = value.replace(/_/g, " ").trim();
  if (!text) return NA_TEXT;
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStatusChipClass(status: PmpArea15Status): string {
  if (status === "OK") return "status-chip status-open";
  if (status === "MINOR") return "status-chip status-minor";
  if (status === "NOT_OK" || status === "INCOMPLETE") return "status-chip status-lock";
  return "status-chip status-na";
}

export default function PmpArea15CompliancePanel({
  summary,
  title = "PMP Area 15 Compliance Bridge",
  showControls = true,
}: PmpArea15CompliancePanelProps) {
  return (
    <section className="task-panel">
      <h2>{title}</h2>
      {!summary ? (
        <p className="warning-box">
          Ringkasan PMP Area 15 belum tersedia dari bridge backend. Approval tetap dapat membaca BIM summary, tetapi
          status governance PMP belum bisa diturunkan otomatis.
        </p>
      ) : (
        <>
          <p>
            Source of truth: <strong>{summary.source_of_truth || "bim_scoring"}</strong>
          </p>
          {summary.intent ? <p>{summary.intent}</p> : null}
          <div className="task-grid-3">
            <article className="summary-card">
              <span>Overall status</span>
              <strong>{summary.overall_status}</strong>
              <small>
                <span className={getStatusChipClass(summary.overall_status)}>{summary.overall_export_status}</span>
              </small>
            </article>
            <article className="summary-card">
              <span>Export readiness</span>
              <strong>{formatBooleanLabel(summary.export_ready)}</strong>
              <small>PMP format generation gate</small>
            </article>
            <article className="summary-card">
              <span>Hold point readiness</span>
              <strong>{formatBooleanLabel(summary.hold_point_ready)}</strong>
              <small>Audit and gate release signal</small>
            </article>
            <article className="summary-card">
              <span>Overall score</span>
              <strong>{summary.overall_score_100 ?? NA_TEXT}</strong>
              <small>Derived PMP control score</small>
            </article>
            <article className="summary-card">
              <span>Mapped controls</span>
              <strong>
                {summary.mapping_status.mapped_control_count}/{summary.mapping_status.configured_control_count}
              </strong>
              <small>Unmapped: {summary.mapping_status.unmapped_control_count}</small>
            </article>
            <article className="summary-card">
              <span>Total BIM score</span>
              <strong>{summary.total_bim_score_100 ?? NA_TEXT}</strong>
              <small>Read-only engine result</small>
            </article>
          </div>

          {summary.phase_summaries.length > 0 ? (
            <>
              <h3>PMP Phase Coverage</h3>
              <div className="task-grid-3">
                {summary.phase_summaries.map((phase) => (
                  <article key={phase.phase} className="summary-card">
                    <span>{formatPhaseLabel(phase.phase)}</span>
                    <strong>{phase.status}</strong>
                    <small>
                      Score {phase.score_100 ?? NA_TEXT} | mapped {phase.mapped_count}/{phase.mandatory_count || 0}
                    </small>
                  </article>
                ))}
              </div>
            </>
          ) : null}

          {showControls && summary.controls.length > 0 ? (
            <>
              <h3>Bridge Controls</h3>
              <div className="task-grid-3">
                {summary.controls.map((control) => (
                  <article key={control.control_id} className="summary-card">
                    <span>{formatPhaseLabel(control.phase)}</span>
                    <strong>{control.status}</strong>
                    <small>{control.title}</small>
                    <small>
                      Score {control.score_100 ?? NA_TEXT} | indicators {control.scored_indicator_count}/
                      {control.matched_indicator_count}
                    </small>
                    <small>
                      Evidence ready {control.evidence_ready_count}/{control.matched_indicator_count} | export{" "}
                      {control.export_status}
                    </small>
                    {control.blockers.length > 0 ? (
                      <small>Blockers: {control.blockers.join(", ")}</small>
                    ) : null}
                  </article>
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
