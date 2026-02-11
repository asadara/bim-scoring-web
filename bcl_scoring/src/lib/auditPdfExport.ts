import { PrintableAuditSnapshot } from "@/lib/auditTaskLayer";

type PdfDoc = {
  internal: {
    pageSize: {
      getWidth: () => number;
      getHeight: () => number;
    };
  };
  addPage: () => void;
  setFont: (fontName: string, fontStyle?: string) => void;
  setFontSize: (fontSize: number) => void;
  text: (text: string | string[], x: number, y: number, options?: { maxWidth?: number }) => void;
  splitTextToSize: (text: string, size: number) => string[];
  output: (type: "blob") => Blob;
};

function ensurePageSpace(doc: PdfDoc, y: number, needed: number, marginBottom: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed <= pageHeight - marginBottom) return y;
  doc.addPage();
  return 48;
}

function drawParagraph(doc: PdfDoc, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const safeText = text || "Not available";
  const lines = doc.splitTextToSize(safeText, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function drawKeyValue(
  doc: PdfDoc,
  label: string,
  value: string,
  x: number,
  y: number,
  maxWidth: number
): number {
  const lineHeight = 14;
  doc.setFont("helvetica", "bold");
  const labelY = drawParagraph(doc, `${label}:`, x, y, maxWidth, lineHeight);
  doc.setFont("helvetica", "normal");
  const valueY = drawParagraph(doc, value, x + 118, y, maxWidth - 118, lineHeight);
  return Math.max(labelY, valueY);
}

export async function generateSnapshotPdfBlob(model: PrintableAuditSnapshot): Promise<Blob> {
  const jspdfModule = await import("jspdf");
  const doc = new jspdfModule.jsPDF({
    unit: "pt",
    format: "a4",
  }) as unknown as PdfDoc;

  const marginX = 40;
  const marginBottom = 40;
  const contentWidth = doc.internal.pageSize.getWidth() - marginX * 2;
  let y = 48;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  y = drawParagraph(doc, model.title, marginX, y, contentWidth, 20);

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  y = drawParagraph(doc, model.disclaimer, marginX, y, contentWidth, 14);
  y += 10;

  y = ensurePageSpace(doc, y, 120, marginBottom);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  y = drawParagraph(doc, "1) Snapshot Header", marginX, y, contentWidth, 16);
  y += 4;
  doc.setFontSize(11);
  y = drawKeyValue(doc, "Project name", model.snapshot_header.project_name, marginX, y, contentWidth);
  y = drawKeyValue(doc, "Project ID", model.snapshot_header.project_id, marginX, y + 2, contentWidth);
  y = drawKeyValue(doc, "Period ID", model.snapshot_header.period_id, marginX, y + 2, contentWidth);
  y = drawKeyValue(doc, "Approved by", model.snapshot_header.approved_by, marginX, y + 2, contentWidth);
  y = drawKeyValue(doc, "Approved at", model.snapshot_header.approved_at, marginX, y + 2, contentWidth);
  y = drawKeyValue(doc, "Lock status", model.snapshot_header.lock_status, marginX, y + 2, contentWidth);
  y = drawKeyValue(doc, "Snapshot ID", model.snapshot_header.snapshot_id, marginX, y + 2, contentWidth);
  y += 10;

  y = ensurePageSpace(doc, y, 140, marginBottom);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  y = drawParagraph(doc, "2) Final Score (Read-only)", marginX, y, contentWidth, 16);
  y += 4;
  doc.setFontSize(11);
  y = drawKeyValue(doc, "Total score", model.final_score.total_score, marginX, y, contentWidth);
  y += 2;
  doc.setFont("helvetica", "bold");
  y = drawParagraph(doc, "Breakdown", marginX, y, contentWidth, 14);
  doc.setFont("helvetica", "normal");
  for (const row of model.final_score.breakdown) {
    y = ensurePageSpace(doc, y, 28, marginBottom);
    y = drawParagraph(
      doc,
      `${row.perspective_id} | Score: ${row.score} | Weight: ${row.weight}`,
      marginX + 12,
      y,
      contentWidth - 12,
      14
    );
  }
  y += 10;

  y = ensurePageSpace(doc, y, 100, marginBottom);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  y = drawParagraph(doc, "3) Evidence Review Counts", marginX, y, contentWidth, 16);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  y = drawParagraph(doc, `ACCEPTABLE: ${model.evidence_review_counts.acceptable}`, marginX, y, contentWidth, 14);
  y = drawParagraph(
    doc,
    `NEEDS REVISION: ${model.evidence_review_counts.needs_revision}`,
    marginX,
    y,
    contentWidth,
    14
  );
  y = drawParagraph(doc, `REJECTED: ${model.evidence_review_counts.rejected}`, marginX, y, contentWidth, 14);
  y = drawParagraph(
    doc,
    `Awaiting review: ${model.evidence_review_counts.awaiting_review}`,
    marginX,
    y,
    contentWidth,
    14
  );
  y += 10;

  y = ensurePageSpace(doc, y, 220, marginBottom);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  y = drawParagraph(doc, "4) Narrative Audit Trail", marginX, y, contentWidth, 16);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  model.narrative_audit_trail.forEach((stage, index) => {
    y = ensurePageSpace(doc, y, 70, marginBottom);
    doc.setFont("helvetica", "bold");
    y = drawParagraph(doc, `${index + 1}. ${stage.title}`, marginX, y, contentWidth, 14);
    doc.setFont("helvetica", "normal");
    y = drawParagraph(doc, `Role: ${stage.role}`, marginX + 10, y, contentWidth - 10, 14);
    y = drawParagraph(doc, `Meaning: ${stage.meaning}`, marginX + 10, y, contentWidth - 10, 14);
    y = drawParagraph(doc, `NOT done: ${stage.not_done}`, marginX + 10, y, contentWidth - 10, 14);
    y += 4;
  });
  y += 8;

  y = ensurePageSpace(doc, y, 220, marginBottom);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  y = drawParagraph(doc, "5) ISO 19650 Reference Mapping (Indicative)", marginX, y, contentWidth, 16);
  y += 4;
  doc.setFontSize(11);
  y = drawParagraph(doc, model.iso_mapping.label, marginX, y, contentWidth, 14);
  y += 2;
  doc.setFont("helvetica", "normal");
  for (const row of model.iso_mapping.rows) {
    y = ensurePageSpace(doc, y, 60, marginBottom);
    doc.setFont("helvetica", "bold");
    y = drawParagraph(doc, row.control_area, marginX, y, contentWidth, 14);
    doc.setFont("helvetica", "normal");
    y = drawParagraph(doc, `ISO Reference: ${row.iso_reference}`, marginX + 10, y, contentWidth - 10, 14);
    y = drawParagraph(
      doc,
      `Indicative Mapping: ${row.indicative_mapping}`,
      marginX + 10,
      y,
      contentWidth - 10,
      14
    );
    y += 4;
  }

  return doc.output("blob");
}
