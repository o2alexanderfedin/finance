# FunctionalScript Updates

Work items to land in FunctionalScript itself, driven by what `finance` needs.

> Blockquoted notes are commentary added while reviewing, not part of the original
> proposal. Each is either a verified fact about fjs as it stands, or an open decision
> worth settling before implementation.

1. Formats:
   - Forms: W-2, 1099-*
   - Bank Statements
   - Expenses (Receipts)
   - Tax Return Config, the config doesn't have any base document and we are free to extend the config as needed:
     - Entity (SSN, name, etc), it can be a full identity (full SSN) or a last 4 digits or another solution. We don't have a solid decision yet.
     - Status (filing status — single, married filing jointly, …)
     - All other fields; it may include references to other files and entities.

   > **Note.** These are `vnd.fjs.*` dialects per the Revision precedent, so each is an
   > rtti schema plus a semantic check. See `todo/plan.md` Week 1 step 5.
   >
   > **Consequence of config having no base document.** A transcribed form cites its source
   > PDF's CAS hash; the config cites nothing. Success Criterion "every computed line
   > traceable to the CAS hash of its source document" therefore has two classes of input —
   > a line derived from the config traces to *a config revision*, not to a document. Both
   > are content-addressed, so traceability holds; it just is not one uniform story.
   >
   > **On the SSN decision.** The constraint that should drive it: CAS is immutable and Evo
   > only adds revisions, so a full SSN written once cannot be redacted later. Last-4 plus a
   > reference stays reversible; full-SSN does not.

2. FJS Runner:
   - Types (CAS permissions are out-of-scope for this types):
     - Pure. Subtypes:
       - No imports and no reading
       - Importing by hash
       - Reading by hash
     - Impure:
       - Reference to revision subjects
       - Providing and generating a lock file. The problem with providing a lock file is
         that we may not know in advance which revision subjects the script will ask for.
         At the same time, the first run without a lock file can generate one, which we
         then supply on later runs to reproduce.
   - Design a URL format for hashes and revision subjects. Our runner should be able to intercept `import`. For example
     - hash URL: `import a from 'sha256-3902j2sye...'`
     - subject (mutable) URL: `import a from 'revision-3902j2sye...'`
     The reason that we use `-` instead of, for example `:`, so we can create a flat directory with the files and any JS engine runner (Node, Deno, Bun, etc) can execute the script. If we use `/` instead of `-`, we will need to write like this `../revision/xxx`, `../sha256/xxx` because imported files should be able to import other files w/o changes in the import.

   > **Note.** These types and the CAS whitelist compose but stay separate, as the
   > parenthetical says: the type is what a program *may express*, the operation map is what
   > the runner *will answer*. A program can be "pure, reading by hash" and still be denied
   > every read.
   >
   > **Note.** "Impure" is narrower than it sounds: resolving a subject to its head is
   > impure only because the head moves. Everything downstream of resolution is pure again.
   > That is why the lock file works — it pins the resolution, and the run becomes
   > reproducible without the program changing.
   >
   > **Note on the URL scheme.** `sha2:` vs `revision:` is a good design because *the
   > specifier itself carries the purity*: a module graph reachable only through `sha2:`
   > is immutable by construction and needs no lock file, and a lock file is exactly a map
   > from every `revision:` specifier to the `sha2:` it resolved to. So the two features
   > are one mechanism, and "which subtype is this program" becomes a syntactic property of
   > its imports rather than something to track separately.
   >
   > **Note.** Intercepting `import` is also the first real lever on the import-time
   > execution hole in `fjs/todo/implement-mcp-server.md` — that limitation exists because
   > `import()` runs a module body with full privileges before any effect is interpreted.
   > A runner that owns resolution can at least *bound the surface*: only `sha2:` and
   > `revision:` resolve, so `node:fs` and `https:` do not. It does not make the module
   > body safe, but it stops the body from reaching anything new.
   >
   > **Open.** Custom schemes need Node's module customization hooks (`module.register()`
   > with `resolve`/`load`), which are per-process and asynchronous. Worth confirming early
   > that hooks can be registered in the MCP server process without disturbing fjs's own
   > module loading — this is the kind of thing that works in a spike and fights the host
   > application later.
   >
   > **Open.** Generate-then-pin is trust-on-first-use: the first run is unpinned by
   > construction, so whatever the heads happened to be is what gets recorded. Fine for a
   > local single user; worth naming as a limitation rather than discovering it.

3. Big file uploader. The problem is that if we use MCP `cas_upload`, we burn tokens, also it has a limit for file size. We also need to provide big CAS files as MCP resources. Solutions:
   - CLI. Actually, we can just use `fjs cas add ...`
   - Local Web Server.

   > **Note.** `casAddFile` and `casUpload` already exist in `fjs/cas`, and `casUpload`
   > streams from `~/cas_upload/` and deletes the source on success. Chunking is 128 KiB
   > with lock-free staging writes, so the streaming problem is solved; what is missing is
   > only the *transport* in front of it.
   >
   > **Note.** The stated motivation changes the shape of the task: token burn and the
   > message-size limit are properties of *the MCP channel*, not of CAS. So the goal is to
   > keep large bytes off the channel entirely, in both directions — upload out of band,
   > and serve large blobs as MCP **resources** rather than tool results. Those are two
   > separate pieces of work; only the first is an "uploader".
   >
   > **Settled — but record it.** Local web server, not a hosted one. That still needs
   > writing into `todo/plan.md` Settled Decisions, which currently says "stdio only. No
   > HTTP, no auth, no hosting" without qualification. The distinction to record is
   > *loopback-bound, unauthenticated, started and stopped with the server* versus a
   > network service — otherwise the next reader sees a contradiction.
   >
   > **Open.** Serving CAS blobs as MCP resources needs a URI scheme the client can hold
   > onto. If that ends up being the same `sha2:` scheme as item 2's import specifiers,
   > they should be designed together rather than arrived at twice.

4. Decimals and BigIntegers for finance. Proposed solution:
   Type-aware JSON parser:
   ```ts
   const parse: <T extends rtti.Type>(type: T) => (s: string) => Result<Ts<T>>
   ```
   Implementation:
   1. Extend the JSON parser to recognize integer values and return them as bigints.
   2. The standard parser will use the extended parser and convert all bigints to numbers.
   3. Our "type-aware JSON parser" will use the extended parser.

   Our forms will use ONLY integers for currencies (cents), percentages, etc. No
   big fixed-point decimals for now. If needed, a form may specify fixed-point positions
   for some values for the whole JSON. For example, if by default a form assumes that our
   units are percent, but a particular form requires hundredths of a percent, then we
   should fall back to strings: `{"interest": "3.45%"}`. We should select a
   default value for all forms. Most likely,
   - for currencies we should use cents (the
   minimal unit), `$100.23 = 10023`.
   - for percentages hundredths of a percents: `3.45% = 345`.

   > **This supersedes a settled decision.** `todo/plan.md` Week 1 step 5 and the PROJECT.md
   > requirement both say money fields must be JSON **strings**, "never JSON numbers",
   > because `fjs/media/json`'s value model types a number as rtti `Number` — a JS double —
   > so exactness was lost before any arithmetic. A type-aware parser removes that cause:
   > the tokenizer already carries the literal text and an exact `BigFloat`, so a parser
   > that knows the target is `bigint` never goes through a double. Money becomes a JSON
   > integer, and strings survive only as the escape hatch below. **Both documents must be
   > updated in the same change as this**, or the format and parser decisions will disagree.
   >
   > **Consequence of the string fallback, worth deciding deliberately.** If a field is an
   > integer *usually* and a string *sometimes*, its rtti type is a union and the schema
   > stops pinning the representation — every reader must handle both, and "which is it
   > here?" becomes a per-document question. Three ways out, in rough order of preference:
   > (a) the *dialect* fixes which fields are strings, so any given field is one or the
   > other and the union is per-schema rather than per-document; (b) the string form is
   > always accepted and always normalised on ingest, so only one form is ever stored;
   > (c) leave the union and handle it in the semantic check. (a) and (b) both keep stored
   > documents uniform; (c) pushes the cost onto every consumer forever.
   >
   > **Still open.** Where rounding is allowed. Integers are exact under addition, but a
   > third of a percent is not representable at any fixed scale — so any division (proration,
   > apportionment, per-payee allocation) must round somewhere. Does v1 divide at all? If it
   > does, the rounding point is a tax-correctness question, not a representation one, and
   > belongs with plan open question 1.

5. One API definition. We should have one internal API definition for external gateways.
   All other APIs — MCP, CLI, REST — should map to the internal API with minimal
   configuration, and must not contain business logic at all. The internal API must be
   defined using rtti.

   > **Note.** This is the same shape fjs already uses for MCP: `toolEntry` pairs an rtti
   > schema with a handler, and `fromRegistry` turns a registry into handlers. Generalizing
   > the registry so MCP is one *renderer* of it, rather than its home, is a small step from
   > what exists.
   >
   > **Open.** rtti is structural and cannot express per-endpoint concerns that gateways
   > usually need — errors, auth, idempotency, pagination. Is the internal API strictly
   > request/response shapes, with those left to each gateway, or does it need its own
   > error vocabulary too?

6. Currently, by default, we use the `~/.cas/` directory. We should be able to use other
   directories. Possible solutions:
   1. Use an algorithm similar to Git's: search for a `.cas/` directory, traversing from
      the current directory up to the root. I prefer this one.
   2. Provide a parameter.

   > **Note.** These are not alternatives — `fileCas(sha2)(path)` already takes the path,
   > so option 2 exists at the library level. What is hardcoded is `const prefix = '.cas'`
   > in `fjs/cas/module.f.js` and the choice of `home` made by the CLI and MCP entry
   > points. So the real question is only how the *entry points* pick a root, and option 1
   > is a discovery rule layered on the parameter that already exists.
   >
   > **Open.** Discovery makes behaviour depend on the current directory, which is
   > invisible to an MCP client — the server is launched by the client, and its cwd is
   > whatever the client chose. Git gets away with this because the user runs it from
   > inside the repo. Should discovery apply to the CLI only, with MCP taking an explicit
   > root?

7. Unrelated FunctionalScript tasks:
   1. Generic partial structures for `scan` state. For example, when `scan` creates a partial object, such as JSON object or an array, we should use a generic type. There should be two main functions for the partial/unfinished structure:
      - `create`, for example when we see `{` or `[`
      - `end` close the structure and return a new complete structure. For example when we see `}` or `]`.
      - `update` - add a new item to the structure.
    We can have a `scan` state machine wrapper, register the partial structure types, and the wrapper may own the stack. We need to investigate the design.
    Some examples: JSON and other PL parsing, SHA2 state, etc.

      > **The duplication this removes is already visible.** `fjs/media/json/parser` hand-rolls
      > exactly this shape: `startArray` / `endArray` (= `create` / `end`), `pushKey` /
      > `pushValue` (= `update`), and a `{ top, stack }` pair holding the structure under
      > construction plus its enclosing ones. That `top`/`stack` management is the bulk of
      > the file, which is the concrete argument for the wrapper owning the stack.
      >
      > **Note — SHA2 is the more interesting example, and may not fit.** A digest is a
      > *flat* accumulator with a fixed-size partial block: no nesting, so no stack, and
      > `end` (padding + finalization) is not symmetric with `create`. If the abstraction is
      > built stack-first from the JSON case, SHA2 will not fit it. Deciding up front whether
      > the target is "nested structures" or "partial values in general" is what keeps this
      > from being discovered late — and worth checking `fjs/media/nix` and `fjs/media/html`
      > against the same question.
