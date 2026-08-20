# Upstream: `fjs/effects/node` has an `Exec` effect, but no long-lived `Spawn` effect

Status: **FILED UPSTREAM** as [functionalscript#1649](https://github.com/functionalscript/functionalscript/pull/1649) —
`fjs/effects/node/todo/spawn-effect.md`, P3. Upstream tracks issues in `todo/` FILES, not GitHub issues
(its own `AGENTS.md`), so that file *is* the filed issue and the PR is merely how it gets added.
The local workaround below stands until a release ships the effect. Recorded here per AGENTS.md's rule that a local
workaround for an fjs gap must never be silent, even though the workaround (below) is
small and does not block progress.

Target: `functionalscript` `fjs/effects/node/module.f.ts` / `module.js`. Checked against
the version pinned in this repo's `package.json` (`functionalscript ^0.43.1`).

**Re-checked 2026-08-19 against 0.46.1** (`2e9ad76f`), reading `fjs/effects/node/types.ts` and grepping
the whole tree for `spawn`. **Still open, unchanged.** No `Spawn` type, no `'spawn'` key in
`nodeCommandSet` (`fjs/effects/node/module.f.mjs:93-102`), and `Fs` is still `Mkdir | ReadFile |
ReadBytes | Readdir | WriteFile | Rm | Rename | Exec | Access | CreateExclusive | WriteBytes | Stat`.
The only two `spawn` hits in `fjs/` are prose in `emergent_testing/todo/`.

**0.46's effect system makes the shape expressible, which RETIRES THE DEFERRAL.** The deferral read
"file if/when a second caller needs the shape"; the answer is now that the shape is sayable.
`Operation` is `readonly [string, (..._: readonly never[]) => Result<unknown, unknown>]`, and
`CreateServer`/`Listen` already thread an opaque host handle (`Server`, a `Nominal` brand minted by
the runner with `asNominal`) through the effect system — the exact precedent a child-process handle
needs.

**One correction to the sketch below, found by type-checking it rather than reading it.** Every
operation's return must be a `Result`, so `Spawn -> SpawnHandle` and `SpawnEnd -> void` written bare
do NOT type-check at 0.46.1; they must be `IoResult<Child>` and `IoResult<void>`. The corrected
five-operation design (`spawn`/`childWrite`/`childRead`/`childEnd`/`childWait`, `Vec` chunks bounded
at 128 KiB as `readBytes`/`writeBytes` are, `null` for EOF as `Read` already spells it, argv split
rather than a shell string) is in #1649, with two signature questions left open there deliberately.

**Two further corrections, from review on #1649 (2026-08-19) — both falsify the sketch at the bottom
of this file, which is kept only as the record of what was first proposed.**

- **`childWait` cannot answer a number.** Node reports `('exit', code, signal)` with `code === null`
  whenever the child was terminated by a signal, so `IoResult<number>` — and this file's older
  `IoResult<{ code, stderr }>` — cannot represent a real outcome. Upstream now specifies
  `ExitStatus = readonly['exited', number] | readonly['signaled', string]`, both tags in the `ok`
  branch, in `IoError`'s own tagged-pair idiom.
- **`childWrite` must NOT loop over short writes.** Node's `Writable.write()` performs no short
  writes: `false` means the whole chunk is already buffered and the caller must await `'drain'`.
  Looping would resend bytes the child already holds and **duplicate NDJSON frames**. Upstream's own
  `fjs/effects/node/module.mjs:156-175` (`writeAll`) had documented this — *"no retry needed"* — long
  before the sketch was written. **The remedy was already in the module being extended; nobody read
  it.** That is the same defect this repo's anti-pattern table records as *"a note whose remedy is
  wrong"*.

## The gap, precisely

`fjs/effects/node` already has one subprocess primitive — `Exec`:

```ts
export type ExecResult = { readonly stdout: string; readonly stderr: string };
export type Exec = readonly ['exec', (command: string, stdin?: string) => IoResult<ExecResult>];
```

implemented as a thin wrapper over Node's `child_process.exec`: a single shell **command
string**, one optional `stdin` string handed in up front, and a `Promise` that resolves
only once the whole process has exited, with the whole of `stdout`/`stderr` collected. It
is genuinely useful for exactly the shape it supports — "run this, wait for it to finish,
give me everything it printed" — and this plan's local workaround (below) could in
principle have used it for the short-lived `fjs cas add` invocations.

What does **not** exist is a **long-lived, streaming** spawn effect: something that
returns a live process handle a caller can write to incrementally, read incremental output
from, and later close/signal — the shape Node's own `child_process.spawn` provides. `Exec`
cannot express this: it takes one `stdin` string and blocks until exit, so a caller cannot
send a first batch of input, observe a response, then send a second batch before the
process ever terminates. There is no `Spawn`/`Kill`/incremental-`Read`/incremental-`Write`
effect over a child process anywhere in `fjs/effects/node`.

## Why it matters here

DOC-14's Success Criterion 5 requires proving that a **already-running** `finance-mcp`
server notices a store mutation made by a **second, genuinely separate OS process**, without
a restart — explicitly rejecting an in-process simulation as insufficient evidence (see
`05-04-PLAN.md`'s `<the_substance>`). Proving that means:

1. starting the real server as its own long-lived OS process,
2. sending it a first NDJSON batch and reading its response(s),
3. *while it is still running*, writing a revision directly into its store from a
   genuinely separate process,
4. sending the still-running server a second NDJSON batch (`cas_refresh`, then `evo_head`
   again) and reading its response(s),
5. only then closing its stdin and observing a clean exit.

Step 2 through step 4 need the server process to stay alive and interactive across
multiple round trips — exactly what `Exec`'s one-shot, blocking, whole-output contract
cannot provide. So this proof cannot be written as a pure `.f.js` proof through the
existing effect system at all, regardless of `Exec`'s existence.

## Local workaround

`cas-refresh-cross-process.test.js` (repo root), plain impure Node, carrying a
`// @ts-nocheck` pragma as its first line (see the pragma's own leading comment for why:
no `@types/node` — forbidden by AGENTS.md's no-new-dependency rule without owner approval
— and no fjs effect exists that could express this test's control flow either way). It
uses `node:child_process`'s `spawn` throughout — for the long-lived server, and (awaited,
not overlapping with the server) for the short-lived `fjs cas add`
invocations too. Those short-lived calls spawn `node` against an absolute path into this
repo's pinned `node_modules/functionalscript`, **not** `npx`: the package declares its bin
as `fjs`, so `npx functionalscript` could not resolve locally and fell through to npm's
registry-touching resolution path — 84% of the test's wall clock, and the reason it timed
out under the full suite's parallel load. See `cas-refresh-cross-process.test.js`'s
`fjsCliPath` docstring for the measurements.
`Exec` was not used for the latter either, to keep the whole harness in
one consistent, already-impure idiom rather than mixing a `virtual`/real effect-runner
invocation into a file that is impure by necessity anyway. This file is scoped outside the
pure `fjs/` tree, alongside `index.js` and `all.test.js` — the same "root-level entry
points that are plain (impure) JS by necessity" category AGENTS.md already carves out.

## What the upstream fix should look like

Per AGENTS.md: **we are contributors and owners of FunctionalScript**, so a missing
generic capability belongs in fjs itself, not as app-specific glue in this repo. A
`Spawn` effect, sibling to `Exec` rather than a replacement for it (`Exec`'s one-shot shape
stays useful on its own), might look roughly like:

```ts
export type SpawnHandle = Nominal<'SpawnHandle', ..., unknown>;
export type Spawn = readonly ['spawn', (cmd: string, args: readonly string[], opts: { readonly cwd?: string; readonly env?: Readonly<Record<string, string>> }) => SpawnHandle];
export type SpawnWrite = readonly ['spawnWrite', (handle: SpawnHandle, data: Vec) => IoResult<void>];
export type SpawnRead = readonly ['spawnRead', (handle: SpawnHandle) => IoResult<Vec | null>]; // null at EOF
export type SpawnEnd = readonly ['spawnEnd', (handle: SpawnHandle) => void]; // close stdin
export type SpawnWait = readonly ['spawnWait', (handle: SpawnHandle) => IoResult<{ readonly code: number; readonly stderr: string }>];
```

**This sketch is superseded and two of its five lines are now known wrong** (see the corrections
above): `spawnEnd -> void` does not type-check, and `spawnWait -> IoResult<{code, stderr}>` cannot
represent a signalled child. It is kept as the record of the first proposal — #1649 carries the
design that survived review.

mirroring the existing `Func<...>`-shaped effects (`ReadBytes`/`WriteBytes`'s
offset-and-size-bounded read/write pair is the closest existing precedent for an
incremental, handle-based I/O effect) rather than `Exec`'s single blocking call. An
argv-array `cmd`/`args` split (not a shell command string) would also close a minor
injection-shaped rough edge `Exec` currently has, though that is a secondary concern here,
not the primary gap. This sketch is illustrative, not a committed signature — fjs's own
maintainers have not reviewed it.

## Upstreaming

**Filed** — see the status line at the top. This section previously said "unscheduled … file the
issue if/when a second caller needs it", which contradicted the header from the day the header was
written. Delete this file once a released FJS version ships a streaming spawn effect and
`cas-refresh-cross-process.test.js` is rewritten as a pure `.f.js` proof on top of it.
