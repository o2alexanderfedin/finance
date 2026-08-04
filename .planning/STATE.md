# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-03)

**Core value:** The report is a program, not an answer — the agent emits FunctionalScript;
the server executes it as a pure function of `(documents, tax-year parameters) → report`.
**Current focus:** Phase 1 — Planning-Document Corrections and the Upstream Report

## Current Position

Phase: 3 of 15 (The Restricted Interpreter)
Plan: 0 of TBD in current phase
Status: Ready to plan — Phases 1 and 2 complete, each verified 11/11

Progress: [██░░░░░░░░] 2/15 phases (15 of 79 requirements Done)
Last activity: 2026-08-03 — PR #14 merged (planning corpus on `main`); PR #17 merged
(Sergey: absolute no-floating-point rule, exact-decimal module as Week 1 step 6)

Progress: [░░░░░░░░░░] 0%

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
- **Minor: the `functionalscript` submodule is not initialized** in this worktree (`git submodule
  status` shows a leading `-`). Nothing depends on it today — `tsconfig.json` excludes it and the
  suite is green — but `git submodule update --init` is needed for workflows that read it.
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
- **NEW: the `finance-mcp` registration points at the worktree path.** After this branch merges,
  run `claude mcp remove finance-mcp -s local` and re-register against the main checkout, or a
  stale duplicate accumulates.
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

Last session: 2026-08-03 16:14 PDT
Stopped at: Session resumed via /gsd-resume-work; proceeding to plan Phase 1
Resume file: None — `HANDOFF.json` and `.continue-here.md` were consumed by this resume
(they were one-shot artifacts, written to `feature/planning-requirements-roadmap` seven
minutes after PR #14 merged, so they never reached `main`; nothing else on that branch is
unmerged and it can be deleted)
