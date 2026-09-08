// @ts-nocheck
//
// Phase 34 harness. NOT part of the engine, not typechecked, not shipped.
//
// The 2025 Tax Rate Schedules and the 2025 Tax Computation Worksheet, HAND-
// TYPED from Publication 17 (2025) -- pages 125 and 123-124 respectively, of
// the revision last modified 2026-01-21 (sha256
// 2d2381d6...0be0840b). Every figure below was read off the printed page.
// Nothing here is computed, and nothing here may be derived from
// `fjs/tax/params`: these constants ARE the independent side of the diff, and
// the moment one of them is copied from the engine the comparison becomes the
// tautology AGENTS.md records this project shipping four times.
//
// Publication 17 is a SECOND printing of figures the engine already cites
// from a FIRST one: `fjs/tax/params` transcribes Rev. Proc. 2024-40 §2.01,
// and `fjs/tax/table` transcribes the Form 1040 instructions' own worksheet
// page. Two documents agreeing is the point -- a transcription error in
// either source would show here.

/**
 * Schedules X, Y-1, Y-2 and Z. `over`/`butNotOver` are the printed band
 * boundaries in whole dollars; `base` is the printed dollars-and-cents
 * constant the schedule adds to; `ratePercent` is the printed percentage.
 * `butNotOver` is `null` on each schedule's last, open-ended row, which the
 * page prints as a dashed rule rather than a number.
 */
export const taxRateSchedules = {
    // Schedule X -- Single
    single: [
        { over: 0, butNotOver: 11925, base: '0.00', ratePercent: 10 },
        { over: 11925, butNotOver: 48475, base: '1192.50', ratePercent: 12 },
        { over: 48475, butNotOver: 103350, base: '5578.50', ratePercent: 22 },
        { over: 103350, butNotOver: 197300, base: '17651.00', ratePercent: 24 },
        { over: 197300, butNotOver: 250525, base: '40199.00', ratePercent: 32 },
        { over: 250525, butNotOver: 626350, base: '57231.00', ratePercent: 35 },
        { over: 626350, butNotOver: null, base: '188769.75', ratePercent: 37 },
    ],
    // Schedule Y-1 -- Married filing jointly or Qualifying surviving spouse.
    // The heading names both statuses, which is the printed page's own answer
    // to the question `taxTableColumnFor.qualifyingSurvivingSpouse` encodes.
    marriedFilingJointly: [
        { over: 0, butNotOver: 23850, base: '0.00', ratePercent: 10 },
        { over: 23850, butNotOver: 96950, base: '2385.00', ratePercent: 12 },
        { over: 96950, butNotOver: 206700, base: '11157.00', ratePercent: 22 },
        { over: 206700, butNotOver: 394600, base: '35302.00', ratePercent: 24 },
        { over: 394600, butNotOver: 501050, base: '80398.00', ratePercent: 32 },
        { over: 501050, butNotOver: 751600, base: '114462.00', ratePercent: 35 },
        { over: 751600, butNotOver: null, base: '202154.50', ratePercent: 37 },
    ],
    // Schedule Y-2 -- Married filing separately
    marriedFilingSeparately: [
        { over: 0, butNotOver: 11925, base: '0.00', ratePercent: 10 },
        { over: 11925, butNotOver: 48475, base: '1192.50', ratePercent: 12 },
        { over: 48475, butNotOver: 103350, base: '5578.50', ratePercent: 22 },
        { over: 103350, butNotOver: 197300, base: '17651.00', ratePercent: 24 },
        { over: 197300, butNotOver: 250525, base: '40199.00', ratePercent: 32 },
        { over: 250525, butNotOver: 375800, base: '57231.00', ratePercent: 35 },
        { over: 375800, butNotOver: null, base: '101077.25', ratePercent: 37 },
    ],
    // Schedule Z -- Head of household
    headOfHousehold: [
        { over: 0, butNotOver: 17000, base: '0.00', ratePercent: 10 },
        { over: 17000, butNotOver: 64850, base: '1700.00', ratePercent: 12 },
        { over: 64850, butNotOver: 103350, base: '7442.00', ratePercent: 22 },
        { over: 103350, butNotOver: 197300, base: '15912.00', ratePercent: 24 },
        { over: 197300, butNotOver: 250500, base: '38460.00', ratePercent: 32 },
        { over: 250500, butNotOver: 626350, base: '55484.00', ratePercent: 35 },
        { over: 626350, butNotOver: null, base: '187031.50', ratePercent: 37 },
    ],
}

/**
 * Sections A-D of the 2025 Tax Computation Worksheet, Publication 17 (2025)
 * pages 123-124. `subtraction` is the printed column (d).
 *
 * The repository already carries these twenty constants in
 * `fjs/tax/table`'s `handTranscribedTaxComputationWorksheetRows`, transcribed
 * from a DIFFERENT document -- the Form 1040 instructions, printed page 80.
 * They are re-transcribed here from Publication 17 on purpose: a second
 * printing is the cheapest available check on the first transcription, and
 * this is the only place the two are compared.
 *
 * Publication 17's own text layer renders Section A's last constant as
 * "$ 42, 979.75". The stray space is an artifact of the PDF's text
 * extraction, not of the page; the figure is forty-two thousand nine hundred
 * seventy-nine dollars and seventy-five cents.
 */
export const taxComputationWorksheet = [
    { status: 'single', atLeast: 100000, butNotOver: 103350, ratePercent: 22, subtraction: '5086.00' },
    { status: 'single', atLeast: 103350, butNotOver: 197300, ratePercent: 24, subtraction: '7153.00' },
    { status: 'single', atLeast: 197300, butNotOver: 250525, ratePercent: 32, subtraction: '22937.00' },
    { status: 'single', atLeast: 250525, butNotOver: 626350, ratePercent: 35, subtraction: '30452.75' },
    { status: 'single', atLeast: 626350, butNotOver: null, ratePercent: 37, subtraction: '42979.75' },
    { status: 'marriedFilingJointly', atLeast: 100000, butNotOver: 206700, ratePercent: 22, subtraction: '10172.00' },
    { status: 'marriedFilingJointly', atLeast: 206700, butNotOver: 394600, ratePercent: 24, subtraction: '14306.00' },
    { status: 'marriedFilingJointly', atLeast: 394600, butNotOver: 501050, ratePercent: 32, subtraction: '45874.00' },
    { status: 'marriedFilingJointly', atLeast: 501050, butNotOver: 751600, ratePercent: 35, subtraction: '60905.50' },
    { status: 'marriedFilingJointly', atLeast: 751600, butNotOver: null, ratePercent: 37, subtraction: '75937.50' },
    { status: 'marriedFilingSeparately', atLeast: 100000, butNotOver: 103350, ratePercent: 22, subtraction: '5086.00' },
    { status: 'marriedFilingSeparately', atLeast: 103350, butNotOver: 197300, ratePercent: 24, subtraction: '7153.00' },
    { status: 'marriedFilingSeparately', atLeast: 197300, butNotOver: 250525, ratePercent: 32, subtraction: '22937.00' },
    { status: 'marriedFilingSeparately', atLeast: 250525, butNotOver: 375800, ratePercent: 35, subtraction: '30452.75' },
    { status: 'marriedFilingSeparately', atLeast: 375800, butNotOver: null, ratePercent: 37, subtraction: '37968.75' },
    { status: 'headOfHousehold', atLeast: 100000, butNotOver: 103350, ratePercent: 22, subtraction: '6825.00' },
    { status: 'headOfHousehold', atLeast: 103350, butNotOver: 197300, ratePercent: 24, subtraction: '8892.00' },
    { status: 'headOfHousehold', atLeast: 197300, butNotOver: 250500, ratePercent: 32, subtraction: '24676.00' },
    { status: 'headOfHousehold', atLeast: 250500, butNotOver: 626350, ratePercent: 35, subtraction: '32191.00' },
    { status: 'headOfHousehold', atLeast: 626350, butNotOver: null, ratePercent: 37, subtraction: '44718.00' },
]

/**
 * Hand-typed counts, read off the printed page rather than off the arrays
 * above. `.length` on a transcription can never fail: a row deleted in an
 * edit takes the diff's coverage with it while every remaining row still
 * passes. Four schedules of seven rows; four worksheet sections of five.
 */
export const expectedCounts = {
    rateScheduleRowsPerSchedule: 7,
    rateSchedules: 4,
    worksheetRows: 20,
}
