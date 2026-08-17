# Schedule B's $1,500 tests cannot see Schedule K-1 interest or dividends

Status: **OPEN**, and **newly reachable as of TAX-35's routing half** — recorded in the same
branch that made it reachable rather than left for a later reader to discover.

## The gap

`fjs/schedule/b`'s lines 4 and 6 are built from 1099-INT and 1099-DIV documents only
(`module.f.js` :204-210). The two threshold tests read those lines:

```
const interestOverThreshold = line4.value > scheduleBThresholdCents
const dividendsOverThreshold = line6.value > scheduleBThresholdCents
```

and they feed `partThreeRequired` (:223-224), which is what makes the printed Part III foreign
account and foreign trust questions required.

Since TAX-35's routing half, a Schedule K-1's separately stated interest and dividends reach
**1040 lines 2b, 3a and 3b** — the partner's box 5/6a/6b/6c, the shareholder's box 4/5a/5b, the
beneficiary's box 1/2a/2b — without passing through Schedule B at all. So this state is now
reachable:

> 1040 line 2b is $4,000.00, entirely from a partner's box 5. Schedule B line 4 is $0.00,
> `interestOverThreshold` is false, and Part III is not required.

**It was unreachable before this branch**, because every one of those boxes refused at storage.
That is the whole reason this file exists: routing a box into a line moved a figure past a
threshold test that reads a *different* line.

## Why it is not fixed here

The printed Schedule B Part I is a **list of payers with amounts**, not a total — the instructions
for line 1 require naming each payer. Feeding K-1 interest into line 4 correctly therefore means
modeling the Part I listing for a new document family (which payer name, which TIN, and how a K-1
issuer is distinguished from a bank on the printed page), plus the equivalent for Part II
dividends. That is real Schedule B modeling, not a widened sum, and it is a decision about the
printed form rather than a wiring fix — so it is written here rather than guessed at in the branch
that found it.

Adding the amounts to lines 4 and 6 *without* the listing would be worse than the gap: it would
make `partThreeRequired` correct while producing a Schedule B whose Part I does not add up to its
own line 4.

## What to check when closing it

- Whether the printed Schedule B line 1 instruction treats a Schedule K-1's interest as a payer
  row at all, or expects it only in the 1040 line 2b total. Read the instruction, not this file.
- The same question for Part II and the K-1 dividend boxes.
- `partThreeRequired`'s other three inputs are profile declarations and are unaffected; only the
  two threshold terms are.
- A control is needed either way: a filer whose K-1 interest is *below* $1,500 must not acquire
  Part III.

## The neighbouring, PRE-EXISTING gap, which is not this one

A stored `vnd.fjs.1099b` on a return that does not declare `capitalGainsOrLosses` is dropped
**silently** today: `fjs/form1040/core`'s `filingScheduleD` is read off the declared kind
(12.1-CONTEXT.md Decision 1.6), and `fjs/return/tripwire` has no brokerage entry — verified by
grep, no `brokerageForms` reference exists in that module.

TAX-35 added tripwire entry 8 for the K-1 capital-gain boxes for exactly this reason, and
deliberately did **not** extend it to Forms 1099-B: that gap predates this work, is a different
document family, and folding it in would have mixed a new hole with an old one in a single commit.
The remedy string `capitalGainsOrLosses` now carries would serve it unchanged, so the entry is
cheap — it just is not TAX-35's to add.
