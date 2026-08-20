---
phase: 15-realism-polish-and-upstream
reviewed: 2026-08-12T01:49:48Z
depth: deep
files_reviewed: 16
files_reviewed_list:
  - fjs/document/prior_year_capital_loss/module.f.js
  - fjs/tax/carryover/module.f.js
  - fjs/report/payer/module.f.js
  - fjs/report/amend/module.f.js
  - fjs/guest/check/module.f.js
  - fjs/media/dialects/module.f.js
  - fjs/schedule/d/module.f.js
  - fjs/form1040/core/module.f.js
  - fjs/server/module.f.js
  - cas-refresh-cross-process.test.js
  - fjs-run-integration.test.js
  - payer-report-gate.test.js
  - payer-report-integration.test.js
  - year-genericity-gate.test.js
  - demo/lib/fixtures.js
  - demo/steps/05-exactness.js
  - README.md
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: resolved
resolved: 2026-08-20 — all five closed; IN-02 fixed on the day of re-verification
---

# Phase 15: Code Review Report

**Reviewed:** 2026-08-12T01:49:48Z
**Depth:** deep
**Files Reviewed:** 16 (+ `.planning/REQUIREMENTS.md`/`.planning/CAPABILITIES.md` inspected for cross-reference only, per the review's own scope rules excluding `.planning/`)
**Status:** resolved — all five closed, re-verified 2026-08-20 (see the end of this report)

## Summary

This review read every production `.f.js` file this phase added or modified, all four new/changed
real-process and mechanical-gate `*.test.js` files, the two demo collateral files, and README.md,
then independently re-derived arithmetic, re-ran the mechanical gates, and reproduced two of the
plans' own claimed mutation results directly (not merely trusted from the SUMMARY files).

**What held up under adversarial pressure:**

- **The Capital Loss Carryover Worksheet's arithmetic is correct.** All three worked examples in
  `fjs/tax/carryover/module.f.js` were independently re-derived by hand from the transcribed
  13-line worksheet text and match the shipped `bigint` arithmetic exactly (Worked Examples A, B,
  and C all re-checked line-by-line; B and C were checked in full, A partially cross-checked).
- **Absent-vs-broken carryover semantics are genuinely implemented and genuinely proven**, both
  halves: an absent `vnd.fjs.prior_year_capital_loss` document yields Schedule D lines 6/14 = `0n`
  without refusing (`absentCarryoverWithBrokerageSalesPresentComputesLegitimateZeroNotRefusal`),
  and a present-but-malformed field refuses by name
  (`presentButInvalidFieldRefusesNamingTheField`), independent of a present-but-*missing*-field
  structural refusal (`generatedRequiredFieldProof`).
- **`year-genericity-gate.test.js` and `payer-report-gate.test.js` are NOT vacuous** — verified by
  running them directly (`node --test`), and independently confirming their positive controls
  actually match their own regexes. Both gates scan the real `fjs/` tree clean and both have a
  mutation-checkable positive control that narrows correctly.
- **The 63-call-site `inputsOf` rewrite is structurally sound.** A bracket-aware script (written
  for this review, not trusted from the SUMMARY's claim) parsed every one of the 65
  `inputsOf(...)` occurrences in `fjs/form1040/core/module.f.js` and confirmed every single one now
  carries exactly 10 balanced argument groups (the widened arity), and the git diff shows every
  changed line is a single, uniform `([])` append at the end of an existing call — no argument was
  reordered, duplicated, or dropped.
- **`fjs_check`'s "never executes" claim is real, verified by reproducing the plans' own mutation.**
  Mutating `fjsCheck`'s production body to invoke the loaded report left the unit suite green
  (3141/3141, reproduced live) but crashed the real-process integration test with the exact stack
  trace the plan's SUMMARY describes, confirming the decisive proof lives where the SUMMARY claims
  it does and is not decorative.
- **No `npx` reappeared** in any real-process test; both `cas-refresh-cross-process.test.js` and
  `payer-report-integration.test.js` spawn `node` against absolute paths.
- **PROV-06's `programHash`/`args` guard is sound and correctly implemented** — no
  `parameterSetHash`-shaped field was added, matching the locked decision.

**What did not hold up:** `fjs/report/amend/module.f.js` — the new PROV-06 diff module — violates
its own declared `Result`-returning contract and its own docstring's safety claim when handed a
*schema-valid but semantically malformed* stored result. This was verified by direct execution
(reproduced twice, independently, below), not merely inferred from reading, and is untested by any
of the module's own 11 proof leaves.

## Critical Issues

### CR-01: `amendmentDiff` crashes with an uncaught bare-value throw on malformed-but-schema-valid stored data, instead of returning the `Result` its own signature promises

**File:** `fjs/report/amend/module.f.js:169-176` (`namedReportLineFromWire`), reached via
`namedLinesFromRecord` (line 181) → `diffWireRecords` (line 208) → `readResultsAndDiff` (line 249)
→ `amendmentDiff` (line 303).

**Issue:** `amendmentDiff`'s exported type is
`(cas) => (elected) => (runHashA) => (runHashB) => Effect<FileCasOperation, Result<AmendmentDiffResult, string>>`
— every documented failure mode (mismatched `programHash`, mismatched `args`, a non-`'ok'` run
status, an unreadable CAS blob, a structurally-invalid wire record) is handled as a graceful
`error(...)` `Result`. The module's own docstring for `namedReportLineFromWire` explicitly claims a
further case is *also* handled this way: "a wire record violating that is a malformed stored
result, refused by name rather than silently treated as sourceless." That claim is false. The
implementation calls `assertNotNullish` (which throws a bare string, per this project's own
convention for *internal invariant violations*, not external/adversarial data) directly against
data read back from CAS — content this module does not control and does not semantically validate
beyond rtti's purely structural `resultRecordSchema` check (`array(wireSourceSchema)` has no
"non-empty" combinator; rtti offers none). The same function also calls the *throwing* form
`centsFromString` (not the `Result`-returning `tryCentsFromString`) on the wire record's `value`
field, which is likewise untrusted, unvalidated external data.

Verified directly by execution (not merely read): I constructed two minimal repro scripts against
the exported `amendmentDiff`, seeded via the same `fileCas`/`virtual` harness the module's own
proof already uses.

1. **Empty `sources` array** (schema-valid: `array(wireSourceSchema)` permits length 0):
   ```
   wireA = { interest: { value: '10.00', sources: [], rule: '1040 line 2b' } }
   ```
   Result: `THREW (uncaught): stored line "interest" has no sources` — not `[, error('...')]`.

2. **Malformed decimal `value`** (schema-valid: `value: string` accepts any string):
   ```
   wireA = { interest: { value: 'not-a-number', sources: [...], rule: '...' } }
   ```
   Result: `THREW (uncaught): not a decimal number: not-a-number`.

Neither throw is caught anywhere in the call chain (`step`/`mapStep`/`pure` do not wrap callbacks
in `try`/`catch`), so it propagates out of the `Effect` entirely. This is the exact crash shape
this same phase's own `fjs-run-integration.test.js` demonstrates for `fjs_check`
(`"nothing in fjs/protocol/mcp/module.f.js's dispatch path wraps a throw in a try/catch"`) — if a
future plan wires `amendmentDiff` into an MCP tool the same bare way `fjsCheckTool`/`fjsRunTool`
are wired in this very diff (`mapStep(fn(...), result => ...)`, no `try`/`catch`), any two run
hashes pointing at a stored result with one empty-sources line or one malformed value crash the
whole server process, not just the one request — precisely the failure mode MCP-09's own design
in this phase was careful to test for and this module was not.

**Root cause, worth naming explicitly:** the docstring's justification —
`fjs/report/line`'s own `ReportLine` type already forbids empty `sources` (it is typed as
`readonly [Source, ...(readonly Source[])]`, a genuine non-empty tuple, confirmed by reading that
module) — is true for a `ReportLine` *constructed in TypeScript* but not preserved across the
JSON/CAS boundary, where rtti's `resultRecordSchema` has no equivalent non-empty-array combinator.
The module conflates a compile-time guarantee on one side of a serialization boundary with a
runtime guarantee on the other.

**Never exercised by a test:** none of the module's 11 proof leaves feeds a wire record with an
empty `sources` array or a malformed `value` string — the exact "malformed stored result" case the
docstring claims is handled.

**Fix:** Add a semantic validation step for the wire record — the same structural-rtti +
semantic-`checkReferences` two-step every document dialect in this codebase already uses — that
returns a `Result` instead of throwing:

```js
/** @type {(name: string) => (w: WireLine) => Result<{ readonly name: string, readonly line: ReportLine }, string>} */
const namedReportLineFromWire = name => w => {
    if (w.sources.length === 0) {
        return error(`stored line "${name}" has no sources`)
    }
    const parsed = tryCentsFromString(w.value)
    if (parsed === undefined) {
        return error(`stored line "${name}" has a malformed value: "${w.value}"`)
    }
    const [first, ...rest] = w.sources
    return ok({ name, line: { value: parsed, sources: [assertNotNullish(first), ...rest], rule: w.rule } })
}
```
then thread the `Result` through `namedLinesFromRecord`/`diffWireRecords` up into `DiffEffect`'s
existing error channel (the same pattern `readResultRecord` already uses one layer up), and add at
least two new proof leaves: a stored line with `sources: []`, and a stored line with a
non-decimal `value` — both asserting a named `error(...)` `Result`, never a throw.

## Warnings

### WR-01: `.planning/REQUIREMENTS.md`'s MCP-09 entry was marked Complete without correcting text that describes a different tool than the one shipped

**File:** `.planning/REQUIREMENTS.md` (excluded from this review's primary file scope, but
directly cross-referenced by this phase's own work, so flagged here rather than silently passed
over).

**Issue:** MCP-09's requirement text reads: `"fjs_check(hash) smoke-checks a stored program —
imports it and confirms it exports main returning an Effect — without running it to completion."`
The shipped `fjsCheck` (`fjs/guest/check/module.f.js`) checks `typeof loaded.report === 'function'`
— it confirms `report`, a guest program's `Report<T>` export, not `main` (the `NodeProgram`
convention AGENTS.md reserves for `index.f.js`'s own entry point), and it never inspects whether
that export "returns an Effect" at all (it stops at `typeof`, deliberately, per MCP-09's own
"never executes" mandate). This same phase explicitly recognized and fixed the identical class of
staleness for DOC-16's requirement text in the same commit range (15-06's own SUMMARY: "Corrected
REQUIREMENTS.md's DOC-16 entry, which described an older `fjs/media`... its own docstring says
'currently just `vnd.fjs.revision`'"), but the analogous MCP-09 staleness was left unfixed while
its checkbox was flipped to `[x]` and its traceability-table row to `Complete`.

**Fix:** Correct MCP-09's requirement text to name `report` (not `main`) and drop "returning an
`Effect`" (never checked), mirroring the correction already applied to DOC-16 in this same phase.

### WR-02: `cas_refresh`'s response shape changed from a bare string to a JSON object with no version signal

**File:** `fjs/server/module.f.js:126-163` (`casRefreshTool`).

**Issue:** `cas_refresh` previously answered the literal string `'refreshed'`; it now answers
`{"status":"refreshed","dialectCounts":{...}}`. This is a backward-incompatible response-shape
change to an existing, already-shipped MCP tool with no schema version bump and no `dialectCounts`
presence check gating old vs. new behavior. In this repo's own tests and demo code every caller
was updated in the same commit (verified: no remaining caller in `demo/` or elsewhere expects the
bare string), so nothing in-repo is broken, and the change is documented in the tool's own
description text (which an MCP client/agent reads before calling). This is a reasonable trade for
a personal-use v1 project, but it is a real breaking change to a tool contract with no explicit
"widened, not narrowed" note the way `Form1040Inputs`'s widening carries one — worth a one-line
docstring note for the next reader who assumes MCP tool responses are additive-only once shipped.

**Fix:** Add a short note at `casRefreshTool`'s own docstring stating this is a breaking response-
shape change from the pre-Phase-15 bare-string form, for the same reason `fjs/schedule/d`'s
docstring names Decision 2.5 as a boundary rather than leaving it implicit.

## Info

### IN-01: `.planning/CAPABILITIES.md` was added already stale relative to this diff's own HEAD

**File:** `.planning/CAPABILITIES.md` (excluded from primary review scope; informational only).

**Issue:** The new snapshot file pins itself to commit `02d478d` and states "Phase 15 in flight (3
of 6 plans landed at this commit)" with 874 de-duplicated proofs — but the diff under review
represents the *end* of Phase 15 (all 6 plans landed, 905 proofs, 6292/6292 passing per the
independently-verified suite state). The file's own header says to "regenerate... after any phase
closes," and this diff closes the phase without that regeneration happening. Not a functional
defect — the file is explicitly self-describing as a point-in-time snapshot — but it ships
misleading on arrival.

**Fix:** Regenerate `CAPABILITIES.md` against the phase-closing commit before merge, or note in
its header that a regeneration is pending.

### IN-02: `fjs/report/amend/module.f.js`'s `assertColumnBEqualsColumnCMinusColumnA` re-derives its check from the same two module functions (`centsFromString`/`centsToString`) the production code itself uses

**File:** `fjs/report/amend/module.f.js:388-395`.

**Issue:** This helper is a good defense-in-depth idiom (it caught an unpredicted second reddened
leaf during the plan's own mutation sweep, per the SUMMARY, which is a genuine point in its
favor) — but it is not, by itself, independent verification that `columnB`'s value is *correct*,
only that it is *internally consistent* with `columnA`/`columnC` as the module itself computed
them. The genuinely independent checks are the hand-typed literal assertions elsewhere in the same
proof leaves (e.g., `columnA === '1000.00'`), which this module already has. No action needed
beyond not over-crediting this helper as a correctness check in future documentation — it is a
consistency check, and the distinction matters given AGENTS.md's own repeated emphasis on
expected-side independence.

---

_Reviewed: 2026-08-12T01:49:48Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

---

## Re-verified 2026-08-20 — every finding checked against the code, not against a later document

This report kept `issues_found` long after the code stopped matching it. Each finding below was
re-checked by reading the current source; a planning document claiming a fix was never accepted as
evidence for one.

| ID | Disposition | Evidence |
|---|---|---|
| CR-01 | **CLOSED** | `fjs/report/amend/module.f.js:190-195` — `namedReportLineFromWire` returns a `Result`, `tryCentsFromString` replaced the throwing form, and the `Result` is threaded through `:225` and `:261-263` into `DiffEffect`'s error channel. Both requested proof leaves exist (`:563-590`, tagged `// CR-01:`) and were observed running. |
| WR-01 | **CLOSED** | `.planning/REQUIREMENTS.md:109-110` — MCP-09 now names `report`, matching `fjs/guest/check/module.f.js:94`, with a correction note at `:110-118`. |
| WR-02 | **CLOSED** | `fjs/server/module.f.js:127-129` carries the breaking-shape note on `casRefreshTool`, using the `fjs/schedule/d` Decision-2.5 precedent this report named. |
| IN-01 | **CLOSED** | `.planning/CAPABILITIES.md:3` is dated and maintained; the stale figures this report flagged are gone entirely. |
| IN-02 | **FIXED 2026-08-20** | `assertColumnBEqualsColumnCMinusColumnA`'s docstring claimed the check was "not merely trusted from the implementation". It re-derives its expectation through `centsFromString` — the same pair the production path used to build `columnB` — so a defect inside that pair satisfies both sides. The docstring now says consistency check, names what it *does* catch, and points at the hand-typed expectations (`:484-486`) that are genuinely independent. No code change; the wording WAS the defect. |
