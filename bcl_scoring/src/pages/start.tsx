import Link from "next/link";

export default function StartHerePage() {
  return (
    <main className="task-shell">
      <header className="task-header">
        <p className="task-kicker">BIM Scoring Platform</p>
        <h1>Start Here</h1>
        <p className="task-subtitle">Jawaban ringkas untuk pertanyaan: mulai dari mana?</p>
      </header>

      <section className="task-panel">
        <h2>4 Langkah Mulai</h2>
        <ol className="start-steps">
          <li>Pilih Proyek &amp; Periode</li>
          <li>Mulai dari BIM Use - pilih indikator</li>
          <li>Submit Evidence (Draft -&gt; Submitted)</li>
          <li>HO Review -&gt; Approval -&gt; Snapshot (read-only)</li>
        </ol>
      </section>

      <section className="task-panel">
        <h2>Role Entry</h2>
        <div className="task-grid-3">
          <article className="summary-card">
            <span>Role 1 (Project)</span>
            <div className="wizard-actions">
              <Link className="primary-cta" href="/projects">
                Masuk Role 1
              </Link>
            </div>
          </article>

          <article className="summary-card">
            <span>Role 2 (HO Reviewer)</span>
            <div className="wizard-actions">
              <Link className="primary-cta" href="/ho/review">
                Masuk Role 2
              </Link>
            </div>
          </article>

          <article className="summary-card">
            <span>Role 3 (Approver)</span>
            <div className="wizard-actions">
              <Link className="primary-cta" href="/approve">
                Masuk Role 3
              </Link>
            </div>
          </article>

          <article className="summary-card">
            <span>Auditor</span>
            <div className="wizard-actions">
              <Link className="primary-cta" href="/audit">
                Masuk Auditor
              </Link>
            </div>
          </article>

          <article className="summary-card">
            <span>Admin Control</span>
            <div className="wizard-actions">
              <Link className="primary-cta" href="/admin">
                Masuk Admin
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className="task-panel">
        <h2>Kebenaran Dasar</h2>
        <ul className="start-truths">
          <li>Evidence tidak otomatis mengubah skor.</li>
          <li>Review menetapkan kelayakan evidence, bukan approval period.</li>
          <li>Approval mengunci period dan membentuk snapshot immutable.</li>
        </ul>
      </section>
    </main>
  );
}
