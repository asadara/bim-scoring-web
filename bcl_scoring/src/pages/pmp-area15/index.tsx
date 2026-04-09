import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import CorporateTopbar from "@/components/CorporateTopbar";
import HeaderContextCard from "@/components/HeaderContextCard";
import PmpArea15CompliancePanel from "@/components/PmpArea15CompliancePanel";
import QuickAccessNav from "@/components/QuickAccessNav";
import { fetchReadOnlySummaryReadMode, type PmpArea15ComplianceSummary } from "@/lib/approverTaskLayer";
import { canRoleAccessPath } from "@/lib/accessControl";
import {
  NA_TEXT,
  fetchProjectPeriodsReadMode,
  fetchProjectsReadMode,
  formatPeriodLabel,
  selectActivePeriod,
  type DataMode,
  type ProjectRecord,
  type ScoringPeriod,
} from "@/lib/role1TaskLayer";
import { useCredential } from "@/lib/useCredential";

function sortProjects(rows: ProjectRecord[]): ProjectRecord[] {
  return [...rows].sort((a, b) =>
    String(a.name || a.code || a.id).localeCompare(String(b.name || b.code || b.id))
  );
}

function pickInitialProject(rows: ProjectRecord[], scopedProjectIds: string[]): ProjectRecord | null {
  if (!rows.length) return null;
  const scoped = rows.find((item) => scopedProjectIds.includes(item.id));
  if (scoped) return scoped;
  const active = rows.find((item) => item.is_active !== false);
  return active || rows[0] || null;
}

function pickInitialPeriod(rows: ScoringPeriod[]): ScoringPeriod | null {
  return selectActivePeriod(rows) || rows[0] || null;
}

export default function PmpArea15LandingPage() {
  const credential = useCredential();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [periods, setPeriods] = useState<ScoringPeriod[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [summary, setSummary] = useState<PmpArea15ComplianceSummary | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [dataMode, setDataMode] = useState<DataMode>("backend");
  const [backendMessage, setBackendMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scopedProjectIds = useMemo(
    () =>
      Array.isArray(credential.scoped_project_ids)
        ? credential.scoped_project_ids.map((item) => String(item || "").trim()).filter(Boolean)
        : [],
    [credential.scoped_project_ids]
  );

  const selectedProject = useMemo(
    () => projects.find((item) => item.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );
  const selectedPeriod = useMemo(
    () => periods.find((item) => item.id === selectedPeriodId) || null,
    [periods, selectedPeriodId]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingProjects(true);
        setError(null);
        const result = await fetchProjectsReadMode();
        if (!mounted) return;
        const projectRows = sortProjects(result.data);
        const initialProject = pickInitialProject(projectRows, scopedProjectIds);
        setProjects(projectRows);
        setSelectedProjectId(initialProject?.id || "");
        setDataMode(result.mode);
        setBackendMessage(result.backend_message);
      } catch (e) {
        if (!mounted) return;
        setProjects([]);
        setSelectedProjectId("");
        setError(e instanceof Error ? e.message : "Gagal memuat workspace PMP Area 15.");
      } finally {
        if (mounted) setLoadingProjects(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [scopedProjectIds]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selectedProjectId) {
        setLoadingPeriods(false);
        setPeriods([]);
        setSelectedPeriodId("");
        return;
      }

      try {
        setLoadingPeriods(true);
        const result = await fetchProjectPeriodsReadMode(selectedProjectId);
        if (!mounted) return;
        const initialPeriod = pickInitialPeriod(result.data);
        setPeriods(result.data);
        setSelectedPeriodId(initialPeriod?.id || "");
        setDataMode(result.mode);
        setBackendMessage(result.backend_message);
      } catch (e) {
        if (!mounted) return;
        setPeriods([]);
        setSelectedPeriodId("");
        setError(e instanceof Error ? e.message : "Gagal memuat scoring period.");
      } finally {
        if (mounted) setLoadingPeriods(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedProjectId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selectedProjectId || !selectedPeriodId) {
        setLoadingSummary(false);
        setSummary(null);
        return;
      }

      try {
        setLoadingSummary(true);
        setError(null);
        const result = await fetchReadOnlySummaryReadMode(selectedProjectId, selectedPeriodId);
        if (!mounted) return;
        setSummary(result.data.compliance);
        setDataMode(result.mode);
        setBackendMessage(result.backend_message);
      } catch (e) {
        if (!mounted) return;
        setSummary(null);
        setError(e instanceof Error ? e.message : "Gagal memuat bridge PMP Area 15.");
      } finally {
        if (mounted) setLoadingSummary(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedProjectId, selectedPeriodId]);

  const connectionLabel =
    dataMode === "backend" ? "Connected (live data)" : dataMode === "prototype" ? "Read mode fallback" : null;
  const connectionTone = dataMode === "backend" ? "open" : "lock";
  const contextItems = [
    { label: "Workspace", value: selectedProject?.name || selectedProject?.code || NA_TEXT },
    { label: "Period", value: selectedPeriod ? formatPeriodLabel(selectedPeriod) : NA_TEXT },
    { label: "Mode", value: dataMode === "backend" ? "Backend summary" : "Prototype fallback" },
  ];
  const canAccessAdmin = canRoleAccessPath(credential.role, "/admin");
  const canAccessAudit = canRoleAccessPath(credential.role, "/audit");
  const canAccessProjects = canRoleAccessPath(credential.role, "/projects");

  return (
    <main className="task-shell page-corporate-shell">
      <CorporateTopbar connectionLabel={connectionLabel} connectionTone={connectionTone} />

      <header className="task-header role-hero page-hero-card">
        <div className="role-hero-grid">
          <div className="role-hero-main">
            <p className="task-kicker">Governance Bridge</p>
            <h1>PMP Area 15</h1>
            <p className="task-subtitle">
              Halaman khusus untuk membuka ringkasan governance PMP Area 15 tanpa perlu mencari section di Dashboard,
              Admin, atau Audit.
            </p>
            <div className="landing-chip-row">
              <span className="status-chip status-na">Single access point</span>
              <span className="status-chip status-na">Read-only governance summary</span>
            </div>
          </div>

          <HeaderContextCard title="Reporting Context" items={contextItems} />
        </div>
      </header>

      <QuickAccessNav
        title="PMP Navigation"
        ariaLabel="PMP Area 15 shortcuts"
        items={[
          { label: "PMP Area 15", href: "/pmp-area15" },
          { label: "Dashboard", href: "/" },
          { label: "Audit", href: canAccessAudit ? "/audit" : null },
          { label: "Admin", href: canAccessAdmin ? "/admin" : null },
          { label: "Projects", href: canAccessProjects ? "/projects" : null },
        ]}
      />

      <section className="task-panel">
        <h2>PMP Area 15 Selector</h2>
        <div className="field-grid">
          <label>
            Workspace Project
            <select
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              disabled={loadingProjects || projects.length === 0}
            >
              <option value="">{loadingProjects ? "Memuat workspace..." : "Pilih workspace"}</option>
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name || item.code || item.id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Scoring Period
            <select
              value={selectedPeriodId}
              onChange={(event) => setSelectedPeriodId(event.target.value)}
              disabled={!selectedProjectId || loadingPeriods || periods.length === 0}
            >
              <option value="">{loadingPeriods ? "Memuat period..." : "Pilih period"}</option>
              {periods.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatPeriodLabel(item)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="inline-note">
          Gunakan halaman ini sebagai pintu masuk tetap untuk PMP Area 15. Detail operasional tetap bisa dilanjutkan ke{" "}
          <Link href="/">Dashboard</Link>, <Link href="/audit">Audit</Link>, dan{" "}
          {canAccessAdmin ? <Link href="/admin">Admin</Link> : <span>Admin</span>}.
        </p>
        {backendMessage ? <p className="task-note">{backendMessage}</p> : null}
        {error ? <p className="error-box">{error}</p> : null}
      </section>

      {loadingSummary ? <p className="task-note">Memuat bridge PMP Area 15...</p> : null}
      <PmpArea15CompliancePanel
        summary={summary}
        title="PMP Area 15 Governance Readout"
        showControls={false}
      />
    </main>
  );
}
