import { runEffect } from 'functionalscript/fjs/effects/node/module.js';
import { register } from 'functionalscript/fjs/emergent_testing/module.f.js';
// we need `await` for Playwright.
await runEffect(register);
