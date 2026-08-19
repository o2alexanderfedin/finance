import { pure, step } from 'functionalscript/fjs/effects/module.f.mjs'
import { financeMcpServer } from './server/module.f.js'

/** @import { NodeProgram } from 'functionalscript/fjs/effects/node/module.f.mjs' */

/**
 * `options.args[0]` is the CAS/Evo store home path an invoker supplies —
 * Plan 03's `claude mcp add` registration always passes the absolute repo
 * root; the `?? '.'` fallback only matters for an ad hoc `npm start` /
 * `fjs r` invocation with no argument. A `.f.js` module cannot call
 * `process.cwd()` (impure) and `options.home` is the OS home directory, not
 * a project path — see `fjs/server/module.f.js` for detail.
 * @type {NodeProgram}
 */
export const main = options => step(financeMcpServer(options.args[0] ?? '.'), () => pure(0))
