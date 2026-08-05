---
phase: 06-guest-abi-freeze-and-safe-materialization
plan: 01
subsystem: guest
tags: [exec-07, guest-abi, type-level-assertions, compile-time-whitelist]
requires:
  - phase: 03
    provides: "fjs/exec — interpret, and the four operations as test fixtures"
provides:
  - "fjs/guest/module.f.js — CasOp, guestCtx, casOpNames, the Report entry-point type, and the compile-time whitelist assertions"
affects: [06-02, 07]
tech-stack:
  added: []
  patterns:
    - "A negative type property is asserted as a conditional type inside the PASSING build (`Extends<Fetch, CasOp> extends false ? true : never`), not as a negative-compile harness. No second tsconfig, no @ts-nocheck, no extra root-level impure file, and it is checked on every run."
key-files:
  created: [fjs/guest/module.f.js]
  modified: []
key-decisions:
  - "CasOp is defined here because fjs has no such type. fjs has FileCasOperation — the filesystem effects the CAS performs internally, including WriteBytes, Rename and Rm. Handing that to a guest hands it the store. The roadmap and REQUIREMENTS both write Effect<CasOp, T> as though CasOp were upstream's; it is not, and defining it is most of EXEC-07."
  - "The entry point is `report`, curried as ctx => args => Effect<CasOp, T>. EXEC-07 says (args) => Effect<CasOp, T> and criterion 2 says the program uses only the INJECTED ctx with zero imports; those reconcile only if ctx is a parameter, since a CAS blob cannot resolve bare specifiers. The inner arrow is literally EXEC-07's signature."
  - "The runtime-refusal backstop is NOT duplicated here. Constructing a probe for it needs the `any` escape fjs/exec confines to its fixture section; reproducing it would put the only `any` under fjs/ into a second file to re-prove EXEC-03."
  - "fjs/exec's `unsafeDo = /** @type {any} */ (do_)` is legitimate and must stay — it constructs probes a real CasOp-typed program could not, which is exactly what EXEC-03's refusal proofs need."
requirements-completed: [EXEC-07]
duration: ~25min
completed: 2026-08-04
---

# Phase 06 Plan 01: The Frozen Guest ABI Summary

**The complete vocabulary a stored report program is written against — four read-only commands, an entry point that is not `main`, and a whitelist that lives in the type system rather than only in the interpreter.**

## Accomplishments

- **`CasOp`** — `casRead`, `evoList`, `evoHead`, `evoRevision`, each `(string) => string` carrying JSON (fjs's JSON `Primitive` has no `bigint`, and a guest result must cross JSON-RPC). Shape unchanged from Phase 3's fixtures, so `interpret` dispatches them with no modification.
- **`guestCtx`** — null-prototyped, the only vocabulary a blob has.
- **`report`** — the third entry-point role beside fjs's `proof` and `main`.
- **Compile-time whitelist** — `Fetch`, `Fs`, `Http`, `Forever`, plus `WriteBytes` and `Rm`.

## Evidence

Criterion 1 was verified by **widening `CasOp` to include `Fetch`**. The build broke with `TS2322: Type 'boolean' is not assignable to type 'never'` at the `fetch` assertion, plus a second independent signal — `TS2741`, the host map then owing a `fetch` handler. So the assertions detect a real widening, not merely a typo in themselves.

## The design call worth defending

Criterion 1 says a program reaching for `Fetch` **fails `tsc`** — an artifact that must *not* compile, which cannot live in a suite whose green means something.

The obvious route is a negative-compile harness: fixtures outside the main `include`, a second tsconfig, a third root-level `@ts-nocheck` file, spawning `tsc` and asserting a non-zero exit. That harness runs only when invoked, and an "exit != 0" assertion passes just as happily on a typo in the fixture as on the property holding.

Expressing the negative as a conditional type inside the passing build costs none of that. `Extends` is tuple-wrapped (`[A] extends [B]`) so a union is tested as a whole rather than distributing member-by-member — without the wrapping the assertion would silently mean something weaker.

## Requirements Completed

- **EXEC-07** — the frozen guest ABI.
