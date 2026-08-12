# Phase 13: The 65+ Profile and the Remaining Schedules - Pattern Map

**Mapped:** 2026-08-10
**Files analyzed:** 17 (11 new modules, 6 modified modules — grouped where one analog serves several)
**Analogs found:** 17 / 17

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `fjs/schedule/1a/module.f.js` (Schedule 1-A, Parts I/V/VI) | schedule/worksheet | CRUD (pure compute over stored docs + profile) | `fjs/tax/line16/qdcgt/module.f.js` (line-by-line worksheet) + `fjs/schedule/b/module.f.js` (documented-boundary schedule) | exact (worksheet shape) / role-match (schedule boundary doc) |
| `fjs/tax/line6/module.f.js` or `fjs/tax/ssb/module.f.js` (SSB Worksheet, 18 lines) | worksheet | CRUD | `fjs/tax/line16/qdcgt/module.f.js` | exact |
| `fjs/schedule/a/module.f.js` (Schedule A) | schedule | CRUD | `fjs/schedule/b/module.f.js` | exact |
| `fjs/tax/deduction/module.f.js` — add `deductionChoice` | service (comparison) | CRUD | same file, existing `standardDeductionCents` | exact (extend in place) |
| `fjs/form8812/module.f.js` (Schedule 8812) | schedule | CRUD | `fjs/schedule/d/module.f.js` (multi-part schedule with phase-out and dispatch) + `fjs/form8949/module.f.js` (line-item aggregation) | role-match |
| `fjs/schedule/1/module.f.js`, `fjs/schedule/2/module.f.js`, `fjs/schedule/3/module.f.js` | schedule | CRUD, mostly documented zero | `fjs/schedule/b/module.f.js` | exact |
| `fjs/document/itemized_deductions/module.f.js` (`vnd.fjs.itemized_deductions`) | document dialect | file-I/O (CAS document validate) | `fjs/document/medical_expenses/module.f.js` | exact (explicit CONTEXT.md precedent) |
| `fjs/tax/params/module.f.js` — extend with TY2025 senior deduction, SSB base amounts, SALT cap, CTC/ODC/ACTC, medical floor; widen `Citation` to discriminated union | config/data | CRUD | same file, existing `standardDeduction`/`ordinaryBrackets` pattern | exact (extend in place) |
| `fjs/tax/boundary/module.f.js` — extend `allThresholds` with four new phase-outs | test/gate | batch (generated boundary proof) | same file | exact (extend in place) |
| `fjs/return/profile/module.f.js` — add `dependents` array, `iraDeductionDeclared`, Schedule A line 18 election | document dialect | file-I/O | same file, existing `hadForeignFinancialAccount`-style additive field pattern | exact (extend in place) |
| `fjs/return/scope/module.f.js` — reclassify kinds, correct 5 remedy strings | service (scope guard) | CRUD | same file, existing `modeledKinds`/`unmodeledKindRefusals` partition | exact (extend in place) |
| `fjs/form1040/core/module.f.js` — wire lines 4a/4b/5a/5b/6a/6b/8/10/12e/13b/17/19/20/23/25b/28/31 | controller (wiring) | CRUD | same file, existing 1a/2a/2b/3a/3b/25a wiring | exact (extend in place) |
| `fjs/document/w2/module.f.js`, `fjs/document/1099r/module.f.js` — docstring amendment only | document dialect | n/a (doc-only) | same files, existing "nothing reads them" paragraph | exact (extend in place) |
| MAGI gate proof (new, Wave 3) | test/gate | batch (tree-walk) | `fjs/tax/boundary/module.f.js`'s generated-proof-over-a-list idiom | role-match |

## Pattern Assignments

### `fjs/schedule/1a/module.f.js` (Schedule 1-A Parts I/V/VI) — new module

**Primary analog:** `fjs/tax/line16/qdcgt/module.f.js` (line-by-line worksheet transcription)
**Secondary analog:** `fjs/schedule/b/module.f.js` (documented-boundary schedule shape, standalone-callable pure function)

**Imports pattern** (`fjs/tax/line16/qdcgt/module.f.js` lines 77-84):
```javascript
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { of, multiply, halfUp } from '../../../types/rational/module.f.js'
import { centsFromString } from '../../../exact/module.f.js'
import { taxParamsByYear } from '../../params/module.f.js'
import { baseTaxForAmount } from '../../table/module.f.js'

/** @import { TaxParamSet, IndividualFilingStatus } from '../../params/module.f.js' */
```

**One-line-per-`const`, in printed order, with the printed instruction quoted above each** (`qdcgt` lines 131-242 — the idiom to copy verbatim for Part V):
```javascript
export const qdcgt = taxParamSet => input => {
    // 1. "Enter the amount from Form 1040 or 1040-SR, line 15."
    const line1 = line1Cents
    // 2. "Enter the amount from Form 1040 or 1040-SR, line 3a."
    const line2 = line2Cents
    // 3. ... (printed instruction, verbatim, above the const)
    ...
    return { line1, line2, ..., line25, method22: base22.method, method24: base24.method }
}
```
Research's own transcription of Part V into this exact idiom (13-RESEARCH.md §"Code Examples"):
```javascript
const line31 = scheduleOneAMagiCents           // = Part I line 3
const line32 = mfj ? 15000000n : 7500000n      // $150,000 / $75,000, in cents
const line33 = line31 > line32 ? line31 - line32 : 0n
const line34 = halfUp(of(line33 * 6n)(100n))    // 6% -- CONTINUOUS, no $1,000 stepping
const line35 = line34 < 600000n ? 600000n - line34 : 0n
const line36a = taxpayerHasValidSsnAndBornBefore1961Jan2 ? line35 : 0n
const line36b = mfj && spouseHasValidSsnAndBornBefore1961Jan2 ? line35 : 0n
const line37 = line36a + line36b
```
**MFS short-circuit (Decision 5.4/Pitfall 3) must run BEFORE line31, as a guard, not as a consequence of the arithmetic** — there is no existing analog for "whole part zeroed by filing status before its own arithmetic runs"; write it as an early return, mirroring `fjs/tax/deduction`'s `standardDeductionCents`'s own ordering discipline (see below, "exceptions 2/3 return zero before any increment is added").

**No-floor assertion idiom** (`qdcgt` lines 183-188, 220-222) — for lines the printed page states cannot go negative (e.g., a line fed only by a `min`), assert rather than defensively floor:
```javascript
const line9 = line7 - line8
assert(line9 >= 0n, ['QDCGT line 9 must never be negative', line9])
```

**Record shape (not array), printed line numbers as field names** — `qdcgt`'s docstring (lines 59-65) explains why: `noUncheckedIndexedAccess` makes an array index `bigint | undefined`, and a record needs no cast.

**Boundary-probe idiom (TAX-04)** for the $75k/$150k phase-out start and the $175k/$250k floor point — see `fjs/tax/boundary/module.f.js` pattern below; add these four thresholds to `allThresholds` there rather than hand-writing separate `-1¢/+1¢` leaves in `fjs/schedule/1a` alone (though a hand-written trio pinning the SPECIFIC arithmetic — not just "a threshold exists" — is also warranted in this module directly, per `standardDeductionCents`'s three-probe idiom in `fjs/tax/deduction`).

**Documented-zero boundary for Parts II/III/IV** — follow `fjs/schedule/b`'s Form 8815 precedent exactly (see below).

---

### `fjs/tax/line6/module.f.js` or `fjs/tax/ssb/module.f.js` (Social Security Benefits Worksheet, 18 lines) — new module

**Analog:** `fjs/tax/line16/qdcgt/module.f.js` (same idiom as above — this is the SAME pattern, a second instance)

Key structural notes specific to this worksheet, from research's own transcription (13-RESEARCH.md §2, "Architecture Patterns" Pattern 1):
```javascript
// Source: i1040gi.pdf (2025) p32, "Social Security Benefits Worksheet—Lines 6a and 6b"
const line1 = totalBox5AllSsa1099AndRrb1099Cents            // -> also 1040 line 6a
const line2 = line1 / 2n                                     // 50%
const line3 = /* 1z+2b+3b+4b+5b+7a+8 */
const line4 = taxExemptInterestCents                          // 1040 line 2a — THE add-back
const line5 = line2 + line3 + line4
const line6 = /* Schedule 1 lines 11-20, 23, 25 total */
const line7 = line6 < line5 ? line5 - line6 : /* -0-, STOP */
```
**Line 8's THREE-way branch** (MFJ $32,000 / single-etc $25,000 / MFS-lived-with-spouse skips straight to `line16 = line7 * 85%`) has no existing analog in this codebase — it is a genuinely new "third branch, not merely a different base amount" shape. Model it as an explicit fork (mirroring `qdcgt` line 3's Schedule-D-yes/no fork at lines 165-169), not as a parameterized base amount with a boolean flag.

**The circularity refusal (Decision 3.3)** does NOT belong inside this worksheet module — it is threaded as an error arm from `fjs/form1040/core`, one level up (see "Error-arm threading pattern" below), triggered by the new `iraDeductionDeclared` profile field, before this worksheet is ever called.

**`ReportLine` idiom for line 3's cross-references and line 6's Schedule 1 total** — use `fjs/report/line/module.f.js`'s `ReportLine`/`unionSources` shape (see "The ReportLine discipline" below); this worksheet's own inputs are already-computed 1040 `ReportLine`s from earlier steps, not raw documents.

---

### `fjs/schedule/a/module.f.js` (Schedule A, 18 lines) — new module

**Analog:** `fjs/schedule/b/module.f.js` (full file read; see excerpt above under "The 'documented zero vs. scope refusal' distinction")

**Standalone, independently-callable pure function; NOT importing `fjs/return/scope` or wired into `fjs/form1040/core`'s own aggregation at runtime** (`schedule/b` docstring lines 10-21):
```javascript
/**
 * This is a STANDALONE, independently callable pure function over stored
 * `vnd.fjs.1099int`/`vnd.fjs.1099div` documents plus the declared return
 * profile ... It is NOT wired into Form 1040's own income-line or
 * tax-and-payment-line aggregation, and it does not consult the return-scope
 * guard's own classification function.
 */
```

**Documented-zero-with-boundary-in-docstring idiom** — this is Schedule A's single most load-bearing borrowed pattern (Decision 2.3, mortgage-interest-limitation and charitable-AGI-limitation lines). Copy `schedule/b`'s Form 8815 treatment verbatim in shape (`schedule/b` lines 23-35, 204-206):
```javascript
/**
 * ## Two documented, deliberate scope boundaries
 *
 * - **Line 3 (Form 8815 excludable EE/I savings bond interest) is NOT
 *   modeled this phase** — Form 8815 does not exist in this codebase — so
 *   line 4 equals line 2 exactly. Not a silent gap: line 4 is constructed
 *   explicitly equal to line 2, with this paragraph as the record of why.
 */
...
// Line 3 (Form 8815) is not modeled this phase — see module docstring —
// so line 4 equals line 2 exactly.
const line4 = { ...line2, rule: 'Schedule B line 4' }
```
For Schedule A's own boundaries (mortgage interest acquisition-debt cap, charitable AGI percentage limits — research confirms neither appears on the form's own face and both require Pub 936/Pub 526 this project does not model), state the same shape: the taxpayer-asserted, already-limited `vnd.fjs.itemized_deductions` entry is trusted verbatim, and the docstring says exactly why (mirroring `schedule/b`'s "Form 8815 does not exist in this codebase").

**Box-sum / document-line helpers, reimplemented locally, never imported from `fjs/form1040/core`** (`schedule/b` lines 58-63, 111-158) — `sumBoxOverDocuments`, `addBoxSums`, `documentLine`, `profileDeclaredZeroLine` are private, module-local reimplementations of the idiom, not shared imports:
```javascript
const sumBoxOverDocuments = documents => boxPath => read => {
    const sources = documents.flatMap(document => {
        const printed = read(document.value)
        return printed === undefined ? [] : [{ documentHash: document.documentHash, boxPath, value: printed }]
    })
    return { value: sources.reduce((total, source) => total + centsFromString(source.value), 0n), sources }
}
const profileDeclaredZeroLine = profile => rule => ({
    value: 0n,
    sources: [{ documentHash: profile.documentHash, boxPath: 'declaredKinds', value: JSON.stringify(profile.value.declaredKinds) }],
    rule,
})
const documentLine = profile => rule => sum => {
    const [first, ...rest] = sum.sources
    return first === undefined ? profileDeclaredZeroLine(profile)(rule) : { value: sum.value, sources: [first, ...rest], rule }
}
```
For `vnd.fjs.itemized_deductions` entries, the read function walks the taxpayer-asserted `entries` array filtered by line-tag rather than a fixed box name — same `documentLine`/`profileDeclaredZeroLine` fallback shape.

**Two-independent-tests-never-combined idiom** — irrelevant to Schedule A's own thresholds (the SALT cap and medical floor are single continuous formulas, not disjunctive tests like Schedule B's $1,500), but the **"two independent tests" anti-pattern warning is worth restating** for the SALT worksheet's own quirk (Pitfall 2: lines w1/w9 use flat non-MFS figures, only w10 halves for MFS) — mirror `schedule/b`'s own "two independent tests, never a combined sum" docstring warning shape (lines 37-47) when documenting this in Schedule A's own module.

**Proof structure** — one `proof.thresholds.boundary.*` block per threshold with a below/at/above triple (`schedule/b` lines 365-424) is the idiom to copy for the SALT cap's `$500,000`/`$600,000` boundaries and the medical floor's 7.5% arithmetic (though the medical floor and SALT phase-down thresholds should ALSO be added to `fjs/tax/boundary`'s generated `allThresholds` list, per TAX-04).

---

### `fjs/tax/deduction/module.f.js` — extend with `deductionChoice` (modified module)

**Analog:** the same file's own `standardDeductionCents` (lines 196-251) — extend in place, do not create a new module (Decision 2.4 explicitly assigns this to `fjs/tax/deduction`, beside the figure it compares against).

**Ordered-steps-as-the-rule idiom** (docstring lines 196-213) — copy this discipline for `deductionChoice`'s own comparison order:
```javascript
/**
 * The ORDER of the four steps below is the rule, not an optimisation:
 * 1. Validate ... first.
 * 2. Exceptions ... return zero before any increment is added.
 * 3. Exception 1 delegates to the Dependents worksheet ...
 * 4. Otherwise the chart ...
 */
export const standardDeductionCents = taxParamSet => input => {
    ...
    if (spouseItemizes || dualStatusAlien) { return 0n }
    if (claimedAsDependent) { return dependentStandardDeduction(...) }
    const basicCents = centsFromString(taxParamSet.standardDeduction[status].amount)
    ...
}
```
`deductionChoice` should follow the same "compute both figures, then decide" shape, returning `{ chosen: 'standard' | 'itemized', standard, itemized }` — a discriminated union return, matching the `ReportLine`-adjacent pattern used elsewhere (see `Form1040Outcome`'s `{ kind: 'ok' } | { kind: 'error' }` shape below for the general discriminated-union idiom in this codebase).

**Refusal-with-named-reason idiom** (`refuses` test helper, lines 352-365, and every `assert(..., [message, ...values])` call in `standardDeductionCents`) — reuse this shape for any Schedule A absent-data refusal case, asserting on the THROWN VALUE's content, never merely that it threw.

**Proof idiom: generated-leaf-per-table-row** (lines 288-326, 374-412) — `Object.fromEntries(chartCombinations.map(...))`, with an INDEPENDENTLY hand-typed `expectedChartCombinationCount` asserted separately from the generated proof's own length. Use this exact idiom for `deductionChoice`'s criterion-3 "both directions" proof if enumerating multiple filing-status/income combinations.

---

### `fjs/form8812/module.f.js` (Schedule 8812, both parts) — new module

**Analogs:** `fjs/schedule/d/module.f.js` (multi-part schedule with a phase-out and downstream dispatch — read for its shape, not excerpted line-by-line here since `qdcgt`/`schedule/b` already cover the worksheet-line and documented-zero idioms this module also needs) and `fjs/form8949/module.f.js` (aggregation-then-total idiom).

**The CTC/ODC phase-out is STEPPED (round UP to next $1,000, a true cliff)** — this is the ONE Schedule 8812 arithmetic shape that has NO existing precedent in this codebase (every existing phase-out this project has shipped, e.g. `fjs/tax/deduction`'s dependent-worksheet threshold, is a simple comparison, not a rounding step). Research's own transcription (13-RESEARCH.md §"Code Examples") is the closest thing to a precedent and should be followed verbatim:
```javascript
// Source: f1040s8.pdf (2025) p1, Part I lines 9-11
const line9 = mfj ? 40000000n : 20000000n      // $400,000 / $200,000, cents
const excess = line3 > line9 ? line3 - line9 : 0n
// "If more than zero and not a multiple of $1,000, enter the NEXT multiple of $1,000"
const line10 = excess === 0n ? 0n : roundUpToNextThousandDollars(excess)
const line11 = halfUp(of(line10 * 5n)(100n))    // 5%
```
`roundUpToNextThousandDollars` does not exist yet anywhere in `fjs/` — it must be written new (a `fjs/types/rational`-style helper, or module-local), and it is the single highest-risk arithmetic primitive in this phase (Decision 5.5 names it explicitly: "getting these backwards is the phase's most likely silent-wrong-number failure"). Contrast explicitly against Schedule 1-A's/SALT's CONTINUOUS (no rounding) phase-outs in the module's own docstring, mirroring `qdcgt`'s own "why line 16 is not bracket arithmetic" docstring section (lines 12-21) as the model for stating a non-obvious arithmetic distinction up front.

**Credit Limit Worksheet A collapsing to `line18` for this profile** — research confirms this (13-RESEARCH.md §4) is a genuine simplification for the target profile (Schedule 3 credits are all documented zeros), but the module should still model the subtraction explicitly (line2 = sum of Schedule 3 credits, documented zero) rather than hard-coding the collapse — same "every printed line exists, computed, even when it is provably zero today" discipline as `qdcgt`'s line 11 (a pure copy of line 9, kept as its own line — see `qdcgt` docstring point 3, lines 54-57).

**`dependents` array consumption** — Schedule 8812 reads `vnd.fjs.return_profile`'s new `dependents` array the same way `schedule/b` reads the profile's foreign-account fields VERBATIM, never inferred (`schedule/b` lines 49-53, 217-221):
```javascript
const hadForeignFinancialAccount = profile.value.hadForeignFinancialAccount === true
```
Classify each dependent entry into CTC (age <17 + SSN valid) vs. ODC (else) with a pure filter/reduce over the array — no existing array-classification precedent in this codebase, so this is new, but keep it a pure function taking the array as input, analogous to how `sumBoxOverDocuments` takes a document array as input.

**ACTC (Part II-A, line 28) threading** — both halves live in ONE module (Decision 4.3); the nonrefundable credit (line 19) and ACTC (line 28) share the module's internal intermediate values (line12/line14), the same way `qdcgt`'s lines 22 and 24 both call `baseTaxForAmount` independently within one function execution (`qdcgt` docstring point 1, lines 38-46) — i.e., compute once, return both halves from one function, never as two separately-callable exports that could independently drift.

---

### `fjs/schedule/1/module.f.js`, `fjs/schedule/2/module.f.js`, `fjs/schedule/3/module.f.js` — new modules

**Analog:** `fjs/schedule/b/module.f.js` (full documented-zero, standalone, profile-driven shape)

For the target profile, research confirms (13-RESEARCH.md §5) nearly every line on all three schedules is a `profileDeclaredZeroLine` — copy `schedule/b`'s `profileDeclaredZeroLine` helper verbatim (see excerpt above), and the module's own docstring should state the boundary the same way `schedule/b`'s docstring states its Form 8815 boundary — one paragraph per line group, naming exactly which coarse `kindVocabulary` entry (`scheduleOneAdditionalIncome`, `scheduleOneAdjustments`, `scheduleTwoTaxes`, `scheduleThreeNonrefundableCredits`, `scheduleThreeRefundableCredits`) drives the whole schedule to zero when undeclared, and refuses (via the `fjs/return/scope` partition, not locally) when declared.

**Zero-stored-documents-still-produce-valid-ReportLines proof idiom** (`schedule/b` lines 500-516) — the exact proof shape for "every line of Schedule 1/2/3 is zero for this profile, citing the profile, not silently absent":
```javascript
zeroStoredDocumentsStillProduceValidReportLinesCitingProfile: () => {
    const result = scheduleB({ interestForms: [], dividendForms: [], profile: profileNoForeign })
    assertEq(result.line2.value, 0n)
    assertEq(result.line2.sources.length, 1)
    assertEq(result.line2.sources[0].boxPath, 'declaredKinds')
}
```

---

### `fjs/document/itemized_deductions/module.f.js` (`vnd.fjs.itemized_deductions`) — new dialect module

**Analog:** `fjs/document/medical_expenses/module.f.js` (verbatim precedent, per Decision 2.1 — "follows `vnd.fjs.medical_expenses` verbatim on every design point")

**Full four-stage shape to copy** (`medical_expenses` lines 43-58, 68-90, 122-163):
```javascript
import { array, number, option, string } from 'functionalscript/fjs/types/rtti/module.f.js'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.js'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.js'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { base, mediaTypeOf } from '../base/module.f.js'
import { moneyFieldError } from '../money_field/module.f.js'

export const dialect = 'vnd.fjs.itemized_deductions'
export const mediaType = mediaTypeOf(dialect)

const itemizedEntry = /** @type {const} */ ({
    lineTag: string,         // free string — "the category" — Decision 2.1: enumerating
                              // Pub 526's allowed categories is deduction logic, this dialect stores
    provider: string,        // or payee/description
    amount: string,
    // NO stored total anywhere in this schema.
})

export const itemizedDeductionsSchema = /** @type {const} */ ({
    ...base(dialect),
    recipientTin: string,
    taxYear: number,
    corrected: option(true),
    entries: array(itemizedEntry),
    // NO formRevision field — DOC-10 does not apply; not a transcribed IRS form.
})
```

**No-`formRevision`, no-total, free-string-category docstring argument** — copy `medical_expenses`'s docstring reasoning nearly verbatim (lines 14-32), substituting Schedule A for medical:
```
- No `formRevision`. DOC-10 exists because box semantics drift between
  revisions of a printed form; there is no printed form and no boxes...
- No total. Nothing here sums the entries, and nothing applies [the SALT
  cap / medical floor]: the floor/cap needs an AGI this document cannot
  see, and a stored total would be a second source of truth able to
  disagree with the entries it came from.
- `category`/`lineTag` is a free string. Enumerating what [Publication
  526 / Schedule A's own instructions] do and do not allow is deduction
  logic; this phase stores and reads.
```

**Semantic `checkReferences` idiom** (`medical_expenses` lines 122-148) — the `moneyFieldError` per-entry loop is the exact shape to reuse for `amount` (and any per-entry withholding cross-check, if Decision 2.2's proof reads entries here rather than in Schedule A itself):
```javascript
export const checkReferences = r => {
    for (const entry of r.entries) {
        const amountMessage = moneyFieldError(`amount for ...`)(entry.amount)
        if (amountMessage !== undefined) { return error(amountMessage) }
    }
    return ok(r)
}
```

**`formSubject` cardinality** — `''` for payer and account, one record per taxpayer per year, exactly as `medical_expenses`'s docstring states (lines 34-39) and as its own `recipientTin`-only-no-payer schema shows.

**`noTotalIsStored` proof** (`medical_expenses` lines 272-282) — copy verbatim as the negative-property proof for this dialect too.

---

### `fjs/tax/params/module.f.js` — extend (modified module)

**Analog:** the same file, extending its own existing `standardDeduction`/`agedOrBlindAdditional`/`ordinaryBrackets` pattern (full file read above).

**`Citation` widens to a discriminated union (Decision 5.2)** — the existing shape:
```javascript
/**
 * @typedef {{
 *   readonly revProc: string,
 *   readonly section: string,
 *   readonly effectiveDate: string,
 * }} Citation
 */
```
becomes (additive; every EXISTING entry becomes `{ kind: 'revProc', ... }` with no value change):
```javascript
/**
 * @typedef {
 *   { readonly kind: 'revProc', readonly revProc: string, readonly section: string, readonly effectiveDate: string } |
 *   { readonly kind: 'publicLaw', readonly publicLaw: string, readonly section: string, readonly effectiveDate: string } |
 *   { readonly kind: 'code', readonly section: string, readonly effectiveDate: string }
 * } Citation
 */
```
This is a breaking structural change to every EXISTING citation literal in this file (all currently `{ revProc, section, effectiveDate }` with no `kind`) — every one of the dozens of citation object literals in `standardDeduction`, `agedOrBlindAdditional`, `dependentStandardDeductionCap`, `ordinaryBrackets`, `capitalGainsBreakpoints` needs `kind: 'revProc'` added. The wiring plan must budget for this as a mechanical, file-wide edit, not a localized one.

**New parameters follow the existing `AmountWithCitation` shape exactly**, e.g.:
```javascript
export const seniorDeduction = {
    amount: '6000.00',
    phaseoutRate: 6,  // percent — plain number, like ratePercent, never money
    phaseoutThreshold: { single: '75000.00', marriedFilingJointly: '150000.00', ... },
    citation: { kind: 'publicLaw', publicLaw: '119-21', section: '§70103', effectiveDate: '2025-01-01' },
}
```

**Per-parameter citation, never one shared document-level citation** (docstring lines 9-25) — the exact discipline to carry forward: the senior deduction, SALT cap, and medical floor each get their OWN `Citation`, and the CTC's `Citation` differs in `kind` (`'revProc'`) from the other three (`'publicLaw'`/`'code'`) — Pitfall 5 in RESEARCH.md names exactly this trap.

**`unmodifiedParametersCite2024_40Only`-style sibling proof (Decision 3.1)** — copy this proof's shape (lines 445-466) for the new OBBBA-sourced set, asserting `kind`, and the specific `publicLaw`/`section`/`effectiveDate` triple, per field, never one deep-equality assertion:
```javascript
unmodifiedParametersCite2024_40Only: () => {
    assertEq(agedOrBlindAdditional.married.citation.revProc, '2024-40')
    assertEq(agedOrBlindAdditional.married.citation.section, '§2.15(3)')
    assertEq(agedOrBlindAdditional.married.citation.effectiveDate, '2025-01-01')
    ...
}
```

**`qssParametersEqualMfjAndAreStoredIndependently`-style proof — the PRECEDENT for Decision 5.6's four separately-named-but-identical-valued income functions** (lines 609-634): this is the exact argument and exact proof shape (assert field-by-field equality between two independently-stored values, never via a spread) to copy when writing the proof that `seniorDeductionPhaseoutIncome`, `saltCapPhasedownIncome`, and `childTaxCreditPhaseoutIncome` currently compute equal values while remaining three separate, non-DRY'd functions:
```javascript
// It is also why neither status is stored as a spread of the other:
// with a spread this leaf could never fail, and the drift it exists to
// detect would be unrepresentable.
qssParametersEqualMfjAndAreStoredIndependently: () => {
    assertEq(standardDeduction.qualifyingSurvivingSpouse.amount, standardDeduction.marriedFilingJointly.amount, '...')
    ...
}
```

**Round-trip / dollar-string discipline proof** (lines 471-476, `everyDollarAmountIsAStringAndRoundTrips`) — extend `everyDollarStringField`'s list with each new parameter's amount fields; do not write a second, separate round-trip proof.

---

### `fjs/tax/boundary/module.f.js` — extend `allThresholds` (modified module)

**Analog:** the same file's own generated-proof-over-a-list idiom (full file read above).

Add the four new phase-out thresholds — senior deduction start/floor, SALT cap start/floor, CTC/ODC phase-out start — to the `allThresholds` array assembly, following the exact shape of `ordinaryBracketThresholds`/`capitalGainsThresholds`:
```javascript
const seniorDeductionThresholds = individualFilingStatuses.flatMap(status => [
    { label: `seniorDeductionPhaseoutStart:${status}`, cents: centsFromString(seniorDeduction.phaseoutThreshold[status]) },
    // ... floor point, computed or hand-typed per research's stated formula
])
```
**`expectedThresholdCount` MUST be bumped from 50 to the new total**, and the bump is itself asserted independently in `everyThresholdIsCovered` — this is the exact mechanism (docstring lines 8-15) that makes a dropped new threshold fail loudly rather than passing by omission. Note: the CTC/ODC phase-out is STEPPED, not continuous — `segmentIndex`'s generic `<=`-count boundary-triple check still applies at the threshold itself (the $1,000-step rounding is a SEPARATE property, tested inside `fjs/form8812` itself, not here — this module only tests "is the threshold crossed at exactly this cent").

---

### `fjs/return/profile/module.f.js` — extend (modified module)

**Analog:** the same file's own additive-field pattern (full excerpt above), specifically the four foreign-account fields (`hadForeignFinancialAccount` et al.) as the direct precedent Decision 2.5/4.1/5.1 all cite.

**Additive `option(...)` fields, never a two-valued primitive** (schema excerpt, lines 167-205):
```javascript
export const returnProfileSchema = /** @type {const} */ ({
    ...base(dialect),
    ...
    // Schedule A line 18 — an election no document reports, exactly like
    // hadForeignFinancialAccount (Decision 2.5).
    itemizeEvenThoughLessThanStandardDeduction: option(true),
    // Decision 5.1 — the new profile field the IRA-deduction refusal fires on.
    iraDeductionDeclared: option(true),
    // Decision 4.1 — dependents, alongside the KEPT dependentCount.
    dependents: option(array(dependentEntrySchema)),
})
```
**`dependentCount` is KEPT, with a proof asserting array length equals it** — this is a NEW cross-field check with no direct existing analog in this file's `checkReferences`, but the SHAPE of a cross-field check already exists (the `line26EstimatedTaxPayments`-requires-`estimatedTaxPayments`-declared check, lines 371-374) and should be copied:
```javascript
if (r.dependents !== undefined && r.dependents.length !== r.dependentCount) {
    return error(`dependents array length (${r.dependents.length}) does not match dependentCount (${r.dependentCount})`)
}
```

**Docstring "Three schema decisions worth stating" section** (lines 34-64) is the exact place to add a fourth/fifth bullet for the new fields, following the same "what this field is, and what it deliberately excludes" shape as the existing bullets — e.g. for `dependents`: "citizenship/resident-alien status is NOT a field here — Schedule 8812's own docstring documents that trust boundary" (Decision 5.7).

**`kindVocabulary` is FROZEN — the new fields above are how Decisions 2.5/4.1/5.1 avoid touching it.** Do not add a new kind for the IRA deduction or dependents; `kindVocabularyIsExactlyFifty` (proof, line 474-476) must continue passing unchanged.

---

### `fjs/return/scope/module.f.js` — extend/reclassify (modified module, Wave 3)

**Analog:** the same file's own `modeledKinds`/`unmodeledKindRefusals` partition (full excerpt above).

**The reclassification is a single atomic edit**: move a `kind` entry OUT of `unmodeledKindRefusals` (delete its row) and INTO `modeledKinds` (add its row, in `kindVocabulary` order) in the SAME change — `_EveryKindIsEitherModeledOrRefused` fails `tsc` if this is done half-way:
```javascript
export const modeledKinds = /** @type {const} */ ([
    'wages', 'taxExemptInterest', 'taxableInterest', 'qualifiedDividends', 'ordinaryDividends',
    'iraDistributions',            // NEW — Decision 1.2, moved from unmodeledKindRefusals
    'pensionsAndAnnuities',        // NEW — Decision 1.2
    'socialSecurityBenefits',      // NEW — TAX-10
    'scheduleOneAdditionalIncome', // NEW — TAX-14
    'scheduleOneAdjustments',      // NEW — TAX-14 (see Open Question 1 re: iraDeductionDeclared)
    'itemizedDeductions',          // NEW — TAX-13
    'seniorAndOtherScheduleOneADeductions', // NEW — TAX-09
    'scheduleTwoTaxes',            // NEW — TAX-14
    'childTaxCreditOrOtherDependents', // NEW — TAX-12
    'scheduleThreeNonrefundableCredits', // NEW — TAX-14
    'federalTaxWithheldOnOther1099', // NEW — Decision 1.3
    'additionalChildTaxCredit',    // NEW — TAX-12
    'scheduleThreeRefundableCredits', // NEW — TAX-14
])
```
**The five corrected remedy strings (Decision 1.4)** — exact current text to replace, from the live table (grep output, lines 153-181 of the current file):
```javascript
{ kind: 'householdEmployeeWages', line: '1040 line 1b', label: 'household employee wages', remedy: 'no dialect models it (Phase 13)' },
{ kind: 'medicaidWaiverPayments', line: '1040 line 1d', label: 'nontaxable Medicaid waiver payments', remedy: 'no dialect models it (Phase 13)' },
{ kind: 'otherEarnedIncome', line: '1040 line 1h', label: 'other earned income', remedy: 'no dialect models it (Phase 13)' },
{ kind: 'federalTaxWithheldOnOtherForms', line: '1040 line 25c', label: 'federal income tax withheld on other forms', remedy: 'no dialect models it (Phase 13)' },
```
each of these four becomes `remedy: 'no dialect models it (no phase yet)'`, and:
```javascript
{ kind: 'netQualifiedDisasterLoss', line: '1040 line 12e', label: 'net qualified disaster loss', remedy: 'requires Schedule A (TAX-13, Phase 13)' },
```
becomes `remedy: 'requires Form 4684 (no phase yet)'`.

**Independently hand-typed count constants MUST be bumped in the same change** — `expectedModeledKindCount` (currently asserted as 12 via `modeledKindsIsExactlyTwelve`, line 394) becomes the new total, and the unmodeled-kind count constant (currently asserted via a count near line 399) becomes 38 — NEVER derived from `.length` (this is the AGENTS.md "hand-typed count" discipline the whole file is built on).

**Docstring's own historical precedent paragraph** ("The dividend/capital-gain boundary, as of Phase 12.1", lines 41-72) is the exact model for a NEW paragraph documenting THIS phase's twelve-kind reclassification — state which kinds moved, cite the phase, and state the two kinds/rules that remain deliberately refused and why (mirroring the two-refusal-reasons paragraph there).

---

### `fjs/form1040/core/module.f.js` — wire lines 4a/4b/5a/5b/6a/6b/8/10/12e/13b/17/19/20/23/25b/28/31 (modified module, Wave 3, largest single file touched)

**Analog:** the same file's own existing wiring for 1a/2a/2b/3a/3b/25a (full excerpts above — this is the load-bearing pattern of the whole phase).

**THE FOUR PARALLEL STRUCTURES that must change together** — a plan that updates three of four produces a `tsc` error at best (missing property) or a silently-missing line at worst (present in the record but absent from the flattened/named list, so it never renders and never enters the whole-dollar-election pass or the `expectedWholeReportLineCount`/`incomeLineFieldNames` proofs):

1. **The `@typedef` block** (`Form1040IncomeLines`, lines 321-359 for income; `Form1040TaxAndPaymentLines`, lines 635-661 for tax/payment) — each new wired line needs its field added here:
```javascript
/**
 * @typedef {{
 *   readonly kind: 'ok',
 *   ...
 *   readonly line4a: ReportLine,
 *   readonly line4b: ReportLine,
 *   readonly line5a: ReportLine,
 *   readonly line5b: ReportLine,
 *   readonly line6a: ReportLine,
 *   readonly line6b: ReportLine,
 *   ...
 * }} Form1040IncomeLines
 */
```
2. **The returned object** inside `form1040IncomeLines`/`form1040TaxAndPaymentLines` (lines 482-487, 600-614 income; lines 912-981 tax) — today these lines are placeholder `declaredZero` calls:
```javascript
const line4a = declaredZero('1040 line 4a') // IRA distributions
const line4b = declaredZero('1040 line 4b') // IRA taxable amount
const line5a = declaredZero('1040 line 5a') // pensions and annuities
const line5b = declaredZero('1040 line 5b') // pensions taxable amount
const line6a = declaredZero('1040 line 6a') // social security benefits
const line6b = declaredZero('1040 line 6b') // social security taxable amount
```
These become `fromDocuments(...)` calls reading `vnd.fjs.1099r` (4a/4b vs 5a/5b routed by `box7bIraSepSimple`, Pitfall 4) and the new SSB worksheet's own outputs (6a/6b), following the EXACT shape line 3a/3b already established for "read unconditionally from stored documents, no declaration gate" (Decision on lines 468-475 — dividends' own comment block is the precedent to cite: a MODELED line reports what the documents say; `declaredKinds` gates REFUSALS, not individual already-computable lines).
3. **The flattening array** (`orderedLines`, lines 995-1019) — printed order, hand-enumerated, never derived from `Object.keys`:
```javascript
const orderedLines = income => tax => [
    income.line1a, income.line1b, income.line1c, income.line1d, income.line1e,
    ...
    income.line4a, income.line4b,
    income.line5a, income.line5b,
    income.line6a, income.line6b,
    ...
]
```
4. **The line-name list** (`incomeLineFieldNames`, lines 1191-1207, and the equivalent tax-side list) plus **the independently hand-typed count constant** (`expectedIncomeLineCount`, currently `31`, lines 1160-1174, and the whole-report `expectedWholeReportLineCount`, currently `56`, near line 1210-1220) — BOTH must be bumped in the same change; neither line count nor field-name list is ever derived from the typedef or the returned object (AGENTS.md's core discipline, restated in this file's own docstring at lines 1165-1171).

**The `ReportLine` idiom, canonical instance** (see also the dedicated section below) — `documentLine`/`fromDocuments`/`sumBoxOverDocuments`/`addBoxSums` are ALREADY DEFINED in this file (not reimplemented per-module the way `schedule/b` reimplements them locally) — the wiring plan uses these existing exports/locals directly, it does not redefine them.

**Error-arm threading pattern, THE model for the IRA-deduction refusal (Decision 3.3/5.1)** — copy this exact early-return shape, placed BEFORE line8/line10 are built (mirroring the Schedule D absent-basis guard's placement before line 1a, lines 412-433):
```javascript
const filingScheduleD = declaredKindsOf(profile).includes('capitalGainsOrLosses')
/** @type {ScheduleDOutcome | undefined} */
const scheduleDOutcome = filingScheduleD
    ? scheduleD({ status, brokerageForms, dividendForms })
    : undefined
// The new, EARLIER error-arm guard: an absent-basis (or undecided-
// category) refusal from Form 8949/Schedule D stops the WHOLE return
// before ANY line is built — not merely line 7a — threaded exactly as
// `line16Outcome`'s error arm already is, one function over.
if (scheduleDOutcome !== undefined && scheduleDOutcome.kind === 'error') {
    return { kind: 'error', message: scheduleDOutcome.message, unmodeled: [] }
}
```
and the LATER instance, `line16Outcome`'s own error arm (lines 900-906):
```javascript
if (line16Outcome.kind === 'error') {
    return { kind: 'error', message: line16Outcome.message, unmodeled: line16Outcome.unmodeled }
}
```
For the IRA-deduction case: check `profile.value.iraDeductionDeclared === true` BEFORE calling the SSB worksheet, and if true, return `{ kind: 'error', message: '<named remedy citing Pub 590-A Worksheet 1-1>', unmodeled: [] }` — `unmodeled: []` because this is a document-data-sufficiency/interaction refusal (12.1 Decision 2.6's category), not a `fjs/return/scope` kind refusal, exactly as the Schedule D comment states (lines 421-423): "This is a document-data-sufficiency refusal ..., never a `fjs/return/scope` kind, so `unmodeled` is empty rather than naming anything."

**`Form1040Outcome`'s discriminated union** (lines 733-743) is the canonical shape for any new schedule module (Schedule 8812, the SSB worksheet) that can itself refuse — each such module should expose its own `{ kind: 'ok', ... } | { kind: 'error', message, unmodeled }`-shaped outcome type, and `Form1040Error` is `Extract<Outcome, { kind: 'error' }>` (line 749) — the exact device to copy for e.g. a hypothetical `ScheduleAOutcome`/`ScheduleAError` if Schedule A's own absent-data cases need to refuse the whole return rather than resolve to a documented zero.

**`lines?: undefined` on the error arm is load-bearing, not decorative** — read the full docstring at lines 664-724 before touching `Form1040Outcome`'s shape; if any new schedule's own outcome type needs the same "error arm carries no partial data" guarantee, use the identical `field?: undefined` trick, not a bare omission (the docstring documents exactly why bare omission silently fails to enforce this at `tsc`).

---

### `fjs/document/w2/module.f.js`, `fjs/document/1099r/module.f.js` — docstring amendment only (Decision 2.2)

**Analog:** the same two files' own existing "nothing reads them" paragraphs.

**Current w2 text to amend** (lines 18-26):
```
- **Boxes 15–20 are a repeating array, stored faithfully and never
  computed on.** One W-2 can carry several states and several localities.
  They are recorded because they are on the form, not because anything
  here reads them: this project computes a FEDERAL return, and a state
  figure that silently reached a federal line would be a wrong return.
```
This must change to state that a PROOF now reads `stateIncomeTax` (Decision 2.2: the Schedule A line 5a proof asserts the taxpayer-asserted line 5a is at least W-2 box 17 + 1099-R box 14) while COMPUTATION still never uses it — the exact "nothing computes yet" vs. "something now watches for drift" distinction the docstring itself must draw, following 12.1 Decision 2.4's "a second source is something a proof watches for drift, never the input itself" framing (already cited in 13-CONTEXT.md Decision 2.2).

**1099-R's equivalent field** is `stateTaxWithheld` inside the `stateLocal` array entries (`oneZeroNineNineRSchema`, line 107) — NOT a top-level `box14` field; the docstring amendment there should name the field precisely (`stateTaxWithheld`), since the array shape means "box 14" is not a single schema key.

**No code change to either file's `validate`/`checkReferences`** — this is a docstring-only amendment (per the phase context's own file list). Do not add a cross-document proof INSIDE these modules; the proof itself belongs in Schedule A (or wherever Decision 2.2's proof is implemented) reading these documents' already-stored fields.

## Shared Patterns

### 1. The `ReportLine` discipline — used by EVERY new/modified module

**Source:** `fjs/report/line/module.f.js` (full file read above)
**Apply to:** all new schedule/worksheet modules, all wiring in `fjs/form1040/core`

```javascript
/**
 * @typedef {{
 *   readonly value: bigint,
 *   readonly sources: readonly [Source, ...(readonly Source[])],
 *   readonly rule: string,
 * }} ReportLine
 */
```
Nothing computes a bare number. Every line — including every documented zero — is a `ReportLine` with a non-empty `sources` tuple and a `rule` string naming the printed line it implements. `declaredZero`/`profileDeclaredZeroLine`, `documentLine`/`fromDocuments`, and `totalLine`/`unionSources` (defined in `fjs/form1040/core` and reimplemented locally in schedule modules per `schedule/b`'s pattern) are the only three ways a `ReportLine` is constructed anywhere in this codebase. New modules must use one of these three, never build a `ReportLine` object literal ad hoc inline except at the specific points `fjs/form1040/core` already does (e.g. line11a/line15's own inline construction, which is itself the sanctioned shape for a line computed as an arithmetic combination of two existing lines — see `fjs/form1040/core` lines 520-525, 593-598).

### 2. Documented zero vs. scope refusal — the central distinction this whole phase turns on

**Source:** `fjs/return/scope/module.f.js` docstring (lines 1-73) and `fjs/schedule/b/module.f.js`'s Form 8815 treatment (lines 23-35, 204-206)
**Apply to:** every new schedule module (Schedule 1-A Parts II/III/IV, Schedule A's mortgage/charitable-limit lines, Schedules 1/2/3's nearly-all-zero lines)

The two are written completely differently:
- **A documented zero** is a `ReportLine` with `value: 0n`, citing the profile's `declaredKinds` box (via `profileDeclaredZeroLine`), constructed INSIDE a schedule/wiring module, with the boundary explained in THAT MODULE's own docstring (`schedule/b`: "Line 3 (Form 8815 ...) is NOT modeled this phase ... Not a silent gap").
- **A scope refusal** is built in EXACTLY ONE place, `fjs/return/scope/module.f.js`'s `scopeRefusal` function, triggered by a declared-but-unmodeled `kind`, and it refuses the WHOLE return — never a partial 1040, never a per-line refusal. `fjs/form1040/core` never itself decides to refuse based on a kind; it only threads an ALREADY-DECIDED refusal (from the scope guard, or from a document-data-sufficiency check like Schedule D's) as an error-arm return.

A line the profile CANNOT populate (no source models it, ever) is a documented zero if its kind is not declared, and its kind's presence in `declaredKinds` is what would make the SAME line's absence into a whole-return refusal instead — the module computing the line never makes that call itself.

### 3. The error-arm threading pattern (`{ kind: 'error', ... }`)

**Source:** `fjs/form1040/core/module.f.js` lines 412-433 (Schedule D absent-basis) and lines 872-906 (`line16Outcome`)
**Apply to:** the IRA-deduction refusal (Decision 3.3/5.1), any Schedule A absent-data refusal case that must refuse the whole return rather than resolve to a documented zero

```javascript
if (someOutcome !== undefined && someOutcome.kind === 'error') {
    return { kind: 'error', message: someOutcome.message, unmodeled: someOutcome.unmodeled ?? [] }
}
```
Placed as early as possible — before any line downstream of the refusing condition is built. `unmodeled: []` for a document-data-sufficiency/interaction refusal (this is not a `fjs/return/scope` kind); `unmodeled: someOutcome.unmodeled` when propagating an outcome that already carries a kind list (e.g. `line16Outcome`).

### 4. The `proof` export shape — boundary-probe idiom

**Source:** `fjs/tax/boundary/module.f.js` (full file read above), `fjs/schedule/b/module.f.js`'s `proof.thresholds.boundary` block (lines 365-424), `fjs/tax/deduction/module.f.js`'s three-probe idiom (lines 516-555)
**Apply to:** all four of this phase's phase-outs (senior deduction, SALT cap, CTC/ODC, plus any medical-floor boundary)

Two complementary levels:
1. **Generic, mechanically-generated** — add each new threshold to `fjs/tax/boundary`'s `allThresholds`, bump `expectedThresholdCount`, and the existing `segmentIndex`-based generated proof covers "is the boundary crossed at exactly this cent" for free.
2. **Specific, hand-written, per-module** — a `threshold − 1¢ / threshold / threshold + 1¢` triple asserting the SPECIFIC dollar arithmetic at that boundary (not merely "a boundary exists"), following `schedule/b`'s `interestOneCentBelowDoesNotTrigger`/`interestExactlyAtThresholdDoesNotTrigger`/`interestOneCentAboveTriggers` three-leaf shape. Both levels are required — the generic one catches a threshold silently dropped from the inventory; the specific one catches the arithmetic itself being wrong.

### 5. The parameter-with-citation shape

**Source:** `fjs/tax/params/module.f.js` (full file read above), specifically `unmodifiedParametersCite2024_40Only` (lines 445-466) and `qssParametersEqualMfjAndAreStoredIndependently` (lines 609-634)
**Apply to:** every new TY2025 parameter; the four separately-named-but-currently-equal income functions (Decision 5.6)

Every dollar figure carries its OWN `Citation` object (never a shared document-level citation), and where two values are expected to be equal FOR NOW but stored independently, the precedent is: never spread one from the other (a spread makes the equality-proof vacuous), and write a proof asserting the equality field-by-field, documented as pinning "the relationship the source states, not a tautology."

### 6. The exact-decimal money discipline

**Source:** `fjs/tax/params/module.f.js`'s `everyDollarAmountIsAStringAndRoundTrips` (lines 471-476), `fjs/document/medical_expenses/module.f.js`'s `moneyFieldError` usage (lines 134-145), AGENTS.md's "Hard rules" section
**Apply to:** every new dialect field, every new parameter, every computed line

Money in a stored JSON document is a `string`, never a JSON number, at every dialect boundary (`vnd.fjs.itemized_deductions`'s `amount` field) and every `fjs/tax/params` entry. In computation, money is integer cents as `bigint`, obtained via `centsFromString`/`centsToString` (`fjs/exact/module.f.js`), never parsed with `Number()` or `parseFloat`. A dialect's `checkReferences` re-validates every money field via `moneyFieldError`, exactly as `medical_expenses` and `w2`/`1099r` already do.

## No Analog Found

| File/Feature | Role | Data Flow | Reason |
|---|---|---|---|
| Schedule 8812 line 10's round-up-to-next-$1,000 cliff (`roundUpToNextThousandDollars`) | pure arithmetic helper | transform | No existing phase-out in this codebase rounds to a $1,000 step before applying a rate — every existing phase-out (dependent standard deduction threshold, Schedule B's $1,500 test) is a plain comparison. Must be written new; highest-risk new primitive in this phase (Decision 5.5). |
| SSB Worksheet line 8's three-way branch (MFJ / single-etc / MFS-lived-with-spouse-skip-to-line16) | control flow | transform | No existing worksheet in this codebase has a THIRD branch that skips 7 subsequent lines entirely, as opposed to merely selecting a different base amount. Model as an explicit fork per research's own guidance; no direct precedent to copy structurally, only the general "worksheet-as-named-line-functions" idiom (Pattern 1 above) applies. |
| `dependents` array → CTC/ODC classification (age + SSN validity filter/reduce) | pure computation | transform | No existing array-classification-into-two-buckets precedent in this codebase (closest is `sumBoxOverDocuments`'s flatMap-filter, which sums rather than classifies). Write as a pure filter/reduce taking the array as input, following the general "pure function over an array input" shape those helpers establish, but the specific classification logic has no line-for-line analog. |
| `dependentCount`-equals-`dependents.length` cross-field proof | validation | CRUD | The nearest existing cross-field check (`line26EstimatedTaxPayments` requires `estimatedTaxPayments` declared) checks a DIFFERENT kind of relationship (a money field requiring a companion declared kind, not an array length matching a count). Shape is close enough to reuse the `checkReferences` early-return-with-`error()` idiom, but the specific comparison is new. |
| MAGI gate proof (mechanical `grep -rn "magi" fjs/` enforcement, Decision 3.6) | build-time test/gate | batch | No existing proof in this codebase walks the `fjs/` tree's own source text for a forbidden token. `fjs/tax/boundary`'s generated-proof-over-a-list idiom is the closest structural analog (a proof built by iterating something external to the code under test — here, the file tree via a shell/fs walk — rather than iterating the code's own exports), but there is no direct file-content-scanning precedent to copy. Likely implemented as a small Node-side helper reading `fjs/` recursively and asserting no file (excluding this gate's own module, which necessarily contains the string `magi` in its own docstring/regex) contains a case-sensitive `magi` substring outside of uppercase `MAGI` occurrences. |

## Metadata

**Analog search scope:** `fjs/schedule/`, `fjs/tax/`, `fjs/document/`, `fjs/return/`, `fjs/form1040/`, `fjs/form8949/`, `fjs/report/` — the full set of directories RESEARCH.md's own "Architectural Responsibility Map" and CONTEXT.md's "Reusable Assets" named.
**Files read in full:** `fjs/schedule/b/module.f.js`, `fjs/report/line/module.f.js`, `fjs/tax/line16/qdcgt/module.f.js`, `fjs/document/medical_expenses/module.f.js`, `fjs/tax/params/module.f.js`, `fjs/tax/boundary/module.f.js`, `fjs/tax/deduction/module.f.js`.
**Files read by targeted excerpt (grep + offset/limit):** `fjs/return/profile/module.f.js`, `fjs/return/scope/module.f.js`, `fjs/form1040/core/module.f.js` (typedef block, income-lines body, tax-lines body, flattening array, line-name list, error-arm sites), `fjs/document/w2/module.f.js`, `fjs/document/1099r/module.f.js`.
**Files scanned by directory listing only (role/data-flow confirmation, not excerpted):** `fjs/schedule/d/module.f.js`, `fjs/form8949/module.f.js` (both read at line-count level; `schedule/d` and `form8949` were confirmed as secondary/role-match analogs for Schedule 8812 per the phase's own analog assignment, but `schedule/b`/`qdcgt` supplied every excerpt actually needed for the shared idioms).
**Pattern extraction date:** 2026-08-10
