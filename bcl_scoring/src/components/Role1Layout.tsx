import { ReactNode } from "react";

import CorporateTopbar from "@/components/CorporateTopbar";
import HeaderContextCard from "@/components/HeaderContextCard";
import QuickAccessNav from "@/components/QuickAccessNav";
import { NA_TEXT, ProjectRecord, ScoringPeriod, formatPeriodLabel, formatProjectLabel } from "@/lib/role1TaskLayer";

type Role1LayoutProps = {
  projectId: string;
  title: string;
  subtitle: string;
  project: ProjectRecord | null;
  activePeriod: ScoringPeriod | null;
  periodStatusLabel: string;
  backendMode?: "backend" | "prototype";
  backendMessage?: string | null;
  children: ReactNode;
};

export default function Role1Layout(props: Role1LayoutProps) {
  const {
    projectId,
    title,
    subtitle,
    project,
    activePeriod,
    periodStatusLabel,
    backendMode,
    children,
  } = props;
  const periodChipClass =
    periodStatusLabel === "LOCKED"
      ? "status-chip status-lock"
      : periodStatusLabel === "OPEN"
        ? "status-chip status-open"
        : "status-chip status-na";
  const connectionLabel =
    backendMode === "backend"
      ? "Connected (live data)"
      : backendMode === "prototype"
        ? "Read mode fallback"
        : null;
  const connectionTone = backendMode === "backend" ? "open" : "lock";
  const contextItems: Array<{ label: string; value: ReactNode }> = [
    { label: "Project", value: formatProjectLabel(project) },
    { label: "Active period", value: formatPeriodLabel(activePeriod) },
    { label: "Period status", value: periodStatusLabel || NA_TEXT },
  ];

  return (
    <main className="task-shell page-corporate-shell">
      <CorporateTopbar connectionLabel={connectionLabel} connectionTone={connectionTone} />

      <header className="task-header role-hero role-hero-role1 page-hero-card">
        <div className="role-hero-grid">
          <div className="role-hero-main">
            <p className="task-kicker">BIM Coordinator Project</p>
            <h1>{title}</h1>
            <p className="task-subtitle">{subtitle}</p>
            <div className="landing-chip-row">
              <span className={periodChipClass}>Period: {periodStatusLabel || NA_TEXT}</span>
              <span className="status-chip status-na">Task-first mode</span>
            </div>
          </div>

          <HeaderContextCard title="Reporting Context" items={contextItems} />
        </div>
      </header>

      <QuickAccessNav
        ariaLabel="Project task shortcuts"
        items={[
          { label: "Project List", href: "/projects" },
          { label: "Project Home", href: projectId ? `/projects/${projectId}` : null },
          { label: "Tambah Evidence", href: projectId ? `/projects/${projectId}/evidence/add` : null },
          { label: "Daftar Evidence", href: projectId ? `/projects/${projectId}/evidence` : null },
          { label: "Daftar Indicators", href: projectId ? `/projects/${projectId}/indicators` : null },
        ]}
      />

      {children}
    </main>
  );
}
