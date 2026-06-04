# GitNexus

Repository: `nxpatterns/gitnexus`
Local checkout: `/Users/gaoyifan/Desktop/CMAP_coding/research/coding-knowledge-graphs-2026-06/repos/gitnexus`
Commit: `50715e3`
Agents: Architecture Agent + Product Boundary Agent

## Verdict

GitNexus is a strong peer-like complement in the code graph and MCP tooling layer. It is not a CMAP superset.

It has a broad source-derived code graph, multi-repo registry, MCP tools, impact analysis, and Web UI. CMAP's differentiator remains trust governance: reviewed `.context`, generated evidence separation, candidate inbox, route not consuming unpromoted candidates, and read-only human review layers.

Classification: **Strong complement / peer on source graph tooling; not a superset.**

## What It Is

GitNexus is a monorepo centered on a Node CLI/MCP/HTTP backend with a React graph/chat UI.

Main parts:

- `gitnexus/`: CLI, ingestion pipeline, MCP server, HTTP API, LadybugDB storage.
- `gitnexus-web/`: React/Vite UI, graph visualization, LLM/chat UI, backend HTTP client.
- `gitnexus-shared/`: shared graph, language, and schema types.
- `gitnexus-claude-plugin/` and `gitnexus-cursor-integration/`: skills, hooks, editor packaging.
- `eval/`: benchmark and evaluation harness.

Typical workflow:

1. `npx gitnexus analyze` indexes a repo.
2. Graph data is written under `.gitnexus/` and registered globally.
3. `gitnexus setup` configures MCP/skills/hooks for agents.
4. Agents use tools such as `query`, `context`, `impact`, `detect_changes`, `rename`, and `cypher`.
5. Web UI can connect through `gitnexus serve` for graph exploration and chat.

## Graph And Storage Model

GitNexus builds a mutable in-memory `KnowledgeGraph` and persists it to LadybugDB.

Nodes include:

- `File`
- `Folder`
- `Function`
- `Class`
- `Method`
- `Community`
- `Process`
- `Route`
- `Tool`
- many language-specific symbols

Edges include:

- `CONTAINS`
- `CALLS`
- `IMPORTS`
- `EXTENDS`
- `IMPLEMENTS`
- `ACCESSES`
- `MEMBER_OF`
- `STEP_IN_PROCESS`

The ingestion pipeline is phase-based:

`scan -> structure -> markdown/cobol -> parse -> routes/tools/orm -> crossFile -> scopeResolution -> mro -> communities -> processes`

Storage uses LadybugDB with separate node tables and a `CodeRelation` relation table carrying the edge type. The system also includes FTS, optional embeddings, parse cache, incremental write-set handling, and a global registry at `~/.gitnexus/registry.json`.

## Trust Boundary

GitNexus has provenance mechanics: graph edges can carry confidence, reason, and evidence; the architecture mentions staleness indicators. But its review boundary is still weaker than CMAP's.

Important differences:

- GitNexus default instructions push agents to trust and use impact analysis.
- `rename` is destructive-capable, though it defaults to dry-run.
- `analyze` can inject GitNexus instructions into host entrypoints.
- Web LLM tools may read file contents into a model transcript depending on provider setup.

CMAP should not import GitNexus graph output as canonical project memory. It should treat it as generated evidence or candidate signals.

## Marketing / Source Evidence Check

The source supports that GitNexus has local indexing, a graph pipeline, MCP tools, impact analysis, detect changes, and Web chat/bridge mechanisms.

The source does not prove stronger outcome claims such as "agents never miss code" or "every dependency/call chain" with perfect recall. It also does not fully match a simple "browser/client-side graph" description: this checkout's active center of gravity is CLI/MCP/HTTP backend, while the browser UI primarily talks to the backend.

## Where It Is Stronger Than CMAP

- Source-code graph breadth and multi-language pipeline.
- Multi-repo registry and group-aware MCP tools.
- Impact/detect_changes tooling for pre-edit and pre-commit workflows.
- Web graph/chat UI and backend bridge.
- Strong agent integration across MCP, skills, and hooks.

## Where CMAP Remains Different

- CMAP has stricter canonical/generated/candidate separation.
- CMAP's module graph is reviewed project memory, not an automatic source graph.
- CMAP's review HTML should not perform new semantic analysis.
- CMAP's MapPatch and relation candidate workflow preserve human promotion gates.

## CMAP Takeaways

- Borrow MCP tool descriptions and next-step hints for agent ergonomics.
- Borrow multi-repo registry ideas carefully, but keep trust boundaries local and explicit.
- Borrow confidence/evidence fields for candidate relation proposals.
- Do not copy the default "impact output is trusted" posture.
- If integrated, route GitNexus outputs to `.context/generated` or `.context/inbox`.
