import { type CmapViewData } from "./schema.js";
import { enMessages, type ViewMessages } from "./messages.js";

export function renderViewHtml(data: CmapViewData): string {
  const safeData = redactViewData(data);
  const json = escapeScriptJson(JSON.stringify(safeData, null, 2));
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(safeData.project.name)} ${escapeHtml(enMessages.htmlTitleSuffix)}</title>
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
    <h1>${escapeHtml(safeData.project.name)} ${escapeHtml(enMessages.htmlTitleSuffix)}</h1>
    <p class="meta">Schema ${escapeHtml(safeData.schema)} · Generated ${escapeHtml(safeData.generatedAt)} · Root ${escapeHtml(safeData.projectRootName)}</p>
    <p class="meta">${escapeHtml(enMessages.canonicalSource)}: .context/ · ${escapeHtml(enMessages.generatedSource)}: .context/generated/${safeData.sourceCommit ? ` · ${escapeHtml(enMessages.sourceCommit)} ${escapeHtml(safeData.sourceCommit)}` : ""}</p>
    <div class="grid">
      ${stat(enMessages.modules, safeData.summary.moduleCount)}
      ${stat(enMessages.evidence, safeData.summary.evidenceCount)}
      ${stat(enMessages.candidates, safeData.summary.candidateCount)}
      ${stat(enMessages.warnings, safeData.summary.warningCount)}
    </div>
  </header>
  <main>
    <section class="toolbar" aria-label="${escapeAttr(enMessages.reviewFilters)}">
      <input id="view-search" type="search" placeholder="${escapeAttr(enMessages.searchPlaceholder)}">
      <label><input id="filter-stale" type="checkbox"> ${escapeHtml(enMessages.stale)}</label>
      <label><input id="filter-candidates" type="checkbox"> ${escapeHtml(enMessages.hasCandidates)}</label>
      <label><input id="filter-high-risk" type="checkbox"> ${escapeHtml(enMessages.highRisk)}</label>
      <label><input id="filter-generated" type="checkbox"> ${escapeHtml(enMessages.generatedEvidenceFilter)}</label>
    </section>
    <section>
      <h2>${escapeHtml(enMessages.overview)}</h2>
      ${renderOverview(safeData, enMessages)}
    </section>
    <section>
      <h2>${escapeHtml(enMessages.warnings)}</h2>
      ${safeData.warnings.length > 0 ? `<div class="panel warning"><ul>${safeData.warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : `<p class="meta">${escapeHtml(enMessages.noWarnings)}</p>`}
    </section>
    <section>
      <h2>${escapeHtml(enMessages.modules)}</h2>
      <div class="modules">${safeData.modules.map((module) => renderModule(module, enMessages)).join("")}</div>
    </section>
    <section>
      <h2>${escapeHtml(enMessages.canonicalRelations)}</h2>
      ${renderCanonicalRelations(safeData, enMessages)}
    </section>
    <section>
      <h2>${escapeHtml(enMessages.verification)}</h2>
      ${renderVerification(safeData, enMessages)}
    </section>
    ${safeData.included.freshness ? `<section><h2>${escapeHtml(enMessages.freshness)}</h2>${renderFreshness(safeData, enMessages)}</section>` : ""}
    ${safeData.included.generated ? `<section><h2>${escapeHtml(enMessages.generatedEvidence)}</h2>${renderEvidence(safeData, enMessages)}</section>` : ""}
    ${safeData.included.inbox ? `<section><h2>${escapeHtml(enMessages.reviewCandidates)}</h2>${renderCandidates(safeData, enMessages)}</section><section><h2>${escapeHtml(enMessages.relationCandidates)}</h2>${renderRelationCandidates(safeData, enMessages)}</section>` : ""}
    <dialog id="module-dialog"><button type="button" data-close-dialog>${escapeHtml(enMessages.close)}</button><h2 id="module-dialog-title">${escapeHtml(enMessages.module)}</h2><pre id="module-dialog-body"></pre></dialog>
    <script type="application/json" id="cmap-view-data">${json}</script>
    <script>${renderClientScript()}</script>
  </main>
</body>
</html>
`;
}

function renderOverview(data: CmapViewData, messages: ViewMessages): string {
  const rows = [
    [messages.purpose, data.overview.purpose],
    [messages.activeGoal, data.overview.activeGoal],
    [messages.currentTask, data.overview.currentTask],
    [messages.nextStep, data.overview.nextStep],
    [messages.verified, data.overview.verified],
    [messages.lastVerified, data.overview.lastVerified]
  ];
  return `<table><tbody>${rows.map(([label, value]) => `<tr><th>${escapeHtml(label ?? "")}</th><td>${escapeHtml(value || messages.notAvailable)}</td></tr>`).join("")}</tbody></table>`;
}

function stat(label: string, value: number): string {
  return `<div class="stat"><strong>${value}</strong><span>${escapeHtml(label)}</span></div>`;
}

function renderModule(module: CmapViewData["modules"][number], messages: ViewMessages): string {
  const relationText = module.relations.length > 0
    ? module.relations.map((relation) => `${relation.type}: ${relation.target}`).join(", ")
    : messages.notAvailable;
  const relationExplanations = module.relations
    .filter((relation) => relation.why || relation.produces || relation.impact)
    .map((relation) => renderRelationExplanation(`${module.id} -> ${relation.target}`, relation, messages))
    .join("");
  const searchable = [module.id, module.name, module.description ?? "", module.aliases.join(" "), module.paths.join(" "), relationText].join(" ");
  const hasCandidate = module.freshness.pendingInboxCandidates.length > 0;
  const isStale = module.freshness.state !== "Not available" && module.freshness.state !== "reviewed";
  const hasGenerated = module.freshness.newestGeneratedEvidenceAt !== "Not available";
  return `<article class="module" data-search="${escapeAttr(searchable)}" data-stale="${isStale ? "true" : "false"}" data-has-candidate="${hasCandidate ? "true" : "false"}" data-high-risk="false" data-generated="${hasGenerated ? "true" : "false"}" data-module-id="${escapeAttr(module.id)}">
    <h3>${escapeHtml(module.name)}</h3>
    <p class="meta"><code>${escapeHtml(module.id)}</code> · ${escapeHtml(module.status)} · ${escapeHtml(module.docPath)}</p>
    <p>${module.aliases.map((alias) => `<span class="pill">${escapeHtml(alias)}</span>`).join("")}</p>
    ${module.description ? `<p><strong>${escapeHtml(messages.purpose)}:</strong> ${escapeHtml(module.description)}</p>` : ""}
    <p><strong>${escapeHtml(messages.paths)}:</strong> ${escapeHtml(module.paths.join(", ") || messages.notAvailable)}</p>
    <p><strong>${escapeHtml(messages.relations)}:</strong> ${escapeHtml(relationText)}</p>
    ${relationExplanations ? `<div>${relationExplanations}</div>` : ""}
    <p><strong>${escapeHtml(messages.freshnessLabel)}:</strong> ${escapeHtml(module.freshness.state)} · ${escapeHtml(module.freshness.lastReviewedAt)}</p>
    ${renderCommandButtons(module.suggestedCommands)}
    <button type="button" data-open-module="${escapeAttr(module.id)}">${escapeHtml(messages.details)}</button>
  </article>`;
}

function renderCanonicalRelations(data: CmapViewData, messages: ViewMessages): string {
  const rows = data.modules.flatMap((module) =>
    module.relations.map((relation) => ({
      from: module.id,
      type: relation.type,
      target: relation.target,
      why: relation.why,
      produces: relation.produces,
      impact: relation.impact
    }))
  );
  if (rows.length === 0) {
    return `<p class="meta">${escapeHtml(messages.notAvailable)}.</p>`;
  }
  return `<table><thead><tr><th>${escapeHtml(messages.from)}</th><th>${escapeHtml(messages.relation)}</th><th>${escapeHtml(messages.to)}</th><th>${escapeHtml(messages.relationExplanation)}</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.from)}</td><td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.target)}</td><td>${renderRelationExplanation(`${row.from} -> ${row.target}`, row, messages)}</td></tr>`).join("")}</tbody></table>`;
}

function renderVerification(data: CmapViewData, messages: ViewMessages): string {
  const commands = data.verify.requiredCommands.length > 0
    ? `<table><thead><tr><th>${escapeHtml(messages.purpose)}</th><th>${escapeHtml(messages.command)}</th><th>${escapeHtml(messages.expected)}</th><th>${escapeHtml(messages.when)}</th></tr></thead><tbody>${data.verify.requiredCommands.map((entry) => `<tr><td>${escapeHtml(entry.purpose)}</td><td><code>${escapeHtml(entry.command)}</code></td><td>${escapeHtml(entry.expected ?? messages.notAvailable)}</td><td>${escapeHtml(entry.when ?? messages.notAvailable)}</td></tr>`).join("")}</tbody></table>`
    : `<p class="meta">${escapeHtml(messages.requiredCommandsUnavailable)}</p>`;
  const checks = data.verify.manualChecks.length > 0
    ? `<ul>${data.verify.manualChecks.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : `<p class="meta">${escapeHtml(messages.manualChecksUnavailable)}</p>`;
  return `${commands}<h3>${escapeHtml(messages.manualChecks)}</h3>${checks}`;
}

function renderFreshness(data: CmapViewData, messages: ViewMessages): string {
  if (data.modules.length === 0) {
    return `<p class="meta">${escapeHtml(messages.notAvailable)}.</p>`;
  }
  return `<table><thead><tr><th>${escapeHtml(messages.moduleColumn)}</th><th>${escapeHtml(messages.state)}</th><th>${escapeHtml(messages.lastReview)}</th><th>${escapeHtml(messages.generatedEvidence)}</th><th>${escapeHtml(messages.pendingCandidatesColumn)}</th></tr></thead><tbody>${data.modules.map((module) => `<tr><td>${escapeHtml(module.id)}</td><td>${escapeHtml(freshnessLabel(module.freshness.state, module.freshness.pendingInboxCandidates.length, messages))}</td><td>${escapeHtml(module.freshness.lastReviewedAt)}</td><td>${escapeHtml(module.freshness.newestGeneratedEvidenceAt)}</td><td>${escapeHtml(module.freshness.pendingInboxCandidates.join(", ") || messages.none)}</td></tr>`).join("")}</tbody></table>`;
}

function freshnessLabel(state: string, pendingCount: number, messages: ViewMessages): string {
  if (pendingCount > 0) {
    return messages.pendingCandidates;
  }
  if (state === "baseline") {
    return messages.baselineOnly;
  }
  if (state === "reviewed") {
    return messages.reviewedState;
  }
  return state || messages.notAvailable;
}

function renderEvidence(data: CmapViewData, messages: ViewMessages): string {
  if (data.evidence.length === 0) {
    return `<p class="meta">${escapeHtml(messages.notAvailable)}.</p>`;
  }
  return `<table><thead><tr><th>${escapeHtml(messages.moduleColumn)}</th><th>${escapeHtml(messages.created)}</th><th>${escapeHtml(messages.summary)}</th><th>${escapeHtml(messages.files)}</th></tr></thead><tbody>${data.evidence.map((entry) => `<tr data-search="${escapeAttr([entry.moduleId, entry.summary, entry.files.join(" ")].join(" "))}" data-generated="true"><td>${escapeHtml(entry.moduleId)}</td><td>${escapeHtml(entry.createdAt)}</td><td>${escapeHtml(entry.summary)}</td><td>${escapeHtml(entry.files.join(", "))}</td></tr>`).join("")}</tbody></table>`;
}

function renderCandidates(data: CmapViewData, messages: ViewMessages): string {
  if (data.candidates.length === 0) {
    return `<p class="meta">${escapeHtml(messages.notAvailable)}.</p>`;
  }
  return `<table><thead><tr><th>${escapeHtml(messages.id)}</th><th>${escapeHtml(messages.type)}</th><th>${escapeHtml(messages.risk)}</th><th>${escapeHtml(messages.moduleColumn)}</th><th>${escapeHtml(messages.summary)}</th><th>${escapeHtml(messages.command)}</th></tr></thead><tbody>${data.candidates.map((candidate) => `<tr data-search="${escapeAttr([candidate.id, candidate.type, candidate.risk, candidate.moduleId, candidate.summary].join(" "))}" data-has-candidate="true" data-high-risk="${candidate.risk === "high" ? "true" : "false"}"><td>${escapeHtml(candidate.id)}</td><td>${escapeHtml(candidate.type)}</td><td>${escapeHtml(candidate.risk)}</td><td>${escapeHtml(candidate.moduleId)}</td><td>${escapeHtml(candidate.summary)}</td><td>${renderCommandButtons(candidate.suggestedCommands)}</td></tr>`).join("")}</tbody></table>`;
}

function renderRelationCandidates(data: CmapViewData, messages: ViewMessages): string {
  if (data.relationCandidates.length === 0) {
    return `<p class="meta">${escapeHtml(messages.notAvailable)}.</p>`;
  }
  return `<table><thead><tr><th>${escapeHtml(messages.id)}</th><th>${escapeHtml(messages.relation)}</th><th>${escapeHtml(messages.from)}</th><th>${escapeHtml(messages.to)}</th><th>${escapeHtml(messages.summary)}</th><th>${escapeHtml(messages.command)}</th></tr></thead><tbody>${data.relationCandidates.map((candidate) => `<tr data-search="${escapeAttr([candidate.id, candidate.relation, candidate.from, candidate.to, candidate.summary].join(" "))}" data-has-candidate="true" data-high-risk="false"><td>${escapeHtml(candidate.id)}<br><span class="pill">${escapeHtml(messages.candidateNonCanonical)}</span></td><td>${escapeHtml(candidate.relation)}</td><td>${escapeHtml(candidate.from)}</td><td>${escapeHtml(candidate.to)}</td><td>${escapeHtml(candidate.summary)}</td><td>${renderCommandButtons(candidate.suggestedCommands)}</td></tr>`).join("")}</tbody></table>`;
}

function renderRelationExplanation(
  title: string,
  relation: { why?: string; produces?: string; impact?: string },
  messages: ViewMessages
): string {
  if (!relation.why && !relation.produces && !relation.impact) {
    return `<span class="meta">${escapeHtml(messages.noRelationExplanation)}</span>`;
  }
  return `<div class="panel">
    <strong>${escapeHtml(title)}</strong>
    <p><strong>${escapeHtml(messages.relationWhy)}:</strong> ${escapeHtml(relation.why ?? messages.noRelationExplanation)}</p>
    <p><strong>${escapeHtml(messages.relationProduces)}:</strong> ${escapeHtml(relation.produces ?? messages.noRelationExplanation)}</p>
    <p><strong>${escapeHtml(messages.relationImpact)}:</strong> ${escapeHtml(relation.impact ?? messages.noRelationExplanation)}</p>
  </div>`;
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
    // Common credential field names (key=val or key: val); covers cloud SDK env-var idioms.
    .replace(
      /\b(api[_-]?key|token|secret|password|authorization|client[_-]?secret|access[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key|x[_-]api[_-]key)(\s*[:=]\s*)(["']?)[^\s"'`<>&]+/gi,
      "$1$2[REDACTED]"
    )
    // HTTP Bearer header
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/g, "Bearer [REDACTED]")
    // PEM private key blocks (covers RSA, OPENSSH, EC, DSA, ENCRYPTED variants)
    .replace(/-----BEGIN[^-\n]+PRIVATE KEY-----[\s\S]*?-----END[^-\n]+PRIVATE KEY-----/g, "[REDACTED PRIVATE KEY]");
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
