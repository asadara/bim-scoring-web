import Link from "next/link";

import {
  PmpArea15ComplianceSummary,
  PmpArea15ControlSummary,
} from "@/lib/approverTaskLayer";

type PmpArea15ActionListProps = {
  projectId: string;
  summary: PmpArea15ComplianceSummary | null;
};

type ActionTone = "critical" | "warning" | "info";

type ActionItem = {
  key: string;
  tone: ActionTone;
  title: string;
  detail: string;
  href: string | null;
  hrefLabel: string | null;
  meta: string;
};

function formatPhaseLabel(value: string): string {
  const text = String(value || "").replace(/_/g, " ").trim();
  if (!text) return "Unspecified phase";
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatControlMeta(control: PmpArea15ControlSummary): string {
  const parts = [
    formatPhaseLabel(control.phase),
    `status ${control.status}`,
    `score ${control.score_100 ?? "N/A"}`,
  ];
  return parts.join(" | ");
}

function mapControlToActionItem(projectId: string, control: PmpArea15ControlSummary): ActionItem | null {
  const blockers = new Set(control.blockers);
  const meta = formatControlMeta(control);

  if (blockers.has("NO_INDICATOR_MAPPING")) {
    return {
      key: `${control.control_id}-no-mapping`,
      tone: "critical",
      title: `${control.title} belum terhubung ke BIM Scoring`,
      detail:
        "Kontrol PMP ini belum memiliki mapping indikator. Bridge governance belum bisa membuktikan kontrol ini sampai config project dilengkapi.",
      href: null,
      hrefLabel: null,
      meta,
    };
  }

  if (blockers.has("MAPPING_BELOW_MINIMUM")) {
    return {
      key: `${control.control_id}-mapping-minimum`,
      tone: "warning",
      title: `${control.title} belum memenuhi cakupan minimum`,
      detail:
        "Indikator yang terhubung ke kontrol ini belum cukup untuk memenuhi requirement minimum PMP. Tambahkan mapping indikator atau revisi baseline control.",
      href: null,
      hrefLabel: null,
      meta,
    };
  }

  if (blockers.has("EVIDENCE_NOT_READY")) {
    return {
      key: `${control.control_id}-evidence`,
      tone: "critical",
      title: `${control.title} masih tertahan evidence`,
      detail:
        "Evidence mandatory belum siap untuk semua indikator yang dipakai kontrol ini. Lengkapi upload atau revisi evidence sebelum export dan hold point.",
      href: `/projects/${projectId}/evidence/add`,
      hrefLabel: "Tambah evidence",
      meta,
    };
  }

  if (blockers.has("UNSCORED_INDICATORS")) {
    return {
      key: `${control.control_id}-unscored`,
      tone: "warning",
      title: `${control.title} masih memiliki indikator belum terskor`,
      detail:
        "Sebagian indikator yang sudah mapped belum menghasilkan score final. Pastikan evidence sudah diajukan dan diproses sampai scoring lengkap.",
      href: `/projects/${projectId}/evidence`,
      hrefLabel: "Lihat daftar evidence",
      meta,
    };
  }

  if (control.status === "NOT_OK") {
    return {
      key: `${control.control_id}-not-ok`,
      tone: "warning",
      title: `${control.title} belum memenuhi ambang PMP`,
      detail:
        "Kontrol ini sudah mapped dan terskor, tetapi nilainya masih di bawah threshold minimum. Perlu peningkatan implementasi atau penguatan evidence pendukung.",
      href: `/projects/${projectId}/evidence`,
      hrefLabel: "Tinjau evidence",
      meta,
    };
  }

  if (control.status === "INCOMPLETE") {
    return {
      key: `${control.control_id}-incomplete`,
      tone: "info",
      title: `${control.title} masih belum lengkap`,
      detail:
        "Bridge PMP menandai kontrol ini belum lengkap. Tinjau scoring dan evidence sampai status kontrol tidak lagi INCOMPLETE.",
      href: `/projects/${projectId}/evidence`,
      hrefLabel: "Buka evidence",
      meta,
    };
  }

  return null;
}

function buildActionItems(projectId: string, summary: PmpArea15ComplianceSummary | null): ActionItem[] {
  if (!summary) return [];

  const items = summary.controls
    .map((control) => mapControlToActionItem(projectId, control))
    .filter((item): item is ActionItem => Boolean(item));

  const toneRank: Record<ActionTone, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  return items.sort((a, b) => toneRank[a.tone] - toneRank[b.tone] || a.title.localeCompare(b.title));
}

export default function PmpArea15ActionList({ projectId, summary }: PmpArea15ActionListProps) {
  const items = buildActionItems(projectId, summary);

  if (!summary) {
    return (
      <section className="task-panel">
        <h2>PMP Action List</h2>
        <p className="warning-box">
          Bridge PMP Area 15 belum tersedia, jadi action list otomatis belum dapat dibentuk dari BIM Scoring.
        </p>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="task-panel">
        <h2>PMP Action List</h2>
        <p className="task-note">
          Tidak ada blocker PMP Area 15 yang perlu ditindak dari workspace ini. Bridge saat ini tidak menemukan control
          gap yang perlu diangkat sebagai action item.
        </p>
      </section>
    );
  }

  return (
    <section className="task-panel">
      <h2>PMP Action List</h2>
      <p className="task-note">
        Daftar ini diturunkan otomatis dari blocker bridge PMP Area 15, agar tim project fokus menutup gap tanpa
        mengisi form governance terpisah.
      </p>
      <div className="pmp-action-list">
        {items.map((item) => (
          <article
            key={item.key}
            className={`pmp-action-card pmp-action-card-${item.tone}`}
          >
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
            <small>{item.meta}</small>
            {item.href && item.hrefLabel ? (
              <div className="pmp-action-links">
                <Link href={item.href}>{item.hrefLabel}</Link>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
