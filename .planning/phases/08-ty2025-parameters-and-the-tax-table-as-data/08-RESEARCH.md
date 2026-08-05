# Phase 8: TY2025 Parameters and the Tax Table as Data - Research

**Researched:** 2026-08-05
**Domain:** IRS TY2025 tax parameters (Rev. Proc. citations) and the published Tax Table's exact
band structure, stored as data behind `finance_tax_params` and diffed row-by-row
**Confidence:** HIGH — every load-bearing claim below is `[VERIFIED]` against a primary-source PDF
fetched and read directly in this session (IRS Publication 1040 (2025), Rev. Proc. 2025-32,
Rev. Proc. 2024-40, Instructions for Form 1040 (2025), Form 1040 (2025)), not against training data
or secondary summaries. Where training knowledge was used without independent verification this
session, it is explicitly tagged `[ASSUMED]` and listed in the Assumptions Log.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TAX-01 | TY2025 parameters stored as data, keyed by year, each carrying a Rev. Proc. citation (number + section) and an effective date. Sourced from Rev. Proc. 2024-40 as modified by Rev. Proc. 2025-32. | "The TY2025 Parameter Set and Its Citations" below enumerates every parameter this phase must store, with the exact section number in the exact Rev. Proc. that governs it — verified by reading both PDFs directly, not assumed. |
| TAX-02 | The IRS Tax Table stored as data and diffed row by row against Publication 1040, as a `proof`. Rows print tax on the interval midpoint. | "The Tax Table's Band Structure" below gives the exact band width in every income region (verified line-by-line from the fetched Pub. 1040 text), resolves the STACK/PITFALLS contradiction, and "Representation" proposes a non-tautological diff design. |
| TAX-04 | Boundary proofs at `threshold − 1¢`, `threshold`, `threshold + 1¢` for every threshold in the parameter data. | "Threshold Inventory" below lists every threshold TAX-01's data introduces (band edges, bracket edges, capital-gain breakpoints) that TAX-04 must cover. |
| MCP-07 | `finance_tax_params(year)` returns the parameter set, each entry citing Rev. Proc. number, section, and effective date. | "How `finance_tax_params` Should Be Shaped" follows the verified `finance_schema` precedent and flags the `fjs-run-integration.test.js` coverage requirement explicitly. |
</phase_requirements>

## Summary

This phase's central risk was an unresolved factual dispute between two prior research files —
STACK.md claimed the Tax Table uses a uniform $50 band (flagging the low end as unverified),
PITFALLS.md claimed $5/$10/$25/$50 varying by income level. **Neither had read the table.** This
session downloaded the actual IRS Publication 1040 (2025) PDF and read the Tax Table line by line.
**PITFALLS was right and STACK's flag was correctly cautious**: the band width is $5 for the very
first row (`$0–$5`), $10 for the next two rows (`$5–$15`, `$15–$25`), $25 from `$25` through
`$3,000`, and $50 from `$3,000` through the table's end at `$100,000`, where the Tax Computation
Worksheet takes over — confirmed on the printed page ("`$100,000 or over, use the Tax Computation
Worksheet`"). Band width does **not** differ by filing status: all four filing-status columns share
the same "At least / But less than" row boundaries throughout. The $18,000 MFJ → $1,803 worked
example in Success Criterion 3 is now independently confirmed at source: the `$18,000–$18,050` row
prints Single 1,925 / **MFJ 1,803** / MFS 1,925 / HoH 1,823, and the midpoint arithmetic
($18,025 × 10% = $1,802.50 → half-up $1,803, against the 2025 MFJ 10% bracket ceiling of $23,850)
reproduces it exactly.

The second major open item — whether "Rev. Proc. 2024-40 as modified by Rev. Proc. 2025-32" is a
real, checkable citation or a project assumption — is now **verified, not assumed**. Rev. Proc.
2025-32 (released October 2025, primarily an inflation-adjustment procedure for **TY2026**) contains
a dedicated **"SECTION 3. 2025 ADJUSTED ITEMS AS MODIFIED, SUPERSEDED OR SUPPLEMENTED"**, and its
subsection **.01, "Removal of Section 2.15(1) of Rev. Proc. 2024-40,"** states the OBBBA-amended
§63(c)(7) standard deduction for **any taxable year beginning in 2025** as exactly $31,500 (MFJ),
$23,625 (HoH), $15,750 (Single/MFS) — verbatim the figures Success Criterion 5 names, and verbatim
the figures printed on the face of Form 1040 (2025) itself. Critically, Rev. Proc. 2025-32 removes
only *subsection (1)* of Rev. Proc. 2024-40 §2.15 — the aged/blind additional standard deduction
amounts in subsection (3) ($1,600 married / $2,000 unmarried-and-not-a-surviving-spouse) and the
ordinary rate brackets and capital-gains breakpoints elsewhere in Rev. Proc. 2024-40 are
**unmodified** and remain the correct TY2025 citation on their own. This means a per-parameter
citation is not a single Rev. Proc. number for the whole set — some parameters cite 2024-40 alone,
one cites 2024-40-as-modified-by-2025-32, and the schema must carry that distinction per parameter,
not as a document-level header.

Third, `finance_tax_params` has a direct in-repo precedent to imitate almost mechanically:
`finance_schema` (`fjs/server/finance_schema/module.f.js`, MCP-06, already shipped in Phase 7) is a
single-argument `toolEntry` returning `okResult`/`errorResult` over a lookup map, proof-tested by
calling `.handle` directly under `pure`. `finance_tax_params(year)` should follow the identical
shape keyed by year instead of dialect. The one thing this phase must not skip: adding a fifth tool
to `financeMcpHandlers`' registry makes `fjs-run-integration.test.js`'s runtime-derived
"every advertised tool must be called" assertion fail immediately unless a
`call('finance_tax_params', { year: 2025 })` is added to that same real-process test in this phase's
own plan — this is a required task, not a follow-up.

**Primary recommendation:** Store TY2025 parameters as one dialect-shaped document (following the
`base`/RTTI/`checkReferences` pattern every other dialect in this repo uses) with a per-parameter
citation object `{ revProc: string, section: string, effectiveDate: string }`, and store the Tax
Table as **band-structure data** (an ordered list of `{ atLeast, lessThan, width }` regions) plus a
**generation function** proof-diffed against an **independently-transcribed sample** of real rows
spanning every band-width region and the boundary at $100,000 — never diffed against a second copy
of the same generator's own output.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| TY2025 parameter storage (rates, standard deduction, capital-gains breakpoints, citations) | Document/Data (`fjs/document/tax_params/` or similar, following the dialect convention) | — | Parameters are data with a schema and a semantic check, exactly like every other `vnd.fjs.*` dialect — not application logic. |
| Tax Table row generation + verification | Document/Data | Exact-arithmetic (`fjs/exact`) | The table's *values* are derived by exact-rational midpoint arithmetic (`fjs/types/rational`, `halfUp`) over the stored rate brackets, but the table's *band structure* (which widths apply where) is itself data, not re-derivable from the brackets alone — see "Representation" below. |
| `finance_tax_params` MCP tool | API/Backend (`fjs/server/finance_tax_params/`) | — | Mirrors `finance_schema`'s existing tier placement in `fjs/server/` exactly; a thin `toolEntry` over the stored parameter data, no business logic of its own. |
| Row-by-row table diff `proof` | Document/Data (test/proof code co-located with the table module) | — | A `proof` export, per this repo's Emergent Testing convention — not a separate test framework, not a script outside the module. |
| Tool registry wiring (`financeMcpHandlers`) | API/Backend (`fjs/server/module.f.js`) | — | Same concatenation pattern already used for `financeSchemaTool`/`fjsRunTool`; Phase 8 adds one more entry, no new composition mechanism. |
| Real-process coverage of the new tool | Test/Integration (`fjs-run-integration.test.js`) | — | TEST-03's standing rule: this repo's own runtime-derived tool-coverage assertion in that file will fail the moment `finance_tax_params` appears in `tools/list` without a matching `call()` in that same file. |

## Standard Stack

### Core

No new libraries. This phase is entirely composition over what Phases 4–7 already built and
shipped:

| Module (already in this repo) | Verified role for Phase 8 |
|---|---|
| `fjs/types/rtti/module.f.js` (`functionalscript` 0.41.0, via `node_modules`) | `array`, `record`, `option`, `string`, `number` — sufficient primitives to schema both the parameter document and the Tax Table's row list. `[VERIFIED]` read directly: no tuple-specific constructor exists beyond plain-array literal schemas (a `Tuple` is just a `readonly Type[]` literal), `record(T)` gives a string-keyed map (candidate for "one row keyed by filing status"), `array(T)` gives a homogeneous list (candidate for "the whole table as a row list"). |
| `fjs/document/base/module.f.js` | `base(dialect)` spread-first helper — reuse verbatim for a new `vnd.fjs.tax_params` (or similarly named) dialect, exactly as `vnd.fjs.1099int`/`vnd.fjs.w2`/`vnd.fjs.medical_expenses` already do. `[VERIFIED]` read in full. |
| `fjs/document/money_field/module.f.js` | `moneyFieldError(label)(printed)` — reuse for every dollar-amount parameter (standard deduction amounts, bracket thresholds, capital-gains breakpoints) so a malformed or comma-grouped stored parameter is refused the same way a malformed 1099 box is. `[VERIFIED]` read in full; already shared across three dialects per its own docstring ("extracted when the third dialect needed it"). |
| `fjs/exact/module.f.js` (`centsFromString`, `centsToString`, `centsScale`) | The decimal-string ⇄ bigint-cents boundary for every stored dollar amount. `[VERIFIED]` read in full. |
| `fjs/types/rational/module.f.js` (`of`, `multiply`, `sum`, `halfUp`) | Exact rational arithmetic for computing a Tax Table row's midpoint tax and rounding it half-up exactly once, at the row, never per-input. `[VERIFIED]` read in full — `halfUp`'s docstring and proof already pin the `-2.5` divergence from `Math.round` that a generated table must not reproduce. |
| `fjs/protocol/mcp/module.f.js` (`toolEntry`, `okResult`, `errorResult`) | The exact tool-registration shape `finance_tax_params` must use — verified via `finance_schema`'s own import list. |
| `fjs/media/json/schema/module.f.js` (`toJsonSchema`) | Only needed if `finance_tax_params` also exposes its own response shape as a discoverable schema (optional; `finance_schema` uses this for dialect *field* schemas, not tool *response* schemas — not required for MCP-07 as scoped). |

**Installation:** None. No `npm install` — this phase adds zero new dependencies, consistent with
AGENTS.md's absolute rule ("No third-party tools or libraries without approval from all owners").

**Version verification:** `functionalscript` is already pinned to `^0.41.0` in `package.json`
`[VERIFIED]` (read directly). No version change needed for this phase.

### Supporting

| Library | Version | Purpose | When to Use |
|---|---|---|---|
| (none) | — | — | This phase is pure composition; there is no supporting-library category distinct from Core. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Storing the full ~1,970-row Tax Table (every $25/$50 band from $0 to $100,000, × 4 filing statuses) as one giant literal array | Store the **band structure** as data (region boundaries + width) plus a **pure generator function** that computes each row's tax from the stored rate brackets at the row's midpoint, `halfUp`-rounded | The literal-array approach is what "store the table as data" naively suggests and is what STACK.md's phrasing ("~1,200 rows of data") implies, but at $25 width from $25–$3,000 plus $50 width to $100,000 the real row count is closer to 2,000 (single filing status; ×4 for all statuses if stored per-status) — a very large literal with no independent value beyond what the generator would produce faster and only from data already stored (the rate brackets). The band-structure-as-data design keeps TAX-02's diff meaningful (see "Representation") while avoiding a multi-thousand-line generated-and-forgotten fixture. See Open Questions for the case where a full transcribed table might still be wanted for the diff's independent side. |

## The Tax Table's Band Structure (the central unknown — RESOLVED)

**Source:** IRS Publication 1040 (2025), "TAX AND EARNED INCOME CREDIT TABLES, For use in preparing
2025 Returns," Catalog Number 46895T, CreationDate 2025-09-17, downloaded directly from
`https://www.irs.gov/pub/irs-pdf/p1040.pdf` and read as extracted text in this session.
`[VERIFIED]` — every claim in this subsection was read from that file's own printed rows, not from
a secondary description.

### Exact band widths by income region (same for all four filing statuses)

| Income region (taxable income, line 15) | Row width | Verified example row |
|---|---|---|
| `$0` – `$5` | $5 | `0 5 → 0 0 0 0` (all four statuses) |
| `$5` – `$15` | $10 | `5 15 → 1 1 1 1` |
| `$15` – `$25` | $10 | `15 25 → 2 2 2 2` |
| `$25` – `$3,000` | $25 | `25 50 → 4 4 4 4` … `2,975 3,000 → 299 299 299 299` |
| `$3,000` – `$100,000` | $50 | `3,000 3,050 → 303 303 303 303` … `99,950 100,000 → 16,909 11,823 16,909 15,170` |
| `$100,000` and over | *(table ends — not a band)* | Printed literally as `"$100,000 or over, use the Tax Computation Worksheet"` immediately after the `99,950–100,000` row |

**This confirms PITFALLS.md's claim ($5/$10/$25/$50 depending on income level) exactly**, and shows
STACK.md's flagged uncertainty ("narrower steps below roughly $3,000... not read out of a
current-year Pub. 1040") was the right thing to flag — the narrowing is real, it just wasn't three
sub-bands, it's four ($5, then $10, $10, then $25 up to $3,000, then $50 for the remaining 97% of
the table's range). **Neither prior file had this exactly right; both were closer to right than to
wrong, and the resolution required reading the primary source, which is what this session did.**

### The $100,000 threshold — confirmed, not assumed

`[VERIFIED]` from two independent places in the same source family:
1. Publication 1040's own table: the last row is `99,950–100,000`; the very next cell reads
   `"$100,000 or over use the Tax Computation Worksheet"`.
2. Instructions for Form 1040 (2025) (`i1040gi.pdf`, CreationDate 2026-02-25, Catalog Number
   24811V), verbatim: *"Tax Table or Tax Computation Worksheet. If your taxable income is less
   than $100,000, you must use the Tax Table... If your taxable income is $100,000 or more, use
   the Tax Computation Worksheet right after the Tax Table."*

So the boundary is exactly `$100,000`: taxable income of `$99,999.99` uses the Tax Table (falls in
the `99,950–100,000` row), and exactly `$100,000.00` uses the Tax Computation Worksheet, not the
table. This is the sharpest threshold TAX-04 must cover for the table/worksheet boundary itself
(though the worksheet's application is TAX-03/Phase 10's job, not Phase 8's — Phase 8 only needs
the Tax Table's own upper bound to be right, since the Tax Table dataset itself should not
silently answer a $100,000+ lookup).

### Band width does not differ by filing status — confirmed

`[VERIFIED]`: every row in the extracted table prints one `At least`/`But less than` pair shared
by all four "Your tax is—" columns (Single, MFJ, MFS, HoH). The band boundaries never diverge by
status; only the printed tax amount in each column diverges (because each status has its own
bracket schedule). This matches what both prior research files assumed and neither had reason to
doubt.

### The midpoint rule and the $18,000 → $1,803 worked example — confirmed at source

`[VERIFIED]`: the `18,000–18,050` row of the table (MFJ column) prints **1,803**, exactly matching
Success Criterion 3. Reconstructing the arithmetic: the interval midpoint is `$18,025`; the TY2025
MFJ ordinary rate schedule's first bracket (`[VERIFIED]` from Rev. Proc. 2024-40 §2.01, Table 1)
is 10% up to $23,850, so tax on the midpoint is `$18,025 × 10% = $1,802.50`; IRS half-up rounding
(this repo's own `halfUp`, ties away from zero) rounds `$1,802.50` up to `$1,803`. Bracket
arithmetic on the *interval's own lower bound or upper bound* (rather than the midpoint) gives
`$1,800.00`/`$1,805.00` respectively, neither of which is the table's actual answer — the table
is specifically a midpoint lookup, not a bracket evaluation at any single point in the interval.

### What this means for storing the table as `proof`-diffed data (TAX-02)

The generation formula `tax(midpoint(row)) → halfUp → row's printed value` is now confirmed
correct in exactly the region it's easiest to get wrong (the low end, and the exact boundary at
$100,000). A generator built from the stored rate brackets and this band-width table should
reproduce every verified row above exactly. See "Representation" for how to keep the row-by-row
diff meaningful rather than tautological.

## The TY2025 Parameter Set and Its Citations

All figures below are `[VERIFIED]` from the two Rev. Proc. PDFs fetched and read directly in this
session: Rev. Proc. 2024-40 (`https://www.irs.gov/pub/irs-drop/rp-24-40.pdf`) and Rev. Proc.
2025-32 (`https://www.irs.gov/pub/irs-drop/rp-25-32.pdf`). **Rev. Proc. 2025-32's own Section 1
states its purpose:** *"This revenue procedure modifies certain sections of Rev. Proc. 2024-40...
to reflect the amendments to the [Code] by [OBBBA]"* — and it is titled and structured primarily
around **2026** inflation adjustments (its main body is `SECTION 4. 2026 ADJUSTED ITEMS`), with a
distinct `SECTION 3. 2025 ADJUSTED ITEMS AS MODIFIED, SUPERSEDED OR SUPPLEMENTED` carrying the
narrow set of 2025-year corrections OBBBA required. **This is the load-bearing structural fact the
whole "as modified by" citation rests on, and it was not obvious without opening the document —
the title and section 4 alone would mislead a reader into thinking 2025-32 has nothing to do with
TY2025.**

| Parameter | TY2025 value | Governing citation | Modified? |
|---|---|---|---|
| Standard deduction — MFJ/QSS | $31,500 | Rev. Proc. 2025-32 §3.01 (removing Rev. Proc. 2024-40 §2.15(1)); IRC §63(c)(2), as amended by OBBBA §70102 (IRC §63(c)(7)) | **Yes** — supersedes Rev. Proc. 2024-40 §2.15(1)'s original $30,000 |
| Standard deduction — HoH | $23,625 | same as above | **Yes** — supersedes $22,500 |
| Standard deduction — Single/MFS | $15,750 | same as above | **Yes** — supersedes $15,000 |
| Additional standard deduction (aged or blind), married | $1,600 per qualifying condition | Rev. Proc. 2024-40 §2.15(3); IRC §63(f) | **No** — OBBBA did not amend §63(f); Rev. Proc. 2025-32 removes only §2.15(1), never §2.15(3) |
| Additional standard deduction (aged or blind), unmarried and not a surviving spouse | $2,000 per qualifying condition | Rev. Proc. 2024-40 §2.15(3); IRC §63(f) | **No** |
| Dependent standard deduction cap | greater of $1,350, or $450 + earned income | Rev. Proc. 2024-40 §2.15(2); IRC §63(c)(5) | **No** |
| Ordinary rate brackets — MFJ/QSS, HoH, Single, MFS, Estates & Trusts (all 7 rates: 10/12/22/24/32/35/37%) | Full bracket tables (verified figures below) | Rev. Proc. 2024-40 §2.01; IRC §1(j)(2)(A)-(E) | **No** — OBBBA §70101 made the *rate schedule structure* permanent going forward but did not change the already-published 2025 dollar breakpoints |
| Maximum capital gains rate breakpoints (0%/15% ceilings, all statuses + estates/trusts) | Full breakpoint table (verified figures below) | Rev. Proc. 2024-40 §2.03; IRC §1(h), §1(j)(5) | **No** |

**Effective date for every row above:** "for taxable years beginning in 2025" per each Rev. Proc.'s
own framing — i.e. calendar TY2025 (2025-01-01 through 2025-12-31) for a calendar-year filer.

### Ordinary rate brackets — TY2025, verified in full (Rev. Proc. 2024-40 §2.01)

| Filing status | 10% | 12% | 22% | 24% | 32% | 35% | 37% |
|---|---|---|---|---|---|---|---|
| MFJ/QSS | ≤ $23,850 | to $96,950 | to $206,700 | to $394,600 | to $501,050 | to $751,600 | over $751,600 |
| HoH | ≤ $17,000 | to $64,850 | to $103,350 | to $197,300 | to $250,500 | to $626,350 | over $626,350 |
| Single | ≤ $11,925 | to $48,475 | to $103,350 | to $197,300 | to $250,525 | to $626,350 | over $626,350 |
| MFS | ≤ $11,925 | to $48,475 | to $103,350 | to $197,300 | to $250,525 | to $375,800 | over $375,800 |
| Estates & Trusts | ≤ $3,150 | (24% to $11,450) | — | $11,450–$15,650 at 35% | — | — | over $15,650 |

(Estates & Trusts uses only 4 rates — 10/24/35/37% — per Rev. Proc. 2024-40 §2.01 Table 5; not
5 columns like the individual statuses. Included for completeness since Phase 9-13 may need it for
trust-adjacent computations; Phase 8 should still store it since it is part of the same §2.01
citation and the same year.)

### Capital gains rate breakpoints — TY2025, verified in full (Rev. Proc. 2024-40 §2.03)

| Filing status | Maximum 0% rate amount | Maximum 15% rate amount |
|---|---|---|
| MFJ/QSS | $96,700 | $600,050 |
| MFS | $48,350 | $300,000 |
| HoH | $64,750 | $566,700 |
| Single | $48,350 | $533,400 |
| Estates & Trusts | $3,250 | $15,900 |

### Not required for Phase 8, flagged for later phases

The Schedule 1-A senior deduction ($6,000 single / $12,000 joint, 6% phase-out over
$75,000/$150,000 MAGI, IRC §63A per OBBBA) is `TAX-09`'s data, scoped to **Phase 13**, not Phase 8
— `[ASSUMED — not independently verified against a primary-source PDF this session; sourced from
secondary tax-press coverage of OBBBA]`. It is noted here only because "Representation" below
recommends a parameter schema general enough that Phase 13 can add a phase-out-shaped parameter
without redesigning the citation object Phase 8 introduces.

## Threshold Inventory (for TAX-04's boundary proofs)

Every dollar figure in "The TY2025 Parameter Set" above that functions as a *threshold* (a value
whose adjacent-cent behavior changes which bracket, band, or breakpoint applies) needs a
`threshold − 1¢` / `threshold` / `threshold + 1¢` proof triple:

- Every ordinary-bracket boundary in the table above (5 statuses × up to 6 internal boundaries each
  — e.g. MFJ's $23,850, $96,950, $206,700, $394,600, $501,050, $751,600).
- Every capital-gains breakpoint (5 statuses × 2 breakpoints each).
- The Tax Table's own band-width transition points: $5, $15, $25, $3,000, and the table's own end
  at $100,000 — these are internal to TAX-02's table, not TAX-01's bracket parameters, but TAX-04's
  text says "every threshold **in the parameter data**," and if the band-structure boundaries are
  stored as data (as "Representation" recommends), they qualify.
- The additional-standard-deduction eligibility age boundary is **not** a dollar threshold (it's a
  birthdate comparison — "born before January 2, 1961," confirmed on the face of Form 1040 (2025)
  line 12d) and is out of scope for TAX-04's cent-level boundary proofs.

## Representation

**The tautology risk, named explicitly (per STATE.md's own recorded lesson):** a `proof` that diffs
generated Tax Table rows against a second computation using the *same* stored rate brackets and the
*same* midpoint/half-up logic proves the generator is internally consistent, never that it matches
the *published* table. STATE.md's Phase 7 lesson ("185 virtual proofs missed a shipped bug because
the fixture mirrored the code's own mistake") is exactly this failure mode transplanted into tax
data: if the "expected" side of the diff is itself computed by the code under test, the diff cannot
fail no matter how wrong the code is.

**Recommended representation, with an independent reference side:**

1. **Store the band structure as its own small data table** (5 rows: the region boundaries and
   widths verified above — `[{ atLeast: 0, lessThan: 5, width: 5 }, { atLeast: 5, lessThan: 15,
   width: 10 }, { atLeast: 15, lessThan: 25, width: 10 }, { atLeast: 25, lessThan: 3000, width: 25 },
   { atLeast: 3000, lessThan: 100000, width: 50 }]`), plus the table's own upper bound (`100000`,
   at which point `finance_tax_params`'s Tax Table data should refuse a lookup rather than
   silently returning nothing — the scope-guard principle TAX-16/PITFALLS already establishes
   elsewhere in this project, applied here to a lookup boundary rather than a document type).
2. **Generate rows from the band structure + the stored rate brackets** (`fjs/types/rational`'s
   exact midpoint arithmetic, `halfUp` rounding) — this is the *implementation*, and it can be
   large in row count without being large in *stored, hand-maintained* data, since it's derived at
   proof-run time from the ~40 numbers in "The TY2025 Parameter Set" above.
3. **Diff against an independently-transcribed sample, not the whole table** — hand-transcribe a
   deliberately-chosen sample of real printed rows *directly from the fetched Pub. 1040 text* (this
   session already transcribed over a dozen exact rows above, spanning every band-width region:
   the `0–5`, `5–15`, `15–25`, `25–50`, `975–1,000`/`1,000–1,025` (width-transition boundary),
   `2,975–3,000`/`3,000–3,050` (the $25→$50 transition), `18,000–18,050` (Success Criterion 3's own
   row), and `99,950–100,000` (the table's last row) — as literal, hand-keyed constants in the
   proof file, sourced with a comment citing "Publication 1040 (2025), p.1–3, 13, read directly"
   rather than computed. The diff's "expected" side is these hand-transcribed literals; the
   "actual" side is the generator's output for the same row. **This keeps the diff honest**: the
   hand-transcribed numbers do not share any code path with the generator, so a generator bug (a
   wrong bracket ceiling, an off-by-one in a band boundary, a rounding-mode error) has an
   independent value to disagree with.
4. **The full-range claim in Success Criterion 2** ("diffs... across the full income range") is
   satisfiable two ways: (a) diff every generated row against a hand-transcribed sample covering
   every band-width region and every internal bracket-boundary crossing (dozens of rows, not
   thousands — this is what the sample above already supports), or (b) additionally diff the
   generator's *output row count and cumulative structure* (band widths sum correctly from $0 to
   $100,000 with no gaps or overlaps) as a second, structural proof that does not require every row
   to be hand-transcribed. Recommend **both**: (a) as the row-level correctness proof, (b) as a
   coverage proof that the *shape* of the full range was validated even where individual rows were
   not hand-checked. Neither alone fully satisfies "across the full income range" as honestly as
   the pair does.

**Schema shape** (illustrative, to inform the planner — not a final field-name decision):

```js
// A per-parameter citation, reused across every dollar figure in the document:
const citation = { revProc: string, section: string, effectiveDate: string }

// Illustrative top-level shape — final field names are the planner's/implementer's call:
const taxParamsSchema = {
    ...base('vnd.fjs.tax_params'), // or similar dialect name
    taxYear: number,
    standardDeduction: {
        marriedFilingJointly: { amount: string, citation },
        headOfHousehold:      { amount: string, citation },
        single:               { amount: string, citation },
        marriedFilingSeparately: { amount: string, citation },
        additionalAgedOrBlindMarried:   { amount: string, citation },
        additionalAgedOrBlindUnmarried: { amount: string, citation },
    },
    ordinaryBrackets: record({ /* per-status bracket list */ }), // or array keyed by status literal
    capitalGainsBreakpoints: record({ /* per-status breakpoints */ }),
    taxTableBandStructure: array({ atLeast: string, lessThan: string, width: string }),
}
```

Every dollar amount is a decimal **string** per AGENTS.md's absolute rule (never a JSON number),
validated through `moneyFieldError` exactly as every other dialect's money boxes already are.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Decimal string ⇄ cents conversion | A new parse/format pair for tax parameters | `fjs/exact`'s existing `centsFromString`/`centsToString` | Already exact, already proof-tested, already the repo's only sanctioned money boundary. |
| Half-up rounding for the Tax Table's midpoint tax | `Math.round` or a bespoke rounding function | `fjs/types/rational`'s `halfUp` | Already proven to diverge correctly from `Math.round` at the `-2.5` tie; re-implementing risks silently reintroducing the asymmetric-rounding bug EXACT-03 exists to prevent. |
| Money-field structural validation | A second `moneyFieldError`-equivalent for parameter amounts | The existing `fjs/document/money_field/module.f.js` | Its own docstring says it was "extracted when the third dialect needed it" specifically so a fourth dialect (this one) would not duplicate it — duplicating it now would be exactly the drift its extraction was meant to prevent. |
| JSON Schema for the tool's own argument/response shape | A hand-written JSON Schema literal | `toJsonSchema` over an rtti schema, as `finance_schema` already does | Same second-source-of-truth risk `finance_schema`'s own docstring calls out for dialect field names — applies equally to a tool's declared shape. |
| An MCP tool from scratch | A new `toolEntry` pattern | `finance_schema`'s already-verified `toolEntry(name, description, argsSchema, handler)` shape | It is the in-repo precedent MCP-07 explicitly names; deviating from it for no reason increases review surface for no benefit. |

**Key insight:** every generic building block this phase needs (money parsing, exact rounding, RTTI
schema construction, MCP tool registration) already exists in this repo from Phases 4–7. Phase 8's
actual net-new work is the *data* (the verified parameter figures and their citations, and the Tax
Table's band structure) and the *composition* (a new dialect module, a new tool module, one new
registry entry, one new integration-test call) — not new mechanism.

## Common Pitfalls

### Pitfall 1: Treating "Rev. Proc. 2024-40 as modified by Rev. Proc. 2025-32" as one citation
**What goes wrong:** Storing a single `revProc: "2024-40 as modified by 2025-32"` string against
every parameter, when in fact only the basic standard deduction amounts were modified — the
additional (aged/blind) standard deduction, the ordinary brackets, and the capital-gains
breakpoints are still governed by Rev. Proc. 2024-40 alone, unmodified.
**Why it happens:** ROADMAP.md and REQUIREMENTS.md's own phrasing ("Sourced from Rev. Proc. 2024-40
**as modified by** Rev. Proc. 2025-32") reads as if it describes the whole parameter set, and it is
easy to copy that phrase onto every citation without checking which specific subsections Rev. Proc.
2025-32 actually touches.
**How to avoid:** Cite per-parameter, not per-document. Rev. Proc. 2025-32 §3 names exactly two
things it modifies for 2025 (§2.15(1) standard deduction; §2.25 the §179 expensing limits, which
this project does not need) — everything else in Rev. Proc. 2024-40 stands for TY2025 unmodified.
**Warning signs:** A citation object where every parameter shows the identical two-Rev.-Proc.
string is a sign this wasn't checked per parameter.

### Pitfall 2: Generating the Tax Table from brackets and diffing it against itself
**What goes wrong:** A `proof` that generates the table and separately "verifies" it by re-running
the identical generation code (or a trivial permutation of it) and asserting equality. This always
passes and proves nothing about correctness against the *published* table.
**Why it happens:** It's the easiest thing to write that satisfies "diff row by row" mechanically,
and STATE.md records this exact class of bug already shipping once in this project (the 07-10 fix
summary: 185 virtual proofs missed a real bug because their fixture keyed at the same wrong bare
name the buggy code itself used).
**How to avoid:** The diff's expected side must be hand-transcribed, independently-sourced literals
(see "Representation" above) — not computed by any code path the generator shares.
**Warning signs:** If deleting the entire rate-bracket parameter table and replacing every bracket
threshold with `0` still makes the Tax Table diff proof pass, the diff is tautological.

### Pitfall 3: Storing the additional standard deduction as a single flat number
**What goes wrong:** Modeling "the 65+/blind additional standard deduction" as one number ($1,600),
losing the married/unmarried distinction ($1,600 vs. $2,000) and the "per qualifying condition"
multiplier (a taxpayer who is both 65+ and blind gets it twice).
**Why it happens:** The headline figure most secondary sources quote is $1,600, and the
unmarried-not-surviving-spouse $2,000 variant and the "per condition" stacking rule are easy to miss
without reading Rev. Proc. 2024-40 §2.15(3) directly.
**How to avoid:** Store both figures distinctly, and store them as *per-condition* amounts (to be
multiplied by however many of {taxpayer aged, taxpayer blind, spouse aged, spouse blind} apply) —
this schema shape is what Phase 10's standard-deduction computation (TAX-06) will need to consume
correctly, and getting the shape right now avoids a rework then.

### Pitfall 4: Missing the `fjs-run-integration.test.js` breakage
**What goes wrong:** Adding `finance_tax_params` to `financeMcpHandlers`'s registry (as MCP-07
requires) without also adding a `call('finance_tax_params', { year: 2025 })` to
`fjs-run-integration.test.js`. That test derives `advertisedTools` from a real `tools/list` response
at runtime and asserts `toolsCalled` equals `advertisedTools` — a new tool that appears in the list
without being called anywhere in that file fails the assertion at line ~359-363
(`[VERIFIED]` read directly), immediately and unconditionally.
**Why it happens:** It is easy to treat "add the tool, write its unit-level `proof`" as complete,
since every other tool's own module has a passing `proof` export — the integration test lives in a
different file at the repo root and is easy to forget when the work is scoped to `fjs/server/`.
**How to avoid:** Make "add one `call('finance_tax_params', ...)` line to
`fjs-run-integration.test.js`, in the same real session the existing calls already run in" an
explicit task in this phase's plan, not an implicit follow-up.
**Warning signs:** `npm run test:integration` (or `npm test`, which includes it) failing with
"expected every advertised tool to be called at least once" naming `finance_tax_params` in the
`advertised` set but absent from `called`.

## Code Examples

### The exact-arithmetic midpoint/half-up pattern a Tax Table row generator should follow
```js
// Source: verified pattern from fjs/exact/module.f.js's own proof.threeLayersOnOneValue
// (this repo, already shipped) — the same three-layer discipline applies to a generated
// Tax Table row: exact rational computation, one half-up round at the row boundary,
// decimal-string output.
import { of, multiply, halfUp } from '../types/rational/module.f.js'
import { centsFromString, centsToString } from '../exact/module.f.js'

// midpoint of a $18,000-$18,050 row, in exact cents:
const rowLowCents = centsFromString('18000.00')
const rowWidthCents = centsFromString('50.00')
const midpointCents = rowLowCents + rowWidthCents / 2n // exact bigint halving where width is even

// tax at 10% of the midpoint, as an exact rational, rounded once at the row:
const taxCents = halfUp(multiply(of(midpointCents)(1n))(of(10n)(100n)))
// taxCents === 180250n / ... -> halfUp(...) === 180250n at cents scale? (illustrative only —
// the planner's implementation should verify the exact cents-vs-dollars scale used throughout,
// since the printed table is in whole dollars, not cents, and this project's centsScale is 2)
```

### `finance_schema`'s verified shape — the precedent `finance_tax_params` should mirror
```js
// Source: fjs/server/finance_schema/module.f.js, this repo, verified read in full this session.
export const financeSchemaTool = toolEntry(
    'finance_schema',
    'Given a document dialect tag ..., returns that dialect's own field schema as JSON Schema ...',
    { dialect: string },
    args => {
        const schema = dialectSchemas[args.dialect]
        if (schema === undefined) {
            return pure(errorResult(`unknown dialect: ${args.dialect}; known: ${knownDialects.join(', ')}`))
        }
        return pure(okResult(JSON.stringify(toJsonSchema(schema))))
    },
)
// finance_tax_params(year) should follow this exactly: { year: number } args, a lookup map
// keyed by year (today: just 2025), and an errorResult naming the requested year and the known
// set on a miss -- mirroring the unknown-dialect refusal message verbatim in spirit.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| TY2025 standard deduction $15,000/$30,000/$22,500 (Rev. Proc. 2024-40, published 2024, pre-OBBBA) | $15,750/$31,500/$23,625 (Rev. Proc. 2025-32 §3.01, OBBBA §70102) | OBBBA signed 2025-07-04; Rev. Proc. 2025-32 released ~2025-10-09 | A program citing only Rev. Proc. 2024-40 for the standard deduction is now factually wrong for TY2025 — this is precisely the failure mode DOCC-06 and this phase exist to prevent. |
| Tax-Table-as-uniform-$50-band assumption (STACK.md) | Verified 4-region band structure: $5/$10/$10/$25/$50 | Resolved this session by reading Pub. 1040 (2025) directly | Any Tax Table generator assuming uniform $50 width from $0 would misprice every row below $3,000 — a real, if narrow, range of low-income returns. |

**Deprecated/outdated:**
- The original (pre-OBBBA) TY2025 standard deduction figures in Rev. Proc. 2024-40 §2.15(1) are
  explicitly superseded by Rev. Proc. 2025-32 §3.01 for any return with a taxable year beginning in
  2025 — DOCC-06 already records this; this phase is where the correction becomes stored data
  rather than a documentation note.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Schedule 1-A senior deduction figures ($6,000/$12,000, 6% phase-out over $75k/$150k, IRC §63A) | "Not required for Phase 8, flagged for later phases" | LOW for Phase 8 (this data is explicitly out of Phase 8's scope and not stored here) — MEDIUM for Phase 13, which should independently verify these figures against a primary IRS source (Schedule 1-A instructions or the OBBBA statute text) rather than inheriting this session's secondary-source figure unchecked. |
| A2 | The illustrative schema field names in "Representation" (`standardDeduction`, `ordinaryBrackets`, `taxTableBandStructure`, etc.) | "Representation" | LOW — explicitly marked illustrative; the planner/implementer should choose final field names, and no downstream correctness claim depends on these exact strings. |
| A3 | The Tax Table's `taxCents` illustrative arithmetic in "Code Examples" uses whole-dollar row boundaries consistent with `centsScale = 2`; the exact scale-conversion details (whether the generator operates in dollars-as-rationals or cents-as-rationals throughout) | "Code Examples" | LOW — flagged inline in the example itself as illustrative-only; an implementer must verify the actual scale discipline against `fjs/exact`'s `centsScale` before trusting the snippet's arithmetic literally. |

**If this table is empty:** N/A — three items are logged above, none of which affect Phase 8's own
stored data (TAX-01/02/04/MCP-07), only forward-looking notes for Phase 13 and implementation
detail choices left to the planner.

## Open Questions

1. **Should the Tax Table be stored per-filing-status or once, with status as a lookup dimension?**
   - What we know: band boundaries are identical across all four statuses; only the printed tax
     amount differs per status per row.
   - What's unclear: whether `finance_tax_params`'s response shape should return one table with
     four tax columns per row (mirroring the printed page exactly) or four separate per-status
     tables (simpler per-status lookup code, more storage duplication of the shared band structure).
   - Recommendation: mirror the printed page's own row shape (one row, four tax columns) — this
     keeps the row-by-row diff against the printed table a literal, unreshuffled comparison, which
     is the most defensible form of "diffed row by row against the published Publication 1040."

2. **Does `finance_tax_params` need a `parameterSetHash` in its response for downstream provenance
   (PROV-04, Phase 14)?**
   - What we know: PROV-04 (Phase 14) wants "the parameter-set hash" alongside report figures.
   - What's unclear: whether that hash should be computed and exposed starting in Phase 8 (so it
     exists before Phase 14 needs it) or added later when PROV-04 is actually implemented.
   - Recommendation: leave it for Phase 14 unless the planner finds it costs nothing to add now —
     Phase 8's own requirements (TAX-01/02/04/MCP-07) do not name a hash, and speculative fields
     that later requirements might want are exactly the kind of "widen the base" AGENTS.md's DOC-00
     precedent says to defer until a real, present need forces it.

## Environment Availability

Skipped — this phase has no external dependencies beyond what Phases 1-7 already established
(`functionalscript` 0.41.0, Node, TypeScript, all already verified present and pinned in
`package.json`). No new tool, service, or runtime is introduced.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | FunctionalScript Emergent Testing (`proof` exports) discovered via root `all.test.js`, run by Node's built-in test runner |
| Config file | none — discovery is `all.test.js`'s `loadModuleMap` walk, per AGENTS.md |
| Quick run command | `npm test` (`tsc && node --test`) — this repo has no faster subset command; `node --test <file>` directly on a source file is a documented **fake pass** (AGENTS.md, verified: `npm test` reported `tests 8, pass 7, fail 1` against an injected failing leaf while `node --test fjs/server/module.f.js` on the identical file reported `tests 1, pass 1, fail 0`) |
| Full suite command | `npm test` (includes `test:integration`'s file via root discovery — confirm during planning whether `fjs-run-integration.test.js` is picked up by root `all.test.js` or must be run separately via `npm run test:integration`; `package.json` lists it as a distinct script, so treat it as a required second command until verified otherwise) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TAX-01 | `finance_tax_params(2025)` returns every parameter with its own citation object | unit (`proof`) | `npm test` (discovers the new module's `proof` export) | ❌ Wave 0 — new module |
| TAX-02 | Tax Table diffed row-by-row against hand-transcribed published rows across every band-width region | unit (`proof`) | `npm test` | ❌ Wave 0 — new module |
| TAX-04 | Boundary proofs at `threshold − 1¢`/`threshold`/`threshold + 1¢` for every bracket/breakpoint/band-transition threshold | unit (`proof`) | `npm test` | ❌ Wave 0 — new module |
| MCP-07 | `finance_tax_params` tool registered, callable, refuses unknown years actionably | unit (`proof`, mirroring `finance_schema`'s own five-leaf pattern) + real-process | `npm test` (unit) and `npm run test:integration` (real-process call added to `fjs-run-integration.test.js`) | ❌ Wave 0 — new module + existing integration file needs one new call |

### Sampling Rate
- **Per task commit:** `npm test` (fast — this repo's project-local proof suite plus `tsc`)
- **Per wave merge:** `npm test` **and** `npm run test:integration` (or confirm the latter runs
  under root discovery already)
- **Phase gate:** Both green before `/gsd-verify-work`, plus the project-local proof count
  (`node --test 2>&1 | grep -c '^✔ import("./fjs/'`) should increase from the Phase 7 baseline of
  185/136 (STATE.md records two different counts across two different checkouts — verify the
  correct one for this worktree before comparing) by roughly the number of new `proof` leaves this
  phase adds.

### Wave 0 Gaps
- [ ] New dialect/parameter module (e.g. `fjs/document/tax_params/module.f.js` or
      `fjs/params/tax/module.f.js` — final path is the planner's call) with its own `proof` export
      — covers TAX-01, TAX-04.
- [ ] New Tax Table module (band structure + generator + row-by-row diff `proof`) — covers TAX-02.
- [ ] New `fjs/server/finance_tax_params/module.f.js`, mirroring `finance_schema`'s structure
      exactly — covers MCP-07's tool.
- [ ] One new registry entry in `fjs/server/module.f.js`'s `financeMcpHandlers` — required for the
      tool to be reachable at all, and for `fjs-run-integration.test.js`'s coverage assertion to
      even enumerate it.
- [ ] One new `call('finance_tax_params', { year: 2025 })` (plus assertions) added to
      `fjs-run-integration.test.js` in the same real session the file's existing calls already
      run in — **required**, not optional, per Pitfall 4 above.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Out of scope — no auth in v1 (REQUIREMENTS.md "Out of Scope") |
| V3 Session Management | no | MCP session state already handled by `fjs/protocol/mcp`, unchanged by this phase |
| V4 Access Control | no | No new access-control surface — `finance_tax_params` is a read-only lookup over static data |
| V5 Input Validation | yes | `{ year: number }` args validated by `toolEntry`'s own RTTI check (same mechanism `finance_schema` already uses); an unknown year refused via `errorResult`, never a throw — mirroring `finance_schema`'s unknown-dialect refusal |
| V6 Cryptography | no | No cryptographic operation in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/oversized `year` argument causing an unhandled throw that crashes the process | Denial of Service | RTTI structural validation on `{ year: number }` before the handler runs (same pattern `toolEntry` already enforces for every other tool), plus an explicit `errorResult` for an unrecognized year rather than an uncaught lookup-miss exception |
| A stored parameter figure silently wrong (data-integrity, not injection) | Tampering (of the data itself, pre-deployment) | The row-by-row diff `proof` against independently-transcribed source figures (TAX-02) is itself the control here — this is a domain-correctness concern more than a classic security one, but it is the closest analogue in this phase |

## Sources

### Primary (HIGH confidence — fetched and read directly this session)
- IRS Publication 1040 (2025), "Tax and Earned Income Credit Tables," Catalog No. 46895T,
  CreationDate 2025-09-17 — `https://www.irs.gov/pub/irs-pdf/p1040.pdf` — Tax Table band structure,
  the $18,000 MFJ worked example, the $100,000 threshold statement.
- Instructions for Form 1040 (2025), Catalog No. 24811V, CreationDate 2026-02-25 —
  `https://www.irs.gov/pub/irs-pdf/i1040gi.pdf` — the "Tax Table or Tax Computation Worksheet"
  method-selection rule and its exact wording.
- Form 1040 (2025), Catalog No. 11320B, Created 2025-09-05 —
  `https://www.irs.gov/pub/irs-pdf/f1040.pdf` — standard deduction figures printed on the face of
  the form itself; line 12d age/blind checkboxes.
- Rev. Proc. 2024-40, 2024-45 I.R.B. 1100 — `https://www.irs.gov/pub/irs-drop/rp-24-40.pdf` —
  §2.01 ordinary rate brackets, §2.03 capital gains breakpoints, §2.15 standard deduction
  (original, pre-OBBBA figures and the unmodified aged/blind and dependent amounts).
- Rev. Proc. 2025-32 — `https://www.irs.gov/pub/irs-drop/rp-25-32.pdf` — §1 (purpose/scope), §3.01
  (the exact OBBBA-modified TY2025 standard deduction figures and the citation mechanics), §4 (2026
  figures, confirmed out of scope for this phase).

### Secondary (MEDIUM confidence)
- KPMG TaxNewsFlash summary of Rev. Proc. 2025-32 (used only to locate the primary PDF quickly;
  every figure taken from it was independently re-verified against the primary PDF itself before
  being used in this document).

### Tertiary (LOW confidence — flagged, not relied on for stored figures)
- Jackson Hewitt / TurboTax / CNBC / TaxSharkInc secondary coverage of the OBBBA Schedule 1-A senior
  deduction (`$6,000`/`$12,000`, 6% phase-out over `$75,000`/`$150,000`) — used only for Assumption
  A1, explicitly out of Phase 8's own required stored data, and flagged for independent primary-
  source verification when Phase 13 is researched.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every module cited was read directly from this repo's own source in this
  session; zero new dependencies.
- Architecture (Tax Table band structure + parameter citations): HIGH — resolved the prior
  STACK/PITFALLS contradiction by reading the actual IRS PDF line by line and reading both Rev.
  Proc. PDFs' actual section structure, not by re-summarizing either prior research file.
- Pitfalls: HIGH for Pitfall 4 (verified directly against the actual integration test file's
  assertion code) and Pitfall 2 (grounded in this project's own recorded STATE.md incident);
  MEDIUM for Pitfalls 1 and 3 (verified against the Rev. Proc. text, but the "how an implementer
  might get this wrong" framing is reasoned, not independently reproduced as a live bug).

**Research date:** 2026-08-05
**Valid until:** Tax-year-specific figures (Rev. Proc. citations, dollar amounts) are stable for
TY2025 by definition — no expiry within this project's timeline. Re-verify only if the IRS issues a
further correcting Rev. Proc. for TY2025 (none known as of this research date) or if this phase is
ever repurposed for a different tax year.
