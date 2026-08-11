# Deferred Items — Phase 13

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
