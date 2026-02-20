import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  isAuthConfigured,
  signUpWithEmployeePassword,
} from "@/lib/authClient";
import type { RequestedRole } from "@/lib/authClient";
import { buildApiUrl, safeFetchJson, toUserFacingErrorMessage, toUserFacingSafeFetchError } from "@/lib/http";
import { useCredential } from "@/lib/useCredential";

const REQUEST_ROLE_OPTIONS: Array<{ value: RequestedRole; label: string }> = [
  { value: "role1", label: "BIM Coordinator Project" },
  { value: "role2", label: "BIM Coordinator HO" },
  { value: "role3", label: "BIM Manager" },
  { value: "viewer", label: "Viewer / Auditor" },
];
const AUTH_RATE_LIMIT_COOLDOWN_SECONDS = 75;

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

function EyeIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M2 12c2.6-4.2 6.1-6.3 10-6.3s7.4 2.1 10 6.3c-2.6 4.2-6.1 6.3-10 6.3S4.6 16.2 2 12z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M2 12c2.6-4.2 6.1-6.3 10-6.3 1.8 0 3.5.5 5.1 1.5m2.1 1.8c1 1 1.9 2.2 2.8 3.7-2.6 4.2-6.1 6.3-10 6.3-1.8 0-3.5-.5-5.1-1.5M4.9 15.4A17.4 17.4 0 0 1 2 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M3 3l18 18" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export default function SignUpPage() {
  const router = useRouter();
  const credential = useCredential();
  const submitGuardRef = useRef(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [requestedRole, setRequestedRole] = useState<RequestedRole>("role1");
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [projectLoadError, setProjectLoadError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const isConfigured = isAuthConfigured();
  const isSignedIn = Boolean(credential.user_id);
  const requiresScope = requestedRole === "role2";
  const isViewerRequest = requestedRole === "viewer";

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
        setProjectLoadError(toUserFacingSafeFetchError(result, "Gagal memuat daftar project."));
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

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  function toggleProjectScope(projectId: string) {
    setSelectedProjectIds((prev) => {
      if (prev.includes(projectId)) return prev.filter((item) => item !== projectId);
      return [...prev, projectId];
    });
  }

  async function onSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitGuardRef.current || busy) return;
    if (cooldownSeconds > 0) {
      setError(`Terlalu banyak percobaan. Coba lagi dalam ${cooldownSeconds} detik.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Password dan konfirmasi password harus sama.");
      return;
    }
    if (requiresScope && selectedProjectIds.length === 0) {
      setError("Untuk pengajuan role BIM Coordinator HO, pilih minimal 1 scope project.");
      return;
    }

    submitGuardRef.current = true;
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
            "Pendaftaran berhasil. Cek email Anda untuk verifikasi akun, lalu lanjut masuk."
          );
        } else {
          setInfo(
            "Permintaan pendaftaran diterima. Jika email sudah terdaftar, gunakan masuk atau cek email verifikasi terakhir."
          );
        }
        return;
      }

      setInfo("Akun berhasil dibuat. Menunggu penetapan role dari admin.");
      await router.push("/auth/sign-in");
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : "";
      const message = toUserFacingErrorMessage(err, "Pendaftaran gagal.");
      if (/rate limit|too many requests|over_email_send_rate_limit|429/i.test(rawMessage)) {
        setCooldownSeconds(AUTH_RATE_LIMIT_COOLDOWN_SECONDS);
        setError(
          `Batas kirim email tercapai. Tunggu ${AUTH_RATE_LIMIT_COOLDOWN_SECONDS} detik, lalu coba lagi.`
        );
      } else {
        setError(message);
      }
    } finally {
      submitGuardRef.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>Daftar - BIM Scoring</title>
      </Head>
      <main className="task-shell auth-shell">
        <section className="task-panel">
          <h1>Daftar</h1>
          <p className="task-subtitle">
            Buat akun pribadi dengan nama, email, nomor pegawai, dan password. Setelah itu akun masuk antrean penetapan role
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
                {credential.pending_role ? " Role masih menunggu penetapan admin." : null}
              </p>
              <div className="wizard-actions">
                <Link href="/auth/sign-in" className="action-primary">
                  Kembali ke Masuk
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
                  <legend>Scope Project Default (Pengajuan)</legend>
                  <p className="auth-hint">
                    {requiresScope
                      ? "Role BIM Coordinator HO wajib memilih minimal 1 project. Scope akhir tetap diputuskan admin."
                      : isViewerRequest
                        ? "Viewer / Auditor memiliki akses read-only ke halaman Audit."
                        : "Opsional. Bisa dipakai sebagai preferensi saat admin menetapkan role."}
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
                  <div className="auth-password-wrap">
                    <input
                      type={passwordVisible ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => setPasswordVisible((prev) => !prev)}
                      aria-label={passwordVisible ? "Sembunyikan password" : "Tampilkan password"}
                      title={passwordVisible ? "Sembunyikan password" : "Tampilkan password"}
                    >
                      <EyeIcon visible={passwordVisible} />
                    </button>
                  </div>
                </label>
                <label className="auth-field">
                  Konfirmasi Password
                  <div className="auth-password-wrap">
                    <input
                      type={confirmPasswordVisible ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => setConfirmPasswordVisible((prev) => !prev)}
                      aria-label={confirmPasswordVisible ? "Sembunyikan konfirmasi password" : "Tampilkan konfirmasi password"}
                      title={confirmPasswordVisible ? "Sembunyikan konfirmasi password" : "Tampilkan konfirmasi password"}
                    >
                      <EyeIcon visible={confirmPasswordVisible} />
                    </button>
                  </div>
                </label>
                <button
                  type="submit"
                  className="primary-cta"
                  disabled={busy || !isConfigured || cooldownSeconds > 0}
                >
                  {busy
                    ? "Membuat akun..."
                    : cooldownSeconds > 0
                      ? `Tunggu ${cooldownSeconds} dtk`
                      : "Daftar"}
                </button>
              </form>

              <p className="auth-helper">
                Sudah punya akun? <Link href="/auth/sign-in">Masuk di sini</Link>.
              </p>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
