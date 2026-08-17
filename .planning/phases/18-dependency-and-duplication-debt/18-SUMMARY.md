---
phase: 18
slug: dependency-and-duplication-debt
status: complete-except-maint-06
completed: 2026-08-17
branch: feature/phase-18-dependency-and-duplication-debt
requirements:
  MAINT-06: blocked-upstream (see fjs/todo/upstream-mjs-migration.md)
  MAINT-07: complete
  MAINT-08: complete
baseline: { commit: c50e61e, tests: 4273, leaves: 2024 }
result:   { tests: 4289, leaves: 2029, exit: 0, tsc: clean }
gates: [M1, M2, M3, M4]
---

# Phase 18: Dependency and Duplication Debt — Summary

Three of the four deliverables landed; the dependency bump did not, because the current
release cannot be consumed without a project-wide migration, and that is now written down
instead of retried.

## Baseline, re-derived (not trusted)

`develop` @ `c50e61e`: `npm test` **4273/4273**, exit 0, `tsc` clean, **2024** project-local
proof leaves, **raw == unique** (2024 = 2024, so the old `sort -u` no longer hides anything).
The plans' stated floor of **916** was stale by 1108 leaves.

## MAINT-06 — NOT DONE, and the reason is the finding

npm's current release is **0.45.0** (`0.44.0` and `0.45.0` exist; the plans said 0.44.0,
MAINT-06's text said 0.43.0, `package.json` declared `^0.43.1`). Both were installed and
measured:

| version | release commit | `tsc` errors |
|---|---|---|
| 0.43.1 (kept) | `cc93a3ca` | 0 |
| 0.44.0 | `37db36c0` | 1287 |
| 0.45.0 | `8804e783` | 1288 |

Upstream migrated its sources to `.f.mjs` and then `#1520` dropped the `.js` emit, so every
`'functionalscript/…/module.f.js'` specifier breaks. The mechanical rename (**396 files, 1900
occurrences**) was applied to a throwaway `tar` snapshot and **still left 288 errors across 60
files**, because the shipped `.d.mts` files import the core types (`Effect`, `Cas`, `Result`,
`StringMap`, `Unknown`, `State`, `Operation`, …) from per-module `types.ts` without re-exporting
them. Every mechanical fix for that is a cast or an `any`, both forbidden here.

Recorded in **`fjs/todo/upstream-mjs-migration.md`** with the measured numbers, the release
SHAs, the unresolved question (where a consumer should now name its types), the upstream fix
that would unblock it (re-export the types from the module files — we own fjs), and the
retirement condition. `^0.43.1` is unchanged, and the submodule gitlink stays at `cc93a3ca`,
which is 0.43.1 — the two references agree.

**MAINT-06 is left unchecked in REQUIREMENTS.md on purpose.** Its literal text is satisfiable
by doing nothing; its intent is not met. A tick needing a paragraph of caveats is a tick that
should not be there.

The four `upstream-*.md` notes were re-checked individually against **0.45.0 at `8804e783`**,
reading the code at that SHA:

- `upstream-json-parse-split.md` — **retired and deleted.** `parse` is tokenizer-backed and
  total at the installed 0.43.1, `parseNative` is gone, `fjs/json` re-exports it. Its own text
  mandated deletion once adopted.
- `upstream-mcp-protocol-version-negotiation.md` — **still open.** `mcpStep`'s `initialize`
  still destructures `const [pr]` and echoes the server's own `protocolVersion`. The note's
  corrected remedy (widened to `const [pr, pv]`) still applies verbatim.
- `upstream-node-spawn-effect.md` — **still open.** No `Spawn`; `Exec` is still the only
  subprocess primitive and the `Fs` union is unchanged.
- `upstream-total-match-dispatch.md` — **still open.** `match` still ends with
  `assert(handler !== null, command)`, so `fjs/exec`'s `try` is still load-bearing.

## MAINT-07 — `executeRun`'s tail has ONE definition

`loadProgram → buildRunSnapshot → buildHostMap → interpret → classifyRunOutcome` was written
out twice. It is now `runProgramTail`, called by `executeRun` and by
`runExecuteRunViaFixture`'s second `virtual` session. The **heads still diverge** — the
fixture's real `materializeProgram` write plus `JsModule` swap exists because
`fjs/effects/node/virtual` cannot compose a write with an import at one path in one session —
so every value the tail needs (`path`, `source`, `literalCount`, `args`, `pin`, `taxParams`) is
a parameter. `runExecuteRunViaFixture`'s signature did not change, so its ~18 call sites did
not move.

**The surviving-mutant note survived.** `executeRun`'s docstring recorded that replacing
`input.taxParams` with a fresh `taxParamsByYear[2025]` lookup survives the whole suite, because
the table holds exactly one tax year. The full paragraph — date, the 6419/6419 result, what IS
proven, and the instruction to re-run the gate when a second year lands — now lives on
`runProgramTail`, which is where the parameter set reaches the guest, with a pointer at the old
site.

`artifactSubject` (`hash => hash`, zero callers) is deleted along with its docstring and proof.
`formSubject` and the file are untouched.

## MAINT-08 — the `formRevision` check has ONE definition

The criterion said two dialect files; the plans said six; **re-derived, it was fourteen**:
1098e, 1098t, 1099b, 1099div, 1099g, 1099int, 1099nec, 1099r, form3921, form3922, k1_1065,
k1_1120s, ssa1099, w2. New `fjs/document/form_revision/module.f.js` exports
`formRevisionError`, following `moneyFieldError`'s nullable-message shape exactly rather than
inventing a second pattern for per-field validation. Six proofs, expectations hand-typed,
including the control and the tab/newline case that distinguishes `trim()` from `=== ''`. The
refusal text is byte-identical, so no stored document's refusal changed.

## WR-03 — the integration test reports each concern by name

`fjs-run-integration.test.js`'s single 766-line `test()` is now **eleven `await t.test(...)`
subtests** — not `describe`/`before`, which no root-level test file here uses. The one real
server process, its readiness handshake and the `send`/`call` helpers stay in the outer scope,
created once. Fourteen values cross a concern boundary and are declared in the outer scope and
assigned at their original sites; no assignment moved and no assertion was added, removed,
reordered or weakened.

PROV-05's control leg and pinned leg deliberately stay in **one** subtest: the file's own
comment says Step 2 is "only reached because Step 1's assertion passed", and separate subtests
would run Step 2 after a failed Step 1.

## Mutation gates — all four watched failing, all restored byte-identical

Every mutation kept its bindings live and was a comparison false for the fixture rather than
statically dead, so each produced an `ℹ tests` line. `git status --short` after each showed only
the untracked `type-level/` orphan.

| Gate | Mutation | Result |
|---|---|---|
| **M1** | shared helper: `formRevision.trim() === ''` → `… && formRevision.length > 1000` | **fail 3 → 23.** 20 dialect leaves across **exactly 14 distinct dialects**, plus the shared module's own three refusal proofs. One edit reached all fourteen. |
| **M2** | one dialect only (w2): `if (formRevisionMessage !== undefined` → `… && formRevisionMessage.length > 1000)` | **fail 1**, and it is `w2 … checkReferences.emptyFormRevisionRejected()`. No other dialect moved — each is genuinely wired to the helper. |
| **M3** | shared tail: `buildRunSnapshot(cas)(evoApi)(pin)` → `…(pin === undefined ? pin : undefined)` | **fail 5.** The virtual proof `fjs_run … proof.executeRun.pinOverridesTheLiveHeadThroughFullExecuteRun()` **and** the real-process test's `09-07: the pin path` and `PROV-05: control-then-pinned` subtests. One edit, both paths — the criterion's own bar. |
| **M4** | two assertions broken at once: `parsed.taxYear, 2025` → `2026` (subtest 4) and `rawStdoutLines.length > 0` → `> 100000` (subtest 11) | **fail 3**, and **both are named**: `✖ fjs_run end to end …` and `✖ full tool coverage (TEST-02) …`. The seven subtests between them ran and passed. Before the split this file reported one failure no matter how many broke. |

## Numbers

| | tests | leaves |
|---|---|---|
| baseline `c50e61e` | 4273 | 2024 |
| after MAINT-08 (formRevision) | 4279 | 2030 |
| after the split | 4290 | 2030 |
| after MAINT-07 (shared tail) | 4290 | 2030 |
| final (artifactSubject deleted) | **4289** | **2029** |

`raw == unique` at every step. `comm -23 baseline final` yields **exactly one** line, the
explained intentional deletion:
`✔ import("./fjs/document/subject/module.f.js").proof.artifactSubjectIsIdentity()` — a proof
that an identity function is the identity, about code with no callers. AGENTS.md's own form of
the rule is "empty, **or every line individually explained**."

No expected literal was edited anywhere in this phase. No computed figure moved.

## Commits

| commit | what |
|---|---|
| `c1441e1` | MAINT-06 findings: the new `upstream-mjs-migration.md`, three dated re-checks, one note retired |
| `9d60924` | MAINT-08: shared `formRevisionError` across fourteen dialects |
| `a30c676` | WR-03: eleven named `node:test` subtests |
| `fa6d5cb` | MAINT-07: `runProgramTail`, the tail's single definition |
| `05aee9d` | MAINT-08: `artifactSubject` deleted |

## Deferred

`.planning/phases/18-dependency-and-duplication-debt/deferred-items.md` — a stale comment in
`fjs/server/module.f.js` (lines 324-326) claims `fjs/media/json`'s `parse` is literally
`JSON.parse`, true at 0.41.0 and false at the installed 0.43.1. Found while retiring
`upstream-json-parse-split.md`. Phase 17's work, not this phase's.
