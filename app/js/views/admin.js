/* אזור מנהלי קבוצות: הקבוצות שלי + יצירת קבוצה. למנהל.ת על: גם ניהול רשימת המנהלים המורשים. */
import { store } from '../store.js';
import { esc, toast, confirmDialog, createView, docs } from '../ui.js';
import { CITIES, newCode, showCode } from '../model.js';

export function mountAdmin(root, { user, sup, go }) {
  const db = store.db;
  return createView(root, {
    watch: (st, sub) => {
      const col = db.collection('groups');
      sub('groups', sup ? col : col.where('ownerUid', '==', user.uid), docs);
      if (sup && store.mode === 'firebase') sub('managers', db.collection('managers'), docs);
    },
    render: st => {
      const gs = (st.data.groups || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      const mine = gs.filter(g => g.ownerUid === user.uid), others = gs.filter(g => g.ownerUid !== user.uid);
      const card = g => `<a class="card gcard" href="#/g/${g.id}"><div class="pill ${g.published ? '' : 'p'}">${g.published ? 'פורסם למשתתפים' : 'טיוטה'}</div>
        <h3 class="s" style="margin-top:10px">${esc(g.name)}</h3><div class="hint">${esc(g.city || '')}${g.ownerName && g.ownerUid !== user.uid ? ' · ' + esc(g.ownerName) : ''}</div>
        <div class="row" style="margin-top:12px"><span class="chip">קוד · <b dir="ltr">${showCode(g.code)}</b></span></div></a>`;
      return `<section class="fr"><div class="sh"><div class="grow"><div class="eyebrow">אזור מנהלי קבוצות</div><h2 class="t">הקבוצות שלי</h2>
          <p>כל קבוצה היא מחזור אחד בעיר אחת. בקבוצה ממלאים את הסילבוס, מזמינים משתתפים בקוד, ועוקבים אחרי הובלת היוזמות.</p></div></div></section>
        ${mine.length ? `<div class="igrid">${mine.map(card).join('')}</div>` : `<section class="fr"><div class="empty"><b>עוד אין לכם קבוצה</b>פתחו קבוצה חדשה למטה, ואז מלאו בה את הסילבוס.</div></section>`}
        <section class="fr"><h3 class="s">קבוצה חדשה</h3>
          <form id="newGroup" class="stack" style="gap:12px;margin-top:12px;max-width:560px">
            <div><label class="l" for="gn">שם הקבוצה</label><input class="in" id="gn" name="name" required maxlength="80" placeholder="לדוגמה: מחנכי עיר חיפה · מחזור ג׳"></div>
            <div><label class="l" for="gc">עיר</label><input class="in" id="gc" name="city" list="cities" required maxlength="40" placeholder="בחרו או כתבו עיר"><datalist id="cities">${CITIES.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
            <div class="row"><button class="btn pri" type="submit">יצירת קבוצה</button></div></form></section>
        ${others.length ? `<section class="fr"><h3 class="s">קבוצות של מנהלים אחרים</h3><div class="igrid" style="margin-top:12px">${others.map(card).join('')}</div></section>` : ''}
        ${sup ? managersHTML(st) : ''}`;
    },
    after: (st, el) => {
      const f = el.querySelector('#newGroup');
      if (f) f.onsubmit = async e => {
        e.preventDefault(); const btn = e.submitter; btn.disabled = true;
        const d = Object.fromEntries(new FormData(f).entries());
        try {
          const ref = db.collection('groups').doc(), code = newCode();
          await ref.set({ name: d.name.trim(), city: d.city.trim(), code, ownerUid: user.uid, ownerEmail: user.email || '', ownerName: user.displayName || user.email || '', published: false, createdAt: Date.now() });
          await db.doc('joinCodes/' + code).set({ gid: ref.id });
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
