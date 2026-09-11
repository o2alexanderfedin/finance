# Milestone v6 — audit against the source

**Ran:** 2026-08-31, on `chore/file-upstream-web-vec-limit` (`42d0701`, one doc commit ahead of
`main` at `d591726`).
**Why it exists:** milestone v6 was executed direct-to-PR. No `CONTEXT.md`, `PLAN.md`, `SUMMARY.md`
or `VERIFICATION.md` was written for phases 39, 40, 41 or 42, and `STATE.md` was hand-marked
`status: complete` without `/gsd-audit-milestone` having run. **Marking a milestone complete
without the gate is the record-ahead-of-verification failure this repository keeps correcting**,
so this document is that gate, run afterwards rather than not at all.

Every verdict below was reached by opening the cited file and reading it. Where a planning
document asserted something, the assertion was treated as a claim to check, not as evidence —
in past rounds here roughly a third of such claims were wrong until the code was actually read.

## Verdicts

| Requirement | Verdict | Evidence read |
|---|---|---|
| **MAINT-09** — take the current FunctionalScript | **COVERED** | `package.json` declares `^0.48.0`; `node_modules/functionalscript/package.json` reports `0.48.0`. **Zero** live `.js` files import the retired `functionalscript/fjs/types/rtti` path. |
| **MAINT-10** — retire the protocol-version gap | **COVERED** | `fjs/server/module.f.js:664` `negotiatesTheProtocolRevision`, over `twoRevisionConfig` (`:522`). Non-vacuous — see below. |
| **MAINT-11** — adopt new 0.48.0 capabilities | **PARTIAL, blocked upstream** | `toolResultStep` adopted at 4 sites in `fjs/server/module.f.js`; `okResult`/`errorResult` no longer appear at all. The `fjs web` half is blocked — `demo/serve.sh:74-86`. |
| **MAINT-12** — a consumer-side migration report | **COVERED** | `.planning/reports/fjs-0.48.0-migration.md`, 232 lines, §5.1 carrying the headline finding. |
| **MAINT-13** — write the standing upstream authority | **COVERED** | `AGENTS.md:25`, written as an *extension* of the existing gap rule at `:24`, plus the re-read rule at `:26`. |
| **DOC-25** — validation on the write path | **COVERED** | `fjs/server/write_validation/module.f.js`; wired at `fjs/server/module.f.js:239`; proven end-to-end at `:608` with a positive control at `:638`. |

## The two checks worth showing the working for

**MAINT-10 — is the proof non-vacuous?** This is the requirement that existed because the
*previous* proof passed for the wrong reason: its fixture requested `2025-06-18`, which was not in
the supported list, so negotiation counter-proposed the latest — the identical value the
non-negotiating code it replaced returned. The assertion passed whether or not negotiation existed.

The current proof builds `twoRevisionConfig` with `['2025-11-25', '2025-06-18']` and asserts three
cases, the decisive one being that a request for the supported **non-latest** `2025-06-18` is
answered with `2025-06-18`. **A server that pinned instead of negotiating would answer
`2025-11-25`, and that assertion would fail.** The proof now watches the behaviour it names.

`theShippedConfigAdvertisesExactlyOneRevision` (`:683`) states as an assertion, rather than as a
comment, why the leaf above needs a config of its own: over the shipped one-entry list no request
can distinguish negotiating from pinning.

**DOC-25 — does the refusal actually refuse, and is it before the store?** The proof drives the
real `financeMcpServer` over stdin, posts a `cas_add` whose content declares `vnd.fjs.w2` and
carries three-decimal money, and asserts `isError`, that the message names the dialect, and that it
says nothing was stored. It then reads `cas_list` back and asserts the listing is **empty** — a
refusal *after* the write would have left the hash listed. The following leaf sends the same
document with the money corrected and asserts it stores, so the pair proves a refusal rather than a
`cas_add` that is broken for everything.

## What the audit found that was not already known

**Three `fjs/todo/*.md` paths cited under `fjs/` do not exist as files.** A naive grep reads these
as the dangling-citation class Phase 39 was written to fix, so they were checked one by one:

- `fjs/schedule/b/module.f.js:41` — *"This is the decision `…md` **existed** to force"*, past
  tense, and the decision it forced is settled in the docstring beneath it.
- `fjs/schedule/b/module.f.js:811` — *"The gap `…md` **recorded**"*, and it quotes the note's
  reachable state inline, so the reader needs nothing else.
- `fjs/server/module.f.js:430`, `fjs/json/module.f.js:24`, `fjs/exec/module.f.js:34` — each says in
  so many words that the note was **retired and deleted**.

None sends a reader to a file it implies is there; all carry the content forward. This is the
opposite of what Phase 39 removed, which were live citations asserting a gap that was already
closed. **No change made** — but the earlier summary's flat "no dangling citations remain" was
imprecise, and the precise statement is the one above.

**Thirteen files still name the retired `functionalscript/fjs/types/rtti` path** — every one of
them under `.planning/phases/`, in `PLAN.md`, `RESEARCH.md` and `PATTERNS.md` records of phases 05
through 19. These are historical documents describing what was true when they were written.
Rewriting them would falsify the record. **No change made.** Zero live `.js` files are affected.

## Measured on the audited tree

- `npm test` — **3325 / 3325**, 0 fail (`tsc` clean; the suite refuses to run otherwise)
- `planning-truth-gate` — **24 / 24**
- fjs `0.48.0` installed against `^0.48.0` declared

## Standing after the audit

Five requirements COVERED, one PARTIAL and blocked upstream, none MISSING. The PARTIAL is
MAINT-11's `fjs web` swap: `fjs web` answers 413 for any file over one `Vec` (131072 bytes) and
eleven of the demo's modules exceed it, the largest by 7.6x. Recorded in
`fjs/todo/upstream-web-vec-size-limit.md` and taken upstream on 2026-08-31 as
[`functionalscript#1819`](https://github.com/functionalscript/functionalscript/issues/1819).

**The `status: complete` in `STATE.md` is ratified by this document**, not by the fact that it was
written there first.
