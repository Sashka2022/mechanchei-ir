/* הגדרות הקבוצה: שם, עיר, פרסום, וקוד כניסה. */
import { store } from '../store.js';
import { esc, toast, confirmDialog, createView, docData } from '../ui.js';
import { CITIES, newCode, showCode } from '../model.js';

export function mountSettings(root, ctx) {
  const { gid } = ctx, db = store.db, base = `groups/${gid}`;
  return createView(root, {
    watch: (st, sub) => sub('group', db.doc(base), docData),
    render: st => {
      const g = st.data.group || ctx.group;
      return `<section class="fr"><div class="sh"><div class="grow"><div class="eyebrow">${esc(g.name)}</div><h2 class="t">הגדרות הקבוצה</h2></div></div>
          <form id="gform" class="stack" style="gap:12px;margin-top:16px;max-width:560px">
            <div><label class="l" for="gn">שם הקבוצה</label><input class="in" id="gn" name="name" required maxlength="80" value="${esc(g.name)}"></div>
            <div><label class="l" for="gc">עיר</label><select class="in" id="gc" name="city" required>${CITIES.map(c => `<option value="${esc(c)}" ${c === g.city ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
            <div class="row"><button class="btn pri" type="submit">שמירה</button></div></form></section>
        ${store.isSuper(ctx.user) || store.mode === 'local' ? `<section class="fr"><h3 class="s">מנהלי הקבוצה</h3><p class="hint" style="margin:4px 0 14px">מייל בכל שורה. מי שמופיע כאן מקבל.ת גישה לנהל את הקבוצה, והמיילים מתווספים לרשימת המנהלים המורשים.</p>
          <form id="mgrs" class="stack" style="gap:12px;max-width:560px"><textarea class="in" name="emails" rows="3" dir="ltr" placeholder="name@tfi.org.il">${esc((g.managerEmails || []).join('\n'))}</textarea><div class="row"><button class="btn pri" type="submit">שמירה</button></div></form></section>` : ''}
        <section class="fr"><h3 class="s">פרסום הסילבוס</h3><p class="hint" style="margin:4px 0 14px">כל עוד הסילבוס טיוטה, המשתתפים נכנסים לקבוצה אבל לא רואים את התחנות.</p>
          <div class="row"><span class="pill ${g.published ? '' : 'p'}">${g.published ? 'פורסם' : 'טיוטה'}</span><button class="btn sm ${g.published ? '' : 'pri'}" data-act="publish">${g.published ? 'החזרה לטיוטה' : 'פרסום למשתתפים'}</button></div></section>
        <section class="fr"><h3 class="s">קוד כניסה</h3><p class="hint" style="margin:4px 0 14px">מי שיש לו את הקוד יכול להיכנס לקבוצה. אם הקוד הגיע למי שלא צריך, מחליפים אותו. המשתתפים שכבר בפנים נשארים.</p>
          <div class="row"><span class="bigcode inline" dir="ltr">${showCode(g.code)}</span><button class="btn sm" data-act="regen">החלפת קוד</button></div></section>`;
    },
    after: (st, el) => {
      const f = el.querySelector('#gform');
      if (f) f.onsubmit = async e => {
        e.preventDefault();
        try {
          const g = st.data.group || ctx.group;
          await db.doc(base).set({ name: f.name.value.trim(), city: f.city.value }, { merge: true });
          await db.doc('joinCodes/' + g.code).set({ gid, city: f.city.value }, { merge: true });
          toast('נשמר');
        } catch (x) { toast('השמירה נכשלה'); }
      };
      const mf = el.querySelector('#mgrs');
      if (mf) mf.onsubmit = async e => {
        e.preventDefault();
        const emails = [...new Set(mf.emails.value.split(/[\s,;]+/).map(x => x.trim().toLowerCase()).filter(x => x.includes('@')))];
        try {
          for (const em of emails) await db.doc('managers/' + em).set({ email: em, name: '', addedBy: ctx.user.email || '', at: Date.now() }, { merge: true });
          await db.doc(base).set({ managerEmails: emails }, { merge: true }); toast('מנהלי הקבוצה עודכנו');
        } catch (x) { toast('העדכון נכשל'); }
      };
    },
    acts: {
      async publish(d, el, st) { const g = st.data.group || ctx.group; await db.doc(base).set({ published: !g.published }, { merge: true }); toast(g.published ? 'הסילבוס חזר לטיוטה' : 'הסילבוס פורסם'); },
      async regen(d, el, st) {
        if (!(await confirmDialog('להחליף את קוד הכניסה? הקוד הישן יפסיק לעבוד.', 'החלפה'))) return;
        const g = st.data.group || ctx.group, code = newCode();
        try {
          await db.doc('joinCodes/' + code).set({ gid, city: g.city });
          await db.doc(base).set({ code }, { merge: true });
          await db.doc('joinCodes/' + g.code).delete(); toast('הקוד הוחלף');
        } catch (x) { toast('ההחלפה נכשלה'); }
      }
    }
  });
}
