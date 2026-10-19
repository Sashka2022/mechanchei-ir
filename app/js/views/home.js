/* בית: למנהל.ת רשימת הקמה ותמונת מצב; למשתתף.ת התחנה הבאה והצוות שלי. */
import { store } from '../store.js';
import { esc, toast, confirmDialog, createView, docs, docData, byOrder } from '../ui.js';
import { fmtDate, stationStatus, STAGES } from '../model.js';

export function mountHome(root, ctx) {
  const { gid, isManager, me } = ctx, db = store.db, base = `groups/${gid}`;
  return createView(root, {
    watch: (st, sub) => {
      sub('group', db.doc(base), docData);
      sub('stations', db.collection(base + '/stations'), docs);
      sub('teams', db.collection(base + '/teams'), docs);
      sub('posts', db.collection(base + '/posts'), docs);
      if (isManager) { sub('members', db.collection(base + '/members'), docs); sub('entry', db.doc('cityGroups/' + ctx.group.city), docData); }
      else { sub('me', db.doc(`${base}/members/${me.uid}`), docData); sub('progress', db.collection(`${base}/members/${me.uid}/progress`), docs); }
    },
    render: st => {
      const g = st.data.group || ctx.group, stations = (st.data.stations || []).sort(byOrder), teams = st.data.teams || [];
      const posts = (st.data.posts || []).sort((a, b) => (b.at || 0) - (a.at || 0));
      return (isManager ? managerHome(g, stations, teams, st.data.members || [], gid, st.data.entry) : memberHome(g, stations, teams, st.data.me, st.data.progress || [], gid)) + postsHTML(posts, isManager);
    },
    after: (st, el) => {
      const f = el.querySelector('#newPost');
      if (f) f.onsubmit = async e => {
        e.preventDefault(); const t = f.text.value.trim(); if (!t) return; e.submitter.disabled = true;
        try { await db.collection(base + '/posts').doc().set({ text: t, at: Date.now(), by: me.name || '' }); f.reset(); toast('העדכון נשלח לקבוצה'); }
        catch (x) { toast('השליחה נכשלה'); }
        e.submitter.disabled = false;
      };
    },
    acts: {
      async delPost(d) { if (await confirmDialog('למחוק את העדכון?', 'מחיקה')) db.doc(`${base}/posts/${d.id}`).delete(); },
      copyLink(d) { navigator.clipboard.writeText(d.v).then(() => toast('הקישור הועתק'), () => toast('ההעתקה נחסמה בדפדפן')); }
    }
  });
}

function managerHome(g, stations, teams, members, gid, entry) {
  const steps = [
    ['מלאו את הסילבוס', stations.length ? `${stations.length} תחנות` : 'עוד אין תחנות', stations.length > 0, `#/g/${gid}/syllabus`, 'לסילבוס'],
    ['פרסמו למשתתפים', g.published ? 'המשתתפים רואים את המסע' : 'הסילבוס עדיין טיוטה', !!g.published, `#/g/${gid}/settings`, 'להגדרות'],
    ['הזמינו משתתפים', members.length ? (members.length === 1 ? 'משתתף.ת אחד.ת נכנס.ה' : `${members.length} משתתפים נכנסו`) : 'עוד לא נכנס אף אחד', members.length > 0, '', '']
  ];
  const inv = location.href.replace(/app\/.*$/, 'app/#/');
  const isEntry = !!(entry && entry.gid === gid);
  return `<section class="fr blue"><div class="hint" style="font-weight:700;opacity:1">כניסת משתתפים</div>
      <h2 class="t" style="margin-top:6px">בלי קוד, עם מייל</h2>
      <p style="margin:6px 0 16px">משתתפים נכנסים מדף הפתיחה: בוחרים את העיר <b>${esc(g.city || '')}</b> ומזינים את המייל שלהם, בלי קוד. בכניסה הראשונה הם כותבים גם שם, ואפשר להגדיר סיסמה אחר כך. מי ששכח.ה סיסמה: דף ״משתתפים״, ״איפוס סיסמה״.</p>
      ${isEntry ? '' : `<p style="margin:0 0 16px"><b>שימו לב:</b> הקבוצה הזו עוד לא קבוצת הכניסה של ${esc(g.city || '')}, ולכן משתתפים לא יכולים להצטרף אליה. <a href="#/g/${gid}/settings" style="color:inherit;text-decoration:underline">להגדרות</a></p>`}
      <div class="row"><button class="btn lt" data-act="copyLink" data-v="${esc(inv)}">העתקת קישור לאפליקציה</button></div></section>
    <section class="fr"><h3 class="s">הקמת הקבוצה</h3><div class="list" style="margin-top:12px">${steps.map(([t, d, ok, href, lab], i) => `<div class="item ${ok ? '' : ''}"><span class="hn">${ok ? '✓' : i + 1}</span><div class="grow" style="padding:6px 8px"><b>${t}</b><div class="hint">${d}</div></div>${href ? `<a class="btn sm" href="${href}">${lab}</a>` : ''}</div>`).join('')}</div></section>
    <div class="grid3 stats"><div class="stat"><b>${stations.length}</b>תחנות בסילבוס</div><div class="stat"><b>${members.length}</b>משתתפים</div><div class="stat"><b>${teams.length}</b>צוותי יוזמה</div></div>
    ${teams.length ? `<section class="fr"><div class="row"><h3 class="s grow">צוותי יוזמה</h3><a class="btn sm" href="#/g/${gid}/initiative">לכל הצוותים</a></div><div class="stack" style="gap:12px;margin-top:12px">${teams.slice(0, 4).map(t => teamLine(t, gid)).join('')}</div></section>` : ''}`;
}

function teamLine(t, gid) {
  const prog = t.progress || {}, total = STAGES[0].steps.length, dn = STAGES[0].steps.filter(s => prog[s]).length;
  return `<a class="card tline" href="#/g/${gid}/t/${t.id}"><b>${esc(t.name)}</b><div class="prog"><i style="width:${Math.round(dn / total * 100)}%"></i></div><span class="hint">${dn} מתוך ${total} שלבי חקירה הושלמו${t.definition ? '' : ''}</span></a>`;
}

function memberHome(g, stations, teams, meDoc, progress, gid) {
  const pub = !!g.published, st = stationStatus(stations), pmap = Object.fromEntries(progress.map(p => [p.id, p]));
  const next = stations.find(s => st(s) === 'current') || stations.find(s => st(s) === 'upcoming');
  const attended = stations.filter(s => (pmap[s.id] || {}).attended).length;
  const myTeam = meDoc && meDoc.teamId ? teams.find(t => t.id === meDoc.teamId) : null;
  return `<section class="fr blue"><div class="hint" style="font-weight:700;opacity:1">${esc(g.city || '')}</div><h2 class="t" style="margin-top:6px">${esc(g.name)}</h2>
      <p class="lede" style="margin-top:10px">שלום ${esc((meDoc && meDoc.name) || '')}, ברוכים הבאים.</p></section>
    ${!pub || !stations.length ? `<section class="fr"><div class="empty"><b>הסילבוס עוד לא פורסם</b>מנהל.ת הקבוצה מעדכנ.ת אותו, וכשיהיה מוכן המסע יופיע כאן.</div></section>`
      : `<section class="fr"><div class="row"><h3 class="s grow">${next && st(next) === 'current' ? 'התחנה הבאה' : 'התחנה הבאה במסע'}</h3><span class="pill l">${attended} מתוך ${stations.length} תחנות · נכחתי</span></div>
        ${next ? `<a class="card" style="display:block;margin-top:12px" href="#/g/${gid}/s/${next.id}"><div class="hint" style="font-weight:700">${esc(fmtDate(next.date, next.time))}${next.place ? ' · ' + esc(next.place) : ''}</div><h3 class="s" style="margin:4px 0">${esc(next.title)}</h3><p>${esc(next.description || '')}</p></a>` : '<div class="empty"><b>עברתם את כל התחנות</b></div>'}
        <div class="row" style="margin-top:14px"><a class="btn" href="#/g/${gid}/journey">לכל התחנות</a></div></section>`}
    <section class="fr"><h3 class="s">הובלת היוזמה</h3>${myTeam
      ? `<p class="hint" style="margin:4px 0 12px">הצוות שלכם: <b>${esc(myTeam.name)}</b></p>${teamLine(myTeam, gid)}<div class="row" style="margin-top:14px"><a class="btn pri" href="#/g/${gid}/t/${myTeam.id}">לכניסה למרחב העבודה</a></div>`
      : `<p style="margin:6px 0 14px">יוזמה מובילים בצוות. פתחו צוות חדש או הצטרפו לצוות שכבר קיים.</p><a class="btn pri" href="#/g/${gid}/initiative">לבחירת צוות</a>`}</section>`;
}

/* עדכונים מהמנהל.ת: מנהל.ת כותב.ת, כולם קוראים. שלושת האחרונים מוצגים, והישנים מתקפלים. */
const fmtPost = at => new Date(at).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
function postsHTML(posts, isManager) {
  if (!isManager && !posts.length) return '';
  const row = p => `<div class="item"><div class="grow" style="padding:8px 10px"><div class="hint" style="font-weight:700">${esc(fmtPost(p.at || Date.now()))}${p.by ? ' · ' + esc(p.by) : ''}</div><div style="white-space:pre-line;margin-top:2px">${esc(p.text)}</div></div>${isManager ? `<button class="rm" data-act="delPost" data-id="${p.id}" aria-label="מחיקת העדכון"></button>` : ''}</div>`;
  return `<section class="fr"><h3 class="s">${isManager ? 'עדכונים לקבוצה' : 'עדכונים מהמנהל.ת'}</h3>
    ${isManager ? `<form id="newPost" class="stack" style="gap:10px;margin:12px 0"><textarea class="in" name="text" rows="2" maxlength="600" required placeholder="הודעה למשתתפים: שינוי מקום, מה להביא, תזכורת"></textarea><div class="row"><button class="btn pri" type="submit">שליחה לקבוצה</button></div></form>` : ''}
    <div class="list" style="margin-top:12px">${posts.length ? posts.slice(0, 3).map(row).join('') : '<div class="empty"><b>עוד לא נשלח עדכון</b></div>'}</div>
    ${posts.length > 3 ? `<details class="guide" style="margin-top:12px"><summary>עדכונים קודמים (${posts.length - 3})</summary><div class="list" style="margin-top:12px">${posts.slice(3).map(row).join('')}</div></details>` : ''}</section>`;
}
