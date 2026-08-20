// @ts-nocheck
//
// Phase 33 harness. NOT part of the engine and NOT typechecked, for the same
// reason the root-level gate suites are not: it reads the filesystem, which
// needs `@types/node`, and AGENTS.md forbids adding a dependency for it.
// Runs every mapped profile and document through its dialect's own
// `validate`, so nothing in the run rests on a document the engine would
// have rejected at the door.
import { readFileSync, readdirSync } from 'node:fs'
import { mapCase } from './map.mjs'
const R = process.env.FINANCE_ROOT ?? new URL('../../..', import.meta.url).pathname
const HERE = process.env.BENCH_ROOT ?? '.'
const DATA = HERE + '/tax-calc-bench/tax_calc_bench/ty24/test_data'

const profileM = await import(R + '/fjs/return/profile/module.f.js')
const dialects = {}
for (const d of readdirSync(R + '/fjs/document')) {
    const m = await import(R + '/fjs/document/' + d + '/module.f.js').catch(() => undefined)
    if (m?.dialect !== undefined && typeof m.validate === 'function') { dialects[m.dialect] = m.validate }
}
dialects['vnd.fjs.return_profile'] = profileM.validate

let bad = 0
for (const name of readdirSync(DATA).sort()) {
    const j = JSON.parse(readFileSync(DATA + '/' + name + '/input.json', 'utf8'))
    const m = mapCase(name, j)
    const docs = [m.inputs.profile, ...Object.entries(m.inputs).filter(([k]) => k !== 'profile').flatMap(([, x]) => x)]
    for (const d of docs) {
        const validate = dialects[d.value.dialect]
        if (validate === undefined) { console.log('NO VALIDATOR', name, d.value.dialect); bad++; continue }
        const [tag, err] = validate(d.value)
        if (tag !== 'ok') {
            bad++
            console.log('INVALID', name, d.value.dialect, '::', JSON.stringify(err).slice(0, 260))
        }
    }
}
console.log(bad === 0 ? 'ALL DOCUMENTS VALIDATE' : bad + ' invalid')
