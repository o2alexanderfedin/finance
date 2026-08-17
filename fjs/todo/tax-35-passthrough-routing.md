# TAX-35, routing half — verified scout, not yet implemented

Status: **NOT IMPLEMENTED.** This file records what was *verified against the code* by a session
that ran out of context before writing the routing. Everything below was checked by reading the
named line, not carried over from a handoff. Where something was only read and not executed, it
says so.

The point of the file is that the next session does not have to re-derive the box map or the leaf
arithmetic, which is where most of the budget went.

## Baseline this was measured against

`develop` @ `d489213`, submodule deliberately de-initialised at `cc93a3ca`.

```
npm test 2>&1 | grep -c '^✔ import("./fjs/'      # 2161  project-local leaves
npm test 2>&1 | grep -E '^ℹ (tests|pass|fail)'   # 2185 / 2185 / 0
```

Both re-derived independently, not trusted from a report. **Never gate on the total**
(AGENTS.md line 127) — it moves with submodule state. Watch the project-local count.

## The box map — VERIFIED against each dialect's own table

Read directly from the three `unmodeledMoneyBoxes` tables. Line numbers are at the verified base.

| Destination | `k1_1065` (partner) | `k1_1120s` (shareholder) | `k1_1041` (beneficiary) |
|---|---|---|---|
| 1040 line 2b interest | `box5InterestIncome` :280 | `box4InterestIncome` :194 | `box1InterestIncome` :222 |
| 1040 line 3b ordinary dividends | `box6aOrdinaryDividends` :281 | `box5aOrdinaryDividends` :195 | `box2aOrdinaryDividends` :223 |
| 1040 line 3a qualified dividends | `box6bQualifiedDividends` :282 | `box5bQualifiedDividends` :196 | `box2bQualifiedDividends` :224 |
| Schedule D line 5 short-term | `box8NetShortTermCapitalGain` :285 | `box7NetShortTermCapitalGain` :198 | `box3NetShortTermCapitalGain` :225 |
| Schedule D line 12 long-term | `box9aNetLongTermCapitalGain` :286 | `box8aNetLongTermCapitalGain` :199 | `box4aNetLongTermCapitalGain` :226 |

**Every row differs across all three faces, and that is the whole trap.** "Box 5" means three
unrelated things: taxable interest on the 1065, ordinary/qualified dividends on the 1120-S
(`box5a`/`box5b`), and *other portfolio and nonbusiness income* on the 1041. A shared destination
table would get exactly this wrong, which is why `k1_1120s` :185-189 says in prose that the table
is deliberately **not** shared.

Three further facts, each verified at the line:

- `k1_1041`'s `box5OtherPortfolioAndNonbusinessIncome` (:229) routes to **Schedule E line 33
  column (f)**, NOT 1040 line 2b. Do not let a shared "box 5 → interest" rule capture it. Its own
  destination string already explains why (portfolio income, §469(e)(1) / §1411(c)(1)).
- `box6cDividendEquivalents` (1065 :283) is a §871(m) dividend equivalent → **1040 line 3b**.
  It belongs in the dividend slice, so the 1065 routes **six** boxes where the other two route five.
- The 28%-rate and unrecaptured-§1250 boxes route to **worksheets** (Schedule D 18/19) and are NOT
  already modeled: 1065 `box9b`/`box9c` (:287-288), 1120s `box8b`/`box8c` (:200-201), 1041
  `box4b`/`box4c` (:227-228). **They stay refused.**

## Leaf arithmetic — predict this BEFORE running the suite

Each box removed from a dialect's `unmodeledMoneyBoxes` drops **2** generated leaves, because both
`perUnmodeledBoxRefusal` and `perUnmodeledBoxZeroAccepted` are `Object.fromEntries(...map(...))`
over that same array (1065 :482/:494, 1120s :337/:349, 1041 :408/:420).

| Dialect | entries now | routed away | entries after | `expectedUnmodeledBoxCount` | leaves |
|---|---|---|---|---|---|
| `k1_1065` | 17 | 6 | 11 | :507 `17` → `11` | −12 |
| `k1_1120s` | 12 | 5 | 7 | :362 `12` → `7` | −10 |
| `k1_1041` | 11 | 5 | 6 | :434 `11` → `6` | −10 |

**Total −32 generated leaves.** So the new fixtures must add more than 32 for the project-local
count to rise at all, and a *rise* is therefore not evidence that nothing vanished. Write the
predicted number down, then compare.

### The prose counts are assertions, not decoration

- `k1_1065` :264 — "Seventeen of the eighteen fixed-caption money boxes are here. Box 1 is the one
  that is not" → becomes **eleven of the eighteen**, and seven are now not here (box 1, which was
  already computed, plus the six newly routed). The sentence's *structure* has to change, not just
  its numeral: it currently explains a single exception.
- `k1_1041` :213 — "Eleven of the twelve ... Box 6 is the one that is not" → **six of the twelve**,
  same structural problem.
- `k1_1120s` :183-189 — carries no numeral in the text read, but **re-check it**; its prose asserts
  the destinations match the partnership's, which stays true only for the boxes that remain.

Recompute these from the files' actual box lists rather than from this table.

## Wiring checklist (from `git show 6dded4e`)

- `guest/tax` — EngineDocument typedef, bucket, reducer, **and the duplicated stored-text strings**
- `report/tax_return` — `expectedDispatchedDialectCount`, currently `25` at :1327, asserted :1832
- `return/scope` — counts + remedy prose
- `return/tripwire`
- `demo/`

`fjs/schedule/d` has `const line5 = 0n` (~264) and `const line12 = 0n` (~301) — the real passthrough
lines, already summed into line 7 / line 15. The proofs at ~768/~773 assert they are `0n` and must
be updated. `shortTermAndLongTermKeptIndependentlyObservable` (~625) is where a transposition guard
belongs.

## Acceptance — and the thing a total cannot see

Each routing needs a fixture where the destination moves by **exactly** the K-1's contribution, and
a control where it does not move. `addBoxSums` concatenates `sources`, so **assert `boxPath` per
box, not just the total** — a two-field transposition is invisible to a sum. The
`fjs/schedule/se` proofs at :1009-1056 are the idiom to copy: they assert
`sourceAt(result.sources)(0).boxPath` by name, and additionally assert a *wrong* box is absent
(`source.boxPath !== 'box5MedicareWagesAndTips'`).

Per slice, mutate by swapping two box names in the routing map and confirm a `boxPath` assertion
reddens — not merely that some leaf reddens.

## The `taxReturnReportSource` coverage gap — VERIFIED, still open

`fjs/report/tax_return` holds two parallel implementations: the stored program **source text**
(`taxReturnReportSource`, string literals) and a live **function twin**.

- The `vnd.fjs.k1_1041` route line in the **text** is :408. Its twin is :597.
- **It is exercised by no fixture.** `grep -rn "taxReturnReportSource.includes" fjs` matching
  `k1_1041`/`estateTrust` returns **nothing** — so there is not even a containment assertion here,
  and containment would not be execution anyway.
- The text is executed only through `tax-return-integration.test.js`'s `casAdd(taxReturnReportSource)`
  harness (:218 defines `casAdd`, :319 stores the program). That test seeds **only** a profile, two
  W-2s and a 1099-G (:241-283) — no K-1 of any kind. The sibling route lines :406 (`k1_1065`) and
  :407 (`k1_1120s`) are unexercised for the same reason.

### Why this is not the cheap win it looks like

Two costs found by reading the harness, both of which force other hand-typed figures to move:

1. `run.readCount` is hand-typed `13` at :339, documented at :334-338 as "`evoList` once plus
   `evoHead`/`evoRevision`/`casRead` per subject — thirteen reads over four subjects", i.e.
   `1 + 3×4`. A fifth subject makes it **16**.
2. `fjs/return/tripwire` :450 cross-checks `context.documents.estateTrustK1Forms.some(...)`, so the
   seeded profile's `declaredKinds` (:247-252) very likely has to declare the kind or the run
   refuses. Confirm before writing the fixture.

**The seam to use:** insert the K-1 leg *after* the main run's assertions but *before* the
mixed-year refusal leg at :505, which the file's own comment (:507-508) says must run last because
it "permanently adds a 2024 document to the store". An extra valid 2025 K-1 does not disturb that
refusal, which triggers on the 2024 document. Storage-valid `k1_1041` literals to clone are in
commit `04f4097` (`fjs/schedule/e`, `estateTrustDoc`, and the live definition around :1500).

Note that a proof added there is **root-level**: it moves `ℹ tests` but leaves the project-local
`grep -c '^✔ import("./fjs/'` count unchanged. That is not a vanished leaf.

## §32(i) investment income — partial, and it points at REFUSE

Recorded because TAX-27 depends on it and three sessions have now declined to determine it. This is
a *direction with its evidence*, not a finished determination.

§32(i)(2)'s disqualified income includes **net rent and royalty income**. The dialect tables state
directly that this engine does not model it: `k1_1065` :275 routes `box2NetRentalRealEstateIncome`
to "Schedule E Part I (lines 3-26) ... which this engine does not model; `rentalRealEstateAndRoyalties`
is an `fjs/return/scope` refusal", and :284 routes `box7Royalties` to "Schedule E Part I line 4".
`k1_1120s` :192/:197 say the same for its own box numbers.

So for any filer with a Part I rent or royalty item, a §32(i) component is **not computable**, and
per the requirement's own rule — under-approximating a disqualifier grants EIC to someone
ineligible — the credit must be **REFUSED**, not computed as if the component were zero.

Still to confirm before recording a determination: the remaining §32(i)(2) components (interest
including tax-exempt, dividends, capital gain net income, net passive income), and whether
Schedule E Parts II/III computing is sufficient for the passive-income component while Part IV
(REMIC) and Part V (farm rental) refuse. Verify each against the code, not against this paragraph.
