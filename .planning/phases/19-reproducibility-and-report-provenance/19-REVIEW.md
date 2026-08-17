---
phase: 19-reproducibility-and-report-provenance
reviewed: 2026-08-12T16:56:19Z
depth: deep
files_reviewed: 10
files_reviewed_list:
  - fjs/report/provenance/module.f.js
  - fjs/run/module.f.js
  - fjs/server/fjs_run/module.f.js
  - fjs/report/amend/module.f.js
  - fjs/media/dialects/module.f.js
  - fjs/server/module.f.js
  - fjs-run-integration.test.js
  - payer-report-integration.test.js
  - .planning/phases/19-reproducibility-and-report-provenance/19-VALIDATION.md
  - .planning/STATE.md
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-08-12T16:56:19Z
**Depth:** deep
**Files Reviewed:** 10 (every file in `git diff e191d75..HEAD --stat` except the four
`*-SUMMARY.md`/`ROADMAP.md`/`REQUIREMENTS.md` planning artifacts, which were read for
cross-reference but excluded from primary scope per this review's own rules)
**Status:** issues_found

## Summary

This review read every production `.f.js` file this phase touched, both modified real-process
test files in full, re-derived the five Run-literal-construction populations independently by
grep rather than trusting the SUMMARYs' counts, ran `npx tsc --noEmit` and `node --test
all.test.js` directly, and independently confirmed the net diff of the one file Mutation Gate M1
claims to have restored byte-identical.

**What held up under adversarial pressure — verified directly, not trusted from the SUMMARYs:**

- **PROV-05's control leg is real, not vacuous.** `assert.notEqual(controlBytes1, controlBytes2)`
  (`fjs-run-integration.test.js:552`) is a genuine `notEqual`, not a computed-and-discarded value,
  and it is ordered strictly before the pinned leg's assertions (lines 619-620) in source order —
  matching 19-VALIDATION.md's "control leaf is not optional" requirement literally.
- **The unknown-`taxYear` path never throws and never reaches `executeRun`.** Read directly:
  `fjs/server/fjs_run/module.f.js:467-472` looks up `taxParamsByYear[args.taxYear]`, binds it to a
  local, and returns a tool-level `errorResult` on `undefined` — before `executeRun` is called at
  all. This is Phase 15's CR-01 defect class (a promised-`Result` function that throws a bare
  value instead), and this phase's new code does not repeat it.
- **All five real `Run`-literal-construction populations were found and updated**, confirmed by
  re-running the population's own grep (`grep -rn "pinned:" fjs *.js | grep -v '^\s*\*'`) rather
  than trusting the SUMMARYs' count: `fjs/run/module.f.js`, `fjs/report/amend/module.f.js`,
  `fjs/report/provenance/module.f.js`, `fjs/media/dialects/module.f.js`, plus
  `fjs/server/fjs_run/module.f.js`'s two record-assembly sites. No sixth was found.
  `responseShape.tenKeysExactlyAndResultAlwaysResolvable` and `sizeGuard.newFieldsStayWellClearOfTheGuard`
  were genuinely rewritten for the widened ten-key envelope, not left stale (`fjs/server/fjs_run/module.f.js:1091,1569`).
- **`paramSetHash` vs `programHash`'s docstring distinction is crisp and does not contradict
  Phase 15.** `fjs/report/provenance/module.f.js:21-37` states the guest-path/host-path split by
  name, correctly, and the field is not redundant: two runs of the identical program with two
  different `taxYear` arguments would share `programHash` but diverge in `paramSetHash`.
- **Mutation Gate M1's target line, independently re-verified**: I confirmed the pre-mutation and
  post-restore content of `fjs/server/fjs_run/snapshot/module.f.js:317` is byte-identical to
  `e191d75` (`git diff e191d75..HEAD` for that file is empty), and that `node --test all.test.js`
  is currently green (see WR-04-adjacent note below on a transient event during this review).

**What did not hold up, or is weaker than the SUMMARYs claim:** see Warnings below. No Critical/
BLOCKER-tier defect was found — nothing here is incorrect running behavior, a security gap, or a
data-loss risk. All four issues are claims-vs-facts and robustness gaps: an inaccurate
"Complete"/"canonical" label, and two structural risks to future regression detection.

## Warnings

### WR-01: EXEC-13 is marked Complete on reasoning that does not establish the requirement's own text, and this is the second time this exact claim has been made in this phase

**File:** `.planning/REQUIREMENTS.md:188,605`; mechanism at `fjs/report/provenance/module.f.js:89`
and its only non-test caller, `fjs-run-integration.test.js:639-640`.

**Issue:** EXEC-13's text is "Run records mark `pinned: true|false`. **Only pinned runs count
toward reproducibility acceptance.**" `countsTowardReproducibilityAcceptance(run) => run.pinned`
is a pure, correctly-proven predicate — but nothing in the shipped system calls it except this
one test assertion. Grepping `.pinned` usage across the whole tree (`grep -rn "\.pinned\b" .
--include="*.js"`) finds exactly: the type/validator (`fjs/run/module.f.js:168`), the two
record-assembly sites that set it (`fjs/server/fjs_run/module.f.js`), the predicate's own module
and proof, and this one test call. There is no production code path — a tool, a report, a gate —
that consults `countsTowardReproducibilityAcceptance` (or `.pinned` directly) to change its own
behavior. The requirement's second sentence describes a *system property* ("only pinned runs
count"); what shipped is an *available, tested function* that nothing in the running system is
gated by. 19-CONTEXT.md's own Deferred section confirms the gap concretely: "`amendmentDiff` keeps
accepting unpinned runs. Making it refuse is out of scope." So today, an unpinned run's diff is
still accepted by the one place in this codebase that does a reproducibility-adjacent comparison —
directly contradicting a literal reading of "only pinned runs count toward reproducibility
acceptance" as an enforced system behavior.

This is not a new question — it was already litigated once in this same phase. Commit `14942a9`
explicitly reverted an earlier premature EXEC-13 completion with the reasoning: "`countsToward
ReproducibilityAcceptance` exists and is proven, but nothing calls it... An available function is
not an enforced property." The 19-03 re-completion changes nothing about that fact — it adds a
*test* caller, not a *production* caller — and re-marks it Complete anyway, on the stated grounds
that "there is no other acceptance pipeline in this codebase's architecture to hook into," which is
a reason the requirement *can't* be more fully satisfied here, not evidence that it *has been*.

**Concrete scenario this misleads:** a future contributor or auditor reads REQUIREMENTS.md, sees
EXEC-13 `Complete`, and assumes the system itself refuses to treat an unpinned run's output as
reproducibility-grade — for example, when reviewing whether a report built from `amendmentDiff`
can be trusted as a "pinned, reproducible" artifact. They would be wrong: nothing currently
prevents an unpinned run's result from flowing anywhere a pinned one's would, because the only
consumer of the predicate is a test.

**Fix:** Either mark EXEC-13 honestly as "predicate available and proven; not yet consumed by any
production path" (Pending or a new partial-completion state), or find/build one real consumer
(e.g., gate `amendmentDiff` per the deferred idea, with owner sign-off) before flipping the
checkbox.

### WR-02: `paramSetHash`'s docstring calls its serialization "canonical," but the underlying primitive is explicitly documented as non-canonical (source-order, not sorted)

**File:** `fjs/report/provenance/module.f.js:58-59` ("a content hash over the canonical JSON
serialization of a `TaxParamSet`"), calling `jsonText` from `fjs/json/module.f.js`.

**Issue:** `fjs/json/module.f.js`'s own module docstring states, in its own words: "**`parse`
returns its keys sorted, `stringify` writes them in source order.**" and warns explicitly: "Hash
the bytes that were written; never hash a re-serialization of a parsed value and expect the
original address... the asymmetry is invisible at the call site." `paramSetHash` calls exactly
this order-preserving `jsonText` (aliased `stringify`) directly on a `TaxParamSet` value
(`fjs/report/provenance/module.f.js:67-71`) and labels the result "canonical" — which this
project's own adjacent module defines canonical serialization is *not*. Today this is harmless in
practice only because `paramSetHash` is *always* called on the same singleton object reference
(`taxParamsByYear[year]`, `fjs/tax/params/module.f.js:728`), so key insertion order never varies
between calls for the same year. None of the seven proof leaves tests order-independence — they
test determinism-on-the-same-reference, content-sensitivity, decodability, and a cross-check
against `fileCas`'s own hash of the identical bytes; none constructs a second, differently-ordered
but content-identical `TaxParamSet` and asserts the hash still matches.

**Concrete failure scenario:** a future refactor of `taxParamsByYear` — e.g., splitting a
shared base config merged with year-specific overrides via `{ ...base, ...override }`, or adding a
field and re-ordering the object literal for readability — changes property insertion order
without changing a single dollar figure. `paramSetHash` for that same tax year then silently
changes. Any tooling built on the strength of PROV-04's "content hash of that exact parameter set"
promise (an audit comparing `paramSetHash` across two versions of the codebase, or a
reproducibility check spanning a deploy) would report "the parameter set changed" when it did not
— the exact class of false signal PROV-05's whole design exists to prevent, just one layer over.

**Fix:** Either make the serialization genuinely canonical (sort keys before hashing — `fjs/json`'s
own `parse` already demonstrates the sorted form exists) or correct the docstring to say what is
actually true: "stable for the one call site that ever supplies it (`taxParamsByYear[year]`, never
reconstructed), not order-independent." Add a proof leaf that reorders `taxParamSet`'s own
top-level keys via a fresh object literal and asserts the hash is unchanged, or drop the word
"canonical."

### WR-03: `fjs-run-integration.test.js`'s single `test()` block masks assertion failures in source order, and this phase added ~180 lines of new decisive assertions into that same block rather than isolating them

**File:** `fjs-run-integration.test.js:122-766` (one `test(...)` call, one `async` function body).

**Issue:** The whole file is one `node:test` `test()` block. An earlier thrown assertion aborts
everything sequenced after it in the same `async` function — including this phase's own new
PROV-05 (control + pinned reproduction) and EXEC-13-consumption assertions, and everything after
them (the zero-read adversary, full tool coverage, the stdout-is-JSON-RPC invariant). This is not
hypothetical: the 19-03-SUMMARY.md's own Mutation Gate M1 record documents hitting exactly this
failure mode during THIS phase's own verification — the naive `npm test` run under the mutation
reported only the *pre-existing* pin assertion (line ~461) as the failure, and a throwaway,
never-committed diagnostic copy with that earlier assertion's checks neutralized was required to
confirm the *new* PROV-05 assertion was independently load-bearing at all.

**Concrete scenario:** suppose a future change simultaneously reintroduces the M1 defect
(`buildRunSnapshot` resolving the live head instead of `pin.parents`) *and* breaks something
unrelated earlier in the block — say, the `finance_tax_params` response text at line 301. `npm
test` would report exactly one failure, at line 301, and stop. The M1 regression — the phase's own
central deliverable — would be completely invisible in that run's output, masked by an unrelated,
earlier failure, until someone fixes the first failure and re-runs to discover the second. The
project's own AGENTS.md names this exact risk in its masking-adjacent sections ("a mutation's
predicted red set is itself a claim, and it is often wrong"); this file's structure guarantees the
*true* red set can never be observed in one run once more than one assertion is broken.

**Fix:** Split `fjs-run-integration.test.js` into multiple `test()` calls sharing one spawned
server process (node:test supports several `test()` invocations per file; only the process-spawn
setup needs to be shared, e.g. via a `before`/module-level spawn, or nested `t.test()` subtests
sharing the outer `test`'s server handle) so one broken assertion does not hide every assertion
sequenced after it. This is a pre-existing pattern (`cas-refresh-cross-process.test.js` and
`payer-report-integration.test.js` share the same one-block structure), but this phase chose to
extend it rather than address it, at exactly the point (PROV-05, the phase's centerpiece) where the
masking risk is most expensive.

### WR-04: `19-VALIDATION.md`'s own Sign-Off checklist and frontmatter were never updated to reflect the phase's closure

**File:** `.planning/phases/19-reproducibility-and-report-provenance/19-VALIDATION.md:1-8,145-157`.

**Issue:** The file's frontmatter still reads `status: draft`, `nyquist_compliant: false`,
`wave_0_complete: false`. Its Sign-Off section is entirely unchecked (`- [ ]` for every item,
including "M1 and M2 both performed and watched failing... restored byte-identical" and "The
PROV-05 unpinned control was observed to MOVE before the pinned assertion was trusted") and ends
"**Approval:** pending." Meanwhile `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, and
`.planning/STATE.md` all declare Phase 19 fully `Complete`, and the 19-03-SUMMARY.md's own prose
describes doing precisely what every unchecked box asks for. Based on this review's own
verification (see Summary above), the underlying work these checkboxes ask about was genuinely
done — this is a bookkeeping gap, not evidence the work is fake. But it is exactly the kind of
claim-vs-fact drift this project's own AGENTS.md repeatedly calls out (Phase 15's WR-01 is the same
class: a tracking artifact left stale after the work it describes finished).

**Concrete scenario:** a future phase, or a `/gsd-verify-work` pass, treats `nyquist_compliant` and
the Sign-Off checklist as the source of truth for whether Phase 19's validation contract was
actually satisfied (which is the file's own stated purpose: "a per-phase validation contract").
Reading only this file, they would conclude Phase 19's mutation gates were never performed and
never restored — directly contradicting the SUMMARY files and the ROADMAP's `Complete` status, and
forcing an unnecessary re-verification, or worse, being trusted over the (correct) SUMMARY and
triggering an incorrect "phase not actually closed" report.

**Fix:** Update `19-VALIDATION.md`'s frontmatter (`status: complete`, `nyquist_compliant: true`,
`wave_0_complete: true`) and check every Sign-Off box, or explicitly note in the file why it was
intentionally left in its draft state despite the phase closing.

## Info

### IN-01: PROV-04's "two different tax years produce two different `paramSetHash` values" validation-map row has no test against two real, distinct tax years

**File:** `19-VALIDATION.md:61`; `fjs/tax/params/module.f.js:726-729`; `fjs/report/provenance/module.f.js:146-158`.

**Issue:** `taxParamsByYear` currently has exactly one entry, `2025` ("Exactly one entry today:
TY2025," the module's own docstring says), so no test can construct this row literally today.
`sensitiveToTheParameterSetsContent` mutates one nested field of the single available year as a
stand-in, which is a reasonable substitute given the constraint, but it is not the row's literal
claim. Not a defect — there is no second year to test against — but worth recording so a second
tax year's addition is the natural trigger to add the literal two-real-years test the validation
map originally asked for, rather than assuming the mutation-based substitute already covers it.

**Fix:** When a second year is added to `taxParamsByYear`, add
`assert(paramSetHash(taxParamsByYear[2025]) !== paramSetHash(taxParamsByYear[<newYear>]))` as its
own leaf, rather than continuing to rely solely on the single-year mutation as the proxy.

### IN-02: A concurrently-running `npm test` process was observed mutating and restoring the exact Mutation-Gate-M1 file during this review, live

**File:** `fjs/server/fjs_run/snapshot/module.f.js:317` (observational, not a code finding).

**Issue:** While verifying Mutation Gate M1's restoration claim independently, this review
observed `git status --porcelain` and the file's own content transiently show the M1 mutation
itself applied (`publicState.heads[pin.subject] ?? []` instead of `pin.parents`), with `node --test
all.test.js` correspondingly reporting exactly the two failing leaves 19-VALIDATION.md predicts for
M1 — then, moments later, the file and `git status` were confirmed clean and correct again, three
consecutive checks apart. `ps aux` at that moment showed a live, independently-running `npm test` /
`node --test` process tree (pids 95536/95557/95602/95606/95609, started 9:52AM) against this same
working directory. This matches AGENTS.md's own documented hazard verbatim: "Concurrent work
invalidates a mutation observation... a red you did not cause confirms a mutation that never
worked, which is worse than a missed failure, because it gets written down as evidence." This
review's own final, repeated checks confirm the committed/working-tree state is correct and stable
(`git diff e191d75..HEAD` for this file is empty), so nothing here is attributed to the shipped
diff. It is recorded because it directly bears on how much independent confidence to place in any
single mutation-gate observation made in this shared workspace, including the ones this review
itself just ran.

**Fix:** No code fix needed. If another agent/session is actively re-running Phase 19's mutation
gates concurrently with this review or with future work in this checkout, coordinate so mutation
observations are not made (or trusted) while a sibling process may be mid-mutation on the same
file — per AGENTS.md's own snapshot-copy recipe for exactly this situation.

---

_Reviewed: 2026-08-12T16:56:19Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
