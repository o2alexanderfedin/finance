/**
 * SHA-pinned links into the repository on GitHub.
 *
 * Every figure this demo puts on screen is one click from the code that
 * produced it and the proof that tests it. That promise is only worth
 * anything if the links keep resolving, so they are pinned to a COMMIT SHA
 * and never to a branch name: GitHub serves a commit-pinned blob permanently
 * whether or not the branch still exists, while `blob/main/...` rots the next
 * time anyone pushes.
 *
 * @module
 */
import { el, anchor } from './dom.js'

/**
 * The commit tagged {@link release}.
 *
 * **Links are built from the SHA; the badge displays the tag.** A tag is more
 * meaningful to a reader, but a tag can be force-moved and a commit cannot, so
 * what actually goes in an href is the immutable half.
 *
 * Nothing at runtime can check that this SHA is still what `v0.12.0` points
 * at — the page has no network access to ask. That check belongs to the
 * pre-demo procedure in `demo/todo/showcase-demo.md`, which resolves every
 * generated href at this exact SHA, and it is the reason the SHA rather than
 * the tag is what gets resolved.
 */
export const sha = 'cfc4a121c52182e43f1dd9633baac1a42212a15e'

/** The release this demo shows. Displayed wherever a version is named. */
export const release = 'v0.12.0'

/** The short form, for display next to the tag. */
export const shortSha = sha.slice(0, 7)

/**
 * Project-local proofs at {@link sha} — the proofs living in this repository's
 * own modules, counted with `node --test | grep -c '^✔ import("./fjs/'`.
 *
 * **Deliberately not `npm test`'s total.** That number includes the vendored
 * `functionalscript` proofs and therefore depends on whether that dependency
 * happens to be present: this same commit reports 629 project-local proofs and
 * 2867 total in a checkout that has it, both correct and neither comparable.
 * The project-local count is the only figure that means the same thing in
 * every checkout, so it is the only one on the badge.
 */
export const proofCount = 629

const repo = 'https://github.com/fjs-dev/finance'

/**
 * A link to a repository file, optionally at a line.
 * @type {(path: string, line?: number) => string}
 */
export const sourceUrl = (path, line) =>
    `${repo}/blob/${sha}/${path}${line === undefined ? '' : `#L${line}`}`

/**
 * A link to a module's `proof` export — the same file, anchored at the line
 * the proof object starts on. There is no separate test file to link to:
 * every `.f.js` module carries its own proofs, which is the property that
 * makes "source" and "proof" one click apart in the first place.
 * @type {(path: string, proofLine?: number) => string}
 */
export const proofUrl = (path, proofLine) => sourceUrl(path, proofLine)

/**
 * A link to a planning artifact, e.g. a phase verification report.
 * @type {(name: string) => string}
 */
export const planningUrl = name =>
    sourceUrl(`.planning/phases/10-form-1040-core-line-16-dispatch-and-the-scope-guard/${name}`)

/**
 * The GitHub release page for {@link release}.
 *
 * This is what the build badge points at, rather than a phase verification
 * report. The release notes carry "What is NOT here" beside what is — the
 * production caller that does not exist, the Schedule D branch that refuses,
 * the unmodeled document types — which is the right thing to hand someone who
 * clicks a badge on a page making claims.
 */
export const releaseUrl = `${repo}/releases/tag/${release}`

/**
 * One entry in a step's source footer. A missing `proofLine` omits the proof
 * link rather than emitting a guessed anchor — a link that lands in the wrong
 * place is worse than no link at all.
 * @typedef {{
 *   readonly label: string,
 *   readonly path: string,
 *   readonly line?: number,
 *   readonly proofLine?: number,
 * }} SourceLink
 */

/**
 * Renders the `source ↗` / `proof ↗` footer every step carries.
 * @type {(links: readonly SourceLink[]) => HTMLElement}
 */
export const sourceFooter = links => {
    const footer = el('footer', { class: 'sources' })
    footer.append(el('h4', { text: 'Source' }))
    const list = el('ul')
    for (const link of links) {
        const item = el('li')
        item.append(el('span', { class: 'source-label', text: link.label }))
        item.append(anchor(sourceUrl(link.path, link.line), 'source ↗'))
        if (link.proofLine !== undefined) {
            item.append(anchor(proofUrl(link.path, link.proofLine), 'proof ↗'))
        }
        list.append(item)
    }
    footer.append(list)
    return footer
}
