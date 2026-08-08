---
phase: 12-brokerage-documents-and-the-capital-gain-chain
verified: 2026-08-07T00:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 12: Brokerage Documents Verification Report

**Phase Goal:** Every brokerage document the declared profile produces can be stored and read.
**Verified:** 2026-08-07
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (the four ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `vnd.fjs.1099div` stores the full printed box list, and a proof shows box 1b's value has exactly the shape the already-shipped QDCGT worksheet consumes — shape assertion, not wiring | ✓ VERIFIED | `fjs/document/1099div/module.f.js` schema carries all 19 printed boxes (1a–13, both checkboxes, state/local group). `proof.qdcgtInputShape` (line 518) annotates the converted value `/** @type {QdcgtInput['line2Cents']} */` (compile-time-only `tsc` check, imported only via a top-level `@import` JSDoc comment, line 90) and asserts `line2Cents === 50000n` at runtime. Confirmed by grep: **no runtime import** of `dispatchLine16`, `classifyScope`, or `form1040IncomeLines` anywhere in the file — the only match for `fjs/tax` is inside a docstring sentence stating the fact, not an import statement. TAX-08 (`fjs/tax/line16/qdcgt/module.f.js`) is untouched (confirmed by the boundary diff below). |
| 2 | `vnd.fjs.1099b` distinguishes a blank box 1e from zero, proven by a case where treating it as zero **changes the gain** | ✓ VERIFIED | `fjs/document/1099b/module.f.js:570-611`, `criterion2GainConsequence`: computes `naiveGain('10000.00')(withBasis.box1eCostOrOtherBasis)` = `400000n` ($4,000.00) vs. `naiveGain('10000.00')(withoutBasis.box1eCostOrOtherBasis)` = `1000000n` ($10,000.00), and asserts `withBasisGain !== withoutBasisGain`. The absent case first asserts `box1eCostOrOtherBasis === undefined` (genuine absence, not a `'0.00'` sentinel). This is a consequence proof, not merely an optionality proof. |
| 3 | One consolidated PDF yields N typed documents with N subjects sharing one artifact hash | ✓ VERIFIED | `fjs/document/consolidated_provenance/module.f.js`, `oneArtifactYieldsTwoSubjectsSharingProvenance`: validates a real `vnd.fjs.1099div` and a real `vnd.fjs.1099b` instance sharing `sharedSourceArtifactHash`, derives `divSubject`/`bSubject` via the pre-existing `formSubject` (unmodified this phase), asserts they are distinct, and asserts `divInstance.sourceArtifactHash === bInstance.sourceArtifactHash`. A control leaf, `differentArtifactsDoNotShareProvenance`, proves the hash-equality half is non-vacuous (a third instance with a genuinely different hash does not equal the shared one). The subject-distinctness half rests on `formSubject`'s pre-existing, independently-tested `formType`-keyed behavior (`fjs/document/subject/module.f.js`), which the code reviewer separately mutation-tested and confirmed load-bearing — this module correctly does not re-test that pre-existing mechanism, only demonstrates it holds for the two new real dialects, matching 12-CONTEXT.md's stated DOC-13 scope ("modeling and subject derivation only"). |
| 4 | Schedule B applies the $1,500 threshold separately to interest and to dividends (two independent tests), and reads foreign-account answers from the taxpayer-declared profile | ✓ VERIFIED | `fjs/schedule/b/module.f.js:214-215` computes `interestOverThreshold`/`dividendsOverThreshold` as two independent `line4.value > scheduleBThresholdCents` / `line6.value > scheduleBThresholdCents` comparisons — never a combined sum. `proof.thresholds.combinedButIndividuallyUnderThresholdTriggersNeither` (line 346) is the discriminating test: $1,000 interest + $1,000 dividends (combined $2,000, over $1,500 combined) trips **neither** flag. Six boundary leaves (`$1,499.99`/`$1,500.00`/`$1,500.01`, both categories) confirm the strict `>` operator. Foreign-account fields (`hadForeignFinancialAccount`, `requiredToFileFinCen114`, `foreignAccountCountries`, `receivedForeignTrustDistributionOrWasGrantorOrTransferor`) are read verbatim from `Stored<ReturnProfile>.value` (lines 217-221), proven with **zero stored documents** in `foreignAccountFields.readVerbatimNeverInferredFromZeroStoredDocuments`. |

**Score:** 4/4 truths verified

### The Phase Boundary (git diff, not prose)

```
git diff e3f405e HEAD --stat -- fjs/return/scope/module.f.js fjs/form1040/core/module.f.js fjs/tax/
```
Ran independently: **empty output**, confirming this phase did not touch the modeled/unmodeled
partition, Form 1040 lines 3a/3b, the hardcoded `qualifiedDividendsCents: 0n`, or anything under
`fjs/tax/`.

Full change-set diff (`git diff e3f405e HEAD --stat`) confirms the complete touched set is exactly:
`fjs/document/1099b/`, `fjs/document/1099div/`, `fjs/document/consolidated_provenance/`,
`fjs/return/profile/`, `fjs/schedule/b/`, `fjs/server/finance_schema/`, plus planning docs and
`CHANGELOG.md` — no surprise files.

**The one granted exception** — additive foreign-account fields on `fjs/return/profile/module.f.js`
— confirmed genuinely additive: `kindVocabulary` (the modeled/unmodeled partition's input list) is
untouched at 50 entries (`kindVocabularyIsExactlyFifty` still asserts `expectedKindCount = 50`), and
the four new fields (`hadForeignFinancialAccount`, `requiredToFileFinCen114`,
`foreignAccountCountries`, `receivedForeignTrustDistributionOrWasGrantorOrTransferor`) are appended
to `returnProfileSchema` with no change to `checkReferences`'s existing seven-step order (verified by
reading the file — the `foreignAccountFields` proof block is additive, and
`fullyPopulatedWithForeignAccountFieldsValidates` is a sibling leaf, not an edit to the pre-existing
`fullyPopulatedValidates`).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `fjs/document/1099div/module.f.js` | `vnd.fjs.1099div` dialect, full box list, QDCGT shape proof | ✓ VERIFIED | 525 lines; 19 boxes + 2 checkboxes + state/local group; `moneyBoxFields` count 17, `everyMoneyBoxIsCovered` hand-typed pair present |
| `fjs/document/1099b/module.f.js` | `vnd.fjs.1099b` dialect, full box list, box 1e/12 independence, DOC-07 consequence proof | ✓ VERIFIED | 636 lines; `moneyBoxFields` count 10, `criterion2GainConsequence` present and non-vacuous |
| `fjs/document/consolidated_provenance/module.f.js` | DOC-13 proof-only module | ✓ VERIFIED | 154 lines, exports only `proof`, no production code (confirmed no `dialect`/schema export) |
| `fjs/schedule/b/module.f.js` | `scheduleB` pure function, Part I/II/III | ✓ VERIFIED | 537 lines; standalone, not wired into Form 1040 aggregation (confirmed no runtime import of `fjs/tax/`, `fjs/return/scope`, `fjs/form1040/`) |
| `fjs/return/profile/module.f.js` (additive) | four new foreign-account fields | ✓ VERIFIED | additive only; `kindVocabulary` unchanged at 50 |
| `fjs/server/finance_schema/module.f.js` | 7→9 dialect registration | ✓ VERIFIED | `expectedKnownDialectCount = 9`, both `oneZeroNineNineDivResolves`/`oneZeroNineNineBResolves` leaves present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `1099div/checkReferences` | `money_field.moneyFieldError` | per-box loop | WIRED | confirmed at line 244 |
| `1099div/checkReferences` | `revision.isHash` | `sourceArtifactHash` check | WIRED | confirmed at line 236 |
| `1099b/checkReferences` | `money_field.moneyFieldError` | per-box loop | WIRED | confirmed at line 274 |
| `schedule/b` | `1099int`/`1099div` box fields | `sumBoxOverDocuments` | WIRED | lines 199-210, box names match dialect schemas exactly |
| `schedule/b` | `return/profile` foreign-account fields | verbatim read | WIRED | lines 217-221, `=== true` guards, no inference |
| `finance_schema.dialectSchemas` | `1099div`/`1099b` schema exports | map entries | WIRED | lines 85-86, both `*Resolves` proofs round-trip against `toJsonSchema` of the real schema const |

### Mutation Gate Evidence (independently confirmed, not re-run per phase instructions)

| Gate | Mutation | Recorded result | Independently corroborated by |
|------|----------|------------------|-------------------------------|
| M1 | Remove a `moneyBoxFields` entry, leave hand count unchanged | RED (`16 !== 17`) | Code review independently re-ran an equivalent mutation (removed `box7ForeignTaxPaid`) and confirmed `everyMoneyBoxIsCovered` catches it |
| M2 | `expectedKnownDialectCount = 8` after registering both dialects | RED (`[9,8,...]`), `unknownDialectRefused` stays green | Docstring at `finance_schema/module.f.js:100-104` states the verified mechanism and cites the exact prior (11-phase) precedent mutation |
| M3 | Treat blank box 1e as `'0.00'` | RED (DOC-07 fixture assertion) | Confirmed by reading `criterion2GainConsequence`'s structure: the assertion directly compares two gains computed from the identical formula, and would be trivially defeated only by re-writing the proof itself, not by an incidental code path |
| WR-01 (code review) | Widen `requiredToFileFinCen114` from `option(true)` to `option(boolean)` | Was NOT caught pre-fix; fix verified — now reddens `eachCheckboxRejectsFalse` | Read `return/profile/module.f.js:684-703`: the fix (asserting `false`-rejection for all three DOC-12 checkboxes, including `requiredToFileFinCen114` at line 701) is present and matches the reviewer's prescribed fix exactly, with an inline comment recording why |

### Independently-run checks (this verification pass)

| Check | Command | Result |
|-------|---------|--------|
| Typecheck | `npx tsc --noEmit` | exit 0, no errors |
| Full suite | `node --test` | `tests 2867, pass 2867, fail 0` |
| Project-local proof count | `node --test 2>&1 \| grep -c '^✔ import("./fjs/'` | `629` (baseline 544, phase gate required "risen from 544" — met) |
| Boundary diff | `git diff e3f405e HEAD --stat -- fjs/return/scope/module.f.js fjs/form1040/core/module.f.js fjs/tax/` | empty |
| Debt markers | `grep -n "TBD\|FIXME\|XXX"` across the six touched files | none found |
| Working tree | `git status --short` | clean |

### Source Honesty (be-skeptical item 5)

- `fjs/document/1099div/module.f.js` docstring names `https://www.irs.gov/pub/irs-pdf/f1099div.pdf`
  (Rev. January 2024, continuous-use form — no revision-drift risk recorded, and correctly so per the
  instructions text quoted).
- `fjs/document/1099b/module.f.js` docstring records **three** URLs, including the finding that the
  canonical un-suffixed `f1099b.pdf` now 404s, and that only the TY2025-suffixed
  `f1099b--2025.pdf` resolves — recorded plainly, not silently worked around, exactly as
  12-CONTEXT.md's specifics section demanded.
- `CHANGELOG.md`'s "Unverified against paper" section still lists exactly **three** items (the 1040
  face inventory, the standard-deduction chart, and the Tax Computation Worksheet cent-exactness
  question) — Phase 12 did not add a fourth, confirmed by diff (`git diff e3f405e HEAD -- CHANGELOG.md`
  shows only the two pre-existing documentation-defect entries updated, not the unverified-claims list).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| DOC-06 | 12-01 | `vnd.fjs.1099div` | ✓ SATISFIED | Full schema, QDCGT shape proof, `[x]` in REQUIREMENTS.md |
| DOC-07 | 12-02 | `vnd.fjs.1099b`, blank-1e-vs-zero distinction | ✓ SATISFIED | `criterion2GainConsequence`, `[x]` in REQUIREMENTS.md |
| DOC-13 | 12-05 | Consolidated 1099 → N documents, N subjects, shared hash | ✓ SATISFIED | `consolidated_provenance` proof, `[x]` in REQUIREMENTS.md |
| TAX-07 | 12-03, 12-04 | Schedule B, $1,500 threshold, foreign-account questions | ✓ SATISFIED | `fjs/schedule/b/module.f.js`, `[x]` in REQUIREMENTS.md |

No orphaned requirements: ROADMAP.md's Phase 12 `Requirements:` line lists exactly these four, and
every plan's frontmatter requirement matches. The REQUIREMENTS.md bottom Traceability table still
shows these rows as "Week 3 / Pending" — this is the pre-existing, project-wide staleness the
CONTEXT/task instructions already flag as Phase 17's sweep to fix, not a Phase 12 gap.

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers, no empty-implementation stubs, no
hardcoded-empty return values, no unguarded conditional spreads (checked: every optional-field spread
uses `...(x === undefined ? {} : { k: x })`), no `any`/cast-over-indexed-access/non-null-assertion in
any of the six touched files.

### Human Verification Required

None. The three "Manual-Only Verifications" listed in 12-VALIDATION.md (1099-DIV box inventory,
1099-B box inventory, Schedule B line structure) are source-provenance checks against IRS PDFs — each
module's docstring already names and records its exact source URL, satisfying the validation plan's
own bar ("an honest 'COULD NOT FETCH — unverified' beats a confident list with no provenance"); no
open item remains that requires a human to act on beyond what is already recorded as inherent
project-wide unverified-against-paper risk (three items, unchanged).

### Gaps Summary

No gaps. All four ROADMAP success criteria hold under direct code inspection, not SUMMARY narrative:
criterion 1 is a genuine shape-only assertion (no runtime coupling to `fjs/tax/`, `fjs/return/`, or
`fjs/form1040/`); criterion 2's proof exhibits an actual changed dollar figure, not merely an optional
field; criterion 3's shared-hash assertion has a working control and its subject-distinctness half
correctly rests on pre-existing, separately mutation-tested machinery; criterion 4's two threshold
tests are independently proven not to combine, with a discriminating $1,000/$1,000 fixture. The
phase boundary (no touch to `fjs/return/scope`, `fjs/form1040/core`, or `fjs/tax/`) is confirmed by an
independently-run `git diff --stat`, not by trusting the SUMMARY's claim of the same. The one
previously-open review warning (WR-01) is fixed and the fix is present in the shipped file. The
suite is green (2867/2867), the typecheck is clean, and the project-local proof count rose from 544
to 629.

---

_Verified: 2026-08-07_
_Verifier: Claude (gsd-verifier)_
