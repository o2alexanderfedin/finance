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

export default defineConfig({
    testDir: '.',
    // A failure here is a real failure. Retrying would turn a genuinely flaky
    // wiring bug — the kind this suite exists to find — into a green run with
    // a note nobody reads.
    retries: 0,
    fullyParallel: false,
    reporter: [['list']],
    use: {
        baseURL: `http://localhost:${port}`,
        trace: 'retain-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: `sh ../demo/serve.sh ${port}`,
        url: `http://localhost:${port}/demo/entry.html`,
        reuseExistingServer: false,
        stdout: 'pipe',
        stderr: 'pipe',
    },
})
