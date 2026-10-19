/* חלון הסיסמה של משתתף.ת: הגדרה, החלפה או הסרה. בלי סיסמה נכנסים עם המייל בלבד. */
import { store } from '../store.js';
import { toast } from '../ui.js';

export function openPasswordDialog() {
  const d = document.createElement('dialog'); d.className = 'dlg';
  d.innerHTML = `<form class="stack" style="gap:14px"><h2 class="s" style="font-size:24px;font-weight:900">סיסמה לכניסה</h2>
    <p class="hint">אפשר להיכנס רק עם המייל. כדי שאף אחד אחר לא ייכנס בשם שלכם, אפשר להגדיר סיסמה. שכחתם? מנהל.ת הקבוצה יכול.ה לשלוח מייל לאיפוס.</p>
    <div><label class="l" for="pwCur">סיסמה נוכחית (אם כבר הגדרתם)</label><input class="in" id="pwCur" type="password" dir="ltr" autocomplete="current-password" maxlength="100"></div>
    <div><label class="l" for="pwNew">סיסמה חדשה (לפחות 6 תווים)</label><input class="in" id="pwNew" type="password" dir="ltr" autocomplete="new-password" maxlength="100"></div>
    <div class="hint" id="pwErr" role="alert" style="min-height:22px"></div>
    <div class="row"><button class="btn pri" type="submit">שמירת הסיסמה</button><button class="btn" type="button" id="pwClear">הסרת הסיסמה</button><button class="btn" type="button" data-close>סגירה</button></div></form>`;
  document.body.appendChild(d);
  const $ = s => d.querySelector(s), err = $('#pwErr');
  const run = async (next, ok) => {
    err.textContent = '';
    try { await store.changePassword($('#pwCur').value, next); toast(ok); d.close(); }
    catch (x) {
      const c = x && x.code;
      err.textContent = c === 'wrong-password' ? 'הסיסמה הנוכחית לא נכונה' : c === 'auth/weak-password' ? 'הסיסמה קצרה מדי, צריך לפחות 6 תווים' : c === 'auth/too-many-requests' ? 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות' : 'השמירה נכשלה. נסו שוב';
    }
  };
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
  d.addEventListener('close', () => d.remove());
  d.querySelector('form').addEventListener('submit', e => { e.preventDefault(); const n = $('#pwNew').value; if (n.length < 6) { err.textContent = 'צריך סיסמה של 6 תווים לפחות'; return; } run(n, 'הסיסמה נשמרה'); });
  $('#pwClear').addEventListener('click', () => run('', 'הסיסמה הוסרה. נכנסים עם המייל בלבד'));
  d.showModal(); $('#pwCur').focus();
}
