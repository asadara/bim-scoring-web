import Link from "next/link";
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
  children: ReactNode;
};

export default function Role2Layout(props: Role2LayoutProps) {
  const { title, subtitle, project, activePeriod, periodStatusLabel, children } = props;

  return (
    <main className="task-shell">
      <header className="task-header">
        <p className="task-kicker">Role 2 - HO Reviewer</p>
        <h1>{title}</h1>
        {subtitle ? <p className="task-subtitle">{subtitle}</p> : null}

        <div className="task-context-grid">
          <div className="context-card">
            <span>Project</span>
            <strong>{formatProjectLabel(project || null)}</strong>
          </div>
          <div className="context-card">
            <span>Active period</span>
            <strong>{formatPeriodLabel(activePeriod || null)}</strong>
          </div>
          <div className="context-card">
            <span>Period status</span>
            <strong>{periodStatusLabel || NA_TEXT}</strong>
          </div>
        </div>
      </header>

      <nav className="task-nav" aria-label="Role 2 task navigation">
        <Link href="/">Home</Link>
        <Link href="/start">Start Here</Link>
        <Link href="/projects">Projects</Link>
        <Link href="/ho/review">HO Review</Link>
        <Link href="/approve">Approvals</Link>
        <Link href="/audit">Audit</Link>
      </nav>

      {children}
    </main>
  );
}
