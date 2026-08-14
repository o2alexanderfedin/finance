# Phase 19: Reproducibility and Report Provenance - Pattern Map

**Mapped:** 2026-08-12
**Files analyzed:** 3 (1 create, 2 modify)
**Analogs found:** 3 / 3 (all role-match or better; no file without an analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `fjs/report/provenance/module.f.js` (CREATE) | utility/model (typed header builder + hash derivation + predicate) | transform | `fjs/report/guard/module.f.js` (predicate shape) + `fjs/report/amend/module.f.js` (`programHash` comparability framing) + `fjs/report/line/module.f.js` (module docstring/type conventions) | role-match (composite; no single sibling covers header+hash+predicate) |
| `fjs/server/fjs_run/module.f.js` (MODIFY: arg schema + envelope) | controller (MCP tool handler) | request-response | itself, at `fjsRunInputSchema` (lines 413-418) and the envelope literal (lines 379-386) — plus `fjs/server/finance_tax_params/module.f.js` for the `{ year: number }` / unknown-year-refusal shape `taxYear` should copy | exact (self) / role-match (finance_tax_params) |
| `fjs-run-integration.test.js` (MODIFY: add PROV-05 pinned/unpinned pair + PROV-04 real-response assertion) | test (real-process integration) | request-response over NDJSON, with an event-driven spawn/readiness wrapper | itself — the existing pin proof (lines 400-464) and the zero-read adversary proof (lines 466-498) are the two closest in-file shapes; `cas-refresh-cross-process.test.js` supplies the second-OS-process (`fjsCliPath`) idiom if a second process is ever needed | exact (self) |

## Pattern Assignments

### `fjs/report/provenance/module.f.js` (CREATE — utility/model, transform)

No file at this path exists yet. Three existing `fjs/report/*` siblings between them cover every convention the new module needs: `line` for module-docstring/type-precedent shape, `guard` for a small exported predicate + `RunOutcome`-style type, `amend` for the `programHash`-comparability framing PROV-04's own docstring must not contradict.

**Module docstring convention** (`fjs/report/guard/module.f.js` lines 1-125, `fjs/report/line/module.f.js` lines 1-16):
- Opens with the requirement ID(s) this module carries in bold/em (`PROV-07's anti-hardcoding kill condition: ...`, `PROV-01/PROV-02 — the report-line type: ...`).
- A `## Where this fits` section (guard, lines 8-19) that names sibling modules under `fjs/report/` by relative path and says which mechanism lives where — copy this shape verbatim for provenance, e.g. "`fjs/report/` holds `line` (traceability type), `audit` (literal count), `guard` (the zero-read kill condition), `amend` (PROV-06's diff), `payer`, and this module — the PROV-04 provenance header, `paramSetHash`, and EXEC-13's acceptance predicate."
- Ends the docstring with `@module` on its own line, then a blank line, then imports.

**The Q2 distinction the docstring MUST state crisply** (CONTEXT.md's own gate on this): `fjs/report/amend/module.f.js` lines 14-23 is the exact precedent text to mirror and NOT contradict — `programHash` equality already implies parameter-set equality for the **guest-program** path (parameters are baked-in literals, no `import`). `paramSetHash` names the parameter set the **host engine** (`fjs/form1040/core`'s `form1040Report`) was handed, a distinct fact. Restate this distinction, don't just cite it.

**Import style — `@import` JSDoc block, never inline `@type {import(...)}`** (AGENTS.md Code style; every analog complies). From `fjs/report/amend/module.f.js` lines 44-63:
```js
import { cBase32ToVec, vecToCBase32 } from 'functionalscript/fjs/basen/cbase32/module.f.js'
import { collectRead, fileCas } from 'functionalscript/fjs/cas/module.f.js'
import { sha256 } from 'functionalscript/fjs/crypto/sha2/module.f.js'
import { assert, assertEq, assertNotNullish } from 'functionalscript/fjs/asserts/module.f.js'
import { dialect as runDialect, validate as validateRun } from '../../run/module.f.js'
import { applyWholeDollarElection } from '../line/module.f.js'
import { centsFromString, centsToString, tryCentsFromString } from '../../exact/module.f.js'

/** @import { Effect } from 'functionalscript/fjs/effects/module.f.js' */
/** @import { Cas, FileCasOperation } from 'functionalscript/fjs/cas/module.f.js' */
/** @import { Result } from 'functionalscript/fjs/types/result/module.f.js' */
/** @import { Run, RunError } from '../../run/module.f.js' */
/** @import { ReportLine, Source } from '../line/module.f.js' */
```
Runtime imports (`import { X } from '...'`) always precede the `/** @import {...} */` type-only block, which is always a top-level JSDoc comment — never an inline `@type {import('...').Name}` anywhere in the file.

**`export const proof` placement:** always the LAST thing in the file, after a `// ── Tests ──...` banner comment (see `fjs/report/line/module.f.js` line 166, `fjs/report/guard/module.f.js` line 170, `fjs/report/amend/module.f.js` line 354). Test-only helpers (fixture builders) sit between that banner and the `proof` object itself, each individually commented `TEST-FIXTURE ONLY.` if they build inputs.

**The predicate — model directly on `classifyRunOutcome`** (`fjs/report/guard/module.f.js` lines 132-168):
```js
/**
 * @template T
 * @typedef {{ readonly kind: 'ok', ... } | { readonly kind: 'error', ... }} RunOutcome
 */

/** @type {(literalCount: number) => (value: unknown, reads: readonly Read[]) => RunOutcome<unknown>} */
export const classifyRunOutcome = literalCount => (value, reads) => reads.length === 0
    ? { kind: 'error', message: `...`, reads: [] }
    : { kind: 'ok', value, reads, literalCount }
```
The EXEC-13 acceptance predicate is the same shape at a fraction of the size: a single exported, hand-named, curried-or-unary pure function over a `Run`-shaped value, e.g. `countsTowardReproducibilityAcceptance = (run) => run.pinned`. `Run`'s own `pinned`/`subject`/`parents` invariant is ALREADY enforced by `fjs/run/module.f.js`'s `checkReferences` (lines 160-166) — the predicate does not need to re-derive "both or neither," only read `pinned`. Import `Run` as a type via `/** @import { Run } from '../../run/module.f.js' */`, never re-declare its shape.

**Proof style for the predicate — both arms named separately, mirroring `classifyRunOutcome`'s own proof** (`fjs/report/guard/module.f.js` lines 172-215): one leaf per arm (`emptyReadsProducesAnErrorOutcome`, `nonEmptyReadsProducesAnOkOutcomeCarryingValueReadsAndLiteralCount`), each asserting the field(s) that arm carries — never one leaf covering both arms combined (Validation's M2 gate specifically targets "the acceptance predicate's rejection arm," so that arm needs its own leaf to be independently reddened).

**The content-hash chain for `paramSetHash` — reuse `computeSync(sha256)`, never `fileCas`'s streaming write.** Every existing `sha256` call site in `fjs/` (`fjs/server/module.f.js`, `fjs/server/finance_documents_list/module.f.js`, `fjs/server/fjs_run/snapshot/module.f.js`, `fjs/report/amend/module.f.js`) reaches `sha256` only through `fileCas(sha256)(home)` — an `Effect`-returning CAS write. `paramSetHash` must be **pure and synchronous** (no CAS write; nothing is being stored, only fingerprinted), so the correct call chain is the ONE-SHOT hash `functionalscript` already ships but that has ZERO call sites anywhere under this repo's own `fjs/` today — `computeSync`, from the same `fjs/crypto/sha2/module.f.js` module `sha256` itself comes from:
```js
import { computeSync, sha256 } from 'functionalscript/fjs/crypto/sha2/module.f.js'
import { vecToCBase32 } from 'functionalscript/fjs/basen/cbase32/module.f.js'
import { tryUtf8 } from 'functionalscript/fjs/text/module.f.js'
import { assert } from 'functionalscript/fjs/asserts/module.f.js'
import { stringify as jsonText } from '../../json/module.f.js'

/** @type {(taxParamSet: TaxParamSet) => string} */
const paramSetHash = taxParamSet => {
    const bytes = tryUtf8(jsonText(/** @type {JsonUnknown} */ (taxParamSet)))
    assert(bytes !== null, ['expected the canonical parameter-set text to encode as UTF-8', taxParamSet])
    return vecToCBase32(computeSync(sha256)([bytes]))
}
```
- `jsonText` (imported as `stringify` from `fjs/json/module.f.js`, the project's ONE canonical JSON codec — see that module's own docstring lines 1-30) preserves **source** key order, never sorts. Every `TaxParamSet` value is a fixed object literal at `fjs/tax/params/module.f.js:729-740` (`taxParamsByYear[2025] = { standardDeduction, agedOrBlindAdditional, ... }`), so its key order is a property of the source file, stable across processes and hashings — this is exactly the determinism `fjs/json/module.f.js`'s own docstring (lines 24-29) warns must not be assumed for arbitrary re-serialized data, but IS true here because the value being hashed was never round-tripped through a parse.
- `tryUtf8` → `computeSync(sha256)([bytes])` → `vecToCBase32` is the same three-function chain `fjs/report/amend/module.f.js`'s `seedText` test helper (lines 368-375) and `fjs/server/fjs_run/module.f.js`'s `writeTextToCas` (lines 235-244) use for the FIRST two steps (`tryUtf8`, then hash) — the only difference is the third step: those two go on to `cas.write` (an `Effect`) and take the hash `fileCas` computes internally; `paramSetHash` calls `computeSync` directly and skips the write entirely, because nothing needs to be retrievable by this hash — it only needs to be a stable fingerprint. `computeSync`'s signature is `(list: List<Vec>) => Vec`, proven directly against `fileCas`'s own internal hash in `node_modules/functionalscript/fjs/cas/proof.f.js` line 97 (`computeSync(sha256)([content])` equals the hash `cas.write` returns for the same bytes) — so this is not a parallel hashing mechanism, it is the SAME primitive `fileCas` already uses, called without the write.
- This is a genuinely NEW pattern for project code (no existing `fjs/*.f.js` file imports `computeSync` today) but not a gap requiring an upstream fix or a `fjs/todo/` note — `computeSync` already ships in the pinned `functionalscript` version and is a first-class export, just previously unused here.

**The "reviewed estimate" framing constant** — a single exported string constant, no analog needed beyond the module-scope-constant convention every dialect module already uses (e.g. `fjs/run/module.f.js`'s `export const dialect = 'vnd.fjs.run'`, line 67): `export const reviewedEstimateFraming = 'reviewed estimate — check against the source documents before filing'` (exact wording from CONTEXT.md, carried verbatim, not paraphrased).

---

### `fjs/server/fjs_run/module.f.js` (MODIFY — controller, request-response)

**Where the envelope is built — `handleRunOutcome`'s `'ok'` branch** (lines 350-389, the six-key object at lines 379-386):
```js
return pure(okResult(jsonText({
    resultHash,
    runHash,
    preview,
    truncated,
    readCount: inputs.length,
    literalCount: outcome.literalCount,
})))
```
PROV-04's header (`taxYear`, `paramSetHash`, `programHash`) is added here, alongside the existing six keys — `programHash` is already in scope at this call site as the function's own `programHash` parameter (line 350's curry, threaded from `args.hash` at the call site line 452/456), so no new plumbing is needed for that one field. `taxYear` and `paramSetHash` must be threaded down from `fjsRunTool`'s `handle` the same way `programArgs`/`pinned`/`pinFields` already are (line 456: `handleRunOutcome(cas)(args.hash)(programArgs)(pinned)(pinFields)(outcome)` — one more curried parameter in that same chain).

**Where the arg schema is extended — `fjsRunInputSchema`** (lines 413-418):
```js
export const fjsRunInputSchema = /** @type {const} */ ({
    hash: string,
    args: option(array(string)),
    subject: option(string),
    parents: option(array(string)),
})
```
CONTEXT.md's decision is that `taxYear` is an explicit, presumably REQUIRED caller argument (mirroring the `elected` precedent Phase 15 set for the same reason — "inferring from stored content is only sound if both runs pin the same revision, which can silently be false"). The closest existing precedent for a bare required numeric field on a tool schema is `finance_tax_params`'s own `{ year: number }` (`fjs/server/finance_tax_params/module.f.js` line 149) — copy `number` (rtti's bare type, from `functionalscript/fjs/types/rtti/module.f.js`, already imported into `fjs_run` at line 123 alongside `option`/`array`/`string`; add `number` to that same import line) rather than inventing a new validated-string-year convention. Adding `taxYear: number` (no `option(...)` wrapper, since it is required) to `fjsRunInputSchema` is the one-line schema change; `toolEntry`'s own RTTI check then rejects a call missing it or carrying a non-number BEFORE the handler ever runs — the same guarantee `finance_tax_params`'s own docstring names at lines 41-43.

**Unknown-year refusal precedent, if `taxYear` needs to be validated against `taxParamsByYear`'s known keys** (`fjs/server/finance_tax_params/module.f.js` lines 131-158):
```js
export const knownYears = Object.keys(taxParamsResponses).map(Number)
...
const response = taxParamsResponses[args.year]
if (response === undefined) {
    return pure(errorResult(`unknown tax year: ${args.year}; known: ${knownYears.join(', ')}`))
}
```
`fjs_run` needs the identical shape for looking up `taxParamsByYear[args.taxYear]` (from `fjs/tax/params/module.f.js` line 728, `{ readonly [year: number]: TaxParamSet }` — already `undefined`-safe under `noUncheckedIndexedAccess`) to compute `paramSetHash`. An unknown `taxYear` should refuse the SAME way `finance_tax_params` does, naming the offending year and the known set, via `errorResult` — never a throw, never a cast past the `| undefined`.

**Where the tool-set derivation lives for this integration test to keep passing** — `fjs/server/module.f.js:216-225`'s `financeMcpHandlers` spreads registries, so the live tool count is not found by grepping local `toolEntry(` calls (AGENTS.md-adjacent Integration Point note in CONTEXT.md). Adding a required field to `fjs_run`'s schema does NOT change the advertised tool SET (still 13 tools, `fjs_run` is still one of them) — it only changes what a call to the EXISTING `fjs_run` tool must supply. `fjs-run-integration.test.js`'s self-enforcing check (line 543-547, comparing `toolsCalled` against `advertisedTools`) is unaffected by this; what breaks if `taxYear` is added without updating the test is every EXISTING `call('fjs_run', {...})` in that file (lines 326, 433, 482, 365 uses `fjs_check` not `fjs_run`) — each now needs `taxYear` added to its `arguments` object or the call fails `toolEntry`'s own RTTI check.

---

### `fjs-run-integration.test.js` (MODIFY — test, real-process, request-response over NDJSON)

**The spawn-and-speak harness — copy verbatim, do not re-derive** (lines 44-80, 121-230):
```js
import { spawn } from 'node:child_process'
...
serverProc = spawn('node', [join(repoRoot, 'index.js'), home], { stdio: ['pipe', 'pipe', 'pipe'] })

const responses = []
let stdoutBuf = ''
serverProc.stdout.setEncoding('utf8')
serverProc.stdout.on('data', chunk => {
    stdoutBuf += chunk
    let idx
    while ((idx = stdoutBuf.indexOf('\n')) !== -1) {
        const line = stdoutBuf.slice(0, idx)
        stdoutBuf = stdoutBuf.slice(idx + 1)
        if (line !== '') { rawStdoutLines.push(line); responses.push(JSON.parse(line)) }
    }
})

const waitForId = async (id, timeoutMs = 20_000) => { /* poll `responses`, never a bare sleep */ }
const call = async (name, args) => {
    const id = nextId()
    send({ jsonrpc: '2.0', method: 'tools/call', id, params: { name, arguments: args } })
    toolsCalled.add(name)
    return waitForId(id)
}
```
NDJSON in both directions: one JSON object per line, newline-delimited, `send` appends `'\n'` (implicit in the existing `send` helper, line 175), incoming lines are split on `\n` and each parsed independently. `initialize` → `notifications/initialized` → `tools/call` is the fixed opening sequence (lines 206-211).

**The PROV-05 mutation-gate shape to copy — the pin proof already in this file is 90% of PROV-05's OWN shape** (lines 400-464): it already does `evo_add` (live head) then `fjs_run` with `subject`/`parents` supplied, and asserts the PINNED value was used, not the live one (line 447-454: `pinResultMeta.text` equals the pinned parents, NOT the live head). PROV-05 needs the SAME pin set up once, then run TWICE with an `evo_add` (adding an amended revision to the pinned subject) happening BETWEEN the two runs, asserting:
1. Run 1 and run 2's `resultHash` strings are equal (cheap check).
2. The ACTUAL BYTES fetched back from CAS via `cas_get(hash, content:true)` for both `resultHash`es are byte-identical — copy the `cas_get`/`content:true` pattern already used at lines 344-347 and 444-446 (`resultGet.result.content[0].text` comparison), not merely the hash string.
3. **The required control (Validation's own "not optional" rule, 19-VALIDATION.md lines 69-79):** the SAME scenario run UNPINNED (an `fjs_run` call with no `subject`/`parents`) must show the result DID move after the same `evo_add`. Model the control's assertion shape on the zero-read adversary's own `assert.notEqual`-style contrast (line 454: `assert.notEqual(pinResultMeta.text, JSON.stringify([pinLiveRevHash]))` is the existing "prove it would have been different" idiom in this exact file) — build the control leg FIRST and watch it move before trusting the pinned leg's stability, per Validation's own instruction.

**The PROV-04 real-response assertion — extend the existing decisive-call block** (lines 323-337, where `parsed.resultHash`/`runHash`/`readCount`/`literalCount` are already asserted off `JSON.parse(runResponse.result.content[0].text)`): add `taxYear`/`paramSetHash`/`programHash` assertions in the SAME block, against the SAME `parsed` object, immediately after the existing `literalCount` assertion (line 337) — this is the one call in the file already proven to reach `fjs_run`'s real response shape; extending its assertions costs nothing structurally, but EVERY existing `call('fjs_run', {...})` invocation in the file (there are three: lines 326, 433, 482) must ALSO gain the new required `taxYear` argument in its `arguments` object, or `toolEntry`'s RTTI check fails those calls the moment the schema changes (see the `fjs_run/module.f.js` entry above).

**If a second, genuinely separate OS process is ever needed (not required by CONTEXT.md's own decisions, but the available idiom if a plan step needs one):** `cas-refresh-cross-process.test.js`'s `fjsCliPath` (lines 59-83) — spawn `node` directly against the absolute path `join(repoRoot, 'node_modules', 'functionalscript', 'fjs', 'module.js')`, NEVER `npx functionalscript` (that resolves through npm's registry, leaks a version-check network call, and costs seconds the CI budget does not have — measured, not assumed, in that file's own docstring). PROV-05 as specified needs only ONE running server process plus ordinary `evo_add`/`fjs_run` tool calls over the SAME session — the `runFjsCli`/second-process idiom is unlikely to be needed for this phase, but is the fallback if a plan step decides the amendment must be written by a truly external writer rather than via the live `evo_add` tool.

## Shared Patterns

### Canonical JSON + content hash (the chain `paramSetHash` must reuse)
**Source:** `fjs/json/module.f.js` (`stringify`, source-order canonicalization) + `functionalscript/fjs/text/module.f.js` (`tryUtf8`) + `functionalscript/fjs/crypto/sha2/module.f.js` (`computeSync`, `sha256`) + `functionalscript/fjs/basen/cbase32/module.f.js` (`vecToCBase32`).
**Apply to:** `fjs/report/provenance/module.f.js`'s `paramSetHash` only. Every OTHER content hash in this codebase (`programHash`, `resultHash`, `runHash`, document hashes) is produced by `cas.write` internally calling this SAME `sha256`/`computeSync` primitive as part of a real store — `paramSetHash` is the first hash in this project computed WITHOUT a corresponding CAS write, because nothing needs to be retrievable by it.
```js
const paramSetHash = taxParamSet => {
    const bytes = tryUtf8(jsonText(taxParamSet))
    assert(bytes !== null, [...])
    return vecToCBase32(computeSync(sha256)([bytes]))
}
```

### `toolEntry` arg-schema extension with a required field
**Source:** `fjs/server/finance_tax_params/module.f.js` lines 141-159 (`{ year: number }`, unknown-value refused via `errorResult`, never a throw).
**Apply to:** `fjs/server/fjs_run/module.f.js`'s `fjsRunInputSchema` (add `taxYear: number`) and `fjsRunTool`'s handler (look it up in `taxParamsByYear`, refuse an unknown year the same way). Every EXISTING caller of the tool (test files, other production call sites — there are none besides tests) must be updated in the SAME commit; `toolEntry`'s RTTI check enforces the new required field unconditionally once the schema changes, so a stale caller starts failing immediately, which is the intended forcing function, not a regression to work around.

### `@import` JSDoc block over inline `@type {import(...)}`
**Source:** AGENTS.md Code style section, lines 41-48; every `fjs/report/*` file complies (see `fjs/report/amend/module.f.js` lines 44-63 above for the fullest example).
**Apply to:** every new/modified `.f.js` file in this phase, no exceptions.

### Real-process integration harness: spawn, NDJSON, self-enforcing tool coverage
**Source:** `fjs-run-integration.test.js` lines 44-230 (primary), `cas-refresh-cross-process.test.js` lines 32-114 (second-process variant, `fjsCliPath`).
**Apply to:** the PROV-05/PROV-04 additions to `fjs-run-integration.test.js`. `@ts-nocheck` stays at the top of the file (already present, line 1) — do not attempt to typecheck this file; both root-level `.test.js` files carry the same exemption for the same reason (no `@types/node`, no subprocess-spawn effect in `fjs/effects/node`).

## No Analog Found

None. Every file this phase touches has at least a role-match analog already inspected above; the acceptance-predicate and `paramSetHash` mechanisms are genuinely new CODE but are directly modeled on `classifyRunOutcome`'s predicate shape and the CAS-internal hash primitive respectively — not built from scratch.

## Metadata

**Analog search scope:** `fjs/report/` (all 4 existing siblings: `line`, `guard`, `amend`, and `audit` referenced but not deep-read — 3 was enough), `fjs/run/module.f.js`, `fjs/server/fjs_run/module.f.js` + `snapshot/module.f.js`, `fjs/server/finance_tax_params/module.f.js`, `fjs/tax/params/module.f.js`, `fjs/form1040/core/module.f.js` (line 1549 region), `fjs-run-integration.test.js`, `cas-refresh-cross-process.test.js`, plus `node_modules/functionalscript/fjs/{cas,crypto/sha2,json→media/json,text,basen/cbase32}` for the hash-chain primitives.
**Files scanned:** 12 read directly (targeted regions for the two >1000-line files: `fjs/server/fjs_run/module.f.js`, `fjs/form1040/core/module.f.js`), plus 3 vendored `functionalscript` files for the `computeSync`/`sha256` signature chain.
**Pattern extraction date:** 2026-08-12
