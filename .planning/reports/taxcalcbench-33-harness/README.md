# Phase 33 harness — TaxCalcBench against this engine

The scripts that produced [`../taxcalcbench-33.md`](../taxcalcbench-33.md). They are kept
because that report calls `params2024.mjs` *"the standing suspect in every number"*, and a
suspect that cannot be re-examined is not auditable.

**None of this is part of the engine.** Nothing in `fjs/` reads it, no proof covers it, it
adds no dependency, and it is `@ts-nocheck` for the same reason the root-level gate suites
are: it reads the filesystem, which needs `@types/node`. It opens the `try` that
`fjs/**.f.js` forbids, which is legal here because it is not a `.f.js`.

## Running it

The benchmark itself is **not** vendored — it is a 282 MB clone. Put it anywhere outside
the checkout:

```sh
git clone --depth 1 https://github.com/column-tax/tax-calc-bench.git /tmp/bench/tax-calc-bench
BENCH_ROOT=/tmp/bench node run.mjs
```

`FINANCE_ROOT` defaults to this repository (three directories up) and `BENCH_ROOT` to the
working directory; both are overridable. `run.mjs` writes `results.json` beside
`BENCH_ROOT` and prints the per-case table.

## The files

| file | what it is |
|---|---|
| `params2024.mjs` | The hand-transcribed **TY2024** `TaxParamSet` — 22 members overridden from Rev. Proc. 2023-34 and friends, 16 left at TY2025 with a reason each. Exports `overridden` and `leftAtTy2025` so the accounting is machine-readable. |
| `map.mjs` | The schema mapping: TaxCalcBench's `input.json` → `Form1040Inputs` + `declaredKinds`, plus the `unmappable` list that decides the *unrunnable* bucket. |
| `run.mjs` | The 51-case loop. Extracts the 20 lines TaxCalcBench's own `tax_return_evaluator.py` grades, compares, and classifies matched / refused / diverged / unrunnable. |
| `validate.mjs` | Runs every constructed document through its own dialect's `validate`, so nothing rests on a document the engine would have rejected at the door. This caught four harness bugs that looked like engine divergences. |
| `one.mjs` | One case, every line with its sources. `node one.mjs <case-name>`. |
| `schemas.mjs` | Dumps every `fjs/document/*` dialect's field names — how the mapping table in the report was built. |
