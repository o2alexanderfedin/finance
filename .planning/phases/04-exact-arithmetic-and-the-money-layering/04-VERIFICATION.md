---
phase: 04-exact-arithmetic-and-the-money-layering
verified: 2026-08-04T07:35:17Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
---

# Phase 4: Exact Arithmetic and the Money Layering Verification Report

**Phase Goal:** Tax math is exact by construction, and rounding is a property of a 1040 line rather
than of a value.
**Verified:** 2026-08-04T07:35:17Z
**Status:** passed
**Re-verification:** No — initial verification

All command output below was captured live against this worktree
(`/Volumes/ProjectsSSD/Projects/jobs4alex/sergey-shandar/finance/.claude/worktrees/finance-phases`),
not copied from SUMMARY.md.

## Goal Achievement

### Observable Truths (must-haves, numbered per verification brief)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `fjs/types/rational` and `fjs/types/decimal` are generic/liftable; `fjs/exact` hosts the money-specific composition; import graph respects the split | ✓ VERIFIED | `grep -n "^import\|from '" fjs/types/rational/module.f.js` → only `functionalscript/fjs/common/monoid`, `functionalscript/fjs/asserts`, `functionalscript/fjs/types/list` (type-only). `fjs/types/decimal/module.f.js` imports only `functionalscript/fjs/asserts`. Neither imports anything under `fjs/exact` or anything finance-specific. `fjs/exact/module.f.js` is the only file importing both (`from '../types/decimal/module.f.js'`, `from '../types/rational/module.f.js'`). `grep -rn "types/rational\|types/decimal" fjs/` shows the only importer outside the two generic modules is `fjs/exact/module.f.js`. |
| 2 | `grep -rn "toFixed\|parseFloat\|Math\.round" fjs/` returns exactly one line | ✓ VERIFIED | Ran live: `grep -rn "toFixed\|parseFloat\|Math\.round" fjs/` → `fjs/types/rational/module.f.js:168:            const builtIn = BigInt(Math.round(-2.5))`. `wc -l` on the same grep = `1`. Exactly the documented divergence-proof line; no second match anywhere in `fjs/`. |
| 3 | Rounding proof asserts the chosen rule differs from the built-in at `-2.5`, both values and the inequality, at both signs | ✓ VERIFIED | `fjs/types/rational/module.f.js:165-171`: `rounding.tieAwayFromZeroNegativeDiffersFromMathRound` asserts `ours = halfUp(of(-5n)(2n)) === -3n`, `builtIn = BigInt(Math.round(-2.5)) === -2n`, then `assert(ours !== builtIn, ...)` — both values and the inequality, not an implication. Both-signs tie coverage: `tieAwayFromZeroPositive` (`halfUp(of(5n)(2n)) === 3n`) and the negative case above. `npm test` shows both leaves passing live. |
| 4 | A proof exhibits the counterexample with concrete values `2n` and `3n`, not merely that they differ | ✓ VERIFIED | `fjs/types/rational/module.f.js:186-193` `lineRoundingVsPerItemRounding`: `assertEq(roundOfSum, 2n)`, `assertEq(sumOfRounds, 3n)`, then `assert(roundOfSum !== sumOfRounds, ...)`. Concrete values asserted individually before the inequality check. Live test run: leaf passes. |
| 5 | No money type rounds on construction; `of(7n)(3n)` stays `[7n,3n]` | ✓ VERIFIED | Live execution: `node -e "import('./fjs/types/rational/module.f.js').then(m => console.log(JSON.stringify(m.of(7n)(3n), (k,v)=>typeof v==='bigint'?v.toString():v)))"` → `["7","3"]`. `of`'s source (line 57-60) does only sign normalization on the denominator, never division/gcd. `fjs/exact/module.f.js`'s `centsFromString`/`centsToString` are direct partial applications of `parse`/`format`, with no wrapper `Money`/`Cents` class anywhere. |
| 6 | One proof walks `"1234.56"` → `123456n` → `[123456n,7n]` → `17637n` → `"176.37"`, asserting each stage | ✓ VERIFIED | `fjs/exact/module.f.js:65-92` `threeLayersOnOneValue`: `stored='1234.56'` → `cents=centsFromString(stored)`, `assertEq(cents,123456n)` → `share=multiply(ofInt(cents))(of(1n)(7n))`, `assertEq(show(share), show([123456n,7n]))` → `lineCents=halfUp(share)`, `assertEq(lineCents,17637n)` → `wire=centsToString(lineCents)`, `assertEq(wire,'176.37')`. Live `npm test` shows `threeLayersOnOneValue` passing. |
| 7 | AGENTS.md compliance: `.f.js` under `fjs/`, pure, ESM; no new dependency; no `l` identifier; `@import` JSDoc form | ✓ VERIFIED | All three files are `fjs/types/rational/module.f.js`, `fjs/types/decimal/module.f.js`, `fjs/exact/module.f.js` — under `fjs/`, `.f.js`. `git diff HEAD -- package.json` → empty (no new dependency; `git log -1 package.json` shows the last change was the pre-phase `functionalscript` 0.41.0 bump, unrelated to this phase). `grep -nE '\b(const\|let)\s+l\b\|...` across all three files → no matches. `@import { List } from '...'` present in rational module (type-only JSDoc form); no inline `@type {import(...)}` in any of the three files. |
| 8 | Nothing broke: `tsc --noEmit` exit 0; `npm test` real counts; Phases 2/3 proofs still pass | ✓ VERIFIED | `npx tsc --noEmit` → exit 0. `npm test` (live, via `tsc && node --test`) → `tests 40, pass 40, fail 0`, including `fjs/exec/module.f.js` (Phase 3, 9 leaves) and `fjs/server/module.f.js` (Phase 2, 6 leaves) all passing alongside the 21 new Phase 4 leaves (12 rational + 9 decimal) and the 1 `fjs/exact` leaf. |
| 9 | Testing-method integrity: only `npm test` used as evidence | ✓ VERIFIED | Every test-count claim in this report came from `npm test` (`tsc && node --test` via root `all.test.js` discovery). No `node --test <source-file>` was run at any point during this verification. |
| 10 | Mutation resistance: truncation, half-even, and scale-break mutations each caught by `npm test`, then reverted to green | ✓ VERIFIED | See Mutation Testing section below — three independent mutations applied to the implementation only, each run through `npm test`, each reverted, tree confirmed clean (`git status --short` empty) and green (`40 pass / 0 fail`) after each revert. |

**Score:** 10/10 truths verified

### ROADMAP.md Phase 4 Success Criteria (contract, cross-checked)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Integer cents, exact rationals, IRS half-up including negatives; asserts divergence from `Math.round` | ✓ VERIFIED | See truth #3, #5 above. |
| 2 | `grep -rn "toFixed\|parseFloat\|Math.round" fjs/` returns nothing inside arithmetic or tax code | ✓ VERIFIED (with documented, locked deviation) | Live grep returns exactly **one** match, inside `fjs/types/rational/module.f.js` (arithmetic code) — not zero. This is a deliberate, pre-approved resolution documented in `04-CONTEXT.md` and both plans' "Grep gate hygiene" notes: criterion 1 *requires* the divergence proof to compare against `Math.round`, and criterion 2's literal zero-match reading would make criterion 1 unsatisfiable. The locked resolution (04-CONTEXT.md, both PLAN.md "Grep gate hygiene" sections) is: exactly one match, pinned to this one line, is the correct verification target. Confirmed exactly one match, at the documented line. |
| 3 | A proof exhibits `round(sum(x)) ≠ sum(round(x))`; only `round(sum(x))` is exposed as the line-level op | ✓ VERIFIED | See truth #4. `fjs/types/rational/module.f.js` exports no per-item-rounding convenience (`roundEach`/`mapRound` do not exist) — confirmed by reading the full export list: `of`, `ofInt`, `negate`, `add`, `multiply`, `sum`, `halfUp`. |
| 4 | A proof demonstrates all three layers (storage-boundary string, exact rational computation, wire-boundary string) on one value | ✓ VERIFIED | See truth #6. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `fjs/types/rational/module.f.js` | Exact `Rational` type, arithmetic, `halfUp` | ✓ VERIFIED | Exists, 197 lines, exports `of, ofInt, negate, add, multiply, sum, halfUp, proof`; wired (imported by `fjs/exact/module.f.js`); data-flow real (live `node -e` execution above). |
| `fjs/types/decimal/module.f.js` | Fixed-scale decimal string ↔ bigint | ✓ VERIFIED | Exists, 116 lines, exports `parse, format, proof`; wired (imported by `fjs/exact/module.f.js`); no `Number()`/`parseFloat` calls in code (only mentioned in a doc comment explaining their absence). |
| `fjs/exact/module.f.js` | Composed cents module + 3-layer proof | ✓ VERIFIED | Exists, 94 lines, exports `centsScale, centsFromString, centsToString, proof`; imports both generic modules via relative paths (`../types/decimal/module.f.js`, `../types/rational/module.f.js`); `threeLayersOnOneValue` proof passes live. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `fjs/types/rational` `sum` | `functionalscript/fjs/common/monoid` `fold` | `sum = fold({ identity: ofInt(0n), operation: add })` | ✓ WIRED | Line 91 of rational module, confirmed by source read and passing `arithmetic.sum` proof (`[12n,8n]`). |
| `fjs/exact/module.f.js` | `fjs/types/decimal`, `fjs/types/rational` | relative imports | ✓ WIRED | Lines 16-17: `import { parse, format } from '../types/decimal/module.f.js'`; `import { ofInt, multiply, of, halfUp } from '../types/rational/module.f.js'`. |
| `fjs/types/decimal` `parse` | over-precision refusal | `assert(frac.length <= scale, ...)` | ✓ WIRED | Line 57, confirmed by live-passing `throw.overPrecision` proof (`parse(2)('1234.567')` throws). |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| EXACT-01 | 04-01, 04-02 | Upstreamable exact-arithmetic module (integer cents, exact rationals, named rounding modes) | ✓ SATISFIED | `fjs/types/rational`, `fjs/types/decimal` generic and liftable; `fjs/exact` composes cents. |
| EXACT-02 | 04-01, 04-02 | Floating point never touches tax math | ✓ SATISFIED | Grep gate (exactly 1, documented exception); no `Number()`/`toFixed`/`parseFloat` in any of the three files. |
| EXACT-03 | 04-01 | IRS half-up rounding, explicitly not `Math.round`, including negatives | ✓ SATISFIED | Truth #3 above. |
| EXACT-04 | 04-01 | Rounding is a property of a 1040 line, not a value; no money type rounds on construction | ✓ SATISFIED | Truth #4, #5 above. |
| EXACT-05 | 04-02 | Three-layer money representation demonstrated on one value | ✓ SATISFIED | Truth #6 above. |

No orphaned requirements — all five EXACT-* IDs mapped to Phase 4 in REQUIREMENTS.md appear in one of the two plans' `requirements` frontmatter.

**Bookkeeping note (not a code gap):** `.planning/REQUIREMENTS.md`'s checkboxes (`- [ ] EXACT-03`, `- [ ] EXACT-04`) and its tracking table (all five EXACT-* rows marked `Pending`) are stale relative to the verified implementation — this is a documentation-sync item for the orchestrator to update post-verification, not evidence of missing code. Likewise `ROADMAP.md` still shows `- [ ] 04-01-PLAN.md` unchecked while `04-02-PLAN.md` is checked; `04-01-SUMMARY.md` did not exist prior to this verification (see Part 2 below), which is why the checkbox and `gsd-sdk query roadmap.analyze`'s `disk_status` were out of sync before this run.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `fjs/types/rational/module.f.js` | header docstring, `halfUp` doc comment | Tax-domain vocabulary ("IRS half-up", "1040 line", "taxpayer's favor") appears in doc comments/rationale, despite the plan's own action text instructing "no tax terms anywhere in this file" | ℹ️ Info | Import graph and exported API are fully generic (no `Money`/`Cents` type, no finance-specific logic) — the must-have's literal requirement ("no dependency on anything finance-specific," "verify the import graph") is satisfied. This is a documentation-purity deviation from the plan's own stricter, self-imposed wording, not a functional coupling; a future upstream lift would need doc edits, not code changes. Not a blocker. |
| `fjs/types/decimal/module.f.js` | header docstring | Same pattern ("money," "taxpayer's disfavour," "cents" mentioned as motivating context) | ℹ️ Info | Same disposition as above. |

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers, no empty implementations, no hardcoded-empty stubs found in any of the three phase files (`grep` runs returned no matches).

### Mutation Testing (must-have #10)

All three mutations were applied to `fjs/types/rational/module.f.js` or `fjs/exact/module.f.js` only (implementation, never the proof), run through `npm test`, then reverted via `cp` from a pre-mutation backup and re-confirmed green.

| Mutation | Applied to | `npm test` result | Caught? | Reverted & re-verified green? |
|----------|-----------|--------------------|---------|-------------------------------|
| Replace `halfUp`'s tie handling with truncation toward zero (`return q` unconditionally) | `halfUp`, rational module | `tests 40, pass 35, fail 5` — failed leaves: `threeLayersOnOneValue`, `tieAwayFromZeroPositive`, `tieAwayFromZeroNegativeDiffersFromMathRound`, `awayFromZeroAboveHalf`, `lineRoundingVsPerItemRounding` | ✓ Yes | ✓ Yes — `git status --short` empty, `npm test` → `40 pass / 0 fail` |
| Replace `halfUp` with half-even (banker's rounding) at exact ties only | `halfUp`, rational module | `tests 40, pass 37, fail 3` — failed leaves: `tieAwayFromZeroPositive` (`2.5→3` under half-up vs `2` under half-even), `tieAwayFromZeroNegativeDiffersFromMathRound`, `lineRoundingVsPerItemRounding` | ✓ Yes | ✓ Yes — same revert-and-confirm as above |
| Break `centsFromString`'s scale by one decimal place (`centsScale = 2` → `3`) | `centsScale`, exact module | `tests 40, pass 39, fail 1` — failed leaf: `threeLayersOnOneValue` (`123456n` → wrongly computed as `1234560n`) | ✓ Yes | ✓ Yes — same revert-and-confirm as above |

Every mutation produced failures; none passed silently. This confirms the rounding and scale guarantees are genuinely tested, not merely asserted-but-untestable — the specific risk the verification brief called out (half-up and half-even agree on every input except ties) was directly exercised and caught.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `of` does not reduce/round on construction | `node -e "import('./fjs/types/rational/module.f.js').then(m=>console.log(...))"` on `of(7n)(3n)` | `["7","3"]` | ✓ PASS |
| Grep gate exact count | `grep -rn "toFixed\|parseFloat\|Math\.round" fjs/ \| wc -l` | `1` | ✓ PASS |
| Full suite green | `npm test` | `tests 40, pass 40, fail 0` | ✓ PASS |
| Typecheck clean | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| No new dependency | `git diff HEAD -- package.json` | empty | ✓ PASS |

### Probe Execution

N/A — no `scripts/*/tests/probe-*.sh` files exist in this repo and neither plan nor SUMMARY references probe-based verification. Skipped: this phase's verification method is the proof suite (`npm test`) plus direct grep/execution checks, all performed above.

### Human Verification Required

None. Every must-have in this phase is mechanically verifiable (exact arithmetic, grep gates, typecheck, test suite, live bigint execution) — no UI, real-time behavior, or external-service integration exists in this phase's scope.

### Gaps Summary

No gaps. All 10 must-haves verified with live command output; all four ROADMAP.md success criteria verified (criterion 2's "one match, not zero" reading is a pre-existing, documented, locked resolution from `04-CONTEXT.md`, not a deviation introduced here). Two informational (non-blocking) findings noted: (1) doc-comment tax vocabulary in the two generic modules, contradicting the plan's own stricter wording without creating functional coupling; (2) stale bookkeeping checkboxes/status rows in `REQUIREMENTS.md` and `ROADMAP.md` that a follow-up documentation pass should sync now that `04-01-SUMMARY.md` exists.

---

_Verified: 2026-08-04T07:35:17Z_
_Verifier: Claude (gsd-verifier)_
