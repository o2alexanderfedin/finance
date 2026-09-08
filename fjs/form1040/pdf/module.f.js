/**
 * Phase 35 — the engine's report as a fill plan for the IRS's OWN
 * `f1040.pdf`.
 *
 * ## Why a plan and not a filled PDF
 *
 * `demo/steps/09-form1040.js` draws both pages of the form face in CSS, every
 * amount cited, and it is genuinely useful — but **the IRS will not accept a
 * re-creation of their form.** The filable artifact is
 * `https://www.irs.gov/pub/irs-pdf/f1040.pdf`, committed verbatim at
 * [`forms/f1040-2025.pdf`](../../../forms/f1040-2025.pdf): a two-page AcroForm
 * declaring **199 named fields**, 126 text and 73 checkbox.
 *
 * Writing into those fields needs a PDF library, and no `.f.js` may import
 * one — a third-party parser would break the purity model this whole tree
 * rests on, and `@cantoo/pdf-lib` is a `devDependency` precisely so that
 * nothing here can. So this module computes **what to write and where**, as
 * plain data, and `form1040-pdf-gate.test.js` is the ~40 lines of binding that
 * writes it. Everything decidable — the mapping, both directions of the
 * coverage guard, the printed number format, the blank-versus-`-0-` rule —
 * is here, where `npm run cov` holds it at 100% and `all.test.js` runs its
 * proofs.
 *
 * ## The guard is the point, and it is total
 *
 * AGENTS.md's fourth shipped defect was a proof whose iteration set came from
 * the code under test, so it could never notice that set shrinking. A field
 * map has the same trap available twice over, and the PDF closes it: **every
 * field carries a name, so the artifact itself declares the set the map must
 * cover.** An unmapped field is therefore a detectable hole, not a silent one.
 *
 * So every one of the 199 names is accounted for, in exactly one of three
 * places, and {@link checkFieldCoverage} compares that accounting against
 * whatever the PDF declares — in BOTH directions, plus the field's kind:
 *
 * | where | how many | what it is |
 * |---|---|---|
 * | {@link amountFieldByLine} | 56 | an engine line's amount |
 * | {@link filingStatusField} | 5 | the filing-status box the profile selects |
 * | {@link unfedFieldGroups} | 138 | named, with the reason nothing feeds it |
 *
 * And {@link fillPlan} closes the other direction over the engine: a report
 * line whose printed number has no field, or a mapped line the engine did not
 * produce, refuses the whole plan rather than filling 55 of 56 boxes.
 *
 * ## What this does NOT fill, said plainly
 *
 * The taxpayer's name, social security number and address are **left blank**,
 * and so are the dependents grid, the direct-deposit block, the signature
 * block and the paid-preparer block. Every one of them is named in
 * {@link unfedFieldGroups} with its reason, which is the difference between a
 * gap and a hole: the guard knows about all of them, and a field that stopped
 * being one of them would redden.
 *
 * The reason is the phase's own criterion — *every value on the form came from
 * the engine*. The engine computes a return; it does not hold an identity. A
 * name transcribed out of a W-2 box into a PDF box would be the first value on
 * this form that no rule produced and no `sources` tuple cites, and the honest
 * place to add it is a phase that says so. **A filer must therefore complete
 * the header block and sign before this can be mailed.**
 *
 * @module
 */
import { assert, assertEq, assertNotNullish } from 'functionalscript/fjs/asserts/module.f.mjs'

/** @import { ReportLine } from '../../report/line/module.f.js' */
/** @import { IndividualFilingStatus } from '../../tax/params/module.f.js' */

/**
 * What a PDF form field is: a box you type in, or a box you tick.
 *
 * Kept as its own union rather than inlined, because
 * {@link checkFieldCoverage} compares it against what the artifact declares.
 * Filling a checkbox as if it were a text field is a runtime throw from the
 * library, in a viewer, at the worst possible moment; here it is a red test.
 * @typedef {'text' | 'check'} FieldKind
 */

/** A field name and its kind, as the PDF declares them.
 * @typedef {{ readonly field: string, readonly kind: FieldKind }} DeclaredField
 */

// ── The map, hand-typed against the artifact ────────────────────────────────

/**
 * Every printed line number the engine produces, and the PDF field that holds
 * that line's amount. **56 rows.**
 *
 * ### Where these names come from
 *
 * Not from guessing at `f2_08` and not from counting boxes down the page. The
 * committed PDF carries an XFA template packet — the IRS's own Designer
 * source — in which each printed line number is a `<draw>` whose
 * `<traversal><traverse ref="…">` names the field beside it:
 *
 * ```xml
 * <draw name="Ln12e" x="170.18mm" y="33.867mm"><value><text>12e</text></value>
 *   <traversal><traverse ref="f2_02[0]"/></traversal></draw>
 * ```
 *
 * That is the IRS stating, in their own authoring data, that the box beside
 * the printed `12e` is `f2_02`. `form1040-pdf-gate.test.js` re-derives all 57
 * of those bindings from the committed bytes and compares them to this table
 * in both directions, so a transposition here is caught by the artifact rather
 * than by a reader holding paper up to a screen — which is how Phase 33 found
 * four real errors in the CSS face, one of them a checkbox block off by one
 * for its whole length.
 *
 * ### Why 57 bindings and 56 rows
 *
 * `Ln38` → `f2_36` is the difference, and it is the estimated-tax penalty. The
 * engine does not compute it (no `1040 line 38` rule exists), so mapping it
 * here would create a field filled from nothing — exactly what the guard
 * exists to forbid. It is named in {@link unfedFieldGroups} under
 * `estimatedTaxPenalty` instead, and the gate's cross-check subtracts it by
 * name.
 *
 * ### Two gaps in the `f1_*` numbering that are NOT typos
 *
 * `f1_54` and `f1_64`/`f1_67`/`f1_71`/`f2_07` are skipped because they are
 * write-in boxes, not amount boxes: line 1h's *type*, line 4c/5c's `3`
 * specifier, line 7b's second box and line 16's other-form number. All six
 * are in {@link unfedFieldGroups} under `writeIn`.
 * @type {readonly (readonly [string, string])[]}
 */
export const amountFieldByLine = [
    ['1a',  'topmostSubform[0].Page1[0].f1_47[0]'],
    ['1b',  'topmostSubform[0].Page1[0].f1_48[0]'],
    ['1c',  'topmostSubform[0].Page1[0].f1_49[0]'],
    ['1d',  'topmostSubform[0].Page1[0].f1_50[0]'],
    ['1e',  'topmostSubform[0].Page1[0].f1_51[0]'],
    ['1f',  'topmostSubform[0].Page1[0].f1_52[0]'],
    ['1g',  'topmostSubform[0].Page1[0].f1_53[0]'],
    ['1h',  'topmostSubform[0].Page1[0].f1_55[0]'],
    ['1i',  'topmostSubform[0].Page1[0].f1_56[0]'],
    ['1z',  'topmostSubform[0].Page1[0].f1_57[0]'],
    ['2a',  'topmostSubform[0].Page1[0].f1_58[0]'],
    ['2b',  'topmostSubform[0].Page1[0].f1_59[0]'],
    ['3a',  'topmostSubform[0].Page1[0].f1_60[0]'],
    ['3b',  'topmostSubform[0].Page1[0].f1_61[0]'],
    ['4a',  'topmostSubform[0].Page1[0].f1_62[0]'],
    ['4b',  'topmostSubform[0].Page1[0].f1_63[0]'],
    ['5a',  'topmostSubform[0].Page1[0].f1_65[0]'],
    ['5b',  'topmostSubform[0].Page1[0].f1_66[0]'],
    ['6a',  'topmostSubform[0].Page1[0].f1_68[0]'],
    ['6b',  'topmostSubform[0].Page1[0].f1_69[0]'],
    ['7a',  'topmostSubform[0].Page1[0].f1_70[0]'],
    ['8',   'topmostSubform[0].Page1[0].f1_72[0]'],
    ['9',   'topmostSubform[0].Page1[0].f1_73[0]'],
    ['10',  'topmostSubform[0].Page1[0].f1_74[0]'],
    ['11a', 'topmostSubform[0].Page1[0].f1_75[0]'],
    ['11b', 'topmostSubform[0].Page2[0].f2_01[0]'],
    ['12e', 'topmostSubform[0].Page2[0].f2_02[0]'],
    ['13a', 'topmostSubform[0].Page2[0].f2_03[0]'],
    ['13b', 'topmostSubform[0].Page2[0].f2_04[0]'],
    ['14',  'topmostSubform[0].Page2[0].f2_05[0]'],
    ['15',  'topmostSubform[0].Page2[0].f2_06[0]'],
    ['16',  'topmostSubform[0].Page2[0].f2_08[0]'],
    ['17',  'topmostSubform[0].Page2[0].f2_09[0]'],
    ['18',  'topmostSubform[0].Page2[0].f2_10[0]'],
    ['19',  'topmostSubform[0].Page2[0].f2_11[0]'],
    ['20',  'topmostSubform[0].Page2[0].f2_12[0]'],
    ['21',  'topmostSubform[0].Page2[0].f2_13[0]'],
    ['22',  'topmostSubform[0].Page2[0].f2_14[0]'],
    ['23',  'topmostSubform[0].Page2[0].f2_15[0]'],
    ['24',  'topmostSubform[0].Page2[0].f2_16[0]'],
    ['25a', 'topmostSubform[0].Page2[0].f2_17[0]'],
    ['25b', 'topmostSubform[0].Page2[0].f2_18[0]'],
    ['25c', 'topmostSubform[0].Page2[0].f2_19[0]'],
    ['25d', 'topmostSubform[0].Page2[0].f2_20[0]'],
    ['26',  'topmostSubform[0].Page2[0].f2_21[0]'],
    ['27a', 'topmostSubform[0].Page2[0].f2_23[0]'],
    ['28',  'topmostSubform[0].Page2[0].f2_24[0]'],
    ['29',  'topmostSubform[0].Page2[0].f2_25[0]'],
    ['30',  'topmostSubform[0].Page2[0].f2_26[0]'],
    ['31',  'topmostSubform[0].Page2[0].f2_27[0]'],
    ['32',  'topmostSubform[0].Page2[0].f2_28[0]'],
    ['33',  'topmostSubform[0].Page2[0].f2_29[0]'],
    ['34',  'topmostSubform[0].Page2[0].f2_30[0]'],
    ['35a', 'topmostSubform[0].Page2[0].f2_31[0]'],
    ['36',  'topmostSubform[0].Page2[0].f2_34[0]'],
    ['37',  'topmostSubform[0].Page2[0].f2_35[0]'],
]

/**
 * Hand-typed beside {@link amountFieldByLine}, per AGENTS.md: a table that
 * shrinks by one row is invisible to any check that iterates over the table.
 */
export const amountFieldCount = 56

/**
 * The filing-status box, by the engine's own status name.
 *
 * A `Record` over {@link IndividualFilingStatus} rather than a list of pairs,
 * and that choice is the guard: a sixth status added to `fjs/tax/params`
 * stops the build here at `tsc` instead of quietly producing a return with no
 * status ticked. It is the device `fjs/form1040/core` already uses for line
 * 16's method names, for the same reason.
 *
 * The five names are not in printed order on the page and it is worth saying
 * why, because a reader checking against the paper will notice: the form sets
 * the first three in a left column and the last two in a right one, and the
 * IRS's own read-order subform wraps only the left column — which is why three
 * of these carry a `Checkbox_ReadOrder[0]` parent and two do not.
 * @type {Record<IndividualFilingStatus, string>}
 */
export const filingStatusField = {
    single:                  'topmostSubform[0].Page1[0].Checkbox_ReadOrder[0].c1_8[0]',
    marriedFilingJointly:    'topmostSubform[0].Page1[0].Checkbox_ReadOrder[0].c1_8[1]',
    marriedFilingSeparately: 'topmostSubform[0].Page1[0].Checkbox_ReadOrder[0].c1_8[2]',
    headOfHousehold:         'topmostSubform[0].Page1[0].c1_8[0]',
    qualifyingSurvivingSpouse: 'topmostSubform[0].Page1[0].c1_8[1]',
}

/**
 * A run of fields nothing feeds, under one reason.
 *
 * `text` and `check` are separate lists rather than one list of tagged pairs,
 * so a field's kind is stated by the key it sits under and cannot be typed
 * wrong independently of where it is written.
 * @typedef {{
 *   readonly reason: string,
 *   readonly why: string,
 *   readonly text: readonly string[],
 *   readonly check: readonly string[],
 * }} UnfedGroup
 */

/**
 * The other 138 fields — every one named, none of them a hole.
 *
 * This list is long, and it is long on purpose. The alternative is a rule like
 * "fill the fields we know and ignore the rest", under which a field the IRS
 * adds, renames or moves is indistinguishable from one deliberately left
 * blank. Here the two are different: a field not in this list and not in the
 * two maps above turns {@link checkFieldCoverage} red.
 * @type {readonly UnfedGroup[]}
 */
export const unfedFieldGroups = [
    {
        reason: 'filingPeriod',
        why: 'The fiscal-year boxes beside the masthead. A return this engine '
            + 'computes is a calendar-year return — every dialect carries '
            + '`taxYear` as a year, not a period — so a fiscal filer is out of '
            + 'scope rather than partially supported.',
        text: [
            'topmostSubform[0].Page1[0].f1_01[0]',
            'topmostSubform[0].Page1[0].f1_02[0]',
            'topmostSubform[0].Page1[0].f1_03[0]',
        ],
        check: [],
    },
    {
        reason: 'specialFilingCircumstance',
        why: 'The IRS-use band: section 301.9100-2 relief, combat zone, a '
            + 'deceased taxpayer and their date of death, and three free-text '
            + '"other" lines. Each is a fact about the FILING rather than about '
            + 'the return, and none is an input to any rule the engine runs.',
        text: [
            'topmostSubform[0].Page1[0].f1_04[0]',
            'topmostSubform[0].Page1[0].f1_05[0]',
            'topmostSubform[0].Page1[0].f1_06[0]',
            'topmostSubform[0].Page1[0].f1_07[0]',
            'topmostSubform[0].Page1[0].f1_08[0]',
            'topmostSubform[0].Page1[0].f1_09[0]',
            'topmostSubform[0].Page1[0].f1_10[0]',
            'topmostSubform[0].Page1[0].f1_11[0]',
            'topmostSubform[0].Page1[0].f1_12[0]',
            'topmostSubform[0].Page1[0].f1_13[0]',
        ],
        check: [
            'topmostSubform[0].Page1[0].c1_1[0]',
            'topmostSubform[0].Page1[0].c1_2[0]',
            'topmostSubform[0].Page1[0].c1_3[0]',
            'topmostSubform[0].Page1[0].c1_4[0]',
        ],
    },
    {
        reason: 'identity',
        why: 'Names, social security numbers and the home address, including '
            + 'the foreign-address row. **The largest deliberate gap on this '
            + 'form, and the one a filer will notice first.** The engine holds '
            + 'no identity: it computes `{ value, rule, sources }` from stored '
            + 'documents, and a name copied out of a W-2 box would be the only '
            + 'value on the page that no rule produced and no source cites. '
            + 'Filling it is a phase, not a line.',
        text: [
            'topmostSubform[0].Page1[0].f1_14[0]',
            'topmostSubform[0].Page1[0].f1_15[0]',
            'topmostSubform[0].Page1[0].f1_16[0]',
            'topmostSubform[0].Page1[0].f1_17[0]',
            'topmostSubform[0].Page1[0].f1_18[0]',
            'topmostSubform[0].Page1[0].f1_19[0]',
            'topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_20[0]',
            'topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_21[0]',
            'topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_22[0]',
            'topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_23[0]',
            'topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_24[0]',
            'topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_25[0]',
            'topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_26[0]',
            'topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_27[0]',
        ],
        check: [],
    },
    {
        reason: 'residencyAndCampaignElection',
        why: 'The main-home-in-the-U.S. question and the two Presidential '
            + 'Election Campaign boxes. The campaign boxes change no figure on '
            + 'the return — the form says so itself — and the residency answer '
            + 'is a taxpayer statement no stored document carries.',
        text: [],
        check: [
            'topmostSubform[0].Page1[0].c1_5[0]',
            'topmostSubform[0].Page1[0].c1_6[0]',
            'topmostSubform[0].Page1[0].c1_7[0]',
        ],
    },
    {
        reason: 'filingStatusRider',
        why: 'The three write-ins that hang off a filing status — the MFS '
            + 'spouse\'s name, the HOH/QSS qualifying child\'s name, and the '
            + 'nonresident-alien-spouse election with its name box. The status '
            + 'itself IS ticked, from the return profile; these are the names '
            + 'beside it, which fall under `identity`\'s reason.',
        text: [
            'topmostSubform[0].Page1[0].Checkbox_ReadOrder[0].f1_28[0]',
            'topmostSubform[0].Page1[0].f1_29[0]',
            'topmostSubform[0].Page1[0].f1_30[0]',
        ],
        check: [
            'topmostSubform[0].Page1[0].c1_9[0]',
        ],
    },
    {
        reason: 'digitalAssets',
        why: 'The Yes/No pair under Digital Assets. **Neither is ticked, and '
            + 'leaving both blank is the correct output rather than a shortcut** '
            + '— the answer is a statement by the taxpayer about their year, '
            + 'and guessing `No` because no dialect models a digital asset '
            + 'would put a taxpayer\'s signature under an answer this engine '
            + 'invented.',
        text: [],
        check: [
            'topmostSubform[0].Page1[0].c1_10[0]',
            'topmostSubform[0].Page1[0].c1_10[1]',
        ],
    },
    {
        reason: 'dependents',
        why: 'The four-column dependents grid: the more-than-four overflow '
            + 'box, four names, four surnames, four identifying numbers, four '
            + 'relationships, and the four columns of residency, student, '
            + 'disability and credit ticks. The return profile carries a '
            + 'dependent COUNT and nothing else — the same gap the CSS face '
            + 'names — so there is nothing to write in any of them.',
        text: [
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row1[0].f1_31[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row1[0].f1_32[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row1[0].f1_33[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row1[0].f1_34[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row2[0].f1_35[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row2[0].f1_36[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row2[0].f1_37[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row2[0].f1_38[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row3[0].f1_39[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row3[0].f1_40[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row3[0].f1_41[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row3[0].f1_42[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row4[0].f1_43[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row4[0].f1_44[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row4[0].f1_45[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row4[0].f1_46[0]',
        ],
        check: [
            'topmostSubform[0].Page1[0].Dependents_ReadOrder[0].c1_11[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row5[0].Dependent1[0].c1_12[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row5[0].Dependent1[0].c1_13[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row5[0].Dependent2[0].c1_14[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row5[0].Dependent2[0].c1_15[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row5[0].Dependent3[0].c1_16[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row5[0].Dependent3[0].c1_17[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row5[0].Dependent4[0].c1_18[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row5[0].Dependent4[0].c1_19[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row6[0].Dependent1[0].c1_20[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row6[0].Dependent1[0].c1_21[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row6[0].Dependent2[0].c1_22[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row6[0].Dependent2[0].c1_23[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row6[0].Dependent3[0].c1_24[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row6[0].Dependent3[0].c1_25[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row6[0].Dependent4[0].c1_26[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row6[0].Dependent4[0].c1_27[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row7[0].Dependent1[0].c1_28[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row7[0].Dependent1[0].c1_28[1]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row7[0].Dependent2[0].c1_29[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row7[0].Dependent2[0].c1_29[1]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row7[0].Dependent3[0].c1_30[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row7[0].Dependent3[0].c1_30[1]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row7[0].Dependent4[0].c1_31[0]',
            'topmostSubform[0].Page1[0].Table_Dependents[0].Row7[0].Dependent4[0].c1_31[1]',
        ],
    },
    {
        reason: 'lineElectionBox',
        why: 'The tick boxes the paper sets INSIDE a numbered line\'s caption: '
            + '3c, 4c, 5c, 6c, 6d, 7b, 12a-12d, 16\'s three form numbers, 27b, '
            + '27c, 28\'s opt-out, 35a\'s Form 8888 box, and the MFS/HOH '
            + 'lived-apart box above line 1a. Each records an ELECTION or a '
            + 'circumstance rather than an amount, and the engine\'s line for '
            + 'each of these numbers carries only the amount. The CSS face '
            + 'draws all of them unticked for the same reason.',
        text: [],
        check: [
            'topmostSubform[0].Page1[0].c1_32[0]',
            'topmostSubform[0].Page1[0].c1_33[0]',
            'topmostSubform[0].Page1[0].c1_34[0]',
            'topmostSubform[0].Page1[0].c1_35[0]',
            'topmostSubform[0].Page1[0].c1_36[0]',
            'topmostSubform[0].Page1[0].c1_37[0]',
            'topmostSubform[0].Page1[0].c1_38[0]',
            'topmostSubform[0].Page1[0].c1_39[0]',
            'topmostSubform[0].Page1[0].c1_40[0]',
            'topmostSubform[0].Page1[0].c1_41[0]',
            'topmostSubform[0].Page1[0].c1_42[0]',
            'topmostSubform[0].Page1[0].c1_43[0]',
            'topmostSubform[0].Page1[0].c1_44[0]',
            'topmostSubform[0].Page2[0].c2_1[0]',
            'topmostSubform[0].Page2[0].c2_2[0]',
            'topmostSubform[0].Page2[0].c2_3[0]',
            'topmostSubform[0].Page2[0].c2_4[0]',
            'topmostSubform[0].Page2[0].c2_5[0]',
            'topmostSubform[0].Page2[0].c2_6[0]',
            'topmostSubform[0].Page2[0].c2_7[0]',
            'topmostSubform[0].Page2[0].c2_8[0]',
            'topmostSubform[0].Page2[0].c2_9[0]',
            'topmostSubform[0].Page2[0].c2_10[0]',
            'topmostSubform[0].Page2[0].c2_11[0]',
            'topmostSubform[0].Page2[0].c2_12[0]',
            'topmostSubform[0].Page2[0].c2_13[0]',
            'topmostSubform[0].Page2[0].Line28_ReadOrder[0].c2_14[0]',
            'topmostSubform[0].Page2[0].c2_15[0]',
        ],
    },
    {
        reason: 'writeIn',
        why: 'The six free-text boxes beside an amount: line 1h\'s type, the '
            + '`3` specifier on 4c and 5c, line 7b\'s second box, line 16\'s '
            + 'other-form number, and the former spouse\'s identifying number '
            + 'on line 26. Each names WHAT an amount is; the engine records '
            + 'that in a line\'s `rule` and its `sources`, in a vocabulary that '
            + 'is not the printed form\'s.',
        text: [
            'topmostSubform[0].Page1[0].f1_54[0]',
            'topmostSubform[0].Page1[0].f1_64[0]',
            'topmostSubform[0].Page1[0].f1_67[0]',
            'topmostSubform[0].Page1[0].f1_71[0]',
            'topmostSubform[0].Page2[0].f2_07[0]',
            'topmostSubform[0].Page2[0].SSN_ReadOrder[0].f2_22[0]',
        ],
        check: [],
    },
    {
        reason: 'estimatedTaxPenalty',
        why: 'Line 38. **The one printed line number with an amount box that '
            + 'this table does not fill**, and the reason the XFA cross-check '
            + 'compares 57 bindings against 56 rows. The penalty depends on '
            + 'when each payment was made across the year, which no dialect '
            + 'records; the engine emits no `1040 line 38` rule at all, so '
            + 'mapping it would create the filled-from-nothing case the guard '
            + 'forbids.',
        text: [
            'topmostSubform[0].Page2[0].f2_36[0]',
        ],
        check: [],
    },
    {
        reason: 'directDeposit',
        why: 'Routing number, account number, and the Checking/Savings pair. '
            + 'Bank details are the taxpayer\'s to supply and nothing computes '
            + 'them. Line 35a\'s AMOUNT is filled, from the engine; where it '
            + 'goes is not.',
        text: [
            'topmostSubform[0].Page2[0].RoutingNo[0].f2_32[0]',
            'topmostSubform[0].Page2[0].AccountNo[0].f2_33[0]',
        ],
        check: [
            'topmostSubform[0].Page2[0].c2_16[0]',
            'topmostSubform[0].Page2[0].c2_16[1]',
        ],
    },
    {
        reason: 'thirdPartyDesignee',
        why: 'The Yes/No pair and the designee\'s name, phone and PIN. An '
            + 'authorization the taxpayer grants, not a figure.',
        text: [
            'topmostSubform[0].Page2[0].f2_37[0]',
            'topmostSubform[0].Page2[0].f2_38[0]',
            'topmostSubform[0].Page2[0].f2_39[0]',
        ],
        check: [
            'topmostSubform[0].Page2[0].c2_17[0]',
            'topmostSubform[0].Page2[0].c2_17[1]',
        ],
    },
    {
        reason: 'signature',
        why: 'Occupations, identity-protection PINs, phone and email. The two '
            + 'signature lines themselves are not form fields at all — the IRS '
            + 'leaves them as ink — which is the plainest possible statement '
            + 'that a filled PDF is not a filed return.',
        text: [
            'topmostSubform[0].Page2[0].f2_40[0]',
            'topmostSubform[0].Page2[0].f2_41[0]',
            'topmostSubform[0].Page2[0].f2_42[0]',
            'topmostSubform[0].Page2[0].f2_43[0]',
            'topmostSubform[0].Page2[0].f2_44[0]',
            'topmostSubform[0].Page2[0].f2_45[0]',
        ],
        check: [],
    },
    {
        reason: 'paidPreparer',
        why: 'The preparer block. This software is not a paid preparer and has '
            + 'no PTIN; writing anything here would be a false statement about '
            + 'who prepared the return.',
        text: [
            'topmostSubform[0].Page2[0].f2_46[0]',
            'topmostSubform[0].Page2[0].f2_47[0]',
            'topmostSubform[0].Page2[0].f2_48[0]',
            'topmostSubform[0].Page2[0].f2_49[0]',
            'topmostSubform[0].Page2[0].f2_50[0]',
            'topmostSubform[0].Page2[0].f2_51[0]',
        ],
        check: [
            'topmostSubform[0].Page2[0].c2_18[0]',
        ],
    },
]

/** Hand-typed beside {@link unfedFieldGroups}, for the same reason as
 * {@link amountFieldCount}: a group silently losing a name is otherwise
 * invisible to a loop over the groups.
 */
export const unfedFieldCount = 138

/**
 * What the artifact declares: **199**, hand-typed. 126 text fields and 73
 * checkboxes, measured against `forms/f1040-2025.pdf` on 2026-09-07.
 *
 * `56 + 5 + 138 = 199` is asserted below, and the gate asserts this equals
 * what the PDF says. Both directions, because either alone is a check that
 * cannot fail: the sum alone would survive a name being in two tables, and the
 * PDF comparison alone would survive this file losing a row and the PDF losing
 * the same one.
 */
export const declaredFieldCount = 199

/**
 * Every field this module accounts for, with its kind — the set
 * {@link checkFieldCoverage} compares against the PDF's own declaration.
 *
 * DERIVED from the three tables above, deliberately and with the trap in
 * view: a check that built its expectation from here would be measuring the
 * tables against themselves. It does not — the hand-typed counts above are
 * one independent side, and the artifact is the other.
 * @type {readonly DeclaredField[]}
 */
export const accountedFields = [
    ...amountFieldByLine.map(pair => {
        const [, field] = pair
        return { field, kind: /** @type {FieldKind} */ ('text') }
    }),
    ...Object.values(filingStatusField).map(
        field => ({ field, kind: /** @type {FieldKind} */ ('check') })),
    ...unfedFieldGroups.flatMap(group => [
        ...group.text.map(field => ({ field, kind: /** @type {FieldKind} */ ('text') })),
        ...group.check.map(field => ({ field, kind: /** @type {FieldKind} */ ('check') })),
    ]),
]

// ── Printing an amount the way the column expects it ────────────────────────

/**
 * The engine's printed line number, read off a report line's `rule`.
 *
 * Line 16's rule carries the METHOD that priced it — `1040 line 16 (Tax
 * Computation Worksheet)` — so the trailing parenthetical is stripped rather
 * than matched around. The demo's step 3 learned this the expensive way:
 * matching on equality silently dropped the most interesting row on the page.
 *
 * **This lived in `demo/steps/09-form1040.js` until Phase 35** and now lives
 * here, with the CSS face importing it. One rule, one place: the face and the
 * PDF must agree about which line a rule names, and two copies of that
 * decision would agree right up until one of them was edited.
 * @type {(rule: string) => string}
 */
export const lineNumberOf = rule =>
    rule.replace(/^1040 line /, '').replace(/ \(.*\)$/, '')

/**
 * Inserts thousands separators into a run of digits.
 *
 * The lookahead is the standard non-backtracking form: a position is a
 * separator site when a positive multiple of three digits follows and no
 * digit follows those. Linear in the input, no alternation, no nesting.
 * @type {(digits: string) => string}
 */
const groupThousands = digits => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/**
 * Exact cents as the amount column prints them: `1,234.56`, a leading `-`
 * when negative, no currency sign.
 *
 * **No `$`**, because the printed column has none — the paper prints the
 * dollar sign once in the column head. The cents are always written, even
 * when the return takes the whole-dollar election and they are always `00`,
 * because the box spans the whole ruled cell including the cents sub-column:
 * a right-aligned `15,750.00` puts `15,750` in the dollars area and `00` in
 * the cents area, which is what a filer writing by hand produces.
 *
 * The split is ARITHMETIC — divide and take the remainder — rather than
 * slicing a formatted string at its `.`, for the reason `demo/lib/engine.js`
 * gives about `noUncheckedIndexedAccess`: a `split` result's members are
 * `string | undefined`, and both a cast and a `!` over that are banned.
 * @type {(cents: bigint) => string}
 */
export const formatAmount = cents => {
    const magnitude = cents < 0n ? -cents : cents
    const sign = cents < 0n ? '-' : ''
    const fraction = String(magnitude % 100n).padStart(2, '0')
    return `${sign}${groupThousands(String(magnitude / 100n))}.${fraction}`
}

/**
 * What the paper prints in place of an amount on a line whose caption says
 * `If zero or less, enter -0-`.
 *
 * A hyphen on each side, which is the IRS's own typography and not a
 * decoration: it is how a filer says "I computed this and it came to nothing",
 * as opposed to a blank box, which says "I did not reach this line".
 */
export const zeroDash = '-0-'

/**
 * The two lines whose printed caption instructs `If zero or less, enter -0-`.
 *
 * Hand-typed from the printed page — line 15 (`Subtract line 14 from line 11b.
 * If zero or less, enter -0-. This is your taxable income`) and line 22
 * (`Subtract line 21 from line 18. If zero or less, enter -0-`) — and there
 * are exactly two on the 1040's own face. Every OTHER line that comes to zero
 * is left blank, which is what the paper does and what a preparer expects:
 * a form with `0.00` in fifty boxes is a form nobody reads.
 * @type {readonly string[]}
 */
export const enterZeroDashLines = ['15', '22']

// ── The plan ────────────────────────────────────────────────────────────────

/** A value to type into a text field. @typedef {{ readonly field: string, readonly text: string }} TextFill */

/** A box to tick. @typedef {{ readonly field: string }} CheckFill */

/**
 * A plan, or the reason there is none.
 *
 * The refusing arm carries no fills at all — `text?: undefined` makes that an
 * ASSIGNABILITY question rather than an excess-property one, the device
 * `fjs/form1040/core`'s own `Form1040Outcome` uses so that a partial plan
 * cannot be constructed. A form filled from a plan that knew it was
 * incomplete is precisely the silent hole this phase exists to make
 * impossible.
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly text: readonly TextFill[],
 *   readonly check: readonly CheckFill[],
 * } | {
 *   readonly kind: 'error',
 *   readonly message: string,
 *   readonly text?: undefined,
 *   readonly check?: undefined,
 * }} FillPlan
 */

/** The field holding a printed line's amount, or `undefined` if none does.
 * @type {(number: string) => string | undefined}
 */
const fieldForLine = number => {
    const found = amountFieldByLine.find(pair => {
        const [line] = pair
        return line === number
    })
    if (found === undefined) { return undefined }
    const [, field] = found
    return field
}

/**
 * What goes in a line's box, or `undefined` when the box stays blank.
 * @type {(number: string) => (value: bigint) => string | undefined}
 */
const printedFor = number => value => {
    if (enterZeroDashLines.includes(number)) {
        return value <= 0n ? zeroDash : formatAmount(value)
    }
    return value === 0n ? undefined : formatAmount(value)
}

/**
 * Turns a computed report into the fills that produce the filled PDF —
 * **or refuses, in either direction.**
 *
 * This is the guard the phase is named for, and it is genuinely two-way:
 *
 * - *No engine line lacks a field.* A `ReportLine` whose printed number is
 *   not in {@link amountFieldByLine} refuses. Without this, a line the engine
 *   started producing would simply not appear on the form.
 * - *No field is filled from nothing.* A row of {@link amountFieldByLine}
 *   with no report line behind it refuses. Without this, a line the engine
 *   stopped producing would leave a box that the table still claims is fed —
 *   and the form would be short one figure with nothing to say so.
 *
 * A THIRD refusal covers the case neither direction catches on its own: two
 * report lines claiming the same printed number. Both directions pass (every
 * number has a field, every field has a number) while one of the two values
 * silently overwrites the other in the same box.
 *
 * `lines` is the `ok` arm of `form1040Report`'s outcome, narrowed by the
 * caller — this module deliberately does not import `fjs/form1040/core`,
 * whose transitive weight has no business behind a field map.
 * @type {(filingStatus: IndividualFilingStatus) => (lines: readonly ReportLine[]) => FillPlan}
 */
export const fillPlan = filingStatus => lines => {
    const numbers = lines.map(line => lineNumberOf(line.rule))
    const withoutField = numbers.filter(number => fieldForLine(number) === undefined)
    const withoutLine = amountFieldByLine.flatMap(pair => {
        const [number] = pair
        return numbers.includes(number) ? [] : [number]
    })
    const repeated = numbers.filter((number, at) => numbers.indexOf(number) !== at)
    if (withoutField.length !== 0 || withoutLine.length !== 0 || repeated.length !== 0) {
        return {
            kind: 'error',
            message: 'the engine\'s lines and the PDF\'s amount fields disagree. '
                + `Engine lines with no field: ${withoutField.join(', ') || 'none'}. `
                + `Fields with no engine line: ${withoutLine.join(', ') || 'none'}. `
                + `Printed line numbers claimed twice: ${repeated.join(', ') || 'none'}. `
                + 'No plan is returned, because a form filled from a plan that '
                + 'knew it was incomplete is worse than no form.',
        }
    }
    const text = lines.flatMap(line => {
        const number = lineNumberOf(line.rule)
        const printed = printedFor(number)(line.value)
        const field = fieldForLine(number)
        if (printed === undefined || field === undefined) { return [] }
        return [{ field, text: printed }]
    })
    return { kind: 'ok', text, check: [{ field: filingStatusField[filingStatus] }] }
}

/**
 * Compares this module's accounting against the field set the PDF itself
 * declares — **in both directions, and on kind as well as name.**
 *
 * `declared` comes from the artifact, read by the gate. That is what makes
 * this check worth running: the expectation is not a second copy of the table
 * written by the same hand on the same day, it is 199 names the IRS chose.
 *
 * The three failures it separates, because they mean different things:
 *
 * - **unmapped** — the PDF has a field this file never named. The hole this
 *   phase exists to make detectable. A new revision adding a box lands here.
 * - **phantom** — this file names a field the PDF does not have. A typo, or a
 *   revision that removed a box.
 * - **misTyped** — both agree the field exists and disagree about whether you
 *   type in it or tick it. Left alone, this is a library throw in a viewer.
 * @type {(declared: readonly DeclaredField[]) => { readonly kind: 'ok' } | { readonly kind: 'error', readonly message: string }}
 */
export const checkFieldCoverage = declared => {
    const declaredNames = declared.map(one => one.field)
    const accountedNames = accountedFields.map(one => one.field)
    const unmapped = declaredNames.filter(name => !accountedNames.includes(name))
    const phantom = accountedNames.filter(name => !declaredNames.includes(name))
    const misTyped = declared.flatMap(one => {
        const mine = accountedFields.find(other => other.field === one.field)
        return mine === undefined || mine.kind === one.kind ? [] : [one.field]
    })
    if (unmapped.length === 0 && phantom.length === 0 && misTyped.length === 0
        && declared.length === declaredFieldCount) {
        return { kind: 'ok' }
    }
    return {
        kind: 'error',
        message: `the PDF declares ${declared.length} fields and this map `
            + `expects ${declaredFieldCount}. `
            + `Declared but unmapped: ${unmapped.join(', ') || 'none'}. `
            + `Mapped but not declared: ${phantom.join(', ') || 'none'}. `
            + `Declared with a different kind: ${misTyped.join(', ') || 'none'}.`,
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * A one-source `ReportLine` for the proofs below: a printed line number and
 * its exact cents.
 *
 * Builds only INPUTS. Every expected string in this file's proofs is
 * hand-typed at its assertion, per AGENTS.md — nothing below compares a
 * result against something this helper produced.
 * @type {(number: string) => (valueCents: bigint) => ReportLine}
 */
const testLine = number => valueCents => ({
    value: valueCents,
    sources: [{
        documentHash: 'sha256-1040-pdf-fixture',
        boxPath: 'box1WagesTipsOtherCompensation',
        value: '0.00',
    }],
    rule: `1040 line ${number}`,
})

/** Every printed line number the map claims, in table order — proof-only.
 * @type {readonly string[]}
 */
const mappedNumbers = amountFieldByLine.map(pair => {
    const [number] = pair
    return number
})

/** A complete, refusal-free set of report lines: one per mapped line, all zero
 * except the two named, so a plan can be built without restating 56 rows.
 * @type {(nonZero: readonly (readonly [string, bigint])[]) => readonly ReportLine[]}
 */
const everyLineWith = nonZero => mappedNumbers.map(number => {
    const found = nonZero.find(pair => {
        const [at] = pair
        return at === number
    })
    if (found === undefined) { return testLine(number)(0n) }
    const [, cents] = found
    return testLine(number)(cents)
})

export const proof = {
    // ── The counts, hand-typed, so a table losing a row cannot be silent ──
    theMapHoldsFiftySixPrintedLines: () => {
        assertEq(amountFieldByLine.length, amountFieldCount)
        assertEq(amountFieldCount, 56)
    },
    theUnfedGroupsHoldOneHundredThirtyEightFields: () => {
        const counted = unfedFieldGroups.reduce(
            (running, group) => running + group.text.length + group.check.length, 0)
        assertEq(counted, unfedFieldCount)
        assertEq(unfedFieldCount, 138)
    },
    // The partition is TOTAL and DISJOINT. Total is the sum; disjoint is the
    // distinct-name count, and it is the half that matters — a name written
    // into two groups makes the sum right and the coverage wrong.
    theThreeTablesPartitionAllOneHundredNinetyNineFields: () => {
        assertEq(amountFieldCount + 5 + unfedFieldCount, declaredFieldCount)
        assertEq(declaredFieldCount, 199)
        assertEq(accountedFields.length, 199)
        assertEq(new Set(accountedFields.map(one => one.field)).size, 199)
    },
    // 126 text and 73 checkbox, hand-typed from the artifact. This is the
    // check that would catch an amount row pointed at a checkbox.
    theKindsSplitOneHundredTwentySixTextAndSeventyThreeCheck: () => {
        assertEq(accountedFields.filter(one => one.kind === 'text').length, 126)
        assertEq(accountedFields.filter(one => one.kind === 'check').length, 73)
    },
    // Every mapped field name is a fully qualified AcroForm name on one of the
    // two pages. A leaf name (`f2_08[0]`) would look right and resolve to
    // nothing, because pdf-lib looks up the qualified name.
    everyAccountedNameIsFullyQualifiedOnPageOneOrTwo: () => {
        const wrong = accountedFields.filter(one =>
            !one.field.startsWith('topmostSubform[0].Page1[0].')
            && !one.field.startsWith('topmostSubform[0].Page2[0].'))
        assertEq(wrong.length, 0)
    },
    // Each of the five filing statuses gets its own box. `Record` already
    // makes a MISSING status a compile error; this catches two statuses
    // pointed at the same box, which `Record` cannot see.
    theFiveFilingStatusBoxesAreDistinct: () => {
        const boxes = Object.values(filingStatusField)
        assertEq(boxes.length, 5)
        assertEq(new Set(boxes).size, 5)
    },

    // ── The line number, read off a rule ──────────────────────────────────
    lineNumberOfStripsThePrefixAndTheMethodParenthetical: () => {
        assertEq(lineNumberOf('1040 line 2b'), '2b')
        assertEq(lineNumberOf('1040 line 16 (Tax Computation Worksheet)'), '16')
        assertEq(lineNumberOf('1040 line 11a'), '11a')
    },

    // ── The printed amount ────────────────────────────────────────────────
    // Hand-typed expectations. Note `999.99`: no separator, and the boundary
    // where the next value gains one.
    amountsPrintWithSeparatorsCentsAndNoCurrencySign: () => {
        assertEq(formatAmount(0n), '0.00')
        assertEq(formatAmount(5n), '0.05')
        assertEq(formatAmount(99999n), '999.99')
        assertEq(formatAmount(100000n), '1,000.00')
        assertEq(formatAmount(1575000n), '15,750.00')
        assertEq(formatAmount(123456789n), '1,234,567.89')
    },
    aNegativeAmountPrintsWithALeadingMinusAndNoParentheses: () => {
        assertEq(formatAmount(-300000n), '-3,000.00')
        assertEq(formatAmount(-1n), '-0.01')
    },

    // ── Blank versus -0- ──────────────────────────────────────────────────
    // Four leaves, one per branch of the rule, because the two conditions
    // (which line, and whether it is zero) cross.
    aZeroOnAnOrdinaryLineLeavesTheBoxBlank: () => {
        const plan = fillPlan('single')(everyLineWith([['15', 100n], ['22', 100n]]))
        assert(plan.kind === 'ok')
        const filled = plan.text.map(one => one.field)
        assertEq(filled.includes('topmostSubform[0].Page1[0].f1_47[0]'), false)
        assertEq(filled.length, 2)
    },
    aZeroOnLineFifteenOrTwentyTwoPrintsTheDash: () => {
        const plan = fillPlan('single')(everyLineWith([]))
        assert(plan.kind === 'ok')
        assertEq(plan.text.length, 2)
        const fifteen = plan.text.find(
            one => one.field === 'topmostSubform[0].Page2[0].f2_06[0]')
        const twentyTwo = plan.text.find(
            one => one.field === 'topmostSubform[0].Page2[0].f2_14[0]')
        assertEq(assertNotNullish(fifteen).text, '-0-')
        assertEq(assertNotNullish(twentyTwo).text, '-0-')
    },
    // The control the leaf above needs: a NON-zero 15 must print the amount,
    // or a rule that always printed the dash would pass it.
    aNonZeroLineFifteenPrintsTheAmountAndNotTheDash: () => {
        const plan = fillPlan('single')(everyLineWith([['15', 7047500n]]))
        assert(plan.kind === 'ok')
        const fifteen = plan.text.find(
            one => one.field === 'topmostSubform[0].Page2[0].f2_06[0]')
        assertEq(assertNotNullish(fifteen).text, '70,475.00')
    },
    // A NEGATIVE line 15 is "zero or less" and takes the dash too. The engine
    // floors line 15 at zero, so this can only be reached with a synthetic
    // line — which is exactly why it is worth pinning: the rule the caption
    // states is "zero or less", not "exactly zero".
    aNegativeLineFifteenAlsoPrintsTheDash: () => {
        const plan = fillPlan('single')(everyLineWith([['15', -100n]]))
        assert(plan.kind === 'ok')
        const fifteen = plan.text.find(
            one => one.field === 'topmostSubform[0].Page2[0].f2_06[0]')
        assertEq(assertNotNullish(fifteen).text, '-0-')
    },
    aNegativeAmountOnAnOrdinaryLinePrintsRatherThanBlanking: () => {
        const plan = fillPlan('single')(everyLineWith([['7a', -300000n], ['15', 100n], ['22', 100n]]))
        assert(plan.kind === 'ok')
        const capital = plan.text.find(
            one => one.field === 'topmostSubform[0].Page1[0].f1_70[0]')
        assertEq(assertNotNullish(capital).text, '-3,000.00')
    },

    // ── The plan, and the box each amount lands in ────────────────────────
    // Field names hand-typed at the assertion, so a transposed table row
    // reddens here as well as in the gate.
    aCompleteReportPlacesEachAmountInItsOwnField: () => {
        const plan = fillPlan('single')(everyLineWith([
            ['1a', 8500000n], ['1z', 8500000n], ['2b', 122500n], ['9', 8622500n],
            ['11a', 8622500n], ['11b', 8622500n], ['12e', 1575000n], ['14', 1575000n],
            ['15', 7047500n], ['22', 1075500n],
        ]))
        assert(plan.kind === 'ok')
        /** @type {(name: string) => string} */
        const at = name => assertNotNullish(
            plan.text.find(one => one.field === name), `no fill for ${name}`).text
        assertEq(at('topmostSubform[0].Page1[0].f1_47[0]'), '85,000.00')
        assertEq(at('topmostSubform[0].Page1[0].f1_57[0]'), '85,000.00')
        assertEq(at('topmostSubform[0].Page1[0].f1_59[0]'), '1,225.00')
        assertEq(at('topmostSubform[0].Page1[0].f1_73[0]'), '86,225.00')
        assertEq(at('topmostSubform[0].Page1[0].f1_75[0]'), '86,225.00')
        assertEq(at('topmostSubform[0].Page2[0].f2_01[0]'), '86,225.00')
        assertEq(at('topmostSubform[0].Page2[0].f2_02[0]'), '15,750.00')
        assertEq(at('topmostSubform[0].Page2[0].f2_05[0]'), '15,750.00')
        assertEq(at('topmostSubform[0].Page2[0].f2_06[0]'), '70,475.00')
        assertEq(at('topmostSubform[0].Page2[0].f2_14[0]'), '10,755.00')
        assertEq(plan.text.length, 10)
    },
    theProfilesFilingStatusIsTheOneBoxTicked: () => {
        const single = fillPlan('single')(everyLineWith([['15', 1n], ['22', 1n]]))
        assert(single.kind === 'ok')
        assertEq(single.check.length, 1)
        assertEq(assertNotNullish(single.check[0]).field,
            'topmostSubform[0].Page1[0].Checkbox_ReadOrder[0].c1_8[0]')
        const joint = fillPlan('marriedFilingJointly')(everyLineWith([['15', 1n], ['22', 1n]]))
        assert(joint.kind === 'ok')
        assertEq(assertNotNullish(joint.check[0]).field,
            'topmostSubform[0].Page1[0].Checkbox_ReadOrder[0].c1_8[1]')
    },

    // ── Both directions of the guard, each with its control ───────────────
    aReportLineWithNoFieldRefusesTheWholePlan: () => {
        const plan = fillPlan('single')([...everyLineWith([]), testLine('99z')(100n)])
        assert(plan.kind === 'error')
        assert(plan.message.includes('Engine lines with no field: 99z'))
        assertEq(plan.text, undefined)
    },
    aMappedFieldWithNoReportLineRefusesTheWholePlan: () => {
        const short = everyLineWith([]).filter(line => lineNumberOf(line.rule) !== '2b')
        const plan = fillPlan('single')(short)
        assert(plan.kind === 'error')
        assert(plan.message.includes('Fields with no engine line: 2b'))
        assertEq(plan.check, undefined)
    },
    twoReportLinesClaimingOnePrintedNumberRefuseTheWholePlan: () => {
        const plan = fillPlan('single')([...everyLineWith([]), testLine('2b')(100n)])
        assert(plan.kind === 'error')
        assert(plan.message.includes('Printed line numbers claimed twice: 2b'))
    },
    // The control every gate needs: a guard that refuses everything passes
    // all three leaves above.
    aCompleteReportIsNotRefused: () => {
        const plan = fillPlan('single')(everyLineWith([]))
        assertEq(plan.kind, 'ok')
    },

    // ── The artifact comparison ───────────────────────────────────────────
    // The POSITIVE side of this check is the gate's, against the real PDF's
    // 199 names; feeding `accountedFields` back in here would only show the
    // comparison is reflexive. What these leaves pin is that each of the three
    // failures is DETECTED and NAMED, which is what a red run has to tell you.
    aMatchingDeclarationIsAccepted: () => {
        assertEq(checkFieldCoverage(accountedFields).kind, 'ok')
    },
    aFieldTheMapNeverNamedIsReportedAsUnmapped: () => {
        const declared = [...accountedFields, { field: 'topmostSubform[0].Page2[0].f2_99[0]', kind: /** @type {FieldKind} */ ('text') }]
        const outcome = checkFieldCoverage(declared)
        assert(outcome.kind === 'error')
        assert(outcome.message.includes('Declared but unmapped: topmostSubform[0].Page2[0].f2_99[0]'))
        assert(outcome.message.includes('declares 200 fields'))
    },
    aMappedFieldThePdfDoesNotDeclareIsReportedAsPhantom: () => {
        const declared = accountedFields.filter(
            one => one.field !== 'topmostSubform[0].Page2[0].f2_08[0]')
        const outcome = checkFieldCoverage(declared)
        assert(outcome.kind === 'error')
        assert(outcome.message.includes('Mapped but not declared: topmostSubform[0].Page2[0].f2_08[0]'))
    },
    aFieldDeclaredWithTheOtherKindIsReported: () => {
        const declared = accountedFields.map(one =>
            one.field === 'topmostSubform[0].Page2[0].f2_08[0]'
                ? { field: one.field, kind: /** @type {FieldKind} */ ('check') }
                : one)
        const outcome = checkFieldCoverage(declared)
        assert(outcome.kind === 'error')
        assert(outcome.message.includes('different kind: topmostSubform[0].Page2[0].f2_08[0]'))
    },
    // Name-for-name agreement with a count that disagrees is still a failure:
    // it means a name is declared twice, which the name comparison alone
    // cannot see because both directions are satisfied by the same set.
    aDeclarationRepeatingOneNameIsRefusedOnTheCount: () => {
        const outcome = checkFieldCoverage(
            [...accountedFields, assertNotNullish(accountedFields[0])])
        assert(outcome.kind === 'error')
        assert(outcome.message.includes('declares 200 fields'))
        assert(outcome.message.includes('unmapped: none'))
    },
}
