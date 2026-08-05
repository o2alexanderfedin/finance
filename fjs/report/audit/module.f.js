/**
 * PROV-07 (the reported half) — the numeric-literal audit: a pure count of
 * numeric-literal tokens in a stored report program's source text.
 *
 * Two properties, stated once here so every call site can rely on them
 * without re-deriving them:
 *
 * - **REPORTED, never refused.** Legitimate programs contain numeric
 *   literals — a bracket index, a zero, a scale. 09-CONTEXT.md: Criterion 3
 *   asks only that the count be *visible to the user*; this module never
 *   throws and never returns a `Result` — it always returns a plain `number`.
 *   The actual anti-hardcoding kill condition is a different, unconditional
 *   mechanism (the zero-observed-CAS-reads check Plan 09-03 wires into
 *   `fjs_run` itself), computed from `interpret`'s own observed reads, not
 *   from this text-only heuristic.
 * - **Not a parser.** Strings, template literals, and comments are stripped
 *   TEXTUALLY first; every remaining token is then counted. This is
 *   deliberately weaker than a real tokenizer — see the accepted-risk note
 *   on template-literal `${...}` expressions below — and that is fine
 *   precisely because of the property above: an undercount here has no
 *   security consequence.
 *
 * This audit runs on the program's source text, in the same conceptual place
 * `fjs/guest/materialize/module.f.js`'s `checkSpecifiers` (SEC-02) already
 * runs: the source text is already in hand at that point, and the two checks
 * are the same kind of static reading of the same string. This module's own
 * string-stripping regexes copy that module's `specifierPattern` idiom — a
 * negated character class plus an escaped-any alternative
 * (`(?:[^'\\]|\\.)*`), never a lazy wildcard — so matching stays linear in
 * input length with no catastrophic-backtracking shape.
 *
 * ## Where this fits
 *
 * This module is one of three mechanisms PROV-07 uses against a program that
 * CONTAINS the answer instead of computing it — the archetype being
 * `() => pure({ line16: 9137 })`, which compiles, returns a plausible figure,
 * and reads nothing. The other two are the zero-read kill condition and the
 * perturbation gate with its control leg.
 *
 * **The plain-language account of all three, and of why the design is shaped
 * this way, lives in `fjs/server/fjs_run/module.f.js`'s module header, section
 * "PROV-07's anti-hardcoding design, in plain words."** It is written there
 * rather than duplicated here so the three parts are explained together and in
 * one place — and because that file is where the mechanism that actually
 * refuses a program lives. Read it before changing this counter's behaviour:
 * this module's freedom to be a weak heuristic is a direct consequence of the
 * kill condition being something else entirely.
 *
 * @module
 */
import { assertEq } from 'functionalscript/fjs/asserts/module.f.js'

// ── String/comment stripping ─────────────────────────────────────────────────

/**
 * A single-quoted string span: `'`, then a body that is either a
 * non-`'`/non-`\` character or an escaped-any pair (`\\.`, which also
 * consumes an escaped closing quote), then the closing `'`. The same shape
 * `fjs/guest/materialize/module.f.js`'s `specifierPattern` already
 * established as free of catastrophic backtracking, applied here to strip
 * rather than to capture.
 * @type {RegExp}
 */
const singleQuotedStringPattern = /'(?:[^'\\]|\\.)*'/g

/** The double-quoted counterpart of {@link singleQuotedStringPattern}. */
const doubleQuotedStringPattern = /"(?:[^"\\]|\\.)*"/g

/**
 * The backtick-quoted (template literal) counterpart of
 * {@link singleQuotedStringPattern}.
 *
 * **Accepted risk:** a numeric literal legitimately embedded inside a
 * template literal's `${...}` expression (e.g. `` `total: ${1 + 2}` ``) is
 * stripped along with the whole span and so is undercounted. This is a
 * documented limitation, not a bug: per 09-CONTEXT.md this audit is
 * REPORTED, never refused, so an undercount here carries no security
 * consequence — the zero-observed-CAS-reads check (Plan 09-03) is the actual
 * kill condition, and it is computed independently of this text-only scan.
 */
const templateLiteralPattern = /`(?:[^`\\]|\\.)*`/g

/** A `//` line comment: from `//` to (not including) the next newline. */
const lineCommentPattern = /\/\/[^\n]*/g

/** A block comment (slash-star ... star-slash), non-greedy so it stops at the first closer. */
const blockCommentPattern = /\/\*[\s\S]*?\*\//g

/**
 * Strips every string, template-literal, and comment span from `source`,
 * textually, before any numeric-literal counting happens. Strings/templates
 * are stripped BEFORE comments deliberately: a string containing `//` (e.g.
 * `'http://example.com'`) would otherwise be misread as starting a line
 * comment mid-string, corrupting everything after it on that line.
 * @type {(source: string) => string}
 */
const stripStringsAndComments = source => source
    .replace(singleQuotedStringPattern, "''")
    .replace(doubleQuotedStringPattern, '""')
    .replace(templateLiteralPattern, '``')
    .replace(lineCommentPattern, '')
    .replace(blockCommentPattern, '')

// ── The audit itself ─────────────────────────────────────────────────────────

/**
 * A numeric-literal token: one or more digits, an optional `.`-decimal part,
 * and an optional bigint `n` suffix — all bounded by `\b` on both ends.
 *
 * `\b` alone is sufficient to exclude a digit embedded in an identifier (e.g.
 * `box1InterestIncome`'s `1`, or the adversary fixture's `line16`'s `16`): a
 * digit immediately preceded by a letter or another digit is not a
 * word-boundary position at all, because both the letter/digit and the digit
 * that follows it are `\w` characters — `\b` only exists at a transition
 * between a `\w` and a non-`\w` character. The pattern therefore never even
 * attempts to start a match at `line16`'s `1`; it only starts where a real
 * boundary exists, which is why no special-casing for identifiers is needed.
 * @type {RegExp}
 */
const numericLiteralPattern = /\b\d+(?:\.\d+)?n?\b/g

/**
 * Counts numeric-literal tokens in a stored report program's source text.
 * Strips strings/templates/comments first ({@link stripStringsAndComments}),
 * then counts every remaining `\b\d+(?:\.\d+)?n?\b` match. Returns `0` when
 * `source` contains no literal at all (including the empty string) — this
 * function is a pure count and never throws on a program's own account.
 * @type {(source: string) => number}
 */
export const countNumericLiterals = source => {
    const stripped = stripStringsAndComments(source)
    const matches = stripped.match(numericLiteralPattern)
    return matches === null ? 0 : matches.length
}

// ── Tests ────────────────────────────────────────────────────────────────────

export const proof = {
    // ── Task 1's <behavior> leaves ──────────────────────────────────────
    zeroOnEmptySource: () => {
        assertEq(countNumericLiterals(''), 0)
    },
    countsAPlainLiteral: () => {
        assertEq(countNumericLiterals('const x = 42'), 1)
    },
    countsMultipleDistinctLiterals: () => {
        assertEq(countNumericLiterals('const a = 1; const b = 2.5; const c = 3n'), 3)
    },

    // ── Task 2's honesty proofs ──────────────────────────────────────────
    // A digit embedded in an identifier is never counted: no word boundary
    // sits between `box1`'s `x` and `1`.
    digitInsideIdentifierNotCounted: () => {
        assertEq(countNumericLiterals('const box1InterestIncome = ctx.casRead(a)'), 0)
    },
    // A digit inside a single-quoted string is stripped before counting.
    digitInsideSingleQuotedStringNotCounted: () => {
        assertEq(countNumericLiterals("const s = '2024 tax year'"), 0)
    },
    // A digit inside a template literal is stripped before counting (the
    // accepted-risk note on templateLiteralPattern documents the one case
    // this also undercounts on purpose: a literal legitimately inside a
    // `${...}` expression).
    digitInsideTemplateLiteralNotCounted: () => {
        assertEq(countNumericLiterals('const s = `rev ${x} 2024`'), 0)
    },
    // A digit inside a `//` line comment is stripped; the real literal on
    // the next line still counts.
    digitInsideLineCommentNotCountedButRealLiteralCounted: () => {
        assertEq(countNumericLiterals('// 2024\nconst x = 1'), 1)
    },
    // A digit inside a `/* */` block comment is stripped; the real literal
    // alongside it still counts.
    digitInsideBlockCommentNotCountedButRealLiteralCounted: () => {
        assertEq(countNumericLiterals('/* 2024 */ const x = 1'), 1)
    },
    // The exact verbatim adversary fixture 09-CONTEXT.md names — `() => pure({
    // line16: 9137 })`, adapted to this project's `ctx`-based entry point —
    // is the same string Plan 09-04 later stores and runs for real (kept
    // byte-for-byte identical here for that reason). It must count EXACTLY
    // 1: the `16` inside `line16` is never counted (no word boundary between
    // the letter and the digit); only `9137` is.
    countsTheVerbatimAdversaryFixtureLiteralExactlyOnce: () => {
        const fixture = 'export const report = ctx => () => ctx.pure({ line16: 9137 })'
        assertEq(countNumericLiterals(fixture), 1)
    },
}
