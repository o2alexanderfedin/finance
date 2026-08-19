# What This System Can Actually Do

**Measured 2026-08-17 on `develop` @ `fd6702c`** (the v1.0.0 release point) for the server surface,
**re-measured at `0ecec40`** for the suite figures, by starting the server and asking it. Supersedes every earlier version, all of which predate the release.

> **Every number below came from a running server or a full suite run, not from reading source.**
> That rule exists because the first version of this file got the tool count wrong three times,
> and the version before this one survived the release with pre-release figures in it.
> To re-derive: `node index.js`, then `initialize` → `notifications/initialized` → `tools/list`
> over stdio. To learn a valid argument set, call a tool with a deliberately wrong one; the refusal
> names the valid values — that is how the dialect list below was obtained.

---

## The short version

**The two halves are joined.** A stored program, written by the agent and executed by the server in
a sandbox, reads your documents and produces a complete Form 1040 — every figure citing the exact
document box it came from, the whole run recorded so it can be replayed and proven byte-identical.

That was not true until 2026-08-16. Phase 21 connected them **without** adding a
"calculate my taxes" tool, which the project forbids: the engine reaches guest programs as a pure
value on their context, so the agent still authors the program.

**All four reference taxpayers compute.** A milestone ago, one did.

---

## What runs end to end

| Scenario | Status |
|---|---|
| Store a tax document, amend it, read any revision | **works** |
| Look up a document's schema, or a year's tax parameters | **works** |
| Write a program, have the server run it in a sandbox, get a reproducible run record | **works** |
| **Produce a complete Form 1040 from stored documents** | **works** — Phase 21 |

The last one is verified by a real-process test: documents in via `evo_add`, program in CAS,
executed by `fjs_run`, result written as a `vnd.fjs.run` record, and a **pinned rerun across an
intervening amendment reproduces it byte for byte**.

---

## Who it can do taxes for

Measured against `.planning/PERSONA-COVERAGE.md`'s four reference taxpayers.

| Person | At the start of milestone v2 | Now |
|---|---|---|
| **Retired** | yes | **yes** — plus charitable IRA distributions and after-tax IRA basis |
| **Non-profit worker** | computed, but **overstated the tax** | **yes** — student loan interest, educator expenses, HSA, and the Earned Income Credit |
| **FAANG engineer** | **refused** | **yes** — Forms 8959, 8960, the full AMT including Part III, and equity-comp basis correction |
| **Startup founder** | **refused** | **yes** — Schedule C, Schedule SE, QBI both below and above the threshold, K-1s, Schedule E |

Two figures worth knowing, both computed by the engine on real fixtures:

- **$49,467.75** of income was being taxed twice for anyone with vested equity, because brokers
  correctly report $0 basis on stock already taxed through payroll. Now corrected.
- **$10,049.64** separates a general partner from an S-corp shareholder on identical income — the
  entity type alone. When the documents do not say which you are, the engine refuses.

---

## What it refuses, and why that is the point

The engine **refuses rather than guessing** wherever it cannot compute honestly. Each refusal names
the form or the facts that would supply it.

**The refusal surface is a partition, checked at `tsc`:** every one of **197 income, deduction,
credit and payment kinds** is either modeled or carries a refusal naming what is missing —
**56 modeled, 141 refused**, and `_EveryKindIsEitherModeledOrRefused` fails the build if a kind
falls in neither. Re-derive with `modeledKinds.length` / `unmodeledKindRefusals.length` in
`fjs/return/scope`.

The refused half jumped 65 → 143 on 2026-08-18, when the last six coarse kinds — each naming a
printed line that collapsed many unrelated facts — became 84 per-fact kinds read off the 2025
printed forms and instructions. **Nothing was reclassified in that change**: the modeled count
did not move, and a taxpayer who is refused now gets told which document, form or determination
is missing rather than that a whole lettered block is unmodeled.

It then fell 143 → 142, and the modeled half rose 52 → 53, when Form 7206 made
`selfEmployedHealthInsuranceDeduction` computable at Schedule 1 line 17. **One kind, moved across
the partition** — the two moves are independent, so the vocabulary is still the 195 the split
left.

It fell again, 142 → 141, and the modeled half rose 53 → 54, when Schedule E Part I made
`rentalRealEstateAndRoyalties` computable at Schedule 1 line 5. **A second single kind moved
across the same partition**, on the same terms and for the same reason: the wiring landed first
and the reclassification rode with it. Neither reclassification invented or retired a kind.

Then it rose 141 → 143 and the **vocabulary itself grew, 195 → 197**, when Form 6781 Part I
wired Form 1099-B box 11 onto Schedule D lines 4 and 11 under §1256(a)(3)'s 60/40 split. This is
the opposite move from the two above and worth distinguishing: **nothing was reclassified**, and
the modeled half did not change. The two new kinds — `straddleGainsAndLosses` and
`netSectionTwelveFiftySixContractsLossCarryback` — name the parts of Form 6781 that remain
uncomputable (Parts II and III need per-position records no information return carries; the box D
election needs three prior years' returns), and they exist because §1256 contracts had **no kind
at all** before that wiring: a futures trader fell through the scope guard entirely. Adding a
refused kind where there was silence is a gain in honesty, not a loss of coverage. 54 + 143 = 197.

It fell a third time, 143 → 142, and the modeled half rose 54 → 55, when Schedule F made
`farmIncomeOrLoss` computable at Schedule 1 line 6 — and at Schedule SE line 1a, which is the
half a reclassification could have skipped while looking complete. **A third single kind moved
across the same partition**, on the same terms, and 55 + 142 = 197. Its two farm neighbours did
NOT move: `netFarmRentalIncomeForm4835` is Form 4835, a different printed form for a landowner
who did not materially participate, and `farmIncomeAveragingScheduleJ` is Schedule J, which
averages farm income over three preceding years this engine does not hold.

**Schedule F and Form 6781 were written on branches whose common ancestor had a refused half of
141**, and this paragraph is where reading either branch's own figure would have gone wrong: one
added two rows
and reclassified nobody, the other reclassified one row and added none, so the two compose to
`141 + 2 - 1` and the vocabulary keeps Form 6781's 197 rather than returning to 195. The
arithmetic is stated rather than transcribed because both branches were internally consistent
and both were superseded the moment they met.

The conditional refusals — the ones that fire on a taxpayer whose kinds are all modeled:

| Refused | Because |
|---|---|
| A nonqualified Roth distribution (1099-R box 7a code `J` or `T`) | Form 8606 Part III is unbuilt. Part I and **Part II compute**, so a backdoor Roth works. |
| Qualified disaster distributions (Form 8606 line 15b) | Form 8915-F is unbuilt |
| A business **loss** | the at-risk determination (Form 6198) needs a multi-year basis history |
| A farm **loss** | §461(l)'s excess business loss aggregates every trade or business including Form 4797 gains, and §199A(c)(2) carries a negative QBI amount into next year |
| A farm on the **accrual** method | printed Schedule F line 45's beginning-of-year inventory, and the valuation method the printed footnote to line 49 makes the sign of lines 47-50 depend on |
| A farm the taxpayer did not **materially participate** in | it is a passive activity, so §1411(c)(1)(A)(ii) makes its income net investment income and Form 8960 line 4b is unbuilt |
| A farm beside a Schedule C business | Form 8995-A figures its limitations per business and this engine carries one business's W-2 wages and unadjusted basis |
| A mixed-tax-year document store | 2024 and 2025 W-2s together would silently mis-total |
| Two businesses, or two K-1s from one entity | netting them is the arithmetic §704(d) exists to stop |
| Two Schedules SE (both spouses self-employed) | one Schedule SE is computed; two are a phase of their own |

**Four refusals listed here before the release have since been built and are gone:** the Earned
Income Credit (Phase 32, `fjs/schedule/eic` → 1040 line 27a), QBI above the income threshold
(Phase 31, `fjs/form8995a` with Schedule A's SSTB percentage and Part III's wage/UBIA phase-in),
AMT with capital gains or qualified dividends (Phase 29, `fjs/form6251/part3`), and Form 8606
Part II.

**There is also a complementary guard.** Some taxes trigger on a threshold from data already held,
on a taxpayer who has never heard of the form — so **12 tripwires** refuse when the documents prove
an obligation was not declared. Without them, a $300,000 W-2 understated tax by ~$900, silently.
A tripwire that always fires is not a tripwire; each one is proven to stay quiet on a return that
does not owe the thing.

---

## The measured surface

**13 tools** · protocol `2025-11-25` · server `finance-mcp 1.0.0` · **30 document dialects**

| Group | Tools |
|---|---|
| Content store | `cas_add`, `cas_get`, `cas_list`, `cas_refresh` |
| Versioning | `evo_add`, `evo_list`, `evo_head`, `evo_revision` |
| Tax reference | `finance_schema`, `finance_tax_params`, `finance_documents_list` |
| Program execution | `fjs_run`, `fjs_check` |

**The tool count has not moved through twelve phases, deliberately.** A `finance_compute_1040` tool
would let the agent stop authoring programs, which is the one thing the architecture exists to
prevent. `tools/list` returning 13 is the check.

`finance_tax_params` takes **`year`**, not `taxYear` — `fjs_run` uses `taxYear` for the same
concept. The tool's own description says so; renaming it would be a breaking change to a live
surface. **Only 2025 exists** — `finance_tax_params` with any other year refuses and names it.

---

## Health

- `npm test`: **2902 / 2902**, exit 0 (`tsc` runs first and is clean). **Wall clock is 5-31s and
  is not a stable figure** — measured 31s, 4.9s, 12.5s and 11.9s across four runs on 2026-08-17
  with no code change between them. It is dominated by three tests that spawn real `node`
  subprocesses (`EXEC-14/PROV-09` alone ranged 3.5s-29.3s), so it tracks machine load, not the
  suite. The 2863 proof leaves are milliseconds each. This pair read 2253/2220 until
  2026-08-19 — figures from before the Tier-B forms landed, and stale on `develop` and on the
  feature branch alike, which is what an ungated number does.
- **2863 project-local proof leaves** — the only stable count:
  `npm test 2>&1 | grep -c '^✔ import("./fjs/'`
- Requirements: **120 defined, 120 complete, 0 open**

**Two standing gates now compare the documents to the code**, because this file had been wrong
about the version, the dialect count, the test total and four separate refusals at once:
`planning-truth-gate.test.js` checks REQUIREMENTS.md's checkboxes against its traceability tables
and every tool/dialect count claimed in `.planning/*.md` and the root `*.md`, and
`fjs/server`'s `toolsListIsExactlyTheHandTypedToolSet` pins the served tool set by name in both
directions — the invariant that forbids a `finance_compute_1040` tool had nothing behind it until
2026-08-17.

**Never gate on `npm test`'s total** (AGENTS.md line 127). It includes ~2,100 vendored
`functionalscript` submodule proofs and moves with submodule state; the submodule is deliberately
de-initialised. Until 2026-08-17 the suite silently ran the entire proof set **twice** — bare
`node --test` was discovering the submodule's own `.ts` entry point — which is why `npm test` is
pinned to `node --test *.test.js` and why earlier versions of this file reported 8533 and 4273.

---

## Known gaps

Nothing here is an open requirement. `fjs/todo/` holds **seven** files. Three are satisfied specs
kept in their original present tense, each with a corrected status line on top — deleting them
would lose the ability to check a spec against the thing that satisfied it. Two are upstream, and
both are filed upstream. **Two are this repository's own, and both are sized rather than open
questions** — this section said "nothing left open is fixable in this repository" while `develop`
carried five files, and the Tier-B forms brought two more with them:

1. **`tax-return-report-source-route-lines-unexercised.md`** — eight of the stored program's
   twenty-eight route lines are EXECUTED against the real stored bytes; twenty are covered by a
   `String.includes` of the dialect tag, which cannot see a line that is present and wrong. The
   note carries the recipe and the measured cost per remaining line.
2. **`stored-but-unread-field-sweep.md`** — the standing gate over the stored-but-unread money
   box: `fjs/document/unread_registry` names every field a document stores and no form reads,
   and the note carries the partition.
3. **`upstream-node-spawn-effect.md`** — `fjs/effects/node` has an `Exec` effect but no long-lived
   `Spawn`. 0.46's error channel makes the shape expressible (`CreateServer`/`Listen` already thread
   an opaque `Nominal` host handle, which is the precedent), so the old "wait for a second caller"
   deferral is retired. Filed as `functionalscript#1649`. The note's own sketch does not type-check
   at 0.46.1 — every operation must return a `Result` — and the corrected five-operation design is
   in the issue.
4. **`upstream-cas-get-uri-discloses-host-path.md`** — `cas_get` puts the blob's **absolute host
   path** in its `uri` field, unconditionally: one call reveals the home directory, the account name
   and the store layout. Verified by execution. A design decision on a public protocol surface, so
   it is filed as `functionalscript#1650` and left to the maintainer. Latent rather than live —
   stdio is the only transport today, and a local client could read `os.homedir()` itself.

**The dependency question is closed.** `functionalscript` is at **^0.46.1**. This section read
"pinned at 0.43.1 because 0.44/0.45 dropped the `.js` emit" until 2026-08-19, which was true when
written: 0.45 left 288 errors after the mechanical rename, each fixable only by a cast, an `any` or a
redeclared type. 0.46 left **630** and every one of them was ordinary work — the larger number was
the smaller job, and no count alone could have told them apart. See
`.planning/reports/fjs-0.46.1-migration.md`.

**Phase 16 was RESOLVED BY REMOVAL** in Phase 31 (MAINT-01): `fjs/document/1099int/from_ocr` and
`fjs/document/ocr_amount` are deleted, and the `vnd.fjs.ocr` dialect itself stays live. This line
said the phase "remains deferred by owner decision" until 2026-08-17 — the deferral was real, and
then the decision was taken.
