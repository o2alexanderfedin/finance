---
phase: 20-unemployment-compensation
verified: 2026-08-15T00:00:00Z
status: gaps_found
score: 5/6 success criteria met
overrides_applied: 0
retrofit: true
code_commit: 8d00990
suite_baseline: "tests 6384, pass 6384, fail 0, exit 0; 951 unique project-local proof leaves"
gaps:
  - truth: "Criterion 4 — boxes 2, 5, 6, 7 and 9 are refused by name, NAMING THE DESTINATION LINE, when present and non-zero"
    status: partial
    reason: >-
      The refusal itself, the by-name half, the accepted-when-zero control and box 11's
      exclusion are all real and all mutation-confirmed by this verifier. The
      "naming the destination line" clause is TRUE of the code today but entirely
      UNPROVEN: erasing every destination string from the refusal message leaves the
      suite fully green (6384/6384, exit 0). No proof leaf asserts the destination.
      Separately, box 7's destination names a FORM ("Schedule F"), not a line.
    artifacts:
      - path: "fjs/document/1099g/module.f.js"
        issue: >-
          `perUnmodeledBoxRefusal` (lines 243-251) asserts only `v.includes(field)` and
          `v.includes('cannot compute')`. Mutation Gate 4 — `${destination}` ->
          `${destination.slice(0, 0)}` at line 183 — SURVIVED with the suite green.
      - path: "fjs/document/1099g/module.f.js"
        issue: >-
          `unmodeledMoneyBoxes[3]` (line 137) gives box 7's destination as
          "Schedule F, which this engine does not model" — a form, not a line, unlike
          the other four entries which name "Schedule 1 line 1" / "Schedule 1 line 8".
    missing:
      - "An assertion in `perUnmodeledBoxRefusal` that the message contains the box's own destination string — hand-typed per box, or the `unmodeledMoneyBoxes` destination read as an independent expected value."
      - "Either a destination for box 7 that names a line, or a note at the site stating that Schedule F has no single destination line and the form name is the honest answer."
unfalsifiable_criteria:
  - criterion: 1
    reason: >-
      The four registration points are verbatim the four the commit message lists
      ("kindVocabulary (50 -> 51) and modeledKinds (20 -> 21). finance_schema registers
      the dialect (9 -> 10) and fjs/media/dialects gains its detect entry (13 -> 14)").
      A criterion enumerating the diff's own four touch-points cannot fail against that
      diff. The live-server clause IS falsifiable and was independently exercised, which
      is the only part of criterion 1 that carried information.
  - criterion: 6
    reason: >-
      "Each of the THREE behaviours above was watched to fail" takes both its count and
      its selection from the commit message's own three-item gate list. It cannot fail,
      because the gates it names are the gates the author had already run. Its blind
      spot is exactly what a fourth gate found: the destination-naming behaviour was
      never watched to fail, and it survives.
human_verification:
  - test: >-
      Re-feed the ORIGINAL IRS Wage and Income Transcript — the real document that
      triggered this work on 2026-08-14 — through the engine and confirm the return now
      computes and that line 8 and line 25b carry the transcript's own printed figures.
    expected: >-
      `form1040Report` returns `kind: 'ok'`, 1040 line 8 equals the transcript's 1099-G
      box 1, and 1040 line 25b includes its box 4.
    why_human: >-
      The document is the owner's private taxpayer data and is not in the repo. This
      verifier reproduced the SHAPE (a wages + 1099-G transcript) from synthetic values
      and confirmed it computes end to end, but only the owner can confirm the actual
      document that was refused is now accepted with the right figures.
  - test: >-
      Decide whether `vnd.fjs.1099g` should also carry printed boxes 10a (State) and
      10b (State identification no.).
    expected: "An owner decision, recorded at the site or in `fjs/todo/`."
    why_human: >-
      The dialect stores box 11 (state withholding) on the stated grounds that "a state
      return would want it", but stores neither the state nor the state payer ID, so a
      state return could not use box 11 as stored. Whether that is a gap or deliberate
      minimalism is a scope judgment, not a code fact.
---

# Phase 20: Unemployment Compensation Verification Report

**Phase Goal:** A 1099-G's unemployment compensation reaches Form 1040 line 8 and its
withholding reaches line 25b, and every box this engine cannot compute is refused by name
rather than silently dropped.
**Verified:** 2026-08-15
**Status:** gaps_found — 5 of 6 criteria met, 1 partial
**Re-verification:** No — initial verification
**Phase type:** Retrofit. The code shipped 2026-08-14 in `8d00990` with no PLAN, SUMMARY,
CONTEXT, VALIDATION, PATTERNS or code review. Their absence is the premise of the phase and
is not reported as a finding. Everything below verifies the **code**.

## How this verification was conducted

Nothing in this report rests on the commit message. Every claim below is either a direct
read of the shipped source, a live MCP server probe run by this verifier, a `tsc`
invocation run by this verifier, or a mutation gate executed and restored by this verifier.

Two mechanical facts govern the numbers:

- **Every project-local proof leaf is registered twice** by root discovery: 951 unique
  `✔ import("./fjs/` names produce 1902 lines. So a failure count in the tables below is
  always **2× the number of distinct leaves**. Distinct leaf names are what is listed.
- **Baseline, measured on this checkout before any mutation:** `npm test` → `tests 6384,
  pass 6384, fail 0`, exit 0; 951 unique project-local proof leaves. `functionalscript`
  installed `0.43.1`, lockfile `0.43.1` — no checkout drift (AGENTS.md's "sixteen `tsc`
  errors that are not defects" trap does not apply here).

**HEAD moved three times from outside this session while verification was running**
(`d05d5ce`, then `b7fcc22`), exactly the hazard AGENTS.md records. Each move touched only
`.planning/*.md`; `git diff --stat 8d00990 HEAD -- fjs demo index.js '*.test.js'
package.json` is **empty**, so every measurement in this report was taken against the same
code. Verified explicitly rather than assumed.

## Goal Achievement

### The Six Success Criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | `vnd.fjs.1099g` exists and is registered in `kindVocabulary`, `modeledKinds`, `finance_schema` and `fjs/media/dialects`; a live server reports it | ✓ MET | **Live server probe, not grep.** Spawned a real `node index.js <tmp home>` process and drove it over real stdio JSON-RPC. `finance_schema{dialect:'vnd.fjs.1099g'}` returned `isError: false` and an 840-character JSON Schema carrying all eight money boxes. The **control** — `finance_schema{dialect:'vnd.fjs.nope'}` — refused and enumerated the live known set: `…vnd.fjs.ssa1099, vnd.fjs.1099g, vnd.fjs.1099div, vnd.fjs.1099b` (ten). `cas_add` of a real 1099-G followed by `cas_refresh` returned `{"dialectCounts":{"application/vnd.fjs.1099g+json":1,"text/plain":1}}` — `detectFinance` (i.e. `fjs/media/dialects`) classifying the blob on a live server, with the non-zero-box-2 blob correctly falling through to `text/plain`. Runtime probe: `kindVocabulary.length === 51`, `modeledKinds.length === 21`, both containing `unemploymentCompensation`, and `classifyScope(['unemploymentCompensation']).kind === 'ok'`. Removal from `modeledKinds` is **compiler-enforced**: deleting the entry fails `tsc` at `fjs/return/scope/module.f.js(372,21): error TS2344: Type 'false' does not satisfy the constraint 'true'` (the `_EveryKindIsEitherModeledOrRefused` partition). See "Unfalsifiable as written" below — the four-registration half of this criterion restates the diff; the live-server half is what carried information. |
| 2 | Box 1 summed across every 1099-G is Schedule 1 line 7 and reaches 1040 line 8 through Part I's total, not a side channel | ✓ MET | **Path traced in source, then executed.** `fjs/schedule/1/module.f.js:234` `const line7 = unemploymentCompensationLine(profile)(unemploymentForms)`; `:242-244` `line10 = totalLine(…)([line1, line2a, line3, line4, line5, line6, line7, line9])`; `fjs/form1040/core/module.f.js:636-641` `const line8 = { value: scheduleOneResult.line10.value, sources: scheduleOneResult.line10.sources, rule: '1040 line 8' }`. There is **one** `scheduleOne(...)` call and 1040 line 8 reads **only** `line10` — no path from `unemploymentForms` to line 8 that bypasses the Part I total exists. Summation across multiple forms is real: `line7SumsEveryUnemploymentFormCitingEach` uses two payers ($4,554.00 + $1,000.00 = 555400n) and asserts both document hashes. **Executed end to end by this verifier** through the full `form1040Report` entry point: line 8 = `455400n`, sources = the profile's `declaredKinds` ∪ `{sha256-1099g-01/box1UnemploymentCompensation}`. **Mutation Gate 2 confirms it is load-bearing** (below). |
| 3 | Box 4 joins 1040 line 25b alongside the existing 1099 withholding terms | ✓ MET | `fjs/form1040/core/module.f.js:1322-1337`: 25b is `addBoxSums` over interest, retirement, dividend, brokerage **and** `unemploymentForms`, each on `box4FederalIncomeTaxWithheld`. "Alongside" is genuinely verified, not assumed: the commit **re-nested** the dividend/brokerage pair to make room, and the pre-existing `line25bSumsAllFourWithholdingDocumentTypes` leaf (hand-typed `$185.00`, `sources.length === 4`) stayed green through that re-nesting — so no existing term was displaced. 25a (W-2 withholding) is untouched. **Executed:** live run gives line 25b = `45400n` citing `sha256-1099g-01/box4FederalIncomeTaxWithheld`. **Mutation Gate 3 confirms it is load-bearing** (below). |
| 4 | Boxes 2, 5, 6, 7, 9 refused **by name, naming the destination line**, when non-zero; accepted when zero; box 11 deliberately not refused | ⚠ PARTIAL | Four of five clauses MET and every one mutation-confirmed — see the breakdown below. The fifth, **"naming the destination line"**, is true of the code and **completely unproven**: Mutation Gate 4 erased every destination from the refusal message and the suite stayed at **6384/6384, exit 0**. Additionally box 7's destination names a *form* ("Schedule F, which this engine does not model"), not a line. This is the one gap in the phase. |
| 5 | `Form1040Inputs.unemploymentForms` is required, enforced by `tsc`, not convention | ✓ MET | **Tested, not read.** Deleted `unemploymentForms: []` from `demo/lib/fixtures.js:169` (`git diff --numstat` = `0  1`, a pure deletion). `npx tsc --noEmit` exit 1 with `TS2741: Property 'unemploymentForms' is missing … but required in type 'Form1040Inputs'` at **`demo/steps/03-return.js(36,44)`** and **`demo/steps/04-refusal.js(67,48)`**. Restored byte-identically; repeated at the second call site, `demo/steps/05-exactness.js:101` → `TS2741` at `(104,44)` and `(105,42)`. Restored byte-identically; `git status --short` empty after each. `demo/` is inside `tsc`'s scope — `tsconfig.json` declares no `include` and excludes only `functionalscript`/`node_modules`. Caveat recorded below: `inputsOf`'s test-helper default, and the fact that `form1040Report` has no server caller at all. |
| 6 | Each of the three behaviours was watched to fail; a mutation gate per behaviour; production restored byte-identical | ✓ MET (with two corrections to the recorded red sets) | All three gates **independently re-executed by this verifier** and all three reddened; all three restored byte-identically with `git status --short` empty; full suite re-confirmed `6384/6384`, exit 0. Two recorded red sets do not match what actually happens — see "Mutation Gates" and "Corrections to the commit message's own record". See also "Unfalsifiable as written": this criterion takes its count and its selection from the commit message, and its blind spot is precisely the survivor Gate 4 found. |

**Score: 5/6 met, 1 partial.**

### Criterion 4, clause by clause

| Clause | Status | Evidence |
|--------|--------|----------|
| Boxes 2, 5, 6, 7, 9 refused when present and non-zero | ✓ MET | `fjs/document/1099g/module.f.js:176-186`. **Gate 1c**: disabling the refusal reddens exactly the five `*IsRefusedWhenNonZero` leaves and nothing else. |
| …**by name** | ✓ MET | Message is `` `${field} carries …` ``; each leaf asserts `v.includes(field)`. Reddens under Gate 1c. |
| …**naming the destination line** | ✗ UNPROVEN | **Gate 4 SURVIVED.** `${destination}` → `${destination.slice(0, 0)}` at line 183 → `tests 6384, pass 6384, fail 0`, exit 0. No leaf asserts the destination. Box 7's destination names a form, not a line. |
| Accepted **silently when zero** | ✓ MET | `perUnmodeledBoxZeroAccepted`, five leaves. **Gate 1a** (true inversion) reddens all five, so the control is a genuine control and not decoration. |
| Box 11 **deliberately** not refused, with a stated reason | ✓ MET | Reason stated in three independent places: the module header (lines 20-39), the `unmodeledMoneyBoxes` docstring (lines 127-132), and the dedicated proof leaf `box11StateWithholdingIsStoredNotRefused`. Deliberateness is **load-bearing, not decorative**: **Gate 5** added box 11 to the refusal list and reddened two leaves — the dedicated leaf and the hand-typed `boxListsAreCovered` count. An oversight would have left both green. |

### Mutation Gates — all executed by this verifier, none taken on trust

Every gate was applied to the **condition**, never to a reference; every one produced an
`ℹ tests` summary line (so none measured the compiler); every one was restored with
`git status --short` empty before the next.

| Gate | Site | Mutation | `npm test` result | Distinct leaves reddened |
|------|------|----------|-------------------|--------------------------|
| **1a** (inversion) | `fjs/document/1099g/module.f.js:181` | `!== 0n` → `=== 0n` | tests 6384, **fail 20**, exit 1 | **10**: all five `*IsRefusedWhenNonZero` **and** all five `*IsAcceptedWhenZero` |
| **1b** (attempted) | same | `&& false` | **NO `ℹ tests` LINE** — `TS7027: Unreachable code detected` at line 182 | — (aborted at compile; **recorded, not silently substituted**, per AGENTS.md) |
| **1c** (reshaped) | same | `&& printed.length > 1000` — semantically identical to 1b, keeps `printed` live and the body reachable | tests 6384, **fail 10**, exit 1 | **5**: `box2…`, `box5…`, `box6…`, `box7…`, `box9…IsRefusedWhenNonZero`. The five `*IsAcceptedWhenZero` **stayed green** — the refusal is isolated from the zero path. |
| **2** | `fjs/schedule/1/module.f.js:176` | `box1UnemploymentCompensation !== undefined` → `=== undefined` | tests 6384, **fail 8**, exit 1 | **4**: `line7SumsEveryUnemploymentFormCitingEach`, `line7ReachesTheLine10TotalThatFeeds1040Line8`, `formWithoutBox1ContributesNoSource`, and `form1040/core…unemploymentReachesLineEightAndItsWithholdingReachesLineTwentyFiveB`. `absentUnemploymentIsZeroWithProfileProvenance` **stayed green** — correctly: with no forms the filter's sense is unobservable. |
| **3** | `fjs/form1040/core/module.f.js:1335` | `sumBoxOverDocuments(unemploymentForms)` → `sumBoxOverDocuments(unemploymentForms.slice(0, 0))` — the "drop the term" intent in a form that keeps the destructured binding live, avoiding the `TS6133` orphan AGENTS.md warns about | tests 6384, **fail 2**, exit 1 | **1**: `unemploymentReachesLineEightAndItsWithholdingReachesLineTwentyFiveB` |
| **4** (this verifier's addition) | `fjs/document/1099g/module.f.js:183` | `${destination}` → `${destination.slice(0, 0)}` | **tests 6384, pass 6384, fail 0, exit 0** | **0 — SURVIVOR.** The destination-naming half of criterion 4 is uncovered. |
| **5** (this verifier's addition) | `fjs/document/1099g/module.f.js:139` | add `['box11StateIncomeTaxWithheld', …]` to `unmodeledMoneyBoxes` | tests 6388, **fail 4**, exit 1 | **2**: `box11StateWithholdingIsStoredNotRefused`, `boxListsAreCovered` |
| **6** (`tsc` only) | `fjs/return/scope/module.f.js:222` | delete `'unemploymentCompensation'` from `modeledKinds` | `tsc` exit 1: `TS2344` at `(372,21)` | — (compile-time partition guard; recorded as such, not as a proof result) |

**Restoration.** After every gate: `git checkout --` or a byte-identical copy-back, then
`git status --short` confirmed empty before proceeding. Final full-suite re-run after the
last restore: **`tests 6384, pass 6384, fail 0`, exit 0**, 951 unique project-local proof
leaves — identical to baseline.

### `tsc` Gates (criterion 5)

| Deletion | `git diff --numstat` | `tsc` result |
|----------|----------------------|--------------|
| `demo/lib/fixtures.js:169` `unemploymentForms: [],` | `0  1` | exit 1 — `TS2741` at `demo/steps/03-return.js(36,44)` and `demo/steps/04-refusal.js(67,48)` |
| `demo/steps/05-exactness.js:101` `unemploymentForms: [],` | `0  1` | exit 1 — `TS2741` at `(104,44)` and `(105,42)` |

### Live Server Probe (criterion 1)

| Probe | Result |
|-------|--------|
| `initialize` against a real `node index.js <tmp>` process | `{"name":"finance-mcp","version":"0.12.0"}` |
| `finance_schema{dialect:'vnd.fjs.1099g'}` | `isError: false`; 840-char JSON Schema naming `box1UnemploymentCompensation`, `box2StateOrLocalIncomeTaxRefunds`, `box4FederalIncomeTaxWithheld`, `box11StateIncomeTaxWithheld` and the rest; `required` = the six non-optional fields |
| `finance_schema{dialect:'vnd.fjs.nope'}` (control) | `isError: true`; message enumerates the live known set of **ten**, including `vnd.fjs.1099g` |
| `cas_add` a real 1099-G, then `cas_refresh` | `{"status":"refreshed","dialectCounts":{"application/vnd.fjs.1099g+json":1,"text/plain":1}}` — `detectFinance` classifying it live |
| `cas_add` a 1099-G with `box2 = '900.00'`, then `cas_refresh` | classified `text/plain`, i.e. `checkOneZeroNineNineG` rejected it — the criterion-4 refusal observed through the media layer on a live server |

### Full-Report Execution (criteria 2 and 3, through the scope guard)

The repo's own two end-to-end leaves call `computedLines`, which invokes
`form1040IncomeLines` / `form1040TaxAndPaymentLines` **directly and therefore bypasses
`classifyScope`**. Since the guard's refusal is the reason this phase exists, this verifier
ran the full `form1040Report` entry point independently, on a wages + 1099-G profile
declaring `unemploymentCompensation`:

```
form1040Report kind = ok
  1040 line 1a  = 4550500n   [w2/box1WagesTipsOtherCompensation]
  1040 line 8   = 455400n    [profile/declaredKinds, sha256-1099g-01/box1UnemploymentCompensation]
  1040 line 9   = 5005900n
  1040 line 25b = 45400n     [sha256-1099g-01/box4FederalIncomeTaxWithheld]
```

The shape of transcript that was refused on 2026-08-14 now computes, through the guard, with
the 1099-G cited on both lines.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| **DOC-18** | `vnd.fjs.1099g`; boxes 1 and 4 computed; 2/5/6/7/9 refused by name when non-zero, accepted when zero; box 11 deliberately not refused; registered in four places in the same commit | ✓ SATISFIED (with the criterion-4 coverage gap) | Criteria 1 and 4 above. Registration in all four places confirmed at runtime and, for `modeledKinds`, at compile time. |
| **TAX-18** | Schedule 1 line 7 is a real computed line summing box 1, flowing to 1040 line 8 via Part I's total; box 4 joins 25b; `unemploymentForms` required and `tsc`-enforced | ✓ SATISFIED | Criteria 2, 3 and 5 above, each mutation- or `tsc`-confirmed. |

No orphaned requirements: `.planning/REQUIREMENTS.md` maps exactly DOC-18 and TAX-18 to
Phase 20, and both appear in the roadmap entry's `Requirements` field.

### Anti-Patterns Found

| File | Pattern | Severity | Note |
|------|---------|----------|------|
| all nine files `8d00990` touched | `TBD`\|`FIXME`\|`XXX`\|`TODO`\|`HACK`\|`PLACEHOLDER` | — | **Zero matches.** No debt markers; the debt-marker gate is clean. |
| `fjs/form1040/core/module.f.js`, `fjs/return/scope/module.f.js` | the word `placeholder` | ℹ Info | Ten occurrences, every one prose in a comment asserting the *absence* of a placeholder ("a real, non-placeholder line 13b"). Not stubs. |

---

## Criteria that are unfalsifiable as written

This is the judgment the phase's own roadmap entry asks for, and it is the most useful thing
this report produces. The criteria were written on 2026-08-15 against code committed on
2026-08-14, and two of the six are restatements of the commit message rather than
independent claims.

**Criterion 1 is half a restatement.** Its list of four registration points —
`kindVocabulary`, `modeledKinds`, `finance_schema`, `fjs/media/dialects` — is verbatim the
list in `8d00990`'s own message ("kindVocabulary (50 -> 51) and … modeledKinds (20 -> 21).
finance_schema registers the dialect (9 -> 10) and fjs/media/dialects gains its detect entry
… (13 -> 14)"). A criterion that enumerates the diff's own touch-points is satisfied by that
diff by construction and could not have failed. What *could* have failed, and therefore what
carried the information, is the clause the verification brief insisted on: **"a live server
reports it."** That is a genuinely independent runtime question — the dialect could have been
registered in a map that no live path reads, `toJsonSchema` could have choked on
`option(true)`, the module could have been imported nowhere. It was probed and it holds, on a
real process, three separate ways. **Scored MET on the strength of the live probe, not the
registration list.**

**Criterion 1 also contains a category slip.** It says the *dialect* is "registered in
`kindVocabulary`, `modeledKinds`". Neither list holds dialect tags; both hold *kinds*. What
was registered there is the kind `unemploymentCompensation`, which is a different object from
the tag `vnd.fjs.1099g`, and the criterion conflates them. This is a symptom of writing
criteria from a diff rather than from a specification — the diff touched four files, so the
criterion named four files.

**Criterion 6 cannot fail, and its blind spot is real, not theoretical.** "Each of the
**three** behaviours above was watched to fail" takes both the number *three* and the choice
of which three from the commit message's own gate list. There is no way for the shipped code
to fail a criterion whose content is "the gates the author ran, were run." The demonstration
that this matters is Gate 4: a fourth behaviour — **naming the destination line**, which
criterion 4 states in bold — was never watched to fail, and when this verifier watched it, it
did not fail. Criterion 6 is fully satisfied and the codebase still has an uncovered
behaviour, which is exactly the failure mode of reverse-engineered criteria.

**Criteria 2, 3, 4 and 5 are genuinely falsifiable**, and each was falsified before being
accepted: 2 and 3 by mutation gates that reddened named leaves, 4 by a gate that reddened
five leaves and a control gate that reddened five more, 5 by a `tsc` run that failed at three
production call sites. Criterion 4 is the one that carries a real, gradeable failure — which
is what a falsifiable criterion is for.

**One further observation on criterion 5's scope.** It says `tsc` enforces the field "on every
production caller". True — but there are exactly three, all in `demo/`, because
`form1040Report` **has no server path at all**; `28d29c9`'s own handoff records this
("form1040Report has no production caller — no server path produces a 1040 today"), and a
repo-wide grep confirms the only non-proof callers are `demo/steps/03-return.js`,
`demo/steps/04-refusal.js` and `demo/steps/05-exactness.js`. The criterion is true; the
population it quantifies over is smaller than the phrase "every production caller" suggests.

---

## What the missing planning artifacts would plausibly have caught

Each item below is a real defect or drift found by this verification, paired with the
specific skipped artifact that this project's own history shows catches that class. None of
them is fatal; all of them are the kind of thing that is cheap during planning and annoying
afterwards.

**1. The survivor — a stated behaviour with no proof. (A plan-check / VALIDATION would have
caught this.)** Criterion 4 states "naming the destination line" in bold, the code implements
it for all five boxes, and no assertion anywhere observes it. This is precisely the class the
project's own 95-mutation sweep found 24 of — "data-shaping code that ships real financial
values" whose message content is unpinned. A VALIDATION artifact enumerating "what must be
watched to fail" would have listed four behaviours, not three.

**2. The hand-typed independent list silently fell one short. (A code review would have caught
this.)** `fjs/return/scope/module.f.js:640`,
`allTwentyModeledKindsDeclaredTogetherAreInScope`, hand-types the twenty modeled kinds with
the explicit comment "hand-typed rather than read from `modeledKinds`, **so this leaf states
independently what the engine claims to be able to compute**". `unemploymentCompensation` was
added to `modeledKinds` and **not** to that list, so the independent statement is now
incomplete by exactly the kind this phase added. The leaf is still named `...Twenty` and the
count leaf at `:558` is still named `modeledKindsIsExactlyTwenty` while asserting **21**.
This is a mild instance of the project's self-described most-repeated defect: a count that is
true of the part someone examined and false of the whole. *Mitigating:* removal of the kind
is still caught two other ways — the hand-typed `expectedModeledKindCount = 21`, and the
`tsc` partition (Gate 6, `TS2344`). So the risk is naming and drift, not silent loss.

**3. The established per-reclassification convention was broken. (A PATTERNS artifact exists
for exactly this.)** Every prior move into `modeledKinds` added an isolated in-scope leaf —
`theFourKindsThisPlanReclassifiedAreInScopeTogether`,
`seniorAndOtherScheduleOneADeductionsIsInScopeAlone`, `itemizedDeductionsIsInScopeAlone`,
`theTwoKindsThisPlanReclassifiedAreInScopeTogether`. Four precedents, and the fifth
reclassification added none. There is consequently **no proof leaf anywhere** asserting that
`classifyScope(['unemploymentCompensation'])` is in scope — the very condition whose failure
started this phase. This verifier confirmed it holds at runtime; the suite does not.

**4. The repo's two end-to-end leaves bypass the scope guard.** Both new `form1040/core`
leaves route through `computedLines`, which calls `form1040IncomeLines` /
`form1040TaxAndPaymentLines` directly. That is a legitimate, established pattern in this
file — but it means the shipped suite never runs a 1099-G return through `form1040Report`,
the one entry point that runs `classifyScope` first, and therefore never proves that the
originating refusal is gone. This verifier ran it manually (above) and it computes. A
CONTEXT/VALIDATION pass would have named "the transcript that was refused now computes" as
the phase's acceptance criterion, and that leaf would exist.

**5. Six stale prose statements, five of them made stale by this commit.** Every one is a
docstring the commit's own edits falsified and did not update:

| Location | Says | Truth after `8d00990` |
|---|---|---|
| `fjs/return/scope/module.f.js:30` | "Every one of the **fifty** kinds…" | 51 |
| `fjs/schedule/1/module.f.js:31` | "The frozen **50-kind** `kindVocabulary`" | 51 |
| `fjs/schedule/1/module.f.js:217-221` (`scheduleOne`'s own docstring) | "**Every line is `value: 0n`** for any profile that does not declare `scheduleOneAdditionalIncome`/`scheduleOneAdjustments`" | False — line 7 is now a real computed line. The module header's whole "Why the whole schedule collapses to documented zero" section is now qualified in a way it does not say. The new `unemploymentCompensationLine` got an excellent docstring; the two docstrings it invalidated got nothing. |
| `fjs/media/dialects/module.f.js:35, 118, 153` | "`financeDialects` carries **THIRTEEN** entries: the **twelve** local dialects plus `revisionDialect`" | 14 = 13 local + `revisionDialect`. `expectedDialectCount` was bumped to 14; the three prose statements next to it were not. |
| `fjs/form1040/core/module.f.js:3637-3643` | "line25b now sums **FOUR** document types" / `line25bSumsAllFourWithholdingDocumentTypes` | Five |
| `demo/lib/fixtures.js:148-157` | "the sample return holds none of the **seven**, so all are empty" | Eight |
| `fjs/server/finance_schema/module.f.js:11, 30` | "each of the **seven** known dialect tag strings"; a paragraph per addition through "the **eighth and ninth**" | Ten registered, no paragraph for the tenth. (The word "seven" was *already* stale before this commit — pre-existing, not caused here.) |

**6. One internal inconsistency inside the new file itself.**
`fjs/document/1099g/module.f.js:12` opens "A 1099-G carries **nine** distinct money boxes",
while `moneyBoxFields` has **eight** entries and `expectedMoneyBoxCount` is hand-typed as
**8**. The header and the code disagree by one in the same file.

**7. A design question nobody was asked.** Box 11 is stored on the stated grounds that "a
state return would want it", but the dialect models neither box 10a (State) nor box 10b
(State identification no.), so box 11 as stored cannot be attributed to a state. The
reasoning for keeping box 11 out of the refusal list is sound and correct — state withholding
genuinely never reaches a federal return — but the positive justification for *storing* it is
only half-served by the schema. Raised as a human decision, not a defect.

---

## Corrections to the commit message's own record

Recorded because criterion 6 is about the *record* of the gates, and two entries in that
record do not survive re-execution. Both errors are in the safe direction — the gates bite
harder than claimed — but AGENTS.md is explicit that a predicted red set is itself a claim.

- **"inverting the dialect's non-zero refusal reddened exactly the five
  `IsRefusedWhenNonZero` leaves, nothing else."** A true **inversion** (`!== 0n` → `=== 0n`)
  reddens **ten** distinct leaves: the five refusals *and* the five `IsAcceptedWhenZero`
  controls, because a zero box now refuses. The recorded red set is only consistent with a
  **disabling** mutation, not an inversion. This verifier ran both and reports both: the
  inversion (Gate 1a, 10 leaves) and the disabling (Gate 1c, exactly 5, controls green). The
  underlying property is proven either way; the word "inverting" is wrong.
- **"inverting Schedule 1's box-1 filter reddened three line-7 leaves."** It reddens **four**
  — the three in `fjs/schedule/1` plus `form1040/core`'s
  `unemploymentReachesLineEightAndItsWithholdingReachesLineTwentyFiveB`. The accompanying
  claim that "the absent-is-zero leaf correctly stayed green" is exactly right and was
  reproduced.
- **"dropping the 1099-G term from line 25b reddened the end-to-end leaf."** Exact, and
  reproduced (1 leaf). Note that the literal "drop the term" edit orphans the
  `unemploymentForms` destructured binding and would have failed `tsc` under
  `noUnusedLocals`; this verifier used `unemploymentForms.slice(0, 0)`, the
  semantically-identical binding-preserving form AGENTS.md prescribes.
- **A separate, positive finding about a written-down mutation that cannot run.** The
  `&& false` idiom AGENTS.md itself recommends **does not compile in this repo**:
  `tsconfig.json` sets `allowUnreachableCode: false`, so `if (cond && false) { … }` fails with
  `TS7027: Unreachable code detected` and `node --test` never runs. Gate 1b hit this exactly.
  Anyone following AGENTS.md's `(spouseItemizes && false)` recipe on an `if` **statement**
  (as opposed to inside a boolean expression that is consumed) will silently measure the
  compiler. The working reshape used here is a never-true but not statically-false conjunct:
  `&& printed.length > 1000`.

---

## Human Verification Required

1. **Re-feed the original transcript.** The real IRS Wage and Income Transcript that the
   engine refused on 2026-08-14 is not in the repo. This verifier reproduced its *shape* with
   synthetic figures and confirmed the return now computes through the full guard. Only the
   owner can confirm the actual document is now accepted with its own printed figures on
   lines 8 and 25b.
2. **Boxes 10a/10b.** Decide whether `vnd.fjs.1099g` should carry the state and state
   identification number alongside box 11, or whether storing box 11 alone is the intended
   minimum. Record the decision at the site or in `fjs/todo/`.

---

## Gaps Summary

The phase goal is **substantially achieved**. Unemployment compensation genuinely travels
1099-G box 1 → Schedule 1 line 7 → Part I total (line 10) → 1040 line 8, and box 4 genuinely
joins 1040 line 25b beside the four existing 1099-family terms. Both paths were traced in
source, executed end to end through the real `form1040Report` entry point by this verifier,
and independently confirmed load-bearing by mutation gates that reddened named leaves and
were restored byte-identically. The dialect is registered and a live MCP server reports it
three different ways. The required-field claim is enforced by `tsc` at three real call sites,
verified by deleting the field and reading the `TS2741`.

**One gap.** Criterion 4's bolded clause — refusals must name **the destination line** — is
implemented but has no proof behind it: erasing every destination string from the refusal
message leaves the suite fully green. Box 7's destination also names a form rather than a
line. The fix is two lines of assertion, and it is the one thing this verification produces
that changes the code.

**Two criteria could not have failed as written** (1's registration list, 6's gate list),
because both were reverse-engineered from the commit that satisfies them. Scoring them MET is
accurate but uninformative; they are recorded as unfalsifiable above rather than counted as
evidence. That criterion 6 is fully satisfied *while an unwatched behaviour survives* is the
concrete cost of writing criteria after the code, and is the single most useful thing this
retrofit verification found.

**Working tree.** `git status --short` is empty. `npm test` exits 0 at `tests 6384, pass
6384, fail 0`, with 951 unique project-local proof leaves — identical to the pre-verification
baseline.

---

_Verified: 2026-08-15_
_Verifier: Claude (gsd-verifier) — seven mutation gates and three `tsc` gates executed and restored by this verifier; live MCP server probed in a separate OS process_

---

## Resolution of both `human_needed` items — 2026-08-15

Both were closed the same day this report was written. Neither needed a new phase.

### 1. Re-feed the original transcript — **CLOSED, confirmed**

The IRS Wage and Income Transcript (TIN `XXX-XX-1426`, tax period `12-31-2025`, tracking number
`111112058106`) was re-read and its figures driven through the **full `form1040Report` entry
point** — not `computedLines`, which is what the phase's own leaves used and which skips the
scope guard.

| 1040 line | Expected | Engine | Source |
|---|---|---|---|
| 1a wages | $45,505.00 | ✅ | $35,937.00 + $9,568.00, two W-2s |
| **8 unemployment** | **$4,554.00** | ✅ | **the line that used to refuse** |
| 9 total income | $50,059.00 | ✅ | |
| 11a / 11b AGI | $50,059.00 | ✅ | no adjustments |
| 12e standard deduction | $15,750.00 | ✅ | single, under 65 |
| 15 taxable income | $34,309.00 | ✅ | |
| 25a W-2 withholding | $8,962.00 | ✅ | $6,384.00 + $2,578.00 |
| **25b 1099-G withholding** | **$454.00** | ✅ | |
| 25d total withholding | $9,416.00 | ✅ | |
| 16 tax (Tax Table) | $3,881.00 | ✅ | |
| **34 refund** | **$5,535.00** | ✅ | matches the independent hand calculation |

**Provenance was checked, not just the amounts.** Line 8 cites the real 1099-G's
`box1UnemploymentCompensation` and line 25b cites its `box4FederalIncomeTaxWithheld` — the
figures are not merely equal to the document, they are traceable to the box.

Two transcript details worth recording, because both exercise DOC-11/DOC-12 rather than
merely passing through it:
- *"1099G Offset: Not Refund, Credit or Offset for Trade or Business"* → box 8 **unchecked**,
  therefore **absent**, which under DOC-12's `option(true)` convention is the only way to say so.
- The transcript prints **no state block at all**, so 10a/10b/11 are **absent, not zero** —
  exactly the distinction DOC-11 exists to preserve.

### 2. Boxes 10a/10b — **CLOSED, the gap was real and is fixed**

The report was right that the justification was half-built. `box11StateIncomeTaxWithheld` was
stored on the stated grounds that *"a state return would want it"*, while neither the state nor
its payer identification number was modelled — and **a withheld amount with no state attached
is of no use to a state return.** The reasoning did not support what it was used to justify.

Fixed by modelling the state block properly, following `fjs/document/w2`'s `stateLocalEntry`
precedent — the same problem one dialect over, already solved in this tree:

```js
const stateEntry = { state, statePayerStateNumber?, stateIncomeTaxWithheld? }
box10Through11: option(array(stateEntry))
```

An **array**, because the printed 1099-G carries two 10a/10b/11 rows and a taxpayer who moved
mid-year receives exactly that. The row's money field goes through the same `moneyFieldError`
every top-level box does, so it is not a hole in DOC-11's parsing rule; the refusal names the
state. Four new proofs, and the money check was **watched to fail** (condition mutated, one leaf
reddened, restored byte-identical).

This also aligns the dialect with REQUIREMENTS.md's Out-of-Scope entry for state returns —
*"store W-2 boxes 15-20 faithfully, compute nothing"* — which is now what the 1099-G does too.

**Suite after both fixes: `npm test` 6394/6394, exit 0, `tsc` clean.**
