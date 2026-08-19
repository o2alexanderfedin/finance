import { exitStep } from 'functionalscript/fjs/effects/node/module.f.mjs'
import { financeMcpServer } from './server/module.f.js'

/** @import { NodeProgram } from 'functionalscript/fjs/effects/node/types.js' */

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
