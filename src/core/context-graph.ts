import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadModuleIndex, type ContextModule } from "./module-index.js";
import { projectRelative } from "../fs/safe-path.js";

export type ContextGraphEdge = {
  from: string;
  to: string;
  type: string;
  source: "module_relations";
  confidence: number;
  evidence: string[];
};

export type ContextGraph = {
  modules: Record<string, { doc: string; paths: string[]; aliases: string[] }>;
  files: Record<string, { modules: string[] }>;
  edges: ContextGraphEdge[];
  meta: {
    generated_at: string;
    module_count: number;
    file_count: number;
    edge_count: number;
    source: string;
  };
};

export async function buildContextGraph(cwd: string): Promise<ContextGraph> {
  return graphFromModules(await loadModuleIndex(cwd));
}

export async function writeContextGraph(cwd: string): Promise<string[]> {
  const graph = await buildContextGraph(cwd);
  const graphRoot = path.join(cwd, ".context", "graph");
  await mkdir(graphRoot, { recursive: true });
  const targets = [
    ["modules.json", graph.modules],
    ["files.json", graph.files],
    ["edges.json", graph.edges],
    ["graph.meta.json", graph.meta]
  ] as const;
  for (const [filename, value] of targets) {
    await writeFile(path.join(graphRoot, filename), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }
  return targets.map(([filename]) => projectRelative(cwd, path.join(graphRoot, filename)));
}

export async function explainGraphModule(cwd: string, moduleId: string): Promise<string> {
  const modules = await loadModuleIndex(cwd);
  const graph = graphFromModules(modules);
  const module = modules.find((candidate) => candidate.id === moduleId);
  if (!module) {
    return [`# Graph Explain: ${moduleId}`, "", "Module not found.", ""].join("\n");
  }
  const outgoing = graph.edges.filter((edge) => edge.from === module.id);
  const incoming = graph.edges.filter((edge) => edge.to === module.id);
  const lines = [
    `# Graph Explain: ${module.id}`,
    "",
    `Doc: ${module.docPath}`,
    "",
    "## Files",
    "",
    ...renderList(module.pathsInclude),
    "",
    "## Outgoing Relations",
    "",
    ...renderEdges(outgoing, "outgoing"),
    "",
    "## Incoming Relations",
    "",
    ...renderEdges(incoming, "incoming"),
    ""
  ];
  return lines.join("\n");
}

function graphFromModules(modules: ContextModule[]): ContextGraph {
  const moduleRecords: ContextGraph["modules"] = {};
  const files: ContextGraph["files"] = {};
  const edges: ContextGraphEdge[] = [];

  for (const module of modules) {
    moduleRecords[module.id] = {
      doc: module.docPath,
      paths: module.pathsInclude,
      aliases: module.aliases
    };
    for (const file of module.pathsInclude) {
      files[file] = files[file] ?? { modules: [] };
      files[file].modules.push(module.id);
      files[file].modules.sort();
    }
    for (const [type, targets] of Object.entries(module.relations)) {
      for (const target of targets) {
        edges.push({
          from: module.id,
          to: target,
          type,
          source: "module_relations",
          confidence: 1,
          evidence: [`${module.docPath} relations.${type} includes ${target}`]
        });
      }
    }
  }

  edges.sort((left, right) => `${left.from}:${left.type}:${left.to}`.localeCompare(`${right.from}:${right.type}:${right.to}`));
  return {
    modules: moduleRecords,
    files,
    edges,
    meta: {
      generated_at: new Date().toISOString(),
      module_count: modules.length,
      file_count: Object.keys(files).length,
      edge_count: edges.length,
      source: "module_frontmatter"
    }
  };
}

function renderList(items: string[]): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : ["- None"];
}

function renderEdges(edges: ContextGraphEdge[], direction: "incoming" | "outgoing"): string[] {
  if (edges.length === 0) {
    return ["- None"];
  }
  return edges.map((edge) => {
    if (direction === "incoming") {
      return `- ${edge.from} -> ${edge.type}`;
    }
    return `- ${edge.type} -> ${edge.to}`;
  });
}
