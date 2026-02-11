import Link from "next/link";
import { ReactNode } from "react";

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

  return (
    <main className="task-shell">
      <header className="task-header">
        <p className="task-kicker">Role 1 - BIM Koordinator Proyek</p>
        <h1>{title}</h1>
        <p className="task-subtitle">{subtitle}</p>

        <div className="task-context-grid">
          <div className="context-card">
            <span>Project</span>
            <strong>{formatProjectLabel(project)}</strong>
          </div>
          <div className="context-card">
            <span>Active period</span>
            <strong>{formatPeriodLabel(activePeriod)}</strong>
          </div>
          <div className="context-card">
            <span>Period status</span>
            <strong>{periodStatusLabel || NA_TEXT}</strong>
          </div>
        </div>
      </header>

      <nav className="task-nav" aria-label="Role 1 task navigation">
        <Link href="/">Home</Link>
        <Link href="/start">Start Here</Link>
        <Link href="/projects">Projects</Link>
        <Link href="/ho/review">HO Review</Link>
        <Link href="/approve">Approvals</Link>
        <Link href="/audit">Audit</Link>
        <Link href={`/projects/${projectId}`}>Project Home</Link>
        <Link href={`/projects/${projectId}/evidence/add`}>Tambahkan Evidence</Link>
        <Link href={`/projects/${projectId}/evidence`}>My Evidence List</Link>
      </nav>

      {children}
    </main>
  );
}
