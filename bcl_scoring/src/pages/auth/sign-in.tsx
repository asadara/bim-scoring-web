import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useMemo, useState } from "react";

import {
  isAuthConfigured,
  signInWithEmployeePassword,
  signInWithGoogleOAuth,
  updateAuthProfile,
} from "@/lib/authClient";
import { useCredential } from "@/lib/useCredential";

export default function SignInPage() {
  const router = useRouter();
  const credential = useCredential();
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [password, setPassword] = useState("");
  const [profileEmployeeNumber, setProfileEmployeeNumber] = useState(credential.employee_number || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isConfigured = isAuthConfigured();
  const isSignedIn = Boolean(credential.user_id);
  const missingEmployeeNumber = isSignedIn && !credential.employee_number;

  const defaultRedirect = useMemo(() => {
    if (credential.role === "admin") return "/admin";
    if (credential.role === "role1") return "/projects";
    if (credential.role === "role2") return "/ho/review";
    if (credential.role === "role3") return "/approve";
    return "/audit";
  }, [credential.role]);

  async function onCredentialSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await signInWithEmployeePassword({
        employee_number: employeeNumber,
        password,
      });
      setInfo("Berhasil masuk.");
      await router.push(defaultRedirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal masuk.");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogleSignIn() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await signInWithGoogleOAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal masuk dengan Google.");
      setBusy(false);
    }
  }

  async function onSaveEmployeeNumber(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await updateAuthProfile({ employee_number: profileEmployeeNumber });
      setInfo("Nomor pegawai berhasil disimpan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan nomor pegawai");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>Masuk - BIM Scoring</title>
      </Head>
      <main className="task-shell auth-shell">
        <section className="task-panel">
          <h1>Masuk</h1>
          <p className="task-subtitle">Masuk dengan nomor pegawai + password, atau Google OAuth.</p>

          {!isConfigured ? (
            <p className="error-box">
              Supabase auth belum dikonfigurasi. Set `NEXT_PUBLIC_SUPABASE_URL` dan
              `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
            </p>
          ) : null}
          {error ? <p className="error-box">{error}</p> : null}
          {info ? <p className="auth-status">{info}</p> : null}

          {isSignedIn ? (
            <div className="auth-stack">
              <p className="auth-status">
                Anda sudah login sebagai <strong>{credential.full_name || credential.user_id}</strong>.
                {credential.pending_role ? " Role masih menunggu assignment dari admin." : null}
              </p>
              {missingEmployeeNumber ? (
                <form className="auth-stack" onSubmit={onSaveEmployeeNumber}>
                  <label className="auth-field">
                    Lengkapi Nomor Pegawai
                    <input
                      value={profileEmployeeNumber}
                      onChange={(event) => setProfileEmployeeNumber(event.target.value)}
                      placeholder="mis. 20240017"
                      required
                    />
                  </label>
                  <div className="wizard-actions">
                    <button type="submit" className="action-primary" disabled={busy}>
                      {busy ? "Menyimpan..." : "Simpan Nomor Pegawai"}
                    </button>
                  </div>
                </form>
              ) : null}
              <div className="wizard-actions">
                <Link href={defaultRedirect} className="action-primary">
                  Lanjut ke Dashboard
                </Link>
              </div>
            </div>
          ) : (
            <div className="auth-stack">
              <form className="auth-stack" onSubmit={onCredentialSignIn}>
                <label className="auth-field">
                  Nomor Pegawai
                  <input
                    value={employeeNumber}
                    onChange={(event) => setEmployeeNumber(event.target.value)}
                    placeholder="mis. 20240017"
                    required
                  />
                </label>
                <label className="auth-field">
                  Password
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Masukkan password"
                    required
                  />
                </label>
                <button type="submit" className="primary-cta" disabled={busy || !isConfigured}>
                  {busy ? "Memproses..." : "Masuk"}
                </button>
              </form>

              <div className="auth-divider">atau</div>

              <button type="button" className="secondary-cta" onClick={() => void onGoogleSignIn()} disabled={busy || !isConfigured}>
                Masuk dengan Google
              </button>

              <p className="auth-helper">
                Belum punya akun? <Link href="/auth/sign-up">Buat akun baru</Link>.
              </p>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
