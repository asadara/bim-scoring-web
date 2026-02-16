const action = (process.argv[2] || process.env.RENDER_DOMAIN_ACTION || "list").trim().toLowerCase();
const customDomainInput = (process.argv[3] || process.env.CUSTOM_DOMAIN || "").trim().toLowerCase();
const timeoutMs = Number(process.env.RENDER_DOMAIN_WAIT_TIMEOUT_MS || 900_000);
const intervalMs = Number(process.env.RENDER_DOMAIN_WAIT_INTERVAL_MS || 15_000);

const apiKey = (process.env.RENDER_API_KEY || "").trim();
const serviceId = (process.env.RENDER_WEB_SERVICE_ID || "").trim();

if (!apiKey) {
  console.error("[FAIL] RENDER_API_KEY is required.");
  process.exit(1);
}

if (!serviceId) {
  console.error("[FAIL] RENDER_WEB_SERVICE_ID is required.");
  process.exit(1);
}

const baseUrl = `https://api.render.com/v1/services/${encodeURIComponent(serviceId)}/custom-domains`;

function info(message) {
  console.log(`[INFO] ${message}`);
}

function ok(message) {
  console.log(`[OK] ${message}`);
}

function warn(message) {
  console.warn(`[WARN] ${message}`);
}

function fail(message) {
  console.error(`[FAIL] ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.value)) return payload.value;
  return [];
}

function findDomainName(row) {
  return String(
    row?.name ??
      row?.domain ??
      row?.hostname ??
      row?.customDomain ??
      ""
  )
    .trim()
    .toLowerCase();
}

function summarize(row) {
  return {
    id: row?.id ?? row?._id ?? "N/A",
    domain: findDomainName(row) || "N/A",
    status:
      row?.status ??
      row?.verificationStatus ??
      row?.sslStatus ??
      row?.certificateStatus ??
      "N/A",
    verificationStatus: row?.verificationStatus ?? row?.verified ?? "N/A",
    certificateStatus: row?.certificateStatus ?? row?.sslStatus ?? "N/A",
    createdAt: row?.createdAt ?? "N/A",
  };
}

function looksVerified(row) {
  const candidates = [
    row?.status,
    row?.verificationStatus,
    row?.certificateStatus,
    row?.sslStatus,
    row?.state,
  ]
    .map((value) => String(value || "").toLowerCase())
    .filter(Boolean);

  const hasPositive = candidates.some((value) =>
    ["verified", "active", "issued", "ready", "ok", "succeeded", "success"].some((token) =>
      value.includes(token)
    )
  );

  const hasNegative = candidates.some((value) =>
    ["pending", "failed", "error", "unverified", "expired"].some((token) => value.includes(token))
  );

  if (typeof row?.verified === "boolean") {
    if (!row.verified) return false;
    return !hasNegative || hasPositive;
  }

  return hasPositive && !hasNegative;
}

async function renderRequest(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const detail = json ? JSON.stringify(json) : text || "No response body";
    throw new Error(`Render API ${method} ${url} failed (${res.status}): ${detail}`);
  }

  return json;
}

async function listDomains() {
  const payload = await renderRequest("GET", baseUrl);
  const rows = asArray(payload);
  if (rows.length === 0) {
    warn("No custom domains configured yet.");
    return [];
  }
  const summary = rows.map(summarize);
  console.table(summary);
  return rows;
}

async function addDomain() {
  if (!customDomainInput) {
    throw new Error("CUSTOM_DOMAIN is required for add action.");
  }

  info(`Requesting custom domain registration for ${customDomainInput}`);
  const payload = await renderRequest("POST", baseUrl, { name: customDomainInput });
  ok(`Custom domain request submitted for ${customDomainInput}.`);
  console.log(JSON.stringify(payload, null, 2));
  return payload;
}

async function getDomainRowByName() {
  if (!customDomainInput) {
    throw new Error("CUSTOM_DOMAIN is required for this action.");
  }
  const rows = await listDomains();
  const hit = rows.find((row) => findDomainName(row) === customDomainInput) || null;
  if (!hit) {
    throw new Error(`Domain ${customDomainInput} not found in Render custom domain list.`);
  }
  return hit;
}

async function showStatus() {
  const row = await getDomainRowByName();
  info(`Status for ${customDomainInput}:`);
  console.log(JSON.stringify(row, null, 2));
  if (looksVerified(row)) ok("Domain appears verified/active.");
  else warn("Domain still pending or not fully active.");
}

async function waitVerified() {
  if (!customDomainInput) {
    throw new Error("CUSTOM_DOMAIN is required for wait action.");
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const row = await getDomainRowByName();
    if (looksVerified(row)) {
      ok(`Domain ${customDomainInput} is verified/active.`);
      console.log(JSON.stringify(row, null, 2));
      return;
    }
    info(`Domain ${customDomainInput} still pending. Recheck in ${Math.round(intervalMs / 1000)}s.`);
    await sleep(intervalMs);
  }
  throw new Error(
    `Timeout waiting for ${customDomainInput} to become verified (timeout=${timeoutMs}ms).`
  );
}

async function main() {
  info(`Render custom domain action: ${action}`);
  switch (action) {
    case "list":
      await listDomains();
      return;
    case "add":
      await addDomain();
      return;
    case "status":
      await showStatus();
      return;
    case "wait":
    case "wait-verified":
      await waitVerified();
      return;
    default:
      throw new Error(`Unknown action "${action}". Use: list | add | status | wait`);
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
