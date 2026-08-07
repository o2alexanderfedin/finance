# Phase 10 — Deferred Items

Out-of-scope discoveries logged rather than fixed, per AGENTS.md's scope boundary: only issues
DIRECTLY caused by the current task's changes are auto-fixed.

## From Plan 10-09

**1. `REQUIREMENTS.md`: TAX-16's traceability row disagrees with its own checkbox.**

Line 315 reads `- [x] **TAX-16**`, but the traceability table at line 610 still reads
`| TAX-16 | T1 | Phase 10 - 1040 Core and Scope Guard | Week 2 | Pending |`. TAX-03's row was
updated to `Complete` and TAX-16's was not, so this is not a convention — it is a miss.

Pre-existing (introduced before this plan, by whichever executor closed TAX-16), and unrelated to
`fjs/form1040/core`, so it was NOT fixed here. `gsd-sdk query requirements.mark-complete` appears
to update the checkbox without always updating the table row — worth checking before the phase's
final roll-up, since the two are read by different consumers.

**2. Line 12e's provenance is document-granular for three boxes.**

`claimedAsDependent`, `spouseItemizes`, `dualStatusAlien` and `earnedIncome` all materially
determine line 12e's value but are cited only through the profile's `filingStatus` source (same
`documentHash`). A dependent's line 12e can differ from the chart amount by $14,400 with no
`Source` naming the box responsible.

Not auto-fixed because Plan 10-09's own `<behavior>` block pins the source COUNTS
("an all-boxes-clear return cites exactly one box, and a two-box return cites three"), and Plan
10-10 assembles the full report and may assert on them. Widening the set unilaterally would be a
silent interface change one wave before it is consumed. Criterion 1 — each line citing the
*documents* it derived from — is satisfied today; the gap is box granularity.

Decision needed from the phase owner, ideally before 10-10 pins anything further.
