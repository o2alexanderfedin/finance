---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: milestone
status: executing
stopped_at: Completed 07-08-PLAN.md
last_updated: "2026-08-05T06:14:19.856Z"
last_activity: 2026-08-05
progress:
  total_phases: 15
  completed_phases: 6
  total_plans: 25
  completed_plans: 25
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-03)

**Core value:** The report is a program, not an answer — the agent emits FunctionalScript;
the server executes it as a pure function of `(documents, tax-year parameters) → report`.
**Current focus:** Phase 7 — `fjs_run`, Run Records, and the Week 1 Convergence (planned, executing — Wave 1)

## Current Position

Phase: 7 of 15 in progress (`fjs_run`, Run Records, and the Week 1 Convergence)
Plan: 9 of 9 in that phase (07-01 complete; 07-02..07-09 remain across Waves 1-5)
Status: Ready to execute

Progress: [██████████] 100%
Last activity: 2026-08-05
`npm test` 2314 pass / 0 fail (runs `tsc && node --test` — tsc is already inside it); fjs 0.41.0. Project-local proof count (`node --test 2>&1 | grep -c '^✔ import("./fjs/'`): 136.

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

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-08-05T06:14:19.838Z
Stopped at: Completed 07-08-PLAN.md
bookkeeping synced (DOC-00/01/03/04/10/11/12/14 all marked Complete).
Resume file: None
(they were one-shot artifacts, written to `feature/planning-requirements-roadmap` seven
minutes after PR #14 merged, so they never reached `main`; nothing else on that branch is
unmerged and it can be deleted)
