# `taxReturnReportSource`'s three Schedule K-1 route lines are never executed

Status: **OPEN.** Verified, sized, and deliberately not closed by TAX-35's routing half.
Everything below was checked by reading or running the named thing, not carried over.

## The gap

`fjs/report/tax_return/module.f.js` holds two parallel implementations of the same dispatch: the
stored program **source text** (`taxReturnReportSource`, an array of string literals) and a live
**function twin**. The text's three Schedule K-1 route lines are :406 (`vnd.fjs.k1_1065`), :407
(`vnd.fjs.k1_1120s`) and :408 (`vnd.fjs.k1_1041`).

**None of the three is exercised, and :408 carries no assertion of any kind** — not even
containment. `grep -rn "taxReturnReportSource.includes" fjs` matching `k1_1041`/`estateTrust`
returns nothing, and containment would not be execution anyway.

The text is executed only through `tax-return-integration.test.js`'s `casAdd(taxReturnReportSource)`
harness (`casAdd` at :218, the program stored at :319). That test seeds **four subjects** — a
return profile, two W-2s and a 1099-G (:241-283) — and no Schedule K-1 of any dialect. So the
three route lines are dead text in every run the suite performs.

This matters more since TAX-35's routing half than it did before it: those three collections now
feed 1040 lines 2b, 3a and 3b and Schedule D lines 5 and 12, so a divergence between the text and
the twin is a divergence in real money rather than in an unread field.

## Why the cheap version is a FAKE PASS — tested, not assumed

The obvious cheap fix is to seed a fifth subject holding a `k1_1041` document with **no money
boxes at all**: it would move no figure, so every hand-typed assertion in the harness would stay
valid.

**It proves nothing.** The reducer's fallthrough was read at `fjs/report/tax_return/module.f.js`
:409-415:

```
'        return undefined',
...
'    const collect = documentHash => doc => acc => {',
'        const routed = route(documentHash)(doc)(acc)',
'        if (routed === undefined) {',
'            return acc',
```

An unrouted document is **silently ignored** — no refusal, no error, `acc` returned unchanged.
That is correct behaviour (a stored blob of a dialect this report does not consume must not fail
the run), and it is exactly what makes the cheap leg worthless: delete line :408 from the stored
text and a zero-box K-1 changes nothing observable. The leg would be green before and after the
mutation, which is the decoration AGENTS.md's "watched to fail" rule exists to catch.

`run.readCount` does not rescue it either. It counts `evoList` once plus
`evoHead`/`evoRevision`/`casRead` per subject (hand-typed `13` at :339, documented :334-338 as
`1 + 3×4`); those dispatches happen in the document-loading loop **before** the dialect dispatch,
so a fifth subject moves it to `16` whether or not line :408 buckets the document.

## What closing it actually costs

A K-1 with a **non-zero** box is the only observable version, and it cascades. Measured against
the harness's own assertions at :365-372, a non-zero `box1InterestIncome` on a `k1_1041` moves:

| Line | Hand-typed today | Moves? |
|---|---|---|
| `1040 line 1a` | `4550500n` | no |
| `1040 line 8` | `455400n` | no |
| `1040 line 9` | `5005900n` | **yes** |
| `1040 line 15` | `3430900n` | **yes** |
| `1040 line 16 (Tax Table)` | `388100n` | **yes, non-linearly** |
| `1040 line 25a` / `25b` | `896200n` / `45400n` | no |
| `1040 line 34` | `553500n` | **yes** |

plus `run.readCount` `13` → `16` at :339 and its `1 + 3×n` note at :334-338.

Line 16 is the expensive one: it is a **tax-table band lookup**, a step function, so the new
figure has to be hand-derived from Publication 1040's own rows — never recomputed with the engine,
which is the code under test. `returnResult.line16Method` (:358) should be re-confirmed as
`'taxTable'` rather than assumed, and `lines.length` (:359, `56`) checked for movement.

## Recipe when someone does close it

- Seed the fifth subject **after** the main run's assertions and **before** the mixed-year refusal
  leg at :505, which its own comment (:507-508) says must run last because it permanently adds a
  2024 document to the store. A valid 2025 K-1 does not disturb a refusal that triggers on the
  2024 document.
- Use a `k1_1041` carrying `box1InterestIncome` and **nothing else**. Interest reaches 1040 line
  2b unconditionally, so no declared kind is needed. Deliberately avoid box 6 (trips
  `estateAndTrustIncome`, `fjs/return/tripwire` :450-451) and boxes 3/4a (trip
  `capitalGainsOrLosses`, the entry TAX-35 added) — either would turn the leg into a refusal
  instead of a computed return.
- Storage-valid `k1_1041` literals to clone: `fjs/schedule/e`'s `estateTrustDoc`, or
  `fjs/return/tripwire`'s `estateTrustK1NoBusinessIncome`.
- **Watch it fail**: delete the `vnd.fjs.k1_1041` line from `taxReturnReportSource` and confirm
  the new leg reddens on line 9 rather than on `readCount`. If it reddens only on `readCount`, the
  fixture's box is not being read and the leg is the fake pass above.
- Lines :406 and :407 need the same treatment with a `k1_1065` box 5 and a `k1_1120s` box 4; the
  same cascade applies to each, so a single leg carrying all three at once is cheaper than three
  legs and loses only the ability to say WHICH route line broke.

## The general shape, which is the part worth keeping

**A second implementation held as data is only as good as the fixtures that execute it**, and a
dispatch table whose fallthrough is "silently ignore" cannot be tested by presence — only by an
amount that moves. Every route line added to `taxReturnReportSource` inherits this, so the cost of
covering one is the cost of covering all of them, and it is paid in hand-derived tax-table
arithmetic rather than in wiring.
