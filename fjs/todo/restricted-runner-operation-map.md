# The restricted runner's operation map

Status: **design note, settled.** Not an upstream item — see [Not an fjs
gap](#not-an-fjs-gap) for why the file that used to sit here was withdrawn.

Companion to [implement-mcp-server.md](./implement-mcp-server.md), which specifies the
runner itself. This file records *why the map is shaped the way it is*, because the
obvious shape is wrong in a way that is invisible at review time.

## Not an fjs gap

This file previously claimed `match` "has no notion of a partial `OperationMap`" and
that the raw `TypeError` on an absent operation was an fjs defect to upstream. Both were
wrong, and the correction matters enough to record so it is not re-derived.

**Every fjs dispatch map is total by construction.** All three are mapped types over the
operation union:

```ts
OperationMap<O, R>      = { readonly [K in O[0]]: (...payload) => R }              // match
ToAsyncOperationMap<O>  = { readonly [K in O[0]]: (...payload) => Promise<…> }     // asyncRun
MemOperationMap<O, S>   = { readonly [K in O[0]]: (...payload) => (state) => […] } // mock run
```

and every runner constrains the effect to a *subset* of the map — `match` and mock's `run`
take `<O1 extends O, T>(e: Effect<O1, T>)`, `asyncRun` pairs `Effect<O, T>` with
`ToAsyncOperationMap<O>`. **The map defines the operation universe; effects must fit inside
it.** Partiality is not missing from fjs; the design has no place for it, and we do not
need it.

**Throwing on an absent command is fine.** Refusal reaching `fjs_run` as an exception costs
nothing — that boundary must catch anyway, since an agent-authored program can throw for a
hundred unrelated reasons. The only concrete complaint was that the old message did not
name the operation, and 0.41.0 fixed that too.

The one genuine fjs bug in this area was unrelated to partiality: `map[command]` was an
ordinary property lookup, so it resolved inherited `Object.prototype` members —
`__defineGetter__`, `constructor`, `toString` — and invoked them with the payload. Reported
as [functionalscript#1419](https://github.com/functionalscript/functionalscript/pull/1419).

## Fixed upstream in 0.41.0

`match` now does an own-property lookup and names the refused command:

```js
const handler = at(command)(map)
assert(handler !== null, command)
return ['cont', handler(...payload), continuation]
```

`at` (`fjs/types/object`) is `getOwnPropertyDescriptor`-based, so the prototype chain is
never consulted. Verified against 0.41.0 — `fetch`, `__defineGetter__`, `constructor`, and
`toString` all now throw, and permitted operations still dispatch. The `__defineGetter__`
escalation (install a getter for a denied command, then call it) is closed with them.

**Two consequences for our runner:**

1. **We no longer need our own `Object.hasOwn` guard.** fjs does the own-property lookup.
   A null-prototype map is still cheap defence in depth and worth keeping, but it is no
   longer load-bearing.
2. **The thrown value is a bare string, not an `Error`.** `assert` is
   `(v, msg) => { if (!v) throw msg }`, so `catch (e)` yields `e === 'fetch'` and
   `e.message` is `undefined`. Formatting `operation not permitted: <command>` means using
   the caught value directly — code reaching for `e.message` gets `undefined`, and a
   `catch (e) { if (e instanceof Error) … }` branch silently misses every refusal.

## The trap: do not whitelist `FileCasOperation`

The plan describes the runner as "an `OperationMap` holding only whitelisted CAS/Evo
operations." Read literally — *the operations CAS needs* — that yields:

```ts
export type FileCasOperation = ReadBytes | Mkdir | Readdir | Access | Rename
                             | Rm | RandomInt | Now | CreateExclusive | WriteBytes | Stat
```

Raw filesystem mutation: `Rm`, `WriteBytes`, `Rename`, `Mkdir`, on any path. A program
holding those can delete or overwrite anything the server process can reach, while the map
*looks* locked down — nothing in it is named `fetch` or `exec`, so the mistake survives
review.

This is the single most likely way to build the sandbox wrong, and it is not hypothetical:
it is what the phrase "whitelisted CAS/Evo operations" means if taken at face value.

## The shape that is correct

Security by **construction**, not subtraction. Do not start from `NodeOp` and remove
dangerous entries — that fails open on anything forgotten. Define a narrow vocabulary and
implement it totally, which fails closed.

`Cas<O>` is already generic in its underlying operation set and exposes only three
semantic methods:

```ts
export type Cas<O extends Operation> = {
    readonly read:  (hash: Vec) => List<O, IoResult<Vec>>
    readonly write: <O1 extends Operation>(payload: List<O1, IoResult<Vec>>) => Effect<O | O1, IoResult<Vec>>
    readonly list:  () => Effect<O, readonly Vec[]>
}
```

`FileCas` is merely `Cas<FileCasOperation>` — the filesystem is one *implementation*
choice, not part of the interface. So:

- The program's vocabulary is a purpose-built **semantic** operation set — `casRead`,
  `casWrite`, `casList`, `evoHead`, … — and nothing else. This is exactly the standing
  requirement *"Define Effects for CAS — the effect vocabulary an executed program may
  express"*, and this file is why that requirement is load-bearing rather than a
  formality: it is what stands between the whitelist and raw `rm`.
- Filesystem operations stay **server-side**, inside the handlers. They never appear in
  the program's operation set, so no program can name them.
- The runner's map is a **total** `ToAsyncOperationMap<CasOp>` over that vocabulary.
  Nothing from fjs is required to build it.

Whether `casWrite` is in the vocabulary at all depends on open question 5 (result
disposition). If results are returned inline, the program's vocabulary can be read-only.

## The two things actually required

1. **A total map over the narrow vocabulary.** Type-level containment: a program typed
   `(args) => Effect<CasOp, T>` cannot express an operation outside it, so `tsc` rejects it
   before the blob is ever stored. This is also why the entry point convention (open
   question 6) is a security decision and not a naming one — typing programs as
   `NodeProgram` would declare `Fetch | Http | Fs | Forever` as expressible.
2. **Catching and reporting the refusal.** A stored blob is arbitrary JS and can emit any
   `command` string regardless of what its types claim; the type system does not reach
   across CAS. Since 0.41.0 the *detection* is fjs's — `at` + `assert` — so what remains is
   ours at the `fjs_run` boundary: catch, and render the caught **string** as
   `operation not permitted: <command>` in an `errorResult`. Do not reach for `e.message`
   (see above). A null-prototype map remains worthwhile as defence in depth.

## Testing

Still write these, even though 0.41.0 closes the hole upstream — they are regression cover
for *our* refusal path, and they pin behaviour we now depend on rather than merely hope for.

The refusal proof must include the inherited names — `constructor`, `toString`, `valueOf`,
`hasOwnProperty`, `__defineGetter__` — not only `fetch`/`readFile`/`exec`. A suite testing
only genuinely-absent commands would have passed while the prototype path was wide open.

Add one adversarial case specifically: a `__defineGetter__` step that installs a getter for
a denied command, followed by a call to that command. It must still be refused. That tests
the security property rather than the error message.

Assert on the reported text (`operation not permitted: fetch`), not on the raw throw — that
covers our string-not-`Error` handling, which is the part most likely to regress.
