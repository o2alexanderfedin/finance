/**
 * **EXEC-13** and **PROV-04**: the provenance header's own module.
 *
 * PROV-04 names three distinct things a report's provenance must carry: the
 * tax year, a parameter-set hash, and a program hash. This module supplies
 * the parameter-set hash ({@link paramSetHash}) and the "reviewed estimate"
 * framing constant ({@link reviewedEstimateFraming}) that PROV-04's envelope
 * carries verbatim, plus EXEC-13's one remaining gap: a named, consumer-side
 * predicate for "only pinned runs count toward reproducibility acceptance"
 * ({@link countsTowardReproducibilityAcceptance}).
 *
 * ## Where this fits
 *
 * `fjs/report/` holds `line` (`fjs/report/line/module.f.js`, the
 * traceability type), `audit` (`fjs/report/audit/module.f.js`, the REPORTED
 * numeric-literal count), `guard` (`fjs/report/guard/module.f.js`, the
 * zero-read kill condition), `amend` (`fjs/report/amend/module.f.js`,
 * PROV-06's diff), `payer`, and this module — the PROV-04 provenance header,
 * `paramSetHash`, and EXEC-13's acceptance predicate.
 *
 * ## `programHash` vs `paramSetHash` — the Q2 distinction, restated
 *
 * `fjs/report/amend/module.f.js` already established that `programHash`
 * equality implies parameter-set equality FOR THE GUEST-PROGRAM PATH: a
 * guest program cannot `import` anything, and `guestCtx` exposes no
 * tax-parameter lookup, so every dollar figure such a program consults is a
 * literal baked into that program's own source text — text the CAS hash
 * already covers. Two runs with equal `programHash` are, by construction,
 * two runs of byte-identical source, including whatever parameters it
 * embedded. That finding is not contradicted here.
 *
 * `paramSetHash` names a DIFFERENT fact: the parameter set the HOST ENGINE —
 * `fjs/form1040/core`'s `form1040Report` — was handed when a report was
 * actually produced. A guest program's baked-in literals and the host
 * engine's own parameter set are two separate inputs to two separate
 * computations; `programHash` covers the first, `paramSetHash` covers the
 * second, and neither is redundant with the other.
 *
 * @module
 */
import { tryUtf8 } from 'functionalscript/fjs/text/module.f.js'
import { computeSync, sha256 } from 'functionalscript/fjs/crypto/sha2/module.f.js'
import { cBase32ToVec, vecToCBase32 } from 'functionalscript/fjs/basen/cbase32/module.f.js'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { stringify as jsonText } from '../../json/module.f.js'
import { fileCas } from 'functionalscript/fjs/cas/module.f.js'
import { pure } from 'functionalscript/fjs/effects/module.f.js'
import { emptyState, virtual } from 'functionalscript/fjs/effects/node/virtual/module.f.js'
import { ok } from 'functionalscript/fjs/types/result/module.f.js'
import { dialect as runDialect } from '../../run/module.f.js'

/** @import { TaxParamSet } from '../../tax/params/module.f.js' */
/** @import { Run } from '../../run/module.f.js' */

// ── PROV-04: paramSetHash and the reviewed-estimate framing ─────────────────

/**
 * PROV-04's parameter-set fingerprint: a content hash over the canonical
 * JSON serialization of a `TaxParamSet`, computed host-side. Reuses the
 * SAME one-shot SHA-256 primitive `fileCas` calls internally, without ever
 * performing a `cas.write` — nothing here needs to be retrievable by this
 * hash, only stable. `matchesFileCassOwnHashOfTheIdenticalBytes` below
 * cross-checks this is genuinely the same content-addressing primitive CAS
 * itself uses, not an independently invented, hand-written format.
 * @type {(taxParamSet: TaxParamSet) => string}
 */
export const paramSetHash = taxParamSet => {
    const bytes = tryUtf8(jsonText(taxParamSet))
    assert(bytes !== null, ['expected the canonical parameter-set text to encode as UTF-8', taxParamSet])
    return vecToCBase32(computeSync(sha256)([bytes]))
}

/**
 * PROV-04's "reviewed estimate" framing: carried in the provenance envelope
 * verbatim, never paraphrased or duplicated in prose.
 */
export const reviewedEstimateFraming = 'reviewed estimate — check against the source documents before filing'

// ── EXEC-13: the consumer-side acceptance predicate ─────────────────────────

/**
 * EXEC-13's consumer-side acceptance predicate: "Only pinned runs count
 * toward reproducibility acceptance." `Run`'s own `checkReferences`
 * (`fjs/run/module.f.js`) already enforces the both-or-neither invariant
 * between `pinned` and `subject`/`parents`, so this function reads `pinned`
 * alone and must never re-implement that check.
 * @type {(run: Run) => boolean}
 */
export const countsTowardReproducibilityAcceptance = run => run.pinned

// ── Tests ────────────────────────────────────────────────────────────────────

// `paramSetHash` is generic over any `TaxParamSet` — production code above
// never imports `taxParamsByYear`. This import exists in the Tests section
// only, to get a real fixture to hash.
import { taxParamsByYear } from '../../tax/params/module.f.js'

/**
 * TY2025's parameter set, narrowed exactly ONCE at module scope — the same
 * idiom `fjs/server/finance_tax_params/module.f.js:86-87` uses byte for
 * byte. Every leaf below uses this constant, never a second direct index
 * into `taxParamsByYear`.
 */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/** TEST-FIXTURE ONLY. A minimal, valid, UNPINNED `Run`-shaped literal. @type {Run} */
const unpinnedRun = {
    dialect: runDialect,
    programHash: 'sha256-program1',
    args: [],
    pinned: false,
    status: 'ok',
    inputs: [],
    resultHash: 'sha256-result1',
}

/**
 * TEST-FIXTURE ONLY. The same shape, but PINNED with both `subject` and
 * `parents` present — valid under `checkReferences`'s own both-or-neither
 * rule, never an invalid pinned fixture.
 * @type {Run}
 */
const pinnedRun = {
    ...unpinnedRun,
    pinned: true,
    subject: 'form:1099int:11-1111111:222-22-2222:ACC-0001:2024',
    parents: ['sha256-parent1'],
}

export const proof = {
    paramSetHash: {
        // Called twice on the same input, same output.
        deterministicForTheSameInput: () => {
            assertEq(paramSetHash(taxParams2025), paramSetHash(taxParams2025))
        },
        // T-19-01-01's sensitivity half: mutating one nested leaf field
        // changes the hash. A THREE-LEVEL spread isolates the mutated
        // field, so every sibling (agedOrBlindAdditional, ordinaryBrackets,
        // etc.) still shares the original reference rather than being
        // shallow-copied and reassigned — safe because nothing here mutates
        // them, and it never corrupts the real imported singleton other
        // leaves depend on.
        sensitiveToTheParameterSetsContent: () => {
            const mutated = {
                ...taxParams2025,
                standardDeduction: {
                    ...taxParams2025.standardDeduction,
                    single: { ...taxParams2025.standardDeduction.single, amount: '999999.00' },
                },
            }
            assert(
                paramSetHash(taxParams2025) !== paramSetHash(mutated),
                'expected a content-sensitive hash to change when the parameter set changes',
            )
        },
        // A real cBase32-encoded hash, not an arbitrary string.
        producesADecodableHash: () => {
            const hash = paramSetHash(taxParams2025)
            assert(cBase32ToVec(hash) !== null, ['expected a decodable cBase32 hash', hash])
        },
        // T-19-01-01's independent cross-check: seed the SAME bytes through
        // a real fileCas(sha256)(home) write, and assert the CAS content
        // hash of that write equals paramSetHash's own output — a
        // DIFFERENT code path computing the same primitive, not a
        // hand-typed literal that could encode the same bug twice.
        matchesFileCassOwnHashOfTheIdenticalBytes: () => {
            const home = '/report/provenance/param-set-hash-cas-cross-check'
            const cas = fileCas(sha256)(home)
            const bytes = tryUtf8(jsonText(taxParams2025))
            assert(bytes !== null, ['expected the canonical parameter-set text to encode as UTF-8', taxParams2025])
            const [, write] = virtual(emptyState)(cas.write(pure({ first: ok(bytes), tail: pure(undefined) })))
            assert(write[0] === 'ok', ['expected the CAS write to succeed', write])
            assertEq(vecToCBase32(write[1]), paramSetHash(taxParams2025))
        },
    },

    // Pins the em dash and exact wording so a future edit cannot silently
    // paraphrase it.
    reviewedEstimateFraming: () => {
        assertEq(reviewedEstimateFraming, 'reviewed estimate — check against the source documents before filing')
    },

    countsTowardReproducibilityAcceptance: {
        rejectsAnUnpinnedRun: () => {
            assertEq(countsTowardReproducibilityAcceptance(unpinnedRun), false)
        },
        acceptsAPinnedRun: () => {
            assertEq(countsTowardReproducibilityAcceptance(pinnedRun), true)
        },
    },
}
