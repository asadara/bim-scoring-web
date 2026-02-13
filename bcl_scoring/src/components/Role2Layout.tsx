import { ReactNode } from "react";

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
  project?: ProjectRecord | null;
  activePeriod?: ScoringPeriod | null;
  periodStatusLabel?: string;
  projectLabel?: string;
  activePeriodLabel?: string;
  children: ReactNode;
};

export default function Role2Layout(props: Role2LayoutProps) {
  const {
    title,
    subtitle,
    project,
    activePeriod,
    periodStatusLabel,
    projectLabel,
    activePeriodLabel,
    children,
  } = props;

  return (
    <main className="task-shell">
      <header className="task-header">
        <p className="task-kicker">BIM Coordinator HO</p>
        <h1>{title}</h1>
        {subtitle ? <p className="task-subtitle">{subtitle}</p> : null}

        <div className="task-context-grid">
          <div className="context-card">
            <span>Project</span>
            <strong>{projectLabel || formatProjectLabel(project || null)}</strong>
          </div>
          <div className="context-card">
            <span>Active period</span>
            <strong>{activePeriodLabel || formatPeriodLabel(activePeriod || null)}</strong>
          </div>
          <div className="context-card">
            <span>Period status</span>
            <strong>{periodStatusLabel || NA_TEXT}</strong>
          </div>
        </div>
      </header>

      {children}
    </main>
  );
}
