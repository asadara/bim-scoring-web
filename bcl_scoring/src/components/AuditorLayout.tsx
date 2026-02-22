import { ReactNode } from "react";

import BackendStatusBanner from "@/components/BackendStatusBanner";
import QuickAccessNav from "@/components/QuickAccessNav";
import { NA_TEXT } from "@/lib/role1TaskLayer";

type AuditorLayoutProps = {
  title: string;
  subtitle?: string;
  projectLabel?: string | null;
  periodLabel?: string | null;
  snapshotId?: string | null;
  backendMode?: "backend" | "prototype";
  backendMessage?: string | null;
  children: ReactNode;
};

export default function AuditorLayout(props: AuditorLayoutProps) {
  const { title, subtitle, projectLabel, periodLabel, snapshotId, backendMode, backendMessage, children } = props;

  return (
    <main className="task-shell">
      <header className="task-header">
        <p className="task-kicker">Read-only Auditor View</p>
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
          {backendMode ? (
            <div className="context-card">
              <span>Backend</span>
              <BackendStatusBanner mode={backendMode} message={backendMessage} variant="compact" />
            </div>
          ) : null}
        </div>
      </header>

      <QuickAccessNav
        ariaLabel="Audit shortcuts"
        items={[
          { label: "Audit Home", href: "/audit" },
          { label: "Snapshot Detail", href: snapshotId ? `/audit/snapshots/${encodeURIComponent(snapshotId)}` : null },
        ]}
      />

      {children}
    </main>
  );
}
