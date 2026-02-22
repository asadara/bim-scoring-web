import type { AppProps } from "next/app";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import "@/styles/task-layer.css";
import MainNav from "@/components/MainNav";
import { canRoleAccessPath, normalizePath } from "@/lib/accessControl";
import { startAuthCredentialSync, syncCredentialFromAuth } from "@/lib/authClient";
import {
  DEFAULT_APP_LANGUAGE,
  applyLanguage,
  getGlobalText,
  getRoleLabelLocalized,
  resolvePreferredLanguage,
  type AppLanguage,
} from "@/lib/language";
import { validatePublicRuntimeEnv } from "@/lib/runtimeEnv";
import { applyTheme, resolveStoredTheme } from "@/lib/theme";
import { UserCredential, getStoredCredential } from "@/lib/userCredential";

validatePublicRuntimeEnv();

const DEFAULT_CREDENTIAL: UserCredential = {
  role: "viewer",
  user_id: null,
  full_name: null,
  employee_number: null,
  auth_provider: null,
  pending_role: false,
  scoped_project_ids: [],
  updated_at: "",
};

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [credential, setCredential] = useState<UserCredential>(DEFAULT_CREDENTIAL);
  const [language, setLanguage] = useState<AppLanguage>(DEFAULT_APP_LANGUAGE);
  const [ready, setReady] = useState(false);
  const text = useMemo(() => getGlobalText(language), [language]);

  useEffect(() => {
    applyTheme(resolveStoredTheme());
    const preferredLanguage = resolvePreferredLanguage();
    applyLanguage(preferredLanguage);
    setLanguage(preferredLanguage);
  }, []);

  useEffect(() => {
    let active = true;
    let stopAuthSync = () => {};

    const sync = () => {
      setCredential(getStoredCredential());
      const preferredLanguage = resolvePreferredLanguage();
      applyLanguage(preferredLanguage);
      setLanguage(preferredLanguage);
    };

    (async () => {
      await syncCredentialFromAuth();
      if (!active) return;
      sync();
      setReady(true);
      stopAuthSync = startAuthCredentialSync();
    })();

    window.addEventListener("storage", sync);
    window.addEventListener("bim:credential-updated", sync as EventListener);
    window.addEventListener("languagechange", sync as EventListener);

    return () => {
      active = false;
      stopAuthSync();
      window.removeEventListener("storage", sync);
      window.removeEventListener("bim:credential-updated", sync as EventListener);
      window.removeEventListener("languagechange", sync as EventListener);
    };
  }, []);

  useEffect(() => {
    const SHORT_TEXT_THRESHOLD = 5;
    const CARD_SELECTOR = [
      ".summary-card",
      ".context-card",
      ".landing-card",
      ".desktop-insight-card",
      ".dashboard-kpi-card",
      ".dashboard-trend-card",
      ".dashboard-side-stat",
      ".dashboard-readiness-item",
      ".desktop-perspective-card",
    ].join(", ");

    const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim();

    const getLineCount = (element: HTMLElement): number => {
      const text = normalizeText(element.textContent || "");
      if (!text) return 0;

      const computed = window.getComputedStyle(element);
      const lineHeight = Number.parseFloat(computed.lineHeight);
      const { height } = element.getBoundingClientRect();
      if (!Number.isFinite(lineHeight) || lineHeight <= 0 || !Number.isFinite(height) || height <= 0) {
        return 1;
      }
      return Math.max(1, Math.round(height / lineHeight));
    };

    const alignTableColumns = (table: HTMLTableElement) => {
      const headRows = table.tHead ? Array.from(table.tHead.rows) : [];
      const bodyRows = table.tBodies.length
        ? Array.from(table.tBodies).flatMap((body) => Array.from(body.rows))
        : Array.from(table.rows);
      const allRows = [...headRows, ...bodyRows];

      const columnCount = allRows.reduce((max, row) => Math.max(max, row.cells.length), 0);
      if (columnCount === 0) return;

      table.querySelectorAll("th, td").forEach((cell) => {
        cell.classList.remove("table-col-short", "table-col-long");
      });

      for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
        let longestBodyText = 0;

        for (const row of bodyRows) {
          const cell = row.cells.item(columnIndex);
          if (!cell) continue;
          const length = normalizeText(cell.textContent || "").length;
          if (length === 0) continue;
          longestBodyText = Math.max(longestBodyText, length);
        }

        if (longestBodyText === 0) {
          for (const row of headRows) {
            const headerCell = row.cells.item(columnIndex);
            if (!headerCell) continue;
            const length = normalizeText(headerCell.textContent || "").length;
            if (length === 0) continue;
            longestBodyText = Math.max(longestBodyText, length);
          }
        }

        const className =
          longestBodyText > 0 && longestBodyText < SHORT_TEXT_THRESHOLD ? "table-col-short" : "table-col-long";

        for (const row of allRows) {
          const cell = row.cells.item(columnIndex);
          if (cell) {
            cell.classList.add(className);
          }
        }
      }
    };

    const alignCardHeaders = () => {
      const cards = Array.from(document.querySelectorAll<HTMLElement>(CARD_SELECTOR));
      for (const card of cards) {
        card.classList.remove("card-title-on-border");

        const firstChild = card.firstElementChild;
        if (!(firstChild instanceof HTMLElement)) continue;
        const headerTag = firstChild.tagName.toUpperCase();
        if (!["SPAN", "P", "H2", "H3", "H4", "H5", "H6"].includes(headerTag)) continue;

        const contentChildren = Array.from(card.children).filter(
          (child): child is HTMLElement => child instanceof HTMLElement && child !== firstChild
        );
        let bodyLines = 0;
        for (const child of contentChildren) {
          bodyLines += getLineCount(child);
          if (bodyLines > 1) break;
        }

        if (bodyLines > 1) {
          card.classList.add("card-title-on-border");
        }
      }
    };

    let rafId = 0;
    const scheduleRefresh = () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        document.querySelectorAll("table").forEach((table) => alignTableColumns(table as HTMLTableElement));
        alignCardHeaders();
      });
    };

    scheduleRefresh();
    const observer = new MutationObserver(() => scheduleRefresh());
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", scheduleRefresh);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener("resize", scheduleRefresh);
    };
  }, [router.asPath]);

  const currentPath = normalizePath(router.asPath || router.pathname || "/");
  const needsAuthentication = useMemo(
    () =>
      currentPath === "/admin" ||
      currentPath.startsWith("/admin/") ||
      currentPath === "/me" ||
      currentPath.startsWith("/me/") ||
      currentPath === "/projects" ||
      currentPath.startsWith("/projects/") ||
      currentPath === "/ho/review" ||
      currentPath.startsWith("/ho/review/") ||
      currentPath === "/approve" ||
      currentPath.startsWith("/approve/"),
    [currentPath]
  );
  const isAllowed = useMemo(
    () => canRoleAccessPath(credential.role, currentPath),
    [credential.role, currentPath]
  );
  const renderShell = (content: ReactNode) => (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <MainNav />
      {content}
    </>
  );

  if (!ready) {
    return renderShell(
      <main className="task-shell">
        <section className="task-panel">
          <h1>{text.checkingAccessTitle}</h1>
          <p className="task-subtitle">{text.checkingAccessSubtitle}</p>
        </section>
      </main>
    );
  }

  if (needsAuthentication && !credential.user_id) {
    return renderShell(
      <main className="task-shell">
        <section className="task-panel">
          <h1>{text.needsSignInTitle}</h1>
          <p className="task-subtitle">{text.needsSignInSubtitle}</p>
          <div className="wizard-actions">
            <Link href="/auth/sign-in" className="action-primary">
              {text.signIn}
            </Link>
            <Link href="/auth/sign-up">{text.signUp}</Link>
          </div>
        </section>
      </main>
    );
  }

  if (!isAllowed) {
    return renderShell(
      <main className="task-shell">
        <section className="task-panel">
          <h1>{text.restrictedAccessTitle}</h1>
          <p className="task-subtitle">
            {text.restrictedAccessSubtitle(getRoleLabelLocalized(credential.role, language))}
          </p>
          <p className="inline-note">{text.restrictedAccessNote}</p>
          <div className="wizard-actions">
            <Link href="/" className="action-primary">
              {text.backToDashboard}
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return renderShell(<Component {...pageProps} />);
}
