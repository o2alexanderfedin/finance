---
phase: 09-traceable-report-lines-and-the-anti-hardcoding-gate
plan: 02
subsystem: report
tags: [numeric-literal-audit, anti-hardcoding, regex, phase-9, prov-07]

requires:
  - phase: 07
    provides: "fjs/guest/materialize/module.f.js's checkSpecifiers/specifierPattern — the negated-character-class-plus-escaped-any regex idiom this module's string-stripping regexes copy for linear-time safety"
provides:
  - "fjs/report/audit/module.f.js — countNumericLiterals, a pure text-only count of numeric-literal tokens in a stored report program's source"
  - "Nine proof leaves proving the audit is not fooled by a digit inside an identifier, a single/double-quoted string, a template literal, a line comment, or a block comment, and that it counts the exact verbatim adversary fixture correctly"
affects: [09-04]

tech-stack:
  added: []
  patterns:
    - "Strip strings/templates/comments TEXTUALLY first (in that order — strings before comments, so a string containing '//' is never misread as starting a comment), then count every remaining token with a single regex — never a real parser."
    - "\\b alone excludes a digit embedded in an identifier: a digit immediately preceded by a letter or digit is not a word-boundary position, so the counting regex never even attempts to start a match there."

key-files:
  created: [fjs/report/audit/module.f.js]
  modified: []

key-decisions:
  - "countNumericLiterals is REPORTED, never refused (09-CONTEXT.md) — it always returns a plain number, never a Result, and never throws on a program's own account."
  - "A numeric literal legitimately inside a template literal's ${...} expression is undercounted (the whole template span is stripped). Documented as an accepted risk in the module: harmless because this audit is reported-only, not the actual kill condition (that is Plan 09-03's zero-observed-CAS-reads check)."
  - "Each honesty case (identifier / single-quoted string / template literal / line comment / block comment / verbatim adversary) is its own proof leaf, not one aggregate assertion — an aggregate that totals correctly could hide two canceling errors."
  - "The adversary fixture string is written byte-for-byte identical to 09-CONTEXT.md's own quoted phrase (adapted to this project's ctx-based entry point), because Plan 09-04 later stores and runs this exact string for real."

patterns-established:
  - "String/template/comment stripping mirrors fjs/guest/materialize/module.f.js's specifierPattern idiom: a negated character class plus an escaped-any alternative ((?:[^'\\\\]|\\\\.)*), never a lazy wildcard, for linear-time safety with no catastrophic-backtracking shape."

requirements-completed: [PROV-07]

duration: ~15min
completed: 2026-08-05
---

# Phase 09 Plan 02: Numeric-Literal Audit Summary

**`countNumericLiterals` strips strings/templates/comments textually (copying SEC-02's linear-time regex idiom) then counts remaining numeric tokens with `\b\d+(?:\.\d+)?n?\b`, proven immune to a digit inside an identifier, string, template, or comment — including the exact verbatim adversary fixture, which counts its one real literal (`9137`) and never the `16` inside `line16`.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-08-05
- **Tasks:** 2 completed
- **Files modified:** 1 created (`fjs/report/audit/module.f.js`)

## Accomplishments

- `countNumericLiterals: (source: string) => number` — a pure, never-throwing count of numeric-literal tokens (integer, decimal, and bigint-suffixed) in a stored report program's source text.
- Private `stripStringsAndComments`, sequentially stripping single-quoted strings, double-quoted strings, template literals, `//` line comments, and `/* */` block comments — strings/templates stripped BEFORE comments, deliberately, so a string containing `//` is never misread as starting a comment mid-string.
- All three string/comment-stripping regexes copy `fjs/guest/materialize/module.f.js`'s `specifierPattern` negated-character-class-plus-escaped-any idiom (`(?:[^'\\]|\\.)*`), the same shape already established in this repo as free of catastrophic backtracking.
- Nine `proof` leaves, each a single, independently-testable assertion rather than one aggregate check: empty source, a plain literal, three distinct literals, a digit inside an identifier, a digit inside a single-quoted string, a digit inside a template literal, a digit inside a line comment (alongside a real literal), a digit inside a block comment (alongside a real literal), and the exact verbatim adversary fixture.
- The adversary fixture `export const report = ctx => () => ctx.pure({ line16: 9137 })` is written byte-for-byte identical to 09-CONTEXT.md's own quoted phrase (adapted to this project's `ctx`-based entry point) and proven to count exactly 1 — the `16` inside `line16` is never counted because no word boundary exists between a letter and an immediately following digit.

## Task Commits

Each task was committed atomically:

1. **Task 1: countNumericLiterals — strip strings/comments, then count** - `dc41d76` (feat)
2. **Task 2: Prove the tokenizer is honest, including the exact verbatim adversary fixture** - `09b82e4` (test)

**Plan metadata:** (this commit, once made) `docs(09-02): complete Numeric-Literal Audit plan`

## Files Created/Modified

- `fjs/report/audit/module.f.js` - `countNumericLiterals`, the private `stripStringsAndComments` helper and its five component regexes, and nine `proof` leaves.

## Decisions Made

- `countNumericLiterals` never returns a `Result` and never throws on a program's own account — it is a pure count, matching 09-CONTEXT.md's "REPORTED, never refused" decision for this audit exactly. Plan 09-03's separate zero-observed-CAS-reads check is the actual anti-hardcoding kill condition; this module has no refusal path to conflate with it.
- Strings/templates are stripped before comments (not the reverse, and not simultaneously) because a string like `'http://example.com'` would otherwise have its `//` misread as the start of a line comment, corrupting everything after it on that line. Verified by the `digitInsideSingleQuotedStringNotCounted` / template / comment leaves passing independently, not just in combination.
- A numeric literal legitimately embedded inside a template literal's `${...}` expression (e.g. `` `total: ${1 + 2}` ``) is undercounted, because the whole backtick span is stripped as one unit. Documented inline as an accepted risk in `templateLiteralPattern`'s own JSDoc: harmless per 09-CONTEXT.md because this audit is reported-only and carries no security consequence on its own.
- Each honesty case is its own proof leaf (nine total), never one aggregate assertion — per the plan's explicit instruction, an aggregate that happens to total correctly could hide two canceling errors (e.g. an off-by-one undercount in one place masked by an off-by-one overcount in another).
- The adversary fixture string is kept byte-for-byte identical to 09-CONTEXT.md's own quoted phrase because Plan 09-04 later stores and runs this exact string for real; a source comment notes the cross-plan reuse.
- Split into two atomic commits (Task 1: the count + its three `<behavior>` leaves; Task 2: the six honesty leaves added to the same file's `proof` export), each independently verified with `npm test` and the honest `node --test` metric before committing, rather than one combined commit — matching the plan's per-task commit structure even though both tasks touch the same file.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria were met without any auto-fix, blocking issue, or architectural question.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification Output

**1. `npm test` (final, after both tasks):**
```
ℹ tests 254
ℹ suites 0
ℹ pass 254
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2508.105458
```
Exit 0, `tsc` clean, `fail 0`.

**2. `node --test 2>&1 | grep -c '^✔ import("./fjs/'` (final):**
```
252
```
Strictly greater than the Phase 9 baseline of 243 measured before this plan (nine new `proof` leaves in `fjs/report/audit/module.f.js`; the discrepancy between "9 leaves added" and "252 - 243 = 9" confirms exactly).

Intermediate checkpoints recorded during execution:
- After Task 1 alone: `246` (three leaves: `zeroOnEmptySource`, `countsAPlainLiteral`, `countsMultipleDistinctLiterals`) — strictly greater than the plan's required `240`.
- After Task 2: `252` (six more leaves) — strictly greater than Task 1's `246`.

**3. Acceptance-criteria greps:**
```
$ grep -n "export const countNumericLiterals" fjs/report/audit/module.f.js
113:export const countNumericLiterals = source => {

$ grep -c "Math.round\|toFixed\|parseFloat" fjs/report/audit/module.f.js
0

$ grep -n "countsTheVerbatimAdversaryFixtureLiteralExactlyOnce" fjs/report/audit/module.f.js
166:    countsTheVerbatimAdversaryFixtureLiteralExactlyOnce: () => {

$ grep -c "ctx.pure({ line16: 9137 })" fjs/report/audit/module.f.js
1
```

**4. `git status --porcelain`:** empty.

**5. `git log --oneline -3`:**
```
09b82e4 test(09-02): prove the tokenizer honest, including the verbatim adversary
dc41d76 feat(09-02): countNumericLiterals — strip strings/comments, then count
f1867b2 docs: refresh STATE.md's stale test metrics
```

## Next Phase Readiness

- `countNumericLiterals` exists, is pure and never-refusing, and is proven immune to digits inside identifiers, strings, templates, and comments — including the exact verbatim adversary fixture Plan 09-04 later stores and runs for real.
- Plan 09-04 (the perturbation gate, which reuses this exact adversary fixture string) can build on this without redefining it.
- Plan 09-03 (the zero-observed-CAS-reads kill condition, and wiring both counts into `fjs_run`'s response envelope) is independent of this plan and can proceed without any change here.
- No blockers.

---
*Phase: 09-traceable-report-lines-and-the-anti-hardcoding-gate*
*Completed: 2026-08-05*

## Self-Check: PASSED

- FOUND: `fjs/report/audit/module.f.js`
- FOUND: commit `dc41d76`
- FOUND: commit `09b82e4`
