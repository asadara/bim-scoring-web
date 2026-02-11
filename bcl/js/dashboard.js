import { GATE_C_ALIGNMENT_CONFIG } from "./gate-c-config.js";

//const API = 'http://localhost:5500/summary/v2/bcl/dashboard'; // SESUAIKAN
const API = '/summary/v2/bcl/dashboard';
const NA_TEXT = 'Not available';
const PHASE_2A_ROLE = "BIM Koordinator Proyek";
const PHASE_2A_STORAGE_PREFIX = "bcl:phase2a:evidence-drafts";
const PHASE_2B_REVIEWER_ROLE = "BIM Koordinator Pusat / HO";
const PHASE_2B_OUTCOMES = ["ACCEPTABLE", "NEEDS REVISION", "REJECTED"];
const PHASE_2C_APPROVER_ROLE = "BIM Manager / Kepala Divisi BIM";
const PHASE_2C_APPROVAL_PREFIX = "bcl:phase2c:approval";
const PHASE_2C_SNAPSHOT_PREFIX = "bcl:phase2c:snapshot";

function ro(value, suffix = '') {
  if (value === null || value === undefined || value === '') return NA_TEXT;
  return `${value}${suffix}`;
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderIndicators(list = []) {
  if (!Array.isArray(list) || list.length === 0) {
    return `<p class="hint">Belum ada indikator untuk perspective ini.</p>`;
  }
  return `
    <ul class="ind-list">
      ${list.map(ind => `
        <li>
          <strong>${ind.code ?? ind.id}</strong> — ${ind.title ?? 'Untitled'}
          ${ind.score != null ? `<span class="ind-badge ind-${Number(ind.score)}">score ${ind.score}/5</span>` : ''}
        </li>
      `).join('')}
    </ul>
  `;
}

function openDrawer(title, html) {
  document.getElementById('drawer-title').textContent = title;
  document.getElementById('drawer-body').innerHTML = html;
  document.getElementById('drawer').classList.add('show');
}
function closeDrawer() {
  document.getElementById('drawer').classList.remove('show');
  activePerspectiveId = null;
}

document.getElementById('drawer-close')?.addEventListener('click', closeDrawer);

async function fetchEvidenceDetail(evidenceId) {
  const res = await fetch(`/evidence/${encodeURIComponent(evidenceId)}`);
  let json = null;
  try {
    json = await res.json();
  } catch (_) {
    json = null;
  }
  if (!res.ok) {
    const backendMessage =
      json?.error?.message ||
      json?.error ||
      json?.message ||
      res.statusText ||
      "Request failed";
    const err = new Error(`HTTP ${res.status}: ${backendMessage}`);
    err.status = res.status;
    throw err;
  }
  if (!json?.ok || json.__signature !== "EVIDENCE-DETAIL-v1") {
    throw new Error("bad EVIDENCE-DETAIL-v1 payload");
  }
  return json.data;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function resolveEvidenceUiState(ev) {
  const type = String(ev?.type || "").toUpperCase();

  if (type === "FILE") {
    const viewUrl = isNonEmptyString(ev?.view_url) ? ev.view_url : null;
    const downloadUrl = isNonEmptyString(ev?.download_url) ? ev.download_url : null;
    return {
      type,
      status: viewUrl || downloadUrl ? "available" : "unavailable",
      viewUrl,
      downloadUrl,
      externalUrl: null,
      textContent: null,
      message: viewUrl || downloadUrl ? "File URL available." : "File view URL unavailable."
    };
  }

  if (type === "URL") {
    const externalUrl = isNonEmptyString(ev?.external_url) ? ev.external_url : null;
    return {
      type,
      status: externalUrl ? "available" : "unavailable",
      viewUrl: null,
      downloadUrl: null,
      externalUrl,
      textContent: null,
      message: externalUrl ? "External link available." : "External link unavailable."
    };
  }

  if (type === "TEXT") {
    const textContent = isNonEmptyString(ev?.text_note)
      ? ev.text_note
      : (isNonEmptyString(ev?.content) ? ev.content : null);
    return {
      type,
      status: textContent ? "available" : "unavailable",
      viewUrl: null,
      downloadUrl: null,
      externalUrl: null,
      textContent,
      message: textContent ? "Text content available." : "Text content unavailable."
    };
  }

  return {
    type: type || "-",
    status: "unavailable",
    viewUrl: null,
    downloadUrl: null,
    externalUrl: null,
    textContent: null,
    message: "Evidence type unavailable."
  };
}

function renderEvidenceLoading() {
  return `
    <div class="ev-state ev-state-loading">
      <div class="title">Loading evidence detail</div>
      <div class="hint">Mengambil data evidence dari server...</div>
    </div>
  `;
}

function renderEvidenceError(err) {
  const message = err?.message || "Evidence detail request failed.";
  return `
    <div class="ev-state ev-state-error">
      <div class="title">Evidence detail error</div>
      <div class="hint">${message}</div>
    </div>
  `;
}

function renderEvidenceDetail(ev) {
  const tags = Array.isArray(ev.tags) ? ev.tags.join(", ") : (ev.tags ?? "");
  const links = Array.isArray(ev.links) ? ev.links : [];
  const ui = resolveEvidenceUiState(ev);

  let actionHtml = "";
  if (ui.type === "TEXT") {
    actionHtml = ui.textContent
      ? `<p><strong>Content:</strong></p><pre class="ev-text">${ui.textContent}</pre>`
      : `<p class="hint">Text content unavailable.</p>`;
  } else if (ui.type === "URL") {
    actionHtml = `
      <div class="ev-actions">
        ${ui.externalUrl
          ? `<a class="ev-btn" href="${ui.externalUrl}" target="_blank" rel="noopener">Open external</a>`
          : `<span class="ev-btn disabled">External unavailable</span>`
        }
      </div>
    `;
  } else if (ui.type === "FILE") {
    actionHtml = `
      <div class="ev-actions">
        ${ui.viewUrl
          ? `<a class="ev-btn" href="${ui.viewUrl}" target="_blank" rel="noopener">View file</a>`
          : `<span class="ev-btn disabled">View unavailable</span>`
        }
        ${ui.downloadUrl
          ? `<a class="ev-btn" href="${ui.downloadUrl}" target="_blank" rel="noopener">Download file</a>`
          : `<span class="ev-btn disabled">Download unavailable</span>`
        }
      </div>
    `;
  } else {
    actionHtml = `<p class="hint">No action available for this evidence type.</p>`;
  }

  return `
    <div class="ev-detail">
      <p>
        <strong>Status:</strong>
        <span class="ev-status ev-status-${ui.status}">${ui.status}</span>
      </p>
      <p class="hint">${ui.message}</p>
      <p><strong>Title:</strong> ${ev.title ?? "-"}</p>
      <p><strong>Type:</strong> ${ev.type ?? "-"}</p>
      <p><strong>Date:</strong> ${ev.document_date ?? "-"}</p>
      <p><strong>Source:</strong> ${ev.source ?? "-"}</p>
      <p><strong>Tags:</strong> ${tags || "-"}</p>
      <p><strong>Notes:</strong> ${ev.notes ?? "-"}</p>
      <p><strong>URI:</strong> ${ev.uri ?? "-"}</p>
      ${actionHtml}
      <hr/>
      <p class="hint">Linked inputs: ${links.length}</p>
    </div>
  `;
}

async function openEvidenceDetail(evidenceId) {
  openDrawer("Evidence", renderEvidenceLoading());
  try {
    const ev = await fetchEvidenceDetail(evidenceId);
    openDrawer("Evidence", renderEvidenceDetail(ev));
  } catch (err) {
    openDrawer("Evidence", renderEvidenceError(err));
  }
}

function bindEvidenceOpenLinksInDrawer() {
  document.querySelectorAll("#drawer .ev-open").forEach(a => {
    a.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const evid = a.dataset.evid;
      if (!evid) return;
      await openEvidenceDetail(evid);
    });
  });
}


async function fetchBundle() {
  const res = await fetch(`${API}?project_id=07d07ae1-28de-4a12-a342-27c6f052afd4&year=2026&week=10&trend_granularity=month&audit=true`);
  if (!res.ok) throw new Error('API error');
  return res.json();
}
async function resolveProjectAndPeriodIds(projectCode, year, week) {
  const pr = await fetch(`/projects`);
  if (!pr.ok) throw new Error(`resolve project failed: ${pr.status}`);
  const pj = await pr.json();

  const projects = Array.isArray(pj?.data) ? pj.data : [];
  const proj = projects.find(p => String(p.code).trim() === String(projectCode).trim());
  if (!proj?.id) throw new Error(`project code not found: ${projectCode}`);

  const rr = await fetch(`/projects/${proj.id}/periods`);
  if (!rr.ok) throw new Error(`resolve periods failed: ${rr.status}`);
  const rj = await rr.json();

  const periods = Array.isArray(rj?.data) ? rj.data : [];
  

  const per = periods.find(
    p => Number(p.year) === Number(year) && Number(p.week) === Number(week)
  );
  if (!per?.id) throw new Error(`period not found for year=${year} week=${week}`);

  return { projectId: proj.id, periodId: per.id };
}

function getPhase2CApprovalStorageKey(projectId, periodId) {
  return `${PHASE_2C_APPROVAL_PREFIX}:${projectId || "na"}:${periodId || "na"}`;
}

function getPhase2CSnapshotStorageKey(projectId, periodId) {
  return `${PHASE_2C_SNAPSHOT_PREFIX}:${projectId || "na"}:${periodId || "na"}`;
}

function loadPhase2CApproval(projectId, periodId) {
  if (!projectId || !periodId) return null;
  try {
    const raw = localStorage.getItem(getPhase2CApprovalStorageKey(projectId, periodId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_) {
    return null;
  }
}

function savePhase2CApproval(projectId, periodId, approval) {
  if (!projectId || !periodId || !approval) return;
  localStorage.setItem(getPhase2CApprovalStorageKey(projectId, periodId), JSON.stringify(approval));
}

function loadPhase2CSnapshot(projectId, periodId) {
  if (!projectId || !periodId) return null;
  try {
    const raw = localStorage.getItem(getPhase2CSnapshotStorageKey(projectId, periodId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_) {
    return null;
  }
}

function savePhase2CSnapshot(projectId, periodId, snapshot) {
  if (!projectId || !periodId || !snapshot) return;
  localStorage.setItem(getPhase2CSnapshotStorageKey(projectId, periodId), JSON.stringify(snapshot));
}

function isPeriodLocked(projectId, periodId) {
  const approval = loadPhase2CApproval(projectId, periodId);
  return Boolean(
    approval &&
    approval.period_status === "LOCKED" &&
    approval.decision === "APPROVE PERIOD"
  );
}

function refreshHeaderLockStatus() {
  if (CURRENT_HEADER) renderHeader(CURRENT_HEADER);
}
function renderHeader(header) {
  const el = document.getElementById('header');
  const locked = isPeriodLocked(CURRENT_PROJECT_ID, CURRENT_PERIOD_ID);
  const lockBadge = locked
    ? `<span class="badge warn lock-pill">LOCKED</span>`
    : `<span class="badge info lock-pill">OPEN</span>`;
  el.innerHTML = `<h2>Project ${header.project_id} — ${header.period.year} W${header.period.week} ${lockBadge}</h2>`;
}

function fmtMeta(meta) {
  if (!meta) return '';
  // tampilkan key penting dulu
  const orderedKeys = ['granularity','direction','points','badges','method','explain_hash_prefix'];
  const keys = [...orderedKeys.filter(k => k in meta), ...Object.keys(meta).filter(k => !orderedKeys.includes(k))];

  return keys
    .map(k => {
      const v = meta[k];
      const out =
        Array.isArray(v) ? v.join(',') :
        (v && typeof v === 'object') ? JSON.stringify(v) :
        v;
      return `<span class="pill">${k}: ${out}</span>`;
    })
    .join(' ');
}

let activePerspectiveId = null;
let CURRENT_PROJECT_ID = null;
let CURRENT_PERIOD_ID = null;
let CURRENT_HEADER = null;
let CURRENT_CARDS = [];


function isDrawerOpen() {
  return document.getElementById('drawer').classList.contains('show');
}

const MOCK_INDICATORS = {
  P1: [
    { code: 'P1-01', title: 'Governance baseline', score: 3 },
    { code: 'P1-02', title: 'BEP approved', score: 4 }
  ],
  P2: [
    { code: 'P2-01', title: 'Model coordination', score: 2 },
    { code: 'P2-02', title: 'Clash resolution workflow', score: 3 }
  ],
  P3: [
    { code: 'P3-01', title: 'LOD compliance', score: 3 }
  ],
  P4: [
    { code: 'P4-01', title: 'Team capability', score: 2 }
  ],
  P5: [
    { code: 'P5-01', title: 'Value realization', score: 4 }
  ]
};

const IND_CACHE = new Map(); // pid -> indicators[]

async function fetchIndicatorEvidence(projectId, periodId, perspectiveId) {
  const qs = new URLSearchParams();
  if (perspectiveId) qs.set("perspective_id", perspectiveId);

  const res = await fetch(
    `/projects/${projectId}/periods/${periodId}/indicator-evidence?${qs.toString()}`
  );

  if (!res.ok) {
    throw new Error(`indicator-evidence fetch failed: ${res.status}`);
  }

  const json = await res.json();
  if (!json?.ok || json.__signature !== "INDICATOR-EVIDENCE-v1") {
    throw new Error("bad INDICATOR-EVIDENCE-v1 payload");
  }

  return json; // jangan diolah dulu
}

async function fetchIndicatorScores(projectId, periodId, perspectiveId) {
  const qs = new URLSearchParams();
  if (perspectiveId) qs.set("perspective_id", perspectiveId);

  const res = await fetch(
    `/projects/${projectId}/periods/${periodId}/indicator-scores?${qs.toString()}`
  );

  if (!res.ok) {
    throw new Error(`indicator-scores fetch failed: ${res.status}`);
  }

  const json = await res.json();
  if (!json?.ok || json.__signature !== "INDICATOR-SCORES-v1") {
    throw new Error("bad INDICATOR-SCORES-v1 payload");
  }

  return json;
}

const PERSPECTIVE_ORDER = ["P1", "P2", "P3", "P4", "P5"];
const GATE_C_CACHE = {
  projects: null,
  indicatorsByProject: new Map(),
};

function perspectiveRank(pid) {
  const idx = PERSPECTIVE_ORDER.indexOf(String(pid || "").toUpperCase());
  return idx === -1 ? 99 : idx;
}

function normalizePerspectiveId(pid) {
  const v = String(pid || "").toUpperCase();
  return PERSPECTIVE_ORDER.includes(v) ? v : null;
}

function sortIndicators(rows) {
  return [...rows].sort((a, b) => {
    const p = perspectiveRank(a?.perspective_id) - perspectiveRank(b?.perspective_id);
    if (p !== 0) return p;
    return String(a?.code || "").localeCompare(String(b?.code || ""));
  });
}

function setEquals(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function statusBadgeClass(status) {
  if (status === "core") return "ok";
  if (status === "optional") return "info";
  if (status === "excluded") return "warn";
  return "info";
}

function toTitleCase(v) {
  const s = String(v || "");
  if (!s) return NA_TEXT;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function fetchProjectsList() {
  if (Array.isArray(GATE_C_CACHE.projects)) return GATE_C_CACHE.projects;
  const res = await fetch("/projects");
  if (!res.ok) throw new Error(`projects fetch failed: ${res.status}`);
  const json = await res.json();
  const rows = Array.isArray(json?.data) ? json.data : [];
  GATE_C_CACHE.projects = rows;
  return rows;
}

async function fetchProjectIndicators(projectId) {
  if (GATE_C_CACHE.indicatorsByProject.has(projectId)) {
    return GATE_C_CACHE.indicatorsByProject.get(projectId);
  }
  const res = await fetch(`/projects/${projectId}/indicators`);
  if (!res.ok) throw new Error(`project indicators fetch failed: ${res.status}`);
  const json = await res.json();
  if (!json?.ok || json.__signature !== "PRJ-ACTIVE-IND-v1") {
    throw new Error("bad PRJ-ACTIVE-IND-v1 payload");
  }
  const rows = Array.isArray(json?.data) ? json.data : [];
  GATE_C_CACHE.indicatorsByProject.set(projectId, rows);
  return rows;
}

function buildGateCIndicatorSet(projectCode, activeIndicators) {
  const cfg = GATE_C_ALIGNMENT_CONFIG?.projects?.[projectCode] || {};
  const overrides = cfg?.indicator_overrides || {};
  const defaultActiveStatus = GATE_C_ALIGNMENT_CONFIG?.default_status?.active || "optional";
  const defaultInactiveStatus = GATE_C_ALIGNMENT_CONFIG?.default_status?.inactive || "excluded";

  const byCode = new Map();
  for (const row of Array.isArray(activeIndicators) ? activeIndicators : []) {
    const code = row?.code;
    if (!code) continue;
    byCode.set(code, {
      code,
      title: row?.title ?? null,
      perspective_id: normalizePerspectiveId(row?.perspective_id),
      status: defaultActiveStatus,
      reason: null,
      is_active: true,
    });
  }

  for (const [code, ov] of Object.entries(overrides)) {
    const existing = byCode.get(code);
    if (existing) {
      existing.status = ov?.status || existing.status;
      existing.perspective_id = normalizePerspectiveId(ov?.perspective_id) || existing.perspective_id;
      existing.title = ov?.title ?? existing.title;
      existing.reason = ov?.reason ?? existing.reason;
    } else {
      byCode.set(code, {
        code,
        title: ov?.title ?? null,
        perspective_id: normalizePerspectiveId(ov?.perspective_id),
        status: ov?.status || defaultInactiveStatus,
        reason: ov?.reason ?? null,
        is_active: false,
      });
    }
  }

  return sortIndicators(Array.from(byCode.values()));
}

function groupByPerspective(rows) {
  const grouped = { P1: [], P2: [], P3: [], P4: [], P5: [] };
  for (const r of Array.isArray(rows) ? rows : []) {
    const pid = normalizePerspectiveId(r?.perspective_id);
    if (!pid) continue;
    grouped[pid].push(r);
  }
  return grouped;
}

function renderGateCProjectConfiguration(projectRows) {
  if (!Array.isArray(projectRows) || projectRows.length === 0) {
    return `<p class="hint">Project configuration: ${NA_TEXT}</p>`;
  }

  return `
    <div class="gc-section">
      <h4>Project Configuration</h4>
      ${projectRows.map(prj => {
        const grouped = groupByPerspective(prj?.indicators || []);
        const bimUses = Array.isArray(prj?.bim_uses) ? prj.bim_uses : [];
        return `
          <div class="gc-project">
            <p><strong>${ro(prj?.display_name || prj?.code)}</strong> (${ro(prj?.code)})</p>
            <p class="meta"><strong>BIM Use:</strong> ${bimUses.length ? bimUses.join(", ") : NA_TEXT}</p>
            ${PERSPECTIVE_ORDER.map(pid => {
              const rows = grouped[pid] || [];
              return `
                <div class="gc-perspective">
                  <p><strong>${pid}</strong> - indicators: ${ro(rows.length)}</p>
                  ${rows.length ? `
                    <ul class="ind-list gc-ind-list">
                      ${rows.map(r => `
                        <li>
                          <strong>${ro(r?.code)}</strong> - ${ro(r?.title)}
                          <span class="badge ${statusBadgeClass(r?.status)}">${toTitleCase(r?.status)}</span>
                          ${r?.status === "excluded" ? `<div class="hint">${r?.reason || "Excluded by design"}</div>` : ""}
                        </li>
                      `).join("")}
                    </ul>
                  ` : `<p class="hint">Not available</p>`}
                </div>
              `;
            }).join("")}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function resolveAlignmentFlag(indicatorCode, projectRows, projectCodes) {
  const rule = (GATE_C_ALIGNMENT_CONFIG?.expected_alignment || [])
    .find(r => r?.indicator_code === indicatorCode);

  const presentSet = new Set(
    projectRows
      .filter(x => x?.status === "core" || x?.status === "optional")
      .map(x => x.project_code)
  );

  if (rule && Array.isArray(rule.expected_presence)) {
    const expectedSet = new Set(rule.expected_presence);
    const ok = setEquals(presentSet, expectedSet);
    return {
      label: ok ? "Expected difference" : "Potential misalignment",
      className: ok ? "info" : "warn",
      note: rule.note || NA_TEXT,
    };
  }

  const allPresent = projectCodes.every(code => presentSet.has(code));
  const allAbsent = projectCodes.every(code => !presentSet.has(code));
  if (allPresent || allAbsent) {
    return { label: "Aligned", className: "ok", note: "No cross-project gap detected." };
  }
  return { label: "Potential misalignment", className: "warn", note: "Difference detected without expected alignment note." };
}

function renderGateCCrossProjectAlignment(projectRows) {
  if (!Array.isArray(projectRows) || projectRows.length < 2) {
    return `
      <div class="gc-section">
        <h4>Cross-Project Alignment</h4>
        <p class="hint">Not available (minimum 2 projects required).</p>
      </div>
    `;
  }

  const projectCodes = projectRows.map(p => p.code);
  const rowByProjectCode = new Map(projectRows.map(p => [p.code, p]));
  const unionCodes = [...new Set(projectRows.flatMap(p => (p.indicators || []).map(i => i.code)))].sort();

  return `
    <div class="gc-section">
      <h4>Cross-Project Alignment</h4>
      <p class="hint">Read-only comparison across projects (flag only, no scoring impact).</p>
      <ul class="ind-list gc-align-list">
        ${unionCodes.map(code => {
          const perProject = projectCodes.map(pcode => {
            const r = (rowByProjectCode.get(pcode)?.indicators || []).find(x => x.code === code) || null;
            return {
              project_code: pcode,
              status: r?.status || "missing",
              text: r
                ? `${toTitleCase(r?.status)}`
                : "Not in set",
            };
          });
          const flag = resolveAlignmentFlag(code, perProject, projectCodes);
          return `
            <li>
              <div class="exp-row-head">
                <strong>${code}</strong>
                <span class="badge ${flag.className}">${flag.label}</span>
              </div>
              <div class="meta">${perProject.map(x => `${x.project_code}: ${x.text}`).join(" | ")}</div>
              <div class="hint">${flag.note}</div>
            </li>
          `;
        }).join("")}
      </ul>
    </div>
  `;
}

function renderGateCAlignmentNotes(projectRows) {
  const globalNotes = Array.isArray(GATE_C_ALIGNMENT_CONFIG?.global_notes)
    ? GATE_C_ALIGNMENT_CONFIG.global_notes
    : [];
  const notesByProject = (Array.isArray(projectRows) ? projectRows : [])
    .map(p => ({
      code: p?.code,
      display: p?.display_name || p?.code,
      notes: Array.isArray(p?.alignment_notes) ? p.alignment_notes : [],
      exclusions: (p?.indicators || [])
        .filter(i => i?.status === "excluded" && i?.reason)
        .map(i => `${i.code}: ${i.reason}`)
    }));

  return `
    <div class="gc-section">
      <h4>Alignment Notes (Non-binding)</h4>
      ${globalNotes.length ? `
        <p><strong>Organization Notes</strong></p>
        <ul class="ind-list">
          ${globalNotes.map(n => `<li>${n}</li>`).join("")}
        </ul>
      ` : `<p class="hint">Organization notes: ${NA_TEXT}</p>`}
      ${notesByProject.map(p => `
        <div class="gc-notes">
          <p><strong>${ro(p.display)} (${ro(p.code)})</strong></p>
          ${p.notes.length ? `<ul class="ind-list">${p.notes.map(n => `<li>${n}</li>`).join("")}</ul>` : `<p class="hint">${NA_TEXT}</p>`}
          ${p.exclusions.length ? `
            <p class="meta"><strong>Excluded indicator rationale</strong></p>
            <ul class="ind-list">${p.exclusions.map(x => `<li>${x}</li>`).join("")}</ul>
          ` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

function renderGateCLoading() {
  return `
    <div class="exp-panel">
      <p class="hint">Loading Gate C configuration and alignment view...</p>
    </div>
  `;
}

function renderGateCView(projectRows, errors) {
  return `
    <div class="gc-panel">
      <p class="hint">Gate C is alignment-only. No scoring formula, weight, or evidence behavior is changed.</p>
      <p class="hint">Reference config (non-binding).</p>
      ${renderGateCProjectConfiguration(projectRows)}
      ${renderGateCCrossProjectAlignment(projectRows)}
      ${renderGateCAlignmentNotes(projectRows)}
      ${Array.isArray(errors) && errors.length ? `<p class="hint">${errors.join(" | ")}</p>` : ""}
    </div>
  `;
}

async function openGateCView() {
  openDrawer("Gate C - Configuration & Alignment", renderGateCLoading());

  const errors = [];
  let projects = [];
  try {
    projects = await fetchProjectsList();
  } catch (e) {
    errors.push(`Projects unavailable: ${e?.message || e}`);
  }

  const configCodes = Array.isArray(GATE_C_ALIGNMENT_CONFIG?.compare_project_codes)
    ? GATE_C_ALIGNMENT_CONFIG.compare_project_codes
    : [];
  const byCode = new Map((projects || []).map(p => [String(p?.code || ""), p]));

  const selected = [];
  for (const code of configCodes) {
    const p = byCode.get(code);
    if (p && !selected.find(x => x.id === p.id)) selected.push(p);
    if (selected.length >= 3) break;
  }
  for (const p of projects || []) {
    if (selected.length >= 3) break;
    if (!selected.find(x => x.id === p.id)) selected.push(p);
  }

  const projectRows = [];
  for (const p of selected) {
    let activeIndicators = [];
    try {
      activeIndicators = await fetchProjectIndicators(p.id);
    } catch (e) {
      errors.push(`[${p?.code}] indicators unavailable: ${e?.message || e}`);
    }

    const cfg = GATE_C_ALIGNMENT_CONFIG?.projects?.[p?.code] || {};
    projectRows.push({
      id: p?.id ?? null,
      code: p?.code ?? null,
      display_name: cfg?.display_name || p?.name || p?.code,
      bim_uses: Array.isArray(cfg?.bim_uses) ? cfg.bim_uses : [],
      alignment_notes: Array.isArray(cfg?.alignment_notes) ? cfg.alignment_notes : [],
      indicators: buildGateCIndicatorSet(p?.code, activeIndicators),
    });
  }

  openDrawer("Gate C - Configuration & Alignment", renderGateCView(projectRows, errors));
}

function renderExplainabilityPanel({
  perspectiveId,
  weight,
  averageScore,
  contribution,
  indicatorScores,
  scoreError,
  evidenceMap,
  evidenceError
}) {
  const rows = Array.isArray(indicatorScores) ? indicatorScores : null;
  const includedCount = rows ? rows.filter(r => r?.is_scored === true).length : null;
  const excludedCount = rows ? rows.filter(r => r?.is_scored === false).length : null;

  const stats = [
    { label: "Perspective", value: ro(perspectiveId) },
    { label: "Weight", value: ro(Number.isFinite(weight) ? weight : null, Number.isFinite(weight) ? "%" : "") },
    { label: "Included indicators", value: ro(includedCount) },
    { label: "Excluded indicators", value: ro(excludedCount) },
    { label: "Average indicator score", value: ro(Number.isFinite(averageScore) ? averageScore : null) },
    { label: "Contribution to total score", value: ro(Number.isFinite(contribution) ? contribution.toFixed(2) : null) },
  ];

  const statsHtml = `
    <ul class="exp-stats">
      ${stats.map(s => `<li><span>${s.label}</span><strong>${s.value}</strong></li>`).join("")}
    </ul>
  `;

  let listHtml = `<p class="hint">Indicators: ${NA_TEXT}</p>`;
  if (rows && rows.length === 0) {
    listHtml = `<p class="hint">No indicators found for this perspective.</p>`;
  } else if (rows && rows.length > 0) {
    listHtml = `
      <ul class="ind-list exp-list">
        ${rows.map(r => {
          const status = r?.is_scored === true ? "Included" : (r?.is_scored === false ? "Excluded" : NA_TEXT);
          const statusClass = r?.is_scored === true ? "ok" : (r?.is_scored === false ? "warn" : "info");
          const scoreText = r?.is_scored === true && Number.isFinite(Number(r?.score))
            ? `${Number(r.score)}/5`
            : NA_TEXT;
          const code = r?.code ?? "-";
          const title = r?.title ?? "Untitled";

          const hasEvidenceMap = evidenceMap && typeof evidenceMap === "object";
          const evList = hasEvidenceMap
            ? (Array.isArray(evidenceMap[code]) ? evidenceMap[code] : [])
            : null;
          const evidenceCount = evList ? evList.length : null;

          let evidenceLinksHtml = `<span class="hint">${NA_TEXT}</span>`;
          if (evList && evList.length === 0) {
            evidenceLinksHtml = `<span class="hint">No evidence</span>`;
          } else if (evList && evList.length > 0) {
            evidenceLinksHtml = evList
              .map(ev => `<a href="#" class="ev-open" data-evid="${ev.evidence_id}">open</a>`)
              .join(" | ");
          }

          return `
            <li>
              <div class="exp-row-head">
                <strong>${code}</strong> â€” ${title}
                <span class="badge ${statusClass}">${status}</span>
              </div>
              <div class="meta">Score: ${scoreText}</div>
              ${r?.is_scored === false ? `<div class="hint">Excluded from calculation</div>` : ""}
              <div class="meta">Evidence count: ${ro(evidenceCount)}</div>
              <div class="meta">Evidence detail: ${evidenceLinksHtml}</div>
            </li>
          `;
        }).join("")}
      </ul>
    `;
  }

  const errors = [];
  if (scoreError) errors.push(`Indicator status unavailable: ${scoreError?.message || scoreError}`);
  if (evidenceError) errors.push(`Evidence summary unavailable: ${evidenceError?.message || evidenceError}`);

  return `
    <div class="exp-panel">
      <p class="hint">Read-only explainability from existing payload (no recalculation).</p>
      ${statsHtml}
      ${listHtml}
      ${errors.length ? `<p class="hint">${errors.join(" | ")}</p>` : ""}
    </div>
  `;
}

function resolvePerspectiveItems(cards) {
  const perspectiveCard = Array.isArray(cards)
    ? cards.find(c => c?.id === "perspectives" && Array.isArray(c?.items))
    : null;
  return Array.isArray(perspectiveCard?.items) ? perspectiveCard.items : [];
}

function renderTraceabilityLoading() {
  return `
    <div class="exp-panel">
      <p class="hint">Loading evidence traceability view...</p>
    </div>
  `;
}

function renderTraceabilityPanel({ projectId, periodId, perspectives, errors }) {
  const perspectiveBlocks = Array.isArray(perspectives) ? perspectives : [];
  const hasRows = perspectiveBlocks.length > 0;

  return `
    <div class="trace-panel">
      <p><strong>Project:</strong> ${ro(projectId)}</p>
      <p><strong>Period:</strong> ${ro(periodId)}</p>
      <p class="hint">Read-only traceability from existing payload (Project/Period -> Perspective -> Indicator -> Evidence).</p>
      ${hasRows ? perspectiveBlocks.map(p => {
        const indicatorRows = Array.isArray(p?.indicators) ? p.indicators : [];
        return `
          <div class="trace-perspective">
            <h4>${ro(p?.perspective_id)}</h4>
            <ul class="exp-stats">
              <li><span>Weight</span><strong>${ro(p?.weight, p?.weight != null ? "%" : "")}</strong></li>
              <li><span>Indicators</span><strong>${ro(p?.indicator_count)}</strong></li>
              <li><span>Total evidence</span><strong>${ro(p?.total_evidence_count)}</strong></li>
            </ul>
            ${indicatorRows.length > 0 ? `
              <ul class="ind-list trace-ind-list">
                ${indicatorRows.map(ind => {
                  const status = ind?.status ?? NA_TEXT;
                  const badgeClass = status === "Included" ? "ok" : (status === "Excluded" ? "warn" : "info");
                  const evidenceItems = Array.isArray(ind?.evidence_items) ? ind.evidence_items : null;
                  return `
                    <li>
                      <div class="exp-row-head">
                        <strong>${ro(ind?.code)}</strong> - ${ro(ind?.title)}
                        <span class="badge ${badgeClass}">${status}</span>
                      </div>
                      <div class="meta">Score: ${ro(ind?.score)}</div>
                      ${status === "Excluded" ? `<div class="hint">Excluded from calculation</div>` : ""}
                      <div class="meta">Evidence count: ${ro(ind?.evidence_count)}</div>
                      <div class="meta">Evidence list:</div>
                      ${evidenceItems === null
                        ? `<div class="hint">${NA_TEXT}</div>`
                        : evidenceItems.length === 0
                          ? `<div class="hint">No evidence</div>`
                          : `<ul class="trace-ev-list">
                              ${evidenceItems.map(ev => `
                                <li>
                                  <code>${ro(ev?.evidence_id)}</code>
                                  <span> type: ${ro(ev?.type)}</span>
                                  <span> title: ${ro(ev?.title)}</span>
                                  ${ev?.evidence_id ? ` - <a href="#" class="ev-open" data-evid="${ev.evidence_id}">open</a>` : ""}
                                </li>
                              `).join("")}
                            </ul>`
                      }
                    </li>
                  `;
                }).join("")}
              </ul>
            ` : `<p class="hint">Indicators: ${NA_TEXT}</p>`}
          </div>
        `;
      }).join("") : `<p class="hint">Perspective data: ${NA_TEXT}</p>`}
      ${Array.isArray(errors) && errors.length > 0 ? `<p class="hint">${errors.join(" | ")}</p>` : ""}
    </div>
  `;
}

async function openTraceabilityView(cards) {
  openDrawer("Evidence Traceability", renderTraceabilityLoading());

  const perspectiveItems = resolvePerspectiveItems(cards);
  if (!CURRENT_PROJECT_ID || !CURRENT_PERIOD_ID) {
    openDrawer(
      "Evidence Traceability",
      renderTraceabilityPanel({
        projectId: CURRENT_PROJECT_ID,
        periodId: CURRENT_PERIOD_ID,
        perspectives: [],
        errors: ["Context unavailable: project/period not resolved"]
      })
    );
    return;
  }

  const perspectives = [];
  const errors = [];

  for (const item of perspectiveItems) {
    const pid = item?.perspective_id ?? null;
    if (!pid) continue;

    let scoreRows = null;
    let evidenceMap = null;
    let scoreErr = null;
    let evidenceErr = null;

    try {
      const sc = await fetchIndicatorScores(CURRENT_PROJECT_ID, CURRENT_PERIOD_ID, pid);
      scoreRows = Array.isArray(sc?.data) ? sc.data : null;
    } catch (e) {
      scoreErr = e;
    }

    try {
      const ev = await fetchIndicatorEvidence(CURRENT_PROJECT_ID, CURRENT_PERIOD_ID, pid);
      const map = ev?.data?.indicator_evidence;
      evidenceMap = map && typeof map === "object" ? map : null;
    } catch (e) {
      evidenceErr = e;
    }

    const byCode = new Map();
    if (Array.isArray(scoreRows)) {
      for (const row of scoreRows) {
        const code = row?.code;
        if (!code) continue;
        byCode.set(code, {
          code,
          title: row?.title ?? null,
          status: row?.is_scored === true ? "Included" : (row?.is_scored === false ? "Excluded" : NA_TEXT),
          score: row?.is_scored === true && Number.isFinite(Number(row?.score)) ? `${Number(row.score)}/5` : NA_TEXT,
          evidence_count: null,
          evidence_items: null,
        });
      }
    }

    if (evidenceMap && typeof evidenceMap === "object") {
      for (const [code, arr] of Object.entries(evidenceMap)) {
        const evArr = Array.isArray(arr) ? arr : [];
        if (!byCode.has(code)) {
          byCode.set(code, {
            code,
            title: null,
            status: NA_TEXT,
            score: NA_TEXT,
            evidence_count: evArr.length,
            evidence_items: evArr.map(ev => ({
              evidence_id: ev?.evidence_id ?? null,
              type: null,
              title: null,
            })),
          });
        } else {
          const r = byCode.get(code);
          r.evidence_count = evArr.length;
          r.evidence_items = evArr.map(ev => ({
            evidence_id: ev?.evidence_id ?? null,
            type: null,
            title: null,
          }));
        }
      }

      for (const row of byCode.values()) {
        if (row.evidence_items === null) {
          row.evidence_items = [];
          row.evidence_count = 0;
        }
      }
    }

    const totalEvidenceCount = evidenceMap && typeof evidenceMap === "object"
      ? Object.values(evidenceMap).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0)
      : null;

    if (scoreErr) errors.push(`[${pid}] indicator-scores unavailable: ${scoreErr?.message || scoreErr}`);
    if (evidenceErr) errors.push(`[${pid}] indicator-evidence unavailable: ${evidenceErr?.message || evidenceErr}`);

    perspectives.push({
      perspective_id: pid,
      weight: Number.isFinite(Number(item?.weight)) ? Number(item.weight) : null,
      indicator_count: Array.isArray(scoreRows) ? scoreRows.length : null,
      total_evidence_count: totalEvidenceCount,
      indicators: Array.from(byCode.values()),
    });
  }

  openDrawer(
    "Evidence Traceability",
    renderTraceabilityPanel({
      projectId: CURRENT_PROJECT_ID,
      periodId: CURRENT_PERIOD_ID,
      perspectives,
      errors,
    })
  );
  bindEvidenceOpenLinksInDrawer();
}

function getPhase2AStorageKey(projectId, periodId) {
  return `${PHASE_2A_STORAGE_PREFIX}:${projectId || "na"}:${periodId || "na"}`;
}

function loadPhase2ADrafts(projectId, periodId) {
  if (!projectId || !periodId) return [];
  try {
    const raw = localStorage.getItem(getPhase2AStorageKey(projectId, periodId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function savePhase2ADrafts(projectId, periodId, drafts) {
  if (!projectId || !periodId) return;
  localStorage.setItem(
    getPhase2AStorageKey(projectId, periodId),
    JSON.stringify(Array.isArray(drafts) ? drafts : [])
  );
}

function createDraftId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `draft-${crypto.randomUUID()}`;
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseTagsCsv(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
}

function formatIso(isoText) {
  if (!isoText) return NA_TEXT;
  const dt = new Date(isoText);
  if (Number.isNaN(dt.getTime())) return isoText;
  return dt.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function asIndicatorMap(rows) {
  const byCode = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const code = row?.code;
    if (!code) continue;
    byCode.set(code, row);
  }
  return byCode;
}

function normalizeEvidenceMap(raw) {
  return raw && typeof raw === "object" ? raw : {};
}

function renderPhase2ALoading() {
  return `
    <div class="phase2a-panel">
      <p class="hint">Loading Phase 2A controlled data entry...</p>
    </div>
  `;
}

function renderPhase2AView({ projectId, periodId, indicators, usedEvidenceMap, drafts, errors, isLocked }) {
  const contextReady = Boolean(projectId && periodId);
  const rows = sortIndicators(Array.isArray(indicators) ? indicators : []);
  const byIndicator = asIndicatorMap(rows);
  const usedMap = normalizeEvidenceMap(usedEvidenceMap);
  const draftRows = Array.isArray(drafts) ? [...drafts] : [];
  draftRows.sort((a, b) => String(b?.updated_at || "").localeCompare(String(a?.updated_at || "")));

  const optionHtml = rows.length
    ? rows.map(r => `
      <option value="${esc(r.code)}">
        ${esc(r.code)} - ${esc(r.title || "Untitled")} (${esc(r.perspective_id || "-")})
      </option>
    `).join("")
    : `<option value="">${NA_TEXT}</option>`;

  const attachmentRows = rows.length
    ? rows.map(ind => {
      const code = ind?.code;
      const used = Array.isArray(usedMap[code]) ? usedMap[code] : [];
      const mine = draftRows.filter(d => d?.indicator_code === code);
      const usedLinks = used.length
        ? used
          .slice(0, 3)
          .map(ev => ev?.evidence_id ? `<a href="#" class="ev-open" data-evid="${esc(ev.evidence_id)}">open</a>` : NA_TEXT)
          .join(" | ")
        : "No evidence";
      const usedMore = used.length > 3 ? ` (+${used.length - 3} more)` : "";

      return `
        <li>
          <div class="exp-row-head">
            <strong>${esc(ind?.code)}</strong> - ${esc(ind?.title || "Untitled")}
            <span class="badge info">${esc(ind?.perspective_id || "-")}</span>
          </div>
          <div class="meta">Used in scoring (read-only): ${used.length}</div>
          <div class="meta">Attached as draft/submitted: ${mine.length}</div>
          <div class="meta">Used evidence detail: ${usedLinks}${usedMore}</div>
          ${mine.length
            ? `<ul class="ind-list phase2a-draft-list">
                ${mine.map(d => {
                  const isDraft = d?.status === "DRAFT";
                  const statusClass = isDraft ? "warn" : "info";
                  const statusNote = isDraft ? "Draft - not used in scoring" : "Submitted - not used in scoring";
                  return `
                    <li>
                      <div class="exp-row-head">
                        <span><strong>${esc(d?.type || "-")}</strong> - ${esc(d?.title || "Untitled")}</span>
                        <span class="badge ${statusClass}">${esc(d?.status || NA_TEXT)}</span>
                      </div>
                      <div class="hint">${statusNote}</div>
                      <div class="meta">Submitted by: ${esc(d?.submitted_by || "-")}</div>
                      <div class="meta">Submitted at: ${esc(formatIso(d?.submitted_at))}</div>
                      <div class="meta">Created by: ${esc(d?.created_by || "-")} at ${esc(formatIso(d?.created_at))}</div>
                      ${isDraft && !isLocked
                        ? `<p><button type="button" class="ev-btn phase2a-submit-draft" data-draft-id="${esc(d?.id)}">Submit draft</button></p>`
                        : ""
                      }
                    </li>
                  `;
                }).join("")}
              </ul>`
            : `<p class="hint">No draft attachment.</p>`
          }
        </li>
      `;
    }).join("")
    : `<li><p class="hint">Indicator attachment: ${NA_TEXT}</p></li>`;

  return `
    <div class="phase2a-panel">
      <p class="hint">Phase 2A controlled input only. Input != Validation != Approval.</p>
      <p class="hint">Draft and submitted evidence here do not change scoring output.</p>
      ${isLocked ? `<p class="hint">Period is LOCKED. Phase 2A is read-only.</p>` : ""}
      <div class="phase2a-section">
        <h4>Role Model (Input Governance)</h4>
        <p><strong>Role:</strong> ${PHASE_2A_ROLE}</p>
        <p class="hint">Allowed: submit draft evidence, attach to indicator, fill evidence metadata.</p>
        <p class="hint">Not allowed: change included/excluded status, approval, or score impact.</p>
      </div>
      <div class="phase2a-section">
        <h4>Evidence Input (Draft)</h4>
        <p><strong>Project:</strong> ${esc(ro(projectId))}</p>
        <p><strong>Period:</strong> ${esc(ro(periodId))}</p>
        ${!contextReady ? `<p class="hint">Context unavailable: project/period not resolved.</p>` : ""}
        <form id="phase2a-form" class="phase2a-form">
          <fieldset ${(contextReady && !isLocked) ? "" : "disabled"}>
            <label>Type
              <select name="type" id="phase2a-type" required>
                <option value="FILE">FILE</option>
                <option value="URL">URL</option>
                <option value="TEXT">TEXT</option>
              </select>
            </label>
            <label>Indicator attachment
              <select name="indicator_code" id="phase2a-indicator" required>
                ${optionHtml}
              </select>
            </label>
            <label>Title
              <input type="text" name="title" id="phase2a-title" required />
            </label>
            <label>Description
              <textarea name="description" id="phase2a-description" rows="2"></textarea>
            </label>
            <label>Date
              <input type="date" name="document_date" id="phase2a-date" />
            </label>
            <label>Tags (comma separated)
              <input type="text" name="tags" id="phase2a-tags" placeholder="coordination, weekly" />
            </label>
            <div class="phase2a-type-field" data-phase2a-type="FILE">
              <label>File view URL
                <input type="url" name="view_url" id="phase2a-view-url" placeholder="https://..." />
              </label>
              <label>File download URL
                <input type="url" name="download_url" id="phase2a-download-url" placeholder="https://..." />
              </label>
            </div>
            <div class="phase2a-type-field" data-phase2a-type="URL">
              <label>External URL
                <input type="url" name="external_url" id="phase2a-external-url" placeholder="https://..." />
              </label>
            </div>
            <div class="phase2a-type-field" data-phase2a-type="TEXT">
              <label>Text content
                <textarea name="text_note" id="phase2a-text-note" rows="3" placeholder="Plain text only"></textarea>
              </label>
            </div>
            <p><button class="ev-btn" type="submit">${isLocked ? "Locked" : "Save draft"}</button></p>
          </fieldset>
        </form>
        <p id="phase2a-form-msg" class="hint"></p>
      </div>
      <div class="phase2a-section">
        <h4>Indicator Attachment (Non-binding)</h4>
        <p class="hint">Attached as draft/submitted is separate from used in scoring (read-only).</p>
        <ul class="ind-list phase2a-attachment-list">
          ${attachmentRows}
        </ul>
      </div>
      ${Array.isArray(errors) && errors.length ? `<p class="hint">${errors.join(" | ")}</p>` : ""}
    </div>
  `;
}

function setPhase2ATypeFieldVisibility(typeValue) {
  const currentType = String(typeValue || "FILE").toUpperCase();
  document.querySelectorAll("#drawer .phase2a-type-field").forEach(el => {
    const target = String(el.dataset.phase2aType || "").toUpperCase();
    el.style.display = target === currentType ? "" : "none";
  });
}

function buildDraftFromPhase2AForm(formEl, indicatorsByCode) {
  const now = new Date().toISOString();
  const formData = new FormData(formEl);
  const type = String(formData.get("type") || "").toUpperCase();
  const indicatorCode = String(formData.get("indicator_code") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const documentDate = String(formData.get("document_date") || "").trim();
  const tags = parseTagsCsv(formData.get("tags"));
  const viewUrl = String(formData.get("view_url") || "").trim();
  const downloadUrl = String(formData.get("download_url") || "").trim();
  const externalUrl = String(formData.get("external_url") || "").trim();
  const textNote = String(formData.get("text_note") || "").trim();

  if (!indicatorCode) return { error: "Indicator attachment is required." };
  if (!title) return { error: "Title is required." };
  if (!["FILE", "URL", "TEXT"].includes(type)) return { error: "Evidence type must be FILE, URL, or TEXT." };
  if (type === "FILE" && !viewUrl && !downloadUrl) {
    return { error: "FILE draft requires view URL or download URL." };
  }
  if (type === "URL" && !externalUrl) return { error: "URL draft requires external URL." };
  if (type === "TEXT" && !textNote) return { error: "TEXT draft requires text content." };

  const indicatorRow = indicatorsByCode.get(indicatorCode) || null;

  return {
    draft: {
      id: createDraftId(),
      status: "DRAFT",
      type,
      title,
      description: description || null,
      document_date: documentDate || null,
      tags,
      indicator_code: indicatorCode,
      indicator_title: indicatorRow?.title || null,
      perspective_id: indicatorRow?.perspective_id || null,
      view_url: type === "FILE" ? (viewUrl || null) : null,
      download_url: type === "FILE" ? (downloadUrl || null) : null,
      external_url: type === "URL" ? externalUrl : null,
      text_note: type === "TEXT" ? textNote : null,
      created_by: PHASE_2A_ROLE,
      created_at: now,
      updated_at: now,
      submitted_by: null,
      submitted_at: null,
    }
  };
}

function bindPhase2AInputHandlers({ projectId, periodId, indicators, isLocked }) {
  const formEl = document.getElementById("phase2a-form");
  if (!formEl) return;

  const indicatorsByCode = asIndicatorMap(indicators);
  const typeEl = document.getElementById("phase2a-type");
  if (typeEl) {
    setPhase2ATypeFieldVisibility(typeEl.value);
    typeEl.addEventListener("change", () => setPhase2ATypeFieldVisibility(typeEl.value));
  }

  formEl.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const msgEl = document.getElementById("phase2a-form-msg");
    if (isLocked) {
      if (msgEl) msgEl.textContent = "Period is LOCKED. Draft input is read-only.";
      return;
    }
    const out = buildDraftFromPhase2AForm(formEl, indicatorsByCode);
    if (out?.error) {
      if (msgEl) msgEl.textContent = out.error;
      return;
    }

    const drafts = loadPhase2ADrafts(projectId, periodId);
    drafts.unshift(out.draft);
    savePhase2ADrafts(projectId, periodId, drafts);
    await openPhase2AInputView();
  });

  document.querySelectorAll("#drawer .phase2a-submit-draft").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (isLocked) return;
      const draftId = btn.dataset.draftId;
      if (!draftId) return;

      const drafts = loadPhase2ADrafts(projectId, periodId);
      const idx = drafts.findIndex(x => x?.id === draftId);
      if (idx === -1) return;

      const current = drafts[idx];
      if (current?.status !== "DRAFT") return;
      const now = new Date().toISOString();
      drafts[idx] = {
        ...current,
        status: "SUBMITTED",
        submitted_by: PHASE_2A_ROLE,
        submitted_at: now,
        updated_at: now,
      };
      savePhase2ADrafts(projectId, periodId, drafts);
      await openPhase2AInputView();
    });
  });
}

async function openPhase2AInputView() {
  openDrawer("Phase 2A - Controlled Data Entry", renderPhase2ALoading());

  const errors = [];
  const projectId = CURRENT_PROJECT_ID;
  const periodId = CURRENT_PERIOD_ID;
  const locked = isPeriodLocked(projectId, periodId);

  let indicators = [];
  let usedEvidenceMap = {};

  if (!projectId || !periodId) {
    errors.push("Project/period context not resolved.");
  } else {
    try {
      indicators = await fetchProjectIndicators(projectId);
    } catch (e) {
      errors.push(`Project indicators unavailable: ${e?.message || e}`);
    }

    try {
      const ev = await fetchIndicatorEvidence(projectId, periodId, null);
      usedEvidenceMap = normalizeEvidenceMap(ev?.data?.indicator_evidence);
    } catch (e) {
      errors.push(`Used-in-scoring evidence unavailable: ${e?.message || e}`);
    }
  }

  const drafts = loadPhase2ADrafts(projectId, periodId);
  openDrawer(
    "Phase 2A - Controlled Data Entry",
    renderPhase2AView({
      projectId,
      periodId,
      indicators,
      usedEvidenceMap,
      drafts,
      errors,
      isLocked: locked,
    })
  );
  bindPhase2AInputHandlers({ projectId, periodId, indicators, isLocked: locked });
  bindEvidenceOpenLinksInDrawer();
}

function getGateCBimUseByProjectCode(projectCode) {
  if (!projectCode) return [];
  const cfg = GATE_C_ALIGNMENT_CONFIG?.projects?.[projectCode] || null;
  return Array.isArray(cfg?.bim_uses) ? cfg.bim_uses : [];
}

function getLatestReviewInfo(draft) {
  if (draft?.latest_review && typeof draft.latest_review === "object") return draft.latest_review;
  const history = Array.isArray(draft?.review_history) ? draft.review_history : [];
  return history.length ? history[history.length - 1] : null;
}

function normalizeReviewOutcome(value) {
  const txt = String(value || "").toUpperCase().trim();
  if (txt === "ACCEPTABLE") return "ACCEPTABLE";
  if (txt === "NEEDS REVISION") return "NEEDS REVISION";
  if (txt === "REJECTED") return "REJECTED";
  return null;
}

function reviewOutcomeBadgeClass(outcome) {
  if (outcome === "ACCEPTABLE") return "ok";
  if (outcome === "NEEDS REVISION") return "info";
  if (outcome === "REJECTED") return "warn";
  return "info";
}

function renderPhase2BLoading() {
  return `
    <div class="phase2b-panel">
      <p class="hint">Loading Phase 2B review and validation panel...</p>
    </div>
  `;
}

function renderPhase2BView({ projectId, periodId, projectCode, projectName, bimUses, indicators, submittedEvidence, errors, isLocked }) {
  const rows = Array.isArray(submittedEvidence) ? [...submittedEvidence] : [];
  rows.sort((a, b) => String(b?.submitted_at || "").localeCompare(String(a?.submitted_at || "")));
  const indByCode = asIndicatorMap(indicators || []);
  const bimUseText = Array.isArray(bimUses) && bimUses.length ? bimUses.join(", ") : NA_TEXT;

  return `
    <div class="phase2b-panel">
      <p class="hint">Phase 2B review sets evidence eligibility only. Review is not approval and does not change score.</p>
      ${isLocked ? `<p class="hint">Period is LOCKED. Phase 2B review is read-only.</p>` : ""}
      <div class="phase2b-section">
        <h4>Reviewer Governance</h4>
        <p><strong>Reviewer role:</strong> ${esc(PHASE_2B_REVIEWER_ROLE)}</p>
        <p><strong>Project:</strong> ${esc(ro(projectName || projectCode || projectId))} (${esc(ro(projectCode))})</p>
        <p><strong>Period:</strong> ${esc(ro(periodId))}</p>
        <p><strong>BIM Use context:</strong> ${esc(bimUseText)}</p>
        <p class="hint">Allowed outcomes: ACCEPTABLE, NEEDS REVISION, REJECTED.</p>
        <p class="hint">Review status is not approval status and has no period lock impact.</p>
      </div>
      <div class="phase2b-section">
        <h4>Submitted Evidence (Read-only)</h4>
        ${rows.length === 0 ? `
          <p class="hint">No submitted evidence found.</p>
        ` : `
          <ul class="ind-list phase2b-list">
            ${rows.map(d => {
              const latest = getLatestReviewInfo(d);
              const outcome = normalizeReviewOutcome(latest?.outcome);
              const indicatorRef = indByCode.get(d?.indicator_code) || null;
              const indicatorTitle = d?.indicator_title || indicatorRef?.title || "Untitled";
              const indicatorPerspective = d?.perspective_id || indicatorRef?.perspective_id || NA_TEXT;
              const tagsText = Array.isArray(d?.tags) ? d.tags.join(", ") : (d?.tags || NA_TEXT);
              const statusLabel = outcome ? `Reviewed - ${outcome}` : "Submitted - awaiting HO review";
              const statusClass = outcome ? reviewOutcomeBadgeClass(outcome) : "info";
              const reviewHistory = Array.isArray(d?.review_history) ? d.review_history : [];
              const reasonText = latest?.reason || latest?.review_reason || null;

              return `
                <li class="phase2b-item" data-draft-id="${esc(d?.id)}">
                  <div class="exp-row-head">
                    <span><strong>${esc(d?.type || "-")}</strong> - ${esc(d?.title || "Untitled")}</span>
                    <span class="badge ${statusClass}">${esc(statusLabel)}</span>
                  </div>
                  <div class="meta">Indicator: ${esc(ro(d?.indicator_code))} - ${esc(indicatorTitle)} (${esc(indicatorPerspective)})</div>
                  <div class="meta">Description: ${esc(ro(d?.description || null))}</div>
                  <div class="meta">Date: ${esc(ro(d?.document_date || null))}</div>
                  <div class="meta">Tags: ${esc(ro(tagsText || null))}</div>
                  <div class="meta">Submitted by: ${esc(ro(d?.submitted_by || null))}</div>
                  <div class="meta">Submitted at: ${esc(formatIso(d?.submitted_at || null))}</div>
                  <div class="meta">Review history count: ${reviewHistory.length}</div>
                  ${latest ? `
                    <div class="meta">Reviewed by: ${esc(ro(latest?.reviewed_by || null))}</div>
                    <div class="meta">Reviewed at: ${esc(formatIso(latest?.reviewed_at || null))}</div>
                    <div class="meta">Review reason: ${esc(ro(reasonText))}</div>
                  ` : `<div class="hint">No review decision yet.</div>`}
                  ${(outcome === "NEEDS REVISION" || outcome === "REJECTED")
                    ? `<div class="hint">Feedback loop: evidence is retained; project can submit a revision as a new cycle.</div>`
                    : ""}
                  <div class="phase2b-action">
                    <label>Review outcome
                      <select class="phase2b-outcome" data-draft-id="${esc(d?.id)}" ${isLocked ? "disabled" : ""}>
                        <option value="">Select outcome</option>
                        ${PHASE_2B_OUTCOMES.map(opt => `
                          <option value="${esc(opt)}" ${outcome === opt ? "selected" : ""}>${esc(opt)}</option>
                        `).join("")}
                      </select>
                    </label>
                    <label>Review reason (required)
                      <textarea class="phase2b-reason" data-draft-id="${esc(d?.id)}" rows="2" placeholder="Short reason from HO reviewer" ${isLocked ? "disabled" : ""}>${esc(reasonText || "")}</textarea>
                    </label>
                    <p>
                      <button type="button" class="ev-btn phase2b-apply-review" data-draft-id="${esc(d?.id)}" ${isLocked ? "disabled" : ""}>Apply review</button>
                    </p>
                    <p class="hint phase2b-msg" data-draft-id="${esc(d?.id)}"></p>
                  </div>
                </li>
              `;
            }).join("")}
          </ul>
        `}
      </div>
      ${Array.isArray(errors) && errors.length ? `<p class="hint">${errors.join(" | ")}</p>` : ""}
    </div>
  `;
}

function bindPhase2BHandlers({ projectId, periodId, isLocked }) {
  document.querySelectorAll("#drawer .phase2b-apply-review").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (isLocked) return;
      const draftId = btn.dataset.draftId;
      if (!draftId) return;
      const draftSel = String(draftId).replace(/"/g, '\\"');
      const outcomeEl = document.querySelector(`#drawer .phase2b-outcome[data-draft-id="${draftSel}"]`);
      const reasonEl = document.querySelector(`#drawer .phase2b-reason[data-draft-id="${draftSel}"]`);
      const msgEl = document.querySelector(`#drawer .phase2b-msg[data-draft-id="${draftSel}"]`);

      const outcome = normalizeReviewOutcome(outcomeEl?.value || "");
      const reason = String(reasonEl?.value || "").trim();

      if (!outcome) {
        if (msgEl) msgEl.textContent = "Review outcome is required.";
        return;
      }
      if (!reason) {
        if (msgEl) msgEl.textContent = "Review reason is required.";
        return;
      }

      const drafts = loadPhase2ADrafts(projectId, periodId);
      const idx = drafts.findIndex(x => x?.id === draftId);
      if (idx === -1) {
        if (msgEl) msgEl.textContent = "Evidence draft not found.";
        return;
      }

      const current = drafts[idx];
      if (current?.status !== "SUBMITTED") {
        if (msgEl) msgEl.textContent = "Only SUBMITTED evidence can be reviewed.";
        return;
      }

      const now = new Date().toISOString();
      const history = Array.isArray(current?.review_history) ? [...current.review_history] : [];
      const reviewEntry = {
        outcome,
        review_reason: reason,
        reviewed_by: PHASE_2B_REVIEWER_ROLE,
        reviewed_at: now,
      };
      history.push(reviewEntry);

      drafts[idx] = {
        ...current,
        latest_review: reviewEntry,
        review_history: history,
        updated_at: now,
      };
      savePhase2ADrafts(projectId, periodId, drafts);
      await openPhase2BReviewView();
    });
  });
}

async function openPhase2BReviewView() {
  openDrawer("Phase 2B - Review & Validation (HO)", renderPhase2BLoading());

  const errors = [];
  const projectId = CURRENT_PROJECT_ID;
  const periodId = CURRENT_PERIOD_ID;
  const locked = isPeriodLocked(projectId, periodId);
  const drafts = loadPhase2ADrafts(projectId, periodId);
  const submittedEvidence = drafts.filter(d => d?.status === "SUBMITTED");

  let projectCode = null;
  let projectName = null;
  let bimUses = [];
  let indicators = [];

  if (!projectId || !periodId) {
    errors.push("Project/period context not resolved.");
  } else {
    try {
      const projects = await fetchProjectsList();
      const project = (projects || []).find(p => String(p?.id) === String(projectId)) || null;
      projectCode = project?.code || null;
      projectName = project?.name || null;
      bimUses = getGateCBimUseByProjectCode(projectCode);
    } catch (e) {
      errors.push(`Project context unavailable: ${e?.message || e}`);
    }

    try {
      indicators = await fetchProjectIndicators(projectId);
    } catch (e) {
      errors.push(`Project indicators unavailable: ${e?.message || e}`);
    }
  }

  openDrawer(
    "Phase 2B - Review & Validation (HO)",
    renderPhase2BView({
      projectId,
      periodId,
      projectCode,
      projectName,
      bimUses,
      indicators,
      submittedEvidence,
      errors,
      isLocked: locked,
    })
  );
  bindPhase2BHandlers({ projectId, periodId, isLocked: locked });
}

function extractPhase2CScoreSummary(cards) {
  const rows = Array.isArray(cards) ? cards : [];
  const scoreCard = rows.find(c => c?.id === "score") || null;
  const perspectiveCard = rows.find(c => c?.id === "perspectives") || null;
  const perspectiveItems = Array.isArray(perspectiveCard?.items) ? perspectiveCard.items : [];

  return {
    final_bim_score: Number.isFinite(Number(scoreCard?.value)) ? Number(scoreCard.value) : null,
    perspective_breakdown: PERSPECTIVE_ORDER.map(pid => {
      const row = perspectiveItems.find(x => x?.perspective_id === pid) || null;
      return {
        perspective_id: pid,
        score: Number.isFinite(Number(row?.score)) ? Number(row.score) : null,
        weight: Number.isFinite(Number(row?.weight)) ? Number(row.weight) : null,
        weighted_score: Number.isFinite(Number(row?.weighted_score)) ? Number(row.weighted_score) : null,
      };
    }),
  };
}

function summarizeReviewOutcomes(drafts) {
  const rows = Array.isArray(drafts) ? drafts : [];
  const submitted = rows.filter(d => d?.status === "SUBMITTED");
  const acceptable = [];
  const needsRevision = [];
  const rejected = [];
  const awaiting = [];

  for (const row of submitted) {
    const latest = getLatestReviewInfo(row);
    const outcome = normalizeReviewOutcome(latest?.outcome);
    if (!outcome) {
      awaiting.push(row);
      continue;
    }
    if (outcome === "ACCEPTABLE") acceptable.push(row);
    else if (outcome === "NEEDS REVISION") needsRevision.push(row);
    else if (outcome === "REJECTED") rejected.push(row);
  }

  return { submitted, acceptable, needsRevision, rejected, awaiting };
}

function evaluatePhase2CPreconditions(summary) {
  const warnings = [];
  if ((summary?.awaiting || []).length > 0) {
    warnings.push("There are SUBMITTED evidence items still awaiting review.");
  }
  if ((summary?.needsRevision || []).length > 0) {
    warnings.push("There are evidence items with NEEDS REVISION.");
  }
  if ((summary?.rejected || []).length > 0) {
    warnings.push("There are evidence items with REJECTED outcome.");
  }
  return {
    pass: warnings.length === 0,
    warnings,
  };
}

function buildPhase2CSnapshot({ projectId, projectCode, header, scoreSummary, acceptableEvidence, approvedAt, approvedBy }) {
  const snapshotId = (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    ? `snap-${crypto.randomUUID()}`
    : `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    snapshot_id: snapshotId,
    immutable: true,
    project_id: projectId || null,
    period: header?.period || null,
    period_id: CURRENT_PERIOD_ID || null,
    project_code: projectCode || null,
    approval_timestamp: approvedAt,
    approved_by: approvedBy,
    final_bim_score: scoreSummary?.final_bim_score ?? null,
    perspective_breakdown: Array.isArray(scoreSummary?.perspective_breakdown)
      ? scoreSummary.perspective_breakdown
      : [],
    acceptable_evidence: (Array.isArray(acceptableEvidence) ? acceptableEvidence : []).map(d => ({
      evidence_id: d?.id || null,
      title: d?.title || null,
      type: d?.type || null,
      indicator_code: d?.indicator_code || null,
      reference: d?.view_url || d?.external_url || d?.text_note || null,
    })),
  };
}

function renderPhase2CLoading() {
  return `
    <div class="phase2c-panel">
      <p class="hint">Loading Phase 2C approval, lock, and snapshot...</p>
    </div>
  `;
}

function renderPhase2CView({
  projectId,
  periodId,
  projectCode,
  projectName,
  header,
  scoreSummary,
  reviewSummary,
  precheck,
  approval,
  snapshot,
  errors,
}) {
  const locked = isPeriodLocked(projectId, periodId);
  const decision = approval?.decision || "No decision";
  const status = approval?.period_status || "OPEN";
  const perspectiveRows = Array.isArray(scoreSummary?.perspective_breakdown)
    ? scoreSummary.perspective_breakdown
    : [];

  return `
    <div class="phase2c-panel">
      <p class="hint">Approval will lock this period and finalize score.</p>
      <p class="hint">Approval is an organizational decision, not a scoring recalculation.</p>
      <div class="phase2c-section">
        <h4>Approval Panel</h4>
        <p><strong>Approver role:</strong> ${esc(PHASE_2C_APPROVER_ROLE)}</p>
        <p><strong>Project:</strong> ${esc(ro(projectName || projectCode || projectId))} (${esc(ro(projectCode))})</p>
        <p><strong>Period:</strong> ${esc(ro(periodId))}</p>
        <p><strong>Period status:</strong> <span class="badge ${locked ? "warn" : "info"}">${esc(locked ? "LOCKED" : "OPEN")}</span></p>
        <p><strong>Final BIM Score:</strong> ${esc(ro(scoreSummary?.final_bim_score))}</p>
        <ul class="ind-list phase2c-persp-list">
          ${perspectiveRows.map(r => `
            <li>${esc(r?.perspective_id)}: score ${esc(ro(r?.score))}, weight ${esc(ro(r?.weight, r?.weight != null ? "%" : ""))}, weighted ${esc(ro(r?.weighted_score))}</li>
          `).join("")}
        </ul>
        <p><strong>Evidence ACCEPTABLE:</strong> ${esc(ro(reviewSummary?.acceptable?.length))}</p>
        <p><strong>Evidence NEEDS REVISION:</strong> ${esc(ro(reviewSummary?.needsRevision?.length))}</p>
        <p><strong>Evidence REJECTED:</strong> ${esc(ro(reviewSummary?.rejected?.length))}</p>
        <p><strong>Awaiting review:</strong> ${esc(ro(reviewSummary?.awaiting?.length))}</p>
      </div>
      <div class="phase2c-section">
        <h4>Pre-Conditions</h4>
        ${precheck?.pass
          ? `<p class="hint">Pre-condition check passed.</p>`
          : `<ul class="ind-list">${(precheck?.warnings || []).map(w => `<li>${esc(w)}</li>`).join("")}</ul>`
        }
      </div>
      <div class="phase2c-section">
        <h4>Approval Actions</h4>
        <p><strong>Latest decision:</strong> ${esc(decision)}</p>
        <p><strong>Decision reason:</strong> ${esc(ro(approval?.decision_reason))}</p>
        <p><strong>Decided by:</strong> ${esc(ro(approval?.decided_by))}</p>
        <p><strong>Decided at:</strong> ${esc(formatIso(approval?.decided_at))}</p>
        <div class="phase2c-warning">
          Approval will lock this period and finalize score.
        </div>
        <label>Decision reason (required)
          <textarea id="phase2c-reason" rows="2" placeholder="Formal reason from approver" ${locked ? "disabled" : ""}></textarea>
        </label>
        <div class="phase2c-actions">
          <button type="button" class="ev-btn phase2c-approve" ${locked ? "disabled" : ""}>APPROVE PERIOD</button>
          <button type="button" class="ev-btn phase2c-reject" ${locked ? "disabled" : ""}>REJECT APPROVAL</button>
        </div>
        <p id="phase2c-msg" class="hint"></p>
      </div>
      <div class="phase2c-section">
        <h4>Snapshot (Immutable)</h4>
        ${snapshot ? `
          <p><strong>Snapshot ID:</strong> ${esc(ro(snapshot?.snapshot_id))}</p>
          <p><strong>Approved by:</strong> ${esc(ro(snapshot?.approved_by))}</p>
          <p><strong>Approval timestamp:</strong> ${esc(formatIso(snapshot?.approval_timestamp))}</p>
          <p><strong>Final BIM Score:</strong> ${esc(ro(snapshot?.final_bim_score))}</p>
          <p><strong>Acceptable evidence in snapshot:</strong> ${esc(ro((snapshot?.acceptable_evidence || []).length))}</p>
          <p class="hint">Snapshot is immutable: no edit or delete action is provided.</p>
        ` : `<p class="hint">No snapshot generated yet.</p>`}
      </div>
      ${Array.isArray(errors) && errors.length ? `<p class="hint">${errors.map(esc).join(" | ")}</p>` : ""}
    </div>
  `;
}

function bindPhase2CHandlers({ projectId, periodId, projectCode, header, scoreSummary }) {
  const msgEl = document.getElementById("phase2c-msg");
  const reasonEl = document.getElementById("phase2c-reason");
  const approveBtn = document.querySelector("#drawer .phase2c-approve");
  const rejectBtn = document.querySelector("#drawer .phase2c-reject");

  const readReason = () => String(reasonEl?.value || "").trim();
  const setMsg = (txt) => { if (msgEl) msgEl.textContent = txt; };

  approveBtn?.addEventListener("click", async () => {
    if (isPeriodLocked(projectId, periodId)) {
      setMsg("Period already LOCKED.");
      return;
    }

    const reason = readReason();
    if (!reason) {
      setMsg("Decision reason is required.");
      return;
    }

    const drafts = loadPhase2ADrafts(projectId, periodId);
    const reviewSummary = summarizeReviewOutcomes(drafts);
    const precheck = evaluatePhase2CPreconditions(reviewSummary);
    if (!precheck.pass) {
      setMsg(`Cannot approve: ${precheck.warnings.join(" | ")}`);
      return;
    }

    const now = new Date().toISOString();
    let snapshot = loadPhase2CSnapshot(projectId, periodId);
    if (!snapshot) {
      snapshot = buildPhase2CSnapshot({
        projectId,
        projectCode,
        header,
        scoreSummary,
        acceptableEvidence: reviewSummary.acceptable,
        approvedAt: now,
        approvedBy: PHASE_2C_APPROVER_ROLE,
      });
      savePhase2CSnapshot(projectId, periodId, snapshot);
    }

    savePhase2CApproval(projectId, periodId, {
      version: "PHASE2C-v1",
      decision: "APPROVE PERIOD",
      period_status: "LOCKED",
      decision_reason: reason,
      decided_by: PHASE_2C_APPROVER_ROLE,
      decided_at: now,
      approved_by: PHASE_2C_APPROVER_ROLE,
      approved_at: now,
      snapshot_id: snapshot?.snapshot_id || null,
    });

    refreshHeaderLockStatus();
    await openPhase2CApprovalView();
  });

  rejectBtn?.addEventListener("click", async () => {
    if (isPeriodLocked(projectId, periodId)) {
      setMsg("Period already LOCKED.");
      return;
    }

    const reason = readReason();
    if (!reason) {
      setMsg("Decision reason is required.");
      return;
    }

    const now = new Date().toISOString();
    savePhase2CApproval(projectId, periodId, {
      version: "PHASE2C-v1",
      decision: "REJECT APPROVAL",
      period_status: "OPEN",
      decision_reason: reason,
      decided_by: PHASE_2C_APPROVER_ROLE,
      decided_at: now,
      approved_by: null,
      approved_at: null,
      snapshot_id: null,
    });

    refreshHeaderLockStatus();
    await openPhase2CApprovalView();
  });
}

async function openPhase2CApprovalView() {
  openDrawer("Phase 2C - Approval, Locking & Snapshot", renderPhase2CLoading());

  const errors = [];
  const projectId = CURRENT_PROJECT_ID;
  const periodId = CURRENT_PERIOD_ID;
  const drafts = loadPhase2ADrafts(projectId, periodId);
  const reviewSummary = summarizeReviewOutcomes(drafts);
  const precheck = evaluatePhase2CPreconditions(reviewSummary);
  const approval = loadPhase2CApproval(projectId, periodId);
  const snapshot = loadPhase2CSnapshot(projectId, periodId);
  const scoreSummary = extractPhase2CScoreSummary(CURRENT_CARDS);

  let projectCode = null;
  let projectName = null;
  if (!projectId || !periodId) {
    errors.push("Project/period context not resolved.");
  } else {
    try {
      const projects = await fetchProjectsList();
      const project = (projects || []).find(p => String(p?.id) === String(projectId)) || null;
      projectCode = project?.code || null;
      projectName = project?.name || null;
    } catch (e) {
      errors.push(`Project context unavailable: ${e?.message || e}`);
    }
  }

  openDrawer(
    "Phase 2C - Approval, Locking & Snapshot",
    renderPhase2CView({
      projectId,
      periodId,
      projectCode,
      projectName,
      header: CURRENT_HEADER,
      scoreSummary,
      reviewSummary,
      precheck,
      approval,
      snapshot,
      errors,
    })
  );
  bindPhase2CHandlers({
    projectId,
    periodId,
    projectCode,
    header: CURRENT_HEADER,
    scoreSummary,
  });
}

async function fetchIndicators(pid) {
  if (IND_CACHE.has(pid)) return IND_CACHE.get(pid);

  const res = await fetch(`/indicators?perspective_id=${encodeURIComponent(pid)}`);

  if (!res.ok) throw new Error(`Cannot load indicators (${res.status})`);

  const json = await res.json();

  // Normalisasi: dukung beberapa shape yang umum
  const list =
    Array.isArray(json) ? json :
    Array.isArray(json.data) ? json.data :
    Array.isArray(json.indicators) ? json.indicators :
    [];

  IND_CACHE.set(pid, list);
  return list;
}

function renderCards(cards) {
  const wrap = document.getElementById('cards');
  wrap.innerHTML = '';

  for (const c of cards) {
    const div = document.createElement('div');
    div.className = c.id === 'score' ? 'card primary' : 'card';

    if (c.items) {
      const max = Math.max(1, ...c.items.map(i => Number(i.weighted_score ?? 0)));

      div.innerHTML = `
        <h3>${c.title}</h3>
        <div class="list">
          ${c.items.map(i => {
            const v = Number(i.weighted_score ?? 0);
            const pct = v > 0 ? Math.min(100, (v / max) * 100) : 4; // min 4% untuk visibilitas
            return `
              <div class="barrow"
                  data-p="${i.perspective_id}"
                  data-weighted="${Number(i.weighted_score ?? 0)}"
                  data-score="${Number(i.score ?? 0)}"
                  data-weight="${Number(i.weight ?? 0)}">
                <span class="barlbl">${i.perspective_id}</span>
                <div class="barwrap">
                  <div class="barfill ${String(i.perspective_id).toLowerCase()}" style="width:${pct}%"></div>
                </div>
                <span class="barnum">${v.toFixed(2)}</span>
                <div class="tip">
                  ${i.perspective_id} · score:${i.score ?? 0} · w:${i.weight}% · weighted:${v.toFixed(2)}
                </div>
              </div>
            `;

          }).join('')}
        </div>
        ${c.meta ? `<div class="meta">${fmtMeta(c.meta)}</div>` : ''}
      `;
    } else {
      const isAlerts = c.id === 'alerts';
      const isAudit = c.id === 'audit';
      const isTrend = c.id === 'trend' || c.id === 'trend_monthly';

      if (isAlerts) {
        const n = Number(c.value ?? 0);
        const bcls = n > 0 ? 'warn' : 'ok';
        div.innerHTML = `
          <h3>${c.title}</h3>
          <div class="value">
            <span class="badge ${bcls}">${n} alert${n === 1 ? '' : 's'}</span>
          </div>
        `;
      } else if (isAudit) {
        const enabled = String(c.value).toLowerCase() === 'enabled';
        const bcls = enabled ? 'ok' : 'info';
        const metaText = c.meta
          ? Object.entries(c.meta).map(([k, v]) => {
              const out = (v && typeof v === 'object') ? JSON.stringify(v) : v;
              return `${k}: ${out}`;
            }).join('\n')
          : '';

        div.innerHTML = `
          <h3>${c.title}</h3>
          <div class="value">
            <span class="badge ${bcls} tooltip">
              ${enabled ? 'Explainable ✓' : 'Explainability'}
              <span class="tip"><pre style="margin:0;white-space:pre-wrap">${metaText}</pre></span>
            </span>
          </div>
        `;
      } else {
        const isTrend = c.id === 'trend' || c.id === 'trend_monthly';
        const isScore = c.id === 'score';

        const dir = isTrend ? (c.meta?.direction ?? 'flat') : null;
        const arrow = dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→';
        const cls = dir === 'up' ? 'up' : dir === 'down' ? 'down' : 'flat';

        // konversi 0–100 -> 0–5 untuk display metodologis
        const score100 = Number(c.value ?? 0);
        const score5 = (score100 / 100) * 5;

        const delta = isTrend ? Number(c.value ?? 0) : null;
        const deltaTxt = isTrend
          ? `<span class="pill">${delta >= 0 ? '+' : ''}${delta.toFixed(2)}</span>`
          : '';

        div.innerHTML = `
          <h3>${c.title}</h3>
          <div class="value ${isTrend ? cls : ''}">
            ${isScore ? `${score100.toFixed(0)}` : c.value}
            ${isTrend ? `<span class="badge ${cls}">${arrow} ${dir}</span>` : ''}
            ${deltaTxt}
          </div>
          ${isScore ? `<div class="meta">(${score5.toFixed(2)} / 5)</div>` : ''}
          ${!isScore && c.meta ? `<div class="meta">${fmtMeta(c.meta)}</div>` : ''}
        `;
      }

    }

    div.addEventListener('click', () => {
      console.debug('[BCL click]', c.id, c);
    });

    wrap.appendChild(div);

    // U2.2c — inject indikator ke setiap barrow
    div.querySelectorAll('.barrow').forEach(row => {
      const pid = row.dataset.p;
      const src = (c.items || []).find(x => x.perspective_id === pid);
      //row._indicators = src?.indicators || [];
      row._indicators = src?.indicators?.length
        ? src.indicators
        : (MOCK_INDICATORS[pid] || []);
    });

    div.querySelectorAll('.barrow').forEach(row => {
      row.addEventListener('click', async (e) => {
        e.stopPropagation();

        const pid = row.dataset.p;

        // ⬅️ INI LOGIKA TOGGLE
        if (isDrawerOpen() && activePerspectiveId === pid) {
          closeDrawer();
          return;
        }

        activePerspectiveId = pid;

        const weighted = Number(row.dataset.weighted ?? 0);
        const score = Number(row.dataset.score ?? 0);
        const weight = Number(row.dataset.weight ?? 0);

        openDrawer(
          `Perspective ${pid}`,
          `
            <p><strong>Score:</strong> ${score}</p>
            <p><strong>Weight:</strong> ${weight}%</p>
            <p><strong>Weighted score:</strong> ${weighted.toFixed(2)}</p>
            <hr/>
            <p class="hint">Loading indicators…</p>
          `
        );

        try {
          const indicators = await fetchIndicators(pid);
          let indicatorScoresRows = null;
          let indicatorScoresError = null;
          if (CURRENT_PROJECT_ID && CURRENT_PERIOD_ID) {
            try {
              const sc = await fetchIndicatorScores(CURRENT_PROJECT_ID, CURRENT_PERIOD_ID, pid);
              indicatorScoresRows = Array.isArray(sc?.data) ? sc.data : null;
            } catch (e) {
              indicatorScoresError = e;
            }
          } else {
            indicatorScoresError = new Error("Period context not resolved");
          }

          let indicatorEvidenceMap = null;
          let indicatorEvidenceError = null;
          let evidenceSummaryHtml = `<p class="hint">Evidence: ${NA_TEXT}</p>`;
          let evidenceListHtml = '';

          if (CURRENT_PROJECT_ID && CURRENT_PERIOD_ID) {
            try {
              const ev = await fetchIndicatorEvidence(CURRENT_PROJECT_ID, CURRENT_PERIOD_ID, pid);
              const m = ev?.data?.indicator_evidence || null;
              indicatorEvidenceMap = (m && typeof m === "object") ? m : null;

              const entries = Object.entries(indicatorEvidenceMap || {})
                .filter(([, arr]) => Array.isArray(arr) && arr.length > 0)
                .map(([code, arr]) => {
                  const first = arr[0];
                  const evid = first?.evidence_id;
                  return `<li>
                  ${code}: ${arr.length} evidence
                  ${evid ? ` - <a href="#" class="ev-open" data-evid="${evid}">open</a>` : ""}
                </li>`;
                });

              const count = Object.keys(indicatorEvidenceMap || {}).length;

              evidenceListHtml = entries.length
                ? `<ul class="ind-list">${entries.join('')}</ul>`
                : '';

              evidenceSummaryHtml =
                count === 0
                  ? `<p class="hint">Evidence: Belum ada evidence ter-link pada period ini.</p>`
                  : `<p class="hint">Evidence loaded: ${count} indicator(s)</p>`;

            } catch (e) {
              indicatorEvidenceError = e;
              evidenceSummaryHtml = `<p class="hint">Evidence load failed: ${e?.message || e}</p>`;
              evidenceListHtml = '';
            }
          } else {
            indicatorEvidenceError = new Error("Period context not resolved");
          }

          const explainabilityHtml = renderExplainabilityPanel({
            perspectiveId: pid,
            weight,
            averageScore: score,
            contribution: weighted,
            indicatorScores: indicatorScoresRows,
            scoreError: indicatorScoresError,
            evidenceMap: indicatorEvidenceMap,
            evidenceError: indicatorEvidenceError,
          });

          let auditHtml = `<p class="hint">Audit: pending</p>`;
          if (CURRENT_PROJECT_ID && CURRENT_PERIOD_ID) {
            try {
              const ar = await fetch(
                `/projects/${CURRENT_PROJECT_ID}/periods/${CURRENT_PERIOD_ID}/indicator-audit?perspective_id=${encodeURIComponent(pid)}`
              );
              if (!ar.ok) throw new Error(`audit fetch failed: ${ar.status}`);
              const aj = await ar.json();
              if (!aj?.ok || aj.__signature !== 'INDICATOR-AUDIT-v1') {
                throw new Error('bad INDICATOR-AUDIT-v1 payload');
              }

              const rows = Array.isArray(aj.data) ? aj.data : [];
              auditHtml = rows.length
                ? `<ul class="ind-list">
                    ${rows.map(r => `
                      <li>
                        <strong>${r.code}</strong>
                        — updated ${r.updated_at ?? '-'}
                        ${r.updated_by ? `by ${r.updated_by}` : ''}
                      </li>
                    `).join('')}
                  </ul>`
                : `<p class="hint">Audit: Belum ada aktivitas Audit pada period ini.</p>`;
            } catch (e) {
              auditHtml = `<p class="hint">Audit load failed: ${e?.message || e}</p>`;
            }
          }

          openDrawer(
            `Perspective ${pid}`,
            `
              <p><strong>Score:</strong> ${score}</p>
              <p><strong>Weight:</strong> ${weight}%</p>
              <p><strong>Weighted score:</strong> ${weighted.toFixed(2)}</p>
              <hr/>
              <h4>Explainability</h4>
              ${explainabilityHtml}
              <hr/>
              <h4>Indicators</h4>
              ${renderIndicators(indicators)}
              <hr/>
              <h4>Evidence Summary</h4>
              ${evidenceSummaryHtml}
              ${evidenceListHtml}
              <hr/>
              <h4>Audit</h4>
              ${auditHtml}
            `
          );

          // U5/U6/U7: bind evidence open links inside drawer
          bindEvidenceOpenLinksInDrawer();

        } catch (err) {
          // fallback ke mock yg sudah ada di row._indicators
          openDrawer(
            `Perspective ${pid}`,
            `
              <p><strong>Score:</strong> ${score}</p>
              <p><strong>Weight:</strong> ${weight}%</p>
              <p><strong>Weighted score:</strong> ${weighted.toFixed(2)}</p>
              <hr/>
              <p class="hint">API indicators gagal: ${err?.message || String(err)}</p>
              ${renderIndicators(row._indicators || [])}
            `
          );
        }
      });
    });
  }

  const gateCCard = document.createElement("div");
  gateCCard.className = "card";
  gateCCard.innerHTML = `
    <h3>Gate C: Configuration & Alignment</h3>
    <div class="meta">Read-only project configuration and cross-project alignment for HO.</div>
    <p><a href="#" class="ev-btn gate-c-open">Open view</a></p>
  `;
  gateCCard.querySelector(".gate-c-open")?.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await openGateCView();
  });
  wrap.appendChild(gateCCard);

  const traceCard = document.createElement("div");
  traceCard.className = "card";
  traceCard.innerHTML = `
    <h3>Evidence Traceability</h3>
    <div class="meta">Read-only mapping: Project/Period -> Perspective -> Indicator -> Evidence</div>
    <p><a href="#" class="ev-btn trace-open">Open view</a></p>
  `;
  traceCard.querySelector(".trace-open")?.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await openTraceabilityView(cards);
  });
  wrap.appendChild(traceCard);

  const phase2ACard = document.createElement("div");
  phase2ACard.className = "card";
  phase2ACard.innerHTML = `
    <h3>Phase 2A: Controlled Data Entry</h3>
    <div class="meta">Input governance only: draft/submitted evidence, non-binding, no scoring impact.</div>
    <p><a href="#" class="ev-btn phase2a-open">Open view</a></p>
  `;
  phase2ACard.querySelector(".phase2a-open")?.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await openPhase2AInputView();
  });
  wrap.appendChild(phase2ACard);

  const phase2BCard = document.createElement("div");
  phase2BCard.className = "card";
  phase2BCard.innerHTML = `
    <h3>Phase 2B: Review & Validation</h3>
    <div class="meta">HO review for submitted evidence eligibility only (no scoring, no approval, no lock).</div>
    <p><a href="#" class="ev-btn phase2b-open">Open view</a></p>
  `;
  phase2BCard.querySelector(".phase2b-open")?.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await openPhase2BReviewView();
  });
  wrap.appendChild(phase2BCard);

  const phase2CCard = document.createElement("div");
  phase2CCard.className = "card";
  phase2CCard.innerHTML = `
    <h3>Phase 2C: Approval, Locking & Snapshot</h3>
    <div class="meta">Final organizational legitimacy: approve period, lock score, generate immutable snapshot.</div>
    <p><a href="#" class="ev-btn phase2c-open">Open view</a></p>
  `;
  phase2CCard.querySelector(".phase2c-open")?.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await openPhase2CApprovalView();
  });
  wrap.appendChild(phase2CCard);
}

function renderLoading() {
  const header = document.getElementById('header');
  const cards = document.getElementById('cards');
  header.innerHTML = `<div class="skeleton sk-h"></div>`;
  cards.innerHTML = `
    <div class="card skeleton sk-card"></div>
    <div class="card skeleton sk-card"></div>
    <div class="card skeleton sk-card"></div>
    <div class="card skeleton sk-card"></div>
  `;
}

function renderState(kind, title, hint) {
  document.getElementById('cards').innerHTML = `
    <div class="state ${kind}">
      <div class="title">${title}</div>
      <div class="hint">${hint}</div>
    </div>
  `;
}

(async () => {
  try {
    renderLoading();

    const payload = await fetchBundle();
    console.log("DEBUG header", payload?.data?.header);

    if (!payload?.ok) {
      const msg = payload?.error?.message || 'Unknown API error';
      renderState('error', 'API Error', msg);
      return;
    }

    const header = payload?.data?.header;
    const cards = payload?.data?.cards;

    if (!header || !Array.isArray(cards) || cards.length === 0) {
      document.getElementById('header').innerHTML = `<h2>Dashboard</h2>`;
      renderState('empty', 'No data', 'Bundle returned no cards. Check project/period parameters.');
      return;
    }

    // U3: project uuid direct from header
    CURRENT_PROJECT_ID = header?.project_id ?? null;
    console.log("U3 project id (direct)", CURRENT_PROJECT_ID);

    // U3: resolve period UUID from year/week
    CURRENT_PERIOD_ID = null;
    if (CURRENT_PROJECT_ID && header?.period?.year && header?.period?.week) {
      try {
        const rr = await fetch(`/projects/${CURRENT_PROJECT_ID}/periods`);
        const txt = await rr.text();
        //console.log("DEBUG periods http", rr.status, txt.slice(0, 300));

        if (!rr.ok) throw new Error(`periods fetch failed: ${rr.status}`);

        const rj = JSON.parse(txt);
        const periods = Array.isArray(rj?.data) ? rj.data : [];
        //console.log("DEBUG periods sample", periods.slice(0, 5));

        const per = periods.find(p =>
          Number(p.year) === Number(header.period.year) &&
          Number(p.week) === Number(header.period.week)
        );

        CURRENT_PERIOD_ID = per?.id ?? null;
        console.log("U3 period id (resolved)", CURRENT_PERIOD_ID);
      } catch (e) {
        console.warn("U3 period resolve failed", e?.message || e);
      }
    } else {
      console.info("U3 period resolve skipped (missing project/year/week)");
    }

    CURRENT_HEADER = header;
    CURRENT_CARDS = Array.isArray(cards) ? cards : [];
    renderHeader(header);
    renderCards(cards);
  } catch (e) {
    const msg = e?.message || String(e);
    renderState('error', 'Runtime Error', msg);
  }
})();

// U5: global delegated handler for "Open file" inside drawer
document.addEventListener("click", async (e) => {
  const a = e.target.closest("#drawer a[data-ev-file]");
  if (!a) return;

  e.preventDefault();
  e.stopPropagation();

  const evid = a.dataset.evFile;
  if (!evid) return;

  await openEvidenceDetail(evid);
});

