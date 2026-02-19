import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useState } from "react";

import {
  isAuthConfigured,
  signInWithGoogleOAuth,
  signUpWithEmployeePassword,
} from "@/lib/authClient";
import type { RequestedRole } from "@/lib/authClient";
import { useCredential } from "@/lib/useCredential";

const REQUEST_ROLE_OPTIONS: Array<{ value: RequestedRole; label: string }> = [
  { value: "role1", label: "BIM Coord Pro" },
  { value: "role2", label: "HO" },
  { value: "role3", label: "BIM Manager" },
  { value: "viewer", label: "Auditor" },
];

export default function SignUpPage() {
  const router = useRouter();
  const credential = useCredential();
  const [name, setName] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [requestedRole, setRequestedRole] = useState<RequestedRole>("role1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isConfigured = isAuthConfigured();
  const isSignedIn = Boolean(credential.user_id);

  async function onSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("Password dan konfirmasi password harus sama.");
      return;
    }

    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await signUpWithEmployeePassword({
        name,
        employee_number: employeeNumber,
        password,
        requested_role: requestedRole,
      });
      setInfo("Akun berhasil dibuat. Menunggu assignment role dari admin.");
      await router.push("/auth/sign-in");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up gagal");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogleSignUp() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await signInWithGoogleOAuth({ requested_role: requestedRole });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google OAuth gagal");
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>Sign Up - BIM Scoring</title>
      </Head>
      <main className="task-shell auth-shell">
        <section className="task-panel">
          <h1>Sign Up</h1>
          <p className="task-subtitle">
            Buat akun pribadi dengan nama, nomor pegawai, dan password. Setelah itu akun masuk antrean assignment role
            oleh admin.
          </p>

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
                {credential.pending_role ? " Role masih menunggu assignment admin." : null}
              </p>
              <div className="wizard-actions">
                <Link href="/auth/sign-in" className="action-primary">
                  Kembali ke Sign In
                </Link>
              </div>
            </div>
          ) : (
            <div className="auth-stack">
              <form className="auth-stack" onSubmit={onSignUp}>
                <label className="auth-field">
                  Nama Lengkap
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Nama pegawai"
                    required
                  />
                </label>
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
                  Pengajuan Role
                  <select value={requestedRole} onChange={(event) => setRequestedRole(event.target.value as RequestedRole)}>
                    {REQUEST_ROLE_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="auth-field">
                  Password
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </label>
                <label className="auth-field">
                  Konfirmasi Password
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                  />
                </label>
                <button type="submit" className="primary-cta" disabled={busy || !isConfigured}>
                  {busy ? "Membuat akun..." : "Sign Up"}
                </button>
              </form>

              <div className="auth-divider">atau</div>

              <button type="button" className="primary-cta" onClick={() => void onGoogleSignUp()} disabled={busy || !isConfigured}>
                Daftar dengan Google
              </button>

              <p className="auth-helper">
                Sudah punya akun? <Link href="/auth/sign-in">Sign in di sini</Link>.
              </p>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
