import { type CmapViewData } from "./schema.js";

export function renderViewHtml(data: CmapViewData): string {
  const safeData = redactViewData(data);
  const json = escapeScriptJson(JSON.stringify(safeData, null, 2));
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(safeData.project.name)} cmap view</title>
  <style>
    :root { color-scheme: light; --ink: #19201f; --muted: #63706c; --line: #d9dfdc; --wash: #f5f7f6; --accent: #145c4b; --warn: #8a4b00; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: #ffffff; }
    header { padding: 28px 32px 18px; border-bottom: 1px solid var(--line); background: var(--wash); }
    main { padding: 24px 32px 40px; max-width: 1180px; margin: 0 auto; }
    h1 { margin: 0 0 8px; font-size: 28px; line-height: 1.2; }
    h2 { margin: 28px 0 12px; font-size: 18px; }
    h3 { margin: 0 0 8px; font-size: 15px; }
    p, li, td, th { font-size: 14px; line-height: 1.45; }
    .meta { color: var(--muted); margin: 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-top: 16px; }
    .stat, .module, .panel { border: 1px solid var(--line); border-radius: 8px; padding: 14px; background: #fff; }
    .stat strong { display: block; font-size: 24px; color: var(--accent); }
    .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 18px 0 6px; }
    .toolbar input[type="search"] { min-width: min(420px, 100%); flex: 1 1 280px; padding: 9px 10px; border: 1px solid var(--line); border-radius: 6px; font: inherit; }
    .toolbar label, summary { cursor: pointer; }
    .modules { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
    .pill { display: inline-block; border: 1px solid var(--line); border-radius: 999px; padding: 2px 8px; margin: 2px 4px 2px 0; color: var(--muted); font-size: 12px; }
    .actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    button { border: 1px solid var(--line); border-radius: 6px; padding: 6px 8px; background: #fff; color: var(--ink); font: inherit; font-size: 12px; cursor: pointer; }
    button:hover { border-color: var(--accent); color: var(--accent); }
    .is-hidden { display: none !important; }
    .warning { border-left: 4px solid var(--warn); background: #fff7ed; }
    table { width: 100%; border-collapse: collapse; border: 1px solid var(--line); }
    th, td { text-align: left; vertical-align: top; padding: 8px 10px; border-bottom: 1px solid var(--line); }
    th { background: var(--wash); }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(safeData.project.name)} cmap view</h1>
    <p class="meta">Schema ${escapeHtml(safeData.schema)} · Generated ${escapeHtml(safeData.generatedAt)} · Root ${escapeHtml(safeData.projectRootName)}</p>
    <p class="meta">Canonical source: .context/ · Generated source: .context/generated/${safeData.sourceCommit ? ` · Source commit ${escapeHtml(safeData.sourceCommit)}` : ""}</p>
    <div class="grid">
      ${stat("Modules", safeData.summary.moduleCount)}
      ${stat("Evidence", safeData.summary.evidenceCount)}
      ${stat("Candidates", safeData.summary.candidateCount)}
      ${stat("Warnings", safeData.summary.warningCount)}
    </div>
  </header>
  <main>
    <section class="toolbar" aria-label="Review filters">
      <input id="view-search" type="search" placeholder="Search modules, candidates, evidence">
      <label><input id="filter-stale" type="checkbox"> Stale</label>
      <label><input id="filter-candidates" type="checkbox"> Has candidates</label>
      <label><input id="filter-high-risk" type="checkbox"> High risk</label>
      <label><input id="filter-generated" type="checkbox"> Generated evidence</label>
    </section>
    <section>
      <h2>Overview</h2>
      ${renderOverview(safeData)}
    </section>
    <section>
      <h2>Warnings</h2>
      ${safeData.warnings.length > 0 ? `<div class="panel warning"><ul>${safeData.warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : `<p class="meta">No warnings.</p>`}
    </section>
    <section>
      <h2>Modules</h2>
      <div class="modules">${safeData.modules.map(renderModule).join("")}</div>
    </section>
    <section>
      <h2>Canonical Relations</h2>
      ${renderCanonicalRelations(safeData)}
    </section>
    <section>
      <h2>Verification</h2>
      ${renderVerification(safeData)}
    </section>
    ${safeData.included.freshness ? `<section><h2>Freshness</h2>${renderFreshness(safeData)}</section>` : ""}
    ${safeData.included.generated ? `<section><h2>Generated Evidence</h2>${renderEvidence(safeData)}</section>` : ""}
    ${safeData.included.inbox ? `<section><h2>Review Candidates</h2>${renderCandidates(safeData)}</section><section><h2>Relation Candidates</h2>${renderRelationCandidates(safeData)}</section>` : ""}
    <dialog id="module-dialog"><button type="button" data-close-dialog>Close</button><h2 id="module-dialog-title">Module</h2><pre id="module-dialog-body"></pre></dialog>
    <script type="application/json" id="cmap-view-data">${json}</script>
    <script>${renderClientScript()}</script>
  </main>
</body>
</html>
`;
}

function renderOverview(data: CmapViewData): string {
  const rows = [
    ["Purpose", data.overview.purpose],
    ["Active Goal", data.overview.activeGoal],
    ["Current Task", data.overview.currentTask],
    ["Next Step", data.overview.nextStep],
    ["Verified", data.overview.verified],
    ["Last Verified", data.overview.lastVerified]
  ];
  return `<table><tbody>${rows.map(([label, value]) => `<tr><th>${escapeHtml(label ?? "")}</th><td>${escapeHtml(value || "Not available")}</td></tr>`).join("")}</tbody></table>`;
}

function stat(label: string, value: number): string {
  return `<div class="stat"><strong>${value}</strong><span>${escapeHtml(label)}</span></div>`;
}

function renderModule(module: CmapViewData["modules"][number]): string {
  const relationText = module.relations.length > 0
    ? module.relations.map((relation) => `${relation.type}: ${relation.target}`).join(", ")
    : "Not available";
  const searchable = [module.id, module.name, module.aliases.join(" "), module.paths.join(" "), relationText].join(" ");
  const hasCandidate = module.freshness.pendingInboxCandidates.length > 0;
  const isStale = module.freshness.state !== "Not available" && module.freshness.state !== "reviewed";
  const hasGenerated = module.freshness.newestGeneratedEvidenceAt !== "Not available";
  return `<article class="module" data-search="${escapeAttr(searchable)}" data-stale="${isStale ? "true" : "false"}" data-has-candidate="${hasCandidate ? "true" : "false"}" data-high-risk="false" data-generated="${hasGenerated ? "true" : "false"}" data-module-id="${escapeAttr(module.id)}">
    <h3>${escapeHtml(module.name)}</h3>
    <p class="meta"><code>${escapeHtml(module.id)}</code> · ${escapeHtml(module.status)} · ${escapeHtml(module.docPath)}</p>
    <p>${module.aliases.map((alias) => `<span class="pill">${escapeHtml(alias)}</span>`).join("")}</p>
    <p><strong>Paths:</strong> ${escapeHtml(module.paths.join(", ") || "Not available")}</p>
    <p><strong>Relations:</strong> ${escapeHtml(relationText)}</p>
    <p><strong>Freshness:</strong> ${escapeHtml(module.freshness.state)} · ${escapeHtml(module.freshness.lastReviewedAt)}</p>
    ${renderCommandButtons(module.suggestedCommands)}
    <button type="button" data-open-module="${escapeAttr(module.id)}">Details</button>
  </article>`;
}

function renderCanonicalRelations(data: CmapViewData): string {
  const rows = data.modules.flatMap((module) =>
    module.relations.map((relation) => ({
      from: module.id,
      type: relation.type,
      target: relation.target
    }))
  );
  if (rows.length === 0) {
    return `<p class="meta">Not available.</p>`;
  }
  return `<table><thead><tr><th>From</th><th>Relation</th><th>To</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.from)}</td><td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.target)}</td></tr>`).join("")}</tbody></table>`;
}

function renderVerification(data: CmapViewData): string {
  const commands = data.verify.requiredCommands.length > 0
    ? `<table><thead><tr><th>Purpose</th><th>Command</th><th>Expected</th><th>When</th></tr></thead><tbody>${data.verify.requiredCommands.map((entry) => `<tr><td>${escapeHtml(entry.purpose)}</td><td><code>${escapeHtml(entry.command)}</code></td><td>${escapeHtml(entry.expected ?? "Not available")}</td><td>${escapeHtml(entry.when ?? "Not available")}</td></tr>`).join("")}</tbody></table>`
    : `<p class="meta">Required commands: Not available.</p>`;
  const checks = data.verify.manualChecks.length > 0
    ? `<ul>${data.verify.manualChecks.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : `<p class="meta">Manual checks: Not available.</p>`;
  return `${commands}<h3>Manual Checks</h3>${checks}`;
}

function renderFreshness(data: CmapViewData): string {
  if (data.modules.length === 0) {
    return `<p class="meta">Not available.</p>`;
  }
  return `<table><thead><tr><th>Module</th><th>State</th><th>Last Review</th><th>Generated Evidence</th><th>Pending Candidates</th></tr></thead><tbody>${data.modules.map((module) => `<tr><td>${escapeHtml(module.id)}</td><td>${escapeHtml(freshnessLabel(module.freshness.state, module.freshness.pendingInboxCandidates.length))}</td><td>${escapeHtml(module.freshness.lastReviewedAt)}</td><td>${escapeHtml(module.freshness.newestGeneratedEvidenceAt)}</td><td>${escapeHtml(module.freshness.pendingInboxCandidates.join(", ") || "None")}</td></tr>`).join("")}</tbody></table>`;
}

function freshnessLabel(state: string, pendingCount: number): string {
  if (pendingCount > 0) {
    return "Pending candidates";
  }
  if (state === "baseline") {
    return "Baseline only";
  }
  if (state === "reviewed") {
    return "Reviewed";
  }
  return state || "Not available";
}

function renderEvidence(data: CmapViewData): string {
  if (data.evidence.length === 0) {
    return `<p class="meta">Not available.</p>`;
  }
  return `<table><thead><tr><th>Module</th><th>Created</th><th>Summary</th><th>Files</th></tr></thead><tbody>${data.evidence.map((entry) => `<tr data-search="${escapeAttr([entry.moduleId, entry.summary, entry.files.join(" ")].join(" "))}" data-generated="true"><td>${escapeHtml(entry.moduleId)}</td><td>${escapeHtml(entry.createdAt)}</td><td>${escapeHtml(entry.summary)}</td><td>${escapeHtml(entry.files.join(", "))}</td></tr>`).join("")}</tbody></table>`;
}

function renderCandidates(data: CmapViewData): string {
  if (data.candidates.length === 0) {
    return `<p class="meta">Not available.</p>`;
  }
  return `<table><thead><tr><th>ID</th><th>Type</th><th>Risk</th><th>Module</th><th>Summary</th><th>Command</th></tr></thead><tbody>${data.candidates.map((candidate) => `<tr data-search="${escapeAttr([candidate.id, candidate.type, candidate.risk, candidate.moduleId, candidate.summary].join(" "))}" data-has-candidate="true" data-high-risk="${candidate.risk === "high" ? "true" : "false"}"><td>${escapeHtml(candidate.id)}</td><td>${escapeHtml(candidate.type)}</td><td>${escapeHtml(candidate.risk)}</td><td>${escapeHtml(candidate.moduleId)}</td><td>${escapeHtml(candidate.summary)}</td><td>${renderCommandButtons(candidate.suggestedCommands)}</td></tr>`).join("")}</tbody></table>`;
}

function renderRelationCandidates(data: CmapViewData): string {
  if (data.relationCandidates.length === 0) {
    return `<p class="meta">Not available.</p>`;
  }
  return `<table><thead><tr><th>ID</th><th>Relation</th><th>From</th><th>To</th><th>Summary</th><th>Command</th></tr></thead><tbody>${data.relationCandidates.map((candidate) => `<tr data-search="${escapeAttr([candidate.id, candidate.relation, candidate.from, candidate.to, candidate.summary].join(" "))}" data-has-candidate="true" data-high-risk="false"><td>${escapeHtml(candidate.id)}<br><span class="pill">Candidate / Non-canonical</span></td><td>${escapeHtml(candidate.relation)}</td><td>${escapeHtml(candidate.from)}</td><td>${escapeHtml(candidate.to)}</td><td>${escapeHtml(candidate.summary)}</td><td>${renderCommandButtons(candidate.suggestedCommands)}</td></tr>`).join("")}</tbody></table>`;
}

function renderCommandButtons(commands: Array<{ label: string; command: string }>): string {
  if (commands.length === 0) {
    return "";
  }
  return `<div class="actions">${commands.map((item) => `<button type="button" data-copy-command="${escapeAttr(item.command)}">${escapeHtml(item.label)}</button>`).join("")}</div>`;
}

export function redactViewData(data: CmapViewData): CmapViewData {
  return JSON.parse(JSON.stringify(data, (_key, value: unknown) => typeof value === "string" ? redact(value) : value)) as CmapViewData;
}

function redact(value: string): string {
  return value
    .replace(/\b(api[_-]?key|token|secret|password)(\s*[:=]\s*)(["']?)[^\s"'`<>&]+/gi, "$1$2[REDACTED]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/g, "Bearer [REDACTED]");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function escapeScriptJson(value: string): string {
  return value.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function renderClientScript(): string {
  return `(function () {
  const dataEl = document.getElementById("cmap-view-data");
  const data = dataEl ? JSON.parse(dataEl.textContent || "{}") : {};
  const search = document.getElementById("view-search");
  const filters = {
    stale: document.getElementById("filter-stale"),
    candidates: document.getElementById("filter-candidates"),
    highRisk: document.getElementById("filter-high-risk"),
    generated: document.getElementById("filter-generated")
  };
  const rows = Array.from(document.querySelectorAll("[data-search]"));
  function applyFilters() {
    const query = (search && "value" in search ? String(search.value) : "").toLowerCase();
    for (const row of rows) {
      const text = String(row.getAttribute("data-search") || "").toLowerCase();
      const visible = (!query || text.includes(query))
        && (!filters.stale.checked || row.getAttribute("data-stale") === "true")
        && (!filters.candidates.checked || row.getAttribute("data-has-candidate") === "true")
        && (!filters.highRisk.checked || row.getAttribute("data-high-risk") === "true")
        && (!filters.generated.checked || row.getAttribute("data-generated") === "true");
      row.classList.toggle("is-hidden", !visible);
    }
  }
  search && search.addEventListener("input", applyFilters);
  Object.values(filters).forEach((input) => input && input.addEventListener("change", applyFilters));
  document.addEventListener("click", async function (event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const command = target.getAttribute("data-copy-command");
    if (command) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(command);
      }
      target.textContent = "Copied";
    }
    const moduleId = target.getAttribute("data-open-module");
    if (moduleId) {
      const module = (data.modules || []).find((item) => item.id === moduleId);
      const dialog = document.getElementById("module-dialog");
      const title = document.getElementById("module-dialog-title");
      const body = document.getElementById("module-dialog-body");
      if (module && dialog && title && body) {
        title.textContent = module.name || module.id;
        body.textContent = JSON.stringify(module, null, 2);
        dialog.showModal && dialog.showModal();
      }
    }
    if (target.hasAttribute("data-close-dialog")) {
      const dialog = document.getElementById("module-dialog");
      dialog && dialog.close && dialog.close();
    }
  });
}());`;
}
