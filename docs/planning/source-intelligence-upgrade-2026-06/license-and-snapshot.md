# License And Source Snapshot

Date: 2026-06-04

This planning set uses local repository snapshots under `research/coding-knowledge-graphs-2026-06/repos/`. It does not claim these upstream projects are current beyond the local checkout.

## Snapshot Table

| Project | Local Commit | Runtime | Local License Signal | CMAP Use |
|---|---:|---|---|---|
| CodeGraph | `8629f7a` | TypeScript / Node | MIT in `LICENSE` and `package.json` | Strong implementation reference; no source copy |
| Code Review Graph | `0c9a5ff` | Python | MIT in `LICENSE` and `pyproject.toml` | Strong algorithm/schema reference; rewrite in TS |
| Graphify | `ec3cb5e` | Python | MIT in `LICENSE` via `pyproject.toml` | Multimodal/confidence/source graph reference; rewrite selectively |
| Understand-Anything | `e5dded6` | TypeScript / plugin | MIT in `LICENSE` | UX/onboarding/dashboard reference; no graph truth promotion |
| CodeGraphContext | `38f5289` | Python | MIT in `LICENSE` and `pyproject.toml` classifier | MCP/backend/allowed-root reference; rewrite selectively |
| LeanKG | `f1f51ad` | Rust | `LICENSE` and `Cargo.toml` say Apache-2.0; README badge says MIT | Treat as Apache-2.0; design reference only for this plan |
| GitNexus | `50715e3` | TypeScript / Node / React | PolyForm Noncommercial 1.0.0 | Design-only; do not copy code |

## License Interpretation For Planning

MIT and Apache-2.0 allow study, modification, and redistribution with notice obligations, but this plan still avoids copying code to keep CMAP's implementation coherent and dependency surface small.

GitNexus's PolyForm Noncommercial license is not suitable for direct code absorption into CMAP because CMAP may be published, reused, or commercialized. Safe use is limited to independently reimplementing ideas after studying command shape and product behavior.

LeanKG has conflicting public signals: its package metadata and `LICENSE` file identify Apache-2.0, while the README badge/section says MIT. This plan follows the stricter concrete files: `LICENSE` and `Cargo.toml`.

## Planning Rule

All competitor-derived implementation details must become:

- CMAP-native TypeScript designs.
- Generated evidence or candidate workflows.
- Documentation with source provenance.

They must not become copied source files or canonical `.context` facts without review.
