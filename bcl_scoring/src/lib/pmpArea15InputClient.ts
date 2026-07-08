import { buildApiUrl, safeFetchJson, toUserFacingSafeFetchError } from "@/lib/http";

export type PmpArea15InputRow = {
  id: string | null;
  project_id: string | null;
  period_id: string | null;
  score_0_5: number | null;
  score_100: number | null;
  status: string | null;
  source_reference: string | null;
  notes: string | null;
  input_by: string | null;
  input_at: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type PmpArea15InputListResult = {
  rows: PmpArea15InputRow[];
  table_ready: boolean;
};

function safeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const out = value.trim();
  return out || null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function toInputRow(value: unknown): PmpArea15InputRow {
  const item = safeObject(value);
  return {
    id: asString(item.id),
    project_id: asString(item.project_id),
    period_id: asString(item.period_id),
    score_0_5: asNumber(item.score_0_5),
    score_100: asNumber(item.score_100),
    status: asString(item.status),
    source_reference: asString(item.source_reference),
    notes: asString(item.notes),
    input_by: asString(item.input_by),
    input_at: asString(item.input_at),
    created_by: asString(item.created_by),
    created_at: asString(item.created_at),
    updated_at: asString(item.updated_at),
  };
}

function endpoint(projectId: string, periodId: string): string {
  return `/projects/${encodeURIComponent(projectId)}/periods/${encodeURIComponent(periodId)}/pmp-area15-inputs`;
}

export async function listPmpArea15Inputs(
  projectId: string,
  periodId: string
): Promise<PmpArea15InputListResult> {
  const result = await safeFetchJson<unknown>(buildApiUrl(`${endpoint(projectId, periodId)}?limit=10`));
  if (!result.ok) {
    throw new Error(toUserFacingSafeFetchError(result, "Gagal memuat input PMP Area 15."));
  }

  const root = safeObject(result.data);
  const rows = Array.isArray(root.data) ? root.data.map(toInputRow) : [];
  const meta = safeObject(root.meta);
  return {
    rows,
    table_ready: meta.table_ready !== false,
  };
}

export async function submitPmpArea15Input(
  projectId: string,
  periodId: string,
  input: {
    score_0_5: number;
    status: string;
    source_reference?: string | null;
    notes?: string | null;
  }
): Promise<PmpArea15InputRow> {
  const result = await safeFetchJson<unknown>(buildApiUrl(endpoint(projectId, periodId)), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!result.ok) {
    throw new Error(toUserFacingSafeFetchError(result, "Gagal menyimpan input PMP Area 15."));
  }

  const root = safeObject(result.data);
  return toInputRow(root.data || result.data);
}
