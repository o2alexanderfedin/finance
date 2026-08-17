/**
 * The semantic check every dialect's `formRevision` shares: a stored form
 * revision must name something, so it may not be empty or whitespace-only.
 *
 * `formRevision` is the printed form's own revision marker ("Rev. January
 * 2025"), and it is what lets a stored document be read against the layout
 * it was actually printed from. A blank one is not a document with a
 * missing detail — it is a document that cannot be interpreted at all,
 * which is why every dialect refuses it rather than defaulting it.
 *
 * Extracted in Phase 18 (MAINT-08), when the copy count reached
 * **fourteen**. Its sibling money-box rule was already shared — see
 * `fjs/document/money_field/module.f.js`, whose docstring notes it was
 * extracted at three — and that asymmetry is what made this one
 * conspicuous. Identical-by-copy is how two dialects come to disagree
 * about what a form revision is; fourteen copies is fourteen chances.
 *
 * **This file deliberately follows `moneyFieldError`'s shape rather than
 * inventing a second one.** Same nullable-message return (`undefined`
 * means fine, a string is the reason it is not), for the same reason:
 * callers are already inside a `checkReferences` that owns the `Result`
 * shape, and a nullable message composes into that without unwrapping at
 * every step. One rule, one place — and one *pattern* for per-field
 * validation helpers, not two.
 *
 * @module
 */
import { assertEq } from 'functionalscript/fjs/asserts/module.f.js'

/**
 * Checks one dialect's present `formRevision`. `undefined` means it is
 * fine; a string is the reason it is not.
 *
 * The message is returned, not thrown: nothing here throws, so a `.f.js`
 * module needs no `try` (which it may not have). The wording is the exact
 * text all fourteen dialects carried before this extraction, so no stored
 * document's refusal message changes — this is a deduplication, not a
 * behaviour change.
 * @type {(formRevision: string) => string | undefined}
 */
export const formRevisionError = formRevision =>
    formRevision.trim() === ''
        ? `formRevision must not be empty or whitespace-only`
        : undefined

// ── Tests ────────────────────────────────────────────────────────────────────

export const proof = {
    // The gate's control: a real revision marker is accepted. Without this,
    // a helper that refused everything would pass every refusal proof.
    printedRevisionMarkerAccepted: () => {
        assertEq(formRevisionError('Rev. January 2025'), undefined)
    },
    // A revision need not look like a date — the dialects do not parse it,
    // they only require it to name something.
    anyNonBlankTextAccepted: () => {
        assertEq(formRevisionError('2025'), undefined)
    },
    emptyRefused: () => {
        // Hand-typed, NOT read back from the module under test: an expected
        // value produced by the code it checks cannot notice the code
        // changing (AGENTS.md, the fourth shipped defect).
        assertEq(
            formRevisionError(''),
            'formRevision must not be empty or whitespace-only',
        )
    },
    spacesRefused: () => {
        assertEq(
            formRevisionError('   '),
            'formRevision must not be empty or whitespace-only',
        )
    },
    // `trim()` is the operative token, and tabs/newlines are what
    // distinguish it from a bare `=== ''`. A dialect fed a form whose
    // revision cell held only a tab must refuse it too.
    tabsAndNewlinesRefused: () => {
        assertEq(
            formRevisionError('\t\n '),
            'formRevision must not be empty or whitespace-only',
        )
    },
    // Whitespace AROUND a real marker is not a refusal — trimming is how
    // the check reads the value, not a canonicalization the caller sees.
    surroundingWhitespaceIsNotARefusal: () => {
        assertEq(formRevisionError('  Rev. 2025  '), undefined)
    },
}
