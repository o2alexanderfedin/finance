/**
 * PROV-07's anti-hardcoding kill condition: `classifyRunOutcome` and the
 * `RunOutcome` type it produces — the mechanism that actually refuses a
 * report program that computed nothing from any stored document, the shipped
 * defeat of `() => pure({ line16: 9137 })`.
 *
 * ## Where this fits
 *
 * `fjs/report/` holds all three PROV-07 mechanisms together: `line`
 * (`fjs/report/line/module.f.js`, the traceability type), `audit`
 * (`fjs/report/audit/module.f.js`, the REPORTED numeric-literal count), and
 * this module, the guard — the one of the three that actually refuses a
 * program rather than merely describing or counting it. `classifyRunOutcome`'s
 * only type dependency is `Read` from `fjs/exec` — no CAS, no MCP, no
 * effects — so Plan 09-06 moved it here out of
 * `fjs/server/fjs_run/module.f.js`, the 1400+-line run-orchestration/MCP-tool
 * module it used to be a buried, private detail of. `fjs_run` now imports
 * {@link classifyRunOutcome} from here instead of defining it, and its own
 * header carries only a pointer.
 *
 * ## PROV-07's anti-hardcoding design, in plain words
 *
 * The premise of this whole project is that the agent does not tell you the
 * answer — it writes a program that COMPUTES the answer, which you can read,
 * re-run, and check.
 *
 * An agent writing that program can cheat, and the cheat is nearly invisible:
 *
 * ```js
 * export const report = ctx => () => ctx.pure({ line16: 9137 })
 * ```
 *
 * That is a valid program. It compiles, it returns a plausible tax figure, and
 * it satisfies essentially every rule one would think to write. It is also a
 * lie: the model recalled a number from training data and dressed it in
 * program's clothing. Nothing was computed from any actual document. PROV-07
 * names this program specifically, because it "satisfies every other criterion
 * while defeating the entire thesis."
 *
 * Three mechanisms catch it, and they do different jobs.
 *
 * ### 1. The zero-read kill condition — {@link classifyRunOutcome}
 *
 * Look at what the program TOUCHED, not at what it says. A guest gets a tiny
 * read-only vocabulary (the frozen four in `fjs/guest/module.f.js`), and
 * `interpret` records every read actually dispatched — not declared, not
 * imported: dispatched. If that list is empty, the run is refused.
 *
 * That is the whole rule. A report about stored documents that opened none of
 * them did not compute; it recited. The fake program above never dispatches a
 * read, so its list is empty and it dies. Nothing here needs tuning: no
 * "suspicious number" detector, no threshold, no heuristic anyone must trust.
 * Just: did you look at anything?
 *
 * ### 2. The two counts in the response — `readCount` and `literalCount`
 *
 * Show the user the evidence rather than only acting on it. Every run returns
 * how many documents it read and how many numbers are written literally in its
 * source.
 *
 * `readCount` is derived from the SAME observed-read set the kill condition
 * uses, so there is no second source of truth that could disagree with the
 * first.
 *
 * `literalCount` is REPORTED and never enforced, deliberately. Real programs
 * contain numbers — a zero, an index, a rate — so refusing on literals would
 * reject honest work and degenerate into an argument about thresholds. But a
 * report claiming a large figure from 1 read and 40 literals smells, and now
 * that is visible. Making the count honest was the fiddly part: in
 * `line16: 9137` exactly ONE number must count, since the `16` in `line16` is
 * part of a name, not a value — likewise digits inside strings, template
 * literals, and comments. `fjs/report/audit/module.f.js` proves each of those
 * cases separately rather than as one combined check, because a combined check
 * that totals correctly can hide two errors that cancel.
 *
 * ### 3. The perturbation gate, and why it needs a control leg
 *
 * If the answer really came from the documents, changing a document must change
 * the answer. So: store documents, run, change one box, run again — the output
 * must MOVE. A program that computed will move; a program with the answer baked
 * in returns 9137 no matter what happens to the store.
 *
 * The control leg is the part that is easy to skip and is the actual point.
 * Running only the real program proves little: the output might have moved for
 * some incidental reason, and a green test cannot tell you it passed for the
 * reason you think. So the SAME test runs the fake program through identical
 * steps and asserts its output does NOT move:
 *
 * - real program, document changed -> output moves    (it computed)
 * - fake program, document changed -> output frozen   (it recited)
 *
 * Together they show the test can distinguish the two cases; either alone
 * cannot. Phase 6 of this project learned that the hard way — a test asserting
 * a security check ran in the right ORDER passed under both orderings. Green
 * and meaningless. A control leg is the cheap insurance.
 *
 * ### The failure this rule already had, kept here as a warning
 *
 * All of the above was built and every test passed — while the kill condition
 * lived in TWO places inside `fjs/server/fjs_run/module.f.js`: the shipped
 * path in `executeRun`, and a near-identical copy inside a test-only helper
 * (`runExecuteRunViaFixture`). Every proof exercised the copy. The shipped
 * rule had no coverage at all.
 *
 * Reading cannot show you that. Only breaking the shipped code on purpose and
 * checking whether anything screams can: when that was done, all 258 tests
 * stayed green, and the gate was decorative. Plan 09-05 fixed it by making the
 * rule exist exactly once, shared by both call sites, still inside
 * `fjs_run`. Plan 09-06 (this module) went one step further and gave the rule
 * its own module and its own unit proofs, so a second copy would now have to
 * be conspicuous: importing this module and then not using it. The same
 * mutation that once left the suite green now fails three tests, including
 * one driving a real server process end to end, from this rule's new home
 * (see the proofs below, plus `fjs/server/fjs_run/module.f.js`'s own gate
 * proofs and `fjs-run-integration.test.js`).
 *
 * The uncomfortable footnote: this phase's own context document contained the
 * sentence "a gate built for an adversary that is never actually run against it
 * is a claim, not a proof" — and the phase built one anyway. Writing the
 * principle down enforced nothing. Mutating the shipped code and watching tests
 * fail is what enforced it. If you touch {@link classifyRunOutcome}, mutate it
 * and confirm the suite goes red before you trust it.
 *
 * @module
 */
import { assertEq, assert } from 'functionalscript/fjs/asserts/module.f.js'

/** @import { Read } from '../../exec/module.f.js' */

// ── The rule ─────────────────────────────────────────────────────────────────

/**
 * One report run's outcome: the program's value plus every command
 * `interpret` actually dispatched to reach it, plus the numeric-literal count
 * of its own source text (PROV-07's REPORTED half —
 * `fjs/report/audit/module.f.js`'s `countNumericLiterals`), or a refusal
 * message (whose `reads` is `[]` for a mid-chain refusal — see
 * `fjs/server/fjs_run/module.f.js`'s own header for why). A program whose
 * `interpret` run dispatched ZERO observed reads is never expressed as an
 * `'ok'` outcome — see {@link classifyRunOutcome} below (PROV-07's actual
 * kill condition: "Zero observed CAS reads is an error result").
 * @template T
 * @typedef {{ readonly kind: 'ok', readonly value: T, readonly reads: readonly Read[], readonly literalCount: number } | { readonly kind: 'error', readonly message: string, readonly reads: readonly Read[] }} RunOutcome
 */

/**
 * PROV-07's actual kill condition: a program whose `interpret` run dispatched
 * ZERO observed reads computed nothing from any stored document, and is
 * refused as an error result rather than returned as a silent `'ok'` — this
 * is what defeats `() => pure({ line16: 9137 })`.
 *
 * This is the ONLY place the observed-read count is checked against zero, and
 * the ONLY place the zero-read error message is built. Both `executeRun`
 * (the production path a real `fjs_run` MCP call actually executes) and
 * `runExecuteRunViaFixture` (the test-only decomposition
 * `fjs/effects/node/virtual`'s write/import split requires — see that
 * helper's own header in `fjs/server/fjs_run/module.f.js`) call this SAME
 * function, so mutating this one body is the only way to change the rule
 * either path enforces.
 * @type {(literalCount: number) => (value: unknown, reads: readonly Read[]) => RunOutcome<unknown>}
 */
export const classifyRunOutcome = literalCount => (value, reads) => reads.length === 0
    ? {
        kind: 'error',
        message: `report produced zero observed reads over any stored document (source contains ${literalCount} numeric literal(s)) — a computed report must read at least one stored document`,
        reads: [],
    }
    : { kind: 'ok', value, reads, literalCount }

// ── Tests ────────────────────────────────────────────────────────────────────

export const proof = {
    // An empty reads array is the kill condition's whole trigger — the
    // exact shape a program that never dispatched a real read produces.
    emptyReadsProducesAnErrorOutcome: () => {
        const outcome = classifyRunOutcome(0)('unused', [])
        assertEq(outcome.kind, 'error')
    },
    // A non-empty reads array carries the value, the reads, AND the
    // literalCount straight through — each field asserted individually so a
    // regression localizes to the specific field that broke.
    nonEmptyReadsProducesAnOkOutcomeCarryingValueReadsAndLiteralCount: () => {
        /** @type {readonly Read[]} */
        const reads = [['casRead', ['some-hash']]]
        const outcome = classifyRunOutcome(3)('the-value', reads)
        assertEq(outcome.kind, 'ok')
        if (outcome.kind === 'ok') {
            assertEq(outcome.value, 'the-value')
            assertEq(outcome.reads.length, 1)
            assertEq(JSON.stringify(outcome.reads[0]), JSON.stringify(reads[0]))
            assertEq(outcome.literalCount, 3)
        }
    },
    // The refusal message names the EXACT literalCount it was constructed
    // with — a wrong literalCount threaded through cannot pass unnoticed.
    refusalMessageNamesTheLiteralCountItWasConstructedWith: () => {
        const outcome = classifyRunOutcome(7)('unused', [])
        assertEq(outcome.kind, 'error')
        if (outcome.kind === 'error') {
            assert(outcome.message.includes('7 numeric literal'), outcome.message)
        }
    },
    // The 'ok' arm's literalCount is exactly the number passed in, not a
    // recomputed or rounded value — asserted independently of the previous
    // leaf's value/reads assertions.
    okArmCarriesLiteralCountThroughUnchanged: () => {
        /** @type {readonly Read[]} */
        const reads = [['evoList', ['false']]]
        const outcome = classifyRunOutcome(42)('value', reads)
        assertEq(outcome.kind, 'ok')
        if (outcome.kind === 'ok') {
            assertEq(outcome.literalCount, 42)
        }
    },
}
