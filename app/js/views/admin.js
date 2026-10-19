/* אזור מנהלי קבוצות: הקבוצות שלי + יצירת קבוצה. למנהל.ת על: גם ניהול רשימת המנהלים המורשים. */
import { store } from '../store.js';
import { esc, toast, confirmDialog, createView, docs } from '../ui.js';
import { CITIES } from '../model.js';

export function mountAdmin(root, { user, sup, go }) {
  const db = store.db, migrated = new Set();
  /* קבוצת הכניסה של עיר: אליה נכנסים המשתתפים שבוחרים את העיר בדף הפתיחה */
  const setEntry = (city, gid) => db.doc('cityGroups/' + city).set({ gid, city });
  async function createGroup(ref, name, city) {
    const email = (user.email || '').toLowerCase();
    await ref.set({ name, city, ownerUid: user.uid, ownerEmail: email, ownerName: user.displayName || user.email || '', managerEmails: email ? [email] : [], published: false, createdAt: Date.now() });
    if (!(await db.doc('cityGroups/' + city).get()).exists) await setEntry(city, ref.id);
    return ref.id;
  }
  return createView(root, {
    watch: (st, sub) => {
      const col = db.collection('groups');
      sub('groups', sup ? col : col.where('managerEmails', 'array-contains', (user.email || '').toLowerCase()), docs);
      sub('entries', db.collection('cityGroups'), docs);
      if (sup && store.mode === 'firebase') sub('managers', db.collection('managers'), docs);
    },
    render: st => {
      const gs = (st.data.groups || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      const me = (user.email || '').toLowerCase(), isMine = g => g.ownerUid === user.uid || (g.managerEmails || []).includes(me);
      const mine = gs.filter(isMine), others = gs.filter(g => !isMine(g));
      const entries = st.data.entries || [], entryOf = g => entries.some(e => e.id === g.city && e.gid === g.id);
      const missing = CITIES.filter(c => !gs.some(g => g.city === c));
      const card = g => `<a class="card gcard" href="#/g/${g.id}"><div class="pill ${g.published ? '' : 'p'}">${g.published ? 'פורסם למשתתפים' : 'טיוטה'}</div>
        <h3 class="s" style="margin-top:10px">${esc(g.name)}</h3><div class="hint">${esc(g.city || '')}${g.ownerName && g.ownerUid !== user.uid ? ' · ' + esc(g.ownerName) : ''}</div>
        ${entryOf(g) ? `<div class="row" style="margin-top:12px"><span class="chip">קבוצת הכניסה של ${esc(g.city)}</span></div>` : ''}</a>`;
      return `<section class="fr"><div class="sh"><div class="grow"><div class="eyebrow">אזור מנהלי קבוצות</div><h2 class="t">הקבוצות שלי</h2>
          <p>כל קבוצה היא מחזור אחד בעיר אחת. בקבוצה ממלאים את הסילבוס, המשתתפים נכנסים מדף הפתיחה עם המייל שלהם, ועוקבים אחרי הובלת היוזמות.</p></div></div></section>
        ${mine.length ? `<div class="igrid">${mine.map(card).join('')}</div>` : `<section class="fr"><div class="empty"><b>עוד אין לכם קבוצה</b>פתחו קבוצה חדשה למטה, ואז מלאו בה את הסילבוס.</div></section>`}
        <section class="fr"><h3 class="s">קבוצה חדשה</h3>
          <form id="newGroup" class="stack" style="gap:12px;margin-top:12px;max-width:560px">
            <div><label class="l" for="gn">שם הקבוצה</label><input class="in" id="gn" name="name" required maxlength="80" placeholder="לדוגמה: מחנכי עיר חיפה · מחזור ג׳"></div>
            <div><label class="l" for="gc">עיר</label><select class="in" id="gc" name="city" required>${CITIES.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></div>
            <div class="row"><button class="btn pri" type="submit">יצירת קבוצה</button></div></form></section>
        ${others.length ? `<section class="fr"><h3 class="s">קבוצות של מנהלים אחרים</h3><div class="igrid" style="margin-top:12px">${others.map(card).join('')}</div></section>` : ''}
        ${sup && missing.length ? `<section class="fr"><h3 class="s">קבוצות הערים</h3><p class="hint" style="margin:4px 0 14px">בעמוד הפתיחה המשתתפים בוחרים בין שלוש הערים. עוד אין קבוצה ל: ${missing.map(esc).join(', ')}.</p><button class="btn pri" data-act="seedCities">פתיחת קבוצות לערים החסרות</button></section>` : ''}
        ${sup ? managersHTML(st) : ''}
        ${store.mode === 'firebase' ? `<section class="fr"><h3 class="s">בדיקת חיבור לענן</h3><p class="hint" style="margin:4px 0 14px">כותב ומחזיר מסמך בדיקה מהשרת, כדי לוודא שהנתונים באמת נשמרים בענן.</p><div class="row"><button class="btn" data-act="health">בדיקה</button><span id="healthOut" role="status"></span></div></section>` : ''}`;
    },
    after: (st, el) => {
      /* קבוצות שנפתחו עוד כשהכניסה הייתה בקוד: הקבוצה החדשה ביותר של כל עיר הופכת לקבוצת הכניסה שלה */
      const have = new Set((st.data.entries || []).map(e => e.id)), me = (user.email || '').toLowerCase();
      for (const c of CITIES) {
        if (have.has(c) || migrated.has(c)) continue;
        const g = (st.data.groups || []).filter(x => x.city === c && (x.ownerUid === user.uid || (x.managerEmails || []).includes(me))).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
        if (g) { migrated.add(c); setEntry(c, g.id).catch(() => migrated.delete(c)); }
      }
      const f = el.querySelector('#newGroup');
      if (f) f.onsubmit = async e => {
        e.preventDefault(); const btn = e.submitter; btn.disabled = true;
        const d = Object.fromEntries(new FormData(f).entries());
        try {
          const ref = db.collection('groups').doc();
          await createGroup(ref, d.name.trim(), d.city.trim());
          go('/g/' + ref.id);
        } catch (x) { toast('יצירת הקבוצה נכשלה'); btn.disabled = false; }
      };
      const mf = el.querySelector('#addMgr');
      if (mf) mf.onsubmit = async e => {
        e.preventDefault();
        const email = mf.email.value.trim().toLowerCase(); if (!email) return;
        try { await db.doc('managers/' + email).set({ email, name: mf.mname.value.trim(), addedBy: user.email || '', at: Date.now() }); mf.reset(); toast('המנהל.ת נוספ.ה'); }
        catch (x) { toast('ההוספה נכשלה'); }
      };
    },
    acts: {
      async seedCities(d, el, st) {
        el.disabled = true;
        try { for (const c of CITIES.filter(c => !(st.data.groups || []).some(g => g.city === c))) await createGroup(db.collection('groups').doc(), 'מחנכי עיר ' + c, c); toast('הקבוצות נפתחו'); }
        catch (x) { toast('הפתיחה נכשלה'); el.disabled = false; }
      },
      async health(d, el) {
        const out = root.querySelector('#healthOut'); out.textContent = 'בודק...'; el.disabled = true;
        try {
          const ref = db.doc('_health/' + user.uid), stamp = Date.now();
          await ref.set({ stamp, by: user.uid });
          const back = await ref.get({ source: 'server' });
          out.textContent = back.exists && back.data().stamp === stamp ? '✓ הנתונים נכתבים לענן ונקראים ממנו' : 'הכתיבה לא אומתה בשרת';
        } catch (x) { out.textContent = 'נכשל: ' + (x.code || x.message); }
        el.disabled = false;
      },
      async rmMgr(d) { if (await confirmDialog('להסיר את ' + d.email + ' מרשימת המנהלים? הקבוצות שלו.ה יישארו.', 'הסרה')) db.doc('managers/' + d.email).delete(); }
    }
  });
}

function managersHTML(st) {
  if (store.mode === 'local') return '';
  const ms = (st.data.managers || []).sort((a, b) => a.email < b.email ? -1 : 1);
  return `<section class="fr"><h3 class="s">מנהלי קבוצות מורשים</h3><p class="hint" style="margin:4px 0 14px">רק מי שנמצא.ת ברשימה יכול.ה להיכנס בחשבון Google ולפתוח קבוצה. הוסיפו את כתובת המייל שבה הם נכנסים ל-Google.</p>
    <div class="list">${ms.length ? ms.map(m => `<div class="item"><div class="grow" style="padding:8px 10px"><b>${esc(m.name || m.email)}</b><div class="hint" dir="ltr" style="text-align:end">${esc(m.email)}</div></div><button class="rm" data-act="rmMgr" data-email="${esc(m.email)}" aria-label="הסרה"></button></div>`).join('') : '<div class="empty"><b>עוד לא נוספו מנהלים</b>רק מנהלי העל יכולים להיכנס כרגע.</div>'}</div>
    <form id="addMgr" class="addrow"><input class="in" name="email" type="email" required placeholder="מייל של מנהל.ת קבוצה" dir="ltr"><input class="in" name="mname" placeholder="שם (לא חובה)"><button class="btn pri" type="submit">הוספה</button></form></section>`;
}
