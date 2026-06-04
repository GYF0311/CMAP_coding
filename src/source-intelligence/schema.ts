export const SOURCE_INDEX_SCHEMA_VERSION = 1 as const;
export const SOURCE_INDEX_GENERATED_BY = "cmap-source-intelligence-p0" as const;

export const SOURCE_FILE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"] as const;

export type SourceFileExtension = typeof SOURCE_FILE_EXTENSIONS[number];
export type SourceLanguage = "typescript" | "javascript" | "unknown";
export type SourceSymbolKind = "File" | "Function" | "Class" | "Method" | "Type" | "Variable" | "Test";
export type SourceEdgeKind = "CONTAINS" | "IMPORTS_FROM" | "EXPORTS" | "CALLS" | "REFERENCES" | "TESTED_BY";
export type SourceConfidenceTier =
  | "parsed"
  | "resolved-local"
  | "resolved-import"
  | "typechecker"
  | "heuristic"
  | "unresolved";

export type SourceEdgeDetailValue = string | number | boolean | string[] | undefined;

export type SourceLocation = {
  filePath: string;
  line: number;
  column: number;
  lineEnd?: number;
  columnEnd?: number;
};

export type SourceFileRecord = {
  path: string;
  language: SourceLanguage;
  extension: SourceFileExtension;
  hash: string;
  size: number;
  modifiedAt: string;
  indexedAt: string;
  gitHead?: string;
  parseErrors: string[];
  isTestFile: boolean;
  canonical: false;
};

export type SourceSymbol = {
  id: string;
  kind: SourceSymbolKind;
  name: string;
  qualifiedName: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  exported: boolean;
  parentId?: string;
  signature?: string;
  canonical: false;
};

export type SourceEdge = {
  id: string;
  kind: SourceEdgeKind;
  sourceId: string;
  targetId?: string;
  unresolvedTarget?: string;
  filePath: string;
  line: number;
  location: SourceLocation;
  confidenceTier: SourceConfidenceTier;
  confidence: number;
  provenance: string;
  details?: Record<string, SourceEdgeDetailValue>;
  canonical: false;
};

export type SourceUnresolvedRef = {
  id: string;
  kind: SourceEdgeKind;
  sourceId: string;
  filePath: string;
  location: SourceLocation;
  target: string;
  reason: "external-module" | "missing-local-file" | "ambiguous-symbol" | "missing-symbol" | "unsupported-syntax";
  provenance: string;
  confidenceTier: "unresolved";
  confidence: number;
  canonical: false;
};

export type SourceIndexMeta = {
  version: typeof SOURCE_INDEX_SCHEMA_VERSION;
  generatedBy: typeof SOURCE_INDEX_GENERATED_BY;
  generatedAt: string;
  canonical: false;
  projectRoot: string;
  gitHead?: string;
  fileCount: number;
  symbolCount: number;
  edgeCount: number;
  unresolvedRefCount: number;
  parseErrorCount: number;
  durationMs: number;
  discovery: {
    includedExtensions: SourceFileExtension[];
    ignoredDirectories: string[];
    ignoreFiles?: string[];
    discoveredFiles: number;
  };
};

export type SourceIndex = {
  meta: SourceIndexMeta;
  files: SourceFileRecord[];
  symbols: SourceSymbol[];
  edges: SourceEdge[];
  unresolvedRefs: SourceUnresolvedRef[];
};

export type SourceIndexBuildOptions = {
  indexedAt?: string;
  gitHead?: string;
  discovery?: {
    extensions?: SourceFileExtension[];
    ignoredDirectories?: string[];
    respectGitignore?: boolean;
  };
};

export function languageForExtension(extension: string): SourceLanguage {
  if (extension === ".ts" || extension === ".tsx") {
    return "typescript";
  }
  if (extension === ".js" || extension === ".jsx" || extension === ".mjs" || extension === ".cjs") {
    return "javascript";
  }
  return "unknown";
}

export function isSourceFileExtension(extension: string): extension is SourceFileExtension {
  return SOURCE_FILE_EXTENSIONS.includes(extension as SourceFileExtension);
}
