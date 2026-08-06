---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: milestone
status: ready_for_09-08
stopped_at: Completed 09-07-PLAN.md (gap closure — 7 mutation-sweep gaps closed, all verified RED before this plan and reverted after); 09-08 not started
last_updated: "2026-08-06T03:54:39.805Z"
last_activity: 2026-08-06
progress:
  total_phases: 15
  completed_phases: 8
  total_plans: 38
  completed_plans: 39
  percent: 53
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-03)

**Core value:** The report is a program, not an answer — the agent emits FunctionalScript;
the server executes it as a pure function of `(documents, tax-year parameters) → report`.
**Current focus:** Phase 9 — Traceable Report Lines and the Anti-Hardcoding Gate

## Current Position

Phase: 9 of 15 — gap-closure plans added after the original `09-VERIFICATION.md` pass
  (a systematic mutation sweep found 7 more undetected gaps); 09-07 closes them, 09-08
  covers a separate exec/guest/document batch from the same sweep and is not yet started.
Plan: 7 of 8 complete (09-07 closed 7 mutation-sweep gaps in server/report; 09-08 pending)
Status: Between phases. Phase 9 not fully complete until 09-08 lands; Phase 10 not started.

Progress: [█████░░░░░] 8 of 15 phases complete (53%; see progress.total_plans/completed_plans
  in this file's frontmatter for the raw plan/summary counts — the percent figure here is
  phase-based, not plan-based, because two phases carry an extra FIX-SUMMARY.md alongside a
  plan's own summary, which would otherwise round the plan-based figure to a misleading 100%)
Last activity: 2026-08-06

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

- Total plans completed: 0
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

Last session: 2026-08-06T03:54:34.503Z
Stopped at: Completed 09-07-PLAN.md (gap closure — 7 mutation-sweep gaps closed, all verified RED before this plan and reverted after); 09-08 not started
(`npm test` 187/187, 185 project-local proofs, `tsc` clean, `test:integration` included and
passing, tree clean). Merge blocker measured and dismissed — see Blockers. Awaiting the user's
choice on push/PR strategy and on Phase 8.
Resume file: None
(they were one-shot artifacts, written to `feature/planning-requirements-roadmap` seven
minutes after PR #14 merged, so they never reached `main`; nothing else on that branch is
unmerged and it can be deleted)
