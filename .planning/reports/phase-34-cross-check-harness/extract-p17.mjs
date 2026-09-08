// @ts-nocheck
//
// Phase 34 harness. NOT part of the engine and NOT typechecked, for the same
// reason the root-level gate suites are not: it reads the filesystem, which
// needs `@types/node`, and AGENTS.md forbids adding a dependency for it.
//
// Rebuilds `p17-tax-table.json` from the printed page, so the vendored copy
// is auditable rather than asserted. Takes the text layer of Publication 17
// (2025) and emits every row of the printed 2025 Tax Table as
// `[atLeast, lessThan, single, marriedFilingJointly, marriedFilingSeparately,
// headOfHousehold]`, in whole dollars exactly as the page prints them.
//
//   curl -o p17.pdf https://www.irs.gov/pub/irs-pdf/p17.pdf
//   pdftotext -layout p17.pdf p17.txt
//   node extract-p17.mjs p17.txt > p17-tax-table.json
//
// SCRATCH ONLY. Nothing in `fjs/` reads it, no proof covers it, it adds no
// dependency. `pdftotext` is invoked by hand at the shell, never from here:
// a harness that shells out to a binary would be a dependency in all but
// name.
import { readFileSync } from 'node:fs'

// The printed table is laid out three column-groups to a page, so one text
// line carries up to three rows of six numbers. Anchoring on "not preceded
// or followed by a digit or comma" is what stops a group's last figure and
// the next group's first from being read as one number.
const NUM = String.raw`\d{1,3}(?:,\d{3})*`
const ROW = new RegExp(`(?<![\\d,])(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})(?![\\d,])`, 'g')

// The first two rows ($0-$5 and $5-$15) are stacked VERTICALLY on the page
// rather than laid out across, so no single text line carries their six
// numbers and the pattern above cannot see them. They are read off the
// printed page instead -- Publication 17 (2025), page 111, the table's first
// two rows, whose four "Your tax is" columns print 0 and 1 respectively.
const stackedFirstRows = [
    [0, 5, 0, 0, 0, 0],
    [5, 15, 1, 1, 1, 1],
]

const text = readFileSync(process.argv[2], 'utf8')

const byAtLeast = new Map()
const conflicts = []
for (const line of text.split('\n')) {
    for (const m of line.matchAll(ROW)) {
        const [atLeast, lessThan, single, mfj, mfs, hoh] =
            m.slice(1).map(x => Number(x.replace(/,/g, '')))
        // A Tax Table band is never wider than $50 and never empty. Anything
        // else on a page of running prose is not a row.
        if (lessThan <= atLeast || lessThan - atLeast > 50) { continue }
        const row = [atLeast, lessThan, single, mfj, mfs, hoh]
        const seen = byAtLeast.get(atLeast)
        if (seen === undefined) { byAtLeast.set(atLeast, row) } else if (String(seen) !== String(row)) {
            conflicts.push([seen, row])
        }
    }
}

const rows = [...stackedFirstRows, ...[...byAtLeast.keys()].sort((a, b) => a - b).map(k => byAtLeast.get(k))]

// Two structural checks on the extraction itself, because a silently dropped
// row would shrink the diff's coverage without failing anything: the table
// must run from $0 to the $100,000 boundary with every row's "But less than"
// equal to the next row's "At least", and no line may have yielded two
// different readings of the same row.
if (conflicts.length !== 0) { throw new Error('conflicting readings: ' + JSON.stringify(conflicts.slice(0, 4))) }
for (let i = 0; i < rows.length - 1; i += 1) {
    if (rows[i][1] !== rows[i + 1][0]) {
        throw new Error('gap after ' + JSON.stringify(rows[i]) + ' before ' + JSON.stringify(rows[i + 1]))
    }
}
if (rows[0][0] !== 0) { throw new Error('table does not start at $0') }
if (rows[rows.length - 1][1] !== 100000) { throw new Error('table does not end at $100,000') }

process.stdout.write('[\n' + rows.map(r => JSON.stringify(r)).join(',\n') + '\n]\n')
