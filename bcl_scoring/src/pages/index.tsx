import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { canRoleAccessPath } from "@/lib/accessControl";
import {
  buildApiUrl,
  fetchBackendHandshake,
  safeFetchJson,
  toUserFacingErrorMessage,
  toUserFacingSafeFetchError,
  type BackendHandshakeResult,
  type SafeFetchFail,
} from "@/lib/http";
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

type PerspectiveAnalyticsRow = {
  perspectiveId: string;
  title: string;
  weight: number;
  score: number;
  weighted: number;
  state: string;
  scorePercent: number;
  totalIndicators: number;
  scoredIndicators: number;
  pendingIndicators: number;
  lowIndicators: number;
  moderateIndicators: number;
  healthyIndicators: number;
  coveragePercent: number;
  averageIndicatorScore: number | null;
  riskLabel: "High risk" | "Watch" | "Healthy";
};

type PerspectiveIndicatorDetail = {
  indicatorId: string;
  code: string;
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

function perspectiveIdFromCode(code: string): string {
  const parts = String(code || "").split("-");
  return parts[0] || "N/A";
}

function classifyIndicator(item: IndicatorScoreRow): AttentionItem {
  const perspectiveId = perspectiveIdFromCode(item.code);
  const perspectiveTitle = PERSPECTIVES.find((row) => row.id === perspectiveId)?.title || perspectiveId;

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
}

function formatScoreLevel(score: number): string {
  if (score < 2.5) return "Critical";
  if (score < 3.5) return "Needs Improvement";
  if (score < 4.5) return "Good";
  return "Excellent";
}

function toPercent(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, (part / total) * 100));
}

function toApiErrorMessage(_path: string, failure: SafeFetchFail): string {
  if (
    failure.kind === "backend_unavailable" ||
    failure.kind === "http_error" ||
    failure.kind === "parse_error"
  ) {
    return toUserFacingSafeFetchError(failure, "Gagal memuat data dashboard.");
  }
  return toUserFacingErrorMessage(failure.error, "Gagal memuat data dashboard.");
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
  const [activePerspectiveId, setActivePerspectiveId] = useState<string | null>(null);

  const selectedProject = useMemo(
    () => projects.find((item) => item.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );
  const selectedPeriod = useMemo(
    () => periods.find((item) => item.id === selectedPeriodId) || null,
    [periods, selectedPeriodId]
  );
  const selectedPeriodYear = selectedPeriod?.year ?? null;
  const selectedPeriodWeek = selectedPeriod?.week ?? null;

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

  const perspectiveAnalytics = useMemo<PerspectiveAnalyticsRow[]>(() => {
    const indicatorStats = new Map<
      string,
      {
        total: number;
        scored: number;
        pending: number;
        low: number;
        moderate: number;
        healthy: number;
        scoreSum: number;
      }
    >();

    for (const perspective of PERSPECTIVES) {
      indicatorStats.set(perspective.id, {
        total: 0,
        scored: 0,
        pending: 0,
        low: 0,
        moderate: 0,
        healthy: 0,
        scoreSum: 0,
      });
    }

    for (const item of indicatorScores) {
      const perspectiveId = perspectiveIdFromCode(item.code);
      const stat = indicatorStats.get(perspectiveId);
      if (!stat) continue;

      stat.total += 1;
      if (!item.is_scored) {
        stat.pending += 1;
        continue;
      }

      stat.scored += 1;
      const score = asNumber(item.score, 0);
      stat.scoreSum += score;

      if (score < 3) {
        stat.low += 1;
      } else if (score < 4) {
        stat.moderate += 1;
      } else {
        stat.healthy += 1;
      }
    }

    return perspectiveRows
      .map((row) => {
        const stat = indicatorStats.get(row.perspectiveId) || {
          total: 0,
          scored: 0,
          pending: 0,
          low: 0,
          moderate: 0,
          healthy: 0,
          scoreSum: 0,
        };

        const coveragePercent = stat.total > 0 ? Math.round((stat.scored / stat.total) * 100) : 0;
        const averageIndicatorScore = stat.scored > 0 ? stat.scoreSum / stat.scored : null;
        const scorePercent = Math.max(0, Math.min(100, Math.round((row.score / 5) * 100)));
        const riskLabel: PerspectiveAnalyticsRow["riskLabel"] =
          row.score < 2.5 || coveragePercent < 60
            ? "High risk"
            : row.score < 4 || coveragePercent < 85
              ? "Watch"
              : "Healthy";

        return {
          ...row,
          scorePercent,
          totalIndicators: stat.total,
          scoredIndicators: stat.scored,
          pendingIndicators: stat.pending,
          lowIndicators: stat.low,
          moderateIndicators: stat.moderate,
          healthyIndicators: stat.healthy,
          coveragePercent,
          averageIndicatorScore,
          riskLabel,
        };
      })
      .sort((a, b) => b.score - a.score || a.perspectiveId.localeCompare(b.perspectiveId));
  }, [indicatorScores, perspectiveRows]);

  const inputCoverage = useMemo(() => {
    const total = indicatorScores.length;
    const scored = indicatorScores.filter((item) => item.is_scored).length;
    const percent = total > 0 ? Math.round((scored / total) * 100) : 0;
    return { total, scored, percent };
  }, [indicatorScores]);

  const priorityIndicators = useMemo<AttentionItem[]>(() => {
    if (indicatorScores.length === 0) return [];
    return indicatorScores
      .map((item) => classifyIndicator(item))
      .sort((a, b) => {
        if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
        return a.perspectiveId.localeCompare(b.perspectiveId) || a.title.localeCompare(b.title);
      })
      .slice(0, 10);
  }, [indicatorScores]);

  const activePerspective = useMemo(
    () => perspectiveAnalytics.find((item) => item.perspectiveId === activePerspectiveId) || null,
    [activePerspectiveId, perspectiveAnalytics]
  );

  const activePerspectiveIndicators = useMemo<PerspectiveIndicatorDetail[]>(() => {
    if (!activePerspectiveId) return [];

    return indicatorScores
      .reduce<PerspectiveIndicatorDetail[]>((acc, item) => {
        const insight = classifyIndicator(item);
        if (insight.perspectiveId !== activePerspectiveId) return acc;
        acc.push({
          indicatorId: item.indicator_id,
          code: asText(item.code),
          title: asText(item.title, "Indicator without title"),
          score: item.is_scored ? asNumber(item.score, 0) : null,
          statusLabel: insight.statusLabel,
          updatedLabel: insight.updatedLabel,
          priorityRank: insight.priorityRank,
        });
        return acc;
      }, [])
      .sort((a, b) => a.priorityRank - b.priorityRank || a.code.localeCompare(b.code))
      .slice(0, 12);
  }, [activePerspectiveId, indicatorScores]);

  const topPerspective = useMemo(() => perspectiveAnalytics[0] || null, [perspectiveAnalytics]);
  const lowestPerspective = useMemo(
    () => perspectiveAnalytics[perspectiveAnalytics.length - 1] || null,
    [perspectiveAnalytics]
  );

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

  const handleProjectChange = (nextProjectId: string) => {
    setSelectedProjectId(nextProjectId);
    setSelectedPeriodId("");
    setPeriods([]);
    setBundle(null);
    setIndicatorScores([]);
    setLastSyncedAt("");
  };

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
        setError(toUserFacingErrorMessage(e, "Gagal memuat dashboard desktop."));
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
        setError(toUserFacingErrorMessage(e, "Gagal memuat scoring period."));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || !selectedPeriodId) return;
    const year = asNumber(selectedPeriodYear, Number.NaN);
    const week = asNumber(selectedPeriodWeek, Number.NaN);
    if (!Number.isFinite(year) || !Number.isFinite(week)) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const bundleData = await fetchBundle(selectedProjectId, year, week);

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
        setError(toUserFacingErrorMessage(e, "Gagal memuat ringkasan dashboard."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, selectedPeriodId, selectedPeriodYear, selectedPeriodWeek]);

  useEffect(() => {
    setActivePerspectiveId(null);
  }, [selectedProjectId, selectedPeriodId]);

  useEffect(() => {
    if (!activePerspectiveId) return;
    if (perspectiveAnalytics.some((item) => item.perspectiveId === activePerspectiveId)) return;
    setActivePerspectiveId(null);
  }, [activePerspectiveId, perspectiveAnalytics]);

  useEffect(() => {
    if (!activePerspectiveId) return;

    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActivePerspectiveId(null);
      }
    };

    window.addEventListener("keydown", onKeydown);
    return () => {
      window.removeEventListener("keydown", onKeydown);
    };
  }, [activePerspectiveId]);

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
          <div className="desktop-hero-layout">
            <div className="desktop-hero-main">
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
            </div>

            <aside className="desktop-header-context">
              <div className="field-grid desktop-filter-grid desktop-filter-grid-compact">
                <label>
                  Workspace Project
                  <select
                    value={selectedProjectId}
                    onChange={(event) => handleProjectChange(event.target.value)}
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
              </div>

              <div className="desktop-context-chip-row">
                <span className="desktop-context-chip">Code: <strong>{asText(selectedProject?.code, "N/A")}</strong></span>
                <span className="desktop-context-chip">
                  Phase: <strong>{asText(selectedProject?.phase, "N/A")}</strong>
                </span>
                <span className="desktop-context-chip">
                  Project Status: <strong>{selectedProject?.is_active === false ? "Inactive" : "Active"}</strong>
                </span>
                <span className="desktop-context-chip">
                  Active Period: <strong>{selectedPeriod ? formatWeekLabel(selectedPeriod) : (selectedProjectId ? "Loading..." : "N/A")}</strong>
                </span>
                <span className="desktop-context-chip">
                  Period Status: <strong>{selectedPeriod ? asText(selectedPeriod?.status, "N/A") : (selectedProjectId ? "Loading..." : "N/A")}</strong>
                </span>
              </div>

              {periods.length === 0 ? (
                <p className="inline-note">
                  Project ini belum memiliki scoring period. Tambahkan period lewat{" "}
                  {canAccessAdmin ? <Link href="/admin">Admin Control Panel</Link> : "Admin Control Panel"}.
                </p>
              ) : null}
            </aside>
          </div>

        </header>

        {error && <p className="error-box">{error}</p>}

        <section className="task-panel">
          <h2>Weekly KPI Summary</h2>
          <div className="task-grid-3">
            <article className="summary-card">
              <span>Weekly BIM Score</span>
              <strong>{scoreValue.toFixed(2)}</strong>
              <small>{formatScoreLevel(scoreValue)}</small>
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
            <article className="summary-card">
              <span>Top Perspective</span>
              <strong>{topPerspective ? `${topPerspective.perspectiveId} (${topPerspective.score.toFixed(2)})` : "N/A"}</strong>
            </article>
            <article className="summary-card">
              <span>Lowest Perspective</span>
              <strong>
                {lowestPerspective ? `${lowestPerspective.perspectiveId} (${lowestPerspective.score.toFixed(2)})` : "N/A"}
              </strong>
            </article>
          </div>
        </section>

        <section className="task-panel">
          <h2>Score Analytics</h2>
          <p className="inline-note">Klik bar chart perspektif untuk membuka drawer insight detail.</p>
          <div className="desktop-analytics-grid">
            <div className="desktop-chart-list">
              {perspectiveAnalytics.map((item) => {
                const toneClass =
                  item.riskLabel === "High risk"
                    ? "desktop-tone-risk"
                    : item.riskLabel === "Watch"
                      ? "desktop-tone-watch"
                      : "desktop-tone-healthy";

                return (
                  <button
                    key={item.perspectiveId}
                    type="button"
                    className={`desktop-chart-row ${activePerspectiveId === item.perspectiveId ? "is-active" : ""}`}
                    onClick={() => setActivePerspectiveId(item.perspectiveId)}
                    aria-expanded={activePerspectiveId === item.perspectiveId}
                    aria-controls={activePerspectiveId === item.perspectiveId ? "desktop-perspective-drawer" : undefined}
                  >
                    <span className="desktop-chart-label">
                      <strong>{item.perspectiveId}</strong>
                      <small>{item.title}</small>
                    </span>
                    <span className="desktop-chart-track">
                      <span className={`desktop-chart-fill ${toneClass}`} style={{ width: `${item.scorePercent}%` }} />
                    </span>
                    <span className="desktop-chart-value">
                      {item.score.toFixed(2)}
                      <small>/ 5.00</small>
                    </span>
                  </button>
                );
              })}
            </div>

            <aside className="desktop-analytics-side">
              <article className="desktop-insight-card">
                <span>Strongest Perspective</span>
                <strong>{topPerspective ? `${topPerspective.title} (${topPerspective.perspectiveId})` : "N/A"}</strong>
                <small>
                  {topPerspective
                    ? `Score ${topPerspective.score.toFixed(2)} | Coverage ${topPerspective.coveragePercent}%`
                    : "Belum ada data"}
                </small>
              </article>
              <article className="desktop-insight-card">
                <span>Needs Intervention</span>
                <strong>{lowestPerspective ? `${lowestPerspective.title} (${lowestPerspective.perspectiveId})` : "N/A"}</strong>
                <small>
                  {lowestPerspective
                    ? `Score ${lowestPerspective.score.toFixed(2)} | Pending ${lowestPerspective.pendingIndicators}`
                    : "Belum ada data"}
                </small>
              </article>
              <article className="desktop-insight-card">
                <span>Coverage Readiness</span>
                <strong>{inputCoverage.percent}%</strong>
                <small>{inputCoverage.scored} dari {inputCoverage.total} indikator sudah dinilai</small>
              </article>
            </aside>
          </div>

          <div className="desktop-coverage-chart">
            <div className="desktop-coverage-head">
              <h3>Indicator Coverage Distribution (Stacked)</h3>
              <p>Klik row untuk membuka drawer perspective insight.</p>
            </div>
            <div className="desktop-coverage-legend">
              <span className="desktop-legend-item">
                <i className="desktop-legend-swatch pending" /> Pending
              </span>
              <span className="desktop-legend-item">
                <i className="desktop-legend-swatch low" /> Low (&lt;3)
              </span>
              <span className="desktop-legend-item">
                <i className="desktop-legend-swatch moderate" /> Moderate (3-4)
              </span>
              <span className="desktop-legend-item">
                <i className="desktop-legend-swatch healthy" /> Healthy (4-5)
              </span>
            </div>
            <div className="desktop-coverage-list">
              {perspectiveAnalytics.map((item) => {
                const totalIndicators = item.totalIndicators;
                const pendingPercent = toPercent(item.pendingIndicators, totalIndicators);
                const lowPercent = toPercent(item.lowIndicators, totalIndicators);
                const moderatePercent = toPercent(item.moderateIndicators, totalIndicators);
                const healthyPercent = toPercent(item.healthyIndicators, totalIndicators);

                return (
                  <button
                    key={`coverage-${item.perspectiveId}`}
                    type="button"
                    className={`desktop-coverage-row ${activePerspectiveId === item.perspectiveId ? "is-active" : ""}`}
                    onClick={() => setActivePerspectiveId(item.perspectiveId)}
                  >
                    <span className="desktop-coverage-label">
                      <strong>{item.perspectiveId}</strong>
                      <small>{item.title}</small>
                    </span>
                    <span className="desktop-coverage-stack">
                      {totalIndicators === 0 ? (
                        <span className="desktop-coverage-empty">No indicators</span>
                      ) : (
                        <>
                          <span className="desktop-coverage-segment pending" style={{ width: `${pendingPercent}%` }} />
                          <span className="desktop-coverage-segment low" style={{ width: `${lowPercent}%` }} />
                          <span className="desktop-coverage-segment moderate" style={{ width: `${moderatePercent}%` }} />
                          <span className="desktop-coverage-segment healthy" style={{ width: `${healthyPercent}%` }} />
                        </>
                      )}
                    </span>
                    <span className="desktop-coverage-summary">
                      {item.scoredIndicators}/{totalIndicators} scored
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="task-panel">
          <h2>Perspective Performance (P1-P5)</h2>
          <div className="desktop-perspective-grid">
            {perspectiveAnalytics.map((item) => (
              <article key={item.perspectiveId} className="desktop-perspective-card">
                <p className="desktop-perspective-title">{item.title}</p>
                <p className="desktop-perspective-meta">Bobot organisasi: {item.weight}%</p>
                <p className="desktop-perspective-score">Skor: {item.score.toFixed(2)} / 5</p>
                <p className="desktop-perspective-meta">Kontribusi weighted: {item.weighted.toFixed(2)}</p>
                <p className="desktop-perspective-meta">
                  Indicator coverage: {item.scoredIndicators}/{item.totalIndicators} ({item.coveragePercent}%)
                </p>
                <p className="desktop-perspective-meta">
                  Risk posture: {item.riskLabel}
                </p>
                <div className="item-actions">
                  <button type="button" onClick={() => setActivePerspectiveId(item.perspectiveId)}>
                    Open Insight
                  </button>
                </div>
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

      {activePerspective ? (
        <div className="desktop-drawer-overlay" onClick={() => setActivePerspectiveId(null)}>
          <aside
            id="desktop-perspective-drawer"
            className="desktop-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="desktop-drawer-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="desktop-drawer-head">
              <div>
                <p className="task-kicker">Desktop Insight</p>
                <h2 id="desktop-drawer-title">
                  {activePerspective.perspectiveId} - {activePerspective.title}
                </h2>
              </div>
              <button type="button" onClick={() => setActivePerspectiveId(null)} aria-label="Close drawer">
                Close
              </button>
            </header>

            <div className="desktop-drawer-body">
              <section className="desktop-drawer-stat-grid">
                <article className="desktop-insight-card">
                  <span>Perspective Score</span>
                  <strong>{activePerspective.score.toFixed(2)} / 5.00</strong>
                  <small>Weighted contribution: {activePerspective.weighted.toFixed(2)}</small>
                </article>
                <article className="desktop-insight-card">
                  <span>Indicator Coverage</span>
                  <strong>{activePerspective.coveragePercent}%</strong>
                  <small>
                    {activePerspective.scoredIndicators}/{activePerspective.totalIndicators} indikator sudah dinilai
                  </small>
                </article>
                <article className="desktop-insight-card">
                  <span>Risk Posture</span>
                  <strong>{activePerspective.riskLabel}</strong>
                  <small>
                    Pending: {activePerspective.pendingIndicators} | Low score: {activePerspective.lowIndicators}
                  </small>
                </article>
              </section>

              <section className="task-panel desktop-drawer-panel">
                <h3>Indicator Status Mix</h3>
                <div className="desktop-status-mix">
                  <div className="desktop-status-chip">Pending input: {activePerspective.pendingIndicators}</div>
                  <div className="desktop-status-chip">Low score (&lt;3): {activePerspective.lowIndicators}</div>
                  <div className="desktop-status-chip">Moderate (3-4): {activePerspective.moderateIndicators}</div>
                  <div className="desktop-status-chip">Healthy (4-5): {activePerspective.healthyIndicators}</div>
                </div>
              </section>

              <section className="task-panel desktop-drawer-panel">
                <h3>Priority Indicators for {activePerspective.perspectiveId}</h3>
                <div className="admin-table-wrap">
                  <table className="audit-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Indicator</th>
                        <th>Status</th>
                        <th>Score</th>
                        <th>Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePerspectiveIndicators.length === 0 ? (
                        <tr>
                          <td colSpan={5}>Belum ada indikator terdaftar pada perspektif ini.</td>
                        </tr>
                      ) : (
                        activePerspectiveIndicators.map((item) => (
                          <tr key={item.indicatorId}>
                            <td>{item.code}</td>
                            <td>{item.title}</td>
                            <td>{item.statusLabel}</td>
                            <td>{item.score === null ? "N/A" : item.score.toFixed(2)}</td>
                            <td>{item.updatedLabel}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="wizard-actions">
                {canAccessRole1 ? <Link href="/projects">Open Evidence Workspace</Link> : null}
                {canAccessAudit ? <Link href="/audit">Open Audit Trail</Link> : null}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
