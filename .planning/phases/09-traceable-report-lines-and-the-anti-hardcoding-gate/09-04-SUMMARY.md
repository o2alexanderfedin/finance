---
phase: 09-traceable-report-lines-and-the-anti-hardcoding-gate
plan: 04
subsystem: report
tags: [perturbation-gate, adversary-fixture, control-leaf, phase-9]

requires:
  - phase: 09
    provides: "Plan 09-01's ReportLine/Source types, Plan 09-02's countNumericLiterals, Plan 09-03's zero-read gate and six-key response envelope (readCount/literalCount)"
provides:
  - "The perturbation gate's real leg: a minimal, real ReportLine-shaped program (proof.antiHardcodingGate.realProgramOutputMovesWhenTheInputDocumentChanges) whose output is proven to move when the one stored document it reads changes"
  - "The perturbation gate's control leg: the exact verbatim adversary `() => pure({ line16: 9137 })` (proof.antiHardcodingGate.hardcodedAdversaryFailsAndIsInvariantToInputChange), run and proven to fail — and to fail with a character-for-character IDENTICAL message whether or not the document changes"
  - "Four pre-existing indexed-access type casts (three heads[0]/regex-capture sites via assertNotNullish, one Record<string,unknown> lookup via a local bind plus typeof assert) replaced with narrowed local bindings across fjs/server/fjs_run/module.f.js and fjs/server/module.f.js"
  - "The real-process integration test (fjs-run-integration.test.js) now asserts readCount/literalCount on the decisive fjs_run response envelope"
affects: []

tech-stack:
  added: []
  patterns:
    - "A perturbation proof needs two hashes for the SAME JsModule fixture run twice against evolving CAS state: runExecuteRunViaFixture performs a REAL materialize write each call, and a second real write to the SAME path collides with the first run's already-swapped-in JsModule function (writeFile refuses any target that isn't an array). One harmless extra byte on the (otherwise irrelevant) stored source text gives each run its own fresh materialize path."
    - "A control leaf proves a before/after comparison is honest by asserting the SAME methodology yields an IDENTICAL result for a program that reads nothing — never merely that a real program's output moved, which alone cannot distinguish 'the gate works' from 'the fixture would have moved anyway' (the Phase 6 lesson)."
    - "The literal count named in a refusal message is asserted against countNumericLiterals called directly on the adversary's own source text, never hand-computed, so the assertion cannot silently drift from the audit's own logic."

key-files:
  created: []
  modified: [fjs/server/fjs_run/module.f.js, fjs/server/module.f.js, fjs-run-integration.test.js]

key-decisions:
  - "The perturbation gate's real leg (Task 1) and control leg (Task 2) were committed as two separate atomic commits, even though both live in the SAME new proof.antiHardcodingGate section of the SAME file — Task 1's commit was verified in isolation (npm test green, honest metric 255) before Task 2's adversary leaf was re-added, matching the plan's own per-task commit protocol despite the two leaves being textually adjacent."
  - "Running the SAME demoReport/adversaryReport JsModule fixture twice against an evolving CAS state (seed, run, perturb, run again) required a SECOND, functionally-identical program hash for the second run: runExecuteRunViaFixture always performs a real materialize write, and the first run's real write already swapped that path's content from raw bytes to a JsModule function, so a second real write to the identical path would collide ('invalid file', fjs/effects/node/virtual's writeFile). Each run's stored source differs only by one trailing newline — the JsModule fixture is what actually executes either way, per this file's own established materialize-write/JsModule-at-full-path split (07-10) — so the second run targets its own fresh path instead of re-touching the first."
  - "The 09-CONTEXT.md-quoted adversary phrase `() => pure({ line16: 9137 })` is stored VERBATIM (adapted only by the unavoidable `ctx.` prefix a zero-import stored program requires, EXEC-07) — never paraphrased — matching the plan's explicit instruction and its own rationale: a gate built against an adversary it is never actually run against is a claim, not a proof."
  - "Site 2 of the four cast repairs (responseShape's `parsed['resultHash']`) used a local-bind-plus-typeof-assert rather than assertNotNullish, per the plan's own explicit instruction: `parsed` there is `Record<string, unknown>`, so the indexed value is `unknown`, not `T | undefined` — assertNotNullish alone would not narrow it to `string`."

patterns-established:
  - "A minimal ReportLine-shaped demonstration program is type-annotated inline against Plan 09-01's own type via `/** @type {import('../../report/line/module.f.js').ReportLine} */`, matching this file's own established inline-import-type convention for local Report<T> annotations."

requirements-completed: [PROV-07]

duration: ~50min
completed: 2026-08-05
---

# Phase 09 Plan 04: The Perturbation Gate and the Verbatim Adversary Summary

**ROADMAP criterion 4 proven by execution, not description: a minimal, real ReportLine-shaped program's output moves from `'10.00'` to `'20.00'` when the one stored document it reads changes, while the exact adversary `() => pure({ line16: 9137 })`, written verbatim and run for real, fails identically before and after the SAME document change — plus four repaired indexed-access casts and the real-process integration test naming its own read/literal counts.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-08-05
- **Tasks:** 3 completed
- **Files modified:** 3 (`fjs/server/fjs_run/module.f.js`, `fjs/server/module.f.js`, `fjs-run-integration.test.js`)

## Accomplishments

- **The perturbation gate's real leg** (`proof.antiHardcodingGate.realProgramOutputMovesWhenTheInputDocumentChanges`): seeds one document (`box1InterestIncome: "10.00"`) behind a subject, runs a minimal `demoReport` that reads that subject's head -> revision -> snapshot -> `box1InterestIncome` (the same chain `multiDocumentSumAcrossTwoStoredDocuments` already establishes), builds a value type-annotated against Plan 09-01's own `ReportLine`, and asserts the JSON-safe wire projection equals `{value: "10.00", sources: [{documentHash: docHash1, boxPath: "box1InterestIncome", ...}], rule: "1040 line 2b"}`. A second revision naming the first as its `parents` entry becomes the subject's sole live head (`headsOf`'s own exclusion rule, verified directly in `fjs/cas/evo/module.f.js`); running the SAME `demoReport` again returns `value: "20.00"` — the output moved.
- **The perturbation gate's control leg** (`proof.antiHardcodingGate.hardcodedAdversaryFailsAndIsInvariantToInputChange`): the exact adversary ROADMAP criterion 4 names, `() => pure({ line16: 9137 })`, stored VERBATIM (adapted only by the unavoidable `ctx.` prefix) and run against the state before AND after the identical perturbation the real leg applies. Both runs return `outcome.kind === 'error'` (the zero-read gate fires — the adversary never reads the document at all), and the two refusal messages are asserted character-for-character IDENTICAL — the control that proves the assertion is about the gate itself, not about a fixture that would have moved regardless (the Phase 6 lesson STATE.md records). The named literal count is asserted against `countNumericLiterals(adversarySource)` called directly, never hand-computed. Either outcome is fed through `handleRunOutcome`/`assertPersistedErrorRunRecord`, confirming a `status: 'error'` run record still persists for a zero-read refusal (PROV-03).
- **Four pre-existing indexed-access casts repaired**, since Task 1 was already editing this exact `evoHead`-chain code path: `fjs/server/fjs_run/module.f.js`'s `sumOverSubjects` `heads[0]` and `responseShape`'s `parsed['resultHash']` (the latter via a local bind plus `typeof` assert, since `parsed` is `Record<string, unknown>` there — `assertNotNullish` alone would not narrow it to `string`), and `fjs/server/module.f.js`'s `sumInterestOverSubjects` `heads[0]` and its `runHashMatch[1]` regex-capture-group extraction (the same shape `assertPersistedErrorRunRecord` already established for an identical narrowing). `fjs/server/module.f.js` gained `assertNotNullish` in its existing `asserts` import.
- **The real-process integration test extended**: `fjs-run-integration.test.js`'s existing decisive `fjs_run` call now asserts `typeof parsed.readCount === 'number' && parsed.readCount > 0` and `typeof parsed.literalCount === 'number' && parsed.literalCount >= 1`, with no new import into the `@ts-nocheck` root file.

## Task Commits

Each task was committed atomically:

1. **Task 1: The perturbation gate's real leg, plus repairing every indexed-access cast on this code path** - `25f58ee` (feat)
2. **Task 2: The verbatim adversary fixture and its control leaf** - `296c296` (feat)
3. **Task 3: Extend the real-process integration test with the new envelope fields** - `2d36fd6` (test)

**Plan metadata:** (this commit, once made) `docs(09-04): complete The Perturbation Gate and the Verbatim Adversary plan`

## Files Created/Modified

- `fjs/server/fjs_run/module.f.js` - New `proof.antiHardcodingGate` section (the real leg and the control leg), plus repaired `sumOverSubjects` `heads[0]` and `responseShape`'s `parsed['resultHash']` casts.
- `fjs/server/module.f.js` - Repaired `sumInterestOverSubjects` `heads[0]` and `runHashMatch[1]` casts; added `assertNotNullish` to the existing `asserts` import.
- `fjs-run-integration.test.js` - Two new assertions (`readCount`, `literalCount`) on the existing decisive `fjs_run` call's response envelope.

## Decisions Made

- Split Task 1 and Task 2 into separate atomic commits despite both adding leaves to the SAME new `proof.antiHardcodingGate` object: Task 1's leaf was temporarily isolated (Task 2's leaf removed from the working tree), verified green in isolation (`npm test` 257 tests, honest metric 255), committed, then Task 2's leaf was restored and verified again (258 tests, honest metric 256) before its own commit — matching the plan's per-task commit protocol.
- Running the SAME JsModule fixture twice against an evolving CAS state (the perturbation gate's whole shape) required a second, textually-distinct-but-functionally-identical program source for the second run, to give the second real materialize write its own fresh path rather than colliding with the first run's already-swapped-in JsModule function at the same path.
- `parsed['resultHash']`'s cast repair used a local-bind-plus-`typeof`-assert rather than `assertNotNullish`, exactly as the plan's own per-site instruction specified, since `parsed` there is `Record<string, unknown>` and the indexed value is `unknown`, not `T | undefined`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Re-running the SAME program hash twice under `runExecuteRunViaFixture` collides on the second real materialize write**
- **Found during:** Task 1 (writing the perturbation gate's real leg) and Task 2 (writing the control leg), both of which need to run the same fixture twice against an evolving CAS state
- **Issue:** `runExecuteRunViaFixture` performs a REAL materialize write on every call. The first call's write succeeds and is then overwritten (state surgery) with a `JsModule` function fixture. A second call against the SAME program hash re-attempts a real write to that SAME path, which now holds a function rather than an array — `fjs/effects/node/virtual`'s `writeFile` refuses any target that isn't `undefined` or an array, failing with `'invalid file'` before the second run's own logic ever executes.
- **Fix:** Seeded a second, textually-distinct-but-functionally-identical program source (the original text plus one trailing newline) for the second run in both leaves, giving each run's real materialize write its own fresh path. The actual executed logic (the `JsModule` fixture closure) is identical either way, per this file's own established materialize-write/JsModule-at-full-path split (07-10); only the accompanying stored source text — never parsed as running code — differs by one harmless byte.
- **Files modified:** `fjs/server/fjs_run/module.f.js` (both new leaves)
- **Verification:** `npm test` green (258/258) after the fix; `node --test 2>&1 | grep -c '^✔ import("./fjs/'` rose from 254 to 256 as expected (one leaf each from Task 1 and Task 2), confirming both leaves actually ran to completion rather than erroring out.
- **Committed in:** `25f58ee` (Task 1), `296c296` (Task 2)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix was necessary purely to make the plan's own specified perturbation methodology (run, perturb, run again against the SAME fixture) actually executable under `fjs/effects/node/virtual`'s real materialize-write/JsModule-swap technique. No scope creep — the fixture's tested behavior (the `demoReport`/`adversaryReport` closures) is unchanged; only the throwaway stored-source bytes used to key the materialize path differ.

## Issues Encountered

None beyond the deviation documented above.

## User Setup Required

None - no external service configuration required.

## Verification Output

**1. `npm test` (final, after all three tasks):**
```
ℹ tests 258
ℹ suites 0
ℹ pass 258
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2934.578833
```
Exit 0, `tsc` clean, `fail 0`.

**2. `npm run test:integration`:**
```
> finance@0.0.0 test:integration
> node --test fjs-run-integration.test.js

✔ TEST-01/TEST-02: fjs_run end to end through a real separate node index.js process and a real filesystem, with full tool coverage (948.046625ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1160.222708
```
Exit 0.

**3. `node --test 2>&1 | grep -c '^✔ import("./fjs/'` (final):**
```
256
```
Strictly greater than the 254 recorded after Plan 09-03. Checkpoint counts during execution: 255 after Task 1 alone (verified by `git stash`-ing Task 2's uncommitted diff and re-running), 256 after Task 2 (one new proof leaf each).

**4. Cast-repair greps:**
```
$ grep -c "@type {string} \*/ (" fjs/server/fjs_run/module.f.js fjs/server/module.f.js
fjs/server/fjs_run/module.f.js:0
fjs/server/module.f.js:0
```

**5. Acceptance-criteria greps (Task 1):**
```
$ grep -n "realProgramOutputMovesWhenTheInputDocumentChanges" fjs/server/fjs_run/module.f.js
1123:        realProgramOutputMovesWhenTheInputDocumentChanges: () => {

$ grep -n "import('../../report/line/module.f.js').ReportLine" fjs/server/fjs_run/module.f.js
1158:                        /** @type {import('../../report/line/module.f.js').ReportLine} */

$ grep -c "assertNotNullish(heads\[0\]" fjs/server/fjs_run/module.f.js
2

$ grep -c "assertNotNullish" fjs/server/module.f.js
3
```

**6. Acceptance-criteria greps (Task 2):**
```
$ grep -n "ctx.pure({ line16: 9137 })" fjs/server/fjs_run/module.f.js
1244:            const adversarySource = 'export const report = ctx => () => ctx.pure({ line16: 9137 })'
1247:            const adversaryReport = ctx => () => ctx.pure({ line16: 9137 })

$ grep -n "hardcodedAdversaryFailsAndIsInvariantToInputChange" fjs/server/fjs_run/module.f.js
1225:        hardcodedAdversaryFailsAndIsInvariantToInputChange: () => {
```

**7. Acceptance-criteria greps (Task 3):**
```
$ grep -n "parsed.readCount" fjs-run-integration.test.js
310:            assert.ok(typeof parsed.readCount === 'number' && parsed.readCount > 0, 'expected a positive readCount')

$ grep -n "parsed.literalCount" fjs-run-integration.test.js
311:            assert.ok(typeof parsed.literalCount === 'number' && parsed.literalCount >= 1, 'expected literalCount to be at least 1')
```

**8. Guest ABI re-verification (Success Criterion 3's static half, unaffected by this plan):**
```
$ grep -n "casWrite\|evoAdd" fjs/guest/module.f.js fjs/guest/materialize/module.f.js
(no output — casWrite/evoAdd structurally absent from the guest ABI, unchanged)
```

**9. `git status --porcelain`:** empty.

**10. `git log --oneline -6`:**
```
2d36fd6 test(09-04): assert readCount/literalCount on the real-process fjs_run call
296c296 feat(09-04): the verbatim adversary fixture and its control leaf
25f58ee feat(09-04): perturbation gate's real leg, plus indexed-access cast repairs
b478ef9 docs(09-03): complete The Zero-Read Gate and the Six-Key Response Envelope plan
98dff7c feat(09-03): six-key response envelope, size-guard and zero-read proofs
e4e8941 feat(09-03): zero-read gate and literalCount in executeRun
```

## Next Phase Readiness

- PROV-07 is now fully complete: the reported half (numeric-literal audit, Plan 09-02), the runtime kill condition (zero-read gate, Plan 09-03), and the decisive perturbation proof with its verbatim adversary and control leaf (this plan) are all proven, by execution, against ROADMAP criterion 4's own named adversary.
- Phase 9 (Traceable Report Lines and the Anti-Hardcoding Gate) is complete: PROV-01/PROV-02 (Plan 09-01's `ReportLine` type), PROV-07's REPORTED half and its kill condition (Plans 09-02/09-03), and this plan's decisive perturbation proof together satisfy all four ROADMAP success criteria.
- Phase 10 (Form 1040 semantics, line-16 dispatch, the scope guard — explicitly out of scope for Phase 9 per 09-CONTEXT.md) can now build directly on `ReportLine`/`Source` (Plan 09-01), the anti-hardcoding gate (Plans 09-02/09-03/09-04), and the demonstrated real-document-reading pattern this plan's `demoReport` establishes.
- No blockers.

---
*Phase: 09-traceable-report-lines-and-the-anti-hardcoding-gate*
*Completed: 2026-08-05*

## Self-Check: PASSED

- FOUND: `fjs/server/fjs_run/module.f.js`
- FOUND: `fjs/server/module.f.js`
- FOUND: `fjs-run-integration.test.js`
- FOUND: `.planning/phases/09-traceable-report-lines-and-the-anti-hardcoding-gate/09-04-SUMMARY.md`
- FOUND: commit `25f58ee`
- FOUND: commit `296c296`
- FOUND: commit `2d36fd6`
