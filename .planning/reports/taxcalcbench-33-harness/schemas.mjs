// @ts-nocheck
//
// Phase 33 harness. NOT part of the engine and NOT typechecked, for the same
// reason the root-level gate suites are not: it reads the filesystem, which
// needs `@types/node`, and AGENTS.md forbids adding a dependency for it.
// Dumps every dialect's schema field names, by importing each module and
// reading its exported `*Schema` object. Scratch only.
import { readdirSync } from 'node:fs'
const R = process.env.FINANCE_ROOT ?? new URL('../../..', import.meta.url).pathname
const dir = R + '/fjs/document'
for (const d of readdirSync(dir).sort()) {
    let m
    try { m = await import(dir + '/' + d + '/module.f.js') } catch (e) { console.log('###', d, 'IMPORT FAIL', String(e).slice(0, 120)); continue }
    const schemaKey = Object.keys(m).find(k => /Schema$/.test(k))
    const dialect = m.dialect ?? '(none)'
    if (schemaKey === undefined) { console.log('###', d, dialect, '(no *Schema export)', Object.keys(m).filter(k => k !== 'proof').join(',')); continue }
    const s = m[schemaKey]
    console.log('###', d, '|', dialect, '|', Object.keys(s).join(' '))
}
