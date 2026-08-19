/**
 * The two rules `vnd.fjs.k1_1065` and `vnd.fjs.k1_1120s` genuinely SHARE,
 * written once (DOC-24).
 *
 * ## What is shared, and what deliberately is not
 *
 * DOC-24's own text says two dialects, not one, because the two printed forms
 * number their Part III boxes differently and a shared schema is how a box
 * comes to be read as the wrong thing. **Nothing here is a schema.** This
 * module carries exactly two things, and both are rules rather than layouts:
 *
 * - {@link codedEntry}, the shape of ONE row inside a coded box. Both printed
 *   forms print coded boxes the same way — a code letter and an amount,
 *   repeated down the box — and the SHAPE of a row is not the box numbering.
 * - {@link materialParticipationValues} and its check, the §469 determination
 *   the printed **Schedule E** requires of every entity in Part II. It is one
 *   question with one vocabulary, and asking it in two spellings is how the
 *   two dialects would come to disagree about what an answer means.
 *
 * Box numbers, captions, which boxes exist and which of them this engine can
 * compute are all per dialect and stay there. AGENTS.md's "one rule, one
 * place" is the reason this file exists; DOC-24's "two dialects" is the reason
 * it holds no box.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { option, string } from 'functionalscript/fjs/types/rtti/module.f.mjs'
import { moneyFieldError } from '../money_field/module.f.js'

/**
 * One row of a coded box: the printed code letter and the amount beside it.
 *
 * **`amount` is absent-able and that is not laxity.** Box 20 code Z (§199A
 * information) and box 13 code W routinely print the word `STMT` rather than a
 * figure, because the amount lives on an attached statement. DOC-11's rule
 * applies exactly: an absent amount must stay absent rather than becoming a
 * zero that claims the statement reported nothing.
 *
 * `code` is REQUIRED, because a code is what a coded box IS — a row without
 * one names no item at all, and no consumer could route it or refuse it by
 * name.
 */
export const codedEntry = /** @type {const} */ ({
    code: string,
    amount: option(string),
})

/** One row of a coded box, as the two dialects' schemas produce it.
 * @typedef {{ readonly code: string, readonly amount?: string | undefined }} CodedEntry
 */

/**
 * Checks every PRESENT amount inside one coded box, naming the box AND the
 * code in any refusal.
 *
 * **The code is in the message on purpose.** A printed box 20 may carry a
 * dozen rows; a message naming only `box20OtherInformation` tells a
 * transcriber to re-check all of them. `fjs/document/1099nec`'s state-row loop
 * makes the identical choice for the same reason (it names the state), and
 * `perCodedBoxRejection` in both K-1 dialects asserts the code is present in
 * the text so this cannot quietly become a box-only message.
 *
 * Returns an error message or `undefined`, matching
 * {@link moneyFieldError}'s own convention so it composes into a
 * `checkReferences` loop without unwrapping.
 * @type {(field: string) => (rows: readonly CodedEntry[] | undefined) => string | undefined}
 */
export const codedBoxError = field => rows => {
    for (const row of rows ?? []) {
        if (row.code.trim() === '') {
            return `${field} carries a row whose code is empty or whitespace-only, and a code is `
                + `what a coded box IS — without one the row names no separately stated item, so `
                + `nothing can route it and nothing can refuse it by name`
        }
        if (row.amount === undefined) {
            continue
        }
        const message = moneyFieldError(`${field} code ${row.code}`)(row.amount)
        if (message !== undefined) {
            return message
        }
    }
    return undefined
}

/**
 * The §469 material-participation determination, as the taxpayer states it.
 *
 * Two values and no third, because §469 has no third: an activity either is or
 * is not one in which the taxpayer materially participates, and the printed
 * Schedule E Part II has exactly two column pairs to match. **Absence is a
 * THIRD state and it is not in this list** — it means *unstated*, which
 * `fjs/schedule/e` refuses by name rather than reading as either answer.
 *
 * The names are the statute's own words rather than `true`/`false`, because a
 * boolean would make the absent case look like the negative one at every call
 * site that forgot to check.
 */
export const materialParticipationValues = /** @type {const} */ ([
    'materiallyParticipated',
    'didNotMateriallyParticipate',
])

/** One member of {@link materialParticipationValues}.
 * @typedef {typeof materialParticipationValues[number]} MaterialParticipation
 */

/**
 * {@link materialParticipationValues} widened to a plain string list — an
 * ordinary widening ASSIGNMENT, never a cast, so the membership question can
 * be asked of the `string` a JSON blob's field actually is. The same device
 * `fjs/return/scope`'s `modeledKindNames` uses.
 * @type {readonly string[]}
 */
const materialParticipationNames = materialParticipationValues

/**
 * Checks a stored `materialParticipation` field. `undefined` means it is fine
 * — including when the field itself is absent, which is a legitimate stored
 * state and a Schedule E refusal rather than a storage one.
 * @type {(stated: string | undefined) => string | undefined}
 */
export const materialParticipationError = stated => {
    if (stated === undefined || materialParticipationNames.includes(stated)) {
        return undefined
    }
    return `materialParticipation carries '${stated}', which is not one of the `
        + `${materialParticipationValues.length} values §469 admits: `
        + `${materialParticipationValues.join(', ')}. The determination decides which pair of `
        + `printed Schedule E Part II columns the entity's income goes in, and through `
        + `§1411(c)(2)(A) whether that income is net investment income, so this engine cannot `
        + `read an answer it does not understand`
}

/**
 * Narrows an already-validated `materialParticipation` string to
 * {@link MaterialParticipation} by FINDING it in the list rather than by
 * asserting a predicate over the incoming string — the identical device, for
 * the identical reason, as `fjs/form1040/core`'s `storedFilingStatusNamed`:
 * the value that flows onward is the one from this module's own list, not the
 * one off the blob, so a widened stored vocabulary cannot leak through.
 * @type {(stated: string | undefined) => MaterialParticipation | undefined}
 */
export const materialParticipationNamed = stated =>
    materialParticipationValues.find(value => value === stated)

// ── Tests ────────────────────────────────────────────────────────────────────

/** Hand-typed off §469: exactly two answers, and absence is neither. */
const expectedMaterialParticipationValueCount = 2

export const proof = {
    codedBox: {
        /** An absent box, and an empty one, both pass — neither carries an amount. */
        anAbsentOrEmptyBoxIsFine: () => {
            assertEq(codedBoxError('box20')(undefined), undefined)
            assertEq(codedBoxError('box20')([]), undefined)
        },

        /** A row with no amount at all is fine: box 20 code Z prints "STMT". */
        aRowWithNoAmountIsFine: () => {
            assertEq(codedBoxError('box20')([{ code: 'Z' }]), undefined)
        },

        /** An exact amount passes — the control for every refusal below. */
        anExactAmountIsFine: () => {
            assertEq(codedBoxError('box14')([{ code: 'A', amount: '80000.00' }]), undefined)
        },

        /**
         * The refusal names the box AND the code. Erasing the code from the
         * message would leave a transcriber re-checking a dozen rows, which is
         * the same "assert the part that carries the information" finding
         * AGENTS.md records for `${destination}`.
         */
        anInexactAmountIsRefusedNamingTheBoxAndTheCode: () => {
            const message = codedBoxError('box13OtherDeductions')([
                { code: 'A', amount: '500.00' },
                { code: 'W', amount: '1,234.56' },
            ])
            assert(message !== undefined, 'a comma-grouped amount must be refused')
            assert(message.includes('box13OtherDeductions'), ['the refusal must name the box', message])
            assert(message.includes('code W'), ['the refusal must name the code', message])
            // ...and NOT the innocent row's code, or the message points at the
            // wrong line of the printed box.
            assert(!message.includes('code A'), ['the refusal must name only the offending row', message])
        },

        /** An empty code is refused: a row with no code names no item. */
        anEmptyCodeIsRefused: () => {
            const message = codedBoxError('box11OtherIncome')([{ code: '  ', amount: '10.00' }])
            assert(message !== undefined, 'an empty code must be refused')
            assert(message.includes('box11OtherIncome'), [message])
        },

        /**
         * EVERY row is walked, not only the first. A loop written with an
         * early `return` on the first row would pass every leaf above.
         */
        aLaterRowIsCheckedToo: () => {
            const message = codedBoxError('box15')([
                { code: 'A', amount: '1.00' },
                { code: 'B', amount: '2.00' },
                { code: 'P', amount: '3.4567' },
            ])
            assert(message !== undefined, 'the third row must be checked')
            assert(message.includes('code P'), [message])
        },
    },

    materialParticipation: {
        /** Hand-typed count, so a value REMOVED from the vocabulary is caught. */
        theVocabularyIsTwoValues: () => {
            assertEq(materialParticipationValues.length, expectedMaterialParticipationValueCount)
        },

        /** Both values pass; absence passes; anything else is refused. */
        bothValuesAndAbsenceAreAccepted: () => {
            assertEq(materialParticipationError(undefined), undefined)
            for (const value of materialParticipationValues) {
                assertEq(materialParticipationError(value), undefined, ['a stated value must pass', value])
            }
        },

        /** The refusal names the offending value and the whole vocabulary. */
        anUnrecognizedValueIsRefusedNamingTheVocabulary: () => {
            const message = materialParticipationError('true')
            assert(message !== undefined, 'an unrecognized value must be refused')
            assert(message.includes("'true'"), [message])
            for (const value of materialParticipationValues) {
                assert(message.includes(value), ['the refusal must name the vocabulary', value, message])
            }
            // It must also say what the determination DECIDES, so a reader
            // knows why the engine cares rather than only that it does.
            assert(message.includes('§1411(c)(2)(A)'), [message])
        },

        /**
         * The narrowing returns the value from THIS module's list, and
         * `undefined` for anything else — including for the absent case, which
         * is what makes "unstated" reach `fjs/schedule/e`'s refusal rather
         * than silently becoming the negative answer.
         */
        theNarrowingRejectsWhatTheVocabularyDoesNotHold: () => {
            assertEq(materialParticipationNamed('materiallyParticipated'), 'materiallyParticipated')
            assertEq(materialParticipationNamed('didNotMateriallyParticipate'), 'didNotMateriallyParticipate')
            assertEq(materialParticipationNamed(undefined), undefined)
            assertEq(materialParticipationNamed('materially participated'), undefined)
        },
    },
}
