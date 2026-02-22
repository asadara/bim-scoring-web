import { ReactNode } from "react";

import CorporateTopbar from "@/components/CorporateTopbar";
import HeaderContextCard from "@/components/HeaderContextCard";
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
    children,
  } = props;
  const periodText = periodStatusLabel || NA_TEXT;
  const periodChipClass =
    periodText === "LOCKED"
      ? "status-chip status-lock"
      : periodText === "OPEN"
        ? "status-chip status-open"
        : "status-chip status-na";
  const connectionLabel =
    backendMode === "backend"
      ? "Connected (live data)"
      : backendMode === "prototype"
        ? "Read mode fallback"
        : null;
  const connectionTone = backendMode === "backend" ? "open" : "lock";
  const contextItems: Array<{ label: string; value: ReactNode }> = [
    { label: "Project", value: projectLabel || formatProjectLabel(project || null) },
    { label: "Active period", value: activePeriodLabel || formatPeriodLabel(activePeriod || null) },
    { label: "Period status", value: periodText },
  ];

  return (
    <main className="task-shell page-corporate-shell">
      <CorporateTopbar connectionLabel={connectionLabel} connectionTone={connectionTone} />

      <header className="task-header role-hero role-hero-role2 page-hero-card">
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

          <HeaderContextCard title="Reporting Context" items={contextItems} />
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
