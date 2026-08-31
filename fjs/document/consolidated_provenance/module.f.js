/**
 * DOC-13's N-subjects/one-provenance property, proved against the two REAL
 * dialects this phase ships — `vnd.fjs.1099div` and `vnd.fjs.1099b` — not a
 * synthetic stand-in.
 *
 * **This module is PROOF-ONLY.** It exports `proof` and NOTHING else: no
 * dialect, no schema, no production function. Per 12-CONTEXT.md's own
 * boundary ("DOC-13 is modeling and subject derivation ONLY... no new
 * ingestion wiring"), no production code belongs here — this file exists
 * solely to exercise `formSubject` (already dialect-independent and already
 * proven; `fjs/document/subject/module.f.js`'s own docstring: "later dialect
 * modules depend on this one, never the reverse") against the two real
 * dialects, not to add a new mechanism.
 *
 * ## The property, and why Evo's `parents` cannot carry it (12-RESEARCH.md Q3)
 *
 * One consolidated brokerage statement (one scanned PDF, one `sourceArtifactHash`)
 * yields TWO separate extracted forms — a 1099-DIV section and a 1099-B
 * section — each its OWN Evo subject, because `formSubject`'s key includes
 * `formType` and these two forms have different `formType` values (their own
 * `dialect` tags). Both forms nonetheless share the SAME originating artifact.
 *
 * Evo's `parents` mechanism cannot record that shared origin: `validateParentSubjects`
 * (`node_modules/functionalscript/fjs/cas/evo/module.f.mjs`, ~lines 226-239)
 * rejects a parent whose subject differs from the child's own subject — it is
 * built to link revisions of ONE subject's history, not to cross-reference two
 * DIFFERENT subjects. That is why `sourceArtifactHash` is a plain data field on
 * the two new dialects (DOC-13's actual mechanism), not an Evo-level
 * cross-subject link.
 *
 * `formSubject`'s existing key already yields N distinct subjects for one
 * consolidated artifact with ZERO code changes to `fjs/document/subject`
 * (12-RESEARCH.md Q3) — this module proves that claim against the two real
 * dialects, plus proves the shared-hash half of DOC-13's property, plus a
 * control proving the equality check is non-vacuous (a genuinely different
 * hash on a third instance is NOT equal to the shared one).
 *
 * @module
 */
import { assertEq, assert } from 'functionalscript/fjs/asserts/module.f.mjs'
import { formSubject } from '../subject/module.f.js'
import {
    dialect as oneZeroNineNineDivDialect,
    validate as validateOneZeroNineNineDiv,
} from '../1099div/module.f.js'
import {
    dialect as oneZeroNineNineBDialect,
    validate as validateOneZeroNineNineB,
} from '../1099b/module.f.js'

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * The key fields shared by BOTH extracted forms of ONE consolidated
 * brokerage statement — same payer, same recipient, same account, same tax
 * year. Only `formType` (each dialect's own tag) differs between the two
 * forms' subjects.
 */
const sharedKeyFields = /** @type {const} */ ({
    payerTin: '11-1111111',
    recipientTin: '222-22-2222',
    accountNumber: 'ACC-CONSOLIDATED-01',
    taxYear: 2025,
})

/**
 * The shared `sourceArtifactHash` literal — the SAME literal
 * `fjs/document/1099div/module.f.js` and `fjs/document/1099b/module.f.js`
 * reuse in their own fixtures, so the "shared provenance" assertion below is
 * a plain `===` on identical strings, not a coincidence to explain. Typed as
 * plain `string` (not preserved as a literal type) so the inequality check
 * against {@link differentSourceArtifactHash} below is a genuine runtime
 * comparison `tsc` cannot pre-resolve to a compile-time `false`.
 * @type {string}
 */
const sharedSourceArtifactHash = 'deadbeef00112233445566778899aabbccddeeff0011223344556677889900'

/**
 * A DIFFERENT, independently valid cBase32 hash — used ONLY by
 * `differentArtifactsDoNotShareProvenance` below as a control, never as a
 * fixture claiming shared provenance. Confirmed to decode via `isHash`
 * (verified live: both `sharedSourceArtifactHash` and this literal pass
 * `functionalscript/fjs/media/revision/module.f.mjs`'s `isHash`; `'not-a-hash'`
 * — the shape either dialect's own `sourceArtifactHashRejectedWhenNotAHash`
 * leaf exercises — does not).
 * @type {string}
 */
const differentSourceArtifactHash = '0000111122223333444455556666777788889999aaaabbbbccccddddeeeeff'

export const proof = {
    // The core DOC-13 property: one consolidated artifact's two extracted
    // forms resolve to two DISTINCT Evo subjects, while sharing one recorded
    // sourceArtifactHash. Both halves live in ONE leaf so the property reads
    // as a single fact, not two disconnected checks.
    oneArtifactYieldsTwoSubjectsSharingProvenance: () => {
        const [tDiv, divInstance] = validateOneZeroNineNineDiv({
            dialect: oneZeroNineNineDivDialect,
            ...sharedKeyFields,
            formRevision: '2024',
            sourceArtifactHash: sharedSourceArtifactHash,
        })
        assert(tDiv === 'ok', ['expected the 1099-DIV section to validate', tDiv, divInstance])

        const [tB, bInstance] = validateOneZeroNineNineB({
            dialect: oneZeroNineNineBDialect,
            ...sharedKeyFields,
            formRevision: '2025',
            sourceArtifactHash: sharedSourceArtifactHash,
        })
        assert(tB === 'ok', ['expected the 1099-B section to validate', tB, bInstance])
        if (tDiv !== 'ok' || tB !== 'ok') {
            throw ['expected both sections to validate ok', tDiv, tB]
        }

        // Two distinct Evo subjects for the SAME artifact — because
        // formType (each dialect's own tag) is part of formSubject's key.
        const divSubject = formSubject({ ...sharedKeyFields, formType: oneZeroNineNineDivDialect })
        const bSubject = formSubject({ ...sharedKeyFields, formType: oneZeroNineNineBDialect })
        assertEq(divSubject !== bSubject, true, ['expected two distinct form subjects', divSubject, bSubject])

        // One shared, recorded provenance hash across those two distinct
        // subjects — the property DOC-13 requires.
        assertEq(
            divInstance.sourceArtifactHash,
            bInstance.sourceArtifactHash,
            ['expected the two sections to share one recorded sourceArtifactHash', divInstance, bInstance],
        )
    },
    // Control: a third validated instance carrying a genuinely DIFFERENT
    // sourceArtifactHash does NOT equal the shared literal — proving the
    // equality assertion above is checking something real. Two fixtures
    // that both defaulted to the same value would pass that assertion
    // vacuously; this leaf is able to fail if the two literals were
    // accidentally identical.
    differentArtifactsDoNotShareProvenance: () => {
        const [t, thirdInstance] = validateOneZeroNineNineDiv({
            dialect: oneZeroNineNineDivDialect,
            ...sharedKeyFields,
            accountNumber: 'ACC-UNRELATED-02',
            formRevision: '2024',
            sourceArtifactHash: differentSourceArtifactHash,
        })
        assert(t === 'ok', ['expected the unrelated instance to validate', t, thirdInstance])
        assertEq(sharedSourceArtifactHash === differentSourceArtifactHash, false)
        assertEq(
            thirdInstance.sourceArtifactHash === sharedSourceArtifactHash,
            false,
            ['expected an unrelated artifact NOT to share the consolidated statement\'s hash', thirdInstance],
        )
    },
}
