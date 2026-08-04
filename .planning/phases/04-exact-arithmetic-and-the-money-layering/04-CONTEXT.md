# Phase 4: Exact Arithmetic and the Money Layering - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Tax math is exact by construction, and rounding is a property of a 1040 line rather than of a value.

In scope: an exact-arithmetic module and its proofs — integer cents, exact rationals, named rounding
modes, and the three-layer money representation. Requirements EXACT-01 … EXACT-05.

Out of scope: any tax logic (Phase 8+ owns parameters and forms), the document format that carries
these values (Phase 5), and the interpreter (Phase 3, done). This phase produces arithmetic, not
finance.
</domain>

<decisions>
## Implementation Decisions

### It is written here, staged for upstreaming — not blocked on an fjs release

AGENTS.md says a missing **generic** capability is a reason to release a new fjs version, never a
reason to write app-specific glue. Exact decimal arithmetic *is* generic. But AGENTS.md line 18 gives
the resolution directly: *"If FunctionalScript is missing something generic (a reusable helper, not
app-specific logic), add it into this repo as a separate file/directory, so it can be moved into
FunctionalScript later."* `todo/plan.md` Week 1 step 6 says the same.

So: a self-contained `fjs/`-shaped module here, written to be lifted upstream unchanged. Do **not**
block this phase on cutting an fjs release — that inverts the staging rule and stalls Week 1.

### fjs genuinely has nothing usable — verified, not assumed

| module | what it actually is |
|---|---|
| `fjs/types/bigint` | 20 general bigint helpers (`sum`, `product`, `abs`, `sign`, `factorial`, …). Well stocked, but no decimal, no rational, no rounding modes. |
| `fjs/types/bigfloat` | exactly two exports, `multiply` and `decToBin` — a decimal→binary literal helper |
| `fjs/types/prime_field` | modular arithmetic for crypto |
| rational / decimal / money / fixed | **absent** |

`divUp`/`roundUp` are not a substitute. Executed against 0.41.0:
`divUp(7)(2) = 1`, `divUp(-7)(2) = 0` — not general signed division, and it does not floor on
negatives. Tax lines carry losses, so this is disqualifying rather than merely inconvenient.

### Representation: bigint minor units, rates as explicit numerator/denominator

Money is bigint **cents**. Rates and percentages are exact rationals — an explicit
numerator/denominator pair of bigints, never a decimal approximation. This is `todo/plan.md` step 6's
shape and needs nothing new from fjs.

### Rounding is a named mode, applied at a 1040 line

- **IRS half-up, away from zero.** Explicitly *not* `Math.round`, which is asymmetric across zero:
  verified `Math.round(2.5) === 3` but `Math.round(-2.5) === -2`. On a form full of losses that is a
  systematic bias, not a rounding detail.
- **`round(sum(x))`, never `sum(round(x))`.** Rounding is a property of the *line*, not of a value.
- **A money type that rounds on construction must not exist here.** If a value rounds when it is
  built, `round(sum(x)) ≠ sum(round(x))` becomes unrepresentable and the distinction above is lost.
  Success criterion 3 exists to catch exactly that.

### Floating point never touches any of it

Verified hazards, executed against this Node:

```
1.005 * 100        = 100.49999999999999
(1.005).toFixed(2) = "1.00"                 <- rounds DOWN: a silent one-cent error
0.1 + 0.2          = 0.30000000000000004
```

`toFixed` is the trap worth naming: it is the obvious way to format money, and it is wrong in the
taxpayer's disfavour without any visible failure. Criterion 2's grep for
`toFixed|parseFloat|Math.round` is what keeps it out.

### Claude's Discretion

- Module path and file layout under `fjs/`.
- Concrete type shapes for the money and rational values.
- Whether rationals are normalised eagerly or lazily.
- Names of the rounding modes, provided IRS half-up is one and is the default for 1040 lines.

</decisions>

<code_context>
## Existing Code Insights

### What exists

- `fjs/exec/module.f.js` — Phase 3's interpreter. **Not imported here**; unrelated concern.
- `fjs/server/module.f.js` — Phase 2's MCP server. Not imported here.
- Suite is green: `npm test` 18 pass / 0 fail, `npx tsc --noEmit` clean, on fjs 0.41.0.

### Reusable from fjs

`fjs/types/bigint` for the general helpers that do apply (`sum`, `product`, `abs`, `sign`), and
`fjs/asserts` for proofs. Nothing else is a fit — see the table above.

### Established patterns

- All source `.f.js` under `fjs/`, pure, ESM. Only `index.js`, `all.test.js` and the launcher are impure.
- Tests are `proof` exports discovered by root `all.test.js`.
- JSDoc typing, `@import { Name } from '...'` form. Maximally strict `tsc`; never relax a flag.
  Phase 3 hit several strict obstacles and solved them without relaxing anything — do the same.
- Never use `l` as an identifier.
- **Only `npm test` / `node --test all.test.js` run proofs.** `node --test <source-file>` is a fake
  pass; Node executes the file as a script and no leaf runs.

</code_context>

<specifics>
## Specific Ideas

**Criterion 1 requires negatives explicitly.** A proof must assert the chosen rule differs from
`Math.round` at `-2.5`. Rounding proofs that only exercise positive values would pass while the rule
is wrong for every loss on the return.

**Criterion 3 requires an exhibited counterexample** — a concrete case where
`round(sum(x)) ≠ sum(round(x))`, with only the former exposed as the line-level operation. Asserting
the property in prose is not the same as demonstrating a value where it bites.

**Criterion 4 requires all three layers on one value**: a decimal **string** in JSON at the storage
boundary (never a JSON number — it is an IEEE 754 double before any arithmetic happens), exact
rationals inside computation, decimal **strings** on the MCP wire. fjs's JSON `Primitive` has no
`bigint`, so a bigint schema cannot cross JSON-RPC — the wire form is not a stylistic choice.

**Mutation-test the rounding.** Phase 3's proofs were validated by breaking them deliberately and
confirming failures. Rounding is exactly the kind of code where a test can pass against a wrong
implementation — half-up and half-even agree on most inputs and differ only at ties.

</specifics>

<deferred>
## Deferred Ideas

- **Upstreaming the module into fjs.** Week 5, per `todo/plan.md`. Write it liftable; do not block
  this phase on the release.
- **Tax-year parameters and any 1040 line** — Phase 8 and Phase 10. This phase provides the
  arithmetic those consume.
- **The document format carrying money as strings** — Phase 5, which this phase gates.
- **A CI grep gate for `toFixed|parseFloat|Math.round`.** Criterion 2 specifies the grep as a
  verification step; promoting it to an enforced CI check is worth doing once there is tax code to
  protect, not now.

</deferred>
