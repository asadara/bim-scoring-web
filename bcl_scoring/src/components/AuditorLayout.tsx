import { ReactNode } from "react";

import BackendStatusBanner from "@/components/BackendStatusBanner";
import CorporateTopbar from "@/components/CorporateTopbar";
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
  const connectionLabel =
    backendMode === "backend"
      ? "Connected (live data)"
      : backendMode === "prototype"
        ? "Read mode fallback"
        : null;
  const connectionTone = backendMode === "backend" ? "open" : "lock";

  return (
    <main className="task-shell page-corporate-shell">
      <CorporateTopbar connectionLabel={connectionLabel} connectionTone={connectionTone} />

      <header className="task-header role-hero role-hero-role3 page-hero-card">
        <div className="role-hero-grid">
          <div className="role-hero-main">
            <p className="task-kicker">Read-only Auditor View</p>
            <h1>{title}</h1>
            {subtitle ? <p className="task-subtitle">{subtitle}</p> : null}
            <div className="landing-chip-row">
              <span className="status-chip status-na">Immutable snapshot trace</span>
              <span className="status-chip status-na">Read-only mode</span>
            </div>
          </div>

          <aside className="role-context-panel">
            <div className="role-context-grid">
              <div className="context-card role-context-card">
                <span>Project</span>
                <strong>{projectLabel || NA_TEXT}</strong>
              </div>
              <div className="context-card role-context-card">
                <span>Period</span>
                <strong>{periodLabel || NA_TEXT}</strong>
              </div>
              <div className="context-card role-context-card">
                <span>Mode</span>
                <strong>Read-only Auditor View</strong>
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
