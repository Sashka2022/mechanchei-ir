/* דף כניסה: שלוש קבוצות הערים בולטות במרכז (כניסה עם מייל, בלי קוד ובלי סיסמה חובה), וכניסת מנהלים באייקון בפינה. */
import { store } from '../store.js';
import { esc } from '../ui.js';
import { LAST_KEY, CITIES, CITY_LOGOS, DEMO_CODE } from '../model.js';
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
      <div><label class="l" for="je">המייל שלכם</label><input class="in" id="je" name="email" type="text" inputmode="email" dir="ltr" autocomplete="email" maxlength="120" placeholder="name@example.com" required></div>
      <div><label class="l" for="jn">איך נקרא לכם? <span class="hint">(בכניסה הראשונה)</span></label><input class="in" id="jn" name="name" autocomplete="name" maxlength="60" placeholder="שם פרטי ושם משפחה"></div>
      <div id="jpwBox" hidden><label class="l" for="jp">סיסמה</label><input class="in" id="jp" name="password" type="password" dir="ltr" autocomplete="current-password" maxlength="100">
        <button class="btn sm" type="button" id="jforgot" style="margin-top:8px">שכחתי סיסמה</button></div>
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
  const je = root.querySelector('#je'), jn = root.querySelector('#jn'), jp = root.querySelector('#jp'), jpwBox = root.querySelector('#jpwBox'), jerr = root.querySelector('#jerr');
  root.querySelectorAll('.ccard').forEach(b => b.addEventListener('click', () => {
    city = b.dataset.city;
    root.querySelector('#joinTitle').textContent = 'קבוצת ' + city;
    root.querySelector('#jimg').src = `assets/cities/${CITY_LOGOS[city]}.webp`;
    jerr.textContent = ''; jpwBox.hidden = true; jp.value = ''; joinDlg.showModal(); je.focus();
  }));
  root.querySelector('#jforgot').addEventListener('click', async () => {
    const em = je.value.trim();
    if (!em.includes('@')) { jerr.textContent = 'כתבו למעלה את המייל, ואז לחצו שוב'; return; }
    try { await store.sendReset(em); jerr.textContent = 'שלחנו מייל לאיפוס הסיסמה. אם הוא לא מגיע, בדקו בספאם או פנו למנהל.ת הקבוצה'; }
    catch (x) { jerr.textContent = 'לא הצלחנו לשלוח מייל. נסו שוב'; }
  });

  root.querySelector('#joinForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.submitter; jerr.textContent = '';
    const email = je.value.trim().toLowerCase(), name = jn.value.trim(), password = jp.value;
    if (email === DEMO_CODE) { try { localStorage.setItem(DEMO_KEY, '1'); } catch (x) {} location.hash = '#/'; location.reload(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { jerr.textContent = 'צריך כתובת מייל תקינה'; return; }
    btn.disabled = true;
    try {
      const { user } = await store.signInParticipant(email, name, password);
      const cg = await store.db.doc('cityGroups/' + city).get();
      if (!cg.exists) { await store.signOut(); jerr.textContent = 'קבוצת העיר עוד לא נפתחה. אפשר לפנות למנהל.ת התוכנית'; btn.disabled = false; return; }
      const gid = cg.data().gid, ref = store.db.doc(`groups/${gid}/members/${user.uid}`);
      if (!(await ref.get()).exists) await ref.set({ name: name || user.displayName || email.split('@')[0], email, city, joinedAt: Date.now() });
      try { localStorage.setItem(LAST_KEY, gid); } catch (x) {}
      go('/g/' + gid);
    } catch (x) {
      const c = x && x.code;
      if (c === 'need-name') { jpwBox.hidden = false; jerr.textContent = 'זו כניסה ראשונה? כתבו גם את השם שלכם. כבר הגדרתם סיסמה? כתבו אותה בשדה הסיסמה.'; jn.focus(); }
      else if (c === 'need-password') { jpwBox.hidden = false; jerr.textContent = 'למייל הזה כבר הוגדרה סיסמה. כתבו אותה כדי להיכנס'; jp.focus(); }
      else if (c === 'wrong-password') { jpwBox.hidden = false; jerr.textContent = 'הסיסמה לא נכונה. אפשר לבקש איפוס במייל'; jp.focus(); }
      else if (c === 'auth/invalid-email') jerr.textContent = 'כתובת המייל לא תקינה';
      else if (c === 'auth/too-many-requests') jerr.textContent = 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות';
      else if (c === 'auth/operation-not-allowed') jerr.textContent = 'הכניסה עם מייל עוד לא הופעלה בפרויקט. פנו למנהל.ת האפליקציה';
      else jerr.textContent = 'לא הצלחנו להיכנס. נסו שוב';
      btn.disabled = false;
    }
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
