import { chromium } from "playwright";

const webBase = (process.env.WEB_BASE_URL || "https://bim-scoring-web.onrender.com").replace(/\/+$/, "");
const apiBase = (process.env.API_BASE_URL || "https://bim-scoring-api.onrender.com").replace(/\/+$/, "");
const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 30_000);
const navTimeoutMs = Number(process.env.NAV_TIMEOUT_MS || 30_000);
const headless = String(process.env.HEADLESS || "true").trim().toLowerCase() !== "false";
const contextResolveRetries = Number(process.env.CONTEXT_RESOLVE_RETRIES || 4);

const CREDENTIAL_STORE_KEY = "bim_user_credential_v1";
const seededCredential = {
  role: "admin",
  user_id: "smoke-admin",
  updated_at: new Date().toISOString(),
};

function logOk(message) {
  console.log(`[OK] ${message}`);
}

function logInfo(message) {
  console.log(`[INFO] ${message}`);
}

function logFail(message) {
  console.error(`[FAIL] ${message}`);
}

function normalizePayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (Object.prototype.hasOwnProperty.call(payload, "data")) return payload.data;
  return payload;
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout (${requestTimeoutMs}ms): ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url) {
  const response = await fetchWithTimeout(url);
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  return { response, payload, text };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nonEmptyString(value) {
  if (typeof value !== "string") return null;
  const out = value.trim();
  return out.length > 0 ? out : null;
}

async function resolveEvidenceContext() {
  const queueUrl = `${apiBase}/projects/queue-summary?limit=50`;
  const queueRes = await fetchJson(queueUrl);
  const queuePayload = normalizePayload(queueRes.payload);
  const queueRows = Array.isArray(queuePayload) ? queuePayload : [];

  const prioritized = [...queueRows]
    .filter((row) => nonEmptyString(row?.project?.id) && nonEmptyString(row?.active_period?.id))
    .sort((a, b) => Number(b?.total_evidence || 0) - Number(a?.total_evidence || 0));

  for (const row of prioritized) {
    const projectId = nonEmptyString(row?.project?.id);
    const periodId = nonEmptyString(row?.active_period?.id);
    if (!projectId || !periodId) continue;

    const evidenceUrl = `${apiBase}/periods/${encodeURIComponent(periodId)}/evidences?project_id=${encodeURIComponent(projectId)}`;
    const evidenceRes = await fetchJson(evidenceUrl);
    const evidencePayload = normalizePayload(evidenceRes.payload);
    const evidenceRows = Array.isArray(evidencePayload) ? evidencePayload : [];
    const firstEvidenceId = nonEmptyString(evidenceRows[0]?.evidence_id || evidenceRows[0]?.id);
    if (!firstEvidenceId) continue;

    return { projectId, periodId, evidenceId: firstEvidenceId };
  }

  throw new Error("No project+period+evidence context available from backend.");
}

async function runRouteCheck(browser, { path, mustContainAny, forbiddenAny }) {
  const url = `${webBase}${path}`;
  const expected = new URL(url);
  const context = await browser.newContext();
  await context.addInitScript(
    ({ key, payload }) => {
      window.localStorage.setItem(key, JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent("bim:credential-updated", { detail: payload }));
    },
    { key: CREDENTIAL_STORE_KEY, payload: seededCredential }
  );

  const page = await context.newPage();
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: navTimeoutMs });
    const statusCode = response?.status() ?? 0;
    if (statusCode >= 400) {
      throw new Error(`status ${statusCode} at ${url}`);
    }

    try {
      await page.waitForLoadState("networkidle", { timeout: 8_000 });
    } catch {
      // Some pages keep polling; continue with current DOM snapshot.
    }
    await page.waitForTimeout(1_000);

    const current = new URL(page.url());
    if (current.pathname !== expected.pathname) {
      throw new Error(`unexpected redirect ${current.pathname} (expected ${expected.pathname})`);
    }

    const body = await page.locator("body").innerText();
    const bodyLower = body.toLowerCase();

    for (const forbidden of forbiddenAny) {
      if (!forbidden) continue;
      if (bodyLower.includes(forbidden.toLowerCase())) {
        throw new Error(`forbidden marker "${forbidden}" detected`);
      }
    }

    if (Array.isArray(mustContainAny) && mustContainAny.length > 0) {
      const hasMatch = mustContainAny.some((marker) => body.includes(marker));
      if (!hasMatch) {
        throw new Error(`expected markers missing (${mustContainAny.join(", ")})`);
      }
    }

    logOk(`${path}`);
  } finally {
    await context.close();
  }
}

async function main() {
  logInfo(`WEB_BASE_URL=${webBase}`);
  logInfo(`API_BASE_URL=${apiBase}`);
  let context = null;
  let resolveError = null;
  for (let attempt = 1; attempt <= contextResolveRetries; attempt += 1) {
    try {
      context = await resolveEvidenceContext();
      resolveError = null;
      break;
    } catch (error) {
      resolveError = error;
      logInfo(`resolve context retry ${attempt}/${contextResolveRetries}`);
      if (attempt < contextResolveRetries) {
        await sleep(attempt * 2_000);
      }
    }
  }
  if (!context) {
    throw resolveError || new Error("Failed resolving evidence context.");
  }
  logInfo(`Sample context: project=${context.projectId}, period=${context.periodId}, evidence=${context.evidenceId}`);

  const routes = [
    {
      path: `/projects/${encodeURIComponent(context.projectId)}`,
      mustContainAny: ["Evidence Tasks", "Project context", "Checking Access"],
      forbiddenAny: ["project context not found."],
    },
    {
      path: `/projects/${encodeURIComponent(context.projectId)}/evidence`,
      mustContainAny: ["My Evidence List", "Checking Access"],
      forbiddenAny: ["project context not found."],
    },
    {
      path:
        `/projects/${encodeURIComponent(context.projectId)}/evidence/add?evidenceId=` +
        encodeURIComponent(context.evidenceId),
      mustContainAny: ["Tambahkan Evidence", "Evidence Data Input", "Checking Access"],
      forbiddenAny: [
        "project context not found.",
        "evidence yang akan direvisi tidak ditemukan",
      ],
    },
    {
      path: `/ho/review/projects/${encodeURIComponent(context.projectId)}`,
      mustContainAny: ["Review Evidence", "Checking Access"],
      forbiddenAny: ["project context not found."],
    },
    {
      path:
        `/ho/review/projects/${encodeURIComponent(context.projectId)}/evidence/` +
        encodeURIComponent(context.evidenceId),
      mustContainAny: ["Apply Review", "Checking Access"],
      forbiddenAny: ["evidence context not found."],
    },
    {
      path: `/approve/projects/${encodeURIComponent(context.projectId)}`,
      mustContainAny: ["Approve Workspace", "Approval", "Checking Access"],
      forbiddenAny: ["project context not found."],
    },
    {
      path: `/approve/projects/${encodeURIComponent(context.projectId)}/awaiting-review`,
      mustContainAny: ["Awaiting Review", "Checking Access"],
      forbiddenAny: ["project context not found."],
    },
    {
      path: `/approve/projects/${encodeURIComponent(context.projectId)}/decision`,
      mustContainAny: ["Konfirmasi Keputusan", "Checking Access"],
      forbiddenAny: ["project context not found."],
    },
  ];

  const browser = await chromium.launch({ headless });
  let failed = 0;
  try {
    for (const route of routes) {
      try {
        await runRouteCheck(browser, route);
      } catch (error) {
        failed += 1;
        logFail(`${route.path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } finally {
    await browser.close();
  }

  if (failed > 0) {
    throw new Error(`ID route regression failed (${failed} route(s)).`);
  }

  logOk("ID route regression passed.");
}

main().catch((error) => {
  logFail(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
