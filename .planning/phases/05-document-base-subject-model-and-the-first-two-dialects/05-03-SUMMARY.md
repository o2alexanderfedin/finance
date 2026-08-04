---
phase: 05-document-base-subject-model-and-the-first-two-dialects
plan: 03
subsystem: document
tags: [conversion-boundary, doc-04, doc-11, tdd, mutation-testing, evo]

# Dependency graph
requires:
  - phase: 05-01
    provides: "fjs/document/subject/module.f.js — formSubject, the content-derived form subject"
  - phase: 05-02
    provides: "fjs/document/ocr/module.f.js (Ocr, fields map) and fjs/document/1099int/module.f.js (schema, validate)"
  - phase: 04
    provides: "fjs/exact (centsScale, centsFromString, centsToString) over fjs/types/decimal's generic parse/format"
provides:
  - "fjs/document/ocr_amount/module.f.js — parseOcrAmount(scale)(printed) and parseOptionalOcrAmount(scale)(printed|undefined): the ONE printed-string-to-cents boundary, comma-grouping aware"
  - "fjs/document/1099int/from_ocr/module.f.js — convert(ocr, meta) -> OneZeroNineNineInt, plus the Success-Criterion-3 and Criterion-4 proof leaves"
affects: [06, 08, 11, 12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Locale/presentation normalization lives OUTSIDE the module staged for upstreaming. fjs/types/decimal keeps refusing '1,234.56'; fjs/document/ocr_amount degroups one step above it and hands the canonical string down. The generic parser never learns a US convention."
    - "Absence-preserving wrapper at the primitive level (parseOptionalOcrAmount): undefined in, undefined out, never 0n — so every future dialect inherits DOC-11 rather than re-deriving it."
    - "Money conversion is one chain with no second entry point: printed -> bigint cents (exactness check) -> canonical decimal string (what is stored). The bigint never reaches storage; the string is what the option(string) schema holds."
    - "Object construction under exactOptionalPropertyTypes uses conditional spread (`...(x === undefined ? {} : { k: x })`), never assignment of an undefined value — `{k: undefined}` and an omitted `k` are different types, and only the former survives `in`."

key-files:
  created:
    - fjs/document/ocr_amount/module.f.js
    - fjs/document/1099int/from_ocr/module.f.js
  modified: []

key-decisions:
  - "The degrouping regex is factored into a named `groupingComma` const rather than written inline at the call site. The plan's <verify> gate greps for the literal inline form `replace(/(\\d),(?=\\d)/g, '$1')`; the shipped code satisfies the gate's INTENT (verified by two greps: the regex literal at line 45, the '$1' replacement at line 55, and a negative grep confirming no empty-string replacement exists anywhere in the file) but not its literal text. Naming the regex is where the explanation of WHY '$1' matters belongs."
  - "convert takes two positional arguments `(ocr, meta)` as the plan specifies, rather than being curried like the rest of the repo. The two arguments are co-equal inputs to one conversion, neither of which is a configuration parameter the other is partially applied against — currying here would imply a reuse that does not exist."
  - "Identity fields come from `meta`, never re-parsed from `ocr.fields`. Deriving a TIN or a tax year from unstructured OCR text is inference, and this phase stores and reads — it does not calculate. Only the six money boxes are read from the label map."
  - "The same-subject proof (Criterion 4 leaf 1) runs against the real fjs/cas/evo through the `virtual` interpreter, mirroring fjs's own evo/proof.f.js idiom, rather than re-deriving the subject string twice. Whether a second ingestion advances one history or forks a parallel one is a question only Evo can answer; string equality cannot."

patterns-established:
  - "Mutation testing as the acceptance step, not an afterthought: every guarantee this plan claims was broken deliberately and the failure count recorded. A guarantee whose mutation fails nothing is decorative."

requirements-completed: [DOC-04, DOC-11]

# Metrics
duration: ~35min
completed: 2026-08-04
---

# Phase 05 Plan 03: The OCR-to-Typed Conversion Boundary Summary

**The one place a printed OCR amount becomes exact cents, and the conversion that carries a full `vnd.fjs.ocr` transcription into a typed `vnd.fjs.1099int` document — with Success Criterion 3 and all four independent facts of Criterion 4 each pinned by a proof leaf that was verified by breaking it.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-04
- **Tasks:** 3/3 completed
- **Files created:** 2
- **Tests:** 67 → 82 pass, 0 fail; `npx tsc --noEmit` clean

## Accomplishments

- **`fjs/document/ocr_amount/module.f.js`** — `parseOcrAmount` degroups (`/(\d),(?=\d)/g` → `'$1'`) and delegates to `fjs/types/decimal`'s generic `parse`. A comma with a digit on only one side (`',1234'`, `'1234,'`) is not matched, survives into the parser, and is refused there: malformed input is never silently repaired into something parseable. `parseOptionalOcrAmount` is the absence-preserving wrapper — DOC-11 at the primitive level, available to every future dialect.
- **`fjs/document/1099int/from_ocr/module.f.js`** — `convert(ocr, meta)` maps six printed box labels onto the schema's six `option(string)` boxes through a single loop over a `[label, field]` pair table (DRY, not six branches), building the output with conditional spreads so an unprinted box's key is genuinely absent.
- **Success Criterion 3, end-to-end:** `{'Box 1 Interest income': '1,234.56'}` → `box1InterestIncome === '1234.56'`, and the leaf additionally asserts `centsFromString` of that stored string is `123456n` — so the leaf fails if either the canonical string or its numeric meaning ever drifts.
- **Success Criterion 4, four separate leaves:** same-form-same-subject (via real Evo), blank-is-absent-not-zero, form-revision-carried-and-distinct-from-tax-year, `CORRECTED`-readable-with-absence-as-the-only-negative.

## Evidence: every guarantee was broken deliberately

| Mutation | Result |
|---|---|
| Replacement group `'$1'` → `''` | **fail 3** — exactly the three grouped-comma leaves. Replacing the whole match deletes the leading digit with the comma: `'1,234.56'` → `'234.56'` → `23456n`, a silent 10× error. |
| Blank box falls back to `'0.00'` | **fail 1** — `blankBoxIsAbsentNotZero` only. The neighbouring present box still passed, confirming the failure is specific to absence handling, not a conversion that dropped everything. |
| `corrected` always emitted (`...{ corrected: meta.corrected }`) | **fail 1** — `uncheckedBoxOmitsTheKeyEntirely`. |
| Second Evo `add` re-pointed to `parents: []` | **fail 1** — `sameFormResolvesToOneSubject`, confirming `heads.length === 1` is load-bearing rather than vacuously true. |

## The finding worth carrying forward

**`exactOptionalPropertyTypes` does not catch a spread that carries `undefined`.** The `corrected` mutation above — `...{ corrected: meta.corrected }`, where `meta.corrected` is `true | undefined` — passed `npx tsc --noEmit` cleanly and was caught only by the runtime proof. The key was present with an `undefined` value, which `'corrected' in result` sees and the type system did not object to.

This matters beyond this one field: the conditional-spread pattern used throughout `convert` is not merely stylistic tidiness that the compiler would have enforced anyway. It is the only thing standing between an absent key and a present-but-undefined one, and the compiler will not tell you when it slips. Every `option(...)` field in every future dialect conversion depends on the same discipline, with the same absence of a compiler backstop.

## Deviations

- **The plan's `<verify>` gate 2 is unsatisfiable as literally written.** It requires that no file under `fjs/document/` outside `1099int/module.f.js` and `ocr_amount/module.f.js` mention `centsFromString` — but Task 2's own acceptance criteria explicitly require the Criterion-3 leaf to call `centsFromString` on the stored string to pin its numeric meaning. The two instructions contradict each other; the more specific one (the acceptance criterion) was followed. The gate's substantive property was verified directly instead: the only printed-string-to-cents parse in production code is `fjs/document/1099int/from_ocr/module.f.js:98`, via `parseOptionalOcrAmount`. The two other `centsFromString` references are a proof assertion (line 162) and Plan 05-02's validator re-parse — neither is a second conversion path.
- **Gate 1's literal grep** does not match, because the regex is a named const rather than inline. Verified by three greps against intent instead (regex literal present, `'$1'` replacement present, no empty-string replacement anywhere).

## Requirements Completed

- **DOC-04** — the OCR→typed conversion, on exactly one revision boundary.
- **DOC-11** — blank is not zero, enforced at the primitive (`parseOptionalOcrAmount`) and at the conversion (absent key), mutation-verified at both.
