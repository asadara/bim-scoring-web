import Link from "next/link";
import BackendStatusBanner from "@/components/BackendStatusBanner";
import { FEATURE_REAL_BACKEND_WRITE } from "@/lib/featureFlags";
import { getApiBaseUrlFromEnv, getAppEnvironment } from "@/lib/runtimeEnv";

export default function Home() {
  const appEnv = getAppEnvironment();
  const apiBaseUrl = getApiBaseUrlFromEnv();
  const connectionMode = FEATURE_REAL_BACKEND_WRITE ? "backend" : "prototype";

  return (
    <main className="task-shell landing-shell">
      <header className="task-header landing-hero">
        <p className="task-kicker">BIM Scoring Platform</p>
        <h1>Web Control Center</h1>
        <p className="task-subtitle">
          Platform berbasis evidence untuk menjaga scoring, review, approval, dan snapshot tetap konsisten serta
          dapat diaudit.
        </p>

        <div className="landing-chip-row">
          <span className="status-chip status-open">Environment: {appEnv}</span>
          <span className="status-chip status-na">API: {apiBaseUrl}</span>
        </div>

        <BackendStatusBanner mode={connectionMode} />

        <div className="wizard-actions landing-hero-actions">
          <Link href="/start">Start Here</Link>
          <Link className="primary-cta" href="/projects">
            Masuk Aplikasi
          </Link>
          <Link href="/ho/review">Buka HO Review</Link>
          <Link href="/approve">Buka Approvals</Link>
          <Link href="/audit">Buka Audit</Link>
        </div>
      </header>

      <section className="task-panel">
        <h2>Operational Workflow</h2>
        <div className="landing-grid">
          <article className="landing-card">
            <span>1. Evidence Capture</span>
            <strong>Draft dan submit evidence per indikator BIM Use.</strong>
          </article>
          <article className="landing-card">
            <span>2. HO Review</span>
            <strong>Reviewer memvalidasi kelayakan evidence secara organisasi.</strong>
          </article>
          <article className="landing-card">
            <span>3. Approval</span>
            <strong>Approver mengunci period dan membentuk snapshot immutable.</strong>
          </article>
          <article className="landing-card">
            <span>4. Audit Trail</span>
            <strong>Seluruh jejak keputusan dapat ditelusuri pada route audit.</strong>
          </article>
        </div>
      </section>

      <section className="task-panel">
        <h2>Role Entry Points</h2>
        <div className="task-grid-3">
          <article className="summary-card">
            <span>Role 1 (Project Team)</span>
            <div className="wizard-actions">
              <Link className="primary-cta" href="/projects">
                Open Role 1
              </Link>
            </div>
          </article>
          <article className="summary-card">
            <span>Role 2 (HO Reviewer)</span>
            <div className="wizard-actions">
              <Link className="primary-cta" href="/ho/review">
                Open Role 2
              </Link>
            </div>
          </article>
          <article className="summary-card">
            <span>Role 3 (Approver)</span>
            <div className="wizard-actions">
              <Link className="primary-cta" href="/approve">
                Open Role 3
              </Link>
            </div>
          </article>
          <article className="summary-card">
            <span>Auditor</span>
            <div className="wizard-actions">
              <Link className="primary-cta" href="/audit">
                Open Audit
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className="task-panel">
        <h2>Governance Notes</h2>
        <ul className="start-truths">
          <li>Scoring dihitung oleh engine backend dan tidak diproses di halaman landing.</li>
          <li>Snapshot bersifat immutable setelah approval period.</li>
          <li>Route audit dipertahankan untuk jejak keputusan append-only.</li>
        </ul>
      </section>
    </main>
  );
}
