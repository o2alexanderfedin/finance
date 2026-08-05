---
phase: 09-traceable-report-lines-and-the-anti-hardcoding-gate
verified: 2026-08-05T00:00:00Z
status: gaps_found
score: 3/4 must-haves verified
overrides_applied: 0
gaps:
  - truth: "A perturbation gate: changing one input document moves the output, AND `() => pure({ line16: 9137 })` — which satisfies every other criterion — fails."
    status: partial
    reason: >
      The zero-observed-reads kill condition is implemented TWICE, identically, in
      fjs/server/fjs_run/module.f.js: once in the real, production `executeRun` (line ~204,
      the function `fjsRunTool` actually calls, i.e. what a real MCP `fjs_run` call executes),
      and once more in the test-only helper `runExecuteRunViaFixture` (line ~480). Every
      project-local proof — including the decisive
      `proof.antiHardcodingGate.hardcodedAdversaryFailsAndIsInvariantToInputChange` control
      leaf — calls `runExecuteRunViaFixture`, never `executeRun` directly, for any case that
      reaches an outcome. I mutated ONLY the production copy (`executeRun`'s
      `reads.length === 0` at line 204) to `reads.length === -1` (still typechecks) and ran
      `npm test`: 258/258 still pass, `tsc` stays clean. The entire proof suite is blind to
      the real gate being deleted. Mutating the OTHER copy (line 480, the one actually
      exercised) correctly turns 2 proofs red
      (`zeroReadGate.zeroReadOutcomeBecomesAnErrorResult` and
      `antiHardcodingGate.hardcodedAdversaryFailsAndIsInvariantToInputChange`), confirming
      the test-only copy is a real gate — but it is not the gate that ships. The real-process
      integration test (fjs-run-integration.test.js) does not close this gap either: it calls
      `fjs_run` exactly once, with a legitimate multi-read program, and only asserts
      `readCount > 0` / `literalCount >= 1` on the success path — it never drives an
      adversarial zero-read program (or the verbatim `line16: 9137` adversary) through the
      real, separately-spawned server process. So no test anywhere — proof or integration —
      exercises the actual shipped code path with an adversary and confirms it is refused.
      This is exactly the failure mode 09-CONTEXT.md itself names as unacceptable ("a gate
      built for an adversary that is never actually run against it is a claim, not a proof")
      and exactly what the verification brief warned about ("a gate whose removal leaves the
      suite green is not a gate") — reproduced here against the ACTUAL production function,
      not a stand-in.
    artifacts:
      - path: "fjs/server/fjs_run/module.f.js"
        issue: >
          Zero-read gate duplicated: `executeRun` (line ~204, production, wired to
          `fjsRunTool`) and `runExecuteRunViaFixture` (line ~480, test-only helper) each carry
          their own `if (reads.length === 0) { ... }` block with the same message-building
          logic. No proof in this file, and no assertion in fjs-run-integration.test.js,
          reaches `executeRun`'s own copy with a zero-read program in a way that would
          observe an 'ok'/'error' distinction depending on that specific `if`.
    missing:
      - "Extract the zero-read check into ONE named function (e.g. `zeroReadRefusal(reads, literalCount)`) that both `executeRun` and `runExecuteRunViaFixture` call, so mutating the single real implementation breaks every consumer — closing the DRY violation and the coverage gap in the same fix."
      - "Add a real-process integration-test call (fjs-run-integration.test.js) that runs a zero-read program — ideally the verbatim `() => pure({ line16: 9137 })` adversary itself, or a functionally-equivalent Pure-only program — through the actual spawned `node index.js` server and asserts the response is `isError: true` naming 'zero observed reads', proving the production code path (not a fixture stand-in) actually refuses it."
deferred: []
---

# Phase 9: Traceable Report Lines and the Anti-Hardcoding Gate Verification Report

**Phase Goal:** A report line cannot exist without the sources it came from, and a program
that contains the answer instead of computing it is caught mechanically.
**Verified:** 2026-08-05
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP's four Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `{ value }` without `{ sources }` fails `tsc` | VERIFIED | Independently reproduced: widened `sources` to optional in `fjs/report/line/module.f.js`, ran `npx tsc` — got `TS2344: Type 'false' does not satisfy the constraint 'true'` at the exact assertion line (76), plus three cascading `TS18048`/`TS2488` errors in the file's own proofs. Reverted; `npx tsc` exits 0 silently; `git diff` empty; file byte-identical to committed state. Matches 09-01-SUMMARY.md's transcript exactly. |
| 2 | Every computed line carries `(documentHash, boxPath, value)` tuples plus the rule it implements | VERIFIED | `ReportLine` (`fjs/report/line/module.f.js`): `sources: readonly [Source, ...(readonly Source[])]` (non-empty tuple — `sources: []` also fails `tsc`), `Source = { documentHash, boxPath, value }`, `rule: string` required (not optional). Demonstrated end-to-end in `proof.antiHardcodingGate.realProgramOutputMovesWhenTheInputDocumentChanges` (`fjs/server/fjs_run/module.f.js`), which type-annotates a real computed value against `ReportLine` and round-trips it through JSON. |
| 3 | Every run reports a CAS-read count and a numeric-literal audit alongside its result, both visible to the user | VERIFIED | `fjsRunTool`'s response envelope carries exactly six keys (`resultHash, runHash, preview, truncated, readCount, literalCount`), asserted by `proof.fjsRunTool.responseShape.sixKeysExactlyAndResultAlwaysResolvable`. Confirmed for REAL over a real separate `node index.js` process: `fjs-run-integration.test.js` asserts `typeof parsed.readCount === 'number' && parsed.readCount > 0` and `typeof parsed.literalCount === 'number' && parsed.literalCount >= 1` on the actual MCP `fjs_run` response — reran this myself (`npm run test:integration`), 1/1 pass. `readCount` derives from `inputs.length` (the same array persisted into the `vnd.fjs.run` record — no second counter); `literalCount` is `countNumericLiterals` on the program's own source text. |
| 4 | A perturbation gate: changing one input document moves the output, AND the verbatim adversary fails | **PARTIAL / BLOCKER** | The REAL leg is genuine: `proof.antiHardcodingGate.realProgramOutputMovesWhenTheInputDocumentChanges` seeds a document, reads it through a real subject/revision/snapshot chain, gets `'10.00'`, perturbs the document, reruns, gets `'20.00'` — reproduced by running `npm test` myself (258/258 pass). The adversary control leg (`hardcodedAdversaryFailsAndIsInvariantToInputChange`) does run the exact verbatim `() => pure({ line16: 9137 })` and does prove it fails identically before/after perturbation — **but only against a test-only duplicate of the zero-read gate**, not the production `executeRun` function a real `fjs_run` call actually executes. See the Gaps section and the mutation evidence below. |

**Score:** 3/4 truths fully verified; truth 4 partially verified (real leg solid, adversary-control leg proven against a code duplicate rather than the shipped path).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `fjs/report/line/module.f.js` | `Source`/`ReportLine` types, PROV-01 compile-time assertion | VERIFIED | Exists, substantive, wired into the demonstration proof in `fjs_run/module.f.js`; PROV-01 assertion independently reproduced (widen/revert). |
| `fjs/report/audit/module.f.js` | `countNumericLiterals`, immune to identifiers/strings/comments | VERIFIED | Tokenizer strips strings/templates/comments before counting; 10 proof leaves including the exact verbatim adversary fixture (count = 1, the `9137` only, not `line16`'s `16`). Manually re-verified: `countNumericLiterals` on the adversary source with and without a trailing newline both return `1`. |
| `fjs/server/fjs_run/module.f.js` | Six-key envelope, zero-read gate, perturbation proof | PARTIAL (see gap) | Envelope and real-leg perturbation verified; zero-read gate exists in duplicate, only the test-only copy is exercised by any proof. |
| `fjs/server/module.f.js` | Four indexed-access cast repairs | VERIFIED | `grep -c "@type {string} */ ("` = 0 in both files; `heads[0]` uses `assertNotNullish`; `runHashMatch[1]` uses `assertNotNullish`; `parsed['resultHash']` uses a local bind + `typeof` assert (correct choice since `parsed` is `Record<string, unknown>`, not `T \| undefined`). |
| `fjs-run-integration.test.js` | Asserts `readCount`/`literalCount` on the real decisive call | VERIFIED | Lines 310–311 assert both fields on the real, separate-process `fjs_run` response. Re-ran: 1/1 pass. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `executeRun` | `countNumericLiterals` | direct call at the point source text is read | WIRED | `literalCount = countNumericLiterals(sourceText)` computed once, reused in both outcome branches. |
| `handleRunOutcome` | `inputs.length` (readCount) | derived from the same array persisted to the run record | WIRED | No second counter — matches 09-CONTEXT.md's explicit decision. |
| `fjsRunTool` (production) | zero-read gate | `executeRun`'s own `if (reads.length === 0)` | **ORPHANED FROM TEST COVERAGE** | The gate exists and is correct by inspection (mirrors the tested copy exactly, and matches `interpret`'s documented `reads = []` behavior for a bare `Pure` effect — confirmed by reading `fjs/exec/module.f.js` lines 137–158). But no proof and no integration assertion ever drives an outcome through THIS copy of the check — see mutation evidence below. |

### Mutation/Adversarial Verification (performed directly against the codebase)

All mutations below were applied, tested, and reverted; `git status --porcelain` was empty before and after every one; final diffs against a pre-mutation copy confirmed byte-identical.

1. **PROV-01 widen/revert (reproduced independently).** Widened `sources` to `sources?:` in `fjs/report/line/module.f.js`. `npx tsc` → `TS2344` at line 76, plus 3 cascading errors, exit 1 — matches 09-01-SUMMARY.md's transcript verbatim. Reverted → `npx tsc` exit 0, silent, `git diff` empty.

2. **Zero-read gate, PRODUCTION copy (`executeRun`, line 204).** Changed `reads.length === 0` → `reads.length === -1` (still typechecks — `tsc` clean). Ran `npm test`: **258/258 still pass.** The entire proof suite — including `proof.antiHardcodingGate.hardcodedAdversaryFailsAndIsInvariantToInputChange`, the proof headlined as defeating the exact adversary the ROADMAP names — is blind to this mutation. This is the BLOCKER: the gate that ships is not the gate any proof exercises. Reverted; confirmed byte-identical to the original.

3. **Zero-read gate, TEST-ONLY copy (`runExecuteRunViaFixture`, line 480).** Same mutation applied to the other copy. Ran `npm test`: **256/258 pass, 2 fail** — `proof.zeroReadGate.zeroReadOutcomeBecomesAnErrorResult` and `proof.antiHardcodingGate.hardcodedAdversaryFailsAndIsInvariantToInputChange` both go RED, as expected. This confirms the mechanism is a real, working gate — just not proven against the function that actually runs in production. Reverted; confirmed byte-identical to the original.

4. **`interpret`'s `Pure` effect and observed reads (read, not mutated).** Confirmed in `fjs/exec/module.f.js` lines 137–144: `if (typeof e === 'function') { return ok([e(), reads]) }` — a bare `Pure` effect (the adversary's whole body) returns immediately with whatever `reads` accumulated so far, which is `[]` (line 141's initial value) if nothing was dispatched first. `executeRun`/`runExecuteRunViaFixture` both destructure this exact `reads` array and check its length — the gate inspects the same set `interpret` produces, confirmed by reading, not merely trusting the docstring.

### 09-04's Documented Deviation (trailing-newline second program hash)

Verified directly, not merely read:
- **(a) Same logic executes both times.** `runExecuteRunViaFixture` places the `report` closure argument (e.g. `adversaryReport = ctx => () => ctx.pure({ line16: 9137 })`) as a `JsModule` fixture at the materialize path; the stored source text is never parsed to produce the running module (confirmed by reading `placeJsModuleFixture`/`runExecuteRunViaFixture` — the loaded module comes from `() => ({ report })`, not from `import()`ing the stored bytes under `virtual`). The trailing newline is applied only to the throwaway stored bytes, never to the `adversaryReport` closure that actually runs.
- **(b) Perturbation still isolates the input document.** The only semantic change between the adversary's two runs is the seeded document (`10.00` → `20.00`); the second program hash differs only to give the real materialize write a fresh, non-colliding path (`fjs/effects/node/virtual`'s `writeFile` refuses a target already holding a non-array — confirmed this is a real, previously-hit collision per the SUMMARY's own account, consistent with `virtual`'s documented behavior).
- **(c) Trailing newline does not change `literalCount` or any asserted value.** Ran `countNumericLiterals` myself, directly, on both `adversarySource` and `adversarySource + '\n'`: both return `1`. The test's own `assertEq(outcome2.message, outcome1.message)` (character-for-character identical, including the embedded literal count) passing in the real `npm test` run is independent confirmation of the same fact.

The deviation is honest and does not weaken what the real leg and the (test-copy) adversary leg demonstrate about each other. It does not touch or mitigate the BLOCKER above, which is about test coverage of the *production* function, not about this workaround.

### Tautology Audit

- `countNumericLiterals`'s own correctness proofs (`fjs/report/audit/module.f.js`) use **hand-computed** expected values (`assertEq(countNumericLiterals('const x = 42'), 1)`, etc.) — not self-referential. Genuine.
- The wiring assertion in `fjs_run/module.f.js` (`expectedLiteralCount = countNumericLiterals(adversarySource)`) IS self-referential, but it is testing *integration* (does `executeRun`'s message correctly embed whatever the audit module reports), not the audit's own correctness, which is separately and non-tautologically proven. Acceptable.
- `readCount` assertions (`assertEq(parsed['readCount'], 1)` in `responseShape`) are hand-computed against a known fixture (one `evoList` dispatch), not derived from the same code path being tested. Genuine.
- The zero-read gate's own two message assertions (`includes('zero observed reads')`) are string-literal checks against a hardcoded message substring — genuine, not circular.
- **The one real tautology risk found:** two structurally-identical copies of the gate exist, and only one is exercised. A test asserting behavior of a duplicate is not automatically a tautology, but here it produces the practical equivalent — a false sense of proof for code that isn't the code that runs. Documented above as the BLOCKER.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `fjs/server/fjs_run/module.f.js` | ~204 vs ~480 | Duplicated zero-read gate logic (DRY violation, AGENTS.md) | 🛑 Blocker | Produces the test-coverage gap above — the two copies drifting apart (or one being silently broken) would ship undetected. |

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any phase-modified file. No `instanceof Error` branching (the two matches found are in comments explicitly documenting its absence). No bare non-null assertions. One `@type {any}` cast (`unsafeDo`, line 508) — a pre-existing, documented test-fixture escape hatch pattern established in Phase 3's `fjs/exec/module.f.js`, confined to test fixtures, not new to this phase.

### Project Hard Rules

- **No new dependency:** `git diff 31260be..HEAD -- package.json` — empty. Confirmed.
- **`vnd.fjs.run` gained no new fields:** `git diff 31260be..HEAD -- fjs/run/module.f.js` — empty. Confirmed unchanged, exactly as 09-CONTEXT.md decided.
- **Four cast repairs:** `grep -c "@type {string} \*/ ("` = 0 in both `fjs/server/fjs_run/module.f.js` and `fjs/server/module.f.js`. `parsed['resultHash']` uses a local bind + `typeof` assert (correct, since it's `Record<string, unknown>`, i.e. `unknown`, not `T | undefined`). Other three sites use `assertNotNullish`. Confirmed by direct grep and read.
- **Money as cents `bigint`/decimal strings:** `ReportLine.value: bigint`; `Source.value: string` (decimal, as read); wire projection uses `centsToString`, never `JSON.stringify` on a bare `bigint`. Confirmed.

### Commands Run (with actual output)

```
$ npm test                                                    → 258 pass, 0 fail
$ npm run test:integration                                    → 1 pass, 0 fail
$ node --test 2>&1 | grep -c '^✔ import("./fjs/'              → 256 (baseline 240; +16 across the phase)
$ git status --porcelain                                      → (empty), confirmed after every mutation+revert
$ git diff 31260be..HEAD -- package.json fjs/run/module.f.js  → (empty both)
```

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| PROV-01 | 09-01 | `{ value }` without `{ sources }` does not typecheck | SATISFIED | Independently reproduced widen/revert. |
| PROV-02 | 09-01 | `(documentHash, boxPath, value)` tuples plus rule | SATISFIED | `Source`/`ReportLine` types, demonstrated. |
| PROV-07 | 09-02/03/04 | Read-count + literal audit + perturbation gate | **PARTIALLY SATISFIED** | Reported halves (read count, literal audit) fully verified for real. The perturbation gate's kill condition is proven only against a test-only duplicate of the production code — see BLOCKER. |

No orphaned requirements — REQUIREMENTS.md maps exactly PROV-01/02/07 to Phase 9, and every plan declares one of these three.

### Human Verification Required

None. Every criterion here is mechanically checkable and was mechanically checked, including by direct mutation against the running suite.

### Gaps Summary

Three of four ROADMAP success criteria are solidly verified, including independent reproduction of the PROV-01 compile-time failure and the real-document perturbation. The fourth criterion — the anti-hardcoding gate defeating the verbatim adversary — is real as a *mechanism* (mutating the code path the tests actually exercise correctly turns two proofs red), but the mechanism proven is not the mechanism that ships: `executeRun`'s own zero-read check (what a live `fjs_run` MCP call actually runs through `fjsRunTool`) is never reached by any proof or by the real-process integration test with an outcome-producing case, because of a documented `fjs/effects/node/virtual` limitation (write-then-import incompatibility) that the project worked around with a test-only duplicate helper (`runExecuteRunViaFixture`) — and never closed the resulting coverage hole. Deleting the real gate leaves `npm test` at 258/258 and `tsc` clean. This is precisely the failure mode 09-CONTEXT.md itself calls out as unacceptable, now confirmed to apply to this phase's own decisive proof. The fix is mechanical and small: extract one shared zero-read-refusal function both `executeRun` and the test helper call, and/or add one real-process integration assertion that runs an adversarial zero-read program through the actual server.

---

*Verified: 2026-08-05*
*Verifier: Claude (gsd-verifier)*
