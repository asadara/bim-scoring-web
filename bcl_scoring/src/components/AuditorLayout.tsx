import { ReactNode } from "react";

import CorporateTopbar from "@/components/CorporateTopbar";
import HeaderContextCard from "@/components/HeaderContextCard";
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
  const { title, subtitle, projectLabel, periodLabel, snapshotId, backendMode, children } = props;
  const connectionLabel =
    backendMode === "backend"
      ? "Connected (live data)"
      : backendMode === "prototype"
        ? "Read mode fallback"
        : null;
  const connectionTone = backendMode === "backend" ? "open" : "lock";
  const contextItems: Array<{ label: string; value: ReactNode }> = [
    { label: "Project", value: projectLabel || NA_TEXT },
    { label: "Period", value: periodLabel || NA_TEXT },
    { label: "Mode", value: "Read-only Auditor View" },
  ];

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

          <HeaderContextCard title="Reporting Context" items={contextItems} />
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
