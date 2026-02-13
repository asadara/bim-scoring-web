import { ReactNode } from "react";

import QuickAccessNav from "@/components/QuickAccessNav";
import { NA_TEXT } from "@/lib/role1TaskLayer";

type ApproverLayoutProps = {
  title: string;
  subtitle?: string;
  projectId?: string | null;
  projectName?: string | null;
  periodLabel?: string | null;
  periodStatusLabel?: string | null;
  children: ReactNode;
};

export default function ApproverLayout(props: ApproverLayoutProps) {
  const { title, subtitle, projectId, projectName, periodLabel, periodStatusLabel, children } = props;
  const periodText = periodStatusLabel || NA_TEXT;
  const periodChipClass =
    periodText === "LOCKED"
      ? "status-chip status-lock"
      : periodText === "OPEN"
        ? "status-chip status-open"
        : "status-chip status-na";

  return (
    <main className="task-shell">
      <header className="task-header role-hero role-hero-role3">
        <div className="role-hero-grid">
          <div className="role-hero-main">
            <p className="task-kicker">BIM Manager</p>
            <h1>{title}</h1>
            {subtitle ? <p className="task-subtitle">{subtitle}</p> : null}
            <div className="landing-chip-row">
              <span className={periodChipClass}>Period: {periodText}</span>
              <span className="status-chip status-na">Approval gate</span>
            </div>
          </div>

          <aside className="role-context-panel">
            <div className="role-context-grid">
              <div className="context-card role-context-card">
                <span>Project</span>
                <strong>{projectName || NA_TEXT}</strong>
              </div>
              <div className="context-card role-context-card">
                <span>Active period</span>
                <strong>{periodLabel || NA_TEXT}</strong>
              </div>
              <div className="context-card role-context-card">
                <span>Period status</span>
                <strong>{periodText}</strong>
              </div>
            </div>
          </aside>
        </div>
      </header>

      <QuickAccessNav
        ariaLabel="Approval shortcuts"
        items={[
          { label: "Approval Home", href: "/approve" },
          { label: "Project Context", href: projectId ? `/approve/projects/${projectId}` : null },
          { label: "Awaiting Review", href: projectId ? `/approve/projects/${projectId}/awaiting-review` : null },
          { label: "Decision", href: projectId ? `/approve/projects/${projectId}/decision` : null },
        ]}
      />

      {children}
    </main>
  );
}
