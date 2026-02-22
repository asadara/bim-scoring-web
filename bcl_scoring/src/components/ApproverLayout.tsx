import { ReactNode } from "react";

import CorporateTopbar from "@/components/CorporateTopbar";
import HeaderContextCard from "@/components/HeaderContextCard";
import QuickAccessNav from "@/components/QuickAccessNav";
import { NA_TEXT } from "@/lib/role1TaskLayer";

type ApproverLayoutProps = {
  title: string;
  subtitle?: string;
  projectId?: string | null;
  projectName?: string | null;
  periodLabel?: string | null;
  periodStatusLabel?: string | null;
  backendMode?: "backend" | "prototype";
  backendMessage?: string | null;
  children: ReactNode;
};

export default function ApproverLayout(props: ApproverLayoutProps) {
  const {
    title,
    subtitle,
    projectId,
    projectName,
    periodLabel,
    periodStatusLabel,
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
    { label: "Project", value: projectName || NA_TEXT },
    { label: "Active period", value: periodLabel || NA_TEXT },
    { label: "Period status", value: periodText },
  ];

  return (
    <main className="task-shell page-corporate-shell">
      <CorporateTopbar connectionLabel={connectionLabel} connectionTone={connectionTone} />

      <header className="task-header role-hero role-hero-role3 page-hero-card">
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

          <HeaderContextCard title="Reporting Context" items={contextItems} />
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
