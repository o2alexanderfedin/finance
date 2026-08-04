/**
 * DOC-04 — the ONE conversion boundary between a printed OCR amount string
 * and exact bigint minor units.
 *
 * A vision model transcribes a US printed form verbatim, commas and all:
 * `"1,234.56"`. `fjs/types/decimal`'s `parse` refuses that string, and that
 * refusal is correct, not a bug — comma grouping is a presentation
 * convention of printed US forms, not part of a decimal number, and
 * `fjs/types/decimal` is generic and staged for lifting into
 * FunctionalScript unchanged (AGENTS.md's staging rule). Teaching it about
 * commas would push a locale convention upstream.
 *
 * So the normalization lives here instead, one step outside: degroup, then
 * hand the canonical string to the generic parser. Like
 * `fjs/exact/module.f.js`, this file is deliberately **not** an upstream
 * candidate — it encodes a US-printed-form ingestion convention, which is
 * app context rather than a generic capability.
 *
 * Exactly one function in this repo turns a printed amount into cents. If
 * two could, they could disagree, and a disagreement between two conversion
 * paths is a silently wrong number on a tax return.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { parse } from '../../types/decimal/module.f.js'

/**
 * Strips grouping commas from a printed amount: a comma is grouping only
 * when it sits BETWEEN two digits. The captured leading digit is put back
 * via `'$1'` — replacing the whole match with the empty string would delete
 * that digit along with the comma, silently turning `"1,234.56"` into
 * `"234.56"`.
 *
 * A leading, trailing, or doubled comma (`",1234"`, `"1234,"`, `"1,,234"`)
 * has no digit on both sides, so it is not matched, survives into
 * {@link parse}, and is refused there. Malformed input is never silently
 * repaired into something parseable.
 *
 * Both digit references are single, non-nested `\d` atoms with no
 * alternation, so evaluation is linear in input length — no catastrophic
 * backtracking shape.
 * @type {RegExp}
 */
const groupingComma = /(\d),(?=\d)/g

/**
 * Parses a printed OCR amount string into exact bigint minor units at the
 * given `scale` — a superset of `fjs/types/decimal`'s `parse`, accepting
 * everything it accepts plus comma-grouped forms, and refusing (via that
 * parser's own `assert`) everything else. Never rounds, never truncates,
 * never falls back to a default.
 * @type {(scale: number) => (printed: string) => bigint}
 */
export const parseOcrAmount = scale => printed => parse(scale)(printed.replace(groupingComma, '$1'))

/**
 * The absence-preserving wrapper (DOC-11, at the primitive level): a box
 * the form left blank is `undefined` in, `undefined` out. It never becomes
 * `0n`. Every dialect that will ever convert printed boxes needs this
 * distinction, so it lives here beside the parser rather than being
 * re-derived per dialect — a blank box decoding as zero is the single
 * easiest way for this system to report a confident wrong number.
 * @type {(scale: number) => (printed: string | undefined) => bigint | undefined}
 */
export const parseOptionalOcrAmount = scale =>
    printed => printed === undefined ? undefined : parseOcrAmount(scale)(printed)

// ── Tests ────────────────────────────────────────────────────────────────────

export const proof = {
    // Success Criterion 3, at the primitive level: the literal printed
    // string from a US 1099-INT becomes exact cents.
    groupedThousands: () => {
        assertEq(parseOcrAmount(2)('1,234.56'), 123456n)
    },
    // A superset, not a replacement: an ungrouped string parses identically.
    ungroupedIsUnchanged: () => {
        assertEq(parseOcrAmount(2)('1234.56'), 123456n)
    },
    multipleGroupingCommas: () => {
        assertEq(parseOcrAmount(2)('1,234,567.89'), 123456789n)
    },
    optional: {
        // DOC-11: absent in, absent out — never 0n.
        absenceIsPreserved: () => {
            assertEq(parseOptionalOcrAmount(2)(undefined), undefined)
            assert(parseOptionalOcrAmount(2)(undefined) !== 0n, 'a blank box must not decode as zero')
        },
        presentValueParses: () => {
            assertEq(parseOptionalOcrAmount(2)('1,234.56'), 123456n)
        },
    },
    // A comma with a digit on only one side is not grouping. It is not
    // stripped, so it reaches the generic parser and is refused there.
    throw: {
        leadingComma: () => parseOcrAmount(2)(',1234'),
        trailingComma: () => parseOcrAmount(2)('1234,'),
    },
}
