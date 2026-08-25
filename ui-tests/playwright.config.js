/**
 * Browser automation for the hand-entry page.
 *
 * ## Why this is a separate npm package
 *
 * A browser driver is a large dependency with a downloaded binary behind it,
 * and the shipped `finance` package must not carry either. `AGENTS.md` puts
 * any dependency behind every owner's approval; the approval given on
 * 2026-08-20 was explicitly *"as a separate npm package"*, so the root
 * `package.json` is untouched and nothing under `fjs/` can import anything
 * from here. `npm test` at the root still runs `tsc` plus the proofs and knows
 * nothing about this directory.
 *
 * ## Why a real browser and not a DOM shim
 *
 * `demo/entry.js` is the one file in this project no proof can reach: it
 * touches `document`, `window` and `indexedDB`. A hand-written shim would test
 * the shim's idea of those, and the interesting failures — a control that
 * renders but reads back empty, an IndexedDB transaction that resolves in the
 * wrong order, a module graph that fails to load and leaves a white page — are
 * exactly the ones a shim reproduces by accident or not at all.
 *
 * ## Two modes, one set of assertions
 *
 * `npm test` runs headless and parallel — the mode CI uses and the mode that
 * answers "is it broken?". `npm run demo` runs headed, one worker, with a
 * pause between actions, for watching the app work. Only observation differs:
 * the specs, the expectations and the verdict are identical, so a green demo
 * run means exactly what a green headless run means.
 *
 * The demo's own `serve.sh` is the server, unchanged. It stages `demo/`,
 * `fjs/` and `functionalscript/` as siblings with symlinks, which is what the
 * page's relative imports and its import map need. Using it rather than a
 * second static server means the automation exercises the layout a human gets
 * from the documented command, not a special one built for tests.
 *
 * @module
 */
import { defineConfig, devices } from '@playwright/test'

const port = 8123

/**
 * Demo mode: a visible browser, slowed down enough to watch.
 *
 * `npm --prefix ui-tests run demo` — or `DEMO=1` in front of any `playwright
 * test` invocation, which is the more useful form because it composes with
 * `-g` to watch ONE test:
 *
 * ```sh
 * cd ui-tests && DEMO=1 npx playwright test -g "Schedule D"
 * DEMO=1 DEMO_SLOW_MO=1200 npx playwright test -g "the gate refuses"
 * ```
 *
 * The mode changes only how the run is *observed*, never what is asserted —
 * same specs, same expectations, same verdict. A demo mode that skipped or
 * relaxed an assertion would be a worse thing than no demo mode: it would show
 * a person a green run that the real suite would not give them.
 */
const demoMode = process.env.DEMO === '1' || process.env.DEMO === 'true'

/**
 * Milliseconds Playwright pauses before each action in demo mode.
 *
 * **One full second, deliberately.** The point of demo mode is that a person
 * can see WHICH control moved and WHAT changed as a result; anything quick
 * enough to feel efficient is too quick to follow, and a watcher who missed
 * the click has to guess what the app just did. Faster is available for a
 * second viewing — `DEMO_SLOW_MO=400` — and slower for presenting to a room.
 *
 * (A very low value like `40` is a verification trick, not a demo setting: it
 * runs the whole suite under demo's headed, single-worker configuration to
 * prove nothing breaks there, without the wait a real demo pace implies.)
 */
const slowMo = (() => {
    const asked = Number(process.env.DEMO_SLOW_MO ?? '1000')
    return Number.isFinite(asked) && asked >= 0 ? asked : 1000
})()

// Playwright loads this config once in the runner and again in every worker,
// so an unguarded banner prints once per worker plus one. `TEST_WORKER_INDEX`
// is set only inside a worker, which makes its absence the runner.
if (demoMode && process.env.TEST_WORKER_INDEX === undefined) {
    console.info(`ui-tests: DEMO MODE — headed browser, ${slowMo}ms between actions, 1 worker.`)
}

export default defineConfig({
    testDir: '.',
    // A failure here is a real failure. Retrying would turn a genuinely flaky
    // wiring bug — the kind this suite exists to find — into a green run with
    // a note nobody reads.
    retries: 0,
    fullyParallel: false,
    // `fullyParallel: false` serializes tests WITHIN a file; separate files
    // still run on separate workers. That is right for a headless run and
    // wrong for a watched one — four browser windows opening at once is not
    // something a person can follow. One worker in demo mode, so the run is a
    // single window telling one story from start to finish.
    //
    // Spread rather than `workers: demoMode ? 1 : undefined`: this package
    // type-checks under `exactOptionalPropertyTypes`, where an explicit
    // `undefined` is NOT the same as an absent key, and Playwright's own type
    // says `string | number`. Absent means "use the default"; spreading `{}`
    // is how a key stays genuinely absent without a cast.
    ...(demoMode ? { workers: 1 } : {}),
    // Every action pays `slowMo`, so the default 30s budget stops being a
    // measure of the app and starts being a measure of the delay. The suite's
    // longest test drives ~50 actions; at 500ms that is 25s of pure pause
    // before the app does anything at all.
    timeout: demoMode ? 300_000 : 30_000,
    expect: { timeout: demoMode ? 15_000 : 5_000 },
    reporter: [['list']],
    use: {
        baseURL: `http://localhost:${port}`,
        trace: 'retain-on-failure',
        headless: !demoMode,
        launchOptions: demoMode ? { slowMo } : {},
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: `sh ../demo/serve.sh ${port}`,
        url: `http://localhost:${port}/demo/entry.html`,
        // In demo mode the same server is usually already up from the previous
        // watch; reusing it keeps the browser the only thing that restarts.
        reuseExistingServer: demoMode,
        stdout: 'pipe',
        stderr: 'pipe',
    },
})
