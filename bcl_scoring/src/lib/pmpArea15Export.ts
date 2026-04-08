import { PmpArea15ComplianceSummary } from "@/lib/approverTaskLayer";

type PmpArea15WorkbookInput = {
  summary: PmpArea15ComplianceSummary;
  project_label: string;
  project_id: string;
  period_label: string | null;
  period_id: string | null;
  snapshot_id?: string | null;
};

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function safeFileSegment(value: string | null | undefined): string {
  return String(value || "na")
    .trim()
    .replace(/[^a-z0-9-_]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "na";
}

export async function exportPmpArea15Workbook(input: PmpArea15WorkbookInput): Promise<string> {
  const XLSX = await import("xlsx");

  const overviewRows = [
    ["Field", "Value"],
    ["Project", input.project_label],
    ["Project ID", input.project_id],
    ["Period", input.period_label || "N/A"],
    ["Period ID", input.period_id || "N/A"],
    ["Snapshot ID", input.snapshot_id || "N/A"],
    ["Bridge version", input.summary.version || "N/A"],
    ["Source of truth", input.summary.source_of_truth || "bim_scoring"],
    ["Overall status", input.summary.overall_status],
    ["Overall export status", input.summary.overall_export_status],
    ["Overall score", input.summary.overall_score_100 ?? "N/A"],
    ["Total BIM score", input.summary.total_bim_score_100 ?? "N/A"],
    ["Export ready", input.summary.export_ready ? "YES" : "NO"],
    ["Hold point ready", input.summary.hold_point_ready ? "YES" : "NO"],
    ["Configured controls", input.summary.mapping_status.configured_control_count],
    ["Mapped controls", input.summary.mapping_status.mapped_control_count],
    ["Unmapped controls", input.summary.mapping_status.unmapped_control_count],
    ["Intent", input.summary.intent || "N/A"],
  ];

  const phaseRows = input.summary.phase_summaries.map((phase) => ({
    phase: phase.phase,
    status: phase.status,
    export_status: phase.export_status,
    score_100: phase.score_100,
    mandatory_count: phase.mandatory_count,
    mapped_count: phase.mapped_count,
    ok_count: phase.ok_count,
    minor_count: phase.minor_count,
    not_ok_count: phase.not_ok_count,
    incomplete_count: phase.incomplete_count,
    not_mapped_count: phase.not_mapped_count,
  }));

  const controlRows = input.summary.controls.map((control) => ({
    control_id: control.control_id,
    phase: control.phase,
    title: control.title,
    description: control.description || "",
    mandatory: control.mandatory ? "YES" : "NO",
    status: control.status,
    export_status: control.export_status,
    score_100: control.score_100,
    average_score_0_5: control.average_score_0_5,
    matched_indicator_count: control.matched_indicator_count,
    scored_indicator_count: control.scored_indicator_count,
    evidence_ready_count: control.evidence_ready_count,
    blockers: control.blockers.join("; "),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(overviewRows), "PMP15 Overview");
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(phaseRows.length > 0 ? phaseRows : [{ phase: "N/A" }]),
    "PMP15 Phases"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(controlRows.length > 0 ? controlRows : [{ control_id: "N/A" }]),
    "PMP15 Controls"
  );

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const fileName = [
    "pmp-area15",
    safeFileSegment(input.project_id),
    safeFileSegment(input.period_id || input.period_label || "period"),
  ].join("-") + ".xlsx";

  downloadBlob(blob, fileName);
  return fileName;
}
