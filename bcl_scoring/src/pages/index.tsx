import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { canRoleAccessPath } from "@/lib/accessControl";
import { buildApiUrl, fetchBackendHandshake, safeFetchJson, type BackendHandshakeResult } from "@/lib/http";
import { useCredential } from "@/lib/useCredential";

type ProjectRow = {
  id: string;
  code?: string | null;
  name?: string | null;
  phase?: string | null;
  is_active?: boolean | null;
};

type PeriodRow = {
  id: string;
  project_id: string;
  year: number;
  week: number;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  version?: number | null;
};

type BundlePerspectiveItem = {
  perspective_id: string;
  score: number;
  weight: number;
  weighted_score: number;
};

type BundleCard = {
  id: string;
  title?: string;
  value?: number | string;
  meta?: Record<string, unknown>;
  items?: BundlePerspectiveItem[];
};

type BundleData = {
  header?: {
    project_id?: string;
    period?: {
      year?: number;
      week?: number;
    };
  };
  cards?: BundleCard[];
};

type IndicatorScoreRow = {
  indicator_id: string;
  code: string;
  title: string;
  score: number | null;
  is_scored: boolean;
};

type AttentionItem = {
  perspectiveId: string;
  perspectiveTitle: string;
  title: string;
  score: number | null;
  statusLabel: string;
  updatedLabel: string;
  priorityRank: number;
};

const PERSPECTIVES = [
  { id: "P1", title: "Governance & Strategy", weight: 15 },
  { id: "P2", title: "Process & Workflow", weight: 30 },
  { id: "P3", title: "Information & Model Quality", weight: 20 },
  { id: "P4", title: "People & Capability", weight: 15 },
  { id: "P5", title: "Value, Impact & Risk Reduction", weight: 20 },
] as const;

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asText(value: unknown, fallback = "N/A"): string {
  if (typeof value === "string" && value.trim()) return value;
  return fallback;
}

function formatDelta(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

function formatWeekLabel(period: PeriodRow | null): string {
  if (!period) return "N/A";
  return `Y${period.year} W${period.week}`;
}

function formatTimestamp(nowIso: string): string {
  const parsed = new Date(nowIso);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleString();
}

function toApiErrorMessage(path: string, failure: { kind: string; status?: number; error?: string }): string {
  if (failure.kind === "backend_unavailable") {
    return `Backend not available for ${path}: ${failure.error || "connection failed"}`;
  }
  if (failure.kind === "http_error") {
    return `HTTP ${failure.status || 500} for ${path}: ${failure.error || "request failed"}`;
  }
  return `Invalid payload for ${path}: ${failure.error || "parse error"}`;
}

async function fetchEnvelope<T>(path: string): Promise<T> {
  const result = await safeFetchJson<unknown>(buildApiUrl(path));
  if (!result.ok) {
    throw new Error(toApiErrorMessage(path, result));
  }

  const payload = result.data;
  if (payload && typeof payload === "object") {
    const root = payload as Record<string, unknown>;
    if (root.ok === false) {
      const message = (root.error && typeof root.error === "object")
        ? asText((root.error as Record<string, unknown>).message)
        : asText(root.error);
      throw new Error(`API rejected ${path}: ${message}`);
    }
    if (Object.prototype.hasOwnProperty.call(root, "data")) {
      return root.data as T;
    }
  }

  return payload as T;
}

async function fetchBundle(projectId: string, year: number, week: number): Promise<BundleData> {
  const query = new URLSearchParams({
    project_id: projectId,
    year: String(year),
    week: String(week),
    trend_granularity: "month",
    audit: "true",
  });
  return await fetchEnvelope<BundleData>(`/summary/v2/bcl/dashboard?${query.toString()}`);
}

async function fetchIndicatorScoresForPerspective(
  projectId: string,
  periodId: string,
  perspectiveId: string
): Promise<IndicatorScoreRow[]> {
  const query = new URLSearchParams({ perspective_id: perspectiveId });
  return await fetchEnvelope<IndicatorScoreRow[]>(
    `/projects/${encodeURIComponent(projectId)}/periods/${encodeURIComponent(periodId)}/indicator-scores?${query.toString()}`
  );
}

export default function Home() {
  const credential = useCredential();
  const [backend, setBackend] = useState<BackendHandshakeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");

  const [bundle, setBundle] = useState<BundleData | null>(null);
  const [indicatorScores, setIndicatorScores] = useState<IndicatorScoreRow[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>("");

  const selectedProject = useMemo(
    () => projects.find((item) => item.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );
  const selectedPeriod = useMemo(
    () => periods.find((item) => item.id === selectedPeriodId) || null,
    [periods, selectedPeriodId]
  );

  const cards = useMemo(() => (Array.isArray(bundle?.cards) ? bundle!.cards! : []), [bundle]);

  const scoreCard = useMemo(() => cards.find((item) => item.id === "score") || null, [cards]);
  const weeklyTrendCard = useMemo(() => cards.find((item) => item.id === "trend") || null, [cards]);
  const monthlyTrendCard = useMemo(() => cards.find((item) => item.id === "trend_monthly") || null, [cards]);
  const alertsCard = useMemo(() => cards.find((item) => item.id === "alerts") || null, [cards]);
  const perspectiveCard = useMemo(() => cards.find((item) => item.id === "perspectives") || null, [cards]);

  const scoreValue = asNumber(scoreCard?.value);
  const weeklyDelta = asNumber(weeklyTrendCard?.value);
  const monthlyDelta = asNumber(monthlyTrendCard?.value);
  const alertsCount = asNumber(alertsCard?.value);

  const perspectiveRows = useMemo(() => {
    const fromBundle = Array.isArray(perspectiveCard?.items) ? perspectiveCard.items : [];
    const byId = new Map(fromBundle.map((item) => [item.perspective_id, item]));

    return PERSPECTIVES.map((meta) => {
      const hit = byId.get(meta.id);
      const score = asNumber(hit?.score, 0);
      const weighted = asNumber(hit?.weighted_score, 0);
      const state = score < 2.5 ? "Attention" : score < 4 ? "Watch" : "Healthy";
      return {
        perspectiveId: meta.id,
        title: meta.title,
        weight: meta.weight,
        score,
        weighted,
        state,
      };
    });
  }, [perspectiveCard]);

  const inputCoverage = useMemo(() => {
    const total = indicatorScores.length;
    const scored = indicatorScores.filter((item) => item.is_scored).length;
    const percent = total > 0 ? Math.round((scored / total) * 100) : 0;
    return { total, scored, percent };
  }, [indicatorScores]);

  const priorityIndicators = useMemo<AttentionItem[]>(() => {
    if (indicatorScores.length === 0) return [];

    const perspectiveTitleMap = new Map<string, string>(PERSPECTIVES.map((item) => [item.id, item.title]));

    return indicatorScores
      .map((item) => {
        const parts = String(item.code || "").split("-");
        const perspectiveId = parts[0] || "N/A";
        const perspectiveTitle = perspectiveTitleMap.get(perspectiveId) || perspectiveId;

        if (!item.is_scored) {
          return {
            perspectiveId,
            perspectiveTitle,
            title: item.title || "Indicator without title",
            score: null,
            statusLabel: "Pending input",
            updatedLabel: "Needs BIM Coordinator Project input",
            priorityRank: 0,
          };
        }

        const score = asNumber(item.score, 0);
        if (score < 3) {
          return {
            perspectiveId,
            perspectiveTitle,
            title: item.title || "Indicator without title",
            score,
            statusLabel: "High attention",
            updatedLabel: "Low score",
            priorityRank: 1,
          };
        }

        if (score < 4) {
          return {
            perspectiveId,
            perspectiveTitle,
            title: item.title || "Indicator without title",
            score,
            statusLabel: "Moderate",
            updatedLabel: "Need improvement",
            priorityRank: 2,
          };
        }

        return {
          perspectiveId,
          perspectiveTitle,
          title: item.title || "Indicator without title",
          score,
          statusLabel: "Healthy",
          updatedLabel: "Stable",
          priorityRank: 3,
        };
      })
      .sort((a, b) => {
        if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
        return a.perspectiveId.localeCompare(b.perspectiveId) || a.title.localeCompare(b.title);
      })
      .slice(0, 10);
  }, [indicatorScores]);

  const workflowReadiness = useMemo(() => {
    const role1Text = `${inputCoverage.scored}/${inputCoverage.total} indicators scored`;
    const role2Ready = inputCoverage.total > 0 && inputCoverage.scored === inputCoverage.total;
    const role3Ready = role2Ready && alertsCount === 0;

    return {
      role1: role1Text,
      role2: role2Ready ? "Ready for HO review" : "Waiting BIM Coordinator Project completion",
      role3: role3Ready ? "Candidate for approval" : "Pending review/alerts",
    };
  }, [alertsCount, inputCoverage]);

  const canAccessRole1 = canRoleAccessPath(credential.role, "/projects");
  const canAccessRole2 = canRoleAccessPath(credential.role, "/ho/review");
  const canAccessRole3 = canRoleAccessPath(credential.role, "/approve");
  const canAccessAudit = canRoleAccessPath(credential.role, "/audit");
  const canAccessAdmin = canRoleAccessPath(credential.role, "/admin");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const handshake = await fetchBackendHandshake(true);
        if (cancelled) return;
        setBackend(handshake);

        const projectRows = await fetchEnvelope<ProjectRow[]>("/projects");
        if (cancelled) return;

        const safeRows = Array.isArray(projectRows) ? projectRows : [];
        setProjects(safeRows);

        if (safeRows.length === 0) {
          setSelectedProjectId("");
          setPeriods([]);
          setSelectedPeriodId("");
          setBundle(null);
          setIndicatorScores([]);
          return;
        }

        setSelectedProjectId((prev) => prev || safeRows[0].id);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load desktop dashboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    let cancelled = false;

    (async () => {
      setError(null);
      try {
        const rows = await fetchEnvelope<PeriodRow[]>(`/projects/${encodeURIComponent(selectedProjectId)}/periods`);
        if (cancelled) return;
        const safeRows = Array.isArray(rows) ? rows : [];
        setPeriods(safeRows);

        if (safeRows.length === 0) {
          setSelectedPeriodId("");
          setBundle(null);
          setIndicatorScores([]);
          return;
        }

        setSelectedPeriodId((prev) => {
          if (prev && safeRows.some((period) => period.id === prev)) return prev;
          return safeRows[0].id;
        });
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load scoring periods.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || !selectedPeriodId) return;
    const period = periods.find((item) => item.id === selectedPeriodId);
    if (!period) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const bundleData = await fetchBundle(selectedProjectId, period.year, period.week);

        const perspectiveScores = await Promise.all(
          PERSPECTIVES.map((item) =>
            fetchIndicatorScoresForPerspective(selectedProjectId, selectedPeriodId, item.id)
              .catch(() => [])
          )
        );

        if (cancelled) return;
        setBundle(bundleData);
        setIndicatorScores(perspectiveScores.flat());
        setLastSyncedAt(new Date().toISOString());
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load dashboard bundle.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [periods, selectedPeriodId, selectedProjectId]);

  const backendStatusText = backend
    ? backend.status === "available"
      ? `Connected (${backend.service})`
      : `Unavailable (${backend.message || "no message"})`
    : "Checking backend...";

  return (
    <>
      <Head>
        <title>BIM Scoring Desktop</title>
      </Head>

      <main className="task-shell landing-shell">
        <header className="task-header landing-hero">
          <p className="task-kicker">BIM Scoring Platform</p>
          <h1>Desktop</h1>
          <p className="task-subtitle">
            Dashboard utama BIM Scoring untuk monitoring weekly score, perspektif P1-P5, dan readiness workflow.
          </p>

          <div className="landing-chip-row">
            <span className={`status-chip ${backend?.status === "available" ? "status-open" : "status-lock"}`}>
              {backendStatusText}
            </span>
            <span className="status-chip status-na">Last sync: {formatTimestamp(lastSyncedAt)}</span>
          </div>

        </header>

        {error && <p className="error-box">{error}</p>}

        <section className="task-panel desktop-filter-panel">
          <h2>Project Context</h2>
          <div className="field-grid desktop-filter-grid">
            <label>
              Workspace Project
              <select
                value={selectedProjectId}
                onChange={(event) => setSelectedProjectId(event.target.value)}
                disabled={loading || projects.length === 0}
              >
                {projects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {asText(item.name, "Workspace tanpa nama")}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Periode Mingguan
              <select
                value={selectedPeriodId}
                onChange={(event) => setSelectedPeriodId(event.target.value)}
                disabled={loading || periods.length === 0}
              >
                {periods.map((item) => (
                  <option key={item.id} value={item.id}>
                    {formatWeekLabel(item)}
                  </option>
                ))}
              </select>
            </label>

            <div className="desktop-context-block">
              <span>Phase</span>
              <strong>{asText(selectedProject?.phase, "N/A")}</strong>
            </div>

            <div className="desktop-context-block">
              <span>Project Status</span>
              <strong>{selectedProject?.is_active === false ? "Inactive" : "Active"}</strong>
            </div>

            <div className="desktop-context-block">
              <span>Active Period</span>
              <strong>{selectedPeriod ? formatWeekLabel(selectedPeriod) : "N/A"}</strong>
            </div>

            <div className="desktop-context-block">
              <span>Period Status</span>
              <strong>{asText(selectedPeriod?.status, "N/A")}</strong>
            </div>
          </div>
          {periods.length === 0 ? (
            <p className="inline-note">
              Project ini belum memiliki scoring period. Tambahkan period lewat{" "}
              {canAccessAdmin ? <Link href="/admin">Admin Control Panel</Link> : "Admin Control Panel"}.
            </p>
          ) : null}
        </section>

        <section className="task-panel">
          <h2>Weekly KPI Summary</h2>
          <div className="task-grid-3">
            <article className="summary-card">
              <span>Weekly BIM Score</span>
              <strong>{scoreValue.toFixed(2)}</strong>
            </article>
            <article className="summary-card">
              <span>Input Coverage</span>
              <strong>{inputCoverage.percent}%</strong>
              <small>{inputCoverage.scored}/{inputCoverage.total} indikator terisi</small>
            </article>
            <article className="summary-card">
              <span>Trend Weekly</span>
              <strong>{formatDelta(weeklyDelta)}</strong>
            </article>
            <article className="summary-card">
              <span>Trend Monthly</span>
              <strong>{formatDelta(monthlyDelta)}</strong>
            </article>
            <article className="summary-card">
              <span>Open Alerts</span>
              <strong>{alertsCount}</strong>
            </article>
          </div>
        </section>

        <section className="task-panel">
          <h2>Perspective Performance (P1-P5)</h2>
          <div className="desktop-perspective-grid">
            {perspectiveRows.map((item) => (
              <article key={item.perspectiveId} className="desktop-perspective-card">
                <p className="desktop-perspective-title">{item.title}</p>
                <p className="desktop-perspective-meta">Bobot organisasi: {item.weight}%</p>
                <p className="desktop-perspective-score">Skor: {item.score.toFixed(2)} / 5</p>
                <p className="desktop-perspective-meta">Kontribusi weighted: {item.weighted.toFixed(2)}</p>
                <span className="status-chip status-na">{item.state}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="task-panel">
          <h2>Priority Indicators</h2>
          <div className="admin-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Perspective</th>
                  <th>Indikator</th>
                  <th>Status</th>
                  <th>Skor</th>
                  <th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {priorityIndicators.length === 0 && (
                  <tr>
                    <td colSpan={5}>Belum ada indikator prioritas untuk periode ini.</td>
                  </tr>
                )}
                {priorityIndicators.map((item, index) => (
                  <tr key={`${item.perspectiveId}-${item.title}-${index}`}>
                    <td>{item.perspectiveTitle}</td>
                    <td>{item.title}</td>
                    <td>{item.statusLabel}</td>
                    <td>{item.score === null ? "N/A" : item.score.toFixed(2)}</td>
                    <td>{item.updatedLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="task-panel">
          <h2>Workflow Readiness</h2>
          <div className="landing-grid">
            <article className="landing-card">
              <span>BIM Coordinator Project</span>
              <strong>{workflowReadiness.role1}</strong>
              {canAccessRole1 ? (
                <Link href="/projects">Open Workspace</Link>
              ) : (
                <small>Read-only visibility only</small>
              )}
            </article>
            <article className="landing-card">
              <span>BIM Coordinator HO</span>
              <strong>{workflowReadiness.role2}</strong>
              {canAccessRole2 ? (
                <Link href="/ho/review">Open Workspace</Link>
              ) : (
                <small>Read-only visibility only</small>
              )}
            </article>
            <article className="landing-card">
              <span>BIM Manager</span>
              <strong>{workflowReadiness.role3}</strong>
              {canAccessRole3 ? (
                <Link href="/approve">Open Workspace</Link>
              ) : (
                <small>Read-only visibility only</small>
              )}
            </article>
          </div>
        </section>

        <section className="task-panel">
          <h2>Governance Snapshot</h2>
          <p className="inline-note">
            Config lock dan audit detail berada pada domain Admin. Desktop ini hanya menampilkan read-only snapshot.
          </p>
          <div className="wizard-actions">
            {canAccessAdmin ? <Link href="/admin">Open Admin Control</Link> : null}
            {canAccessAudit ? <Link href="/audit">Open Audit Trail</Link> : <span>Audit read-only unavailable</span>}
          </div>
        </section>
      </main>
    </>
  );
}
