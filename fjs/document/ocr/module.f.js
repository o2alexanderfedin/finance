/**
 * `vnd.fjs.ocr` — DOC-03: the near-verbatim vision-model transcription of a
 * scanned/uploaded artifact, produced before any typed conversion happens.
 *
 * `pages` is the per-page transcription text — an audit trail: the only
 * record of what the vision model actually saw. `fields` is a flat
 * label -> printed-string map the same vision pass produces (e.g.
 * `{"Box 1 Interest income": "1,234.56"}`) — this is what DOC-04's later
 * conversion (Plan 05-03) reads from. Money values here are kept exactly as
 * printed, commas included: `fields` is never parsed or normalized by this
 * module (AGENTS.md — money in a stored JSON document is a string, never a
 * JSON number; here it is not even a canonical decimal string yet, just
 * verbatim OCR output).
 *
 * Deliberate, minimal deviation from the `fjs/media/revision` four-stage
 * template (dialect -> mediaType -> schema -> structural validate ->
 * semantic checkReferences -> composed validate): there are no
 * reference-shaped fields here (no hashes, no cross-field constraints), so
 * there is no `checkReferences` stage — `validate` is `validateShape`
 * directly, structural-only.
 *
 * @module
 */
import { array, record, string } from 'functionalscript/fjs/types/rtti/module.f.js'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.js'
import { assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { base } from '../base/module.f.js'

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.ocr'
/** The media type derived from {@link dialect}: `application/vnd.fjs.ocr+json`. */
export const mediaType = `application/${dialect}+json`

/**
 * rtti schema for an `ocr` BLOB. `dialect` is spread first (via `base`) so
 * structural validation reports it as the first failing field on a
 * mismatched blob (DOC-00's criterion-1 discriminant).
 */
export const ocrSchema = /** @type {const} */ ({
    ...base(dialect),
    pages: array(string),
    fields: record(string),
})

/** @typedef {import('functionalscript/fjs/types/rtti/ts/module.f.js').Ts<typeof ocrSchema>} Ocr */

/**
 * Structural-only validator: checks the shape, nothing more (see module
 * docstring — no `checkReferences` stage exists for this dialect).
 */
export const validate = rttiValidate(ocrSchema)

// ── Tests ────────────────────────────────────────────────────────────────────

export const proof = {
    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.ocr')
        assertEq(mediaType, 'application/vnd.fjs.ocr+json')
    },
    minimalValid: () => {
        const [t] = validate({ dialect, pages: [], fields: {} })
        assertEq(t, 'ok')
    },
    populatedRoundTrips: () => {
        const value = { dialect, pages: ['page 1 text'], fields: { 'Box 1 Interest income': '1,234.56' } }
        const [t, v] = validate(value)
        if (t !== 'ok') {
            throw ['expected ok', t, v]
        }
        assertEq(v.fields['Box 1 Interest income'], '1,234.56')
        assertEq(v.pages[0], 'page 1 text')
    },
    wrongDialectRejected: () => {
        const [t, v] = validate({ dialect: 'vnd.fjs.wrong', pages: [], fields: {} })
        assertEq(t, 'error')
        if (t !== 'error') {
            throw ['expected error', t, v]
        }
        assertEq(v.path[0], 'dialect')
    },
}
