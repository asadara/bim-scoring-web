import { PmpArea15ComplianceSummary } from "@/lib/approverTaskLayer";

type CellValue = string | number | boolean | null | undefined;

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

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodeUtf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function escapeXml(value: CellValue): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(index: number): string {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function objectRowsToSheetRows(rows: Array<Record<string, CellValue>>, fallback: Record<string, CellValue>): CellValue[][] {
  const sourceRows = rows.length > 0 ? rows : [fallback];
  const headers = Object.keys(sourceRows[0]);
  return [
    headers,
    ...sourceRows.map((row) => headers.map((header) => row[header])),
  ];
}

function buildSheetXml(rows: CellValue[][]): string {
  const body = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, cellIndex) => {
          const ref = `${columnName(cellIndex)}${rowIndex + 1}`;
          if (typeof cell === "number" && Number.isFinite(cell)) {
            return `<c r="${ref}"><v>${cell}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${body}</sheetData>
</worksheet>`;
}

function pushUint16(bytes: number[], value: number) {
  bytes.push(value & 0xff, (value >>> 8) & 0xff);
}

function pushUint32(bytes: number[], value: number) {
  bytes.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function toZip(parts: Array<{ path: string; content: string }>): Blob {
  const chunks: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;

  for (const part of parts) {
    const nameBytes = encodeUtf8(part.path);
    const dataBytes = encodeUtf8(part.content);
    const checksum = crc32(dataBytes);
    const localHeader: number[] = [];
    pushUint32(localHeader, 0x04034b50);
    pushUint16(localHeader, 20);
    pushUint16(localHeader, 0);
    pushUint16(localHeader, 0);
    pushUint16(localHeader, 0);
    pushUint16(localHeader, 33);
    pushUint32(localHeader, checksum);
    pushUint32(localHeader, dataBytes.length);
    pushUint32(localHeader, dataBytes.length);
    pushUint16(localHeader, nameBytes.length);
    pushUint16(localHeader, 0);
    const localHeaderBytes = new Uint8Array([...localHeader, ...nameBytes]);
    chunks.push(localHeaderBytes, dataBytes);

    const centralHeader: number[] = [];
    pushUint32(centralHeader, 0x02014b50);
    pushUint16(centralHeader, 20);
    pushUint16(centralHeader, 20);
    pushUint16(centralHeader, 0);
    pushUint16(centralHeader, 0);
    pushUint16(centralHeader, 0);
    pushUint16(centralHeader, 33);
    pushUint32(centralHeader, checksum);
    pushUint32(centralHeader, dataBytes.length);
    pushUint32(centralHeader, dataBytes.length);
    pushUint16(centralHeader, nameBytes.length);
    pushUint16(centralHeader, 0);
    pushUint16(centralHeader, 0);
    pushUint16(centralHeader, 0);
    pushUint16(centralHeader, 0);
    pushUint32(centralHeader, 0);
    pushUint32(centralHeader, offset);
    centralDirectory.push(new Uint8Array([...centralHeader, ...nameBytes]));

    offset += localHeaderBytes.length + dataBytes.length;
  }

  const centralOffset = offset;
  const centralSize = centralDirectory.reduce((total, chunk) => total + chunk.length, 0);
  chunks.push(...centralDirectory);

  const endRecord: number[] = [];
  pushUint32(endRecord, 0x06054b50);
  pushUint16(endRecord, 0);
  pushUint16(endRecord, 0);
  pushUint16(endRecord, parts.length);
  pushUint16(endRecord, parts.length);
  pushUint32(endRecord, centralSize);
  pushUint32(endRecord, centralOffset);
  pushUint16(endRecord, 0);
  chunks.push(new Uint8Array(endRecord));

  const blobParts: BlobPart[] = chunks.map((chunk) => {
    const copy = new Uint8Array(chunk.byteLength);
    copy.set(chunk);
    return copy.buffer as ArrayBuffer;
  });
  return new Blob(blobParts, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function buildWorkbookBlob(sheets: Array<{ name: string; rows: CellValue[][] }>): Blob {
  const worksheetParts = sheets.map((sheet, index) => ({
    path: `xl/worksheets/sheet${index + 1}.xml`,
    content: buildSheetXml(sheet.rows),
  }));
  const sheetDefinitions = sheets
    .map(
      (sheet, index) =>
        `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
    )
    .join("");
  const sheetRelationships = sheets
    .map(
      (_sheet, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
    )
    .join("");
  const contentTypeOverrides = sheets
    .map(
      (_sheet, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join("");

  return toZip([
    {
      path: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${contentTypeOverrides}
</Types>`,
    },
    {
      path: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      path: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetDefinitions}</sheets>
</workbook>`,
    },
    {
      path: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheetRelationships}
</Relationships>`,
    },
    ...worksheetParts,
  ]);
}

export async function exportPmpArea15Workbook(input: PmpArea15WorkbookInput): Promise<string> {
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

  const blob = buildWorkbookBlob([
    { name: "PMP15 Overview", rows: overviewRows },
    { name: "PMP15 Phases", rows: objectRowsToSheetRows(phaseRows, { phase: "N/A" }) },
    { name: "PMP15 Controls", rows: objectRowsToSheetRows(controlRows, { control_id: "N/A" }) },
  ]);

  const fileName = [
    "pmp-area15",
    safeFileSegment(input.project_id),
    safeFileSegment(input.period_id || input.period_label || "period"),
  ].join("-") + ".xlsx";

  downloadBlob(blob, fileName);
  return fileName;
}
