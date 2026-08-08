---
phase: 12-brokerage-documents-and-the-capital-gain-chain
reviewed: 2026-08-07T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - fjs/document/1099div/module.f.js
  - fjs/document/1099b/module.f.js
  - fjs/document/consolidated_provenance/module.f.js
  - fjs/schedule/b/module.f.js
  - fjs/return/profile/module.f.js
  - fjs/server/finance_schema/module.f.js
findings:
  critical: 0
  warning: 1
  info: 0
  total: 1
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-08-07T00:00:00Z
**Depth:** standard (with targeted mutation verification beyond the standard baseline, per AGENTS.md's "a proof is not known to work until you have watched it fail")
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the six files that make up Phase 12: `vnd.fjs.1099div` (DOC-06), `vnd.fjs.1099b`
(DOC-07), the DOC-13 provenance proof, Schedule B (TAX-07), the additive foreign-account fields on
`vnd.fjs.return_profile`, and `finance_schema`'s 7→9 dialect registration.

`npm test` (`tsc && node --test`) passes clean: 2867/2867, and the project-local proof count
(`node --test 2>&1 | grep -c '^✔ import("./fjs/'`) is 629. `git diff --name-only e3f405e..HEAD`
confirms these six files (plus `CHANGELOG.md`) are the complete change set — nothing in
`fjs/return/scope/module.f.js` or `fjs/tax/line16/` was touched, matching the phase boundary and
the one explicitly granted exception (adding the four foreign-account fields to
`return_profile`).

I did not stop at reading the code. Per AGENTS.md's mutation discipline, I ran targeted mutations
against the load-bearing claims this phase's docstrings make, reverting each afterward (verified
clean via `git diff --stat`):

- **Schedule B's `>` threshold operator** (weakened to `>=`) → caught, `interestExactlyAtThresholdDoesNotTrigger` reddened. The two-independent-tests claim (interest vs. dividends, never combined) is real; `combinedButIndividuallyUnderThresholdTriggersNeither` backs it.
- **Schedule B's `partThreeRequired` disjunction** (weakened the last `||` to `&&`) → caught, two leaves reddened.
- **1099-DIV's money-box drift guard** (removed `box7ForeignTaxPaid` from `moneyBoxFields`, count left at 17) → caught by `everyMoneyBoxIsCovered`, exactly as the module's own Mutation Gate M1 claims.
- **DOC-13's subject-key independence** (`formSubject`'s own `formType` proof, `fjs/document/subject/module.f.js:155-156`) confirmed non-vacuous; the DOC-13 proof's `divSubject !== bSubject` assertion rests on real, independently-tested key behavior, not a coincidence.
- **`vnd.fjs.return_profile`'s `requiredToFileFinCen114` field** (widened `option(true)` → `option(boolean)`, which would let a stored `false` slip through as valid — a live DOC-12 violation) → **NOT caught**. `tsc --noEmit` reports zero errors and the full 2867-test suite passes with zero failures. See WR-01.

Everything else checked — the conditional-spread trap (every optional-field spread in these six files uses the guarded `...(x === undefined ? {} : {...})` form), `any`/cast/non-null-assertion absence, the 1099-B box 1e/box 12 independence and negative-magnitude boxes 8-11, box-list fidelity against the fetched IRS sources cited in each docstring, and DOC-11 absence-vs-zero handling in Schedule B's `sumBoxOverDocuments`/`documentLine` — held up under inspection and, where a mutation was practical, under mutation.

## Warnings

### WR-01: `requiredToFileFinCen114`'s DOC-12 discipline is asserted for only 2 of the 4 new checkbox-shaped fields

**File:** `fjs/return/profile/module.f.js:684-691` (`foreignAccountFields.eachCheckboxRejectsFalse`)

**Issue:** This phase adds four fields to `vnd.fjs.return_profile` for Schedule B Part III.
`hadForeignFinancialAccount`, `requiredToFileFinCen114`, and
`receivedForeignTrustDistributionOrWasGrantorOrTransferor` are all typed `option(true)` per DOC-12
— a stored `false` must be structurally rejected, never accepted as "not checked." The proof
`eachCheckboxRejectsFalse` exercises this for `hadForeignFinancialAccount` and
`receivedForeignTrustDistributionOrWasGrantorOrTransferor` only; `requiredToFileFinCen114` is
never asserted to reject `false`.

Today's shipped code is correct — I confirmed live that `validate({ ...minimal,
requiredToFileFinCen114: false })` returns `['error', { path: ['requiredToFileFinCen114'], message:
'no match' }]`. But the proof suite cannot currently detect a regression on this one field. I
verified this is a real, not theoretical, gap: widening the schema line

```js
requiredToFileFinCen114: option(true),
```

to

```js
requiredToFileFinCen114: option(boolean),
```

(a one-line, easy-to-make mistake — e.g. during a future refactor that "generalizes" the four
foreign-account fields) passes `tsc --noEmit` with zero errors and the entire 2867-leaf suite with
zero failures. That is exactly the shape of gap AGENTS.md's mutation-testing section warns about:
a silently-shrunk guarantee that a green suite cannot see.

This mirrors the box-count-drift class of defect this same phase's `moneyBoxFields`/
`expectedMoneyBoxFieldCount` pairing exists to prevent — except here there is no generated,
per-field loop at all for the checkbox fields, so nothing catches a single field's `option(true)`
silently becoming `option(boolean)`.

**Fix:** Add the missing assertion to `eachCheckboxRejectsFalse` (or split it into a fourth,
independent leaf for symmetry with the other three):

```js
eachCheckboxRejectsFalse: () => {
    const [t1] = validate({ ...minimal, hadForeignFinancialAccount: false })
    assertEq(t1, 'error')
    const [t2] = validate({ ...minimal, requiredToFileFinCen114: false })
    assertEq(t2, 'error')
    const [t3] = validate({
        ...minimal,
        receivedForeignTrustDistributionOrWasGrantorOrTransferor: false,
    })
    assertEq(t3, 'error')
},
```

For comparison, `fjs/document/1099b/module.f.js`'s `falseFlagsRejected` (lines 450-463) already
gets this right: it asserts `false`-rejection for every one of that dialect's twelve checkbox
fields, one assertion per field, so a regression on any single one would be caught. This file's
own analogous leaf for the two pre-existing checkboxes (`claimedAsDependent`, etc.) and the four
existing money boxes both follow the "one leaf/assertion per field, no field left out" discipline
this new leaf should match.

---

_Reviewed: 2026-08-07T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
