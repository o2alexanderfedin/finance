---
phase: 18
slug: dependency-and-duplication-debt
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-14
---

# Phase 18 — Validation Strategy

> Hand-written; ROADMAP marks this phase `Research: No`.

## What makes this phase different

**Every deliverable is a refactor or a dependency bump. None of them should change a single
computed figure.** That inverts the usual validation question. Elsewhere the question is "does the
new behavior work?" — here it is **"did anything change that shouldn't have?"**

The suite is the instrument, and it is a good one: 6314 tests, 916 project-local proofs, two
real-process integration tests. But an all-green suite after a refactor proves only that the
refactor didn't break what is *covered*. Two additional invariants apply, and both are gates:

1. **No expected value may be edited.** If a refactor makes a proof fail, the refactor is wrong.
   Changing the expectation to match the new behavior would convert a caught regression into a
   shipped one. **A diff that touches both a production file and an expected literal in the same
   commit is the signature of this mistake** — look for it in review.
2. **The de-duplicated proof count must not drop below 916.** A refactor that quietly removes a
   proof leaf reduces coverage while the suite still reports green.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's `node:test` + FunctionalScript Emergent Testing (`proof` exports found by `all.test.js`) |
| **Full suite** | `npm test` (`tsc && node --test`) |
| **Runtime** | **~45-140s**, varying ~3× with load. Measured 24.8s-136s across seven runs, 2026-08-12/13. The "~8 min / 481s" figure in older docs is ~10× too high (Phase 17 correction) |
| **Proof count** | `node --test 2>&1 \| grep '^✔ import("./fjs/' \| sed 's/ ([0-9.]*ms)$//' \| sort -u \| wc -l` |
| **Baseline** | **6314/6314 tests, 916 proofs, exit 0** on `6d6d8b8` |

> **`node --test <a-file-under-fjs/>` reports a FAKE PASS.** Emergent Testing registers only when
> root `all.test.js` is imported. Root-level `*.test.js` files are the documented exception.

---

## Sampling Rate

- **Every task:** full `npm test`. It costs under two minutes; there is no reason to sample
  narrowly, and narrow verification is part of how Phase 15 shipped two vacuous proofs.
- **Every task:** proof count re-measured. A silent drop is the failure mode a green suite hides.
- **Phase gate:** all four mutation gates below, each watched failing and restored byte-identical.

---

## Per-Deliverable Verification

| Req | Behavior | How verified | Status |
|-----|----------|--------------|--------|
| MAINT-06 | Suite green on `functionalscript` 0.44.0 | `npm test` after the bump, **alone in its own commit** | ⬜ |
| MAINT-06 | Each of the four `upstream-*.md` notes re-checked against 0.44.0 | Per-note record in the file itself; a note claiming a closed gap is a defect | ⬜ |
| MAINT-06 | `upstream-json-parse-split.md` deleted (already retired) | File absent; its own text mandates deletion once adopted | ⬜ |
| MAINT-08 | The `formRevision` check exists **once** | `grep -rn "formRevision must not be empty" fjs` returns **one** definition site | ⬜ |
| MAINT-08 | All six dialects still reject an empty `formRevision` | Existing per-dialect proofs, unchanged, still green | ⬜ |
| MAINT-07 | `executeRun`'s tail shared with `runExecuteRunViaFixture` | Mutation Gate M3 below | ⬜ |
| MAINT-07 | `artifactSubject` deleted; `formSubject` intact | `grep -rn "artifactSubject" fjs` empty; `consolidated_provenance` still green | ⬜ |
| WR-03 | `fjs-run-integration.test.js` split into multiple `test()` blocks | Mutation Gate M4 below | ⬜ |

---

## Mutation Gates — all four required for phase close

**A proof is not known to work until you have watched it fail.** Mutate, run `npm test`, confirm
the named leaf reddens, restore **byte-identical**, confirm `git status` clean.

| Gate | Mutation | Must redden | Why |
|------|----------|-------------|-----|
| **M1** (MAINT-08) | Break the **shared** `formRevision` helper so it accepts an empty string | **A leaf in each of the six dialects** | If sharing worked, one edit reaches all six. If only some redden, the others still hold private copies and the deduplication is incomplete. |
| **M2** (MAINT-08) | Restore, then break **one dialect's** call site (drop the check) | **Only that dialect's leaf** | Proves each dialect is genuinely wired to the helper, not that a single shared proof is doing all the work. |
| **M3** (MAINT-07) | **Reorder or insert a step** in the shared tail | **Both the virtual proofs AND the real-process integration test** | ROADMAP's own stated bar. A change reddening only one path has not shared the thing that matters — the two paths were still independent. |
| **M4** (WR-03) | Break an assertion in a **late** block of the split test file | **That block reported BY NAME**, while earlier blocks still pass | The whole point. Before the split, an early failure masked everything after it — Phase 19's M1 needed a throwaway diagnostic copy because of exactly this. A split not demonstrated to unmask is just moved code. |

**A mutation that fails to compile proves nothing** — `npm test` is `tsc && node --test`, and
`allowUnreachableCode: false` has already rejected one such attempt in Phase 5.

---

## Ordering constraint

**The dependency bump lands first, alone, in its own commit.** A 0.44.0 upgrade in the same commit
as a refactor makes `git bisect` useless if a figure moves. This is a minor bump on a dependency
this project is deeply coupled to — keep it isolable.

---

## Manual-Only Verifications

| Behavior | Why manual | Instructions |
|----------|------------|--------------|
| *(none)* | — | — |

**This phase must add ZERO `human_needed` items.** It transcribes nothing and reads no printed
form. Phase 19 achieved zero; Phases 10 and 13 did not, and their items remain unowned today.
**If a plan proposes a manual verification here, that is a signal it has drifted out of scope.**

---

## Sign-Off

- [ ] `npm test` green; proof count **≥ 916**
- [ ] **No expected literal was edited** — verified by reading the diff, not by the suite being green
- [ ] M1, M2, M3, M4 all performed, watched failing, restored byte-identical, `git status` clean
- [ ] The 0.44.0 bump is alone in its own commit
- [ ] `grep -rn "formRevision must not be empty" fjs` returns exactly one definition
- [ ] `grep -rn "artifactSubject" fjs` returns nothing
- [ ] `nyquist_compliant: true` set

**Approval:** pending
