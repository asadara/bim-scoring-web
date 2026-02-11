import Link from "next/link";
import { ReactNode } from "react";

import { NA_TEXT } from "@/lib/role1TaskLayer";

type AuditorLayoutProps = {
  title: string;
  subtitle?: string;
  projectLabel?: string | null;
  periodLabel?: string | null;
  children: ReactNode;
};

export default function AuditorLayout(props: AuditorLayoutProps) {
  const { title, subtitle, projectLabel, periodLabel, children } = props;

  return (
    <main className="task-shell">
      <header className="task-header">
        <p className="task-kicker">Phase 3A - Read-only Auditor View</p>
        <h1>{title}</h1>
        {subtitle ? <p className="task-subtitle">{subtitle}</p> : null}

        <div className="task-context-grid">
          <div className="context-card">
            <span>Project</span>
            <strong>{projectLabel || NA_TEXT}</strong>
          </div>
          <div className="context-card">
            <span>Period</span>
            <strong>{periodLabel || NA_TEXT}</strong>
          </div>
          <div className="context-card">
            <span>Mode</span>
            <strong>Read-only Auditor View</strong>
          </div>
        </div>
      </header>

      <nav className="task-nav" aria-label="Auditor navigation">
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
