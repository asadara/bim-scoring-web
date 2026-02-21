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
