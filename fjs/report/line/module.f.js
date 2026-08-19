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
import { assert, assertEq, assertNotNullish } from 'functionalscript/fjs/asserts/module.f.mjs'
import { centsToString } from '../../exact/module.f.js'
import { of, halfUp } from '../../types/rational/module.f.js'

/** @import { Assert } from 'functionalscript/fjs/asserts/module.f.mjs' */
/** @import { Equal } from 'functionalscript/fjs/types/ts/module.f.mjs' */

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

// ── The whole-dollar election (i1040gi p23) ─────────────────────────────────

/**
 * Rounds one already-exact cents value to a whole number of dollars, then
 * re-expresses it in this project's cents convention (`× 100`), so a
 * projected line stays comparable to every other stored cents amount.
 *
 * The governing rule, verbatim from the Form 1040 instructions
 * (`i1040gi.pdf` p23, "Rounding Off to Whole Dollars"):
 *
 * > You can round off cents to whole dollars on your return and schedules.
 * > If you do round to whole dollars, you must round all amounts. To round,
 * > drop amounts under 50 cents and increase amounts from 50 to 99 cents to
 * > the next dollar. For example, $1.39 becomes $1 and $2.50 becomes $3.
 * >
 * > If you have to add two or more amounts to figure the amount to enter on
 * > a line, include cents when adding the amounts and round off only the
 * > total.
 *
 * "Increase amounts from 50 to 99 cents to the next dollar" is a half-up
 * rule, and `halfUp` is why the tie goes away from zero at BOTH signs: it
 * breaks `-2.50` to `-3`, whereas JavaScript's built-in number rounding
 * breaks it toward `+Infinity` (to `-2`) — a systematic bias in the
 * taxpayer's favor on every loss (`fjs/types/rational`'s own docstring and
 * its `rounding.tieAwayFromZeroNegativeDiffersFromMathRound` leaf pin that
 * divergence). No floating point appears anywhere on this path: `of` builds
 * an exact `Rational` over `bigint`s and `halfUp` consumes it.
 *
 * **Deliberately NOT shared with `fjs/tax/table`'s private
 * `roundToNearestDollarThenBackToCents`, which computes the same numbers
 * today.** That one implements Publication 1040's *printing* convention for
 * the Tax Table — a property of the printed table, which simply has no
 * cents column, and which applies whether or not the taxpayer elected
 * anything. This one implements the taxpayer's own p23 *election*, which
 * the taxpayer may decline. They are two different rules with two different
 * justifications that happen to coincide numerically, and each would
 * survive the IRS changing the other. A later "DRY these up" pass has to
 * argue with that reason, not only with the duplication — merging them
 * would make declining the election silently unable to stop the Tax Table
 * from rounding, or make a change to the printed table's convention
 * silently rewrite the election.
 *
 * Private on purpose: see `applyWholeDollarElection` for why no per-line
 * variant is exported.
 * @type {(cents: bigint) => bigint}
 */
const wholeDollarCentsFromCents = cents => halfUp(of(cents)(100n)) * 100n

/**
 * Applies (or declines) the taxpayer's whole-dollar election over a WHOLE
 * report. `false` returns `lines` exactly as given — the same array, not a
 * rebuilt copy. `true` projects every line's `value` to whole dollars,
 * leaving `sources` and `rule` untouched, so provenance survives a rounding
 * pass intact.
 *
 * **The signature is the point.** p23 makes the election all-or-nothing for
 * the entire return — "If you do round to whole dollars, you must round
 * **all** amounts" — so this takes the whole `ReportLine[]` and there is
 * deliberately no exported per-line variant to partially apply
 * (`wholeDollarCentsFromCents` is private for exactly this reason). A
 * caller cannot round line 2b and leave line 1a alone without writing a
 * second rounding mechanism of their own, which would be conspicuous in
 * review rather than a one-character slip.
 *
 * **Round the total, never the items.** p23's second sentence — "include
 * cents when adding the amounts and round off only the total" — is honored
 * structurally by *where* this runs: a `ReportLine.value` is already the
 * exact cents sum of its `sources`, so projecting the line rounds the
 * total once. Applying this to per-item values and then adding them is the
 * error the rule names, and this module's
 * `roundSumIsFourteenDollarsWhileSumRoundIsTenOnTenIrsExampleAmounts` leaf
 * prices that error at $4 on ten $1.39 amounts.
 * Nothing here re-rounds an already-rounded value either: the projection is
 * applied once, at report time, to the exact cents figure.
 *
 * **Where `elected` comes from:** the return profile document's own
 * `wholeDollarElection` box (Plan 10-04), never a host-side flag or a
 * configuration default. The election is a fact the taxpayer supplies, and
 * so it carries provenance like every other input — a report can say which
 * document said to round.
 * @type {(elected: boolean) => (lines: readonly ReportLine[]) => readonly ReportLine[]}
 */
export const applyWholeDollarElection = elected => lines => elected
    ? lines.map(line => ({ ...line, value: wholeDollarCentsFromCents(line.value) }))
    : lines

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * Builds a one-source `ReportLine` for the election proofs: `valueCents` is
 * the line's exact cents value, `rawValue` the decimal string as it would
 * have been read at the box, `documentHash` a synthetic content hash.
 * Builds only INPUTS — never an expected value, every one of which is
 * hand-typed at its assertion (AGENTS.md). Test-only; not exported.
 * @type {(documentHash: string) => (rawValue: string) => (valueCents: bigint) => ReportLine}
 */
const electionTestLine = documentHash => rawValue => valueCents => ({
    value: valueCents,
    sources: [{ documentHash, boxPath: 'box1InterestIncome', value: rawValue }],
    rule: '1040 line 2b',
})

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

    // ── The whole-dollar election (i1040gi p23) ──────────────────────────
    //
    // `'1.39'` and `'2.50'` below are the IRS's OWN printed examples from
    // that paragraph ("For example, $1.39 becomes $1 and $2.50 becomes
    // $3"), which is why they are the values worth pinning. Every expected
    // value in these leaves is hand-typed: none is produced by
    // `wholeDollarCentsFromCents`, and none is derived from another
    // (AGENTS.md — a proof's expected side must be independent of the code
    // under test).

    // The election is an election: not taken, the report comes back exactly
    // as it went in — the same array, not a rebuilt copy — so "we did not
    // elect" can never quietly cost a taxpayer cents.
    electionNotMadeReturnsEveryLineValueUnchanged: () => {
        const lines = [
            electionTestLine('sha256-doc1')('13.90')(1390n),
            electionTestLine('sha256-doc2')('2.50')(250n),
            electionTestLine('sha256-doc3')('1.39')(139n),
        ]
        const projected = applyWholeDollarElection(false)(lines)
        assert(projected === lines, 'an unelected projection must return its input unchanged')
        assertEq(projected.length, 3)
        assertEq(assertNotNullish(projected[0], 'unelected line 0').value, 1390n)
        assertEq(assertNotNullish(projected[1], 'unelected line 1').value, 250n)
        assertEq(assertNotNullish(projected[2], 'unelected line 2').value, 139n)
    },
    // $13.90 is above the half-dollar, so it rounds UP to $14 — the value
    // Task 2's ten-`$1.39` line lands on when the sum is rounded once.
    electedThirteenNinetyBecomesFourteenDollars: () => {
        const line = electionTestLine('sha256-doc1')('13.90')(1390n)
        const projected = assertNotNullish(
            applyWholeDollarElection(true)([line])[0],
            'the projection of a one-line report must have a line 0')
        assertEq(projected.value, 1400n)
    },
    // The IRS's printed tie: "$2.50 becomes $3". Half rounds AWAY from
    // zero, never to even and never toward +Infinity.
    electedTwoFiftyTieBecomesThreeDollars: () => {
        const line = electionTestLine('sha256-doc1')('2.50')(250n)
        const projected = assertNotNullish(
            applyWholeDollarElection(true)([line])[0],
            'the projection of a one-line report must have a line 0')
        assertEq(projected.value, 300n)
    },
    // The same tie at the other sign. JavaScript's built-in number rounding
    // breaks -2.5 toward -2 (toward +Infinity), which on a form full of
    // losses is a systematic bias; `halfUp` breaks it to -3. This leaf
    // pins the direction, so a future "just use the built-in" refactor
    // cannot pass. (`fjs/types/rational`'s
    // `rounding.tieAwayFromZeroNegativeDiffersFromMathRound` pins the same
    // divergence against the built-in directly; this is its 1040-line
    // instance and does not restate it.)
    electedNegativeTwoFiftyTieBecomesMinusThreeDollarsAwayFromZero: () => {
        const line = electionTestLine('sha256-doc1')('-2.50')(-250n)
        const projected = assertNotNullish(
            applyWholeDollarElection(true)([line])[0],
            'the projection of a one-line report must have a line 0')
        assertEq(projected.value, -300n)
    },
    // "For example, $1.39 becomes $1." Rounding a single $1.39 amount is
    // correct only when $1.39 IS the line total; doing it per item before
    // adding is what p23 forbids. Exhibited here so Task 2's divergence
    // leaf has both of its sides pinned separately.
    electedOneThirtyNineBecomesOneDollar: () => {
        const line = electionTestLine('sha256-doc1')('1.39')(139n)
        const projected = assertNotNullish(
            applyWholeDollarElection(true)([line])[0],
            'the projection of a one-line report must have a line 0')
        assertEq(projected.value, 100n)
    },
    // All-or-nothing, on a report with more than one line: EVERY line's
    // value is projected — not merely the first — while `sources` and
    // `rule` survive untouched on every line. Provenance is not something
    // a rounding pass is allowed to spend.
    electedProjectionRoundsEveryLineAndPreservesSourcesAndRule: () => {
        const lines = [
            electionTestLine('sha256-doc1')('13.90')(1390n),
            electionTestLine('sha256-doc2')('2.50')(250n),
            electionTestLine('sha256-doc3')('1.39')(139n),
        ]
        const projected = applyWholeDollarElection(true)(lines)
        assertEq(projected.length, 3)
        const first = assertNotNullish(projected[0], 'elected line 0')
        const second = assertNotNullish(projected[1], 'elected line 1')
        const third = assertNotNullish(projected[2], 'elected line 2')
        assertEq(first.value, 1400n)
        assertEq(second.value, 300n)
        assertEq(third.value, 100n)
        const [firstSource] = first.sources
        assertEq(first.sources.length, 1)
        assertEq(firstSource.documentHash, 'sha256-doc1')
        assertEq(firstSource.boxPath, 'box1InterestIncome')
        assertEq(firstSource.value, '13.90')
        assertEq(first.rule, '1040 line 2b')
        const [thirdSource] = third.sources
        assertEq(third.sources.length, 1)
        assertEq(thirdSource.documentHash, 'sha256-doc3')
        assertEq(thirdSource.boxPath, 'box1InterestIncome')
        assertEq(thirdSource.value, '1.39')
        assertEq(third.rule, '1040 line 2b')
    },

    // ROADMAP criterion 5, made non-vacuous. Over `bigint` cents `round` is
    // the identity, so `round(sum)` and `sum(round)` are trivially equal and
    // proving it tests nothing. Rounding only bites at WHOLE DOLLARS, which
    // is what the election introduces — and here the two orders visibly
    // diverge by $4.
    //
    // Why ten amounts of `'1.39'`: that is i1040gi p23's OWN printed example
    // of an amount that rounds down ("For example, $1.39 becomes $1"). Each
    // item individually loses 39 cents to rounding and every loss falls the
    // same way, so ten of them are the sharpest demonstration available that
    // per-item rounding is wrong — which is precisely why the same paragraph
    // ends "include cents when adding the amounts and round off only the
    // total."
    //
    // `fjs/types/rational`'s `lineRoundingVsPerItemRounding` exhibits this
    // mathematical fact abstractly on three halves; this leaf is its
    // 1040-line-shaped instance and does not restate it. The ten `Source`
    // entries below have the shape Plan 10-09 will build from ten REAL
    // stored 1099-INT documents.
    //
    // `1390n`, `1400n`, `1000n` and `400n` are all hand-typed. None is
    // computed by `wholeDollarCentsFromCents`, none is written as a product
    // of the per-item amount and the item count, and none is derived from
    // another: an expected value is worth exactly as much as its
    // independence from the code it checks (AGENTS.md).
    roundSumIsFourteenDollarsWhileSumRoundIsTenOnTenIrsExampleAmounts: () => {
        // The IRS's way: ONE line whose value is already the exact cents sum
        // of its ten sources, rounded once.
        /** @type {ReportLine} */
        const aggregateLine = {
            value: 1390n,
            sources: [
                { documentHash: 'sha256-int-01', boxPath: 'box1InterestIncome', value: '1.39' },
                { documentHash: 'sha256-int-02', boxPath: 'box1InterestIncome', value: '1.39' },
                { documentHash: 'sha256-int-03', boxPath: 'box1InterestIncome', value: '1.39' },
                { documentHash: 'sha256-int-04', boxPath: 'box1InterestIncome', value: '1.39' },
                { documentHash: 'sha256-int-05', boxPath: 'box1InterestIncome', value: '1.39' },
                { documentHash: 'sha256-int-06', boxPath: 'box1InterestIncome', value: '1.39' },
                { documentHash: 'sha256-int-07', boxPath: 'box1InterestIncome', value: '1.39' },
                { documentHash: 'sha256-int-08', boxPath: 'box1InterestIncome', value: '1.39' },
                { documentHash: 'sha256-int-09', boxPath: 'box1InterestIncome', value: '1.39' },
                { documentHash: 'sha256-int-10', boxPath: 'box1InterestIncome', value: '1.39' },
            ],
            rule: '1040 line 2b',
        }
        assertEq(aggregateLine.sources.length, 10)
        assertEq(aggregateLine.value, 1390n)
        const roundOfSum = assertNotNullish(
            applyWholeDollarElection(true)([aggregateLine])[0],
            'the projection of a one-line report must have a line 0').value
        // $14 — the amount the IRS instructs the taxpayer to enter.
        assertEq(roundOfSum, 1400n)

        // The forbidden way: round each of the ten amounts FIRST, then add.
        const perItemLines = [
            electionTestLine('sha256-int-01')('1.39')(139n),
            electionTestLine('sha256-int-02')('1.39')(139n),
            electionTestLine('sha256-int-03')('1.39')(139n),
            electionTestLine('sha256-int-04')('1.39')(139n),
            electionTestLine('sha256-int-05')('1.39')(139n),
            electionTestLine('sha256-int-06')('1.39')(139n),
            electionTestLine('sha256-int-07')('1.39')(139n),
            electionTestLine('sha256-int-08')('1.39')(139n),
            electionTestLine('sha256-int-09')('1.39')(139n),
            electionTestLine('sha256-int-10')('1.39')(139n),
        ]
        assertEq(perItemLines.length, 10)
        const sumOfRounds = applyWholeDollarElection(true)(perItemLines)
            .reduce((total, projected) => total + projected.value, 0n)
        // $10 — thirty-nine cents lost ten times over.
        assertEq(sumOfRounds, 1000n)

        // Name the SIZE of the divergence, not merely one side of it: $4.
        assertEq(roundOfSum - sumOfRounds, 400n)
        assert(roundOfSum !== sumOfRounds, 'round(sum) must diverge from sum(round) at whole dollars')
    },
}
