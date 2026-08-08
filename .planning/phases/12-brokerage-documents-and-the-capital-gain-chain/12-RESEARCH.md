# Phase 12: Brokerage Documents - Research

**Researched:** 2026-08-07
**Domain:** IRS information-return box schemas (1099-DIV, 1099-B), Schedule B, the existing
line-16/scope-guard machinery this phase must reach into, and the Evo/CAS subject model
**Confidence:** MEDIUM-HIGH (box lists VERIFIED against fetched PDFs; the most important finding —
a load-bearing contradiction inside the locked CONTEXT — is VERIFIED against installed source, not
inferred)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Phase Boundary:** Every brokerage document the declared profile produces can be **stored and
read**, and the dividend half of the capital-gain story reaches the worksheet that **already
exists**. Four things, and nothing else:
1. `vnd.fjs.1099div` — a new dialect (DOC-06).
2. `vnd.fjs.1099b` — a new dialect, including the blank-box-1e distinction (DOC-07).
3. The consolidated-1099 document model: one PDF yields *N* typed documents with *N* subjects
   sharing one artifact hash as provenance (DOC-13).
4. Schedule B — the $1,500 threshold and the foreign-account questions (TAX-07).

**Explicitly NOT in this phase — it is Phase 12.1:** Form 8949, Schedule D, and the Schedule D Tax
Worksheet. Replacing `dispatchLine16`'s `scheduleDTaxWorksheet` refusal. That branch keeps refusing
until 12.1 lands.

**TAX-08 IS ALREADY DELIVERED. DO NOT REBUILD IT.** `fjs/tax/line16/qdcgt/module.f.js` is a complete
634-line Qualified Dividends and Capital Gain Tax Worksheet, shipped in Phase 10. This phase's job
is to make `vnd.fjs.1099div` **reach** it, and to verify the path end to end — not to write a
second one.

- TAX-08 is verified and closed, never rebuilt.
- The violated "ship the worksheet WITH the dialect" constraint is recorded, not silently dropped
  (QDCGT shipped in Phase 10 without `vnd.fjs.1099div`; the harmless ordering).
- **Box 1b flows through the EXISTING dispatch.** `dispatchLine16` already selects `qdcgt` when
  qualified dividends exceed zero; `vnd.fjs.1099div` populates that input. Do not add a second
  selection path.
- **Both new dialects model the FULL printed box list**, following Phase 11's 1099-R precedent
  rather than 1099-INT's documented MVP subset.
- A blank box 1e is modeled by ABSENCE (`option(string)`), per DOC-11 — never a sentinel, never a
  zero.
- **Criterion 2 requires a proof where treating a blank box 1e as zero CHANGES THE GAIN.**
- **DOC-13 is modeling and subject derivation ONLY.** N subjects, each recording the same artifact
  hash as provenance. No new ingestion wiring: `fjs/document/1099int/from_ocr` is already orphaned
  and booked as Phase 16.
- **Schedule B's foreign-account answers are taxpayer-DECLARED, never inferred.** They live on
  `vnd.fjs.return_profile`, not on any transcribed document.
- Every box `option(...)` (DOC-11); `corrected: option(true)` with no `false` member (DOC-12).
- `formRevision` REQUIRED and NEVER derived from `taxYear` (DOC-10).
- Money is a decimal `string` in stored JSON, never a JSON number.
- Conditional spread discipline: `...(x === undefined ? {} : { k: x })`.
- Generated proofs paired with an independently hand-typed expected count.
- `finance_schema`'s `dialectSchemas` must grow 7 -> 9 atomically.
- No new dependencies. No `any`, no cast over an indexed access, no non-null assertions.
- **"This phase STORES AND READS. It does not compute a return. It must not touch `fjs/return/`,
  and it touches `fjs/tax/` only to verify the existing QDCGT path, never to modify it."** — See
  this research's Summary, Q4, and Q5, and Assumptions Log entry A1: this constraint, read
  literally, makes criterion 1 (QDCGT reachability) and TAX-07's foreign-account questions
  unsatisfiable as stated. Flagged for explicit resolution before planning, not silently overridden.

### Claude's Discretion

- Exact field naming within each dialect (follow `1099r`/`1099int` conventions).
- Plan and wave decomposition.
- Whether Schedule B lives under `fjs/tax/` or a new `fjs/schedule/` root — the planner should
  follow whatever the existing layout most naturally extends. (Research recommends a new
  `fjs/schedule/b/` root — see Standard Stack's Alternatives Considered.)

### Deferred Ideas (OUT OF SCOPE)

- **Form 8949, Schedule D, the Schedule D Tax Worksheet, and the `scheduleDTaxWorksheet` refusal
  replacement** — Phase 12.1, deliberately split out on 2026-08-07.
- **`from_ocr` converters** for the new dialects — would grow Phase 16's orphan island.
- **Ingestion wiring for consolidated PDFs** — DOC-13 is modeled here; wiring is Phase 16.
- Two known documentation errors still open: `REQUIREMENTS.md` TAX-10's worksheet line count, and
  `ROADMAP.md` constraint 4's 1099-DIV boxes (says 2b/2d, i1040gi p31 Exception 1 says 2b, 2c AND
  2d). Constraint 4's error is directly relevant to Phase 12.1's criterion 1 — fix the source text
  during 12.1 planning, not this one.
</user_constraints>

## Summary

This phase looks, on the box-list surface, like a straightforward repeat of Phase 11's pattern: two
new dialects (`vnd.fjs.1099div`, `vnd.fjs.1099b`), a Schedule B computation, and a DOC-13 modeling
proof. The box lists were fetched directly from the IRS this session (not from recall) and hold no
surprises: 1099-DIV is unrevised since January 2024 (no drift risk), while 1099-B genuinely is
revised annually and the canonical un-suffixed URL now 404s, forcing the year-suffixed
`f1099b--2025.pdf` — the TY2025-specific revision was fetched and is what is documented below.

The load-bearing finding is not a box list. **`12-CONTEXT.md`'s own success criterion 1 — "a box
1b > 0 case reaches the already-shipped QDCGT worksheet through the existing `dispatchLine16`
selection" — is impossible to satisfy without editing `fjs/return/scope/module.f.js`, a file inside
`fjs/return/`, which the same CONTEXT document's Standing Constraints section says this phase "must
not touch."** This is not a matter of interpretation: `fjs/return/scope/module.f.js` currently
classifies `qualifiedDividends` and `ordinaryDividends` as **unmodeled**, each with the refusal
remedy text `'requires vnd.fjs.1099div (DOC-06, Phase 12)'`, and the module's own type-level
exhaustiveness check (`_EveryKindIsEitherModeledOrRefused`) makes every declared kind either
modeled or refused — there is no third state. A return profile that declares `qualifiedDividends`
today is refused by `classifyScope` before Form 1040 line 3a is ever computed, regardless of what
`vnd.fjs.1099div` stores. Reclassifying these two kinds from `unmodeledKindRefusals` to
`modeledKinds` is a small, precisely-scoped, `tsc`-forced-atomic edit — and it is the **only** way
criterion 1 can be true. The module's own docstring anticipated this exact moment ("a taxpayer who
declares dividends gets a refusal naming the missing dialect... That is the guard doing its job" —
written in Phase 10, before Phase 12 existed to fill the gap). See Q5 and the Assumptions Log for
the full analysis and a precise recommendation.

The second load-bearing finding is a companion to the first: even after `qualifiedDividends` and
`ordinaryDividends` become modeled, Form 1040 lines 3a/3b in `fjs/form1040/core/module.f.js` are
**hardcoded to `declaredZero`**, and the `dispatchLine16` call site hardcodes
`qualifiedDividendsCents: 0n` and `capitalGainDistributionsCents: 0n`. Reclassifying the scope
without also wiring these two call sites to sum `vnd.fjs.1099div` box 1b/1a across stored documents
would produce the single worst outcome this architecture exists to prevent: a return that computes
without refusing, reporting **zero** dividend income for a taxpayer who declared dividends and
stored real documents. Both edits must land together.

The third finding is that DOC-13's provenance requirement ("N subjects... each recording the same
artifact hash as provenance") **cannot** be satisfied through Evo's `parents` mechanism — verified
directly against `node_modules/functionalscript/fjs/cas/evo/module.f.js`'s `validateParentSubjects`,
which explicitly REJECTS a cross-subject parent. The N typed-form subjects this phase creates from
one consolidated artifact are, by DOC-01's own key (`payerTin`, `recipientTin`, `accountNumber`,
`taxYear`, `formType`), already guaranteed to be distinct subjects (different `formType` per
dialect) with **zero new code** — but the "shared artifact hash" half of the requirement needs a new
data field on the two new dialects, because no existing dialect schema carries one.

**Primary recommendation:** Build the two dialects and Schedule B as described below, and treat the
`fjs/return/scope` reclassification and the `fjs/form1040/core` wiring as REQUIRED, in-scope work for
this phase — not because CONTEXT explicitly authorizes touching `fjs/return/`, but because criterion
1 is unsatisfiable without it and the type-level partition makes the edit small and safe. Surface
this tension to the phase owner explicitly before planning locks it in (see Assumptions Log A1).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOC-06 | `vnd.fjs.1099div` — full box list, forces QDCGT | Q1: complete box inventory from the fetched PDF; Q5: the scope-guard and form1040 wiring gap that must close for the dialect to actually reach anything |
| DOC-07 | `vnd.fjs.1099b` — full box list including blank-box-1e distinction | Q2: complete box inventory from the fetched TY2025 PDF; the blank-1e / box-12 / box-5 relationship spelled out precisely |
| DOC-13 | Consolidated 1099 -> N typed documents, shared artifact-hash provenance | Q3: `formSubject` already produces N distinct subjects for free; the artifact-hash provenance field does NOT already exist and must be added |
| TAX-07 | Schedule B: $1,500 threshold, foreign-account questions | Q4: full line structure from the fetched TY2025 PDF; the threshold applies separately to interest and dividends; `return_profile` does not yet carry the foreign-account fields and needs them added |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `vnd.fjs.1099div` / `vnd.fjs.1099b` schema + validation | Document/Storage (pure `.f.js`, no I/O) | — | Same tier as every existing dialect (`fjs/document/*`) |
| Consolidated-artifact provenance field (DOC-13) | Document/Storage (schema field on the two new dialects) | — | A data field inside the document JSON, not an Evo-level mechanism — Evo's `parents` cannot cross subjects (Q3) |
| Schedule B computation | Tax computation (new `fjs/schedule/b/` root, per CONTEXT's own discretion note) | Document/Storage (reads stored 1099-INT/1099-DIV) | Mirrors `fjs/tax/line16/qdcgt`'s shape (printed-line-numbered pure function) without living inside `fjs/tax/`, which CONTEXT reserves for read-only verification this phase |
| Scope-guard reclassification (`qualifiedDividends`, `ordinaryDividends`: unmodeled -> modeled) | Return/Scope (`fjs/return/scope/module.f.js`) | — | Required for criterion 1 to be satisfiable at all — see Summary and Q5 |
| Form 1040 lines 3a/3b + `dispatchLine16` wiring | Form aggregation (`fjs/form1040/core/module.f.js`) | — | The companion edit to the reclassification above; without it the reclassified scope silently reports zero |
| Foreign-account declared facts | Return/Profile (`fjs/return/profile/module.f.js`) | — | CONTEXT's own Decision: taxpayer-declared, lives on `vnd.fjs.return_profile` — but the fields do not exist there yet (Q4) |

## Standard Stack

No new libraries. Entirely additive/modifying `.f.js` modules over already-installed
`functionalscript`.

### Core (already present, no install needed)
| Module | Purpose | Why it's already the standard |
|--------|---------|-------------------------------|
| `functionalscript/fjs/types/rtti/module.f.js` (`option`, `array`, `string`, `number`) | Schema primitives for both new dialects and the return-profile additions | Same primitives every existing dialect uses |
| `functionalscript/fjs/types/rtti/validate/module.f.js` | Structural validation | Same `rttiValidate(schema)` pattern |
| `functionalscript/fjs/media/revision/module.f.js`'s `isHash` | Validating the new artifact-provenance field is a real cBase32 hash | `export const isHash = (s) => cBase32ToVec(s) !== null` — already exported, already imported by `fjs/cas/evo` |
| `../base/module.f.js`, `../money_field/module.f.js` | Dialect base spread + money-box exactness check | Named reusable assets, unchanged |
| `fjs/document/subject/module.f.js`'s `formSubject` | Subject derivation for both new dialects | Already dialect-independent; needs zero changes for DOC-13 (Q3) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A new `sourceArtifactHash` field on the two new dialects only | Widening `fjs/document/base`'s shared `base()` helper | Rejected for THIS phase: widening `base()` would force a new required field onto every existing shipped dialect (1099-INT, W-2, 1099-R, SSA-1099, medical expenses, return profile), a much larger blast radius than DOC-13 needs. `base()`'s own docstring anticipates this exact question ("If a later dialect needs to widen this base, that is the signal worth revisiting") — record it as a signal, do not act on it wholesale this phase |
| Reclassifying `qualifiedDividends`/`ordinaryDividends` in `fjs/return/scope` | Leaving them unmodeled and declaring criterion 1 satisfied by unit-testing `dispatchLine16` directly (bypassing `form1040/core` and `classifyScope` entirely) | Rejected: criterion 1 says "reaches... through the existing `dispatchLine16` **selection**" — `fjs/tax/line16/module.f.js`'s own tests already exercise the dispatcher directly with hand-built inputs (Phase 10's own regression pairs). Repeating that would prove nothing NEW about Phase 12 and would leave the real gap (a stored 1099-DIV cannot reach that dispatcher at all today) undiscovered by the phase's own proofs |
| A new `fjs/schedule/b/` root for Schedule B | `fjs/tax/scheduleb/` | Either works; CONTEXT explicitly defers this to Claude's Discretion. Recommend `fjs/schedule/b/module.f.js`: CONTEXT's Standing Constraints say this phase "touches `fjs/tax/` only to verify the existing QDCGT path" — adding a brand-new subtree there, even though it is a new file rather than a modification, sits awkwardly next to that sentence, whereas a fresh `fjs/schedule/` root sidesteps the question entirely |

**Installation:** none.

**Version verification:**
```
$ node -p "require('./package.json').dependencies.functionalscript"
^0.43.1
$ node -p "require('./package-lock.json').packages['node_modules/functionalscript'].version"
0.43.1
```
Both agree — no drift trap this session. `[VERIFIED: read directly, 2026-08-07]`

## Architecture Patterns

### System Architecture Diagram

```
                    ┌───────────────────────────────┐
                    │  Agent (vision pass on a       │
                    │  consolidated 1099 statement)  │
                    └───────────────┬────────────────┘
                                    │ emits N typed JSON blobs, each
                                    │ carrying sourceArtifactHash (NEW field)
                    ┌───────────────┼────────────────────┬──────────────────┐
                    ▼               ▼                    ▼                  ▼
           evo_add: subject   evo_add: subject     evo_add: subject   evo_add(existing):
           formSubject(       formSubject(         formSubject(       vnd.fjs.return_profile,
           1099div key)       1099b key)           1099int key)       declaredKinds += 
                    │               │                    │            ['qualifiedDividends',
                    ▼               ▼                    ▼             'ordinaryDividends', ...]
           ┌─────────────────────────────────────────────────┐              │
           │   Evo cache (host-side): N DISTINCT subjects,    │              │
           │   same (payerTin,recipientTin,accountNumber,     │              │
           │   taxYear), different formType per dialect       │◀─────────────┘
           └──────────────────────┬──────────────────────────┘
                                   │ finance_documents_list (Phase 11, unchanged)
                                   │ finance_schema (Phase 7, +2 dialects)
                                   ▼
           ┌───────────────────────────────────────────────────────────┐
           │  fjs/form1040/core: form1040IncomeLines                   │
           │  line3a = fromDocuments(sumBoxOverDocuments(dividendForms)│
           │             ('box1bQualifiedDividends'))  <- NEW WIRING   │
           │  line3b = fromDocuments(sumBoxOverDocuments(dividendForms)│
           │             ('box1aTotalOrdinaryDividends')) <- NEW WIRING│
           └──────────────────────┬──────────────────────────────────┘
                                   │ income.line3a.value, income.line3b.value
                                   ▼
           ┌───────────────────────────────────────────────────────────┐
           │  fjs/form1040/core: form1040TaxAndPaymentLines             │
           │  dispatchLine16({ ..., qualifiedDividendsCents:            │
           │    income.line3a.value })  <- NEW WIRING (was hardcoded 0n)│
           └──────────────────────┬──────────────────────────────────┘
                                   │ level 2c: qualifiedDividendsCents > 0n
                                   ▼
           ┌───────────────────────────────────────────────────────────┐
           │  fjs/tax/line16/qdcgt (ALREADY SHIPPED, Phase 10)          │
           │  the 25-line worksheet, calls back into baseTaxForAmount   │
           └───────────────────────────────────────────────────────────┘

           Separately, read-only:
           ┌────────────────────────┐      ┌───────────────────────────┐
           │ fjs/schedule/b (NEW)    │◀─────│ stored 1099-INT + 1099-DIV │
           │ Part I/II sums, $1,500  │      │ documents (sum box1/box3   │
           │ threshold, Part III     │      │ interest; box1a dividends) │
           │ echoes return_profile's │      └───────────────────────────┘
           │ foreign-account fields  │◀─────│ vnd.fjs.return_profile     │
           │ (NEW fields, Q4)        │      │ (foreign-account fields    │
           └────────────────────────┘      │  added this phase)         │
                                            └───────────────────────────┘
```

### Recommended Project Structure
```
fjs/document/
├── 1099div/
│   └── module.f.js       # vnd.fjs.1099div — DOC-06
├── 1099b/
│   └── module.f.js       # vnd.fjs.1099b — DOC-07
fjs/schedule/
├── b/
│   └── module.f.js       # Schedule B — TAX-07
fjs/return/
├── profile/
│   └── module.f.js       # MODIFIED — foreign-account fields added (Q4)
├── scope/
│   └── module.f.js       # MODIFIED — qualifiedDividends/ordinaryDividends reclassified (Q5)
fjs/form1040/
├── core/
│   └── module.f.js       # MODIFIED — line3a/3b wiring, dispatchLine16 call site (Q5)
fjs/server/
├── finance_schema/
│   └── module.f.js       # MODIFIED — dialectSchemas grows 7 -> 9 atomically
```

### Pattern 1: The four-stage dialect template (unchanged, reused verbatim)
**What:** dialect -> mediaType -> RTTI schema -> structural `validate` -> semantic
`checkReferences` -> composed `validate`, exactly as `fjs/document/1099r/module.f.js` does.
**When to use:** both new dialects, no deviation.
**Example (1099-DIV, full box list, following the 1099-R full-printed-box precedent per CONTEXT's
own decision "both new dialects model the FULL printed box list"):**
```js
// Source: fjs/document/1099r/module.f.js pattern, boxes from
// https://www.irs.gov/pub/irs-pdf/f1099div.pdf (Rev. January 2024), fetched 2026-08-07
const oneZeroNineNineDivSchema = /** @type {const} */ ({
    ...base(dialect),
    payerTin: string,
    recipientTin: string,
    accountNumber: string,
    taxYear: number,
    formRevision: string,
    corrected: option(true),
    sourceArtifactHash: string,                    // NEW — DOC-13 provenance, see Q3
    box1aTotalOrdinaryDividends: option(string),
    box1bQualifiedDividends: option(string),
    box2aTotalCapitalGainDistr: option(string),
    box2bUnrecapSec1250Gain: option(string),
    box2cSection1202Gain: option(string),
    box2dCollectibles28PercentGain: option(string),
    box2eSection897OrdinaryDividends: option(string),
    box2fSection897CapitalGain: option(string),
    box3NondividendDistributions: option(string),
    box4FederalIncomeTaxWithheld: option(string),
    box5Section199ADividends: option(string),
    box6InvestmentExpenses: option(string),
    box7ForeignTaxPaid: option(string),
    box8ForeignCountryOrUsPossession: option(string),
    box9CashLiquidationDistributions: option(string),
    box10NoncashLiquidationDistributions: option(string),
    box11FatcaFilingRequirement: option(true),
    box12ExemptInterestDividends: option(string),
    box13SpecifiedPrivateActivityBondInterestDividends: option(string),
    stateLocal: option(array(stateEntry)),          // boxes 14-16 — NO local box on 1099-DIV
    payerName: option(string),
    recipientName: option(string),
})
```

### Pattern 2: Reclassifying a declared kind in the scope guard (`tsc`-forced-atomic)
**What:** move a `Kind` member out of `unmodeledKindRefusals` and into `modeledKinds` in one commit.
**When to use:** exactly this phase, for `qualifiedDividends` and `ordinaryDividends` (required),
and optionally `capitalGainDistributions` (discretionary — see Q5).
**Example:**
```js
// Source: fjs/return/scope/module.f.js, pattern for the required edit
export const modeledKinds = /** @type {const} */ ([
    'wages', 'taxExemptInterest', 'taxableInterest',
    'federalTaxWithheldOnW2', 'federalTaxWithheldOn1099Int', 'estimatedTaxPayments',
    'qualifiedDividends',   // NEW — removed from unmodeledKindRefusals in the same commit
    'ordinaryDividends',    // NEW — removed from unmodeledKindRefusals in the same commit
])
```
`_EveryKindIsEitherModeledOrRefused` (a `tsc`-level `Assert<Equal<...>>`) makes a HALF-done edit —
adding to one list without removing from the other — fail the build before a single test runs. This
is the same mechanism `finance_schema`'s `dialectSchemas` atomicity note describes, one layer over.

### Anti-Patterns to Avoid
- **Reclassifying the scope without wiring `form1040/core`'s line3a/3b:** produces a return that
  computes a wrong number (silent zero) instead of refusing loudly — strictly worse than today's
  refusal, and the exact failure mode TAX-16 exists to prevent, self-inflicted.
- **Widening `fjs/document/base` for the artifact-provenance field:** touches every existing
  shipped dialect for a need only the two new ones have this phase (see Standard Stack table).
- **Deriving the 8949-category letter (A-F) by re-implementing the mapping logic in this phase's
  dialect:** `vnd.fjs.1099b`'s "Applicable checkbox on Form 8949" is a field the PAYER already
  prints on the form (a letter A-F) — store it verbatim as `option(string)`, do not derive it from
  box 2 + box 12 combinations. That derivation, if ever needed, belongs to Phase 12.1's Form 8949
  categorization logic, not to this phase's storage-only dialect.
- **Treating a blank box 1e as evidence the basis is zero:** box 1e can be blank AND non-blank
  amounts in box 1e can still be UNREPORTED to the IRS (governed by box 12, "Check if basis
  reported to IRS," and box 5, "Check if noncovered security" — see Q2's box-1e analysis).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subject derivation for N form-types from one artifact | A new consolidated-artifact subject scheme | `fjs/document/subject`'s existing `formSubject`, called once per extracted form with `formType` set to that dialect's own tag | Already produces N distinct subjects for free — verified, zero code change needed (Q3) |
| Validating the new artifact-hash field is a real hash | A new hash-format regex/validator | `isHash` from `functionalscript/fjs/media/revision/module.f.js` (already exported, already used by `fjs/cas/evo`) | Same validation `fjs/media/revision`'s own `checkReferences` uses for `parents`/`snapshot` |
| Exact-decimal money validation for the new dialects' money boxes | A new per-dialect check | `../money_field/module.f.js`'s `moneyFieldError` | Shared across every existing dialect; note boxes 8-11 on 1099-B CAN be negative (profit OR loss) — `moneyFieldError` already accepts negatives (proven in its own `negativeAccepted` leaf) |
| Schedule B's per-payer listing | A rewrite of the box-sum aggregation idiom | `fjs/form1040/core`'s `sumBoxOverDocuments`/`documentLine` idiom, reused for Schedule B's own lines 1-6 | Same DOC-11 "absent box skipped, never defaulted" discipline already proven there |

**Key insight:** almost everything DOC-13 needs already exists and needs a proof, not new structure
— exactly as CONTEXT hoped. The one piece that is missing (artifact-hash provenance) is missing
because no existing dialect has ever needed to express "I am one of several forms extracted from
the same physical document," not because the subject/base machinery is incomplete for its existing
job.

## Q1 — Form 1099-DIV: the complete box inventory, from the fetched PDF

**Source, fetched and read directly this session:** `https://www.irs.gov/pub/irs-pdf/f1099div.pdf`
— **Rev. January 2024**, printed "Form 1099-DIV (Rev. 1-2024)". `[VERIFIED: fetched PDF, read
directly, 2026-08-07]`. Cross-checked via `WebSearch`: "Form 1099-DIV and these instructions have
been converted from an annual revision to continuous use" — i.e., unlike 1099-R and 1099-B, this
form is **not** revised every year, and January 2024 is confirmed current for TY2025 use.
`[VERIFIED: IRS instructions page i1099div, cross-referenced]`. **No revision-drift risk found for
this dialect** — a contrast worth recording precisely because Phase 11 and this same phase's 1099-B
half both DO carry drift risk.

### Complete box inventory

| Box | Label as printed | Kind | Repeating (state/local)? |
|---|---|---|---|
| — | VOID (Copy A only) | checkbox | no — not modeled, same precedent as every other dialect |
| — | CORRECTED / "CORRECTED (if checked)" | checkbox | no — `corrected: option(true)` |
| — | PAYER'S name, address | free text | no — `payerName: option(string)` |
| — | PAYER'S TIN | free text | no — `payerTin: string` (subject key) |
| — | RECIPIENT'S TIN | free text | no — `recipientTin: string` (subject key) |
| — | RECIPIENT'S name, address | free text | no — `recipientName: option(string)` |
| — | Account number (see instructions) | free text | no — `accountNumber: string` (subject key; may be `''`) |
| — | 2nd TIN not. | checkbox | no — filer-only, **not modeled** (mirrors 1099-B's identical box; no computation reads it) |
| 1a | Total ordinary dividends | money | no |
| 1b | Qualified dividends | money | no — **flagged: drives the QDCGT selection (Q5)** |
| 2a | Total capital gain distr. | money | no — **flagged: forces the QDCGT level-2d path OR the Schedule D chain, see Q5's discretionary note** |
| 2b | Unrecap. Sec. 1250 gain | money | no — **flagged: forces the Schedule D Tax Worksheet, Phase 12.1** |
| 2c | Section 1202 gain | money | no — **flagged: forces Schedule D, Phase 12.1** (already a separate `Kind` in `return_profile`, correctly still unmodeled) |
| 2d | Collectibles (28%) gain | money | no — **flagged: forces the Schedule D Tax Worksheet, Phase 12.1** |
| 2e | Section 897 ordinary dividends | money | no — foreign-persons-only per the instructions; store, do not compute |
| 2f | Section 897 capital gain | money | no — same |
| 3 | Nondividend distributions | money | no |
| 4 | Federal income tax withheld | money | no |
| 5 | Section 199A dividends | money | no |
| 6 | Investment expenses | money | no |
| 7 | Foreign tax paid | money | no |
| 8 | Foreign country or U.S. possession | free text | no |
| 9 | Cash liquidation distributions | money | no |
| 10 | Noncash liquidation distributions | money | no |
| 11 | FATCA filing requirement | checkbox | no |
| 12 | Exempt-interest dividends | money | no |
| 13 | Specified private activity bond interest dividends | money | no |
| 14 | State | free text | **yes** |
| 15 | State identification no. | free text | **yes** |
| 16 | State tax withheld | money | **yes** |

**No locality boxes exist on 1099-DIV** — unlike W-2 and 1099-R, the state/local repeating group
here is state-only (boxes 14-16). `stateEntry` should be a smaller shape than `1099r`'s
`stateLocalEntry` — no `localityName`/`localTaxWithheld`/`localDistribution` fields, since the
printed form has no such boxes to hold them.

**Box 8 is free text (a country name), not money** — it should NOT be walked by the money-box
exactness loop. Its own instruction: "This box should be left blank if a RIC reported the foreign
tax shown in box 7," i.e., boxes 7 and 8 are mutually informative but neither derives the other —
store both as printed, compute nothing.

## Q2 — Form 1099-B: the complete box inventory, from the fetched TY2025-specific PDF

**Sources, fetched and read directly this session:**
- `https://www.irs.gov/pub/irs-pdf/f1099b--2025.pdf` — the year-specific TY2025 revision (the form
  itself prints the literal year "2025" prominently, not a "Rev. Month Year" string). `[VERIFIED:
  fetched PDF, read directly, 2026-08-07]`
- **The canonical un-suffixed URL, `https://www.irs.gov/pub/irs-pdf/f1099b.pdf`, returned HTTP 404
  this session** — confirmed via a direct fetch. `[VERIFIED: fetched, 404 observed directly]` This
  is itself the drift-risk finding the phase brief asked to watch for, in a different shape than
  Phase 11's: rather than serving a NEWER revision under the stable name, the IRS's current
  1099-B distribution scheme requires the year-suffixed URL (`f1099b--<year>.pdf`) with no
  un-suffixed alias at all. A researcher who assumed the canonical-URL convention from 1099-R/1099-DIV
  would get a 404, not a silently wrong year.
- `https://www.irs.gov/pub/irs-prior/i1099b--2026.pdf` — the 2026 Instructions for Form 1099-B,
  fetched to check for box-numbering changes into the following year. Found: address-field-format
  changes only (individual entry boxes for payer/recipient address), **no box-number or box-meaning
  changes** identified between the TY2025 form and the 2026 instructions' description. `[VERIFIED:
  fetched, cross-referenced; MEDIUM confidence on completeness of this negative claim — the 2026
  form face itself was not separately located and fetched this session]`

### Complete box inventory (TY2025 revision)

| Box | Label as printed | Kind | Repeating? |
|---|---|---|---|
| — | VOID / CORRECTED (if checked) | checkbox | no |
| — | PAYER'S / RECIPIENT'S name, address, TIN | free text | no (TINs are subject keys) |
| — | Account number (see instructions) | free text | no — subject key, may be `''` |
| — | 2nd TIN not. | checkbox | no — filer-only, not modeled |
| — | CUSIP number | free text | no |
| — | FATCA filing requirement | checkbox | no |
| — | **Applicable checkbox on Form 8949** | free text/code (A/B/C/D/E/F, printed by the payer) | no — store verbatim, see Anti-Patterns |
| 1a | Description of property | free text | no |
| 1b | Date acquired | date (free text — no date primitive in this project) | no — **may be blank if box 5 is checked, or if securities were acquired on a variety of dates** |
| 1c | Date sold or disposed | date (free text) | no |
| 1d | Proceeds | money | no |
| 1e | Cost or other basis | money | no — **THE LOAD-BEARING BOX. See analysis below.** |
| 1f | Accrued market discount | money | no — may be blank if box 5 checked |
| 1g | Wash sale loss disallowed | money | no — may be blank if box 5 checked |
| 2 | Short-term gain or loss / Long-term gain or loss / Ordinary | THREE separate checkboxes | no — may all be blank if box 5 checked |
| 3 | Check if proceeds from: Collectibles / QOF | TWO separate checkboxes | no |
| 4 | Federal income tax withheld | money | no |
| 5 | Check if noncovered security | checkbox | no — **governs which other boxes may legitimately be blank** |
| 6 | Reported to IRS: Gross proceeds / Net proceeds | TWO separate checkboxes | no |
| 7 | Check if loss is not allowed based on amount in 1d | checkbox | no |
| 8 | Profit or (loss) realized in 2025 on closed contracts | money, **can be negative** | no |
| 9 | Unrealized profit or (loss) on open contracts — 12/31/2024 | money, can be negative | no |
| 10 | Unrealized profit or (loss) on open contracts — 12/31/2025 | money, can be negative | no |
| 11 | Aggregate profit or (loss) on contracts | money, can be negative | no |
| 12 | Check if basis reported to IRS | checkbox | no — **THE OTHER HALF of the box-1e story** |
| 13 | Bartering | money | no |
| 14 | State name | free text | **yes** |
| 15 | State identification no. | free text | **yes** |
| 16 | State tax withheld | money | **yes** |

**No locality boxes on 1099-B either** — boxes 14-16 are state-only, same shape as 1099-DIV, not
1099-R's fuller state+local group.

### Box 1e, exactly, per the fetched instructions

**"Box 1e. Shows the cost or other basis of securities sold... If box 5 is checked, box 1e may be
blank."** `[VERIFIED: f1099b--2025.pdf Copy B "Instructions for Recipient", read directly]`

The instructions do **not** say "a blank box 1e means basis was not reported to the IRS" in so many
words. What they establish, read together, is a THREE-WAY distinction that the phase brief's
framing ("blank means not reported, which is not zero") is the right shape for but slightly
undersells the mechanism:

1. **Box 1e present, box 12 checked** — a basis figure IS printed and it WAS reported to the IRS.
   The safest case: a filer can generally use it directly (subject to the "Ordinary" box-2
   adjustment note).
2. **Box 1e present, box 12 NOT checked** — a basis figure is printed but it was **not** reported
   to the IRS. This is the case the phase brief's framing is most precisely about: a present,
   non-blank dollar amount that is still NOT authoritative to the IRS's own copy of the return.
3. **Box 1e blank** — most commonly co-occurring with box 5 checked (a noncovered security): "the
   securities sold were noncovered securities and boxes 1b, 1e, 1f, 1g, and 2 **may be blank**."
   The instructions list five specific noncovered-security categories (stock purchased before
   2011, most mutual fund stock before 2012, dividend-reinvestment-plan stock before 2012, debt
   acquired before 2014, options/securities-futures before 2014) as *why* a broker commonly has no
   basis to report at all.

**Model both box 1e (money, `option(string)`) and box 12 (checkbox, `option(true)`) as independent
fields — never derive one from the other's absence.** Case 2 above is exactly the scenario CONTEXT's
"a proof where treating a blank box 1e as zero CHANGES THE GAIN" cannot discharge by itself if box
1e is merely blank: the more subtle and more common real-world case is box 1e **present** with box
12 **absent**, where a naively-trusting reader would still compute the correct number by using the
printed 1e — the actual risk this box-pair exists to flag is a DOWNSTREAM Form 8949 adjustment
requirement (Phase 12.1's problem), not this phase's gain computation. For THIS phase's proof
(criterion 2 — "treating a blank box 1e as zero changes the gain"), the relevant case is box 1e
genuinely ABSENT (case 3): `gain = proceeds - basis` computed with `basis = 0` (wrong) versus
`basis` genuinely absent, meaning no gain/loss figure can be computed AT ALL from this document
alone. Model this as: the dialect stores `box1eCostOrOtherBasis: option(string)`, and **this phase
does not compute a gain** (that is Phase 12.1's Form 8949 job) — so criterion 2's proof is a
DIALECT-LEVEL proof (validate/read back), not a tax-computation proof: show a small pure helper
(local to the proof, not exported production code, since this phase does not compute) that
naively treats absence as `'0.00'` and demonstrates the resulting "gain" differs from the true
(unknown / unrepresentable) gain. See Validation Architecture below for the exact shape.

### Box 5, box 2, and the 8949-category checkbox, precisely

Per the fetched instructions: **"Box 5. If checked, the securities sold were noncovered securities
and boxes 1b, 1e, 1f, 1g, and 2 may be blank."** The six noncovered-security categories are listed
verbatim in the instructions (stock purchased before 2011; most mutual fund stock before 2012;
dividend-reinvestment-plan stock before 2012; debt acquired before 2014; options/securities-futures
before 2014). Store this list nowhere in code — it is recipient-facing prose, not a computation
input.

**"Applicable checkbox on Form 8949"** is a printed field near the top of the form, filled in by the
payer, indicating which of Form 8949's six category letters (A-F) the transaction belongs to. The
instructions state only: "Indicates where to report this transaction on Form 8949 and Schedule D
(Form 1040)... See the instructions for your Schedule D (Form 1040) and/or Form 8949." Model this as
`applicableCheckboxOnForm8949: option(string)` — store the printed letter verbatim, never derive it
from boxes 2/5/12 in this phase (see Anti-Patterns).

## Q3 — DOC-13: one consolidated 1099 -> N typed documents

**Files read directly:** `fjs/document/subject/module.f.js`, `node_modules/functionalscript/fjs/cas/evo/module.f.js`.

### How one artifact hash becomes N subjects — already works, verified

`formSubject`'s key is `(payerTin, recipientTin, accountNumber, taxYear, formType)`. For a
consolidated brokerage statement covering one account, `payerTin`/`recipientTin`/`accountNumber`/
`taxYear` are IDENTICAL across the 1099-DIV section and the 1099-B section of that same statement —
only `formType` differs (`'vnd.fjs.1099div'` vs `'vnd.fjs.1099b'`, matching each dialect's own
`dialect` constant, per the established convention in
`fjs/document/1099int/from_ocr/module.f.js:151` — `const formType = 'vnd.fjs.1099int'`). Because
`formType` is one of the five key fields, and `formSubject` encodes the five as a
`JSON.stringify`-array (collision-resistant, proven in `subject/module.f.js`'s own
`delimiterCollisionResistance` leaf), two form types under the same account **automatically**
produce two distinct subject strings. **Zero changes needed to `fjs/document/subject/module.f.js`
for this half of DOC-13.**

### The subject key for a 1099-DIV vs. a 1099-B section of the same statement, concretely

Given a consolidated statement for payer TIN `12-3456789`, recipient TIN `987-65-4321`, account
`ACC-001`, tax year 2025:
```
1099-DIV subject: ["vnd.fjs.1099div","2025","12-3456789","987-65-4321","ACC-001"]
1099-B subject:   ["vnd.fjs.1099b","2025","12-3456789","987-65-4321","ACC-001"]
```
Two distinct, deterministic strings — proven by the existing `formSubjectIsDeterministic` /
`changingOneField.formType` leaves in `subject/module.f.js`, which already demonstrate that
changing `formType` alone (holding the other four fixed) changes the resulting subject. **The
existing machinery already proves the property DOC-13 asks for; this phase's job for this half is a
NEW proof exercising it with the two real dialects, not new code.**

### How the shared artifact-hash provenance is recorded — does NOT already work, verified

DOC-01's "artifact chain... rooted at the cBase32 hash of the original artifact" is a SEPARATE,
PARALLEL identity from the extracted-form subject: `artifactSubject(hash) = hash` roots the raw
bytes' OWN Evo revision chain (used for `vnd.fjs.ocr`), while `formSubject(...)` roots each typed
form's chain. **Nothing links the two today.** The obvious candidate — recording the artifact's
subject/hash as an Evo `parents` entry on the typed document's own revision — is structurally
**rejected**: `node_modules/functionalscript/fjs/cas/evo/module.f.js`'s `validateParentSubjects`
explicitly checks "that every already-resolved parent belongs to `subject`" and returns
`error('parent belongs to a different subject...')` otherwise, with a docstring stating why: "a
parent from a different subject would silently graft the new revision... onto an unrelated object's
history." `[VERIFIED: read directly, lines 226-239]`

**Consequence:** the shared artifact hash must be recorded as an ordinary DATA FIELD inside each
typed document's own JSON payload — not through the Evo revision graph. No existing dialect has
such a field (`fjs/document/base/module.f.js`'s `base()` returns only `{ dialect }`).
**Recommendation:** add `sourceArtifactHash: string` (required — every real document is, in
principle, extracted from SOME artifact, consolidated or not, so there is no legitimate case for
omitting it on a NEW dialect with no legacy instances) to `vnd.fjs.1099div` and `vnd.fjs.1099b`
specifically, validated in `checkReferences` via the already-exported `isHash` from
`functionalscript/fjs/media/revision/module.f.js`. Do **not** widen the shared `base()` helper this
phase (see Standard Stack's Alternatives table) — that is a signal for a later phase once a third or
fourth dialect needs the same field, per `base()`'s own docstring.

### DOC-13's proof, concretely

A proof should construct two documents (a 1099-DIV and a 1099-B instance) sharing:
- the same `sourceArtifactHash`
- the same `(payerTin, recipientTin, accountNumber, taxYear)`

...and assert `formSubject({ ...divFields, formType: 'vnd.fjs.1099div' }) !==
formSubject({ ...bFields, formType: 'vnd.fjs.1099b' })` while both documents' own
`sourceArtifactHash` fields are `===`-equal — proving "N subjects, one shared provenance hash" in
one assertion pair, entirely at the dialect/subject level, no ingestion tool required.

## Q4 — TAX-07: Schedule B

**Source, fetched and read directly this session:** `https://www.irs.gov/pub/irs-pdf/f1040sb.pdf` —
**2025 revision**, printed "Schedule B (Form 1040) 2025... Created 4/23/25". `[VERIFIED: fetched
PDF, read directly, 2026-08-07]` This is exactly the declared taxpayer profile's tax year — no
drift risk found.

### Complete line structure, verbatim

**Part I — Interest**
- Line 1: "List name of payer. If any interest is from a seller-financed mortgage and the buyer
  used the property as a personal residence, see the instructions and list this interest first.
  Also, show that buyer's social security number and address" — a repeating (payer name, amount)
  list, printed as roughly 13 blank rows.
- Line 2: "Add the amounts on line 1."
- Line 3: "Excludable interest on series EE and I U.S. savings bonds issued after 1989. Attach Form
  8815."
- Line 4: "Subtract line 3 from line 2. Enter the result here and on Form 1040 or 1040-SR, line
  2b." **Note directly beneath: "If line 4 is over $1,500, you must complete Part III."**

**Part II — Ordinary Dividends**
- Line 5: "List name of payer" — a repeating (payer name, amount) list.
- Line 6: "Add the amounts on line 5. Enter the total here and on Form 1040 or 1040-SR, line 3b."
  **Note directly beneath: "If line 6 is over $1,500, you must complete Part III."**

**Part III — Foreign Accounts and Trusts**
Header text, verbatim: *"You must complete this part if you (a) had over $1,500 of taxable interest
or ordinary dividends; (b) had a foreign account; or (c) received a distribution from, or were a
grantor of, or a transferor to, a foreign trust."*
- Line 7a: "At any time during 2025, did you have a financial interest in or signature authority
  over a financial account (such as a bank account, securities account, or brokerage account)
  located in a foreign country? See instructions" [Yes/No] — followed immediately, same line group:
  "If 'Yes,' are you required to file FinCEN Form 114, Report of Foreign Bank and Financial Accounts
  (FBAR), to report that financial interest or signature authority? See FinCEN Form 114 and its
  instructions for filing requirements and exceptions to those requirements" [Yes/No] — **this is
  TWO separate Yes/No sub-questions under one line label.**
- Line 7b: "If you are required to file FinCEN Form 114, list the name(s) of the foreign
  country(-ies) where the financial account(s) is (are) located:" — free text.
- Line 8: "During 2025, did you receive a distribution from, or were you the grantor of, or
  transferor to, a foreign trust? If 'Yes,' you may have to file Form 3520. See instructions" [Yes/No]

### The $1,500 threshold, resolved precisely (this is the common-error trap the phase brief named)

**The threshold applies SEPARATELY to interest and to dividends, not to their combined total.** The
form prints two independent notes — "If line 4 is over $1,500..." beneath Part I, and "If line 6 is
over $1,500..." beneath Part II — each triggering Part III on its own. Part III's own header text
("over $1,500 of taxable interest **or** ordinary dividends") restates this as a disjunction, not a
combined sum: exceeding $1,500 in EITHER category alone requires Part III, and a taxpayer with
$1,000 of interest and $1,000 of dividends (combined $2,000, neither individually over $1,500) does
**not** trigger Part III on the threshold grounds (though a foreign account or foreign trust would
still trigger it independently). **This is the exact error the phase brief flagged as common — get
it right: two separate $1,500 tests, never a summed test.**

Schedule B is required (per the form's own structure) whenever **any** of: (a) Part I's line 4
exceeds $1,500, (b) Part II's line 6 exceeds $1,500, (c) a foreign financial account exists, or (d)
a foreign trust distribution/grantor/transferor relationship exists in the tax year. Below all four
thresholds, Schedule B is optional (the totals still flow to 1040 lines 2b/3b either way, computed
without the schedule).

### Return-profile support for foreign-account declared facts — does NOT already exist, verified

`fjs/return/profile/module.f.js`'s `returnProfileSchema` was read in full this session. It carries
NO field resembling "foreign account," "FBAR," "FinCEN," or "foreign trust." **CONTEXT's Decision
that these answers "live on `vnd.fjs.return_profile`" describes an intended design, not a shipped
one — the fields must be ADDED this phase.** Recommended additive fields (all `option()`, per DOC-12's
convention, since these are checkboxes/free-text the taxpayer may leave unanswered on a return where
Part III does not apply):
```js
// New fields on returnProfileSchema, additive (existing stored profiles remain valid —
// every new field is option())
hadForeignFinancialAccount: option(true),               // Schedule B line 7a, part 1
requiredToFileFinCen114: option(true),                   // Schedule B line 7a, part 2
foreignAccountCountries: option(array(string)),          // Schedule B line 7b
receivedForeignTrustDistributionOrWasGrantorOrTransferor: option(true), // Schedule B line 8
```
This is an edit to `fjs/return/profile/module.f.js`, a file inside `fjs/return/` — the SAME tension
flagged in the Summary and Q5 for `fjs/return/scope`. See Assumptions Log A1.

## Q5 — What the existing QDCGT worksheet needs as input, and the wiring gap

**Files read directly:** `fjs/tax/line16/qdcgt/module.f.js`, `fjs/tax/line16/module.f.js`,
`fjs/return/scope/module.f.js`, `fjs/form1040/core/module.f.js`.

### The exact shape `qdcgt` expects

```js
// fjs/tax/line16/qdcgt/module.f.js — QdcgtInput
{
    status: IndividualFilingStatus,
    line1Cents: bigint,        // Form 1040 line 15 (taxable income)
    line2Cents: bigint,        // Form 1040 line 3a (qualified dividends)
    filingScheduleD: boolean,
    scheduleD15Cents: bigint,  // out of scope this phase (Phase 12.1)
    scheduleD16Cents: bigint,  // out of scope this phase (Phase 12.1)
    line7aCents: bigint,       // Form 1040 line 7a (capital gain distributions, if not filing Sch D)
}
```

### How `dispatchLine16` decides to select it

`fjs/tax/line16/module.f.js`'s `Line16Inputs` carries `qualifiedDividendsCents` and
`capitalGainDistributionsCents` as top-level facts. `qdcgtOutcome()` is invoked from THREE distinct
printed conditions (2c/2d/2e), and it always builds the FULL `QdcgtInput` regardless of which
condition fired — `line2Cents: qualifiedDividendsCents` and `line7aCents:
capitalGainDistributionsCents` are populated unconditionally:
- **2c**: `qualifiedDividendsCents > 0n` — the box-1b case criterion 1 names directly.
- **2d**: `!filingScheduleD && capitalGainDistributionsCents > 0n` — the box-2a-only case (no
  Schedule D needed), discretionary for this phase (see below).
- **2e**: `filingScheduleD && scheduleD15Cents > 0n && scheduleD16Cents > 0n` — needs Schedule D,
  out of scope (Phase 12.1).

### The wiring gap, exactly, verified against `fjs/form1040/core/module.f.js`

```js
// fjs/form1040/core/module.f.js, form1040IncomeLines — TODAY:
const line3a = declaredZero('1040 line 3a') // qualified dividends
const line3b = declaredZero('1040 line 3b') // ordinary dividends
```
```js
// fjs/form1040/core/module.f.js, form1040TaxAndPaymentLines — TODAY:
const line16Outcome = dispatchLine16(taxParamSet)({
    status,
    taxableIncomeCents: income.line15.value,
    qualifiedDividendsCents: 0n,          // HARDCODED
    capitalGainDistributionsCents: 0n,    // HARDCODED
    filingScheduleD: false,
    // ...
})
```
Both are **verified as hardcoded** at this session's reading (lines ~386-387 and ~752-767). Neither
value can ever become nonzero through the real Form 1040 aggregation path today, regardless of what
`vnd.fjs.1099div` documents exist in the store. This is separate from, and in addition to, the
scope-guard reclassification (a return declaring `qualifiedDividends` is refused before reaching
this code at all — Q5's other half, below).

### And the scope-guard finding, exactly, verified against `fjs/return/scope/module.f.js`

```js
// fjs/return/scope/module.f.js — TODAY, in unmodeledKindRefusals (44 entries):
{ kind: 'qualifiedDividends', line: '1040 line 3a', label: 'qualified dividends',
  remedy: 'requires vnd.fjs.1099div (DOC-06, Phase 12)' },
{ kind: 'ordinaryDividends', line: '1040 line 3b', label: 'ordinary dividends',
  remedy: 'requires vnd.fjs.1099div (DOC-06, Phase 12)' },
```
The module's own docstring states the reasoning explicitly and by name: *"a taxpayer who declares
qualified dividends gets a refusal naming the missing dialect instead of a number derived from a
document nobody could ingest. That is the guard doing its job."* This sentence was written in Phase
10, before `vnd.fjs.1099div` existed — it describes the state of affairs **before** this phase, not
a permanent one. `_EveryKindIsEitherModeledOrRefused` (a `tsc`-level `Assert<Equal<Kind, ModeledKind
| UnmodeledKind>>`) means these two kinds cannot be left in an intermediate state: they are either in
`unmodeledKindRefusals` (refusing every dividend-declaring return, making criterion 1 permanently
unreachable through the real 1040 path) or in `modeledKinds` (requiring the `form1040/core` wiring
above to actually be correct, not merely absent-of-a-refusal).

**Recommendation:** move `qualifiedDividends` and `ordinaryDividends` from `unmodeledKindRefusals`
into `modeledKinds` (both required — Schedule B needs `ordinaryDividends`' box-1a sum regardless of
box 1b, and criterion 1 needs `qualifiedDividends`), update the paired hand-typed counts
(`expectedModeledKindCount` 6->8, `expectedUnmodeledKindCount` 44->42) in the same commit, and wire
`form1040/core`'s line3a/3b and the `dispatchLine16` call site to the new dialect's box sums, in the
SAME commit as the reclassification (never split across commits — an interval where the scope is
open but the wiring is not would compute silent zeros).

`capitalGainDistributions` (1099-DIV box 2a, feeding level 2d) is **discretionary**: CONTEXT's
criterion 1 names only box 1b, and "the dividend half of the capital-gain story" reads most
conservatively as boxes 1a/1b alone. Recommend leaving `capitalGainDistributions` **unmodeled** this
phase (the conservative, criterion-literal reading) unless the phase owner wants the QDCGT
dispatcher's level-2d branch proven end-to-end here too — flagged as Open Question 1.

## Project Constraints (from AGENTS.md)

- **No new dependency, including a devDependency, without every repo owner's approval** — none
  needed.
- **Money in a stored JSON document is a decimal `string`, never a JSON number** — every money box
  in both new dialects is `option(string)`, validated via `moneyFieldError`. 1099-B boxes 8-11 are
  money that CAN be negative — `moneyFieldError` already accepts negatives.
- **Every box `option(...)`; blank is not zero** — applies without exception, including box 1e.
- **`corrected: option(true)`, never `false`** — same convention, both new dialects.
- **Conditional spread discipline** — `...(x === undefined ? {} : { k: x })`.
- **No `any`, no cast over an indexed access, no non-null assertion.**
- **`finance_schema`'s `dialectSchemas` must grow 7 -> 9 atomically** — register both new dialects,
  bump `expectedKnownDialectCount` to 9, add two `*Resolves` proof leaves, all in one commit.
- **`fjs/return/scope`'s 6/44 modeled/unmodeled partition must move atomically to 8/42** (or 8/43 if
  `capitalGainDistributions` stays unmodeled per the discretionary note) — same discipline, one
  level over, forced by `_EveryKindIsEitherModeledOrRefused` at `tsc` level.
- **Proofs are `export const proof = {...}`, discovered only through root `all.test.js`.**
- **Never gate on `npm test`'s total; use `node --test 2>&1 | grep -c '^✔ import("./fjs/'`.**
  Current baseline this session: **544**.

## Common Pitfalls

### Pitfall 1: Treating "reaches the worksheet" as satisfied by a `dispatchLine16` unit test alone
**What goes wrong:** writing a proof that calls `dispatchLine16` directly with a hand-built
`qualifiedDividendsCents: 3000n` and declaring criterion 1 satisfied, without ever storing a
`vnd.fjs.1099div` document or exercising `form1040IncomeLines`/`classifyScope`.
**Why it happens:** `fjs/tax/line16/module.f.js` already has exactly this kind of proof, from Phase
10 — it is easy to add one more of the same shape and call it done.
**How to avoid:** the proof must start from a STORED `vnd.fjs.1099div` document and a
`return_profile` declaring `qualifiedDividends`, run it through `form1040IncomeLines` and
`form1040TaxAndPaymentLines`, and assert the RESULT — proving the whole chain, not just the
worksheet's own arithmetic (already proven in Phase 10).
**Warning signs:** a Phase 12 proof file that imports `dispatchLine16` directly but never imports
`vnd.fjs.1099div`'s own `validate`.

### Pitfall 2: Reclassifying the scope guard without the companion wiring (or vice versa)
**What goes wrong:** either (a) moving `qualifiedDividends` to `modeledKinds` without wiring
`form1040/core`'s line3a — silently reports $0 dividend income for a taxpayer who declared and
stored real dividends, the worst failure mode this architecture exists to prevent — or (b) wiring
`form1040/core` without reclassifying the scope — every dividend-declaring return still refuses
before the new wiring is ever reached, so the wiring is dead code with a passing-looking proof that
never actually exercises it (if the proof forgot to declare the kind).
**Why it happens:** the two edits live in different files (`fjs/return/scope` and
`fjs/form1040/core`) with no compiler link between them — `tsc` cannot catch "wiring exists but
scope still refuses" or the reverse.
**How to avoid:** land both in the same commit/task, and write the proof from a stored document
through to the final line-16 figure (Pitfall 1's proof already covers this if done right).

### Pitfall 3: Assuming Form 1099-B's box numbering is stable year over year without checking
**What goes wrong:** modeling `vnd.fjs.1099b` from whatever URL happens to resolve, without
confirming it is the TY2025-specific revision — 1099-B is revised annually (unlike 1099-DIV), and
this session found the canonical un-suffixed URL now 404s entirely, which is easy to mistake for a
transient fetch failure rather than a permanent naming-scheme change.
**How to avoid:** always fetch `f1099b--<year>.pdf` explicitly for the tax year in force, and record
that exact URL in the dialect's docstring (per DOC-10's "form revision" discipline) — never rely on
the un-suffixed name resolving to anything for this specific form.

## Code Examples

### The DOC-13 provenance proof shape
```js
// Illustrative — the two dialects' own proof files
const artifactHash = 'SOME-CBASE32-HASH-OF-THE-PDF'
const divInstance = { ...divMinimal, sourceArtifactHash: artifactHash }
const bInstance = { ...bMinimal, sourceArtifactHash: artifactHash }
const divSubject = formSubject({ ...divKeyFields, formType: 'vnd.fjs.1099div' })
const bSubject = formSubject({ ...bKeyFields, formType: 'vnd.fjs.1099b' })
assertEq(divSubject === bSubject, false, 'two form types from one artifact are two subjects')
assertEq(divInstance.sourceArtifactHash, bInstance.sourceArtifactHash, 'same artifact, shared provenance')
```

### Box 1e absence changing the gain (criterion 2's proof, dialect-level, not tax computation)
```js
// Illustrative, local to the 1099-B proof file — NOT exported production code,
// since this phase does not compute Form 8949/Schedule D (Phase 12.1's job).
// Demonstrates the CONSEQUENCE CONTEXT requires without building the real worksheet.
const naiveGain = (proceeds) => (basis) => centsFromString(proceeds) - centsFromString(basis ?? '0.00')
const withBasis = validate({ ...minimal, box1dProceeds: '10000.00', box1eCostOrOtherBasis: '6000.00' })
const withoutBasis = validate({ ...minimal, box1dProceeds: '10000.00' }) // box 1e genuinely absent
// naiveGain on withBasis: 4000.00 (correct, given the printed basis)
// naiveGain on withoutBasis, treating absence as '0.00': 10000.00 (WRONG — overstates the gain
// by the full basis amount; the true gain cannot be computed from this document alone)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| 1099-B canonical URL `f1099b.pdf` served the current year's form | Canonical URL 404s; only `f1099b--<year>.pdf` resolves | Observed this session, exact date of the naming-scheme change not established | A researcher must always use the year-suffixed URL for this specific form, unlike 1099-DIV/1099-INT |
| Form 1099-DIV revised annually | Converted to "continuous use" | Some point before TY2025 (per IRS instructions page, exact date not independently verified) | No revision-drift risk for this dialect, worth recording as a contrast to 1099-R/1099-B |

**Deprecated/outdated:** none identified this session for the forms themselves.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `fjs/return/scope` reclassification and the `fjs/return/profile` foreign-account field addition are IN SCOPE for this phase, despite CONTEXT's Standing Constraints literally saying "This phase... must not touch `fjs/return/`" | Summary, Q4, Q5 | **HIGH — this is the single most consequential claim in this document.** If the phase owner insists on the literal reading of "must not touch `fjs/return/`," then criterion 1 (QDCGT reachability) and TAX-07's foreign-account questions are BOTH unsatisfiable as currently stated, and the phase's success criteria need rewriting before planning proceeds — not a planning-time workaround. This must be confirmed explicitly, not assumed, before plans are written. |
| A2 | `capitalGainDistributions` (1099-DIV box 2a) should remain UNMODELED this phase (conservative reading of "the dividend half") rather than also being reclassified alongside `qualifiedDividends`/`ordinaryDividends` | Q5 | LOW-MEDIUM — if wrong, a return with box 2a > 0 and no Schedule D need still refuses when it could compute; not a correctness risk (it fails safely), only a completeness one, closeable in Phase 12.1 or a later Phase 12 wave without reopening anything |
| A3 | `sourceArtifactHash` should be a REQUIRED (not `option`) field on the two new dialects | Q3 | LOW — since these are brand-new dialects with no legacy stored instances, making it required now is free; if wrong (some legitimate case exists where a typed document has no traceable source artifact), loosening to `option()` later is a non-breaking widening |
| A4 | 1099-DIV's "continuous use" status (no annual revision) is accurately reported by the IRS instructions page and not itself stale | Q1 | LOW — even if a newer revision exists that was not surfaced by this session's search, every field modeled is `option()`-typed per DOC-11, so a genuinely newer/fuller box list would be additive, not corrective |
| A5 | No box-number or box-meaning changes exist between the fetched TY2025 Form 1099-B and the 2026 instructions beyond the address-field-format change found | Q2 | MEDIUM — the 2026 form FACE itself was not independently fetched and diffed line-by-line (only its instructions were); if a numbered box actually moved for 2026, this claim is wrong for a FUTURE tax year, not for TY2025, which is what this phase models |

**If this table is empty:** N/A — five assumptions logged, one (A1) load-bearing and requiring
explicit confirmation before planning proceeds.

## Open Questions

1. **Should `capitalGainDistributions` (1099-DIV box 2a) also be reclassified to modeled this
   phase, wiring Form 1040 line 7a and `dispatchLine16`'s level-2d path?**
   - What we know: the QDCGT dispatcher's level-2d branch already exists and is proven at the unit
     level (Phase 10); box 2a is a field this phase's own dialect stores.
   - What's unclear: whether CONTEXT's "the dividend half of the capital-gain story" is meant to
     include box 2a (a capital-gain-flavored box printed ON the dividend form) or strictly boxes
     1a/1b (dividends proper).
   - Recommendation: default to NOT including it (Assumption A2), and let the phase owner expand
     scope explicitly if they want level-2d proven this phase rather than in 12.1.

2. **Does the phase owner want the `fjs/return/scope`/`fjs/return/profile` edits treated as their
   own explicit sub-decision in `12-CONTEXT.md`, given they directly contradict a Standing
   Constraint?**
   - What we know: criterion 1 and TAX-07 are literally unsatisfiable without these edits (Q5, Q4).
   - What's unclear: whether "must not touch `fjs/return/`" was written with `fjs/return/scope`
     and `fjs/return/profile` specifically in mind, or was a shorthand for "do not build new
     return-computation machinery" that these narrow, additive edits do not actually violate in
     spirit.
   - Recommendation: raise this explicitly before planning locks in task boundaries — see
     Assumptions Log A1.

## Environment Availability

Not applicable — this phase is pure `.f.js` code over already-installed `functionalscript` and the
project's existing project-local CAS store; no external tool, service, or runtime dependency is
introduced.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | FunctionalScript Emergent Testing (`export const proof = {...}`, discovered via root `all.test.js`), run through Node's built-in `node --test` |
| Config file | none — registration is automatic via `all.test.js`'s `loadModuleMap` walk |
| Quick run command | `node --test 2>&1 \| grep -c '^✔ import("./fjs/'` (current baseline: **544**) |
| Full suite command | `npm test` (`tsc && node --test`) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOC-06 | `vnd.fjs.1099div` round-trips; every box `option`-absent-able; a stored document reaches the QDCGT worksheet through the real `form1040IncomeLines` -> `dispatchLine16` chain (not a bypassed unit test) | unit + integration-shaped unit (chain proof) | `npm test` | ❌ Wave 0 — `fjs/document/1099div/module.f.js` does not exist; `fjs/return/scope` and `fjs/form1040/core` need modification |
| DOC-07 | `vnd.fjs.1099b` round-trips; box 1e absence is provably distinguishable from box 1e = `'0.00'`, with a proof exhibiting the gain difference | unit | `npm test` | ❌ Wave 0 — `fjs/document/1099b/module.f.js` does not exist |
| DOC-13 | N subjects from one shared `sourceArtifactHash`, for a 1099-DIV and a 1099-B section of one consolidated artifact | unit (subject-derivation proof, no ingestion tool) | `npm test` | ❌ Wave 0 — depends on both new dialects existing; `subject/module.f.js` itself needs NO changes |
| TAX-07 | Schedule B: $1,500 threshold tested SEPARATELY for interest and dividends (not combined); Part III echoes `return_profile`'s (new) foreign-account fields, never inferred from documents | unit | `npm test` | ❌ Wave 0 — `fjs/schedule/b/module.f.js` does not exist; `return_profile` needs the four new fields |

### Sampling Rate
- **Per task commit:** `node --test 2>&1 | grep -c '^✔ import("./fjs/'`
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** full suite green, PLUS a manual mutation check on the `fjs/return/scope`
  reclassification specifically (per AGENTS.md's standing rule) — temporarily reverting
  `qualifiedDividends` back into `unmodeledKindRefusals` must turn the chain proof (Pitfall 1) red,
  not merely leave it green by accident; and reverting the `form1040/core` wiring (leaving the
  scope reclassified) must ALSO turn it red, proving the two edits are both load-bearing rather
  than one masking a gap in the other.

### Wave 0 Gaps
- [ ] `fjs/document/1099div/module.f.js` — new file, covers DOC-06
- [ ] `fjs/document/1099b/module.f.js` — new file, covers DOC-07
- [ ] `fjs/schedule/b/module.f.js` — new file, covers TAX-07
- [ ] `fjs/return/profile/module.f.js` — MODIFIED, four new `option()` foreign-account fields (Q4)
- [ ] `fjs/return/scope/module.f.js` — MODIFIED, `qualifiedDividends`/`ordinaryDividends`
      reclassified atomically with both hand-typed counts (Q5)
- [ ] `fjs/form1040/core/module.f.js` — MODIFIED, line3a/3b wiring and the `dispatchLine16` call
      site's `qualifiedDividendsCents` argument (Q5) — must land in the SAME commit as the scope
      reclassification above
- [ ] `fjs/server/finance_schema/module.f.js` — MODIFIED, `dialectSchemas` grows 7 -> 9 atomically

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | no | out of scope for this local, single-user, stdio-transport project |
| V3 Session Management | no | same |
| V4 Access Control | no | this phase adds no new access-control surface (unlike Phase 11's DOC-15 finding) — no archived-visibility or cross-subject concern arises from these two dialects |
| V5 Input Validation | yes | RTTI structural validation + `checkReferences` semantic checks, exactly as every existing dialect does — no new pattern; the new `sourceArtifactHash` field is validated via the already-exported `isHash` |
| V6 Cryptography | no | no new cryptographic primitive; hashing is entirely upstream `fjs/crypto/sha2`, unchanged |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| A money box in the new dialects silently accepting a non-exact or comma-grouped value | Tampering | `moneyFieldError`, reused unchanged |
| `sourceArtifactHash` accepting a non-hash string, breaking the DOC-13 provenance guarantee silently | Tampering | Validate via `isHash` in `checkReferences`, refuse otherwise |
| A `checkReferences` treating box 1e absence as zero, silently understating a reported gain in a LATER phase's computation | Tampering (of the eventual Phase 12.1 Form 8949 input) | `option(string)`, never defaulted — this phase's proof (criterion 2) exists specifically to catch a future regression of this kind |

## Sources

### Primary (HIGH confidence)
- `https://www.irs.gov/pub/irs-pdf/f1099div.pdf` — fetched and read directly, 2026-08-07 (Rev.
  January 2024, confirmed current for TY2025)
- `https://www.irs.gov/pub/irs-pdf/f1099b--2025.pdf` — fetched and read directly, 2026-08-07
  (TY2025-specific revision)
- `https://www.irs.gov/pub/irs-pdf/f1040sb.pdf` — fetched and read directly, 2026-08-07 (2025
  revision, "Created 4/23/25")
- `https://www.irs.gov/pub/irs-pdf/f1099b.pdf` — fetched directly, confirmed HTTP 404, 2026-08-07
- `node_modules/functionalscript/fjs/cas/evo/module.f.js` — read directly (the `validateParentSubjects`
  finding)
- `node_modules/functionalscript/fjs/media/revision/module.f.js` — read directly (`isHash`)
- `fjs/document/subject/module.f.js`, `fjs/document/base/module.f.js`, `fjs/document/money_field/module.f.js`,
  `fjs/document/1099r/module.f.js`, `fjs/document/1099int/module.f.js`, `fjs/document/w2/module.f.js`
  (this project) — read directly
- `fjs/tax/line16/qdcgt/module.f.js`, `fjs/tax/line16/module.f.js`, `fjs/return/scope/module.f.js`,
  `fjs/return/profile/module.f.js`, `fjs/form1040/core/module.f.js`, `fjs/server/finance_schema/module.f.js`
  (this project) — read directly, all findings in Q3/Q5/Q4 verified against this source, not inferred
- `AGENTS.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`,
  `.planning/phases/12-.../12-CONTEXT.md`, `.planning/phases/11-.../11-RESEARCH.md` (this project) —
  read directly

### Secondary (MEDIUM confidence)
- `https://www.irs.gov/pub/irs-prior/i1099b--2026.pdf` — fetched, used only to check for
  box-numbering drift into TY2026; the 2026 form FACE itself was not independently located and
  fetched (Assumption A5)
- "Form 1099-DIV converted from an annual revision to continuous use" — via `WebSearch`, not
  independently confirmed against an IRS-published changelog (Assumption A4)

### Tertiary (LOW confidence)
- None — every claim in this document is either verified against a fetched/read source above, or
  explicitly logged in the Assumptions table.

## Metadata

**Confidence breakdown:**
- Box lists (Q1, Q2, Q4): HIGH — every box read from a fetched, session-current, tax-year-matched
  PDF, not from recall
- The `fjs/return/scope`/`fjs/form1040/core` wiring gap (Q5) and the DOC-13 provenance mechanism
  (Q3): HIGH — both verified by reading the actual shipped source, not by inference
- Whether the `fjs/return/` edits are within the phase owner's intended scope (Assumption A1): this
  is a JUDGMENT the research cannot make on the phase owner's behalf — flagged, not resolved

**Research date:** 2026-08-07
**Valid until:** 30 days for the code-pattern findings (Q3, Q5 — stable unless `functionalscript` is
upgraded past `^0.43.1`); the IRS box-list findings (Q1, Q2, Q4) are valid for TY2025 specifically
and must be re-verified if the project ever extends to a different tax year (1099-B in particular,
given its confirmed annual-revision cadence).
