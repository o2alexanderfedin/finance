# Deferred Items — Phase 13

## RESOLVED 2026-08-11 — the traceability-table `Status` lag

Fixed at phase close: `TAX-09`, `TAX-10`, `TAX-12`, `TAX-13` and `TAX-14` now read
**Complete** in `.planning/REQUIREMENTS.md`'s traceability table, matching their `[x]`
checkboxes. Two sources of truth disagreeing about whether a requirement is done is how a
closed phase gets re-litigated later. The underlying tooling question — whether
`requirements mark-complete` should update the table, or whether the column should be dropped
because the checkbox is the single source of truth — is still open and belongs to a future
`requirements`-tooling change.

## DEFERRED TO PHASE 14 — the IRS-figure transcription check (user decision, 2026-08-11)

`13-VERIFICATION.md` is `status: human_needed` for exactly one reason: **no human has checked
the transcribed TY2025 figures against the printed IRS PDFs.** The user chose to resolve this
in Phase 14 rather than by reading PDFs now.

The figures awaiting confirmation:

| Figure | Cited source |
|---|---|
| Senior deduction $6,000, 6%, $75k/$150k | `f1040s1a.pdf` (2025) p2 |
| SSB base amounts $25,000 / $32,000 | `i1040gi.pdf` (2025) p32 |
| SALT cap $40,000, 30% phase-down, $500k/$250k, $10,000 floor | `f1040sa.pdf` (2025) |
| CTC $2,200 / ODC $500 / ACTC cap $1,700 / phase-out $400k/$200k at 5% per $1,000 | `f1040s8.pdf` (2025), `rp-25-32.pdf` §2.03 |
| Medical floor 7.5% | IRC §213(a) |

**Why deferring is defensible, not a shortcut:** Phase 14's acceptance runs the engine against
the user's own filed TY2025 return. That tests the same constants from the other direction and
more convincingly than re-reading a PDF — a transcription error surfaces as a disagreement with
a return the IRS already accepted. Phase 14 must **not** close without it.

Phase 14 also owns the Phase 10 `human_needed` item (whether the Tax Computation Worksheet is
cent-exact or whole-dollar, pinned at $184,094.50 for MFJ at $700,000 taxable) — the same
acceptance run resolves both.


Logged during 13-13 execution. Out of scope for 13-13 (SCOPE BOUNDARY: only auto-fix issues
directly caused by the current task's changes). Not fixed here.

## REQUIREMENTS.md traceability table shows "Pending" for already-complete requirements

`.planning/REQUIREMENTS.md`'s "Requirement -> Phase" traceability table (around line 618
onward) has a `Status` column that reads **Pending** for `TAX-09`, `TAX-10`, `TAX-12`,
`TAX-13` and (as of this plan's `requirements mark-complete TAX-14` call) `TAX-14`, even
though each of these requirements' own checkbox line above is `[x]` (TAX-09/10/12/13 were
already `[x]` before 13-13 ran; 13-13 marked TAX-14 `[x]` via
`gsd-sdk query requirements.mark-complete`). The checkbox is the authoritative
completion marker; this appendix table's `Status` column appears to lag it — pre-existing
for TAX-09/10/12/13 (not introduced by 13-13), and inherited by TAX-14 for the same reason.

Not fixed here because it is not caused by any 13-13 change and touching the appendix
table's format is outside this plan's `files_modified` scope
(`.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `magi-gate.test.js`,
`fjs/return/scope/module.f.js`) for anything beyond the 19-line correction and the
requirement-completion checkbox itself.

**Suggested fix (future plan or a `requirements`-tooling change):** either have
`requirements mark-complete` also update this table's `Status` column, or drop the column
if the checkbox above is meant to be the single source of truth.
