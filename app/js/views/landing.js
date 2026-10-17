/* דף כניסה: שלוש קבוצות הערים בולטות במרכז (כניסה בקוד קבוצה ושם), וכניסת מנהלים באייקון בפינה. */
import { store } from '../store.js';
import { esc } from '../ui.js';
import { normCode, LAST_KEY, CITIES, CITY_LOGOS, DEMO_CODE } from '../model.js';
import { DEMO_KEY } from '../demo.js';

const ADMIN_ICON = `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8.2-7 9.5C8 19.2 5 15.5 5 11V6l7-3z"/><circle cx="12" cy="10" r="2.4"/><path d="M8 16c.8-2 2.4-3 4-3s3.2 1 4 3"/></svg>`;

export function mountLanding(root, { go }) {
  const local = store.mode === 'local';
  root.innerHTML = `
  <header class="fr top land-top"><img class="logo" src="../assets/hotam-logo-hebrew.png" alt="חותם · אחריות לחינוך בישראל">
    <div class="name grow">מחנכי עיר</div>
    <button class="adminbtn" type="button" id="adminOpen" aria-label="כניסת מנהלים" title="כניסת מנהלים">${ADMIN_ICON}<span>מנהלים</span></button></header>
  <section class="fr blue banner"><div class="bn-copy"><div class="bn-eye">חותם · מחנכי עיר</div>
      <h1 class="bn-t"><span class="a">מסע בעיר,</span><span class="b">יוזמה בידיים</span></h1>
      <p class="bn-lede">לומדים לעומק עיר אחת, ומובילים בה יוזמה מהרעיון ועד הפעולה. בוחרים את הקבוצה שלכם למטה.</p></div>
    <div class="bn-dot" aria-hidden="true">מרעיון<br>לפעולה</div></section>
  <section class="cgrid" aria-label="קבוצות הערים">${CITIES.map(c => `<button type="button" class="ccard" data-city="${esc(c)}">
      <span class="clogo"><img src="assets/cities/${CITY_LOGOS[c]}.webp" alt="" loading="eager"></span>
      <span class="cname">קבוצת ${esc(c)}</span><span class="cgo">כניסה לקבוצה</span></button>`).join('')}</section>

  <dialog class="dlg join" id="joinDlg" aria-labelledby="joinTitle">
    <form id="joinForm" class="stack" style="gap:14px">
      <div class="jhead"><span class="jlogo"><img id="jimg" alt=""></span><div><div class="hint" style="font-weight:700">כניסה לקבוצה</div><h2 id="joinTitle" class="s" style="font-size:28px;font-weight:900;line-height:1.1"></h2></div></div>
      <div><label class="l" for="jc">קוד הקבוצה</label><input class="in code" id="jc" name="code" autocomplete="off" maxlength="9" placeholder="ABC-123" required></div>
      <div><label class="l" for="jn">איך נקרא לכם?</label><input class="in" id="jn" name="name" autocomplete="name" maxlength="60" placeholder="שם פרטי ושם משפחה"></div>
      <div class="hint" id="jerr" role="alert" style="min-height:22px"></div>
      <div class="row"><button class="btn pri" type="submit">כניסה</button><button class="btn" type="button" data-close>ביטול</button></div>
    </form></dialog>

  <dialog class="dlg admin" id="adminDlg" aria-labelledby="adminTitle">
    <form id="mgrForm" class="stack" style="gap:14px">
      <div class="jhead"><span class="jlogo adm">${ADMIN_ICON}</span><div><div class="hint" style="font-weight:700">אזור מנהלים</div><h2 id="adminTitle" class="s" style="font-size:28px;font-weight:900;line-height:1.1">כניסת מנהלי קבוצות</h2></div></div>
      <p class="hint">${local ? 'מצב בדיקות למפתחים: אפשר להיכנס עם כל מייל.' : 'כניסה עם חשבון Google של הארגון. החשבון צריך להיות מורשה מראש.'}</p>
      ${local ? `<div><label class="l" for="me">מייל</label><input class="in" id="me" name="email" type="email" placeholder="name@tfi.org.il" required></div>
      <div><label class="l" for="mn">שם</label><input class="in" id="mn" name="name" placeholder="השם שיוצג למשתתפים"></div>` : ''}
      <div class="hint" id="merr" role="alert" style="min-height:22px"></div>
      <div class="row"><button class="btn pri" type="submit">${local ? 'כניסה לבדיקות' : 'כניסה עם Google'}</button><button class="btn" type="button" data-close>ביטול</button></div>
    </form></dialog>`;

  const joinDlg = root.querySelector('#joinDlg'), adminDlg = root.querySelector('#adminDlg');
  root.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  [joinDlg, adminDlg].forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
  root.querySelector('#adminOpen').addEventListener('click', () => { root.querySelector('#merr').textContent = ''; adminDlg.showModal(); });

  let city = '';
  const jc = root.querySelector('#jc'), jerr = root.querySelector('#jerr');
  root.querySelectorAll('.ccard').forEach(b => b.addEventListener('click', () => {
    city = b.dataset.city;
    root.querySelector('#joinTitle').textContent = 'קבוצת ' + city;
    root.querySelector('#jimg').src = `assets/cities/${CITY_LOGOS[city]}.webp`;
    jerr.textContent = ''; joinDlg.showModal(); jc.focus();
  }));
  jc.addEventListener('input', () => { const c = normCode(jc.value).slice(0, 6); jc.value = c && DEMO_CODE.startsWith(c) ? c : c.length > 3 ? c.slice(0, 3) + '-' + c.slice(3) : c; });

  root.querySelector('#joinForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.submitter; jerr.textContent = '';
    const code = normCode(jc.value), name = root.querySelector('#jn').value.trim();
    if (code === DEMO_CODE) { try { localStorage.setItem(DEMO_KEY, '1'); } catch (x) {} location.hash = '#/'; location.reload(); return; }
    if (code.length !== 6 || !name) { jerr.textContent = 'צריך קוד בן 6 תווים ושם'; return; }
    btn.disabled = true;
    try {
      const u = await store.signInParticipant();
      const c = await store.db.doc('joinCodes/' + code).get();
      if (!c.exists) { jerr.textContent = 'הקוד לא נמצא. בדקו שוב מול מנהל.ת הקבוצה'; btn.disabled = false; return; }
      if (c.data().city && c.data().city !== city) { jerr.textContent = 'הקוד הזה שייך לקבוצה של עיר אחרת'; btn.disabled = false; return; }
      const gid = c.data().gid, ref = store.db.doc(`groups/${gid}/members/${u.uid}`);
      await ref.set({ name, code, joinedAt: Date.now() }, { merge: true });
      try { localStorage.setItem(LAST_KEY, gid); } catch (x) {}
      go('/g/' + gid);
    } catch (x) { jerr.textContent = 'לא הצלחנו להיכנס. נסו שוב'; btn.disabled = false; }
  });

  root.querySelector('#mgrForm').addEventListener('submit', async e => {
    e.preventDefault();
    const err = root.querySelector('#merr'), btn = e.submitter; err.textContent = ''; btn.disabled = true;
    try {
      const f = new FormData(e.target);
      await store.signInManager(f.get('email'), f.get('name'));
      go('/admin');
    } catch (x) {
      err.textContent = x && x.code === 'auth/popup-closed-by-user' ? '' : 'הכניסה נכשלה. נסו שוב'; btn.disabled = false;
    }
  });
  return () => { [joinDlg, adminDlg].forEach(d => { try { d.close(); } catch (e) {} }); };
}
