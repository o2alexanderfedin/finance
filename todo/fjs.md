# FunctionalScript Updates

Work items to land in FunctionalScript itself, driven by what `finance` needs.

> Blockquoted notes are commentary added while reviewing, not part of the original
> proposal. Each is either a verified fact about fjs as it stands, or an open decision
> worth settling before implementation.

1. Formats:
   - Forms: W-2, 1099-*
   - Bank Statements
   - Expenses (Receipts)
   - Tax Return Config:
     - Entity (SSN)
     - Status (filing status — single, married filing jointly, …)
     - All other fields; it may include references to other files and entities.

   > **Note.** These are `vnd.fjs.*` dialects per the Revision precedent, so each is an
   > rtti schema plus a semantic check. See `todo/plan.md` Week 1 step 5.
   >
   > **Open.** "Tax Return Config" is a different kind of thing from the other three: a
   > W-2 is a *transcription of a document that exists*, whereas the config is *user-entered
   > state* with no source document behind it. That difference shows up in provenance —
   > a transcribed form cites the PDF's CAS hash, the config cites nothing. Worth deciding
   > whether they share the document base at all, or whether config is its own kind.
   >
   > **Open.** An SSN identifies the entity but is also the most sensitive field we would
   > ever store, and CAS is immutable — a value written once cannot be unwritten. Consider
   > referencing an entity by subject and keeping the SSN out of content-addressed storage,
   > or storing only a last-4 plus a reference.

2. FJS Runner:
   - Types:
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
   - Design a URL format.

   > **Note.** The three pure subtypes form a genuine lattice — each strictly more
   > permissive than the last — and it maps onto the operation vocabulary in
   > `fjs/todo/implement-mcp-server.md`: "no imports and no reading" needs an empty map,
   > "reading by hash" needs `casRead`. So this list *is* the whitelist design, viewed
   > from the program's side rather than the runner's.
   >
   > **Note.** "Impure" here is narrower than it sounds: resolving a subject to its head is
   > impure only because the head moves. Everything downstream of resolution is pure again.
   > That is exactly why the lock file works — it pins the resolution, and the run becomes
   > reproducible without the program changing.
   >
   > **Open.** Generate-then-pin has a trust-on-first-use property: the first run is
   > unpinned by construction, so whatever the heads happened to be is what gets recorded.
   > Fine for a local single user; worth naming as a limitation rather than discovering it.

3. Big file uploader. Solutions:
   - CLI. Actually, we can just use `fjs cas add ...`
   - Web Server

   > **Note.** `casAddFile` and `casUpload` already exist in `fjs/cas`, and `casUpload`
   > streams from `~/cas_upload/` and deletes the source on success. Chunking is 128 KiB
   > with lock-free staging writes, so the streaming problem is solved; what is missing is
   > only the *transport* in front of it.
   >
   > **Open.** A web server contradicts "stdio only, no HTTP, no hosting" in
   > `todo/plan.md` Settled Decisions. If it is a local-only upload helper rather than a
   > network service that is probably fine, but it should be said explicitly — otherwise
   > this is the first crack in the transport decision.

4. Decimals and BigIntegers for finance. Proposed solution:
   Type-aware JSON parser:
   ```ts
   const parse: <T extends rtti.Type>(type: T) => (s: string) => Ts<T>
   ```
   Implementation:
   1. Extend the JSON parser to recognize integer values and return them as bigints.
   2. The standard parser will use the extended parser and convert all bigints to numbers.
   3. Our "type-aware JSON parser" will use the extended parser.

   Our forms will use ONLY integers for currencies (cents), percentages, etc. No
   big fixed-point decimals for now. If needed, a form may specify fixed-point positions
   for some values for the whole JSON. For example, if by default a form assumes that our
   units are percent, but a particular form requires hundredths of a percent, then the form
   may specify something like `{"percentage-point-position":2}`. We may also select a
   default value for all forms. Most likely, for currencies we should use cents (the
   minimal unit), and for percentages hundredths of a percent. `$100.23 = 10023`,
   `3.45% = 345`.

   > **Signature fix.** The original read `(type: rtti.Type)`, which makes `T`
   > uninferrable — every call would return `Ts<rtti.Type>`. It has to be `(type: T)`.
   >
   > **This supersedes a settled decision, and that is good news.** `todo/plan.md` Week 1
   > step 5 and the PROJECT.md requirement both say money fields must be JSON **strings**,
   > "never JSON numbers", because `fjs/media/json`'s value model types a number as rtti
   > `Number` — a JS double — so exactness was lost before any arithmetic. A type-aware
   > parser removes that constraint: the tokenizer already carries the literal text and an
   > exact `BigFloat`, so a parser that knows the target type is `bigint` can produce one
   > without ever going through a double. If this lands, money can be a JSON number again
   > and the string encoding is unnecessary. **Those two documents must be updated together
   > with this**, or the format decision and the parser decision will disagree.
   >
   > **Open.** Scaling as *JSON-wide metadata* (`{"percentage-point-position":2}`) makes a
   > field's meaning depend on a value elsewhere in the document, so a value cannot be
   > interpreted in isolation and two documents of the same dialect can disagree about what
   > `345` means. The alternative is to fix the scale per field in the schema, which is
   > uniform and needs no metadata, at the cost of a new dialect version if a scale ever
   > changes. Which do we want?
   >
   > **Open.** Percentages are the case where integers-only bites: a third of a percent is
   > not representable at any fixed scale, so any proration or apportionment rounds at
   > entry rather than at the point the form specifies. Are there computations we need that
   > divide, and if so, where is the rounding allowed to happen?

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
   1. ~~Move `fjs/media/json/rpc` to `fjs/protocol/jsonrpc`.~~ **Already done** — verified
      in both `functionalscript@0.41.0` and the submodule at `main`: `fjs/protocol/json_rpc`
      exists and `fjs/media/json/rpc` is gone. Note it landed as `json_rpc` (snake_case),
      matching the sibling `fjs/protocol/mcp`, not `jsonrpc`.
   2. Generic partial structures for `scan` state.

      > **Open.** `fjs/types/list` has three variants already — `scan` (`Scan<I,O> =
      > (input: I) => [O, Scan<I,O>]`), `stateScan` (`StateScan<I,S,O> = (input: I, prior:
      > S) => [O, S]`), and `foldScan` — plus `stateScanToScan` and `foldToScan` to convert
      > between them. Since `stateScan` already threads an arbitrary `S`, what does
      > "generic partial structures" add that `S` does not? A worked example of a state
      > this cannot express would make the task concrete.
