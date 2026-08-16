# What This System Can Actually Do

**Measured 2026-08-16 on `develop` @ `fe23d0b`** by starting the server and asking it. Supersedes
the versions pinned to `e7837a3`, `449846a` and `6053db9`.

> **Every number below came from a running server, not from reading source.** That rule exists
> because the first version of this file got the tool count wrong three times — 7, then 8, then 12,
> when the answer was 13 — by grepping for tool declarations and missing the ones spread in from
> upstream. To re-derive anything here: `node index.js`, then send `initialize` →
> `notifications/initialized` → `tools/list` over stdio. To learn a valid argument set, call a tool
> with a deliberately wrong one; the refusal names the valid values.

---

## The short version

**There are two halves to this project, and they are not connected to each other.**

The **tax engine** computes a real Form 1040 correctly. It has been checked against a real IRS
transcript and produces the right refund to the cent.

The **server** stores documents, versions them, and runs agent-written programs safely.

**Nothing joins them.** No server command produces a tax return. If you connected this to Claude
today and asked it to do your taxes, it could store your W-2 and read it back — and that is all.
The calculator is reachable only from test code and from the demo.

That is not a bug that slipped through; it is the next scheduled piece of work (Phase 21), and the
demo says so on its own first page.

---

## What runs end to end today

Three complete scenarios. Each was exercised against a live server.

### 1. Store a tax document and get it back — **works**

Store a W-2 (or any of the ten supported document types) as versioned JSON. It gets a content
hash. Amend it later and the old version stays; you get a chain of revisions with the correction
history intact. List what you have, read any version, mark one archived without deleting it.

**Commands:** `cas_add` → `evo_add` → `finance_documents_list` → `evo_head` → `evo_revision`

This is genuinely useful on its own: it is a tamper-evident filing cabinet for tax paperwork,
where nothing is ever silently overwritten.

### 2. Look up the rules — **works**

Ask what any document type looks like (`finance_schema`), or ask for the 2025 tax parameters
(`finance_tax_params`) — standard deduction, brackets, capital-gains breakpoints, each with a
citation back to the IRS source it came from.

**Caveat found while measuring:** the argument is `year`, **not** `taxYear`, even though the tool's
own description says "given a tax year" and its output field is called `taxYear`. Passing `taxYear`
returns `invalid arguments: unexpected value`. Only 2025 exists.

### 3. Write a program and have the server run it — **works**

This is the architectural centrepiece. Instead of the server having a "calculate my taxes" button,
the agent **writes a small program**, stores it, and the server executes it in a sandbox with
access to nothing but the document store. The result is saved as a run record with the hashes of
the program and the inputs, so the same run can be reproduced later and proved identical.

**Commands:** `cas_add` (the program) → `fjs_check` → `fjs_run` → run record

The sandbox is real and tested: a program asking for network or filesystem access is refused by
name. Escape routes through inherited JavaScript properties (`constructor`, `__defineGetter__`
and friends) are individually blocked and individually proven.

**One honest limit:** a program that calls `globalThis.fetch` directly still runs with host
privileges. That is a known, recorded, accepted risk — not a discovery.

---

## What does not run end to end

### Computing a tax return through the product — **does not work**

The 1040 engine is complete for a mainstream return and is proven by roughly 950 tests. It
computes all 56 printed lines, picks correctly between the Tax Table, the Tax Computation
Worksheet, the qualified-dividends worksheet and the Schedule D worksheet, and every figure it
produces cites the exact document box it came from.

**None of it is reachable from the server.** Stored programs cannot import code — that is a
deliberate security property — so no program the agent writes can reach the engine. The two halves
have never been joined.

**What this means practically:** the $5,535 refund figure computed from your 2025 transcript is
real arithmetic from the real engine, but it was produced by running a script directly against the
code, not by using the product.

---

## A gap found while measuring this

**Three document types the engine requires have no readable schema.**

`finance_schema` serves ten dialects. The engine's input type requires two more that it does not
serve:

| Document | Needed by the engine? | Schema readable? |
|---|---|---|
| `vnd.fjs.itemized_deductions` | **Yes** — required field on the 1040 input | **No** |
| `vnd.fjs.prior_year_capital_loss` | **Yes** — required field on the 1040 input | **No** |
| `vnd.fjs.consolidated_provenance` | internal | No |

So an agent serving anyone who **itemizes**, or anyone carrying a **capital loss forward**, cannot
find out what those documents should look like. It would have to guess the field names.

This does not break anything today, precisely *because* nothing reaches the engine through the
server — but it becomes a blocker the moment Phase 21 connects them. Recorded here rather than
fixed, because fixing it belongs in that phase.

---

## The measured surface

**13 tools** · protocol `2025-11-25` · server `finance-mcp 0.12.0`

| Group | Tools |
|---|---|
| Content store | `cas_add`, `cas_get`, `cas_list`, `cas_refresh` |
| Versioning | `evo_add`, `evo_list`, `evo_head`, `evo_revision` |
| Tax reference | `finance_schema`, `finance_tax_params`, `finance_documents_list` |
| Program execution | `fjs_run`, `fjs_check` |

**10 document types**, as reported by the server:

`w2` · `1099int` · `1099div` · `1099b` · `1099r` · `1099g` · `ssa1099` · `medical_expenses` ·
`return_profile` · `ocr`

**1 tax year:** 2025.

---

## Who this can actually do taxes for

From `.planning/PERSONA-COVERAGE.md`, measured the same way. This is about the **engine**, since
nothing reaches it through the server yet.

| Person | Can it produce a return? | Blocker |
|---|---|---|
| **Retired** | **Yes** | None. Four narrow gaps, biggest is charitable IRA distributions. |
| **Non-profit worker** | Computes, but **overstates the tax** | Student-loan interest, educator expenses and HSA are all hard-coded zeros. Silent. |
| **FAANG engineer** | **No** | Form 8959 is mandatory above $200k of wages and is not modelled. |
| **Startup founder** | **No** | No Schedule C, SE, E, K-1, 1099-NEC, QBI or AMT. |

**The non-profit case is the dangerous one.** The other two refuse — loudly and safely. That one
produces a confident, fully-cited return that is simply wrong, because a missing deduction is
modelled as a legitimate zero rather than as something the engine knows it cannot handle.

---

## Health

- `npm test`: **6394 / 6394**, exit 0
- `tsc --noEmit`: clean
- ~953 distinct proofs
- Suite runtime 25–140 seconds, varying about fivefold with machine load

---

## What has to happen next, in order

1. **Connect the engine to the server** (Phase 21) — the single change that turns a proven library
   into a usable product. Everything it needs already exists. Note the trap: the obvious
   implementation is explicitly forbidden by the project's own design rules.
2. **Add the tripwires** (Phase 22) — make the engine refuse when a document implies a tax it
   cannot compute. Today a $300,000 W-2 quietly understates by about $900.
3. **Then the missing forms**, one persona at a time.
