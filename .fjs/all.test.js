import { fileURLToPath } from 'node:url'

// FunctionalScript's proof-discovery walker skips dot-directories (e.g. `.git`),
// and this file lives under `.fjs/` — a dot-directory itself. Standing `cwd`
// inside it (and dropping npm's INIT_CWD override) makes the walk start from
// here, so its siblings are still discovered instead of being skipped.
process.chdir(fileURLToPath(new URL('.', import.meta.url)))
delete process.env['INIT_CWD']

await import('functionalscript/fjs/emergent_testing/all.test.js')
