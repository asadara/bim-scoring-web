import { ReactNode } from "react";

import QuickAccessNav from "@/components/QuickAccessNav";
import { NA_TEXT, ProjectRecord, ScoringPeriod, formatPeriodLabel, formatProjectLabel } from "@/lib/role1TaskLayer";

type Role1LayoutProps = {
  projectId: string;
  title: string;
  subtitle: string;
  project: ProjectRecord | null;
  activePeriod: ScoringPeriod | null;
  periodStatusLabel: string;
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
    children,
  } = props;
  const periodChipClass =
    periodStatusLabel === "LOCKED"
      ? "status-chip status-lock"
      : periodStatusLabel === "OPEN"
        ? "status-chip status-open"
        : "status-chip status-na";

  return (
    <main className="task-shell">
      <header className="task-header role-hero role-hero-role1">
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

          <aside className="role-context-panel">
            <div className="role-context-grid">
              <div className="context-card role-context-card">
                <span>Project</span>
                <strong>{formatProjectLabel(project)}</strong>
              </div>
              <div className="context-card role-context-card">
                <span>Active period</span>
                <strong>{formatPeriodLabel(activePeriod)}</strong>
              </div>
              <div className="context-card role-context-card">
                <span>Period status</span>
                <strong>{periodStatusLabel || NA_TEXT}</strong>
              </div>
            </div>
          </aside>
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
