# Nothing validates a finance document against its dialect on the write path

**Priority:** P2 — a correctness hole, not a crash; found by `/gsd-audit-milestone` 2026-08-20
**Status:** RESOLVED 2026-08-31 (DOC-25, Phase 40) — see "How it was closed" at the end

## What is true today, verified by reading production code

A blob reaches the engine through `evo_add`/`cas_add` → `fjs_run` → the stored program's `route`,
and **no step on that path checks it against its dialect**:

- Upstream `cas_add` classifies with `detect([revisionDialect, lockDialect, noteDialect])`
  (`node_modules/functionalscript/fjs/mcp/cas/module.f.mjs:164`) — three upstream dialects, none of
  them a finance one.
- `detectFinance` (`fjs/media/dialects/module.f.js:313`), which *does* carry the per-dialect
  semantic checks, reaches production at exactly one site: `cas_refresh`'s **read-only** count
  report, `fjs/server/module.f.js:170`. The other reference is the `dialect_parity` gate.
- `finance_documents_list` applies only a loose `rttiValidate`
  (`fjs/server/finance_documents_list/module.f.js:81`) — enough to read a `dialect` field, not to
  check the document.
- The stored program's `route` dispatches on `doc.dialect` and files the value
  (`fjs/report/tax_return/module.f.js`, the `route` block). No schema, no money-exactness check.

So a malformed `vnd.fjs.w2` — a box carrying `"12.345"`, or missing a required field — is stored,
routed, and computed from.

## Why it has not bitten

Every producer calls its dialect's own `validate` before storing.
`tax-return-integration.test.js:373-384` does it explicitly for all of its seeds, and the demo
builds its fixtures from validated shapes. **That is a convention among callers, not an enforced
invariant** — and `fjs/report/tax_return`'s module docstring asserted it *was* enforced, naming
`cas_add`/`evo_add` as the enforcer, until 2026-08-20.

## Why it matters now rather than in the abstract

Milestone v4's phases 34 and 35 both consume stored documents and assume they are well-formed:
34 diffs this engine against a second implementation on the owner's real documents, and 35 fills
the official `f1040.pdf` from computed lines. **A silent understatement from a malformed box would
surface as a disagreement with the other filer, or as a wrong number on a form meant to be filed** —
in both cases far from its cause.

## Options

1. **Validate at the write boundary.** A `finance_add` wrapper, or a hook in the server's tool
   registry, that runs `detectFinance`'s dialect check before `cas_add` stores. Refuses early, at
   the site that knows the dialect. Cost: the write path gains a dependency on the dialect table,
   and a blob that is not a finance document at all must still be storable.
2. **Validate in the stored program**, at `route`. Keeps the write path untouched and puts the
   check where the document is first interpreted; refusal becomes part of the run record, which is
   where a reader would look. Cost: the run fails late, after storage, and the program grows.
3. **Neither — state the trust boundary and enforce it in the client.** Legitimate, but then the
   docstring must say so, and a client that forgets is unprotected.

Option 2 fits the architecture best — the same program already refuses on year mismatch and on
document-set problems, so this is one more refusal in a place that has them.

## Tasks

- [ ] Decide between the three (the write path is a public protocol surface).
- [ ] Implement, with a proof watched to fail: a malformed box must produce a refusal naming the
      document and the box, not a computed number.
- [ ] A negative control: a well-formed document still computes, unchanged.


## How it was closed — 2026-08-31, DOC-25, Phase 40

**Option 1, the write boundary**, not Option 2 as this note preferred. The note's own
parenthesis is the reason: the write path is a public protocol surface. A refusal at `route`
arrives after the bytes are stored and addressable, so the store accumulates documents it will
never accept, and `fjs_run`'s run record — where that refusal would land — is not where an agent
that just called `cas_add` is looking.

`fjs/server/write_validation` wraps the `cas_add` entry and consults the claimed dialect's own
`match`, the same predicate `detect` uses, so the check cannot drift from classification. An
earlier attempt compared `detectFinance(bytes).mime_type` against the payload's tag and refused
every document including valid ones — `detect` answers `application/vnd.fjs.w2+json` where the
payload says `vnd.fjs.w2`. That is recorded in the module, because the fix is not obvious from
the outside.

- `evo_add` is NOT wrapped: its `snapshot` is a hash, not content, so no document bytes enter
  through it. `cas_add` is the only tool that writes them.
- Content that claims no known dialect is stored unexamined — the cost this note named for
  Option 1, paid deliberately, since the CAS holds programs and notes as well as documents.
- Watched to fail: a compiling mutation that makes the check never refuse reddens three leaves,
  including the end-to-end one that drives the real MCP tool.

**The open-versus-closed question this made live is decided in `fjs/document/base`**: the schemas
stay `open`, so a MISSPELLED OPTIONAL BOX is still silently ignored while a missing REQUIRED field
is refused. Both halves were checked empirically, not assumed.
