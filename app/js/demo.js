/* מצב הדגמה: הקוד 1111 בעמוד הכניסה פותח סביבת הדגמה מקומית שבה רואים את המערכת כמנהל.ת.
   הנתונים נשמרים בדפדפן הזה בלבד (מנוע dev/localdb.js), ואין בה שום גישה לקבוצות האמיתיות בענן. */
export const DEMO_KEY = 'mhi-demo';
export const DEMO_USER = { email: 'demo@mechanchei-ir.local', name: 'מנהל.ת הדגמה' };

export async function seedDemo(db, user) {
  if ((await db.doc('groups/demo').get()).exists) return;
  const email = (user.email || '').toLowerCase(), day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  await db.doc('groups/demo').set({ name: 'קבוצת הדגמה', city: 'חיפה', code: '1111', demo: true, ownerUid: user.uid, ownerEmail: email, ownerName: user.displayName || user.email || '', managerEmails: email ? [email] : [], published: true, createdAt: Date.now() });
  const st = [
    ['פתיחת המסע ושאלת המוצא', 'מפגש פתיחה: מכירים את הקבוצה, את העיר ואת התהליך.', 'בית הקבוצה', ['מה הייתם רוצים להשתנות בעיר?', 'מי בעיר יכול ללמד אתכם משהו שלא למדתם?'], '', 1],
    ['סיור בשכונה והתבוננות', 'הולכים ברגל, מתבוננים, ומתעדים מה רואים ומה חסר.', 'השכונה', ['מה תבדקו בדרך?', 'איזו תופעה תרצו להבין לעומק?'], 'phen', 8],
    ['עץ הבעיה בצוותים', 'כל צוות חופר לשורשי תופעה אחת ומתמקד בנתיב קריטי.', 'חדר הלמידה', ['איזו תופעה בחרתם?', 'מה הגורמים שאתם חושבים שחשובים?'], 'tree', 15],
    ['רעיונות לפתרון ובחירת פיילוט', 'מפתחים רעיונות, מצביעים ובוחרים מה מנסים קודם.', 'חדר הלמידה', ['איזה רעיון אתם רוצים לנסות?'], 'ideas', 22]
  ];
  for (let i = 0; i < st.length; i++) { const [title, description, place, prep, step, off] = st[i]; await db.doc('groups/demo/stations/d' + (i + 1)).set({ title, description, place, prep, step, date: day(off), time: '16:00 עד 19:00', readings: [], order: i + 1 }); }
  const lib = [['מדריך קצר ליזמות חברתית', 'יזמות', 'פתיח לפני התחנה הראשונה'], ['על מנהיגות מקומית', 'מנהיגות', 'סיפור של מי שהתחיל מהשכונה'], ['נתוני העיר במבט אחד', 'נתוני העיר', 'מספרים שכדאי להכיר לפני הסיור']];
  for (let i = 0; i < lib.length; i++) await db.doc('groups/demo/library/d' + (i + 1)).set({ title: lib[i][0], category: lib[i][1], note: lib[i][2], url: '', order: i + 1, createdAt: Date.now() });
  await db.doc('groups/demo/teams/t1').set({ name: 'צוות לדוגמה', createdBy: user.uid, createdAt: Date.now(), progress: {} });
}
