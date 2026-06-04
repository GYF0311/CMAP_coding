import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import path from "node:path";
import * as ts from "typescript";
import { discoverSourceFiles, snapshotSourceFile, type SourceDiscoveryOptions } from "./discovery.js";
import { resolveSourceIndex } from "./resolver.js";
import {
  SOURCE_INDEX_GENERATED_BY,
  SOURCE_INDEX_SCHEMA_VERSION,
  SOURCE_FILE_EXTENSIONS,
  type SourceEdge,
  type SourceEdgeDetailValue,
  type SourceFileRecord,
  type SourceIndex,
  type SourceIndexBuildOptions,
  type SourceLocation,
  type SourceSymbol,
  type SourceSymbolKind
} from "./schema.js";

type ExtractionState = {
  file: SourceFileRecord;
  sourceFile: ts.SourceFile;
  fileSymbol: SourceSymbol;
  symbols: SourceSymbol[];
  edges: SourceEdge[];
};

type VisitContext = {
  currentSymbol: SourceSymbol;
  currentClass?: SourceSymbol;
};

const execFileAsync = promisify(execFile);

export async function buildSourceIndex(cwd: string, options: SourceIndexBuildOptions = {}): Promise<SourceIndex> {
  const started = Date.now();
  const root = path.resolve(cwd);
  const indexedAt = options.indexedAt ?? new Date().toISOString();
  const gitHead = options.gitHead ?? await currentGitHead(root);
  const discoveryOptions: SourceDiscoveryOptions = options.discovery ?? {};
  const discovery = await discoverSourceFiles(root, discoveryOptions);
  const files: SourceFileRecord[] = [];
  const symbols: SourceSymbol[] = [];
  const edges: SourceEdge[] = [];

  for (const relativePath of discovery.files) {
    const extracted = await indexSourceFile(root, relativePath, indexedAt, gitHead);
    files.push(extracted.file);
    symbols.push(...extracted.symbols);
    edges.push(...extracted.edges);
  }

  const unresolved = resolveSourceIndex({
    meta: {
      version: SOURCE_INDEX_SCHEMA_VERSION,
      generatedBy: SOURCE_INDEX_GENERATED_BY,
      generatedAt: indexedAt,
      canonical: false,
      projectRoot: root,
      gitHead,
      fileCount: files.length,
      symbolCount: symbols.length,
      edgeCount: edges.length,
      unresolvedRefCount: 0,
      parseErrorCount: files.reduce((total, file) => total + file.parseErrors.length, 0),
      durationMs: Date.now() - started,
      discovery: {
        includedExtensions: [...(discoveryOptions.extensions ?? SOURCE_FILE_EXTENSIONS)],
        ignoredDirectories: discovery.ignoredDirectories,
        ignoreFiles: discovery.ignoreFiles,
        discoveredFiles: discovery.discoveredFiles
      }
    },
    files,
    symbols,
    edges,
    unresolvedRefs: []
  });

  return {
    ...unresolved,
    meta: {
      ...unresolved.meta,
      fileCount: unresolved.files.length,
      symbolCount: unresolved.symbols.length,
      edgeCount: unresolved.edges.length,
      unresolvedRefCount: unresolved.unresolvedRefs.length,
      parseErrorCount: unresolved.files.reduce((total, file) => total + file.parseErrors.length, 0),
      durationMs: Date.now() - started
    }
  };
}

async function indexSourceFile(cwd: string, relativePath: string, indexedAt: string, gitHead?: string): Promise<ExtractionState> {
  const file = await snapshotSourceFile(cwd, relativePath, indexedAt, gitHead);
  const raw = await readFile(path.join(cwd, relativePath), "utf8");
  const sourceFile = ts.createSourceFile(relativePath, raw, ts.ScriptTarget.Latest, true, scriptKindFor(file.extension));
  file.parseErrors = parseDiagnostics(sourceFile);
  const fileSymbol = createSymbol("File", file.path, path.basename(file.path), file.path, locationForSourceFile(sourceFile), false);
  const state: ExtractionState = {
    file,
    sourceFile,
    fileSymbol,
    symbols: [fileSymbol],
    edges: []
  };

  visitChildren(state, sourceFile, { currentSymbol: fileSymbol });
  return state;
}

function visitChildren(state: ExtractionState, node: ts.Node, context: VisitContext): void {
  ts.forEachChild(node, (child) => visitNode(state, child, context));
}

function visitNode(state: ExtractionState, node: ts.Node, context: VisitContext): void {
  if (ts.isImportDeclaration(node)) {
    addImportEdge(state, node);
    return;
  }
  if (ts.isExportDeclaration(node)) {
    addExportDeclarationEdges(state, node, context);
    return;
  }
  if (ts.isExportAssignment(node)) {
    addExportAssignmentEdge(state, node, context);
    visitChildren(state, node, context);
    return;
  }
  if (ts.isFunctionDeclaration(node)) {
    const symbol = addFunctionSymbol(state, node, context);
    visitFunctionLikeBody(state, node, { currentSymbol: symbol, currentClass: context.currentClass });
    return;
  }
  if (ts.isClassDeclaration(node)) {
    const symbol = addClassSymbol(state, node, context);
    for (const member of node.members) {
      visitNode(state, member, { currentSymbol: symbol, currentClass: symbol });
    }
    return;
  }
  if (ts.isMethodDeclaration(node)) {
    const symbol = addMethodSymbol(state, node, context);
    visitFunctionLikeBody(state, node, { currentSymbol: symbol, currentClass: context.currentClass });
    return;
  }
  if (ts.isVariableStatement(node)) {
    if (isExported(node)) {
      addExportedVariableSymbols(state, node, context);
      return;
    }
    visitChildren(state, node, context);
    return;
  }
  if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)) {
    if (isExported(node)) {
      addTypeSymbol(state, node, context);
    }
    return;
  }
  if (ts.isCallExpression(node)) {
    addCallEdge(state, node, context);
    const testSymbol = maybeAddTestSymbol(state, node, context);
    if (testSymbol) {
      visitCallChildrenWithTestContext(state, node, { currentSymbol: testSymbol, currentClass: context.currentClass });
      return;
    }
    visitChildren(state, node, context);
    return;
  }

  visitChildren(state, node, context);
}

function addImportEdge(state: ExtractionState, node: ts.ImportDeclaration): void {
  const specifier = stringLiteralText(node.moduleSpecifier);
  if (!specifier) {
    return;
  }
  const bindings = importBindings(node);
  state.edges.push(createEdge({
    kind: "IMPORTS_FROM",
    sourceId: state.fileSymbol.id,
    unresolvedTarget: specifier,
    filePath: state.file.path,
    location: locationForNode(state.sourceFile, node),
    confidenceTier: "parsed",
    confidence: 0.72,
    provenance: "typescript.ImportDeclaration",
    details: {
      moduleSpecifier: specifier,
      localNames: bindings.localNames,
      importedNames: bindings.importedNames,
      importKinds: bindings.importKinds,
      typeOnly: Boolean(node.importClause?.isTypeOnly)
    }
  }));
}

function addExportDeclarationEdges(state: ExtractionState, node: ts.ExportDeclaration, context: VisitContext): void {
  const specifier = node.moduleSpecifier ? stringLiteralText(node.moduleSpecifier) : undefined;
  const location = locationForNode(state.sourceFile, node);
  if (specifier) {
    const names = exportNames(node);
    state.edges.push(createEdge({
      kind: "EXPORTS",
      sourceId: state.fileSymbol.id,
      unresolvedTarget: specifier,
      filePath: state.file.path,
      location,
      confidenceTier: "parsed",
      confidence: 0.7,
      provenance: "typescript.ExportDeclaration.reexport",
      details: {
        moduleSpecifier: specifier,
        exportedNames: names.exportedNames,
        localNames: names.localNames,
        reExport: true
      }
    }));
    return;
  }

  const names = exportNames(node);
  names.localNames.forEach((localName, index) => {
    state.edges.push(createEdge({
      kind: "EXPORTS",
      sourceId: context.currentSymbol.id,
      unresolvedTarget: localName,
      filePath: state.file.path,
      location,
      confidenceTier: "parsed",
      confidence: 0.76,
      provenance: "typescript.ExportDeclaration.named",
      details: {
        localName,
        exportedName: names.exportedNames[index] ?? localName
      }
    }));
  });
}

function addExportAssignmentEdge(state: ExtractionState, node: ts.ExportAssignment, context: VisitContext): void {
  const expressionText = node.expression.getText(state.sourceFile);
  const localName = ts.isIdentifier(node.expression) ? node.expression.text : undefined;
  state.edges.push(createEdge({
    kind: "EXPORTS",
    sourceId: context.currentSymbol.id,
    unresolvedTarget: localName ?? expressionText,
    filePath: state.file.path,
    location: locationForNode(state.sourceFile, node),
    confidenceTier: "parsed",
    confidence: localName ? 0.76 : 0.45,
    provenance: "typescript.ExportAssignment",
    details: {
      localName,
      exportedName: "default",
      expression: expressionText
    }
  }));
}

function addFunctionSymbol(state: ExtractionState, node: ts.FunctionDeclaration, context: VisitContext): SourceSymbol {
  const name = node.name?.text ?? (isDefaultExport(node) ? "default" : "anonymous");
  const symbol = createSymbol(
    "Function",
    state.file.path,
    name,
    qualifiedName(state.file.path, name, context.currentClass),
    locationForNode(state.sourceFile, node),
    isExported(node),
    context.currentClass?.id,
    signatureForNode(state.sourceFile, node)
  );
  addSymbolWithContainment(state, symbol, context.currentClass ?? state.fileSymbol);
  if (symbol.exported) {
    addExportEdgeForSymbol(state, symbol, node);
  }
  return symbol;
}

function addClassSymbol(state: ExtractionState, node: ts.ClassDeclaration, context: VisitContext): SourceSymbol {
  const name = node.name?.text ?? (isDefaultExport(node) ? "default" : "anonymous-class");
  const symbol = createSymbol(
    "Class",
    state.file.path,
    name,
    qualifiedName(state.file.path, name, context.currentClass),
    locationForNode(state.sourceFile, node),
    isExported(node),
    context.currentClass?.id,
    signatureForNode(state.sourceFile, node)
  );
  addSymbolWithContainment(state, symbol, context.currentClass ?? state.fileSymbol);
  if (symbol.exported) {
    addExportEdgeForSymbol(state, symbol, node);
  }
  return symbol;
}

function addMethodSymbol(state: ExtractionState, node: ts.MethodDeclaration, context: VisitContext): SourceSymbol {
  const name = propertyNameText(state.sourceFile, node.name) ?? "anonymous-method";
  const symbol = createSymbol(
    "Method",
    state.file.path,
    name,
    qualifiedName(state.file.path, name, context.currentClass),
    locationForNode(state.sourceFile, node),
    Boolean(context.currentClass?.exported),
    context.currentClass?.id,
    signatureForNode(state.sourceFile, node)
  );
  addSymbolWithContainment(state, symbol, context.currentClass ?? state.fileSymbol);
  if (symbol.exported) {
    addExportEdgeForSymbol(state, symbol, node);
  }
  return symbol;
}

function addExportedVariableSymbols(state: ExtractionState, node: ts.VariableStatement, context: VisitContext): void {
  const declarationKind = variableDeclarationKind(node.declarationList);
  for (const declaration of node.declarationList.declarations) {
    if (!ts.isIdentifier(declaration.name)) {
      visitChildren(state, declaration, context);
      continue;
    }
    const symbol = createSymbol(
      "Variable",
      state.file.path,
      declaration.name.text,
      qualifiedName(state.file.path, declaration.name.text, context.currentClass),
      locationForNode(state.sourceFile, declaration),
      true,
      context.currentClass?.id,
      `${declarationKind} ${declaration.name.text}`
    );
    addSymbolWithContainment(state, symbol, context.currentClass ?? state.fileSymbol);
    addExportEdgeForSymbol(state, symbol, declaration);
    if (declaration.initializer) {
      visitNode(state, declaration.initializer, { currentSymbol: symbol, currentClass: context.currentClass });
    }
  }
}

function addTypeSymbol(
  state: ExtractionState,
  node: ts.InterfaceDeclaration | ts.TypeAliasDeclaration | ts.EnumDeclaration,
  context: VisitContext
): SourceSymbol {
  const symbol = createSymbol(
    "Type",
    state.file.path,
    node.name.text,
    qualifiedName(state.file.path, node.name.text, context.currentClass),
    locationForNode(state.sourceFile, node),
    true,
    context.currentClass?.id,
    signatureForNode(state.sourceFile, node)
  );
  addSymbolWithContainment(state, symbol, context.currentClass ?? state.fileSymbol);
  addExportEdgeForSymbol(state, symbol, node);
  return symbol;
}

function addCallEdge(state: ExtractionState, node: ts.CallExpression, context: VisitContext): void {
  const target = callTarget(state.sourceFile, node);
  state.edges.push(createEdge({
    kind: "CALLS",
    sourceId: context.currentSymbol.id,
    unresolvedTarget: target.targetText,
    filePath: state.file.path,
    location: locationForNode(state.sourceFile, node),
    confidenceTier: "heuristic",
    confidence: target.targetName ? 0.48 : 0.28,
    provenance: "typescript.CallExpression",
    details: {
      targetName: target.targetName,
      targetText: target.targetText
    }
  }));
}

function maybeAddTestSymbol(state: ExtractionState, node: ts.CallExpression, context: VisitContext): SourceSymbol | undefined {
  const target = callTarget(state.sourceFile, node);
  if (!target.targetName || !["describe", "it", "test", "suite"].includes(target.targetName)) {
    return undefined;
  }
  const firstArg = node.arguments[0];
  const label = firstArg && isStringLike(firstArg) ? firstArg.text : target.targetName;
  const symbol = createSymbol(
    "Test",
    state.file.path,
    `${target.targetName}: ${label}`,
    qualifiedName(state.file.path, `${target.targetName}: ${label}`, context.currentClass),
    locationForNode(state.sourceFile, node),
    false,
    context.currentSymbol.id,
    `${target.targetName}(${JSON.stringify(label)})`
  );
  addSymbolWithContainment(state, symbol, context.currentSymbol);
  return symbol;
}

function visitCallChildrenWithTestContext(state: ExtractionState, node: ts.CallExpression, context: VisitContext): void {
  for (const argument of node.arguments) {
    if (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)) {
      visitFunctionLikeBody(state, argument, context);
    } else {
      visitNode(state, argument, context);
    }
  }
}

function visitFunctionLikeBody(
  state: ExtractionState,
  node: ts.FunctionDeclaration | ts.MethodDeclaration | ts.ArrowFunction | ts.FunctionExpression,
  context: VisitContext
): void {
  if (node.body) {
    visitNode(state, node.body, context);
  }
}

function addSymbolWithContainment(state: ExtractionState, symbol: SourceSymbol, parent: SourceSymbol): void {
  state.symbols.push(symbol);
  state.edges.push(createEdge({
    kind: "CONTAINS",
    sourceId: parent.id,
    targetId: symbol.id,
    filePath: state.file.path,
    location: {
      filePath: state.file.path,
      line: symbol.lineStart,
      column: 1,
      lineEnd: symbol.lineEnd
    },
    confidenceTier: "parsed",
    confidence: 1,
    provenance: "typescript.AST.containment"
  }));
}

function addExportEdgeForSymbol(state: ExtractionState, symbol: SourceSymbol, node: ts.Node): void {
  state.edges.push(createEdge({
    kind: "EXPORTS",
    sourceId: state.fileSymbol.id,
    targetId: symbol.id,
    filePath: state.file.path,
    location: locationForNode(state.sourceFile, node),
    confidenceTier: "parsed",
    confidence: 0.98,
    provenance: "typescript.AST.exported-symbol",
    details: {
      localName: symbol.name,
      exportedName: symbol.name
    }
  }));
}

function createSymbol(
  kind: SourceSymbolKind,
  filePath: string,
  name: string,
  qualifiedNameValue: string,
  location: SourceLocation,
  exported: boolean,
  parentId?: string,
  signature?: string
): SourceSymbol {
  return {
    id: kind === "File" ? `file:${filePath}` : `symbol:${hashId([kind, filePath, name, String(location.line), String(location.column), parentId ?? "root"])}`,
    kind,
    name,
    qualifiedName: qualifiedNameValue,
    filePath,
    lineStart: location.line,
    lineEnd: location.lineEnd ?? location.line,
    exported,
    parentId,
    signature: signature ? truncate(signature.replace(/\s+/g, " "), 180) : undefined,
    canonical: false
  };
}

function createEdge(input: {
  kind: SourceEdge["kind"];
  sourceId: string;
  targetId?: string;
  unresolvedTarget?: string;
  filePath: string;
  location: SourceLocation;
  confidenceTier: SourceEdge["confidenceTier"];
  confidence: number;
  provenance: string;
  details?: Record<string, SourceEdgeDetailValue>;
}): SourceEdge {
  const line = input.location.line;
  return {
    id: `edge:${hashId([
      input.kind,
      input.sourceId,
      input.targetId ?? input.unresolvedTarget ?? "",
      input.filePath,
      String(line),
      input.provenance
    ])}`,
    kind: input.kind,
    sourceId: input.sourceId,
    targetId: input.targetId,
    unresolvedTarget: input.unresolvedTarget,
    filePath: input.filePath,
    line,
    location: input.location,
    confidenceTier: input.confidenceTier,
    confidence: input.confidence,
    provenance: input.provenance,
    details: compactDetails(input.details),
    canonical: false
  };
}

function importBindings(node: ts.ImportDeclaration): { localNames: string[]; importedNames: string[]; importKinds: string[] } {
  const localNames: string[] = [];
  const importedNames: string[] = [];
  const importKinds: string[] = [];
  const clause = node.importClause;
  if (!clause) {
    return { localNames, importedNames, importKinds };
  }
  if (clause.name) {
    localNames.push(clause.name.text);
    importedNames.push("default");
    importKinds.push(clause.isTypeOnly ? "type-default" : "default");
  }
  if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
    localNames.push(clause.namedBindings.name.text);
    importedNames.push("*");
    importKinds.push(clause.isTypeOnly ? "type-namespace" : "namespace");
  }
  if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
    for (const element of clause.namedBindings.elements) {
      localNames.push(element.name.text);
      importedNames.push(element.propertyName?.text ?? element.name.text);
      importKinds.push(element.isTypeOnly || clause.isTypeOnly ? "type-named" : "named");
    }
  }
  return { localNames, importedNames, importKinds };
}

function exportNames(node: ts.ExportDeclaration): { localNames: string[]; exportedNames: string[] } {
  if (!node.exportClause) {
    return { localNames: ["*"], exportedNames: ["*"] };
  }
  if (!ts.isNamedExports(node.exportClause)) {
    return { localNames: [], exportedNames: [] };
  }
  const localNames: string[] = [];
  const exportedNames: string[] = [];
  for (const element of node.exportClause.elements) {
    localNames.push(element.propertyName?.text ?? element.name.text);
    exportedNames.push(element.name.text);
  }
  return { localNames, exportedNames };
}

function callTarget(sourceFile: ts.SourceFile, node: ts.CallExpression): { targetName?: string; targetText: string } {
  const expression = node.expression;
  if (ts.isIdentifier(expression)) {
    return { targetName: expression.text, targetText: expression.text };
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return { targetName: expression.name.text, targetText: expression.getText(sourceFile) };
  }
  if (ts.isElementAccessExpression(expression)) {
    const argument = expression.argumentExpression;
    const targetName = argument && isStringLike(argument) ? argument.text : undefined;
    return { targetName, targetText: expression.getText(sourceFile) };
  }
  if (expression.kind === ts.SyntaxKind.SuperKeyword) {
    return { targetName: "super", targetText: "super" };
  }
  return { targetText: expression.getText(sourceFile) };
}

function propertyNameText(sourceFile: ts.SourceFile, name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) || ts.isPrivateIdentifier(name)) {
    return name.text;
  }
  return name.getText(sourceFile);
}

function isExported(node: ts.Node): boolean {
  return hasModifier(node, ts.SyntaxKind.ExportKeyword) || hasModifier(node, ts.SyntaxKind.DefaultKeyword);
}

function isDefaultExport(node: ts.Node): boolean {
  return hasModifier(node, ts.SyntaxKind.DefaultKeyword);
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  if (!ts.canHaveModifiers(node)) {
    return false;
  }
  return Boolean(ts.getModifiers(node)?.some((modifier) => modifier.kind === kind));
}

function variableDeclarationKind(list: ts.VariableDeclarationList): "const" | "let" | "var" {
  if (list.flags & ts.NodeFlags.Const) {
    return "const";
  }
  if (list.flags & ts.NodeFlags.Let) {
    return "let";
  }
  return "var";
}

function locationForSourceFile(sourceFile: ts.SourceFile): SourceLocation {
  const end = ts.getLineAndCharacterOfPosition(sourceFile, sourceFile.end);
  return {
    filePath: sourceFile.fileName,
    line: 1,
    column: 1,
    lineEnd: end.line + 1,
    columnEnd: end.character + 1
  };
}

function locationForNode(sourceFile: ts.SourceFile, node: ts.Node): SourceLocation {
  const start = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
  const end = ts.getLineAndCharacterOfPosition(sourceFile, node.getEnd());
  return {
    filePath: sourceFile.fileName,
    line: start.line + 1,
    column: start.character + 1,
    lineEnd: end.line + 1,
    columnEnd: end.character + 1
  };
}

function parseDiagnostics(sourceFile: ts.SourceFile): string[] {
  const diagnostics = (sourceFile as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
  return diagnostics.map((diagnostic) => {
    const location = diagnostic.start === undefined
      ? "unknown"
      : (() => {
        const line = ts.getLineAndCharacterOfPosition(sourceFile, diagnostic.start);
        return `${line.line + 1}:${line.character + 1}`;
      })();
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
    return `${location} TS${diagnostic.code}: ${message}`;
  });
}

function scriptKindFor(extension: string): ts.ScriptKind {
  switch (extension) {
    case ".ts":
      return ts.ScriptKind.TS;
    case ".tsx":
      return ts.ScriptKind.TSX;
    case ".jsx":
      return ts.ScriptKind.JSX;
    case ".js":
    case ".mjs":
    case ".cjs":
      return ts.ScriptKind.JS;
    default:
      return ts.ScriptKind.Unknown;
  }
}

function stringLiteralText(node: ts.Expression): string | undefined {
  return isStringLike(node) ? node.text : undefined;
}

function isStringLike(node: ts.Node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

function signatureForNode(sourceFile: ts.SourceFile, node: ts.Node): string {
  const text = node.getText(sourceFile);
  const withoutBody = text.split(/\{\s*/)[0] ?? text;
  return withoutBody.trim();
}

function qualifiedName(filePath: string, name: string, parent?: SourceSymbol): string {
  if (parent && parent.kind !== "File") {
    return `${parent.qualifiedName}.${name}`;
  }
  return `${filePath}#${name}`;
}

function compactDetails(details?: Record<string, SourceEdgeDetailValue>): Record<string, SourceEdgeDetailValue> | undefined {
  if (!details) {
    return undefined;
  }
  const entries = Object.entries(details).filter(([, value]) =>
    value !== undefined && (!Array.isArray(value) || value.length > 0)
  );
  return entries.length > 0 ? Object.fromEntries(entries) as Record<string, SourceEdgeDetailValue> : undefined;
}

function hashId(parts: string[]): string {
  return createHash("sha1").update(parts.join("\0")).digest("hex").slice(0, 16);
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

async function currentGitHead(cwd: string): Promise<string | undefined> {
  try {
    const result = await execFileAsync("git", ["rev-parse", "--verify", "HEAD"], { cwd });
    return result.stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}
