// Runs the two `generation` rules over the SAME chain of amendments and prints
// where they part. This is the harness behind Finding 1 of
// ../effects-opportunity-analysis.md, and it exists so the finding is MEASURED
// rather than argued from a reading of two functions.
//
// The demo's flow is what the chain models: after the first store a subject has
// exactly one head (demo/entry.js:337-341 filters out superseded revisions), and
// that single head is what is passed as `parents`.
//
// Usage, from anywhere:
//   node .planning/reports/effects-opportunity-harness/generation-divergence.mjs
const upstream = parents => parents.length === 0 ? 0 : 1 + parents.reduce((m, p) => Math.max(m, p.generation), 0)
const demo     = parents => parents.length   // demo/lib/store.js:114 — `previous.length`

// The demo's flow: after the first store, a subject has exactly ONE head, and that head
// is what demo/entry.js:338-341 passes as `parents`.
const chainCorrect = [], chainDemo = []
for (let i = 0; i < 6; i++) {
    const upParents = i === 0 ? [] : [chainCorrect[i - 1]]
    const dmParents = i === 0 ? [] : [chainDemo[i - 1]]
    chainCorrect.push({ generation: upstream(upParents) })
    chainDemo.push({ generation: demo(dmParents) })
}
console.log('write │ upstream │ demo │')
console.log('──────┼──────────┼──────┼')
chainCorrect.forEach((c, i) => {
    const d = chainDemo[i].generation
    console.log(`  ${i + 1}   │    ${String(c.generation).padEnd(5)} │  ${String(d).padEnd(3)} │ ${c.generation === d ? 'agree' : 'DIVERGE'}`)
})
// And what upstream's own rule yields when fed the demo's stored data:
const fedDemo = []
for (let i = 0; i < 6; i++) { fedDemo.push({ generation: upstream(i === 0 ? [] : [chainDemo[i - 1]]) }) }
console.log('\nupstream rule applied to the demo\'s OWN stored parents:',
    fedDemo.map(r => r.generation).join(', '))
console.log('a correctly-written chain would read:                  ',
    chainCorrect.map(r => r.generation).join(', '))
console.log('the demo writes:                                      ',
    chainDemo.map(r => r.generation).join(', '))
