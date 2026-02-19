import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  isAuthConfigured,
  signInWithGoogleOAuth,
  signUpWithEmployeePassword,
} from "@/lib/authClient";
import type { RequestedRole } from "@/lib/authClient";
import { buildApiUrl, safeFetchJson } from "@/lib/http";
import { useCredential } from "@/lib/useCredential";

const REQUEST_ROLE_OPTIONS: Array<{ value: RequestedRole; label: string }> = [
  { value: "role1", label: "BIM Coord Pro" },
  { value: "role2", label: "HO" },
  { value: "role3", label: "BIM Manager" },
  { value: "viewer", label: "Auditor" },
];

type ProjectOption = {
  id: string;
  code?: string | null;
  name?: string | null;
  is_active?: boolean | null;
};

function toSingleLine(text: string | null | undefined): string {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function projectLabel(project: ProjectOption): string {
  const code = toSingleLine(project.code);
  const name = toSingleLine(project.name);
  if (code && name && !name.toLowerCase().startsWith(code.toLowerCase())) {
    return `${code} - ${name}`;
  }
  return name || code || project.id;
}

export default function SignUpPage() {
  const router = useRouter();
  const credential = useCredential();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [requestedRole, setRequestedRole] = useState<RequestedRole>("role1");
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [projectLoadError, setProjectLoadError] = useState<string | null>(null);

  const isConfigured = isAuthConfigured();
  const isSignedIn = Boolean(credential.user_id);
  const requiresScope = requestedRole === "role2";

  const activeProjectOptions = useMemo(() => {
    return projectOptions
      .filter((item) => item.is_active !== false)
      .sort((a, b) => String(a.name || a.code || a.id).localeCompare(String(b.name || b.code || b.id)));
  }, [projectOptions]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const result = await safeFetchJson<unknown>(buildApiUrl("/projects"));
      if (!mounted) return;
      if (!result.ok) {
        setProjectOptions([]);
        setProjectLoadError(result.error || "Gagal memuat daftar project");
        return;
      }
      const root = result.data && typeof result.data === "object" ? (result.data as Record<string, unknown>) : {};
      const rows = Array.isArray(root.data) ? (root.data as ProjectOption[]) : [];
      setProjectOptions(rows);
      setProjectLoadError(null);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  function toggleProjectScope(projectId: string) {
    setSelectedProjectIds((prev) => {
      if (prev.includes(projectId)) return prev.filter((item) => item !== projectId);
      return [...prev, projectId];
    });
  }

  async function onSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("Password dan konfirmasi password harus sama.");
      return;
    }
    if (requiresScope && selectedProjectIds.length === 0) {
      setError("Untuk pengajuan role HO, pilih minimal 1 project scope.");
      return;
    }

    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const result = await signUpWithEmployeePassword({
        name,
        email,
        employee_number: employeeNumber,
        password,
        requested_role: requestedRole,
        requested_project_ids: selectedProjectIds,
      });
      if (result.requires_email_verification) {
        if (result.likely_new_registration) {
          setInfo(
            "Pendaftaran berhasil. Cek email Anda untuk verifikasi akun, lalu lanjut Sign In."
          );
        } else {
          setInfo(
            "Permintaan pendaftaran diterima. Jika email sudah terdaftar, gunakan Sign In atau cek email verifikasi terakhir."
          );
        }
        return;
      }

      setInfo("Akun berhasil dibuat. Menunggu assignment role dari admin.");
      await router.push("/auth/sign-in");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up gagal");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogleSignUp() {
    if (requiresScope && selectedProjectIds.length === 0) {
      setError("Untuk pengajuan role HO, pilih minimal 1 project scope.");
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await signInWithGoogleOAuth({
        requested_role: requestedRole,
        requested_project_ids: selectedProjectIds,
      });
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
            Buat akun pribadi dengan nama, email, nomor pegawai, dan password. Setelah itu akun masuk antrean assignment role
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
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="nama@domain.com"
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
                <fieldset className="auth-fieldset">
                  <legend>Default Scope Project (Pengajuan)</legend>
                  <p className="auth-hint">
                    {requiresScope
                      ? "Role HO wajib memilih minimal 1 project. Scope akhir tetap diputuskan Admin."
                      : "Opsional. Bisa dipakai sebagai preferensi saat admin assign role."}
                  </p>
                  {projectLoadError ? <p className="error-box">{projectLoadError}</p> : null}
                  {activeProjectOptions.length === 0 ? (
                    <p className="auth-hint">Belum ada project aktif.</p>
                  ) : (
                    <div className="auth-checkbox-grid">
                      {activeProjectOptions.map((project) => (
                        <label key={project.id} className="auth-checkbox-item">
                          <input
                            type="checkbox"
                            checked={selectedProjectIds.includes(project.id)}
                            onChange={() => toggleProjectScope(project.id)}
                          />
                          <span className="auth-checkbox-label" title={projectLabel(project)}>
                            {projectLabel(project)}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>
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
