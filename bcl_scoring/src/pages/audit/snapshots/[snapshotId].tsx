import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import AuditorLayout from "@/components/AuditorLayout";
import BackendStatusBanner from "@/components/BackendStatusBanner";
import {
  AuditSnapshotView,
  buildAuditExportPayload,
  buildPrintableAuditSnapshot,
  fetchAuditSnapshotsReadMode,
  getSnapshotLockStatus,
  getSubmittedCountFromSnapshot,
  listDecisionsForSnapshot,
} from "@/lib/auditTaskLayer";
import { generateSnapshotPdfBlob } from "@/lib/auditPdfExport";
import { fetchReadOnlySummaryReadMode } from "@/lib/approverTaskLayer";
import {
  ISO19650_REFERENCE_ONLY_LABEL,
  ISO19650_REFERENCE_ROWS,
} from "@/lib/iso19650Reference";
import { getPrototypeProjectMetaFromStore } from "@/lib/prototypeStore";
import {
  DataMode,
  NA_TEXT,
  ProjectRecord,
  fetchProjectReadMode,
  formatProjectLabel,
} from "@/lib/role1TaskLayer";

const PERSPECTIVES = ["P1", "P2", "P3", "P4", "P5"];

function scoreInterpretation(totalScore: number | null): string {
  if (totalScore === null || !Number.isFinite(totalScore)) return NA_TEXT;
  if (totalScore < 40) return "Symbolic BIM";
  if (totalScore < 60) return "Partial BIM";
  if (totalScore < 75) return "Functional BIM";
  if (totalScore < 90) return "Integrated BIM";
  return "BIM-Driven Project";
}

export default function AuditSnapshotDetailPage() {
  const router = useRouter();
  const { snapshotId } = router.query;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshotView, setSnapshotView] = useState<AuditSnapshotView | null>(null);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [dataMode, setDataMode] = useState<DataMode>("backend");
  const [backendMessage, setBackendMessage] = useState<string | null>(null);
  const [exportInfo, setExportInfo] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [backendSummary, setBackendSummary] = useState<{
    total_score: number | null;
    breakdown: Array<{ perspective_id: string; score: number | null }>;
  } | null>(null);

  useEffect(() => {
    if (!router.isReady || typeof snapshotId !== "string") return;

    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const decodedId = decodeURIComponent(snapshotId);
        const snapshotResult = await fetchAuditSnapshotsReadMode();
        const hit = snapshotResult.data.find((row) => row.snapshot_id === decodedId) || null;
        if (!hit) {
          throw new Error("Snapshot not found.");
        }

        const projectResult = await fetchProjectReadMode(hit.snapshot.project_id);
        let projectInfo: ProjectRecord | null = projectResult.data;
        let pageDataMode: DataMode =
          snapshotResult.mode === "prototype" || projectResult.mode === "prototype" ? "prototype" : "backend";
        let pageBackendMessage = snapshotResult.backend_message || projectResult.backend_message;

        if (!projectInfo) {
          const meta = getPrototypeProjectMetaFromStore(hit.snapshot.project_id);
          projectInfo = {
            id: hit.snapshot.project_id,
            name: meta?.project_name || null,
            code: meta?.project_code || null,
            phase: null,
            is_active: null,
          };
          pageDataMode = "prototype";
          pageBackendMessage = pageBackendMessage || "Backend not available";
        }

        let summary: typeof backendSummary = null;
        const summaryResult = await fetchReadOnlySummaryReadMode(hit.snapshot.project_id, hit.snapshot.period_id);
        if (summaryResult.mode === "prototype") {
          pageDataMode = "prototype";
          pageBackendMessage = pageBackendMessage || summaryResult.backend_message;
        }
        if (summaryResult.available) {
          summary = {
            total_score: summaryResult.data.total_score,
            breakdown: summaryResult.data.breakdown,
          };
        } else {
          summary = null;
        }

        if (!mounted) return;
        setSnapshotView(hit);
        setProject(projectInfo);
        setDataMode(pageDataMode);
        setBackendMessage(pageBackendMessage);
        setBackendSummary(summary);
        setError(null);
      } catch (e) {
        if (!mounted) return;
        setSnapshotView(null);
        setProject(null);
        setDataMode("prototype");
        setBackendMessage(e instanceof Error ? e.message : "Backend not available");
        setBackendSummary(null);
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router.isReady, snapshotId]);

  const decisions = useMemo(() => {
    if (!snapshotView) return [];
    return listDecisionsForSnapshot(snapshotView.snapshot);
  }, [snapshotView]);

  const scoreBreakdownMap = useMemo(() => {
    const source = snapshotView?.snapshot.breakdown || [];
    return new Map(source.map((row) => [row.perspective_id, row.score]));
  }, [snapshotView]);

  function onExportJson() {
    if (!snapshotView) return;

    const payload = buildAuditExportPayload({
      snapshot_id: snapshotView.snapshot_id,
      snapshot: snapshotView.snapshot,
      decisions,
      lock_status: getSnapshotLockStatus(snapshotView.snapshot),
    });

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `snapshot-${snapshotView.snapshot_id}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setExportInfo("Export JSON selesai (download started).");
  }

  async function onExportPdf() {
    if (!snapshotView) return;
    try {
      setPdfGenerating(true);
      setExportInfo("Generating PDF...");

      const printable = buildPrintableAuditSnapshot({
        snapshot_id: snapshotView.snapshot_id,
        snapshot: snapshotView.snapshot,
        lock_status: getSnapshotLockStatus(snapshotView.snapshot),
        project_name: project?.name || project?.code || null,
        latest_decision: decisions[0] || null,
        submitted_count: getSubmittedCountFromSnapshot(snapshotView.snapshot.evidence_counts),
        iso_reference_label: ISO19650_REFERENCE_ONLY_LABEL,
        iso_reference_rows: ISO19650_REFERENCE_ROWS,
      });

      const blob = await generateSnapshotPdfBlob(printable);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = printable.file_name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setExportInfo("PDF generated (download started).");
    } catch (e) {
      setExportInfo(e instanceof Error ? e.message : "Failed to generate PDF.");
    } finally {
      setPdfGenerating(false);
    }
  }

  if (loading) {
    return (
      <main className="task-shell">
        <section className="task-panel">Loading...</section>
      </main>
    );
  }

  if (!snapshotView) {
    return (
      <main className="task-shell">
        <section className="task-panel">
          <h1>Read-only Auditor View</h1>
          <p className="error-box">{error || "Not available"}</p>
          <p>
            <Link href="/audit">Back to Audit Home</Link>
          </p>
        </section>
      </main>
    );
  }

  const { snapshot } = snapshotView;
  const submittedCount = getSubmittedCountFromSnapshot(snapshot.evidence_counts);
  const latestDecision = decisions[0] || null;
  const interpretation = scoreInterpretation(snapshot.final_bim_score);

  return (
    <AuditorLayout
      title="Read-only Auditor View"
      subtitle="Snapshot detail sebagai catatan immutable prototype."
      projectLabel={formatProjectLabel(project || { id: snapshot.project_id, name: null, code: null, phase: null, is_active: null })}
      periodLabel={snapshot.period_id || NA_TEXT}
    >
      <BackendStatusBanner mode={dataMode} message={backendMessage} />

      <section className="task-panel">
        <h2>Snapshot Header</h2>
        <p>Project: {project?.name || project?.code || snapshot.project_id || NA_TEXT}</p>
        <p>Project ID: {snapshot.project_id || NA_TEXT}</p>
        <p>Period: {snapshot.period_id || NA_TEXT}</p>
        <p>Approved by: {snapshot.approved_by || NA_TEXT}</p>
        <p>Approved at: {snapshot.approved_at || NA_TEXT}</p>
        <p>Lock status: {getSnapshotLockStatus(snapshot)}</p>
        <p>Snapshot ID: {snapshotView.snapshot_id || NA_TEXT}</p>
        <p className="prototype-badge">Prototype snapshot (not used for audit/compliance)</p>
      </section>

      <section className="task-panel">
        <h2>Final Score (Read-only)</h2>
        <p>
          Total: <strong>{snapshot.final_bim_score ?? NA_TEXT}</strong>
        </p>
        <p>
          Score level: <strong>{interpretation}</strong>
        </p>
        <div className="task-grid-3">
          {PERSPECTIVES.map((pid) => (
            <article key={pid} className="summary-card">
              <span>{pid}</span>
              <strong>{scoreBreakdownMap.get(pid) ?? NA_TEXT}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="task-panel">
        <h2>Evidence Review Counts</h2>
        <div className="task-grid-3">
          <article className="summary-card">
            <span>ACCEPTABLE</span>
            <strong>{snapshot.evidence_counts.ACCEPTABLE}</strong>
          </article>
          <article className="summary-card">
            <span>NEEDS REVISION</span>
            <strong>{snapshot.evidence_counts.NEEDS_REVISION}</strong>
          </article>
          <article className="summary-card">
            <span>REJECTED</span>
            <strong>{snapshot.evidence_counts.REJECTED}</strong>
          </article>
          <article className="summary-card">
            <span>Awaiting review</span>
            <strong>{snapshot.evidence_counts.AWAITING_REVIEW}</strong>
          </article>
        </div>
      </section>

      <section className="task-panel">
        <h2>Narrative Audit Trail</h2>
        <ol className="audit-trail">
          <li>
            <p>
              <strong>Evidence Submission (Role 1)</strong>
            </p>
            <p>Role: BIM Koordinator Proyek.</p>
            <p>Meaning: Proyek submit evidence untuk indikator terkait (submitted count: {submittedCount}).</p>
            <p>NOT done: Tidak melakukan review, approval, atau locking period.</p>
          </li>
          <li>
            <p>
              <strong>Review Eligibility (Role 2)</strong>
            </p>
            <p>Role: HO Reviewer.</p>
            <p>
              Meaning: Menilai kelayakan evidence (Acceptable/Needs Revision/Rejected) berdasarkan konteks review.
            </p>
            <p>NOT done: Tidak melakukan approval period dan tidak mengubah skor.</p>
          </li>
          <li>
            <p>
              <strong>Approval Decision (Role 3)</strong>
            </p>
            <p>Role: BIM Manager/KaDiv BIM.</p>
            <p>Meaning: Keputusan level period: {latestDecision?.decision || NA_TEXT}.</p>
            <p>Reason: {latestDecision?.reason || NA_TEXT}</p>
            <p>NOT done: Tidak melakukan edit evidence, indikator, atau score entry.</p>
          </li>
          <li>
            <p>
              <strong>Snapshot Created (System)</strong>
            </p>
            <p>Role: System record layer (prototype).</p>
            <p>Meaning: Snapshot immutable dibuat saat approval dan disimpan append-only.</p>
            <p>NOT done: Tidak mengklaim compliance final; hanya rekam jejak referensi internal.</p>
          </li>
        </ol>
      </section>

      <section className="task-panel">
        <h2>ISO 19650 Reference Mapping</h2>
        <p className="inline-note">{ISO19650_REFERENCE_ONLY_LABEL}</p>
        <table className="audit-table">
          <thead>
            <tr>
              <th align="left">Control Area</th>
              <th align="left">ISO Reference</th>
              <th align="left">Indicative Mapping</th>
            </tr>
          </thead>
          <tbody>
            {ISO19650_REFERENCE_ROWS.map((row) => (
              <tr key={row.control_area}>
                <td>{row.control_area}</td>
                <td>{row.iso_reference}</td>
                <td>{row.indicative_mapping}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="task-panel">
        <h2>Audit Export</h2>
        <div className="wizard-actions">
          <button type="button" onClick={onExportJson}>
            Export JSON
          </button>
          <button type="button" onClick={onExportPdf} disabled={pdfGenerating}>
            Export PDF
          </button>
        </div>
        {exportInfo ? <p className="task-note">{exportInfo}</p> : null}
      </section>

      <section className="task-panel">
        <h3>Backend Read-only Summary</h3>
        <p>
          Total: <strong>{backendSummary?.total_score ?? NA_TEXT}</strong>
        </p>
        <p>Breakdown source: {backendSummary ? "Available" : NA_TEXT}</p>
      </section>
    </AuditorLayout>
  );
}
