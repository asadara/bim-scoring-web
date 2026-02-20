import { useEffect, useState } from "react";

import { FEATURE_REAL_BACKEND_WRITE } from "@/lib/featureFlags";
import { BackendHandshakeResult, fetchBackendHandshake } from "@/lib/http";

type BackendStatusBannerProps = {
  mode: "backend" | "prototype";
  message?: string | null;
};

export default function BackendStatusBanner(props: BackendStatusBannerProps) {
  const { mode, message } = props;
  const [handshake, setHandshake] = useState<BackendHandshakeResult | null>(() => {
    if (FEATURE_REAL_BACKEND_WRITE) return null;
    return {
      status: "available",
      service: "backend-readonly",
      endpoint: null,
      checked_at: new Date().toISOString(),
      message: null,
    };
  });

  useEffect(() => {
    if (!FEATURE_REAL_BACKEND_WRITE) return;

    let mounted = true;
    fetchBackendHandshake()
      .then((result) => {
        if (!mounted) return;
        setHandshake(result);
      })
      .catch(() => {
        if (!mounted) return;
        setHandshake({
          status: "unavailable",
          service: "Not available",
          endpoint: null,
          checked_at: new Date().toISOString(),
          message: "Backend not available",
        });
      });

    return () => {
      mounted = false;
    };
  }, []);

  const normalizedMessage = (message || "").trim();
  const hint = normalizedMessage.toUpperCase();
  const hasAuthorizationIssue =
    hint.includes("HTTP 401") || hint.includes("HTTP 403") || hint.includes("FORBIDDEN_ROLE");
  const hasConflictIssue =
    hint.includes("HTTP 409") || hint.includes("CONFLICT_STATE") || hint.includes("CONFLICT_VERSION");
  const hasLockedIssue = hint.includes("HTTP 423") || hint.includes("PERIOD_LOCKED");
  const hasUnavailableIssue =
    hint.includes("BACKEND UNAVAILABLE") ||
    hint.includes("BACKEND NOT AVAILABLE") ||
    hint.includes("FAILED TO FETCH") ||
    hint.includes("HTTP 500") ||
    hint.includes("HTTP 502") ||
    hint.includes("HTTP 503") ||
    hint.includes("HTTP 504");

  if (!FEATURE_REAL_BACKEND_WRITE) {
    if (mode === "backend") {
      return (
        <p className="backend-status-banner backend-status-ok" role="status">
          Connected to backend (read mode)
        </p>
      );
    }
    return (
      <p className="backend-status-banner backend-status-neutral" role="status">
        Backend read endpoint is partially available
      </p>
    );
  }

  if (!handshake) {
    return (
      <p className="backend-status-banner backend-status-neutral" role="status">
        Checking backend status...
      </p>
    );
  }

  if (hasAuthorizationIssue) {
    return (
      <p className="backend-status-banner" role="status">
        Authorization required (401/403) - read-only mode
      </p>
    );
  }

  if (hasConflictIssue) {
    return (
      <p className="backend-status-banner" role="status">
        Conflict state/version detected (409)
      </p>
    );
  }

  if (hasLockedIssue) {
    return (
      <p className="backend-status-banner" role="status">
        Period locked (423) - read-only mode
      </p>
    );
  }

  if (hasUnavailableIssue || handshake.status === "unavailable") {
    return (
      <p className="backend-status-banner" role="status">
        Backend unavailable
      </p>
    );
  }

  if (handshake.status === "available" && mode === "backend") {
    return (
      <p className="backend-status-banner backend-status-ok" role="status">
        Connected to backend (live data)
      </p>
    );
  }

  if (handshake.status === "available" && mode === "prototype") {
    return (
      <p className="backend-status-banner" role="status">
        Backend available, but some read endpoints return empty/Not available.
        {normalizedMessage ? ` - ${normalizedMessage}` : ""}
      </p>
    );
  }

  return (
    <p className="backend-status-banner" role="status">
      Backend unavailable
      {normalizedMessage ? ` - ${normalizedMessage}` : ""}
    </p>
  );
}
