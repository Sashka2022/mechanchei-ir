/* עורך הסילבוס של מנהל.ת הקבוצה: מסע התחנות. כל תחנה: מועד, מקום, תיאור, שאלות הכנה, חומרי קריאה,
   וקישור לשלב בתהליך הובלת היוזמה שעובדים עליו באותה תחנה. */
import { store } from '../store.js';
import { esc, toast, confirmDialog, createView, docs, docData, byOrder } from '../ui.js';
import { fmtDate, WS_STEPS, wsLabel } from '../model.js';
import { readSyllabusFile, parseSyllabus } from '../syllabus-import.js';

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
      const imp = st.ui.imp;
      const importPanel = !imp ? '' : `<section class="fr"><div class="card editor"><h3 class="t">ייבוא סילבוס ממסמך</h3>
          <p class="hint">מעלים מסמך אחד עם כל הסילבוס והאפליקציה פורסת אותו לתחנות. כל כותרת "תחנה 1", "תחנה 2"… (או כותרת במסמך Word) פותחת תחנה. בתוך תחנה אפשר לכתוב שורות כמו: מקום: …, תאריך: 12.11.2026, שעה: 16:00-19:00, שאלות הכנה: (ורשימה), חומרי קריאה: (ורשימה, עם קישורים), שלב: עץ הבעיה. כל השאר הופך לתיאור התחנה.</p>
          <label class="l" style="margin-top:12px">קובץ Word (docx), טקסט או Markdown</label><input class="in" type="file" id="impfile" accept=".docx,.txt,.md,.markdown,text/plain">
          <label class="l" style="margin-top:12px">או הדביקו את הטקסט כאן</label><textarea class="in" id="imptext" rows="7" placeholder="תחנה 1: ...">${esc(imp.text || '')}</textarea>
          <div class="row" style="margin-top:12px"><button class="btn pri" data-act="parse">פירוק לתחנות</button><button class="btn" data-act="impcancel">ביטול</button></div>
          ${imp.err ? `<p class="hint" style="color:#C0524B;margin-top:10px">${esc(imp.err)}</p>` : ''}
          ${imp.parsed ? `<div style="margin-top:16px"><b>נמצאו ${imp.parsed.length} תחנות. בדקו לפני שמירה:</b><div class="list" style="margin-top:8px">${imp.parsed.map((p, i) => `<div class="item stn"><span class="hn">${i + 1}</span><div class="grow" style="padding:4px 8px"><b>${esc(p.title)}</b>
            <div class="hint">${esc(fmtDate(p.date, p.time))}${p.place ? ' · ' + esc(p.place) : ''}${p.step ? ' · ' + esc(wsLabel(p.step)) : ''}${p.prep.length ? ' · ' + p.prep.length + ' שאלות הכנה' : ''}${p.readings.length ? ' · ' + p.readings.length + ' חומרי קריאה' : ''}</div></div></div>`).join('')}</div>
            <div class="row" style="margin-top:12px"><button class="btn pri" data-act="impsave" data-mode="add">הוספה לסוף הסילבוס</button>${list.length ? `<button class="btn" data-act="impsave" data-mode="replace">החלפת כל התחנות הקיימות</button>` : ''}</div>
            <p class="hint">אחרי היבוא אפשר לערוך כל תחנה בנפרד, לשנות סדר או למחוק.</p></div>` : ''}</div></section>`;
      return `<section class="fr"><div class="sh"><div class="grow"><div class="eyebrow">סילבוס · ${esc(g.name)}</div><h2 class="t">מסע התחנות</h2>
          <p>מגדירים את התחנות של הקבוצה בסדר שבו הן קורות. המשתתפים רואים אותן רק אחרי שמפרסמים.</p></div></div>
        <div class="row" style="margin-top:16px"><span class="pill ${g.published ? '' : 'p'}">${g.published ? 'פורסם למשתתפים' : 'טיוטה, המשתתפים לא רואים'}</span>
          <button class="btn sm ${g.published ? '' : 'pri'}" data-act="publish">${g.published ? 'החזרה לטיוטה' : 'פרסום למשתתפים'}</button>
          ${list.length ? `<a class="btn sm" href="#/g/${gid}/journey">תצוגת משתתפים</a>` : ''}</div></section>
        ${importPanel}<section class="fr"><div class="list">${list.length ? list.map(row).join('') : `<div class="empty"><b>הסילבוס ריק</b>הוסיפו את התחנה הראשונה של המסע.</div>`}</div>
          ${ed === 'new' ? `<div style="margin-top:14px">${editor(null)}</div>` : `<div class="row" style="margin-top:14px"><button class="btn pri" data-act="add">+ תחנה חדשה</button><button class="btn" data-act="imp">ייבוא סילבוס ממסמך</button></div>`}</section>`;
    },
    after: (st, el) => {
      const fi = el.querySelector('#impfile');
      if (fi) fi.onchange = async () => {
        const f = fi.files[0]; if (!f) return;
        try { const text = await readSyllabusFile(f); st.ui.imp = { text, parsed: parseSyllabus(text) }; if (!st.ui.imp.parsed.length) st.ui.imp.err = 'לא נמצא טקסט במסמך.'; }
        catch (x) { st.ui.imp = { text: '', err: x.message || 'קריאת הקובץ נכשלה' }; }
        st.redraw();
      };
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
      imp(d, el, st, redraw) { st.ui.edit = null; st.ui.imp = { text: '' }; redraw(); },
      impcancel(d, el, st, redraw) { st.ui.imp = null; redraw(); },
      parse(d, el, st, redraw) {
        const text = root.querySelector('#imptext').value;
        const parsed = parseSyllabus(text);
        st.ui.imp = { text, parsed, err: parsed.length ? '' : 'לא הוזן טקסט.' }; redraw();
      },
      async impsave(d, el, st, redraw) {
        const imp = st.ui.imp; if (!imp || !imp.parsed || !imp.parsed.length) return;
        const old = st.data.stations || [];
        if (d.mode === 'replace' && !(await confirmDialog(`למחוק ${old.length} תחנות קיימות ולהחליף ב-${imp.parsed.length} התחנות מהמסמך? אי אפשר לשחזר.`, 'החלפה'))) return;
        try {
          if (d.mode === 'replace') await Promise.all(old.map(s => db.doc(`${base}/stations/${s.id}`).delete()));
          const start = d.mode === 'replace' ? 0 : Math.max(0, ...old.map(s => s.order || 0));
          for (let i = 0; i < imp.parsed.length; i++) await db.collection(base + '/stations').doc().set({ ...imp.parsed[i], order: start + i + 1 });
          st.ui.imp = null; toast(`נוצרו ${imp.parsed.length} תחנות`); redraw();
        } catch (x) { toast('הייבוא נכשל'); }
      },
      add(d, el, st, redraw) { st.ui.edit = 'new'; redraw(); },
      edit(d, el, st, redraw) { st.ui.edit = d.id; redraw(); },
      cancel(d, el, st, redraw) { st.ui.edit = null; redraw(); },
      async del(d) { if (await confirmDialog('למחוק את התחנה? אי אפשר לשחזר.', 'מחיקה')) db.doc(`${base}/stations/${d.id}`).delete(); },
      async publish(d, el, st) { const g = st.data.group || ctx.group; await db.doc(base).set({ published: !g.published }, { merge: true }); toast(g.published ? 'הסילבוס חזר לטיוטה' : 'הסילבוס פורסם למשתתפים'); },
      async up(d, el, st) { await swap(st, d.id, -1); },
      async down(d, el, st) { await swap(st, d.id, 1); }
    }
  });

  async function swap(st, id, dir) {
    const arr = (st.data.stations || []).sort(byOrder), i = arr.findIndex(s => s.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    await Promise.all(arr.map((s, k) => s.order === k + 1 ? null : db.doc(`${base}/stations/${s.id}`).set({ order: k + 1 }, { merge: true })));
  }
}
