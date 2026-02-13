import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import ApproverLayout from "@/components/ApproverLayout";
import BackendStatusBanner from "@/components/BackendStatusBanner";
import { DataMode } from "@/lib/role1TaskLayer";
import { NA_TEXT } from "@/lib/role1TaskLayer";
import {
  ApproverProjectRow,
  fetchApproverHomeContext,
} from "@/lib/approverTaskLayer";

export default function ApproverHomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ApproverProjectRow[]>([]);
  const [dataMode, setDataMode] = useState<DataMode>("backend");
  const [backendMessage, setBackendMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchApproverHomeContext();
        if (!mounted) return;
        setRows(data.rows);
        setDataMode(data.data_mode);
        setBackendMessage(data.backend_message);
        setError(null);
      } catch (e) {
        if (!mounted) return;
        setRows([]);
        setDataMode("prototype");
        setBackendMessage(e instanceof Error ? e.message : "Backend not available");
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
  }, []);

  const headerProjectLabel = useMemo(() => {
    if (loading) return "Loading approval queue...";
    if (rows.length === 0) return "No project pending approval";
    if (rows.length === 1) return rows[0].project.name || rows[0].project.code || "1 project pending approval";
    return `${rows.length} projects pending approval`;
  }, [loading, rows]);

  const headerPeriodLabel = useMemo(() => {
    if (loading) return "Checking active period...";
    if (rows.length === 0) return "No active period";
    const labels = [...new Set(rows.map((row) => row.period_label).filter((value) => value && value !== NA_TEXT))];
    if (labels.length === 1) return labels[0];
    if (labels.length > 1) return `${labels.length} active periods (multi-project)`;
    return "Not synced";
  }, [loading, rows]);

  const headerPeriodStatus = useMemo(() => {
    if (loading) return "Syncing...";
    if (rows.length === 0) return "No submitted evidence";
    const statuses = [
      ...new Set(rows.map((row) => row.period_status_label).filter((value) => value && value !== NA_TEXT)),
    ];
    if (statuses.length === 1) return statuses[0];
    if (statuses.length > 1) return "Mixed";
    return "Not synced";
  }, [loading, rows]);

  return (
    <ApproverLayout
      title="Period Approval"
      subtitle="Approval final di level period berdasarkan summary read-only dan status review evidence."
      projectName={headerProjectLabel}
      periodLabel={headerPeriodLabel}
      periodStatusLabel={headerPeriodStatus}
    >
      <BackendStatusBanner mode={dataMode} message={backendMessage} />

      <section className="task-panel">
        <p className="inline-note">
          Mulai setelah review selesai -&gt; approve/reject period dengan reason.
        </p>
        <p className="inline-note">Review tidak mengubah skor dan bukan approval period.</p>
        {loading ? <p>Loading...</p> : null}
        {error ? <p className="error-box">{error}</p> : null}

        {!loading && !error && rows.length === 0 ? (
          <p className="empty-state">No projects available.</p>
        ) : null}

        {!loading && !error && rows.length > 0 ? (
          <div className="evidence-list">
            {rows.map((row) => (
              <article className="evidence-item" key={row.project.id}>
                <p>
                  <strong>{row.project.name || row.project.code || NA_TEXT}</strong>
                </p>
                <p>Active period: {row.period_label || NA_TEXT}</p>
                <p>Period status: {row.period_status_label || NA_TEXT}</p>
                <p>Approval status: {row.approval_status || NA_TEXT}</p>

                <div className="item-actions">
                  <Link className="revisi" href={`/approve/projects/${row.project.id}`}>
                    Buka Approval
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </ApproverLayout>
  );
}
