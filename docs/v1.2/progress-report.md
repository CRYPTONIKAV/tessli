# Tessli v1.2: progress report

Date: 2026-10-11
Scope: Stage A (cleanup) and Stage B (development) of [`plan.md`](plan.md), run by an orchestrating agent while the owner was away.
Method: one PR per step, each branched from the latest `main`. From #131 on, each PR passed an adversarial review by a fresh reviewer agent, had its findings fixed, had real check output pasted in, went green in CI and was squash-merged (#130 only added the plan under `docs/v1.2/`, which CI did not run on). Visible changes have screenshots at 1440/1024/768/390/320 on the `pr-assets` branch, which is never merged.

## Where each phase stands

Updated 2026-10-11, after #169. Phases are from [`plan.md`](plan.md) §11.

| Phase                    | Status            | What is missing                                                                                                       |
| ------------------------ | ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| 0. Decide and clean      | Done              | Nothing                                                                                                               |
| 1. Sources pruned        | Done              | Owner decisions on the weak and unclear sources in the October audit                                                  |
| 2. Library foundation    | Done              | Nothing                                                                                                               |
| 3. Starter set and rules | Built, not signed | All 12 items are `community` and all 39 rules `draft`; the owner signs them with [`taste-review.md`](taste-review.md) |
| 4. Open to contributors  | Mostly done       | First external PR merged (#159). Left: shadcn directory listing (pre-flight steps 5–6) and the announcement           |
| 5. Taste Bench           | Ready, not run    | The 36 AI builds and at least 3 human reviewers                                                                       |

## Stage A: cleanup (complete)

The full report is in [`cleanup-report.md`](cleanup-report.md). Stage A merged PRs #130–#138. It covered the approved plan, the process-docs removal and governance files, the removal of proofs, auth, Boards/Saved, the media pipeline and dead code, the design-system repair, and one CI workflow.

|                | Before  | After   |
| -------------- | ------- | ------- |
| Tracked files  | 564     | 224     |
| Tracked bytes  | 13.1 MB | 1.97 MB |
| Markdown files | 158     | 20      |

The Stage A gate passed on `main` @ `9016d73`:

- CI is green and `npm run check` passes.
- All 16 remaining routes rendered at 390 and 1440 with no overflow and no console errors (32/32).
- All 9 browser tests pass.
- Nothing on the removal map is still tracked.

## Stage B: development

| Step             | PR                                                                                                                                 | One line                                                                                                                                                                                                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1a              | [#139](https://github.com/Online-Scope-Lab/tessli/pull/139)                                                                        | Froze source IDs; one `sources/<slug>.yml` per source (295); removed the hard-coded 295 and per-category counts; added `archived` status; removed the Verified/coverage machinery from public surfaces                                                                                                                          |
| B1b              | [#140](https://github.com/Online-Scope-Lab/tessli/pull/140)                                                                        | Applied `catalogue-triage-final.csv` exactly: 125 active, 4 needs-review (fix-url rows the sandbox could not verify), 166 archived with reasons, 0 deleted. Fixed collections; added the suggest-source validation Action                                                                                                       |
| B2               | [#141](https://github.com/Online-Scope-Lab/tessli/pull/141)                                                                        | Library foundation: item schema, `_template`, `/preview/[slug]`, Tessli/Neutral/Dark themes, root `registry.json`, `/library` pages, Playwright and axe item CI; 3 items. A GitHub-registry install of all three items into a fresh Next.js + shadcn app built successfully                                                     |
| B3a              | [#142](https://github.com/Online-Scope-Lab/tessli/pull/142)                                                                        | 39 draft rules, a generated 7.4 KB `rules/TESSLI.md` (installable as `online-scope-lab/tessli/rules`), and `/rules` and `/rules/[id]`                                                                                                                                                                                           |
| B3b              | [#143](https://github.com/Online-Scope-Lab/tessli/pull/143)                                                                        | The remaining 9 starter items. The library now has all 12 (§6.4), all `community`                                                                                                                                                                                                                                               |
| B3c              | [#144](https://github.com/Online-Scope-Lab/tessli/pull/144)                                                                        | MCP tools `search_items`, `get_item`, `get_rules`, `find_sources` and `get_source`; rewritten `llms.txt` and `/for-ai`; `skills/tessli/SKILL.md`                                                                                                                                                                                |
| B3d              | [#145](https://github.com/Online-Scope-Lab/tessli/pull/145)                                                                        | Home rewritten below the kept ExploreHero; nav is Library \| Sources \| For AI; `/contribute`; `/submit` and `/suggest` redirect with 308                                                                                                                                                                                       |
| B4               | [#146](https://github.com/Online-Scope-Lab/tessli/pull/146)                                                                        | Contribution flow audited end to end; error messages contributors can act on; fork-safe workflows; CONTRIBUTING rewritten; shadcn directory listing text (no PR opened on shadcn-ui/ui); 8 first-contributor issue drafts                                                                                                       |
| B4 (GitHub)      | issues [#147](https://github.com/Online-Scope-Lab/tessli/issues/147)–[#154](https://github.com/Online-Scope-Lab/tessli/issues/154) | 8 seeded first-contributor issues (6 labelled good first issue, 2 help wanted). Test issue [#155](https://github.com/Online-Scope-Lab/tessli/issues/155) confirmed the suggest-source Action works on GitHub, then was closed                                                                                                   |
| B5a              | [#156](https://github.com/Online-Scope-Lab/tessli/pull/156)                                                                        | Taste Bench: protocol (published before any run), 6 briefs, starter app, condition prompts, harness (recovered from `v1.1-archive`), blinded-packet tooling, 70 tests (77, plus 7 Node tests, after B5b prep)                                                                                                                   |
| B5b prep         | [#157](https://github.com/Online-Scope-Lab/tessli/pull/157)                                                                        | Operator prep for the AI-build run: a script that mirrors the shadcn base registry, plus run notes                                                                                                                                                                                                                              |
| After the report | [#159](https://github.com/Online-Scope-Lab/tessli/pull/159)                                                                        | First external contribution: better summaries for the Icons sources, from @swetajha3 (closes #148)                                                                                                                                                                                                                              |
| After the report | [#160](https://github.com/Online-Scope-Lab/tessli/pull/160)                                                                        | Source URL audit of all 129 active and needs-review sources ([`source-audit-2026-10.md`](source-audit-2026-10.md)): Godly moved to Recent.Design, 9 other URLs moved to their redirect targets, the 4 `needs-review` sources set `active`. Hero artwork origin recorded. Logo files, GitHub social preview and Open Graph image |
| After the report | [#161](https://github.com/Online-Scope-Lab/tessli/pull/161)                                                                        | Owner's call: text wordmark alone in the header, mark alone in the footer                                                                                                                                                                                                                                                       |
| After the report | issues [#162](https://github.com/Online-Scope-Lab/tessli/issues/162)–[#168](https://github.com/Online-Scope-Lab/tessli/issues/168) | 7 more contributor issues seeded from the audit: summaries, `kind`, `limitations`, gallery liveness, a FAQ state and a contact-form item                                                                                                                                                                                        |
| After the report | [#169](https://github.com/Online-Scope-Lab/tessli/pull/169)                                                                        | [`taste-review.md`](taste-review.md), the sign-off checklist for items and rules; shadcn directory pre-flight steps 1–4 and 7 pass against `tessli.vercel.app`                                                                                                                                                                  |

### Notable decisions

`docs/decisions.md` lists the decisions, about 107 dated lines. The ones with the most effect:

- **Registry:** item sources live in `web/registry/items/`. A generated root `registry.json` points into them. Items import `@/registry/shadcn/ui/*`, which the shadcn CLI rewrites on install.
- **Site structure:** site pages moved into the `app/(site)` route group so `/preview` renders without site chrome. `/preview/*` alone allows same-origin framing.
- **Sources:**
  - The 11 current categories stay. The 13-category taxonomy needs a curator to place each source.
  - Migrated summaries are kept verbatim.
  - `kind` is a provisional per-category default.
  - `added_at` comes from git history; `last_checked` is null.
- **Unverified URLs:** the 4 fix-url rows are `needs-review`, not `active`, because their new URLs could not be checked from the sandbox.
- **Review status:** rules are `draft` and items are `community`. Only a maintainer can sign `reviewed`.
- **MCP:** the local server runs with `node web/mcp/server.ts`, because the `npm run` banner corrupts stdio. Hosted MCP stays off.
- **Hero:** the home hero is untouched, copy included. Library-first positioning starts in the section below it.
- **DCO:** sign-off is documented but not enforced in CI.
- **New dependencies:** each has a one-line reason.
  - `yaml` parses the source files.
  - `clsx`, `tailwind-merge` and `class-variance-authority` are shadcn's `cn` and `button`.
  - `@playwright/test` and `@axe-core/playwright` run the item CI.
- **CI hardening:** browser tests mark the old document stale before navigating, and CI waits for the Chrome DevTools endpoint before running them. This fixed two intermittent failures (PR #138).

## What is left, and why

- **Taste Bench AI builds (B5b): not run.**
  - The environment's permission policy refused to launch headless builder agents.
  - Running the builds as in-session subagents would give the builders the repository's own design guidance, which breaks the baseline condition. So nothing was run, rather than running a compromised study.
  - The protocol, harness and operator prep are ready for a human operator. No human or AI scores exist.
- **`/bench` results page:** waits for human scores, as the protocol says.
- **Revised 13-category taxonomy:** needs a curator to place each source. Issue #150 starts the Colour/Accessibility split.
- **Kit feature** (one install for a set of items): planned for v1.3.
- **`@tessli` install form in the docs:** `/for-ai`, the README and `skills/tessli/SKILL.md` gain `npx shadcn add @tessli/<item>` in a follow-up change once the directory listing merges.

## Needs a human

One list, in the order that unblocks the most. Items done since the first version of this report are at the end.

### 1. Sign off taste (finishes Phase 3)

- [ ] Review the 12 starter items in all three themes at five widths, and the 39 draft rules, with [`taste-review.md`](taste-review.md). Only a maintainer sets `status: reviewed` with `reviewed_by` and `reviewed_at`. The plan suggests a second designer you trust.

### 2. List in the shadcn directory and announce (finishes Phase 4)

- [ ] Confirm `tessli.vercel.app` is the domain to keep, and approve the entry's logo and description (pre-flight step 6 in [`shadcn-directory-listing.md`](shadcn-directory-listing.md)).
- [ ] Run `pnpm validate:registries` in a fork of `shadcn-ui/ui` with the entry added (step 5), then open the pull request.
- [ ] Announce once the listing is live.

### 3. Run the Taste Bench (Phase 5)

- [ ] Run the 36 AI builds by following `bench/README.md`, in an environment where the baseline builders cannot read this repository.
- [ ] Recruit at least 3 independent human reviewers to score the 18 blinded pairs. No scores were produced or simulated.

### 4. Sources

- [ ] Decide keep or archive (with a reason) for the 11 **weak** sources and open the 17 **unclear** ones in [`source-audit-2026-10.md`](source-audit-2026-10.md). Confirm the reported Tailwind Plus change before acting on it.
- [ ] Optionally override any row of the triage made on your behalf ([`owner-actions.md`](owner-actions.md): 125 keep, 4 fix-url, 2 merge, 164 archive).
- Curator work stays open to contributors: per-source `kind` (#149, #164), summaries (#162, #163), `limitations` (#165), gallery liveness (#166). `last_checked` is still null for every source.

### 5. Contributors

- [ ] Review the PR for #152 from @Adityaaop when it arrives (assigned 2026-10-11).
- [ ] Decide whether to enforce DCO sign-off; if so, install the DCO GitHub App and decide how to handle unsigned commits from first-time contributors.
- [ ] Add a dedicated Code of Conduct contact address.

### 6. Housekeeping

- [ ] Shut down the hosted Supabase project (user tables and the pilot image bucket). The repo no longer uses it.
- [ ] Delete merged branches; the automation proxy rejects ref deletion. Optionally turn on "Automatically delete head branches".
  - Stage A: `docs/tessli-v1.2-plan`, `docs/v1.2-governance`, `chore/remove-proofs-and-experiments`, `chore/remove-auth`, `chore/remove-boards-and-saved`, `chore/remove-media-pipeline`, `fix/design-system-foundation`, `chore/ci-consolidation`, `docs/cleanup-report`.
  - Stage B: `feat/sources-yml`, `feat/sources-triage`, `feat/library-foundation`, `feat/rules`, `feat/starter-items`, `feat/agent-interfaces`, `feat/home-nav-contribute`, `feat/open-to-contributors`, `feat/taste-bench`, `feat/bench-operator-prep`, `docs/progress-report`, `claude/sweet-wright-72sp6d`.
  - Keep `pr-assets` (screenshots linked from PRs), `archive/v1.1` and tag `v1.1-archive`.
  - About 42 pre-v1.2 branches (`agent/*`, `codex/*`, `proof/*`, `validate/*`, older `docs/*` and `feat/*`) were left untouched; their content is in `main`'s history or `v1.1-archive`.

### Done since the first version of this report

- Hero artwork origin confirmed by the owner: generated with ChatGPT; Online Scope holds whatever rights exist in it (#160).
- The 4 `needs-review` sources (coss UI, React Aria, v0, Shopify Polaris) set `active`, and Godly moved to Recent.Design (#160).
- Canonical domain checked: `tessli.vercel.app` serves `/r/*.json`, and a fresh-app install builds (#169).
- Labels `source:suggestion`, `source:problem` and `design:needs-implementation` created; `source:problem` added to #147 (now closed).
