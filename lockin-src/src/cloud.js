/* Lock-In cloud: Firebase sign-in plus field-level sync of the ledger.
   Built into lockin/cloud.js by build.mjs. The page loads it with import('./cloud.js'). */
import { initializeApp } from 'firebase/app';
import {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, connectAuthEmulator,
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, signOut as fbSignOut
} from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache,
  doc, collection, writeBatch, onSnapshot, getDocFromServer, getDocsFromServer, deleteField,
  terminate, clearIndexedDbPersistence
} from 'firebase/firestore';
import { toCloud, fromCloud, docOps, mergeDeep, sameCloud, isDel } from './core.js';

export { toCloud, fromCloud };

const BASE_KEY = 'lockin-base';
const OWNER_KEY = 'lockin-owner';
const clone = o => JSON.parse(JSON.stringify(o));
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

function toFirestore(x) {
  if (isDel(x)) return deleteField();
  if (x && typeof x === 'object' && !Array.isArray(x)) { const o = {}; for (const k of Object.keys(x)) o[k] = toFirestore(x[k]); return o; }
  return x;
}

/* Firestore documents: users/{uid}/lockin/meta and users/{uid}/months/{YYYY-MM} */
function firestoreBackend(db, uid) {
  const metaRef = doc(db, 'users', uid, 'lockin', 'meta');
  const monthsCol = collection(db, 'users', uid, 'months');
  return {
    async fetch() {
      const [m, ms] = await Promise.all([getDocFromServer(metaRef), getDocsFromServer(monthsCol)]);
      const months = {}; ms.docs.forEach(d => { months[d.id] = d.data(); });
      return { meta: m.exists() ? m.data() : null, months };
    },
    write(ops) {
      const b = writeBatch(db);
      ops.forEach(o => b.set(o.doc === 'meta' ? metaRef : doc(monthsCol, o.ym), toFirestore(o.data), { merge: true }));
      return b.commit();
    },
    listen(onData, onState, onError) {
      let meta, months, mp = false, sp = false, mc = true, sc = true, seen = false;
      const emit = () => {
        const cached = mc || sc; if (!cached) seen = true;
        // Before the first server answer, a cached view means "still connecting", not "offline".
        onState({ pending: mp || sp, offline: cached && (seen || !navigator.onLine), connecting: cached && !seen && navigator.onLine });
        // Only server-confirmed views replace what's on screen; offline, this device's own copy stays in charge.
        if (meta === undefined || months === undefined || mc || sc) return;
        onData({ meta: meta || {}, months });
      };
      const u1 = onSnapshot(metaRef, { includeMetadataChanges: true }, s => {
        meta = s.exists() ? s.data() : null; mp = s.metadata.hasPendingWrites; mc = s.metadata.fromCache; emit();
      }, onError);
      const u2 = onSnapshot(monthsCol, { includeMetadataChanges: true }, s => {
        const m = {}; s.docs.forEach(d => { m[d.id] = d.data(); });
        months = m; sp = s.metadata.hasPendingWrites; sc = s.metadata.fromCache; emit();
      }, onError);
      return () => { u1(); u2(); };
    }
  };
}

export function init(config, test) {
  test = test || {};
  const app = initializeApp(config);
  const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
  if (test.authEmulator) connectAuthEmulator(auth, test.authEmulator, { disableWarnings: true });
  let db = null;
  const getDb = () => {
    if (db) return db;
    try { db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
    catch (e) { db = initializeFirestore(app, { localCache: memoryLocalCache() }); }
    return db;
  };
  const backendFor = uid => test.dataBackend ? test.dataBackend(uid) : firestoreBackend(getDb(), uid);

  let sync = null;

  /* Starts syncing for a signed-in user.
     app = { getState, setState(st), hasData(), choose(): Promise<'merge'|'account'>, status(s) } */
  async function startSync(user, appApi) {
    stopSync();
    const uid = user.uid;
    const backend = backendFor(uid);
    let base = null;
    const owner = ls.get(OWNER_KEY);
    if (owner === uid) {
      try { base = JSON.parse(ls.get(BASE_KEY) || 'null'); } catch (e) {}
    } else {
      // This device's data isn't linked to this account yet.
      appApi.status({ phase: 'linking' });
      const remote = await backend.fetch();
      const cloudEmpty = !remote.meta || !remote.meta.h;
      const local = toCloud(appApi.getState());
      if (owner && owner !== uid) {
        // Data left by a different account: never mix it in.
        if (cloudEmpty) { appApi.reset(); base = { meta: {}, months: {} }; }
        else { appApi.setState(fromCloud(remote)); base = remote; }
      } else if (cloudEmpty) {
        base = { meta: {}, months: {} };              // upload everything from this device
      } else if (!appApi.hasData()) {
        appApi.setState(fromCloud(remote)); base = remote;
      } else {
        const pick = await appApi.choose();
        if (pick === 'merge') { appApi.setState(fromCloud(mergeDeep(remote, local))); }
        else { appApi.setState(fromCloud(remote)); }
        base = remote;
      }
      ls.set(OWNER_KEY, uid);
    }
    const s = { uid, backend, base: base || { meta: {}, months: {} }, stop: null, lastState: { pending: false, offline: !navigator.onLine } };
    sync = s;
    const saveBase = () => ls.set(BASE_KEY, JSON.stringify(s.base));
    s.push = () => {
      if (sync !== s) return;
      const cur = toCloud(appApi.getState());
      const ops = docOps(s.base, cur);
      if (!ops.length) return;
      s.base = cur; saveBase();
      appApi.status({ phase: 'live', pending: true, offline: s.lastState.offline });
      Promise.resolve(backend.write(ops)).catch(err => appApi.status({ phase: 'error', error: err }));
    };
    s.push();   // changes made on this device while sync wasn't running
    s.stop = backend.listen(remote => {
      if (sync !== s) return;
      const r = clone(remote);
      s.base = r; saveBase();
      const st = fromCloud(r);
      if (!sameCloud(toCloud(st), toCloud(appApi.getState()))) appApi.setState(st, true);
      s.push();   // tidy up anything the merge left behind (renumbered order, stale bin entries)
    }, state => {
      if (sync !== s) return;
      s.lastState = state; appApi.status(Object.assign({ phase: 'live' }, state));
    }, err => { if (sync === s) appApi.status({ phase: 'error', error: err }); });
    saveBase();
  }

  function stopSync() { if (sync && sync.stop) sync.stop(); sync = null; }

  return {
    onUser(cb) { return onAuthStateChanged(auth, cb); },
    currentUser: () => auth.currentUser,
    signUp: (e, p) => createUserWithEmailAndPassword(auth, e, p),
    signIn: (e, p) => signInWithEmailAndPassword(auth, e, p),
    reset: e => sendPasswordResetEmail(auth, e),
    startSync,
    push() { if (sync) sync.push(); },
    async signOut() {
      stopSync();
      await fbSignOut(auth);
      ls.del(BASE_KEY); ls.del(OWNER_KEY);
      if (db) { try { await terminate(db); await clearIndexedDbPersistence(db); } catch (e) {} }
    }
  };
}
