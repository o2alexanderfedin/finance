# A dialect's `subjectKey` is pinned to fields that EXIST, never to the RIGHT ones

Status: **OPEN.** Found 2026-08-21 while verifying `feature/form-accurate-identity-fields`
before merge, by mutation. Not a regression this branch introduced — the machinery it
concerns is the machinery this branch introduced, so the gap arrived with it.

## The gap

FORM-KEY-01 gives every keyed dialect an exported `subjectKey` naming which of its own
fields play DOC-01's five roles, and `fjs/document/registry` checks it BOTH ways:

- `everyDialectWithABusinessKeyDeclaresASubjectKey` — 28 declarations, hand-typed, so a
  deleted declaration is red.
- `everySubjectKeyNamesRealPropertiesOfItsOwnSchema` — every name is a real property of
  that dialect's own schema, so a typo or a half-applied rename is red.
- `theDeclaredRoleTallyIsWhatTheSchemasSupport` — 15 payers, 18 accounts, hand-typed, so a
  quietly dropped optional role is red.

All three are about the SET of names. None is about the ASSIGNMENT. **Transposing a
dialect's `payer` and `recipient` roles leaves every one of them green**, because both
names are still real properties of that schema and the tallies do not move:

| Mutation | `npm test` | `ui-tests` |
|---|---|---|
| `vnd.fjs.w2` `{ payer: 'employeeSSN', recipient: 'employerEIN' }` | 3290 pass, 0 fail | 31 passed |
| `vnd.fjs.1098e` `{ payer: 'borrowerTin', recipient: 'lenderTin' }` | 3290 pass, 0 fail | not run |

## Why the leaves that look like they cover it do not

Two of them look like they should bite, and the reason neither does is the part worth
keeping:

- **`fjs/document/subject`'s three golden-literal pins** (`declaredSubjectMatchesTheGoldenLiteral`
  and friends) hand-type both the key and the expected string. That independence is
  deliberate and correct — this module must stay dialect-independent, and an expected value
  produced by the code under test is the defect AGENTS.md has shipped four times. But the
  key they pin is a LOCAL literal, so no dialect's exported declaration is on the path.
- **`1098e`'s and `1098t`'s `twoServicersForOneBorrowerAreTwoSubjects`** DO call
  `declaredSubject(subjectKey)` — the real export. They assert that two servicers are two
  subjects, that two borrowers are two subjects, and that a corrected form is the same
  subject. Every one of those is an equality or an inequality between two strings derived
  the SAME way, and a transposition is symmetric: it moves both sides of every comparison
  into the same two slots. **A relation between two derived values cannot see a permutation
  applied to both.**
- The per-dialect `theXAndYAreNotTransposed` leaves (`w2`, `farm`, `1098e`, the K-1s, ...)
  pin that `employerEIN` holds something in EIN format and `employeeSSN` something in SSN
  format. That is a fact about the SCHEMA's fields, not about the role declaration, and it
  stays green when the roles above them swap.

## Why it matters

A subject cannot be renamed and `fjs/cas` has no delete. A transposed role assignment
derives a perfectly well-formed, perfectly stable subject — for every future document of
that dialect, under a key that no longer matches the one every document stored to date was
written under. That is DOC-01's "permanent parallel history", reached with the whole suite
green, and it is precisely the property FORM-KEY-02's eleven renames claim to have
preserved. The claim is currently supported by review, not by a proof.

## The fix

One leaf per keyed dialect, in that dialect's own module, next to the `theXAndYAreNotTransposed`
leaf that is already there:

```js
assertEq(
    declaredSubject(subjectKey)(minimal),
    '["vnd.fjs.w2","2025","11-1111111","222-22-2222",""]',   // HAND-TYPED
)
```

The expected string must be hand-typed, not derived — it is the same device
`goldenEncodedSubjectValue` already uses, and the whole point is that it is written by a
person reading the printed form rather than produced by the declaration under test. A
transposition then reddens exactly one leaf, and names the dialect.

Prefer the per-dialect site over one table in `fjs/document/registry`: the registry must
import 28 fixtures to do it, and this module's rule is that a dialect owns the facts about
its own paper.

Twenty-eight leaves is the honest scope, and eleven of them (the renamed dialects) are the
ones carrying real risk today.
