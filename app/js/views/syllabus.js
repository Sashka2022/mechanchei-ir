/* עורך הסילבוס של מנהל.ת הקבוצה: מסע התחנות. כל תחנה: מועד, מקום, תיאור, שאלות הכנה, חומרי קריאה,
   וקישור לשלב בתהליך הובלת היוזמה שעובדים עליו באותה תחנה. */
import { store } from '../store.js';
import { esc, toast, confirmDialog, createView, docs, docData, byOrder } from '../ui.js';
import { fmtDate, STATION_TEMPLATE, WS_STEPS, wsLabel } from '../model.js';

const lines = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
const parseReadings = s => lines(s).map(l => { const [t, ...u] = l.split('|'); const url = u.join('|').trim(); return url ? { title: t.trim(), url } : { title: t.trim(), url: '' }; });
const readingsText = r => (r || []).map(x => x.url ? `${x.title} | ${x.url}` : x.title).join('\n');

export function mountSyllabus(root, ctx) {
  const { gid } = ctx, db = store.db, base = `groups/${gid}`;
  return createView(root, {
    watch: (st, sub) => { sub('group', db.doc(base), docData); sub('stations', db.collection(base + '/stations'), docs); },
    render: st => {
      const g = st.data.group || ctx.group, list = (st.data.stations || []).sort(byOrder), ed = st.ui.edit;
      const editor = s => `<form class="card editor" data-sid="${s ? s.id : ''}">
        <div class="grid2"><div><label class="l">שם התחנה</label><input class="in" name="title" required maxlength="120" value="${esc(s ? s.title : '')}" placeholder="לדוגמה: סיור בשכונה"></div>
          <div><label class="l">מקום</label><input class="in" name="place" maxlength="120" value="${esc(s ? s.place : '')}" placeholder="כתובת או שם המקום"></div></div>
        <div class="grid2" style="margin-top:12px"><div><label class="l">תאריך</label><input class="in" type="date" name="date" value="${esc(s ? s.date : '')}"></div>
          <div><label class="l">שעה</label><input class="in" name="time" maxlength="20" value="${esc(s ? s.time : '')}" placeholder="16:00 עד 19:00"></div></div>
        <label class="l" style="margin-top:12px">תיאור התחנה</label><textarea class="in" name="description" rows="3" maxlength="800">${esc(s ? s.description : '')}</textarea>
        <label class="l" style="margin-top:12px">שאלות הכנה (שאלה בכל שורה)</label><textarea class="in" name="prep" rows="3" placeholder="מה הייתם רוצים לשאול את המארחים?">${esc(s ? (s.prep || []).join('\n') : '')}</textarea>
        <label class="l" style="margin-top:12px">חומרי קריאה והשראה (שורה לכל פריט: כותרת | קישור)</label><textarea class="in" name="readings" rows="3" placeholder="שנתון סטטיסטי | https://...">${esc(s ? readingsText(s.readings) : '')}</textarea>
        <label class="l" style="margin-top:12px">בתחנה הזו עובדים על (בתהליך הובלת היוזמה)</label>
        <select class="in" name="step"><option value="">ללא קשר לתהליך</option>${WS_STEPS.map(w => `<option value="${w.id}" ${s && s.step === w.id ? 'selected' : ''}>${w.n ? w.n + ' · ' : ''}${w.label}</option>`).join('')}</select>
        <div class="row" style="margin-top:16px"><button class="btn pri" type="submit">שמירה</button><button class="btn" type="button" data-act="cancel">ביטול</button></div></form>`;
      const row = (s, i) => ed === s.id ? editor(s) : `<div class="item stn"><span class="hn">${i + 1}</span><div class="grow" style="padding:4px 8px"><b>${esc(s.title)}</b>
          <div class="hint">${esc(fmtDate(s.date, s.time))}${s.place ? ' · ' + esc(s.place) : ''}${s.step ? ' · ' + esc(wsLabel(s.step)) : ''}</div></div>
          <div class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sm" data-act="up" data-id="${s.id}" ${i === 0 ? 'disabled' : ''} aria-label="הזזה למעלה">▲</button><button class="btn sm" data-act="down" data-id="${s.id}" ${i === list.length - 1 ? 'disabled' : ''} aria-label="הזזה למטה">▼</button>
          <button class="btn sm" data-act="edit" data-id="${s.id}">עריכה</button><a class="btn sm" href="#/g/${gid}/s/${s.id}">תצוגה</a><button class="rm" data-act="del" data-id="${s.id}" aria-label="מחיקה"></button></div></div>`;
      return `<section class="fr"><div class="sh"><div class="grow"><div class="eyebrow">סילבוס · ${esc(g.name)}</div><h2 class="t">מסע התחנות</h2>
          <p>מגדירים את התחנות של הקבוצה בסדר שבו הן קורות. המשתתפים רואים אותן רק אחרי שמפרסמים.</p></div></div>
        <div class="row" style="margin-top:16px"><span class="pill ${g.published ? '' : 'p'}">${g.published ? 'פורסם למשתתפים' : 'טיוטה, המשתתפים לא רואים'}</span>
          <button class="btn sm ${g.published ? '' : 'pri'}" data-act="publish">${g.published ? 'החזרה לטיוטה' : 'פרסום למשתתפים'}</button>
          ${list.length ? `<a class="btn sm" href="#/g/${gid}/journey">תצוגת משתתפים</a>` : ''}</div></section>
        <section class="fr"><div class="list">${list.length ? list.map(row).join('') : `<div class="empty"><b>הסילבוס ריק</b>הוסיפו תחנה, או התחילו מתבנית מסע התחנות של מחנכי עיר ותתאימו אותה לעיר שלכם.</div>`}</div>
          ${ed === 'new' ? `<div style="margin-top:14px">${editor(null)}</div>` : `<div class="row" style="margin-top:14px"><button class="btn pri" data-act="add">+ תחנה חדשה</button>${list.length ? '' : '<button class="btn" data-act="template">טעינת תבנית מחנכי עיר (11 תחנות)</button>'}</div>`}</section>`;
    },
    after: (st, el) => {
      el.querySelectorAll('form.editor').forEach(f => f.onsubmit = async e => {
        e.preventDefault(); const btn = e.submitter; btn.disabled = true;
        const d = Object.fromEntries(new FormData(f).entries()), sid = f.dataset.sid;
        const data = { title: d.title.trim(), place: d.place.trim(), date: d.date || '', time: d.time.trim(), description: d.description.trim(), prep: lines(d.prep), readings: parseReadings(d.readings), step: d.step || '' };
        try {
          if (sid) await db.doc(`${base}/stations/${sid}`).set(data, { merge: true });
          else { const max = Math.max(0, ...(st.data.stations || []).map(s => s.order || 0)); await db.collection(base + '/stations').doc().set({ ...data, order: max + 1 }); }
          st.ui.edit = null; toast('התחנה נשמרה'); st.redraw();
        } catch (x) { toast('השמירה נכשלה'); btn.disabled = false; }
      });
    },
    acts: {
      add(d, el, st, redraw) { st.ui.edit = 'new'; redraw(); },
      edit(d, el, st, redraw) { st.ui.edit = d.id; redraw(); },
      cancel(d, el, st, redraw) { st.ui.edit = null; redraw(); },
      async del(d) { if (await confirmDialog('למחוק את התחנה? אי אפשר לשחזר.', 'מחיקה')) db.doc(`${base}/stations/${d.id}`).delete(); },
      async publish(d, el, st) { const g = st.data.group || ctx.group; await db.doc(base).set({ published: !g.published }, { merge: true }); toast(g.published ? 'הסילבוס חזר לטיוטה' : 'הסילבוס פורסם למשתתפים'); },
      async up(d, el, st) { await swap(st, d.id, -1); },
      async down(d, el, st) { await swap(st, d.id, 1); },
      async template(d, el, st) {
        const col = db.collection(base + '/stations');
        for (let i = 0; i < STATION_TEMPLATE.length; i++) await col.doc().set({ title: STATION_TEMPLATE[i][0], description: STATION_TEMPLATE[i][1], place: '', date: '', time: '', prep: [], readings: [], step: '', order: i + 1 });
        toast('התבנית נטענה. עכשיו מתאימים תחנה אחרי תחנה');
      }
    }
  });

  async function swap(st, id, dir) {
    const arr = (st.data.stations || []).sort(byOrder), i = arr.findIndex(s => s.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    await Promise.all(arr.map((s, k) => s.order === k + 1 ? null : db.doc(`${base}/stations/${s.id}`).set({ order: k + 1 }, { merge: true })));
  }
}
