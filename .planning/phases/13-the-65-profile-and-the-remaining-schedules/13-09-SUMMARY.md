---
phase: 13-the-65-profile-and-the-remaining-schedules
plan: 09
subsystem: tax-documents
tags: [fjs, schedule-8812, ctc, odc, actc, phase-out, stepped-cliff, boundary-proof]

# Dependency graph
requires:
  - phase: 13-the-65-profile-and-the-remaining-schedules
    provides: "13-08's dependents array and childTaxCredit TY2025 parameters"
provides:
  - "fjs/form8812 — Schedule 8812 Part I (CTC/ODC, line 14) and Part II-A (ACTC, line 27), computed from one function execution"
  - "roundUpToNextThousandDollars — the stepped $1,000-rounding primitive, module-local, with its own dedicated boundary proofs"
  - "childTaxCreditPhaseoutIncome — TAX-15's fourth named income function"
  - "fjs/tax/boundary's allThresholds extended with the two CTC/ODC phase-out START thresholds; expectedThresholdCount 68 -> 70"
affects: [13-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stepped-cliff phase-out (round excess UP to next $1,000, then apply rate) as a module-local arithmetic primitive with no codebase precedent — contrast fjs/schedule/1a's/fjs/schedule/a's continuous phase-outs"
    - "Dependent classification via pure filter/reduce over a caller-supplied, already-normalized boolean array, never a pre-classified count"
    - "One function computing two Form 1040 lines' worth of credit (Part I and Part II-A) from shared intermediates, with a mid-function error-arm refusal for an out-of-scope form part (Part II-B)"

key-files:
  created:
    - fjs/form8812/module.f.js
  modified:
    - fjs/tax/boundary/module.f.js

key-decisions:
  - "roundUpToNextThousandDollars kept MODULE-LOCAL (not exported), per the plan's own instruction — it is exercised entirely through this module's own proof export, and fjs/tax/boundary only needs the phase-out's crossing point, not the rounding step itself"
  - "childTaxCreditPhaseoutIncome is written independently of fjs/schedule/1a's seniorDeductionPhaseoutIncome and fjs/schedule/a's saltCapPhasedownIncome, with its own docstring stating its own add-back list, and a dedicated proof pins its equality to Schedule 8812's own line 3 across five fixtures rather than assuming it"
  - "fjs/tax/boundary registers ONLY the CTC/ODC phase-out's START threshold (2 entries, MFJ + other) — no floor/zero-point entry, since the phase-out has no floor (line12's own STOP is the effective floor, driven by a comparison against line8, not a fixed income ceiling the way the senior deduction and SALT cap have one)"
  - "Part II-B's refusal returns unmodeled: [] (a document-data-sufficiency refusal, 12.1 Decision 2.6's category), never a fjs/return/scope kind, mirroring the Schedule D absent-basis precedent fjs/form1040/core already uses"
  - "Avoided quoting fjs/schedule/1a's own Magi-bearing identifier verbatim in a docstring comment, even though the current criterion (grep -rn \"magi\" fjs/, case-sensitive) would have passed it — pre-empting Validation Finding C-1's case-insensitive gate (owned by 13-13) rather than adding a new occurrence for it to find"

requirements-completed: []

# Metrics
duration: 55min
completed: 2026-08-11
---

# Phase 13 Plan 09: Schedule 8812 — Parts I and II-A Summary

**`fjs/form8812` computes Schedule 8812's nonrefundable CTC/ODC credit and its Additional Child Tax Credit from one function execution, with a hand-written `roundUpToNextThousandDollars` stepped-cliff primitive (no prior codebase precedent) proven at the exact cent where a single dollar over the $400,000/$200,000 threshold costs the full $50 first step.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-08-11
- **Tasks:** 1 (`type="auto" tdd="true"`, one commit)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `fjs/form8812/module.f.js` created: `form8812` computes all of Schedule
  8812 Part I (lines 1–14, feeding 1040 line 19) and Part II-A (lines
  16a–27, feeding 1040 line 28) from a single `(taxParamSet) => (input) =>
  Form8812Outcome` execution, sharing every internal intermediate — Part
  II-A is never independently computable on stale Part I state.
- Dependent classification (qualifying child, $2,200 CTC vs. other
  dependent, $500 ODC) is derived purely from `ageAtYearEnd < 17 &&
  ssnValidForEmployment`, a pure filter over the caller-supplied array —
  never a pre-classified count, honoring 13-08's own scope boundary.
- `roundUpToNextThousandDollars` — the phase's highest-risk new arithmetic
  primitive — implemented as a module-local ceiling-divide
  (`((cents - 1n) / 100000n + 1n) * 100000n` with an explicit `cents === 0n`
  guard), with five dedicated proof leaves pinning: $0.01 → $1,000.00, an
  exact $1,000.00 multiple staying itself (not rounding a further $1,000),
  $1,000.01 → $2,000.00, zero excess staying zero (no phantom step), and
  the resulting $50 cliff standalone.
- The stepped cliff itself: at exactly $400,000.00 MFJ, `line10`/`line11`
  are both `$0`; at $400,000.01, `line10` rounds up to `$1,000.00` and
  `line11` is `$50.00` — a single cent over the threshold costs the full
  first step immediately, contrasted explicitly in the module's own
  docstring against `fjs/schedule/1a`'s continuous 6% curve at its own
  threshold (where one cent moves the deduction by an unobservable
  fraction of a cent).
- Part II-B (3+ qualifying children or Puerto Rico residents, `line16b >=
  $5,100`) refuses with a named remedy (`unmodeled: []`) before `line17` is
  ever computed, rather than silently treating Part II-B's own lines as
  zero — verified against a 2-qualifying-child control that computes
  normally at the identical income/liability shape.
- The form's own early exit (`line12`'s STOP when `line8 <= line11`) is
  modeled as control flow: a fixture with zero dependents, and a second
  fixture with one qualifying child fully phased out by a high income,
  both short-circuit BOTH parts from one function call, proving Part II-A
  never runs independently on stale state.
- `childTaxCreditPhaseoutIncome` exported as TAX-15's fourth named income
  function, its own docstring stating its own (currently all-zero)
  add-back list, deliberately independent of
  `seniorDeductionPhaseoutIncome`/`saltCapPhasedownIncome` — a dedicated
  proof pins the equality to Schedule 8812's own line 3 across five
  fixtures rather than assuming it via a shared call.
- `fjs/tax/boundary/module.f.js` extended: `childTaxCreditThresholds`
  registers the phase-out's two START thresholds only
  (`childTaxCreditPhaseoutStart:marriedFilingJointly`,
  `childTaxCreditPhaseoutStart:other`) — no floor entry, since this
  phase-out has no fixed income ceiling the way the senior deduction and
  SALT cap do. `expectedThresholdCount` bumped `68` → `70`, both new leaves
  green under the generated per-threshold proof.
- Project-local proof count rose from **787 (baseline after 13-08) to
  806** — 19 new leaves (17 in `fjs/form8812`, 2 in `fjs/tax/boundary`).
- `npm test` (`tsc && node --test`): 3044 passing, 0 failing.
- `grep -rn "magi" fjs/`: empty.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build Schedule 8812 — dependent classification, Part I, Part II-A, and register the phase-out start threshold in fjs/tax/boundary** - `f405261` (feat)

**Plan metadata:** (this commit, following this SUMMARY)

## Files Created/Modified

- `fjs/form8812/module.f.js` (new) - `form8812`, `roundUpToNextThousandDollars`
  (module-local), `childTaxCreditPhaseoutIncome`, `Form8812Input`/
  `Form8812Outcome` types, and a `proof` export with 17 leaves across
  classification, the stepped cliff, the rounding primitive standalone, the
  Part I → Part II-A short-circuit, ACTC-under-threshold, the Part II-B
  refusal (plus its control), Credit Limit Worksheet A, and the linked
  income-function equality.
- `fjs/tax/boundary/module.f.js` - Added `childTaxCreditThresholds` (2
  entries), spread into `allThresholds`, bumped `expectedThresholdCount`
  `68` → `70`.

## Decisions Made

- `roundUpToNextThousandDollars` stays module-local per the plan's explicit
  instruction — `fjs/tax/boundary` only needs to know the phase-out's
  crossing point (a threshold `segmentIndex` can count), never the
  $1,000-step rounding shape itself, which this module's own Test 2/3
  fixtures pin directly.
- `childTaxCreditPhaseoutIncome` is written as its own independent
  function (not calling or being called by the other two shape-(A) income
  functions), each stating its own add-back list — mirroring
  `fjs/schedule/1a`'s own precedent (a dedicated equality proof, not a
  shared call) rather than `fjs/schedule/a`'s (call the function directly
  to compute the worksheet line). This keeps the four TAX-15 functions
  uniformly independent, since a future divergence in any one rule's
  add-back list must not silently ripple into the others.
- Avoided literally quoting `fjs/schedule/1a`'s own `Magi`-bearing test
  identifier in a docstring comment (rephrased to describe the pattern
  instead of naming it), even though today's case-sensitive
  `grep -rn "magi" fjs/` gate would have passed it — this pre-empts
  Validation Finding C-1's case-insensitive gate (owned by 13-13) rather
  than adding a fresh occurrence for that later plan to find and fix.

## Deviations from Plan

None — plan executed exactly as written. All seven critical constraints
were honored: the phase-out is stepped (not `fjs/schedule/1a`'s continuous
idiom), `roundUpToNextThousandDollars` carries its own dedicated
proofs including the exactly-on-boundary and zero-excess cases, both Part I
and Part II-A compute from one function execution with the form's own
early exits modeled as control flow, classification is derived (never
supplied), the citizenship trust boundary is documented in the module's
own docstring (not added as a field), `expectedThresholdCount` moved
`68` → `70` with per-module boundary trios present, and `fjs/form1040/core`
was not touched (that is 13-10's scope). TAX-12 is deliberately NOT marked
complete in REQUIREMENTS.md — Slice 4 spans 13-08 through 13-10 and closes
only at 13-10, per this plan's own scope constraint #7.

## Mutation Verification

Per AGENTS.md's "a proof is not known to work until you have watched it
fail" discipline, three targeted mutations were run and reverted (verified
clean via `diff` against a backup before each commit):

1. **`roundUpToNextThousandDollars`'s boundary arithmetic** — changing
   `((cents - 1n) / 100000n + 1n) * 100000n` to drop the `- 1n` reddened
   exactly `roundUpToNextThousandDollars.exactMultipleDoesNotRoundUpAgain`
   and no other leaf.
2. **The Part II-B threshold comparison** — weakening `line16b >=
   partTwoBThresholdCents` to `>` reddened exactly
   `partTwoBRefusal.threeQualifyingChildrenRefusesNamingPartTwoB` (a
   3-qualifying-child fixture lands exactly at $5,100.00) and no other leaf.
3. **The classification predicate** — dropping the `&& d.ssnValidForEmployment`
   term from `qualifyingChildren`'s filter reddened exactly
   `classification.underSeventeenWithoutValidSsnCountsAsOtherDependentNotQualifyingChild`
   and no other leaf.

All three mutations typechecked cleanly (`npx tsc`), applied cleanly, and
reddened the predicted leaf and only the predicted leaf — no equivalent
mutants encountered.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `fjs/form8812` is ready for 13-10 to wire into `fjs/form1040/core`'s
  lines 19 and 28, alongside the `childTaxCreditOrOtherDependents` and
  `additionalChildTaxCredit` scope reclassification — the last two steps
  that close Slice 4.
- `fjs/tax/boundary`'s `allThresholds` is at its final count for this
  phase (70) — no further threshold registrations are expected from Slice
  5.
- TAX-12 stays unchecked in REQUIREMENTS.md until 13-10 lands, per this
  plan's own scope constraint.

---
*Phase: 13-the-65-profile-and-the-remaining-schedules*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: `fjs/form8812/module.f.js`
- FOUND: `fjs/tax/boundary/module.f.js` (`childTaxCreditThresholds`, `expectedThresholdCount: 70`)
- FOUND commit `f405261` (Task 1: Schedule 8812 Parts I/II-A + threshold registration)
- `npm test`: 3044 passing, 0 failing
- Project-local proof count: 806 (baseline 787, risen by 19)
- `grep -rn "magi" fjs/`: empty
