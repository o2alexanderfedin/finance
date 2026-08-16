/**
 * `fjs/media/dialects` — DOC-16's local adoption of the dialect registry
 * `functionalscript/fjs/media/module.f.js` already ships, at the pinned
 * `functionalscript@0.43.1`: `dialectEntry(type, extraValidate)` and
 * `detect(dialects)(bytes)`, "a list of dialect decoders that falls through
 * when none match" — DOC-16's own criterion verbatim.
 *
 * **This is LOCAL ADOPTION ONLY.** The capability already exists upstream;
 * nothing in `dialectEntry`/`detect` is reimplemented here, and no PR
 * against `functionalscript` is filed or needed
 * (15-CONTEXT.md's "DOC-16 is local adoption only" decision). This module's
 * one job is registering every one of THIS repo's own dialects with that
 * already-shipped machinery, exactly as `fjs/media/revision`'s own
 * `revisionDialect` already does upstream:
 *
 * ```javascript
 * // node_modules/functionalscript/fjs/media/revision/module.f.js, verbatim
 * import { dialectEntry } from '../module.f.js'
 * const isValidRevision = (r) => { const [tag] = checkReferences(r); return tag === 'ok' }
 * export const revisionDialect = dialectEntry(revisionSchema, isValidRevision)
 * ```
 *
 * Every finance document dialect module already exports a `schema` object
 * with a direct string `dialect` member (spread first, via `base()`) and a
 * `checkReferences` returning `Result<T, ...Error>` — the exact shape
 * `dialectEntry` requires, the identical shape `revisionSchema`/
 * `checkReferences` above has. Each is wrapped here the same one-line way:
 * `dialectEntry(schema, v => checkReferences(v)[0] === 'ok')`.
 *
 * `fjs/document/ocr` is the ONE exception: it has no `checkReferences` at
 * all (structural-only — see its own module header), so it registers with
 * `dialectEntry`'s own documented default: no second argument, structural
 * (rtti) match alone.
 *
 * `financeDialects` carries SIXTEEN entries: the fifteen local dialects
 * below, plus `revisionDialect`, reused unchanged from upstream — not
 * reconstructed locally, since `fjs/media/revision` already IS one of this
 * repo's dialects (`vnd.fjs.revision` blobs are written directly into the
 * CAS store — see `fjs/server/module.f.js`'s `casRefresh.*` proofs).
 *
 * @module
 */
import { dialectEntry, detect } from 'functionalscript/fjs/media/module.f.js'
import { dialect as revisionDialectTag, revisionDialect } from 'functionalscript/fjs/media/revision/module.f.js'
import { vecToCBase32 } from 'functionalscript/fjs/basen/cbase32/module.f.js'
import { vec8 } from 'functionalscript/fjs/types/bit_vec/module.f.js'
import { tryUtf8 } from 'functionalscript/fjs/text/module.f.js'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import {
    dialect as oneZeroNineNineBDialect,
    oneZeroNineNineBSchema,
    checkReferences as checkOneZeroNineNineB,
} from '../../document/1099b/module.f.js'
import {
    dialect as oneZeroNineNineDivDialect,
    oneZeroNineNineDivSchema,
    checkReferences as checkOneZeroNineNineDiv,
} from '../../document/1099div/module.f.js'
import {
    dialect as oneZeroNineNineIntDialect,
    oneZeroNineNineIntSchema,
    checkReferences as checkOneZeroNineNineInt,
} from '../../document/1099int/module.f.js'
import {
    dialect as oneZeroNineNineRDialect,
    oneZeroNineNineRSchema,
    checkReferences as checkOneZeroNineNineR,
} from '../../document/1099r/module.f.js'
import {
    dialect as itemizedDeductionsDialect,
    itemizedDeductionsSchema,
    checkReferences as checkItemizedDeductions,
} from '../../document/itemized_deductions/module.f.js'
import {
    dialect as medicalExpensesDialect,
    medicalExpensesSchema,
    checkReferences as checkMedicalExpenses,
} from '../../document/medical_expenses/module.f.js'
import {
    dialect as ocrDialect,
    ocrSchema,
} from '../../document/ocr/module.f.js'
import {
    dialect as ssa1099Dialect,
    ssa1099Schema,
    checkReferences as checkSsa1099,
} from '../../document/ssa1099/module.f.js'
import {
    dialect as oneZeroNineNineGDialect,
    oneZeroNineNineGSchema,
    checkReferences as checkOneZeroNineNineG,
} from '../../document/1099g/module.f.js'
import {
    dialect as w2Dialect,
    w2Schema,
    checkReferences as checkW2,
} from '../../document/w2/module.f.js'
import {
    dialect as runDialect,
    runSchema,
    checkReferences as checkRun,
} from '../../run/module.f.js'
import {
    dialect as returnProfileDialect,
    returnProfileSchema,
    checkReferences as checkReturnProfile,
} from '../../return/profile/module.f.js'
import {
    dialect as priorYearCapitalLossDialect,
    priorYearCapitalLossSchema,
    checkReferences as checkPriorYearCapitalLoss,
} from '../../document/prior_year_capital_loss/module.f.js'
import {
    dialect as adjustmentsDialect,
    adjustmentsSchema,
    checkReferences as checkAdjustments,
} from '../../document/adjustments/module.f.js'
import {
    dialect as oneZeroNineEightEDialect,
    oneZeroNineEightESchema,
    checkReferences as checkOneZeroNineEightE,
} from '../../document/1098e/module.f.js'
import {
    dialect as oneZeroNineEightTDialect,
    oneZeroNineEightTSchema,
    checkReferences as checkOneZeroNineEightT,
} from '../../document/1098t/module.f.js'
import {
    dialect as creditsDialect,
    creditsSchema,
    checkReferences as checkCredits,
} from '../../document/credits/module.f.js'

/** @import { DialectEntry } from 'functionalscript/fjs/media/module.f.js' */

/**
 * Every one of this repo's own dialects, registered for {@link detect}: the
 * seventeen local finance document/return/run dialects wrapped via
 * {@link dialectEntry}, plus upstream's own {@link revisionDialect} reused
 * unchanged. See this module's own docstring for why `ocr` is the one entry
 * with no `extraValidate` second argument.
 * @type {readonly DialectEntry[]}
 */
export const financeDialects = [
    dialectEntry(oneZeroNineNineBSchema, v => checkOneZeroNineNineB(v)[0] === 'ok'),
    dialectEntry(oneZeroNineNineDivSchema, v => checkOneZeroNineNineDiv(v)[0] === 'ok'),
    dialectEntry(oneZeroNineNineIntSchema, v => checkOneZeroNineNineInt(v)[0] === 'ok'),
    dialectEntry(oneZeroNineNineRSchema, v => checkOneZeroNineNineR(v)[0] === 'ok'),
    dialectEntry(itemizedDeductionsSchema, v => checkItemizedDeductions(v)[0] === 'ok'),
    dialectEntry(medicalExpensesSchema, v => checkMedicalExpenses(v)[0] === 'ok'),
    dialectEntry(ocrSchema),
    dialectEntry(ssa1099Schema, v => checkSsa1099(v)[0] === 'ok'),
    dialectEntry(oneZeroNineNineGSchema, v => checkOneZeroNineNineG(v)[0] === 'ok'),
    dialectEntry(w2Schema, v => checkW2(v)[0] === 'ok'),
    dialectEntry(runSchema, v => checkRun(v)[0] === 'ok'),
    dialectEntry(returnProfileSchema, v => checkReturnProfile(v)[0] === 'ok'),
    dialectEntry(priorYearCapitalLossSchema, v => checkPriorYearCapitalLoss(v)[0] === 'ok'),
    dialectEntry(adjustmentsSchema, v => checkAdjustments(v)[0] === 'ok'),
    dialectEntry(oneZeroNineEightESchema, v => checkOneZeroNineEightE(v)[0] === 'ok'),
    dialectEntry(oneZeroNineEightTSchema, v => checkOneZeroNineEightT(v)[0] === 'ok'),
    dialectEntry(creditsSchema, v => checkCredits(v)[0] === 'ok'),
    revisionDialect,
]

/**
 * `detect`, closed over {@link financeDialects} — the one function
 * `fjs/server/module.f.js`'s `cas_refresh` calls to classify a raw CAS blob
 * against every dialect this repo knows about.
 * @type {(bytes: import('functionalscript/fjs/types/bit_vec/module.f.js').Vec) => import('functionalscript/fjs/media/type/module.f.js').DetectMeta}
 */
export const detectFinance = detect(financeDialects)

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * Independently hand-typed: the number of entries {@link financeDialects}
 * is expected to carry today — seventeen local dialects plus
 * {@link revisionDialect}. Deliberately NOT derived from
 * `financeDialects.length` itself (AGENTS.md's hand-typed-count idiom,
 * mirroring `fjs/document/1099b`'s `expectedMoneyBoxFieldCount`): a dialect
 * silently dropped from the array above would otherwise still pass every
 * generated per-dialect leaf below while genuinely losing coverage, exactly
 * the Phase 10 defect AGENTS.md records ("a proof that iterates over a
 * collection derived from the thing it is testing can never notice that
 * collection shrinking").
 * @type {number}
 */
const expectedDialectCount = 18

/** A sample cbase32 hash — {@link revisionDialect}'s own `snapshot`/`parents` shape needs a decodable one; the value itself is arbitrary. */
const revisionSampleHash = vecToCBase32(vec8(0x77n))

/**
 * One minimal, independently hand-typed valid fixture per registered
 * dialect, keyed by the dialect's own tag string (imported from that
 * dialect's OWN module, never read back off {@link financeDialects} —
 * the same independence discipline as {@link expectedDialectCount}).
 * Every fixture below either mirrors, or is drawn directly from, that
 * dialect's own module-level `minimal` proof fixture, so this registry's
 * proof is checked against the SAME already-independently-verified
 * instances those modules ship, not a fresh guess.
 * @type {{ readonly [dialect: string]: Readonly<Record<string, unknown>> }}
 */
const fixtures = {
    [oneZeroNineNineBDialect]: {
        dialect: oneZeroNineNineBDialect,
        payerTin: '11-1111111',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-0001',
        taxYear: 2025,
        formRevision: '2025',
        sourceArtifactHash: 'deadbeef00112233445566778899aabbccddeeff0011223344556677889900',
    },
    [oneZeroNineNineDivDialect]: {
        dialect: oneZeroNineNineDivDialect,
        payerTin: '11-1111111',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-0001',
        taxYear: 2025,
        formRevision: '2025',
        sourceArtifactHash: 'deadbeef00112233445566778899aabbccddeeff0011223344556677889900',
    },
    [oneZeroNineNineIntDialect]: {
        dialect: oneZeroNineNineIntDialect,
        payerTin: '11-1111111',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-0001',
        taxYear: 2024,
        formRevision: '2024',
    },
    [oneZeroNineNineRDialect]: {
        dialect: oneZeroNineNineRDialect,
        payerTin: '11-1111111',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-0001',
        taxYear: 2025,
        formRevision: '2025',
    },
    [itemizedDeductionsDialect]: {
        dialect: itemizedDeductionsDialect,
        recipientTin: '222-22-2222',
        taxYear: 2025,
        entries: [],
    },
    [medicalExpensesDialect]: {
        dialect: medicalExpensesDialect,
        recipientTin: '222-22-2222',
        taxYear: 2025,
        entries: [],
    },
    [ocrDialect]: {
        dialect: ocrDialect,
        pages: [],
        fields: {},
    },
    [ssa1099Dialect]: {
        dialect: ssa1099Dialect,
        payerTin: '',
        recipientTin: '222-22-2222',
        accountNumber: 'CLAIM-0001',
        taxYear: 2025,
        formRevision: '2025',
    },
    [oneZeroNineNineGDialect]: {
        dialect: oneZeroNineNineGDialect,
        payerTin: '11-1111111',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-0001',
        taxYear: 2025,
        formRevision: '2025',
        box1UnemploymentCompensation: '4554.00',
        box4FederalIncomeTaxWithheld: '454.00',
    },
    [w2Dialect]: {
        dialect: w2Dialect,
        payerTin: '11-1111111',
        recipientTin: '222-22-2222',
        accountNumber: '',
        taxYear: 2025,
        formRevision: '2025',
    },
    [runDialect]: {
        dialect: runDialect,
        programHash: 'sha256-program1',
        args: [],
        taxYear: 2025,
        paramSetHash: 'sha256-paramset1',
        pinned: false,
        status: 'ok',
        inputs: [],
        resultHash: 'sha256-result1',
    },
    [returnProfileDialect]: {
        dialect: returnProfileDialect,
        taxYear: 2025,
        filingStatus: 'single',
        dependentCount: 0,
        declaredKinds: [],
    },
    [priorYearCapitalLossDialect]: {
        dialect: priorYearCapitalLossDialect,
        recipientTin: '222-22-2222',
        taxYear: 2024,
        priorYearFormLine15: '20000.00',
        priorYearScheduleDLine7: '-10000.00',
        priorYearScheduleDLine15: '1000.00',
        priorYearScheduleDLine21: '-3000.00',
    },
    [adjustmentsDialect]: {
        dialect: adjustmentsDialect,
        recipientTin: '222-22-2222',
        taxYear: 2025,
        entries: [],
    },
    [oneZeroNineEightEDialect]: {
        dialect: oneZeroNineEightEDialect,
        payerTin: '11-1111111',
        recipientTin: '222-22-2222',
        accountNumber: 'LOAN-0001',
        taxYear: 2025,
        formRevision: '2025',
    },
    [oneZeroNineEightTDialect]: {
        dialect: oneZeroNineEightTDialect,
        payerTin: '11-1111111',
        recipientTin: '333-33-3333',
        accountNumber: 'STU-0001',
        taxYear: 2025,
        formRevision: '2025',
    },
    [creditsDialect]: {
        dialect: creditsDialect,
        recipientTin: '222-22-2222',
        taxYear: 2025,
    },
    [revisionDialectTag]: {
        dialect: revisionDialectTag,
        subject: revisionSampleHash,
        parents: [],
        snapshot: revisionSampleHash,
        generation: 0,
    },
}

export const proof = {
    financeDialects: {
        // See expectedDialectCount's own docstring for why this is the
        // count, not financeDialects.length compared to itself.
        expectedCount: () => {
            assertEq(financeDialects.length, expectedDialectCount)
        },
    },
    detectFinance: {
        // One generated leaf per registered dialect, from the independent
        // fixture map above: a minimal valid instance of that dialect
        // detects as exactly that dialect's own derived media type.
        ...Object.fromEntries(
            Object.entries(fixtures).map(([dialectTag, fixture]) => [
                dialectTag,
                () => {
                    const bytes = tryUtf8(JSON.stringify(fixture))
                    assert(bytes !== null, ['expected the fixture to encode as UTF-8', dialectTag])
                    const meta = detectFinance(bytes)
                    assertEq(meta.mime_type, `application/${dialectTag}+json`)
                },
            ]),
        ),
        // A well-formed JSON blob naming a dialect NONE of financeDialects
        // registers falls through to detectVec's ordinary text/plain
        // verdict -- never throwing, never claiming a false match.
        unregisteredDialectFallsThroughWithoutThrowing: () => {
            const bytes = tryUtf8(JSON.stringify({ dialect: 'vnd.fjs.not-a-real-dialect' }))
            assert(bytes !== null, 'expected the unregistered-dialect fixture to encode as UTF-8')
            const meta = detectFinance(bytes)
            assertEq(meta.mime_type, 'text/plain')
            assertEq(meta.type, 'text')
        },
    },
}
