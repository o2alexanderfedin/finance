---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: milestone
status: executing
stopped_at: **Phase 12.1 (The Capital-Gain Chain) COMPLETE — 4/4 plans, 4/4 summaries.** A
last_updated: "2026-08-11T01:56:58.597Z"
last_activity: 2026-08-11
progress:
  total_phases: 19
  completed_phases: 13
  total_plans: 75
  completed_plans: 66
  percent: 88
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-03)

**Core value:** The report is a program, not an answer — the agent emits FunctionalScript;
the server executes it as a pure function of `(documents, tax-year parameters) → report`.
**Current focus:** Phase 13 — The 65+ Profile and the Remaining Schedules

## Current Position

Phase: 13 (The 65+ Profile and the Remaining Schedules) — EXECUTING
  Four plans across three waves. The plan set was returned ISSUES FOUND by
  `gsd-plan-checker` twice (2 blockers, then 2 more), revised each time, and only
  executed after a third pass returned VERIFICATION PASSED.
Plan: 2 of 13
  Wave 1: 12.1-01 (Form 8949 category derivation + the absent-basis refusal) and
  12.1-02 (the 47-line Schedule D Tax Worksheet). Wave 2: 12.1-03 (Schedule D
  lines 1a-21, the loss-cap three-way branch, two bounded sub-worksheets).
  Wave 3: 12.1-04 (Form 1040 wiring FIRST, then the six-kind scope
  reclassification — the atomic transition — then mutation gates M3/M4/M5).
Status: Ready to execute
  exists**. Every phase 01-12 has one. Execute-phase ran with `--no-transition` and
  stopped after the final wave, so the phase has never been independently verified
  against its goal. That is the next action.

Progress: [█████████░] 88%
  Phase-based, never plan-based: `completed_plans` (65) exceeds `total_plans` (62)
  because three phases carry an extra FIX-SUMMARY.md beside a plan's own summary,
  which rounds the plan-based figure to a misleading 100%. See `percent_note`.
Last activity: 2026-08-11

> **This block carried Phase 10's text under a 12.1 heading until 2026-08-09** — "Ten plans
> across six waves", `10-03 Tax Computation Worksheet`, "Phase 11 not started" — while
> `Progress` read 100% against a frontmatter `percent` of 68. Rewritten from measurement.
> The same class of defect as the coverage-table drift fixed in `REQUIREMENTS.md` the same
> day: a hand-maintained second source that nothing compares against.

### Test metrics — MEASURE, do not read

**Do not quote a test count from this file.** Run the commands:

```
npm test                                        # tsc && node --test
node --test 2>&1 | grep -c '^✔ import("./fjs/'  # project-local proofs — the ONLY honest metric
npm run test:integration                        # real-process subset (also included in npm test)
```

Pasted counts were kept here through Phases 7-9 and went stale every single time, including once
*after* a note was added saying they go stale. The note did not help; removing the numbers does.
Only two figures are worth recording, because they are historical facts rather than current state:

| Landmark | Project-local proofs |
|---|---|
| End of Phase 7 | 185 |
| End of Phase 9 | 260 |

**Never gate on `npm test`'s total.** It includes ~2,100 vendored `functionalscript` submodule
proofs and moves with submodule initialization state — which is exactly how a Phase 7 gate
("total > 134") came to be satisfied before a single line of that phase's code was written.

## Performance Metrics

**Velocity:**

- Total plans completed: 65 (see the per-plan table below; this line read 0 until 2026-08-09 while the table listed 40+ entries)
- Average duration: —
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 04 P02 | 25min | 3 tasks | 2 files |
| Phase 07 P01 | 20min | 2 tasks | 1 files |
| Phase 07 P02 | 25min | 2 tasks | 1 files |
| Phase 07 P03 | 20min | 2 tasks | 1 files |
| Phase 07 P04 | 13min | 2 tasks | 1 files |
| Phase 07 P05 | 45min | 2 tasks | 3 files |
| Phase 07 P06 | 55min | 2 tasks | 1 files |
| Phase 07 P07 | 40min | 2 tasks | 1 files |
| Phase 07 P08 | 50min | 2 tasks | 1 files |
| Phase 07 P09 | 20min | 2 tasks | 2 files |
| Phase 08 P01 | 25min | 2 tasks | 1 files |
| Phase 08 P02 | 45min | 3 tasks | 1 files |
| Phase 8 P03 | 25min | 2 tasks | 1 files |
| Phase 08 P04 | 25min | 2 tasks | 3 files |
| Phase 09 P01 | 20min | 2 tasks | 1 files |
| Phase 09 P02 | 15min | 2 tasks | 1 files |
| Phase 09 P03 | 35min | 2 tasks | 1 files |
| Phase 09 P04 | 50min | 3 tasks | 3 files |
| Phase 09 P05 | 35min | 3 tasks | 2 files |
| Phase 09 P06 | 25min | 3 tasks | 3 files |
| Phase 09 P07 | 65min | 3 tasks | 4 files |
| Phase 08 P06 | 65min | 3 tasks | 3 files |
| Phase 09 P08 | 45min | 3 tasks | 5 files |
| Phase 10 P07 | 35min | 2 tasks | 1 files |
| Phase 10 P08 | 55min | 2 tasks | 1 files |
| Phase 10 P09 | 75min | 2 tasks | 1 files |
| Phase 10 P10 | 95min | 3 tasks | 1 files |
| Phase 11 P01 | 30min | 3 tasks | 2 files |
| Phase 11 P02 | 20min | 2 tasks | 1 files |
| Phase 11 P03 | 30min | 2 tasks | 1 files |
| Phase 11 P04 | 20min | 1 tasks | 1 files |
| Phase 11 P05 | 20min | 1 tasks | 2 files |
| Phase 12 P01 | 20min | 2 tasks | 1 files |
| Phase 12 P02 | 21min | 2 tasks | 1 files |
| Phase 12 P03 | 20min | 1 tasks | 1 files |
| Phase 12 P04 | 35min | 1 tasks | 1 files |
| Phase 12 P05 | 35min | 3 tasks | 2 files |
| Phase 12.1 P01 | 35min | 2 tasks | 1 files |
| Phase 12.1 P02 | 55min | 2 tasks | 1 files |
| Phase 12.1 P03 | 35min | 2 tasks | 1 files |
| Phase 12.1 P04 | 70min | 3 tasks | 9 files |
| Phase 13 P01 | 35min | 2 tasks | 3 files |

## Accumulated Context

### Decisions

Full log in PROJECT.md Key Decisions. Recent decisions affecting current work:

- [Scoping]: TY2025, stdio → Claude Code/Desktop, maximal taxpayer profile (65+, brokerage
  sales, dependents, itemizes). Remote transport is an explicit v2 milestone.

- [Scoping]: Entry point is a distinct export typed `(args) => Effect<CasOp, T>`, not
  `main` — answers open question 6, puts the whitelist in the type.

- [Research/OQ5]: The **tool handler** writes result + run record to CAS; the guest
  whitelist stays read-only. `casWrite`/`evoAdd` are never in it.

- [Research/OQ2]: Subjects are content-derived — artifact chain rooted at the cBase32 hash
  of the original artifact; each extracted form instance keyed on
  `(payerTin, recipientTin, accountNumber, taxYear, formType)`.

- [Research/OQ3]: The OCR artifact is stored, not transient.
- [Roadmap]: `todo/plan.md`'s Weeks 1–5 are milestones; phases are sliced under them.
  Week 0 (corrections + integration smoke test) is added in front.

- [PR #17, Sergey]: **Money in a stored JSON document is a `string`, never a JSON number.**
  Now an absolute rule in AGENTS.md, covering documents, tax-year parameters, intermediates
  and reports. Rationale: a JSON number is an IEEE 754 double by the time `media/json`'s
  `Unknown` sees it. The rtti field is `string`; exactness is enforced in the semantic
  check, mirroring how `vnd.fjs.revision` types `hash` as `string` and defers to `isHash`.
  Note the tokenizer is *not* the lossy layer — `NumberToken` carries an exact `BigFloat`
  mantissa/exponent; precision dies one layer up.

- [PR #17, Sergey]: The exact-decimal module is now `todo/plan.md` **Week 1 step 6**
  (bigint-backed minor units, rates as explicit numerator/denominator pairs), gating the
  document base at step 5. OCR renumbered 6→7, ingestion 7→8. This matches ROADMAP Phase 4
  gating Phase 5 — convergent, no new phase and no schedule change.

- [Phase 04-02]: decimal module kept fully generic (scale as parameter, zero finance-specific content) so it is liftable into FunctionalScript unchanged
- [Phase 04-02]: parse refuses over-precision and non-numeric input via assert, never rounds/truncates/coerces
- [Phase 04-02]: no Money/Cents wrapper type: cents are exactly what centsFromString returns, a plain bigint with no construction path that could round

- [Phase 05-01]: `base` is generic (`<D extends string>`) so the dialect **literal** survives into
  the derived type. The non-generic `(dialect: string)` form let a deliberately wrong literal pass
  `tsc` — without the generic form, criterion 1's structural rejection is unprovable.

- [Phase 05-02]: `corrected: option(true)` mirrors revision's `archived`. A `corrected: false` blob
  is rejected structurally; absence is the only way to say "not corrected". One representation.

- [Phase 05-03]: comma degrouping lives in `fjs/document/ocr_amount`, one step OUTSIDE
  `fjs/types/decimal`, which keeps refusing `"1,234.56"`. That module is generic and staged for
  upstreaming; comma grouping is a US printed-form presentation convention. Teaching the generic
  parser about it would ship a locale convention upstream.

- [Phase 05-03]: identity fields come from the caller's `meta`, never re-parsed from `ocr.fields`.
  Deriving a TIN or tax year from unstructured OCR text is inference; this phase stores and reads.

- [Phase 05-05, user-directed]: W-2 box 12 is a list of `(code, amount)` pairs, never four slot
  fields — the slot carries no meaning, the code does, and a code can legitimately repeat.
  Boxes 15-20 are a repeating array stored faithfully and never computed on; the "never computed
  on" half is a live constraint on every phase that computes, enforceable only there.

- [Phase 05-05, user-directed]: `vnd.fjs.medical_expenses` is taxpayer-asserted, not transcribed
  — no IRS form reports out-of-pocket medical spend. It therefore has NO `formRevision`, and
  DOC-10's text was narrowed to "every dialect that transcribes a printed IRS form" rather than
  the requirement being silently violated. No stored total, no 7.5% floor: both need an AGI the
  document cannot see.

- [Phase 06-01]: `CasOp` is OURS, not fjs's. The roadmap and REQUIREMENTS both write
  `Effect<CasOp, T>` as though it were upstream; it is not. fjs has `FileCasOperation`, which
  contains `WriteBytes`/`Rename`/`Rm` — handing it to a guest hands it the store.

- [Phase 06-01]: the entry point is `report`, curried `ctx => args => Effect<CasOp, T>`. EXEC-07's
  `(args) => …` and criterion 2's "injected ctx, zero imports" reconcile only if ctx is a
  parameter — a CAS blob cannot resolve bare specifiers.

- [Phase 06-01]: a negative TYPE property is asserted as a conditional type inside the passing
  build, never as a negative-compile harness. Verified by widening `CasOp` to include `Fetch`:
  TS2322 at the assertion, plus TS2741 on the host map. No second tsconfig, no `@ts-nocheck`.

- [Phase 06-02]: an ORDERING guarantee is proven by observing the side effect the ordering
  prevents, never by which error message came back. See the blocker note below.

- [Phase 07-01]: guestCtx widened with step/pure/centsFromString/centsToString per 07-CONTEXT.md Decision 1; CasOp and casOpNames stay byte-for-byte unchanged — The widening is additive to ctx only, never to the operation vocabulary match dispatches on; step/pure are pure data composition and never become a command.
- [Phase 07-01]: vocabularyIsFrozenAtFour split into three independently falsifiable assertion groups instead of one collapsed equality — A single Object.keys(guestCtx) === casOpNames check would fail forever once ctx grew; the fix keeps casOpNames.join(',') a live, unchanged equality (a fifth command name still fails it) while separately asserting per-name presence and per-combinator typeof.
- [Phase 07]: vnd.fjs.run's status is exactly or('ok','error'), mirroring Result's two arms, per 07-CONTEXT.md
- [Phase 07]: inputs[].payload modelled as array(string) since every frozen CasOp command takes a single string argument
- [Phase 07]: finance_schema's dialectSchemas map is typed as an open string-keyed map ({ readonly [dialect: string]: Type }), not the narrower literal-key type TS infers from computed properties — indexing the inferred/unknown-cast lookup by a request-supplied string produced TS's lossy '{} | null' type, which toJsonSchema rejects
- [Phase 07]: sizeGuard measures byte length via tryUtf8 + bit_vec length/8 (matching writeResponse's own byte-cap measurement), never content.length
- [Phase 07]: Ordering proof asserts absence of raw oversized content in stdout, not just presence of the too-large message (SEC-02-before-import_ lesson)
- [Phase 07-05]: evoList's guest argument is 'true' selects archived, else active (mirroring Evo.list default)
- [Phase 07-05]: buildRunSnapshot resolves every hash cas.list() returns (whole-store), not a narrower reachability subset
- [Phase 07-06]: loadProgram is called with the bare programFileName(hash), not the full materialize path — matches fjs/guest/materialize's documented virtual-harness limitation; production wiring is Plan 09's follow-up
- [Phase 07-06]: executeRun/fjsRunTool typed against concrete FileCasOperation, not a generic <O extends Operation> — curried generics resolve O at the first application; the plan's curry order puts a non-O parameter first, which empirically defeats inference
- [Phase 07-07]: Session survival for EXEC-12 is proven via a second fjsRunTool.handle call against the SAME threaded virtual State, not a full financeMcpServer session -- fjsRunTool is not yet wired into that server (Plan 09's follow-up)
- [Phase 07-07]: missingHashBecomesErrorResult uses a syntactically valid but unwritten cBase32 hash, distinct from 07-06's own malformed-hash proof, to exercise the genuine CAS-miss branch rather than duplicate the null-hashVec short-circuit
- [Phase 07]: 07-08: Flat registry concatenation — financeSchemaTool/fjsRunTool unify into financeMcpHandlers's operation union with zero casts — Confirms the plan's own expectation that the two tools' operation types unify cleanly; no widened signature beyond fjsRunTool's own declared Mkdir|WriteFile|Import
- [Phase 07]: 07-08: weekOneConvergence seeds all three 1099-INT revisions before building the Evo cache — Opposite ordering from casRefresh's own proof (which builds the cache before its seed to demonstrate invisibility) — this proof's goal is an ordinary already-populated store, not the refresh-lever scenario
- [Phase 07]: 07-08: Verified the absent-vs-coerced-to-zero distinction is load-bearing — Temporarily forced centsFromString(undefined) by removing the skip check, confirmed the leaf fails with isError:true, then reverted — proves the leaf checks skip logic, not merely the final sum
- [Phase 07-09]: Fixed fjs_run's real working-directory gap at the test-harness spawn level (cwd = materializeHome(home)), not in executeRun, to avoid breaking every existing virtual proof of executeRun/fjsRunTool
- [Phase 07-09]: Seeded CAS content through the real cas_add MCP tool over the live session rather than a separate CLI subprocess; cas_add auto-syncs recognized vnd.fjs.revision blobs into the live Evo cache
- [Phase 08-01]: Standard deduction cites Rev. Proc. 2025-32 §3.01 (OBBBA revision); aged/blind additional, dependent cap, ordinary brackets, and capital-gains breakpoints cite Rev. Proc. 2024-40 alone, unmodified
- [Phase 08-01]: ratePercent stored as a plain number, not a decimal string — it is a rate, not a dollar amount crossing the money boundary
- [Phase 08]: generateRow rounds to the nearest whole dollar (Publication 1040's own printing convention), not nearest cent, before re-expressing in cents — The plan's literal formula would round at cents precision, reproducing $1,802.50 instead of the required $1,803.00 for the MFJ $18,000 row -- verified by hand against all ten transcribed rows before trusting it
- [Phase 08]: T-08-01 mutation-verified: breaking the MFJ first bracket's rate (10 -> 11) turns the row-by-row diff red — Confirms the diff's expected side (hand-transcribed Pub. 1040 literals) is independent of the generator, not a tautology; reverted cleanly with an empty git status
- [Phase ?]: TAX-04 boundary proofs are generated data-driven over a 42-entry threshold inventory (allThresholds), never hand-written per-threshold, via a generic segmentIndex counter sharing no code path with the Tax Table's own tax-computation functions
- [Phase 08-04]: taxParamsByYear[2025] narrowed exactly once at module scope via assert; both the tool's taxParamsResponses map and the year2025Resolves proof leaf read from the single exported response2025 constant — Never a non-null assertion or cast; keeps the response as the single source of truth for both the handler and its proof. **Correction (Phase 09):** an earlier version of this line attributed the no-cast rule to AGENTS.md. It is NOT in AGENTS.md — that file mentions `@type` only to prefer `@import` over inline `@type {import(...)}`. The rule is a standing engineering directive for this work and it stands on its own merits (a cast over an indexed access discards the `| undefined` that `noUncheckedIndexedAccess` exists to compute), but citing AGENTS.md for it sends the next reader hunting for text that is not there
- [Phase 08-04]: Registry entry and fjs-run-integration.test.js call landed in one commit — 08-VALIDATION.md's ordering note: that test derives advertised/called tool sets from a live tools/list response at runtime, so a registry-only commit breaks npm test immediately
- [Phase 09]: [Phase 09-01]: ReportLine.sources is a non-empty TUPLE type, never a plain array — sources: [] also fails tsc, satisfying PROV-02's plural 'tuples' at the type level
- [Phase 09]: [Phase 09-01]: Extends<A, B> is defined locally in fjs/report/line/module.f.js, not reused from fjs/guest/module.f.js — that module's assertion tests exact union equality via Equal alone; this module's PROV-01 assertion tests structural assignability, which needs the tuple-wrapped [A] extends [B] conditional
- [Phase 09]: countNumericLiterals is REPORTED, never refused - always returns a plain number, never a Result, never throws on a program's own account
- [Phase 09]: A numeric literal inside a template literal's ${...} expression is undercounted (accepted risk) - harmless because this audit is reported-only, not the anti-hardcoding kill condition
- [Phase 09]: Each honesty case (identifier/string/template/comment/adversary) is its own proof leaf, never one aggregate assertion
- [Phase 09-03]: Zero-read gate implemented identically in executeRun and its test-mirror runExecuteRunViaFixture, computed at the point sourceText/source is already in hand
- [Phase 09-03]: vnd.fjs.run gained no new fields; readCount/literalCount are envelope-only fields in fjs_run's response, derived from data that already exists
- [Phase 09-04]: [Phase 09-04] Running the SAME JsModule fixture twice against evolving CAS state needs a second, functionally-identical program hash: runExecuteRunViaFixture always performs a real materialize write, which collides with the prior run's already-swapped-in JsModule function at the SAME path
- [Phase 09-04]: [Phase 09-04] The adversary () => pure({ line16: 9137 }) is stored VERBATIM as the perturbation gate's control fixture, proven to fail and to fail identically whether or not the document changes
- [Phase 09-05]: classifyRunOutcome extracted as one exported function (literalCount => (value, reads) => RunOutcome); executeRun and runExecuteRunViaFixture both call it — mutating it to reads.length === -1 turns antiHardcodingGate/zeroReadGate proofs RED (pass 256, fail 2), closing 09-VERIFICATION.md's BLOCKER
- [Phase 09-06]: classifyRunOutcome and RunOutcome moved to fjs/report/guard/module.f.js, joining line and audit as the three PROV-07 mechanisms fjs/report/ now holds together — the rule's only type dependency (Read from fjs/exec) had nothing to do with fjs_run's own CAS/MCP/orchestration concerns; mutation from the new home re-proved the antiHardcodingGate/zeroReadGate/integration-test binding survived the move
- [Phase 09-07]: E2's decisive pin-through-the-shipped-tool proof lives in fjs-run-integration.test.js, not the virtual proof file — fjsRunTool.handle cannot reach an 'ok' RunOutcome under fjs/effects/node/virtual in one call (the write/import representational split), so only a real separate process can exercise the shipped executeRun(...) call with subject+parents end to end
- [Phase 09-07]: E12's proof constructs a synthetic RunOutcome with a non-empty error-arm reads array rather than reproducing a real mid-chain refusal — no current production path retains reads on refusal (fjs/exec discards them), but handleRunOutcome's own contract to persist whatever reads it is given is independent of that fact
- [Phase 08]: Closed 9 mutation-sweep coverage gaps in fjs/tax/params, fjs/tax/table, and fjs/types/rational (08-06); all figures confirmed correct against Rev. Proc. 2024-40, no stored values changed
- [Phase 09-08]: Per-box exactness proofs generated from moneyBoxFields/stateLocalMoneyFields themselves (so a box added later is auto-covered), paired with an independently hand-typed expected count (so a box removed is still caught) -- mirrors fjs/tax/boundary's allThresholds/expectedThresholdCount idiom
- [Phase 09-08]: interpret's step-budget boundary measured empirically before writing the proof: chainOfLength(stepBudget-1) completes, chainOfLength(stepBudget) is refused, because completing it needs one more loop iteration than the budget allows to notice the chain went Pure
- [Phase 10]: 10-07: the modeled/unmodeled partition is a tsc property — Assert<Equal<Kind, ModeledKind | UnmodeledKind>>, so a declared kind classified nowhere fails to compile — verified by adding a 51st kind and by deleting a refusal entry; both stop at TS2344 on that assertion
- [Phase 10]: 10-07: scopeRefusal returns ScopeError, not the ScopeOutcome union — Plan 10-08 spreads it into its own error arm; the union would force a cast or a non-null assertion, both banned
- [Phase 10]: 10-08: Line16Outcome carries `method` on BOTH arms, and `tsc` enforces it (TS2322 when the tag is dropped) — the Schedule D branch refuses rather than computes, so without a tag on the error arm TAX-03's "a proof per branch" would be unprovable for one of its four branches
- [Phase 10]: 10-08: Line16Error is `ScopeError & { method }`, an intersection with fjs/return/scope's own refusal type rather than a re-spelled object literal, so a second declaration of "what a refusal is" cannot appear beside the one place it is built
- [Phase 10]: 10-08: level 2's three QDCGT bullets stay THREE separate `if` blocks sharing one closure — fusing them into one disjunction makes the dispatch-order mutation unrunnable, because 2e cannot be moved past 2a without reddening the very leaf that documents the swap's invisibility
- [Phase 10]: 10-09: sumBoxOverDocuments returns a BoxSum intermediate, not a ReportLine — line 2b must add two box sums before a line exists, and a box read over zero documents has no source, so PROV-01 forbids it being a line at all
- [Phase 10]: 10-09: the filing status is recovered by finding it in individualFilingStatuses rather than by a type predicate — a @type-annotated predicate over .includes is rejected by tsc (TS2322), and find returns the STORED member rather than the blob's string
- [Phase 10]: 10-09: line 12e cites filingStatus plus one box per checked 12d checkbox, exactly as planned; 12a-12c and earnedIncome determine the value but are cited only at document granularity — flagged for the phase owner, not widened, because 10-10 may pin the counts
- [Phase 10]: 10-10: Form1040Outcome's error arm declares readonly lines?: undefined — omitting the field does NOT make adding it a tsc error, because TypeScript's excess-property check against a union admits any property declared in any constituent
- [Phase 10]: 10-10: line 22's zero floor lives in its own named function: lines 19/20 are always profile-declared zeros in Phase 10, so the floor is unreachable through a whole report and would otherwise be an equivalent mutant
- [Phase 11-01]: 1099-R modeled against the fuller TY2026 box set (strict superset of TY2025); box 7c/7d and the 8a/8b split are documented as 2026-only, option-typed additions, harmless on a TY2025 document
- [Phase 11-01]: SSA-1099's payerTin is always stored as '' (no printed payer TIN exists) and accountNumber maps to Box 8's Claim Number; both proven by a round-trip leaf, not just documented
- [Phase 11-01]: Mutation Gate M2 confirmed: removing one entry from moneyBoxFields while leaving expectedMoneyBoxFieldCount unchanged is the correct mutation shape -- schema-generated coverage leaves cannot detect a removal on their own
- [Phase 11-02]: buildRunSnapshot's withBlobsAndRevisions/withHeads now exclude archived-flagged revisions from heads/revisions, closing the guest-vocabulary path (evoList('true') -> evoHead -> evoRevision -> casRead) to a retracted document; blobs and buildHostMap stay untouched (the honest, documented boundary)
- [Phase 11-02]: Mutation Gate M1 confirmed load-bearing: reverting the two filtering conditions reddens archivedRevisionUnreachable.adversarialAndControl with the predicted failure (archived hash resurfacing in heads); restored verbatim, suite green, git status clean
- [Phase 11]: MCP-08: one row per (subject, head) pair, not one per subject -- concurrent heads yield multiple rows sharing a subject
- [Phase 11]: MCP-08: 'unknown' is the sentinel dialect for a well-formed document with no dialect field (arbitrary, recorded pick per RESEARCH.md A2)
- [Phase 11]: MCP-08: finance_documents_list never validates against finance_schema's dialect registry -- an unregistered dialect tag is listed verbatim
- [Phase 11-04]: expectedKnownDialectCount bumped 5 -> 7 in one commit registering both vnd.fjs.1099r and vnd.fjs.ssa1099 together (both dialect modules already existed from Plan 11-01); guard verified load-bearing by mutating to 6 and watching everyRegisteredDialectIsCounted fail with [7, 6, ...], then restored
- [Phase 11-05]: financeDocumentsListTool inserted between financeTaxParamsTool and fjsRunTool in financeMcpHandlers, reusing the same evo/fileCas expressions the surrounding lines already construct
- [Phase 11-05]: Same-commit ordering constraint (finance_documents_list registry entry + integration test call) verified live by mutation: commenting out only the call/assert block reddened toolsCalled/advertisedTools with the predicted diff, then restored byte-identical
- [Phase 12]: vnd.fjs.1099div: sourceArtifactHash required (not option), validated via isHash, kept off the shared base() helper
- [Phase 12]: DOC-06 shape proof uses a JSDoc @import type-only reference to QdcgtInput plus a runtime assertEq -- no runtime import of the QDCGT worksheet, dispatch, scope, or form1040 aggregation
- [Phase 12]: Boxes 8-11 (profit-or-loss) reuse the shared negative-accepting moneyFieldError loop rather than a separate check
- [Phase 12]: applicableCheckboxOnForm8949 stores the payer-printed A-F letter verbatim, never derived from boxes 2/5/12 (Phase 12.1's job)
- [Phase 12-03]: No checkReferences cross-field rule links the four new foreign-account fields to each other or to declaredKinds -- Schedule B (Plan 12-04) decides what to do with the combination
- [Phase 12-04]: Schedule B's $1,500 threshold is two INDEPENDENT strict comparisons, never a combined line4+line6 sum
- [Phase 12-04]: Schedule B Part III foreign-account fields are read verbatim from vnd.fjs.return_profile, proven with zero stored 1099s so the read cannot be mistaken for document-derived inference
- [Phase 12]: DOC-13's provenance proof lives in a new proof-only module (fjs/document/consolidated_provenance/module.f.js), not inside either dialect's own file, since the property spans both dialects plus formSubject
- [Phase 12]: expectedKnownDialectCount bumped directly 7 -> 9 in one commit (both new dialects registered together), mirroring Phase 11's 11-04 precedent
- [Phase 12.1-01]: Form 8949's category-derivation refusal check order is fixed and documented (box1f/box1g, then absent-basis, then undecided category) so Mutation Gate M1 has an unambiguous target line
- [Phase 12.1-01]: TAX-11/TAX-15 are NOT marked complete after this plan, despite being named in its frontmatter -- the requirement spans all four plans of Phase 12.1 and REQUIREMENTS.md has no partial-completion representation. Deferred to 12.1-04.
- [Phase 12.1-02]: SDTW lines 22/32's printed skip instructions are left unimplemented as special cases -- surrounding mins/floors already make the shortcut and straight-through arithmetic agree, mirroring qdcgt's own precedent; neither worked example directly observes this, flagged for a future mutation sweep
- [Phase 12.1-02]: SDTW lines 35-40/41-43 are explicitly gated to 0n when their controlling Schedule D line (19/18) is zero, rather than relying on natural arithmetic -- necessary because line 42 carries no printed floor and would otherwise leak a spurious 28% charge
- [Phase 12.1-02]: the split-dispatch fixture (method44 !== method46) and the degenerate-equivalence fixture (sdtw.line47 === qdcgt.line25) share one underlying input rather than two separate constructions
- [Phase 12.1-03]: Schedule D's line-21 loss cap built as a three-way branch (gain/zero/capped-loss) rather than a pass-through of line16, per CONTEXT.md Decision 1.5 -- Form 1040 line 7a is wrong on every net-loss year without the $3,000/$1,500 MFS cap
- [Phase 12.1-03]: Mutation Gate M2's short/long-term equivalent-mutant trap defeated by asserting Schedule D lines 7 and 15 separately -- swapping short-term/long-term categorization leaves line16's total unchanged ($400,000 net gain both before and after), so a total-only proof cannot see the swap
- [Phase 12.1-03]: TAX-11 is NOT marked complete after this plan, despite being named in its frontmatter -- the requirement spans all four plans of Phase 12.1. Deferred to 12.1-04.
- [Phase ?]: [Phase 12.1-04]: Task order REVERSED (1040 wiring first, scope reclassification last) as a git-history atomicity guarantee -- the six kinds stay refused throughout Task 1 so the new line3a/3b/7a/dispatch code is unreachable-or-correct, and Task 2's single commit is the only atomic transition point
- [Phase ?]: [Phase 12.1-04]: filingScheduleD derives verbatim from declaredKinds.includes('capitalGainsOrLosses'), never document presence (Decision 1.6) -- status is now computed once near the top of form1040IncomeLines since Schedule D's loss-cap threshold needs it too
- [Phase ?]: [Phase 12.1-04]: Mutation Gate M4's literal instruction (remove one modeledKinds entry, leave the count) does not compile -- it trips _EveryKindIsEitherModeledOrRefused (TS2344), a stronger correctly-caught defect. Ran the semantically-equivalent compiling form instead: migrate the kind into unmodeledKindRefusals without updating expectedModeledKindCount
- [Phase ?]: [Phase 12.1-04]: TAX-11 and TAX-15 marked complete -- this plan is where Form 8949/Schedule D/the Schedule D Tax Worksheet actually get wired into a computing Form 1040, closing both requirements that spanned all four plans of Phase 12.1
- [Phase 13]: 13-01: Citation widening pulled forward from Slice 2 into this plan, since socialSecurityBenefitsWorksheetBaseAmounts needed the 'code' arm immediately
- [Phase 13]: 13-01: MFS-lived-with-spouse SSB worksheet branch computes line16 as 85% of line7 (not line1 as the plan text said), corrected against 13-RESEARCH.md's verified transcription
- [Phase 13]: 13-01: TAX-10 NOT marked complete -- this plan builds Slice 1's foundation only; wiring into Form 1040 is Plan 13-02's job

### Pending Todos

None yet.

### Blockers/Concerns

- **RESOLVED (Phase 1): the AGENTS.md / roadmap money contradiction.** Corrected as DOCC-07.
  Storage boundary is now a decimal string in both REQUIREMENTS.md and ROADMAP.md;
  rationals-in-computation and strings-on-the-MCP-wire verified unchanged.

- **RESOLVED: what moves HEAD.** Not a daemon and not corruption — **a second author works
  in this same checkout**. `feature/link-issue-16` appeared mid-session and became PR #19.
  Still a live hazard for uncommitted edits: commit early, keep multi-step git in one atomic
  invocation, and re-verify `git branch --show-current` at the start of every command block.
  The guard has caught it every time; nothing has been lost.

- **RESOLVED upstream: the prototype-dispatch escape is closed in fjs 0.41.0.** `match` now does
  `at(command)(map)` + `assert(handler !== null, command)`; `at` is `getOwnPropertyDescriptor`-based,
  so inherited names never resolve. Verified by execution against the installed 0.41.0, not assumed:
  `casRead` dispatches; `fetch`, `constructor`, `toString`, `valueOf` and `__defineGetter__` are all
  refused; re-running the 0.40.0 escape leaves the whitelist unpolluted with no getter installed.
  The real fix was Sergey's functionalscript#1419. The issue filed from this branch, #1420, was a
  duplicate and is closed.

- **The ergonomics half SURVIVES and is still ours (EXEC-03).** `assert` throws the **bare command
  string**, not an `Error` — `typeof e === 'string'`, `e instanceof Error === false`, `e.message`
  `undefined`. A refusal handler must use the caught value directly; an `instanceof Error` branch
  misses every refusal. 0.41.0 knows the command name but nothing of the permitted set.

- **Phase 3 is smaller than planned.** EXEC-02 is delivered upstream. What remains is EXEC-01
  (`interpret`), EXEC-03 (actionable refusal naming the permitted set), EXEC-04 (regression proofs —
  now pinning behaviour we depend on rather than hoping for it), EXEC-05 (observed read set), and
  EXEC-06 (step budget).

- **The `functionalscript` submodule is initialized in the MAIN checkout but not in this
  worktree**, and that changes the test count: `npm test` reports **118** here and **2295** on
  main (2177 of them upstream's own, all passing). Neither number is wrong; know which tree you
  are measuring before comparing runs. `tsconfig.json` excludes the submodule either way.

- **Leftover remote branches, not ours to delete.** `origin/wtf` and
  `origin/revert-14-feature/planning-requirements-roadmap` are Sergey's and each carry one
  commit not in main. `origin/ok` is fully merged (0 unmerged) and is safe to drop.
  `origin/feature/planning-requirements-roadmap` holds one superseded WIP commit
  ("paused at 8/15 — Phase 1 not started") — obsolete, but deleting unmerged work is the
  user's call.

- **RESOLVED (Phase 2): the protocol-version pin works.** A real `claude -p` client issued an
  actual `tools/call` (`mcp__finance-mcp__evo_list` -> non-error `tool_result`) against the
  registered server, so the documented silent-failure mode did not occur and `2026-07-28` stays a
  recorded fallback rather than a needed change. The underlying gap remains real and is filed in
  `fjs/todo/upstream-mcp-protocol-version-negotiation.md`.

- **NEW: `node --test <source-file>` reports a FAKE PASS.** Emergent Testing only registers when
  root `all.test.js` is imported. Verified by injecting a proof leaf that throws: `npm test` gave
  `tests 8, pass 7, fail 1`; `node --test fjs/server/module.f.js` gave `tests 1, pass 1, fail 0` on
  the identical file. AGENTS.md line 51 said the opposite and is corrected. **Only ever trust
  `npm test` / `node --test all.test.js`.**

- **NEW (Phase 6): a "which error message" assertion cannot prove an ORDERING.** SEC-02's gate
  must run before `import_`, and the first proof asserted that a dirty source returned a specifier
  message rather than an import error. Both orderings return that message when the module loads,
  so moving the gate after `import_` left the suite green at 134 pass. Only observing whether the
  module BODY was evaluated distinguishes them — which is also the actual security property,
  since `import()` runs the body immediately with full Node privileges. A `JsModule` fixture under
  `virtual` recording its own invocation is the mechanism; pair it with a control leaf so the
  assertion is about the gate and not about a spy that never fires.

- **NEW (Phase 5): a mutation that fails to COMPILE proves nothing.** `npm test` is
  `tsc && node --test`, so `allowUnreachableCode: false` rejected an `if (false)` mutation
  before a single test ran. Mutations must be rewritten into forms that typecheck but never
  fire, or the run is measuring the compiler rather than the suite.

- **NEW (Phase 5): `exactOptionalPropertyTypes` does NOT catch a spread carrying `undefined`.**
  Mutating `convert` to `...{ corrected: meta.corrected }` (where `meta.corrected` is
  `true | undefined`) passed `npx tsc --noEmit` cleanly and was caught only by a runtime proof —
  the key was present holding `undefined`, which `'corrected' in result` sees. Every `option(...)`
  field in every future dialect conversion depends on the conditional-spread discipline
  (`...(x === undefined ? {} : { k: x })`), and **the compiler will not tell you when it slips.**
  DOC-11's absent-vs-zero rule rests on this.

- **RESOLVED: PR #20 merged** (2026-08-04, merge commit `2c4eb2e`) — 41 commits, +10386/-131,
  Phases 1-5. Merged unreviewed at the user's explicit direction after a long wait for review.
  Its title said "Phases 1-2" while carrying five phases; corrected before merging.

- **RESOLVED: the `finance-mcp` registration** now points at the main checkout
  (`/Volumes/.../sergey-shandar/finance`), re-registered post-merge and verified Connected.

- **Superseded (Phase 2): fjs's `mcpStep` does not negotiate the protocol version.** The
  `initialize` handler validates the client's params then discards the client's
  `protocolVersion`, returning the configured string unconditionally
  (`fjs/protocol/mcp/module.f.js`). `McpConfig.protocolVersion` is an unvalidated `string`.
  Whatever we pin is what every client is told. Decision: pin `2025-11-25` per MCP-03 and
  settle it with the roadmap's budgeted empirical check against a real client, escalating
  only if that fails. Note `2026-07-28` is now the current spec revision. This is an
  upstream gap AGENTS.md requires reporting rather than silently working around.

- **Scope vs schedule (open, deliberate).** The selected taxpayer profile makes v1 roughly
  4–5× research's recommended scope. The five-week plan realistically delivers Phases 1–10.
  Phase 14 (acceptance against the filed return) is gated on Phases 11–13 and cannot pass
  without them. Cut line documented in ROADMAP.md "Scope Honesty and the Cut Line".

- **Open question 4 unanswered** — is an external date driving the five weeks? Decides
  whether Phases 11–13 are compressed (they must not be) or the schedule extends.

- **Accepted, not solved:** `import()` runs a blob's module body with full Node privileges;
  Node's permission model has no network permission, so exfiltration is unmitigated
  in-process. See REQUIREMENTS.md "Accepted Risks".

- **Research required before planning** Phases 8, 10, 11, 12, 13, 15 — Tax Table band
  widths, QDCGT and Schedule D Tax Worksheets, 1099-R/SSA-1099 box lists, MAGI add-back
  lists, Schedule 1-A mechanics, child-process isolation.

- **RESOLVED (07-10):** the prior note here ("production's real `claude mcp add` registration does
  not set the working directory `fjs_run` needs") was a misdiagnosis of the actual root cause.
  `executeRun` (`fjs/server/fjs_run/module.f.js`) wrote the materialized program to
  `programPath(materializeHome(home))(hash)` but imported it via the BARE hash-derived filename —
  a real Node `import()` of a bare specifier resolves against `process.cwd()`, not `home`, so the
  import missed the file `materializeProgram` had just written. The fix composes the import path
  from the SAME `materializeHome`/`programPath` expressions the write uses, so the two paths can
  never drift apart again. The launcher needs NO special working directory: proven by
  `fjs-run-integration.test.js`, which now spawns the real server from an ordinary working
  directory (the `cwd: materializeHome(home)` workaround has been removed) and still passes. See
  `07-10-FIX-SUMMARY.md` for the full account, including why 185 virtual proofs never caught this
  (they keyed their `JsModule` fixtures at the same bare name the buggy code asked for).

- **RESOLVED (resume, 2026-08-05): the two Phase 7 branches were never divergent.**
  The pause-work handoff flagged a blocking human merge decision between
  `feature/phase-7-exec` (this worktree) and `feature/phase-7-fjs-run-and-run-records`
  (where a second Claude session was committing). Measured on resume:
  `git rev-list --count feature/phase-7-fjs-run-and-run-records ^feature/phase-7-exec` = **0**,
  and the same count against `origin/feature/phase-7-fjs-run-and-run-records` and `origin/main`
  is also **0**. `feature/phase-7-exec` is a strict superset — 22 commits ahead of the other
  branch, 90 ahead of `develop`. Nothing to reconcile; any merge is a fast-forward. The branch
  is **not yet pushed** to origin, which is the only remaining action.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-08-11T01:38:30.768Z
Stopped at: **Phase 12.1 (The Capital-Gain Chain) COMPLETE — 4/4 plans, 4/4 summaries.** A
brokerage sale now flows 1099-B → Form 8949 → Schedule D → the Schedule D Tax Worksheet → Form
1040 line 16. TAX-11 and TAX-15 marked complete. Nothing is mid-edit.

> **An automated state write clobbered this block on 2026-08-09** (`stopped_at` replaced with
> "context exhaustion at 75%", the continuity text truncated mid-sentence into a dangling
> fragment, and the quoted metrics left two waves stale at `555f11c`/629 proofs). Restored here
> from measurement. Its one *correct* edit was kept: `percent: 100 → 68`, which is 13/19 phases —
> the plan-based figure is unusable (`completed_plans` 65 exceeds `total_plans` 62; see
> `percent_note`).

Measure the suite rather than quoting it — see "Test metrics" above. Measured on `d111258`:
`tsc` clean, **663** project-local proofs (629 → 663 across Phase 12.1), 0 failures.

**Branch `feature/phase-12.1-capital-gain-chain` is 22 commits ahead of `origin/main` and
UNPUSHED.** No PR opened yet. `main` and `develop` are both still at `555f11c`.

Also landed this session, outside the phase:

- **`REQUIREMENTS.md` coverage table reconciled** — 28 rows said `Pending` for requirements whose
  checkbox already said `[x]`, drift reaching back to Phase 3. Now 72 complete / 21 pending / 93
  total, and the header's stale "79 requirements" corrected to 93. Phase 17 owns turning the
  recompute command into an actual gate.

- **Audit finding F-01 closed** — the 2025 Form 1040 face was fetched and its 56 printed money
  lines enumerated against `orderedLines`: exact match. This item had been `human_needed` since
  Phase 10 on the grounds that "the verifier has no access to the IRS PDF", which is no longer
  true. **F-02 (Standard Deduction Chart) is closable the same way.** F-03 (assumption A2) is
  NOT — it asks for confirmation against a real filed return, which no public PDF supplies.

**Known gap: Phase 12.1 has no `12.1-VERIFICATION.md`.** Every phase 01-12 has one. Execute-phase
ran with `--no-transition` and stopped after the final wave, so the phase is implemented and
self-verified by its own plans but never independently verified against its goal.

**Why the recorded HEAD drifted, and the general lesson:** the three handoff files each named
`694d580` — the tip at the moment their text was written — while the commit that merged that very
text moved the tip to `555f11c`. A handoff that states its own HEAD is always one commit stale by
construction. Corrected at this resume; do not treat a recorded SHA as authoritative when
`git rev-parse HEAD` is one command away.

Next: **Phase 12.1 — The Capital-Gain Chain**, which has no directory, no CONTEXT, no research and
no plans. Read its BLOCKING constraint before planning it (below).

Resume file: None
plus `.planning/HANDOFF.json`. The stale `.continue-here.md` files in phases 09 and 10 were deleted
during this pause — they were one-shot artifacts from earlier sessions and would have misdirected a
resuming agent.

**The one constraint that gates Phase 12.1:** the dividend scope reclassification
(`fjs/return/scope`) and the Form 1040 lines-3a/3b wiring (`fjs/form1040/core`, which today sets
them to `declaredZero` and hardcodes `qualifiedDividendsCents: 0n`) must land as **one atomic
change**. Doing either half alone makes the engine report a confident **zero** for dividend income
where it currently refuses honestly — strictly worse than the refusal, and the exact failure TAX-16
exists to prevent.

**Approved autonomous run** (phase owner, 2026-08-07): 12.1 → 13 → 15 → 16 → 17 → 18, with **14
skipped** — Acceptance needs the taxpayer's real filed return and real documents, and is marked
NOT AUTONOMOUS-EXECUTABLE in ROADMAP.md itself.
