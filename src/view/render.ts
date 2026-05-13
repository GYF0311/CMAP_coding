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
    .modules { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
    .pill { display: inline-block; border: 1px solid var(--line); border-radius: 999px; padding: 2px 8px; margin: 2px 4px 2px 0; color: var(--muted); font-size: 12px; }
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
    <section>
      <h2>Warnings</h2>
      ${safeData.warnings.length > 0 ? `<div class="panel warning"><ul>${safeData.warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : `<p class="meta">No warnings.</p>`}
    </section>
    <section>
      <h2>Modules</h2>
      <div class="modules">${safeData.modules.map(renderModule).join("")}</div>
    </section>
    <section>
      <h2>Generated Evidence</h2>
      ${renderEvidence(safeData)}
    </section>
    <section>
      <h2>Review Candidates</h2>
      ${renderCandidates(safeData)}
    </section>
    <section>
      <h2>Relation Candidates</h2>
      ${renderRelationCandidates(safeData)}
    </section>
    <script type="application/json" id="cmap-view-data">${json}</script>
  </main>
</body>
</html>
`;
}

function stat(label: string, value: number): string {
  return `<div class="stat"><strong>${value}</strong><span>${escapeHtml(label)}</span></div>`;
}

function renderModule(module: CmapViewData["modules"][number]): string {
  const relationText = module.relations.length > 0
    ? module.relations.map((relation) => `${relation.type}: ${relation.target}`).join(", ")
    : "Not available";
  return `<article class="module">
    <h3>${escapeHtml(module.name)}</h3>
    <p class="meta"><code>${escapeHtml(module.id)}</code> · ${escapeHtml(module.status)} · ${escapeHtml(module.docPath)}</p>
    <p>${module.aliases.map((alias) => `<span class="pill">${escapeHtml(alias)}</span>`).join("")}</p>
    <p><strong>Paths:</strong> ${escapeHtml(module.paths.join(", ") || "Not available")}</p>
    <p><strong>Relations:</strong> ${escapeHtml(relationText)}</p>
    <p><strong>Freshness:</strong> ${escapeHtml(module.freshness.state)} · ${escapeHtml(module.freshness.lastReviewedAt)}</p>
  </article>`;
}

function renderEvidence(data: CmapViewData): string {
  if (data.evidence.length === 0) {
    return `<p class="meta">Not available.</p>`;
  }
  return `<table><thead><tr><th>Module</th><th>Created</th><th>Summary</th><th>Files</th></tr></thead><tbody>${data.evidence.map((entry) => `<tr><td>${escapeHtml(entry.moduleId)}</td><td>${escapeHtml(entry.createdAt)}</td><td>${escapeHtml(entry.summary)}</td><td>${escapeHtml(entry.files.join(", "))}</td></tr>`).join("")}</tbody></table>`;
}

function renderCandidates(data: CmapViewData): string {
  if (data.candidates.length === 0) {
    return `<p class="meta">Not available.</p>`;
  }
  return `<table><thead><tr><th>ID</th><th>Type</th><th>Risk</th><th>Module</th><th>Summary</th></tr></thead><tbody>${data.candidates.map((candidate) => `<tr><td>${escapeHtml(candidate.id)}</td><td>${escapeHtml(candidate.type)}</td><td>${escapeHtml(candidate.risk)}</td><td>${escapeHtml(candidate.moduleId)}</td><td>${escapeHtml(candidate.summary)}</td></tr>`).join("")}</tbody></table>`;
}

function renderRelationCandidates(data: CmapViewData): string {
  if (data.relationCandidates.length === 0) {
    return `<p class="meta">Not available.</p>`;
  }
  return `<table><thead><tr><th>ID</th><th>Relation</th><th>From</th><th>To</th><th>Summary</th></tr></thead><tbody>${data.relationCandidates.map((candidate) => `<tr><td>${escapeHtml(candidate.id)}<br><span class="pill">Candidate / Non-canonical</span></td><td>${escapeHtml(candidate.relation)}</td><td>${escapeHtml(candidate.from)}</td><td>${escapeHtml(candidate.to)}</td><td>${escapeHtml(candidate.summary)}</td></tr>`).join("")}</tbody></table>`;
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

function escapeScriptJson(value: string): string {
  return value.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
