import { ReactNode } from "react";

import BackendStatusBanner from "@/components/BackendStatusBanner";
import QuickAccessNav from "@/components/QuickAccessNav";
import {
  NA_TEXT,
  ProjectRecord,
  ScoringPeriod,
  formatPeriodLabel,
  formatProjectLabel,
} from "@/lib/role1TaskLayer";

type Role2LayoutProps = {
  title: string;
  subtitle?: string;
  projectId?: string | null;
  project?: ProjectRecord | null;
  activePeriod?: ScoringPeriod | null;
  periodStatusLabel?: string;
  projectLabel?: string;
  activePeriodLabel?: string;
  backendMode?: "backend" | "prototype";
  backendMessage?: string | null;
  children: ReactNode;
};

export default function Role2Layout(props: Role2LayoutProps) {
  const {
    title,
    subtitle,
    projectId,
    project,
    activePeriod,
    periodStatusLabel,
    projectLabel,
    activePeriodLabel,
    backendMode,
    backendMessage,
    children,
  } = props;
  const periodText = periodStatusLabel || NA_TEXT;
  const periodChipClass =
    periodText === "LOCKED"
      ? "status-chip status-lock"
      : periodText === "OPEN"
        ? "status-chip status-open"
        : "status-chip status-na";

  return (
    <main className="task-shell">
      <header className="task-header role-hero role-hero-role2">
        <div className="role-hero-grid">
          <div className="role-hero-main">
            <p className="task-kicker">BIM Coordinator HO</p>
            <h1>{title}</h1>
            {subtitle ? <p className="task-subtitle">{subtitle}</p> : null}
            <div className="landing-chip-row">
              <span className={periodChipClass}>Period: {periodText}</span>
              <span className="status-chip status-na">Review-only action</span>
            </div>
          </div>

          <aside className="role-context-panel">
            <div className="role-context-grid">
              <div className="context-card role-context-card">
                <span>Project</span>
                <strong>{projectLabel || formatProjectLabel(project || null)}</strong>
              </div>
              <div className="context-card role-context-card">
                <span>Active period</span>
                <strong>{activePeriodLabel || formatPeriodLabel(activePeriod || null)}</strong>
              </div>
              <div className="context-card role-context-card">
                <span>Period status</span>
                <strong>{periodText}</strong>
              </div>
              {backendMode ? (
                <div className="context-card role-context-card">
                  <span>Backend</span>
                  <BackendStatusBanner mode={backendMode} message={backendMessage} variant="compact" />
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </header>

      <QuickAccessNav
        ariaLabel="HO review shortcuts"
        items={[
          { label: "Review Home", href: "/ho/review" },
          { label: "Project Review", href: projectId ? `/ho/review/projects/${projectId}` : null },
          { label: "Proposal BIM Use", href: "/ho/review/proposals" },
        ]}
      />

      {children}
    </main>
  );
}
