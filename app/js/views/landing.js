/* דף כניסה: מנהל.ת קבוצה (חשבון) או משתתף.ת (קוד קבוצה ושם). */
import { store } from '../store.js';
import { esc, toast } from '../ui.js';
import { normCode, LAST_KEY, CITIES } from '../model.js';

export function mountLanding(root, { go }) {
  const local = store.mode === 'local';
  root.innerHTML = `
  <section class="hero"><div class="fr blue copy">
    <div class="hint" style="font-weight:700;opacity:1">חותם · אחריות לחינוך בישראל</div>
    <h1 class="h-xl"><span class="a">מחנכי עיר</span><span class="b">מסע בעיר, יוזמה בידיים</span></h1>
    <p class="lede" style="max-width:520px">לומדים את העיר לעומק, ומגדירים יחד יוזמה אחת שאפשר להוביל.</p></div></section>
  <div class="grid2">
    <section class="fr"><h3 class="s">אני משתתף.ת</h3><p class="hint" style="margin:4px 0 14px">בוחרים את הקבוצה של העיר, ומזינים את הקוד שקיבלתם ממנהל.ת הקבוצה.</p>
      <div class="cities" role="radiogroup" aria-label="בחירת קבוצה">${CITIES.map(c => `<button type="button" class="city" role="radio" aria-checked="false" data-city="${c}"><span class="cdot">${c[0]}</span><b>${c}</b></button>`).join('')}</div>
      <form id="joinForm" class="stack" style="gap:12px;margin-top:16px">
        <div><label class="l" for="jc">קוד הקבוצה</label><input class="in code" id="jc" name="code" autocomplete="off" maxlength="9" placeholder="ABC-123" required></div>
        <div><label class="l" for="jn">איך נקרא לכם?</label><input class="in" id="jn" name="name" autocomplete="name" maxlength="60" placeholder="שם פרטי ושם משפחה" required></div>
        <div class="row"><button class="btn pri" type="submit">כניסה לקבוצה</button><span class="hint" id="jerr" role="alert"></span></div></form></section>
    <section class="fr"><h3 class="s">אני מנהל.ת קבוצה</h3><p class="hint" style="margin:4px 0 16px">${local ? 'מצב בדיקות: אפשר להיכנס עם כל מייל.' : 'כניסה עם חשבון Google של הארגון. החשבון צריך להיות מורשה מראש.'}</p>
      <form id="mgrForm" class="stack" style="gap:12px">
        ${local ? `<div><label class="l" for="me">מייל</label><input class="in" id="me" name="email" type="email" placeholder="name@tfi.org.il" required></div>
        <div><label class="l" for="mn">שם</label><input class="in" id="mn" name="name" placeholder="השם שיוצג למשתתפים"></div>` : ''}
        <div class="row"><button class="btn pri" type="submit">${local ? 'כניסה לבדיקות' : 'כניסה עם Google'}</button><span class="hint" id="merr" role="alert"></span></div></form></section>
  </div>`;

  let city = '';
  root.querySelectorAll('.city').forEach(b => b.addEventListener('click', () => {
    city = b.dataset.city;
    root.querySelectorAll('.city').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
    root.querySelector('#jerr').textContent = ''; root.querySelector('#jc').focus();
  }));
  const jc = root.querySelector('#jc');
  jc.addEventListener('input', () => { const c = normCode(jc.value).slice(0, 6); jc.value = c.length > 3 ? c.slice(0, 3) + '-' + c.slice(3) : c; });

  root.querySelector('#joinForm').addEventListener('submit', async e => {
    e.preventDefault();
    const err = root.querySelector('#jerr'), btn = e.submitter; err.textContent = '';
    const code = normCode(jc.value), name = root.querySelector('#jn').value.trim();
    if (!city) { err.textContent = 'בחרו קודם את הקבוצה של העיר'; return; }
    if (code.length !== 6 || !name) { err.textContent = 'צריך קוד בן 6 תווים ושם'; return; }
    btn.disabled = true;
    try {
      const u = await store.signInParticipant();
      const c = await store.db.doc('joinCodes/' + code).get();
      if (!c.exists) { err.textContent = 'הקוד לא נמצא. בדקו שוב מול מנהל.ת הקבוצה'; btn.disabled = false; return; }
      if (c.data().city && c.data().city !== city) { err.textContent = 'הקוד הזה שייך לקבוצה של עיר אחרת'; btn.disabled = false; return; }
      const gid = c.data().gid, ref = store.db.doc(`groups/${gid}/members/${u.uid}`);
      await ref.set({ name, code, joinedAt: Date.now() }, { merge: true });
      try { localStorage.setItem(LAST_KEY, gid); } catch (x) {}
      go('/g/' + gid);
    } catch (x) { err.textContent = 'לא הצלחנו להיכנס. נסו שוב'; btn.disabled = false; }
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
  return () => {};
}
