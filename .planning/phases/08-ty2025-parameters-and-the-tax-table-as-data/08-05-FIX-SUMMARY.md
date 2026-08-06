---
phase: 08-ty2025-parameters-and-the-tax-table-as-data
plan: 05
subsystem: finance_tax_params
tags: [bugfix, proof-integrity, tdd, mutation-testing, tax-params]

# Dependency graph
requires:
  - phase: 08-01
    provides: fjs/tax/params/module.f.js (the TY2025 figures and citations this fix's expected literals are hand-typed from)
  - phase: 08-02
    provides: fjs/tax/table/module.f.js (taxTableBandStructure, the five band regions this fix's expected literals are hand-typed from)
  - phase: 08-04
    provides: fjs/server/finance_tax_params/module.f.js (the tool and its defective content proof, found by a Phase 9 follow-up audit)
provides:
  - "fjs/server/finance_tax_params/module.f.js's year2025Resolves: a genuine content proof — every served field asserted against an independently hand-typed literal, never against response2025 (the same object the handler serializes)"
  - "asObject/field/asString/asNumber/asArray: local, cast-free helpers narrowing a JSON.parse'd unknown value field-by-field, used only within this module's proof"
  - "responseRoundTripsThroughJson: a JSON-encoding-stability check, explicitly labeled as NOT a content proof"
affects:
  - "fjs/server/finance_tax_params/module.f.js's response2025 and proof docstrings (corrected the wrong-intent guidance that caused the bug)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Independent-expected-value discipline: a proof's expected side must never be produced by the code under test (or by data that code also consumes to build its own answer) — duplication of hand-typed literals is the point of a content proof, not a smell to DRY away"
    - "Cast-free unknown narrowing: JSON.parse's result bound to a `@type {unknown}` local, then narrowed field-by-field via small assert-based helpers (asObject/field/asString/asNumber/asArray) built on Reflect.get (typed any, converts to unknown for free on assignment) rather than a type-cast over an indexed access"
    - "Mutation testing as the acceptance gate for a content proof: a fix to a tautological proof is verified by injecting the two known-blind mutations and confirming both now fail red, then reverting"

key-files:
  created:
    - .planning/phases/08-ty2025-parameters-and-the-tax-table-as-data/08-05-FIX-SUMMARY.md
  modified:
    - fjs/server/finance_tax_params/module.f.js

key-decisions:
  - "Rewrote year2025Resolves to parse the tool's JSON response once, then assert every field (taxYear, standardDeduction × 4 statuses + citation, agedOrBlindAdditional both keys asserted BY NAME + citation, dependentStandardDeductionCap × 2, ordinaryBrackets count + MFJ's first bracket, capitalGainsBreakpoints count + one concrete breakpoint, taxTableBandStructure length + every region's atLeast/lessThan/width) against a hand-typed literal taken directly from fjs/tax/params/module.f.js and fjs/tax/table/module.f.js — never from response2025 or any other value the code under test also produces."
  - "Used separate assertEq calls per field (not one aggregate JSON.stringify deep-equal) so a single wrong field names itself in a failure, matching this repo's existing per-field-assertion pattern (fjs/document/1099int/module.f.js, fjs/tax/table/module.f.js's rowByRowDiffMatchesPublishedTable)."
  - "Built four tiny local helpers (asObject, field, asString, asNumber, asArray) to narrow the JSON.parse'd unknown value without a type cast, a non-null assertion, or `any`, per this fix's standing directive (not written in AGENTS.md). field() reads via Reflect.get, whose TS return type is `any`; assigning that to a declared `unknown` return costs no cast, since `any` is assignable to every type including `unknown`. This differs from the rest of the codebase's own established pattern (`/** @type {T} */ (JSON.parse(...))`, used throughout fjs/server/fjs_run/module.f.js and fjs/server/module.f.js) — that pattern was explicitly excluded for this proof by the task's own hard constraint, not because it is wrong in general, but because a cast to the EXPECTED shape here would silently let TypeScript's structural typing paper over exactly the kind of content mismatch this proof exists to catch."
  - "Kept a JSON round-trip check (responseRoundTripsThroughJson) but renamed it from the deleted content-comparison and re-documented it as NOT a content proof — it only confirms JSON.stringify(JSON.parse(text)) === text, which every plain-data object satisfies trivially and says nothing about served-value correctness."
  - "Corrected response2025's and the proof's docstrings, which had explicitly instructed comparing the tool's output against 'this SAME constant... never a second, hand-typed literal' — the wrong-intent guidance that produced the original bug. Replaced with the correct rule (an expected value's worth is its independence from the code under test) and named both confirming mutations inline, so a future reader who is tempted to 'simplify' this back sees the cost first."

patterns-established:
  - "When a proof's docstring instructs the NEXT author to avoid duplication with the code under test's own output, that instruction is itself a defect to fix, not merely code to fix — leaving the wrong-intent comment in place invites the same mistake to be reintroduced later. Fix the comment in the same commit as the code."

requirements-completed: []

# Metrics
duration: ~1h
completed: 2026-08-05
---

# Phase 8 Plan 05: `finance_tax_params`'s Tautological Content Proof — Fix Summary

**`year2025Resolves` compared the tool's served JSON against `response2025` — the same object the production handler serializes it from — so it could never fail on content, only prove JSON round-trips; confirmed by two independent mutations that left `npm test` green. Rewritten to assert every served field against an independently hand-typed literal, narrowed from `JSON.parse`'s `unknown` output via small cast-free helpers, with the docstrings that encoded the wrong intent corrected in the same commit.**

## The Defect

`fjs/server/finance_tax_params/module.f.js`'s only content-correctness proof did this:

```js
assertEq(
    JSON.stringify(JSON.parse(textOf(result))),
    JSON.stringify(response2025),
)
```

`response2025` is exported from the same module and is exactly what `financeTaxParamsTool`'s handler serializes (`taxParamsResponses[2025]`, built from `response2025` itself). A proof comparing the handler's output against the same object it was built from can only ever demonstrate that `JSON.stringify`/`JSON.parse` round-trip a plain-data object without loss — a fact true of any well-formed JSON, unrelated to whether the served dollar figures, citations, or band structure are actually correct.

The module's own docstrings actively encoded this as the intended design: `response2025`'s comment instructed comparing against "this SAME constant, never a second, hand-typed literal," and `year2025Resolves`'s comment repeated the same guidance. That is the DRY instinct applied to a test's expected value, where it is exactly backwards — an expected value's entire worth is that it is *independent* of the code under test.

## Confirmed By Mutation (Before The Fix)

**Mutation 1 — drop the Tax Table's first band region:**

```js
// response2025, before:
taxTableBandStructure,
// mutated to:
taxTableBandStructure: taxTableBandStructure.slice(1),
```

This silently removes the entire `$0.00`–`$5.00` band region from what an agent is served.

- `npx tsc` — exit 0, no output (a genuine behavioral mutation, not a type error).
- `npm test` — **262/262 still passed.**

**Mutation 2 — swap `married`/`unmarried` in `agedOrBlindAdditional`:**

```js
// response2025, before:
agedOrBlindAdditional: taxParams2025.agedOrBlindAdditional,
// mutated to:
agedOrBlindAdditional: {
    married: taxParams2025.agedOrBlindAdditional.unmarried,
    unmarried: taxParams2025.agedOrBlindAdditional.married,
},
```

This serves an agent the wrong dollar figure for their filing status (`$2,000.00` for `married`, `$1,600.00` for `unmarried` — exactly reversed).

- `npx tsc` — exit 0, no output.
- `npm test` — **262/262 still passed.**

Both mutations confirm the diagnosis: the only accidental cover came from `fjs-run-integration.test.js`'s two literal substring checks (`'31500.00'`, `'2025-32'`), which happen to sit inside `standardDeduction` and were untouched by either mutation. `agedOrBlindAdditional`, `dependentStandardDeductionCap`, `ordinaryBrackets`, `capitalGainsBreakpoints`, and `taxTableBandStructure` had no coverage at all.

## The Fix

Rewrote `year2025Resolves` to parse the tool's JSON response exactly once, then assert every field against a hand-typed literal taken directly from `fjs/tax/params/module.f.js` and `fjs/tax/table/module.f.js` — never from `response2025` or any value the code under test also produces:

- `taxYear` — `2025`.
- `standardDeduction` — all four individual filing statuses' amounts (`$15,750.00` / `$31,500.00` / `$15,750.00` / `$23,625.00`), each asserted alongside its citation (`Rev. Proc. 2025-32 §3.01`, the OBBBA revision).
- `agedOrBlindAdditional` — `married` (`$1,600.00`) and `unmarried` (`$2,000.00`) asserted individually **by name**, so mutation 2's swap fails; each citation asserted as `Rev. Proc. 2024-40` alone (never "as modified by").
- `dependentStandardDeductionCap` — `minimum` (`$1,350.00`) and `earnedIncomeAddOn` (`$450.00`).
- `ordinaryBrackets` — the count of filing statuses (5: the four individual statuses plus `estatesAndTrusts`), and MFJ's first bracket (`10%`, ceiling `$23,850.00`) — the figure the whole Tax Table's low end depends on.
- `capitalGainsBreakpoints` — the count of statuses (5) and one concrete breakpoint (MFJ: `zeroRateMax` `$96,700.00`, `fifteenRateMax` `$600,050.00`).
- `taxTableBandStructure` — the length (**5**) and every region's own `atLeast`/`lessThan`/`width`, hand-typed from `fjs/tax/table/module.f.js`'s `taxTableBandStructure` — this is the exact field mutation 1 targets, and checking every region's own boundaries (not just the length) also catches a mutation that drops one region while duplicating another to preserve the count.

Each field is asserted with its own `assertEq` call (not one aggregate deep comparison), matching this repo's existing per-field-assertion convention (`fjs/document/1099int/module.f.js`, `fjs/tax/table/module.f.js`'s `rowByRowDiffMatchesPublishedTable`) — a single wrong field names itself in a failure rather than an opaque JSON-diff.

### Narrowing `unknown` Without A Cast

The task's standing directive for this fix forbids type casts over an indexed access, `any`, and non-null assertions — `JSON.parse`'s result is bound to a `@type {unknown}` local, then narrowed field-by-field via four small local helpers:

- `asObject(value, description)` — asserts `typeof value === 'object' && value !== null && !Array.isArray(value)`, narrowing `unknown` to `object` via `assert`'s `asserts v` signature.
- `field(value, key)` — reads a named field off an `object` via `Reflect.get`, whose TypeScript return type is `any`; assigning that `any` to this helper's declared `unknown` return costs no cast, since `any` converts to any type for free.
- `asString`/`asNumber`/`asArray` — the terminal narrows, each an `assert` on `typeof`/`Array.isArray`.

This differs from the rest of the codebase's own established pattern for parsed JSON (`/** @type {T} */ (JSON.parse(...))`, used throughout `fjs/server/fjs_run/module.f.js` and `fjs/server/module.f.js`) — that pattern was excluded here specifically because a cast to the *expected* shape would let TypeScript's structural typing quietly paper over the very kind of content mismatch this proof exists to catch.

### Docstring Correction

`response2025`'s docstring and `year2025Resolves`'s own comment both instructed the reader to compare against "this SAME constant... never a second, hand-typed literal" — the exact wrong-intent guidance that produced this bug. Both were rewritten to state the correct rule (an expected value's worth is its independence from the code under test) and to name both confirming mutations inline, so a future reader tempted to "simplify" this back to a single deep-equal sees the cost first.

### Round-Trip Check, Relabeled

The old `JSON.stringify(JSON.parse(text)) === JSON.stringify(response2025)` comparison is gone; a much narrower `responseRoundTripsThroughJson` leaf remains, asserting only `JSON.stringify(JSON.parse(text)) === text` — a genuine (if weak) encoding-stability check, explicitly documented as **not** a content proof.

## Confirmed By Mutation (After The Fix)

Both mutations were re-applied against the fixed code and re-verified, then reverted:

**Mutation 1 (`taxTableBandStructure.slice(1)`):**
```
✔ tsc — exit 0
✖ npm test — tests 263, pass 262, fail 1
  failing: import("./fjs/server/finance_tax_params/module.f.js").proof.year2025Resolves()
  [ 4, 5 ]
```
(`bandStructure.length` was `4`, expected `5`.)

**Mutation 2 (`married`/`unmarried` swap):**
```
✔ tsc — exit 0
✖ npm test — tests 263, pass 262, fail 1
  failing: import("./fjs/server/finance_tax_params/module.f.js").proof.year2025Resolves()
  [ '2000.00', '1600.00' ]
```
(`agedOrBlindAdditional.married.amount` was `'2000.00'`, expected `'1600.00'`.)

Both mutations now fail `npm test`, naming `year2025Resolves` directly. Reverting each restores a clean, all-green run.

## Verification Gate Results

- `npx tsc` — exits 0, no output, both before and after each mutation.
- `npm test` — exits 0, `tests 263, pass 263, fail 0` (up from 262 — one new leaf, `responseRoundTripsThroughJson`).
- `npm run test:integration` — exits 0, `tests 1, pass 1, fail 0`, unchanged.
- Honest metric — `node --test 2>&1 | grep -c '^✔ import("./fjs/'` = **261** (up from the pre-fix baseline of 260 — one new proof leaf added, consistent with the rewrite).
- `git status --porcelain` — clean after the fix commit, and clean again after each mutation's revert.
- `response2025`'s served content is byte-identical to before this fix; only the proof and its docstrings changed.

## Deviations from Plan

None — this is a gap fix executed exactly per the assigned scope (no PLAN.md; execution context specified the fix directly). No architectural change, no new dependency, no submodule pointer touched.

## Known Stubs

None — this is a proof-integrity fix to an already-shipped, already-correct tool; no new stubs introduced.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. `response2025`'s served content and the tool's behavior are unchanged; only the proof that verifies that content, and its docstrings, changed.

## Self-Check: PASSED

- `fjs/server/finance_tax_params/module.f.js` — FOUND, modified as described (proof rewritten, docstrings corrected).
- Commit `46f78a2` — FOUND in `git log --oneline`.
- Mutation A (`taxTableBandStructure.slice(1)`) — confirmed RED (`[ 4, 5 ]`), then reverted to a clean tree.
- Mutation B (`married`/`unmarried` swap) — confirmed RED (`[ '2000.00', '1600.00' ]`), then reverted to a clean tree.
- `npm test` — confirmed `tests 263, pass 263, fail 0`.
- `npm run test:integration` — confirmed `tests 1, pass 1, fail 0`.
- Honest metric — confirmed **261** via `node --test 2>&1 | grep -c '^✔ import("./fjs/'`.
- `git status --porcelain` — confirmed empty after the fix commit.
