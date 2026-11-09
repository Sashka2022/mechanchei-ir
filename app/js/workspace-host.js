/* מחבר את מרחב העבודה של הצוות (initiative.html) לשכבת הנתונים של האפליקציה.
   סקריפט רגיל (לא מודול) כדי שיהיה מוכן לפני הסקריפט הראשי; הוא טוען את store.js דינמית.
   מחזיר ל-window.MHI_HOST הבטחה לאובייקט: { db (מצומצם לנתיב הצוות), me, names, isRoster, canWrite, local, step, report, gid, tid, isManager, teamName, back }. */
window.MHI_HOST = (async () => {
  const { store } = await import('./store.js');
  await store.ready;
  const q = new URLSearchParams(location.search), gid = q.get('g'), tid = q.get('t');
  const user = await store.authState();
  if (!user || !gid || !tid) throw new Error('no-session');
  const db = store.db, base = `groups/${gid}/teams/${tid}`;

  let team;
  try { team = await db.doc(base).get(); } catch (e) { throw new Error(e && e.code === 'permission-denied' ? 'forbidden' : 'load-failed'); }
  if (!team.exists) throw new Error('no-team');

  /* שמות חברי הקבוצה (לכותרות "נכתב על ידי") */
  const names = {};
  await new Promise(res => { let first = true; db.collection(`groups/${gid}/members`).onSnapshot(snap => { snap.docs.forEach(d => { names[d.id] = d.data().name || ''; }); if (first) { first = false; res(); } }, () => res()); });

  /* מנהל.ת: חשבון עם מייל, או כניסת קוד (אנונימית עם מסמך admins/{uid}) */
  const isManager = !user.isAnonymous || (store.mode !== 'local' && await db.doc('admins/' + user.uid).get().then(d => d.exists, () => false));
  const rosterDoc = await db.doc(`${base}/roster/${user.uid}`).get().catch(() => ({ exists: false }));
  /* בדיקות מקומיות בלבד: ?as=helper (מסייע.ת) או ?as=viewer (צופה) מדמים תפקידים שבמנוע המקומי לא קיימים */
  const sim = store.mode === 'local' ? q.get('as') || '' : '';
  const isRoster = sim === 'viewer' ? false : store.mode === 'local' ? true : !!rosterDoc.exists;
  const name = isManager ? (user.displayName || user.email || 'מנחה') : (names[user.uid] || '');

  return {
    db: { collection: col => db.collection(base + '/' + col) },
    me: { id: user.uid, name },
    names, isRoster, canWrite: isRoster || isManager,
    local: store.mode === 'local' && !sim, gid, tid, isManager, teamName: team.data().name || '',
    /* חזרה ללוח היוזמה של הקבוצה, באפליקציה שמארחת את המרחב (או ישירות אם הדף נפתח לבד) */
    back: () => { const h = '#/g/' + gid + '/initiative'; if (window.parent !== window) { try { parent.location.hash = h; return; } catch (e) {} } location.href = 'index.html' + h; },
    step: q.get('step') || '',
    report: obj => db.doc(base).set(obj, { merge: true }),
    /* מסמך הצוות בזמן אמת (לסימון תחנות משותף). מחזיר פונקציית ביטול. */
    watchTeam: (fn, err) => db.doc(base).onSnapshot(s => fn(s.exists ? s.data() : {}, s), err || (() => {})),
    team: team.data(),
    /* סימון תחנה כהושלמה או ביטול. ההבטחה נפתרת רק אחרי אישור כתיבה מהשרת. */
    setStationDone: (id, val) => db.doc(base).set({ stationsDone: { [id]: !!val } }, { merge: true })
  };
})();
