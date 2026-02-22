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
  const [language, setLanguage] = useState<AppLanguage>(() => resolvePreferredLanguage());
  const [ready, setReady] = useState(false);
  const text = useMemo(() => getGlobalText(language), [language]);

  useEffect(() => {
    applyTheme(resolveStoredTheme());
    applyLanguage(language);
  }, [language]);

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

    const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim();

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

    let rafId = 0;
    const scheduleRefresh = () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        document.querySelectorAll("table").forEach((table) => alignTableColumns(table as HTMLTableElement));
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
  const isRootShellPath = currentPath === "/" || currentPath === "/bcl/index.html";
  const renderShell = (content: ReactNode) => (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/logo/bim_scoring_logo.png" />
        {isRootShellPath ? (
          <>
            <meta name="bim-scoring-marker" content="bim-scoring-root-shell" />
            <meta name="bim-scoring-marker" content="bcl-legacy-shell" />
          </>
        ) : null}
      </Head>
      <MainNav />
      {isRootShellPath ? (
        <>
          <div className="sr-only" data-e2e-marker="bim-scoring-root-shell" />
          <div className="sr-only" data-e2e-marker="bcl-legacy-shell" />
        </>
      ) : null}
      {content}
      <footer className="app-global-footer-shell">
        <section className="task-panel app-legal-footer">
          <p>&copy; 2026 PT Nusa Konstruksi Enjiniring Tbk &mdash; Engineering Department &mdash; Divisi BIM</p>
          <p>
            This platform supports information governance aligned with ISO 19650 (conceptual alignment).
          </p>
        </section>
      </footer>
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

