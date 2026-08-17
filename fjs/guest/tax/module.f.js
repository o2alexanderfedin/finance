/**
 * EXEC-14 — the 1040 engine, reachable from a stored guest program as one
 * more **pure value on `ctx`**, exactly as `step`/`pure`/`centsFromString`/
 * `centsToString` already are.
 *
 * ## What this module is NOT, and why that is the whole point
 *
 * `REQUIREMENTS.md`'s Out of Scope list forbids a `finance_compute_1040`
 * MCP tool — *"would destroy the thesis permanently. The agent would call
 * it and never author a program again."* A server tool that reads
 * documents, assembles a {@link Form1040Inputs} and calls
 * {@link form1040Report} **is** that tool, whatever it is named. So no tool
 * is added here: `tools/list` still answers exactly the same set it
 * answered before this module existed, and
 * `tax-return-integration.test.js` asserts that count against a live
 * server.
 *
 * What is added instead is a wider **context**. The guest still authors the
 * program: it still enumerates subjects with `ctx.evoList`, still walks
 * `ctx.evoHead` -> `ctx.evoRevision` -> `ctx.casRead`, still decides which
 * stored document belongs in which of `Form1040Inputs`' eleven fields, and
 * still decides what to return. The engine is just another value in its
 * vocabulary — the same move 07-CONTEXT.md Decision 1 already made for the
 * combinators and the money helpers.
 *
 * ## Why this lives in its OWN module rather than in `fjs/guest`
 *
 * `fjs/report/payer/module.f.js` imports `fjs/guest/module.f.js`, and
 * PROV-08's whole claim is that the payer report is **not** 1040-shaped:
 * it consults zero tax parameters and produces no 1040 line.
 * `payer-report-gate.test.js` enforces that claim **textually** — it scans
 * every file under `fjs/report/payer/` for an import specifier containing a
 * `/tax/` path segment. Putting `taxGuestCtx` into `fjs/guest/module.f.js`
 * would leave that gate fully green while handing the payer report a
 * *transitive* dependency on the entire tax engine, because the gate reads
 * text and the claim is about dependency.
 *
 * **That mismatch is precisely the "true of the part examined" defect this
 * project keeps shipping** (AGENTS.md's four-instance table). The fix is
 * not a cleverer regex; it is to keep the ABI module clean, so the text and
 * the dependency say the same thing. `fjs/guest/module.f.js` therefore
 * imports nothing from `fjs/tax/*`, `fjs/return/*` or `fjs/form1040/*`, and
 * this module — which imports two of the three — sits beside it rather than
 * inside it.
 *
 * ## The parameter set is bound SERVER-SIDE, never chosen by the guest
 *
 * {@link taxGuestCtx} takes an **already-resolved** {@link TaxParamSet} and
 * hands the guest `form1040Report` *already applied to it*. A stored
 * program therefore cannot invent a parameter set, cannot substitute one
 * year's parameters for another's, and cannot reach `taxParamsByYear` at
 * all (it has no imports). That is what keeps PROV-04 true: the run
 * record's `taxYear`/`paramSetHash` describe the parameters the guest
 * actually computed against, because the guest had no other ones available.
 *
 * `taxParams` is also exposed as a plain readable value, so a program can
 * *cite* the parameters it computed against (e.g. render the standard
 * deduction it applied) without being able to change them.
 *
 * ## The effect whitelist does not widen (Success Criterion 2)
 *
 * `form1040Report` is **pure**. It builds no `Effect`, never becomes a
 * `command`, and never reaches `match`. `CasOp` still has exactly four
 * members, `_CasOpIsExactlyTheFourCommands` in `fjs/guest/module.f.js` is
 * untouched, and `casOpNames` is untouched. {@link proof.engineAndParametersAreNeverOperations}
 * is this module's runtime guard on that distinction — the direct mirror of
 * `fjs/guest`'s own `combinatorsAreNeverOperations`, extended to the two
 * new context members.
 *
 * @module
 */
import { assert, assertEq, assertNotNullish } from 'functionalscript/fjs/asserts/module.f.js'
import { guestCtx, casOpNames } from '../module.f.js'
import { form1040Report } from '../../form1040/core/module.f.js'
import { taxParamsByYear } from '../../tax/params/module.f.js'
import { dialect as returnProfileDialect } from '../../return/profile/module.f.js'

/** @import { Effect } from 'functionalscript/fjs/effects/module.f.js' */
/** @import { CasOp } from '../module.f.js' */
/** @import { TaxParamSet } from '../../tax/params/module.f.js' */
/** @import { Form1040Inputs } from '../../form1040/core/module.f.js' */
/** @import { ReturnProfile } from '../../return/profile/module.f.js' */

/**
 * The guest ABI, widened with the 1040 engine and the parameter set it was
 * bound to.
 *
 * Written as a spread of {@link guestCtx} rather than by re-listing its
 * members, deliberately: a member added to the frozen ABI reaches a tax
 * program automatically, and there is no second list here to drift from the
 * one in `fjs/guest/module.f.js`.
 * {@link proof.taxGuestCtxCarriesTheWholeGuestAbiUnchanged} pins each of the
 * eight by name anyway — the spread is the mechanism, the named checks are
 * the evidence.
 *
 * The parameter is annotated inline (`/** @type {TaxParamSet} *\/`) rather
 * than via a whole-function `@type`, so `TaxGuestCtx` below can be
 * `ReturnType<typeof taxGuestCtx>` and stay derived from the one object
 * literal instead of restated beside it.
 */
export const taxGuestCtx = (/** @type {TaxParamSet} */ taxParams) => ({
    ...guestCtx,
    taxParams,
    form1040Report: form1040Report(taxParams),
})

/** @typedef {ReturnType<typeof taxGuestCtx>} TaxGuestCtx */

/**
 * The entry point a stored **tax** report program exports — `fjs/guest`'s
 * own `Report<T>`, with `TaxGuestCtx` in place of `GuestCtx` and nothing
 * else changed. The effect parameter is still `CasOp`: the four frozen
 * read-only commands, unwidened, because the engine reached through `ctx`
 * dispatches nothing.
 *
 * A plain `Report<T>` is assignable to a `TaxReport<T>` (its parameter is
 * the wider `GuestCtx`, and a function accepting less is usable where more
 * is supplied), which is why `fjs/report/payer`'s program still runs
 * unchanged through the executor now that the executor always supplies a
 * tax context.
 * @template T
 * @typedef {(ctx: TaxGuestCtx) => (args: readonly string[]) => Effect<CasOp, T>} TaxReport
 */

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * TY2025's parameter set, narrowed exactly once at module scope —
 * `noUncheckedIndexedAccess` makes the open year-keyed lookup yield
 * `TaxParamSet | undefined`, and a cast or `!` is banned, so `assert` is the
 * only compliant narrowing path (`fjs/form1040/core` does the same).
 */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/**
 * The smallest input a 1040 can be computed from: a single filer who
 * declared wages and holds no documents at all. Every list is empty, so
 * every money line is either zero or the profile-declared zero — which
 * leaves line 12e (the deduction) as the ONE line driven purely by the
 * parameter set, and therefore the one line
 * {@link proof.theEngineIsBoundToTheParameterSetItWasGiven} can move by
 * moving a parameter.
 * @type {Form1040Inputs}
 */
const parameterProbeInputs = {
    profile: {
        documentHash: 'sha256-tax-guest-ctx-profile',
        value: /** @type {ReturnProfile} */ ({
            dialect: returnProfileDialect,
            taxYear: 2025,
            filingStatus: 'single',
            dependentCount: 0,
            declaredKinds: ['wages'],
        }),
    },
    w2s: [],
    interestForms: [],
    dividendForms: [],
    brokerageForms: [],
    retirementForms: [],
    socialSecurityForms: [],
    itemizedDeductionForms: [],
    medicalExpenseForms: [],
    capitalLossCarryoverForms: [],
    unemploymentForms: [],
    adjustmentForms: [],
    studentLoanInterestForms: [],
    tuitionForms: [],
    creditForms: [],
    iraForms: [],
    nonemployeeCompensationForms: [],
    businessExpenseForms: [],
    priorYearIraBasisForms: [],
    isoExerciseForms: [],
    partnershipK1Forms: [],
    sCorporationK1Forms: [],
    estateTrustK1Forms: [],
    employeeStockPurchaseForms: [],
    basisCorrectionForms: [],
}

/**
 * Reads one printed line's cents out of a whole-report outcome by its `rule`
 * string. A LOOKUP, never an iteration set: the proofs below hand-type both
 * the rule they ask for and the cents they expect, so a line vanishing from
 * the report fails `assertNotNullish` here rather than quietly shrinking a
 * loop (AGENTS.md's fourth shipped defect).
 * @type {(inputs: Form1040Inputs) => (taxParams: TaxParamSet) => (rule: string) => bigint}
 */
const lineCents = inputs => taxParams => rule => {
    const outcome = taxGuestCtx(taxParams).form1040Report(inputs)
    assert(outcome.kind === 'ok', ['expected the probe return to compute', outcome])
    if (outcome.kind !== 'ok') {
        return 0n
    }
    const line = outcome.lines.find(candidate => candidate.rule === rule)
    return assertNotNullish(line, ['expected the report to carry', rule]).value
}

export const proof = {
    // The whole frozen ABI reaches a tax program UNCHANGED — each of the
    // eight members named individually and checked with `Object.is` (the
    // same function object, never a wrapper), plus a hand-typed count so
    // that a member DISAPPEARING from `guestCtx` is caught here too. The
    // count is the `expectedMoneyBoxFieldCount` idiom: without it, this
    // leaf's evidence would shrink in lockstep with the thing it checks.
    taxGuestCtxCarriesTheWholeGuestAbiUnchanged: () => {
        const ctx = taxGuestCtx(assertNotNullish(taxParams2025, 'TY2025 parameters'))
        assertEq(Object.keys(guestCtx).length, 8)
        assertEq(Object.keys(ctx).length, 10)
        assert(Object.is(ctx.casRead, guestCtx.casRead), 'casRead must be the frozen ABI\'s own constructor')
        assert(Object.is(ctx.evoList, guestCtx.evoList), 'evoList must be the frozen ABI\'s own constructor')
        assert(Object.is(ctx.evoHead, guestCtx.evoHead), 'evoHead must be the frozen ABI\'s own constructor')
        assert(Object.is(ctx.evoRevision, guestCtx.evoRevision), 'evoRevision must be the frozen ABI\'s own constructor')
        assert(Object.is(ctx.step, guestCtx.step), 'step must be the frozen ABI\'s own combinator')
        assert(Object.is(ctx.pure, guestCtx.pure), 'pure must be the frozen ABI\'s own combinator')
        assert(Object.is(ctx.centsFromString, guestCtx.centsFromString), 'centsFromString must be the frozen ABI\'s own helper')
        assert(Object.is(ctx.centsToString, guestCtx.centsToString), 'centsToString must be the frozen ABI\'s own helper')
        assertEq(typeof ctx.form1040Report, 'function')
    },
    // Success Criterion 2's runtime half, mirroring `fjs/guest`'s own
    // `combinatorsAreNeverOperations` for the two members this module adds:
    // neither the engine nor the parameter set is a dispatched command, so
    // neither may ever appear in `casOpNames`. The frozen four are re-checked
    // as a single hand-typed string, exactly as that leaf does — a fifth
    // command name still fails this line, which is the property the type-level
    // `_CasOpIsExactlyTheFourCommands` guards at compile time.
    //
    // Measured, not assumed: adding `'form1040Report'` to `casOpNames` was run
    // as a mutation gate on 2026-08-16 and reddened `vocabularyIsFrozenAtFour`,
    // `everyConstructorDispatches` and THIS leaf — while `fjs/guest`'s own
    // `combinatorsAreNeverOperations` stayed GREEN, because it enumerates
    // `step`/`pure`/`centsFromString`/`centsToString` and cannot see a name it
    // was never told about. That is precisely why this leaf exists rather than
    // a line being added to that one: a guard whose list is fixed at the
    // members somebody thought of is blind to the next member.
    engineAndParametersAreNeverOperations: () => {
        assertEq(casOpNames.join(','), 'casRead,evoList,evoHead,evoRevision')
        assert(!casOpNames.includes('form1040Report'), ['form1040Report must never be listed as a command'])
        assert(!casOpNames.includes('taxParams'), ['taxParams must never be listed as a command'])
    },
    // The parameter set the SERVER supplied is the one the engine computes
    // against — proven by moving a parameter and watching the answer move.
    //
    // Both expected values are hand-typed: $15,750.00 is TY2025's single
    // standard deduction as printed in Rev. Proc. 2025-32 §3.01, and $1.00 is
    // this proof's own invented substitute. Neither is read back out of
    // `taxParams` (which is the code under test's own input), so a change to
    // the stored parameter fails this leaf rather than moving with it.
    theEngineIsBoundToTheParameterSetItWasGiven: () => {
        const real = assertNotNullish(taxParams2025, 'TY2025 parameters')
        assertEq(lineCents(parameterProbeInputs)(real)('1040 line 12e'), 1575000n)
        const substituted = {
            ...real,
            standardDeduction: {
                ...real.standardDeduction,
                single: { ...real.standardDeduction.single, amount: '1.00' },
            },
        }
        assertEq(lineCents(parameterProbeInputs)(substituted)('1040 line 12e'), 100n)
    },
    // The guest reads the SAME parameter object the caller resolved, not a
    // copy and not a second lookup — so a program that cites the parameters
    // it used cites the ones the run record's `paramSetHash` was computed
    // over. Complementary to the leaf above rather than redundant with it:
    // that one proves the engine FOLLOWS the parameters, this one proves the
    // readable copy IS them.
    taxParamsIsTheServerResolvedObjectItself: () => {
        const real = assertNotNullish(taxParams2025, 'TY2025 parameters')
        assert(Object.is(taxGuestCtx(real).taxParams, real), 'ctx.taxParams must be the object the caller resolved')
    },
}
