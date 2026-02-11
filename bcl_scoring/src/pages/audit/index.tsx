import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import AuditorLayout from "@/components/AuditorLayout";
import BackendStatusBanner from "@/components/BackendStatusBanner";
import { AuditSnapshotView, fetchAuditSnapshotsReadMode } from "@/lib/auditTaskLayer";
import { getPrototypeProjectMetaFromStore } from "@/lib/prototypeStore";
import {
  DataMode,
  NA_TEXT,
  ProjectRecord,
  fetchProjectsReadMode,
} from "@/lib/role1TaskLayer";

export default function AuditHomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<AuditSnapshotView[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [dataMode, setDataMode] = useState<DataMode>("backend");
  const [backendMessage, setBackendMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const snapshotResult = await fetchAuditSnapshotsReadMode();
        const projectsResult = await fetchProjectsReadMode();

        if (!mounted) return;
        setSnapshots(snapshotResult.data);
        setProjects(projectsResult.data);
        setDataMode(
          snapshotResult.mode === "prototype" || projectsResult.mode === "prototype" ? "prototype" : "backend"
        );
        setBackendMessage(snapshotResult.backend_message || projectsResult.backend_message);
        setError(null);
      } catch (e) {
        if (!mounted) return;
        setSnapshots([]);
        setProjects([]);
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

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of projects) {
      map.set(item.id, item.name || item.code || item.id);
    }
    for (const entry of snapshots) {
      if (map.has(entry.snapshot.project_id)) continue;
      const meta = getPrototypeProjectMetaFromStore(entry.snapshot.project_id);
      map.set(entry.snapshot.project_id, meta?.project_name || meta?.project_code || entry.snapshot.project_id);
    }
    return map;
  }, [projects, snapshots]);

  return (
    <AuditorLayout
      title="Read-only Auditor View"
      subtitle="Snapshot list untuk pemeriksaan jejak proses Evidence -> Review -> Approval -> Snapshot."
      projectLabel={null}
      periodLabel={null}
    >
      <BackendStatusBanner mode={dataMode} message={backendMessage} />

      <section className="task-panel">
        <p className="inline-note">
          Mulai dari snapshot list -&gt; baca narrative trail &amp; reference ISO mapping.
        </p>
        {loading ? <p>Loading...</p> : null}
        {error ? <p className="error-box">{error}</p> : null}

        {!loading && !error && snapshots.length === 0 ? (
          <p className="empty-state">No snapshots available in prototype storage.</p>
        ) : null}

        {!loading && !error && snapshots.length > 0 ? (
          <div className="evidence-list">
            {snapshots.map((entry) => (
              <article className="evidence-item" key={entry.snapshot_id}>
                <p>
                  <strong>{projectNameById.get(entry.snapshot.project_id) || entry.snapshot.project_id || NA_TEXT}</strong>
                </p>
                <p>Project ID: {entry.snapshot.project_id || NA_TEXT}</p>
                <p>Period: {entry.snapshot.period_id || NA_TEXT}</p>
                <p>Approved at: {entry.snapshot.approved_at || NA_TEXT}</p>
                <p>Approved by: {entry.snapshot.approved_by || NA_TEXT}</p>
                <div className="item-actions">
                  <Link className="revisi" href={`/audit/snapshots/${encodeURIComponent(entry.snapshot_id)}`}>
                    Open Snapshot
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </AuditorLayout>
  );
}
