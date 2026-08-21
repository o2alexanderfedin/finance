/**
 * The browser's own content store: CAS and Evo over IndexedDB.
 *
 * ## Why this is the store and not a store
 *
 * The server keeps documents in a content-addressed store under `$HOME/.cas`
 * and their history in Evo revisions. A hand-entry page needs the same two
 * things, and the temptation is to keep a plain array of documents in memory
 * and hand it to the engine directly. That would be a **third** assembly of
 * `Form1040Inputs` — the demo steps already have one and
 * `fjs/report/tax_return` has another, and the milestone audit on 2026-08-20
 * recorded that nothing compares those two.
 *
 * So this store is shaped exactly like the server's, and the guest program
 * that reads it is the same program: `taxReturnReport`, the function twin of
 * the bytes an agent stores with `cas_add`. The four operations it asks for —
 * `evoList`, `evoHead`, `evoRevision`, `casRead` — are what
 * {@link snapshotOps} answers, so the browser runs the product path rather
 * than an imitation of it.
 *
 * ## Nothing leaves the machine
 *
 * IndexedDB is the accountant's own browser. A client's W-2 typed into this
 * page is never uploaded, never sent to a model, and never reaches a server we
 * run — there is no request in this file at all. That is a deliberate
 * architectural choice and not an accident of the demo being small: a
 * preparer's disclosure of a client's return information is governed by
 * §7216, and the cheapest way to satisfy it is to have nothing to disclose.
 *
 * ## Why a load-then-run split
 *
 * `interpret` is synchronous — a guest operation returns a `Result`, never a
 * promise — and IndexedDB is asynchronous. So the whole store is read into
 * plain maps first ({@link readAll}) and the guest runs against those. The
 * documents are a household's tax papers; there is no size at which this is
 * the wrong trade.
 *
 * ## Why this file is not a `.f.js`
 *
 * It touches `indexedDB`. Same carve-out as `demo.js` and `form1040.js`: the
 * logic worth proving lives in `fjs/`, and there is none here beyond wiring.
 *
 * @module
 */
import { casAddress, storedText } from './engine.js'
import { encodeText, dialect as revisionDialect } from 'functionalscript/fjs/media/revision/module.f.mjs'

/** @import { Revision } from 'functionalscript/fjs/media/revision/types.d.ts' */

const databaseName = 'finance-demo'
const databaseVersion = 1
const casStore = 'cas'
const revisionStore = 'revisions'

/**
 * A promise around one IndexedDB request. `onsuccess`/`onerror` is the whole
 * API surface this file needs, and wrapping it once keeps every caller below
 * readable as ordinary `await`.
 * @type {<T>(request: IDBRequest<T>) => Promise<T>}
 */
const promised = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
})

/**
 * The database, creating the two object stores on first use. Both are keyed by
 * the caller-supplied hash — content addresses, so no generated key could be
 * anything but a second name for the same thing.
 * @type {() => Promise<IDBDatabase>}
 */
export const openDatabase = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion)
    request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(casStore)) { db.createObjectStore(casStore) }
        if (!db.objectStoreNames.contains(revisionStore)) { db.createObjectStore(revisionStore) }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
})

/** @type {(db: IDBDatabase) => (name: string) => (mode: IDBTransactionMode) => IDBObjectStore} */
const objectStore = db => name => mode => db.transaction(name, mode).objectStore(name)

/**
 * Stores a document's canonical text under its own content address and answers
 * that address. Identical bytes stored twice are one blob, which is what makes
 * a re-entered document the same document.
 * @type {(db: IDBDatabase) => (value: unknown) => Promise<string>}
 */
export const casAdd = db => async value => {
    const text = storedText(value)
    const hash = casAddress(new TextEncoder().encode(text))
    await promised(objectStore(db)(casStore)('readwrite').put(text, hash))
    return hash
}

/**
 * Records a new revision of `subject` pointing at `snapshot`, superseding
 * `parents`. A first entry passes no parents; an amended document passes the
 * subject's current heads, which is what makes the amendment supersede rather
 * than duplicate — the same shape `evo_add` writes on the server.
 * @type {(db: IDBDatabase) => (entry: { readonly subject: string, readonly snapshot: string, readonly parents?: readonly string[] }) => Promise<string>}
 */
export const evoAdd = db => async ({ subject, snapshot, parents }) => {
    const previous = parents ?? []
    /** @type {Revision} */
    const revision = {
        dialect: revisionDialect,
        subject,
        parents: previous,
        snapshot,
        generation: previous.length,
    }
    const text = encodeText(revision)
    const hash = casAddress(new TextEncoder().encode(text))
    await promised(objectStore(db)(revisionStore)('readwrite').put(text, hash))
    return hash
}

/**
 * Everything in the store, as plain maps.
 *
 * Read in one pass because {@link snapshotOps} must answer synchronously, and
 * read in FULL because a partial read is the failure mode that looks like a
 * correct return with a document missing — the one outcome this whole project
 * refuses to produce quietly.
 * @type {(db: IDBDatabase) => Promise<{ readonly blobs: ReadonlyMap<string, string>, readonly revisions: ReadonlyMap<string, Revision> }>}
 */
export const readAll = async db => {
    const [blobKeys, blobValues, revisionKeys, revisionValues] = await Promise.all([
        promised(objectStore(db)(casStore)('readonly').getAllKeys()),
        promised(objectStore(db)(casStore)('readonly').getAll()),
        promised(objectStore(db)(revisionStore)('readonly').getAllKeys()),
        promised(objectStore(db)(revisionStore)('readonly').getAll()),
    ])
    /** @type {Map<string, string>} */
    const blobs = new Map()
    blobKeys.forEach((key, index) => {
        const value = blobValues[index]
        if (typeof key === 'string' && typeof value === 'string') { blobs.set(key, value) }
    })
    /** @type {Map<string, Revision>} */
    const revisions = new Map()
    revisionKeys.forEach((key, index) => {
        const value = revisionValues[index]
        if (typeof key !== 'string' || typeof value !== 'string') { return }
        const parsed = JSON.parse(value)
        revisions.set(key, parsed)
    })
    return { blobs, revisions }
}

/** Removes everything. The only destructive operation, and the page confirms before calling it.
 * @type {(db: IDBDatabase) => Promise<void>}
 */
export const clearAll = async db => {
    await promised(objectStore(db)(casStore)('readwrite').clear())
    await promised(objectStore(db)(revisionStore)('readwrite').clear())
}
