# Migration report: FunctionalScript 0.47.0 → 0.48.0

**Written 2026-08-31, for Sergey**, in the shape of
[`fjs-0.46.1-migration.md`](./fjs-0.46.1-migration.md), which was asked for by name in
`todo/update-fjs-0.46.0` (PR #96).

**It records where the migration cost nothing as well as where it cost.** A report that lists only
breakage overstates the release, and 0.48.0 is a release whose two breaking changes were, between
them, about forty minutes of mechanical work and one genuinely interesting semantic discovery.

**0.47.0 has no report of its own**, and that is itself a finding — see §5.1. What is known about
it is folded in here.

---

## 1. The numbers

| | 0.47.0 → 0.48.0 |
|---|---|
| published | 2026-08-30T19:06:59Z, three days after 0.47.0 |
| upstream files changed / added / removed | 235 / 15 / 7 |
| upstream modules this repo imports | 50, of which **28 changed and 5 moved** |
| breaking changes reaching this code | **2** |
| `rtti` import sites rewritten | **140**, in 42 files |
| `option(…)` call sites rewritten | **459**, in 34 files |
| call sites needing a real decision, not a rewrite | **38**, in 12 files |
| files changed here | 81 |
| `tsc` errors at the worst moment | **2671** |
| served JSON Schemas that moved | **0** |

**The 2671 is the honest headline and it is also misleading**, which is why both halves are here.
It is what `tsc` reported after the `rtti` path rewrite and before the `option` rewrite — a number
that looks like a rewrite of the repository and was in fact one `sed`-shaped change away from 38.
The useful figure is the last one: **zero served schemas moved**, which is the only thing the
application's clients could have noticed.

---

## 2. The two changes

### 2.1 `rtti` relocated — 140 sites, and nothing else

`functionalscript/fjs/types/rtti/…` → `functionalscript/fjs/rtti/…`. The public constructor
surface is unchanged; the only additions are two `_`-prefixed internals. Five distinct specifiers
were in use, and the three ending `types.js` kept their spelling because TypeScript resolves them
to the `types.d.ts` that moved with them.

**Cost: near zero.** One `sed`, one `tsc` run to confirm.

### 2.2 `option` stopped being a function — 459 sites, and one real discovery

0.47.0 defined `option = t => or(t, undefined)`, called `option(string)`.
0.48.0 defines `option = type0('option')`, used `or(option, string)`.

The rewrite is `option(` → `or(option, `, keeping the call's own closing paren. Two things made it
worth more care than that suggests:

**A Type is a thunk, so the old spelling still runs.** `option(string)` under 0.48.0 calls the
`['option']` thunk with an ignored argument and returns the bare tag — **the declared type silently
dropped**, yielding a schema admitting only absence. It compiles as a call. Had `tsc` not caught
the result type at 2671 sites, this would have been a schema change disguised as a no-op.

**One `option(` was not rtti at all.** `demo/steps/02-line16.js` builds an HTML `<option>` from
`demo/lib/dom.js`. The first sweep rewrote it. It was caught by checking each file's *import* for
`option` before accepting the rewrite, not by the type checker and not by the suite.

---

## 3. Where the cost actually was: absence is not `undefined`

This is the part that was not mechanical, and the part worth Sergey's attention.

`or(T, undefined)` meant **"present, may hold `undefined`"**. `or(option, T)` means **"may be
absent"**. Upstream's own docstring is explicit that `{}` and `{ a: undefined }` are two distinct
values.

**38 call sites here had written `{ ...base, field: undefined }` to mean "absent".** Under the old
schema that was accepted, because the old schema conflated the two. Under the new one it is a type
error, and — more to the point — those documents were *malformed*: they claimed a shape their own
schema no longer admits.

They had never bitten, for a reason worth recording: every production reader takes these fields by
value (`k1.materialParticipation`, `boxCents(k1.box1OrdinaryBusinessIncome)`) and none tests with
`in`. So the runtime behaviour is unchanged by the fix while the documents become valid again.

**The proofs got sharper, not merely type-clean.** Two of them were reading an rtti `no match`
array where they meant to read a semantic refusal, and passed only because they asserted
`t === 'error'` *before* reading the message:

- `k1_1065.boxG.neitherPartnerTypeIsRefused`
- `rental_property.validate.theRoyaltyPartitionIsEnforcedBothWays`

`fjs/return/tripwire` had already documented the correct convention at line 930 — *"a spread of
`undefined` leaves the KEY present"* — while violating it at line 2113. The rule was known; it was
the enforcement that did not exist.

**Recommendation for the release notes:** say plainly that `option(T)` → `or(option, T)` is not a
spelling change, and that any fixture spelling absence as `field: undefined` is now wrong. That one
sentence is worth more to a downstream consumer than the file counts.

---

## 4. What decided the migration, and what did not

**`tsc` at 0 did not decide it.** v5's Phase 38 is why: its call-site `open()` experiment
typechecked, passed the whole suite, and still moved 47 served containers while presenting the
smaller diff as proof.

So the deciding check was **`toJsonSchema` over all 30 dialect schemas, byte-identical across the
bump** — sha `6062f5b85f01160b` before and after. The harness is kept at
[`fjs-0.48.0-migration-harness/`](./fjs-0.48.0-migration-harness/) and drives the real MCP handler
rather than re-deriving the schema map, because it is the served path the criterion is about.

Supporting checks, in the order they earned their place:

| check | result |
|---|---|
| proof-leaf **set** may only grow | 3265 → 3275, one name absent and it is a documented rename |
| assertion counts per changed file | **0 fell** — not one file |
| `npm test` / integration / ui | 3324/3324 · 13/13 · 46/46 |
| coverage, no file below 95% | held |

---

## 5. What we learned

### 5.1 A release can close a gap and nobody notices

**0.47.0 retired the MCP protocol-version gap and this repository did not notice for four days.**
`_negotiateVersion` shipped on 2026-08-27; `fjs/server/module.f.js` went on carrying a docstring
headed *"The protocol-version pin is a known upstream gap, not a design choice"* and instructing
readers not to work around it, plus three citations of a note deleted two milestones earlier.

The proof that should have caught it **could not**. It asked for a revision the server did not
advertise, against a list of exactly one entry — so the counter-proposal equalled the old
unconditional pin, and the assertion survived the very change it was written to detect. A leaf that
cannot fail is not evidence, and this one stayed green through a behavioural change without being
touched.

**This is the general lesson: a downstream consumer needs a way to learn that a gap it filed has
closed.** A `fjs/todo/upstream-*.md` file records that a gap exists; nothing re-reads it when a
release ships. Suggested: name the closing release in the changelog entry against the issue number
the consumer filed, so a `grep` of the changelog for one's own open notes is a five-second check.

### 5.2 A `git diff --stat` predicts almost nothing about blast radius

The 0.46.1 report already said this; 0.48.0 confirms it twice over. **235 upstream files changed
and 2 of them reached this code.** Meanwhile 5 moved files produced 140 edits here, and one
four-line definition change produced 459.

The predictive quantity is not files changed. It is **which exported names a consumer imports, and
whether their arity or meaning moved**. `option` changed arity *and* meaning in four lines and cost
more than the other 234 files combined.

### 5.3 Verification harnesses need their own verification

Two checks in this migration proved nothing and had to be redone:

- The per-file coverage floor was measured against a `tail`-truncated report — six lines, no file
  rows. It could not have failed. Re-run in full it found two real violations.
- Two mutation checks were rejected at `tsc` and therefore never ran the suite; they looked "red"
  and meant nothing. A mutation must **compile** to be a mutation.

Both are the same error as §5.1's fake pass, one level up: **a check whose failure mode is
"silently vacuous" is worse than no check**, because it is reported as evidence.

---

## 6. What cost nothing

Stated because a report that lists only breakage overstates the release.

- **No dependency was added or removed.** One version string.
- **No served schema changed.** Zero of 30.
- **No assertion count fell** in any of 81 changed files.
- **No public behaviour changed** — the 38 fixture fixes are test-side, and every production reader
  was already `undefined`-tolerant.
- **28 of the 50 imported modules changed upstream and 26 of them cost nothing at all.**
- The one capability adopted (§7) **deleted** code rather than adding it.

---

## 7. Capabilities adopted, and two deliberately not

MAINT-11's rule: **a capability is adopted because it deletes something.** One that
adds code without removing any is not adopted.

**`fjs web` — ATTEMPTED, REVERTED, and filed upstream.** This was to be the headline: `demo/serve.sh`
runs `python3 -m http.server`, the last place anything outside `functionalscript` is executed.

**`fjs web` answers 413 for any file larger than one `Vec` — 131072 bytes — and eleven files this
demo loads are over it.** `fjs/form1040/core/module.f.js` is 995159 bytes, 7.6x the ceiling.

The swap was made and the **UI suite caught it**: 44 of 46 Playwright tests failed with an empty
`#dialect` and an empty `#step`, because the engine modules the page imports never arrived. Worth
Sergey's attention: **the page itself did not obviously break.** `entry.html`, `entry.js` and every
small module returned 200, so a smoke test that merely loaded the page would have passed, and
`curl`-ing the three paths I checked first all returned 200 — the failure only appeared under a
browser actually resolving the import graph.

Recorded in `fjs/todo/upstream-web-vec-size-limit.md`, with the suggestion that streaming the body
is the fix that removes the ceiling rather than raising it, and that **413 is arguably the wrong
status** — 413 says the *request* was too large. Under the standing authority in §7 of AGENTS.md
it was taken upstream directly, as
[`functionalscript#1819`](https://github.com/functionalscript/functionalscript/issues/1819).

The one-line command description, `Serve a directory over HTTP`, gives no hint of a 128 KiB
ceiling; the module docstring's response table does state it. For a capability meant to replace a
general-purpose static server, that row deserves to be in the release notes.

**`toolResultStep` — adopted, at three sites.** It states the value and error renderers in one call
and deleted a `mapStep`/`catchStep` sandwich at each, plus the `okResult`/`errorResult` imports from
two modules entirely.

**`path.escapes` — NOT adopted.** There is no hand-rolled `..` guard here to delete; the only place
this repository needed one was the demo server, and `fjs web` now does it internally. Adopting it
directly would have added an import and removed nothing.

**`memoryRun` — NOT adopted.** It runs *memory-only* effects with a store per call. This project's
entry point is a full node program over file CAS and stdio, for which `run` is already correct.

---

## 8. For the next release

1. **`fjs web`'s 128 KiB ceiling** (§7) — the only finding here that blocked work rather than merely
   costing time.
2. **Name the closing release against the filed issue number** (§5.1) — the single highest-value
   process change for a downstream consumer.
3. **In the notes, say what a changed combinator *means*, not only its new spelling** (§3).
4. `option`'s docstring is genuinely good — the four-line table of `or(option, number)` versus
   `or(number, undefined)` answered the question this migration turned on. More of that.
