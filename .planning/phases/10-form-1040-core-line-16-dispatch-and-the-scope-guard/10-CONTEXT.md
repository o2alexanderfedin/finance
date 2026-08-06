# Phase 10: Form 1040 Core, Line-16 Dispatch, and the Scope Guard - Context

**Gathered:** 2026-08-06
**Status:** Ready for planning
**Mode:** Smart discuss (three grey areas resolved by the user)

<domain>
## Phase Boundary

A real 1040 computes for a return inside the declared scope, and anything outside it is
refused loudly rather than silently omitted.

**Requirements:** TAX-03, TAX-05, TAX-06, TAX-16. Tier T1. Depends on Phases 8 and 9.

**In scope:** Form 1040 lines 1a–37 for a return within declared scope; the explicit line-16
method dispatcher across all four methods; the full 25-line QDCGT worksheet; the standard
deduction with age and blindness increments; the TAX-16 scope guard.

**Out of scope:** the Schedule D Tax Worksheet's computation (its branch dispatches to a
refusal — see Decision 1); Schedule B (TAX-07), Schedule 1-A (TAX-09) and everything else
Phases 11–13 own; multi-year and capital-loss carryover (TAX-17, T3).
</domain>

<decisions>
## Implementation Decisions

### Decision 1 — Line-16 scope: dispatcher for four branches, QDCGT implemented, Schedule D guarded

**A contradiction between the ROADMAP and REQUIREMENTS forced this question.** Phase 10's
requirements are TAX-03/05/06/16, and the QDCGT worksheet is **TAX-08, tier T2, owned by a
later phase**. But ROADMAP success criterion 2 demands a regression proof for the signature
$1–$12 line-16 error, and that proof cannot exist without QDCGT actually computing: the
discrepancy arises precisely because QDCGT lines 22 and 24 call *back into* the Tax Table,
whose $25/$50 bands make the two paths disagree. Verified against the worksheet text
(`i1040gi.pdf` p38), not against research notes.

**Resolution (user-selected):**
- The **dispatcher** covers all four methods — Tax Table, Tax Computation Worksheet, QDCGT
  worksheet, Schedule D Tax Worksheet — with a proof per branch that the correct method is
  *selected*.
- **QDCGT is fully implemented** (all 25 lines), which makes criterion 2's $1–$12 regression
  proof real rather than deferred.
- The **Schedule D Tax Worksheet branch dispatches to a TAX-16 refusal** naming unrecaptured
  §1250 gain and 28%-rate gain as unmodeled. That worksheet needs Phase 12's brokerage
  documents to have anything to compute over, so implementing it now would mean writing the
  hardest computation in v1 against inputs that do not yet exist.

This pulls the necessary part of TAX-08 forward and leaves the rest where the tiering puts it.

### Decision 2 — The scope guard refuses the WHOLE report, as an error outcome

An unmodeled input makes the entire report an **error result naming what is unmodeled**. A
partial 1040 is never returned, so there is no way to mistake one for a complete return.

This is the strictest reading of criterion 4's "never a silently omitted line", and it reuses
the shape `fjs/report/guard`'s `classifyRunOutcome` already establishes — a discriminated
`{ kind: 'error', message, reads }` versus `{ kind: 'ok', … }`. **One rule, one place**
(AGENTS.md): the scope guard must not become a second, parallel refusal mechanism.

Rejected: a per-line refusal inside a returned report. More informative for debugging, but it
ships a document that looks like a 1040 while being incomplete — the exact failure mode
TAX-16 exists to prevent.

### Decision 3 — A parameter disagreement STOPS the phase and is reported

If research or implementation finds the Standard Deduction Worksheet disagreeing with
`fjs/tax/params`' shipped TY2025 values, **stop and report to the user before changing
anything.** Phase 8 cited Rev. Proc. 2025-32 §3.01 for `15750.00/31500.00/23625.00`; a
conflict would mean either that citation or the transcription is wrong. That is a correctness
question about money, not a routine fix, and it invalidates Phase 8's proofs either way.

### Decision 4 — A return-profile document drives the scope guard

**Research proved the phase's original assumption false.** A scope guard driven by *store
contents* cannot distinguish "the taxpayer has no brokerage income" from "the brokerage
document was never ingested", so it stays silent in exactly the case TAX-16 exists for.

A new `vnd.fjs.*` dialect — the **return profile** — carries what the taxpayer *declares*:
filing status, age/blindness box counts, and the set of income kinds present. The guard
compares the declared set against a **frozen modeled set** and refuses, naming every declared
kind the engine does not model.

This also resolves a separate defect research found: `ReportLine.sources` requires a non-empty
tuple of `{documentHash, boxPath, value}`, and the standard deduction (line 12) derives from
no document, so line 12 could not be expressed at all. With a return profile the standard
deduction cites a real document with a real hash, leaving Phase 9's `tsc` guarantee untouched.

Three of the four remaining success criteria depend on this document, so it is a Phase 10
prerequisite rather than a Phase 11 nicety.

### Decision 5 — Model the IRS whole-dollar election, because criterion 5 is otherwise vacuous

**Criterion 5 as written is a tautology.** In the cents regime money is `bigint` cents, so
`round(sum)` and `sum(round)` are both the identity and any proof of their equality tests
nothing. Rounding only bites at *whole dollars*.

Form 1040's instructions (p23) state the governing rule — *"include cents when adding the
amounts and round off only the total"* — and make whole-dollar rounding an **election that is
all-or-nothing for the whole return**. Phase 10 models that election, and proves criterion 5
with the IRS's own example: ten 1099-INTs at `'1.39'` give `round(sum) = $14` against
`sum(round) = $10`.

### Decision 6 — `qualifyingSurvivingSpouse` becomes a real `IndividualFilingStatus`

Its dollar amounts coincide with `marriedFilingJointly`, but its **maximum age/blindness box
count is 2, not 4**. Mapping QSS onto MFJ would silently permit a 4-box standard deduction no
QSS filer can claim — precisely the quietly-wrong number this architecture exists to prevent.

### Claude's Discretion

Module layout, naming, and plan decomposition, provided they follow existing conventions:
`fjs/tax/*` for computation, `fjs/report/*` for report shaping, one `proof` export per module.
</decisions>

<code_context>
## Existing Code Insights

Build on these; do not duplicate them.

| Module | What it already gives Phase 10 |
|---|---|
| `fjs/tax/params` | TY2025 parameters with per-parameter `{revProc, section, effectiveDate}` citations |
| `fjs/tax/table` | The Tax Table as data — `taxTableBandStructure`, `generateRow`, `lookupTaxTable`, `handTranscribedRows`. **Already refuses at ≥ $100,000 naming the Tax Computation Worksheet**, which is one of the dispatcher's four branches |
| `fjs/tax/boundary` | Generic `segmentIndex` plus 42 threshold triples |
| `fjs/report/line` | `Source`, `ReportLine`. A `ReportLine` without `sources` **fails `tsc`** via an in-build conditional-type assertion — this is how criterion 1's "each line citing the documents it derived from" is enforced structurally rather than by review |
| `fjs/report/guard` | `classifyRunOutcome`, the zero-observed-reads kill condition and the `RunOutcome` shape Decision 2 reuses |
| `fjs/report/audit` | `countNumericLiterals` — the anti-hardcoding audit |
| `fjs/types/decimal`, `fjs/types/rational` | Exact arithmetic with scale as a parameter; `round(sum)` vs `sum(round)` structure for criterion 5 |
| `fjs/document/*` | `w2`, `1099int`, `medical_expenses`, `money_field` — the documents lines 1a–37 can actually read today |

**Phase 8 already learned** that the Tax Table rounds to **whole dollars**, not cents. A plan
specifying `halfUp` at cent precision was caught and corrected during execution.
</code_context>

<specifics>
## Specific Ideas

- **Criterion 2's regression proof is the phase's most valuable artifact.** It needs a worked
  numeric example from primary sources where the QDCGT path and a naive path differ by $1–$12,
  with both values stated. Hand-type the expected value; do not derive it from the code under
  test (AGENTS.md).
- **Dispatcher ordering is load-bearing and is not detectable by testing the common path
  only.** The conditions selecting each method must be tested in the order the instructions
  state, with a proof per branch *and* a proof that a wrong order changes the selection.
- **The refusal must name what is unmodeled**, not merely refuse. Phase 9's sweep found
  several assertions checking *that* a refusal threw rather than *what* it threw; the same
  mistake here would make criterion 4 vacuous.
- Criterion 5 needs a line aggregating **ten or more documents with real cents** — enough that
  `sum(round)` and `round(sum)` visibly diverge.
- Criterion 3 needs a proof at **each combination** the 65+/dependents/itemizing profile can
  produce, not one representative case.

## Primary sources (downloaded, text-extracted)

`i1040gi.pdf` (127pp) — p32 Social Security Benefits Worksheet, p34–35 Standard Deduction
Worksheet, p36–38 line-16 instructions and the dispatch tree, **p38 the 25-line QDCGT
worksheet**, p124 Tax Computation Worksheet. `i1040sd.pdf` (17pp) — p15–16 Schedule D Tax
Worksheet. `f1040.pdf` — the form face. `p1040.pdf` — the Tax Table.

## The criterion-2 regression pair — INDEPENDENTLY VERIFIED

Produced by research, then **recomputed from the worksheet and the bracket parameters by a
second party before being recorded here**. Both computations agree. MFJ, no Schedule D.

| Case | line 15 | line 3a | line 22 | line 23 | line 24 | **correct line 16** | forgot-`min` | error |
|---|---|---|---|---|---|---|---|---|
| A | $97,000.00 | $300.00 | 11,130 | 11,175.00 | **11,174** | **$11,174** | 11,175.00 | **+$1.00** |
| B | $96,999.00 | $299.00 | 11,130 | 11,174.85 | **11,163** | **$11,163** | 11,174.85 | **+$11.85** |

**The bug this pins is omitting the `min` on line 25** — not naive Tax Table use. An engine
that simply looks up line 1 in the Tax Table gets *both* cases right, because that is exactly
what line 24 computes and `min` selects it. A regression proof aimed at the wrong bug would
pass while the real one shipped.

**"$1–$12" is not a bound and must never be asserted as a range.** Research found MFJ
$96,949 / $249 produces $13.35. Pin these exact values.

QDCGT anchors already read directly: line 6 (top of the 0% bracket) $48,350 single/MFS,
$96,700 MFJ/QSS, $64,750 HoH; line 13 (top of the 15% bracket) $533,400 single, $300,000 MFS,
$600,050 MFJ/QSS, $566,700 HoH; line 18 = 15% × line 17; line 21 = 20% × line 20; lines 22
and 24 each route to the Tax Table under $100,000 and the Tax Computation Worksheet at or
above it; **line 25 = the smaller of line 23 or line 24**.
</specifics>

<deferred>
## Deferred Ideas

- The **Schedule D Tax Worksheet** computation, with its Unrecaptured §1250 Gain and 28% Rate
  Gain worksheets → Phase 12, alongside the brokerage documents that feed it.
- **Schedule B** (TAX-07), **Schedule 1-A** (TAX-09) → Phases 11–13.
- **Multi-year and capital-loss carryover** (TAX-17, T3).
- The **Foreign Earned Income Tax Worksheet** — reachable from line 16 only when Form 2555 is
  filed, which the declared taxpayer profile does not include. It is a scope-guard refusal.
</deferred>
