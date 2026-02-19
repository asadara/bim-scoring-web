import type { AppProps } from "next/app";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import "@/styles/task-layer.css";
import MainNav from "@/components/MainNav";
import { canRoleAccessPath, normalizePath } from "@/lib/accessControl";
import { startAuthCredentialSync, syncCredentialFromAuth } from "@/lib/authClient";
import { validatePublicRuntimeEnv } from "@/lib/runtimeEnv";
import { UserCredential, getRoleLabel, getStoredCredential } from "@/lib/userCredential";

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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    let stopAuthSync = () => {};

    const sync = () => {
      setCredential(getStoredCredential());
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

    return () => {
      active = false;
      stopAuthSync();
      window.removeEventListener("storage", sync);
      window.removeEventListener("bim:credential-updated", sync as EventListener);
    };
  }, []);

  const currentPath = normalizePath(router.asPath || router.pathname || "/");
  const needsAuthentication = useMemo(
    () =>
      currentPath === "/admin" ||
      currentPath.startsWith("/admin/") ||
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

  if (!ready) {
    return (
      <>
        <MainNav />
        <main className="task-shell">
          <section className="task-panel">
            <h1>Checking Access</h1>
            <p className="task-subtitle">Memuat credential aktif...</p>
          </section>
        </main>
      </>
    );
  }

  if (needsAuthentication && !credential.user_id) {
    return (
      <>
        <MainNav />
        <main className="task-shell">
          <section className="task-panel">
            <h1>Sign In Required</h1>
            <p className="task-subtitle">
              Halaman ini hanya untuk user terautentikasi. Silakan sign in terlebih dahulu.
            </p>
            <div className="wizard-actions">
              <Link href="/auth/sign-in" className="action-primary">
                Sign In
              </Link>
              <Link href="/auth/sign-up">Buat Akun</Link>
            </div>
          </section>
        </main>
      </>
    );
  }

  if (!isAllowed) {
    return (
      <>
        <MainNav />
        <main className="task-shell">
          <section className="task-panel">
            <h1>Access Restricted</h1>
            <p className="task-subtitle">
              Role aktif Anda <strong>{getRoleLabel(credential.role)}</strong> tidak memiliki akses ke halaman ini.
            </p>
            <p className="inline-note">
              Untuk hak akses lain, gunakan credential sesuai role yang berwenang (review/approval/audit bersifat
              role-based).
            </p>
            <div className="wizard-actions">
              <Link href="/" className="action-primary">
                Kembali ke Desktop
              </Link>
            </div>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <MainNav />
      <Component {...pageProps} />
    </>
  );
}
