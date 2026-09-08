# Phase 34 harness — the second-implementation cross-check

The scripts that produced [`../phase-34-cross-check.md`](../phase-34-cross-check.md), plus
the one that is waiting for the owner.

**None of this is part of the engine.** Nothing in `fjs/` reads it, no proof covers it, it
adds no dependency, and every file is `@ts-nocheck` for the same reason the root-level gate
suites are: it reads the filesystem, which needs `@types/node`, and AGENTS.md forbids adding
a dependency for it. The findings that belong in the suite are proofs —
`fjs/tax/crosscheck/module.f.js` and the twelve rows Phase 34 added to `fjs/tax/table`'s
`handTranscribedRows` — and those run under `npm test` like everything else.

## Running it

```sh
FINANCE_ROOT=../../.. node sweep-p17.mjs        # 2,062 printed rows + 4 rate schedules + 20 worksheet rows
FINANCE_ROOT=../../.. node crosscheck-ty25.mjs  # the ten published tax year 2025 returns
```

Both exit non-zero on a disagreement. Both print their comparison counts first, because a
run that compared nothing also disagrees about nothing.

`FINANCE_ROOT` defaults to this repository (three directories up).

## The files

| file | what it is |
|---|---|
| `p17-tax-table.json` | Every row of the printed **2025 Tax Table** — `[atLeast, lessThan, single, marriedFilingJointly, marriedFilingSeparately, headOfHousehold]`, 2,062 rows running contiguously from `$0` to `$100,000`. Vendored, because the sweep's whole value is that this side did not come from `fjs/`. |
| `extract-p17.mjs` | Rebuilds that file from Publication 17's own text layer, so the vendored copy is auditable rather than asserted. It refuses on a gap, on a conflicting reading of the same row, or on a table that does not run `$0`-`$100,000`. |
| `p17-schedules.mjs` | The four **2025 Tax Rate Schedules** and all twenty **2025 Tax Computation Worksheet** rows, hand-typed from Publication 17 pages 123-125. |
| `sweep-p17.mjs` | The diff: every printed table cell against `lookupTaxTable`, every schedule row against the stored brackets and `cumulativeBracketTaxCents`, every worksheet row against `taxComputationWorksheet`. |
| `ty25-published.mjs` | The ten tax year 2025 federal returns TaxCalcBench publishes, reduced to the nineteen lines its own evaluator grades. Hand-typed from each case's `output.xml`. |
| `crosscheck-ty25.mjs` | The diff against those ten, and the census of every line it does **not** check with the reason. |
| `diff-return.mjs` | **The part of the phase that is waiting for the owner.** Takes a `Form1040Inputs` module and a commercial filer's Modernized e-File `Return` export, and prints the nineteen graded lines side by side. |

## Reproducing `p17-tax-table.json`

```sh
curl -o p17.pdf https://www.irs.gov/pub/irs-pdf/p17.pdf
pdftotext -layout p17.pdf p17.txt
node extract-p17.mjs p17.txt > p17-tax-table.json
```

The revision this was built from is `Publication 17 (2025)`, dated January 13 2026 on its
own cover, served with `last-modified: Wed, 21 Jan 2026 13:10:36 GMT`, 3,088,632 bytes,
sha256 `2d2381d62c7c77ed4b64b83ac23c28ed85b7c8304eb580c09bd9fd660be0840b`. `pdftotext` is
poppler's, invoked by hand at the shell and never from a script — a harness that shelled out
to a binary would be a dependency in all but name.

## Using `diff-return.mjs`, when there are documents to use it on

```sh
FINANCE_ROOT=../../.. node diff-return.mjs ./my-return.mjs ./filer-export.xml
```

`my-return.mjs` exports `inputs`, a `Form1040Inputs`. `filer-export.xml` is whatever the
free commercial filer hands back. It was smoke-tested both ways before being committed: with
a deliberately wrong `TaxAmt` it reported three disagreements and exited 1; with the right
one, zero and 0. A diff tool that has only ever been watched to agree is not known to work.
