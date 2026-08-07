# Phase 11: Wage, Retirement, and Benefit Documents - Research

**Researched:** 2026-08-07
**Domain:** IRS/SSA information-return box schemas (1099-R, SSA-1099), MCP tool registration, Evo/CAS retraction semantics
**Confidence:** MEDIUM-HIGH (box lists VERIFIED against fetched PDFs; retraction mechanism VERIFIED against installed upstream source; one HIGH-severity gap found and reported below)

## Summary

This phase adds two document dialects (`vnd.fjs.ssa1099`, `vnd.fjs.1099r`), one MCP tool
(`finance_documents_list`), and a retraction guarantee (DOC-15) that must be **enforced by a
proof**. The two dialects follow the established `fjs/document/1099int` four-stage template and
borrow `vnd.fjs.w2`'s two structural devices (a repeating state/local array, a list-shaped box
rather than fixed slots).

The box lists below were read from the actual PDFs fetched in this session, not from training
recall — this matters because Form 1099-R's box 7/8 structure has **genuinely changed between the
TY2025 revision (which is what the declared taxpayer's real documents carry) and the TY2026
revision (which is what `irs.gov/pub/irs-pdf/f1099r.pdf` currently serves)**. Both revisions were
fetched and diffed; the differences are documented in Q1 below and must inform the schema.

The most important finding in this research is **not** a box list. It is that the DOC-15
retraction decision, as stated in `11-CONTEXT.md` ("report programs see ACTIVE revisions only, by
construction"), is **not actually true of the shipped Phase 7 code today**. `buildRunSnapshot`
resolves archived subjects' heads and archived revisions into the same `RunSnapshot` a report
program's `evoList`/`evoHead`/`evoRevision` read from, with no archived-aware filtering at any of
those three layers. A report program that explicitly calls `ctx.evoList('true')` — nothing in the
type system or the interpreter prevents this — sees archived subjects today, then can read their
heads, revisions, and snapshot bytes exactly like any active document's. This phase's plan MUST
include a code change to `fjs/server/fjs_run/snapshot/module.f.js`, not just two new dialect files
and one new tool, or Success Criterion 4 ("enforced by a proof") will be provable false. See
**Q3** below for the precise mechanism and a concrete, scoped fix.

**Primary recommendation:** Model `vnd.fjs.1099r` against the TY2026 revision's fuller box set
(a strict superset of TY2025's), model `vnd.fjs.ssa1099` from IRS Publication 915 (2025)'s
Appendix sample (explicitly labeled SAMPLE, not a blank form — SSA-1099 has no IRS blank form
URL), implement `finance_documents_list` as a host-side tool over the Evo cache (mirroring
`finance_schema`/`finance_tax_params`, not a guest report program), and — before writing the
proof for Success Criterion 4 — patch `buildRunSnapshot` so archived revisions are excluded from
what a report program's host map can resolve.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOC-08 | `vnd.fjs.ssa1099` — required by the 65+ profile | Q2: full box list sourced from Pub 915 (2025) Appendix, with exact page/URL provenance and the payerTin-has-no-printed-value finding |
| DOC-09 | `vnd.fjs.1099r` — required by the 65+ profile | Q1: full box list from both the TY2025 and TY2026 revisions, diffed, with the formRevision-availability finding |
| DOC-15 | Retraction story: `archived` flag + a proof-enforced decision on whether report programs filter archived revisions | Q3: the buildRunSnapshot gap, its exact mechanism, and a scoped fix in `fjs/server/fjs_run/snapshot/module.f.js` |
| MCP-08 | `finance_documents_list` — enumerate stored documents with dialect, tax year, subject | Q4: host-side tool design over `evo.list`/`evo.head`/`evo.revision`/`cas.read`, the "non-revision blob" and "unknown dialect" edge cases resolved, and the same-commit integration-test constraint |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `vnd.fjs.ssa1099` / `vnd.fjs.1099r` schema + validation | Document/Storage (pure `.f.js`, no I/O) | — | Same tier as every existing dialect (`fjs/document/*`) — pure RTTI schema + semantic check, no CAS/Evo access inside the dialect module itself |
| `finance_documents_list` | API/Backend (MCP tool, host-side) | Database/Storage (reads the Evo cache + CAS) | Mirrors `finance_schema`/`finance_tax_params`: a `toolEntry` closed over host `Evo<O>`/`Cas<O>`, never routed through the guest `interpret`/`CasOp` sandbox — it is not a "report program" |
| Retraction enforcement (DOC-15) | Execution Spine (`fjs/server/fjs_run/snapshot`) | — | The guarantee is a property of what `buildRunSnapshot`/`buildHostMap` resolve for a GUEST report program, not a property of any document dialect or of `finance_documents_list` |
| `evo_add` (existing, reused for archiving) | API/Backend (already-registered MCP tool, upstream) | — | No new tool; DOC-15's "documented answer" is a documented `evo_add` call plus a proof, not new registry surface |

## Standard Stack

No new libraries. This phase is entirely additive `.f.js` modules over already-installed
`functionalscript` (`^0.43.1` per `package.json` — note this contradicts `AGENTS.md`'s own
MAINT-06 backlog item claiming a `^0.41.0` pin; **verified**: `package.json`'s `dependencies`
block reads `"functionalscript": "^0.43.1"` today. Not this phase's problem to fix, but the
planner should not assume the AGENTS.md figure is current).

### Core (already present, no install needed)
| Module | Purpose | Why it's already the standard |
|--------|---------|-------------------------------|
| `functionalscript/fjs/types/rtti/module.f.js` (`option`, `array`, `string`, `number`) | Schema primitives for the two new dialects | Same primitives every existing dialect uses |
| `functionalscript/fjs/types/rtti/validate/module.f.js` | Structural validation | Same `rttiValidate(schema)` pattern as `fjs/document/1099int` |
| `functionalscript/fjs/protocol/mcp/module.f.js` (`toolEntry`, `okResult`, `errorResult`) | `finance_documents_list`'s registration | Same as `finance_schema`/`finance_tax_params` |
| `functionalscript/fjs/cas/evo/module.f.js` (`evo`, `Evo<O>`) | Subject/head/revision reads for the new tool | Already used by `casRefreshTool`, `evoToolRegistry` |
| `functionalscript/fjs/basen/cbase32/module.f.js` (`cBase32ToVec`, `vecToCBase32`) | Hash conversion between Evo's string hashes and `Cas<O>.read`'s `Vec` argument | Already used throughout `fjs/server/module.f.js` and `fjs/server/fjs_run/snapshot` |
| `../base/module.f.js`, `../money_field/module.f.js` | Dialect base spread + money-box exactness check | Explicitly named reusable assets in `11-CONTEXT.md` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A host-side `finance_documents_list` toolEntry | A guest `Report<T>` program run via `fjs_run` | Rejected: MCP-08 wants a tool an agent calls directly with no program-authoring step, and the tool needs `cas.read`/`evo.revision` to CLASSIFY dialects by content, which a guest program *could* do but would add an unnecessary indirection (author a program, store it, run it) for a capability that has nothing to do with computing a tax figure |
| Filtering archived data inside `buildHostMap`'s `evoList` handler only | Filtering inside `buildRunSnapshot`'s snapshot construction (recommended) | Filtering only at `evoList` leaves `evoRevision`/`casRead` reachable by a directly-supplied hash (e.g. one obtained from `finance_documents_list`'s own `archived: true` response, then passed through `fjs_run`'s `args`). Filtering at snapshot-construction time closes that path too — see Q3 |

**Installation:** none.

**Version verification:**
```
$ node -p "require('./package.json').dependencies.functionalscript"
^0.43.1
$ node -p "require('./package-lock.json').packages['node_modules/functionalscript'].version"
```
Run the second command before writing any plan that touches `fjs/cas/evo` internals — AGENTS.md
documents this exact drift trap (two checkouts silently running different `functionalscript`
versions against the same lockfile). `[VERIFIED: package.json read directly]`

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────┐
                         │   Agent (Claude Code/Desktop) │
                         └───────────────┬───────────────┘
                                         │ tools/call
                    ┌────────────────────┼─────────────────────┐
                    │                    │                     │
                    ▼                    ▼                     ▼
         ┌────────────────────┐ ┌─────────────────┐  ┌──────────────────┐
         │ evo_add (existing) │ │ finance_documents│  │  fjs_run (exist.) │
         │ archived: true     │ │ _list (NEW)      │  │  runs a guest     │
         └──────────┬──────────┘ └────────┬─────────┘  │  report program   │
                    │                     │            └─────────┬─────────┘
                    ▼                     ▼                      ▼
         ┌───────────────────────────────────────┐   ┌───────────────────────┐
         │      Evo cache (host-side, in-mem)     │   │ buildRunSnapshot (NEEDS│
         │  evo.list / evo.head / evo.revision    │──▶│ A FIX — Q3): must     │
         └──────────────────┬──────────────────────┘   │ EXCLUDE archived      │
                            │                           │ revisions from what a │
                            ▼                           │ report program's     │
                 ┌────────────────────┐                 │ evoList/evoHead/     │
                 │  CAS (fileCas)     │◀────────────────│ evoRevision resolve  │
                 │  content-addressed │                 └───────────┬───────────┘
                 │  immutable bytes   │                             │
                 └─────────┬──────────┘                            ▼
                           │                              ┌──────────────────┐
                           ▼                              │ buildHostMap →    │
                 ┌────────────────────┐                   │ interpret(map)    │
                 │ vnd.fjs.ssa1099 /  │                   │ (guest program's   │
                 │ vnd.fjs.1099r JSON │                   │ ctx.evoList/       │
                 │ document blobs     │                   │ evoHead/evoRevision│
                 │ (this phase's      │                   │ /casRead)          │
                 │ dialects)          │                   └────────────────────┘
                 └────────────────────┘
```

### Recommended Project Structure
```
fjs/document/
├── ssa1099/
│   └── module.f.js       # vnd.fjs.ssa1099 — DOC-08
├── 1099r/
│   └── module.f.js       # vnd.fjs.1099r — DOC-09
fjs/server/
├── finance_documents_list/
│   └── module.f.js       # MCP-08's toolEntry
├── finance_schema/
│   └── module.f.js       # (existing) — dialectSchemas grows 5 -> 7
├── fjs_run/snapshot/
│   └── module.f.js       # (existing) — MODIFIED for DOC-15's fix (Q3)
```

### Pattern 1: The four-stage dialect template (unchanged, reused verbatim)
**What:** dialect tag -> mediaType -> RTTI schema -> structural `validate` -> semantic
`checkReferences` -> composed `validate`, exactly as `fjs/document/1099int/module.f.js` and
`fjs/document/w2/module.f.js` already do.
**When to use:** both new dialects, no deviation.
**Example (box-7-style list-of-codes, following W2 box 12's `(code, amount)` pair precedent but
simpler — 1099-R box 7a has no per-code amount, only a list of code strings):**
```js
// Source: pattern generalized from fjs/document/w2/module.f.js box12Entry
const oneZeroNineNineRSchema = /** @type {const} */ ({
    ...base(dialect),
    payerTin: string,
    recipientTin: string,
    accountNumber: string,
    taxYear: number,
    formRevision: string,
    corrected: option(true),
    box1GrossDistribution: option(string),
    box2aTaxableAmount: option(string),
    box2bTaxableAmountNotDetermined: option(true),
    box2bTotalDistribution: option(true),
    box3CapitalGain: option(string),
    box4FederalIncomeTaxWithheld: option(string),
    box5EmployeeContribOrInsurancePremiums: option(string),
    box6NuaInEmployerSecurities: option(string),
    box7aDistributionCodes: option(array(string)),
    box7bIraSepSimple: option(true),
    box7cTrumpAccount: option(true),
    box7dEarningsOnExcessContrib: option(string),
    box8aOther: option(string),
    box8bPercentageOfAnnuityContract: option(string),
    box9aPercentageOfTotalDistribution: option(string),
    box9bTotalEmployeeContrib: option(string),
    box10AmountAllocableToIrrWithin5Years: option(string),
    box11FirstYearOfDesigRothContrib: option(string),
    box12FatcaFilingRequirement: option(true),
    box13DateOfPayment: option(string),
    stateLocal: option(array(stateLocalEntry)),
    payerName: option(string),
    recipientName: option(string),
})
```

### Pattern 2: Host-side lookup-map tool (finance_documents_list's shape)
**What:** a `toolEntry` closed directly over `Evo<O>`/`Cas<O>` — never routed through
`interpret`/`CasOp` — mirroring `casRefreshTool`'s and `evoToolRegistry`'s own construction, not
`fjs_run`'s guest-program indirection.
**When to use:** a capability an agent needs to call directly, with no program-authoring step, and
that touches host-only concerns (enumerating everything, including archived state) a guest program
is not meant to have unrestricted access to.
**Example:**
```js
// Source: pattern generalized from fjs/server/module.f.js's casRefreshTool and
// fjs/server/finance_schema/module.f.js's toolEntry construction
export const financeDocumentsListTool = evo => cas => toolEntry(
    'finance_documents_list',
    'Enumerates stored documents as a JSON array of {subject, dialect, taxYear, hash}. ' +
    'Active by default; pass archived: true to list archived documents instead.',
    { archived: option(true) },
    ({ archived }) => step(
        evo.list(archived),
        subjects => foldStep(pure(subjects), /** @type {readonly DocumentListEntry[]} */ ([]), subject => acc =>
            step(evo.head(subject), heads => {
                const headHash = heads[0]
                if (headHash === undefined) {
                    return pure(acc) // no current head (shouldn't happen for a listed subject)
                }
                return step(evo.revision(headHash), revResult => {
                    if (revResult[0] === 'error') {
                        return pure(acc) // shouldn't happen: head hash names a revision by construction
                    }
                    const snapshotHash = cBase32ToVec(revResult[1].snapshot)
                    if (snapshotHash === null) {
                        return pure(acc)
                    }
                    return step(collectRead(cas.read(snapshotHash)), blobResult => {
                        if (blobResult[0] === 'error') {
                            return pure(acc) // snapshot unreadable — skip
                        }
                        const parsed = tryJsonParse(utf8ToString(blobResult[1]))
                        if (parsed === null) {
                            return pure(acc) // not JSON — the "non-revision blob" skip case
                        }
                        const [t, identity] = rttiValidate(documentIdentitySchema)(parsed)
                        const dialect = t === 'ok' && identity.dialect !== undefined ? identity.dialect : 'unknown'
                        const taxYear = t === 'ok' ? identity.taxYear : undefined
                        return pure([...acc, { subject, dialect, taxYear, hash: headHash }])
                    })
                })
            }),
        ),
    )
        .map(list => okResult(jsonText(list))),
)
```
This is illustrative, not literal — `step`/`foldStep`/`.map` composition details should follow
whatever idiom `fjs/server/fjs_run/snapshot/module.f.js`'s `buildRunSnapshot` already establishes
for folding an effectful loop into an accumulator (same nested-`step` shape).

### Anti-Patterns to Avoid
- **Routing `finance_documents_list` through `fjs_run`/`interpret`:** would force the agent to
  author a throwaway program to list documents, adds no safety benefit (the tool is read-only
  regardless), and complicates the archived-visibility requirement, which is a HOST behavior here,
  not a guest one.
- **Deriving `finance_documents_list`'s dialect classification from `dialectSchemas`
  (`finance_schema`'s registry):** would require importing every dialect's schema into the new
  tool just to validate-and-discard the payload, and would make "unknown dialect" mean something
  different (schema-invalid) than what CONTEXT wants (dialect string not one of the ones we
  registered, but the blob is still a well-formed document with SOME dialect tag). Read `.dialect`
  generically instead (Q4).
- **Reusing `moneyFieldError` for a percentage box** (1099-R boxes 8b, 9a): `moneyFieldError`
  enforces this project's CENTS-scale exact-decimal rule, which does not apply to a percentage
  value (a percentage can carry more or fewer decimal places than 2, and is not a money amount at
  all). Do not call it on `box8bPercentageOfAnnuityContract` / `box9aPercentageOfTotalDistribution`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Archiving a document | A new `finance_document_archive` MCP tool | The already-registered `evo_add` with `{ subject, parents: [currentHead], snapshot: sameOrNewSnapshot, archived: true }` | `evo_add` already accepts `archived: option(true)` per its own schema (`node_modules/functionalscript/fjs/mcp/evo/module.f.js`'s `evoAddArgs`); CONTEXT explicitly rejects a new tool here |
| Determining a subject's active/archived status | Hand-rolled head-walking logic | `evo.list(archived)` (subject-level) for `finance_documents_list`; nothing new needed for the tool | `subjectListed`/`headsOf` in `node_modules/functionalscript/fjs/cas/evo/module.f.js` already implement exactly this, verified read |
| Exact-decimal money validation for the new dialects' money boxes | A new per-dialect check | `../money_field/module.f.js`'s `moneyFieldError` | Shared across `1099int`/`w2`/`medical_expenses` already; extending to a fourth/fifth dialect is the intended use |

**Key insight:** every piece of retraction machinery this phase needs except the SNAPSHOT-FILTERING
fix (Q3) already exists upstream. The temptation in this phase is to build something new for
"archiving a document" or "listing documents archived-aware" — resist it; the gap is entirely in
one function's data-resolution logic, not in missing surface area.

## Q1 — Form 1099-R: the complete box inventory, from the fetched PDFs

**Sources, with exact URLs, fetched and read directly this session:**
- `https://www.irs.gov/pub/irs-pdf/f1099r.pdf` — the CURRENT canonical URL. Fetched 2026-08-07;
  this is the **2026 revision** ("Form 1099-R Created 4/2/26"), for use FIRST to report TY2026
  distributions (filed starting January 2027) — per the form's own "Attention: Which Revision To
  Use for Which Year" cover page, which states IRS issues forms up to a year in advance.
  `[VERIFIED: fetched PDF, read directly]`
- `https://www.irs.gov/pub/irs-prior/f1099r--2025.pdf` — the **2025 revision** ("Form 1099-R
  Created 3/20/25"), which is what a payer would actually have issued for **TY2025** — the
  declared taxpayer profile's tax year. Fetched 2026-08-07. `[VERIFIED: fetched PDF, read
  directly]`
- `https://www.irs.gov/pub/irs-pdf/i1099r.pdf` (2026 Instructions for Forms 1099-R and 5498) —
  fetched but not needed beyond what the form's own "Instructions for Recipient" panel already
  states (the instructions panel is printed on the form itself, Copy B/C/2).

**Why both revisions matter, concretely:** this is a live example of exactly the box-numbering
drift `11-CONTEXT.md` and the roadmap both warn about, not a hypothetical.

| Box on the 2026 (current) form | Present on the 2025 (TY2025) form? | What changed |
|---|---|---|
| 7a Dist. code(s) | Yes — printed as unlabeled "7 Distribution code(s)" | Cosmetic split into 7a/7b sub-labels only |
| 7b IRA/SEP/SIMPLE | Yes — same checkbox, unlabeled "7b" on the 2025 print | No change in meaning |
| **7c Trump account** | **No — does not exist on the 2025 form** | **New box.** Reflects the new "Trump Accounts" savings vehicle created by 2025 legislation (OBBBA); a TY2025 1099-R simply has no such box printed |
| **7d Earnings on excess contrib.** | **No — does not exist on the 2025 form** | New box, paired with 7c |
| 8a Other ($) | Present, but **merged with 8b into one printed box**: "8 Other $ ___ %" | The 2026 form SPLITS what was one visual box into two (8a $, 8b %) |
| 8b Percentage of annuity contract (%) | Present, merged into the same "8 Other $ ___ %" box as above | Same box, split for the 2026 print |

Everything else (boxes 1, 2a, 2b's two checkboxes, 3, 4, 5, 6, 9a, 9b, 10, 11, 12, 13, 14–19, and
the VOID/CORRECTED header) is **identical in meaning and box number** across both revisions —
verified by reading both PDFs, not assumed.

**Recommendation:** model the fuller (2026) box set. It is a strict superset for the boxes that
matter (7c/7d are simply new, additive, absent-able boxes; 8a/8b splitting a single visual box on
the 2025 form into two logical fields loses nothing — the OCR/ingestion pass reads the printed `$`
value into `box8aOther` and the printed `%` value into `box8bPercentageOfAnnuityContract`
regardless of whether they share one bordered box or two on the physical page). A real TY2025
document will simply always have `box7cTrumpAccount`/`box7dEarningsOnExcessContrib` absent
(`option`, not required) — exactly the DOC-11 discipline this project already enforces everywhere
else.

### Complete box inventory (2026 revision terms; 2025-only differences noted inline)

| Box | Label as printed | Kind | Repeating (state/local)? |
|---|---|---|---|
| — | VOID (Copy A/1 only) | checkbox | no — **not modeled**, mirrors precedent of not modeling filer-only artifacts |
| — | CORRECTED / "CORRECTED (if checked)" | checkbox | no — `corrected: option(true)`, same convention as every other dialect |
| — | PAYER'S name, address | free text | no — `payerName: option(string)` (label only, per DOC-01) |
| — | PAYER'S TIN | free text | no — `payerTin: string` (subject key) |
| — | RECIPIENT'S TIN | free text | no — `recipientTin: string` (subject key) |
| — | RECIPIENT'S name, address | free text | no — `recipientName: option(string)` |
| — | Account number (see instructions) | free text | no — `accountNumber: string` (subject key; may be `''`) |
| 1 | Gross distribution | money | no |
| 2a | Taxable amount | money | no |
| 2b | Taxable amount not determined (checkbox) | checkbox | no |
| 2b | Total distribution (checkbox, same box-2b group) | checkbox | no |
| 3 | Capital gain (included in box 2a) | money | no |
| 4 | Federal income tax withheld | money | no |
| 5 | Employee contrib./desig. Roth contrib. or insurance premiums | money | no |
| 6 | NUA in employer's securities | money | no |
| 7a | Dist. code(s) | **list of codes** (see below) | no |
| 7b | IRA/SEP/SIMPLE | checkbox | no |
| 7c | Trump account **(2026-only — absent on 2025 forms)** | checkbox | no |
| 7d | Earnings on excess contrib. **(2026-only — absent on 2025 forms)** | money | no |
| 8a | Other | money | no |
| 8b | Percentage of annuity contract | percentage | no |
| 9a | Percentage of total dist. | percentage | no |
| 9b | Total employee contrib. | money | no |
| 10 | Amount allocable to IRR within 5 years | money | no |
| 11 | 1st year of desig. Roth contrib. | year (free text/number, not money) | no |
| 12 | FATCA filing requirement | checkbox | no |
| 13 | Date of payment | date (free text — no date primitive exists yet in this project) | no |
| 14 | State tax withheld | money | **yes** |
| 15 | State/Payer's state no. | free text (state abbrev. + payer's state ID, combined print) | **yes** |
| 16 | State distribution | money | **yes** |
| 17 | Local tax withheld | money | **yes** |
| 18 | Name of locality | free text | **yes** |
| 19 | Local distribution | money | **yes** |

**Box 7a is a LIST, per the CONTEXT decision** (mirrors W2 box 12's lesson): the printed
Instructions for Recipient enumerate over 30 single-letter/digit codes (1–9, A, B, C, D, E, F, G,
H, J, K, L, M, N, P, Q, R, S, T, U, W, Y), and IRS convention allows **up to two codes** in this
box on one form (e.g., a normal distribution that is also a direct rollover). Model
`box7aDistributionCodes: option(array(string))` — a list, never a fixed pair of slots, for the same
reason W2 box 12 is a list: the codes carry the meaning, not their position.

**Boxes 14–19 form the repeating state/local group**, directly analogous to W2 boxes 15–20 — the
printed layout on both revisions shows two stacked `$` lines per box (14/16/17/19), meaning the
physical form itself anticipates more than one state/locality per document. Model as
`stateLocal: option(array(stateLocalEntry))` mirroring `fjs/document/w2/module.f.js`'s
`stateLocalEntry` shape (field naming below is a recommendation, `MEDIUM` confidence — the exact
visual sub-split of box 15 into "state abbreviation" vs. "payer's state no." was not verified
pixel-by-pixel, only that both pieces of information are printed under one box number):
```js
const stateLocalEntry = /** @type {const} */ ({
    state: string,
    payerStateNo: option(string),      // box 15's second half
    stateTaxWithheld: option(string),  // box 14
    stateDistribution: option(string), // box 16
    localTaxWithheld: option(string),  // box 17
    localityName: option(string),      // box 18
    localDistribution: option(string), // box 19
})
```

### formRevision — a genuine, non-obvious finding

**The "Created MM/DD/YY" print string that best identifies the form revision appears ONLY on Copy
A** ("Form 1099-R Created 4/2/26 www.irs.gov/Form1099R", bottom-left, red print) — the copy filed
with the IRS, which a taxpayer never possesses. **Copy B/C/2 — what an actual recipient receives
and would upload — print only "Form 1099-R www.irs.gov/Form1099R"**, with no "Created" date at
all. The only revision-distinguishing mark visible on the recipient's own copy is the large "20 25"
/ "20 26" year watermark inside the form body, which is the SAME field this project already treats
as `taxYear`.

**Consequence:** for the copy taxpayers actually have, `formRevision` and `taxYear` will, in
practice, usually collapse to the same printed value — weaker than DOC-10's stated ideal
(revision independent of tax year), but it is the most precise information the source document
actually carries. Document this explicitly in the dialect's docstring rather than silently
deriving `formRevision` FROM `taxYear` in code (DOC-10 forbids that derivation structurally, and
correctly so — a future document that DOES carry a distinguishable revision string, e.g. an
amended late filing on a different print run, must still be able to say so). Recommend: the
ingestion/vision pass records whatever revision text is actually printed on the specific copy in
hand (per this finding, usually just the year), and `formRevision` stores that text verbatim,
never a value computed from `taxYear`.

## Q2 — Form SSA-1099: the complete box inventory, and why it cannot be sourced like an IRS form

**This is not an IRS form.** It is issued by the **Social Security Administration**. There is no
blank form at `irs.gov/pub/irs-pdf/`. Confirmed by directly reading IRS Publication 915 (2025),
page 2: *"If you received these benefits during 2025, you should have received a Form SSA-1099,
Social Security Benefit Statement... "* — sourced from the SSA, not the IRS, and the same page
explicitly separates it from **Form RRB-1099** ("Payments by the Railroad Retirement Board"),
confirming RRB-1099 is a **distinct form**, correctly out of scope per `11-CONTEXT.md`.

**Source used, exact URL and location:** `https://www.irs.gov/pub/irs-pdf/p915.pdf` — IRS
Publication 915 (2025), *"Social Security and Equivalent Railroad Retirement Benefits,"* Appendix,
pages 20–22, fetched and read directly 2026-08-07. `[VERIFIED: fetched PDF, read directly]`

**This is explicitly a SAMPLE, not a blank form**, and the publication says so plainly on the same
page: *"Caution: The illustrated versions of Form SSA-1099... in this appendix are proof copies of
the forms as they appeared when this publication went to print. The information on the illustrated
forms should essentially be the same as the information on the form you received from either the
SSA or the RRB. You should, however, compare the form you received with the one shown here to note
any differences."* The printed form itself is watermarked "SAMPLE" and carries the bottom-left
print `Form SSA-1099-SM (1-2026)`. Report this honestly to the planner and executor: the box
LABELS below are as reliable as an IRS-published illustration gets, but this is explicitly **not**
a guaranteed-current blank form the way `f1099r.pdf` is.

### Complete box inventory (Pub 915 (2025) Appendix, pages 20–22)

| Box | Label as printed | Kind |
|---|---|---|
| 1 | Name | free text |
| 2 | Beneficiary's Social Security Number | free text (this is the recipient TIN) |
| 3 | Benefits Paid in [year] | money |
| — | "Description of Amount in Box 3" | free text block (see below) |
| 4 | Benefits Repaid to SSA in [year] | money |
| — | "Description of Amount in Box 4" | free text block (see below) |
| 5 | Net Benefits for [year] (Box 3 minus Box 4) | money |
| 6 | Voluntary Federal Income Tax Withheld | money |
| 7 | Address | free text — **recommend NOT modeling** (PII with no computational use; mirrors the W2 box 9/14 omission precedent, and address is already the kind of "human label" DOC-01 keeps out of subjects) |
| 8 | Claim Number (use this number if you need to contact SSA) | free text — **recommend mapping to `accountNumber`** (the subject-key convention's natural slot; Pub 915 itself directs "be sure to use the claim number shown in box 8" for any SSA correspondence, i.e. it is functionally this form's per-account identifier) |

**Boxes 3 and 4's "Description of" blocks** (per the CONTEXT decision) are stored as optional free
text, never parsed into structured line items, even though Pub 915's own text explains they can
enumerate several sub-adjustments (Medicare premiums, workers' comp offset, attorney fees, etc.) —
parsing those would be exactly the kind of computation this phase explicitly excludes.
`box3Description: option(string)`, `box4Description: option(string)`.

**There is no printed CORRECTED indicator on the SSA-1099 sample.** Unlike RRB-1099 (which Pub
915 explicitly says the RRB marks "CORRECTED" and replaces), the SSA-1099 Appendix sample shows no
such box. `[VERIFIED: read the sample directly — no CORRECTED field present]`. Recommend keeping
`corrected: option(true)` in the schema for structural consistency with every other dialect (and
in case a real form is later found to carry one, per the "compare the form you received" caution
above), but flag LOW confidence that it will ever be populated in practice from a genuine
SSA-1099.

### The payerTin problem — a genuine finding, not assumed symmetry

**SSA-1099 prints no payer TIN anywhere.** The existing subject-key convention
(`fjs/document/subject/module.f.js`'s `FormKey`) requires `payerTin` as one of the five fields
rooting a form's identity. For every other dialect this project has, `payerTin` is a real printed
field (the employer's EIN on a W-2, the bank's TIN on a 1099-INT). SSA-1099 has no analogous
printed field — the "payer" is universally the Social Security Administration, and Pub 915's
sample shows no TIN box for it at all.

**Recommendation:** mirror the already-established `accountNumber: string` (always-present,
may-be-empty) convention: `payerTin: string`, always stored as `''` for this dialect. Document
this explicitly in the module docstring as a deliberate deviation, not an oversight — a future
reader diffing dialects should not "fix" it by inventing a fake SSA EIN, which would misrepresent
what is actually printed on the form.

## Q3 — How retraction actually works, and the gap it has today

**Files read directly this session** (per the instruction, via relative/absolute paths, never `cd`
into the `functionalscript` submodule):
- `node_modules/functionalscript/fjs/mcp/evo/module.f.js`
- `node_modules/functionalscript/fjs/cas/evo/module.f.js`
- `node_modules/functionalscript/fjs/media/revision/module.f.js`
- `fjs/server/fjs_run/snapshot/module.f.js` (this project's own file)

### The exact shape of a `vnd.fjs.revision` blob
```js
// node_modules/functionalscript/fjs/media/revision/module.f.js — revisionSchema
{
    dialect: 'vnd.fjs.revision',
    subject: string,
    parents: array(hash),      // hash = string (cbase32)
    snapshot: hash,
    generation: number,
    archived: option(true),    // present-and-true, or ABSENT — never false
    lock: option(record(string)),
}
```
`archived` follows the exact same "`option(true)`, never `false`" convention this project's own
`corrected` field already copies (per `11-CONTEXT.md`'s own note that this was "not invented
here").

### How `archived` gets set
Exactly one way: an `evo_add` (or the internal `addRevision`) call whose input carries
`archived: true`. `addRevision` (`node_modules/functionalscript/fjs/cas/evo/module.f.js`) copies
`input.archived` verbatim into the assembled `Revision` before `checkReferences`/write — there is
no separate "archive" mutation; a revision's `archived` flag is fixed at the moment that specific
revision is written, forever (CAS write-once).

### The exact `evo_add` call that retracts a document
```json
{
  "name": "evo_add",
  "arguments": {
    "parents": ["<current head hash of the wrongly-ingested document's subject>"],
    "subject": "<the subject — inheritable from a single parent, but explicit is clearer>",
    "archived": true
  }
}
```
`snapshot` is **omitted** — per `resolveSnapshot`'s rule (`cas/evo/module.f.js`), with exactly one
parent and no explicit `snapshot`, the new revision inherits the parent's own `snapshot` unchanged.
This is exactly right for retraction: the archived revision points at the SAME bytes, just
flagged `archived: true` — "the bytes remain in the store; `archived` means no longer current,
never gone," precisely as `11-CONTEXT.md` states. `generation` is computed by the server
(`1 + parent.generation`); the caller never supplies it.

### `evo.list(true)` vs `evo.list()` — verified against `subjectListed`
```js
// node_modules/functionalscript/fjs/cas/evo/module.f.js
const subjectListed = archived => state => {
    const heads = headsOf(state)                                   // hashes not referenced as a parent
    const unarchived = heads.filter(h => !state.archived.includes(h))
    return archived === undefined
        ? unarchived.length !== 0        // ACTIVE: at least one current head is NOT archived
        : heads.length !== 0 && unarchived.length === 0   // ARCHIVED: has heads, and EVERY head is archived
}
```
**Verified, not merely quoted from the tool description**: a subject with one active head and one
newly-added archived head (e.g. mid-correction, before the old head is superseded) is still
**active** — one un-archived head keeps the whole subject active. This matches the tool's own
advertised docstring exactly (`'evo_list'`'s description string in
`node_modules/functionalscript/fjs/mcp/evo/module.f.js`), so that part of the CONTEXT decision is
confirmed correct.

### `evo.head(subject)` does NOT filter by archived status — a load-bearing detail
```js
// node_modules/functionalscript/fjs/cas/evo/module.f.js
head: subject => eff(read(cacheKey)).step(cache => {
    const state = at(subject)(cache.bySubject)
    return pure(state === null ? [] : headsOf(state))   // ALL current heads, archived or not
}).value,
```
`headsOf` returns every hash not superseded as a parent — **with no archived filtering at all**.
Archived-awareness lives only in `list()`'s `subjectListed`, never in `head()`. This is the seam
the gap below runs through.

### THE GAP — confirmed by reading `fjs/server/fjs_run/snapshot/module.f.js` directly

`buildRunSnapshot` (this project's own code, not upstream) builds the `RunSnapshot` every guest
report program's `ctx.evoList`/`evoHead`/`evoRevision`/`casRead` calls are answered from
(`buildHostMap` reads ONLY from this snapshot — no live I/O once a run starts). Reading its
current implementation line by line:

```js
const withSubjects = step(withBlobsAndRevisions, state => step(
    evoApi.list(),               // active subjects
    activeSubjects => step(
        evoApi.list(true),        // archived subjects — RESOLVED UNCONDITIONALLY
        archivedSubjects => pure({ ...state, activeSubjects, archivedSubjects }),
    ),
))
const withHeads = step(withSubjects, state => foldStep(
    pure([...state.activeSubjects, ...state.archivedSubjects]),   // BOTH sets folded together
    state,
    subject => s => step(evoApi.head(subject), headHashes => pure({ ...s, heads: { ...s.heads, [subject]: headHashes } })),
))
```

and separately, `withBlobsAndRevisions` resolves **every** hash `cas.list()` returns into
`blobs`/`revisions`, with no `archived` check on the decoded `RevisionData` at all.

`buildHostMap`'s `evoList` handler then does:
```js
evoList: archivedFlag => jsonText(archivedFlag === 'true' ? snapshot.archivedSubjects : snapshot.activeSubjects),
```

**Nothing in `CasOp`'s type (`EvoList = readonly ['evoList', (a: string) => string]`) or in
`interpret`'s dispatch restricts what STRING a guest passes as the `archived` argument.** A report
program is free to write `ctx.evoList('true')`. When it does, under the CURRENT implementation:
1. It receives the archived subject list (not empty, not refused).
2. For each, `ctx.evoHead(subject)` returns real head hashes — `heads` was populated from BOTH
   active and archived subjects with no filtering.
3. `ctx.evoRevision(headHash)` resolves — `revisions` was populated from a full `cas.list()` scan
   with no `archived` filtering on the decoded value.
4. `ctx.casRead(revision.snapshot)` resolves the document bytes — `blobs` was likewise populated
   unconditionally.

**Conclusion, stated as loudly as the phase brief asked for:** `11-CONTEXT.md`'s claim that
*"Archived revisions are invisible to a report program; the guest cannot silently include them"*
is **not true of the code as it exists today**. It is true only by CONVENTION — i.e., only insofar
as a report program's author chooses not to pass `'true'`. This is **exactly** the rejected
alternative CONTEXT itself names and dismisses ("programs see everything and filter themselves...
which makes it not a guarantee"). The gap is not hypothetical or edge-case: it is the direct,
one-line consequence of `buildRunSnapshot` resolving `[...activeSubjects, ...archivedSubjects]`
together with no distinction carried forward.

### The recommended, provable fix — scoped to what CAS's nature actually allows

CAS is fundamentally content-addressable: anyone holding an exact hash can `cas.read` it,
independent of any revision wrapper. A textbook-complete guarantee ("archived bytes are
UNREADABLE by any means") is not achievable without a much larger access-control redesign, and
would also contradict this project's own already-accepted risk ("CAS has no delete... Retraction
remains a policy question, not a capability" — `REQUIREMENTS.md`'s Accepted Risks table). The
provable, honestly-scoped guarantee this phase should build and assert is narrower and still
closes the actual gap found above:

1. **`buildRunSnapshot`'s `heads` map**: for each subject, include only head hashes whose OWN
   decoded revision is NOT `archived: true`. An archived-only subject then resolves to
   `heads[subject] = []` — indistinguishable, from a report program's view, from "unknown
   subject."
2. **`buildRunSnapshot`'s `revisions` map**: exclude any hash whose decoded `RevisionData` carries
   `archived: true`. This closes the "smuggled hash" path too — even if a report program is
   handed an archived revision's hash directly via `fjs_run`'s `args` (e.g., because the calling
   agent got it from `finance_documents_list`'s own `archived: true` response), `ctx.evoRevision`
   on that hash now throws `revision not found`, matching the existing bare-string-throw
   convention `buildHostMap` already uses for any absent hash.
3. **`buildHostMap`'s `evoList` handler**: no change needed once (1) holds — `snapshot.
   archivedSubjects` can still be resolved and returned (a report program asking `ctx.evoList
   ('true')` gets subject NAMES back, which reveals nothing about content), but every subsequent
   `evoHead`/`evoRevision`/`casRead` step on that subject's data is already closed off by (1)/(2).
4. **Leave `blobs` (raw snapshot bytes by hash) unfiltered.** A report program that is somehow
   handed the exact SNAPSHOT hash (not the revision hash) through an external channel could still
   `casRead` it — this is the honest, documented boundary of the guarantee, consistent with CAS's
   nature and with the project's own Accepted Risks framing. State this explicitly in the proof's
   docstring so a future reader does not mistake the guarantee for something stronger than it is.

This requires a small, targeted change to `fjs/server/fjs_run/snapshot/module.f.js`'s
`buildRunSnapshot` (folding the already-decoded `revResult[1].archived` flag into the fold
accumulator alongside `heads`/`revisions`, rather than after the fact) — **not** a new module, and
**not** a change to any upstream `functionalscript` file. This belongs to DOC-15, must land in this
phase, and Success Criterion 4's "enforced by a proof" cannot be satisfied without it: a proof
against the CURRENT `buildRunSnapshot` would either need to avoid exercising `ctx.evoList('true')`
at all (proving nothing) or would fail.

### Un-archive / restore — confirmed consistent with append-only

`11-CONTEXT.md`'s "restoring is just another revision without the flag" is confirmed correct
against the code: nothing about `addRevision` special-cases `archived` beyond copying it through —
a later revision simply omitting `archived` (or setting it structurally impossible to set `false`,
per the `option(true)` convention) makes that later revision an unarchived head again, and
`subjectListed` would then re-classify the subject as active (assuming that head is now the sole
or newest one). No separate "unarchive" mechanism is needed, matching the deferred-scope decision.

## Q4 — `finance_documents_list`: what it needs to exist

### APIs, verified from upstream `Evo<O>` (`node_modules/functionalscript/fjs/cas/evo/module.f.js`)
```js
export const evo = cas => cacheKey => ({
    list: archived => Effect<..., readonly string[]>,          // subject names
    head: subject => Effect<..., readonly string[]>,           // head hashes (cbase32), [] if unknown
    add: input => Effect<..., Result<string, string>>,         // (not used by this tool)
    revision: hash => Effect<..., Result<RevisionData, string>>,
})
```
`RevisionData = { subject, parents, snapshot, generation, archived?, lock? }` — `.snapshot` is the
cbase32 hash of the document blob itself, convertible to a `Vec` via `cBase32ToVec` for
`cas.read`.

### From a head hash to `{ dialect, taxYear }`
There is no shortcut: the tool must (1) `evo.head(subject)` to get head hash(es), (2)
`evo.revision(headHash)` to get `.snapshot`, (3) `cas.read(cBase32ToVec(snapshot))` (via
`collectRead`, the same helper `buildRunSnapshot` already uses) to get the document bytes, (4)
`JSON.parse` and read `.dialect`/`.taxYear` off the result. **Cost**: one `evo.head` + one
`evo.revision` + one `cas.read` per LISTED SUBJECT (not per stored revision — only current heads
are read). At this project's declared scale (a handful of documents, same assumption
`07-RESEARCH.md` already made for `buildRunSnapshot`), this is negligible; do not add caching.
**Failure modes to handle, all as skips, never as thrown errors reaching the transport**:
- `evo.head` returns `[]` (a listed subject with no current head — should not happen given
  `list()`'s own contract, but code defensively, consistent with this project's own
  `noUncheckedIndexedAccess` discipline).
- `evo.revision(headHash)` errors (should not happen for a hash `evo.head` itself just returned,
  but the `Result` type must still be narrowed, never cast).
- `cas.read(snapshot)` errors (a genuinely broken/missing blob — skip that entry).
- The blob's bytes are not valid UTF-8 or not valid JSON (**the "non-revision blob" skip case**
  the CONTEXT decision names — though note, per the analysis in Q3's "gap" discussion, that
  `evo.list()` already only ever returns subjects that HAVE a revision chain; a raw non-revision
  CAS blob is invisible to Evo entirely and is excluded from consideration by construction, before
  `finance_documents_list` ever runs. The realistic "skip" case here is a SNAPSHOT blob — the
  document itself — that fails to parse as JSON, not a revision blob).

### The "unknown dialect" case, resolved
Per CONTEXT: *"A document whose head is NOT one of the known finance dialects is still listed,
carrying its actual dialect tag."* Do **not** validate the parsed snapshot against
`finance_schema`'s `dialectSchemas` registry (that would require importing every dialect just to
reject unknown ones, and conflates "not one of ours" with "structurally invalid"). Instead, define
a minimal, deliberately loose identity-peek schema:
```js
const documentIdentitySchema = /** @type {const} */ ({ dialect: option(string), taxYear: option(number) })
```
`fjs/server/module.f.js`'s own code comments already establish, and this project's tests already
rely on, the fact that **"rtti permits properties a schema does not mention"** — so any real
document (which always carries a REQUIRED `dialect: string` and `taxYear: number` per every
existing dialect's schema) validates against this loose schema trivially, and the extra fields are
simply ignored. If `dialect` comes back present, use it verbatim as the response's `dialect` value
— genuinely unknown dialects (a string `finance_schema` has never heard of) are listed exactly as
printed, per CONTEXT. **Open question, not resolved by CONTEXT:** what to do if the parsed JSON is
a well-formed object with NO `dialect` field at all (structurally possible — this schema makes it
`option`). Recommend a documented sentinel string, e.g. `'unknown'`, rather than `undefined`
(the response schema promises `dialect` as a value, and a JSON-RPC response cannot carry
`undefined` — `fjs/exact`/`fjs/document`'s own `option()` convention only ever applies to STORED
document fields, not to this tool's own response shape). Flag this as a decision for the planner
to record explicitly, since CONTEXT does not name the sentinel.

### The same-commit ordering constraint (Phase 08-04's own precedent, re-verified)
`fjs-run-integration.test.js` builds `advertisedTools` from a LIVE `tools/list` response and
`toolsCalled` from every `call(...)` invocation actually made in that same test file, then
asserts:
```js
assert.equal([...toolsCalled].sort().join(','), [...advertisedTools].sort().join(','), ...)
```
`[VERIFIED: read fjs-run-integration.test.js lines 484-492 directly]`. Registering
`finance_documents_list` in `financeMcpHandlers` (`fjs/server/module.f.js`) without ALSO adding a
`call('finance_documents_list', {...})` invocation to `fjs-run-integration.test.js` in the SAME
commit will make `npm test` fail immediately on this exact assertion — not a hypothetical, this is
the literal mechanism Phase 08-04 already exercised for `finance_tax_params`.

### Registration pattern (mirrors `finance_schema`/`finance_tax_params` exactly)
```js
// fjs/server/module.f.js — financeMcpHandlers
export const financeMcpHandlers = home => cacheKey => fromRegistry([
    ...casToolRegistry(home)(cacheKey),
    ...evoToolRegistry(evo(fileCas(sha256)(home))(cacheKey)),
    casRefreshTool(fileCas(sha256)(home))(cacheKey),
    financeSchemaTool,
    financeTaxParamsTool,
    financeDocumentsListTool(evo(fileCas(sha256)(home))(cacheKey))(fileCas(sha256)(home)),  // NEW
    fjsRunTool(home)(fileCas(sha256)(home))(evo(fileCas(sha256)(home))(cacheKey)),
])
```

## Project Constraints (from AGENTS.md)

- **No new dependency, including a devDependency, without every repo owner's approval** — this
  phase needs none; if the planner finds it needs one, that is itself a finding to surface, not
  something to work around.
- **Money in a stored JSON document is a decimal `string`, never a JSON number** — every money box
  in both new dialects is `option(string)`, validated via `moneyFieldError`, exactly as
  `1099int`/`w2` already do. Percentage boxes (1099-R 8b, 9a) are NOT money — do not run them
  through `moneyFieldError` (see Anti-Patterns).
- **Every box is `option(...)`; blank is not zero** — applies to every box in both new dialects
  with no exception.
- **`corrected: option(true)`, never `false`** — same for both new dialects; recommended even for
  SSA-1099 despite LOW confidence it is ever populated (see Q2).
- **Conditional spread discipline** — `...(x === undefined ? {} : { k: x })` — applies wherever
  `finance_documents_list`'s response entries are assembled (`taxYear` may be `undefined` for a
  genuinely unknown blob).
- **No `any`, no type cast over an indexed access, no non-null assertion** — the
  `documentIdentitySchema` validation result must be narrowed via `assert`/the existing `t ===
  'ok'` pattern, exactly as `finance_tax_params`'s own `field`/`asObject`/`asString` helpers do
  (those are proof-only helpers today; production code in the new tool needs its own narrowing,
  following the same discipline, not importing test helpers into production).
- **Proofs are `export const proof = {...}`, discovered only through root `all.test.js`** —
  applies to every new file.
- **Never gate on `npm test`'s total; use `node --test 2>&1 | grep -c '^✔ import("./fjs/'`.**
- **`.f.js` files may not use `try`/`catch`** (per `money_field/module.f.js`'s own comment,
  "which `.f.js` files may not use") — any narrowing in the new tool must use `Result`
  destructuring (`[t, v] = ...`), never `try`/`catch`, matching every existing dialect module.

## Common Pitfalls

### Pitfall 1: Assuming the currently-hosted `f1099r.pdf` is what a TY2025 document actually looks like
**What goes wrong:** modeling `vnd.fjs.1099r` purely from the URL the phase brief names
(`irs.gov/pub/irs-pdf/f1099r.pdf`) silently bakes in the 2026 revision's box 7c/7d/8a/8b split as
if it were universal, without anyone checking whether the declared TY2025 profile's real documents
even have those boxes.
**Why it happens:** the IRS publishes forms up to a year ahead of first use; the canonical URL
always serves the NEWEST revision, not the one matching "this year's taxes."
**How to avoid:** always cross-check the tax year the profile actually needs against
`irs.gov/pub/irs-prior/<form>--<year>.pdf`, as done in Q1 above.
**Warning signs:** a box number/label in the schema that a test fixture built from a "real-looking"
TY2025 document can never legitimately populate.

### Pitfall 2: Treating "report programs don't see archived data" as already true
**What goes wrong:** writing DOC-15's proof against the current `buildRunSnapshot`/`buildHostMap`
and either (a) never actually exercising `ctx.evoList('true')` inside a report program (the proof
then proves nothing about the guarantee) or (b) exercising it and discovering the proof fails,
late in the phase.
**Why it happens:** the CONTEXT decision states the guarantee as already-true prose; nothing
forces a reader to re-derive it from the actual `buildRunSnapshot` source before planning around
it.
**How to avoid:** implement Q3's fix FIRST (or in the same plan/wave as the proof), then write an
adversarial proof: a report program that explicitly calls `ctx.evoList('true')` on a subject with
one active head that WAS superseded by an archived head, asserting the archived head/revision/
snapshot are unreachable through the guest vocabulary.
**Warning signs:** a DOC-15 proof that never calls `evoList('true')` from inside a `Report<T>`,
or that only tests `finance_documents_list` (a HOST tool, not subject to this guarantee at all).

### Pitfall 3: Reusing `moneyFieldError` for a percentage field
**What goes wrong:** `box8bPercentageOfAnnuityContract`/`box9aPercentageOfTotalDistribution`
rejected as "not an exact decimal" for legitimate values, or silently coerced into the wrong scale
if `moneyFieldError`'s cents-scale assumption is applied to a percentage.
**Why it happens:** every other `option(string)` field in the existing dialects IS money, so it is
easy to reach for the one existing exactness check reflexively.
**How to avoid:** store percentage boxes as plain `option(string)` with no numeric-exactness check
in this phase (this phase does not compute), or, if the planner wants SOME validation, write a
separate, explicitly-named percentage check — never call `moneyFieldError` on a percentage.

## Code Examples

### Retracting a document (the documented answer to "I uploaded the wrong document")
```json
// Source: derived from node_modules/functionalscript/fjs/mcp/evo/module.f.js's evoAddArgs
// and node_modules/functionalscript/fjs/cas/evo/module.f.js's resolveSnapshot (single-parent
// inheritance)
{
  "jsonrpc": "2.0", "method": "tools/call", "id": 1,
  "params": {
    "name": "evo_add",
    "arguments": {
      "parents": ["<current head hash>"],
      "subject": "<the document's subject>",
      "archived": true
    }
  }
}
```

### A minimal, loose identity-peek schema for `finance_documents_list`
```js
// Source: pattern derived from fjs/server/module.f.js's own comment: "rtti permits properties
// a schema does not mention"
import { number, option, string } from 'functionalscript/fjs/types/rtti/module.f.js'
const documentIdentitySchema = /** @type {const} */ ({ dialect: option(string), taxYear: option(number) })
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Form 1099-R box 7 as a single "Distribution code(s)" + one checkbox | Box split into 7a/7b/7c/7d, with 7c/7d wholly new | 2026 revision (Created 4/2/26), vs. 2025 revision (Created 3/20/25) | A schema built from the currently-hosted PDF alone would silently model two boxes (7c, 7d) that never appear on the declared taxpayer profile's real TY2025 documents — harmless if `option`-typed, but worth knowing |
| Form 1099-R box 8 as one combined "Other $ / %" box | Split into 8a (money) / 8b (percentage) | Same 2025→2026 change | Same as above — two logical fields sharing one visual box on older documents |

**Deprecated/outdated:** none — both revisions are current-enough that neither is "deprecated";
the point is that they differ and the profile's tax year determines which one is authoritative.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Box 15's printed "State/Payer's state no." splits visually into a state abbreviation and a separate payer's-state-ID sub-field the way `stateLocalEntry.state`/`payerStateNo` models it | Q1, `stateLocalEntry` | If the real printed layout is a single free-text cell, the two-field split is harmless (OCR would just leave `payerStateNo` absent) but may not match what an ingestion pass naturally produces; LOW-severity, easily adjusted before any computation reads it (nothing does, per phase scope) |
| A2 | `finance_documents_list`'s unknown-dialect-with-no-dialect-field sentinel should be the literal string `'unknown'` | Q4 | Cosmetic only — CONTEXT does not name a sentinel, so any documented choice satisfies the requirement; a different string would not fail any stated success criterion |
| A3 | SSA-1099's `corrected` field will in practice never be populated from a real form (no CORRECTED box observed on the Pub 915 sample) | Q2 | If a real SSA-1099 IS later found to carry a CORRECTED-equivalent mark, the `option(true)` field already accommodates it — no schema change needed either way |

## Open Questions

1. **Does a real TY2025 SSA-1099 print anything resembling formRevision at all, beyond "Form
   SSA-1099-SM (1-2026)" printed on the SAMPLE?**
   - What we know: the sample (a proof copy for the PUBLICATION, not a specific tax year's issued
     form) carries `Form SSA-1099-SM (1-2026)` at bottom-left.
   - What's unclear: whether an actually-ISSUED SSA-1099 for TY2025 carries a different, or no,
     analogous string — this was never independently verified against a real received form (per
     Pub 915's own caution to "compare the form you received with the one shown here").
   - Recommendation: same treatment as 1099-R's formRevision finding — record whatever text is
     actually printed on the specific document in hand, falling back to the tax year if nothing
     else is legible, and never derive it from `taxYear` in code.

2. **Should `finance_documents_list` return one row per (subject, head) pair, or collapse
   multi-head subjects into one row?**
   - What we know: `evo.head(subject)` can return more than one hash (concurrent, unmerged
     branches) — CONTEXT's `{ subject, dialect, taxYear, hash }` shape names a single `hash`
     per entry, implying one row per head, not per subject.
   - What's unclear: whether this project's usage pattern ever actually produces concurrent heads
     for a document subject (single-writer ingestion suggests it would be rare-to-never in
     practice).
   - Recommendation: implement one row per (subject, head) pair — the simpler, more literal
     reading of CONTEXT's response shape — and note in the tool's own docstring that a subject
     with N concurrent heads yields N rows sharing the same `subject`.

## Environment Availability

Not applicable — this phase is pure `.f.js` code over already-installed `functionalscript` and the
project's existing project-local CAS store; no external tool, service, or runtime dependency is
introduced.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | FunctionalScript Emergent Testing (`export const proof = {...}`, discovered via root `all.test.js`), run through Node's built-in `node --test` |
| Config file | none — registration is automatic via `all.test.js`'s `loadModuleMap` walk (see `AGENTS.md`) |
| Quick run command | `node --test 2>&1 \| grep -c '^✔ import("./fjs/'` (the only honest per-project-file count; never gate on `npm test`'s raw total, which includes ~2,100+ vendored submodule proofs) |
| Full suite command | `npm test` (`tsc && node --test`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOC-08 | `vnd.fjs.ssa1099` round-trips; every box `option`-absent-able; `payerTin` always `''` | unit (`proof` in the new dialect file) | `npm test` (via root discovery) | ❌ Wave 0 — `fjs/document/ssa1099/module.f.js` does not exist |
| DOC-09 | `vnd.fjs.1099r` round-trips; box 7a is a list; box 2b's two checkboxes are independent; state/local repeats faithfully, including two entries for the same state | unit (`proof` in the new dialect file) | `npm test` | ❌ Wave 0 — `fjs/document/1099r/module.f.js` does not exist |
| DOC-15 | An archived revision's head/revision/snapshot are unreachable through `ctx.evoList('true')` → `evoHead` → `evoRevision` → `casRead`, even when the exact archived hash is supplied directly as `fjs_run` `args` | unit + adversarial | `npm test` (via a new `proof` in `fjs/server/fjs_run/snapshot/module.f.js`, following the existing `buildRunSnapshotResolvesTheStore` proof's own pattern of seeding a real store under `virtual`) | ❌ Wave 0 — the proof, and the `buildRunSnapshot` fix itself, do not exist yet |
| MCP-08 | `finance_documents_list` enumerates active documents by default, archived ones on `archived: true`, and lists an unknown-dialect document with its real dialect tag rather than hiding it | unit + real-process integration | `npm test`, PLUS a `call('finance_documents_list', {...})` addition to `fjs-run-integration.test.js` in the SAME commit (TEST-03's standing rule) | ❌ Wave 0 — tool and its integration-test coverage do not exist yet |

### Sampling Rate
- **Per task commit:** `node --test 2>&1 | grep -c '^✔ import("./fjs/'` (fast, project-local only)
- **Per wave merge:** `npm test` (full suite, includes the real-process integration test)
- **Phase gate:** full suite green, PLUS a manual mutation check on the DOC-15 fix specifically
  (per AGENTS.md's standing rule, "a proof is not known to work until you have watched it fail") —
  temporarily reverting the `buildRunSnapshot` filtering change must turn the new adversarial proof
  red, not merely leave it green by accident.

### Wave 0 Gaps
- [ ] `fjs/document/ssa1099/module.f.js` — new file, covers DOC-08
- [ ] `fjs/document/1099r/module.f.js` — new file, covers DOC-09
- [ ] `fjs/server/fjs_run/snapshot/module.f.js` — MODIFIED (not new), covers DOC-15's fix +
      adversarial proof
- [ ] `fjs/server/finance_documents_list/module.f.js` — new file, covers MCP-08
- [ ] `fjs/server/module.f.js` — MODIFIED, registers the new tool (same commit as the integration
      test update, per the ordering constraint in Q4)
- [ ] `fjs-run-integration.test.js` — MODIFIED, adds a `call('finance_documents_list', ...)`
      invocation (same commit as the registry change)
- [ ] `fjs/server/finance_schema/module.f.js` — MODIFIED, `dialectSchemas` grows 5 -> 7, and both
      the hand-typed `expectedKnownDialectCount` constant AND a `*Resolves` proof leaf per new
      dialect must be added in the same commit (per that file's own documented mutation-verified
      trap)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | no | out of scope for this local, single-user, stdio-transport project (per `REQUIREMENTS.md`'s Accepted Risks) |
| V3 Session Management | no | same |
| V4 Access Control | **yes, narrowly** | the DOC-15 guarantee IS an access-control property (which data a guest program's sandboxed vocabulary can reach) — the fix in Q3 is this phase's V4 control |
| V5 Input Validation | yes | RTTI structural validation (`option`, `array`, exact-literal `dialect`) + `checkReferences` semantic checks, exactly as every existing dialect already does — no new pattern |
| V6 Cryptography | no | not applicable — no new cryptographic primitive introduced; hashing is entirely upstream `fjs/crypto/sha2` |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| A guest report program reads data the retraction feature was meant to hide (this phase's central finding) | Information Disclosure | The `buildRunSnapshot` filtering fix in Q3 — exclude archived-flagged revisions from what a report's host map can resolve, both by subject-enumeration and by direct hash |
| A malformed/adversarial stored blob masquerading as a document (e.g., valid JSON with a `dialect` field but garbage `taxYear`) reaching `finance_documents_list` | Tampering (of a sort — this is CAS content the user themselves controls, not attacker-supplied, but the SAME code path must not crash on it) | The loose `documentIdentitySchema` validate-then-narrow pattern (Q4) — never `JSON.parse` + direct property access without a schema-backed narrowing step, consistent with this project's `noUncheckedIndexedAccess`/no-cast discipline |
| A money box in the new dialects silently accepting a non-exact or comma-grouped value | Tampering | `moneyFieldError`, reused unchanged, exactly as `1099int`/`w2` already require |

## Sources

### Primary (HIGH confidence)
- `https://www.irs.gov/pub/irs-pdf/f1099r.pdf` — fetched and read directly, 2026-08-07 (2026 revision)
- `https://www.irs.gov/pub/irs-prior/f1099r--2025.pdf` — fetched and read directly, 2026-08-07 (2025 revision, the TY2025-relevant one)
- `https://www.irs.gov/pub/irs-pdf/p915.pdf` — IRS Publication 915 (2025), fetched and read directly 2026-08-07, pages 1-3 and 20-22 (Appendix, SSA-1099 sample)
- `node_modules/functionalscript/fjs/mcp/evo/module.f.js` — read directly
- `node_modules/functionalscript/fjs/cas/evo/module.f.js` — read directly
- `node_modules/functionalscript/fjs/media/revision/module.f.js` — read directly
- `fjs/server/fjs_run/snapshot/module.f.js` (this project) — read directly, is the source of the Q3 finding
- `fjs/server/module.f.js`, `fjs/server/finance_schema/module.f.js`, `fjs/server/finance_tax_params/module.f.js` (this project) — read directly, registration/lookup-map pattern
- `fjs/document/1099int/module.f.js`, `fjs/document/w2/module.f.js`, `fjs/document/base/module.f.js`, `fjs/document/money_field/module.f.js`, `fjs/document/subject/module.f.js` (this project) — read directly
- `fjs-run-integration.test.js` (this project) — read directly, lines confirming the same-commit ordering constraint
- `AGENTS.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/phases/11-.../11-CONTEXT.md` (this project) — read directly

### Secondary (MEDIUM confidence)
- Box 15's exact visual sub-split (state abbreviation vs. payer's state ID number as two distinct
  writable areas) — inferred from the printed label text and general IRS forms convention, not
  verified pixel-by-pixel against a rendered image (see Assumption A1)

### Tertiary (LOW confidence)
- None — every claim in this document is either verified against a fetched/read source above, or
  explicitly logged in the Assumptions table.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, every pattern reused verbatim from three already-shipped dialects and two already-shipped tools
- Architecture (dialects, `finance_documents_list`): HIGH for box lists (fetched PDFs, both relevant revisions); MEDIUM for `finance_documents_list`'s exact composition (illustrative, not copy-pasteable, code)
- DOC-15 / retraction: HIGH — the gap was found by reading the actual shipped source, not by inference, and the fix is scoped precisely against that same source
- Pitfalls: HIGH — all three are directly derived from source discrepancies found this session, not speculative

**Research date:** 2026-08-07
**Valid until:** 30 days for the code-pattern findings (Q3/Q4 — stable unless `functionalscript` is upgraded past `^0.43.1`, see MAINT-06); the IRS/SSA box-list findings (Q1/Q2) are valid for TY2025 specifically and should be re-verified if the project ever extends to a different tax year, per DOC-10's own "revision travels with the instance" rationale.
