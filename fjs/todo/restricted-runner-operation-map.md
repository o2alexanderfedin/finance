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

**A `TypeError` on an absent command is fine.** Refusal reaching `fjs_run` as an exception
costs nothing — that boundary must catch anyway, since an agent-authored program can throw
for a hundred unrelated reasons. The only concrete complaint was that the message
(`map[command] is not a function`) does not name the operation, and that is ours to fix by
guarding at the boundary, not fjs's to fix by changing `match`.

The one genuine fjs bug in this area is unrelated to partiality: `map[command]` is an
ordinary property lookup, so it resolves inherited `Object.prototype` members —
`__defineGetter__`, `constructor`, `toString` — and invokes them with the payload. Filed
upstream as
[functionalscript#1419](https://github.com/functionalscript/functionalscript/pull/1419).

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
2. **A guard where untyped data enters.** A stored blob is arbitrary JS and can emit any
   `command` string regardless of what its types claim; the type system does not reach
   across CAS. Guard dispatch with `Object.hasOwn` (or build the map with a `null`
   prototype), and turn a miss into `operation not permitted: <command>`. This also closes
   the #1419 prototype hole locally, ahead of any upstream release.

## Testing

The refusal proof must include the inherited names — `constructor`, `toString`, `valueOf`,
`hasOwnProperty`, `__defineGetter__` — not only `fetch`/`readFile`/`exec`. A suite testing
only genuinely-absent commands passes while the prototype path is wide open.

Add one adversarial case specifically: a `__defineGetter__` step that installs a getter for
a denied command, followed by a call to that command. It must still be refused. That tests
the security property rather than the error message.
