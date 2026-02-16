import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import AuditorLayout from "@/components/AuditorLayout";
import BackendStatusBanner from "@/components/BackendStatusBanner";
import {
  AuditGovernanceEvent,
  AuditSnapshotView,
  fetchAdminAuditLogsReadMode,
  fetchAuditSnapshotsReadMode,
} from "@/lib/auditTaskLayer";
import { getPrototypeProjectMetaFromStore } from "@/lib/prototypeStore";
import {
  DataMode,
  NA_TEXT,
  ProjectRecord,
  ScoringPeriod,
  formatPeriodLabel,
  fetchProjectPeriodsReadMode,
  fetchProjectsReadMode,
} from "@/lib/role1TaskLayer";
import { useCredential } from "@/lib/useCredential";

function formatDateText(value: string | null | undefined): string {
  if (!value) return NA_TEXT;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return NA_TEXT;
  return parsed.toLocaleString();
}

const ACTION_LABEL_MAP: Record<string, string> = {
  SNAPSHOT_CREATED: "Snapshot created",
  PERIOD_APPROVED: "Period approved",
  PERIOD_REJECTED: "Period approval rejected",
  EVIDENCE_REVIEWED: "Evidence reviewed",
  SUBMITTED: "Evidence submitted",
  CREATED: "Record created",
  UPDATED: "Record updated",
  ADMIN_CONFIG_LOCK_UPDATED: "Configuration lock updated",
  ADMIN_PERIOD_CREATED: "Scoring period created",
  ADMIN_PERIOD_BULK_GENERATED: "Scoring periods bulk generated",
};

const ENTITY_LABEL_MAP: Record<string, string> = {
  project: "Project",
  user: "User",
  role_mapping: "Role mapping",
  perspective: "Perspective",
  indicator: "Indicator",
  config_lock: "Configuration lock",
  period: "Scoring period",
  period_batch: "Scoring period batch",
  snapshot: "Snapshot",
};

function toTitleCase(raw: string): string {
  const source = raw.trim().toLowerCase();
  if (!source) return NA_TEXT;
  return source
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatActionLabel(action: string): string {
  const normalized = action.trim().toUpperCase();
  if (!normalized) return NA_TEXT;

  const direct = ACTION_LABEL_MAP[normalized];
  if (direct) return direct;

  const adminCrud = /^ADMIN_(.+)_(CREATED|UPDATED|DELETED)$/.exec(normalized);
  if (adminCrud) {
    const entityRaw = adminCrud[1].replace(/_/g, " ");
    const verbRaw = adminCrud[2].toLowerCase();
    return `Admin ${toTitleCase(entityRaw)} ${verbRaw}`;
  }

  return toTitleCase(normalized.replace(/_/g, " "));
}

function shortenEntityId(value: string | null): string {
  if (!value) return "";
  const text = value.trim();
  if (text.length <= 14) return text;
  return `${text.slice(0, 8)}...${text.slice(-4)}`;
}

function formatEntityLabel(entityType: string, entityId: string | null): string {
  const normalized = entityType.trim().toLowerCase();
  const entity = ENTITY_LABEL_MAP[normalized] || toTitleCase(normalized.replace(/_/g, " "));
  const shortId = shortenEntityId(entityId);
  return shortId ? `${entity} (${shortId})` : entity;
}

export default function AuditHomePage() {
  const credential = useCredential();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<AuditSnapshotView[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [periodsByProjectId, setPeriodsByProjectId] = useState<Record<string, ScoringPeriod[]>>({});
  const [events, setEvents] = useState<AuditGovernanceEvent[]>([]);
  const [dataMode, setDataMode] = useState<DataMode>("backend");
  const [backendMessage, setBackendMessage] = useState<string | null>(null);
  const [snapshotProjectFilter, setSnapshotProjectFilter] = useState<string>("");
  const [snapshotQuery, setSnapshotQuery] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const snapshotResult = await fetchAuditSnapshotsReadMode();
        const projectsResult = await fetchProjectsReadMode();
        const projectRows = projectsResult.data;

        const periodPairs = await Promise.all(
          projectRows.map(async (project) => ({
            projectId: project.id,
            result: await fetchProjectPeriodsReadMode(project.id),
          }))
        );

        const periodMap: Record<string, ScoringPeriod[]> = {};
        for (const pair of periodPairs) {
          periodMap[pair.projectId] = pair.result.data;
        }

        const includeAdminAuditLog = credential.role === "admin";
        const auditLogResult = includeAdminAuditLog
          ? await fetchAdminAuditLogsReadMode({
              role: credential.role,
              actor_id: credential.user_id,
              limit: 20,
            })
          : {
              data: [] as AuditGovernanceEvent[],
              mode: "backend" as DataMode,
              backend_message: null as string | null,
            };

        const messages: Array<string | null> = [
          snapshotResult.backend_message,
          projectsResult.backend_message,
          ...periodPairs.map((pair) => pair.result.backend_message),
          includeAdminAuditLog ? auditLogResult.backend_message : null,
        ];

        const hasPrototypeFallback =
          snapshotResult.mode === "prototype" ||
          projectsResult.mode === "prototype" ||
          periodPairs.some((pair) => pair.result.mode === "prototype") ||
          (includeAdminAuditLog && auditLogResult.mode === "prototype");

        if (!mounted) return;
        setSnapshots(snapshotResult.data);
        setProjects(projectRows);
        setPeriodsByProjectId(periodMap);
        setEvents(auditLogResult.data);
        setDataMode(hasPrototypeFallback ? "prototype" : "backend");
        setBackendMessage(messages.find((message) => Boolean(message)) || null);
        setError(null);
      } catch (e) {
        if (!mounted) return;
        setSnapshots([]);
        setProjects([]);
        setPeriodsByProjectId({});
        setEvents([]);
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
  }, [credential.role, credential.user_id]);

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

  const projectFilterOptions = useMemo(() => {
    const ids = new Set<string>();
    projects.forEach((project) => ids.add(project.id));
    snapshots.forEach((entry) => ids.add(entry.snapshot.project_id));
    Object.keys(periodsByProjectId).forEach((projectId) => ids.add(projectId));

    const rows = [...ids].map((projectId) => ({
      id: projectId,
      label: projectNameById.get(projectId) || projectId,
    }));
    rows.sort((a, b) => a.label.localeCompare(b.label));
    return rows;
  }, [periodsByProjectId, projectNameById, projects, snapshots]);

  const periodLabelByProjectPeriodId = useMemo(() => {
    const map = new Map<string, string>();
    for (const [projectId, periods] of Object.entries(periodsByProjectId)) {
      for (const period of periods) {
        if (!period?.id) continue;
        map.set(`${projectId}|${period.id}`, formatPeriodLabel(period));
      }
    }
    return map;
  }, [periodsByProjectId]);

  const snapshotMetrics = useMemo(() => {
    const periodRows = Object.values(periodsByProjectId).flat();
    const lockedPeriods = periodRows.filter((row) => row.status === "LOCKED").length;
    const openPeriods = periodRows.filter((row) => row.status !== "LOCKED").length;

    const sortedSnapshots = [...snapshots].sort((a, b) =>
      String(b.snapshot.approved_at).localeCompare(String(a.snapshot.approved_at))
    );
    const latestSnapshot = sortedSnapshots[0] || null;

    return {
      total_projects: projects.length,
      total_periods: periodRows.length,
      locked_periods: lockedPeriods,
      open_periods: openPeriods,
      total_snapshots: snapshots.length,
      latest_snapshot_id: latestSnapshot?.snapshot_id || null,
      latest_snapshot_at: latestSnapshot?.snapshot.approved_at || null,
      latest_snapshot_project:
        latestSnapshot ? projectNameById.get(latestSnapshot.snapshot.project_id) || latestSnapshot.snapshot.project_id : null,
    };
  }, [periodsByProjectId, projectNameById, projects.length, snapshots]);

  const visibleSnapshots = useMemo(() => {
    const projectFilter = snapshotProjectFilter.trim();
    const query = snapshotQuery.trim().toLowerCase();

    const rows = [...snapshots].sort((a, b) =>
      String(b.snapshot.approved_at).localeCompare(String(a.snapshot.approved_at))
    );

    return rows.filter((entry) => {
      if (projectFilter && entry.snapshot.project_id !== projectFilter) return false;
      if (!query) return true;

      const projectLabel = projectNameById.get(entry.snapshot.project_id) || "";
      const haystack = [
        entry.snapshot_id,
        entry.snapshot.project_id,
        entry.snapshot.period_id,
        entry.snapshot.approved_by,
        entry.snapshot.approved_at,
        projectLabel,
      ]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [projectNameById, snapshotProjectFilter, snapshotQuery, snapshots]);

  const coverageRows = useMemo(() => {
    const ids = new Set<string>();
    projects.forEach((project) => ids.add(project.id));
    snapshots.forEach((entry) => ids.add(entry.snapshot.project_id));
    Object.keys(periodsByProjectId).forEach((projectId) => ids.add(projectId));

    const rows = [...ids].map((projectId) => {
      const periods = periodsByProjectId[projectId] || [];
      const snapshotRows = snapshots.filter((entry) => entry.snapshot.project_id === projectId);
      const sortedSnapshots = snapshotRows
        .slice()
        .sort((a, b) => String(b.snapshot.approved_at).localeCompare(String(a.snapshot.approved_at)));
      const latest = sortedSnapshots[0] || null;

      return {
        project_id: projectId,
        project_label: projectNameById.get(projectId) || projectId,
        period_count: periods.length,
        locked_period_count: periods.filter((row) => row.status === "LOCKED").length,
        snapshot_count: snapshotRows.length,
        latest_snapshot_id: latest?.snapshot_id || null,
        latest_snapshot_at: latest?.snapshot.approved_at || null,
      };
    });

    return rows.sort((a, b) => a.project_label.localeCompare(b.project_label));
  }, [periodsByProjectId, projectNameById, projects, snapshots]);

  const timelineEvents = useMemo(() => {
    if (events.length > 0) return events;

    return snapshots.slice(0, 10).map((entry, index) => ({
      id: `${entry.snapshot_id}-${index}`,
      action: "SNAPSHOT_CREATED",
      entity_type: "snapshot",
      entity_id: entry.snapshot_id,
      actor_id: entry.snapshot.approved_by || null,
      created_at: entry.snapshot.approved_at,
    } satisfies AuditGovernanceEvent));
  }, [events, snapshots]);

  return (
    <AuditorLayout
      title="Read-only Auditor View"
      subtitle="Snapshot list untuk pemeriksaan jejak proses Evidence -> Review -> Approval -> Snapshot."
      projectLabel="All projects (snapshot list)"
      periodLabel="All periods"
    >
      <BackendStatusBanner mode={dataMode} message={backendMessage} />

      <section className="task-panel">
        <h2>Audit Coverage Summary</h2>
        <div className="task-grid-3">
          <article className="summary-card">
            <span>Projects in scope</span>
            <strong>{snapshotMetrics.total_projects}</strong>
          </article>
          <article className="summary-card">
            <span>Periods tracked</span>
            <strong>{snapshotMetrics.total_periods}</strong>
          </article>
          <article className="summary-card">
            <span>Periods locked</span>
            <strong>{snapshotMetrics.locked_periods}</strong>
          </article>
          <article className="summary-card">
            <span>Periods open</span>
            <strong>{snapshotMetrics.open_periods}</strong>
          </article>
          <article className="summary-card">
            <span>Snapshots available</span>
            <strong>{snapshotMetrics.total_snapshots}</strong>
          </article>
          {snapshotMetrics.latest_snapshot_id ? (
            <Link
              className="summary-card summary-card-action"
              href={`/audit/snapshots/${encodeURIComponent(snapshotMetrics.latest_snapshot_id)}`}
            >
              <span>Latest snapshot</span>
              <strong>{snapshotMetrics.latest_snapshot_project || "Latest snapshot"}</strong>
              <small>{formatDateText(snapshotMetrics.latest_snapshot_at)}</small>
            </Link>
          ) : (
            <article className="summary-card">
              <span>Latest snapshot</span>
              <strong>{snapshotMetrics.latest_snapshot_project || "Not yet created"}</strong>
              <small>{formatDateText(snapshotMetrics.latest_snapshot_at)}</small>
            </article>
          )}
        </div>
      </section>

      <section className="task-panel">
        <p className="inline-note">
          Mulai dari snapshot list -&gt; baca narrative trail &amp; reference ISO mapping.
        </p>
        <div className="wizard-actions admin-filter-row">
          <label>
            Project filter
            <select
              value={snapshotProjectFilter}
              onChange={(event) => setSnapshotProjectFilter(event.target.value)}
              disabled={projectFilterOptions.length === 0}
            >
              <option value="">All projects</option>
              {projectFilterOptions.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Search
            <input
              value={snapshotQuery}
              onChange={(event) => setSnapshotQuery(event.target.value)}
              placeholder="Cari snapshot_id / project / period / approver..."
            />
          </label>
        </div>
        {loading ? <p>Loading...</p> : null}
        {error ? <p className="error-box">{error}</p> : null}

        {!loading && !error && snapshots.length === 0 ? (
          <div className="empty-state">
            <p>No immutable snapshot found yet.</p>
            <p>Snapshot akan muncul setelah period mendapat keputusan <strong>APPROVE PERIOD</strong> (Role 3).</p>
            <p>Audit page tetap menampilkan coverage project/period agar status governance tetap terbaca.</p>
          </div>
        ) : null}

        {!loading && !error && snapshots.length > 0 ? (
          <div className="evidence-list">
            {visibleSnapshots.length === 0 ? (
              <div className="empty-state">
                <p>Tidak ada snapshot yang cocok dengan filter saat ini.</p>
              </div>
            ) : null}
            {visibleSnapshots.map((entry) => {
              const periodKey = `${entry.snapshot.project_id}|${entry.snapshot.period_id || ""}`;
              const periodLabel =
                (entry.snapshot.period_id
                  ? periodLabelByProjectPeriodId.get(periodKey)
                  : null) ||
                entry.snapshot.period_id ||
                NA_TEXT;

              return (
              <article className="evidence-item" key={entry.snapshot_id}>
                <p>
                  <strong>{projectNameById.get(entry.snapshot.project_id) || entry.snapshot.project_id || NA_TEXT}</strong>
                </p>
                <p>Project ID: {entry.snapshot.project_id || NA_TEXT}</p>
                <p>Period: {periodLabel}</p>
                <p>Approved at: {formatDateText(entry.snapshot.approved_at)}</p>
                <p>Approved by: {entry.snapshot.approved_by || NA_TEXT}</p>
                <div className="item-actions">
                  <Link className="revisi" href={`/audit/snapshots/${encodeURIComponent(entry.snapshot_id)}`}>
                    Open Snapshot
                  </Link>
                </div>
              </article>
            );
            })}
          </div>
        ) : null}
      </section>

      <section className="task-panel">
        <h2>Project Coverage Matrix</h2>
        <div className="admin-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Periods</th>
                <th>Locked</th>
                <th>Snapshots</th>
                <th>Latest Snapshot</th>
              </tr>
            </thead>
            <tbody>
              {coverageRows.length === 0 ? (
                <tr>
                  <td colSpan={5}>No project coverage available.</td>
                </tr>
              ) : (
                coverageRows.map((row) => (
                  <tr key={row.project_id}>
                    <td>{row.project_label}</td>
                    <td>{row.period_count}</td>
                    <td>{row.locked_period_count}</td>
                    <td>{row.snapshot_count}</td>
                    <td>
                      {row.latest_snapshot_id ? (
                        <Link href={`/audit/snapshots/${encodeURIComponent(row.latest_snapshot_id)}`}>
                          {formatDateText(row.latest_snapshot_at)}
                        </Link>
                      ) : (
                        formatDateText(row.latest_snapshot_at)
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="task-panel">
        <h2>Recent Governance Events</h2>
        <div className="admin-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Actor</th>
              </tr>
            </thead>
            <tbody>
              {timelineEvents.length === 0 ? (
                <tr>
                  <td colSpan={4}>No governance events yet.</td>
                </tr>
              ) : (
                timelineEvents.slice(0, 20).map((event) => (
                  <tr key={event.id}>
                    <td>{formatDateText(event.created_at)}</td>
                    <td>
                      {formatActionLabel(event.action)}
                      <br />
                      <small>{event.action}</small>
                    </td>
                    <td>{formatEntityLabel(event.entity_type, event.entity_id)}</td>
                    <td>{event.actor_id || NA_TEXT}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AuditorLayout>
  );
}
