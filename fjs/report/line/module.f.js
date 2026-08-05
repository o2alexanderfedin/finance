/**
 * PROV-01/PROV-02 — the report-line type: a computed monetary figure that
 * cannot exist, at the type level, without the sources it came from and the
 * rule it implements. `{ value }` without `{ sources }` must fail `tsc` —
 * traceability enforced by the type system, not by authoring convention.
 *
 * The negative type property is asserted as a conditional type INSIDE the
 * passing build, never a second tsconfig and never `@ts-nocheck` — Phase 6's
 * precedent (`fjs/guest/module.f.js`'s
 * `_CasOpIsExactlyTheFourCommands`). Verified the same way Phase 6 verified
 * its own negative type property: widen the guarded property, watch the
 * assertion fail to compile, then revert (this plan's Task 2, transcript in
 * `09-01-SUMMARY.md`).
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { centsToString } from '../../exact/module.f.js'

/** @import { Assert } from 'functionalscript/fjs/asserts/module.f.js' */
/** @import { Equal } from 'functionalscript/fjs/types/ts/module.f.js' */

/**
 * One `(documentHash, boxPath, value)` tuple as a named object — greppable
 * by field name rather than positional. `boxPath` is a dotted string
 * matching the dialect's own field name (e.g. `box1InterestIncome`,
 * `fjs/document/1099int`'s convention). `value` is the raw value exactly as
 * read at that box — the same decimal-string wire representation the
 * dialect itself stores (EXACT-05) — never re-parsed or rounded in this
 * module.
 * @typedef {{
 *   readonly documentHash: string,
 *   readonly boxPath: string,
 *   readonly value: string,
 * }} Source
 */

/**
 * A computed monetary report line. `value` is cents as `bigint` with NO
 * generic type parameter — 09-CONTEXT.md: this is a money line, and a type
 * variable here would only invite a `number` to appear downstream.
 * `sources` is a non-empty TUPLE (`readonly [Source, ...(readonly
 * Source[])]`), never a plain `readonly Source[]` — so an empty `sources:
 * []` also fails to typecheck, not merely an omitted key, satisfying
 * PROV-02's plural "tuples". `rule` is a required (non-optional) string
 * naming the form line or worksheet line this value implements (e.g.
 * `'1040 line 2b'`) — a line that cannot say which rule it implements is
 * exactly the untraceable line this type exists to make unrepresentable.
 * @typedef {{
 *   readonly value: bigint,
 *   readonly sources: readonly [Source, ...(readonly Source[])],
 *   readonly rule: string,
 * }} ReportLine
 */

/**
 * Does `A` structurally satisfy `B`? Tuple-wrapped (`[A] extends [B]`, not
 * bare `A extends B`) so a union `A` is tested as a whole rather than
 * distributing member-by-member — mirroring why `fjs/guest/module.f.js`'s
 * own conditional-type assertion needs the same wrapping for its own
 * (different) generic. `Extends` does not exist upstream in fjs; it is the
 * "does A structurally satisfy B" check this module's own assertion needs,
 * which `Equal` alone cannot express, so it is defined once, locally, here.
 * @template A
 * @template B
 * @typedef {[A] extends [B] ? true : false} Extends
 */

/**
 * PROV-01, as a single compile-time assertion: a value carrying `value` and
 * `rule` but OMITTING `sources` must NOT satisfy `ReportLine` —
 * traceability enforced by `tsc`, not by convention. Task 2 verifies this
 * assertion is load-bearing by deliberately widening `sources` to optional
 * and watching this exact line fail to compile (transcript in
 * `09-01-SUMMARY.md`).
 * @typedef {Assert<Equal<Extends<{ readonly value: bigint, readonly rule: string }, ReportLine>, false>>} _ValueAndRuleWithoutSourcesDoesNotSatisfyReportLine
 */

// ── Tests ────────────────────────────────────────────────────────────────────

export const proof = {
    // PROV-02: a fully populated line carries `value`, its `sources` tuple,
    // and `rule` — every field asserted individually so a failure localizes
    // to the specific field that broke.
    fullyPopulatedLineHasAllThreeFields: () => {
        /** @type {ReportLine} */
        const line = {
            value: 180300n,
            sources: [{
                documentHash: 'sha256-doc1',
                boxPath: 'box1InterestIncome',
                value: '1234.56',
            }],
            rule: '1040 line 2b',
        }
        assertEq(line.value, 180300n)
        assertEq(line.rule, '1040 line 2b')
        assertEq(line.sources.length, 1)
        const [source] = line.sources
        assertEq(source.documentHash, 'sha256-doc1')
        assertEq(source.boxPath, 'box1InterestIncome')
        assertEq(source.value, '1234.56')
    },
    // The runtime witness of the type-level non-empty-tuple guarantee:
    // `sources` always carries at least one tuple.
    sourcesCarriesAtLeastOneTuple: () => {
        /** @type {ReportLine} */
        const line = {
            value: 180300n,
            sources: [{
                documentHash: 'sha256-doc1',
                boxPath: 'box1InterestIncome',
                value: '1234.56',
            }],
            rule: '1040 line 2b',
        }
        assert(line.sources.length > 0, ['sources must carry at least one tuple', line.sources])
    },
    // PROV-02's "round-trips through JSON without needing a schema for
    // paths": project the line to its JSON-safe wire form — `centsToString`,
    // never `JSON.stringify` on a bare `bigint` (EXACT-05) — then
    // stringify/parse it and assert every field survives unchanged.
    wireProjectionRoundTripsThroughJson: () => {
        /** @type {ReportLine} */
        const line = {
            value: 180300n,
            sources: [{
                documentHash: 'sha256-doc1',
                boxPath: 'box1InterestIncome',
                value: '1234.56',
            }],
            rule: '1040 line 2b',
        }
        const wire = { value: centsToString(line.value), sources: line.sources, rule: line.rule }
        const roundTripped = JSON.parse(JSON.stringify(wire))
        assertEq(roundTripped.value, '1803.00')
        assertEq(roundTripped.rule, '1040 line 2b')
        assertEq(roundTripped.sources.length, 1)
        const [roundTrippedSource] = roundTripped.sources
        assertEq(roundTrippedSource.documentHash, 'sha256-doc1')
        assertEq(roundTrippedSource.boxPath, 'box1InterestIncome')
        assertEq(roundTrippedSource.value, '1234.56')
    },
}
