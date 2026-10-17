/* הובלת יוזמה: ארבעה שלבים, צוותים בתוך הקבוצה, ומרחב עבודה לכל צוות (initiative.html).
   האפיון המלא: docs/initiative-process-spec.md */
import { store } from '../store.js';
import { esc, toast, confirmDialog, createView, docs, docData, byOrder } from '../ui.js';
import { STAGES, WS_STEPS, wsLabel, wsStep } from '../model.js';

export function mountInitiative(root, ctx, params = {}) {
  return params.tid ? mountWorkspace(root, ctx, params) : mountDashboard(root, ctx);
}

/* ---------- מרחב עבודה של צוות ---------- */
/* ה-iframe נוצר פעם אחת. רק כותרת הצוות (מעליו) נטענת מחדש כשהנתונים משתנים, כדי שהעבודה לא תיפסק. */
function mountWorkspace(root, ctx, { tid, step }) {
  const { gid } = ctx, db = store.db, base = `groups/${gid}`;
  const q = new URLSearchParams({ g: gid, t: tid }); if (step) q.set('step', step);
  root.innerHTML = `<div id="wsHead"></div><iframe class="ws" title="מרחב העבודה של הצוות" src="${esc('initiative.html?' + q)}"></iframe>`;
  return createView(root.querySelector('#wsHead'), {
    watch: (st, sub) => { sub('team', db.doc(`${base}/teams/${tid}`), docData); sub('members', db.collection(base + '/members'), docs); },
    render: st => {
      const t = st.data.team; if (!t) return `<section class="fr"><div class="empty"><b>הצוות לא נמצא</b><a class="btn" href="#/g/${gid}/initiative">חזרה לצוותים</a></div></section>`;
      const mem = (st.data.members || []).filter(m => m.teamId === tid);
      return `<section class="fr tight"><div class="row"><a class="btn sm" href="#/g/${gid}/initiative">→ הובלת יוזמה</a><h3 class="s grow">${esc(t.name)}</h3>${mem.map(m => `<span class="chip">${esc(m.name)}</span>`).join('')}</div></section>`;
    }
  });
}

/* ---------- לוח הובלת יוזמה ---------- */
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
      const viewTeam = isManager ? (teams.find(t => t.id === st.ui.viewTeam) || teams[0]) : null;
      const stationsFor = sid => stations.filter(s => s.step === sid).map(s => s.title);
      const stageStatus = (t, sg) => { if (!sg.steps) return 'soon'; if (!t) return 'idle'; const p = t.progress || {}; if (p[sg.gate]) return 'done'; return sg.steps.some(x => p[x]) ? 'current' : 'idle'; };
      const stageCard = sg => {
        const stat = stageStatus(myTeam || viewTeam, sg);
        return `<div class="card stage ${stat}"><div class="row" style="flex-wrap:nowrap;align-items:flex-start"><span class="hn big">${stat === 'done' ? '✓' : sg.n}</span><div class="grow"><h3 class="s">${sg.title}</h3><p class="hint" style="margin-top:2px">${sg.desc}</p></div>${stat === 'soon' ? '<span class="pill l">בקרוב</span>' : ''}</div>
          ${sg.steps ? `<div class="stepl">${sg.steps.map(s => {
            const ok = (myTeam || viewTeam) && (myTeam || viewTeam).progress && (myTeam || viewTeam).progress[s], ws = wsStep(s), tgt = myTeam || (isManager && viewTeam), at = stationsFor(s);
            const go = tgt ? `<a class="btn sm pri" href="#/g/${gid}/t/${tgt.id}?step=${s}">${myTeam ? 'כניסה לשלב' : 'צפייה בשלב'}</a>` : `<button type="button" class="btn sm" data-act="needTeam">${isManager ? 'פתחו צוות כדי לצפות במסך' : 'צריך קודם צוות'}</button>`;
            return `<details class="stepd ${ok ? 'ok' : ''}"><summary><span class="hn ${ok ? 'on' : ''}">${ok ? '✓' : ws.n || '·'}</span><span class="grow"><b>${ws.label}</b><span class="hint">${ws.desc || ''}</span></span></summary>
              <div class="stepb"><ul>${(ws.do || []).map(x => `<li>${x}</li>`).join('')}</ul>${at.length ? `<p class="hint">נלמד בתחנה: ${esc(at.join(' · '))}</p>` : ''}<div class="row">${go}</div></div></details>`;
          }).join('')}</div>` : `<div class="chips" style="margin-top:14px">${sg.soon.map(x => `<span class="chp">${x}</span>`).join('')}</div>`}
          <div class="hint" style="margin-top:12px"><b>התוצר:</b> ${sg.out}</div></div>`;
      };
      const tcard = t => {
        const mem = members.filter(m => m.teamId === t.id), prog = t.progress || {}, total = STAGES[0].steps.length, dn = STAGES[0].steps.filter(s => prog[s]).length;
        const isMine = mine === t.id;
        return `<div class="card tcard ${isMine ? 'mine' : ''}"><div class="row" style="flex-wrap:nowrap;align-items:flex-start"><div class="grow"><h3 class="s">${esc(t.name)}</h3><div class="chips" style="margin-top:8px">${mem.length ? mem.map(m => `<span class="chip">${esc(m.name)}</span>`).join('') : '<span class="hint">אין עדיין חברים</span>'}</div></div>${isMine ? '<span class="pill">הצוות שלי</span>' : ''}</div>
          <div class="prog" style="margin:14px 0 6px"><i style="width:${Math.round(dn / total * 100)}%"></i></div><div class="hint">${dn} מתוך ${total} שלבי חקירה הושלמו${prog.ideas ? '' : ''}</div>
          ${t.definition ? `<div class="defmini">${esc(t.definition)}</div>` : ''}
          <div class="row" style="margin-top:14px"><a class="btn sm ${isMine ? 'pri' : ''}" href="#/g/${gid}/t/${t.id}">${isMine ? 'כניסה למרחב העבודה' : 'צפייה במרחב'}</a>
            ${!isManager && !isMine ? `<button class="btn sm" data-act="join" data-id="${t.id}">הצטרפות</button>` : ''}${isMine ? `<button class="btn sm" data-act="leave" data-id="${t.id}">יציאה מהצוות</button>` : ''}
            ${isManager ? `<button class="btn sm" data-act="delTeam" data-id="${t.id}">מחיקה</button>` : ''}</div></div>`;
      };
      return `<section class="fr"><div class="sh"><div class="grow"><div class="eyebrow">מסלול הובלת יוזמה</div><h2 class="t">מהכאב אל היוזמה</h2>
          <p>מגדירים בעיה לפי פרוטוקול הגדרת בעיה, מגיעים לרעיונות ובוחרים פיילוט, ואז בונים תוכנית ואורזים להצגה. כל צוות עובד על יוזמה אחת.</p></div></div></section>
        <section class="fr"><div class="row" style="margin-bottom:14px"><h3 class="s grow">ארבעה שלבים</h3>${isManager && teams.length ? `<label class="row" style="gap:8px"><span class="hint">צפייה בשלבים של הצוות</span><select class="in" data-change="viewTeam" style="width:auto;min-width:180px">${teams.map(t => `<option value="${t.id}" ${viewTeam && viewTeam.id === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>` : ''}</div><div class="grid2">${STAGES.map(stageCard).join('')}</div></section>
        ${pitchGallery(teams, members)}
        <section class="fr" id="teamsSec"><div class="row"><h3 class="s grow">צוותי היוזמה בקבוצה</h3></div>
          ${teams.length ? `<div class="igrid" style="margin-top:14px">${teams.map(tcard).join('')}</div>` : `<div class="empty" style="margin-top:12px"><b>עוד לא נפתח צוות</b>${isManager ? 'משתתפים יפתחו צוותים בעצמם, ואפשר גם לפתוח מכאן.' : 'פתחו את הצוות הראשון, והזמינו חברים להצטרף.'}</div>`}
          <form id="newTeam" class="addrow"><input class="in" name="name" required maxlength="60" placeholder="שם לצוות, או לנושא היוזמה"><button class="btn pri" type="submit">${isManager ? 'פתיחת צוות' : 'פתיחת צוות והצטרפות'}</button></form></section>`;
    },
    after: (st, el) => {
      const f = el.querySelector('#newTeam');
      if (f) f.onsubmit = async e => {
        e.preventDefault(); const name = f.name.value.trim(); if (!name) return; e.submitter.disabled = true;
        try {
          const ref = db.collection(base + '/teams').doc();
          await ref.set({ name, createdBy: me.uid, createdAt: Date.now(), progress: {} });
          if (!isManager) await joinTeam(ref.id, st);
          toast('הצוות נפתח');
        } catch (x) { toast('פתיחת הצוות נכשלה'); e.submitter.disabled = false; }
      };
    },
    acts: {
      viewTeam(d, el, st, redraw) { st.ui.viewTeam = el.value; redraw(); },
      needTeam() { toast(isManager ? 'עוד אין צוות לפתוח. פתחו צוות למטה' : 'כדי להיכנס לשלב צריך צוות. פתחו צוות או הצטרפו לצוות קיים'); const t = document.getElementById('teamsSec'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
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
function pitchGallery(teams, members) {
  const gid = location.hash.split('/')[2];
  const list = teams.filter(t => t.pitchTitle || t.pitchTagline || (t.progress || {}).pitch);
  if (!list.length) return '';
  return `<section class="fr"><div class="row"><h3 class="s grow">גלריית פיצ׳ים</h3><span class="pill ${list.some(t => (t.progress || {}).pitch) ? '' : 'l'}">${list.filter(t => (t.progress || {}).pitch).length} מוכנים</span></div>
    <p class="hint" style="margin:4px 0 14px">היוזמות של הצוותים. פותחים צוות כדי לצפות בפיצ׳ ולהציג אותו במסך מלא.</p>
    <div class="igrid">${list.map(t => `<div class="card"><div class="row" style="gap:8px"><span class="pill ${(t.progress || {}).pitch ? '' : 'l'}">${(t.progress || {}).pitch ? 'פיצ׳ מוכן' : 'בכתיבה'}</span><span class="hint">${esc(t.name)}</span></div>
      <h3 class="s" style="margin-top:8px">${esc(t.pitchTitle || t.name)}</h3>${t.pitchTagline ? `<p style="margin-top:4px">${esc(t.pitchTagline)}</p>` : ''}${t.pitchHook ? `<p class="hint" style="margin-top:8px">״${esc(t.pitchHook)}״</p>` : ''}
      <div class="chips" style="margin-top:10px">${members.filter(m => m.teamId === t.id).map(m => `<span class="chip">${esc(m.name)}</span>`).join('')}</div>
      <div class="row" style="margin-top:12px"><a class="btn sm pri" href="#/g/${gid}/t/${t.id}?step=pitch">לפיצ׳ ולהצגה</a></div></div>`).join('')}</div></section>`;
}
