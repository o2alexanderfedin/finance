# Phase 13: The 65+ Profile and the Remaining Schedules - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase makes the **declared taxpayer profile structurally complete**: a 65+ TY2025
return with dependents that itemizes is no longer missing anything it is required to have.

In scope — the five requirements TAX-09, TAX-10, TAX-12, TAX-13, TAX-14:

- **Schedule 1-A** senior deduction (the parts criterion 1 names), with the 6% phase-out
  over $75k/$150k, feeding Form 1040 line 13b.
- **The 19-line Social Security Benefits Worksheet**, feeding 1040 lines 6a/6b.
- **Schedule A**, compared against the standard deduction rather than assumed to win.
- **Schedule 8812**, both halves — the nonrefundable credit (line 19) and the ACTC (line 28).
- **Schedules 1, 2, and 3**, carrying every line the profile reaches.

Also in scope, because the phase cannot be honest without them:

- **Wiring `vnd.fjs.1099r` into 1040 lines 4a/4b/5a/5b.** The dialect shipped in Phase 11
  and nothing reads it. The SSB worksheet's own line 3 sums 4b and 5b, so TAX-10 cannot be
  verified while they are `declaredZero`.
- **Wiring 1040 line 25b** (`federalTaxWithheldOnOther1099`) from 1099-R / 1099-DIV / 1099-B.
- **One new taxpayer-asserted dialect** for the Schedule A amounts no information return
  reports, and a **`dependents` array** on `vnd.fjs.return_profile` for Schedule 8812.
- **New TY2025 parameter data** with citations: senior deduction and its phase-out, the SSB
  base amounts, the SALT cap and its phase-down, the CTC/ODC/ACTC amounts, the medical floor.

Out of scope, and staying refused: household employee wages (1b), Medicaid waiver payments
(1d), other earned income (1h), other-form withholding (25c), net qualified disaster loss
(Form 4684), the QBI deduction, §1202, Form 4952, and every line-16 wrapper and add-on.

</domain>

<decisions>
## Implementation Decisions

### 1. Phase Shape and Scope Boundary

- **1.1 — One phase, wave-decomposed. No 13.1 split.** Estimated 9–11 plans, which matches
  Phase 7 (9 plans) and Phase 10 (10 plans). Phase 12's split existed because its two halves
  had a genuine dependency ordering (documents, then the chain computing over them); this
  phase's five schedules are siblings that share one wiring step, not a chain. Splitting
  would also leave half the declared profile unbuilt, and Phase 14's acceptance test cannot
  pass on half a profile.

- **1.2 — Form 1040 lines 4a/4b and 5a/5b are wired from `vnd.fjs.1099r` in this phase.**
  The dialect shipped in Phase 11; nothing reads it. This is the identical
  reclassify-without-wiring hazard 12.1 Decision 1.3 named for line 7a. It is not optional
  scope growth: the Social Security Benefits Worksheet's line 3 sums 1040 lines 1z, 2b, 3b,
  4b, 5b, 7 and 8, so TAX-10's criterion-2 case cannot exercise the worksheet's real
  arithmetic while 4b and 5b are `declaredZero`. `iraDistributions` and
  `pensionsAndAnnuities` move from `unmodeledKindRefusals` to `modeledKinds`.

- **1.3 — Form 1040 line 25b is wired.** `federalTaxWithheldOnOther1099`'s own remedy string
  already reads "requires vnd.fjs.1099r, vnd.fjs.1099div or vnd.fjs.1099b (Phases 11 and
  12)" — all three shipped. A 65+ return with 1099-R withholding that omits it computes the
  wrong refund, and line 25a already reads W-2 withholding through `fromDocuments`, so the
  precedent and the machinery both exist.

- **1.4 — Five kinds KEEP REFUSING, and their remedy strings are CORRECTED.** The declared
  profile reaches none of them, and a remedy that names Phase 13 while Phase 13 ships without
  it is a false remedy — precisely the failure mode Phase 1 existed to eliminate. A remedy is
  read by a taxpayer deciding what to do next; a wrong one is worse than a vague one.
  - `householdEmployeeWages` (1b), `medicaidWaiverPayments` (1d), `otherEarnedIncome` (1h),
    `federalTaxWithheldOnOtherForms` (25c) — remedy becomes "no dialect models it (no phase
    yet)".
  - `netQualifiedDisasterLoss` (12e exception) — remedy becomes "requires Form 4684 (no
    phase yet)". Schedule A shipping does not make the disaster-loss election computable.

- **1.5 — Kind arithmetic must balance and be stated.** `modeledKinds` 12 → the new total,
  `unmodeledKindRefusals` 38 → its complement, `kindVocabulary` stays **50**. The
  `_EveryKindIsEitherModeledOrRefused` conditional type enforces the partition at `tsc`;
  the plan states the two counts explicitly so a miscount is caught in review, not in CI.

### 2. Schedule A — Where the Itemized Numbers Come From

- **2.1 — ONE new taxpayer-asserted dialect, `vnd.fjs.itemized_deductions`**, carrying
  line-tagged entries for SALT, mortgage interest, gifts to charity, and the other-itemized
  lines. It follows `vnd.fjs.medical_expenses` **verbatim** on every design point that
  dialect already argued: no `formRevision` (DOC-10 governs dialects transcribing a printed
  IRS form, and there is no printed form here), **no stored totals** (a stored total is a
  second source of truth able to disagree with the entries it came from, and no floor or cap
  can be applied without an AGI the document cannot see), and free-string categories
  (enumerating what Publication 526 allows is deduction logic, and this dialect stores).

  Medical expenses stay in their own existing dialect — it already exists, already has
  proofs, and folding it in would be a rewrite for symmetry's sake.

  Rejected: one dialect per Schedule A section (four to five new dialects, four to five new
  subject conventions, for one taxpayer record). Rejected: transcribing Form 1098 — it covers
  only mortgage interest, and no information return reports charitable gifts or real-estate
  tax, so the taxpayer-asserted dialect would still be needed alongside it.

- **2.2 — Schedule A line 5a stays TAXPAYER-ASSERTED; the stored withholding becomes a
  PROOF, never an input.** Line 5a is state and local income tax *paid* during the year —
  withholding plus estimated payments plus any prior-year balance paid — so W-2 box 17 alone
  systematically understates it. A proof asserts that the asserted line 5a is **at least**
  the sum of W-2 box 17 and 1099-R box 14 across stored documents, since withheld tax is
  necessarily paid; the proof applies only when the income-tax election (rather than the
  general-sales-tax election) is in force.

  This is 12.1 Decision 2.4's shape reused: the second source is something a proof watches
  for drift, never the input itself.

  **`fjs/document/w2` and `fjs/document/1099r` docstrings must be amended.** Both currently
  state that nothing reads the state/local rows because a state return is out of scope. That
  stays true of *computation* — but a proof now reads them, and a docstring that says
  "nothing here reads them" while something does is exactly the kind of claim Phase 17 exists
  to delete.

  **AMENDED (13-REVIEW.md WR-02, applied by the code-fixer):** the drift check described above
  shipped as a private function called only from this module's own hand-written test fixtures —
  it protected zero real returns while its own docstring and the amended `fjs/document/w2`/
  `fjs/document/1099r` docstrings read as though it were an active safeguard. It is now WIRED
  into `fjs/schedule/a`'s own real computation: `ScheduleAInput` carries the return's own stored
  `w2Forms`/`oneZeroNineNineRForms`, and a drift refusal propagates as a `{ kind: 'error' }`
  document-data-sufficiency outcome (12.1 Decision 2.6's category), threaded through
  `fjs/form1040/core` exactly like the Schedule D absent-basis guard. "A proof watches for
  drift, never the input itself" stays true — the check still never feeds `stateIncomeTax`/
  `stateTaxWithheld` into line 5a's VALUE, only into whether the whole return refuses.

- **2.3 — Every printed Schedule A line is modeled.** Lines no source can populate are
  **documented zeros with the boundary stated in the module's own docstring**, never silent
  omissions — 12.1 Decision 2.5, itself `fjs/schedule/b`'s Form 8815 precedent. A later phase
  widening the dialect then knows exactly what to revisit.

- **2.4 — The comparison lives in `fjs/tax/deduction` as a named `deductionChoice`**,
  returning a discriminated union `{ chosen: 'standard' | 'itemized', standard, itemized }`.
  `fjs/tax/deduction` already owns the standard deduction including the age and blindness
  increments, so the comparison belongs beside the figure it compares against; putting it in
  `fjs/form1040/core` would bury a tax rule in a wiring module, and putting it in
  `fjs/schedule/a` would make Schedule A responsible for deciding whether it is used.

  **1040 line 12 cites BOTH figures in its sources**, so the report shows what was compared,
  not only what won. Criterion 3 requires proofs in **both directions**, including a case
  above $15,750 / $31,500 where itemizing still loses.

- **2.5 — The Schedule A line 18 election** ("itemize even though less than the standard
  deduction") joins `vnd.fjs.return_profile`. It is a taxpayer election that no document
  reports, exactly like `hadForeignFinancialAccount` (Phase 12's precedent), and without it
  `deductionChoice` cannot express a legitimate return.

### 3. Schedule 1-A, the SSB Worksheet, and the MAGI Rule

- **3.1 — New TY2025 numbers extend `fjs/tax/params`**, each with its own citation. Phase 8's
  rule is that every number the engine consults is data with a citation, and
  `finance_tax_params` already serves that module to the agent. The existing
  `unmodifiedParametersCite2024_40Only` proof is **not loosened** — it gets a sibling proof
  for the OBBBA-sourced set, so the two provenances stay separable and neither can silently
  absorb the other.

- **3.2 — Schedule 1-A parts the profile does not reach are DOCUMENTED ZEROS, not refusals.**
  The 50-kind vocabulary is frozen and carries exactly one kind
  (`seniorAndOtherScheduleOneADeductions`) for the whole of Schedule 1-A, so a *scope* refusal
  for the tips / overtime / car-loan-interest parts is **not expressible** — the same reason
  12.1 Decision 1.4 gave for 1099-B boxes 1f and 1g. Each such part is a documented zero with
  the boundary in the module docstring. The exact part numbering comes from research against
  the printed form; the criterion names Parts I/V/VI and research confirms or corrects that.

- **3.3 — The SSB worksheet computes in printed IRS order, one pass; the one true cycle
  REFUSES loudly.** Taxable social security depends on income excluding social security, so
  the ordering is: other income → the worksheet → line 6b → AGI → the Schedule 1-A phase-out.
  The genuine circularity is the IRA-deduction ↔ taxable-SS pair, which requires Pub 590-A
  Worksheet 1-1 — another worksheet, and out of this phase. When the profile declares an IRA
  deduction on Schedule 1, the return refuses with a named remedy rather than iterating to a
  fixed point or quietly ignoring the interaction. Refusing is honest and small; a silent
  approximation here is exactly TAX-16's failure mode.

- **3.4 — Criterion 2's case must exercise the near-circularity, not merely the arithmetic.**
  The case lands taxable social security in the 85% tier and includes **tax-exempt interest
  (1040 line 2a)**, which the worksheet adds back — the add-back a naive implementation
  omits, and the reason the worksheet is not simply "85% of benefits".

- **3.5 — TAX-15 / criterion 5: one named income function per rule, in the module that owns
  the rule**, each stating its own add-back list in its own docstring — for example
  `socialSecurityCombinedIncome`, `seniorDeductionPhaseoutIncome`, `saltCapPhasedownIncome`.
  The names are indicative; research fixes them against the printed line labels. There is no
  shared "MAGI" anything, because the IRA deduction, Roth eligibility, the Premium Tax Credit,
  IRMAA, and the student-loan-interest deduction do not share one.

- **3.6 — The criterion is enforced MECHANICALLY, not remembered.** A gate proof walks the
  `fjs/` tree and fails on a lowercase `magi` token, so `grep -rn "magi" fjs/` returning
  nothing is a property the build maintains rather than a fact someone checked once. This
  follows Phase 9's anti-hardcoding gate precedent: a rule a human has to remember is a rule
  that decays. Uppercase `MAGI` in prose stays permitted — the rule is about names.

### 4. Dependents, Schedule 8812, and Schedules 1 / 2 / 3

- **4.1 — `vnd.fjs.return_profile` grows a `dependents` array** — relationship, SSN valid for
  employment, age at year end, and lived-with-taxpayer — while **`dependentCount` is KEPT**,
  with a proof asserting the array length equals it. Schedule 8812 cannot tell a qualifying
  child from an other dependent from a bare count, and the two credits differ in both amount
  and refundability. The count stays the load-bearing declaration (the scope guard and the
  existing proofs read it); the array is what Schedule 8812 reads.

  Rejected: replacing `dependentCount` — it is referenced by existing proofs and is the
  simpler declaration for a return that itemizes nothing about its dependents. Rejected: two
  scalar counts — they encode 8812's classification decision in the *input*, which makes the
  engine's own classification unverifiable, the same objection 12.1 Decision 2.4 raised
  against trusting the payer-printed Form 8949 checkbox.

- **4.2 — Schedules 1, 2, and 3 model every printed line.** Populatable lines compute;
  the rest are documented zeros with the boundary in each module's docstring. **Documented
  zero and scope refusal stay strictly distinct** — `fjs/return/scope`'s docstring already
  insists on this: a line that is legitimately zero cites the profile, and a line the
  taxpayer declared but the engine cannot compute refuses the whole return. Criterion 4's
  "every line the profile actually reaches" is about the first category; the declared-kind
  guard still governs the second.

- **4.3 — Schedule 8812 is modeled in FULL, both halves.** Part I's nonrefundable credit
  (1040 line 19) and Part II-A's additional child tax credit (1040 line 28) compute from the
  same inputs, and `additionalChildTaxCredit` is one of this phase's refusals. Shipping half
  the form would leave line 28 refusing on a return that has a completed Schedule 8812 sitting
  in front of it — an outcome no taxpayer could interpret.

- **4.4 — SUPERSEDED by Decision 6.1.** This decision originally specified three horizontal
  waves (all parameters and dialects → all five schedules → all wiring and the reclassification
  in one atomic change). It is replaced by the vertical-slice decomposition below. The
  reasoning that survives is recorded in 6.2; the reasoning that does not is why 6.1 exists.

### 5. Resolutions From Research (added 2026-08-10, after `13-RESEARCH.md`)

Research transcribed all five forms from published final 2025 IRS PDFs and surfaced three
contradictions and three open questions. These are the resolutions. They amend, and where
they conflict take precedence over, the decisions above.

- **5.1 — The IRA-deduction refusal fires on a NEW PROFILE FIELD, not on the coarse kind.**
  `vnd.fjs.return_profile` gains `iraDeductionDeclared: option(true)`. The frozen 50-kind
  vocabulary carries exactly one kind (`scheduleOneAdjustments`) for the whole of Schedule 1
  Part II, so it cannot distinguish an IRA deduction — which creates Decision 3.3's cycle —
  from an HSA or educator-expense adjustment, which does not. A new *field* keeps the 50-kind
  freeze intact and is the same mechanism Decisions 2.5 and 4.1 already use.

  Research confirmed the cycle's exact boundary: SSB worksheet **line 6** adds back Schedule 1
  lines 11–20, 23 and 25 — every Part II adjustment **except** the student-loan-interest
  deduction (line 21) — and of those, only the IRA deduction (line 20) has an amount that
  itself depends on taxable social security (Pub 590-A Worksheet 1-1). Refusing on any
  declared adjustment would therefore reject returns this engine can compute correctly.

- **5.2 — `Citation` in `fjs/tax/params` widens to a DISCRIMINATED UNION.** This amends
  Decision 3.1's implication that the OBBBA parameters share the existing citation shape.
  Research grepped Rev. Proc. 2025-32 in full: it backs **only** the $2,200 CTC (§2.03) among
  this phase's new numbers. The senior deduction ($6,000, 6%, $75k/$150k) and the SALT cap
  ($40,000, 30%, $500k/$250k, $10,000 floor) are direct OBBBA statute; the 7.5% medical floor
  is long-standing IRC §213(a). The existing `{ revProc, section, effectiveDate }` has no
  honest field for either.

  New shape: `{ kind: 'revProc', revProc, section, effectiveDate } | { kind: 'publicLaw',
  publicLaw, section, effectiveDate } | { kind: 'code', section, effectiveDate }`. The change
  is **additive** — every existing entry becomes `kind: 'revProc'` with no value change — and
  it is what keeps `unmodifiedParametersCite2024_40Only`-style proofs meaningful, because a
  proof asserting "cites a Rev. Proc." stops meaning anything the moment `revProc` is allowed
  to hold a Public Law number.

- **5.3 — The Social Security Benefits Worksheet has EIGHTEEN lines, not nineteen, and the
  planning documents are corrected in this phase.** `[VERIFIED: i1040gi.pdf (2025) p32]` —
  lines 1 through 18, no lettered sub-lines. REQUIREMENTS.md's TAX-10 and ROADMAP.md's
  criterion 2 both say "19-line". Build **18** named line functions plus a count-guard proof
  asserting 18, and fix the prose in both planning documents in the same phase. Phase 1 exists
  precisely so that no later phase is planned against text that dissolves on contact; leaving
  a known-false count for Phase 17 to find would be that failure committed knowingly.

- **5.4 — The senior deduction is CATEGORICALLY UNAVAILABLE to married-filing-separately
  filers, at any income.** `[VERIFIED: f1040s1a.pdf (2025) p2, Part V caution: "If married,
  you must file jointly to claim this deduction."]` CONTEXT.md was silent on filing-status
  eligibility. Part V must **short-circuit to `$0` for MFS before the phase-out arithmetic
  runs** — not merely arrive at `$0` through it. The form's face alone under-specifies this:
  MFS shares the non-MFJ $75,000 threshold, so an MFS filer with low income would otherwise
  compute a nonzero deduction. Only the caption states the exclusion. This needs its own proof.

- **5.5 — The senior-deduction phase-out is CONTINUOUS, unlike its own siblings.** Schedule
  1-A's tips / overtime / car-loan-interest parts round the phase-out to $1,000 increments;
  **Part V does not**. Schedule 8812's CTC/ODC phase-out *is* stepped (5% per $1,000 rounded
  up — a true cliff at the threshold). Getting these backwards is the phase's most likely
  silent-wrong-number failure, so each phase-out carries `threshold − 1¢ / threshold /
  threshold + 1¢` boundary proofs per TAX-04 at the exact dollar values research names.

- **5.6 — FOUR named income functions, not three.** Decision 3.5's three examples missed
  Schedule 8812's own phase-out income. Research transcribed all three worksheets side by side
  and found the senior-deduction phase-out, the SALT cap phase-down, and the CTC/ODC phase-out
  read the **identical** measure — AGI plus the Puerto Rico exclusion plus Form 2555 lines
  45/50 plus Form 4563 line 15 — and since all three add-backs are unmodeled and stay refused,
  all three are *provably equal to bare AGI* for every return this engine can compute.

  They are still written as **four separately named functions** (the three above plus the
  social-security combined-income measure), each stating its own add-back list. Identical
  values stored independently is the established precedent here —
  `qssParametersEqualMfjAndAreStoredIndependently` in `fjs/tax/params` is the same argument —
  and it is the entire point of TAX-15: these four coincide *today*, for reasons that are
  contingent on what is unmodeled, not on the rules being the same rule.

- **5.7 — Schedule 8812's citizenship/national/resident-alien test for the ODC is an ACCEPTED
  TRUST BOUNDARY**, documented in the module's own docstring rather than added to the
  `dependents` array. The taxpayer's act of declaring a dependent already asserts it, and the
  printed form keys the CTC-vs-ODC classification itself on only two facts — age and SSN
  validity — both of which Decision 4.1's array carries. This mirrors how `fjs/schedule/b`
  documents its Form 8815 boundary.

- **5.8 — Neither OBBBA itemized-deduction change applies to TY2025.** The 0.5% charitable AGI
  floor and the high-income "2/37ths" haircut are **TY2026**, confirmed by the 2025
  instructions' own "What's New". Schedule A must **not** implement either. Recording this
  because both are widely discussed as if current, and a plan that adds them would produce a
  confidently wrong return.

### 6. Vertical Slices (user directive, 2026-08-10 — supersedes Decision 4.4)

- **6.1 — This phase is planned as FIVE VERTICAL SLICES, one per wave, executed in order.**
  Each slice carries its own parameters, its own module, its own Form 1040 wiring, and its own
  scope reclassification, and ends with a **return that computes something it could not
  compute before**. Nothing is deferred to a final integration wave.

  The test each slice must pass, borrowed from `planner-mvp-mode.md`'s acceptance question and
  translated out of its web vocabulary: *after this slice, does a real TY2025 return produce a
  number it did not produce before?* If the honest answer is "no, but the foundation is laid",
  it is a horizontal task wearing a slice's label and must be restructured.

  | # | Slice | Delivers | Req |
  |---|-------|----------|-----|
  | 1 | **Retirement and Social Security income** — the 18-line SSB worksheet; `vnd.fjs.1099r` into 1040 lines 4a/4b and 5a/5b; lines 6a/6b; line 25b withholding; the `iraDeductionDeclared` refusal | A 65+ return with an SSA-1099 and a 1099-R computes its income lines and **a correct AGI** | TAX-10 |
  | 2 | **The senior deduction** — the `Citation` union widening; the OBBBA parameters; Schedule 1-A Parts I/V/VI; 1040 line 13b | A 65+ TY2025 return stops being structurally wrong | TAX-09 |
  | 3 | **Itemizing** — `vnd.fjs.itemized_deductions`; Schedule A; `deductionChoice`; 1040 line 12e | A return that itemizes computes, and the comparison against the standard deduction decides | TAX-13 |
  | 4 | **Dependents** — the profile `dependents` array; Schedule 8812 Parts I and II-A; 1040 lines 19 and 28 | A return with dependents gets its CTC/ODC and its ACTC | TAX-12 |
  | 5 | **The remaining schedules and the sweep** — Schedules 1, 2, 3; 1040 lines 8, 10, 17, 20, 23, 31; the MAGI tree-walk gate; the five stale remedy strings; the 18-vs-19 correction in REQUIREMENTS.md and ROADMAP.md | Criterion 4's "every line the profile reaches" and criterion 5's gate | TAX-14 |

- **6.2 — Slice 1 is first because AGI is upstream of everything else, not because it is
  easiest.** The senior-deduction phase-out, the SALT cap phase-down, the CTC phase-out, and
  the 7.5% medical floor **all read AGI**, and AGI includes 1040 line 6b — taxable social
  security. Building any other slice first would mean proving its arithmetic against an AGI
  that is still `declaredZero` where the SSA-1099 and 1099-R belong, and every one of those
  proofs would have to be revisited once slice 1 landed. Slices 2, 3 and 4 are mutually
  independent once slice 1 is done; slice 5 sweeps.

- **6.3 — The atomic-transition invariant is PRESERVED, and is in fact tightened.** Decision
  4.4 inherited 12.1 Plan 04's single reclassification commit, and the fear behind it is real:
  a kind that is `modeledKinds` while its 1040 line still returns `declaredZero` makes the
  scope guard report a line as computed when it is not. But the invariant was never "all kinds
  move together" — it is **"no kind moves before its line is wired."** 12.1 used one commit
  because its six kinds were one feature: a single capital-gain chain that did not compute
  until all of it did.

  Here the five slices are five independent features, so each slice performs its own
  wire-then-reclassify inside itself, atomically. This makes the blast radius *smaller* per
  change, and `_EveryKindIsEitherModeledOrRefused` type-checks every one of the five
  independently — a kind added to `modeledKinds` without a paired deletion from
  `unmodeledKindRefusals` still stops the build at `tsc`, five times instead of once.

- **6.4 — The known cost, accepted with eyes open: `fjs/form1040/core` gets touched five
  times instead of once.** `13-PATTERNS.md` identifies six structures in that file that must
  move together for every wired line — the `@typedef` block, the returned object, the
  `orderedLines` flattening array, the `incomeLineFieldNames` list, and two independently
  hand-typed count constants — and names it the highest-risk mechanical trap in the phase.
  Five slices means five chances to update five of six.

  This is accepted rather than avoided, because the mitigation is already in the file: the two
  count constants exist precisely to fail when the structures drift apart. Each slice's plan
  must **name all six structures explicitly in its task**, and the count constants must be
  updated in the same commit as the line they count. A single large wiring change would not
  remove this risk — it would concentrate it into one commit that is harder to review and
  harder to bisect.

- **6.5 — Slice-internal task order.** Within each slice: (1) the parameters the slice needs,
  with citations; (2) the worksheet or schedule module with its proofs, including its boundary
  probes; (3) the Form 1040 wiring across all six parallel structures; (4) the scope
  reclassification paired with its refusal-table deletion; (5) the end-to-end proof that a
  return computes the new number. Step 5 is what makes the slice vertical — a slice that stops
  after step 4 has built a module nothing calls.

### Claude's Discretion

- Module paths for the new schedules, following the established `fjs/schedule/<letter>` and
  `fjs/form<number>` conventions (`fjs/schedule/a`, `fjs/schedule/1a` or similar, `fjs/form8812`).
- Exact function names for the per-rule income definitions and worksheet lines — research
  against the printed forms decides these, subject to TAX-15's rule that each carries the
  printed line numbers in IRS order.
- Plan-to-wave assignment within the three-wave structure, and whether Wave 2's five schedules
  are five plans or fewer.
- The precise field list of `vnd.fjs.itemized_deductions`, subject to 2.1's constraints.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`fjs/tax/deduction/module.f.js`** (617 lines) — the standard deduction with age and
  blindness increments and the dependent worksheet. `deductionChoice` belongs here.
- **`fjs/document/medical_expenses/module.f.js`** (282 lines) — the taxpayer-asserted dialect
  precedent, with its no-`formRevision` / no-total / free-category reasoning already argued in
  its docstring. `vnd.fjs.itemized_deductions` follows it.
- **`fjs/schedule/b`** and **`fjs/schedule/d`** — the schedule module precedent, including
  `fjs/schedule/b`'s Form 8815 documented-boundary pattern for unpopulatable lines.
- **`fjs/tax/line16/qdcgt`** and **`fjs/tax/line16/sdtw`** — the worksheet precedent: one named
  pure function per worksheet line, printed line numbers preserved, IRS order.
- **`fjs/report/line/module.f.js`** — `ReportLine`, `declaredZero`, `totalLine`,
  `fromDocuments`, `unionSources`. Every new line uses these; nothing computes a bare number.
- **`fjs/tax/params/module.f.js`** — `taxParamsByYear[2025]`, `standardDeduction`,
  `agedOrBlindAdditional`, `dependentStandardDeductionCap`, plus seven citation proofs.

### Established Patterns

- **Documented zero vs. scope refusal** is the central distinction of this codebase
  (`fjs/return/scope`'s docstring). A legitimately-zero line cites the profile; a declared but
  unmodeled kind refuses the *whole return*, never a partial one.
- **The frozen partition** — `_EveryKindIsEitherModeledOrRefused` is a conditional type that
  fails at `tsc` if a kind is classified nowhere or twice. Adding to `modeledKinds` requires
  deleting from `unmodeledKindRefusals` in the same change.
- **Wire before reclassify** (12.1 Plan 04) — the 1040 line reads real data *before* its kind
  moves out of the refusal table, never after.
- **A payer-printed or second-source value is a proof's subject, never an input** (12.1
  Decision 2.4).
- **Money is exact decimal** via `fjs/exact` and `fjs/types/decimal`; every dialect money field
  is a string at the storage boundary and is re-parsed for exactness (Phase 4).
- **Every module carries a `proof` export**; the project is at 665 proofs, `tsc` clean.

### Integration Points

- `fjs/form1040/core/module.f.js` (2835 lines) — lines 4a/4b, 5a/5b, 6a/6b, 8, 10, 12e, 13b,
  17, 19, 20, 23, 25b, 28, 31 are all `declaredZero` today and are this phase's wiring targets.
  Three parallel structures must stay in sync: the `@typedef` block (~line 341), the returned
  object (~line 607), the flattening array (~line 1002), and the line-name list (~line 1197).
- `fjs/return/scope/module.f.js` — `modeledKinds` / `unmodeledKindRefusals` partition.
- `fjs/return/profile/module.f.js` — `returnProfileSchema`, `kindVocabulary` (frozen at 50),
  `checkReferences`, `validate`.
- `fjs/server/finance_tax_params` — serves `fjs/tax/params` to the agent; new parameters
  surface here.
- `fjs/server/finance_schema` — dialect schema surface; the new dialect registers here.
- `fjs/document/base` and `fjs/document/subject` — `base(dialect)`, `mediaTypeOf`, `formSubject`
  keyed on `(payerTin, recipientTin, accountNumber, taxYear, formType)`. The taxpayer-asserted
  dialect uses `''` for payer and account, giving one record per taxpayer per year.

</code_context>

<specifics>
## Specific Ideas

- **Criterion 5 is a gate, not a note.** `grep -rn "magi" fjs/` returns nothing *today*. This
  phase introduces five distinct income definitions, which is exactly the moment the criterion
  is at risk. It must be mechanically enforced (Decision 3.6), and the phase's verification
  must run the literal command from the criterion.

- **Criterion 3 needs proofs in BOTH directions.** The stated failure mode is an engine where
  itemizing automatically wins above the standard deduction. A case above $15,750 / $31,500
  where the standard deduction still wins is the load-bearing proof, not the easy one.

- **Criterion 2 needs a case that exercises the near-circular dependency**, specifically the
  tax-exempt-interest add-back — not merely a case where the 19 lines produce a number.

- **The stale-remedy correction (Decision 1.4) is small and easy to forget**, and it is the
  kind of thing Phase 1 and Phase 17 exist to catch. It belongs in Wave 3 beside the
  reclassification, in the same change that touches the refusal table.

</specifics>

<deferred>
## Deferred Ideas

- **Pub 590-A Worksheet 1-1** — the IRA-deduction ↔ taxable-social-security fixed point.
  Refused loudly in this phase (Decision 3.3); a future phase can model it.
- **Form 4684 and the net qualified disaster loss** — the 12e exception stays refused.
- **The §1202 exclusion percentage** — unchanged from Phase 12.1; no 1099-DIV box carries it.
- **Form 4952 and the investment interest election** — deliberately still refusing, as the
  live proof that the Schedule D Tax Worksheet branch's guard is real (12.1 Decision 1.2).
- **Form 1098 / 1098-E as transcribed dialects** — a real information return exists for
  mortgage interest and student loan interest; a later phase could add them and let a proof
  watch them against the taxpayer-asserted record, exactly as Decision 2.2 does for withholding.
- **State returns** — out of scope project-wide. The state/local rows stay stored and, apart
  from Decision 2.2's proof, uncomputed.
- **Capital loss carryover (TAX-17)** — Phase 15, T3.
- **Household employee wages, Medicaid waiver payments, other earned income, other-form
  withholding** — no dialect models them and no phase is scheduled (Decision 1.4).

</deferred>
