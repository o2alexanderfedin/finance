// Dumps every dialect schema the server actually serves, as JSON text.
//
// This is the harness behind Phase 42's deciding criterion: `toJsonSchema` over
// all 30 dialect schemas must be BYTE-IDENTICAL across the 0.47.0 -> 0.48.0
// bump. Phase 38 is why that criterion exists rather than a green suite — its
// call-site `open()` experiment typechecked, passed, and still moved 47 served
// containers while presenting the smaller diff as proof.
//
// It drives `financeSchemaTool.handle` — the real MCP handler — rather than
// walking `dialectSchemas` itself. Re-deriving the map would let the dump and
// the served path drift apart, and it is the served path the criterion is about.
//
// The dialect list comes from `knownDialects` and is sorted, so the output is
// stable under registration-order changes and two runs can be diffed directly.
//
// Usage, from anywhere:
//   node .planning/reports/fjs-0.48.0-migration-harness/schema-dump.mjs > before.txt
//   <change the dependency>
//   node .planning/reports/fjs-0.48.0-migration-harness/schema-dump.mjs > after.txt
//   diff before.txt after.txt      # must be empty
import { runPure } from 'functionalscript/fjs/effects/module.f.mjs'
import { unwrap } from 'functionalscript/fjs/types/result/module.f.mjs'

// Resolved from this file rather than the working directory, so the harness
// answers the same thing no matter where it is invoked from.
const repoRoot = new URL('../../../', import.meta.url)
const { financeSchemaTool, knownDialects } = await import(
    new URL('fjs/server/finance_schema/module.f.js', repoRoot).href)

const out = []
for (const dialect of [...knownDialects].sort()) {
    const [result] = runPure(financeSchemaTool.handle({ dialect }))
    if (result === undefined) { throw new Error(`no value for ${dialect}`) }
    const first = unwrap(result).content[0]
    if (first === undefined || first.type !== 'text') { throw new Error(`no text for ${dialect}`) }
    out.push(`${dialect}\t${first.text}`)
}
console.error(`dialects: ${out.length}`)
console.log(out.join('\n'))
