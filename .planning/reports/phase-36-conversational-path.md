# Phase 36 — The Conversational Path

**A real `node index.js` server, driven over stdio as a chat client drives it. 2026-09-07.**

> The phase is one sentence: *documents into chat, "what do I owe for 2025?", answer end
> to end with citing hashes, no code touched.* It is Phase 14's Success Criterion 1,
> which was never run because it needed a session nobody had scheduled.
>
> **"No code touched" is the criterion, not a convenience.** The claim under test is that
> the MCP surface as it already ships is sufficient for an agent to take raw documents,
> store them, compute a return, and answer a natural-language question with a hash behind
> every figure — without anyone adding a tool or changing the engine. Nothing under
> `fjs/` was modified to produce this report. The one file added is a client.

---

## 0. Headline

| | |
|---|---|
| The question | *"What do I owe for 2025?"* |
| **The answer** | **$6,135.00 owed** — Form 1040 line 37 |
| Figures on the return | 56 lines, plus the §199A(c)(2) carryforward |
| Citations behind them | **144** `(documentHash, boxPath, value)` tuples |
| Citations that resolve out of CAS to the claimed value | **135 of 144** as first filed; **144 of 144** after one client-side amendment |
| Citations naming a value the store contradicts | **0** |
| Tools added or engine lines changed to get there | **0** |
| Steps requiring something the MCP surface cannot supply | **1** — the program's source text |

**Verdict: the surface is sufficient for everything except authoring the program, and
that one exception decides the phase.** Storage, discovery, execution, the answer, and
the citation chain all work through the shipped tools. But the vocabulary a stored
program must be written in appears nowhere on the surface, and a wrong guess at it does
not produce a refusal — it terminates the server process.

The executable record is `conversational-path-integration.test.js` (12 subtests, all
green). Every number in this report is asserted there; nothing below is prose-only.

---

## 1. How it was driven, and why not the way the phase's brief preferred

The brief asked for the technique the end-to-end proofs in `fjs/server/module.f.js` use —
NDJSON over the real handlers under `fjs/effects/node/virtual`. **That technique cannot
answer this question, and the repository already knew it.**

`proof.weekOneConvergence` is titled "end to end" and asserts an **error**: under
`virtual`, `writeFile` represents a file as an array of `Vec` chunks and `import_`
requires a `JsModule` function, so materialise-then-import cannot be composed in one
virtual session (`fjs/server/fjs_run/module.f.js`'s own module header, and
`fjs/guest/materialize`'s). A `fjs_run` that reaches `'ok'` is not reachable there. Since
the phase's whole content is a successful run whose answer is then traced, the virtual
harness was set aside and the real-process technique used instead — the same one
`tax-return-integration.test.js` and `fjs-run-integration.test.js` use:

```
spawn('node', [<repo>/index.js, <fresh temp home>], { stdio: ['pipe','pipe','pipe'] })
```

JSON-RPC over the process's real stdin/stdout, readiness proven by matching a response's
own `id` and never by a sleep, a fresh CAS home under `os.tmpdir()`. This is stated as a
finding rather than a deviation: **the preferred technique is structurally incapable of
running this phase**, and `.planning/v4-MILESTONE-AUDIT.md` §"Phase 36's prerequisite"
had already predicted the phase would land as a root-level `@ts-nocheck` harness for
exactly this reason.

Two server processes are spawned. The second exists because the fourth finding below is
that a server dies, and running that against the main session would take the rest of the
transcript with it.

---

## 2. The taxpayer, and why this one

One single filer, tax year 2025, three forms, **withholding deliberately short of the
tax**. Every other integration fixture in this repository overpays, so every one of them
can only ever answer "you are owed a refund" — which is not the question the phase asks.

Documents arrive the way a chat client hands them over: as an artifact first (a scan),
with the structured document derived from it second. All identifiers are digit-only,
because `ACC-0001`-shaped fixture strings read as requirement citations to
`planning-truth-gate.test.js`'s ID scan.

| | |
|---|---|
| Form W-2, box 1 wages | $88,000.00 |
| Form W-2, box 2 federal income tax withheld | $6,000.00 |
| Form 1099-INT, box 1 interest income | $2,400.00 |
| Form 1099-DIV, box 1a total ordinary dividends | $3,600.00 |
| `vnd.fjs.return_profile` | single, 0 dependents, four declared kinds |

**The arithmetic, hand-derived before the engine was asked**, so the assertions are
independent of the code under test:

```
line 1a   wages                                        88,000.00
line 2b   taxable interest                              2,400.00
line 3b   ordinary dividends                            3,600.00
line 9    total income                                 94,000.00
line 11b  adjusted gross income (nothing to adjust)    94,000.00
line 12e  standard deduction, single, TY2025           15,750.00
line 15   taxable income  94,000.00 - 15,750.00        78,250.00
line 16   tax (Tax Table)                              12,135.00
line 25a  federal income tax withheld (W-2 box 2)       6,000.00
line 33   total payments                                6,000.00
line 34   overpaid                                          0.00
line 37   AMOUNT YOU OWE  12,135.00 - 6,000.00          6,135.00
```

Line 16 is a Tax Table **band** lookup, not a bracket evaluation. $78,250.00 opens the
"at least $78,250, but less than $78,300" row (the $50-wide region runs $3,000 to
$100,000, `fjs/tax/table`'s `taxTableBandStructure`), and the printed tax is the bracket
schedule applied to that band's **$78,275 midpoint**:

```
10% x 11,925.00                              =  1,192.50
12% x (48,475.00 - 11,925.00 = 36,550.00)    =  4,386.00
22% x (78,275.00 - 48,475.00 = 29,800.00)    =  6,556.00
                                                ---------
                                                12,134.50   -> half up -> 12,135.00
```

The same derivation reproduces `tax-return-integration.test.js`'s own independently
hand-typed figure ($41,709.00 → the $41,700/$41,750 band, midpoint $41,725, $1,192.50 +
12% × $29,800.00 = $4,768.50 → $4,769), which is the check that the midpoint-and-half-up
rule used here is the right one rather than a guess that happened to land.

**The engine agreed on every line.** Line 16 came back `12135.00`, line 37 `6135.00`.

---

## 3. The transcript

Abridged to one line per call; the full request/response pairs are what
`conversational-path-integration.test.js` sends and asserts. Hashes are cBase32 and
**reproducible** — the store is content-addressed and the fixture is a literal, so the
same bytes take the same address on any machine. The four document hashes and the
1099-DIV artifact hash are asserted as literals in the harness, so this table stays true
by construction rather than by someone remembering to update it.

### 3.1 The session opens

```
-> initialize                      protocolVersion 2025-06-18 requested
<- result                          finance-mcp 1.0.0, protocolVersion 2025-11-25
-> notifications/initialized
-> tools/list
<- result                          13 tools, none naming 1040
```

The thirteen: `cas_add`, `cas_get`, `cas_list`, `cas_refresh`, `evo_add`, `evo_head`,
`evo_list`, `evo_revision`, `finance_documents_list`, `finance_schema`,
`finance_tax_params`, `fjs_check`, `fjs_run`. Unchanged by this phase — the harness
asserts both the name set and the count, and asserts no advertised name contains `1040`,
because `.planning/REQUIREMENTS.md` permanently forbids a tool that computes the form.

### 3.2 Discovery — everything the surface volunteers

```
-> finance_schema  { dialect: "vnd.fjs.not-a-real-dialect" }
<- isError: true   "unknown dialect: vnd.fjs.not-a-real-dialect; known: vnd.fjs.1099int,
                    vnd.fjs.ocr, vnd.fjs.w2, ... vnd.fjs.farm"          (30 dialects)
-> finance_schema  x30, one per name in that list
<- result          each dialect's own RTTI, as JSON Schema
-> finance_tax_params { year: 2025 }
<- result          ... "15750.00" ... "2025-32" ...
```

This is the one place the server describes itself without being told what to ask for, and
it works: an agent that knows only the tool list can reach every dialect's field names
from a deliberate wrong guess at a tag. §5.1 turns on there being **no equivalent** for
the guest vocabulary.

### 3.3 The documents go in

Artifacts first — `vnd.fjs.ocr`, the thing that actually arrives in a chat:

| artifact | hash |
|---|---|
| W-2 scan | `2b7qz78k2q65g0ptknrsze2jzwgbe6kfs657a4y8j9hnm6nr0qa8` |
| 1099-INT scan | `jxbwk9mdar0epwj4f53fbhwdg3g90qxsydzwf2pzw16n4bfgdzp8` |
| 1099-DIV scan | `43ft5bp5te3t9jkw88gv4k9thxe8e2dc47fdxzf5kyh6ysk5z28r` |

Then the structured documents read off them, each stored with `cas_add` and filed against
a subject with `evo_add`:

| document | dialect | `cas_add` hash | `evo_add` revision |
|---|---|---|---|
| profile | `vnd.fjs.return_profile` | `1fkm7jz0skzaxdfstfakdz4z00d4f7t98sp7q233q43rt97mv69r` | `k1acsj45fajfah03pvte33dy0vspnr4hzkhcbq5h3x916kv93f78` |
| Form W-2 | `vnd.fjs.w2` | `1gk7pmczjxjdcme3w4wj1q4vxrc4x9b25xq88888xpm9dx0pb6cr` | `nkc9wvh38yytd7ckmmp9s7ynqq5n9rx656yxj7c0ya2p1586xa88` |
| Form 1099-INT | `vnd.fjs.1099int` | `8nnemgkk1vy29e1bx2e4adanpbn36afwmyaft1bpw71ffhaknp98` | `qcg0dv52b155dnh0n8gmxwrt5tyrqckfm5j7642tawmsx2v7y4y8` |
| Form 1099-DIV | `vnd.fjs.1099div` | `xpka6kk85992ejkdawbpjtq8wt3jr7qh1x56qvjh4sssc454s0e8` | `snt6mavt71dey84wv22xwdfsmex7fha1v79gsgbzzq4e9mgw3dkr` |

**Only `vnd.fjs.1099div` has anywhere to record which scan it came from.**
`sourceArtifactHash` is a required field on that dialect and on `vnd.fjs.1099b`, and
exists on no other, so the W-2's and the 1099-INT's artifacts are stored and orphaned.
The artifact leg of the citation chain is one dialect wide. That is a fact about the
dialect set, not a defect in this run, and it is recorded because "documents into chat"
makes the scan a first-class input and the chain stops one step short of it for 28 of the
30 dialects.

`finance_documents_list` then reports four rows. **Its `hash` is the head revision's, not
the document's** — one row per (subject, head) pair, by design. The route from a listing
to a document body is therefore `evo_revision(hash).snapshot` → `cas_get`, and the
harness walks it for all four, because that is the route an agent answering a question
about a stored figure actually takes.

### 3.4 The program, and the run

```
-> cas_add   <taxReturnReportSource>
<- 7m1kr9g4v7t6kpr80zex44c7byrm2ww7s9xjtjnbbcqgn34vwcqr
-> fjs_check { hash: 7m1kr9... }
<- { "exportsReport": true }
-> fjs_run   { hash: 7m1kr9..., taxYear: 2025 }
<- { resultHash: 6bfxme853569xe1agvb51f5bgx9wdems3p6nqgnch3g1b28p81g8,
     runHash:    5qr3e2e9b73kz3f6zemdy40hqkpym6egx24rmk86sxs507cb156r,
     paramSetHash: j55a6d3px5v5fd5j3z72aff2aej7mvtapr6x1a5svesn7cm936n8,
     taxYear: 2025, readCount: 13, literalCount: 3, ... }
-> cas_get   { hash: 6bfxme..., content: true }
<- { kind: "ok", taxYear: 2025, line16Method: "taxTable", lines: [ 56 ] }
```

`readCount` 13 is `1 + 3 x 4`: one `evoList`, then `evoHead`/`evoRevision`/`casRead` per
subject. Hand-typed in the harness, because "greater than zero" passes for a program that
read one document and invented the rest.

**The `cas_add` on the first line is the whole finding.** See §5.1.

### 3.5 The answer

> **You owe $6,135.00 for tax year 2025.**
>
> Your total income was $94,000.00 — $88,000.00 of wages (Form W-2 box 1,
> `1gk7pmcz…`), $2,400.00 of taxable interest (Form 1099-INT box 1, `8nnemgkk…`)
> and $3,600.00 of ordinary dividends (Form 1099-DIV box 1a, `xpka6kk8…`). Your
> standard deduction as a single filer was $15,750.00, leaving $78,250.00 of taxable
> income and $12,135.00 of tax from the Tax Table. You had $6,000.00 withheld
> (Form W-2 box 2, `1gk7pmcz…`), so $12,135.00 − $6,000.00 = **$6,135.00 is due**.
>
> The whole return is `6bfxme85…`; the run that produced it is `5qr3e2e9…`.

Every hash in that paragraph resolves through `cas_get` and carries the figure claimed
beside it. §4 checks all 144, not just these five.

---

## 4. The citation chain, checked hash by hash

The phase says *"answer end to end with citing hashes"*. A citation nobody resolves is a
string, so the harness fetches **every** source of **every** rendered line through
`cas_get` — the same tool a client would use — parses the document, and compares the box
the citation names against the value the citation claims. `boxPath` is dialect-qualified
where two dialects spell a box the same way (`k1_1041.box1InterestIncome` versus a
1099-INT's `box1InterestIncome`), so the field is the last dotted segment; array-valued
boxes are cited as their JSON rendering.

Three outcomes are counted separately, because "did it resolve" would report the first
two failures identically and they are not the same failure:

| | as first filed | after §4.2's amendment |
|---|---|---|
| Sources examined | 144 | 144 |
| **Resolved** — field present, value agrees | **135** | **144** |
| **Absent** — the document has no such field | **9** | **0** |
| **Mismatched** — the store contradicts the citation | **0** | **0** |
| Distinct documents cited | 4 | 4 |

Every cited hash is one of the four documents this session filed, and all four are cited:
no figure was traced to something the store never received, and no stored document went
unread.

### 4.1 The bottom line, resolved

Form 1040 line 37, `6135.00`, cites seven sources. Each row was fetched and compared:

| cited hash | box | claimed | stored | resolves |
|---|---|---|---|---|
| `1gk7pmcz…` | `box1WagesTipsOtherCompensation` | `88000.00` | `88000.00` | yes |
| `1gk7pmcz…` | `box2FederalIncomeTaxWithheld` | `6000.00` | `6000.00` | yes |
| `8nnemgkk…` | `box1InterestIncome` | `2400.00` | `2400.00` | yes |
| `xpka6kk8…` | `box1aTotalOrdinaryDividends` | `3600.00` | `3600.00` | yes |
| `1fkm7jz0…` | `filingStatus` | `single` | `single` | yes |
| `1fkm7jz0…` | `declaredKinds` | `["wages","taxableInterest","ordinaryDividends","federalTaxWithheldOnW2"]` | identical | yes |
| `1fkm7jz0…` | `dependents` | `[]` | *no such field* | **no** |

And one step further back than any existing proof goes: the 1099-DIV's own
`sourceArtifactHash` is `43ft5bp5…`, which `cas_get` resolves to the `vnd.fjs.ocr`
artifact whose `fields.box1a` is `3600.00` — the same figure line 3b prints. The chain
runs **figure → document → scan** for the one dialect that can express it.

### 4.2 The nine that do not resolve, and how they close

All nine are the same box on the same document, and all nine are the same cause.
`fjs/form1040/core/module.f.js:3151` builds

```js
const dependentsSource = {
    documentHash: profile.documentHash,
    boxPath: 'dependents',
    value: JSON.stringify(profile.value.dependents ?? []),
}
```

`dependents` is **optional** on `vnd.fjs.return_profile` — `checkReferences` requires it
to agree with `dependentCount` only when present — so a profile that legally omits it is
cited as saying `[]` when it says nothing at all. The claim is semantically true (this
taxpayer has no dependents) and literally unreadable: an auditor following the citation
finds no such field. The nine lines are 19, 21, 22, 24, 28, 32, 33, 34 and **37** — the
answer itself is one of them.

**It closes from the client side, with no code changed.** The agent amends the profile to
state the array explicitly and reruns:

```
-> cas_add  {..., "dependents": [], ...}
<- 3zwz9q703wvyf4ys0yrp15ecjs8kn82kvy9jjxwxezmtpse9b0z8
-> evo_add  { parents: [k1acsj45...], subject: "conversational-profile",
              snapshot: 3zwz9q70... }
-> fjs_run  { hash: 7m1kr9..., taxYear: 2025 }
<- resultHash 0s10fpgrq1n7mt9ejv7f6ehh2yw8zw7dnjejqbtrcnpaqadr15er
```

144 of 144 then resolve, and **the answer does not move**: line 37 is still $6,135.00 and
line 16 still $12,135.00, because an empty array and an absent one are the same taxpayer.
A remedy that changed the amount owed would have been the wrong remedy.

That leg is also the control for the one before it. "Nine citations do not resolve" is a
negative, and a negative passes trivially for a resolver that never ran; the same
resolver over a second run of the same program reports zero, so the nine are real.

**Disposition: this is a gap in the document, not in the engine.** It is reported rather
than fixed because the phase's criterion is that no code is touched, and because the fix
is not obvious — dropping the `?? []` would leave the line with an *unciteable* input
rather than a defaulted one, and `ReportLine` makes an empty `sources` unrepresentable by
design. The honest statement is that **the engine can cite a value the document does not
contain, and nothing before now checked.**

### 4.3 Where the statutory figures come from, and why that hash does not resolve

Line 12e is $15,750.00, and its citation **does** resolve — to
`{ filingStatus: 'single' }` on the profile. But that is the input that *selected* the
amount, not the amount. Nothing in the store says $15,750.00. Line 16's $12,135.00 is the
same: the Tax Table it was read out of is not a stored blob either.

The provenance header names where they did come from, by hash — and that hash is not in
the store:

```
-> cas_get { hash: j55a6d3px5v5fd5j3z72aff2aej7mvtapr6x1a5svesn7cm936n8, content: true }
<- isError: true   "no such hash: j55a6d3px5v5fd5j3z72aff2aej7mvtapr6x1a5svesn7cm936n8"
```

The `vnd.fjs.run` record carries the same unresolvable `paramSetHash`, so this is a
property of the provenance record and not of one response. `paramSetHash` is a *digest
of* the parameter set (`fjs/report/provenance`), computed at run time; nothing ever
writes the parameter set into CAS under it. An agent can fetch TY2025's parameters
through `finance_tax_params` and can be told which digest was in effect, but it cannot
fetch the artefact the digest names, and so cannot prove the two are the same object.

For "every figure cites the hash it came from", this is the honest boundary: **the
document-derived figures are traceable to bytes; the statutory ones are traceable to a
name.**

---

## 5. What the surface cannot do

### 5.1 It never names the vocabulary a stored program must be written in

`fjs_run` executes a program stored in CAS. That program is written against `ctx` — the
frozen guest ABI (`fjs/guest`) widened by `fjs/guest/tax` — and it must export an entry
point named `report`. A CAS blob cannot resolve bare specifiers, so a stored program has
**zero** imports and `ctx` is the only vocabulary it has.

The harness captures the entire surface in-session — 13 tool names, descriptions and
input schemas; all 30 served dialect schemas; the tax parameter set; the document list;
the unknown-dialect refusal — roughly 50,000 characters, and searches it for the six
names an agent must know:

| name | needed for | present on the surface |
|---|---|---|
| `form1040Report` | computing a 1040 at all | no |
| `taxParams` | the parameter set the run was bound to | no |
| `centsFromString` | reading a document's money strings | no |
| `centsToString` | rendering a figure back to the wire | no |
| `ctx.step` | sequencing two reads | no |
| `ctx.pure` | returning a result | no |

**None is there.** The search is proven capable of finding things by three controls in
the same leaf (`box1WagesTipsOtherCompensation`, `finance_documents_list` and `15750.00`
are all located), so its emptiness is evidence rather than a broken capture.

The claim is deliberately not overstated. The four read-only op names — `casRead`,
`evoList`, `evoHead`, `evoRevision` — *are* reachable, but only by running a program that
violates the policy and reading `fjs/exec`'s refusal, which prints the permitted list.
They are absent from the static surface (the harness asserts `evoRevision` does not
appear in the 50,000 characters). And four read-only commands are enough to sum boxes;
they are not enough to produce a 1040, which is the entire reason `form1040Report` is
reached through `ctx` rather than through a tool.

**This is the step that fails.** A `finance_compute_1040` tool is forbidden by
`.planning/REQUIREMENTS.md` on the grounds that "the agent would call it and never author
a program again" — a position this report does not dispute. But the consequence is that
authoring is mandatory, and the surface does not teach it.

### 5.2 A wrong guess at the vocabulary ends the session

The consequence of §5.1 is not a slower path to the same place. A second server, a second
store, and a program that walks a subject correctly using the four op names and then
reaches for a tax entry point it has to guess the name of:

```js
return ctx.pure(JSON.stringify(ctx.computeForm1040({ documents: [doc], year: 2025 })))
```

```
-> fjs_check { hash: wp7vhwk2... }
<- { "exportsReport": true }                      <-- passes
-> fjs_run   { hash: wp7vhwk2..., taxYear: 2025 }
<- (no response — the process is gone)
   stderr: TypeError: ctx.computeForm1040 is not a function
   exit code 1
```

Not `isError: true` with a message the agent could read and correct. **The server process
exits and the connection is gone**; the harness confirms a subsequent `cas_list` gets the
same exit report rather than an answer. `fjs_check` does not stand in the way — nor
should it be expected to, its own description says it "confirms a shape, never a sandbox,
verification, or trust boundary" — but that means nothing between an agent and this.

In a chat client this is not a recoverable error the agent apologises for and retries; it
is the MCP connection dropping mid-answer, with the user's documents still in a store the
session can no longer reach until the client reconnects.

### 5.3 What the surface *does* refuse well, stated so §5.2 is not overclaimed

The counterweight, and the reason §5.2 is a gap in the guest ABI's failure mode rather
than "guest programs are unguarded". A program that computes without reading anything:

```
-> fjs_run { hash: <a program that just returns a number>, taxYear: 2025 }
<- isError: true  "fjs_run failed: report produced zero observed reads over any stored
                   document (source contains 0 numeric literal(s)) — a computed report
                   must read at least one stored document (run record: c01pdbdq...)"
```

Precise, in the agent's own terms, with the run record preserved and **the session still
answering** — the harness asserts the server has not exited and that a following
`cas_list` succeeds. `fjs_run` is not careless. The difference is whether the failure is
one `executeRun` can see coming: a hallucinated *answer* is caught, a hallucinated
*vocabulary* is not.

---

## 6. The verdict on sufficiency

Phase 14's criterion names two clients, and they get different answers.

**Claude Desktop, or any client holding only the MCP surface: NOT sufficient.** It cannot
author the program. §5.1 is the reason and §5.2 is what happens when it tries anyway. It
can store documents, read every dialect's schema, read the parameter set, list what it
holds, run a program it already has, fetch a result, and resolve every citation — but the
one step that turns documents into a return is unreachable, and failing at it costs the
session.

**Claude Code, or any client that can also read this repository: sufficient, with the two
qualifications in §4.2 and §4.3.** `taxReturnReportSource` is a module export sitting on
disk; reading it is not touching it. Everything before and after that read is the MCP
surface, and this report's transcript is what it does.

**The gap is exactly one file's worth of knowledge**, and it is worth being precise about
its size: not a missing capability, not a missing tool, not an engine change. What is
absent is a way for the server to tell a client what a stored program may say. The
architecture's central bet — that the agent authors a program rather than calling one —
is currently only payable by an agent that can already see the source.

---

## 7. What a human at a real client adds that this drive does not

This harness simulates the client. Stating the difference plainly, because glossing it
would make the verdict read stronger than it is:

1. **Vision.** The `vnd.fjs.ocr` artifacts here are hand-written JSON with the box values
   already in them. A real session starts from a photograph or a PDF, and the model reads
   the boxes off it. **Nothing in this run tests that reading.** Whether a model
   transcribes Form W-2 box 1 correctly from a scan is untested here and is the single
   largest untested step in the conversational path.
2. **Choosing the calls.** Every call in this transcript is scripted, in the order a
   competent agent would make them. Nothing here demonstrates that a model *decides* to
   call `finance_schema` before authoring, or that it maps "what do I owe" onto line 37
   rather than line 34. `.planning/v4-MILESTONE-AUDIT.md` named this gap already: "no
   agent driver — every sequence is hand-scripted; nothing reads `tools/list` and
   chooses, which is the actual content of 'the conversational path'."
3. **Authoring under §5.1's constraint.** A model with repository access would read
   `fjs/report/tax_return` and reuse or adapt it. That adaptation — and whether a model
   *reliably* produces a program that runs rather than one that trips §5.2 — is untested.
   This run stores the exact shipped bytes.
4. **The taxpayer's own judgement.** `declaredKinds` is a declaration: the profile here
   asserts four income kinds because the fixture author knew them. In a real session that
   list is elicited from a person who may not know what an income kind is, and a wrong
   declaration is refused by the engine at the door — correctly, but the conversation
   that produces a right one is not modelled here.
5. **Reading the answer back.** The prose in §3.5 was composed for this report from the
   result JSON. A real session's rendering is the model's, and whether it carries the
   hashes into what the user actually sees — the phase's own words — is a property of the
   client, not of the server.

What the drive *does* establish, and a hand-run session could not establish as firmly, is
that every mechanical claim between `cas_add` and the last resolved citation holds under
assertion, repeatably, on a real process and a real filesystem.

---

## 8. Verification

| | |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `node --test all.test.js` | **3344 / 3344** (unchanged — this phase adds no `proof` leaf) |
| `npm run cov` | exit 0 at 100 lines / 100 branches / 100 functions; **3405 / 3405**, 123 rows in the report, **no file below 100 on any metric** (baseline before this phase: 3393) |
| `node --test planning-truth-gate.test.js` | **24 / 24** |
| `node --test conversational-path-integration.test.js` | **12 / 12** |

Four assertions were watched to fail before being trusted, per AGENTS.md:

| mutation | reddened |
|---|---|
| `amountOwedCents` 613500n → 613600n | the answer leaf, and the amendment leaf |
| `box1WagesTipsOtherCompensation` added to the vocabulary list | the §5.1 leaf, reporting it as found |
| expected server exit code 1 → 0 | the §5.2 leaf |
| `'1040 line 37 -> dependents = []'` removed from the absent list | the §4.2 leaf, naming the missing row |

---

## 9. What this leaves open

- **The two gaps are not closed and were deliberately not closed.** Closing §5.1 means
  either a tool that describes the guest ABI or documentation the client can fetch, and
  both are code. That is a decision for the owners, not for the phase that found it.
- **§5.2 is the more urgent of the two** and is separable from it: a guest that throws
  should become a `status: 'error'` run record and an `isError` result, exactly as a
  guest that reads nothing already does. It is filed here rather than fixed for the same
  reason.
- **§4.2's `?? []`** is a one-line question with a real design answer behind it, and it
  wants the `ReportLine` non-empty-`sources` invariant considered alongside it.
- **The vision step (§7.1) remains completely untested**, here and everywhere else in
  this repository.
