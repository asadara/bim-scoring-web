import { useEffect, useState } from "react";

import { FEATURE_REAL_BACKEND_WRITE } from "@/lib/featureFlags";
import { BackendHandshakeResult, fetchBackendHandshake } from "@/lib/http";

type BackendStatusBannerProps = {
  mode: "backend" | "prototype";
  message?: string | null;
  variant?: "banner" | "compact";
};

type StatusTone = "default" | "ok" | "neutral";

type ResolvedStatus = {
  text: string;
  tone: StatusTone;
};

function resolveStatus(params: {
  mode: "backend" | "prototype";
  message?: string | null;
  handshake: BackendHandshakeResult | null;
}): ResolvedStatus {
  const { mode, message, handshake } = params;
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
      return {
        text: "Connected to backend (read mode)",
        tone: "ok",
      };
    }
    return {
      text: "Prototype mode active: evidence/review data sync only within the same browser profile.",
      tone: "neutral",
    };
  }

  if (!handshake) {
    return {
      text: "Checking backend status...",
      tone: "neutral",
    };
  }

  if (hasAuthorizationIssue) {
    return {
      text: "Authorization required (401/403) - read-only mode",
      tone: "default",
    };
  }

  if (hasConflictIssue) {
    return {
      text: "Conflict state/version detected (409)",
      tone: "default",
    };
  }

  if (hasLockedIssue) {
    return {
      text: "Period locked (423) - read-only mode",
      tone: "default",
    };
  }

  if (hasUnavailableIssue || handshake.status === "unavailable") {
    return {
      text: "Backend unavailable",
      tone: "default",
    };
  }

  if (handshake.status === "available" && mode === "backend") {
    return {
      text: "Connected to backend (live data)",
      tone: "ok",
    };
  }

  if (handshake.status === "available" && mode === "prototype") {
    return {
      text: `Backend available, but some read endpoints return empty/Not available.${
        normalizedMessage ? ` - ${normalizedMessage}` : ""
      }`,
      tone: "default",
    };
  }

  return {
    text: `Backend unavailable${normalizedMessage ? ` - ${normalizedMessage}` : ""}`,
    tone: "default",
  };
}

function toStatusClass(baseClass: string, tone: StatusTone): string {
  if (tone === "ok") return `${baseClass} backend-status-ok`;
  if (tone === "neutral") return `${baseClass} backend-status-neutral`;
  return baseClass;
}

export default function BackendStatusBanner(props: BackendStatusBannerProps) {
  const { mode, message, variant = "banner" } = props;
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

  const resolved = resolveStatus({ mode, message, handshake });
  const className =
    variant === "compact"
      ? toStatusClass("backend-status-inline", resolved.tone)
      : toStatusClass("backend-status-banner", resolved.tone);

  if (variant === "compact") {
    return (
      <span className={className} role="status">
        {resolved.text}
      </span>
    );
  }

  return (
    <p className={className} role="status">
      {resolved.text}
    </p>
  );
}
