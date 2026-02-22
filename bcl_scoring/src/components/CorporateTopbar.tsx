import Image from "next/image";
import { useState, type ReactNode } from "react";

import { useCredential } from "@/lib/useCredential";
import { getRoleLabel } from "@/lib/userCredential";

type CorporateTopbarProps = {
  connectionLabel?: ReactNode;
  connectionTone?: "open" | "lock" | "na";
  lastSyncLabel?: string | null;
  className?: string;
};

function resolveEnvironmentLabel(): string {
  const appEnv = String(process.env.NEXT_PUBLIC_APP_ENV || "").trim().toLowerCase();
  if (appEnv.includes("prod")) return "Production";
  if (appEnv.includes("beta") || appEnv.includes("staging") || appEnv.includes("dev")) return "Beta";
  return "Production";
}

export default function CorporateTopbar(props: CorporateTopbarProps) {
  const {
    connectionLabel = null,
    connectionTone = "na",
    lastSyncLabel = null,
    className = "",
  } = props;
  const credential = useCredential();
  const [showNkeLogo, setShowNkeLogo] = useState(true);
  const [showBimLogo, setShowBimLogo] = useState(true);

  const environmentLabel = resolveEnvironmentLabel();
  const activeRoleLabel = getRoleLabel(credential.role);
  const statusChipClass =
    connectionTone === "open"
      ? "status-chip status-open"
      : connectionTone === "lock"
        ? "status-chip status-lock"
        : "status-chip status-na";
  const classes = ["task-panel", "dashboard-corp-topbar", "page-corp-topbar", className]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classes}>
      <div className="dashboard-brand-cluster">
        {showNkeLogo ? (
          <Image
            src="/logo_nke.png"
            alt="PT Nusa Konstruksi Enjiniring"
            className="dashboard-brand-logo dashboard-brand-logo-primary"
            width={130}
            height={40}
            loading="eager"
            onError={() => setShowNkeLogo(false)}
            unoptimized
          />
        ) : (
          <div className="dashboard-logo-fallback">NKE</div>
        )}
        <span className="dashboard-brand-separator" aria-hidden="true" />
        <div className="dashboard-program-brand">
          {showBimLogo ? (
            <Image
              src="/logo/bim_scoring_logo.png"
              alt="BIM Scoring Logo"
              className="dashboard-brand-logo dashboard-brand-logo-secondary page-corp-logo-secondary"
              width={40}
              height={40}
              loading="eager"
              onError={() => setShowBimLogo(false)}
              unoptimized
            />
          ) : (
            <div className="dashboard-logo-fallback dashboard-logo-fallback-secondary">BIM</div>
          )}
        </div>
      </div>

      <div className="dashboard-meta-chip-row">
        <span className="dashboard-meta-chip">
          <b>Environment</b>
          <em>{environmentLabel}</em>
        </span>
        <span className="dashboard-meta-chip">
          <b>Active Role</b>
          <em>{activeRoleLabel}</em>
        </span>
        {lastSyncLabel ? (
          <span className="dashboard-meta-chip">
            <b>Last Sync</b>
            <em>{lastSyncLabel}</em>
          </span>
        ) : null}
        {connectionLabel ? (
          <span className={statusChipClass}>{connectionLabel}</span>
        ) : null}
      </div>
    </section>
  );
}
