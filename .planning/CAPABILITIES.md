# Finance — Capability Snapshot

**Pinned to:** `02d478d` (2026-08-11)
**Suite at that commit:** `npm test` green — 6230/6230, 0 failures; 874 de-duplicated project-local proofs
**Phase state:** 14 of 19 phases complete; Phase 15 in flight (3 of 6 plans landed at this commit)

> **Read this file as a snapshot, not a contract.** It answers one question — *what can this
> system actually do today?* — and it is derived by reading the code, not the roadmap.
> REQUIREMENTS.md says what is promised; ROADMAP.md says when; **this file says what runs.**
>
> Everything below was verified against source at the pinned commit. Where a capability is
> partial or unreachable, that is stated rather than omitted. Regenerate with `/gsd-progress`
> after any phase closes, and re-pin the commit — a capability list that outlives its commit
> becomes marketing.

---

## The one-line summary

**A working, fully traceable TY2025 tax engine for one specific taxpayer profile, driven by an
agent-authored program — with the document-ingestion half of its own story still missing from
the MCP surface.**

---

## The MCP surface

Eight tools over local stdio (remote transport is an explicit v2 milestone):

| Tool | What it does |
|---|---|
| `fjs_run` | The main event. Executes a stored FunctionalScript program over stored documents; returns the report and writes a run record. |
| `fjs_check` | Smoke-checks a stored program — imports it and confirms it exports the right shape, **without ever executing it**. An agent-productivity feature with **zero** security value; it is not a security control and must never be described as one. |
| `finance_schema` | Schema discovery for the document dialects. |
| `finance_tax_params` | Given a tax year, returns that year's parameter set. An unknown year is an ordinary refusal, not a crash. |
| `finance_documents_list` | Lists stored documents. |
| `evo_head` | Current revision for a subject. |
| `evo_list` | Subject/revision enumeration. |
| `cas_refresh` | Picks up blobs written into the store by another process, without a server restart. |

**There is no document-write tool.** See "What does not run end to end" below — this is the
single most important limitation on this page.

---

## Scenarios that genuinely run start to end

### 1. Compute a complete Form 1040 for the declared profile

The real capability, proven by a real-process integration test (`TEST-01/TEST-02`) that spawns
an actual `node index.js` against a real filesystem — not an in-process simulation.

- **All 56 printed money lines** of Form 1040 (lines 1a–37) compute. The count is a hand-typed
  guard (`expectedWholeReportLineCount = 56`), deliberately not derived from the code under test,
  so it can actually fail.
- Supporting forms implemented: **Schedules 1, 1-A, 2, 3, A, B, D**, plus **Form 8812** and
  **Form 8949**.

**The profile it handles completely:** a 65+ filer with retirement and Social Security income,
brokerage sales, dependents, and itemized deductions. Concretely, that includes:

| Capability | Notes |
|---|---|
| Senior deduction (Schedule 1-A) | OBBBA, continuous 6% phase-out over $75k/$150k, MFS short-circuit before arithmetic |
| Social Security Benefits Worksheet | All 18 printed lines in printed order, including the tax-exempt-interest add-back and the 85% tier |
| Standard vs. itemized | Strict `>` comparison, both directions proven — including the case where itemizing loses despite exceeding the base, because age/blindness boxes raise the real standard deduction |
| Schedule A | All 18 lines, SALT worksheet with the MFS halving rule, 7.5% medical floor |
| Child credits (Form 8812) | CTC / ODC / ACTC, stepped phase-out with a true $50 cliff |
| Capital gains | Form 8949 category derivation → Schedule D, loss-cap three-way branch, Schedule D Tax Worksheet |
| Tax computation | Tax Table as published data, plus the bracket/worksheet dispatch on line 16 |

### 2. Refuse honestly when out of scope

**15 income and credit kinds are modeled; 21 are refused by name** — household employee wages,
unreported tips, QBI deduction, earned income credit, education credits, Schedule J farm income
averaging, and others. A taxpayer who declares one gets a loud, correctly-labeled refusal instead
of a silent `$0`.

This is the design working, not a gap. TAX-16 exists precisely to prevent a confident zero
standing in for an honest "not modeled."

### 3. Prove the answer was not fabricated

- Every report line carries `(documentHash, boxPath, value)` tuples plus the rule or worksheet
  line it implements. A line with `{ value }` and no `{ sources }` **does not typecheck** —
  traceability enforced by the type system, not convention.
- Each run writes a run record carrying the program hash and the inputs read.
- An anti-hardcoding gate reports CAS read count and a numeric-literal audit with each run, plus
  a perturbation check that changes an input and asserts the output moves. (`main = () => pure({
  line16: 9137 })` would satisfy every other criterion while defeating the whole thesis.)
- A mechanical, case-insensitive gate proves no `magi` identifier exists anywhere in `fjs/` —
  each rule computes its own separately-named income function with its own documented add-back
  list, even where several currently equal bare AGI.

### 4. Notice a document written by a different process

A live server picks up a revision added out-of-band via `cas_refresh`, without restarting.
Proven cross-process, with a genuinely separate OS process doing the write.

### 5. Run a second, non-tax report over the same documents

An income-by-payer summary runs through the same `fjs_run` path with **no engine change**,
reusing the same traced `ReportLine` type. A mechanical import-graph gate proves
`fjs/report/payer` imports nothing from `fjs/tax/*`.

This is the cheapest available evidence that the report layer is not a tax engine wearing a
disguise.

### 6. Exact arithmetic throughout

Money is `bigint` cents everywhere — never floats. Rounding is a property of a specific 1040
line, not of a value, and the whole-dollar election is an explicit projection.

---

## Document dialects

Eleven typed dialects, each with its own `validate` and `checkReferences` and co-located proofs:

| Dialect | Source |
|---|---|
| `vnd.fjs.w2` | Wage and tax statement |
| `vnd.fjs.1099int` | Interest income |
| `vnd.fjs.1099div` | Dividends and distributions |
| `vnd.fjs.1099b` | Broker proceeds |
| `vnd.fjs.1099r` | Retirement distributions |
| `vnd.fjs.ssa1099` | Social Security benefits |
| `vnd.fjs.itemized_deductions` | Schedule A substantiation |
| `vnd.fjs.medical_expenses` | Taxpayer-asserted medical spend (no IRS form reports it) |
| `vnd.fjs.prior_year_capital_loss` | Prior-year Schedule D figures for the carryover worksheet |
| `vnd.fjs.ocr` | Vision transcription artifact |
| `vnd.fjs.return_profile` | Taxpayer declarations (filing status, age/blindness, dependents, elections) |

---

## What does NOT run end to end

### The document-ingestion half is missing from the MCP surface

**No `evo_add` or `cas_add` tool is registered on this server.** Documents enter the store via
the `fjs cas add` **CLI — a separate process, out of band.**

So the story README tells — *upload → ask "what do I owe for 2025?" → answer, in one Claude Code
or Claude Desktop session touching no code* — **cannot be completed inside a single MCP
conversation today.** You can ask, and get a fully traceable answer. You cannot put the documents
in that way.

This is exactly Phase 14's success criterion 1, and **Phase 14 is skipped** (owner decision,
2026-08-11). Nothing currently scheduled restores it.

### The vision/OCR ingestion path is unreachable

`fjs/document/1099int/from_ocr` and its two dependants are tested but not reachable from
`index.js`. That is MAINT-01; Phase 16 exists to decide whether to wire it up or delete it.
Tested code that nothing can execute is worse than either.

### Nothing has been checked against a real filed return

The engine agrees with the constants it was given. **No human has confirmed those constants match
the printed IRS PDFs** (Phase 13's open `human_needed` item), and no return the IRS actually
accepted has been reproduced. A green suite cannot detect a correctly-implemented wrong constant.

### One tax year

TY2025 only. The seam is cut — `taxParamsByYear` is open-keyed and every computation module
already takes `TaxParamSet` as an explicit argument — but only one year is populated. Phase 15
proves genericity structurally rather than transcribing a second year's figures.

### Local stdio only

No remote transport. HTTPS + OAuth, required for any browser-hosted client, is a v2 milestone.

---

## Carried verification debt

Six items, none of which a green suite can close:

| Phase | Item |
|---|---|
| 05, 06, 07 | Never independently verified against their goals — no VERIFICATION.md under any name |
| 10 | Tax Computation Worksheet: cent-exact or whole-dollar? Pinned at $184,094.50 for MFJ at $700,000 taxable |
| 13 | The TY2025 figures have never been checked against the printed IRS PDFs |
| 15 | The four prior-year line references in the new carryover dialect (in flight) |

Items 2 and 3 were both to be resolved by Phase 14's run against a real filed return. With
Phase 14 skipped, they have **no scheduled owner** — see STATE.md's "CARRIED, NOW UNOWNED" block.

---

## How to re-derive this file

Do not trust it; re-measure it. The commands that produced the numbers above:

```sh
npm test                                    # full suite: tsc && node --test

# de-duplicated project-local proofs — the bare `grep -c` form DOUBLE-COUNTS when the
# functionalscript submodule is initialized, because its own all.test.js re-scans this tree
node --test 2>&1 | grep '^✔ import("./fjs/' | sed 's/ ([0-9.]*ms)$//' | sort -u | wc -l

grep -oE "t\.name === '[a-z_]+'" fjs/server/module.f.js | sort -u    # registered tools
sed -n '213,300p' fjs/return/scope/module.f.js                        # modeled kinds
sed -n '301,400p' fjs/return/scope/module.f.js                        # refused kinds
```
