---
phase: 06-guest-abi-freeze-and-safe-materialization
plan: 02
subsystem: guest
tags: [sec-02, sec-03, exec-09, mutation-testing, ordering-proof]
requires:
  - phase: 06-01
    provides: "fjs/guest — CasOp, guestCtx, Report"
provides:
  - "fjs/guest/materialize/module.f.js — checkSpecifiers, programFileName, programPath, loadProgram"
affects: [07]
tech-stack:
  added: []
  patterns:
    - "An ORDERING guarantee is proven by observing the side effect the ordering exists to prevent, never by which error message came back. A JsModule fixture under `virtual` records its own invocation; the gate is proven by the body NOT having been evaluated."
key-files:
  created: [fjs/guest/materialize/module.f.js]
  modified: []
key-decisions:
  - "checkSpecifiers takes the allow-list as a parameter, empty for guests, rather than hardcoding reject-all. A function named for an allow-list that cannot express one is a name that stops being true the first time somebody needs it to; the parameter costs one line and a proof shows a listed specifier is genuinely allowed."
  - "programFileName is the content hash and nothing else — no counter, clock or PID. Both halves of criterion 4 are proven separately because a `${hash}-${n}.mjs` scheme satisfies distinctness and breaks stability, and stability is the half SEC-03 exists for."
  - "programPath is separate from programFileName because virtual's import_ accepts only a single-segment path (verified: it errors otherwise). A proof addresses the bare filename; a real run addresses the full path."
  - "loadProgram takes the path as a parameter rather than deriving it, so the gate ordering stays visible in the signature and cannot be rearranged silently."
requirements-completed: [SEC-02, SEC-03, EXEC-09]
duration: ~35min
completed: 2026-08-04
---

# Phase 06 Plan 02: Safe Materialization Summary

**A stored blob becomes an executable module without inheriting the ways that go wrong: its specifiers are gated before anything runs, its filename is its content hash, and `import()` is reached through an effect so the whole path is testable with no filesystem.**

## Performance

- **Tests:** 123 → 135 pass, 0 fail; `tsc` clean
- **Files created:** 1

## The failure worth reading

**My first ordering proof was decorative, and the mutation caught it.**

The leaf asserted that a dirty source came back with a *specifier* message rather than an *import* error — reasoning that only a check running first could produce the former. That reasoning is wrong. The module at the test path loads fine, so **both** orderings end in the specifier message. Moving the gate to *after* `import_` left the suite fully green at 134 pass.

The only thing that distinguishes the two orderings is whether the module body **ran** — which is the entire security property, since `import()` evaluates the body immediately and REQUIREMENTS records that it does so with full Node privileges.

`virtual` invokes a `JsModule` on import, and upstream's own docstring notes the fixture may close over state for exactly this purpose. So the fixture now records its own invocation, and the assertion is `spy.evaluated === false`. A control leaf proves a clean source *does* evaluate the body, so the assertion is about the gate rather than about a spy that never fires. Re-running the identical mutation against the rewritten proof fails it.

This is the third time in this project that a green suite meant nothing. It stays cheap to catch and expensive to miss.

## Accomplishments

- **`checkSpecifiers`** — matches `from 'x'`, `import 'x'`, `import('x')`, `export … from 'x'`. Proofs cover the two specifiers criterion 3 names plus the forms an attacker reaches for once those are closed: bare side-effect import, re-export, `data:` URL, and a relative path escaping the store.
- **`programFileName` / `programPath`** — criterion 4's two halves proven separately.
- **`loadProgram`** — no raw `import(...)` expression anywhere in the module.
- **Criterion 5** — under `virtual` with a `JsModule` at the hash-derived path, the loaded program is **run** through the frozen `ctx` and Phase 3's `interpret`, end to end. Asserting the export is a function would only have proven the fixture came back.

## Requirements Completed

- **SEC-02** — the specifier allow-list, enforced before materialization.
- **SEC-03** — content-hash-derived filenames.
- **EXEC-09** — `import()` reached through the effect.
