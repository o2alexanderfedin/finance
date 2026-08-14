# Phase 18: Dependency and Duplication Debt - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning

<domain>
## Phase Boundary

The vendored dependency is current, and the remaining duplications are shared rather than copied.

Four deliverables: upgrade `functionalscript` and re-check the upstream notes against it (MAINT-06);
share `executeRun`'s common tail with `runExecuteRunViaFixture` (MAINT-07); collapse the
`formRevision` check to one definition (MAINT-08); and resolve `artifactSubject`.

Plus one item carried in from Phase 19's code review by owner decision: **split
`fjs-run-integration.test.js`'s single `test()` block** (WR-03).

**Out of scope:** anything touching the OCR island (Phase 16, deferred), any documentation
truth-pass work beyond notes this phase's own changes invalidate (Phase 17), and any behavior
change. **This phase must not alter a single computed figure.**

</domain>

<decisions>
## Implementation Decisions

### The dependency upgrade (MAINT-06)

- **Target `functionalscript` 0.44.0** (owner decision, 2026-08-14). ROADMAP's criterion said
  `0.43.0`, which `package.json` had already exceeded — it has declared `^0.43.1` since Phase 15
  and 0.43.1 is installed, so the literal text was satisfiable by doing nothing. The owner chose
  to honour the criterion's *intent*: "the vendored dependency is current." The ROADMAP text is
  corrected in place.
- **Keep the caret range** (`^0.44.0`). Exact pinning was considered and not chosen; the
  `package-lock.json` already provides reproducibility, and the submodule pin is the deeper
  guarantee.
- **All four `fjs/todo/upstream-*.md` notes get re-checked against 0.44.0**, individually, with
  the check recorded in each file. A note claiming a gap upstream has since closed is precisely
  the wrong-remedy defect Phase 17 exists to eliminate — do not let this phase hand Phase 17 more
  of them.
- **`upstream-json-parse-split.md` is the already-retired one.** It has read *"landed upstream and
  adopted here — `parse` is total as of 0.42.0"* since before this phase was written, and its own
  text says to delete it once adopted. Delete it, unless re-checking finds the adoption incomplete.

### The `formRevision` duplication (MAINT-08)

- **Share across all six dialects, and correct the ROADMAP** (owner decision). The criterion said
  "two dialect files"; measured, it is **six**: `1099int:130`, `1099r:232`, `w2:196`,
  `ssa1099:130`, `1099div:234`, `1099b:264`, each carrying the identical
  `` error(`formRevision must not be empty or whitespace-only`) ``.
- **Follow `moneyFieldError`'s precedent exactly** — `fjs/document/money_field/module.f.js:42`
  is the established shape for a shared per-field validation helper. Do not invent a second
  pattern beside it.
- **Re-derive the population before fixing.** `grep -rn "formRevision must not be empty" fjs`.
  If it returns more than six, a dialect was added after this note was written and the count is
  stale again — which is exactly how the criterion came to say two.

### The `executeRun` / fixture duplication (MAINT-07)

> **The criterion's premise is partly wrong and the plan must not inherit it.** Measured
> 2026-08-14: these two functions are **not** a byte-identical duplication.

- `executeRun` (line 179) and `runExecuteRunViaFixture` (line 574) **genuinely diverge at the
  head**. The fixture performs a real `materializeProgram` write, then swaps in a `JsModule` via
  `placeJsModuleFixture`, because `fjs/effects/node/virtual` cannot compose a write with an
  import in one session. That divergence is load-bearing and documented; **it stays.**
- **Only the tail is shared shape:** `loadProgram` → `buildRunSnapshot` → `buildHostMap` →
  `interpret` → `classifyRunOutcome`. Extract *that*, not the whole sequence.
- **`classifyRunOutcome` is already shared** (Phase 09-06 moved it to `fjs/report/guard` for
  exactly this reason, and mutating it reddens both paths today). The remaining duplication is
  the orchestration around it, not the rule inside it.
- **The criterion's proof standard is the real bar:** reorder or insert a step in the shared
  tail, and **both** the virtual proofs **and** the real-process integration test must go red.
  A change that reddens only one has not shared the thing that matters.

### `artifactSubject` (MAINT-07's fourth criterion)

- **Delete it.** Confirmed twice, 2026-08-12 and 2026-08-14: `fjs/document/subject/module.f.js:48`
  exports it and nothing outside that file references it.
- **`formSubject`, from the same file, is live** — `fjs/document/consolidated_provenance/module.f.js:41`
  imports it and calls it at lines 117-118. **Do not delete the file.** This is the exact
  distinction Phase 16's ROADMAP criterion got wrong, and correcting that error is what surfaced
  this one.

### Splitting `fjs-run-integration.test.js` (WR-03, carried from Phase 19)

- **Do it in this phase** (owner decision). Measured: **766 lines, exactly one `test()` call** at
  line 122.
- **The masking is proven, not theoretical.** During Phase 19's Mutation Gate M1, Node reported
  the failure as the *pre-existing* pin proof — which shares the block and runs first — so the new
  PROV-05 assertion's independent redness could only be established with a throwaway diagnostic
  copy. **Two separate agents hit this.** Beyond mutation testing, a regression in any later
  assertion is invisible today while an earlier one fails: the file reports one failure no matter
  how many things break.
- **Split by concern into multiple `test()` calls**, preserving every existing assertion verbatim.
  This is a pure restructuring: no assertion added, removed, or weakened.
- **Prove the split worked the only way that counts:** break an assertion in a *late* block and
  confirm it is now reported by name, where before it would have been masked by an earlier
  failure. A split that isn't demonstrated to unmask is just moved code.

### Claude's Discretion

- Helper naming and module placement for the shared `formRevision` check and the shared tail;
  the number and boundaries of the split `test()` blocks; plan/wave decomposition.

</decisions>

<code_context>
## Existing Code Insights

Measured on `6d6d8b8` before planning.

### Reusable Assets

- `fjs/document/money_field/module.f.js:42` — `moneyFieldError`, the precedent the shared
  `formRevision` check must follow.
- `fjs/report/guard/module.f.js` — `classifyRunOutcome`, already shared between both run paths.
- `cas-refresh-cross-process.test.js` — the second-OS-process spawn pattern, including
  `fjsCliPath`: spawn `node` against an absolute `node_modules` path, **never `npx`**.

### The six duplication sites

`fjs/document/{1099int:130, 1099r:232, w2:196, ssa1099:130, 1099div:234, 1099b:264}/module.f.js`.

### Established Patterns

- Money is `bigint` cents; a stored document's money is a decimal **string**, never a number.
- Pure `.f.js` modules with a co-located `export const proof`, discovered by `all.test.js`.
  **`node --test <a-file-under-fjs/>` reports a FAKE PASS** — only trust `npm test` or
  `node --test all.test.js`. Root-level `*.test.js` files are the documented exception.
- No casts, no `!` non-null assertions, no `any`. `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes` are on; the latter does **not** catch a spread carrying
  `undefined` (proven in Phase 5).
- A mutation that fails to **compile** proves nothing — `npm test` is `tsc && node --test`.

### Measured baseline entering this phase

`npm test`: **6314/6314**, exit 0. Project-local proofs: **916**. Full-suite runtime **~45-140s**,
varying ~3× with load — *not* the "~8 min" older docs claim.

</code_context>

<specifics>
## Specific Ideas

- **This phase is unusually exposed to silent behavior change.** Three of its four deliverables
  are refactors of code that computes or validates, and the fourth is a dependency bump beneath
  all of it. The suite is the safety net, and `916` proofs plus two real-process tests is a good
  net — but **the proof count must not drop**, and no figure may move. If a refactor requires
  changing an expected value, that is a defect in the refactor, not a test to update.

- **Re-derive every population this phase touches before acting on it.** Both of this phase's own
  ROADMAP criteria were measurably false (`0.43.0` already exceeded; "two dialect files" is six),
  and Phase 19 shipped after four blockers of the identical shape. The corrected criteria now
  carry their re-derivation commands inline. Use them.

- **The upgrade goes first and alone.** A dependency bump landing in the same commit as a refactor
  makes a bisect useless if something moves. 0.44.0 is a minor bump on a dependency this project
  is deeply coupled to.

</specifics>

<deferred>
## Deferred Ideas

- **Exact-pinning `functionalscript`** (dropping the caret). Considered during discuss and not
  chosen; revisit if a patch release ever breaks the suite.
- **Phase 16's orphan island** — `from_ocr` and `ocr_amount` remain unreachable. Deferred by owner
  decision on 2026-08-12; not this phase's business even though it is adjacent debt.
- **Splitting `payer-report-integration.test.js`** if it has the same single-block shape. Check,
  but do not fix here unless it is trivially the same edit — WR-03 named only
  `fjs-run-integration.test.js`.

</deferred>
