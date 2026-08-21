---
milestone: v4
milestone_name: Verified With the Taxpayer Present
audited: 2026-08-20T18:40:00.000Z
status: gaps_found
gate: "the three phases of this milestone are unexecuted; every one is blocked on an owner decision, none on engineering"
scores:
  requirements: 0/0
  phases: 0/3
  integration: 5/5 wired, 0 blockers, 3 warnings
  flows: 1/1 end-to-end path verified, mutation-proved
requirements_note: >-
  No REQ-ID in REQUIREMENTS.md maps to Phase 34, 35 or 36. The requirement set is 127/127
  complete and cannot measure this milestone: v4's definition of done lives only in ROADMAP
  prose. That is the finding, not an oversight to paper over — see F-01.
gaps:
  phases:
    - id: "Phase 34"
      status: not_started
      blocked_on: "the owner's own documents and an account at a second filer"
    - id: "Phase 35"
      status: not_started
      blocked_on: "one dependency approval (@cantoo/pdf-lib); AGENTS.md requires EVERY owner's approval and there are two"
    - id: "Phase 36"
      status: not_started
      blocked_on: "a real client session with real documents; fixtures would prove the pipe and not the phase"
findings_fixed_in_this_audit:
  - id: F-02
    title: "Milestone v4 was invisible to the tooling auditing it"
  - id: F-03
    title: "Phase 36's description was split across two milestone sections, 987 lines apart"
  - id: F-04
    title: "Four present-tense pointers to a deleted file"
  - id: F-05
    title: "STATE.md's timestamp was older than the events STATE.md describes"
  - id: I-01
    title: "A production docstring justified skipping validation by naming a check that does not exist"
tech_debt:
  - area: phase-artifacts
    items:
      - "4 phase directories carry no VERIFICATION.md: 05, 06, 07, 18"
      - "Phases 21-33 and 37 have no phase directory at all; their evidence is PR links in ROADMAP.md"
      - "44 of 127 ticked requirements are claimed by no SUMMARY frontmatter — the audit matrix's third source does not exist for phases 21+"
  - area: integration
    items:
      - "I-01 filed as fjs/todo/no-dialect-validation-on-the-write-path.md — nothing checks a finance document against its dialect on the write path"
      - "I-02 the stable line key needs a suffix stripper that lives only in demo/steps/09-form1040.js:348"
      - "I-03 Form1040Inputs is assembled twice — demo steps and taxReturnReportSource — with nothing comparing them"
      - "Phase 36 needs a reusable stdio client; initialize/initialized are hand-mirrored in four root harnesses"
  - area: nyquist
    items:
      - "6 VALIDATION.md files were never signed off: 07, 11, 12, 12.1, 13, 15 — zero ticked boxes each"
      - "08-VALIDATION.md carries nyquist_compliant: true with status: draft"
nyquist:
  compliant_phases: 2      # 18, 19
  partial_phases: 7        # 07, 08, 11, 12, 12.1, 13, 15
  missing_phases: 9        # 01, 02, 03, 04, 05, 06, 09, 10, 20 (of the 18 dirs)
  overall: partial
---

# Milestone v4 — Audit

**Verdict: `gaps_found`, and the gap is the milestone.** All three phases are unexecuted. None is
blocked on engineering; each waits on a decision only an owner can take. Auditing v4's deliverables
is therefore not possible — so this audit did the two things that are: it checked whether the
apparatus that will measure v4 works, and it checked whether the pipeline v4 exercises is wired.

**The apparatus did not work.** Three defects, all found here, all fixed in the same change.

---

## F-01 — v4 has no requirement coverage, and that is a real hole

No REQ-ID maps to Phase 34, 35 or 36. Verified by searching the traceability tables and the
requirement bodies: the highest phase number any requirement names is **32**.

So two statements are simultaneously true, and they look contradictory until you see this:

- **127 of 127 requirements are complete**, and `planning-truth-gate.test.js` enforces that the
  checkbox and the traceability row agree on every one.
- **Three phases of work remain.**

The requirement set simply stops before this milestone. v4's definition of done exists only as
ROADMAP prose, which nothing checks. **The standard audit score — "N/M requirements satisfied" — is
0/0 here, and 0/0 is not a pass.**

Not fixed in this audit: writing requirements for v4 is a planning decision, and the owner who is
already the blocker for all three phases is the one to take it.

## F-02 — the milestone was invisible to the tooling meant to audit it — FIXED

`gsd-sdk query roadmap.analyze` reported **31 phases, ending at Phase 30**, while ROADMAP.md's
phase list carries **38 entries**. Cause, found rather than guessed: the tool reads `### Phase N`
detail sections, and **Phases 31 through 37 had a checkbox line and no section**.

Phases 34, 35 and 36 are exactly three of the seven. **The current milestone did not exist as far
as the tooling was concerned** — including the tooling that routes `/gsd-progress --next`.

Fixed by adding the seven sections, each deliberately carrying no prose of its own — the phase list
above them remains the single record, because a second copy of the same fact is what this file has
already been bitten by. After the fix: `roadmap.analyze` reports **38**, matching `34 [x] + 3 [ ] +
1 [→]` counted from the list.

**One number still disagrees and should not be reconciled: `completed_phases: 17`.** That is not
progress; it counts phase directories containing a SUMMARY, and exactly 17 do. The ROADMAP says 34
complete. Both are true of different things, and only the label makes them look like one thing.

## F-03 — a sentence split across two milestones — FIXED

Phase 36's entry ended mid-clause:

> `- [ ] **Phase 36: The Conversational Path** - Documents into chat, "what do I owe for 2025?",`

Its continuation — *"answer end to end with citing hashes, no code touched. This is Phase 14's
criterion 2, unchanged and still wanted."* — sat **987 lines earlier**, glued to the end of Phase
37's entry, where it read as a claim about the FunctionalScript migration. A later insertion had
swallowed it. Both halves are now where they belong.

## F-04 — four present-tense pointers to a file that does not exist — FIXED

`fjs/todo/upstream-mjs-migration.md` was retired by `1924cef` once its three conditions were met.
Four places still pointed at it in the present tense: ROADMAP.md ("Full analysis in …"),
REQUIREMENTS.md:645 ("is specified in …"), and `.planning/reports/fjs-0.46.1-migration.md` twice
("It is recorded in …", "holds the full running record"). Each now names the retirement, the commit,
and what the account moved into. Four further mentions in `18-SUMMARY.md`/`18-VALIDATION.md` were
left alone: those are records of what was true when written, the same exemption `CHANGELOG.md` has.

## F-05 — a timestamp older than the text it stamps — FIXED

`.planning/STATE.md` carried `last_updated: 2026-08-17` and `last_activity: 2026-08-17` while its
own `stopped_at` field, four lines above, narrated **2026-08-19**: Phase 33's closure, the
milestone split, the 3247-test suite. And its body read *"Current focus: Between phases — Phase 15
shipped, Phase 16 awaiting an owner decision"* — Phase 16 was resolved by removal on 2026-08-17 and
is ticked `[x]` in the ROADMAP.

**A timestamp older than the text it stamps is the cheapest possible tell**, and nothing was
watching for it. Both fixed, with the staleness recorded in place rather than quietly overwritten.

---

## Phase artifacts — the chain stops at Phase 20

| | count |
|---|---|
| Phases in ROADMAP | 37 (+1 retired-marker line for Phase 14) |
| Phase directories | 18 |
| With VERIFICATION.md | 14 |
| With at least one SUMMARY | 17 |

**Four directories carry no VERIFICATION.md** — 05, 06, 07, 18. By this workflow's own rule those
are unverified phases and therefore blockers. They are recorded here as debt rather than as v4
blockers, because all four shipped inside milestones already closed.

**Phases 21–33 and 37 have no directory at all.** Their evidence is a PR number in the ROADMAP
entry (`PR #72` … `PR #100`) plus, for 33 and 37, a full report under `.planning/reports/`. This is
a deliberate change of evidence style, not lost work — but it is why the audit matrix's third
source is missing for **44 of 127 requirements**: no SUMMARY frontmatter claims them.

Cross-checked all three sources anyway, and **nothing contradicts**: no requirement is claimed
complete by a SUMMARY while its checkbox is open, and no SUMMARY names an ID that has no
requirement behind it. The matrix cannot classify those 44; it does not disagree about them.

## Nyquist coverage

| Phase | VALIDATION.md | `nyquist_compliant` | Sign-off boxes | Phase VERIFICATION |
|---|---|---|---|---|
| 07 | exists | false | 0 of 10 | **absent** |
| 08 | exists | **true** | — | passed |
| 11 | exists | false | 0 of 14 | passed |
| 12 | exists | false | 0 of 9 | passed |
| 12.1 | exists | false | 0 of 12 | passed |
| 13 | exists | false | 0 of 8 | passed |
| 15 | exists | false | — | passed |
| 18 | exists | true, `complete` | all ticked | absent |
| 19 | exists | true, `complete` | all ticked | passed |

**These six are not stale frontmatter — the checklists were never filled in at all** (zero ticked
boxes each), in phases whose goal-backward VERIFICATION says `passed`. That distinguishes them from
Phase 19's WR-04, where the boxes were ticked and only the frontmatter lagged.

**Deliberately not fixed.** Setting `nyquist_compliant: true` without running each checklist item
is precisely the failure this repository's discipline exists to prevent — several items are live
commands (`grep -rn "magi" fjs/` empty; "proof count rose from the 665 baseline") and would have to
be executed, not assumed. This workflow is discovery-only for that reason: run
`/gsd-validate-phase 07 11 12 12.1 13 15` if the coverage is wanted.

## Integration — the pipeline v4 will exercise

Checked by a dedicated pass that ran and mutated code rather than reading planning documents.
**No blockers.** Every expected cross-phase connection resolves to wired, and the decisive one was
watched to fail.

| # | Subject | Verdict |
|---|---|---|
| 1 | blob → CAS → dialect → engine → printed lines | **VERIFIED** (mutation-proved) + 1 warning |
| 2 | MCP surface, 13 tools, route to a computed return | **VERIFIED** |
| 3 | demo calls the same engine entry point | **VERIFIED** + 1 warning |
| 4 | stdio real-process harness (phase 36's prerequisite) | **VERIFIED** at the transport level + 4 gaps |
| 5 | stable per-line identifier (phase 35's prerequisite) | **VERIFIED** — the field is `rule` + 1 warning |

**The decisive hop was watched to fail.** In a snapshot copy, `'vnd.fjs.w2'` → `'vnd.fjs.w2ZZ'` at
`fjs/report/tax_return/module.f.js:405` reddened exactly two leaves — the dialect-dispatch proof and
the cross-process `EXEC-14/PROV-09` end-to-end. The E2E is not decoration.

**Phase 35's key exists**: `rule` is required on `ReportLine` (`fjs/report/line/module.f.js:53`) and
a live run gives 56 lines, 56 unique rules, 56 unique line numbers, no duplicates.

### I-01 — nothing validates a finance document on the write path — DOCSTRING FIXED, GAP FILED

The most consequential finding, and it was hiding behind a sentence that asserted the opposite.
`fjs/report/tax_return`'s module docstring justified handing documents to the engine unvalidated
because *"`cas_add`/`evo_add` already validated them against their dialect"*. **They do not**,
verified here rather than taken:

- upstream `cas_add` classifies with `detect([revisionDialect, lockDialect, noteDialect])`
  (`node_modules/functionalscript/fjs/mcp/cas/module.f.mjs:164`) — three upstream dialects, none of
  them ours;
- `detectFinance`, which does carry the per-dialect checks, reaches production at exactly one site:
  `cas_refresh`'s **read-only** count report, `fjs/server/module.f.js:170`;
- the stored program's `route` dispatches on `doc.dialect` and files the value, with no schema or
  money-exactness check.

What holds today is that every producer calls its dialect's own `validate` first
(`tax-return-integration.test.js:373-384` does exactly that). **That is a convention among callers,
not an enforced invariant, and calling it one was the defect.**

**Why it belongs in a v4 audit rather than a backlog:** phases 34 and 35 both consume stored
documents and assume they are well formed. A silent understatement from a malformed box would
surface as a disagreement with the second filer, or as a wrong number on a form meant to be filed —
in both cases far from its cause.

Docstring corrected to state the trust boundary honestly; the behaviour change is filed as
`fjs/todo/no-dialect-validation-on-the-write-path.md` with three options costed, because adding
validation to a public protocol surface is a design decision and not an audit's to take.

### I-02 — the stable line key needs one normalization, and it lives in the demo

`rule` is not quite a key as emitted: line 16 embeds its computation method
(`` `1040 line 16 (${line16MethodNames[...]})` ``, `fjs/form1040/core/module.f.js:2747`), which ships
in at least three variants. A field table keyed on the raw string breaks the moment a return uses
QDCGT instead of the Tax Table.

The stripper exists — `lineNumberOf` at `demo/steps/09-form1040.js:348` — **in the demo, not in the
engine**, and it is the only copy. Phase 35 should lift it into `fjs/report/line` rather than write
a second one. Left in place here: no second caller exists yet, and moving it is that phase's work.

### I-03 — input assembly exists twice, and nothing compares the two

The engine call cannot drift — `demo/lib/engine.js:21` and `fjs/guest/tax/module.f.js:74` import the
same `form1040Report` from the same file, and every other `../../fjs/...` reference in `demo/` is a
type-only JSDoc import. But **`Form1040Inputs` is assembled twice**: inline in the demo steps, and in
`taxReturnReportSource`'s dialect dispatch. A dialect routed into a new input field would be picked
up by one and not the other, silently.

### Phase 36's prerequisite — transport works, four named gaps

Four root-level harnesses spawn `node index.js <home>` and speak NDJSON JSON-RPC; the most capable
(`tax-return-integration.test.js:146-192`) does a real handshake and resolves calls by **JSON-RPC id
matching, never a sleep**. What it cannot do:

1. **No reusable client module** — `initialize`/`initialized` are hand-mirrored in all four
   harnesses, deliberately, because they are module-private constants of a pure `.f.js`. Phase 36
   would be the fifth copy unless a shared harness is extracted first.
2. **No agent driver** — every sequence is hand-scripted; nothing reads `tools/list` and chooses,
   which is the actual content of "the conversational path".
3. **Capabilities are `{ tools: {} }`** (`fjs/server/module.f.js:255`) — no prompts, resources,
   sampling or elicitation, so the server cannot make server→client requests.
4. **It cannot be a `.f.js` proof** — `fjs/effects/node` still has no subprocess-spawn effect
   (filed upstream as `functionalscript#1649`), so phase 36's session lands as another root-level
   `@ts-nocheck` file, outside `tsc`.
