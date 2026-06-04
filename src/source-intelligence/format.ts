import type {
  SourceFreshnessSummary,
  SourceImpactReport,
  SourceImpactRiskFactor,
  SourceImpactRelatedModule,
  SourceSymbolRef
} from "./impact.js";

export function renderSourceImpactMarkdown(report: SourceImpactReport): string {
  return [
    "# Source Impact Report",
    "",
    "Generated source evidence. Non-canonical: do not treat this as reviewed `.context` truth.",
    "",
    `Query: \`${report.query.normalizedPath}\``,
    `Matched index file: ${report.query.matched ? "yes" : "no"}`,
    `Confidence: ${report.confidence}`,
    `Truncated: ${report.truncated ? "yes" : "no"}`,
    "",
    renderFreshnessSummaryMarkdown(report.freshness).trimEnd(),
    "",
    "## Changed Files",
    renderList(report.changedFiles),
    "",
    "## Changed Symbols",
    renderSymbolList(report.changedSymbols),
    "",
    "## Impacted Symbols",
    renderSymbolList(report.impactedSymbols),
    "",
    "## Impacted Files",
    renderList(report.impactedFiles),
    "",
    "## Likely Tests",
    renderList(report.likelyTests),
    "",
    "## Related CMAP Modules",
    renderRelatedModules(report.relatedModules),
    "",
    "## Risk Factors",
    renderRiskFactors(report.riskFactors),
    "",
    "## Omitted",
    renderList([
      `symbols: ${report.omitted.symbols}`,
      `files: ${report.omitted.files}`,
      `tests: ${report.omitted.tests}`,
      `edges: ${report.omitted.edges}`
    ]),
    "",
    "## Next Commands",
    renderList(report.nextCommands.map((command) => `\`${command}\``)),
    ""
  ].join("\n");
}

export function renderFreshnessSummaryMarkdown(summary: SourceFreshnessSummary): string {
  return [
    "## Freshness",
    `Status: ${summary.status}`,
    `Indexed at: ${summary.indexedAt ?? "Not available"}`,
    `Git head: ${summary.gitHead ?? "Not available"}`,
    "",
    renderList([
      `fresh: ${summary.counts.fresh}`,
      `stale: ${summary.counts.stale}`,
      `missing: ${summary.counts.missing}`,
      `error: ${summary.counts.error}`
    ]),
    "",
    "Stale files:",
    renderList(summary.staleFiles),
    "",
    "Missing files:",
    renderList(summary.missingFiles),
    "",
    "Errors:",
    renderList(summary.errorFiles.map((item) => item.error ? `${item.path}: ${item.error}` : item.path)),
    "",
    "Notes:",
    renderList(summary.explanations)
  ].join("\n");
}

function renderSymbolList(symbols: SourceSymbolRef[]): string {
  if (symbols.length === 0) {
    return "- None";
  }
  return symbols.map((symbol) => {
    const location = `${symbol.filePath}:${symbol.lineStart}`;
    const confidence = symbol.confidence === undefined ? "" : ` confidence=${symbol.confidence}`;
    const reason = symbol.reason ? ` - ${symbol.reason}` : "";
    return `- ${symbol.kind} \`${symbol.qualifiedName || symbol.name}\` (${location})${confidence}${reason}`;
  }).join("\n");
}

function renderRelatedModules(modules: SourceImpactRelatedModule[]): string {
  if (modules.length === 0) {
    return "- None";
  }
  return modules.map((module) =>
    `- ${module.module} (${module.confidence}) - ${module.reason}`
  ).join("\n");
}

function renderRiskFactors(risks: SourceImpactRiskFactor[]): string {
  if (risks.length === 0) {
    return "- None";
  }
  return risks.map((risk) => {
    const evidence = risk.evidence.length > 0 ? ` Evidence: ${risk.evidence.join(", ")}` : "";
    return `- ${risk.kind}: ${risk.reason}${evidence}`;
  }).join("\n");
}

function renderList(items: string[]): string {
  if (items.length === 0) {
    return "- None";
  }
  return items.map((item) => `- ${item}`).join("\n");
}
