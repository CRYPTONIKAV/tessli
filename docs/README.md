# Tessli docs

A short index of what lives in `docs/`. Start with the root [`README.md`](../README.md), [`AGENTS.md`](../AGENTS.md), [`CONTRIBUTING.md`](../CONTRIBUTING.md) and [`design.md`](../design.md).

## Direction

- [`v1.2/plan.md`](v1.2/plan.md): the approved product and build plan.
- [`v1.2/repo-cleanup.md`](v1.2/repo-cleanup.md): the cleanup steps (C0–C7).
- [`v1.2/cleanup-report.md`](v1.2/cleanup-report.md): what Stage A removed and kept, with before/after counts.
- [`v1.2/progress-report.md`](v1.2/progress-report.md): where each phase stands, the PRs, decisions, what is left, and the owner's to-do list.
- [`v1.2/good-first-issues.md`](v1.2/good-first-issues.md): drafts of the first contributor issues, each with files, acceptance checks and how to verify.
- [`v1.2/shadcn-directory-listing.md`](v1.2/shadcn-directory-listing.md): the `@tessli` entry for the shadcn registry directory, its pull request text and the pre-flight checklist.
- [`v1.2/`](v1.2/): the catalogue audit, triage files and research notes behind the plan.
- [`decisions.md`](decisions.md): one dated line per decision.

## Contributing

- [`../CONTRIBUTING.md`](../CONTRIBUTING.md): every contribution path, step by step, with the item checklist, DCO sign-off and AI-assistance disclosure.
- [`../.github/ISSUE_TEMPLATE/`](../.github/ISSUE_TEMPLATE/): the issue forms (suggest a source, submit a design, report a source problem, bug report) and [`../.github/workflows/suggest-source.yml`](../.github/workflows/suggest-source.yml), the automatic first-pass check on source suggestions.

## Reference

- [`quality-gates.md`](quality-gates.md): the checklist for visible changes (widths, accessibility, interaction, truthfulness) and the twelve review dimensions.
- [`../bench/PROTOCOL.md`](../bench/PROTOCOL.md) and [`../bench/README.md`](../bench/README.md): the Taste Bench protocol (published before any run) and how to operate it.
- [`../rules/`](../rules/): the UI rules, one file each, and the generated agent index [`TESSLI.md`](../rules/TESSLI.md).
- [`data-and-media-contract.md`](data-and-media-contract.md): the catalogue, category and collection models, and the frozen media fallback chain.
- [`component-contracts.md`](component-contracts.md): behaviour of the site's shared components.
- [`asset-manifest.md`](asset-manifest.md): brand artwork and reference images, with dimensions and hashes.
- [`ref-img/`](ref-img/): art-direction references and the canonical hero artwork.
- [`tessli-native-mcp.md`](tessli-native-mcp.md): running the local read-only MCP server.

## Recovering removed docs

PRD, build slices, slice evidence, contracts, handoffs and earlier research were removed in v1.2. Read any of them with `git show v1.1-archive:<path>`, or browse the `archive/v1.1` branch.
