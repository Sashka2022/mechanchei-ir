/* ספריית השראה: חומרי קריאה, הרצאות, נתונים ודוגמאות לפי קטגוריות. המנהל.ת מנהל.ת, המשתתפים מעיינים. */
import { store } from '../store.js';
import { esc, toast, confirmDialog, createView, docs, docData, byOrder } from '../ui.js';
import { LIB_CATS } from '../model.js';

const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '';

export function mountLibrary(root, ctx) {
  const { gid, isManager } = ctx, db = store.db, base = `groups/${gid}`;
  return createView(root, {
    watch: (st, sub) => { sub('group', db.doc(base), docData); sub('lib', db.collection(base + '/library'), docs); },
    render: st => {
      const g = st.data.group || ctx.group, all = (st.data.lib || []).sort(byOrder), cat = st.ui.cat || '', ed = st.ui.edit;
      if (!isManager && !g.published) return `<section class="fr"><div class="empty"><b>הספרייה עוד לא פורסמה</b>היא תיפתח יחד עם הסילבוס.</div></section>`;
      const list = cat ? all.filter(x => x.category === cat) : all;
      const cnt = c => all.filter(x => x.category === c).length;
      const editor = x => `<form class="card editor" data-id="${x ? x.id : ''}">
        <div class="grid2"><div><label class="l">כותרת</label><input class="in" name="title" required maxlength="140" value="${esc(x ? x.title : '')}" placeholder="שם החומר"></div>
          <div><label class="l">קטגוריה</label><select class="in" name="category">${LIB_CATS.map(c => `<option ${x && x.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div></div>
        <label class="l" style="margin-top:12px">קישור</label><input class="in" name="url" dir="ltr" maxlength="500" value="${esc(x ? x.url : '')}" placeholder="https://...">
        <label class="l" style="margin-top:12px">למה כדאי (משפט או שניים)</label><textarea class="in" name="note" rows="2" maxlength="400">${esc(x ? x.note : '')}</textarea>
        <div class="row" style="margin-top:16px"><button class="btn pri" type="submit">שמירה</button><button class="btn" type="button" data-act="cancel">ביטול</button></div></form>`;
      const item = x => ed === x.id ? editor(x) : `<div class="item lib"><div class="grow" style="padding:6px 8px"><div class="row" style="gap:8px"><span class="pill d">${esc(x.category)}</span>${safeUrl(x.url) ? `<a href="${esc(safeUrl(x.url))}" target="_blank" rel="noopener noreferrer"><b>${esc(x.title)}</b></a>` : `<b>${esc(x.title)}</b>`}</div>${x.note ? `<div class="hint" style="margin-top:4px">${esc(x.note)}</div>` : ''}</div>
        ${isManager ? `<div class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sm" data-act="edit" data-id="${x.id}">עריכה</button><button class="rm" data-act="del" data-id="${x.id}" aria-label="מחיקה"></button></div>` : ''}</div>`;
      return `<section class="fr"><div class="sh"><div class="grow"><div class="eyebrow">${esc(g.city || '')} · ${esc(g.name)}</div><h2 class="t">ספריית השראה</h2>
          <p>${all.length ? `${all.length} חומרים שנאספו בשביל המסע: לקרוא, לצפות ולהתחבר לפני התחנות ואחריהן.` : 'כאן נאספים חומרי קריאה, הרצאות ונתונים שמלווים את המסע.'}</p></div></div>
        <div class="chips" style="margin-top:16px"><button class="chp ${cat ? '' : 'on'}" data-act="cat" data-c="">הכול · ${all.length}</button>${LIB_CATS.map(c => `<button class="chp ${cat === c ? 'on' : ''}" data-act="cat" data-c="${esc(c)}">${c} · ${cnt(c)}</button>`).join('')}</div></section>
        <section class="fr"><div class="list">${list.length ? list.map(item).join('') : `<div class="empty"><b>${all.length ? 'אין חומרים בקטגוריה הזו' : 'הספרייה ריקה'}</b>${isManager ? 'הוסיפו את החומר הראשון.' : 'המנהל.ת יוסיפו חומרים בהמשך.'}</div>`}</div>
          ${isManager ? (ed === 'new' ? `<div style="margin-top:14px">${editor(null)}</div>` : `<div class="row" style="margin-top:14px"><button class="btn pri" data-act="add">+ חומר חדש</button></div>`) : ''}</section>`;
    },
    after: (st, el) => {
      el.querySelectorAll('form.editor').forEach(f => f.onsubmit = async e => {
        e.preventDefault(); const btn = e.submitter; btn.disabled = true;
        const d = Object.fromEntries(new FormData(f).entries()), id = f.dataset.id;
        const url = d.url.trim();
        if (url && !safeUrl(url)) { toast('הקישור צריך להתחיל ב-https://'); btn.disabled = false; return; }
        const data = { title: d.title.trim(), category: d.category, url, note: d.note.trim() };
        try {
          if (id) await db.doc(`${base}/library/${id}`).set(data, { merge: true });
          else { const max = Math.max(0, ...(st.data.lib || []).map(s => s.order || 0)); await db.collection(base + '/library').doc().set({ ...data, order: max + 1, createdAt: Date.now() }); }
          st.ui.edit = null; toast('נשמר'); st.redraw();
        } catch (x) { toast('השמירה נכשלה'); btn.disabled = false; }
      });
    },
    acts: {
      cat(d, el, st, redraw) { st.ui.cat = d.c; redraw(); },
      add(d, el, st, redraw) { st.ui.edit = 'new'; redraw(); },
      edit(d, el, st, redraw) { st.ui.edit = d.id; redraw(); },
      cancel(d, el, st, redraw) { st.ui.edit = null; redraw(); },
      async del(d) { if (await confirmDialog('למחוק את החומר מהספרייה?', 'מחיקה')) db.doc(`${base}/library/${d.id}`).delete(); }
    }
  });
}
