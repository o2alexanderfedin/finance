---
phase: 10-form-1040-core-line-16-dispatch-and-the-scope-guard
plan: 04
subsystem: document-dialects
tags: [rtti, dialect, return-profile, declared-kinds, scope-guard-input, mcp-schema, standard-deduction]

requires:
  - phase: 10-01
    provides: "individualFilingStatuses (five members, QSS included) and taxParamsByYear, both read rather than restated"
  - phase: 05
    provides: "fjs/document/base (base, mediaTypeOf), the four-stage dialect template, fjs/document/money_field"
  - phase: 07
    provides: "fjs/server/finance_schema's dialectSchemas registry and its round-trip proof shape"
provides:
  - "vnd.fjs.return_profile — the taxpayer-DECLARED return profile dialect"
  - "kindVocabulary — the frozen 50-member vocabulary of declarable income/deduction/credit/payment kinds, in 1040 form order, plus the `Kind` typedef Plan 10-07 will pin at tsc level"
  - "Seven semantic ingest checks, each refusing by name: filing status, tax year, dependent count, kind membership + duplicates, spouse boxes for the three spouseless statuses, the MFS conditional-box gate, money exactness, and the amount-without-a-declared-kind cross-check"
  - "A real CAS document for line 12e to cite, so ReportLine.sources' non-empty tuple is satisfiable without widening the Phase 9 type"
  - "The dialect served by finance_schema, plus a hand-typed dialect count that the unknown-dialect refusal loop cannot supply itself"
affects: [10-06, 10-07, 10-08, 10-09, 10-10, phase-11, phase-12, phase-13]

tech-stack:
  added: []
  patterns:
    - "Widening ASSIGNMENT (not a cast) from a `@type {const}` literal tuple to `readonly string[]`, so a check can ask a membership question about an untrusted `string`"
    - "A frozen vocabulary carried as a `@type {const}` array plus a `typeof x[number]` typedef, awaiting a tsc-level exhaustiveness assertion in a later plan"
    - "A conditional-entitlement gate expressed as a required taxpayer ASSERTION field, because the engine cannot observe the fact itself"

key-files:
  created:
    - fjs/return/profile/module.f.js
  modified:
    - fjs/server/finance_schema/module.f.js

key-decisions:
  - "Every checkbox is option(true), never a two-valued primitive — an unchecked box is the key's ABSENCE, and `spouseIsBlind: false` is rejected structurally (DOC-12)"
  - "Every money box is option(string), re-parsed through the shared money_field check (AGENTS.md)"
  - "No formRevision field: DOC-10 describes printed forms whose box semantics drift between revisions; this dialect's versioning is its own tag"
  - "Check 5b makes the married-filing-separately spouse boxes conditional on a named taxpayer assertion — up to $3,200 of standard deduction turns on it"
  - "finance_schema's unknownDialectRefused does NOT cover a newly registered dialect 'for free'; its iteration set is the code under test, so a hand-typed count was added (deviation Rule 1)"

patterns-established:
  - "Pattern: a semantic check ordered most-fundamental-first, so a blob failing several reports the cause rather than a downstream symptom"
  - "Pattern: a generated per-field proof whose fixture is chosen so the assertion cannot be satisfied by an unrelated check firing first"

requirements-completed: [TAX-16, TAX-05, TAX-06]

duration: 62min
completed: 2026-08-06
---

# Phase 10 Plan 04: the `vnd.fjs.return_profile` Dialect Summary

**A taxpayer-declared return profile — filing status, the line 12a–12d checkboxes, a dependent count and a frozen 50-kind vocabulary — validated through seven named refusals, so the TAX-16 scope guard has a declaration to compare against instead of a store whose silence is ambiguous.**

## Performance

- **Duration:** ~62 min
- **Tasks:** 2 of 2
- **Files modified:** 2 (1 created, 1 modified)
- **Commits:** `7795cc2`, `2dc3925`

## Leaf counts

Measured with `node --test 2>&1 | grep -c '^✔ import("./fjs/…'`, never with `npm test`'s
total (AGENTS.md: it carries ~2,100 vendored submodule proofs).

| Scope | Before this plan | After |
|---|---|---|
| project-local (`^✔ import("./fjs/`) | 334 | 406 |
| `fjs/return/profile` | 0 (module did not exist) | **28** |
| `fjs/server/finance_schema` | 5 | **7** |

**This plan contributed 30 leaves.** The project-local total moved by 72 because two sibling
executors (10-03, 10-05) committed into the same branch while this plan ran; their leaves are
not mine and the per-module columns are the honest measure. Plan verification asked for "+16
from this plan's recorded starting point" — 30, met.

`npm test`: **408 tests, 408 pass, 0 fail, exit 0.**

## Measuring under two concurrent executors

`npm test` is `tsc && node --test` and **`tsc` is repo-wide**, so a sibling's in-flight file
turns this plan's gate red for reasons unrelated to it. That happened twice and was observed
directly:

```
✖ import("./fjs/tax/table/module.f.js").proof.qualifyingSurvivingSpouseReadsTheMarriedFilingJointlyColumn()
fjs/tax/deduction/module.f.js(212,75): error TS6133: 'dualStatusAlien' is declared but its value is never read.
```

Neither file is in this plan's `files_modified`. AGENTS.md's warning is exact — a red you did
not cause, recorded as evidence, confirms a mutation that never worked.

So every gated command in this plan ran against a snapshot built as:

```
git archive HEAD | tar -x -C /tmp/snap-1004     # last COMMITTED state — green
ln -s <worktree>/node_modules /tmp/snap-1004/node_modules
cp <worktree>/fjs/return/profile/module.f.js  /tmp/snap-1004/fjs/return/profile/
( cd /tmp/snap-1004 && npm test )
```

`git archive` emits no `.git` directory at all, so no git command run inside the snapshot can
write to the real repo — the hazard the `cp -a` recipe carries. **Every mutation edit and every
`git diff --numstat` was performed on the real tracked file**; only the gated command ran on the
snapshot. Because the new module is untracked at HEAD until its commit, `--numstat` was taken as
`git diff --numstat --no-index <pristine-copy> <real file>`, which is read-only.

## Accomplishments

### Task 1 — `fjs/return/profile/module.f.js` (`7795cc2`)

The four-stage template `fjs/document/1099int` establishes, followed exactly: `dialect` ->
`mediaType` (derived by `mediaTypeOf`, never hand-written) -> `returnProfileSchema` ->
structural `validateShape` -> semantic `checkReferences` -> composed `validate`.

`kindVocabulary` — 50 members in 1040 form order, each with its line in a trailing comment so a
reviewer diffs it against the printed face rather than against memory — plus
`@typedef {typeof kindVocabulary[number]} Kind`, which Plan 10-07 will pin at `tsc` level.

Seven checks, in a fixed order so a blob failing several reports the most fundamental first:

1. `filingStatus` is a member of `individualFilingStatuses` — **read from `fjs/tax/params`, not
   restated**, so a status this dialect accepts but that module has no parameters for cannot exist.
2. `taxYear` is a whole year with a stored `taxParamsByYear` entry. The lookup is bound to a
   local and compared against `undefined` — `noUncheckedIndexedAccess` makes that `undefined`
   real. No cast, no `!`.
3. `dependentCount` is a non-negative whole count.
4. Every declared kind is in the vocabulary (refusal names the kind AND the known set, mirroring
   `finance_schema`'s unknown-dialect refusal) and appears once. A repeat is refused rather than
   deduplicated: silently collapsing it would make "declared once" and "declared twice"
   indistinguishable to the guard's later set comparison.
5. `'single'`, `'headOfHousehold'` and `'qualifyingSurvivingSpouse'` may check no spouse box —
   `[i1040gi p33]` "Don't check any boxes for your spouse if your filing status is head of
   household"; single has no spouse and a QSS filer's spouse is deceased. These are exactly the
   three statuses the 1040-SR chart caps at two boxes.
6. **5b — the money gate.** See below.
7. Every present money box passes `moneyFieldError`, walked over a `moneyBoxFields` list so the
   exactness re-parse is written once; and a present `line26EstimatedTaxPayments` requires
   `'estimatedTaxPayments'` in `declaredKinds`.

### Check 5b — the $3,200 gate

`[i1040gi p33 / f1040s.pdf p4 footnote, recorded in 10-CONTEXT.md]` — a married-filing-separately
filer may check the two SPOUSE age/blindness boxes only "if your spouse had no income, isn't
filing a return, and can't be claimed as a dependent on another person's return." MFS reaches
four boxes at $1,600 each, so quoting that footnote in a comment and then accepting both spouse
boxes unconditionally hands an MFS return **up to $3,200** of standard deduction it may not be
entitled to, silently.

The refusal names `spouseHadNoIncomeIsNotFilingAndIsNotADependent` and is paired with its
control. The flag is a taxpayer ASSERTION, not a derivation — this engine cannot observe a
spouse's income or filing behaviour, so it records that the taxpayer claimed the condition, which
is what makes the resulting deduction attributable to a declaration rather than an assumption.

### Task 2 — registration in `finance_schema` (`2dc3925`)

Fifth entry in `dialectSchemas`, plus a `returnProfileResolves` leaf comparing the served text
(JSON-parsed, re-stringified) against `JSON.stringify(toJsonSchema(returnProfileSchema))` —
never a hand-written JSON literal, which is the second source of truth MCP-06 exists to
eliminate. Module docstring updated from four known dialects to five.

## TDD gate compliance

Task 1 carries `tdd="true"`. **The RED phase was executed and observed, but was NOT committed as
a separate `test(10-04): …` commit.** Reason: two sibling executors were running `npm test` in
this same checkout throughout, and publishing a knowingly-red HEAD would have handed them exactly
the false evidence AGENTS.md's "Concurrent work invalidates a mutation observation" section warns
about — a red they did not cause, recorded as a mutation confirmation. The single `feat` commit
is the deviation; the RED evidence is below, and the five mutations that follow are stronger
falsification than the RED gate is.

**RED transcript** — the module written with the full schema, the full 28-leaf proof, and
`checkReferences = r => ok(r)` (no semantic checks). `tsc` clean; `node --test`:

```
✔ …proof.dialectAndMediaType()
✔ …proof.kindVocabularyIsExactlyFifty()
✔ …proof.validate.minimalValidates()
✔ …proof.validate.twoDeclaredKindsValidate()
✔ …proof.validate.fullyPopulatedValidates()
✔ …proof.validate.wrongDialectRejected()
✖ …proof.checkReferences.filingStatus.unknownFilingStatusRefusedByName()
✔ …proof.checkReferences.filingStatus.everyStoredFilingStatusAccepted()
✖ …proof.checkReferences.taxYear.unsupportedYearRefused()
✖ …proof.checkReferences.dependentCount.negativeRefused()
✖ …proof.checkReferences.dependentCount.fractionalRefused()
✖ …proof.checkReferences.declaredKinds.unknownKindRefusedNamingItAndTheVocabulary()
✖ …proof.checkReferences.declaredKinds.duplicateKindRefused()
✖ …proof.checkReferences.spouseBoxes.headOfHouseholdSpouseBlindRefused()
✔ …proof.checkReferences.spouseBoxes.marriedFilingJointlySpouseBlindAccepted()
✖ …proof.checkReferences.spouseBoxes.singleSpouseBornBeforeRefused()
✖ …proof.checkReferences.spouseBoxes.qualifyingSurvivingSpouseSpouseBlindRefused()
✖ …proof.checkReferences.spouseBoxes.marriedFilingSeparatelySpouseBoxWithoutConditionRefused()
✔ …proof.checkReferences.spouseBoxes.marriedFilingSeparatelySpouseBoxWithConditionAccepted()
✔ …proof.checkReferences.spouseBoxes.conditionFlagWithoutSpouseBoxesAccepted()
✖ …proof.checkReferences.moneyBoxExactness.earnedIncome()
✖ …proof.checkReferences.moneyBoxExactness.line26EstimatedTaxPayments()
✖ …proof.checkReferences.moneyBoxExactness.line35aRefundRequested()
✖ …proof.checkReferences.moneyBoxExactness.line36AppliedToNextYear()
✔ …proof.checkReferences.moneyBoxExactness.everyMoneyBoxIsCovered()
✖ …proof.checkReferences.crossField.estimatedPaymentWithoutDeclaredKindRefused()
✔ …proof.checkReferences.crossField.estimatedPaymentWithDeclaredKindAccepted()
✔ …proof.crossDialect.oneZeroNineNineIntShapeRejectedByReturnProfile()

ℹ tests 392   ℹ pass 377   ℹ fail 15
```

Every "…Refused" leaf red, every control leg ("…Accepted") green — which is the right signature
for a stub that accepts everything, and confirms the controls are not passing by accident.

## Mutations — all six run one at a time, reverted, actual output recorded

Each was applied to the real tracked file and verified with `git diff --numstat`. Every one
typechecked (`tsc` exit 0); none hit the wave-1 `noUnusedLocals` trap.

### Task 1, mutation 1 — kind membership always passes

`if (!kindNames.includes(kind))` -> `if (!true)`. `numstat: 1 1`. **tsc exit 0.**

```
✖ import("./fjs/return/profile/module.f.js").proof.checkReferences.declaredKinds.unknownKindRefusedNamingItAndTheVocabulary()
ℹ tests 395   ℹ pass 394   ℹ fail 1
```

Predicted: RED on the `dogecoin` leaf. **Observed exactly that.** Note `if (!true)` does not trip
`allowUnreachableCode: false` — TypeScript exempts `if` bodies.

### Task 1, mutation 2 — HoH swapped for MFJ in the spouseless list

`['single', 'headOfHousehold', 'qualifyingSurvivingSpouse']` ->
`['single', 'marriedFilingJointly', 'qualifyingSurvivingSpouse']`. `numstat: 1 1`. **tsc exit 0.**

```
✖ …proof.checkReferences.spouseBoxes.headOfHouseholdSpouseBlindRefused()
✖ …proof.checkReferences.spouseBoxes.marriedFilingJointlySpouseBlindAccepted()
✖ …proof.validate.fullyPopulatedValidates()
ℹ tests 395   ℹ pass 392   ℹ fail 3
```

Predicted: RED on BOTH the HoH refusal leaf and the MFJ control leaf, or the control leg is
missing. **Observed both, plus `fullyPopulatedValidates`** (an MFJ profile with all four boxes).
The control leg exists and fires.

### Task 1, mutation 3 — a money box dropped from the exactness loop

`'line26EstimatedTaxPayments'` deleted from `moneyBoxFields`, schema field left in place.
`numstat: 0 1`. **tsc exit 0.**

```
✖ import("./fjs/return/profile/module.f.js").proof.checkReferences.moneyBoxExactness.everyMoneyBoxIsCovered()
ℹ tests 394   ℹ pass 393   ℹ fail 1
```

Predicted: RED on `everyMoneyBoxIsCovered` via the hand-typed count of 4. **Observed.** Note the
total fell 395 -> 394: the dropped box's own generated leaf vanished WITH it, which is precisely
why the hand-typed count has to exist (T-09-08-02's shape, reproduced in a new dialect).

### Task 1, mutation 4 — cross-field condition inverted

`&& !r.declaredKinds.includes('estimatedTaxPayments')` -> `&& r.declaredKinds.includes(…)`.
`numstat: 1 1`. **tsc exit 0.**

```
✖ …proof.checkReferences.crossField.estimatedPaymentWithDeclaredKindAccepted()
✖ …proof.checkReferences.crossField.estimatedPaymentWithoutDeclaredKindRefused()
✖ …proof.validate.fullyPopulatedValidates()
ℹ tests 406   ℹ pass 403   ℹ fail 3
```

Predicted: RED on both the refusal leaf and the fully-populated ok leaf. **Observed both
directions plus the third.**

### Task 1, mutation 5 — check 5b deleted entirely (the money gate)

The whole 5b block removed. `numstat: 0 26`. **tsc exit 0.**

```
✖ …proof.checkReferences.spouseBoxes.marriedFilingSeparatelySpouseBoxWithoutConditionRefused()
    [ 'ok', 'error' ]
ℹ tests 406   ℹ pass 405   ℹ fail 1
```

The thrown value is `[ 'ok', 'error' ]` — `assertEq(t, 'error')` received `'ok'`. The profile
`{ filingStatus: 'marriedFilingSeparately', spouseIsBlind: true }` validated clean, with no
`spouseHadNoIncomeIsNotFilingAndIsNotADependent` anywhere in it. That is the $3,200 open.

**Both halves, as the plan required.** The full spouse-box group under the mutation:

```
✔ …spouseBoxes.headOfHouseholdSpouseBlindRefused()
✔ …spouseBoxes.marriedFilingJointlySpouseBlindAccepted()
✔ …spouseBoxes.singleSpouseBornBeforeRefused()
✔ …spouseBoxes.qualifyingSurvivingSpouseSpouseBlindRefused()
✖ …spouseBoxes.marriedFilingSeparatelySpouseBoxWithoutConditionRefused()
✔ …spouseBoxes.marriedFilingSeparatelySpouseBoxWithConditionAccepted()
✔ …spouseBoxes.conditionFlagWithoutSpouseBoxesAccepted()
```

The control — the same blob WITH the flag present — stayed **GREEN**, so the refusal is a gate
and not a blanket rejection.

### Task 2, mutation — the dialect unregistered

`[returnProfileDialect]: returnProfileSchema,` deleted from `dialectSchemas`, the import kept
live by a `{@link returnProfileDialect}` reference in `knownDialects`' docstring. `numstat: 1 2`.
**tsc exit 0** — TypeScript does count a JSDoc `{@link}` as a use for `noUnusedLocals`, so the
plan's suggested workaround holds.

**First run, against the proof as the plan specified it:**

```
✖ import("./fjs/server/finance_schema/module.f.js").proof.returnProfileResolves()
ℹ tests 407   ℹ pass 406   ℹ fail 1
```

**`unknownDialectRefused` stayed GREEN.** See the plan defect below.

**Second run, after the Rule-1 fix:**

```
✖ import("./fjs/server/finance_schema/module.f.js").proof.everyRegisteredDialectIsCounted()
✖ import("./fjs/server/finance_schema/module.f.js").proof.returnProfileResolves()
ℹ tests 408   ℹ pass 406   ℹ fail 2
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `unknownDialectRefused` cannot detect an unregistered dialect; it is self-referential**

- **Found during:** Task 2's required mutation.
- **Issue:** the plan states — "`unknownDialectRefused` already iterates `knownDialects`, so the
  refusal message's coverage of the new tag comes for free — confirm that in the SUMMARY rather
  than adding a second assertion," and predicts the mutation will redden it. It does not.
  `knownDialects` is `Object.keys(dialectSchemas)`, i.e. **the code under test**, so deleting an
  entry deletes it from the loop's iteration set in the same instant. Measured: the mutation
  reddened `returnProfileResolves` alone, 407/406/1. This is AGENTS.md's named recurring defect —
  "a proof whose expected side was not independent of the code under test" — which has shipped in
  this project three times, each with a fully green suite.
- **Fix:** added `expectedKnownDialectCount = 5`, hand-typed and deliberately NOT
  `knownDialects.length`, with an `everyRegisteredDialectIsCounted` leaf — the same
  `expectedThresholdCount` / `expectedMoneyBoxFieldCount` idiom `fjs/tax/boundary` and
  `fjs/document/1099int` already use, and the same idiom this plan's own Task 1 mandates. The
  docstring records the measurement so the next reader does not re-derive it. Re-running the
  identical mutation then reddened two leaves.
- **Why this overrides the plan's "rather than adding a second assertion":** the prohibition's
  stated premise ("comes for free") is false, and MCP-06's actual prohibition is on a second
  source of truth for a dialect's FIELD NAMES — a hand-typed count of registered dialects is not
  that. AGENTS.md is the repo's single source of truth and takes precedence.
- **Files modified:** `fjs/server/finance_schema/module.f.js`
- **Commit:** `2dc3925`

**2. [Process] the TDD RED gate was observed but not committed separately**

Documented under "TDD gate compliance" above. Reason: not publishing a knowingly-red HEAD into a
checkout two other executors were measuring mutations in.

### Naming departures from the plan's literal text

Both are mechanical and were forced by `tsc`; neither changes a check's meaning.

- The plan writes check 4 as `kindVocabulary.includes(kind)`. `kindVocabulary` is a
  `@type {const}` tuple of 50 string literals, so its own `.includes` rejects an untrusted
  `string` argument at compile time — the compiler refusing to let the check ask the question it
  exists to answer. Resolved with a **widening assignment**, `const kindNames = kindVocabulary`
  annotated `@type {readonly string[]}` — an assignment, not a cast, so nothing is silenced. The
  same applies to `individualFilingStatuses` -> `filingStatusNames`. `finance_schema`'s
  `knownDialects` is the in-repo precedent.
- The forbidden-status list is named `statusesWithoutSpouseBoxes`.

## Threat register outcomes

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-10-04-01 | mitigated | membership + duplicate checks; mutation 1 reddens the `dogecoin` leaf |
| T-10-04-02 | mitigated | every money box `option(string)`, re-parsed via the shared `moneyFieldError`; mutation 3 reddens the hand-typed count |
| T-10-04-03 | mitigated | cross-field check 7; mutation 4 reddens both directions |
| T-10-04-07 | mitigated | check 5b; mutation 5 reddens the refusal and leaves the control green |
| T-10-04-04 | mitigated | `filingStatus` against `individualFilingStatuses`, `taxYear` against `taxParamsByYear`, both read from `fjs/tax/params` |
| T-10-04-05 | mitigated | refusals name fields, kinds and the permitted vocabulary. The dialect stores no name and no TIN field at all, so neither can appear in a message |
| T-10-04-06 | accepted | a dialect adds a schema, not a guest command; `finance_schema` is read-only |

No new security surface was introduced beyond what the register covers, so there are no threat
flags.

## Acceptance criteria

### Task 1

| Criterion | Result |
|---|---|
| `npm test` exits 0, `tsc` clean, 0 fail | ✅ 408/408, exit 0 (isolated snapshot; see above) |
| media type literal outside comment lines is exactly 1 | ✅ `1` |
| `grep -c "boolean"` is 0 | ✅ `0` |
| `grep -cE ': number,'` is exactly 2 | ✅ `2` (`taxYear`, `dependentCount`) |
| `grep -c "instanceof Error"` is 0 | ✅ `0` |
| `grep -c "spouseHadNoIncome…"` ≥ 3 | ✅ `6` |
| all five mutations produced the recorded RED output | ✅ transcripts above |

### Task 2

| Criterion | Result |
|---|---|
| `npm test` exits 0, 0 fail | ✅ |
| `grep -c "returnProfileSchema"` ≥ 3 | ✅ `4` |
| `grep -c "five known dialect\|of the five"` ≥ 1 | ✅ `1` |
| project-local leaf count > the count after Task 1 | ✅ 404 -> 406 |
| the mutation produced the recorded RED output | ✅ — and only after the Rule-1 fix did it match the plan's prediction |

## What the next plans inherit

- `kindVocabulary` and `Kind` are ready for **Plan 10-07**'s `tsc`-level assertion that every
  member is either modeled or carries a refusal entry. All 50 members are currently unclassified.
- **Plan 10-06/10-09** can cite a profile document hash and `filingStatus` / `taxpayerIsBlind` /
  `spouseIsBlind` / … as a real `boxPath` for line 12e's `ReportLine.sources`.
- `spouseHadNoIncomeIsNotFilingAndIsNotADependent` is validated at ingest but **not yet consumed
  by the deduction computation**. Whichever plan computes the box count must read it; the four-box
  MFS maximum is only sound because this field gates it.
- `wholeDollarElection` and `earnedIncome` are carried but unread here — 10-02's election and the
  Standard Deduction Worksheet for Dependents respectively.

## Known Stubs

None. Every field the schema declares is either validated here or explicitly handed to a named
later plan in the section above.

## Self-Check: PASSED

- `fjs/return/profile/module.f.js` — FOUND
- `fjs/server/finance_schema/module.f.js` — FOUND
- commit `7795cc2` — FOUND
- commit `2dc3925` — FOUND
