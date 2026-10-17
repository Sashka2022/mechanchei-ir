/* מחבר את מרחב העבודה של הצוות (initiative.html) לשכבת הנתונים של האפליקציה.
   סקריפט רגיל (לא מודול) כדי שיהיה מוכן לפני הסקריפט הראשי; הוא טוען את store.js דינמית.
   מחזיר ל-window.MHI_HOST הבטחה לאובייקט: { db (מצומצם לנתיב הצוות), me, names, isRoster, canWrite, local, step, report }. */
window.MHI_HOST = (async () => {
  const { store } = await import('./store.js');
  await store.ready;
  const q = new URLSearchParams(location.search), gid = q.get('g'), tid = q.get('t');
  const user = await store.authState();
  if (!user || !gid || !tid) throw new Error('no-session');
  const db = store.db, base = `groups/${gid}/teams/${tid}`;

  const team = await db.doc(base).get();
  if (!team.exists) throw new Error('no-team');

  /* שמות חברי הקבוצה (לכותרות "נכתב על ידי") */
  const names = {};
  await new Promise(res => { let first = true; db.collection(`groups/${gid}/members`).onSnapshot(snap => { snap.docs.forEach(d => { names[d.id] = d.data().name || ''; }); if (first) { first = false; res(); } }, () => res()); });

  const isManager = !user.isAnonymous;
  const rosterDoc = await db.doc(`${base}/roster/${user.uid}`).get().catch(() => ({ exists: false }));
  const isRoster = store.mode === 'local' ? true : !!rosterDoc.exists;
  const name = isManager ? (user.displayName || user.email || '') : (names[user.uid] || '');

  return {
    db: { collection: col => db.collection(base + '/' + col) },
    me: { id: user.uid, name },
    names, isRoster, canWrite: isRoster || isManager,
    local: store.mode === 'local',
    step: q.get('step') || '',
    report: obj => db.doc(base).set(obj, { merge: true })
  };
})();
