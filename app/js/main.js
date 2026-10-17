/* מחנכי עיר · מעטפת האפליקציה: ניתוב לפי hash, זיהוי תפקיד (מנהל.ת / משתתף.ת) ושלד העמוד. */
import { store } from './store.js';
import { esc, $ } from './ui.js';
import { LAST_KEY } from './model.js';
import { mountLanding } from './views/landing.js';
import { mountAdmin } from './views/admin.js';
import { mountHome } from './views/home.js';
import { mountSyllabus } from './views/syllabus.js';
import { mountJourney } from './views/journey.js';
import { mountInitiative } from './views/initiative.js';
import { mountPeople } from './views/people.js';
import { mountSettings } from './views/settings.js';
import { mountLibrary } from './views/library.js';

const app = $('#app');
let cleanup = null, bootDone = false, routeId = 0;
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };

export const go = path => { if (location.hash === '#' + path) route(); else location.hash = path; };

/* האם החשבון המחובר מורשה לנהל קבוצות */
async function managerStatus(user) {
  if (!user || user.isAnonymous) return { ok: false };
  if (store.mode === 'local') return { ok: true, sup: true };
  if (!user.emailVerified) return { ok: false, why: 'unverified' };
  if (store.isSuper(user)) return { ok: true, sup: true };
  try { const s = await store.db.doc('managers/' + user.email.toLowerCase()).get(); return { ok: s.exists, sup: false }; }
  catch (e) { return { ok: false }; }
}

function parse() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  const seg = path.split('/').filter(Boolean);
  return { seg, q: new URLSearchParams(qs || '') };
}

function setMain(html) { app.innerHTML = html; return $('#view'); }

function shell(ctx, active) {
  const g = ctx.group, mgr = ctx.isManager;
  const tabs = mgr
    ? [['', 'בית'], ['syllabus', 'סילבוס'], ['library', 'ספריית השראה'], ['initiative', 'הובלת יוזמה'], ['people', 'משתתפים'], ['settings', 'הגדרות']]
    : [['', 'בית'], ['journey', 'מסע התחנות'], ['library', 'ספריית השראה'], ['initiative', 'הובלת יוזמה']];
  return `${store.mode === 'local' ? `<div class="notice deep"><b>מצב בדיקות למפתחים</b><span>הנתונים נשמרים בדפדפן הזה בלבד ולא בענן.</span></div>` : ''}
  <header class="fr top"><a href="#/" aria-label="לדף הבית"><img class="logo" src="../assets/hotam-logo-hebrew.png" alt="חותם"></a>
    <div class="name grow">מחנכי עיר · ${esc(g.name)}<small>${esc(g.city || '')}${mgr ? ' · מנהל.ת קבוצה' : ' · משתתף.ת'}</small></div>
    ${mgr ? `<a class="btn sm" href="#/admin">כל הקבוצות שלי</a>` : ''}
    <span class="chip" title="${store.mode === 'firebase' ? 'הנתונים נשמרים בענן ומשותפים בזמן אמת' : 'הנתונים נשמרים בדפדפן הזה בלבד'}">${store.mode === 'firebase' ? '☁ נשמר בענן' : 'בדיקות מקומי'}</span>
    <span class="chip">${esc(ctx.me.name || 'אני')}</span>
    <button class="btn sm" data-global="signout">יציאה</button></header>
  <nav class="fr tabs" aria-label="ניווט ראשי">${tabs.map(([p, l]) => `<a class="tab ${active === p ? 'on' : ''}" href="#/g/${ctx.gid}${p ? '/' + p : ''}">${l}</a>`).join('')}</nav>
  <main id="view"></main>`;
}

async function route() {
  const my = ++routeId, stale = () => my !== routeId;
  if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
  const { seg, q } = parse();
  const user = store.user;

  /* בלי התחברות: דף כניסה */
  if (!user) { cleanup = mountLanding(setMain('<div id="view"></div>'), { go }); return; }
  const mgr = await managerStatus(user);
  if (stale()) return;

  if (seg[0] === 'admin') {
    if (!mgr.ok) return denied(user, mgr);
    const root = setMain(`<header class="fr top"><a href="#/admin"><img class="logo" src="../assets/hotam-logo-hebrew.png" alt="חותם"></a><div class="name grow">מחנכי עיר · ניהול<small>${esc(user.displayName || user.email || '')}</small></div><button class="btn sm" data-global="signout">יציאה</button></header><main id="view"></main>`);
    cleanup = mountAdmin(root, { user, sup: mgr.sup, go, sub: seg[1] });
    return;
  }

  if (seg[0] === 'g' && seg[1]) {
    const gid = seg[1], sec = seg[2] || '';
    let group;
    try { const s = await store.db.doc('groups/' + gid).get(); group = s.exists ? { id: s.id, ...s.data() } : null; } catch (e) { group = null; }
    if (stale()) return;
    if (!group) {
      lsSet(LAST_KEY, null);
      setMain(`<section class="fr"><h2 class="t">הקבוצה לא נמצאה</h2><p class="lede" style="margin:12px 0 18px">אין לכם גישה לקבוצה הזו, או שהיא לא קיימת.</p><a class="btn pri" href="#/">חזרה לכניסה</a></section>`); return;
    }
    const isManager = mgr.ok && (group.ownerUid === user.uid || mgr.sup || (group.managerEmails || []).includes((user.email || '').toLowerCase()));
    let me = { uid: user.uid, name: user.displayName || user.email || '' };
    if (!isManager) {
      let m; try { m = await store.db.doc(`groups/${gid}/members/${user.uid}`).get(); } catch (e) { m = null; }
      if (stale()) return;
      if (!m || !m.exists) { lsSet(LAST_KEY, null); go('/'); return; }
      me = { uid: user.uid, name: m.data().name, teamId: m.data().teamId || null };
    }
    lsSet(LAST_KEY, isManager ? null : gid);
    const ctx = { gid, group, isManager, user, me, go };
    if (sec === 't' && seg[3]) {   // מרחב עבודה של צוות: מסך מלא בתוך המעטפת
      const root = setMain(shell(ctx, 'initiative'));
      cleanup = mountInitiative(root, ctx, { tid: seg[3], step: q.get('step') || '' });
      return;
    }
    const views = { '': mountHome, journey: mountJourney, s: mountJourney, syllabus: mountSyllabus, initiative: mountInitiative, people: mountPeople, settings: mountSettings, library: mountLibrary };
    const managerOnly = ['syllabus', 'people', 'settings'];
    if (!views[sec] || (managerOnly.includes(sec) && !isManager)) { go('/g/' + gid); return; }
    const root = setMain(shell(ctx, sec === 's' ? 'journey' : sec));
    cleanup = views[sec](root, ctx, { sid: sec === 's' ? seg[3] : null });
    return;
  }

  /* מחוברים אבל בלי יעד: מנהל.ת לרשימת הקבוצות, משתתף.ת לקבוצה האחרונה */
  if (mgr.ok) { go('/admin'); return; }
  const last = lsGet(LAST_KEY);
  if (last) { go('/g/' + last); return; }
  await store.signOut(); if (!stale()) route();
}

function denied(user, mgr) {
  setMain(`<section class="fr"><h2 class="t">החשבון הזה לא מורשה לנהל קבוצות</h2>
    <p class="lede" style="margin:12px 0 18px">${mgr.why === 'unverified' ? 'כתובת המייל לא אומתה.' : `החשבון ${esc(user.email || '')} עוד לא נוסף לרשימת מנהלי הקבוצות.`} אפשר לפנות למי שמנהל.ת את האפליקציה כדי שיוסיפו אתכם.</p>
    <button class="btn pri" data-global="signout">יציאה</button></section>`);
}

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-global="signout"]'); if (!b) return;
  lsSet(LAST_KEY, null); await store.signOut(); go('/');
});
addEventListener('hashchange', () => { if (bootDone) route(); });

(async function boot() {
  try {
    await store.ready;
    await store.authState();
    store.auth.onAuthStateChanged(u => { if (bootDone && !u) route(); });
  } catch (e) {
    app.innerHTML = e.code === 'not-configured'
      ? `<section class="fr"><div class="eyebrow">חותם · מחנכי עיר</div><h2 class="t">האפליקציה עוד לא מחוברת לענן</h2><p class="lede" style="margin:12px 0">כדי שהנתונים יישמרו וישותפו בין כולם, צריך לחבר אותה ל-Firebase. מנהל.ת האפליקציה ממלא.ת את הקונפיגורציה לפי SETUP.md.</p></section>`
      : `<section class="fr"><h2 class="t">לא הצלחנו להתחבר לשרת</h2><p class="lede">${esc(e.message || e)}</p></section>`;
    return;
  }
  bootDone = true; route();
})();
