import { log } from 'functionalscript/fjs/effects/node/module.f.js'
import { mapStep } from 'functionalscript/fjs/effects/module.f.js'

/** @import { NodeProgram } from 'functionalscript/fjs/effects/node/module.f.js' */

/** @type {NodeProgram} */
export const main = () => mapStep(log('hello world!'), () => 0)
