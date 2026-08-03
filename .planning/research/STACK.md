# Stack Research

**Domain:** MCP server over content-addressable storage executing agent-authored FunctionalScript programs to compute US personal income tax reports
**Researched:** 2026-08-03
**Confidence:** HIGH for everything verified against `node_modules/functionalscript@0.40.0` and against a live Node process on this machine; MEDIUM for external-ecosystem claims (MCP client behaviour, tax-parameter sourcing); LOW where explicitly marked.

---

## How to read this document

The single-dependency rule (`functionalscript` only) means "what's the best library for X" is almost always the wrong question. Every need below therefore carries one of six verdicts:

| Verdict | Meaning |
|---|---|
| **EXISTS** | Already in `functionalscript@0.40.0`. Verified by reading the installed package. Use it. |
| **BUILD (upstreamable)** | Not in fjs, but generic. Per AGENTS.md, write it in its own directory here so it can move upstream. |
| **BUILD (app-specific)** | Not in fjs and not generic. Lives here permanently. |
| **UPSTREAM** | Requires a change *inside* fjs (a bug fix or a signature change). Report it; do not work around it locally. |
| **CONFIG** | Solved by a runtime flag or a process-launch decision. Costs no code and no dependency. |
| **DON'T** | The thing the wider ecosystem would reach for, which this project must not adopt. |

Cost estimates are in developer-days for one experienced FunctionalScript author, and are estimates, not measurements.

**Every fjs claim below was checked by reading `node_modules/functionalscript/` at version 0.40.0.** Where the existing planning documents assert something about fjs that turned out to be wrong, that is called out explicitly under **CORRECTION**.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 26.x (CI already pins 26) | Runtime for the MCP server and the first program runner | Node 26.0.0 shipped 2026-05-05 and is the Current line, entering Active LTS in Oct 2026. It is the first line where *everything this design needs* is stable simultaneously: the Permission Model (stable since 23.5.0), ESM syntax detection for extensionless files (default since 22.7), and `node --test`. `functionalscript` declares `engines: node >=22`, so 26 is comfortably inside support. **Do not drop to 22** — see "Version Compatibility". |
| `functionalscript` | 0.40.0 (`^0.40.0`) | The entire library surface: MCP protocol, stdio transport, CAS, Evo, effects, RTTI, JSON/DJS, media types | The only dependency. Verified to contain a complete working CAS+Evo MCP server (`fjs/mcp/module.f.js`) that the finance server should be a strict superset of. |
| TypeScript | 7.0.x (`^7.0.2`, already pinned) | Type checking only (`noEmit`), driven by JSDoc | TypeScript 7.0 reached GA on 2026-07-08 — the Go-native compiler, 8–12× faster full builds. Relevant caveat below: 7.0 **tightened** JSDoc/JavaScript checking. |
| FunctionalScript (`.f.js`) | — | All source | Project constraint. Effects-as-data is what makes the "restricted runner is the sandbox" claim structurally true rather than aspirational. |
| fjs Emergent Testing | via `functionalscript/fjs/emergent_testing/all.test.js` | All tests, as `proof` exports | Already wired: root `all.test.js` is a one-line re-export. New `.f.js` files with a `proof` export are picked up with zero registration. |

### Supporting Libraries

There are none, and there will be none. The table below is what would normally be here, and what replaces it.

| What the ecosystem would use | Why it is not used here | What replaces it |
|---|---|---|
| `decimal.js` / `big.js` / `dinero.js` | Third-party dependency; also all three are more machinery than tax math needs | Integer cents as `bigint` + an exact rational type — **BUILD (upstreamable)**, ~2 dev-days (see §2) |
| `@modelcontextprotocol/sdk` | Third-party; and fjs already has the protocol state machine, stdio transport, tool registry, and RTTI→JSON-Schema conversion | `fjs/protocol/mcp` + `fjs/protocol/mcp/stdio` — **EXISTS** |
| `isolated-vm` / `vm2` / `quickjs-emscripten` | Third-party, native addons, and (for `vm2`) actively exploited | Node Permission Model flags — **CONFIG**, ~0.5 dev-days (see §3) |
| `pdf-parse` / `pdfjs-dist` | Third-party; and the project already settled on agent vision for extraction | Agent-supplied `vnd.fjs.*` JSON — already decided |
| `zod` / `ajv` | Third-party | `fjs/types/rtti` + `fjs/media/json/schema`'s `toJsonSchema` — **EXISTS** |
| A tax engine (`Tax-Calculator`, `policyengine-us`) | Python, and a dependency | Use Tax-Calculator's **CC0 public-domain parameter data** as a cross-check source, not as code — see §1 |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `tsc --noEmit` (TS 7.0) | Type checking JSDoc | `tsconfig.json` sets `"types": []` — no `@types/node`. Keep it that way; it forces Node access to stay behind fjs effects. If a root launcher ever needs `process`, that is a signal the logic belongs in a `.f.js` module instead. |
| `node --test` | Test runner | `npm test` is `tsc && node --test`. Nothing else to add. |
| `node --permission …` | Runtime sandbox for the MCP server process | The single highest-value hardening available at zero dependency cost. See §3. |
| `fjs r <module>` | Run a `.f.js` `main` directly | Already wired as `npm run fjs-start`. Keeping `fjs_run`'s entry point named `main` means every agent-authored program is also debuggable from the CLI — worth the constraint. |

### Installation

```bash
# Nothing to install. The dependency set is already final:
npm ci
```

`package.json` stays at exactly:

```json
"dependencies":    { "functionalscript": "^0.40.0" },
"devDependencies": { "typescript": "^7.0.2" }
```

Any PR that adds a line here is wrong by construction.

---

## Verified inventory: what `functionalscript@0.40.0` actually gives you

Read from the installed package, not recalled. This is the baseline every "build vs adopt" decision below is measured against.

| Need | Module | Status |
|---|---|---|
| MCP session state machine | `fjs/protocol/mcp` — `mcpStep(config)(handlers)(stateKey)` | EXISTS |
| Tool registry, typed handlers | `fjs/protocol/mcp` — `toolEntry`, `fromRegistry`, `okResult`, `errorResult` | EXISTS |
| RTTI → JSON Schema for `inputSchema` | `fjs/media/json/schema` — `toJsonSchema` (called automatically inside `fromRegistry`) | EXISTS |
| stdio read→parse→dispatch→write loop | `fjs/protocol/mcp/stdio` — `stdioTransport` | EXISTS |
| Streaming content store | `fjs/cas` — `fileCas(sha256)(home)`, `collectRead`, `toPath`, `url` | EXISTS |
| Revision DAG | `fjs/cas/evo` — `initEvo`, `evo` | EXISTS |
| A complete reference MCP server | `fjs/mcp` — `casMcpServer`, `casMcpHandlers`, `casConfig` | EXISTS |
| Effects as data + interpreters | `fjs/effects`, `fjs/effects/mock`, `fjs/effects/node`, `fjs/effects/node/virtual` | EXISTS |
| Async effect runner | `fjs/effects/module.js` — `asyncRun(map)` (note: impure `.js`, not `.f.js`) | EXISTS |
| Dynamic import as an *effect* | `fjs/effects/node` — `import_` (`['import', (path) => IoResult<Module>]`) | EXISTS |
| Magic-byte MIME detection | `fjs/media/type` — `detect`, `detectVec`, `detectStream` | EXISTS |
| Dialect-tagged JSON blob precedent | `fjs/media/revision` | EXISTS |
| `bigint` in an RTTI schema | `fjs/types/rtti` — `bigint` | EXISTS |
| Exact decimal arithmetic | — | **ABSENT** (see §2) |
| Rational arithmetic | — | **ABSENT** |
| Rounding helpers (half-up, banker's, floor-to-dollar) | — | **ABSENT** |
| A JavaScript *parser* (not just tokenizer) | `fjs/js/` contains **only** `tokenizer` | **ABSENT** |
| A FunctionalScript source validator | — | **ABSENT** (see §3, CORRECTION) |
| Financial document formats | `fjs/media/` has `json`, `html`, `revision`, `nix`, `type` only | **ABSENT** |

### Three things in fjs whose names mislead

1. **`fjs/types/bigfloat` is not a decimal arithmetic library.** It exports exactly two functions — `multiply([m,e])(mul)` and `decToBin(dec)` — plus a proof. `decToBin` converts a decimal pair `m × 10^e` into the nearest IEEE-754-representable binary pair. Its only consumers in the whole package are `fjs/djs/tokenizer` and `fjs/media/json/tokenizer`, i.e. it exists to parse number literals. There is no `add`, no `sub`, no `cmp`, no rounding mode. It is **not** usable for money.

2. **`fjs/types/prime_field` is modular arithmetic over a prime, for cryptography.** `add`/`sub`/`mul`/`div` all reduce mod `p`, and `div` goes through a modular inverse. Applying it to currency would produce arithmetically valid but financially meaningless results. Not relevant to this project at all.

3. **`fjs/effects/node`'s `sandbox` operation is not a sandbox.** Reading the Node runner (`fjs/effects/node/module.js:64`), it is `performance.now()` → `try { f() } catch` → `performance.now()`. It provides timing and error capture, nothing else. Its own doc comment says Worker-based implementations *could* enforce hard limits "in future". Do not reach for it as an isolation mechanism; it is a measurement tool.

---

## §1 — Tax parameter data

### Is there an authoritative machine-readable source?

**No.** Confidence: HIGH.

The IRS publishes annual inflation adjustments as **Revenue Procedures** — narrative legal documents in PDF and HTML, not data. For the tax years in scope:

- **TY2025** → Rev. Proc. 2024-40, **modified by Rev. Proc. 2025-32**
- **TY2026** → Rev. Proc. 2025-32 (<https://www.irs.gov/pub/irs-drop/rp-25-32.pdf>)

There is no `irs.gov/data/brackets.json`. Everything machine-readable is a third-party transcription.

### The trap that would have bitten TY2025

Rev. Proc. 2024-40 (issued late 2024) set the TY2025 standard deduction at **$15,000 / $30,000 / $22,500**. The One Big Beautiful Bill Act (P.L. 119-21, July 2025) raised it retroactively for TY2025 to **$15,750 / $31,500 / $23,625**, and Rev. Proc. 2025-32 modified the earlier procedure to match.

Any parameter set transcribed from the "official 2025 IRS inflation adjustments" release is **wrong for the tax year the project is actually targeting**. Verified against Tax-Calculator's current `policy_current_law.json`, which carries `STD` for 2025 as `15750 / 31500 / 23625`.

The same act added four new below-the-line deductions (tips, overtime, car-loan interest, enhanced senior deduction) on a brand-new **Schedule 1-A**, carrying to Form 1040 **line 13b**, for tax years 2025–2028. A TY2025 1040 that does not model line 13b is structurally incomplete, not merely incomplete in edge cases.

### Recommended sourcing strategy

**Two-source rule: transcribe from the Revenue Procedure, verify against a public-domain dataset, store the citation.**

| Source | License | Role |
|---|---|---|
| IRS Revenue Procedures (`irs.gov/pub/irs-drop/rp-*.pdf`) | US Government work, public domain | **Authoritative.** Every parameter value cites the Rev. Proc. and section it came from. |
| IRS Form 1040 instructions + Pub. 1040 (Tax Table) | Public domain | Authoritative for line-level rules and the Tax Table |
| PSL `Tax-Calculator` `taxcalc/policy_current_law.json` | **CC0 1.0** (verified: repository `LICENSE` reads "public domain within the United States … we waive copyright … through the CC0 1.0 Universal public domain dedication") | **Cross-check.** 253 parameters, keyed `{year, MARS, value}`, currently correct through TY2026 including the OBBBA revisions. Copy freely. |
| PolicyEngine `policyengine-us` | **AGPL-3.0** (verified via GitHub license API) | **Reference only — do not copy.** AGPL is incompatible with this project's licensing posture; the parameter YAML is part of an AGPL work. |

Verdict: **BUILD (app-specific)** — a per-year parameter blob per tax year. ~1 dev-day per year for the core rate/deduction/threshold set, plus real time reading the Rev. Proc.

### Representation

Follow the `vnd.fjs.revision` precedent exactly, as the project constraints already require:

- Dialect `vnd.fjs.tax-params` → media type `application/vnd.fjs.tax-params+json`
- One blob per `(jurisdiction, year)`; store it in CAS and make it an Evo subject so a mid-year statutory change (exactly what OBBBA was) is a **new revision with the old as parent** — the same mechanism as an amended 1099. This is not a hypothetical: TY2025 already needs it.
- Every parameter carries a `source` string (Rev. Proc. number + section). This makes Success Criterion 3 ("every number traces to a source") extend past documents to the *law*, which is where an auditor will actually push back.
- Money values as **integer cents** (see §2), not decimal strings and not floats.

Validation via `fjs/types/rtti` gives you the schema, the `Ts<>` type, and — through `toJsonSchema` — the MCP `inputSchema` for free, from one declaration.

### The Tax Table is a function, not a table

Form 1040 line 16 does **not** come from the rate schedule when taxable income is under $100,000 — it comes from the Tax Table in Pub. 1040, which quantises income into $50 bands and reports the tax on the band's **midpoint, rounded to the nearest dollar**. Rate-schedule arithmetic and the Tax Table therefore disagree by up to roughly half a band × top marginal rate, and a return computed from brackets alone will **fail the "matches a real filed return" acceptance test** for most personal filers.

The good news: the table is derivable, so it does not need transcribing.

```
taxTableTax(rate schedule, filing status, taxableIncome):
    band      = the $50 band containing taxableIncome
    midpoint  = (band.lower + band.upper) / 2
    return roundHalfUp(rateScheduleTax(midpoint))
```

Verdict: **BUILD (app-specific)**, ~0.5 dev-days for the generator, plus verification against the published table.

⚠️ **Verify the band width at the low end before trusting this.** The published Tax Table uses narrower steps below roughly $3,000 (and single-dollar-ish steps in the first few rows) rather than a uniform $50. Confidence on the $50-midpoint rule itself: MEDIUM (multiple secondary sources including IRS SOI publications agree; not read out of a current-year Pub. 1040 during this research). Confidence on "the table and the rate schedule disagree": HIGH. **Action: before Week 2, diff the generated table against the TY2025 Pub. 1040 across the full income range as a `proof`.** That single test is worth more than any amount of further reading.

Also note two other line-16 paths that are *not* the rate schedule: the **Qualified Dividends and Capital Gain Tax Worksheet** (whenever there are qualified dividends or net long-term gains, which for a 1099-DIV/1099-B holder is nearly always) and the **Schedule D Tax Worksheet**. Scoping line 16 as "apply brackets" will not survive contact with a real return.

---

## §2 — Exact decimal arithmetic for currency

### What tax math actually requires

Three distinct numeric kinds, and conflating them is where precision bugs come from:

1. **Money.** Always a whole number of cents at rest, always a whole number of dollars on a filed line. Never fractional.
2. **Statutory rates.** `10%`, `12%`, `22%`, `7.5%` (medical floor), `0.9%` (Additional Medicare), `3.8%` (NIIT), `85%` (Social Security inclusion), `0.2106` (EITC phase-out). **Every one is exactly rational.** None require irrational or arbitrary-precision decimal arithmetic.
3. **Derived ratios.** Phase-out fractions (`excess / range`), the foreign-tax-credit limitation ratio, allocation ratios. These are *not* terminating decimals in general — `1/3` appears — so they must stay exact through intermediate steps and be rounded exactly once, at the line.

### What fjs offers: essentially nothing

| Module | Reality | Verdict |
|---|---|---|
| `fjs/types/bigint` | `sum`, `product`, `abs`, `sign`, `log2`, `bitLength`, `mask`, `factorial`, `combination`, `xor`, `divUp`, `roundUp`, `divUp8`, `roundUp8` | Useful *substrate*. `divUp`/`roundUp` are the only rounding present, they round **up** only, and their own doc comments warn they truncate rather than floor on negatives — which matters, because tax lines carry losses. |
| `fjs/types/bigfloat` | `multiply`, `decToBin`. A decimal→binary conversion helper for number-literal tokenizing. | Not arithmetic. Its **type** `BigFloat = readonly [bigint, number]`, read as `m × 10^e`, is the right carrier shape — the operations on it simply don't exist. |
| `fjs/types/prime_field` | Modular arithmetic mod `p` for crypto | Wrong domain entirely |
| `fjs/types/number` | `sum`/`min`/`max`/`cmp` over IEEE doubles | Must never touch money |

### Recommendation

**Money is `bigint` cents. Rates are exact rationals. Rounding is always explicit and always named.**

Create one new upstreamable directory, e.g. `fjs/exact/`:

```
fjs/exact/rational/module.f.js   — Rational = readonly [bigint, bigint]  (num, den)
                                   add, sub, mul, div, cmp, neg, abs,
                                   fromInt, fromScaled(value, scale), normalize
fjs/exact/round/module.f.js      — roundHalfUp, roundHalfEven, roundDown, roundUp,
                                   applied to a Rational, yielding a bigint
                                   (each correct for negative values — assert it)
fjs/exact/money/module.f.js      — Money as a nominal bigint of cents
                                   (fjs/types/nominal already exists for the branding)
                                   toDollarsHalfUp, fromCents, sumMoney, applyRate
```

Verdict: **BUILD (upstreamable)**, ~2 dev-days including proofs. It is unambiguously generic, so per AGENTS.md it goes in its own directory and can be offered upstream once stable. It is a strong upstream candidate precisely because it *complements* `bigfloat` rather than duplicating it.

**Why rational rather than a general decimal type.** A `Decimal` with arbitrary scale forces a rounding decision at every division, which is exactly the thing IRS instructions want deferred. A rational defers it structurally: you carry `[num, den]` through the whole worksheet and round once, at the line, with a named function that matches what the instruction text says. Fewer decisions, and each surviving decision is visible in the source.

**Why not "just use `number` for cents".** JSON numbers are IEEE doubles and integer cents *are* exact up to 2^53 (≈ $90 trillion), so it is tempting. Do not do it. It only holds while every intermediate is an integer, and the first `× 0.075` breaks it silently. Use `number` at the **storage boundary only**, convert to `bigint` on decode.

### IRS rounding rules — the actual text

- **Rounding to whole dollars is optional, but all-or-nothing.** If you round one line you must round every line on the return and all schedules.
- **The rule is half-up on the absolute value**: drop amounts under 50¢, round 50–99¢ up. `$1.39 → $1`, `$2.50 → $3`.
- **The one that catches implementations:** *"If you have to add two or more amounts to figure the amount to enter on a line, include cents when adding and round off only the total."*

That last rule is a hard architectural constraint, not a detail. It means **aggregation must happen in cents (or exact rationals) and rounding must be a property of a 1040 *line*, not of a value.** A `Money` type that rounds on construction is wrong. Model it as: values flow exactly, and a line is `roundHalfUp(exactValue)`.

Confidence: HIGH (Form 1040/1040-NR instructions, "Rounding Off to Whole Dollars").

### Serialization

| Context | Encoding | Rationale |
|---|---|---|
| `vnd.fjs.*` document/parameter blobs (JSON) | Integer **cents** in a JSON `number` field | Exact for any realistic personal return. Validate with `Number.isSafeInteger` — the precedent already exists: `fjs/media/revision` applies exactly this check to `generation`, and its doc comment explains why `isInteger` is insufficient. Decode straight to `bigint`. |
| DJS-encoded blobs, if used | Native `bigint` | Verified: `fjs/djs` `Primitive = JsonPrimitive \| bigint \| undefined`, and the tokenizer emits a `bigint` token kind for the `n` suffix. |
| MCP tool arguments and results | Decimal **string** | JSON-RPC payloads go through `fjs/media/json`, whose `Primitive` is `null \| boolean \| number \| string` — no `bigint`. RTTI has a `bigint` schema, but it cannot survive the JSON wire. Strings also read better to the agent and to a human reviewing a report. |

---

## §3 — Executing untrusted / generated JavaScript

### The 2026 landscape, and what survives the dependency rule

| Approach | 2026 status | Verdict here |
|---|---|---|
| **Node Permission Model** (`--permission`) | **Stable** (Stability: 2) since v23.5.0 / v22.13.0. Flags: `--allow-fs-read`, `--allow-fs-write`, `--allow-net`, `--allow-child-process`, `--allow-worker`, `--allow-addons`, `--allow-wasi`, `--allow-ffi`. All resources denied by default under `--permission`. | ✅ **CONFIG — adopt now.** Zero dependencies, one launcher flag. |
| `node:worker_threads` | Real thread isolation, but the Node docs state the Permission Model **does not inherit to worker threads**, and a worker still reaches native addons and shared memory | ⚠️ Weaker than a child process here. Not the right vehicle. |
| Child `node --permission …` process | Full permission model, hard kill available, clean JSON-over-stdout boundary. fjs already has an `exec` effect. | ✅ **The Week 5 answer.** |
| `node:vm` | Node docs, unchanged: *"The vm module is not a security mechanism. Do not use it to run untrusted code."* | ❌ **DON'T** |
| `vm2` | **CVE-2026-22709** (published 2026-01-26): Promise-callback sanitization gap in 3.10.0 allows sandbox escape → RCE. Also a dependency. | ❌ **DON'T** — and this is the fourth or fifth escape in this library's history |
| `isolated-vm` | Technically the strongest in-process option (real V8 Isolates), but a native addon, a dependency, and its own maintainers recommend Docker on top | ❌ **DON'T** (dependency rule) |
| `quickjs-emscripten` / QuickJS-NG | Genuine isolation via a separate engine, but a large dependency and it cannot run fjs modules | ❌ **DON'T** (dependency rule) |
| **ShadowRealm** | **Stage 2.7** as of May 2026 — not Stage 3, not shipping in any engine. Blocked on enumerating which web APIs are exposed. | ❌ **DON'T** — and note that even shipped, ShadowRealm is a *global-scope* boundary, not a security boundary: same heap, no resource limits, no capability control |

Sources: `nodejs.org/api/permissions.html`; `tc39/proposal-shadowrealm`; CVE-2026-22709.

### Empirically verified on this machine

Run against a module at a CAS-shaped path outside the project tree, on Node v23.11 (Permission Model stable since 23.5, so Node 26 is equal or stricter):

```
# Import-time fs access, no flags
$ node -e "import('/tmp/.../ab/cd/evil')…"
node:fs reachable, entries: 21

# Same module, permission model on
$ node --permission --allow-fs-read=/tmp/.../fakecas -e "import('…/evil')…"
blocked: ERR_ACCESS_DENIED

# Network, permission model on
$ node --permission … -e "fetch('https://example.com')…"
fetch blocked: fetch failed

# stdio still works under --permission (the MCP transport is unaffected)
$ printf 'hello\n' | node --permission -e "…echo…"
echo:hello
```

The blocked case throws a **catchable** `ERR_ACCESS_DENIED`, so it can be surfaced through `errorResult` rather than crashing the transport.

### Recommendation

**Week 1 (replaces "accept the `import()` hole and do nothing about it"):** launch the MCP server itself under the Permission Model.

```bash
node --permission \
     --allow-fs-read=$HOME/.cas --allow-fs-write=$HOME/.cas \
     ./mcp.js
```

Cost: **~0.5 dev-days** — a launcher flag plus a proof that a program reaching for `node:fs`/`fetch` produces a clean `errorResult`.

This does not change the plan's settled position; it makes the accepted risk **far smaller for free**. The stated Week 1 limitation — "a blob that runs `fs.rmSync` at module scope is not stopped by an empty operation map" — becomes false under this flag. `--allow-fs-write` scoped to `~/.cas` also means the worst case degrades from "wipes the home directory" to "corrupts the content store", which is recoverable and, being content-addressed, detectable.

**Read the caveats honestly and write them down.** Node's own docs call this a "seat belt": *"It does not provide security guarantees in the presence of malicious code."* Specifically: symlinks are followed, existing file descriptors bypass it, `--env-file`/`--openssl-config` are evaluated before initialization, and `process.debugProcess(pid)` can force another Node process to open its V8 inspector with no grants at all. Against the actual threat model — a competent LLM writing plausible-but-wrong code, plus a possibly-adversarial *input document* — a seat belt is the right shape of protection. Against a determined attacker it is not a boundary. That distinction belongs in the spec, so it does not silently become "we sandboxed it."

**Week 5 (hardening):** move execution to a child `node --permission --allow-fs-read=$HOME/.cas` process that reads a hash on argv, writes JSON to stdout, and is killable on a timeout. This buys a hard resource boundary and crash isolation. Cost ~3 dev-days. The server then needs `--allow-child-process`, which is a real (and acceptable) widening of the server's own grants — the point is that the *program* runs with strictly less.

### CORRECTION: `djs/parser` cannot validate agent-authored programs

Both `todo/plan.md` (Week 5) and `fjs/todo/implement-mcp-server.md` ("Known limitation") propose closing the `import()` hole "most plausibly by parsing the source with FunctionalScript's own `djs/parser` before importing, which would enforce the language subset rather than assume it."

**This does not work.** Verified by reading `fjs/djs/ast/module.f.d.ts`:

```ts
export type AstConst = Primitive | AstModuleRef | AstArray | AstObject
```

The DJS AST has exactly four node kinds — primitive, module reference, array, object. **There is no function node.** DJS is a *data* serialization language (its doc describes a module body as `(...args) => { const c0 = …; return <last> }`, where every `c` is a constant). An agent-authored tax program is arrow functions and calls. `djs/parser` will reject every one of them.

What would actually be needed is a **FunctionalScript parser**, which does not exist in 0.40.0: `fjs/js/` contains a `tokenizer` and nothing else. The raw material is there — `fjs/js/tokenizer` plus the `fjs/bnf` machinery (`ll1`, `descent`, grammar rules over packed terminal ranges) — but assembling a FunctionalScript grammar and a validating parser is **weeks, not days**, and it is squarely an **UPSTREAM** contribution to fjs rather than app work.

Consequence for the roadmap: **fix the Week 5 wording in both documents now**, and treat "validate source before import" as an fjs-scale project, not a cleanup task. The Permission Model is what makes deferring it acceptable.

### Two `fjs_run` design constraints discovered by testing, in neither planning document

**(a) Bare specifiers do not resolve from `~/.cas/`.** `fileCas.url(hash)` returns an absolute path under the CAS root (`toPath` shards the cBase32 hash into `prefix/aa/bb/rest`). Node resolves bare specifiers by walking `node_modules` **upward from the importing file**, so a program stored in CAS cannot `import 'functionalscript/…'`:

```
$ node -e "import('/tmp/fakecas/ab/cd/blobhash')…"   # blob imports functionalscript/…
FAIL: ERR_MODULE_NOT_FOUND
```

Three ways out, in preference order:

1. **Pass capabilities as arguments.** `main(ctx)` where the server hands the program the CAS/Evo effect constructors and the numeric helpers it is allowed to use. A program that never imports is easier to reason about, and this makes the capability set explicit and enumerable rather than implicit in whatever the module could resolve. **Recommended.**
2. **`node_modules` symlink at the CAS root.** Verified to work (`OK with node_modules symlink at cas root: 6n`), five minutes of work, but it puts a mutable non-content-addressed path inside the content store. Acceptable as a stopgap; ugly as a design.
3. **A module customization hook** (`module.register()`) resolving `functionalscript/*` for CAS-loaded modules. Correct, and real work.

**(b) `data:` URLs are not a shortcut.** Importing agent source as a `data:text/javascript,…` URL avoids touching the filesystem and works for self-contained modules (verified: `OK data-url 42`), but bare specifiers fail hard (`ERR_UNSUPPORTED_RESOLVE_REQUEST`) because a data URL has no base to resolve from. It is only viable in combination with option (a), where it is genuinely attractive: no path, no extension question, nothing on disk.

**(c) Extensionless import works — but by syntax detection.** CAS blobs have no file extension. `import()` on such a file succeeds (verified: `OK extensionless 42`) because Node's ESM syntax detection has been on by default since 22.7. Fine on Node ≥22.7, and fine on the pinned Node 26. Worth an explicit test rather than an assumption, since it depends on a defaulted heuristic rather than a guarantee.

### CONFIRMED: the `match` gap is real

`fjs/effects/module.f.js:282` reads exactly as the spec claims:

```js
export const match = (map) => (e) => {
    if (typeof e === 'function') { return ['done', e()] }
    const { command, payload, continuation } = e
    return ['cont', map[command](...payload), continuation]
}
```

`map[command]` is `undefined` for an absent operation, so a program requesting `fetch` gets `TypeError: map[command] is not a function` — no command name, no indication it was a refusal. `asyncRun` (`fjs/effects/module.js`) is a thin loop over `match` and adds no handling.

Verdict: **UPSTREAM.** Per AGENTS.md this is reported, not worked around. The natural shape is for `match` to return a third `MatchResult` variant — `['refused', command]` — so refusal is a value the runner can turn into `errorResult('operation not permitted: fetch')` rather than an exception it has to classify. Cost upstream: ~0.5 dev-days plus fjs's own release cycle. Cost of *not* fixing it: the single most likely agent failure mode is undiagnosable.

Interim, without forking: wrap the operation map in a `Proxy`-free lookup by pre-populating every known-but-refused command with a function that throws a typed refusal error, and catch that around `asyncRun`. Explicitly a stopgap — write it as such, in its own file, so it deletes cleanly when the upstream fix lands.

---

## §4 — MCP server implementation

### Protocol versions, as of 2026-08-03

| Version | Status | Notes |
|---|---|---|
| `2026-07-28` | **Current** | Major architectural break: **stateless**. No `initialize`/`initialized` handshake, no session IDs. Version and capabilities travel in per-request `_meta` under `io.modelcontextprotocol/protocolVersion`. Adds mandatory `server/discover`. Deprecates Roots, Sampling, Logging. |
| `2025-11-25` | Final (legacy) | Last handshake-based revision. **This is what Claude Desktop negotiates.** |
| `2025-06-18` | Final (legacy) | Structured tool output (`structuredContent`), elicitation, JSON-RPC batching removed |
| `2025-03-26` | Final (legacy) | Streamable HTTP, batching (later removed) |
| `2024-11-05` | Final (legacy) | Original. **What `fjs`'s `casConfig` pins.** |

The spec calls `2026-07-28`+ **"modern"** and `2025-11-25` and earlier **"legacy"**, and its compatibility matrix is blunt: *Modern client + Legacy server = **Fails***. A legacy server survives only against a **dual-era** or legacy client.

### The concrete risk

Verified by reading `node_modules/functionalscript/fjs/mcp/module.f.js:50-55`:

```js
export const casConfig = {
    serverInfo: { name: 'functionalscript-cas', version: '0.30.0' },
    capabilities: { tools: {} },
    protocolVersion: '2024-11-05',
}
```

And `mcpStep` (`fjs/protocol/mcp/module.f.js:228-245`) **validates but ignores** the client's requested `protocolVersion`, always answering with the server's pinned string. There is no negotiation — only a pin.

- **Claude Code / `claude mcp add` over stdio:** works with `2024-11-05` today. Confidence MEDIUM (secondary sources; and the `fjs mcp` server presumably works for its author, which is decent circumstantial evidence).
- **Claude Desktop:** a public report (thingsboard-mcp issue #35, April 2026) describes Claude Desktop negotiating `2025-11-25`, receiving `2024-11-05`, listing tools successfully, and then **never issuing a single `tools/call`** — a silent, extremely confusing failure. Confidence MEDIUM (one detailed report; not reproduced here).

### Recommendations

1. **Declare your own config; pin `2025-11-25`, not `2024-11-05`.** `mcpStep` takes `McpConfig` as a parameter, so this needs no fork and no fjs release — just don't reuse `casConfig`. This also resolves the open question in `fjs/todo/implement-mcp-server.md` ("Reuse `casConfig`, or declare our own server identity?"): **declare your own**, and the protocol version is the reason, not just branding. Cost: ~0.1 dev-days. Confidence in the *need*: MEDIUM. Confidence that it is nearly free: HIGH.

2. **Verify empirically in Week 1, before building anything on top.** Pipe a hand-written `initialize` at `2025-11-25` and at `2024-11-05` into the server and diff. Then connect the real client and confirm a `tools/call` actually arrives. Ten minutes; removes a whole class of "why won't it call my tool" debugging.

3. **Real negotiation is UPSTREAM.** Answering with the client's version when it is in a supported set requires `McpConfig` to carry a *set* and `mcpStep` to select. Worth proposing (~1 dev-day upstream), but pinning covers a single-client stdio deployment.

4. **Do not chase `2026-07-28` in v1.** It is a week old, it deletes the handshake `mcpStep` implements, and no shipping client requires it yet. Track it; do not build for it. When fjs does adopt it, that is an fjs change, not a finance change — which is the payoff for having built on `fjs/protocol/mcp` rather than a hand-rolled server.

### stdio transport constraints (verified by reading `fjs/protocol/mcp/stdio/module.f.js`)

**The 128 KiB line limit is the design constraint that matters.** `writeResponse` calls `tryUtf8(stringifyJson(resp) + '\n')`, which returns `null` past `maxLength`. Tracing it: `text/module.f.js` → `bit_vec` `tryU8ListToVec` → `bigint.maxLength = 0x100000n` bits = 1,048,576 bits = **131,072 bytes = 128 KiB**. This is not arbitrary — the same bound appears on `readFile`, `readBytes`, `writeBytes`, CAS chunking, and `cas_add` inline content, and fjs documents it as the minimum across Node/Bun/Deno `bigint` limits.

Overflow does not crash: `writeResponse` degrades to a `-32603` internal error carrying the original `id`, and if even that overflows (a pathological client-controlled `id`), to `id: null`. So an oversized `fjs_run` result surfaces as a bare internal error with **no indication that size was the problem**.

Design consequences, in order of importance:

- **This settles plan open question 5 (`fjs_run` result disposition).** Write the result **back to CAS and return its hash.** The plan frames this as "permanent audit trail vs. simpler", but the transport adds a third argument that is not a preference: a full 1040 with per-line provenance (every line carrying source CAS hashes) will approach or exceed 128 KiB, and the inline path fails *opaquely* when it does. Returning a hash is O(1) in response size, is what makes Success Criterion 3 structural, and matches the plan's own "programHash + input hashes, exactly reproducible" framing. It does mean the whitelist includes CAS **writes** — which is the question the answer was blocking. This is the most-referenced open question in the corpus and the transport answers it. Confidence: HIGH.
- **Return a short summary plus the hash**, not the whole report, so the agent gets something useful without a second round trip.
- **Add an explicit size check before `writeResponse`** and emit a real error ("result too large; stored at `<hash>`") rather than inheriting the silent `-32603`.
- Programs are `cas_add`-ed, so **agent-authored source is also capped at 128 KiB**. Ample for a tax program; worth stating in the spec so nobody discovers it via an opaque failure.

**Other stdio properties**, all verified:

- Newline-delimited JSON. `readLine('stdin')` accumulates **one byte per effect step** into a cons-list, reversing and UTF-8-decoding once at the terminator — O(n), no leftover-byte buffer between calls. Fine at this scale; not a throughput design.
- Malformed input line → `-32700` parse error with `id: null`, loop continues.
- Handler returning `null` (a notification) → nothing written, loop continues.
- EOF → clean return. No signal handling, no shutdown hook.
- The loop consumes only `Read` and emits only `Write`, so it is fully testable against `fjs/effects/node/virtual` with no real process — as `fjs/protocol/mcp/proof.f.js` already demonstrates.

### ⚠️ ChatGPT cannot connect to this server at all

**ChatGPT does not support local stdio MCP servers — only remote HTTPS endpoints with OAuth.** Developer Mode connectors require a public URL; a local `node …` server has to be bridged (e.g. `mcp-remote`) before ChatGPT can reach it. Confidence: MEDIUM-HIGH (consistent across multiple 2026 sources including OpenAI's help centre coverage of Developer Mode).

This directly contradicts `.planning/PROJECT.md`'s framing — *"uses ChatGPT (or any other MCP client) to compute tax and other financial reports"*, quoted from the authoritative README `## Goal` — and Success Criterion 2 ("point an agent at the MCP server … ask 'what do I owe for 2025?'").

The settled decision "stdio only, single local user" is still the right call: it is what makes the `import()` limitation tolerable, and HTTP + OAuth + tenancy is a milestone of its own. But **the goal statement should say Claude Code / Claude Desktop, not ChatGPT**, or Success Criterion 2 should name the client it will actually be demonstrated against. Left unstated, this surfaces in Week 4 as "the acceptance demo is impossible with the client the README promises." Not a technical blocker — a scoping correction that costs nothing now and is expensive to discover late.

---

## Consolidated build ledger

| Need | Verdict | Cost | Notes |
|---|---|---|---|
| MCP protocol, stdio, tool registry, JSON Schema | **EXISTS** | 0 | `fjs/protocol/mcp`, `fjs/protocol/mcp/stdio`, `fjs/media/json/schema` |
| CAS, Evo, streaming hash store | **EXISTS** | 0 | `fjs/cas`, `fjs/cas/evo` |
| Effects, runners, mock interpreters | **EXISTS** | 0 | `fjs/effects` + `mock` + `node/virtual` |
| Dynamic import as an effect | **EXISTS** | 0 | `fjs/effects/node` `import_` — already an operation, so it is already whitelistable |
| MIME sniffing for ingested bytes | **EXISTS** | 0 | `fjs/media/type` — pure table lookup, costs nothing to adopt |
| Own `McpConfig` with `protocolVersion: '2025-11-25'` | **BUILD (app-specific)** | 0.1 d | Highest value-per-minute item in this document |
| Server launcher under `--permission` | **CONFIG** | 0.5 d | Closes most of the accepted Week 1 `import()` risk for free |
| Restricted `OperationMap` + refusal path | **BUILD (app-specific)** + **UPSTREAM** | 1 d + upstream | Local stopgap for clean refusals; `match` fix goes upstream |
| `fjs_run` (hash → import → run → CAS-write result → return hash) | **BUILD (app-specific)** | 2 d | Pass capabilities as arguments; do not rely on bare-specifier resolution |
| Exact rational + rounding + money | **BUILD (upstreamable)** | 2 d | `fjs/exact/` — genuinely generic, strong upstream candidate |
| Tax Table generator from the rate schedule | **BUILD (app-specific)** | 0.5 d | Plus a full-range `proof` against the published Pub. 1040 table |
| `vnd.fjs.tax-params` dialect + TY2025 data | **BUILD (app-specific)** | 1–2 d | Rev. Proc. 2024-40 **as modified by 2025-32**; cross-check against CC0 Tax-Calculator |
| `vnd.fjs.1099` (and later W-2, 1099-DIV, …) | **BUILD (app-specific)** | 1 d each | Follow the `vnd.fjs.revision` pattern exactly |
| 1040 line-by-line computation programs | **BUILD (app-specific)** | the actual project | Includes Schedule 1-A for TY2025 |
| Child-process execution with hard limits | **BUILD (app-specific)** | 3 d | Week 5 |
| FunctionalScript source parser/validator | **UPSTREAM** | weeks | Not v1. `djs/parser` cannot do this — see §3 CORRECTION |
| PDF text extraction | **DON'T** | — | Already correctly out of scope; agent vision supersedes it |
| Any npm package | **DON'T** | — | — |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `fjs/types/bigfloat` for money | It is a decimal→binary *literal conversion* helper with two exports and no arithmetic. `decToBin` **loses precision by design** — that is its job. | `bigint` cents + a new exact rational module |
| `fjs/types/prime_field` for money | Modular arithmetic mod a prime, for cryptography. Every operation wraps. | Same |
| `fjs/types/number` (`sum`, `min`, `max`) on currency | IEEE doubles | Same |
| `fjs/effects/node`'s `sandbox` op as isolation | It is `try/catch` + `performance.now()`. Nothing is isolated. | `node --permission`, then a child process |
| `djs/parser` to validate agent programs | The DJS AST has no function node — it is a data language | Permission Model now; a real FS parser upstream, later |
| `casConfig` verbatim | Pins `protocolVersion: '2024-11-05'` and identifies your server as `functionalscript-cas` | Your own `McpConfig` at `2025-11-25` |
| Returning a full 1040 inline from `fjs_run` | 128 KiB stdio line cap; overflow degrades to an opaque `-32603` | Write to CAS, return the hash + a short summary |
| `vm2` | CVE-2026-22709 (Jan 2026), sandbox escape → RCE; plus it is a dependency | Permission Model |
| `node:vm` | Node's own docs: *"not a security mechanism"* | Permission Model |
| `isolated-vm`, `quickjs-emscripten`, `@modelcontextprotocol/sdk`, `decimal.js`, any npm package | Dependency rule | Build it, or upstream it into fjs |
| ShadowRealm | Stage 2.7 as of May 2026, unshipped; and not a security boundary even when shipped | Permission Model |
| PolicyEngine-US parameter YAML | **AGPL-3.0** | Tax-Calculator's `policy_current_law.json` — **CC0 1.0**, public domain |
| TY2025 parameters from Rev. Proc. 2024-40 alone | Superseded by Rev. Proc. 2025-32 after OBBBA — standard deduction was $15,000/$30,000, is now $15,750/$31,500 | Rev. Proc. 2024-40 **as modified by** 2025-32 |
| Rate-schedule arithmetic for Form 1040 line 16 | Under $100,000 the Tax Table governs, and it disagrees with the rate schedule | Generate the Tax Table; and handle the Qualified Dividends / Schedule D worksheets |
| Rounding money at construction | Violates *"include cents when adding … round off only the total"* | Round at the 1040 **line**, once |

---

## Stack Patterns by Variant

**If `fjs_run` returns results inline (rejecting the §4 recommendation):**
- You must cap and truncate results explicitly before `writeResponse`, and say so in the tool description
- Because otherwise a full 1040 hits the 128 KiB line cap and fails as an unexplained `-32603`

**If agent programs are allowed to `import` at all:**
- Either symlink `node_modules` into the CAS root or register a module customization hook
- Because bare-specifier resolution walks up from `~/.cas/`, not from the server's cwd (verified: `ERR_MODULE_NOT_FOUND`)
- Preferred instead: hand capabilities to `main(ctx)` and let programs import nothing

**If the audience ever widens beyond one trusted local user:**
- Everything in §3 becomes a blocker, exactly as `.planning/PROJECT.md` already states
- Add, in order: child-process execution with hard limits → source validation → HTTP + auth
- And note the chain is *untrusted document → LLM → generated program → execution*, so the document itself is an injection vector before any of this

**If ChatGPT support is genuinely required:**
- stdio is disqualified; ChatGPT needs a public HTTPS endpoint with OAuth
- That is a separate milestone (`fjs/effects/node` does have `createServer`/`listen`, so the effect vocabulary exists), and it invalidates "the `import()` hole is tolerable"
- Recommended: amend the goal statement to name Claude instead

---

## Version Compatibility

| Package | Compatible with | Notes |
|---------|-----------------|-------|
| `functionalscript@0.40.0` | `node >= 22` (declared), `typescript = 7.0.2`, `@types/node = 26.0.0` (its own devDeps) | fjs pins TS exactly at 7.0.2; the project's `^7.0.2` will float ahead of it. Watch for drift once TS 7.1 lands. |
| Node 26.x | Permission Model stable (≥23.5.0), ESM syntax detection default (≥22.7), `node --test` `expectFailure` (fjs's `usesInlineTestContext` uses **Node 26** as the baseline for native `expectFailure`) | **Do not drop below Node 26** — fjs's own test-registration strategy branches on it |
| TypeScript 7.0 | `checkJs` + JSDoc | 7.0 **tightened** JS/JSDoc checking: Closure-style JSDoc removed, `@enum` gone, standalone `?` as a type gone, `@class` on functions gone, values can no longer substitute for types. The project's `@import { Name } from '...'` convention is the modern form and is unaffected. |
| TypeScript 7.0 | tooling | **No stable programmatic API until 7.1.** typescript-eslint, ts-morph, ts-jest cannot run on it. Irrelevant here (`tsc --noEmit` + `node --test` only) but rules out adding a linter this cycle. |
| MCP `2024-11-05` (fjs default) | Claude Code: yes (MEDIUM). Claude Desktop: **likely broken** — lists tools, never calls them. ChatGPT: N/A, no stdio. | Override with your own `McpConfig` |
| `bigint` values | `fjs/media/json`: **no**. `fjs/djs`: **yes**. `fjs/types/rtti`: schema exists, but cannot cross the JSON wire. | Money crosses MCP as a decimal string; rests in JSON blobs as integer cents |
| 128 KiB (`bigint.maxLength = 0x100000n` bits) | Every `Vec`, `readFile`, `readBytes`, CAS chunk, `cas_add` inline content, and stdio response line | One number, everywhere. Design around it once. |

---

## Open questions this research could not close

| Question | Why it stayed open | How to close it, cheaply |
|---|---|---|
| Does Claude Code accept `2024-11-05` today? | Only secondary sources | Pipe an `initialize` at both versions into `fjs mcp` and diff. 10 minutes. |
| Is the Tax Table band uniformly $50 at the low end? | Not read out of a current-year Pub. 1040 | Generate the table and diff it against the TY2025 Pub. 1040 across the full range, as a `proof`. Do this before Week 2. |
| Exact TY2025 Schedule 1-A limitation/phase-out mechanics | Out of scope for a stack survey | Read the Schedule 1-A instructions when scoping the 1040. Affects plan open question 1. |
| Whether the plan's Week 5 "source validation" is worth attempting at all | Depends on how far the Permission Model gets you in practice | Decide after Week 1's `--permission` launcher is running and you have seen real refusal errors |

---

## Sources

**Primary — read directly from `node_modules/functionalscript@0.40.0` (HIGH confidence):**
- `fjs/mcp/module.f.js` — `casConfig` protocol version pin, `casMcpServer` assembly
- `fjs/protocol/mcp/module.f.js` — `mcpStep`, version echo behaviour (lines 199–245), `toJsonSchema` use
- `fjs/protocol/mcp/stdio/module.f.js` — transport loop, `tryUtf8` overflow degradation
- `fjs/effects/module.f.js:282` — `match` and the missing-operation `TypeError`
- `fjs/effects/module.js` — `asyncRun`
- `fjs/effects/node/module.f.d.ts` — full `NodeOp` vocabulary incl. `Import`, `Sandbox`
- `fjs/effects/node/module.js:64` — the `sandbox` implementation (try/catch + timing)
- `fjs/types/bigfloat/module.f.js` and `.d.ts` — two exports, no arithmetic
- `fjs/types/bigint/module.f.js` — `maxLength = 0x100000n`, `divUp`/`roundUp`
- `fjs/types/prime_field/module.f.d.ts` — modular arithmetic
- `fjs/djs/ast/module.f.d.ts` — `AstConst` has no function node
- `fjs/js/` — tokenizer only
- `fjs/media/type/module.f.d.ts`, `fjs/media/revision/module.f.d.ts`, `fjs/media/json/module.f.d.ts`, `fjs/types/rtti/module.f.d.ts`
- `fjs/cas/module.f.js` / `.d.ts` — `toPath`, `url`, `collectRead`

**Primary — executed on this machine (HIGH confidence):**
- Extensionless dynamic import → succeeds (syntax detection)
- Bare specifier from a CAS-shaped path → `ERR_MODULE_NOT_FOUND`; succeeds with a `node_modules` symlink at the CAS root
- `data:` URL import → succeeds; with a bare specifier → `ERR_UNSUPPORTED_RESOLVE_REQUEST`
- `node:fs` at import time → reachable with no flags; `ERR_ACCESS_DENIED` under `--permission`
- `fetch` under `--permission` → blocked; stdio under `--permission` → works
- Tax-Calculator `policy_current_law.json` fetched and inspected: `STD` 2025 = 15750/31500/23625, 2026 = 16100/32200/24150

**Official documentation (HIGH confidence):**
- <https://nodejs.org/api/permissions.html> — Permission Model stability, flag list, threat-model caveats
- <https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning> — modern/legacy terminology, negotiation, compatibility matrix
- <https://modelcontextprotocol.io/docs/2026-07-28/learn/versioning> — current version is `2026-07-28`
- <https://blog.modelcontextprotocol.io/posts/2026-07-28/> — stateless architecture, deprecations
- <https://www.irs.gov/pub/irs-drop/rp-25-32.pdf> — Rev. Proc. 2025-32
- <https://www.irs.gov/newsroom/schedule-1-a-additional-deductions-what-to-know-about-the-new-form> — Schedule 1-A, line 13b
- <https://www.irs.gov/instructions/i1040gi> — Form 1040 instructions
- <https://github.com/PSLmodels/Tax-Calculator/blob/master/LICENSE> — CC0 1.0, verified

**Secondary, verified against ≥2 sources (MEDIUM confidence):**
- <https://nodejs.org/en/blog/release/v26.0.0>, <https://www.infoq.com/news/2026/06/nodejs-release-changes/> — Node 26 released 2026-05-05, LTS Oct 2026
- <https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/>, <https://www.infoq.com/news/2026/08/typescript-7-released/> — TS 7.0 GA 2026-07-08, JSDoc tightening, no stable API until 7.1
- <https://github.com/tc39/proposal-shadowrealm> — Stage 2.7 as of May 2026
- <https://www.endorlabs.com/learn/cve-2026-22709-critical-sandbox-escape-in-vm2-enables-arbitrary-code-execution>, <https://thehackernews.com/2026/01/critical-vm2-nodejs-flaw-allows-sandbox.html> — CVE-2026-22709
- <https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt> — ChatGPT Developer Mode requires remote HTTPS endpoints
- <https://simonwillison.net/2026/Mar/22/javascript-sandboxing-research/> — 2026 sandboxing option survey

**Single-source, flagged (MEDIUM/LOW confidence):**
- <https://github.com/thingsboard/thingsboard-mcp/issues/35> — Claude Desktop negotiating `2025-11-25`, silently refusing `tools/call` against a `2024-11-05` server (April 2026). One report; motivates the pin change but is not proof.
- Tax Table $50-band midpoint derivation — multiple secondary sources including IRS SOI publications; **not** confirmed against a current-year Pub. 1040. Must be closed by a generated-vs-published diff.

---
*Stack research for: MCP + CAS + FunctionalScript US tax computation*
*Researched: 2026-08-03*
