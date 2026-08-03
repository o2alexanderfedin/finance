# Phase 1: Planning-Document Corrections and the Upstream Report - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Every planning document states only things that are true, so no later phase is planned
against text that dissolves on contact.

This phase edits documents and files one upstream bug report. It writes **no source code**
and changes no behaviour. Its output is prose, plus a public issue URL recorded in the repo.

In scope: `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`,
`README.md`, `todo/plan.md`, `fjs/todo/implement-mcp-server.md`,
`fjs/todo/upstream-match-partial-operation-map.md`.

Out of scope: implementing the corrected guard (that is Phase 3, EXEC-02/EXEC-03), and the
exact-decimal module itself (Phase 4, EXACT-01).

</domain>

<decisions>
## Implementation Decisions

### Upstream Disclosure (SEC-04)

- **File a public issue** on `github.com/functionalscript/functionalscript` for the `match`
  prototype-dispatch soundness hole, **with the full `__defineGetter__` reproduction
  attached**, and record the resulting URL in the repo. Satisfies ROADMAP criterion 4
  literally.
- **Risk accepted, explicitly.** This publishes a working sandbox escape against shipped
  0.40.0 before a fix exists. Raised at decision time and chosen anyway. Recorded here so
  the choice stays legible rather than looking like an oversight.
- The issue names `Object.hasOwn` + a null-prototype map as the correct guard, so the
  report ships with its own remedy rather than only a weakness.
- AGENTS.md line 30 says "don't open a tracker" — that rule governs *this* repo's specs and
  issues, which live in `todo/`. It does not govern a bug report filed against a third-party
  dependency's own tracker. No conflict; noted so the next reader does not re-litigate it.

### Scope of Corrections

- **DOCC-07 is added to this phase** (seventh correction): PR #17 made "money in stored JSON
  is a `string`, never a JSON number" absolute, contradicting three places that still specify
  integer cents as a JSON *number* at the storage boundary —
  `.planning/REQUIREMENTS.md:249` (EXACT-05), `.planning/ROADMAP.md:214` (Phase 4 success
  criterion 4), `.planning/ROADMAP.md:221` (Phase 5 depends-on line).
- **Only the storage layer flips.** Exact rationals inside computation and decimal strings on
  the MCP wire are unaffected and must survive the edit unchanged.
- Rationale for fixing it here rather than in Phase 4: Phase 1 exists precisely so no later
  phase is planned against false text. Phase 4 and Phase 5 both read these lines when they
  plan.

### Sergey's Upstream File

`fjs/todo/upstream-match-partial-operation-map.md` carries two separate problems. The
treatment differs per problem, deliberately:

- **Correct the false claim.** "That design is sound — an operation not in the map genuinely
  cannot happen" is the exact DOCC-02 claim, and it is false for a plain-object map. Rewrite
  it to state the guard condition that makes it true.
- **Add a warning to the Local workaround section**, which currently proposes
  `command in map`. Reproduced: `in` returns **true** for `constructor`,
  `__defineGetter__`, `toString`, and `valueOf`, so it does not refuse them.
- **Leave the three upstream fix sketches untouched.** They are Sergey's design call on his
  own project. This phase corrects facts, it does not overrule a partner's API preference.

### Claude's Discretion

- Exact wording of every correction.
- Whether corrections land as one commit or several (granularity is `fine`, so several).
- Whether the reproduction script is committed to the repo or only pasted into the issue.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- No source code is touched. The repo is still 17 lines of hello-world: `fjs/index.f.js`,
  `fjs/proof.f.js`, `index.js`, `all.test.js`. `npm test` → 1 pass, 0 fail.

### Established Patterns

- Specs live as Markdown in `todo/` next to the code they concern (AGENTS.md line 30).
- Upstream gaps get a dedicated `fjs/todo/upstream-*.md` file. Two exist already:
  `upstream-match-partial-operation-map.md`, `upstream-media-dialect-registry.md`.
- `todo/plan.md` is the project's own sequencing authority; `.planning/ROADMAP.md` nests
  under it rather than replacing it.

### Integration Points

- Phase 3 (The Restricted Interpreter) implements from
  `fjs/todo/upstream-match-partial-operation-map.md`. That file is this phase's
  highest-stakes edit — uncorrected, Phase 3 ships an escapable guard.
- Phase 4 and Phase 5 read the EXACT-05 / storage-boundary lines when they plan.
- Phase 8 reads the TY2025 parameter-sourcing rule (DOCC-06).

</code_context>

<specifics>
## Specific Ideas

### The reproduction, verified by execution

Against a plain-object whitelist holding exactly one permitted operation:

| command | `in` | `!== undefined` | `Object.hasOwn` |
|---|---|---|---|
| `casRead` (whitelisted) | true | true | **true** |
| `fetch` | false | false | false |
| `constructor` | **true** | **true** | **false** |
| `__defineGetter__` | **true** | **true** | **false** |
| `toString` | **true** | **true** | **false** |
| `valueOf` | **true** | **true** | **false** |

With an `in`-based guard, dispatching `__defineGetter__` installed an attacker-controlled
getter **on the whitelist object itself**; reading that property executed arbitrary code. The
same call under an `Object.hasOwn` guard returned `refused` and left the map unpolluted.

Only `Object.hasOwn` is correct. A null-prototype map (`{ __proto__: null }`) is the
belt-and-braces companion.

### DOCC-06 wording constraint

The parameter-sourcing rule must name **Rev. Proc. 2024-40 as modified by Rev. Proc.
2025-32**, and must explicitly name the original 2025 inflation-adjustment release as the
*wrong* source. Naming the wrong source is the part that prevents the mistake.

</specifics>

<deferred>
## Deferred Ideas

- **A CI regression gate** (grep for `toFixed`/`parseFloat`/`Math.round`, or for the
  reintroduction of `djs/parser` as a validation remedy). Belongs with the phase that
  introduces the code it guards — Phase 4's success criterion 2 already specifies the money
  grep.
- **Implementing the corrected guard.** Phase 3, EXEC-02/EXEC-03, deliberately kept in one
  phase so the security fix and the clean-refusal feature cost one change, not two.
- **Deciding the v1 cut line.** Still open. Surfaces again at Phase 11.

</deferred>
