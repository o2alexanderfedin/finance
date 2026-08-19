# Schedule 2 line 13 — uncollected Social Security/Medicare/RRTA tax on tips or group-term life insurance

**Status:** specified, implemented on `feature/tier-a-refused-kinds`
**Kind:** `uncollectedTaxOnTipsOrGroupTermLife`
**Printed line:** Schedule 2 line 13 -> 1040 line 23

## What is missing

Form W-2 box 12 carries four codes that report tax an employer **could not
collect** from the employee, and which the employee therefore owes on the
return:

| code | what it reports |
|---|---|
| `A` | uncollected social security or RRTA tax on tips |
| `B` | uncollected Medicare tax on tips |
| `M` | uncollected social security or RRTA tax on group-term life insurance over $50,000 (former employees only) |
| `N` | uncollected Medicare tax on group-term life insurance over $50,000 (former employees only) |

All four are **additional taxes owed**, summed onto Schedule 2 line 13 and from
there into line 21 -> 1040 line 23. Schedule 2 line 13 was a
`profileDeclaredZeroLine` (`fjs/schedule/2/module.f.js:554`), so a taxpayer
holding a W-2 with any of these codes received a return that **understated the
tax by the whole of them**. That is a correctness defect, not a missing nicety:
unlike a missed deduction, it fails in the direction the taxpayer cannot
discover by reading their own refund.

## The remedy string was stale, and false

`fjs/return/scope/module.f.js:803` said:

> `remedy: 'requires Form W-2 box 12 codes A, B, M or N, which no dialect field models (no phase yet)'`

**"no dialect field models" is false.** `vnd.fjs.w2` has carried box 12 as a
generic `readonly {code, amount}[]` array since the dialect shipped
(`fjs/document/w2/module.f.js:77` for the entry shape, `:129` for the field),
and that array is inside the dialect's own money-exactness checking, so every
stored `amount` is already validated to the cent. `fjs/schedule/1`'s
`employerHsaContributionSources` has read `box12[code=W]` off exactly that
array since the HSA deduction shipped.

The correct remedy string, had the line stayed refused, would have been that
**no computation reads the codes** — the `box13StatutoryEmployee` shape this
repository has already paid for once — not that no field models them. Since
this spec's work wires the line, the row leaves `unmodeledKindRefusals`
entirely and the string goes away.

## The computation

No floor, no threshold, no phase-out, no worksheet and no attached form. The
boxes ARE the computation:

    line13 = Σ amount  over every box 12 entry, on every stored Form W-2,
                       whose trimmed, upper-cased code is one of A, B, M, N

Which is why this lands as a schedule line rather than a form module.

## Matching the code

Copied verbatim in shape from `employerHsaContributionSources`
(`fjs/schedule/1/module.f.js:617-624`), for its stated reason:
`fjs/document/w2` stores box 12's code **as printed** and never interprets it.

- matched **case-insensitively**, after **trimming** — `'a'` and `' A '` are
  the same box as `'A'`;
- matched on the **whole trimmed string**, never a prefix — `'AA'` (a
  designated Roth contribution under a §401(k) plan) is a different code from
  `'A'` and contributes nothing;
- the four codes are a **hand-typed** list in this module, never derived from
  anything the code under test owns.

The normalized code is what reaches the `boxPath`, so a citation reads
`box12[code=A]` whatever the stored spelling was.

## Citation contract

**One `Source` per contributing box-12 entry**, never one per document: a
single W-2 can carry all four codes, and collapsing them would lose which of
the four an auditor has to look at.

    { documentHash, boxPath: `box12[code=${code}]`, value: amount }

A return whose W-2s carry none of the four codes — including a return with no
W-2 at all, and a return whose box 12 holds only `D`/`W` — keeps a **computed
zero citing the profile's own `declaredKinds` box**, through the same
`documentLine` fallback `fjs/schedule/1` uses. It is byte-identical to the
declared zero line 13 was before this work, which is what keeps every existing
Schedule 2 leaf green.

Note the difference from Schedule 1 line 18's presence-not-value rule: there,
a box that is present and `'0.00'` cites its document. Here, presence of an
entry IS the presence of a code, so an entry with code `A` and amount `'0.00'`
cites its document too, and the only "absent" case is the absence of a
matching code.

## Wiring

Schedule 2 did **not** already receive the W-2 documents — it receives
`medicareWages` and `medicareTaxWithheld` as already-summed `ReportLine`s,
because those two boxes have no 1040 line of their own. Box 12 cannot be
pre-summed that way: the citation contract is per-entry, and a pre-summed
`ReportLine` would have to carry the per-entry sources anyway. So `w2Forms`
joins `ScheduleTwoInput`, and `fjs/form1040/core` passes the `w2s` it already
has in scope at the call site.

## Proofs

Hand-typed expected values in integer cents with the dollar figure in the
assertion message, never derived from the sum under test. **Value and citation
are asserted by separate leaves.**

- one W-2 with code `A` only -> line 13 equals it; one cited source
- one W-2 with all four codes -> the hand-typed total, four cited sources, one
  per entry, in printed order
- two W-2s each carrying codes -> the hand-typed total, each document cited
  under its own hash
- a W-2 whose box 12 carries only `D` and `W` -> zero, profile-cited, and
  neither entry cited
- case and whitespace: `'a'`, `' A '` and `'A'` are the same code; `'AA'` is
  not, and contributes nothing
- no `box12` key at all -> profile-cited zero
- line 13 reaches line 21 -> 1040 line 23, not line 3 -> 1040 line 17

## Mutations to run before claiming the proofs work

- the sum forced to `0n`
- one of the four codes dropped from the match set (each of A, B, M, N)
- the match loosened to a prefix (`startsWith`) so `'AA'` counts as `'A'`
- the case-insensitive trim removed
- the box transposed to a different code (`A` -> `W`)
- line 13 dropped from the line 21 total

## What the mutations actually found

Nine mutations were run against an isolated snapshot (a second agent was
editing `fjs/schedule/3` and `fjs/tax/params` in the same checkout, and
AGENTS.md's "concurrent work invalidates a mutation observation" applies —
their files were reset to `HEAD` inside the snapshot so a foreign `tsc`
failure could not be read as a mutation result).

**One survived, and it was the important one.** Replacing `w2Forms: w2s` with
`w2Forms: []` at `fjs/form1040/core`'s Schedule 2 call site left the entire
suite green: 2,276 proofs passing while a taxpayer holding a W-2 with box 12
code A received a return understating the tax by the whole of it. Every leaf
in `fjs/schedule/2` proves the arithmetic and the citations, and **not one of
them can see the schedule being handed an empty document list.** Two
end-to-end leaves were added in `fjs/form1040/core` —
`aBoxTwelveCodeAReachesLineTwentyThree` (an absolute AND a differential
against the same return carrying code `D` instead) and
`lineTwentyThreeCitesTheBoxTwelveEntryItTaxed` — and the mutation now reddens
both.

The general lesson, which is not new here and keeps costing the same amount:
**a schedule-level proof cannot prove a wiring.** A line that reads documents
needs a leaf at the entry point that actually supplies them.

## Reclassification — NOT done here

`fjs/return/scope/module.f.js` is out of scope for this work by instruction.
The kind stays in `unmodeledKindRefusals` and the exact edits it needs are
reported to the caller rather than made.

## Not in scope

Schedule 2 lines 5 and 6 — uncollected tax on **unreported** tips (Form 4137)
and on wages (Form 8919) — are different kinds (`unreportedTips`,
`form8919Wages`) with their own forms and their own documents. Box 12 codes A,
B, M and N have nothing to do with either.
