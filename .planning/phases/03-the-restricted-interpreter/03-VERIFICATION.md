---
phase: 03-the-restricted-interpreter
verified: 2026-08-03T21:00:00Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
---

# Phase 3: The Restricted Interpreter Verification Report

**Phase Goal:** A guest program can reach exactly the operations it is permitted, is refused
actionably when it reaches further, cannot run forever, and cannot misreport what it read.
**Verified:** 2026-08-03T21:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `interpret(map)(effect)` exists, dispatches permitted operations, imports only `fjs/effects`, `fjs/types/result`, `fjs/asserts` | ✓ VERIFIED | `fjs/exec/module.f.js` exports `interpret`; `grep -n "^import" fjs/exec/module.f.js \| grep -Ev "functionalscript/fjs/(effects\|types/result\|asserts)/module\.f\.js'$" \| wc -l` → `0`. Only 3 import lines total, all from the permitted set. |
| 2 | All six of `constructor`, `toString`, `valueOf`, `hasOwnProperty`, `__defineGetter__`, `fetch` yield the exact text `operation not permitted: <name>; permitted: casRead, evoList, evoHead, evoRevision` | ✓ VERIFIED | 6 dedicated `proof.refusals.*` leaves, each `assertEq`'d against a hardcoded literal (not derived from the implementation's own `refusalMessage` helper — non-tautological). `npm test`: all 6 pass. Mutation-confirmed: altering `refusalMessage`'s text produces 8 failures (see Mutation Resistance below). |
| 3 | The catch reads the caught value directly — no `.message`, no `instanceof Error` branch | ✓ VERIFIED | Code: `assert(typeof thrown === 'string'); return error(refusalMessage(thrown, map))` — no `.message`, no `instanceof`. Confirmed against `node_modules/functionalscript` 0.41.0's `assert = (v, msg = 'assertion failed') => { if (!v) throw msg }` — the throw is genuinely the bare command string. Mutation-confirmed: rewriting the catch to read `thrown.message` produces 8 failures, each reporting `operation not permitted: undefined; ...` — proving `.message` is genuinely `undefined` and that a "the obvious way" implementation would pass every refusal proof vacuously. This is the highest-risk line in the phase and it holds. |
| 4 | EXEC-04: two-step `__defineGetter__` escalation is chased to code execution, not a single hop | ✓ VERIFIED | `twoStepDefineGetterEscalation`: install refused with the `__defineGetter__` message; `assert(!Object.hasOwn(map, 'fetch'))`; a following `fetch` dispatch on the same `map` is still refused with the `fetch` message. All three assertions present and passing. |
| 5 | EXEC-06: `stepBudget` is an exported constant = 10,000; a non-terminating chain returns bounded, not hangs; the budget is genuinely exhausted (10,000 real dispatches), not short-circuited | ✓ VERIFIED | `export const stepBudget = 10_000`. `stepBudgetBoundsNonTerminatingChain` interprets a genuinely self-referential `forever` chain and returns `['error', 'step budget exceeded: 10000']`, completing in ~70-280ms across runs (no hang, no kill). Mutation-confirmed: raising `stepBudget` to `20_000` roughly doubles this leaf's measured duration (~281ms → ~562ms) before failing on the now-mismatched message text — durations scale with the budget, confirming real dispatches occur rather than a short-circuited check. |
| 6 | EXEC-05: `interpret` returns the accumulated read set alongside the result; a proof asserts the observed set equals what was actually dispatched | ✓ VERIFIED | `readSetReflectsActualDispatch`: a two-command chain returns `reads` exactly `[['casRead',['doc-a']],['evoHead',['subject-b']]]`, in dispatch order. `refusalPartwayThroughAChainReportsTheRefusedCommand` covers a denial reached after one real dispatch (every other refusal leaf denies on the first command). The code comment claiming the read-append-ordering (before vs. after dispatch) is unobservable was independently re-verified: moving the append before the `match` call and re-running the full suite still passes 18/18 — the comment does not overstate what is guaranteed. |
| 7 | EXEC-02 not rebuilt locally — `match`'s own-property lookup is the real guard, verified against the installed package, not assumed | ✓ VERIFIED | `node_modules/functionalscript/fjs/effects/module.f.js`: `at(command)(map)` → `getOwnPropertyDescriptor`-based (`node_modules/functionalscript/fjs/types/object/module.f.js`), never consults the prototype chain. `interpret` contains no local `Object.hasOwn`-based dispatch guard; the one `Object.hasOwn(map, 'fetch')` call in the file is a test-time assertion (checking the map stayed clean), not a guard in `interpret`'s dispatch path. `Object.setPrototypeOf(map, null)` is documented as non-load-bearing defence in depth, matching 03-CONTEXT.md. |
| 8 | AGENTS.md compliance: `.f.js` under `fjs/`, pure ESM, no new dependency, no `l` identifier, `@import` JSDoc form, steps never nested | ✓ VERIFIED | File is `fjs/exec/module.f.js`. `git show 4e3d51a --stat -- package.json package-lock.json` and `git show 2754ef0 --stat -- package.json package-lock.json` both empty — no dependency added. `grep -n -E "\bl\b" fjs/exec/module.f.js` — no matches. Two top-level `@import {...} from '...'` comments, matching AGENTS.md's required form. All 3 uses of `step(...)` in the proof tree are single, unnested calls. |
| 9 | Nothing broke: `npx tsc --noEmit` clean, `npm test` all green, Phase 2's proofs still pass | ✓ VERIFIED | `npx tsc --noEmit` exit 0. `npm test`: `tests 18, pass 18, fail 0` — 11 leaves in `fjs/exec/module.f.js` (this phase) + 7 pre-existing (`fjs/proof.f.js`:1, `fjs/server/module.f.js`:6, all from Phase 2) all passing, no regression. |
| 10 | Testing-method integrity: only `npm test` / `node --test all.test.js` used as evidence; no `<verify>` block uses `node --test <file>` | ✓ VERIFIED | `grep -n "<automated>" 03-01-PLAN.md 03-02-PLAN.md` — all 4 `<verify>` blocks use `npm test` (which runs `tsc && node --test`, discovering via root `all.test.js`) plus `npx tsc --noEmit` and, in Plan 02 Task 2, the import-boundary grep. No `<verify>` block targets `fjs/exec/module.f.js` or any source file by explicit path with `node --test`. |
| 11 | Mutation resistance: the three named guarantees are genuinely tested, not vacuously passing | ✓ VERIFIED | All three independently applied mutations produced real failures (see Mutation Resistance section below), then all were reverted and the tree confirmed clean (`git status --short` empty on `fjs/exec/module.f.js`, `git diff --stat` empty). |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `fjs/exec/module.f.js` | `interpret(map)(effect)`, `stepBudget`, full proof tree | ✓ VERIFIED | 277 lines. Exports `interpret`, `stepBudget`, `proof`. No stub/placeholder markers. Imports exactly the 3 permitted modules. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `interpret` | `functionalscript/fjs/effects/module.f.js match` | `match(map)(effect)` inside try/catch, reading the caught value directly | ✓ WIRED | Confirmed at code line ~148; catch reads `thrown` directly, asserts `typeof thrown === 'string'`, never `.message`. |
| `interpret` | the reads accumulator | `reads = [...reads, [command, payload]]`, appended only after successful dispatch | ✓ WIRED | Confirmed at code line ~150, positioned after `assert(result[0] === 'cont')` and before `e = result[2](result[1])` — strictly inside the success path, never in the catch branch. |
| `interpret` | `stepBudget` | `for (let count = 0; count < stepBudget; count++)` | ✓ WIRED | Confirmed at code line ~142. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Import boundary holds | `grep -n "^import" fjs/exec/module.f.js \| grep -Ev "...permitted.../module\.f\.js'$" \| wc -l` | `0` | ✓ PASS |
| No local hasOwn dispatch guard | `grep -n "hasOwn" fjs/exec/module.f.js` | Only line 269 (`assert(!Object.hasOwn(map,'fetch'))`, a test assertion, not a dispatch guard) | ✓ PASS |
| `tsc` clean | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Full suite green | `npm test` | `tests 18, pass 18, fail 0` | ✓ PASS |
| `at`'s own-property lookup verified against installed package | `sed -n` on `node_modules/functionalscript/fjs/types/object/module.f.js` | `getOwnPropertyDescriptor`-based, no prototype chain access | ✓ PASS |

### Mutation Resistance

Applied to a copy of `fjs/exec/module.f.js`'s implementation only (never the test oracles), run via `npm test`, then reverted; tree confirmed clean afterward (`git status --short fjs/exec/module.f.js` empty).

| # | Mutation | Result | Status |
|---|----------|--------|--------|
| 1 | `refusalMessage`'s template literal changed from `operation not permitted: ` to `BLOCKED: ` (implementation only; test literals untouched) | 8 failures (`refusalPartwayThroughAChainReportsTheRefusedCommand`, all 6 `refusals.*`, `twoStepDefineGetterEscalation`) | ✓ CAUGHT |
| 2 | Catch rewritten to `const message = /** @type {any} */ (thrown).message; return error(refusalMessage(message, map))` | 8 failures, each reporting `operation not permitted: undefined; ...` | ✓ CAUGHT |
| 3 | `stepBudget` raised from `10_000` to `20_000` | 1 failure (`stepBudgetBoundsNonTerminatingChain`, message text mismatch `20000` vs. expected `10000`); leaf duration roughly doubled (~281ms → ~562ms), confirming genuine proportional dispatch, not a short-circuit | ✓ CAUGHT |
| 4 (exploratory, not required) | Read-append moved from after `match` success to before it | 0 failures — all 18 pass, confirming the code comment's own claim that this ordering is unobservable given the current API (refusal path discards `reads` on error) | Confirms comment honesty, not a gap |

All three required mutations produced real, correctly-attributed failures. None passed vacuously — every named guarantee is genuinely under test.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| EXEC-01 | 03-01 | `interpret(map)(effect)`, depends on `fjs/effects` only | ✓ SATISFIED | `fjs/exec/module.f.js` exports `interpret`; import-boundary grep confirms isolation. |
| EXEC-02 | (upstream, not this phase) | Own-property dispatch guard | ✓ SATISFIED (pre-existing) | Verified directly against installed fjs 0.41.0's `match`/`at`; no local guard added, none required. |
| EXEC-03 | 03-01 | Actionable refusal naming operation + permitted set | ✓ SATISFIED | 6 `refusals.*` leaves, exact-text `assertEq`, mutation-confirmed. |
| EXEC-04 | 03-01 | Two-step `__defineGetter__` escalation regression proof | ✓ SATISFIED | `twoStepDefineGetterEscalation`, install-then-dispatch, both refused. |
| EXEC-05 | 03-02 | Observed (not declared) read set | ✓ SATISFIED | `readSetReflectsActualDispatch`, `Read`/`Interpreted<T>` typedefs, append-after-dispatch. |
| EXEC-06 | 03-02 | Step budget bounds execution | ✓ SATISFIED | `stepBudget = 10_000` exported; `stepBudgetBoundsNonTerminatingChain`, mutation-confirmed genuinely exhausted. |

No orphaned requirements — REQUIREMENTS.md maps exactly EXEC-01 through EXEC-06 to Phase 3 (line 510), and all six are accounted for above (EXEC-02 pre-satisfied upstream, the other five delivered by this phase's two plans).

Note: REQUIREMENTS.md's own checkbox markers for EXEC-01, EXEC-03–06 (lines 116, 125, 132, 139, 142) still read `[ ]` (unchecked) as a documentation-tracking artifact — this is outside the scope of what either plan's tasks touch (neither plan's `files_modified` includes `REQUIREMENTS.md`) and does not affect the code-level verification above. Flagged as informational, not a gap.

### Anti-Patterns Found

None. `grep -n -E "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER"`, case-insensitive placeholder-language grep, and empty-implementation grep (`return null|return {}|return []|=> {}`) all returned zero matches against `fjs/exec/module.f.js`.

### Human Verification Required

None. Every observable truth in this phase is a pure-function property (dispatch, refusal text, read-set accumulation, step-budget bound) fully verifiable by proof execution, grep, and mutation testing — no UI, no real-time behavior, no external service integration.

### Gaps Summary

None. All 11 must-haves verified, all 4 ROADMAP.md Phase 3 success criteria confirmed directly against the live tree, no anti-patterns, no unverifiable-programmatically items. Success criterion 4's roadmap phrasing ("runs under `fjs/effects/mock`") is satisfied in spirit — every proof runs entirely in-memory against a hand-built `OperationMap` fixture with zero CAS/Evo/MCP/filesystem imports — though the module does not literally import `node_modules/functionalscript/fjs/effects/mock/module.f.js`'s `run` combinator (not needed here, since `interpret`'s own handlers are stateless). This matches 03-CONTEXT.md's own reading of criterion 4 as the import-boundary constraint, which is the part verified mechanically by grep in both plans and again in this report.

---
*Verified: 2026-08-03T21:00:00Z*
*Verifier: Claude (gsd-verifier)*
