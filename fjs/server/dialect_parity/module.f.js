/**
 * `fjs/server/dialect_parity` — the check that COMPARES this repo's two dialect
 * registries against each other, instead of asking a reader to.
 *
 * ## Why this module exists
 *
 * There are two hand-maintained dialect registries, and they answer different
 * questions:
 *
 * - `fjs/media/dialects`'s `financeDialects` decides how `cas_refresh`
 *   **classifies** a stored blob. A dialect missing here is filed as
 *   `text/plain`.
 * - `fjs/server/finance_schema`'s `dialectSchemas` decides which dialects an
 *   agent can **read a schema for**. A dialect missing there leaves an agent
 *   guessing field names — the exact second-source-of-truth that tool exists to
 *   eliminate.
 *
 * Each already carried a hand-typed count in the `expectedMoneyBoxFieldCount`
 * idiom, and each count counted **only its own list**. So neither could notice
 * the other drifting, and both drifted. Measured on `develop` @ `0df734d`, the
 * two twenty-three-entry lists were not the same twenty-three:
 *
 * - Registered for schema reading and NOT classifiable: `vnd.fjs.form3921`,
 *   `vnd.fjs.form3922`, `vnd.fjs.basis_correction` (Phase 29 registered all
 *   three with the schema tool and none with `detect`).
 * - Classifiable with NO readable schema: `vnd.fjs.itemized_deductions`,
 *   `vnd.fjs.prior_year_capital_loss` — and both are **REQUIRED** fields on
 *   `Form1040Inputs` (`itemizedDeductionForms`, `capitalLossCarryoverForms`),
 *   so every agent serving anyone who itemizes or carries a capital loss
 *   forward had to guess.
 *
 * `fjs/media/dialects`'s own docstring had recorded that divergence, by name,
 * in both directions, since Phase 30 — and it did not stop it, because
 * **naming a hazard in a comment is not a check.** Only comparing one list
 * against the other is. That comparison is {@link dialectDrift}, and the leaf
 * that runs it against the real registries is
 * {@link proof.theTwoRegistriesDescribeTheSameDialectSet}.
 *
 * ## The permitted asymmetry is named individually, never left loose
 *
 * Two dialects are legitimately classification-only, and they are enumerated in
 * {@link classificationOnlyDialects} rather than admitted by a rule loose enough
 * to let anything through:
 *
 * - **`vnd.fjs.revision`** — the CAS/evolution version record. Upstream's own
 *   dialect, written into the store by `evo_add`; a taxpayer never authors one
 *   and no program is written against its fields, which are served by the
 *   `evo_*` tools directly.
 * - **`vnd.fjs.run`** — the `fjs_run` run record. Produced BY the server as the
 *   output of an execution, never supplied to it; `fjs_run`'s own result is the
 *   thing an agent reads, so there is nothing for a schema-reading author to
 *   author against.
 *
 * Neither is a taxpayer document, which is the property that distinguishes them
 * from the five above. The list is not merely tolerated either: an entry that
 * stops being genuinely asymmetric — because someone registered a schema for it,
 * or dropped it from classification — comes back in `staleExceptions` and
 * reddens, so the exception list cannot rot into a dumping ground.
 *
 * ## Why this is a `.f.js` proof and not a root-level `*.test.js`
 *
 * The root-level TAX-15 acronym gate and `payer-report-gate.test.js` live at
 * the root because they scan file TEXT, which a `.f.js` module's purity rule
 * does not permit. This gate needs no filesystem access at all: both registries
 * are ordinary exported values, so the comparison is pure and belongs here,
 * under root discovery, where `npm test` picks it up like every other proof.
 *
 * (The first draft of the paragraph above named that gate by its FILENAME, and
 * the gate itself reddened on it — the file name is a lowercase spelling of the
 * acronym TAX-15 forbids inside `fjs/**`. Recorded rather than quietly
 * reworded: it is a second gate proving itself load-bearing on the same day
 * this one was written, and the next author reaching for that filename in a
 * docstring under `fjs/` will hit it too.)
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { financeDialects } from '../../media/dialects/module.f.js'
import { knownDialects } from '../finance_schema/module.f.js'

/**
 * The three ways the two registries can disagree, each as a SORTED list of the
 * offending dialect tags — sorted so a failure message is stable and
 * diff-readable, and named rather than counted so the message says *which*
 * dialect drifted instead of merely that one did.
 * @typedef {{
 *   readonly classifiableWithNoReadableSchema: readonly string[],
 *   readonly readableButNotClassifiable: readonly string[],
 *   readonly staleExceptions: readonly string[],
 * }} DialectDrift
 */

/**
 * Compares two dialect-tag lists, tolerating exactly the classification-only
 * tags named in `exceptions` and nothing else.
 *
 * Written as a function OVER two lists rather than as a proof directly against
 * the two imported registries, for one reason: it is what makes a positive
 * control possible. {@link proof.driftGateIsNotVacuous} feeds this same
 * function synthetic lists carrying a deliberate drift in every one of the
 * three directions and asserts it names each offender — so a comparison that
 * had degenerated into "return three empty arrays" would fail the control
 * rather than pass the real leaf for the wrong reason (AGENTS.md: "a gate needs
 * a control", and `payer-report-gate.test.js`'s own pattern of pointing the
 * real walker at a case that MUST trip).
 *
 * `Array.prototype.filter` already allocates a fresh array, so the `.sort()`
 * that follows it mutates nothing the caller holds — unlike a bare
 * `someList.sort()`, which would reorder a registry in place.
 * @type {(classifiable: readonly string[]) =>
 *   (readable: readonly string[]) =>
 *   (exceptions: readonly string[]) => DialectDrift}
 */
export const dialectDrift = classifiable => readable => exceptions => ({
    classifiableWithNoReadableSchema: classifiable
        .filter(tag => !readable.includes(tag) && !exceptions.includes(tag))
        .sort(),
    readableButNotClassifiable: readable
        .filter(tag => !classifiable.includes(tag))
        .sort(),
    staleExceptions: exceptions
        .filter(tag => !classifiable.includes(tag) || readable.includes(tag))
        .sort(),
})

/**
 * The ONLY dialects permitted to be classifiable without a readable schema,
 * enumerated by name. See this module's docstring for the justification of each;
 * both are server-produced records rather than taxpayer documents.
 *
 * Hand-typed, and hand-typed here rather than filtered out of either registry
 * by a predicate: a predicate ("anything not under `fjs/document`", say) is
 * exactly the loose rule that would have admitted all five real drifts above
 * without anyone noticing.
 * @type {readonly string[]}
 */
const classificationOnlyDialects = ['vnd.fjs.revision', 'vnd.fjs.run']

/**
 * Independently hand-typed: how many classification-only exceptions there are.
 * Deliberately NOT `classificationOnlyDialects.length`.
 *
 * Its job is to make ADDING an exception a visible, deliberate act. The gate
 * below cannot itself distinguish "this dialect is legitimately
 * classification-only" from "I could not be bothered to register a schema" —
 * only a human can — so the cheapest thing it can do is refuse to let the
 * exception list grow silently. Raising this literal is the moment to write the
 * justification into the docstring above, next to the other two.
 * @type {number}
 */
const expectedClassificationOnlyCount = 2

/**
 * The dialect tags {@link financeDialects} classifies. Read off each entry's own
 * `dialect` member, which upstream's `dialectEntry` takes from the schema itself
 * (`fjs/media/module.f.js`: "no registration can claim one dialect while
 * validating another's blobs"), so this is the tag `detect` will actually emit —
 * not a second list that could disagree with it.
 * @type {readonly string[]}
 */
const classifiableDialects = financeDialects.map(entry => entry.dialect)

// ── Tests ────────────────────────────────────────────────────────────────────

export const proof = {
    /**
     * THE GATE. The two registries describe the same dialect set, modulo the
     * two named classification-only tags.
     *
     * Both hand-typed counts (`expectedDialectCount`,
     * `expectedKnownDialectCount`) stay where they are and keep doing their own
     * job: they catch an entry vanishing from ONE list. This leaf catches the
     * thing they structurally cannot — the two lists ceasing to agree.
     */
    theTwoRegistriesDescribeTheSameDialectSet: () => {
        // Non-vacuity first. A comparison of two empty lists reports no drift,
        // so without this the leaf below would pass for the wrong reason if
        // either import ever resolved to nothing — the same guard the payer
        // report's transitive gate makes with `reached.size > 1`.
        assert(
            classifiableDialects.length > expectedClassificationOnlyCount,
            ['the classifiable registry must be non-trivial', classifiableDialects.length],
        )
        assert(
            knownDialects.length > expectedClassificationOnlyCount,
            ['the schema registry must be non-trivial', knownDialects.length],
        )
        const drift = dialectDrift(classifiableDialects)(knownDialects)(classificationOnlyDialects)
        assertEq(
            drift.classifiableWithNoReadableSchema.join(', '),
            '',
            [
                'these dialects are classifiable but serve NO readable schema, so an agent has to '
                + 'guess their field names — register them in fjs/server/finance_schema, or name '
                + 'them in classificationOnlyDialects with the reason',
                drift.classifiableWithNoReadableSchema,
            ],
        )
        assertEq(
            drift.readableButNotClassifiable.join(', '),
            '',
            [
                'these dialects serve a readable schema but are NOT classifiable, so cas_refresh '
                + 'files a stored blob of each as text/plain — register them in fjs/media/dialects',
                drift.readableButNotClassifiable,
            ],
        )
        assertEq(
            drift.staleExceptions.join(', '),
            '',
            [
                'these classification-only exceptions are no longer needed (each is either absent '
                + 'from classification or now serves a schema) — remove them from '
                + 'classificationOnlyDialects',
                drift.staleExceptions,
            ],
        )
    },

    /**
     * POSITIVE CONTROL: the same {@link dialectDrift} the leaf above trusts,
     * fed synthetic lists that MUST trip it, in all three directions at once.
     *
     * Every tag here is `vnd.test.*` and is registered nowhere, so this leaf can
     * never accidentally become evidence about a real dialect — the discipline
     * `payer-report-gate.test.js`'s synthetic offending import line follows.
     */
    driftGateIsNotVacuous: () => {
        const syntheticClassifiable = [
            'vnd.test.in-both',
            'vnd.test.classifiable-only',
            'vnd.test.exception-that-now-has-a-schema',
        ]
        const syntheticReadable = [
            'vnd.test.in-both',
            'vnd.test.readable-only',
            'vnd.test.exception-that-now-has-a-schema',
        ]
        const syntheticExceptions = [
            'vnd.test.exception-that-now-has-a-schema',
            'vnd.test.exception-nothing-classifies',
        ]
        const drift = dialectDrift(syntheticClassifiable)(syntheticReadable)(syntheticExceptions)
        // Named, and named EXACTLY: `vnd.test.in-both` must not appear in any
        // channel, or the gate reports drift for a dialect that has none and
        // the real leaf above would be failing for a reason nobody could act on.
        assertEq(drift.classifiableWithNoReadableSchema.join(', '), 'vnd.test.classifiable-only')
        assertEq(drift.readableButNotClassifiable.join(', '), 'vnd.test.readable-only')
        // Both stale branches: an exception that acquired a schema, and one
        // nothing classifies any more. Sorted, so the expectation is stable.
        assertEq(
            drift.staleExceptions.join(', '),
            'vnd.test.exception-nothing-classifies, vnd.test.exception-that-now-has-a-schema',
        )
    },

    /**
     * NEGATIVE CONTROL: two lists that genuinely agree report no drift at all.
     *
     * Without it, a comparison that reported every tag in every channel would
     * satisfy the positive control's three assertions in spirit and be caught
     * only by the real leaf — which is the leaf whose verdict is supposed to be
     * the finding, not the self-test.
     */
    driftGateReportsNothingWhenTwoListsAgree: () => {
        const drift = dialectDrift(
            ['vnd.test.a', 'vnd.test.b', 'vnd.test.classify-only'])(
            ['vnd.test.b', 'vnd.test.a'])(
            ['vnd.test.classify-only'])
        assertEq(drift.classifiableWithNoReadableSchema.join(', '), '')
        assertEq(drift.readableButNotClassifiable.join(', '), '')
        assertEq(drift.staleExceptions.join(', '), '')
    },

    /**
     * The exception list is exactly the two tags this module's docstring
     * justifies, each named individually. A third one appearing without a
     * matching edit here is the case this leaf exists to stop.
     */
    theClassificationOnlyExceptionsAreExactlyTheTwoNamedOnes: () => {
        assertEq(classificationOnlyDialects.length, expectedClassificationOnlyCount)
        assert(
            classificationOnlyDialects.includes('vnd.fjs.revision'),
            ['the CAS revision record is one of the two', classificationOnlyDialects],
        )
        assert(
            classificationOnlyDialects.includes('vnd.fjs.run'),
            ['the fjs_run run record is the other', classificationOnlyDialects],
        )
    },

    /**
     * Neither registry registers the same dialect twice.
     *
     * This is what keeps the two hand-typed counts honest in the one case they
     * cannot see: a duplicated entry beside a deleted one leaves the count
     * unchanged. The gate above would catch that in `readableButNotClassifiable`
     * for the classifiable side, but a duplicate is a defect in its own right —
     * `detect` takes the FIRST match, so two entries for one tag mean the second
     * schema is dead code nobody will notice is unreachable.
     */
    neitherRegistryRegistersADialectTwice: () => {
        assertEq(
            classifiableDialects.length,
            new Set(classifiableDialects).size,
            ['fjs/media/dialects registers a dialect twice', classifiableDialects],
        )
        assertEq(
            knownDialects.length,
            new Set(knownDialects).size,
            ['fjs/server/finance_schema registers a dialect twice', knownDialects],
        )
        // With no duplicates on either side and no drift, the two lengths differ
        // by exactly the number of permitted exceptions. Stated because it is
        // the whole invariant in one line, and because it fails on a duplicate
        // even if a future edit weakens one of the two assertions above.
        assertEq(
            classifiableDialects.length - knownDialects.length,
            expectedClassificationOnlyCount,
        )
    },
}
