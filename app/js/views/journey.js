/* מסע התחנות: רשימת התחנות (מהסילבוס שמילא המנהל.ת) ופירוט תחנה עם הכנה, נוכחות ורפלקציה אישית. */
import { store } from '../store.js';
import { esc, toast, createView, docs, docData, byOrder } from '../ui.js';
import { fmtDate, stationStatus, wsLabel } from '../model.js';

const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '';

export function mountJourney(root, ctx, { sid }) {
  const { gid, isManager, me } = ctx, db = store.db, base = `groups/${gid}`;
  const pbase = `${base}/members/${me.uid}/progress`;
  return createView(root, {
    watch: (st, sub) => {
      sub('group', db.doc(base), docData);
      sub('stations', db.collection(base + '/stations'), docs);
      sub('teams', db.collection(base + '/teams'), docs);
      if (!isManager) { sub('me', db.doc(`${base}/members/${me.uid}`), docData); sub('progress', db.collection(pbase), docs); }
    },
    render: st => {
      const g = st.data.group || ctx.group, list = (st.data.stations || []).sort(byOrder);
      const pmap = Object.fromEntries((st.data.progress || []).map(p => [p.id, p]));
      const status = stationStatus(list);
      if (!isManager && !g.published) return `<section class="fr"><div class="empty"><b>הסילבוס עוד לא פורסם</b>מנהל.ת הקבוצה מעדכנ.ת אותו.</div></section>`;
      const sel = sid && list.find(s => s.id === sid);
      return sel ? detail(sel, list, status, pmap[sel.id] || {}, st) : overview(list, status, pmap, g);
    },
    acts: {
      async attend(d, el, st) {
        if (isManager) return;
        const cur = !!((st.data.progress || []).find(p => p.id === d.id) || {}).attended;
        await db.doc(`${pbase}/${d.id}`).set({ attended: !cur }, { merge: true });
      }
    },
    after: (st, el) => {
      el.querySelectorAll('[data-save]').forEach(t => t.addEventListener('change', async () => {
        if (isManager) return;
        const [kind, i] = t.dataset.save.split(':');
        try {
          await db.doc(`${pbase}/${t.dataset.sid}`).set(kind === 'reflection' ? { reflection: t.value } : { answers: { [i]: t.value } }, { merge: true });
          toast('נשמר');
        } catch (x) { toast('השמירה נכשלה'); }
      }));
    }
  });

  function overview(list, status, pmap, g) {
    const done = list.filter(s => (pmap[s.id] || {}).attended).length;
    return `<section class="fr"><div class="sh"><div class="grow"><div class="eyebrow">${esc(g.city || '')} · ${esc(g.name)}</div><h2 class="t">מסע התחנות</h2>
        <p>${list.length} תחנות. לכל תחנה יש הכנה לפני, ומקום לכתוב אחריה.</p></div></div>
        ${!isManager && list.length ? `<div class="prog" style="margin:16px 0 0"><i style="width:${Math.round(done / list.length * 100)}%"></i></div><div class="hint" style="margin-top:6px">נכחתי ב-${done} מתוך ${list.length}</div>` : ''}
        ${isManager && !g.published ? `<div class="notice purple" style="margin-top:16px"><b>תצוגה מקדימה</b><span>הסילבוס עדיין טיוטה, והמשתתפים לא רואים אותו.</span></div>` : ''}</section>
      <section class="fr"><div class="list">${list.length ? list.map((s, i) => { const k = status(s); const att = (pmap[s.id] || {}).attended;
        return `<a class="item stn ${k}" href="#/g/${gid}/s/${s.id}"><span class="hn">${att ? '✓' : i + 1}</span><div class="grow" style="padding:4px 8px"><b>${esc(s.title)}</b><div class="hint">${esc(fmtDate(s.date, s.time))}${s.place ? ' · ' + esc(s.place) : ''}</div></div>
        <span class="pill ${k === 'current' ? '' : k === 'done' ? 'd' : 'l'}">${k === 'current' ? 'התחנה הבאה' : k === 'done' ? 'התקיימה' : 'בהמשך'}</span></a>`; }).join('') : '<div class="empty"><b>עוד אין תחנות</b></div>'}</div></section>`;
  }

  function detail(s, list, status, p, st) {
    const i = list.indexOf(s), prev = list[i - 1], next = list[i + 1];
    const team = !isManager && st.data.me && st.data.me.teamId;
    const answers = p.answers || {};
    return `<section class="fr"><a class="hint" href="#/g/${gid}/journey">${'→'} לכל התחנות</a>
        <div class="sh" style="margin-top:12px"><div class="num"><span style="font-weight:900;font-size:28px;color:var(--on)">${i + 1}</span></div><div class="grow"><div class="eyebrow">${esc(fmtDate(s.date, s.time))}${s.place ? ' · ' + esc(s.place) : ''}</div>
        <h2 class="t">${esc(s.title)}</h2><p>${esc(s.description || '')}</p></div></div></section>
      ${s.step ? `<section class="fr blue"><div class="hint" style="font-weight:700;opacity:1">בתחנה הזו עובדים על</div><h3 class="s" style="margin:4px 0 12px">${esc(wsLabel(s.step))}</h3>
        <a class="btn lt" href="#/g/${gid}/${team ? 't/' + team + '?step=' + s.step : 'initiative'}">${team ? 'לפתיחת השלב במרחב הצוות' : 'לבחירת צוות יוזמה'}</a></section>` : ''}
      ${(s.prep || []).length ? `<section class="fr"><h3 class="s">הכנה לתחנה</h3><p class="hint" style="margin:4px 0 14px">שאלות לחשוב עליהן לפני שמגיעים. התשובות פרטיות, רק אתם רואים אותן.</p>
        <div class="stack" style="gap:14px">${s.prep.map((q, k) => `<div><label class="l">${k + 1}. ${esc(q)}</label>${isManager ? '' : `<textarea class="in" rows="2" data-save="answer:${k}" data-sid="${s.id}" placeholder="התשובה שלכם">${esc(answers[k] || '')}</textarea>`}</div>`).join('')}</div></section>` : ''}
      ${(s.readings || []).length ? `<section class="fr"><h3 class="s">חומרי קריאה והשראה</h3><ul class="plain" style="margin-top:12px">${s.readings.map(r => `<li>${safeUrl(r.url) ? `<a href="${esc(safeUrl(r.url))}" target="_blank" rel="noopener noreferrer">${esc(r.title)}</a>` : esc(r.title)}</li>`).join('')}</ul></section>` : ''}
      ${isManager ? '' : `<section class="fr"><div class="row"><h3 class="s grow">אחרי התחנה</h3><button class="btn ${p.attended ? 'pri' : ''}" data-act="attend" data-id="${s.id}" aria-pressed="${!!p.attended}">${p.attended ? '✓ נכחתי' : 'סימון נוכחות'}</button></div>
        <label class="l" style="margin-top:14px">מה לקחתי מהתחנה? (יומן אישי)</label><textarea class="in" rows="4" data-save="reflection:0" data-sid="${s.id}" placeholder="תובנות, שאלות שנשארו, רעיונות">${esc(p.reflection || '')}</textarea></section>`}
      <div class="nav">${prev ? `<a class="btn" href="#/g/${gid}/s/${prev.id}">→ ${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a class="btn pri" href="#/g/${gid}/s/${next.id}">${esc(next.title)} ←</a>` : '<span></span>'}</div>`;
  }
}
