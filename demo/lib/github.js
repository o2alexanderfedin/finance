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
 * `main` at the moment Phase 10 closed. The build badge's figures — 494 tests,
 * 492 project-local proofs — are a historical fact about THIS commit, which is
 * the only honest way to put a test count in a document that will outlive the
 * count.
 */
export const sha = 'ca9b0bfab98ba9421fb168ab59c3cbe89b2dd4fb'

/** The short form, for display. */
export const shortSha = sha.slice(0, 7)

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
