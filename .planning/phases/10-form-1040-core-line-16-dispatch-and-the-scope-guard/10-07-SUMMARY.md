---
phase: 10-form-1040-core-line-16-dispatch-and-the-scope-guard
plan: 07
subsystem: scope-guard
tags: [scope-guard, classify-scope, frozen-modeled-set, refusal-content, tsc-exhaustiveness, phase-10]

requires:
  - phase: 10-04
    provides: "kindVocabulary — the frozen 50-member declared-kind vocabulary in 1040 form order, and the `Kind` typedef this module partitions"
  - phase: 09
    provides: "fjs/report/guard's classifyRunOutcome — the discriminated {kind:'ok'|'error'} outcome shape, and its recorded account of a rule that once existed twice"
  - phase: 07
    provides: "fjs/guest's _CasOpIsExactlyTheFourCommands — the Assert<Equal<…>> frozen-vocabulary precedent"
provides:
  - "modeledKinds — the six kinds a real stored document feeds today, frozen"
  - "unmodeledKindRefusals — forty-four entries, each naming a 1040 line, a human label and a remedy with its requirement ID and phase"
  - "_EveryKindIsEitherModeledOrRefused — the partition as a tsc property: a kind classified nowhere fails to compile"
  - "ScopeOutcome and ScopeError (= Extract<ScopeOutcome, {kind:'error'}>), so a consumer reaches message/unmodeled without a cast or a non-null assertion"
  - "scopeRefusal — the ONE place a scope refusal is built, imported by Plan 10-08 rather than reimplemented"
  - "classifyScope — declared kinds vs modeled kinds, refusing the WHOLE return by name"
affects: [10-08, 10-10]

tech-stack:
  added: []
  patterns:
    - "A partition stated as Assert<Equal<Whole, PartA | PartB>> so both widening and narrowing stop at tsc — fjs/guest's precedent applied to a 50-member domain"
    - "A refusal table carried as a LIST of `{kind, line, label, remedy}` entries rather than a Record keyed by kind, so the unmodeled-kind union is derived from the data and every list operation stays typed without an Object.keys cast"
    - "A whole-message hand-typed expectation, pinning message format and the information-disclosure disposition in a single assertion"

key-files:
  created:
    - fjs/return/scope/module.f.js
  modified: []

key-decisions:
  - "unmodeledKindRefusals is an entry LIST, not Record<UnmodeledKind, …>: the plan's own typing is circular, and its only non-circular reading makes the tsc assertion a tautology (plan defect 1)"
  - "scopeRefusal returns ScopeError, never ScopeOutcome — Plan 10-08 spreads it into its own error arm and both a cast and a `!` are banned"
  - "scopeRefusal throws a bare value on an empty argument: a refusal that names nothing IS the silent partial return this module exists to prevent"
  - "The message orders kinds by walking the refusal table (1040 form order) rather than sorting the argument, so the lookup is total and needs no narrowing"
  - "qualifiedDividends stays UNMODELED in the phase that ships the QDCGT worksheet: the worksheet's arithmetic is not the same thing as the ability to read the 1099-DIV that feeds line 3a"

patterns-established:
  - "Pattern: a proof loop over the code under test is admissible only when paired with a hand-typed count AND a tsc-level completeness assertion; the loop then contributes reachability, which neither of those can see"
  - "Pattern: a refusal proof asserts the structured field element by element AND the message in three separate includes calls, so a failure names which part went missing"

requirements-completed: [TAX-16]

duration: 35min
completed: 2026-08-06
---

# Phase 10 Plan 07: `classifyScope`, the TAX-16 Scope Guard Summary

**The fifty kinds a taxpayer may declare are partitioned six modeled / forty-four refused, with `tsc` — not review — enforcing that there is no third option, and `classifyScope` refusing the whole return by naming every declared kind the engine does not model, its 1040 line and its remedy.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 of 2
- **Files modified:** 1 (created)
- **Commits:** 2 task commits + this metadata commit

## What Was Built

`fjs/return/scope/module.f.js`, in two commits:

| Commit | Task | What |
|---|---|---|
| `822c730` | 1 | `modeledKinds` (6), `unmodeledKindRefusals` (44), `_EveryKindIsEitherModeledOrRefused`, six partition proofs |
| `eb58f87` | 2 | `ScopeOutcome` / `ScopeError`, `scopeRefusal`, `classifyScope`, twelve scope proofs |

**Leaf count for this module: 0 before → 18 after** (6 partition + 12 scope). The plan's
verification asked for at least 12.

Repo-wide at the end: `npm test` **434 / 434, 0 fail, `tsc` clean**, 432 project-local leaves
(the delta above this plan's own 18 is Plan 10-06's concurrent QDCGT work, committed beside it).

## Why the guard compares declarations and not the store

Restated because it is the reason this module exists in this shape (10-CONTEXT.md Decision 4):
"no 1099-DIV in the store" cannot distinguish *the taxpayer had no dividends* from *the taxpayer
had dividends and this engine cannot read the form*. A store-driven guard refuses only when the
user happened to store an unreadable document, and stays silent in exactly the case TAX-16 exists
for. The converse is carried by the same set: a return declaring only `wages` is IN SCOPE, and its
interest line is a legitimate `0n`, not a refusal (`deliberateOmissionIsNotARefusal`).

## Mutations — every one run, one at a time, reverted, transcripts real

### Task 1

**Mutation 1 — `'qualifiedDividends'` added to `modeledKinds`** (`git diff --numstat`: `1 0`).
`tsc` stayed clean, as the plan predicted. **RED on exactly the two predicted leaves:**

```
✖ import("./fjs/return/scope/module.f.js").proof.partition.modeledKindsIsExactlySix()
✖ import("./fjs/return/scope/module.f.js").proof.partition.partitionCoversTheVocabularyWithNoOverlap()
ℹ tests 417  ℹ pass 415  ℹ fail 2
```

Worth recording *why* `tsc` cannot catch this one, since it is the boundary of what the type-level
assertion buys: `Assert<Equal<Kind, ModeledKind | UnmodeledKind>>` constrains the UNION, and a kind
listed in both halves leaves the union unchanged. The type system owns coverage; only
`partitionCoversTheVocabularyWithNoOverlap` owns disjointness. Both are needed.

**Mutation 2 — a 51st kind added to `kindVocabulary` in `fjs/return/profile/module.f.js`,
classified nowhere** (`numstat`: `1 0`; reverted in the same command block to keep the window
away from the concurrent executor):

```
fjs/return/scope/module.f.js(210,21): error TS2344: Type 'false' does not satisfy the constraint 'true'.
```

Line 210 col 21 is the `Assert<Equal<…>>` inside `_EveryKindIsEitherModeledOrRefused`. The
assertion is load-bearing, not decoration; `npm test` never reaches the tests.

**Mutation 3 — the `form8978` entry deleted from `unmodeledKindRefusals`** (`numstat`: `0 1`):

```
fjs/return/scope/module.f.js(209,21): error TS2344: Type 'false' does not satisfy the constraint 'true'.
```

Same assertion (one line higher, because a line was deleted). So the equality catches narrowing as
well as widening — which is the property an enumeration of forbidden members would have missed.

### Task 2

**Mutation 1 — the comparison inverted**, `!modeledKindNames.includes(kind)` →
`modeledKindNames.includes(kind)` (`numstat`: `1 1`). **RED on 10 leaves — both sides of the gate:**

```
✖ …proof.scope.allSixModeledKindsDeclaredTogetherAreInScope()
✖ …proof.scope.controlTheSameDeclarationWithoutSocialSecurityBenefitsIsInScope()
✖ …proof.scope.controlTheSixtyFivePlusProfileWithoutThoseTwoKindsIsInScope()
✖ …proof.scope.deliberateOmissionIsNotARefusal()
✖ …proof.scope.everyUnmodeledKindRefusesNamingItsOwnLineAndLabel()
✖ …proof.scope.refusalIsABareValueShapeNotAnError()
✖ …proof.scope.socialSecurityBenefitsRefusesNamingItsLineLabelAndRemedy()
✖ …proof.scope.theRefusalMessageIsExactlyTheHandTypedSentence()
✖ …proof.scope.theSixtyFivePlusProfileRefusesNamingBothUnmodeledKinds()
✖ …proof.scope.unmodeledFollowsFormOrderNotDeclarationOrder()
ℹ tests 434  ℹ pass 424  ℹ fail 10
```

**The two scope leaves that stayed GREEN, with the reason each survived** (AGENTS.md: record
these, they are where the code has a property nobody wrote down):

| Green under inversion | Why |
|---|---|
| `emptyDeclarationIsInScope` | `[].filter(p)` is `[]` for every predicate `p`. The empty declaration maps to the empty unmodeled set under both the rule and its inverse, so this leaf cannot distinguish them — and must not be counted as covering the comparison. |
| `refusalNamingNothingIsItselfRefused` | It calls `scopeRefusal` directly and never reaches `classifyScope`'s comparison. |

That both *control* leaves reddened is the point of the mutation: a guard whose inversion breaks
only the refusal side has no control leg at all.

**Mutation 2 — the `remedy` term dropped from the message template** (`numstat`: `1 1`).
**RED on 2 leaves, where the plan predicted 1:**

```
✖ …proof.scope.socialSecurityBenefitsRefusesNamingItsLineLabelAndRemedy()
✖ …proof.scope.theRefusalMessageIsExactlyTheHandTypedSentence()
ℹ tests 434  ℹ pass 432  ℹ fail 2
```

The plan predicted "the `'vnd.fjs.ssa1099'` assertion and nothing else." The second failure is
`theRefusalMessageIsExactlyTheHandTypedSentence`, a leaf this execution added beyond the plan: the
complete refusal sentence, hand-typed character for character, which is simultaneously the
strongest available format pin and the proof of T-10-07-04 (nothing but compiled-in strings can
reach the message a user sees). Its localization cost is one extra red leaf; the diagnostic
property the plan wanted — *which* part of the message went missing — is preserved, because the
65+ leaf deliberately asserts lines and labels only and stayed green.

**Mutation 3 — `unmodeled: entries.map(r => r.kind)` → `unmodeled: []`**, message untouched
(`numstat`: `1 1`). **RED on exactly the 4 leaves that read the structured field:**

```
✖ …proof.scope.everyUnmodeledKindRefusesNamingItsOwnLineAndLabel()
✖ …proof.scope.socialSecurityBenefitsRefusesNamingItsLineLabelAndRemedy()
✖ …proof.scope.theSixtyFivePlusProfileRefusesNamingBothUnmodeledKinds()
✖ …proof.scope.unmodeledFollowsFormOrderNotDeclarationOrder()
ℹ tests 434  ℹ pass 430  ℹ fail 4
```

`theRefusalMessageIsExactlyTheHandTypedSentence` and `refusalIsABareValueShapeNotAnError` stayed
green as they should — the message is unchanged and `[]` is still an array. So `unmodeled` is
genuinely *checked*, not merely carried.

**Mutation 4 — `classifyScope` returns `{ kind: 'ok' }` unconditionally.** The plan's literal form
does not compile, the failure mode AGENTS.md names as the most common:

```
$ perl -0pi -e "s/export const classifyScope = declaredKinds => \{.*?\n\}/…({ kind: 'ok' })/s"
   numstat: 1 11
fjs/return/scope/module.f.js(306,30): error TS6133: 'declaredKinds' is declared but its value is never read.
```

(Only the parameter orphaned; `modeledKindNames` stayed live because a partition proof also uses
it.) Re-run as the semantically identical edit that keeps every binding live —
`declaredAndNotModeled.length === 0` → `>= 0`, i.e. always return `ok` (`numstat`: `1 1`):

```
✖ …proof.scope.everyUnmodeledKindRefusesNamingItsOwnLineAndLabel()
✖ …proof.scope.refusalIsABareValueShapeNotAnError()
✖ …proof.scope.socialSecurityBenefitsRefusesNamingItsLineLabelAndRemedy()
✖ …proof.scope.theRefusalMessageIsExactlyTheHandTypedSentence()
✖ …proof.scope.theSixtyFivePlusProfileRefusesNamingBothUnmodeledKinds()
✖ …proof.scope.unmodeledFollowsFormOrderNotDeclarationOrder()
ℹ tests 434  ℹ pass 428  ℹ fail 6
```

**Six leaves stand between this engine and a silently partial 1040** at this module's boundary
(T-10-07-01). The four control leaves stayed green under this mutation, by construction — which is
exactly why mutation 1, which reddens controls and refusals together, is the one that proves the
gate discriminates.

## Deviations from Plan

### Plan defects found (3)

**1. `unmodeledKindRefusals`' specified typing is circular and cannot be written.**
The action block asks for `Record<UnmodeledKind, {line,label,remedy}>` *and* for
`UnmodeledKind = keyof typeof unmodeledKindRefusals`. Each defines the other. The only
non-circular reading — `Record<Exclude<Kind, ModeledKind>, …>` — makes
`_EveryKindIsEitherModeledOrRefused` a tautology (`Kind = Modeled | Exclude<Kind, Modeled>` holds
for every `Kind`), i.e. precisely the decorative assertion the same plan forbids two paragraphs
later. A Record also cannot yield a typed `readonly UnmodeledKind[]` for `scopeRefusal` without an
`Object.keys(...)` cast, which AGENTS.md bans.

**Resolution:** the table is a LIST of `{ kind, line, label, remedy }` entries. `UnmodeledKind` is
derived from the data (`typeof unmodeledKindRefusals[number]['kind']`), so mutations 2 and 3 both
fail on the named assertion — verified above. The exported name, its contents and every behaviour
the plan specifies are unchanged; only the container differs. Documented at the site.

**2. The plan's "bind the lookup to a local and narrow with `assert`" is unnecessary in the shape
that removes the cast.** `scopeRefusal` orders its output by walking the refusal table and keeping
entries the argument names, so the entry and its `kind` come from the same record: there is no
indexed access to narrow and no unreachable `undefined` branch to write. Same guarantee, one fewer
impossible branch.

**3. Plan 10-08's interface block (line 93) types `scopeRefusal` as returning `ScopeOutcome`.**
This plan (and its orchestration brief) requires `ScopeError`. Not a conflict in practice —
`ScopeError` is a subtype, so 10-08's stated call sites still typecheck — but 10-08's copy of the
interface is stale and its author should read the shipped signature, not that block.

### Auto-fixed / added beyond the plan (Rule 2 — correctness)

- **`scopeRefusal` throws a bare value when given no kinds.** A refusal that names nothing is the
  silent partial return this module exists to prevent, so it is refused rather than produced.
  Proven by `refusalNamingNothingIsItselfRefused`, which asserts WHAT was thrown (the message
  must say `'must name at least one unmodeled kind'`), not merely that something was —
  a bare `throw:` leaf would pass for any failure, including one raised before this code was
  reached.
- **`theRefusalMessageIsExactlyTheHandTypedSentence`**, the whole-message expectation described
  under mutation 2. This is the module's answer to T-10-07-04.
- **`refusalTableFollowsKindVocabularyOrder`.** `scopeRefusal`'s "ordered by `kindVocabulary`
  position" claim is true only while the table is in form order, since it walks the table rather
  than sorting. Positions are read from the vocabulary, not from the table.

## Self-referential-proof exposure, and what stands behind it

The brief flagged this module's partition as carrying the exposure that has now bitten this
project four times. Two proof leaves iterate collections owned by this module
(`everyRefusalNamesALineALabelAndARemedy`, `everyUnmodeledKindRefusesNamingItsOwnLineAndLabel`) and
so could never notice the table shrinking on their own. Three independent things stand behind them:

1. `expectedUnmodeledKindCount = 44` and `expectedModeledKindCount = 6`, hand-typed, deliberately
   not the collections' own `.length` — the `expectedMoneyBoxFieldCount` idiom;
2. `theTwoHandTypedCountsSumToTheWholeVocabulary`, asserting `6 + 44` against
   `kindVocabulary.length`, which `fjs/return/profile` in turn pins against its own hand-typed 50;
3. `_EveryKindIsEitherModeledOrRefused`, which makes a deletion a `tsc` failure — verified by
   mutation 3, which deleted an entry and never reached the test runner.

What the loops add on top is *reachability*, which none of the three can see. The CONTENT of two
entries is pinned by hand-typed leaves rather than by the loops.

## Concurrency notes

Plan 10-06 executed on `fjs/tax/line16/qdcgt` throughout. Only `fjs/return/scope/module.f.js` was
ever staged (by explicit path), and every revert was `git checkout -- fjs/return/scope/module.f.js`
— at one point `git diff --numstat` showed the sibling's 261-line in-flight file alongside mine,
and it was left untouched. No snapshot run was needed: the sibling's file typechecked at every
point I measured, so no red I did not cause was ever observed. The one edit outside my file
(mutation 2, `fjs/return/profile/module.f.js`) was applied, measured and reverted inside a single
command block.

## For the plans that consume this

- **10-08** imports `scopeRefusal` and gets `ScopeError`: `message` and `unmodeled` are reachable
  directly, no cast, no `!`.
- **10-10** calls `classifyScope(profile.declaredKinds)` — note that `ReturnProfile.declaredKinds`
  is `readonly string[]` (rtti `array(string)`), while `classifyScope` takes `readonly Kind[]` as
  both this plan and 10-10's own interface block specify. **10-10 will need a narrowing step**
  (`checkReferences` has already refused every non-vocabulary string by then, so the narrowing is
  sound — but it must be written, and it is not in this module's exports). Widening the parameter
  to `readonly string[]` was rejected: it would let a typo classify as "not unmodeled" and produce
  a degenerate refusal instead of a loud one.

## Self-Check: PASSED

- `fjs/return/scope/module.f.js` — FOUND
- commit `822c730` — FOUND
- commit `eb58f87` — FOUND
- `npm test` — 434 tests, 434 pass, 0 fail, `tsc` clean, working tree clean of this plan's files
