// @ts-nocheck
//
// Phase 35 — the gate that fills the IRS's own `f1040.pdf` and reads every
// value back out of the bytes it produced.
//
// ── Why this is a root-level impure JS file ────────────────────────────────
//
// The same two reasons the other root gates state in full, plus one that is
// specific to this phase:
//
// 1. TypeScript cannot resolve `node:fs` / `node:crypto` / `node:zlib` /
//    `node:test` without `@types/node`, which this repository does not have.
//    `@ts-nocheck` disables TYPE checking of this one file only.
// 2. It reads the filesystem, which a pure `.f.js` may not do.
// 3. **It imports `@cantoo/pdf-lib`, which nothing under `fjs/` may.** That is
//    not a limitation to work around, it is the boundary: a third-party PDF
//    parser inside the engine would break the purity model the whole tree
//    rests on. So `fjs/form1040/pdf` decides WHAT to write and WHERE, as
//    plain data under 100% coverage, and the forty-odd lines below are the
//    only place a library touches a byte.
//
// ── Why the PDF is in the repository ──────────────────────────────────────
//
// `forms/f1040-2025.pdf`, hash-pinned below. Fetching it here would make the
// suite depend on the network and on the IRS not republishing, and every way
// of handling a failed fetch ends in "skip this check" — a fake pass, which
// AGENTS.md spends several paragraphs on for good reason. `forms/README.md`
// records where the bytes came from and when.
//
// ── What each test is for ─────────────────────────────────────────────────
//
// The pure module's own proofs already show that each of its refusals fires
// and says which field is at fault. They cannot show the thing that actually
// matters, because they have no artifact: that the 199 names it accounts for
// are the 199 names the IRS chose, that the box beside the printed `15` is the
// box the map calls line 15, and that a value handed to pdf-lib comes back out
// of the saved bytes unchanged. Every assertion here is against the file, and
// every expected value is hand-typed with the arithmetic that produced it.
//
// **Expect one line of noise per load on stderr** — pdf-lib says "Removing XFA
// form data" every time. That message is load-bearing rather than annoying: it
// is the library telling you the artifact it produces has no XFA copy left to
// render differently, which is half of why `flatten()` is worth calling.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFDocument, PDFName } from '@cantoo/pdf-lib'

// The modules under test, and the engine that feeds them. `fjs/form1040/pdf`
// is the subject; the rest are used FOR REAL — the dialect validators confirm
// the seeds below are well-formed documents before anything computes from
// them, and `form1040Report` is the shipped entry point, not a stand-in.
import {
    accountedFields, amountFieldByLine, amountFieldCount, checkFieldCoverage,
    declaredFieldCount, fillPlan, filingStatusField, lineNumberOf, unfedFieldCount,
} from './fjs/form1040/pdf/module.f.js'
import { form1040Report } from './fjs/form1040/core/module.f.js'
import { taxParamsByYear } from './fjs/tax/params/module.f.js'
import { validate as validateProfile } from './fjs/return/profile/module.f.js'
import { validate as validateW2 } from './fjs/document/w2/module.f.js'
import { validate as validate1099Int } from './fjs/document/1099int/module.f.js'

const repoRoot = dirname(fileURLToPath(import.meta.url))
const templatePath = join(repoRoot, 'forms', 'f1040-2025.pdf')

/**
 * The committed artifact's SHA-256 and byte count, hand-typed from
 * `shasum -a 256 forms/f1040-2025.pdf` on 2026-09-07 and recorded in
 * `forms/README.md` as well.
 *
 * Pinned because everything below is a claim about ONE file. This copy's
 * printed footer still reads `Created 9/5/25` — the same revision Phase 33
 * transcribed the labels from — while its XMP `MetadataDate` is 2026-01-02:
 * re-saved and re-published, with nothing on the page saying so. A newer PDF
 * dropped in place is exactly the change that could move a field name under a
 * map that still typechecks, so it turns this red first, where the message
 * says what happened, rather than three tests later where it would not.
 */
const templateSha256 = '3d31c226df0d189ced80e039d01cf0f8820c1019681a0f0ca6264de277b7e982'
const templateBytes = 220237

/** The template's bytes, read once. */
const template = readFileSync(templatePath)

/** Where a produced artifact is written, so a human can open one. */
const outputDir = join(tmpdir(), 'finance-f1040')

/** pdf-lib's `PDFCheckBox` versus `PDFTextField`, in this project's vocabulary. */
const kindOf = field => field.constructor.name === 'PDFCheckBox' ? 'check' : 'text'

/** Every field the loaded document declares, as `fjs/form1040/pdf` names them. */
const declarationOf = doc =>
    doc.getForm().getFields().map(field => ({ field: field.getName(), kind: kindOf(field) }))

// ── The two returns these tests fill ───────────────────────────────────────
//
// Both are INPUTS. Not one figure below is an expected result; every expected
// value in this file is hand-typed at its assertion, with the arithmetic.
//
// Identifiers are digit-only on purpose. `planning-truth-gate.test.js` scans
// every root-level `*.js` for requirement-shaped citations, and a control
// number like `W2-DANA-2025` is one hyphen away from reading as one.

const singleProfile = elected => ({
    dialect: 'vnd.fjs.return_profile',
    taxYear: 2025,
    filingStatus: 'single',
    dependentCount: 0,
    declaredKinds: elected,
    wholeDollarElection: true,
})

const w2Of = (wages, withheld) => ({
    dialect: 'vnd.fjs.w2',
    employerEIN: '11-1111111',
    employeeSSN: '222-22-2222',
    controlNumber: '4400010001',
    taxYear: 2025,
    formRevision: '2025',
    employerName: 'Northwind Traders',
    employeeName: 'Dana Okafor',
    box1WagesTipsOtherCompensation: wages,
    box2FederalIncomeTaxWithheld: withheld,
})

const interestOf = amount => ({
    dialect: 'vnd.fjs.1099int',
    payerTin: '55-5555555',
    recipientTin: '222-22-2222',
    accountNumber: '88420001',
    taxYear: 2025,
    formRevision: '2025',
    payerName: 'Cascadia Mutual Savings',
    box1InterestIncome: amount,
})

/** The twenty-six document kinds this return holds none of. */
const noOtherDocuments = {
    dividendForms: [], brokerageForms: [], retirementForms: [], socialSecurityForms: [],
    itemizedDeductionForms: [], medicalExpenseForms: [], capitalLossCarryoverForms: [],
    unemploymentForms: [], adjustmentForms: [], studentLoanInterestForms: [], tuitionForms: [],
    creditForms: [], iraForms: [], nonemployeeCompensationForms: [], businessExpenseForms: [],
    assetRegisters: [], rentalProperties: [], farmForms: [], priorYearIraBasisForms: [],
    isoExerciseForms: [], partnershipK1Forms: [], sCorporationK1Forms: [], estateTrustK1Forms: [],
    employeeStockPurchaseForms: [], basisCorrectionForms: [], marketplaceStatements: [],
}

/** Runs a return through the shipped entry point, refusing to guess if it refuses. */
const reportFor = (profile, w2, interestForms) => {
    assert.equal(validateProfile(profile)[0], 'ok', 'the seed profile is not a valid document')
    assert.equal(validateW2(w2)[0], 'ok', 'the seed W-2 is not a valid document')
    for (const one of interestForms) {
        assert.equal(validate1099Int(one)[0], 'ok', 'a seed 1099 is not a valid document')
    }
    const outcome = form1040Report(taxParamsByYear[2025])({
        profile: { documentHash: 'sha256-profile', value: profile },
        w2s: [{ documentHash: 'sha256-w2', value: w2 }],
        interestForms: interestForms.map(
            (value, at) => ({ documentHash: `sha256-int-${at}`, value })),
        ...noOtherDocuments,
    })
    assert.equal(outcome.kind, 'ok', outcome.message)
    return outcome
}

/**
 * **Return A — tax owed.** Single, $85,000.00 of wages with $9,000.00
 * withheld, and $1,225.00 of bank interest. Chosen so that taxable income
 * lands at $70,475, the MIDDLE of the tax table's `at least 70,450, but less
 * than 70,500` row rather than on either edge of it: an off-by-one in the
 * table's `<` versus `<=` would then not be what this test measured.
 */
const returnOwing = () => reportFor(
    singleProfile(['wages', 'taxableInterest', 'federalTaxWithheldOnW2']),
    w2Of('85000.00', '9000.00'),
    [interestOf('1225.00')])

/**
 * **Return B — refund, and a taxable income of zero.** Single, $12,000.00 of
 * wages with $500.00 withheld and nothing else. Wages below the standard
 * deduction, so line 15 and line 22 both come to nothing and the printed
 * caption's `enter -0-` applies to a REAL report rather than to a synthetic
 * line. It also lands on the overpaid side, so line 34 carries an amount and
 * line 37 is blank — the reverse of return A, which is the pair the
 * blank-versus-zero rule needs.
 */
const returnRefunded = () => reportFor(
    singleProfile(['wages', 'federalTaxWithheldOnW2']),
    w2Of('12000.00', '500.00'),
    [])

/** Fills a fresh copy of the template from a plan, and returns the saved bytes. */
const fill = async plan => {
    const doc = await PDFDocument.load(template)
    const form = doc.getForm()
    for (const one of plan.text) { form.getTextField(one.field).setText(one.text) }
    for (const one of plan.check) { form.getCheckBox(one.field).check() }
    return Buffer.from(await doc.save())
}

/** Every field's value in a saved document, by name: a string, `''` when empty. */
const readBack = doc => new Map(doc.getForm().getFields().map(field => [
    field.getName(),
    kindOf(field) === 'check' ? (field.isChecked() ? 'X' : '') : (field.getText() ?? ''),
]))

/**
 * The strings a flattened page actually DRAWS.
 *
 * Flattening replaces each widget with a form XObject holding that widget's
 * appearance stream, and the appearance nests one further level, so this
 * recurses through `Resources`/`XObject`. The text arrives as PDF string
 * operands, and the ones that matter are HEX — `<3134312C303030> Tj` is
 * `141,000`. A first version of this looked only for the `(literal) Tj` form,
 * found nothing at all, and would have read as "flatten silently dropped every
 * value" had the appearance streams not been dumped by hand.
 */
const drawnStringsOn = page => {
    const decode = stream => {
        const raw = Buffer.from(stream.getContents())
        try { return inflateSync(raw).toString('latin1') } catch { return raw.toString('latin1') }
    }
    const collect = (stream, depth) => {
        let out = decode(stream)
        const resources = depth === 0 ? undefined : stream.dict.lookup(PDFName.of('Resources'))
        const xobjects = resources === undefined
            ? undefined
            : resources.lookup(PDFName.of('XObject'))
        if (xobjects === undefined) { return out }
        for (const key of xobjects.keys()) {
            const child = xobjects.lookup(key)
            if (child !== undefined && child.getContents !== undefined) {
                out += `\n${collect(child, depth - 1)}`
            }
        }
        return out
    }
    const resources = page.node.Resources()
    const xobjects = resources === undefined
        ? undefined
        : resources.lookup(PDFName.of('XObject'))
    let all = ''
    if (xobjects !== undefined) {
        for (const key of xobjects.keys()) {
            const child = xobjects.lookup(key)
            if (child !== undefined && child.getContents !== undefined) {
                all += `${collect(child, 6)}\n`
            }
        }
    }
    const found = []
    for (const m of all.matchAll(/<([0-9A-Fa-f\s]*)>\s*Tj/g)) {
        found.push(Buffer.from(m[1].replace(/\s/g, ''), 'hex').toString('latin1'))
    }
    for (const m of all.matchAll(/\(((?:[^()\\]|\\.)*)\)\s*Tj/g)) { found.push(m[1]) }
    return found.filter(one => one !== '')
}

// ── 1. The artifact ────────────────────────────────────────────────────────

test('the committed f1040.pdf is the exact revision this map was written against', async () => {
    assert.equal(createHash('sha256').update(template).digest('hex'), templateSha256)
    assert.equal(template.length, templateBytes)
    const doc = await PDFDocument.load(template)
    assert.equal(doc.getPageCount(), 2)
    const declared = declarationOf(doc)
    // Hand-typed from the artifact, not counted off the map: 126 boxes you
    // type in and 73 you tick.
    assert.equal(declared.length, 199)
    assert.equal(declared.filter(one => one.kind === 'text').length, 126)
    assert.equal(declared.filter(one => one.kind === 'check').length, 73)
})

// ── 2. The two-way field guard, against the artifact's own declaration ─────

test('every field the PDF declares is accounted for, and every accounted field is declared', async () => {
    const doc = await PDFDocument.load(template)
    const outcome = checkFieldCoverage(declarationOf(doc))
    assert.equal(outcome.kind, 'ok', outcome.message)
    // The counts the map claims, checked against the artifact rather than
    // against themselves: 56 amount rows, 5 filing-status boxes, 138 named
    // as fed by nothing, and 199 in total.
    assert.equal(amountFieldCount + Object.keys(filingStatusField).length + unfedFieldCount,
        declarationOf(doc).length)
    assert.equal(declaredFieldCount, 199)
    assert.equal(accountedFields.length, 199)
})

test('the guard detects a field the map does not name — against the real declaration', async () => {
    // The control the test above needs. `checkFieldCoverage` returning `ok`
    // for the real PDF proves nothing unless a PDF with one more field is
    // refused, which is exactly the "a gate needs a control" rule.
    const doc = await PDFDocument.load(template)
    const withAnExtra = [
        ...declarationOf(doc),
        { field: 'topmostSubform[0].Page2[0].f2_52[0]', kind: 'text' },
    ]
    const outcome = checkFieldCoverage(withAnExtra)
    assert.equal(outcome.kind, 'error')
    assert.match(outcome.message, /unmapped: topmostSubform\[0\]\.Page2\[0\]\.f2_52\[0\]/)
})

// ── 3. The IRS's own line-number bindings ──────────────────────────────────

test('the XFA template binds each printed line number to the field the map claims', async () => {
    // `preserveXFA` is not optional here: the default load DROPS the XFA
    // packet, which is the data this test exists to read.
    const doc = await PDFDocument.load(template, { preserveXFA: true })
    const acroForm = doc.catalog.lookup(PDFName.of('AcroForm'))
    const packets = acroForm.lookup(PDFName.of('XFA'))
    let templateXml = ''
    for (let at = 0; at < packets.size(); at += 2) {
        // The packet NAME is a PDF string, so `String(…)` renders it with its
        // delimiters: `(template)`, not `template`.
        if (String(packets.lookup(at)).replace(/[()]/g, '') !== 'template') { continue }
        const raw = Buffer.from(packets.lookup(at + 1).getContents())
        try { templateXml = inflateSync(raw).toString('utf8') } catch { templateXml = raw.toString('utf8') }
    }
    assert.ok(templateXml.length > 100000,
        'the XFA template packet did not decompress; the rest of this test would pass vacuously')

    // A printed line number is a `<draw name="Ln…">` whose value is the number
    // and whose `<traverse ref>` names the field beside it. `Ln` and not
    // `Line`: the `Line…` draws are the CAPTIONS, and several of those carry a
    // bare `1`/`2`/`3` for a checkbox choice, which would read as line 1.
    const bound = new Map()
    for (const block of templateXml.matchAll(/<draw\b([\s\S]*?)<\/draw\s*>/g)) {
        const body = block[1]
        const head = body.slice(0, body.indexOf('>'))
        const named = /name="([^"]*)"/.exec(head)
        if (named === null || !named[1].startsWith('Ln')) { continue }
        const printed = /<value\s*><text\s*>([\s\S]*?)<\/text\s*>/.exec(body)
        const ref = /<traverse[^>]*ref="([^"]+)"/.exec(body)
        if (printed === null || ref === null) { continue }
        bound.set(printed[1].trim(), ref[1])
    }

    // Hand-typed: 57 printed line numbers carry an amount box, and the engine
    // produces 56 lines. Asserted so a parse that silently found none — or
    // found 300 — cannot pass the comparison below by having nothing to
    // compare.
    assert.equal(bound.size, 57)

    // Line 38 is the whole of the difference, and it is named: the estimated
    // tax penalty, which no dialect carries the payment dates to compute.
    const engineLines = amountFieldByLine.map(([number]) => number)
    const irsLines = [...bound.keys()].filter(number => number !== '38')
    assert.deepEqual([...irsLines].sort(), [...engineLines].sort(),
        'the IRS\'s own line-number bindings and the map disagree about which lines exist')

    // And each one points at the same field. The map holds the fully qualified
    // AcroForm name; the XFA holds the leaf, so the comparison is on the leaf.
    for (const [number, field] of amountFieldByLine) {
        assert.equal(field.split('.').pop(), bound.get(number),
            `line ${number} is mapped to ${field}, which is not the field the IRS binds it to`)
    }
})

// ── 4. A real return, filled, and read back out of the saved bytes ─────────

/**
 * Return A's every non-blank box, hand-typed BY FIELD NAME.
 *
 * Keyed by the PDF's name rather than by line number on purpose: keyed by line
 * number, this table would be read through the very map it is checking, and
 * two swapped rows would move the value and the expectation together. Keyed by
 * field, a swap puts `70,475.00` in the box the IRS labels 14 and this test
 * says so.
 *
 * The arithmetic, so every figure can be checked without running anything:
 *
 * | line | field | amount | from |
 * |---|---|---|---|
 * | 1a | f1_47 | 85,000.00 | W-2 box 1 |
 * | 1z | f1_57 | 85,000.00 | add lines 1a through 1h |
 * | 2b | f1_59 | 1,225.00 | 1099-INT box 1 |
 * | 9 | f1_73 | 86,225.00 | 85,000 + 1,225 |
 * | 11a | f1_75 | 86,225.00 | 86,225 − 0 adjustments |
 * | 11b | f2_01 | 86,225.00 | amount from line 11a |
 * | 12e | f2_02 | 15,750.00 | single standard deduction, Rev. Proc. 2025-32 §3.01 |
 * | 14 | f2_05 | 15,750.00 | 15,750 + 0 + 0 |
 * | 15 | f2_06 | 70,475.00 | 86,225 − 15,750 |
 * | 16 | f2_08 | 10,419.00 | see below |
 * | 18 | f2_10 | 10,419.00 | 10,419 + 0 |
 * | 22 | f2_14 | 10,419.00 | 10,419 − 0 credits |
 * | 24 | f2_16 | 10,419.00 | 10,419 + 0 other taxes |
 * | 25a | f2_17 | 9,000.00 | W-2 box 2 |
 * | 25d | f2_20 | 9,000.00 | 9,000 + 0 + 0 |
 * | 33 | f2_29 | 9,000.00 | 9,000 + 0 + 0 |
 * | 37 | f2_35 | 1,419.00 | 10,419 − 9,000 |
 *
 * **Line 16 derived by hand from the printed rate schedule**, not read out of
 * `fjs/tax/table`. Taxable income $70,475 sits in the table's `at least
 * 70,450, but less than 70,500` row, whose tax is figured on the $70,475
 * midpoint:
 *
 *     11,925 × 10%                    =  1,192.50
 *     (48,475 − 11,925) × 12%         =  4,386.00
 *     (70,475 − 48,475) × 22%         =  4,840.00
 *                                       ─────────
 *                                        10,418.50  → 10,419
 *
 * The ceilings are Rev. Proc. 2024-40 §2.01's single schedule. The final
 * rounding is the taxpayer's whole-dollar election, which this profile takes.
 */
const expectedOwing = [
    ['topmostSubform[0].Page1[0].f1_47[0]', '85,000.00'],
    ['topmostSubform[0].Page1[0].f1_57[0]', '85,000.00'],
    ['topmostSubform[0].Page1[0].f1_59[0]', '1,225.00'],
    ['topmostSubform[0].Page1[0].f1_73[0]', '86,225.00'],
    ['topmostSubform[0].Page1[0].f1_75[0]', '86,225.00'],
    ['topmostSubform[0].Page2[0].f2_01[0]', '86,225.00'],
    ['topmostSubform[0].Page2[0].f2_02[0]', '15,750.00'],
    ['topmostSubform[0].Page2[0].f2_05[0]', '15,750.00'],
    ['topmostSubform[0].Page2[0].f2_06[0]', '70,475.00'],
    ['topmostSubform[0].Page2[0].f2_08[0]', '10,419.00'],
    ['topmostSubform[0].Page2[0].f2_10[0]', '10,419.00'],
    ['topmostSubform[0].Page2[0].f2_14[0]', '10,419.00'],
    ['topmostSubform[0].Page2[0].f2_16[0]', '10,419.00'],
    ['topmostSubform[0].Page2[0].f2_17[0]', '9,000.00'],
    ['topmostSubform[0].Page2[0].f2_20[0]', '9,000.00'],
    ['topmostSubform[0].Page2[0].f2_29[0]', '9,000.00'],
    ['topmostSubform[0].Page2[0].f2_35[0]', '1,419.00'],
    // The one box ticked: Single. `Checkbox_ReadOrder` is the IRS's own
    // subform around the left column of the filing-status block, and it is
    // part of the name.
    ['topmostSubform[0].Page1[0].Checkbox_ReadOrder[0].c1_8[0]', 'X'],
]

test('a real return fills the form, and every value comes back out of the saved bytes', async () => {
    const outcome = returnOwing()
    // 56 lines in, 56 lines mapped. If the engine grew a line the map does not
    // have, or lost one the map claims, `fillPlan` refuses rather than filling
    // 55 boxes and looking finished.
    assert.equal(outcome.lines.length, amountFieldCount)
    const plan = fillPlan('single')(outcome.lines)
    assert.equal(plan.kind, 'ok', plan.message)

    const filled = await fill(plan)
    const values = readBack(await PDFDocument.load(filled))

    // Every field, all 199, in one sweep: the eighteen named above hold
    // exactly what they should, and the other 181 are empty. The second half
    // is what "no field is filled from nothing" means once there is an
    // artifact to say it about.
    assert.equal(values.size, 199)
    const expected = new Map(expectedOwing)
    for (const [field, value] of values) {
        assert.equal(value, expected.get(field) ?? '',
            `${field} holds ${JSON.stringify(value)}`)
    }
    // Hand-typed, so a run that filled nothing at all cannot satisfy the loop
    // above by making every box empty on both sides.
    assert.equal([...values.values()].filter(one => one !== '').length, 18)

    mkdirSync(outputDir, { recursive: true })
    writeFileSync(join(outputDir, 'f1040-2025-owing.pdf'), filled)
})

test('a return with no taxable income prints -0- where the caption says to, and leaves the rest blank', async () => {
    const outcome = returnRefunded()
    const plan = fillPlan('single')(outcome.lines)
    assert.equal(plan.kind, 'ok', plan.message)
    const values = readBack(await PDFDocument.load(await fill(plan)))

    // $12,000.00 of wages against a $15,750.00 standard deduction. Lines 15
    // and 22 are the only two on this form whose printed caption says "If zero
    // or less, enter -0-", and they are the only two zeros written.
    assert.equal(values.get('topmostSubform[0].Page2[0].f2_06[0]'), '-0-')
    assert.equal(values.get('topmostSubform[0].Page2[0].f2_14[0]'), '-0-')
    // Line 16's tax, line 18 and line 24's total tax are all nothing, and all
    // three stay BLANK — the difference this rule exists to draw.
    assert.equal(values.get('topmostSubform[0].Page2[0].f2_08[0]'), '')
    assert.equal(values.get('topmostSubform[0].Page2[0].f2_10[0]'), '')
    assert.equal(values.get('topmostSubform[0].Page2[0].f2_16[0]'), '')
    // The refund side rather than the owed side: line 34 is 500 − 0 and line
    // 37 is blank, the reverse of the return above.
    assert.equal(values.get('topmostSubform[0].Page2[0].f2_30[0]'), '500.00')
    assert.equal(values.get('topmostSubform[0].Page2[0].f2_35[0]'), '')
    assert.equal(values.get('topmostSubform[0].Page1[0].f1_47[0]'), '12,000.00')
    assert.equal(values.get('topmostSubform[0].Page2[0].f2_02[0]'), '15,750.00')
    // Hand-typed: thirteen amounts and one tick.
    assert.equal([...values.values()].filter(one => one !== '').length, 14)
})

test('every filled line is a line the engine produced, named by its rule', () => {
    // The other direction, stated over the artifact's own vocabulary: each
    // field written carries a value that some `ReportLine.rule` names. This is
    // the assertion that would fail if a fill were ever synthesised from
    // anything but the report.
    const outcome = returnOwing()
    const plan = fillPlan('single')(outcome.lines)
    assert.equal(plan.kind, 'ok', plan.message)
    const fieldForRule = new Map(amountFieldByLine)
    const produced = new Set(outcome.lines.map(line => fieldForRule.get(lineNumberOf(line.rule))))
    for (const one of plan.text) {
        assert.ok(produced.has(one.field), `${one.field} was filled by no report line`)
    }
    assert.equal(plan.text.length, 17)
    assert.equal(plan.check.length, 1)
})

// ── 5. Flattening ──────────────────────────────────────────────────────────

test('the flattened artifact has no form fields left and draws every value onto the page', async () => {
    const plan = fillPlan('single')(returnOwing().lines)
    const doc = await PDFDocument.load(await fill(plan))
    doc.getForm().flatten()
    const flat = Buffer.from(await doc.save())

    const reloaded = await PDFDocument.load(flat)
    // No field survives, so no viewer can render this differently from any
    // other viewer, and nobody can retype a figure in a form box.
    assert.equal(reloaded.getForm().getFields().length, 0)
    assert.equal(reloaded.getPageCount(), 2)

    // Flatten CAN succeed and draw nothing — it works from each widget's
    // appearance stream, and a missing appearance is silent. So the values are
    // read back out of the page's own marks.
    const drawn = [...drawnStringsOn(reloaded.getPage(0)), ...drawnStringsOn(reloaded.getPage(1))]
    for (const [field, value] of expectedOwing) {
        if (value === 'X') { continue }
        assert.ok(drawn.includes(value), `${value} (${field}) is not drawn on the flattened page`)
    }
    // The tick is drawn too, as ZapfDingbats `4` — the check-mark glyph. It is
    // asserted separately because it is not a value, and because a reader
    // finding a bare `4` in this file deserves to know why.
    assert.ok(drawn.includes('4'), 'the filing-status tick is not drawn')
    // Hand-typed: seventeen amounts plus the tick, and nothing else drawn by
    // the flattening. A count, so a page that drew every figure twice — or
    // drew a stale one — is not silently fine.
    assert.equal(drawn.length, 18)

    mkdirSync(outputDir, { recursive: true })
    writeFileSync(join(outputDir, 'f1040-2025-owing-flat.pdf'), flat)
})
