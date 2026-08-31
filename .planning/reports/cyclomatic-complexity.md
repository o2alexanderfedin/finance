# Cyclomatic Complexity — A Baseline

**Every `.f.js` module under `fjs/`, measured 2026-08-30 at `main` = `91e65d3`.**

> There is no complexity gate in this repo and this report does not propose one.
> It records where the branching actually is, so a later "this module is getting
> hard to follow" is a comparison against a number rather than an impression.

---

## 0. Headline

| | shipped code | proof code |
|---|---|---|
| top-level definitions | 1054 | 1083 |
| mean | **3.28** | 1.98 |
| median | **1** | 1 |
| p90 | 6 | 2 |
| p99 | 41 | 26 |
| max | **87** | 110 |
| over 10 | 63 | 25 |
| over 30 | 21 | 6 |
| over 50 | 4 | 3 |

Per module, shipped code only: mean **20.98**, median **11**, max **127**
(120 modules; 61 over 10, 16 over 50).

The distribution is sharply bimodal, and that is the finding. The **median
shipped definition has a cyclomatic complexity of 1** — no branching at all,
because most module-level bindings here are constants, schemas, or a
straight-line arrow. Essentially all of the branching lives in a short tail of
form-shaped functions.

## 1. How it is measured

`cyclomatic-complexity-harness/cyclo.mjs`, run from anywhere:

```sh
node .planning/reports/cyclomatic-complexity-harness/cyclo.mjs
```

It tokenises each module with **`functionalscript/fjs/js/tokenizer`** — the
language's own tokenizer, already a dependency — and counts
`1 + if / for / while / do / case / catch / ?: / && / || / ??`, which is exactly
what ESLint's own `complexity` rule counts, so these numbers are comparable to
the recognised baseline. `?.` is a distinct token kind and is not counted,
matching ESLint.

**Tokenising rather than grepping is not fussiness here.** This codebase carries
long prose docstrings, and English prose is full of the words `if` and `for`. A
`grep -oE` over `scheduleOnePartIIExceptStudentLoanInterest`'s 777 lines reports
114 decision keywords; 50 of those are the word "for" inside comments. The
tokenizer sees a comment as one token and answers 86.

Attribution is per **top-level binding** (`const x =` / `export const x =` at
column 1), not per syntactic function. In this codebase the two nearly coincide:
a module-level binding is a usually-curried arrow, and the nested arrows inside
it are that definition's own branching, which is what a reader weighing "how
hard is this to follow" wants counted together. Anything at or after a module's
`── Tests` banner is counted as proof code and reported separately.

## 2. Where the branching is

| CC | definition |
|---|---|
| 87 | `fjs/schedule/1/module.f.js:1453` `scheduleOnePartIIExceptStudentLoanInterest` |
| 81 | `fjs/return/scope/module.f.js:846` `unmodeledKindRefusals` |
| 74 | `fjs/document/asset_register/module.f.js:392` `checkReferences` |
| 60 | `fjs/form1040/core/module.f.js:787` `form1040IncomeLines` |
| 50 | `fjs/return/profile/module.f.js:1500` `checkReferences` |
| 48 | `fjs/form8829/module.f.js:315` `form8829` |
| 46 | `fjs/document/credits/module.f.js:568` `checkReferences` |
| 45 | `fjs/form8606/module.f.js:852` `oneRecord` |
| 44 | `fjs/report/tax_return/module.f.js:371` `taxReturnReportSource` |
| 43 | `fjs/form8962/module.f.js:397` `form8962` |

Modules, shipped code only: `schedule/1` 127, `form1040/core` 126,
`schedule/e` 99, `document/asset_register` 97, `return/scope` 91.

## 3. What the number does and does not say

McCabe counts decision points; it does not care whether they are **nested** or
**flat**. Those two are not equally hard to read, and this codebase sits almost
entirely at the flat end:

- A **form function** (`form8829`, `form8962`, `scheduleC`) is a transcription
  of a printed IRS page. Its branches are the page's own printed
  "if zero or less, enter -0-" and "enter the smaller of" instructions, one per
  line, in the order the page prints them. The complexity is the form's, and
  splitting the function would put the page's line 14 in a different file from
  its line 15 — which is the thing this project's docstrings repeatedly say not
  to do, because the diff against the printed page is the review artefact.
- A **`checkReferences`** is a fail-fast validation sequence: a flat list of
  independent refusals, each naming its own offender. Its high count is a count
  of *how many distinct ways the input can be wrong*, and lowering it would mean
  checking fewer things.
- `unmodeledKindRefusals` at 81 is a refusal table — one arm per unmodeled
  return kind — for the same reason.

So the tail is not, on inspection, a backlog. What the baseline is genuinely
useful for is the second reading: if `form1040/core` moves from 126 to 180
without the 1040 gaining lines, that is a real signal, and now there is a
number to notice it against.

## 4. Reproducing

The harness prints the full distribution, both tails, and the module ranking. It
reads nothing but the source, needs no build, and adds no dependency.
