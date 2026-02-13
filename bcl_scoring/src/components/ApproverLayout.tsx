import { ReactNode } from "react";

import { NA_TEXT } from "@/lib/role1TaskLayer";

type ApproverLayoutProps = {
  title: string;
  subtitle?: string;
  projectName?: string | null;
  periodLabel?: string | null;
  periodStatusLabel?: string | null;
  children: ReactNode;
};

export default function ApproverLayout(props: ApproverLayoutProps) {
  const { title, subtitle, projectName, periodLabel, periodStatusLabel, children } = props;

  return (
    <main className="task-shell">
      <header className="task-header">
        <p className="task-kicker">BIM Manager</p>
        <h1>{title}</h1>
        {subtitle ? <p className="task-subtitle">{subtitle}</p> : null}

        <div className="task-context-grid">
          <div className="context-card">
            <span>Project</span>
            <strong>{projectName || NA_TEXT}</strong>
          </div>
          <div className="context-card">
            <span>Active period</span>
            <strong>{periodLabel || NA_TEXT}</strong>
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
