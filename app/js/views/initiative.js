/* הובלת יוזמה: לוח קצר (כרטיס אחד: שם הפרויקט, ארבע תחנות, כפתור המשך), אזורים נפרדים לצוותים, לגלריית הפיצ׳ים ולניהול,
   ומרחב עבודה במסך מלא (initiative.html). האפיון המלא: docs/initiative-process-spec.md */
import { store } from '../store.js';
import { esc, toast, confirmDialog, createView, docs, byOrder } from '../ui.js';
import { WS_STATIONS, wsLabel, stationDone, firstOpenStation, continueTarget } from '../model.js';

export function mountInitiative(root, ctx, params = {}) {
  return params.tid ? mountWorkspace(root, ctx, params) : mountDashboard(root, ctx);
}

/* ---------- מרחב עבודה של צוות ---------- */
/* מסך מלא: ה-iframe הוא כל מה שמוצג. הכותרת, ארבע התחנות והחזרה ללוח נמצאות בתוכו (initiative.html). */
function mountWorkspace(root, ctx, { tid, step }) {
  const q = new URLSearchParams({ g: ctx.gid, t: tid }); if (step) q.set('step', step);
  root.innerHTML = `<iframe class="ws" title="מרחב העבודה של הצוות" src="${esc('initiative.html?' + q)}" allow="fullscreen"></iframe>`;
  document.body.classList.add('wsmode');
  return () => document.body.classList.remove('wsmode');
}

/* מה שהצוות ביקש לעשות בכל תחנה, כמשפט קצר ליד כפתור ההמשך */
const STATION_TASK = { problem: 'לנסח את הבעיה במשפט אחד', idea: 'לבחור רעיון אחד לנסות', pilot: 'למלא כרטיס ניסוי לבית הספר', learn: 'לענות על שלוש שאלות הלמידה' };

/* סרגל ארבע התחנות. שם התחנה פותח אותה; הסימון מוצג לקריאה בלבד (העורכ.ת מסמן.ת אותו בתוך מרחב העבודה).
   ✓ הושלמה · ● התחנה הבאה לעבודה · ○ טרם סומנה */
export function stationBarHTML(gid, t) {
  const nx = firstOpenStation(t);
  return `<nav class="sstrip" aria-label="ארבע תחנות">${WS_STATIONS.map(x => {
    const d = stationDone(t, x.id), cur = !!nx && nx.id === x.id;
    return `<a class="sst ${d ? 'done' : ''} ${cur ? 'cur' : ''}" href="#/g/${gid}/t/${t.id}?step=${x.main}" aria-label="${esc(x.label)}${d ? ', הושלמה' : ''}"><span class="hn" aria-hidden="true">${d ? '✓' : cur ? '●' : '○'}</span><b>${x.label}</b></a>`;
  }).join('')}</nav>`;
}
const marksLine = t => WS_STATIONS.map(x => `${stationDone(t, x.id) ? '✓' : '○'} ${x.label}`).join(' · ');

/* ---------- לוח הובלת יוזמה ---------- */
/* דף קצר: כרטיס אחד בראש (הפרויקט, ארבע התחנות, מה הוחלט והמשך), ומתחתיו אזורים נפרדים: צוותים, גלריית פיצ׳ים וניהול. */
function mountDashboard(root, ctx) {
  const { gid, isManager, me } = ctx, db = store.db, base = `groups/${gid}`;
  const myDoc = db.doc(`${base}/members/${me.uid}`);
  return createView(root, {
    watch: (st, sub) => {
      sub('teams', db.collection(base + '/teams'), docs);
      sub('members', db.collection(base + '/members'), docs);
      sub('stations', db.collection(base + '/stations'), docs);
    },
    render: st => {
      const teams = (st.data.teams || []).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)), members = st.data.members || [];
      const stations = (st.data.stations || []).sort(byOrder);
      const mine = !isManager && (members.find(m => m.id === me.uid) || {}).teamId;
      const myTeam = mine && teams.find(t => t.id === mine);
      const today = new Date().toISOString().slice(0, 10);
      const nextSyl = stations.find(s => s.step && s.date && s.date >= today);

      /* הצוות שמוצג בראש הלוח: של המשתתפת, ולמנהל.ת הצוות שבחר.ה (ברירת מחדל: הראשון) */
      const focus = myTeam || (isManager ? (teams.find(t => t.id === st.ui.viewTeam) || teams[0]) : null);
      const pitches = teams.filter(t => t.pitchTitle || t.pitchTagline || (t.progress || {}).pitch);

      const card = focus ? (() => {
        const ct = continueTarget(focus), nx = ct.station, mem = members.filter(m => m.teamId === focus.id);
        const started = !!firstOpenStation(focus) !== true || WS_STATIONS.some(x => stationDone(focus, x.id)) || Object.values(focus.progress || {}).some(Boolean);
        const decided = [['הבעיה', focus.problem || focus.definition], ['הרעיון שנבחר', focus.chosenIdea], ['הניסוי', focus.expWhat]].filter(r => r[1]);
        return `<section class="fr resume"><div class="eyebrow">${isManager ? 'צפייה בצוות' : 'הפרויקט שלי'}</div><h2 class="t">${esc(focus.name)}</h2>
          <div class="chips" style="margin-top:8px">${mem.length ? mem.map(m => `<span class="chip">${esc(m.name)}</span>`).join('') : '<span class="hint">אין עדיין חברים</span>'}</div>
          ${stationBarHTML(gid, focus)}
          ${decided.length ? `<dl class="decided">${decided.map(([l, v]) => `<dt>${l}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : '<p class="hint" style="margin-bottom:14px">הצוות עוד לא כתב החלטות. אחרי התחנה הראשונה הן יופיעו כאן.</p>'}
          <div class="next"><div class="grow"><div class="hint" style="font-weight:700">${nx ? (started ? 'הפעולה הבאה' : 'מתחילים כאן') : 'כל התחנות סומנו'}</div><div class="nt">${nx ? 'תחנה ' + (WS_STATIONS.indexOf(nx) + 1) + ' · ' + nx.label + ' · ' + STATION_TASK[nx.id] : 'אפשר לפתוח את תיק הפרויקט ולהציג אותו'}</div></div>
            <a class="btn pri big" href="#/g/${gid}/t/${focus.id}?step=${ct.step}">${ct.label}</a></div>
          ${nextSyl ? `<p class="hint" style="margin-top:12px">במפגש הבא בסילבוס (${esc(nextSyl.title)}) עובדים על: <b>${esc(wsLabel(nextSyl.step))}</b></p>` : ''}</section>`;
      })() : '';

      const noTeam = !isManager && !myTeam ? `<section class="fr"><div class="eyebrow">הובלת יוזמה</div><h2 class="t">בואו נתחיל: צוות אחד, יוזמה אחת</h2>
          <p style="margin:8px 0 14px">העבודה על היוזמה נעשית בצוות. פתחו צוות חדש, או הצטרפו לצוות שכבר פתוח.</p>
          <form id="newTeam" class="addrow"><input class="in" name="name" required maxlength="60" placeholder="שם לצוות, או לנושא היוזמה"><button class="btn pri" type="submit">פתיחת צוות</button></form>
          ${teams.length ? `<h3 class="s" style="margin-top:20px">או הצטרפו לצוות קיים</h3><div class="list" style="margin-top:8px">${teams.map(t => `<div class="item"><div class="grow"><b>${esc(t.name)}</b><div class="hint">${members.filter(m => m.teamId === t.id).map(m => esc(m.name)).join(' · ') || 'אין עדיין חברים'}</div></div><button class="btn sm pri" data-act="join" data-id="${t.id}">הצטרפות</button></div>`).join('')}</div>` : ''}</section>` : '';

      /* אזורים נפרדים: צוותים, גלריית פיצ׳ים, ניהול. נפתח אזור אחד בכל פעם. */
      const areas = [];
      if (teams.length && (myTeam || isManager)) areas.push(['teams', isManager ? 'כל הצוותים' : 'צוותים נוספים']);
      if (pitches.length) areas.push(['gallery', 'גלריית פיצ׳ים']);
      if (isManager) areas.push(['manage', 'ניהול הצוותים']);
      const area = areas.some(a => a[0] === st.ui.area) ? st.ui.area : (!focus && isManager ? 'manage' : '');
      const tabs = areas.length ? `<div class="seg areas" role="tablist" aria-label="אזורים בלוח">${areas.map(([k, l]) => `<button role="tab" aria-selected="${area === k}" class="${area === k ? 'on' : ''}" data-act="area" data-v="${k}">${l}</button>`).join('')}</div>` : '';

      const teamRow = t => {
        const mem = members.filter(m => m.teamId === t.id);
        return `<div class="item"><div class="grow"><b>${esc(t.name)}</b>${t.id === mine ? ' <span class="pill">הצוות שלי</span>' : ''}<div class="hint">${mem.map(m => esc(m.name)).join(' · ') || 'אין עדיין חברים'}</div>
          <div class="hint" style="margin-top:6px">${marksLine(t)}</div></div>
          <a class="btn sm" href="#/g/${gid}/t/${t.id}?step=${continueTarget(t).step}">${t.id === mine ? 'כניסה' : 'צפייה'}</a>
          ${isManager ? `<button class="btn sm" data-act="focus" data-id="${t.id}">הצגה בראש הלוח</button>` : ''}</div>`;
      };
      const rows = isManager ? teams : teams.filter(t => !focus || t.id !== focus.id);
      const areaBody = area === 'teams' ? `<div class="list">${rows.map(teamRow).join('') || '<div class="hint">אין צוותים נוספים</div>'}</div>`
        : area === 'gallery' ? pitchGallery(gid, pitches, members)
        : area === 'manage' ? `<form id="newTeam" class="addrow"><input class="in" name="name" required maxlength="60" placeholder="שם לצוות חדש"><button class="btn pri" type="submit">פתיחת צוות</button></form>
          ${teams.length ? `<div class="list" style="margin-top:12px">${teams.map(t => `<div class="item"><div class="grow">${esc(t.name)}</div><button class="btn sm" data-act="delTeam" data-id="${t.id}">מחיקה</button></div>`).join('')}</div>` : '<p class="hint" style="margin-top:12px">עוד לא נפתח צוות. משתתפות ומשתתפים יפתחו צוותים בעצמם, ואפשר גם לפתוח מכאן.</p>'}` : '';
      const areasSec = areas.length ? `<section class="fr" id="areasSec">${tabs}${areaBody ? `<div style="margin-top:16px" role="tabpanel">${areaBody}</div>` : ''}</section>` : '';

      const leave = !isManager && myTeam ? `<section class="fr tight"><div class="row"><span class="hint grow">${members.filter(m => m.teamId === myTeam.id).length} חברים בצוות</span><button class="btn sm" data-act="leave" data-id="${myTeam.id}">יציאה מהצוות</button></div></section>` : '';
      return `${card}${noTeam}${areasSec}${leave}
        ${isManager && !teams.length && !areas.length ? `<section class="fr"><div class="empty"><b>עוד לא נפתח צוות</b>משתתפות ומשתתפים יפתחו צוותים בעצמם.</div></section>` : ''}`;
    },
    after: (st, el) => {
      el.querySelectorAll('#newTeam').forEach(f => f.onsubmit = async e => {
        e.preventDefault(); const name = f.name.value.trim(); if (!name) return; e.submitter.disabled = true;
        try {
          const ref = db.collection(base + '/teams').doc();
          await ref.set({ name, createdBy: me.uid, createdAt: Date.now(), progress: {} });
          if (!isManager) await joinTeam(ref.id, st);
          toast('הצוות נפתח');
        } catch (x) { toast('פתיחת הצוות נכשלה'); e.submitter.disabled = false; }
      });
    },
    acts: {
      area(d, el, st, redraw) { st.ui.area = st.ui.area === d.v ? '' : d.v; redraw(); },
      focus(d, el, st, redraw) { st.ui.viewTeam = d.id; redraw(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
      async join(d, el, st) { try { await joinTeam(d.id, st); toast('הצטרפתם לצוות'); } catch (x) { toast('ההצטרפות נכשלה'); } },
      async leave(d, el, st) { if (await confirmDialog('לצאת מהצוות? העבודה שלו נשארת, ואפשר להצטרף שוב.', 'יציאה')) { try { await leaveTeam(d.id); } catch (x) { toast('היציאה נכשלה'); } } },
      async delTeam(d) { if (await confirmDialog('למחוק את הצוות? חברי הצוות יוצאו ממנו. נתוני העבודה לא יוצגו יותר.', 'מחיקה')) { try { await db.doc(`${base}/teams/${d.id}`).delete(); toast('הצוות נמחק'); } catch (x) { toast('המחיקה נכשלה'); } } }
    }
  });

  async function joinTeam(tid, st) {
    const cur = ((st.data.members || []).find(m => m.id === me.uid) || {}).teamId;
    if (cur && cur !== tid) await leaveTeam(cur);
    await db.doc(`${base}/teams/${tid}/roster/${me.uid}`).set({ name: me.name, at: Date.now() });
    await myDoc.set({ teamId: tid }, { merge: true });
  }
  async function leaveTeam(tid) {
    await myDoc.set({ teamId: null }, { merge: true });
    await db.doc(`${base}/teams/${tid}/roster/${me.uid}`).delete();
  }
}

/* גלריית פיצ׳ים: כל הצוותים שכתבו שם או משפט מרכזי, ליום ההצגה בסיום. */
function pitchGallery(gid, list, members) {
  return `<div class="row"><h3 class="s grow">גלריית פיצ׳ים</h3><span class="pill ${list.some(t => (t.progress || {}).pitch) ? '' : 'l'}">${list.filter(t => (t.progress || {}).pitch).length} מוכנים</span></div>
    <p class="hint" style="margin:4px 0 14px">היוזמות של הצוותים. פותחים צוות כדי לצפות בפיצ׳ ולהציג אותו במסך מלא.</p>
    <div class="igrid">${list.map(t => `<div class="card"><div class="row" style="gap:8px"><span class="pill ${(t.progress || {}).pitch ? '' : 'l'}">${(t.progress || {}).pitch ? 'פיצ׳ מוכן' : 'בכתיבה'}</span><span class="hint">${esc(t.name)}</span></div>
      <h3 class="s" style="margin-top:8px">${esc(t.pitchTitle || t.name)}</h3>${t.pitchTagline ? `<p style="margin-top:4px">${esc(t.pitchTagline)}</p>` : ''}${t.pitchHook ? `<p class="hint" style="margin-top:8px">״${esc(t.pitchHook)}״</p>` : ''}
      <div class="chips" style="margin-top:10px">${members.filter(m => m.teamId === t.id).map(m => `<span class="chip">${esc(m.name)}</span>`).join('')}</div>
      <div class="row" style="margin-top:12px"><a class="btn sm pri" href="#/g/${gid}/t/${t.id}?step=pitch">לפיצ׳ ולהצגה</a></div></div>`).join('')}</div>`;
}
