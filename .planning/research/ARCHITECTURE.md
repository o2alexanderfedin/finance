# Architecture Research

**Domain:** MCP server over content-addressable storage executing agent-authored FunctionalScript programs
**Researched:** 2026-08-03
**Confidence:** HIGH for everything verified against `node_modules/functionalscript@0.40.0` (most of this document); MEDIUM for comparative-systems reasoning behind the subject-model recommendation.

---

## Verification Notes — fjs claims checked against the installed package

Everything below was read or executed against `node_modules/functionalscript@0.40.0`, not recalled. Where PROJECT.md or `todo/plan.md` is confirmed, that is stated; where it needs correcting, that is stated too. This matters because several architectural decisions hinge on details neither planning document currently has.

### Confirmed as written

| Claim | Evidence |
|---|---|
| `match` dispatches through an `OperationMap`, `fjs/effects/module.f.js:282` | Verified verbatim, exact line number, exact body |
| `casMcpHandlers = home => cacheKey => fromRegistry([...casToolRegistry(home)(cacheKey), ...evoToolRegistry(evo(fileCas(sha256)(home))(cacheKey))])` | `fjs/mcp/module.f.js:45` — one-line concat, our server is that array plus one registry |
| Seven CAS+Evo tools exist and are exported | `fjs/mcp/cas`, `fjs/mcp/evo` |
| `toolEntry` / `okResult` / `errorResult` / `fromRegistry` / `mcpStep` / `stdioTransport` / `asyncRun` all exported | `fjs/protocol/mcp/module.f.d.ts`, `fjs/protocol/mcp/stdio/module.f.d.ts`, `fjs/effects/module.js` |
| Heads computed as `hashes − parents` at read time | `headsOf` at `fjs/cas/evo/module.f.js:78` |
| Revision = `{dialect, subject, parents[], snapshot, generation, archived?}` | `revisionSchema`, `fjs/media/revision/module.f.js:46` |
| `generation` guarded by `Number.isSafeInteger` | `checkReferences`, same file |
| `vnd.fjs.revision` → `application/vnd.fjs.revision+json` derived mechanically | `mediaType = \`application/${dialect}+json\`` |
| No financial media formats exist | `fjs/media/` holds only `html`, `json`, `nix`, `revision`, `type` |
| No "evaluate FunctionalScript source" module exists | Confirmed by directory survey |

### Corrections and additions the planning documents do not yet have

These change design decisions, so they are called out rather than buried.

**1. `match`'s partial-map failure is worse than "an opaque `TypeError`."** PROJECT.md and `fjs/todo/implement-mcp-server.md` both describe the gap as `TypeError: map[command] is not a function`. That is true only for commands that do not collide with `Object.prototype`. Executed against the real package:

```
cmd toString        -> "[object Object]"     (silently succeeded)
cmd constructor     -> {}                    (silently succeeded)
cmd valueOf         -> {}                    (silently succeeded)
cmd hasOwnProperty  -> false                 (silently succeeded)
cmd fetch           -> TypeError: map[command] is not a function
```

A program emitting `{ command: 'constructor', … }` against an empty operation map **does not fail at all** — `match` dispatches to the inherited `Object.prototype` method and hands the program its return value. The whitelist is therefore not merely unhelpful on refusal; it is *not total*. Any guard must use `Object.hasOwn`, never `map[command] !== undefined` and never `command in map`. `fjs/cas/evo/module.f.js` already worries about exactly this hazard for subject names (it uses an own-property `at()` lookup, with a comment explaining why), which is the precedent for treating this as a real upstream bug rather than a nicety. **This is a stronger upstream report than the one currently planned.**

**2. `import` is already an effect operation, not something outside the effect system.** `fjs/effects/node/module.f.d.ts:133` declares `Import = ['import', (path: string) => IoResult<Module>]`, part of `NodeOp`, interpreted in `fjs/effects/node/module.js:219` as `asyncTryCatch(() => asyncImport(path))`. Two consequences the plan does not account for:

   - The *host* should reach `import()` through the `import_` effect, not a raw `import()` expression. That keeps `fjs_run` a `.f.js` module and makes it testable — `fjs/effects/node/virtual` implements `import` over an in-memory FS with `JsModule` entries (`virtual/module.f.js:88`), so `fjs_run` is proof-testable end to end with no filesystem. `fjs/todo/implement-mcp-server.md` currently says the server "cannot be proof-tested directly"; that is true of `casMcpServer`, but **not** of `fjs_run`.
   - Whether the *guest* may import is a whitelist decision like any other. It must be excluded — `import` is arbitrary-code-execution-by-name.

   The accepted Week 1 limitation is narrower than stated: it is not "`import()` is outside the boundary," it is "the imported module's **top-level body** runs before any effect is interpreted." Worth stating precisely, because the fix (validate source with `djs/parser` before importing) targets exactly that body.

**3. `import` takes a filesystem path, and the CAS blob is a real file.** `fileCas.url(hash) = join(home, toPath(hash))` (`fjs/cas/module.f.js:210`), i.e. `~/.cas/<a>/<b>/<rest>` — extensionless. Executed checks on Node 23 (CI is Node 26):

   - Importing an extensionless file **works** — Node's module-syntax detection handles it. So `fjs_run` can `import_(cas.url(hash))` directly with no staging step.
   - A CAS blob **cannot resolve bare specifiers**: `import { pure } from 'functionalscript/…'` inside a blob fails with `ERR_MODULE_NOT_FOUND`, because resolution starts at `~/.cas/<a>/<b>/` and walks up to `~/`, which has no `node_modules`. Staging the blob inside the repo tree makes it resolve, and that was verified too.

   This is a **load-bearing, undocumented constraint on the guest program ABI** and it forces a decision (see "Guest ABI" below). It is currently invisible in all three planning documents.

**4. Evo has a built-in content-derived subject idiom.** `resolveSnapshot` (`fjs/cas/evo/module.f.js:225`): with `parents: []` and no explicit `snapshot`, **`subject` must itself be a valid hash**, and it becomes the snapshot —
   `error('subject must be a valid hash when snapshot is omitted and there are no parents')`.
   fjs's own proofs use this shape (`proof.f.js:252`, `mcp/evo/proof.f.js:84`). `evo_add { parents: [], subject: H }` — a two-field call — is the designed-in way to root a document at its own content hash. Directly relevant to open question 2.

**5. A subject can never be renamed.** `validateParentSubjects` (`fjs/cas/evo/module.f.js:207`) rejects any revision whose parent belongs to a different subject. The subject string is baked into every revision blob. There is no ref layer, no alias, no move operation. Choosing a subject name is permanent for the life of that document's history. Also decisive for open question 2.

**6. Three separate 128 KiB caps, all reachable in this project.**

   | Cap | Where | What it blocks |
   |---|---|---|
   | `cas_add` inline content | `fjs/mcp/cas/module.f.js:149` | **Uploading a real PDF through MCP.** Most 1099/bank PDFs exceed 128 KiB. The only route is the `cas` CLI, run by the user. |
   | A single `Vec` (`maxLength`) | `fjs/types/bit_vec` | Buffering any blob whole |
   | One encoded stdio response line | `fjs/protocol/mcp/stdio` | Returning a large report inline; overflow degrades to a `-32603` |

   The first one means "store raw PDF statement bytes" is **not** an MCP-tool operation in v1 — it is a CLI step. That should be designed for, not discovered.

**7. `fjs/effects/mock`'s `run` is a state-threading synchronous interpreter**, `MemOperationMap<O,S>` where entries are `(...payload) => (state) => [state, output]` (`mock/module.f.d.ts:12`). PROJECT.md's paraphrase ("honoring only the effects handler `o` implements") is loose. The shape matters: it is what makes the restricted runner testable without promises, and it is what makes the read-set recording below fall out for free.

**8. `fjs r` calls `unwrap(x).main({ ...options, args })`** (`fjs/module.f.js:46`) — the entry point is `main`, and it receives `NodeProgramOptions`. Confirms the convention, and shows the precedent for **injecting a context object into the guest**.

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  MCP client (ChatGPT / Claude)                    stdio, single user │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ JSON-RPC lines
┌───────────────────────────────▼──────────────────────────────────────┐
│  LAUNCHER  mcp.js (impure, root)  —  run(financeMcpServer)           │
├──────────────────────────────────────────────────────────────────────┤
│  TRANSPORT  stdioTransport ∘ mcpStep(config)  [fjs, reused verbatim] │
├──────────────────────────────────────────────────────────────────────┤
│  TOOL LAYER   fromRegistry([ …casTools, …evoTools, …financeTools ])  │
│   ┌──────────────────┬───────────────────┬────────────────────────┐  │
│   │ cas_* evo_*      │ fjs_run           │ finance_ingest         │  │
│   │ (fjs, unchanged) │ (ours)            │ (ours, thin)           │  │
│   └────────┬─────────┴─────────┬─────────┴───────────┬────────────┘  │
├────────────┼───────────────────┼─────────────────────┼───────────────┤
│            │      EXECUTION SPINE (ours) ─ Track A   │               │
│            │  ┌────────────────▼──────────────────┐  │               │
│            │  │ interpret(map)  restricted runner │  │               │
│            │  │  · own-property guard → refusal   │  │               │
│            │  │  · records read set (provenance)  │  │               │
│            │  └────────┬──────────────────┬───────┘  │               │
│            │  ┌────────▼────────┐  ┌──────▼───────┐  │               │
│            │  │ guest ABI (ctx) │  │ run record   │  │               │
│            │  │ read-only ops   │  │ writer       │  │               │
│            │  └────────┬────────┘  └──────┬───────┘  │               │
├────────────┼───────────┼──────────────────┼──────────┼───────────────┤
│            │           │  FORMATS (ours) ─ Track B   │               │
│            │           │      ┌──────────────────────▼────────────┐  │
│            │           │      │ vnd.fjs.ocr · vnd.fjs.1099int ·   │  │
│            │           │      │ vnd.fjs.run · vnd.fjs.taxparams   │  │
│            │           │      │ (pure: dialect, schema, validate) │  │
│            │           │      └───────────────┬───────────────────┘  │
├────────────┼───────────┼──────────────────────┼──────────────────────┤
│            │           │   fjs STORAGE (reused verbatim)             │
│   ┌────────▼───────────▼──────────────────────▼────────────────────┐ │
│   │  Evo   subjects → head hashes  (in-memory cache over the CAS)  │ │
│   ├────────────────────────────────────────────────────────────────┤ │
│   │  FileCas   ~/.cas/  sha256, 128 KiB chunks, lock-free staging  │ │
│   └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
        ▲
        │  raw PDF bytes >128 KiB  ──  `npx functionalscript cas add <path>`
        │  (out-of-band: the user's shell, NOT an MCP tool — see cap #6)
```

### Component Responsibilities

| Component | Owns | Depends on | Net-new? |
|---|---|---|---|
| **Launcher** (`mcp.js`, root, impure) | Calling `run(financeMcpServer)`. Nothing else. | `fjs/effects/node` | Ours, ~3 lines |
| **Transport / session** | JSON-RPC framing, MCP handshake, line-size fallback | — | fjs, verbatim |
| **Tool layer** | Tool names, rtti arg schemas, `ToolsCallResult` shaping | `fjs/protocol/mcp` | Ours = 2 tools + fjs's 7 |
| **`interpret`** (restricted runner) | Translating a guest `Effect` into a host `Effect`; refusing non-whitelisted commands; recording the read set | `fjs/effects` only | **Ours — the core of the work** |
| **Guest ABI (`ctx`)** | The exact vocabulary a stored program may use: combinators + read-only CAS/Evo operations | `interpret`, `Cas`, `Evo` | Ours — freeze early |
| **Run-record writer** | Turning `(programHash, readSet, result)` into a `vnd.fjs.run` blob and, optionally, an Evo revision | `Cas`, `Evo`, `vnd.fjs.run` | Ours |
| **Format modules** | One `.f.js` per dialect: `dialect`, `mediaType`, rtti `schema`, `validate`, `decodeText`, `proof` | `fjs/media/json`, `fjs/types/rtti` | Ours, pure, zero deps |
| **Evo** | Subject → head hashes; revision read/write with validation | `Cas`, `fjs/effects/memory` | fjs, verbatim |
| **FileCas** | Bytes ↔ hash, streaming, dedup | `fjs/effects/node` | fjs, verbatim |

**The boundary that matters most:** `interpret` depends on `fjs/effects` and *nothing else*. Not on CAS, not on Evo, not on MCP. The whitelist is a parameter. That is what makes the single riskiest component proof-testable on day one with no store, no process, and no server.

---

## Recommended Project Structure

```
mcp.js                          # impure launcher — `claude mcp add` target. ~3 lines.
index.js                        # existing
all.test.js                     # existing

fjs/
├── mcp/
│   ├── module.f.js             # financeMcpServer, financeConfig, handler composition
│   └── tools/
│       ├── run.f.js            # fjs_run tool entry + proof
│       └── ingest.f.js         # finance_ingest tool entry + proof
├── run/                        # ← EXECUTION SPINE (upstreamable as a unit)
│   ├── interpret.f.js          # interpret(map)(effect); refusal; own-property guard
│   ├── abi.f.js                # the guest ctx: combinators + operation constructors
│   ├── whitelist.f.js          # binds ABI commands to a Cas<O>/Evo<O>
│   └── record.f.js             # run record assembly + write-back
├── media/                      # ← FORMATS (mirrors fjs/media layout deliberately)
│   ├── ocr/module.f.js         # vnd.fjs.ocr
│   ├── doc1099int/module.f.js  # vnd.fjs.1099int
│   ├── run/module.f.js         # vnd.fjs.run
│   ├── taxparams/module.f.js   # vnd.fjs.taxparams
│   └── module.f.js             # our dialect-aware `detect`, mirroring fjs/media/module.f.js
├── money/module.f.js           # integer-cents arithmetic (upstreamable — generic)
├── tax/
│   ├── params/2025.f.js        # data, not code
│   └── f1040/module.f.js       # report programs, or their host-side test doubles
├── index.f.js                  # existing
└── todo/                       # existing convention
```

### Structure Rationale

- **`fjs/run/` is one directory because it is one upstream candidate.** AGENTS.md says generic capability goes in its own file/directory so it can move into FunctionalScript later. `interpret` is entirely generic — it knows nothing about finance, CAS, or tax. `todo/plan.md` Week 5 already names "the CAS effects, and `fjs_run` if its shape has settled" as the upstream targets. Putting them under one directory from day one makes that a `git mv`.
- **`fjs/media/<name>/module.f.js` mirrors `fjs/media/revision/module.f.js` exactly.** Same filename, same export names (`dialect`, `mediaType`, `schema`, `validate`, `decodeText`), same neighbouring `proof.f.js`. A dialect that moves upstream then needs no renaming, and a reader who knows `fjs/media/revision` already knows every one of ours.
- **`fjs/money/` is separate from `fjs/tax/`** because exact-cent arithmetic is generic and upstreamable, while brackets are not.
- **`fjs/tax/params/<year>.f.js` is data in a module**, satisfying "tax-year parameters stored as data, keyed by year." A new year is a new file and no engine change.
- **`mcp.js` at the root, not in `fjs/`**, per the Layout constraint. Keep it to the launcher line and nothing more.

---

## Decisions on the Blocking Open Questions

### Open question 5 — `fjs_run` result disposition

> **Recommendation: write the result back to CAS *and* return a bounded inline preview. The write is performed by the `fjs_run` tool handler, not by the program. The guest whitelist stays read-only.**

The question as posed in `todo/plan.md` is a binary — inline, or write-back-and-return-a-hash — and it treats "write back" as implying CAS write access in the whitelist. That implication is the part to reject. There are two writers available, and the plan only considers one:

| Who writes | Whitelist | Provenance guarantee |
|---|---|---|
| The **program**, via a `casWrite` operation | Must include writes | Best-effort — a program can forget, or write something that does not match what it returned |
| The **tool handler**, after `interpret` returns | Stays read-only | **Structural** — every run produces a record; a program cannot opt out |

Success Criterion 3 ("every number traces to a source") and `todo/plan.md`'s own note that "this should be part of `fjs_run`'s contract rather than an accident" both argue for the second. Making the write a property of the *tool* rather than of program discipline is what turns "reproducible if the program was written well" into "reproducible, full stop."

Concretely:

```
fjs_run { hash, args?, subject?, parents? }
  ├─ import_(cas.url(hash))                        [host effect]
  ├─ interpret(whitelist)(module.main(ctx))        [pure]
  │    └─ yields  Result<value, string>  +  the recorded read set
  ├─ encode value as canonical JSON  → cas.write   → resultHash
  ├─ assemble vnd.fjs.run { program, inputs[], result, status }
  │                                    → cas.write → runHash
  ├─ if subject or parents given: evo.add → revision hash
  └─ okResult(JSON { runHash, resultHash, result?, inputs, refused? })
```

`result` is inlined when the encoded response fits comfortably under the stdio line cap (verified cap #6), and omitted with a note otherwise. This is not fence-sitting: the inline copy is a *convenience* over the authoritative record, exactly the way `cas_get` returns metadata always and content conditionally. Both planning documents frame this as either/or; it is not, and the "either" framing is what made it look blocking.

**Why the read set matters here.** Because `interpret` is the only thing that ever touches the guest's operations, it can accumulate every hash the program read. The `inputs[]` field of the run record is therefore *observed*, not declared — the program cannot lie about, or forget to cite, what it read. This was verified working in a prototype run: the host state after interpreting a two-step program came back as `[["h1"]]`, the read set, alongside the result. This is the single highest-leverage structural property in the design and it costs one accumulator.

**Corollary — the whitelist.** With this decision, CAS writes are **out**. See "The restricted runner" below for the full list.

**Subject for the run record.** Do not force a naming decision on the agent. Default (`subject` and `parents` both absent): write the plain blob only, return `runHash`. If `parents` is given, chain onto the previous report head (a recomputation after an amended 1099 — the 1040-X mechanism from PROJECT.md, for free). If `subject` is given, root a new report subject. This makes `fjs_run` useful before the report-versioning story is designed, and complete after.

---

### Open question 2 — Evo subject model

> **Recommendation: one subject per real-world document; the subject string is the cBase32 CAS hash of the document's original artifact. Human-readable labels live *inside* the snapshot, never in the subject. Parsed representations are successive revisions of that subject.**

The second half ("each uploaded document its own subject, parsed representations as revisions") is the plan's own proposed default and it is right. The naming half is where the decision actually is, and the evidence points one way.

**Argument 1 — a subject can never be renamed (verified, finding #5).** `validateParentSubjects` rejects cross-subject parents; the subject is baked into every revision blob; Evo has no ref layer. So `doc/2025/1099-int/chase` is a permanent, uncorrectable assertion. And the classification in that name is exactly what turns out to be wrong: the form is a 1099-OID not a 1099-INT; "chase" is Chase Auto not Chase Bank N.A.; the document is dated 2025 but is for tax year 2024. A misfiled document under a hash-named subject is fixed by adding a revision. Under a path-named subject it is fixed by abandoning the history and starting over, losing the provenance chain that is the entire point.

**Argument 2 — fjs designed the content-derived idiom in (verified, finding #4).** `evo_add { parents: [], subject: H }` where `H` is the artifact's own hash is the *two-field* call; anything else requires an explicit `snapshot`. fjs's own proofs use it. Following the library's happy path costs nothing and means our revision blobs look like fjs's.

**Argument 3 — the comparable systems converged here independently.**

| System | Identity | Human name | Lesson |
|---|---|---|---|
| **Perkeep** | A *permanode*: "really just a signed random number," deliberately carrying **no mutable state**, precisely so it can be consistently nameable | A `set-attribute` claim referencing the permanode | The system closest to Evo's exact problem chose an opaque anchor and layered names as data |
| **Git** | The commit hash; the DAG is the identity | A ref — a *mutable pointer* | Git renames branches only because the name was never the identity. Evo has no ref layer, so a human subject is Git-without-the-rename |
| **Datomic** | Opaque entity id; external keys via `:db.unique/identity` + lookup refs | `:db/ident`, with the explicit documented rule that idents "**should not be used as unique names or ids on ordinary domain entities**" | Stated as a rule, not a preference |
| **IPFS/IPLD** | CID | A separate mutable naming layer (IPNS/DNSLink) | Same split, different vocabulary |

Four systems, four ways of saying: identity is opaque, names are data on top.

**Argument 4 — deduplication is free and it matters here.** Tax documents get downloaded twice, forwarded, re-saved. A content-derived subject means re-uploading the same PDF resolves to the *same* subject — the ingestion tool sees an existing head and can say "already ingested, head is X" instead of silently creating a second parallel history. Under user-facing naming, the same document filed twice under two names is two unrelated histories and a double-counted 1099.

**What this looks like in practice:**

```
subject = <hash of chase-1099int-2025.pdf>          (cBase32)

  rev 0   parents []            snapshot = <that same hash>     gen 0
          ── the raw artifact, added by `evo_add { parents: [], subject: H }`

  rev 1   parents [rev0]        snapshot = <vnd.fjs.ocr blob>   gen 1
          ── what the model actually saw

  rev 2   parents [rev1]        snapshot = <vnd.fjs.1099int>    gen 2
          ── the narrowed, typed document.  label lives in here.

  rev 3   parents [rev2]        snapshot = <corrected 1099int>  gen 3
          ── the amended 1099.  head moves.  rev 2 stays readable.
```

`evo_head(subject)` returns the current best interpretation. Report programs read heads. Corrections, re-classifications, and user edits are all "new revision, old as parent" — PROJECT.md's "all three amendment kinds use one mechanism," now with nothing left to build.

**Where the human name goes.** For v1: a `label` field inside the `vnd.fjs.ocr` / `vnd.fjs.1099int` envelope. Cost: zero new dialects, zero new tools; `evo_list` + a head read per subject recovers every label. Renaming = a new revision, with the rename itself preserved in history — strictly better than a subject rename would have been.

**Growth path, not v1:** if label lookup ever becomes hot (it will not at ~50 documents/year), add one well-known **index subject** whose snapshot is a `vnd.fjs.index` map of `label → subject hash`. Renaming stays a revision; lookup becomes O(1). Deferring this is safe because it is purely additive.

**The one real cost, stated honestly.** "Find all 1099-INTs" becomes: `evo_list` → for each subject `evo_head` → read the head revision → check the snapshot's dialect. That is O(subjects) with a read each. At the scale of one household's tax year (tens of documents) this is unmeasurable. At thousands it would want the index subject. Say so in the code rather than discovering it.

**What would change this recommendation:** if the primary access pattern were humans browsing a directory tree rather than programs querying by content, the ergonomics of `evo_head('doc/2025/1099-int/chase')` in a chat transcript might outweigh permanence. It does not here — the consumer is a program, and the agent gets labels from `evo_list` plus head reads either way.

---

### Open question 3 — OCR / document format layering

> **Recommendation: the raw vision output is a stored artifact, as revision 1 of the same subject — not a separate subject, and not transient.**

PROJECT.md already argues for storing it ("the record of what the model actually saw, before interpretation"). Two arguments strengthen that, and one of them looks decisive and is not yet in the corpus:

1. **It costs almost nothing.** One more revision on a chain that already exists, content-addressed and deduplicated. There is no separate store, no new tool, no new subject.
2. **It makes the narrowing step's provenance structural.** If OCR is transient, the `vnd.fjs.1099int` revision's parent is the raw PDF, and the question "did the model read box 1 as 1,234.56 or did the narrowing step invent it?" is unanswerable. With the OCR revision present, the diff between rev 1 and rev 2 *is* the interpretation, and it is reviewable.
3. **Re-narrowing without a second vision pass — the decisive one.** When a document is re-classified (the 1099-INT is actually a 1099-OID), the correction is a new revision whose parent is the **OCR revision**, not the PDF. No second vision pass. This matters because a second vision pass is *not deterministic* — the model may read a different number the second time, and the report would silently change for a reason that has nothing to do with the correction. Storing the OCR output is what makes reclassification a pure, reviewable operation. A transient OCR step forecloses this permanently.

**Layering the two dialects.**

| | `vnd.fjs.ocr` | `vnd.fjs.1099int` |
|---|---|---|
| Produced by | The agent's vision pass | The agent's narrowing pass (or a program) |
| Semantics | Near-verbatim transcription. Page-oriented. Text and observed layout. **No financial interpretation.** | Typed, form-specific fields. Integer cents. |
| Numbers | Strings, exactly as printed (`"1,234.56"`) | `number`, integer cents (`123456`) |
| Reviewable against | The PDF, by eye | The OCR blob, by diff |
| Carries | `label`, `pages[]`, `sourceHash` | `label`, `taxYear`, `payer`, `recipient`, boxes, `sourceHash` |

Keeping numbers as printed strings in `vnd.fjs.ocr` is the whole point of having two dialects: it puts the "1,234.56 → 123456 cents" conversion in exactly one reviewable place, on a revision boundary, rather than smearing it across the vision prompt.

**How to design any `vnd.fjs.*` dialect — the `vnd.fjs.revision` pattern, read off the source.**

`fjs/media/revision/module.f.js` is 123 lines and every one of them is a template. Follow it literally:

```js
export const dialect = 'vnd.fjs.1099int'
export const mediaType = `application/${dialect}+json`     // derived, never written out

export const schema = {
    dialect,                       // exact literal → structural validation alone rejects other dialects
    label: string,
    taxYear: number,
    sourceHash: hash,              // = string at rtti level; refined below
    box1: number,                  // interest income, INTEGER CENTS
    // …
}

const validateShape = rttiValidate(schema)

export const checkReferences = r => { /* isHash(r.sourceHash); Number.isSafeInteger(r.box1); … */ }
export const validate     = value => { /* validateShape then checkReferences */ }
export const decodeText   = text  => { /* fjs's own json parser, then validate */ }
export const proof = { /* round-trips, rejections */ }
```

Five rules, each read directly off the precedent:

1. **`dialect` as an exact literal in the schema.** The revision module's comment says this outright: it is what makes structural validation alone reject another dialect's blob. Free discrimination.
2. **Never write the media type by hand** — derive it, so the two can never drift.
3. **Split `validate` into structural (rtti) and semantic (`checkReferences`).** rtti cannot express "this string is a cBase32 hash" or "this number is a safe integer." The revision module exports `checkReferences` separately precisely so a caller that already has typed fields can skip the unreachable structural branch — `fjs/cas/evo`'s `addRevision` uses it that way. Ours will too.
4. **Use `fjs/media/json`'s parser, never `JSON.parse`.** The revision module does (`jsonParse(jsonTokenize(stringToList(text)))`). Beyond the purity rule, `stringify` gives *canonical* output, and canonical output is what makes the same logical document hash to the same CAS address.
5. **Money is integer cents in a `number`, guarded by `Number.isSafeInteger`.** This is not a new invention — it is `generation`'s rule verbatim, with the same justification written out in `checkReferences`'s doc comment. Never floats; PROJECT.md's Correctness constraint and the safe-integer bound are the same rule applied to a different field.

**One gap to note:** `fjs/media/module.f.js`'s dialect-aware `detect` hardcodes `vnd.fjs.revision`. There is no dialect registry. So `cas_get` will report our blobs as `text/plain`, not `application/vnd.fjs.1099int+json`. Two responses: (a) our own `fjs/media/module.f.js` wrapping fjs's and adding our dialects — trivial, and mirrors theirs; (b) report upstream that `detect` wants a registry parameter. Do both; (a) unblocks, (b) is the AGENTS.md obligation.

---

### The restricted runner

The mechanism is settled and correct. Three things remain open, and all three have verified answers.

#### Structure: a pure effect *translator*, not a promise-returning operation map

The natural reading of "an `OperationMap` holding only whitelisted ops, driven by `asyncRun`" is a map whose entries return `Promise`s. That is the wrong shape here, because our handlers are not promises — `cas.read` and `evo.head` are themselves `Effect` values. Making the entries return effects instead gives a **pure, synchronous, recursion-only** runner:

```js
/** interpret : OperationMap<G, Effect<H, out>> -> Effect<G, T> -> Effect<H, Result<T, string>> */
export const interpret = map => e => {
    if (typeof e === 'function') { return pure(ok(e())) }
    const { command, payload, continuation } = e
    if (!Object.hasOwn(map, command)) {
        return pure(error(`operation not permitted: ${command}`))
    }
    const inner = map[command](...payload)
    return step(inner, out => interpret(map)(continuation(out)))
}
```

**Verified working**, including under `fjs/effects/mock`, with these results from a prototype:

```
good  -> [["h1"], ["ok", "got BYTES(h1)"]]            ← read set + result
bad   -> [[],     ["error","operation not permitted: fetch"]]
proto -> [[],     ["error","operation not permitted: constructor"]]
```

Why this shape earns its keep:

- **`asyncRun` is not needed at the guest level at all.** The whole thing is a `.f.js` module depending only on `fjs/effects`. The *host* runner (`asyncRun` in production, `mock`/`virtual` in proofs) interprets the resulting host effect.
- **It is directly proof-testable** with a hand-built map, satisfying `fjs/todo/implement-mcp-server.md`'s testing plan without any process, filesystem, or promise.
- **`Object.hasOwn` closes finding #1.** `constructor`, `toString`, and friends are refused instead of silently succeeding.
- **Stack depth is bounded.** The recursion sits *inside* the continuation the host runner invokes from its own iterative loop, so it does not grow across effect steps. Only a long chain of `Pure`-headed steps nests, because `step` is eager on `Pure` — worth a note and a proof, not a redesign.

**One caveat, and it is the upstream report.** This adds a fourth `typeof e === 'function'` site. `fjs/effects/module.f.js`'s module doc explicitly says a fifth such site "is a review flag, because the representation is only cheap to change while its readers stay enumerable." Keep it to exactly one place in this repo, and file upstream with the concrete proposed fix: **`match` should return a third `['refused', command]` variant** (or ship a `matchOwn`) so no consumer has to re-discriminate. Bundle this with finding #1's prototype-dispatch evidence — that is a considerably stronger report than "the error message is opaque," and it comes with a reproduction.

#### The whitelist

Given the open-question-5 decision (the *tool* writes, not the program), the guest surface is read-only:

| Command | Backed by | In? | Why |
|---|---|---|---|
| `casRead(hash)` | `collectRead(cas.read(v))` | **yes** | Reading snapshots is the point |
| `evoList()` | `evo.list()` | **yes** | Discovering documents |
| `evoHead(subject)` | `evo.head(s)` | **yes** | Current interpretation of a document |
| `evoRevision(hash)` | `evo.revision(h)` | **yes** | Walking history; amended-document logic |
| `casWrite` | `cas.write` | **no** | The tool writes the result; a program that writes can produce records that disagree with what it returned |
| `evoAdd` | `evo.add` | **no** | Same |
| `casList()` | `cas.list()` | **no** | Enumerating every blob in the store is not a report operation. `evoList` is the intended discovery route and is scoped. Cheap to add later; impossible to remove once a program depends on it |
| `import` | `import_` | **no** | Arbitrary code by name |
| `fetch` / `readFile` / `exec` / `write` / `forever` / `now` / `randomInt` | — | **no** | Nondeterminism or I/O. `now`/`randomInt` deserve their own mention: they are the two that would silently break reproducibility (Success Criterion 4) while looking harmless. A program needing "today" takes it as an *argument*, so the run record captures it |

`casRead` returns decoded content, not a raw `Vec` — the guest has no bit-vector library (it cannot import one, finding #3), so hand it a string or a parsed JSON value. This is an ABI decision, and it belongs with the next section.

#### Reporting a refusal

`interpret` returns `Result<T, string>`. `fjs_run`'s handler maps `['error', msg]` to `errorResult(msg)` — the MCP tool-level error convention that `fjs/mcp/cas` documents and that the model can read and react to. Message format: `operation not permitted: fetch`, exactly as the spec asks.

Two refinements worth building in:

- **Include the whitelist in the message**: `operation not permitted: fetch (permitted: casRead, evoList, evoHead, evoRevision)`. The failure mode this exists for is an agent guessing at the ABI; telling it the ABI in the error turns a retry loop into one retry.
- **Return the read set even on refusal.** A program that read three documents and then reached for the network is more debuggable when you can see how far it got.

#### Testability via `fjs/effects/mock`

The structure above makes this fall out, but state it as a requirement so it does not erode:

| Test | Mechanism |
|---|---|
| `interpret` accepts a whitelisted op | `mockRun(hostMap)(state)(interpret(map)(effect))` — a hand-built `MemOperationMap`, no store |
| `interpret` refuses `fetch` | Same, asserting `['error', 'operation not permitted: fetch']` |
| `interpret` refuses `constructor`/`toString` | Same. **Regression test for finding #1** — write this one, it guards a real hazard |
| Read set is recorded | The mock's threaded state *is* the read set (verified) |
| `fjs_run` end to end | `fjs/effects/node/virtual` with a `JsModule` entry at the CAS path (finding #2). No filesystem |
| Dialect round-trips | Pure `proof` in each `fjs/media/*/module.f.js` |

**Nothing in Track A needs to touch `~/.cas/` to be tested.** That is worth protecting: the moment a test needs a real store, the test suite stops being a proof and starts being a fixture-management problem.

#### Guest ABI — the decision finding #3 forces

A program in CAS **cannot `import` anything** (verified: `ERR_MODULE_NOT_FOUND` for bare specifiers from the CAS path). So the ABI must be self-sufficient. Two options:

| | (a) Inject a `ctx` into `main` | (b) Stage the blob into the repo tree, then import |
|---|---|---|
| Guest writes | `main = ctx => ctx.step(ctx.evoList(), …)` | `import { step } from 'functionalscript/…'` |
| Extra filesystem writes | none | one per run, outside CAS |
| Precedent | `fjs r` does exactly this: `unwrap(x).main({ ...options, args })` | none |
| Surface the guest can reach | exactly what `ctx` names | all of `functionalscript` and anything else resolvable |
| Testable under `virtual` | yes | needs a real path |

> **Recommendation: (a).** It matches the `NodeProgram` precedent, needs no filesystem writes outside CAS, and makes the reachable surface exactly the thing being whitelisted — the ABI and the sandbox become the same object, which is the property the whole design is built on.

`ctx` carries the combinators (`pure`, `step`, `mapStep`) plus the four operation constructors plus the money helpers, and `args` from the tool call. **Freeze this early** — it is what every report program is written against, and it is the one interface that is expensive to change after programs exist. It is a smaller, more urgent version of the same "annoying to change later" problem as the subject model.

*(Fallback worth knowing about: an effect is plain data, so a zero-import program can hand-construct `{ command, payload, continuation }` literals — verified working. That is the escape hatch if `ctx` ever proves insufficient, not the intended interface.)*

---

## Architectural Patterns

### Pattern 1: The runner is the sandbox *and* the auditor

**What:** `interpret` is the only code path between a guest program and anything real. Restriction and observation are the same interception point, so provenance recording costs one accumulator.

**When:** Any time untrusted code needs bounded access to a store and its accesses need to be citable.

**Trade-offs:** Only covers what goes through the effect layer — the module's top-level body runs before `interpret` ever sees an effect (the known Week 1 hole). Buys structural provenance for free; does not buy import-time safety.

### Pattern 2: Dialect modules as the unit of format ownership

**What:** One directory per format, exporting `dialect`, `mediaType`, `schema`, `validate`, `decodeText`, `proof`. Purely structural — no store access, no effects, exactly as `fjs/media/revision` describes itself.

**When:** Every new `vnd.fjs.*`.

**Trade-offs:** More files than a single `formats.f.js`. Buys: each format is independently proof-testable and independently upstreamable, and the layout is one a fjs reader already knows.

### Pattern 3: Content-derived identity, human names as data

**What:** Subject = artifact hash. Labels live in the snapshot. (Perkeep's permanode, Datomic's ident rule, Git's refs.)

**When:** Any identity that must survive being wrong about the thing it identifies.

**Trade-offs:** Costs a lookup where a path would have been direct, and subjects are unreadable in a transcript. Buys renameability, dedup, and the fjs happy path.

### Pattern 4: Parse-forward revision chains

**What:** raw → OCR → typed → corrected, each a revision of one subject. The diff between adjacent revisions *is* one interpretation step.

**When:** Ingestion pipelines where every stage is fallible and reviewable.

**Trade-offs:** Snapshot type varies along the chain, so readers must check the dialect (via `detect`). Buys: re-do any stage from its input without re-running the earlier ones — the decisive argument for storing OCR output.

### Pattern 5: Effects-as-effects, not effects-as-promises

**What:** Whitelist entries return `Effect<HostOp, out>`, not `Promise<out>`. `interpret` composes with `step`.

**When:** Any interpreter whose handlers are themselves effectful.

**Trade-offs:** Cannot use `asyncRun` directly at the guest level (write ~8 lines instead). Buys: the whole runner is pure `.f.js`, and every test runs under `mock`/`virtual`.

---

## Data Flow

### Ingestion (Track B)

```
PDF on disk
   │
   ├─ >128 KiB → user runs `npx functionalscript cas add <path>`  ──┐   [out-of-band]
   └─ ≤128 KiB → cas_add { content, type:'base64' }               ──┤
                                                                    ▼
                                                            hash H (cBase32)
                                                                    │
                              evo_add { parents: [], subject: H }   │  ← snapshot resolves to H
                                                                    ▼
                                                            rev0  gen 0
                                                                    │
  agent reads the PDF by vision → vnd.fjs.ocr JSON → cas_add ──► O  │
                              evo_add { parents:[rev0], snapshot:O }│
                                                                    ▼
                                                            rev1  gen 1   HEAD
                                                                    │
  agent narrows → vnd.fjs.1099int JSON → cas_add ──────────────► D  │
                              evo_add { parents:[rev1], snapshot:D }│
                                                                    ▼
                                                            rev2  gen 2   HEAD
```

Direction is strictly forward; nothing is ever overwritten. A correction appends rev3 with rev2 as parent; a re-classification appends with **rev1** as parent.

### Execution (Track A)

```
agent authors program source
   │ cas_add                                             (≤128 KiB — programs are small)
   ▼
programHash P
   │ fjs_run { hash: P, args? }
   ▼
┌────────────────────────────────────────────────────────────┐
│ import_(cas.url(P))            [host: Import effect]       │
│ module.main(ctx)               [pure — builds an Effect]   │
│ interpret(whitelist)(effect)   [pure]                      │
│   guest: evoList → evoHead → casRead → casRead → …         │
│   host:  each translated to a Cas/Evo effect, hash logged  │
│   refusal → Result error, short-circuit                    │
└──────────────┬─────────────────────────────────────────────┘
               ▼
     Result<value,string>  +  readSet[]
               │
      cas.write(canonical JSON of value) ──► resultHash R
      cas.write(vnd.fjs.run {P, readSet, R, status}) ──► runHash
      if subject/parents: evo.add ──► report revision
               ▼
   okResult { runHash, resultHash, inputs, result? }
```

Reads flow **up** from the store into the program; writes flow **down** from the tool handler only. The guest never appears on a write path. That asymmetry is the security model and the provenance model at once.

### Key data flows

1. **Provenance** — flows sideways out of `interpret` as a byproduct of restriction. Never declared by the program.
2. **Corrections** — flow forward as revisions. `evo_head` is always "current truth"; every prior truth stays readable at its hash.
3. **Tax parameters** — flow in as ordinary CAS content under their own subject, read by the program through the same `casRead` as documents. No special path, therefore no special caching, no special versioning story.

---

## Build Order

Ordered by what unblocks what, not by visible progress.

| # | Deliverable | Unblocked by | Blocks | Note |
|---|---|---|---|---|
| **0** | **Server skeleton** — `mcp.js` + `financeMcpServer` composing fjs's two registries and nothing of ours | nothing | everything downstream, socially | An hour's work that proves `claude mcp add` works before any real code exists. `casMcpServer` is a one-line template. De-risks the integration nobody wants to discover is broken in week 4 |
| **1** | **`interpret`** + own-property guard + refusal message + read-set accumulator, with proofs | `fjs/effects` only | 2, 3 | The riskiest component, and it has **zero** dependencies on CAS, Evo, or MCP. Build it first precisely because it can be built and fully tested in isolation. `todo/plan.md` already calls step 3 "the real work" |
| **2** | **Guest ABI (`ctx`)** + whitelist bound to `Cas<O>`/`Evo<O>` | 1; OQ5 decided | 3, 6, 7 | Freeze it here. Every report program is written against it. Changing it later means rewriting stored programs |
| **3** | **`fjs_run`** — `import_`, `interpret`, run-record write-back | 1, 2; OQ5 | 6 | Testable under `virtual` with a `JsModule` at the CAS path |
| **4** | **`vnd.fjs.ocr` + `vnd.fjs.1099int`** + our `detect` wrapper | nothing | 5 | **Fully parallel with 1–3.** Pure format modules, zero dependencies. This is the genuine two-track split |
| **5** | **Ingestion convention** (+ optional `finance_ingest` sugar over `cas_add`/`evo_add`) | 4; **OQ2 decided** | 6 | May need no new tool at all — fjs's `cas_add`/`evo_add` already do it. Prefer a documented convention over a tool until the convention hurts |
| **6** | **Convergence: total 1099-INT interest** as a stored program | 3, 5 | 7 | `todo/plan.md`'s Week 1 finish line. First moment the thesis is demonstrated end to end |
| **7** | **Tax params as data + 1040 program** | 2, 6; OQ1 (tax scope) | — | Blocked on scope, not on architecture |

**Dependency facts that force this order:**

- `interpret` genuinely depends on nothing. Any ordering that builds it later is choosing to carry the largest unknown for longer, for no reason.
- OQ5 blocks the ABI (item 2), not `fjs_run` (item 3) — because it decides whether `casWrite` is in the guest vocabulary. That is one step earlier than `fjs/todo/implement-mcp-server.md` places it, and it is why answering OQ5 first is right.
- OQ2 blocks item 5 only. Track B's *formats* (item 4) do not depend on it. So OQ2 does not block as much as `todo/plan.md` implies — dialect work can start immediately.
- Item 0 is not in either planning document. Add it. The integration risk it retires (stdio handshake, `claude mcp add` registration, Node version, launcher purity) is entirely front-loaded and entirely cheap.

**What must land if the week runs short:** `todo/plan.md` says Track A, and that is right. Refine it: **items 1 + 2** are the thesis. `fjs_run` without `interpret` is a shell; `interpret` without `fjs_run` is still the demonstrated core, testable and upstreamable.

---

## Anti-Patterns

### Giving the program CAS write access "for flexibility"
**What people do:** Put `casWrite` in the whitelist so programs can persist intermediates.
**Why it is wrong:** Provenance becomes a program-authorship convention. A program can write a record that disagrees with what it returned, or forget to write one. Success Criterion 3 degrades from structural to best-effort, and the degradation is invisible until an audit.
**Instead:** The tool writes. If a program truly needs a scratch value, it returns it as part of its result.

### Naming subjects by hand
**What people do:** `subject = 'doc/2025/1099-int/chase'`.
**Why it is wrong:** Verified — subjects cannot be renamed (`validateParentSubjects`), and the classification embedded in the name is exactly what turns out to be wrong. Also defeats dedup of a re-uploaded document.
**Instead:** Subject = artifact hash. Label inside the snapshot, correctable by revision.

### Floating-point money
**What people do:** `1234.56`.
**Why it is wrong:** `0.1 + 0.2 !== 0.3`; a 1040 that is off by a cent fails Success Criterion 1.
**Instead:** Integer cents in a `number`, validated with `Number.isSafeInteger` — the rule `fjs/media/revision` already applies to `generation`, with the same reasoning.

### Treating OCR output as transient
**What people do:** Vision → typed document, discarding the transcription.
**Why it is wrong:** Loses "what the model actually saw," and forces a *second, nondeterministic* vision pass on any reclassification — so a correction can silently change unrelated numbers.
**Instead:** Store it as revision 1. Reclassify by branching from it.

### `JSON.parse` / `JSON.stringify`
**What people do:** Reach for the globals.
**Why it is wrong:** Violates the FunctionalScript constraint, and loses canonical encoding — the same logical document would land at two different CAS hashes, defeating dedup and hash-stable citation.
**Instead:** `fjs/media/json`'s `parse`/`tokenize`/`stringify`, as `fjs/media/revision` does.

### A bare `import()` expression inside a `.f.js` module
**What people do:** `await import(path)` in `fjs_run`.
**Why it is wrong:** Impure, and it makes `fjs_run` untestable — `fjs/effects/node/virtual` can serve `import` from an in-memory FS, but only if it goes through the effect.
**Instead:** `import_(cas.url(hash))` from `fjs/effects/node/module.f.js`.

### `map[command] !== undefined` or `command in map` as the whitelist guard
**What people do:** The obvious presence check.
**Why it is wrong:** Verified — both find `Object.prototype` members. `command in map` accepts `toString`; `map[command] !== undefined` accepts it too, since the inherited method is not `undefined`. The program then gets a real dispatch.
**Instead:** `Object.hasOwn(map, command)`. Write the regression proof.

### Returning a full report inline
**What people do:** `okResult(JSON.stringify(report))`.
**Why it is wrong:** The stdio transport caps an encoded line at 128 KiB and degrades to `-32603` on overflow — so a large 1040-plus-schedules result would come back as an internal error rather than a report.
**Instead:** Always return `resultHash`; inline the value only when it comfortably fits.

### Building `finance_ingest` before knowing it is needed
**What people do:** Wrap `cas_add` + `evo_add` in a domain tool on day one.
**Why it is wrong:** fjs's tools already do the job; a wrapper freezes the subject convention into an interface before the convention has been used once.
**Instead:** Document the convention, use fjs's tools, and add the wrapper when the repetition is real.

---

## Scale and Limits

Single user, personal tax records — so "scale" means documents and years, not users. The real limits are the ones verified above.

| Dimension | Realistic v1 | Where it breaks | Response |
|---|---|---|---|
| Documents per year | 10–100 | — | Nothing needed |
| Blob size | PDFs 50 KiB–5 MiB | **128 KiB `cas_add` cap** — most real PDFs exceed it | Design the CLI route in from the start; do not discover it in week 4 |
| Report size | 1040 + schedules, a few KiB | 128 KiB stdio line | Hash-plus-preview (already the OQ5 recommendation) |
| Evo cache build | full store scan at startup (`initEvo` → `buildCache` → `cas.list()` + a read per blob) | thousands of blobs → noticeable startup | Not a v1 concern; note it before it surprises someone |
| "Find all 1099-INTs" | O(subjects) head reads | thousands of subjects | The index-subject growth path |
| Effect chain depth | hundreds of steps | very long `Pure`-only chains nest (`step` is eager on `Pure`) | Proof it; redesign only if it fires |
| Years | 1 → many | — | Params keyed by year; no engine change by construction |

**First bottleneck, concretely:** PDF upload. It is a constraint on the *user workflow*, not on the code, and it is invisible until someone tries to hand a real 1099 to the agent in chat. Write the CLI step into the ingestion documentation now.

---

## Integration Points

### External

| Service | Pattern | Gotchas |
|---|---|---|
| MCP client (ChatGPT / Claude) | stdio JSON-RPC via `stdioTransport` | 128 KiB line cap with `-32603` fallback; single session, no concurrency |
| Node runtime | `fjs/effects/node`'s `asyncRun` | CI pins Node 26; extensionless `import` relies on module-syntax detection — pin it with a proof |
| `npx functionalscript cas add` | User's shell, out-of-band | The only route for >128 KiB blobs. Prints the hash on stdout, which the user pastes back |
| Agent vision | Prompt → `vnd.fjs.ocr` JSON | **Nondeterministic.** The reason to store the output rather than re-run it |

### Internal Boundaries

| Boundary | Communication | Notes |
|---|---|---|
| Tool layer ↔ execution spine | Direct call returning `Effect<O, ToolsCallResult>` | The tool owns MCP shaping; the spine owns semantics. Keep `okResult`/`errorResult` out of `fjs/run/` so it stays upstreamable |
| `interpret` ↔ whitelist | `map` as a parameter | `interpret` must never name a CAS or Evo operation. This is what makes it generic — protect it |
| Guest ↔ host | The `ctx` object + the `Effect` it returns | The ABI. Widest blast radius of any interface here. Version it explicitly if it ever changes |
| Format modules ↔ everything | Pure functions over already-parsed JSON | No effects, no store access — same rule `fjs/media/revision` states about itself |
| Ours ↔ fjs | Named imports only | Zero forks, zero patches. Every gap becomes a `todo/` note plus an upstream report, per AGENTS.md |

---

## Upstream fjs Reports to File

Per AGENTS.md ("tell the user so they can fix it and release a new FJS version — don't just work around it silently"):

1. **`match` dispatches to `Object.prototype` on a partial map** (`fjs/effects/module.f.js:287`). Not merely an opaque `TypeError` — `constructor`, `toString`, `valueOf`, `hasOwnProperty` **silently succeed**. Reproduction available. Suggested fix: a `['refused', command]` variant of `MatchResult`, or an own-property-checking `matchOwn`. **Highest priority** — it is a soundness hole in the exact mechanism this project's security model rests on, and `fjs/cas/evo` already guards against the same hazard for subject names.
2. **`fjs/media/module.f.js`'s `detect` hardcodes `vnd.fjs.revision`.** No way to register a dialect, so downstream formats always report as `text/plain`. Suggested fix: take a dialect list/registry.
3. **Candidates once stable** (`todo/plan.md` Week 5): `interpret` as a generic restricted runner; the CAS effect vocabulary; integer-cents helpers if they prove reusable.

---

## Sources

**Primary — read or executed against `node_modules/functionalscript@0.40.0`** (HIGH confidence):
`fjs/effects/module.f.js` (`match`, `step`, `pure`) · `fjs/effects/module.js` (`asyncRun`) · `fjs/effects/mock/module.f.js` · `fjs/effects/memory/module.f.d.ts` · `fjs/effects/node/module.f.d.ts` + `module.js` (`Import`, `Sandbox`, the operation map) · `fjs/effects/node/virtual/module.f.js` (`import_`, `JsModule`) · `fjs/cas/module.f.js` (`fileCas`, `toPath`, `url`, `collectRead`) · `fjs/cas/evo/module.f.js` + `module.f.d.ts` + `proof.f.js` (`resolveSnapshot`, `validateParentSubjects`, `headsOf`, `addRevisionToCache`) · `fjs/mcp/module.f.js` (`casMcpServer`, `casMcpHandlers`, `casConfig`) · `fjs/mcp/cas/module.f.js` (128 KiB cap, error convention) · `fjs/mcp/evo/module.f.js` + `proof.f.js` · `fjs/media/revision/module.f.js` (the dialect template) · `fjs/media/module.f.js` (`detect`) · `fjs/protocol/mcp/module.f.d.ts` · `fjs/protocol/mcp/stdio/module.f.d.ts` · `fjs/module.f.js` (the `r`/`run` command) · `fjs/types/rtti/module.f.d.ts`

**Executed experiments** (HIGH confidence, Node 23.11.0; CI is Node 26): `match` prototype-dispatch on a partial map · extensionless dynamic `import` · bare-specifier resolution failure from a CAS-shaped path · resolution success from a repo-staged path · zero-import effect-data guest program under `asyncRun` · the `interpret` translator under `fjs/effects/mock`, including refusal and read-set recording.

**Project documents:** `.planning/PROJECT.md` · `todo/plan.md` · `fjs/todo/implement-mcp-server.md` · `AGENTS.md`

**Comparative systems** (MEDIUM confidence — official docs, informing the subject-model recommendation only):
- [Perkeep — Permanodes](https://perkeep.org/doc/schema/permanode) and [Schema](https://perkeep.org/doc/schema/) — permanode as a signed random number with no mutable state; attributes as claims
- [Datomic — Identity and Uniqueness](https://docs.datomic.com/schema/identity.html) — "idents should not be used as unique names or ids on ordinary domain entities"
- [Datomic — Lookup Refs](https://blog.datomic.com/2014/02/datomic-lookup-refs.html) — external unique keys as the alternative to naming the identity
- [DefraDB — Content Addressable Storage](https://docs.source.network/defradb/concepts/content-addressable-storage/) — CID-per-version versioning
- [Lore — System Design](https://epicgames.github.io/lore/explanation/system-design/) — opaque identity tag carried alongside a content hash

---
*Architecture research for: MCP + CAS + agent-authored program execution (FunctionalScript)*
*Researched: 2026-08-03*
