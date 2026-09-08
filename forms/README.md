# forms

The IRS's own PDFs, byte for byte as they publish them.

Nothing here is authored in this repository and nothing here may be edited. A
file in this directory is evidence: it is the artifact the engine fills, and it
is the authority every field name, every printed line number and every caption
is checked against.

## Why the bytes are committed rather than fetched

`fjs/form1040/pdf/module.f.js` hand-types a table of the 199 field names this
PDF declares, and `form1040-pdf-gate.test.js` checks that table against the
PDF **in both directions** on every `npm test`. A check like that is only worth
running against a *fixed* artifact:

- **A fetch at test time makes the suite depend on the network**, and the
  failure mode is the bad one. A download that 404s, or a proxy that returns an
  HTML error page, would have to be handled — and every way of handling it ends
  in "skip the check", which is a fake pass. AGENTS.md's whole complaint about
  the doubled proof run is that a green result nobody could distinguish from a
  real one survives for months.
- **A fetch at test time makes the suite depend on the IRS not republishing.**
  The file here carries an XMP `MetadataDate` of 2026-01-02 — four months
  after Phase 33 read the printed labels off this form — while the printed
  footer still reads `Cat. No. 11320B · Form 1040 (2025) Created 9/5/25`. So
  the *revision* is the same one Phase 33 checked and the *file* is not: it was
  re-saved and re-published in between. That is the more instructive case, not
  the milder one — a byte-level change nothing on the page announces is exactly
  the change that could move a field name under a mapping table that still
  typechecks. (An earlier draft of this file read the metadata date as a new
  revision. It was not; the rendered footer says so, and it was only found by
  rendering a filled copy and looking at it.)

So the bytes are here, the SHA-256 below is asserted by the gate, and replacing
the file without re-running the mapping check turns the suite red rather than
quiet. 220,237 bytes is a rounding error against `node_modules`, and it buys an
offline, deterministic suite.

## What is here

| file | source | fetched | bytes | SHA-256 |
| --- | --- | --- | --- | --- |
| [f1040-2025.pdf](./f1040-2025.pdf) | `https://www.irs.gov/pub/irs-pdf/f1040.pdf` | 2026-09-07 | 220,237 | `3d31c226df0d189ced80e039d01cf0f8820c1019681a0f0ca6264de277b7e982` |

### What `f1040-2025.pdf` is, measured rather than recalled

Measured on 2026-09-07 with `@cantoo/pdf-lib` against the committed bytes:

- **2 pages, 199 form fields, 199 widgets** — 126 text fields and 73
  checkboxes. Every field carries a name, which is the property the whole
  approach rests on: an unmapped field is a *detectable* hole.
- `dc:title` is `2025 Form 1040`; the printed footer is `Cat. No. 11320B ·
  Form 1040 (2025) Created 9/5/25`; the authoring tool is Adobe Designer 6.5.
- **Filling it and rendering the result was checked by eye, once**, and it is
  worth saying that plainly: the field map is verified mechanically against the
  IRS's own XFA bindings, but nothing mechanical can tell you the amounts land
  in boxes a human reads as the right ones. They do — both pages, every figure
  in its ruled cell, the filing-status tick in the Single box.
- **It is a hybrid AcroForm + XFA document, and `.planning/ROADMAP.md` said
  "no XFA".** That claim was wrong and is corrected there. The AcroForm's own
  dictionary holds an `/XFA` key with an eleven-packet stream set; what the
  document does *not* have is `/NeedsRendering`, so a viewer is not required to
  render the XFA copy, and the AcroForm fields are live. The distinction
  matters twice over:
  - `PDFDocument.load` **drops the XFA by default** and says so on stderr.
    That is the behaviour we want for the artifact — a filled form with no XFA
    packet cannot be rendered two ways — but it also means the XFA is gone
    before you can read it, so the gate's cross-check loads a *second* copy
    with `preserveXFA: true`.
  - The XFA template is the strongest field-name authority that exists. Each
    printed line number is a `<draw>` whose `<traversal><traverse ref="…">`
    names the field beside it (`Ln12e` → `f2_02`), and each field carries an
    accessibility `<speak>` string that is the printed caption. The IRS wrote
    both. The gate reads them and compares them to the hand-typed table.

## Adding another form here

State where it came from, when it was fetched, its byte count and its
SHA-256, and pin the hash in whatever gate consumes it. A form whose bytes can
change without anything noticing is not evidence.
