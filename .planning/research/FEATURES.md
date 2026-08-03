# Feature Research

**Domain:** MCP server over content-addressable storage for personal financial documents + US personal income tax reports computed by agent-authored FunctionalScript programs
**Researched:** 2026-08-03
**Confidence:** HIGH on tax form scope and document payloads (read directly from current IRS PDFs and irs.gov). HIGH on agent/tool design (Anthropic official engineering guidance). MEDIUM on traceability feature comparisons (vendor marketing + support forums). MEDIUM on competitor engine internals (README-level).

---

## Executive Summary of Findings

Five findings dominate everything else in this document. Read these even if you read nothing else.

1. **The forms are not the engine — the worksheets are.** Form 1040 line 16 ("Tax") is a single line whose value comes from one of four different computations depending on inputs: the Tax Table (taxable income < $100,000), the Tax Computation Worksheet (≥ $100,000), the Qualified Dividends and Capital Gain Tax Worksheet (any qualified dividends or net LTCG), or the Schedule D Tax Worksheet (collectibles / unrecaptured §1250). Only the first two are simple. None of the four is a *form*; all live in the instructions. The moment the project ingests a 1099-DIV, it owes the Qualified Dividends worksheet — a ~25-line computation. This is the single biggest hidden scope item and the thing to budget for. (Verified: 2025 Schedule D Part III lines 20 and 22, Form 1040 line 16.)

2. **TY2025 is the worst possible first year, and TY2024 is the best.** The One Big Beautiful Bill Act (signed 2025-07-04) retroactively changed 2025 parameters *after* the IRS had already published them: the standard deduction went from the Rev. Proc. 2024-40 figures ($15,000 / $30,000 / $22,500) to $15,750 / $31,500 / $23,625 (confirmed on the face of the 2025 Form 1040 itself). A brand-new **Schedule 1-A** appeared, created 2025-11-04, feeding a brand-new Form 1040 line 13b. Meanwhile Success Criterion 1 in PROJECT.md is "feed it a year already filed; every 1040 line matches" — which TY2025 cannot satisfy at the time of building. **Recommendation: build and acceptance-test against TY2024, and treat TY2025 as a parameter-data addition.** This resolves a direct conflict between `todo/plan.md` open question 1's proposed default (TY2025) and PROJECT.md Success Criterion 1.

3. **The project's core thesis is empirically validated, and there is a published benchmark to prove it against.** TaxCalcBench (Column Tax, arXiv 2507.16126) evaluated frontier models on 51 realistic 1040 scenarios: best model 32.35% strictly-correct returns, 51.96% within ±$5. Documented failure modes are *exactly* what "program, not answer" fixes — tax-table misuse (15–20% of failures), arithmetic errors, incorrect qualified dividends worksheet calculations, hallucinated line numbers, cascading downstream corruption. The dataset is public at `github.com/column-tax/tax-calc-bench` and its coverage (1040 + Schedules 1/2/3, excluding itemized deductions, business income, depreciation, multi-state) maps almost exactly onto the recommended v1 scope. This converts Success Criterion 1 from "one return" into "51 graded returns plus one real one" at near-zero cost.

4. **"Authoritative vs. estimate" is the wrong axis.** There is no legal distinction for a self-prepared return — IRS preparer regulation (PTIN, Circular 230) is triggered by *compensation*, not by software. So the choice is an engineering standard, and "estimate" is the weaker one because it has no pass/fail criterion. **Recommend instead: exact within a declared scope, and a hard refusal outside it.** The failure mode to design against is not imprecision; it is silently producing a plausible number for an input the engine does not model. That implies a table-stakes feature nobody asks for: a **scope guard** that makes the program fail loudly on an unmodeled document type or unmodeled box value.

5. **Traceability has three levels and this project can reach a level no shipping product reaches.** Level 1 = line cites contributing document hashes. Level 2 = line cites (document, field, value) tuples — this is what SurePrep SPbinder does with hyperlinked leadsheets and what TurboTax QuickZoom/Data Source does interactively (desktop only; absent from TurboTax Online). Level 3 = line cites the *program expression* that produced it, plus all inputs, and the whole thing re-runs to the same answer from content hashes. Nothing commercial offers level 3. That is the differentiator, and per PROJECT.md it is a storage-layer property, not a report feature.

---

## Part 1 — US Form 1040 Scope

All line numbers and thresholds below were read from the current IRS PDFs (Form 1040 (2025) created 9/5/25; Schedule 1 created 7/25/25; Schedule 1-A created 11/4/25; Schedule B created 4/23/25; Schedule D created 10/6/25; Form 8949 created 5/5/25). **HIGH confidence.**

### What a minimal-but-real return actually requires

For the canonical case — single or MFJ, wages from W-2s, bank interest, brokerage dividends, standard deduction, no dependents, no credits — the *entire* return is Form 1040 pages 1–2 plus possibly Schedule B. No Schedule 1, no Schedule 2, no Schedule 3.

Lines actually touched:

| Line | Content | Source |
|---|---|---|
| 1a / 1z | Total from Form(s) W-2 box 1; 1z = sum of 1a–1h | W-2 |
| 2a / 2b | Tax-exempt interest / taxable interest | 1099-INT boxes 8 / 1+3 |
| 3a / 3b | Qualified dividends / ordinary dividends | 1099-DIV boxes 1b / 1a |
| 9 | Total income = 1z + 2b + 3b + 4b + 5b + 6b + 7 + 8 | derived |
| 10 | Adjustments from Schedule 1 line 26 | (0 in minimal case) |
| 11a / 11b | Adjusted gross income | derived |
| 12a–12e | Standard **or** itemized deduction; 12a–12d are the dependent/age/blindness checkboxes that change the standard deduction | derived + taxpayer facts |
| 13a / 13b | QBI deduction (Form 8995) / **Schedule 1-A line 38** | new for 2025 |
| 14 / 15 | 12e + 13a + 13b; taxable income = 11b − 14, floored at 0 | derived |
| **16** | **Tax** — see the four-way branch below | **the hard part** |
| 24 | Total tax | derived |
| 25a / 25b / 25d | Federal income tax withheld from W-2 / from 1099 / total | W-2 box 2, 1099 box 4 |
| 33 / 34 / 35a / 37 | Total payments; overpaid; refund; amount owed | derived |

**2025 standard deduction, printed on the form itself:** $15,750 single/MFS, $31,500 MFJ/QSS, $23,625 HoH.

**Line 16 is a four-way branch (the critical finding):**

| Condition | Computation | Where it lives |
|---|---|---|
| Taxable income < $100,000, no qualified dividends / net LTCG | **Tax Table** — $50-wide bracket lookup, 12 pages | Pub. 1040 |
| Taxable income ≥ $100,000, no qualified dividends / net LTCG | **Tax Computation Worksheet** | 1040 instructions |
| Any qualified dividends or net LTCG, no collectibles/§1250/Form 4952 | **Qualified Dividends and Capital Gain Tax Worksheet** | 1040 instructions (routed to by Sch. D lines 20, 22) |
| Collectibles (28% rate) or unrecaptured §1250, or filing Form 4952 | **Schedule D Tax Worksheet** | Sch. D instructions |

Note the Tax Table is a *lookup*, not a bracket formula — TaxCalcBench found models substituting bracket arithmetic for the table as the #1 failure category. Since the table rounds to $50 bands, bracket arithmetic gives a *different* answer, not a rounding difference. A correct engine must implement the lookup semantics.

### Tiering the forms

**Tier 1 — essential for a realistic first version**

| Form / schedule | Why essential | Complexity | Depends on |
|---|---|---|---|
| Form 1040 pages 1–2 (income → tax → refund) | The deliverable | MEDIUM | everything |
| W-2 dialect | Nearly every return has one; feeds lines 1a and 25a | LOW | — |
| 1099-INT dialect | Nearly every return has one; feeds 2a/2b | LOW | — |
| 1099-DIV dialect | Nearly every return with a brokerage; feeds 3a/3b | LOW | — |
| Schedule B | Required if interest + ordinary dividends > $1,500, **or** any foreign financial account, **or** any foreign trust distribution/grantor status (Part III) | LOW | 1099-INT, 1099-DIV |
| Tax Table + Tax Computation Worksheet | Line 16 for the simple case | MEDIUM (table is ~1,200 rows of data) | taxable income |
| Qualified Dividends and Capital Gain Tax Worksheet | Line 16 the instant a 1099-DIV exists with box 1b > 0 | HIGH | 1099-DIV, capital gains |
| Standard Deduction (incl. age/blindness increments, dependent-of-another worksheet) | Line 12 | LOW–MEDIUM | filing status, birth dates |
| Schedule 1-A Parts I, V, VI | **Only if the taxpayer is 65+** (born before 1961-01-02) — the senior deduction is worth up to $6,000/$12,000, phased out at 6% of MAGI over $75,000/$150,000. A 65+ retiree's 2025 return *cannot* be right without it. | MEDIUM | AGI |
| Scope guard / refusal on unmodeled input | Prevents silent wrong answers | LOW | dialect schemas |

**Tier 2 — second wave, common but each pulls a chain**

| Form | Pulls in | Complexity |
|---|---|---|
| 1099-B → Schedule D → Form 8949 | Short/long-term split; basis-reported vs. not (8949 box codes A/B/C/G/H/I short, D/E/F/J/K/L long); wash sales (box 1g); noncovered securities (box 5). **Shortcut worth exploiting:** transactions reported on 1099-B with basis reported to IRS and no adjustments may be totaled directly on Schedule D lines 1a/8a with no Form 8949 at all. | HIGH |
| Capital loss carryover | Requires prior-year Schedule D → forces multi-year support; $3,000/$1,500 annual limit | MEDIUM |
| 1099-R → lines 4a/4b, 5a/5b | Distribution codes drive taxability; basis via Form 8606 for IRAs | MEDIUM–HIGH |
| SSA-1099 → line 6a/6b | Social Security Benefits Worksheet — a genuinely nasty 19-line circular-ish computation | HIGH |
| Schedule 1 | Only needed for any of lines 1–8z income or 11–24z adjustments; large surface, mostly rare items | MEDIUM |
| Schedule A (itemized) | Only wins above $15,750/$31,500 — for many personal returns it is dead weight | HIGH |

**Tier 3 — long tail, deliberately deferred**

| Form | Why long-tail |
|---|---|
| Schedule K-1 (1065/1120-S/1041) | 23 numbered Part III items, many with lettered sub-codes and "see attached statement"; pulls in Schedule E Part II, at-risk limits, passive activity (Form 8582), QBI (8995/8995-A), possibly Schedule K-3 for foreign items, basis tracking across years. Arrives latest of any document. Enormous effort, narrow benefit. |
| 1099-NEC | Feeds Schedule C → Schedule SE → QBI → quarterly estimates, **all already out of scope per PROJECT.md**. Its simplicity as a *document* is a trap: the box is three fields, the downstream is a project. Do not add this dialect early. |
| Schedule 2 | AMT (Form 6251), NIIT (8960), Additional Medicare Tax (8959), excess APTC (8962) |
| Schedule 3 | Foreign tax credit (1116), education credits (8863), residential energy (5695), etc. |
| Schedule 8812 | Child tax credit / ACTC — needed only with dependents |
| Schedule 1-A Parts II/III (tips, overtime) | **Not derivable from TY2025 documents.** IRS Notice 2025-62 granted penalty relief; Forms W-2 and 1099 for TY2025 were *not* updated to report qualified tips or overtime separately. The taxpayer must reconstruct from pay stubs. Separate reporting begins with TY2026 forms (new W-2 box 14b "Treasury Tipped Occupation Code" and new box 12 codes). |
| Schedule 1-A Part IV (car loan interest) | Requires per-vehicle VINs and an allocation against Sch. C/E/F |
| 1099-DA (digital assets) | New; already referenced on 2025 Schedule D lines 1a/8a and Form 8949 boxes G/H/I/J/K/L. Relevant only if the user holds crypto. |
| State returns | W-2 boxes 15–20 and 1099 state boxes make it tempting. Doubles the parameter surface. **Store the boxes; do not compute.** |

### Direct answer to open question 1

> **Jurisdiction:** US federal only (already settled).
> **Year:** **TY2024 for the acceptance test; TY2025 as the second dataset.** TY2024 has a filed return to diff against, stable parameters published once, and no Schedule 1-A. Building TY2025-first means the acceptance criterion cannot be exercised until the user actually files.
> **Forms:** Form 1040 core + Schedule B + Tax Table/Computation Worksheet + Qualified Dividends and Capital Gain Tax Worksheet; document dialects W-2, 1099-INT, 1099-DIV. Add Schedule 1-A Parts I/V/VI **only if** the taxpayer is 65+ and the year is 2025+. Schedule D/8949/1099-B is the first post-v1 increment.
> **Authoritative vs. estimate:** neither — **exact within a declared scope, with a hard refusal outside it.** No legal obligation attaches either way (preparer rules key off compensation), so pick the framing with a testable pass/fail. Ship a scope manifest and make the program fail on anything not in it.

---

## Part 2 — Document Ingestion

### What users expect when uploading financial documents

Benchmarked against Paperless-ngx (self-hosted personal DMS) and TaxCaddy/1040SCAN (professional 1040 workflow):

| Expectation | Status here | Notes |
|---|---|---|
| Drop a file, get it stored, never lose it | Table stakes | CAS gives content-addressed, deduplicated, tamper-evident storage for free |
| Deduplication — the same statement uploaded twice is one document | Table stakes | **Free with CAS.** Content-addressing makes re-upload idempotent. Worth stating explicitly in the tool description so the agent knows retries are safe. |
| Extract the fields without manual typing | Table stakes | Agent vision → dialect (settled) |
| Classify: what kind of document is this, who is it from, what year | Table stakes | Paperless-ngx does this with a trained classifier; **here the agent does it** — do not build a classifier |
| See the original next to the extracted data | Table stakes | Raw bytes in CAS + OCR artifact + typed dialect, all hash-linked |
| Corrections supersede, don't overwrite | Table stakes for tax | Evo revision chain (settled) |
| Full-text search across documents | Paperless-ngx table stakes; **anti-feature here** | The agent already has the documents; typed dialects + list-by-year/type cover the real need |
| Auto-tagging / ML classification | Paperless-ngx feature; **anti-feature here** | The agent classifies |

### Ingestion realities that shape the data model

Three verified facts that should change the design:

1. **A brokerage PDF is not one document.** Brokers issue a *consolidated / composite 1099* — a single multi-page statement containing 1099-INT, 1099-DIV, 1099-B, 1099-OID and 1099-MISC sections. Schwab, Raymond James, Fidelity all do this. One uploaded file therefore yields *N* typed documents. This bears directly on open question 2 (Evo subject model): the subject cannot be "the uploaded file" if the file contains four form types. A workable shape is: one subject for the uploaded artifact (raw bytes), and one subject per extracted *form instance* keyed by (payer TIN, recipient TIN, account number, tax year, form type), with the artifact hash recorded as provenance.

2. **Corrections are routine and late.** Consolidated statements are due to recipients by 2026-02-17 for TY2025, and corrected versions commonly arrive in March, April, sometimes May — especially with foreign holdings. The forms carry an explicit **CORRECTED** checkbox (1099-INT, 1099-DIV, 1099-B) and Schedule K-1 carries **Amended K-1**. So the amendment signal is *in the document itself*, not something to infer. The dialect must carry it, and the ingestion tool should use it to create a revision rather than a new subject.

3. **Box semantics drift year over year.** The 1099-INT PDF is "Rev. January 2024" (revised on its own cycle); the W-2 is annual and the 2026 revision adds box 14b that the 2025 revision lacks. A dialect must carry the **form revision it was read from**, not just the tax year, or a program written against 2026 box semantics will silently misread a 2025 document.

### Verified field payloads

Everything below was read directly from the current IRS form PDFs. **HIGH confidence.**

#### `vnd.fjs.w2` — Form W-2, Wage and Tax Statement

Identity: `a` Employee SSN · `b` Employer EIN · `c` Employer name/address/ZIP · `d` Control number · `e` Employee name (+ suffix) · `f` Employee address/ZIP.

Amounts: `1` Wages, tips, other compensation · `2` Federal income tax withheld · `3` Social security wages · `4` Social security tax withheld · `5` Medicare wages and tips · `6` Medicare tax withheld · `7` Social security tips · `8` Allocated tips · `10` Dependent care benefits · `11` Nonqualified plans.

Coded/repeating: `12a`–`12d` each a **(code, amount)** pair — this is a list, not four scalars, and TaxCalcBench specifically lists "confusion with box 12 codes" as a model failure mode. `13` three independent booleans: Statutory employee / Retirement plan / Third-party sick pay. `14a` Other (free-text label + amount, repeating). `14b` Treasury Tipped Occupation Code — **2026 forms only**.

State/local: `15`–`20` (State, Employer's state ID, State wages, State income tax, Local wages, Local income tax, Locality name) — **repeating, two rows printed on the form**. Model as an array.

Note box `9` is shaded/unused on the current form.

#### `vnd.fjs.1099int` — Form 1099-INT (Rev. January 2024)

Header: VOID checkbox · **CORRECTED checkbox** · Payer name/address/phone · Payer's RTN (optional) · Payer TIN · Recipient TIN · Recipient name/address · Account number · FATCA filing requirement checkbox · 2nd TIN not. checkbox · calendar year.

Boxes: `1` Interest income · `2` Early withdrawal penalty · `3` Interest on U.S. Savings Bonds and Treasury obligations · `4` Federal income tax withheld · `5` Investment expenses · `6` Foreign tax paid · `7` Foreign country or U.S. territory (string) · `8` Tax-exempt interest · `9` Specified private activity bond interest · `10` Market discount · `11` Bond premium · `12` Bond premium on Treasury obligations · `13` Bond premium on tax-exempt bond · `14` Tax-exempt and tax credit bond CUSIP no. (string) · `15` State · `16` State identification no. · `17` State tax withheld. Boxes 15–17 are **repeating** (two rows on the form).

Mapping: 1040 line 2b ← boxes 1 + 3 (less amortizable bond premium adjustments); line 2a ← box 8.

#### `vnd.fjs.1099div` — Form 1099-DIV (Rev. January 2024)

Header: same shape as 1099-INT (VOID, CORRECTED, payer/recipient identity, account number, FATCA, 2nd TIN not.).

Boxes: `1a` Total ordinary dividends · `1b` Qualified dividends · `2a` Total capital gain distr. · `2b` Unrecap. Sec. 1250 gain · `2c` Section 1202 gain · `2d` Collectibles (28%) gain · `2e` Section 897 ordinary dividends · `2f` Section 897 capital gain · `3` Nondividend distributions · `4` Federal income tax withheld · `5` Section 199A dividends · `6` Investment expenses · `7` Foreign tax paid · `8` Foreign country or U.S. possession · `9` Cash liquidation distributions · `10` Noncash liquidation distributions · `11` FATCA filing requirement · `12` Exempt-interest dividends · `13` Specified private activity bond interest dividends · `14` State · `15` State identification no. · `16` State tax withheld. Boxes 14–16 repeating.

**Dependency alarm:** box 1b > 0 forces the Qualified Dividends and Capital Gain Tax Worksheet. Boxes 2b and 2d force the *Schedule D* Tax Worksheet instead — a strictly harder path. Box 2a alone (capital gain distributions with no Schedule D otherwise required) can go directly on Form 1040 line 7 with the "Schedule D not required" checkbox (7b).

#### `vnd.fjs.1099b` — Form 1099-B

Per-transaction: `1a` Description of property · `1b` Date acquired · `1c` Date sold or disposed · `1d` Proceeds · `1e` Cost or other basis · `1f` Accrued market discount · `1g` Wash sale loss disallowed · `2` Type of gain or loss (short/long/ordinary) · `3` Check if proceeds are from collectibles or from a QOF · `4` Federal income tax withheld · `5` Check if a noncovered security · `6` Reported to IRS (gross vs. net proceeds) · `7` Check if loss not allowed based on amount in box 1d · `8`–`11` regulated futures/§1256 (Profit or loss realized on closed contracts; Unrealized on open contracts at prior and current year end; Aggregate profit or loss) · `12` Check if basis reported to IRS · `13` Bartering · `14`–`16` State information. Plus **CUSIP number** and **"Applicable checkbox on Form 8949"** (A, B, D, E, or X).

**Blank ≠ zero here.** An empty box 1e means basis was not reported, which is materially different from a basis of $0. Any dialect that coerces absent to 0 will produce wrong capital gains. This generalizes: model every box as explicitly-absent-able.

#### `vnd.fjs.k1-1065` — Schedule K-1 (Form 1065), for completeness

Part I partnership identity (EIN, name/address, IRS center, PTP checkbox). Part II partner identity, entity type, general/limited, domestic/foreign, disregarded-entity passthrough, profit/loss/capital percentages beginning and ending, share of liabilities (nonrecourse / qualified nonrecourse / recourse) beginning and ending, capital account analysis (beginning, contributed, current year net income, other increase/decrease, withdrawals, ending), built-in gain question, §704(c) gain/loss. Part III items 1–23 including coded multi-value boxes 11 (Other income), 13 (Other deductions), 15 (Credits), 17 (AMT items), 18 (Tax-exempt income and nondeductible expenses), 20 (Other information), plus Schedule K-3 attachment flag and at-risk / passive-activity multi-activity flags. Header carries **Final K-1** and **Amended K-1** checkboxes.

This is the shape of the long tail. It is roughly as much modelling work as W-2 + 1099-INT + 1099-DIV + 1099-B combined, and it is useless without Schedule E, at-risk and passive-activity machinery behind it.

### Payload design rules

| Rule | Rationale |
|---|---|
| **Keys mirror the form's own box numbers.** `box1b`, not `qualifiedDividends`. | "Traces to source" means traces to a *named box on a named form*. A normalized schema destroys the citation and breaks whenever the IRS renumbers. |
| **Carry the form revision, not just the tax year.** | Box semantics drift (W-2 box 14b exists in 2026, not 2025). |
| **Every box explicitly absent-able; absent ≠ 0.** | 1099-B box 1e blank means basis not reported. |
| **Amounts as exact decimals — integer cents or decimal strings.** | PROJECT.md constraint; also `Number.isSafeInteger` in `fjs/media/revision`. Never float. |
| **Codes and flags are first-class, not stringly-typed amounts.** | W-2 box 12 (code, amount) pairs; 1099-B box 2 type; 8949 applicable-checkbox letter. TaxCalcBench flags box-12 confusion as a real failure mode. |
| **Carry `corrected: bool` from the form's own checkbox.** | The revision signal is printed on the document. |
| **Carry the provenance triple: raw artifact hash, OCR artifact hash, page/region if available.** | This is what makes level-2 traceability structural. |
| **Identity key = (payerTin, recipientTin, accountNumber, taxYear, formType).** | Deterministic subject naming for open question 2; survives corrections. |

---

## Part 3 — Traceability and Audit Features

### What existing software actually does

| Product | Feature | Reach |
|---|---|---|
| TurboTax Desktop | **QuickZoom** — click a line, jump to the form/worksheet that calculated it; **Data Source** — right-click a number to see where an *entered* value came from | Level 2. **Not available in TurboTax Online.** |
| SurePrep **SPbinder** | Leadsheets tie 1040 amounts to source documents via auto-generated clickable hyperlinked cross-references; tick marks, annotations, notes; dynamically highlights changes between versions | Level 2, professional-grade. Closest existing analogue to this project's goal. |
| SurePrep **1040SCAN Organize** | Bookmarks and orders source documents into a standardized workpaper index that follows the order of the tax return | Level 1 organization |
| TaxCaddy | Client-side document collection, mobile capture, links documents to the engagement | Level 0/1 |
| Professional practice generally | "Tick and tie" — cross-referencing every return figure to a workpaper | The manual baseline the above automate |

**Gap in all of them:** you can trace a number to the form or document it came from, but you cannot *re-derive* it, diff it, or replay it. The derivation is inside proprietary software. That is the level-3 gap.

### What tax record-keeping actually demands

Verified from IRS "How long should I keep records?":

| Situation | Retention |
|---|---|
| Ordinary case | **3 years** from filing |
| Credit/refund claim after original return | 3 years from filing, or 2 years from tax paid, whichever later |
| Unreported income > 25% of gross income shown | **6 years** |
| Worthless securities or bad debt deduction | **7 years** |
| Return not filed, or fraudulent return | **Indefinitely** |
| Employment tax records | 4 years |
| **Property (basis) records** | Until the period of limitations expires **for the year the property is disposed of** — i.e. potentially decades |

Design consequences:
- The store is **append-only by requirement, not just by architecture**. Deletion is an anti-feature; CAS already forbids it.
- Basis records must outlive everything else. If capital gains are ever supported, the 1099-B/8949 chain and the acquisition-side documents must be retained indefinitely in practice.
- Retention makes *export* important and *deletion* unimportant. The audit-defence question is "can I produce the original and the derivation seven years later," and CAS answers it directly.

### What "every number traces to its source" should mean here

Three levels, in increasing order of what this architecture uniquely enables:

**Level 1 — line cites contributing document hashes.** Table stakes. `line2b: { value: 1234.56, sources: [<hash>, <hash>] }`.

**Level 2 — line cites (documentHash, fieldPath, value) tuples.** Parity with SPbinder. `{ doc: <hash>, field: "box1", value: 900.00 }`. This is the level PROJECT.md's "traceability is a storage-layer property" decision buys, provided every extracted value carries its source hash from ingestion onward.

**Level 3 — line cites the derivation.** The program hash, the entry point, the expression, and every input hash — such that re-running reproduces the number bit-for-bit. This is Success Criterion 4 and it is the differentiator. It also strongly argues for resolving open question 5 (`fjs_run` result disposition) in favour of **writing results back to CAS**: an inline-only result is not an audit record, and a report that is not stored cannot be diffed against a later re-run.

### The full provenance chain worth committing to

```
raw PDF bytes (CAS hash)
    └─> OCR artifact (CAS hash)          <- open question 3: STORE IT
            └─> typed dialect doc (CAS hash, Evo revision)
                    └─> [corrected doc] (Evo revision, parent = above)
                            └─> report program (CAS hash)
                                    └─> report result (CAS hash) citing all of the above
```

**Argument for storing the OCR artifact (open question 3):** it is the only record of *what the model actually saw* before interpretation. If a line is wrong, the diagnostic question is always "did vision misread the document, or did the program misuse a correctly-read value?" Without the intermediate artifact that question is unanswerable, and the transcription error — the most likely error in the whole pipeline — is exactly the one that cannot be audited. Also: the raw bytes are useless for diffing (a re-scan produces different bytes), while OCR artifacts diff meaningfully. **Store it.**

### Differentiator: mechanical 1040-X generation

Form 1040-X is literally a three-column diff: Column A original amount, Column B net change, Column C correct amount, plus a **mandatory** Part II written explanation of changes (a blank Part II is a common rejection trigger).

This project gets Columns A/B/C for free: a corrected 1099 arrives → new Evo revision → re-run the *same stored program* → diff the two stored reports → the diff *is* Columns A, B, C, with each changed line already citing the document hashes that changed. The written explanation is the one thing the agent should author, and it can author it from the diff.

No consumer tax product does this from first principles; they re-run a proprietary engine and hope. This is the strongest differentiator in the entire feature set, it requires no new mechanism beyond what PROJECT.md already commits to, and it is the natural v1.x demo.

---

## Part 4 — Agent/LLM-Facing Features

Sourced from Anthropic's official engineering guidance, "Writing effective tools for AI agents." **HIGH confidence.**

### General principles, applied here

| Guidance | Application |
|---|---|
| **Namespace by service and resource** (`asana_search`, `asana_projects_search`); prefix vs. suffix choice produces measurable eval differences | The server already inherits `cas_*` and `evo_*` from `casMcpServer`. New tools should be `finance_*` / `fjs_*`. Do not add unprefixed names into a registry that already has 7 prefixed ones. |
| **Consolidate — build high-leverage tools, not thin API wrappers.** "Instead of a `schedule_event` tool… implement a `get_customer_context` tool which compiles all of a customer's recent & relevant information at once." | The ingestion path is currently `cas_add` → `evo_add`, two calls plus hash plumbing. Expose **one** `finance_document_add` that takes the dialect payload and does both. Likewise a single `finance_context(taxYear)` returning every stored document's summary + the year's parameters is worth more than three list tools. |
| **Return meaningful context; avoid low-level identifiers** — prefer `name`, `file_type` over `uuid`, `mime_type` | **Direct tension with CAS.** Hashes are exactly the identifier Anthropic warns about. Resolution: tools return *both* — `{ label: "Chase 1099-INT 2024", formType, taxYear, payer, box1, hash }`. Never a bare hash list. |
| **`response_format` enum: `concise` \| `detailed`** — their example was 72 vs. 206 tokens | Applies to `finance_documents_list` and to report results. A full 1040 with level-2 provenance on every line is large; concise should be line numbers + values, detailed adds sources. |
| **Pagination, filtering, truncation with sensible defaults** | `finance_documents_list(taxYear, formType, limit)`. `cas_list` over a real document store will otherwise blow context. |
| **Errors must "clearly communicate specific and actionable improvements, rather than opaque error codes or tracebacks"** | Validates the existing `operation not permitted: fetch` requirement — and it should go further: *list the permitted operations in the error*. `operation not permitted: fetch. Available: cas_get, cas_list, evo_head, evo_revision.` An agent can self-correct from the second form and cannot from the first. |
| **Tool descriptions written as onboarding docs; unambiguous parameter names** (`user_id` not `user`) | `programHash` not `hash`; `taxYear` not `year`. State explicitly in the description that re-adding identical content is idempotent and returns the same hash. |
| **Evaluate with realistic multi-tool tasks with verifiable outcomes; measure tokens and runtime; let agents analyze transcripts and improve the tools** | The TaxCalcBench 51-case corpus is precisely this. Add the user's own filed return as case 52. |

### Tool-surface features specific to this product

| Feature | Why it matters for an agent | Complexity |
|---|---|---|
| **`finance_schema(dialect)` — return the RTTI schema for a document dialect** | The agent must author a program that reads `box1b` off a stored document. Without a schema it guesses field names, and every guess is a runtime failure and a round trip. This is the **most under-appreciated tool in the design** and the cheapest to add, since the RTTI schemas exist already for tool validation. Alternatively expose as MCP *resources*. | LOW |
| **`finance_tax_params(year)` — return brackets, standard deduction, thresholds as data** | PROJECT.md already stores these as data. The agent needs to *read* them to write a program against them; otherwise it will hardcode remembered values — the exact failure TaxCalcBench documents. Must include a source citation per parameter. | LOW |
| **`fjs_check(hash)` — parse/typecheck a program without executing it** | An agent's first program usually does not run. A check tool shortens the authoring loop from execute-fail-guess to check-fix-execute. **Bonus: this is the same `djs/parser` source-validation that Week 5 wants for closing the `import()` hole.** One feature, two problems. | MEDIUM |
| **Result carries `programHash` + input hashes + parameter-set hash** | Reproducibility is the product. `todo/plan.md` already flags this as "part of `fjs_run`'s contract rather than an accident." | LOW |
| **Example program stored in CAS, referenced from the tool description** | "Even small refinements to tool descriptions can yield dramatic improvements." A worked example of reading a stored 1099-INT and summing box 1 is the highest-leverage documentation in the system. | LOW |
| **Scope guard: program can assert "I do not model this input"** | Prevents the silent-wrong-answer failure mode. The agent should get `unmodeled document type: vnd.fjs.k1-1065 in tax year 2024` rather than a 1040 that quietly omits partnership income. | MEDIUM |
| **Idempotent add, stated in the description** | Agents retry. Content-addressing makes retries free. Say so. | LOW |

### Tool-surface anti-patterns

- **`finance_compute_1040(taxYear)`.** This single tool would destroy the entire thesis. If a tool computes the return, the agent will call it instead of authoring a program, and Success Criterion 4 fails permanently. The tool surface must make the program path the *only* path to a number.
- **A tool per CAS/Evo primitive as the documented ingestion path.** Anthropic's consolidation guidance and the reality of agent error rates both argue against a 3-call ingestion sequence.
- **Returning bare hash arrays.** Unreadable to the agent, forces N follow-up `cas_get` calls, blows context.
- **Returning raw tracebacks from `import()` failures.** The most common failure in the system deserves the best error message in the system.

---

## Feature Landscape

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| Store raw document bytes, immutably, deduplicated | It is a document store | LOW | Free with `fjs/cas` |
| W-2, 1099-INT, 1099-DIV dialects | These three cover the overwhelming majority of simple personal returns | LOW each | Box-numbered keys; see Part 2 |
| Corrected document supersedes without overwriting | Corrected 1099s arrive Mar–May routinely; the CORRECTED checkbox is on the form | LOW | Evo revision, parent = prior |
| Form 1040 core lines 1a–37 | The deliverable | MEDIUM | See table in Part 1 |
| Standard deduction with age/blindness increments | Line 12; 65+/blind increments are common and easy to get wrong | LOW–MEDIUM | Needs birth dates as taxpayer facts, not documents |
| Tax Table lookup + Tax Computation Worksheet | Line 16 | MEDIUM | Table is data, not code: ~1,200 rows keyed by $50 band × filing status. Model as tax-year parameters. |
| Qualified Dividends and Capital Gain Tax Worksheet | Mandatory the moment 1099-DIV box 1b > 0 | HIGH | The largest single computation in v1 |
| Schedule B when thresholds met | > $1,500 interest or dividends, or any foreign account/trust | LOW | Part III is three yes/no questions, not a computation |
| Tax-year parameters as data with source citations | Already a PROJECT.md requirement; the citation part is new | LOW | See pitfall below re: OBBBA |
| Every line cites contributing document hashes (level 1–2) | Success Criterion 3 | MEDIUM | Structural if extraction carries hashes |
| Reproducible re-run: same program + same inputs → same output | Success Criterion 4 | MEDIUM | Needs result to record programHash + input hashes |
| Clean refusal error naming the permitted operations | Anthropic guidance; already a PROJECT.md requirement | LOW | Upstream gap in `match` |
| **Scope guard — fail on unmodeled input** | The difference between "narrow and correct" and "wrong" | MEDIUM | Nobody asks for this; everybody needs it |
| Schema + parameter discovery tools for the agent | The agent cannot author a correct program blind | LOW | Reuses existing RTTI |
| Multi-year: compute any year with parameters + documents | Already a PROJECT.md requirement; also forced by capital loss carryover | MEDIUM | Parameters keyed by year |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| **Level-3 traceability: line → derivation, not just line → source** | No shipping product offers a re-runnable derivation. TurboTax QuickZoom shows you *where*; this shows you *how*, and proves it by re-running. | MEDIUM | Falls out of program-as-report + result-in-CAS |
| **Mechanical 1040-X columns from a report diff** | Corrected doc → re-run → diff → Columns A/B/C with per-line source hashes. Exactly the form's own structure. | MEDIUM | Requires results stored in CAS (open question 5) |
| **Full provenance chain incl. the OCR artifact** | Distinguishes "vision misread the document" from "program misused the value" — the only way to debug the pipeline's most likely error | LOW | Argues for storing the OCR artifact (open question 3) |
| **Reports beyond the 1040 with no engine changes** | A new report is a new program. PROJECT.md's stated payoff. | LOW (by construction) | The proof is a second, non-tax report over the same documents |
| **What-if as an Evo branch, not a feature** | Multiple heads *are* competing scenarios, with provenance | LOW (design-only in v1) | Already a Key Decision; keep the door open |
| **Graded correctness against a public benchmark** | TaxCalcBench: 51 cases, strict + ±$5 metrics, best frontier model 32%. A deterministic engine should score far higher, and that number is publishable evidence for the thesis. | LOW–MEDIUM | `github.com/column-tax/tax-calc-bench`; scope matches v1 closely |
| **Append-only store that satisfies IRS retention by construction** | 3/6/7-year and indefinite-for-basis retention is a hard requirement most personal tooling ignores | LOW (free) | Also means "delete" should not exist |
| **`fjs_check` — validate a program without running it** | Halves the agent's authoring loop *and* is the Week 5 security fix | MEDIUM | Best cost/benefit item in the backlog |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| **`finance_compute_1040` tool** | "Obviously the server should compute the tax" | Destroys the entire thesis. The agent will call it and never author a program. Success Criterion 4 becomes unreachable. | The tool surface exposes documents, schemas, parameters and *execution*. Numbers only ever come out of `fjs_run`. |
| **Agent-authored numbers anywhere in the report** | Faster; the model "already knows" | TaxCalcBench: best frontier model gets 32% of returns exactly right; documented failures include tax-table misuse and qualified-dividends-worksheet errors | Every number is program output. Enforce by reviewing that no report line is a literal. |
| **Normalized "income event" schema across form types** | Cleaner; less duplication | Destroys box-level citation (the product's whole point) and breaks the first time the IRS renumbers a box. W-2 box 14b appeared in 2026. | Dialect per form type, keys mirroring box numbers, revision recorded |
| **Floating-point currency** | Default in JS | Cent-level errors fail the acceptance test outright; the Tax Table's $50 bands make some errors non-obvious | Integer cents or decimal strings; already a PROJECT.md constraint |
| **Tax advice / eligibility interpretation ("should I itemize?", "do I qualify for X?")** | Natural in a chat product | TaxCalcBench specifically found models "incorrectly determine eligibility." An advice surface is unverifiable and unfalsifiable. | Eligibility tests live inside programs, cite the parameter and its source, and appear in the derivation |
| **1099-NEC dialect early** | It is the simplest 1099 (three boxes) | Its downstream — Schedule C, Schedule SE, QBI, quarterly estimates — is explicitly out of scope. Supporting the document without the downstream produces a wrong return. | Out until Schedule C is in scope, which per PROJECT.md is never |
| **State returns** | The W-2 and every 1099 already carry state boxes | ~40 more parameter sets, each with its own rules, forms and worksheets. Doubles+ the surface for a personal tool. | Store boxes 15–20 and 1099 state boxes faithfully; compute nothing |
| **ML/heuristic document classifier and auto-tagging** | Paperless-ngx has it; feels like table stakes for a DMS | The agent classifies documents as part of the vision pass. A second classifier is a second source of truth and a dependency. | Agent asserts the type; optionally cross-check with `fjs/media/type` magic-byte detection on the raw bytes |
| **Full-text search across stored documents** | Standard DMS feature | The agent already reads documents; typed dialects plus list-by-(year, type) answer the real questions. Search would index OCR text, i.e. the least trustworthy artifact. | `finance_documents_list(taxYear, formType)` returning summaries |
| **Delete / retention-expiry / archival policy** | Storage hygiene | IRS retention is 3–7 years and effectively indefinite for basis records. Deletion is a liability, not a feature. CAS is append-only anyway. | Never delete. Add export if anything. |
| **CSV / OFX / QFX parsers** | Listed as a PROJECT.md requirement (unscheduled) | Duplicates the vision-to-dialect path that already covers v1, adds a parser surface under the functionalscript-only dependency rule, and OFX/QFX give transaction feeds — which are *not* tax documents and do not map to 1040 lines | Keep unscheduled. Revisit only if vision proves inadequate on a real document. |
| **Bank/broker API integration (Plaid, direct download)** | "Why upload at all?" | Auth, secrets, network access — all three contradict stdio-only, no-auth, effects-whitelist | Vision over uploaded PDFs |
| **A "tax engine" module** | Natural refactor once three schedules exist | The premise is that there is no engine — reports are programs. A shared engine module recreates the thing the architecture exists to avoid, and every new report starts requiring engine changes. | Shared *data* (parameters, tax tables) and upstreamable generic *helpers* (decimal arithmetic). Not shared tax logic. |
| **A UI** | Everyone builds one | stdio + a conversational agent is the interface, per settled decisions | — |
| **Filing-status optimization (MFJ vs. MFS)** | Genuinely valuable, sometimes worth thousands | Two complete returns plus comparison logic, on top of an engine not yet proven for one | v2, and by then it is just two programs and a diff — no feature work |
| **Estimated tax / W-4 planning (1040-ES)** | Adjacent and useful | Different problem (forward-looking, different year, different parameters) with no shared acceptance test | Out |

---

## Feature Dependencies

```
vnd.fjs.w2 ─────────────────> 1040 line 1a, 25a
                                    │
vnd.fjs.1099int ────────────> 1040 line 2a/2b ──┐
                                    │           ├──> Schedule B (if >$1,500 or foreign)
vnd.fjs.1099div ────────────> 1040 line 3a/3b ──┘
                                    │
                                    ├── box 1b > 0 ──requires──> QUALIFIED DIVIDENDS AND
                                    │                            CAPITAL GAIN TAX WORKSHEET
                                    │                                    │
                                    └── box 2b/2d > 0 ──requires──> SCHEDULE D TAX WORKSHEET
                                                                         │
1040 lines 9,10 ──> AGI (11a/11b) ──> taxable income (15) ──> LINE 16 ───┘
                        │                     │
                        │                     └──> Tax Table (<$100k) | Tax Computation Wksht (>=$100k)
                        │
                        └──requires──> Schedule 1-A Part I (MAGI)
                                            └──> Part V senior deduction (if 65+)
                                                    └──> Part VI ──> 1040 line 13b

vnd.fjs.1099b ──> Form 8949 ──> Schedule D ──> 1040 line 7
      │              ^                │
      │              │                └──> capital loss carryover ──requires──> MULTI-YEAR
      │              │
      └──covered + no adjustments──> Schedule D lines 1a/8a directly (SKIP 8949)

CAS content-addressing ──enables──> deduplication (free)
                       ──enables──> IRS retention compliance (free)
                       ──enables──> idempotent add (free)

extraction carries source hash ──requires──> level-2 traceability
        └──> report result written to CAS ──requires──> level-3 traceability
                    └──> report diff ──enables──> mechanical 1040-X Columns A/B/C

OCR artifact stored ──enables──> "vision misread vs. program misused" diagnosis

finance_schema + finance_tax_params ──requires──> agent authoring a correct program
        (without these the agent guesses field names and hardcodes remembered parameters)

fjs_check (djs/parser validation) ──enables──> faster agent loop
                                  ──enables──> Week 5 import() hardening    [same mechanism]

scope guard ──requires──> dialect registry + declared coverage manifest
```

### Dependency Notes

- **1099-DIV requires the Qualified Dividends worksheet.** This is the sharpest ordering constraint in the project. A v1 that ingests only W-2 + 1099-INT can compute line 16 from the Tax Table alone. Adding 1099-DIV — one more "simple" dialect — silently adds the single largest computation in the scope. Decide this deliberately; do not let it arrive as a surprise in Week 3.
- **Capital loss carryover requires multi-year.** Schedule D line 6/14 pull from the prior year's Capital Loss Carryover Worksheet. Any capital-gains support therefore drags multi-year support forward from "nice" to "required."
- **Schedule 1-A Part V requires only AGI, not new documents.** MAGI (line 3) starts from Form 1040 line 11b and adds back only foreign-income exclusions. So the senior deduction is cheap to add and mandatory for a 65+ taxpayer — check the user's age before scoping it out.
- **Schedule 1-A Parts II/III are blocked by upstream data, not by effort.** IRS Notice 2025-62 means TY2025 W-2s and 1099s do not separately report qualified tips or overtime. The inputs do not exist in the documents. Out of v1 for a reason no amount of engineering changes.
- **Level-3 traceability requires resolving open question 5 toward CAS writes.** An inline-only `fjs_run` result cannot be diffed, cited, or re-verified later. This makes the answer to open question 5 "write back to CAS" fairly clearly, and it means the whitelist includes CAS writes.
- **`fjs_check` and the Week 5 `import()` hardening are the same mechanism.** Both are "parse the blob with `djs/parser` and confirm it is genuine FunctionalScript before doing anything with it." Building it as an agent-facing convenience in Week 1–2 delivers the security fix as a side effect.
- **Scope guard conflicts with "compute a full line-by-line 1040."** They are not both satisfiable in v1. The guard is what makes the partial 1040 honest. Resolve by declaring the covered scope in data and having the program refuse — rather than by quietly emitting a 1040 with unmodeled income missing.
- **Consolidated 1099 conflicts with "one subject per uploaded document"** (open question 2). One PDF contains 1099-INT + 1099-DIV + 1099-B sections. Subject identity must key off the *form instance*, not the file.

---

## MVP Definition

### Launch With (v1)

- [ ] **`vnd.fjs.1099int`** — one dialect first, per `todo/plan.md`. Simplest complete payload, maps to exactly one 1040 line pair.
- [ ] **`vnd.fjs.w2`** — second. Highest coverage of real returns; box 12 (code, amount) list is the first real modelling decision.
- [ ] **`vnd.fjs.1099div`** — third, and the trigger for the Qualified Dividends worksheet. Budget for that when scheduling this.
- [ ] **OCR artifact format, stored** — resolves open question 3 toward "stored," on record-keeping and diagnosability grounds.
- [ ] **`finance_document_add`** — one consolidated ingestion tool over `cas_add` + `evo_add`.
- [ ] **`finance_documents_list(taxYear, formType, response_format)`** — summaries with labels, not bare hashes.
- [ ] **`finance_schema(dialect)`** and **`finance_tax_params(year)`** — the agent cannot author a correct program without them.
- [ ] **`fjs_run`** with result written to CAS, recording `programHash` + input hashes + parameter-set hash.
- [ ] **Restricted runner** with a refusal error that names the permitted operations.
- [ ] **Tax-year parameters as data with per-parameter source citation and effective date** — TY2024 first.
- [ ] **Form 1040 core** (lines 1a–37 for the W-2 + interest + dividends case), **Schedule B**, **Tax Table + Tax Computation Worksheet**, **Qualified Dividends and Capital Gain Tax Worksheet**, **standard deduction incl. age/blindness**.
- [ ] **Scope guard** — declared coverage manifest; program refuses unmodeled document types and unmodeled non-zero boxes.
- [ ] **Level-2 provenance on every computed line** — (documentHash, boxPath, value).
- [ ] **Acceptance harness against the TaxCalcBench corpus** plus the user's own filed TY2024 return.

### Add After Validation (v1.x)

- [ ] **Report diff → 1040-X Columns A/B/C** — trigger: the first corrected 1099 arrives, or the first user correction.
- [ ] **`fjs_check`** — trigger: the agent's program-authoring loop is measurably slow, or Week 5 arrives.
- [ ] **TY2025 parameter set + Schedule 1-A Parts I/V/VI** — trigger: filing season, or taxpayer is 65+.
- [ ] **`vnd.fjs.1099b` + Form 8949 + Schedule D** — trigger: the user has brokerage sales. Start with the covered-and-no-adjustments shortcut straight to Schedule D lines 1a/8a.
- [ ] **`vnd.fjs.1099r`, SSA-1099** — trigger: retirement distributions or Social Security in the user's documents.
- [ ] **A second, non-tax report over the same documents** — the cheapest proof of the "reports are programs" claim.

### Future Consideration (v2+)

- [ ] **Schedule A (itemized)** — only pays off above $15,750/$31,500; defer until a year where it wins.
- [ ] **Schedule 1 breadth, Schedule 2, Schedule 3, Schedule 8812** — add lines as the user's own documents demand them, never speculatively.
- [ ] **K-1 / Schedule E** — the genuine long tail; roughly the cost of everything in v1 combined.
- [ ] **What-if scenarios as named capability** — already deferred; likely dissolves into "another program over branched inputs."
- [ ] **1099-DA / digital assets** — only if the user holds crypto.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---|---|---|---|
| `vnd.fjs.1099int` + `fjs_run` convergence demo | HIGH | LOW | P1 |
| Restricted runner + named-operations refusal error | HIGH | MEDIUM | P1 |
| `finance_schema` + `finance_tax_params` | HIGH | LOW | P1 |
| Tax parameters as data with source citation | HIGH | LOW | P1 |
| Form 1040 core + Schedule B | HIGH | MEDIUM | P1 |
| Tax Table / Tax Computation Worksheet | HIGH | MEDIUM | P1 |
| Qualified Dividends and Capital Gain Tax Worksheet | HIGH | HIGH | P1 (if 1099-DIV in v1) |
| `vnd.fjs.w2` | HIGH | LOW | P1 |
| Level-2 provenance on every line | HIGH | MEDIUM | P1 |
| Result written to CAS with programHash + input hashes | HIGH | LOW | P1 |
| Scope guard / refusal on unmodeled input | HIGH | MEDIUM | P1 |
| OCR artifact stored | MEDIUM | LOW | P1 |
| Consolidated `finance_document_add` | MEDIUM | LOW | P1 |
| TaxCalcBench acceptance harness | HIGH | MEDIUM | P1 |
| `vnd.fjs.1099div` | HIGH | LOW (doc) / HIGH (downstream) | P1–P2 |
| Report diff → 1040-X columns | HIGH | MEDIUM | P2 |
| `fjs_check` (djs/parser validation) | MEDIUM | MEDIUM | P2 |
| Schedule 1-A Parts I/V/VI | MEDIUM (HIGH if 65+) | MEDIUM | P2 |
| 1099-B / 8949 / Schedule D | MEDIUM | HIGH | P2 |
| Capital loss carryover + multi-year | MEDIUM | MEDIUM | P2 |
| 1099-R, SSA-1099 | MEDIUM | HIGH (worksheets) | P3 |
| Schedule A | LOW–MEDIUM | HIGH | P3 |
| K-1 / Schedule E | LOW | VERY HIGH | P3 |
| State returns | LOW | VERY HIGH | Never (anti-feature) |
| E-filing | LOW | VERY HIGH | Never (out of scope) |

---

## Competitor Feature Analysis

| Feature | TurboTax Desktop | OpenTaxSolver | Filed / Invaro OpenTax engines | SurePrep (SPbinder/1040SCAN) | Our Approach |
|---|---|---|---|---|---|
| Form coverage | Effectively complete | 1040 + Sch 1–3, A–D, 6251, 8949, 8889 + ~12 states (TY2025) | Form 1040 TY2025, "131 input nodes… W-2s, 1099s, all major schedules, credits, capital transactions" | N/A (workpapers, not computation) | Deliberately narrow, declared, and refusing outside it |
| Traceability | QuickZoom + Data Source; desktop only, absent from Online | Text output; no per-line provenance | "line-by-line results traceable to IRS instructions"; nodes are pure functions over immutable data | Hyperlinked leadsheets tying 1040 amounts to source documents; tick marks; change highlighting | Level 3 — line → program expression → inputs → source documents → OCR artifact → raw bytes, all content-addressed and re-runnable |
| Reproducibility | Proprietary, unverifiable | Re-runnable | Deterministic by design (directed graph of pure nodes) | N/A | Content-addressed program + inputs; re-run must be bit-identical (Success Criterion 4) |
| Document ingestion | Guided interview + some import | Manual entry | JSON payloads via CLI | 1040SCAN OCR + auto-organized workpaper index | Agent vision → typed dialect → CAS/Evo |
| Corrections / amendments | 1040-X wizard | Manual re-run | Not documented | Change highlighting between binder versions | Evo revision chain; report diff *is* 1040-X Columns A/B/C |
| Agent interface | None | None | CLI + Claude Desktop skills (no MCP) | None | MCP over stdio; program execution is the only path to a number |
| E-filing | Yes | No | MeF XML export | Via integrated tax software | Never |

**Notable:** the two "built for AI agents" open-source engines (Filed's `opentax`, Invaro's `opentax-engine`) both landed on the same architectural conclusion as this project — pure functions, immutable data, deterministic graph — but both expose the *engine* to the agent. This project exposes the *substrate* and makes the agent write the engine. That is the differentiating bet, and it is the one thing TaxCalcBench cannot yet measure.

---

## Open Items and Gaps

- **Not verified in this pass:** exact box list for Form 1099-R, SSA-1099, 1099-OID, 1099-MISC, 1099-DA. Verify from the IRS PDFs before designing those dialects; do not rely on recall.
- **Not verified:** the precise line count and structure of the Qualified Dividends and Capital Gain Tax Worksheet and the Social Security Benefits Worksheet for TY2024/TY2025. These live inside the 1040 instructions (`i1040gi`) rather than as standalone PDFs and should be read line-by-line before estimating the work.
- **Not verified:** whether the TaxCalcBench input format is directly consumable, or needs a shim into `vnd.fjs.*` dialects. Worth 30 minutes on `github.com/column-tax/tax-calc-bench` before committing to it as the acceptance harness.
- **Open for the user, not resolvable by research:** is the taxpayer 65+ (decides Schedule 1-A), do they hold brokerage positions with sales (decides Schedule D timing), do they have dependents (decides Schedule 8812), do they itemize (decides Schedule A)? Each answer removes or adds a whole tier. Ask before finalizing scope.
- **Tension flagged:** PROJECT.md requires "compute a full line-by-line 1040" while the scope guard requires refusing outside a declared scope. These need reconciling in the requirements — most cleanly as "full line-by-line 1040 *for returns within the declared scope*, refusal otherwise."

---

## Sources

**IRS primary sources (HIGH confidence — read directly from the current PDFs and irs.gov):**
- Form 1040 (2025), created 9/5/25 — https://www.irs.gov/pub/irs-pdf/f1040.pdf
- Schedule 1 (Form 1040) 2025, created 7/25/25 — https://www.irs.gov/pub/irs-pdf/f1040s1.pdf
- Schedule 1-A (Form 1040) 2025, created 11/4/25 — https://www.irs.gov/pub/irs-pdf/f1040s1a.pdf
- Schedule B (Form 1040) 2025, created 4/23/25 — https://www.irs.gov/pub/irs-pdf/f1040sb.pdf
- Schedule D (Form 1040) 2025, created 10/6/25 — https://www.irs.gov/pub/irs-pdf/f1040sd.pdf
- Form 8949 (2025), created 5/5/25 — https://www.irs.gov/pub/irs-pdf/f8949.pdf
- Form W-2 — https://www.irs.gov/pub/irs-pdf/fw2.pdf
- Form 1099-INT (Rev. 1-2024) — https://www.irs.gov/pub/irs-pdf/f1099int.pdf
- Form 1099-DIV (Rev. 1-2024) — https://www.irs.gov/pub/irs-pdf/f1099div.pdf
- Schedule K-1 (Form 1065) 2025 — https://www.irs.gov/pub/irs-pdf/f1065sk1.pdf
- Instructions for Form 1099-B — https://www.irs.gov/instructions/i1099b
- About Form 1040 — https://www.irs.gov/forms-pubs/about-form-1040
- Schedule 1-A, Additional Deductions: what to know about the new form — https://www.irs.gov/newsroom/schedule-1-a-additional-deductions-what-to-know-about-the-new-form
- Treasury/IRS penalty relief for TY2025 tips and overtime reporting (Notice 2025-62) — https://www.irs.gov/newsroom/treasury-irs-provide-penalty-relief-for-tax-year-2025-for-information-reporting-on-tips-and-overtime-under-the-one-big-beautiful-bill
- How long should I keep records? — https://www.irs.gov/businesses/small-businesses-self-employed/how-long-should-i-keep-records
- Rev. Proc. 2024-40 (2025 inflation adjustments, pre-OBBBA) — https://www.irs.gov/pub/irs-drop/rp-24-40.pdf
- Instructions for Form 1040-X (12/2025) — https://www.irs.gov/instructions/i1040x
- Publication 1040, Tax and Earned Income Credit Tables — https://www.irs.gov/pub/irs-pdf/p1040.pdf
- PTIN requirements for tax return preparers — https://www.irs.gov/tax-professionals/ptin-requirements-for-tax-return-preparers

**Benchmark and engines (HIGH for the paper, MEDIUM for engine internals):**
- TaxCalcBench: Evaluating Frontier Models on the Tax Calculation Task, arXiv 2507.16126 — https://arxiv.org/pdf/2507.16126
- TaxCalcBench results writeup (Column Tax) — https://www.columntax.com/blog/taxcalcbench
- Dataset — https://github.com/column-tax/tax-calc-bench
- Filed Open Tax Engine — https://github.com/filedcom/opentax
- Invaro opentax-engine — https://github.com/Invaro/opentax-engine
- OpenTaxSolver — https://opentaxsolver.sourceforge.net/

**Agent/tool design (HIGH — official Anthropic engineering guidance):**
- Writing effective tools for AI agents — https://www.anthropic.com/engineering/writing-tools-for-agents

**Traceability in existing tax software (MEDIUM — vendor material and support forums):**
- TurboTax QuickZoom / Data Source — https://ttlc.intuit.com/community/taxes/discussion/what-is-quickzoom-and-how-is-it-used/00/517129
- SurePrep 1040SCAN / SPbinder — https://tax.thomsonreuters.com/en/sureprep and https://corp.sureprep.com/products/1040scan
- CPA Practice Advisor review of 1040SCAN and TaxCaddy — https://www.cpapracticeadvisor.com/2019/08/13/2019-review-of-sureprep-1040scan-and-taxcaddy/34443/

**Document management baseline (MEDIUM):**
- Paperless-ngx usage and advanced topics — https://docs.paperless-ngx.com/usage/ and https://docs.paperless-ngx.com/advanced_usage/

**Consolidated 1099 practice (MEDIUM — brokerage and preparer material, corroborated by IRS general instructions):**
- Schwab composite 1099 — https://www.schwab.com/learn/story/overview-brokerage-1099-tax-form
- Raymond James 2025 composite statement guide — https://www.raymondjames.com/-/media/rj/dotcom/files/client-resources/tax-reporting/cost_basiscomposite_brochure.pdf
- General Instructions for Certain Information Returns — https://www.irs.gov/instructions/i1099gi

---
*Feature research for: MCP server + CAS + agent-authored FunctionalScript tax reports*
*Researched: 2026-08-03*
