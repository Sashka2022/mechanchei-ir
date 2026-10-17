/* משתתפים וצוותים, למנהל.ת הקבוצה. */
import { store } from '../store.js';
import { esc, toast, confirmDialog, createView, docs, byOrder } from '../ui.js';
import { STAGES, wsLabel, fmtDate } from '../model.js';

export function mountPeople(root, ctx) {
  const { gid } = ctx, db = store.db, base = `groups/${gid}`;
  return createView(root, {
    watch: (st, sub) => { sub('members', db.collection(base + '/members'), docs); sub('teams', db.collection(base + '/teams'), docs); sub('stations', db.collection(base + '/stations'), docs); },
    render: st => {
      const members = (st.data.members || []).sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0)), teams = st.data.teams || [], stations = (st.data.stations || []).sort(byOrder);
      const att = m => stations.filter(s => (m.attended || {})[s.id]).length;
      const tname = id => (teams.find(t => t.id === id) || {}).name;
      const solo = members.filter(m => !tname(m.teamId)).length;
      return `<section class="fr"><div class="sh"><div class="grow"><div class="eyebrow">${esc(ctx.group.name)}</div><h2 class="t">משתתפים</h2>
          <p>${members.length === 1 ? 'משתתף.ת אחד.ת נכנס.ה' : members.length + ' נכנסו'} עם קוד הקבוצה${solo ? `, ${solo} עוד בלי צוות` : ''}.</p></div></div></section>
        <section class="fr"><div class="list">${members.length ? members.map(m => `<div class="item"><div class="grow" style="padding:8px 10px"><b>${esc(m.name)}</b><div class="hint">${tname(m.teamId) ? 'צוות · ' + esc(tname(m.teamId)) : 'עוד בלי צוות'}${stations.length ? ' · נכח.ה ב-' + att(m) + ' מתוך ' + stations.length + ' תחנות' : ''}</div></div><button class="rm" data-act="rmMember" data-id="${m.id}" aria-label="הסרה מהקבוצה"></button></div>`).join('') : '<div class="empty"><b>עוד לא נכנס אף אחד</b>שתפו את קוד הקבוצה מדף הבית.</div>'}</div></section>
        ${stations.length && members.length ? `<section class="fr"><h3 class="s">נוכחות בתחנות</h3><div class="tablewrap"><table class="g"><thead><tr><th>תחנה</th><th>מועד</th><th>נכחו</th><th></th></tr></thead><tbody>${stations.map(s => { const n = members.filter(m => (m.attended || {})[s.id]).length; return `<tr><td><b>${esc(s.title)}</b></td><td>${esc(fmtDate(s.date, s.time))}</td><td>${n} מתוך ${members.length}</td><td><div class="prog" style="margin:0;min-width:90px"><i style="width:${Math.round(n / members.length * 100)}%"></i></div></td></tr>`; }).join('')}</tbody></table></div><p class="hint" style="margin-top:10px">הנוכחות מסומנת על ידי המשתתפים בעצמם. היומן האישי והתשובות להכנה נשארים פרטיים.</p></section>` : ''}
        <section class="fr"><h3 class="s">התקדמות הצוותים</h3>${teams.length ? `<div class="tablewrap"><table class="g"><thead><tr><th>צוות</th><th>חקירה</th><th>רעיונות</th><th>תוכנית</th><th>פיצ׳</th><th>הגדרת הבעיה</th><th></th></tr></thead><tbody>${teams.map(t => {
          const p = t.progress || {}, n = STAGES[0].steps.filter(x => p[x]).length;
          return `<tr><td><b>${esc(t.name)}</b><div class="hint">${members.filter(m => m.teamId === t.id).map(m => esc(m.name)).join(', ') || 'אין חברים'}</div></td><td>${n} מתוך ${STAGES[0].steps.length}</td><td>${p.pilot ? 'נבחר פיילוט' : p.ideas ? 'יש רעיונות' : '—'}</td><td>${p.plan ? 'הושלמה' : ['toc', 'budget', 'partners'].filter(x => p[x]).length ? ['toc', 'budget', 'partners'].filter(x => p[x]).length + ' מתוך 3' : '—'}</td><td>${p.pitch ? 'מוכן' : '—'}</td><td>${t.definition ? esc(t.definition) : '<span class="hint">עוד לא הוגדרה</span>'}</td><td><a class="btn sm" href="#/g/${gid}/t/${t.id}">פתיחה</a></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty" style="margin-top:12px"><b>עוד לא נפתח צוות</b></div>'}</section>`;
    },
    acts: {
      async rmMember(d, el, st) {
        if (!(await confirmDialog('להסיר את המשתתף.ת מהקבוצה? הוא.היא יוכלו להיכנס שוב עם הקוד.', 'הסרה'))) return;
        const m = (st.data.members || []).find(x => x.id === d.id);
        try { if (m && m.teamId) await db.doc(`${base}/teams/${m.teamId}/roster/${d.id}`).delete(); await db.doc(`${base}/members/${d.id}`).delete(); toast('הוסר.ה'); } catch (x) { toast('ההסרה נכשלה'); }
      }
    }
  });
}
