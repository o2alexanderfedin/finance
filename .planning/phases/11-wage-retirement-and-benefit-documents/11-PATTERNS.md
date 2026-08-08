# Phase 11: Wage, Retirement, and Benefit Documents - Pattern Map

**Mapped:** 2026-08-07
**Files analyzed:** 7 (2 new dialects, 1 new tool, 4 modified)
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `fjs/document/1099r/module.f.js` | model (document dialect) | CRUD (validate/round-trip) | `fjs/document/w2/module.f.js` (repeating array + pair-list) and `fjs/document/1099int/module.f.js` (four-stage template) | exact |
| `fjs/document/ssa1099/module.f.js` | model (document dialect) | CRUD (validate/round-trip) | `fjs/document/1099int/module.f.js` | exact |
| `fjs/server/finance_documents_list/module.f.js` | service/controller (MCP toolEntry) | request-response (host-side lookup over Evo cache) | `fjs/server/finance_schema/module.f.js`, `fjs/server/finance_tax_params/module.f.js` | exact |
| `fjs/server/fjs_run/snapshot/module.f.js` | service (host map builder) | transform / access-control filter | itself (existing `buildRunSnapshot`) — same-file surgical fix | exact (modify-in-place) |
| `fjs/server/finance_schema/module.f.js` | service (registry/lookup map) | request-response | itself (existing `dialectSchemas`) — same-file extension | exact (modify-in-place) |
| `fjs/server/module.f.js` | composition root | request-response (registry composition) | itself (existing `financeMcpHandlers`) — same-file extension | exact (modify-in-place) |
| `fjs-run-integration.test.js` | test (real-process integration) | request-response | itself (existing `finance_tax_params` call block) — same-file extension | exact (modify-in-place) |

## Pattern Assignments

### `fjs/document/1099r/module.f.js` (model, CRUD)

**Analogs:** `fjs/document/1099int/module.f.js` (four-stage template), `fjs/document/w2/module.f.js` (repeating array + pair-list shapes)

#### 1. The four-stage `fjs/media/revision` template (verbatim shape, from `1099int/module.f.js` lines 43–168)

```js
import { number, option, string } from 'functionalscript/fjs/types/rtti/module.f.js'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.js'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.js'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { base, mediaTypeOf } from '../base/module.f.js'
import { moneyFieldError } from '../money_field/module.f.js'

// stage 1: dialect tag
export const dialect = 'vnd.fjs.1099int'
// stage 2: mediaType, derived mechanically
export const mediaType = mediaTypeOf(dialect)

// stage 3: rtti schema, `base(dialect)` spread FIRST
export const oneZeroNineNineIntSchema = /** @type {const} */ ({
    ...base(dialect),
    payerTin: string,
    recipientTin: string,
    accountNumber: string,
    taxYear: number,
    formRevision: string,
    corrected: option(true),
    box1InterestIncome: option(string),
    // ...
})
/** @typedef {Ts<typeof oneZeroNineNineIntSchema>} OneZeroNineNineInt */

// stage 4: structural-only validator
const validateShape = rttiValidate(oneZeroNineNineIntSchema)

/** @type {(r: OneZeroNineNineInt) => Result<OneZeroNineNineInt, OneZeroNineNineIntError>} */
// stage 5: semantic checkReferences
export const checkReferences = r => {
    if (r.formRevision.trim() === '') {
        return error(`formRevision must not be empty or whitespace-only`)
    }
    for (const field of moneyBoxFields) {
        const printed = r[field]
        if (printed === undefined) { continue }
        const message = moneyFieldError(field)(printed)
        if (message !== undefined) { return error(message) }
    }
    return ok(r)
}

// stage 6: composed validate — structural THEN semantic, never the reverse
export const validate = value => {
    const [t, v] = validateShape(value)
    if (t === 'error') { return error(v) }
    return checkReferences(v)
}
```

The 1099-R schema in RESEARCH.md's own worked example already follows this exactly (see RESEARCH.md's Pattern 1 block, lines 160–194) — copy that shape verbatim, not just the idea.

#### 2. Conditional spread discipline (VERBATIM, from `fjs/document/1099int/from_ocr/module.f.js` lines 120–131)

This is the ONLY place in the codebase today doing this correctly on a document-shaped object. `1099r`/`ssa1099` don't need a `convert` function this phase (no `from_ocr` per CONTEXT), but this same discipline governs `finance_documents_list`'s response-entry assembly (see below) and is worth pinning here as the canonical example:

```js
export const convert = (ocr, meta) => ({
    dialect,
    payerTin: meta.payerTin,
    recipientTin: meta.recipientTin,
    accountNumber: meta.accountNumber,
    taxYear: meta.taxYear,
    formRevision: meta.formRevision,
    ...(meta.corrected === true ? { corrected: /** @type {const} */ (true) } : {}),
    ...(meta.payerName === undefined ? {} : { payerName: meta.payerName }),
    ...(meta.recipientName === undefined ? {} : { recipientName: meta.recipientName }),
    ...moneyBoxes(ocr.fields),
})
```

Never write `...{ payerName: meta.payerName }` directly — under `exactOptionalPropertyTypes` that passes `tsc` and inserts a literal `payerName: undefined` key into the object at runtime, which is NOT the same as the key being absent (RTTI's `option(string)` and this project's own `option`-absent-able discipline distinguish "absent" from "present-and-undefined").

#### 3. The repeating-array shape (VERBATIM, from `fjs/document/w2/module.f.js` lines 69–77, 115, 200–211, 392–421)

```js
/**
 * One boxes-15-through-20 row: a state line and the locality line printed
 * beside it. Every field but `state` is absent-able, because the printed
 * form routinely leaves the locality half blank (DOC-11).
 */
const stateLocalEntry = /** @type {const} */ ({
    state: string,
    employerStateIdNumber: option(string),
    stateWagesTipsEtc: option(string),
    stateIncomeTax: option(string),
    localityName: option(string),
    localWagesTipsEtc: option(string),
    localIncomeTax: option(string),
})

// ...inside the dialect schema:
box15Through20: option(array(stateLocalEntry)),
```

`checkReferences`' walk over each row (the exact idiom for `1099r`'s `stateLocal` array):

```js
for (const entry of r.box15Through20 ?? []) {
    for (const field of stateLocalMoneyFields) {
        const printed = entry[field]
        if (printed === undefined) { continue }
        const message = moneyFieldError(`${entry.state} ${field}`)(printed)
        if (message !== undefined) { return error(message) }
    }
}
```

And the round-trip proof that "faithfully" has to mean — several rows, INCLUDING two for the same state, nothing merged or summed:

```js
multipleRowsIncludingRepeatedStateRoundTrip: () => {
    const rows = [
        { state: 'CA', stateWagesTipsEtc: '85000.00', stateIncomeTax: '4200.00' },
        { state: 'CA', stateWagesTipsEtc: '1000.00', stateIncomeTax: '50.00' },
        { state: 'NY', stateWagesTipsEtc: '2000.00', localityName: 'NYC', localIncomeTax: '75.00' },
    ]
    const [t, v] = validate({ ...minimal, box15Through20: rows })
    assert(t === 'ok', ['expected ok', t, v])
    assertEq(v.box15Through20?.length, 3)
    // The two CA rows stay two rows. Nothing here adds them up.
    assertEq(v.box15Through20?.[0]?.state, v.box15Through20?.[1]?.state)
},
```

For 1099-R specifically, RESEARCH.md's Q1 already names the field mapping (`stateLocal: option(array(stateLocalEntry))` with `state`/`payerStateNo`/`stateTaxWithheld`/`stateDistribution`/`localTaxWithheld`/`localityName`/`localDistribution`) — reuse the SHAPE above, renaming fields per that mapping.

#### 4. The `(code, amount)` pair-list shape (VERBATIM, from `fjs/document/w2/module.f.js` lines 55–62, 111, 191–199, 369–390)

```js
/**
 * One box-12 entry: the printed code and its amount. `code` is the IRS
 * code letter(s) as printed (`D`, `DD`, `W`, …) and is never interpreted
 * here — this phase stores and reads.
 */
const box12Entry = /** @type {const} */ ({
    code: string,
    amount: string,
})

// ...inside the dialect schema:
box12: option(array(box12Entry)),
```

`checkReferences`' walk (code must be non-empty, amount must pass `moneyFieldError`):

```js
for (const entry of r.box12 ?? []) {
    if (entry.code.trim() === '') {
        return error(`box12 entry has an empty code: ${entry.amount}`)
    }
    const message = moneyFieldError(`box12 code ${entry.code}`)(entry.amount)
    if (message !== undefined) { return error(message) }
}
```

**1099-R's box 7a deviates from this shape on purpose** — CONTEXT decision: box 7a is a LIST OF CODES (`option(array(string))`), never `(code, amount)` pairs, because there is no per-code amount printed (unlike W-2 box 12). Do not copy the pair shape for box 7a; copy only the "a code can repeat, a code carries meaning, position does not" lesson (see RESEARCH.md's `box7aDistributionCodes: option(array(string))`). The repeated-code round-trip proof (`repeatedCodeIsPreserved`, W-2 lines 372–381) is still the pattern to copy for box 7a's own proof — just against `array(string)` instead of `array(box12Entry)`.

#### 5. `option(true)` checkbox convention (VERBATIM, from `fjs/document/w2/module.f.js` lines 100, 112–114, 348–356)

```js
corrected: option(true),
box13StatutoryEmployee: option(true),
box13RetirementPlan: option(true),
box13ThirdPartySickPay: option(true),
```

Why `false` is structurally invalid — the proof that pins it:

```js
// DOC-12, and the same rule for box 13's three flags: `false` is not
// a member of `option(true)`. Absence is the only way to say "not
// checked", so there is exactly one representation of it.
falseFlagsRejected: () => {
    assertEq(validate({ ...minimal, corrected: false })[0], 'error')
    assertEq(validate({ ...minimal, box13RetirementPlan: false })[0], 'error')
    assertEq(validate({ ...minimal, box13StatutoryEmployee: false })[0], 'error')
    assertEq(validate({ ...minimal, box13ThirdPartySickPay: false })[0], 'error')
},
```

`option(true)`'s type is literally the single-member type `true | undefined` — there is no third value `false` can occupy, so this is REJECTED BY THE RTTI SCHEMA ITSELF, not by a runtime `if`. 1099-R needs this for `corrected`, `box2bTaxableAmountNotDetermined`, `box2bTotalDistribution`, `box7bIraSepSimple`, `box7cTrumpAccount`, `box12FatcaFilingRequirement` (per RESEARCH.md's Q1 box list). SSA-1099 needs it for `corrected` only (Q2 notes LOW confidence it is ever populated, but the field stays for structural consistency).

#### 6. `moneyFieldError` usage (VERBATIM, from `fjs/document/money_field/module.f.js` lines 42–47, and its call sites in `1099int`/`w2`)

```js
// fjs/document/money_field/module.f.js
export const moneyFieldError = label => printed => {
    const [t, v] = tryCentsFromString(printed)
    if (t === 'error') { return `${label} is not an exact decimal: ${v}` }
    const magnitude = v < 0n ? -v : v
    return magnitude > maxSafeCents ? `${label} exceeds safe integer magnitude: ${printed}` : undefined
}
```

Call site (scalar box loop, from `w2/module.f.js` lines 181–190 — same shape 1099-R's scalar money boxes use):

```js
for (const field of moneyBoxFields) {
    const printed = r[field]
    if (printed === undefined) { continue }
    const message = moneyFieldError(field)(printed)
    if (message !== undefined) { return error(message) }
}
```

**Anti-pattern flagged by RESEARCH.md**: do NOT call `moneyFieldError` on 1099-R's percentage boxes (`box8bPercentageOfAnnuityContract`, `box9aPercentageOfTotalDistribution`). `moneyFieldError` enforces the project's cents-scale exact-decimal rule; a percentage is not a money amount and can legitimately carry a different number of decimal places. Store those two boxes as plain `option(string)` with no numeric-exactness check this phase.

#### 7. The generated-proof idiom: generation FROM a field list + an INDEPENDENTLY hand-typed count

Half A — the GENERATION (from `fjs/document/w2/module.f.js` lines 133–159, 262–306):

```js
const moneyBoxFields = /** @type {const} */ ([
    'box1WagesTipsOtherCompensation',
    'box2FederalIncomeTaxWithheld',
    // ... every scalar money box name, as a string literal ...
])

const stateLocalMoneyFields = /** @type {const} */ ([
    'stateWagesTipsEtc',
    'stateIncomeTax',
    'localWagesTipsEtc',
    'localIncomeTax',
])

// One generated proof leaf PER named field, built by mapping the list
// itself into [field, assertion] pairs — never as N hand-written
// near-identical leaves.
const generatedScalarMoneyBoxExactnessProof = Object.fromEntries(
    moneyBoxFields.map(field => [
        field,
        () => {
            const [t, v] = validate({ ...minimal, [field]: '1,234.56' })
            assertEq(t, 'error', ['expected a comma-grouped amount in this box to be refused', field, t, v])
        },
    ]),
)
```

Half B — the INDEPENDENTLY hand-typed count (from `w2/module.f.js` lines 272–278, 306; the same idiom in `fjs/tax/boundary/module.f.js` lines 150–171):

```js
/**
 * Independently hand-typed: the number of scalar money boxes
 * {@link moneyBoxFields} is expected to name today. Deliberately NOT derived
 * from `moneyBoxFields.length` — see {@link generatedScalarMoneyBoxExactnessProof}.
 * @type {number}
 */
const expectedMoneyBoxFieldCount = 10
```

```js
// fjs/tax/boundary/module.f.js — same idiom, second precedent
export const allThresholds = [
    ...ordinaryBracketThresholds,
    ...capitalGainsThresholds,
    ...taxTableBandThresholds,
]
/** @type {number} */
export const expectedThresholdCount = 50
```

The count is asserted alongside the generated leaves, not replacing them (`w2/module.f.js` lines 433–446):

```js
scalarMoneyBoxExactness: {
    ...generatedScalarMoneyBoxExactnessProof,
    everyMoneyBoxIsCovered: () => {
        assertEq(
            moneyBoxFields.length,
            expectedMoneyBoxFieldCount,
            ['expected exactly the independently-stated money box count', moneyBoxFields.length, expectedMoneyBoxFieldCount],
        )
    },
},
```

**Why either alone is insufficient** (this is the exact defect class AGENTS.md documents as having shipped four times): the generated leaves prove every box CURRENTLY in the list is exercised — but if a box is silently DELETED from `moneyBoxFields`, its generated leaf disappears WITH it, and the loop iterating a shrunken list stays green. The hand-typed count is the only thing that notices the list itself got shorter, because it is NOT derived from `moneyBoxFields.length` — it is a separate literal a human typed. AGENTS.md's own case study: `finance_schema`'s `unknownDialectRefused` iterated `Object.keys(dialectSchemas)` (the code under test) and a removed dialect vanished from its own test loop in the same instant; only `everyRegisteredDialectIsCounted`'s hand-typed `expectedKnownDialectCount` catches that class of regression.

1099-R needs at least two such generated+hand-typed pairs: one for its scalar money boxes (`moneyBoxFields`), one for its `stateLocal` array's money fields (`stateLocalMoneyFields`, mirroring `stateLocalMoneyFields`/`expectedStateLocalMoneyFieldCount` above). SSA-1099 needs one, for its handful of money boxes (`box3`, `box4`, `box5`, `box6`).

---

### `fjs/document/ssa1099/module.f.js` (model, CRUD)

**Analog:** `fjs/document/1099int/module.f.js` — same four-stage template as above (see 1099-R's section 1). Deviations specific to SSA-1099, per CONTEXT/RESEARCH:

- `payerTin: string`, always stored as `''` (SSA-1099 prints no payer TIN — document this explicitly in the module docstring, mirroring `w2`'s own docstring style of explaining a deliberate naming/shape choice up front, e.g. `w2/module.f.js` lines 84–91's explanation of why `payerTin`/`recipientTin` keep the family's names).
- `box3Description: option(string)`, `box4Description: option(string)` — free text, never parsed, following the SAME "option(string), never computed on" discipline every other optional label field in `1099int`/`w2` already uses (e.g. `payerName: option(string)` in `1099int/module.f.js` line 83).
- Module docstring MUST name the actual source (IRS Pub 915 (2025), pages 20–22, `https://www.irs.gov/pub/irs-pdf/p915.pdf`) and state plainly it is a SAMPLE illustration, not a blank form — this is the specific trap RESEARCH.md and CONTEXT both flag by name. Model the docstring's "sourcing honesty" register on `1099int/module.f.js`'s own header (lines 1–41), which documents its own MVP-subset scope choice inline rather than leaving it implicit.

---

### `fjs/server/finance_documents_list/module.f.js` (service/controller, request-response)

**Analogs:** `fjs/server/finance_schema/module.f.js`, `fjs/server/finance_tax_params/module.f.js`

#### 8. `toolEntry` registration — exact shape, unknown-argument refusal via `errorResult`, never a throw

VERBATIM from `fjs/server/finance_schema/module.f.js` lines 106–124:

```js
export const financeSchemaTool = toolEntry(
    'finance_schema',
    'Given a document dialect tag (e.g. vnd.fjs.1099int), returns that ' +
    "dialect's own field schema as JSON Schema — read this before authoring " +
    'a program against a dialect, so field names are read, never guessed.',
    { dialect: string },
    args => {
        const schema = dialectSchemas[args.dialect]
        if (schema === undefined) {
            return pure(errorResult(
                `unknown dialect: ${args.dialect}; known: ${knownDialects.join(', ')}`,
            ))
        }
        return pure(okResult(jsonText(/** @type {JsonUnknown} */ (toJsonSchema(schema)))))
    },
)
```

Same shape, `finance_tax_params/module.f.js` lines 141–159 (numeric key instead of string, otherwise identical):

```js
export const financeTaxParamsTool = toolEntry(
    'finance_tax_params',
    'Given a tax year, returns that year\'s TY parameter set — ... ',
    { year: number },
    args => {
        const response = taxParamsResponses[args.year]
        if (response === undefined) {
            return pure(errorResult(
                `unknown tax year: ${args.year}; known: ${knownYears.join(', ')}`,
            ))
        }
        return pure(okResult(jsonText(response)))
    },
)
```

The rule to copy exactly: `toolEntry` itself already rejects a call missing/mistyping a DECLARED argument (`{ dialect: string }` / `{ year: number }`) via its own RTTI check before the handler runs (see `finance_schema/module.f.js`'s docstring, lines 26–34, citing `T-07-03-02`). The handler's own `errorResult` branch is for a value that IS present and well-typed but names something UNKNOWN (an unregistered dialect, an unregistered year) — always `pure(errorResult(...))`, naming BOTH the offending value and the full known set, never a throw, never a crash, never a dropped connection. `finance_documents_list` takes `{ archived: option(true) }` per CONTEXT/RESEARCH — since `archived` is itself `option(true)`, there is no "unknown value" case to refuse for that one argument (only present-true or absent), so the "known set" refusal pattern above may not even be needed here; if the tool later grows an argument with a closed vocabulary, copy the pattern above.

RESEARCH.md's own illustrative construction for `finance_documents_list` (Pattern 2, "Host-side lookup-map tool"), explicitly flagged there as "illustrative, not literal" — use it for the effect-composition shape (nested `step`/`foldStep`), not as a drop-in:

```js
export const financeDocumentsListTool = evo => cas => toolEntry(
    'finance_documents_list',
    'Enumerates stored documents as a JSON array of {subject, dialect, taxYear, hash}. ' +
    'Active by default; pass archived: true to list archived documents instead.',
    { archived: option(true) },
    ({ archived }) => step(
        evo.list(archived),
        subjects => foldStep(pure(subjects), /** @type {readonly DocumentListEntry[]} */ ([]), subject => acc =>
            step(evo.head(subject), heads => {
                const headHash = heads[0]
                if (headHash === undefined) { return pure(acc) }
                return step(evo.revision(headHash), revResult => {
                    if (revResult[0] === 'error') { return pure(acc) }
                    const snapshotHash = cBase32ToVec(revResult[1].snapshot)
                    if (snapshotHash === null) { return pure(acc) }
                    return step(collectRead(cas.read(snapshotHash)), blobResult => {
                        if (blobResult[0] === 'error') { return pure(acc) }
                        const parsed = tryJsonParse(utf8ToString(blobResult[1]))
                        if (parsed === null) { return pure(acc) }
                        const [t, identity] = rttiValidate(documentIdentitySchema)(parsed)
                        const dialect = t === 'ok' && identity.dialect !== undefined ? identity.dialect : 'unknown'
                        const taxYear = t === 'ok' ? identity.taxYear : undefined
                        return pure([...acc, { subject, dialect, taxYear, hash: headHash }])
                    })
                })
            }),
        ),
    ).map(list => okResult(jsonText(list))),
)
```

For the ACTUAL fold/step composition idiom this project uses for an effectful loop into an accumulator, copy `buildRunSnapshot`'s own nested-`step`/`foldStep` shape (see the DOC-15 section below) rather than trusting the illustrative snippet's exact call chain — RESEARCH.md itself says so.

Loose identity-peek schema (VERBATIM, RESEARCH.md Code Examples section, sourced from `fjs/server/module.f.js`'s own comment "rtti permits properties a schema does not mention" — verified true against `fjs/server/module.f.js` lines 283–285):

```js
import { number, option, string } from 'functionalscript/fjs/types/rtti/module.f.js'
const documentIdentitySchema = /** @type {const} */ ({ dialect: option(string), taxYear: option(number) })
```

Do NOT validate against `finance_schema`'s `dialectSchemas` registry to classify a document's dialect — CONTEXT/RESEARCH explicitly reject that (it would conflate "not one of ours" with "structurally invalid", and force importing every dialect just to reject unknown ones).

Narrowing discipline for the parsed JSON — copy `finance_tax_params/module.f.js`'s own helpers verbatim as the model for "no `any`, no cast, no non-null assertion" (lines 198–243, though these are proof-only helpers there — RESEARCH.md's own constraint note says production code needs its OWN narrowing following the same discipline, not importing test helpers):

```js
const asObject = (value, description) => {
    assert(
        typeof value === 'object' && value !== null && !Array.isArray(value),
        ['expected a JSON object', description, value],
    )
    return value
}
const field = (value, key) => Reflect.get(value, key)
const asString = (value, description) => {
    assert(typeof value === 'string', ['expected a string', description, value])
    return value
}
```

Effect-composition helper reused from elsewhere: `collectRead`, `cBase32ToVec`/`vecToCBase32`, `utf8ToString` — all already imported this exact way in `fjs/server/fjs_run/snapshot/module.f.js` (see its import block, lines 42–50) — reuse those same imports rather than re-deriving the hash-conversion dance.

**Registration** (VERBATIM shape, `fjs/server/module.f.js` lines 141–148 — the exact site and pattern to extend, shown here as it exists TODAY, before this phase's edit):

```js
export const financeMcpHandlers = home => cacheKey => fromRegistry([
    ...casToolRegistry(home)(cacheKey),
    ...evoToolRegistry(evo(fileCas(sha256)(home))(cacheKey)),
    casRefreshTool(fileCas(sha256)(home))(cacheKey),
    financeSchemaTool,
    financeTaxParamsTool,
    fjsRunTool(home)(fileCas(sha256)(home))(evo(fileCas(sha256)(home))(cacheKey)),
])
```

RESEARCH.md's Q4 names exactly where the new line goes (between `financeTaxParamsTool` and `fjsRunTool`), reusing the SAME already-in-scope `evo(fileCas(sha256)(home))(cacheKey)` and `fileCas(sha256)(home)` expressions the surrounding lines already construct — do not re-derive them differently.

---

### `fjs/server/fjs_run/snapshot/module.f.js` (MODIFIED — DOC-15 fix + adversarial proofs)

**This file is its own analog** — the fix is surgical, in-place, against the existing `buildRunSnapshot`/`buildHostMap` shown in full above (module read in full: lines 1–357).

#### The exact gap, quoted (current shipped code, lines 148–158 — the two lines that must change)

```js
const withHeads = step(
    withSubjects,
    state => foldStep(
        pure([...state.activeSubjects, ...state.archivedSubjects]),   // BOTH sets folded together
        state,
        subject => s => step(
            evoApi.head(subject),
            headHashes => pure({ ...s, heads: { ...s.heads, [subject]: headHashes } }),
        ),
    ),
)
```

and, inside `withBlobsAndRevisions` (lines 106–137), the revision fold that has NO `archived` check at all on the decoded `RevisionData`:

```js
return step(
    evoApi.revision(hashStr),
    revResult => pure({
        ...state,
        blobs,
        revisions: revResult[0] === 'ok'
            ? { ...state.revisions, [hashStr]: jsonText(revResult[1]) }
            : state.revisions,
    }),
)
```

Per RESEARCH.md Q3's scoped fix: (1) `heads` must exclude any head hash whose OWN decoded revision carries `archived: true`; (2) `revisions` must exclude any hash whose decoded `RevisionData` carries `archived: true`. Both closures already have `revResult[1]` (the decoded `RevisionData`, which per Q3's quoted schema carries `archived: option(true)`) in scope at the exact point these two maps are built — the fix folds the flag into the SAME accumulator step, not a separate pass afterward.

#### 9 (repeated for #10). `buildRunSnapshotResolvesTheStore` — the seeding pattern EVERY new adversarial proof must follow (VERBATIM, lines 291–327)

```js
buildRunSnapshotResolvesTheStore: {
    blobsSubjectsHeadsAndRevisions: () => {
        const home = '/'
        const cas = fileCas(sha256)(home)
        const [state0, cacheKey] = virtual(emptyState)(initEvo(cas))
        // A plain (non-revision) document blob.
        const docText = '{"box1InterestIncome":"12.34"}'
        const docBytes = tryUtf8(docText)
        assert(docBytes !== null, 'expected the sample document to encode as UTF-8')
        const [state1, docWrite] = virtual(state0)(
            cas.write(pure({ first: ok(docBytes), tail: pure(undefined) })))
        assert(docWrite[0] === 'ok', ['expected the document write to succeed', docWrite])
        const docHash = vecToCBase32(docWrite[1])
        // A revision naming that document as its snapshot, for a fresh
        // subject — through evo.add, so both the store AND the cache end
        // up consistent with each other.
        const e = evo(cas)(cacheKey)
        const [state2, addResult] = virtual(state1)(
            e.add({ parents: [], subject: 'subjectS', snapshot: docHash }))
        assert(addResult[0] === 'ok', ['expected the revision add to succeed', addResult])
        const revisionHash = addResult[1]
        const [, snapshot] = virtual(state2)(buildRunSnapshot(cas)(e)(undefined))
        assertEq(snapshot.blobs[docHash], docText)
        assert(snapshot.blobs[revisionHash] !== undefined, 'expected the revision blob itself to be resolved')
        assert(snapshot.revisions[revisionHash] !== undefined, 'expected the revision to decode into revisions')
        assertEq(snapshot.revisions[docHash], undefined)
        assert(snapshot.activeSubjects.includes('subjectS'), snapshot.activeSubjects)
        assertEq(JSON.stringify(snapshot.heads['subjectS']), JSON.stringify([revisionHash]))
    },
    // ...pinOverridesTheResolvedHead follows the identical seeding shape...
},
```

**The new DOC-15 adversarial proof must extend this exact seeding pattern**: seed a subject with an ACTIVE head, then `e.add({ parents: [activeHead], subject: 'subjectS', archived: true })` (a NEW head superseding the active one, flagged archived — per RESEARCH.md's documented retraction call, `snapshot` omitted so it inherits the parent's own snapshot per `resolveSnapshot`'s single-parent rule), then build a `Report<T>` that explicitly calls `ctx.evoList('true')` → `ctx.evoHead` → `ctx.evoRevision` → `ctx.casRead` and assert the archived head/revision/snapshot are UNREACHABLE — i.e. `evoHead` returns `[]` for that subject (or omits the archived-only head) and `evoRevision` on the archived hash throws the existing bare-string `revision not found: ${hash}` (line 200), reusing the SAME `casReadOnAbsentHashThrowsAPlainString`-style assertion discipline (lines 273–283: assert `typeof thrown === 'string'`, assert NOT `instanceof Error`, assert the message names the hash) rather than a bare `throw: {...}` leaf (see the file's own `MERGE NOTE` at lines 263–272 warning against exactly that weakening).

**A gate needs a control** (AGENTS.md rule): pair the adversarial "archived is unreachable" leaf with the EXISTING legitimate case — an ACTIVE subject's head/revision/snapshot remain reachable exactly as `buildRunSnapshotResolvesTheStore` above already proves. Do not let the new archived-focused proof replace or narrow that existing coverage; it must keep passing unchanged (per the phase brief's "existing proofs that must stay green" instruction).

**Mutation-check requirement** (AGENTS.md, "a proof is not known to work until you have watched it fail"): after landing the fix, temporarily revert the `heads`/`revisions` filtering change and confirm the new adversarial proof goes RED. If it stays green, the proof is decoration.

---

### `fjs/server/finance_schema/module.f.js` (MODIFIED — dialectSchemas 5 -> 7)

**This file is its own analog** (full module read above, lines 1–227).

#### The registry to extend (VERBATIM, lines 65–71)

```js
const dialectSchemas = {
    [oneZeroNineNineIntDialect]: oneZeroNineNineIntSchema,
    [ocrDialect]: ocrSchema,
    [w2Dialect]: w2Schema,
    [medicalExpensesDialect]: medicalExpensesSchema,
    [returnProfileDialect]: returnProfileSchema,
}
```

Add two entries, importing `dialect as ssa1099Dialect, ssa1099Schema` and `dialect as oneZeroNineNineRDialect, oneZeroNineNineRSchema` from the two new dialect files, mirroring the existing import block (lines 44–48).

#### 9. The hand-typed dialect count guard — quoted, constant AND docstring (VERBATIM, lines 76–97)

```js
/**
 * Independently hand-typed: how many dialects {@link dialectSchemas} registers
 * today. Deliberately NOT `knownDialects.length`.
 *
 * `unknownDialectRefused` below loops over {@link knownDialects} asserting each
 * tag is named in the refusal message, and it is tempting to conclude that a
 * newly registered dialect is therefore covered "for free". **It is not.**
 * `knownDialects` is `Object.keys(dialectSchemas)` — the code under test — so
 * deleting an entry from the map deletes it from the loop's iteration set at
 * the same instant, and that proof stays green over a dialect that quietly
 * stopped being served. Verified by mutation: removing the
 * `vnd.fjs.return_profile` entry reddened `returnProfileResolves` alone, and
 * `unknownDialectRefused` passed.
 *
 * This is AGENTS.md's rule — "a proof's expected value must not be produced by
 * the code under test" — and the same `expectedThresholdCount` /
 * `expectedMoneyBoxFieldCount` idiom `fjs/tax/boundary` and
 * `fjs/document/1099int` already use. Raise it in the same commit that
 * registers a sixth dialect, and add that dialect's own `*Resolves` leaf.
 * @type {number}
 */
const expectedKnownDialectCount = 5
```

**Must become `7`** in this phase's commit, and the docstring's "sixth dialect" example generalizes unchanged — bump the number, keep the warning.

#### A `*Resolves` proof leaf per new dialect (VERBATIM pattern, lines 161–200)

```js
oneZeroNineNineIntResolves: () => {
    const result = call('vnd.fjs.1099int')
    assertEq(result.isError, undefined)
    assertEq(
        JSON.stringify(JSON.parse(textOf(result))),
        JSON.stringify(toJsonSchema(oneZeroNineNineIntSchema)),
    )
},
```

Add `oneZeroNineNineRResolves` and `ssa1099Resolves`, each comparing the tool's actual output against `toJsonSchema(<newSchema>)` called DIRECTLY — never a hand-written JSON literal (that would reintroduce the second-source-of-truth MCP-06 exists to eliminate, per this file's own header lines 9–24).

The `unknownDialectRefused` leaf (lines 203–211) needs NO change — it already loops over `knownDialects`, which will include the two new tags automatically once `dialectSchemas` is extended. Only `everyRegisteredDialectIsCounted`'s hand-typed expectation (lines 215–225) needs the literal bump.

---

### `fjs/server/module.f.js` (MODIFIED — compose the new tool)

Extend `financeMcpHandlers` (VERBATIM current state, lines 141–148, quoted above in the `finance_documents_list` section) by inserting the new tool's construction between `financeTaxParamsTool` and `fjsRunTool`, per RESEARCH.md Q4's exact placement recommendation. Import the new module's export the same way `financeSchemaTool`/`financeTaxParamsTool` are already imported (lines 75–76):

```js
import { financeSchemaTool } from './finance_schema/module.f.js'
import { financeTaxParamsTool } from './finance_tax_params/module.f.js'
```

Add `import { financeDocumentsListTool } from './finance_documents_list/module.f.js'` alongside them. Also extend `proof.session.toolsListEnumeratesComposedRegistry` (lines 369–378) with a `tools.some(t => t.name === 'finance_documents_list')` assertion, mirroring the existing `finance_schema`/`finance_tax_params` assertions on the same lines — this is the in-process (virtual) half of registry coverage; the real-process half is `fjs-run-integration.test.js` below.

---

### `fjs-run-integration.test.js` (MODIFIED — same-commit registry coverage, TEST-03)

**Analog: this file's own `finance_tax_params` call block** (VERBATIM, lines 293–305):

```js
// MCP-07: an agent reads TY2025's parameters through a real tool
// call rather than recalling them — the decisive reachability
// proof 08-VALIDATION.md (T-08-04) requires alongside the
// financeMcpHandlers registry entry, in this SAME real session.
const taxParamsResponse = await call('finance_tax_params', { year: 2025 })
assert.ok(!taxParamsResponse.result.isError, `finance_tax_params failed: ${JSON.stringify(taxParamsResponse)}`)
assert.ok(
    taxParamsResponse.result.content[0].text.includes(...),
    'expected the finance_tax_params response to name ...')
```

Add a structurally identical block calling `finance_documents_list` (with `{}` or `{ archived: true }`), asserting `!response.result.isError` and something concrete about the response shape (e.g. it parses as a JSON array, or it includes one of the subjects/hashes already seeded earlier in the same test — `subjectA`/`docAHash` etc. are already in scope at that point in the file, lines 268 onward).

**The `call` helper already auto-tracks this** (VERBATIM, lines 197–203):

```js
const toolsCalled = new Set()
const call = async (name, args) => {
    const id = nextId()
    send({ jsonrpc: '2.0', method: 'tools/call', id, params: { name, arguments: args } })
    toolsCalled.add(name)
    return waitForId(id)
}
```

So calling `call('finance_documents_list', {...})` anywhere in the test body is sufficient — no separate registration step needed in THIS file. The hard ordering constraint (VERBATIM, lines 489–492):

```js
assert.deepEqual(
    [...toolsCalled].sort().join(','),
    [...advertisedTools].sort().join(','),
    `called=[${[...toolsCalled].sort()}] advertised=[${[...advertisedTools].sort()}]`)
```

means: the moment `financeMcpHandlers` (in `fjs/server/module.f.js`) advertises `finance_documents_list` via `tools/list`, THIS assertion fails immediately unless this same test file also calls it. **Both edits — the registry entry in `fjs/server/module.f.js` and this test's new `call('finance_documents_list', ...)` — must land in the SAME commit.** This is not a style preference; it is the literal mechanism Phase 08-04 already exercised for `finance_tax_params` (RESEARCH.md Q4, "The same-commit ordering constraint").

---

## Shared Patterns

### Money-as-decimal-string + exactness check
**Source:** `fjs/document/money_field/module.f.js` (`moneyFieldError`)
**Apply to:** every money box in both new dialects, scalar and array-nested alike. Never apply to a percentage box.

### `option(...)` for every printed box; `option(true)` for every checkbox
**Source:** `fjs/document/w2/module.f.js`, `fjs/document/1099int/module.f.js` (schema declarations)
**Apply to:** every field in both new dialects with no exception — DOC-11/DOC-12.

### Conditional spread discipline
**Source:** `fjs/document/1099int/from_ocr/module.f.js` lines 120–131
**Apply to:** `finance_documents_list`'s response-entry assembly (`taxYear` may be `undefined` for a genuinely unknown blob) and any future `convert`-style function touching either new dialect.

### Generated-proof-from-list + independently-hand-typed-count
**Source:** `fjs/document/w2/module.f.js` (`moneyBoxFields`/`expectedMoneyBoxFieldCount`, `stateLocalMoneyFields`/`expectedStateLocalMoneyFieldCount`), `fjs/tax/boundary/module.f.js` (`allThresholds`/`expectedThresholdCount`), `fjs/server/finance_schema/module.f.js` (`knownDialects`/`expectedKnownDialectCount`)
**Apply to:** both new dialects' money-box exactness proofs, AND `finance_schema`'s bumped dialect count.

### `toolEntry` construction + `errorResult` refusal, never a throw
**Source:** `fjs/server/finance_schema/module.f.js`, `fjs/server/finance_tax_params/module.f.js`
**Apply to:** `finance_documents_list`.

### Nested `step`/`foldStep` accumulator fold over an effectful loop
**Source:** `fjs/server/fjs_run/snapshot/module.f.js`'s `buildRunSnapshot` (the `withBlobsAndRevisions`/`withHeads` chain)
**Apply to:** `finance_documents_list`'s subject-by-subject resolution loop, in preference to RESEARCH.md's own "illustrative, not literal" `financeDocumentsListTool` sketch.

### Real-store seeding under `fjs/effects/node/virtual` via `evo.add`
**Source:** `fjs/server/fjs_run/snapshot/module.f.js`'s `buildRunSnapshotResolvesTheStore`
**Apply to:** the new DOC-15 adversarial archived-visibility proof in the same file.

### Same-commit registry + integration-test ordering (TEST-03)
**Source:** `fjs/server/module.f.js` (`financeMcpHandlers`) + `fjs-run-integration.test.js`'s `finance_tax_params` precedent
**Apply to:** `finance_documents_list`'s registration.

## No Analog Found

None. Every file in this phase's list has a strong, previously-shipped analog in this codebase; RESEARCH.md independently confirms no new library or architectural pattern is required.

## Metadata

**Analog search scope:** `fjs/document/`, `fjs/server/`, `fjs/server/fjs_run/`, `fjs-run-integration.test.js`, `fjs/tax/boundary/module.f.js` (for the generated-proof idiom's second precedent)
**Files read in full:** `fjs/document/1099int/module.f.js`, `fjs/document/w2/module.f.js`, `fjs/document/base/module.f.js`, `fjs/document/money_field/module.f.js`, `fjs/document/1099int/from_ocr/module.f.js` (partial, conditional-spread section), `fjs/server/finance_schema/module.f.js`, `fjs/server/finance_tax_params/module.f.js`, `fjs/server/fjs_run/snapshot/module.f.js`, `fjs/server/module.f.js`, `fjs-run-integration.test.js` (partial, relevant sections), `fjs/tax/boundary/module.f.js` (partial)
**Pattern extraction date:** 2026-08-07
