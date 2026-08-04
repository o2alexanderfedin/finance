# Phase 5: Document Base, Subject Model, and the First Two Dialects - Context

**Gathered:** 2026-08-04
**Status:** Ready for planning

<domain>
## Phase Boundary

A document can be stored, versioned, and read back under an identity that can never be wrong, with
the vision transcription preserved as its own artifact.

In scope: the shared document base, the Evo subject convention, two dialects (`vnd.fjs.ocr` and
`vnd.fjs.1099int`), and the >128 KiB CLI ingestion route with its cache-refresh path.
Requirements DOC-00, DOC-01, DOC-03, DOC-04, DOC-10, DOC-11, DOC-12, DOC-14.

Out of scope: further dialects (W-2, 1099-DIV, 1099-B — Phases 11–12), the consolidated-brokerage
split (DOC-13), the `archived` retraction story (DOC-15), `fjs/media` `detect` registration
(DOC-16), and anything that computes on a document. This phase stores and reads; it does not
calculate.
</domain>

<decisions>
## Implementation Decisions

### The precedent is `fjs/media/revision`, and it is small

122 lines, and it is the exact shape DOC-00 asks us to mirror:

```js
export const dialect = 'vnd.fjs.revision'
export const mediaType = `application/${dialect}+json`
export const revisionSchema = { … }                 // single source of truth
const validateShape = rttiValidate(revisionSchema)  // structural
export const checkReferences = r => { … }           // semantic, beside the schema
export const validate = value => { … }              // shape then references
```

and in the `.d.ts`: `export type Revision = Ts<typeof revisionSchema>` — the type derived, never
declared twice.

**`Ts` is at `fjs/types/rtti/ts/module.f.js`, a subdirectory — not the main `fjs/types/rtti`.**
Stated because it is easy to hunt for in the wrong place.

### The comma is a real integration gap — and Phase 4 is right to reject it

Criterion 3 carries `"1,234.56"` from the OCR revision into `123456` cents. Phase 4's parser does
**not** accept that string. Verified:

```
parse(2)("1234.56")   = 123456
parse(2)("1,234.56")  -> THROWS: not a decimal number: 1,234.56
```

**That is correct behaviour, not a bug.** `fjs/types/decimal` is generic and staged for upstreaming;
comma grouping is a presentation convention of printed US forms, not part of a decimal number. A
generic decimal parser has no business knowing about it.

So this phase adds a normalisation step — printed OCR string → canonical decimal string → cents —
and **it must not go into `fjs/types/decimal`.** It belongs beside the dialect conversion, on the one
revision boundary DOC-04 names. Do not "fix" Phase 4's parser to accept commas; that would push a
locale convention into a module meant to leave this repo.

### The subject convention is decided now because it can never be changed

DOC-01: the artifact chain is rooted at the **cBase32 hash of the original artifact**; each extracted
form instance gets its own subject keyed on `(payerTin, recipientTin, accountNumber, taxYear,
formType)`. Human labels live inside snapshots, never in subjects.

A subject cannot be renamed and CAS has no delete. Getting this wrong is not a refactor — it is a
permanent parallel history. Criterion 4's "re-adding the same artifact resolves to the same subject"
is the proof that it is content-derived rather than incidental.

### Three modelling rules that look like details and are not

- **DOC-11 — blank is not zero.** Every box is explicitly absent-able. A missing box that decodes as
  `0` is a silently wrong return, and it is the single easiest way for this system to produce a
  confident wrong number.
- **DOC-10 — carry the form *revision*, not merely the tax year.** Box semantics drift between
  revisions of the same form.
- **DOC-12 — `CORRECTED` is data.** It is printed on the form, so amendment is a read signal, not an
  inference.

### DOC-14: the mechanism exists; the refresh path is the design work

`npx functionalscript cas` is a real CLI subcommand (verified). For the running server to see a store
mutated by another process, fjs offers two levers in `fjs/cas/evo`:
`buildCache` (full rescan) and `syncRevision` (targeted, but needs the hash and bytes handed to it —
which an external `cas add` does not provide). Criterion 5 demands visibility **without a restart**.

### Claude's Discretion

- Module layout under `fjs/` for the base, the two dialects, and the conversion.
- Whether the shared base is a spread helper (`{ ...base('vnd.fjs.1099int'), ...fields }`) or another
  composition — DOC-00 notes an RTTI `Struct` is a string map, so spreading works without schema
  inheritance the type system lacks.
- Which refresh lever satisfies criterion 5, and its trigger.

</decisions>

<code_context>
## Existing Code Insights

### What this phase builds on

| From | What |
|---|---|
| Phase 2 | `fjs/server/module.f.js` — the project-local store and the running server criterion 5 tests |
| Phase 4 | `fjs/types/decimal` (`parse`/`format`, generic) and `fjs/exact` (cents composition) |
| fjs | `fjs/media/revision` (the template), `fjs/types/rtti` + `fjs/types/rtti/ts` (`Ts`), `fjs/cas/evo` (`addRevision`, `readRevision`, `buildCache`, `syncRevision`) |

Phase 3's `fjs/exec` is unrelated and must not be imported here.

Suite is green: `npm test` 40 pass / 0 fail, `npx tsc --noEmit` clean, on fjs 0.41.0.

### Established patterns

- All source `.f.js` under `fjs/`, pure, ESM. Only `index.js`, `all.test.js` and the launcher are impure.
- New formats follow the Revision precedent: JSON plus a dialect tag, named `vnd.fjs.<name>`,
  yielding media type `application/vnd.fjs.<name>+json` (AGENTS.md).
- **Money in a stored JSON document is a string, never a JSON number** (AGENTS.md, absolute).
- Tests are `proof` exports discovered by root `all.test.js`. Only `npm test` /
  `node --test all.test.js` run them — `node --test <source-file>` is a fake pass.
- Maximally strict `tsc`; never relax a flag. Known obstacles already solved here:
  `JSON.stringify` cannot serialize `bigint` (use a replacer), `noUnusedParameters` on stubs (use
  `void` statements).

</code_context>

<specifics>
## Specific Ideas

**Criterion 1 forbids the shortcut.** A `vnd.fjs.ocr` blob must fail `vnd.fjs.1099int` validation on
**structure alone**, via the exact-literal `dialect` discriminant — explicitly not by string-matching
a `{"dialect":` prefix. The discriminant has to do the work inside RTTI validation.

**Criterion 2 forbids the second declaration.** The TypeScript type must derive via
`Ts<typeof schema>` and appear nowhere a second time. A hand-written interface that happens to match
is the failure this criterion exists to catch — it passes `tsc` and drifts silently.

**Criterion 3 says "exactly one revision boundary."** The `"1,234.56" → 123456` conversion happens
once, on the OCR→typed transition. If two places can convert, they can disagree.

**Criterion 4 bundles four independent proofs** — same-artifact-same-subject, blank decoding as
absent rather than zero, form revision present, and `CORRECTED` readable. Each needs its own leaf;
one combined leaf that touches all four proves the least of them.

**Criterion 5 needs a real second process.** A >128 KiB PDF added via the CLI, visible to `evo_head`
in the **running** server without a restart. An in-process simulation of "another process" does not
test the thing that breaks.

**Mutation-test the absent-vs-zero rule.** Phases 3 and 4 were validated by breaking them
deliberately. Making a blank box decode as `0` must fail a proof — if it does not, DOC-11 is
decorative.

</specifics>

<deferred>
## Deferred Ideas

- **W-2, 1099-DIV, 1099-B dialects** — Phases 11–12. The base is designed for the family now so those
  land without reopening it.
- **DOC-13** (one PDF → N documents), **DOC-15** (`archived` retraction), **DOC-16** (`fjs/media`
  `detect` registration) — later phases; `fjs/todo/upstream-media-dialect-registry.md` already
  records the DOC-16 gap.
- **Teaching `fjs/types/decimal` about comma grouping.** Explicitly rejected, not deferred — it would
  push a presentation convention into a module staged to leave this repo.
- **Anything that computes on a document.** Phase 8 onward.

</deferred>
