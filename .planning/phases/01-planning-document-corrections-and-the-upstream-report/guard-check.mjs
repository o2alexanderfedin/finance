// The whitelist as the runner would build it: a plain object with one permitted op.
const map = { casRead: (h) => `bytes:${h}` }

const probes = ['casRead', 'fetch', 'constructor', '__defineGetter__', 'toString', 'valueOf']
console.log('guard behaviour on a PLAIN-OBJECT whitelist')
console.log('command            | in    | !==undef | hasOwn')
for (const c of probes) {
  const a = c in map
  const b = map[c] !== undefined
  const d = Object.hasOwn(map, c)
  console.log(`${c.padEnd(18)} | ${String(a).padEnd(5)} | ${String(b).padEnd(8)} | ${d}`)
}

// Does the `in` guard actually let a non-whitelisted op dispatch?
const guardedIn = (m) => (cmd, ...args) => {
  if (!(cmd in m)) return ['refused', cmd]
  return ['cont', m[cmd](...args)]
}
console.log('\n--- `in` guard vs __defineGetter__ ---')
try {
  const r = guardedIn(map)('__defineGetter__', 'pwned', () => { throw new Error('ARBITRARY CODE RAN') })
  console.log('guard verdict:', r[0], '(expected "refused" if the guard were correct)')
  console.log('getter installed on the whitelist object:', Object.hasOwn(map, 'pwned'))
  try { map.pwned } catch (e) { console.log('reading it →', e.message) }
} catch (e) { console.log('threw:', e.message) }

console.log('\n--- Object.hasOwn guard, same attack ---')
const guardedOwn = (m) => (cmd, ...args) => {
  if (!Object.hasOwn(m, cmd)) return ['refused', cmd]
  return ['cont', m[cmd](...args)]
}
const map2 = { casRead: (h) => `bytes:${h}` }
console.log('verdict:', guardedOwn(map2)('__defineGetter__', 'pwned', () => {})[0])
console.log('polluted:', Object.hasOwn(map2, 'pwned'))
