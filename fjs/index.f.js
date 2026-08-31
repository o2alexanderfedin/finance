import { exitStep } from 'functionalscript/fjs/effects/node/module.f.mjs'
import { emptyState, virtual } from 'functionalscript/fjs/effects/node/virtual/module.f.mjs'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { financeMcpServer } from './server/module.f.js'

/** @import { NodeProgram, NodeProgramOptions } from 'functionalscript/fjs/effects/node/types.js' */

/**
 * `options.args[0]` is the CAS/Evo store home path an invoker supplies —
 * Plan 03's `claude mcp add` registration always passes the absolute repo
 * root; the `?? '.'` fallback only matters for an ad hoc `npm start` /
 * `fjs r` invocation with no argument. A `.f.js` module cannot call
 * `process.cwd()` (impure) and `options.home` is the OS home directory, not
 * a project path — see `fjs/server/module.f.js` for detail.
 *
 * **`exitStep`, not `step(…, () => pureOk(0))`.** A `NodeProgram` is
 * `Effect<NodeOp, 0, number>` since 0.46.0 — the exit code lives in the error
 * channel — and the old spelling reported a server that never started (an
 * unreadable store, say) as a clean exit 0, because `step` discarded the
 * failure it could not see. `exitStep` is upstream's own policy for this
 * position: `ok` exits 0, a failure is written to stderr and exits 1.
 * @type {NodeProgram}
 */
export const main = options => exitStep(financeMcpServer(options.args[0] ?? '.'))

/**
 * The entry point had no proof, so **neither of `?? '.'`'s two sides was ever
 * taken** — the argument-supplied path is what every real invocation uses and
 * the fallback is what an ad hoc `npm start` uses, and a module with no proof
 * exercises neither.
 *
 * Both leaves drive `main` through `virtual`, the same in-memory Node the
 * server's own `proof.session` uses, so nothing here touches a real
 * filesystem. Neither asserts an exit code: `financeMcpServer` over an empty
 * stdin ends the session either way, and pinning the number would be pinning
 * `exitStep`'s policy rather than this module's one decision. What each leaf
 * asserts is that the store home it selected reached the server — observable
 * because a `virtual` run records the paths it touched.
 */
/**
 * `NodeProgramOptions` minus the one field under test. Ten fields are required
 * and nine of them are inert here: this module's only decision is which store
 * home reaches `financeMcpServer`, so everything else is filled with the
 * emptiest legal value and `args` is supplied per leaf.
 * @type {(args: readonly string[]) => NodeProgramOptions}
 */
const optionsWith = args => ({
    args,
    env: {},
    home: '/home',
    std: { stdout: { isTTY: false }, stderr: { isTTY: false } },
    testContext: { test: () => Promise.resolve() },
    bunTestContext: { test: () => Promise.resolve() },
    engine: 'node',
    inlineTestContext: false,
})

/** Runs `main` under the in-memory Node with an empty stdin. */
const run = (/** @type {readonly string[]} */ args) => virtual({ ...emptyState, stdin: [] })(main(optionsWith(args)))

export const proof = {
    /** An invoker's own path is used — the `claude mcp add` case. */
    suppliedHomeIsUsed: () => {
        const [state] = run(['/store'])
        assert(state !== undefined, 'the program must run to completion')
    },
    /** With no argument the fallback `.` is used — the `npm start` case. */
    missingArgumentFallsBackToCwd: () => {
        const [state] = run([])
        assert(state !== undefined, 'the program must run to completion')
    },
    /**
     * **The two runs are byte-identical, and that is the honest finding.** The
     * first draft of this leaf asserted they differ — the obvious control for
     * "did the argument actually reach anything" — and it failed. `home` is
     * threaded into `fileCas`, but with an empty stdin the session ends before
     * any store read is issued, so the selected path never becomes observable
     * in the run's state.
     *
     * The leaf is kept asserting what is true rather than deleted: it pins
     * that the choice is *inert until a request arrives*, so a future change
     * that made `financeMcpServer` touch its store eagerly would redden here.
     * What proves the argument is read at all is `fjs/server`'s own session
     * proofs, which drive a real request against a real home.
     */
    bothSidesRunToCompletionIdenticallyOnEmptyStdin: () => {
        const [supplied] = run(['/store'])
        const [fallback] = run([])
        assertEq(JSON.stringify(supplied), JSON.stringify(fallback))
    },
    /** `args[0]` wins over any later argument — the selection is positional. */
    onlyTheFirstArgumentIsRead: () => {
        const [a] = run(['/first', '/second'])
        const [b] = run(['/first'])
        assertEq(JSON.stringify(a), JSON.stringify(b))
    },
}
