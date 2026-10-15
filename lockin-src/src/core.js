/* Lock-In sync core: converts app state to the cloud shape, diffs and merges.
   Cloud shape (one object, split into Firestore documents by the backend):
     meta:   { v:1, h:{ [habitId]:{ n:name, g:goal, o:order, s:{ [subId]:{ n, o } } } }, t:{ [trashId]: JSON } }
     months: { 'YYYY-MM': { d:{ [rowId]:{ [day]:true } } } }
   Every tick, name and bin entry is its own field, so edits from two devices merge field by field. */

export const DEL = Object.freeze({ __del: 1 });
export const isDel = x => !!x && typeof x === 'object' && x.__del === 1;
const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x) && !isDel(x);

export function toCloud(state) {
  const meta = { v: 1, h: {}, t: {} };
  (state.habits || []).forEach((h, i) => {
    const s = {};
    (h.subs || []).forEach((x, j) => { s[x.id] = { n: String(x.name), o: j }; });
    meta.h[h.id] = { n: String(h.name), g: +h.goal || 0, o: i, s };
  });
  (state.trash || []).forEach(t => { if (t && t.tid) meta.t[t.tid] = JSON.stringify(t); });
  const months = {};
  Object.entries(state.months || {}).forEach(([ym, m]) => {
    const d = {};
    Object.entries(m || {}).forEach(([id, days]) => {
      const set = {};
      (days || []).forEach(n => { n = +n; if (n >= 1 && n <= 31) set[n] = true; });
      if (Object.keys(set).length) d[id] = set;
    });
    if (Object.keys(d).length) months[ym] = { d };
  });
  return { meta, months };
}

const byOrder = (a, b) => ((a[1].o ?? 1e9) - (b[1].o ?? 1e9)) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);

export function fromCloud(c) {
  const meta = (c && c.meta) || {};
  const habits = Object.entries(meta.h || {})
    .filter(([, v]) => isObj(v) && typeof v.n === 'string')
    .sort(byOrder)
    .map(([id, v]) => ({
      id, name: v.n, goal: +v.g || 0,
      subs: Object.entries(v.s || {}).filter(([, x]) => isObj(x) && typeof x.n === 'string').sort(byOrder).map(([sid, x]) => ({ id: sid, name: x.n }))
    }));
  const live = new Set();
  habits.forEach(h => { live.add(h.id); h.subs.forEach(s => live.add(s.id)); });
  const trash = Object.values(meta.t || {})
    .map(j => { try { return JSON.parse(j); } catch (e) { return null; } })
    .filter(t => t && t.tid && t.item && t.item.id && !live.has(t.item.id))
    .sort((a, b) => String(b.removedAt || '').localeCompare(String(a.removedAt || '')));
  const months = {};
  Object.entries((c && c.months) || {}).forEach(([ym, doc]) => {
    const m = {};
    Object.entries((doc && doc.d) || {}).forEach(([id, days]) => {
      if (!isObj(days)) return;
      const arr = Object.keys(days).filter(k => days[k] === true).map(Number).filter(n => n >= 1 && n <= 31).sort((a, b) => a - b);
      if (arr.length) m[id] = arr;
    });
    if (Object.keys(m).length) months[ym] = m;
  });
  return { habits, months, trash };
}

/* Patch that turns a into b. Removed keys become DEL; null when equal. */
export function diff(a, b) {
  a = a || {}; b = b || {};
  const p = {}; let any = false;
  for (const k of Object.keys(a)) if (!(k in b)) { p[k] = DEL; any = true; }
  for (const k of Object.keys(b)) {
    const av = a[k], bv = b[k];
    if (isObj(av) && isObj(bv)) { const s = diff(av, bv); if (s) { p[k] = s; any = true; } }
    else if (!(k in a) || av !== bv) { p[k] = bv; any = true; }
  }
  return any ? p : null;
}

/* Apply a patch in place, the way Firestore's set-with-merge does. */
export function applyPatch(target, patch) {
  for (const k of Object.keys(patch)) {
    const v = patch[k];
    if (isDel(v)) delete target[k];
    else if (isObj(v)) { if (!isObj(target[k])) target[k] = {}; applyPatch(target[k], v); }
    else target[k] = v;
  }
  return target;
}

/* Union of two cloud objects; b wins where both set the same field. */
export function mergeDeep(a, b) {
  const out = JSON.parse(JSON.stringify(a || {}));
  return applyPatch(out, JSON.parse(JSON.stringify(b || {})));
}

/* Writes needed to move the cloud from `base` to `cur`, one entry per document. */
export function docOps(base, cur) {
  base = base || { meta: {}, months: {} };
  const ops = [];
  const mp = diff(base.meta || {}, cur.meta);
  if (mp) ops.push({ doc: 'meta', data: mp });
  const bm = base.months || {}, cm = cur.months || {};
  new Set([...Object.keys(bm), ...Object.keys(cm)]).forEach(ym => {
    if (!cm[ym]) { if (bm[ym] && bm[ym].d && Object.keys(bm[ym].d).length) ops.push({ doc: 'month', ym, data: { d: DEL } }); return; }
    const p = diff(bm[ym] || {}, cm[ym]);
    if (p) ops.push({ doc: 'month', ym, data: p });
  });
  return ops;
}

export const sameCloud = (a, b) => !diff(a, b) && !diff(b, a);
