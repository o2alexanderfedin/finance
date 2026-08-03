# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-03)

**Core value:** The report is a program, not an answer — the agent emits FunctionalScript;
the server executes it as a pure function of `(documents, tax-year parameters) → report`.
**Current focus:** Phase 1 — Planning-Document Corrections and the Upstream Report

## Current Position

Phase: 1 of 15 (Planning-Document Corrections and the Upstream Report)
Plan: 0 of TBD in current phase
Status: Ready to plan
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

- **Live contradiction between AGENTS.md and the roadmap (new, Phase 1 scope).** PR #17
  makes "money in JSON is a string" absolute; three places still specify integer cents as a
  JSON *number* at the storage boundary — `REQUIREMENTS.md:249` (EXACT-05),
  `ROADMAP.md:214` (Phase 4 success criterion 4), `ROADMAP.md:221` (Phase 5 depends-on).
  Only the storage layer flips; exact rationals in computation and decimal strings on the
  MCP wire are unaffected. Folds into Phase 1 as a seventh correction.
- **HEAD moves externally — now characterized.** Reflog shows the pattern is
  `checkout: moving from feature/… to main` immediately followed by
  `merge origin/main: Fast-forward` — i.e. something runs `git checkout main && git pull`
  after each upstream merge. Not corruption, and no work has ever been lost, but it will
  discard uncommitted edits. Mitigation: commit early, keep multi-step git in one atomic
  invocation, and re-verify `git branch --show-current` at the start of every command block.
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
