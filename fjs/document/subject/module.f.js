/**
 * DOC-01 — the Evo subject convention for this project's documents, decided
 * once, permanently, before any real document exists: a subject cannot be
 * renamed and `fjs/cas` (content-addressable storage) has no delete, so an
 * artifact/subject scheme chosen wrong is not a refactor later, it is a
 * permanent parallel history.
 *
 * Two independent roots, matching two independent things a document can be:
 *
 * - The **artifact** chain — the original scanned/uploaded bytes (a PDF, an
 *   image) — is rooted at the cBase32 hash of that artifact itself
 *   the artifact's own cBase32 content hash. Re-adding the identical bytes
 *   resolves to the identical subject, because the subject *is* the content
 *   hash — there is no derivation, and therefore (MAINT-08, Phase 18) no
 *   function here for it: an exported identity function with zero callers was
 *   a named place to change that nothing read.
 * - Each **extracted form** — the structured data a dialect parses out of an
 *   artifact (e.g. a single 1099-INT) — gets its own subject, keyed on the
 *   business identity of that form: five ROLES, in a fixed order —
 *   `(formType, taxYear, payer, recipient, account)`. Two different
 *   scans of the same paper form resolve to the same form subject even
 *   though they resolve to two different artifact subjects (see
 *   `T-05-01-02` in this plan's threat model — an accepted consequence of
 *   content-hash-based artifact identity, not a defect).
 *
 *   **A role is not a field name.** Until FORM-KEY-01 it was: every dialect
 *   spelled the payer `payerTin`, the recipient `recipientTin` and the
 *   account `accountNumber`, and {@link formSubject} read those five
 *   properties off the document. The argument for it was that one convention
 *   should cover the whole family, and that a dialect-specific spelling would
 *   mean a dialect-specific subject derivation. **That argument is obsolete,
 *   and the reason it is worth stating rather than deleting is that it was
 *   sound about the goal and wrong about the mechanism.** One convention no
 *   longer requires one spelling: a dialect declares which of ITS OWN fields
 *   play the five roles ({@link SubjectKey}), and {@link declaredSubject}
 *   reads the declaration. So `vnd.fjs.w2` may call box b `employerEIN` and
 *   box a `employeeSSN` — the words "payer" and "recipient" appear nowhere on
 *   a W-2 — while the derivation stays single and shared.
 *
 *   **The encoding did not move.** Both functions emit the same five values
 *   in the same order, so every subject stored under the old names is
 *   byte-identical to the one derived under the new ones — which, given that
 *   a subject cannot be renamed and `fjs/cas` has no delete, is the whole
 *   claim FORM-KEY-02's renames rest on. `goldenEncodedSubjectValue` and
 *   `declaredSubjectMatchesTheGoldenLiteral` pin the same hand-typed literal
 *   through the two functions for exactly that reason.
 *
 * Human-readable labels (a payer's display name, a filename) live inside
 * snapshots, never in subjects — a subject is an opaque, stable key.
 *
 * Neither function performs I/O; both are pure and dialect-independent —
 * this module imports no rtti schema from any specific dialect, so later
 * dialect modules depend on this one, never the reverse.
 *
 * @module
 */
import { assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { stringify as jsonText } from '../../json/module.f.js'

/**
 * The five VALUES that key an extracted form's identity, per DOC-01, named
 * by their roles. Not imported from any dialect module — Plan 05-02's
 * `vnd.fjs.1099int` dialect does not exist yet at this wave, and this module
 * must stay dialect-independent so later dialect plans depend on it, never
 * the reverse.
 *
 * **`payerTin`/`recipientTin`/`accountNumber` are this parameter object's
 * property names, and since FORM-KEY-01 they are nothing more than that.**
 * They were once the field names every dialect's schema was required to use,
 * which is what made a rename impossible; today a dialect names its own
 * fields whatever its printed form calls them and declares the mapping in a
 * {@link SubjectKey}. These three spellings survive here because
 * {@link formSubject} is a pinned encoding that stored subjects depend on —
 * renaming its parameters would change nothing it emits and cost the
 * cross-check `declaredSubject`'s proofs run against it.
 *
 * `taxYear` is a plain JS `number` (a 4-digit calendar year) — this is not
 * money, so ordinary numeric handling is fine here; it does not route
 * through `fjs/exact`/`fjs/types/decimal`.
 *
 * @typedef {{
 *   readonly payerTin: string,
 *   readonly recipientTin: string,
 *   readonly accountNumber: string,
 *   readonly taxYear: number,
 *   readonly formType: string,
 * }} FormKey
 */

/**
 * The subject for an extracted form instance: deterministically derived
 * from the five business-key VALUES (DOC-01), independent of which
 * artifact/scan produced it and independent of object identity (two distinct
 * object literals carrying the same five values yield the identical,
 * `===`-equal subject string).
 *
 * This function takes the values already extracted, so it knows nothing
 * about which field of which dialect each came from. {@link declaredSubject}
 * is the one that reads a document, through the dialect's own
 * {@link SubjectKey}; the two agree by construction and are pinned against
 * the same hand-typed literals.
 *
 * Encoded via `JSON.stringify` on a fixed-order array of the five values
 * (`[formType, String(taxYear), payerTin, recipientTin, accountNumber]`)
 * rather than manual delimiter-joining: `JSON.stringify` already escapes
 * embedded quote/comma/colon characters correctly, so two different
 * five-tuples cannot collide by a field boundary shifting (e.g. an
 * `accountNumber` containing a colon cannot be confused with a
 * delimiter) — the same technique `fjs/exact/module.f.js`'s `show` test
 * helper already uses in this repo, so no new serialization logic is
 * invented here (T-05-01-01).
 *
 * @type {(key: FormKey) => string}
 */
export const formSubject = ({ payerTin, recipientTin, accountNumber, taxYear, formType }) =>
    jsonText([formType, String(taxYear), payerTin, recipientTin, accountNumber])

/**
 * FORM-KEY-01 — a dialect's own declaration of which of ITS fields play the
 * five roles a form subject is keyed on.
 *
 * {@link formSubject} above takes the five VALUES already extracted. Every
 * caller therefore had to know, per dialect, which field name carried each
 * role — and every one of them spelled it `payerTin`/`recipientTin`/
 * `accountNumber`/`taxYear`/`dialect`, because when this was written they all
 * agreed. That agreement was an accident of twenty-eight schemas having been
 * written from one template, not a property anything checked: a dialect whose
 * printed form calls the payer an *employer* or the recipient a *student*
 * could not say so without silently changing what every caller read.
 * FORM-KEY-02 has since spent that freedom on eleven dialects, so the
 * agreement is gone and nothing broke — which is the point.
 *
 * So the dialect declares the mapping instead. The values are FIELD NAMES on
 * that dialect's own schema, never values and never other dialects' names,
 * which is what keeps this module dialect-independent (it still imports no
 * dialect).
 *
 * `payer` and `account` are OPTIONAL roles: several dialects
 * (`medical_expenses`, `prior_year_capital_loss`, `ira`, ...) transcribe a
 * fact off the taxpayer's own return and have neither a payer nor an account
 * number. Those dialects have carried `payerTin: ''` and `accountNumber: ''`
 * into `formSubject` since DOC-01, and an omitted role here reproduces
 * exactly that — see `declaredSubject`.
 *
 * They are optional PROPERTIES rather than `string | undefined` ones on
 * purpose: with `exactOptionalPropertyTypes`, deleting a role from a
 * declaration must still TYPECHECK, or the mutation that proves the role
 * tally is load-bearing could never be run (AGENTS.md: "a mutation must still
 * typecheck"). For the same reason the values are plain `string`, not
 * `keyof typeof someSchema` — a `keyof` type would turn every mis-typed name
 * into a compile error, which sounds stronger and is in fact weaker: it makes
 * the runtime two-way proof unwatchable, and a proof nobody has seen fail is
 * decoration.
 *
 * @typedef {{
 *   readonly formType: string,
 *   readonly taxYear: string,
 *   readonly payer?: string,
 *   readonly recipient: string,
 *   readonly account?: string,
 * }} SubjectKey
 */

/**
 * Reads one role off a document: an omitted role is the empty string (the
 * `payerTin: ''` / `accountNumber: ''` convention DOC-01 already uses for
 * payerless, accountless dialects), a string field is itself, and a numeric
 * field — `taxYear` — is `String(...)`d exactly as {@link formSubject} does.
 *
 * A named field that is missing, or holds neither a string nor a number, is a
 * PANIC rather than a `Result`: the declaration is source code in the same
 * module as the schema it describes, so this cannot be a runtime input error,
 * only a bug — and the two-way proof in `fjs/document/registry` is what stops
 * it reaching here.
 *
 * @type {(document: { readonly [k: string]: unknown }) => (name: string | undefined) => string}
 */
const roleText = document => name => {
    if (name === undefined) {
        return ''
    }
    const value = document[name]
    if (typeof value === 'string') {
        return value
    }
    if (typeof value === 'number') {
        return String(value)
    }
    throw ['a subjectKey names a field that is not a string or a number', name, value]
}

/**
 * The subject for a document, derived through the DIALECT'S OWN
 * {@link SubjectKey} declaration instead of through five field names assumed
 * to be shared.
 *
 * **The encoding is deliberately unchanged.** The array handed to `jsonText`
 * is the same five values in the same fixed order as {@link formSubject}'s
 * (`[formType, String(taxYear), payer, recipient, account]`), so for every
 * document stored to date this returns the byte-identical subject string.
 * That is not a hope: `goldenEncodedSubjectValue` pins `formSubject`'s
 * literal, `declaredSubjectMatchesTheGoldenLiteral` pins the SAME literal
 * through this function, and the payerless case is pinned separately because
 * it is the one whose `''` substitution could fork a stored history without
 * any keyed dialect noticing.
 *
 * @type {(key: SubjectKey) => (document: { readonly [k: string]: unknown }) => string}
 */
export const declaredSubject = key => document => {
    const text = roleText(document)
    return jsonText([text(key.formType), text(key.taxYear), text(key.payer), text(key.recipient), text(key.account)])
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** @type {FormKey} */
const baseline = {
    payerTin: '11-1111111',
    recipientTin: '222-22-2222',
    accountNumber: 'ACC-0001',
    taxYear: 2024,
    formType: 'vnd.fjs.1099int',
}

export const proof = {
    // formSubject is deterministic across two DISTINCT object literals that
    // carry the identical five field values — proves it does not
    // accidentally key on object identity.
    formSubjectIsDeterministic: () => {
        const a = { ...baseline }
        const b = { ...baseline }
        assertEq(a === b, false)
        assertEq(formSubject(a), formSubject(b))
    },
    // T-09-08-03: every `changingOneField` leaf below only asserts that
    // reordering the encoded array's fields — or serializing `taxYear` as a
    // raw number instead of `String(taxYear)` — CHANGES the result; a
    // reordering or an un-stringified year would still change some field's
    // effect and pass every one of those leaves. This leaf pins what the
    // encoding actually IS: a HAND-TYPED golden literal, independent of
    // `formSubject`'s own `JSON.stringify` call (AGENTS.md: "a proof's
    // expected value must not be produced by the code under test").
    //
    // This literal is a stored artifact's shape, not an implementation
    // detail: every subject already written under it is filed in Evo by
    // this exact string. Changing this literal to make a future proof pass
    // is a DATA MIGRATION for every document already stored, never a
    // refactor to wave through on a green suite.
    goldenEncodedSubjectValue: () => {
        assertEq(
            formSubject(baseline),
            '["vnd.fjs.1099int","2024","11-1111111","222-22-2222","ACC-0001"]',
        )
    },
    // Changing exactly one of the five fields, holding the other four
    // fixed, changes the resulting subject — one leaf per field.
    changingOneField: {
        payerTin: () => {
            assertEq(formSubject({ ...baseline, payerTin: '99-9999999' }) === formSubject(baseline), false)
        },
        recipientTin: () => {
            assertEq(formSubject({ ...baseline, recipientTin: '999-99-9999' }) === formSubject(baseline), false)
        },
        accountNumber: () => {
            assertEq(formSubject({ ...baseline, accountNumber: 'ACC-9999' }) === formSubject(baseline), false)
        },
        taxYear: () => {
            assertEq(formSubject({ ...baseline, taxYear: 2023 }) === formSubject(baseline), false)
        },
        formType: () => {
            assertEq(formSubject({ ...baseline, formType: 'vnd.fjs.ocr' }) === formSubject(baseline), false)
        },
    },
    // Collision resistance: demonstrates WHY JSON.stringify was chosen over
    // manual colon-joining, not just that it works. `a` and `b` are two
    // genuinely distinct five-tuples (different recipientTin AND different
    // accountNumber) that a naive `[...].join(':')` encoding would collide
    // on, because the colon inside `a.accountNumber` shifts the field
    // boundary to exactly reproduce `b`'s recipientTin/accountNumber split.
    // formSubject's JSON.stringify-array encoding does not collide, because
    // JSON array syntax (quotes + structural commas) delimits fields
    // unambiguously regardless of characters embedded inside a field.
    delimiterCollisionResistance: () => {
        const a = { ...baseline, recipientTin: 'R', accountNumber: '1:2' }
        const b = { ...baseline, recipientTin: 'R:1', accountNumber: '2' }
        /** @type {(k: FormKey) => string} */
        const naiveColonJoin = k =>
            [k.formType, String(k.taxYear), k.payerTin, k.recipientTin, k.accountNumber].join(':')
        // The premise: these two distinct tuples really do collide under a
        // naive delimiter join.
        assertEq(naiveColonJoin(a), naiveColonJoin(b))
        // The proof: formSubject does NOT collide on the same two tuples.
        assertEq(formSubject(a) === formSubject(b), false)
    },
    // ── FORM-KEY-01: the declaration-driven derivation ───────────────────
    //
    // The whole point of `declaredSubject` is that it must produce the
    // BYTE-IDENTICAL string `formSubject` already produces, for every
    // document already stored. A subject cannot be renamed and `fjs/cas` has
    // no delete (see this module's header), so a one-character drift here is
    // not a refactor, it is a permanent parallel history for every dialect at
    // once.
    //
    // So each leaf pins a HAND-TYPED golden literal — the same device, and
    // for `1099int` literally the same literal, as `goldenEncodedSubjectValue`
    // above. The second `assertEq` against `formSubject` is a cross-check
    // against an independent (and deliberately untouched) implementation, not
    // the primary assertion: on its own it would stay green if BOTH functions
    // drifted together.
    declaredSubjectMatchesTheGoldenLiteral: () => {
        /** @type {SubjectKey} */
        const key = {
            formType: 'dialect',
            taxYear: 'taxYear',
            payer: 'payerTin',
            recipient: 'recipientTin',
            account: 'accountNumber',
        }
        const stored = {
            dialect: 'vnd.fjs.1099int',
            payerTin: '11-1111111',
            recipientTin: '222-22-2222',
            accountNumber: 'ACC-0001',
            taxYear: 2024,
            box1InterestIncome: '100.00',
        }
        assertEq(
            declaredSubject(key)(stored),
            '["vnd.fjs.1099int","2024","11-1111111","222-22-2222","ACC-0001"]',
        )
        assertEq(declaredSubject(key)(stored), formSubject(baseline))
    },
    // The payerless, accountless case, pinned SEPARATELY because it is the
    // one an all-roles-present fixture cannot see: `medical_expenses`,
    // `prior_year_capital_loss`, `ira` and friends have carried
    // `payerTin: ''` / `accountNumber: ''` into `formSubject` since DOC-01,
    // and an omitted role must reproduce that empty string exactly. Anything
    // else -- a dropped array slot, a `null`, the string `"undefined"` --
    // forks the stored history of ten dialects while every keyed dialect's
    // proof stays green.
    declaredSubjectMatchesAPayerlessDialectsStoredSubject: () => {
        /** @type {SubjectKey} */
        const key = { formType: 'dialect', taxYear: 'taxYear', recipient: 'recipientTin' }
        const stored = {
            dialect: 'vnd.fjs.medical_expenses',
            recipientTin: '222-22-2222',
            taxYear: 2025,
        }
        assertEq(
            declaredSubject(key)(stored),
            '["vnd.fjs.medical_expenses","2025","","222-22-2222",""]',
        )
        assertEq(
            declaredSubject(key)(stored),
            formSubject({
                payerTin: '',
                recipientTin: '222-22-2222',
                accountNumber: '',
                taxYear: 2025,
                formType: 'vnd.fjs.medical_expenses',
            }),
        )
    },
    // The reason the declaration exists at all, asserted rather than
    // described: a dialect whose printed form names its parties differently
    // gets the SAME subject encoding out of fields `formSubject`'s parameter
    // list cannot even spell. When this leaf was written NOTHING in the repo
    // declared such names and the comment here said so; FORM-KEY-02 has since
    // spent the freedom on `vnd.fjs.w2` and seven others, so the names below
    // are now the real ones rather than a hypothetical.
    //
    // The fixture is still WRITTEN OUT rather than imported from
    // `fjs/document/w2`. This module must stay dialect-independent -- it
    // imports no dialect and later dialect modules depend on it, never the
    // reverse -- and hand-typing the expected string is the same independence
    // AGENTS.md requires of any expected value.
    declaredSubjectReadsTheDeclarationRatherThanAssumingFieldNames: () => {
        /** @type {SubjectKey} */
        const key = {
            formType: 'dialect',
            taxYear: 'taxYear',
            payer: 'employerEIN',
            recipient: 'employeeSSN',
            account: 'controlNumber',
        }
        const stored = {
            dialect: 'vnd.fjs.w2',
            employerEIN: '11-1111111',
            employeeSSN: '222-22-2222',
            controlNumber: 'ACC-0001',
            taxYear: 2024,
            // The names this dialect USED to use are present too, holding
            // values that would produce a different string -- so a
            // `declaredSubject` that ignored its declaration and reached for
            // `payerTin`/`recipientTin`/`accountNumber` would not merely fail
            // to find them, it would find the WRONG ones and still return a
            // string. That is the failure this fixture is shaped to catch,
            // and it is a LIVE hazard now rather than a hypothetical one:
            // every stored W-2 written before FORM-KEY-02 carries exactly
            // these three keys.
            payerTin: '99-9999999',
            recipientTin: '888-88-8888',
            accountNumber: 'WRONG',
        }
        assertEq(
            declaredSubject(key)(stored),
            '["vnd.fjs.w2","2024","11-1111111","222-22-2222","ACC-0001"]',
        )
    },
}
