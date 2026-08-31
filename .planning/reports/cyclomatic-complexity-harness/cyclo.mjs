// Cyclomatic complexity (McCabe) over the repo's own `.f.js` modules.
//
// Tokenised with `functionalscript/fjs/js/tokenizer` — the language's own
// tokenizer, already a dependency here, so no new one is added and a `?` or
// `||` inside a string or a comment is never miscounted the way a regex
// sweep would miscount it.
//
// CC = 1 + the decision tokens ESLint's own `complexity` rule counts:
// if / for / while / do / case / catch / `?:` / `&&` / `||` / `??`.
// `?.` is a distinct token kind and is NOT counted, matching ESLint.
//
// Attribution is per TOP-LEVEL BINDING (`const x =` / `export const x =` at
// column 1), not per syntactic function. In this codebase those coincide:
// a module-level binding is a (usually curried) arrow, and the nested arrows
// inside it are that definition's own branching, which is what a reader
// weighing "how hard is this to follow" wants counted together.
import { tokenize } from 'functionalscript/fjs/js/tokenizer/module.f.mjs'
import { toArray } from 'functionalscript/fjs/types/list/module.f.mjs'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Resolved from this file, not from the caller's cwd, so the harness answers
// the same number wherever it is run from.
const fjsRoot = fileURLToPath(new URL('../../../fjs', import.meta.url))

const DECISION = new Set(['if', 'for', 'while', 'do', 'case', 'catch', '?', '&&', '||', '??'])

const walk = dir => readdirSync(dir).flatMap(name => {
    const p = join(dir, name)
    if (name === 'node_modules' || name === '.git') return []
    return statSync(p).isDirectory() ? walk(p) : (p.endsWith('.f.js') ? [p] : [])
})

const rel = p => p.slice(fjsRoot.length - 3)

const bindings = []
const files = []
for (const file of walk(fjsRoot).sort()) {
    const text = readFileSync(file, 'utf8')
    const lines = text.split('\n')
    const bannerIdx = lines.findIndex(l => l.includes('── Tests'))
    const proofIdx = lines.findIndex(l => l.startsWith('export const proof'))
    const cut = 1 + (bannerIdx !== -1 ? bannerIdx : (proofIdx !== -1 ? proofIdx : lines.length))

    const starts = []
    lines.forEach((l, i) => {
        const m = /^(?:export )?const ([A-Za-z0-9_$]+)\s*=/.exec(l)
        if (m !== null) starts.push({ line: i + 1, name: m[1], cc: 1, file: rel(file), proof: i + 1 >= cut })
    })

    const tokens = toArray(tokenize([...text].map(c => c.codePointAt(0)))(file))
    let fileCc = 1
    let shippedCc = 1
    let i = -1
    for (const { token, metadata } of tokens) {
        if (!DECISION.has(token.kind)) continue
        fileCc += 1
        if (metadata.line < cut) shippedCc += 1
        while (i + 1 < starts.length && starts[i + 1].line <= metadata.line) i += 1
        if (i >= 0) starts[i].cc += 1
    }
    files.push({ file: rel(file), cc: fileCc, shipped: shippedCc, bindings: starts.length })
    bindings.push(...starts)
}

const stats = (label, rows, key = 'cc') => {
    const v = rows.map(r => r[key]).sort((a, b) => a - b)
    const q = p => v[Math.min(v.length - 1, Math.floor(v.length * p))]
    const over = t => v.filter(x => x > t).length
    console.log(`\n=== ${label} (n=${v.length}) ===`)
    console.log(`mean ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)}   median ${q(0.5)}   p90 ${q(0.9)}   p99 ${q(0.99)}   max ${v[v.length - 1]}`)
    console.log(`>10: ${over(10)}   >15: ${over(15)}   >20: ${over(20)}   >30: ${over(30)}   >50: ${over(50)}`)
}

const top = (label, rows, key, n) => {
    console.log(`\n--- ${label} ---`)
    for (const r of [...rows].sort((a, b) => b[key] - a[key]).slice(0, n)) {
        console.log(`  ${String(r[key]).padStart(4)}  ${r.file}${r.line === undefined ? '' : ':' + r.line}  ${r.name ?? ''}`)
    }
}

const shipped = bindings.filter(b => !b.proof)
const proofs = bindings.filter(b => b.proof)
stats('shipped top-level definitions', shipped)
stats('proof top-level definitions', proofs)
stats('per module, shipped code only', files, 'shipped')
stats('per module, whole file', files, 'cc')
top('most complex shipped definitions', shipped, 'cc', 15)
top('most complex modules (shipped only)', files, 'shipped', 10)
console.log(`\nmodules ${files.length}, top-level definitions ${bindings.length} (${shipped.length} shipped, ${proofs.length} proof)`)
