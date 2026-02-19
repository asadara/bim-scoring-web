import { buildApiUrl } from "@/lib/http";

export type Role2ProposalType = "BIM_USE_CREATE" | "BIM_USE_MAPPING_UPDATE";
export type Role2ProposalStatus = "PENDING" | "APPROVED" | "REJECTED";

export type Role2BimUseProposal = {
  id: string;
  requester_user_id: string;
  requester_role: string | null;
  project_id: string | null;
  proposal_type: Role2ProposalType | string;
  proposed_bim_use: string | null;
  indicator_ids: string[];
  reason: string;
  status: Role2ProposalStatus | string;
  decision_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type RequestActor = {
  actorId: string;
  actorRole: string;
};

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const out = value.trim();
  return out ? out : null;
}

async function requestProposalApi<T>(
  actor: RequestActor,
  path: string,
  init?: RequestInit
): Promise<T> {
  const headers = new Headers(init?.headers || {});
  headers.set("content-type", "application/json");
  headers.set("x-actor-id", actor.actorId);
  headers.set("x-actor-role", actor.actorRole);

  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers,
  });
  const raw = await response.text();
  const payload = raw.trim() ? (JSON.parse(raw) as unknown) : null;
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const message = (() => {
    const error = root.error;
    if (typeof error === "string") return error;
    if (error && typeof error === "object") {
      return toNonEmptyString((error as Record<string, unknown>).message) || toNonEmptyString((error as Record<string, unknown>).code);
    }
    return null;
  })();

  if (!response.ok || root.ok === false) {
    throw new Error(message || `${response.status} ${response.statusText}`);
  }

  if (Object.prototype.hasOwnProperty.call(root, "data")) {
    return root.data as T;
  }
  return payload as T;
}

export async function listRole2BimUseProposals(actor: RequestActor): Promise<Role2BimUseProposal[]> {
  return await requestProposalApi<Role2BimUseProposal[]>(actor, "/role2/bim-use-proposals");
}

export async function submitRole2BimUseProposal(
  actor: RequestActor,
  input: {
    project_id: string;
    proposal_type: Role2ProposalType;
    proposed_bim_use?: string | null;
    indicator_ids?: string[];
    reason: string;
  }
): Promise<Role2BimUseProposal> {
  return await requestProposalApi<Role2BimUseProposal>(actor, "/role2/bim-use-proposals", {
    method: "POST",
    body: JSON.stringify({
      project_id: input.project_id,
      proposal_type: input.proposal_type,
      proposed_bim_use: toNonEmptyString(input.proposed_bim_use),
      indicator_ids: Array.isArray(input.indicator_ids) ? input.indicator_ids : [],
      reason: input.reason,
    }),
  });
}

