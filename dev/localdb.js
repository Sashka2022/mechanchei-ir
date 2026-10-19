/* מנוע בדיקות למפתחים בלבד (לא חלק מהאפליקציה שעובדת בענן): מחקה את הממשק של Firestore (compat) ושל Firebase Auth מעל localStorage.
   כל הקוד של האפליקציה כתוב מול הממשק הזה, כך שמעבר ל-Firebase אמיתי לא משנה שורת קוד באפליקציה.
   לא מיועד לעבודה אמיתית: הנתונים נשארים בדפדפן הזה בלבד, ואין בו אבטחה. */

const DB_KEY = 'mhi-local-db-v1';
const USERS_KEY = 'mhi-local-users-v1';
const SESSION_KEY = 'mhi-local-session-v1';

const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const clone = o => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
const rid = () => 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function deepAssign(t, s) {
  for (const k in s) {
    if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k])) {
      t[k] = t[k] && typeof t[k] === 'object' && !Array.isArray(t[k]) ? t[k] : {};
      deepAssign(t[k], s[k]);
    } else t[k] = s[k];
  }
  return t;
}

export function createLocalDb() {
  let data = {};            // { 'groups/g1/stations': { id: {...} } }
  const subs = new Map();   // path -> Set(fn)
  const read = () => { try { data = JSON.parse(lsGet(DB_KEY) || '{}') || {}; } catch (e) { data = {}; } };
  const persist = () => lsSet(DB_KEY, JSON.stringify(data));
  read();

  const colSnap = (path, filters = []) => {
    const m = data[path] || {};
    const docs = Object.keys(m)
      .filter(id => filters.every(([f, op, v]) => m[id] && (op === 'array-contains' ? Array.isArray(m[id][f]) && m[id][f].includes(v) : m[id][f] === v)))
      .map(id => docSnap(path, id));
    return { docs, size: docs.length, empty: !docs.length, forEach: fn => docs.forEach(fn) };
  };
  const docSnap = (path, id) => {
    const d = (data[path] || {})[id];
    return { id, exists: d !== undefined, data: () => clone(d), ref: docRef(path, id) };
  };
  const emit = path => (subs.get(path) || new Set()).forEach(fn => fn());
  const listen = (path, fn) => {
    if (!subs.has(path)) subs.set(path, new Set());
    subs.get(path).add(fn);
    setTimeout(fn, 0);
    return () => subs.get(path).delete(fn);
  };
  addEventListener('storage', e => { if (e.key === DB_KEY) { read(); [...subs.keys()].forEach(emit); } });

  function docRef(colPath, id) {
    const path = colPath + '/' + id;
    return {
      id, path,
      collection: name => colRef(path + '/' + name),
      get: async () => docSnap(colPath, id),
      set: async (d, opts) => {
        const m = (data[colPath] = data[colPath] || {});
        if (opts && opts.merge && m[id]) deepAssign(m[id], clone(d)); else m[id] = clone(d);
        persist(); emit(colPath);
      },
      update: async d => {
        const m = data[colPath];
        if (!m || m[id] === undefined) throw Object.assign(new Error('not-found'), { code: 'not-found' });
        deepAssign(m[id], clone(d)); persist(); emit(colPath);
      },
      delete: async () => { if (data[colPath]) delete data[colPath][id]; persist(); emit(colPath); },
      onSnapshot: (fn, err) => listen(colPath, () => fn(docSnap(colPath, id)))
    };
  }
  function colRef(path, filters = []) {
    return {
      path,
      doc: id => docRef(path, id || rid()),
      add: async d => { const r = docRef(path, rid()); await r.set(d); return r; },
      where: (f, op, v) => { if (op !== '==' && op !== 'array-contains') throw new Error('local db: only == and array-contains are supported'); return colRef(path, [...filters, [f, op, v]]); },
      get: async () => colSnap(path, filters),
      onSnapshot: (fn, err) => listen(path, () => fn(colSnap(path, filters)))
    };
  }
  return {
    collection: path => colRef(path),
    doc: path => { const i = path.lastIndexOf('/'); return docRef(path.slice(0, i), path.slice(i + 1)); }
  };
}

export function createLocalAuth() {
  const listeners = new Set();
  const users = () => { try { return JSON.parse(lsGet(USERS_KEY) || '{}'); } catch (e) { return {}; } };
  const saveUsers = u => lsSet(USERS_KEY, JSON.stringify(u));
  const session = () => { try { return JSON.parse(lsGet(SESSION_KEY) || 'null'); } catch (e) { return null; } };
  const emit = s => { lsSet(SESSION_KEY, JSON.stringify(s)); auth.currentUser = toUser(s); listeners.forEach(f => f(auth.currentUser)); return auth.currentUser; };
  const bad = code => Object.assign(new Error(code), { code });
  /* משתתפים עם מייל וסיסמה (כמו Firebase): pw ריק = כל סיסמה מתקבלת (מנהלים, וחשבונות אחרי איפוס) */
  const toUser = s => s ? { uid: s.uid, email: s.email || null, displayName: s.name || null, isAnonymous: !!s.anon, emailVerified: !!s.email && !s.part, participant: !!s.part,
    async updateProfile(p) { const u = users(), e = s.email; if (u[e] && p.displayName) { u[e].name = p.displayName; saveUsers(u); emit({ ...s, name: p.displayName }); } },
    async updatePassword(pw) { const u = users(); if (u[s.email]) { u[s.email].pw = pw; saveUsers(u); } } } : null;
  const auth = {
    currentUser: toUser(session()),
    onAuthStateChanged(fn) { listeners.add(fn); setTimeout(() => fn(auth.currentUser), 0); return () => listeners.delete(fn); },
    async signOut() { lsSet(SESSION_KEY, 'null'); auth.currentUser = null; listeners.forEach(f => f(null)); },
    /* כניסת מנהל/ת בבדיקות: אימייל ושם, בלי סיסמה */
    async devManagerSignIn(email, name) {
      const e = String(email || '').trim().toLowerCase(); if (!e) throw new Error('missing-email');
      const u = users(); if (!u[e]) u[e] = { uid: 'm' + rid(), email: e, name: name || e.split('@')[0] };
      if (name) u[e].name = name; saveUsers(u);
      const s = { uid: u[e].uid, email: e, name: u[e].name };
      lsSet(SESSION_KEY, JSON.stringify(s)); auth.currentUser = toUser(s); listeners.forEach(f => f(auth.currentUser)); return auth.currentUser;
    },
    async signInWithEmailAndPassword(email, pw) {
      const e = String(email).toLowerCase(), u = users()[e];
      if (!u) throw bad('auth/user-not-found');
      if (u.pw && u.pw !== pw) throw bad('auth/wrong-password');
      return { user: emit({ uid: u.uid, email: e, name: u.name, part: !!u.part }) };
    },
    async createUserWithEmailAndPassword(email, pw) {
      const e = String(email).toLowerCase(), u = users();
      if (u[e]) throw bad('auth/email-already-in-use');
      u[e] = { uid: 'p' + rid(), email: e, name: e.split('@')[0], pw, part: true }; saveUsers(u);
      return { user: emit({ uid: u[e].uid, email: e, name: u[e].name, part: true }) };
    },
    async sendPasswordResetEmail(email) { const u = users(), e = String(email).toLowerCase(); if (u[e]) { u[e].pw = null; saveUsers(u); } },
    async signInAnonymously() {
      let s = session();
      if (!s || !s.anon) { s = { uid: 'a' + rid(), anon: true }; lsSet(SESSION_KEY, JSON.stringify(s)); }
      auth.currentUser = toUser(s); listeners.forEach(f => f(auth.currentUser)); return auth.currentUser;
    }
  };
  return auth;
}
