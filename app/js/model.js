/* מודל התהליך: שלבי הובלת היוזמה, והמיפוי שלהם לפרוטוקול הגדרת הבעיה (אפליקציית עץ הבעיה).
   מקור האמת לאפיון נמצא ב-docs/initiative-process-spec.md. */

/* שבעת מסכי מרחב העבודה של הצוות. ה-id זהה ל-id של STEPS בקובץ initiative.html. */
export const WS_STEPS = [
  { id: 'setup',    label: 'הכנת המפגש' },
  { id: 'phen',     label: 'ניסוח תופעה בלתי רצויה',  n: 1 },
  { id: 'tree',     label: 'עץ הבעיה',               n: 2 },
  { id: 'insights', label: 'התבוננות בעץ והנחות',     n: 3 },
  { id: 'path',     label: 'בחירת נתיב קריטי',        n: 4 },
  { id: 'def',      label: 'הגדרת הבעיה',             n: 5 },
  { id: 'ideas',    label: 'רעיונות לפתרון',          n: 6 },
  { id: 'toc',      label: 'תיאוריית שינוי',          n: 7 },
  { id: 'budget',   label: 'מחולל תב״ר',              n: 8 },
  { id: 'partners', label: 'גיוס שותפים',             n: 9 },
  { id: 'pitch',    label: 'בונה פרזנטציה ופיצ׳',      n: 10 },
  { id: 'board',    label: 'לוח למליאה' }
];
export const wsLabel = id => (WS_STEPS.find(s => s.id === id) || {}).label || '';

/* ארבעה שלבי הובלת יוזמה. steps = מסכים בנויים; soon = כלים שעוד לא נבנו. */
export const STAGES = [
  { id: 's1', n: 1, title: 'חקירה וזיקוק הבעיה', desc: 'מגדירים בעיה אחת, חדה, שבוחרים לטפל בה.',
    steps: ['setup', 'phen', 'tree', 'insights', 'path', 'def', 'board'], gate: 'def',
    out: 'הגדרת בעיה והנחות יסוד' },
  { id: 's2', n: 2, title: 'רעיונואות ובחירת פיילוט', desc: 'מהגדרת הבעיה לרעיונות, להצבעה ולמועמד לפיילוט.',
    steps: ['ideas'], gate: 'pilot', out: 'רעיון (או שניים) שנבחרו לפיילוט' },
  { id: 's3', n: 3, title: 'תכנון היוזמה', desc: 'בונים תיאוריית שינוי, תקציב ושותפים לרעיון שנבחר.',
    steps: ['toc', 'budget', 'partners'], gate: 'plan', out: 'תוכנית יוזמה: תיאוריית שינוי, תקציב ושותפים' },
  { id: 's4', n: 4, title: 'אריזה והצגה', desc: 'אורזים את היוזמה להצגה בסיום התכנית.',
    steps: ['pitch'], gate: 'pitch', out: 'פיצ׳ של שלוש דקות ופרזנטציה מוכנה להצגה' }
];

export const LIB_CATS = ['יזמות', 'מנהיגות', 'הוגנות', 'סוגיות חינוכיות', 'נתוני העיר'];
/* קוד קבוצת ההדגמה: 4 ספרות, נכנסים איתו לקבוצת בדיקה פתוחה (נוצרת על ידי מנהל.ת על בדף ״הקבוצות שלי״). */
export const DEMO_CODE = '1111';
export const LAST_KEY = 'mhi-last-group';
export const CITIES = ['חיפה', 'בת ים', 'מרום הגליל'];
export const CITY_LOGOS = { 'חיפה': 'haifa', 'בת ים': 'bat-yam', 'מרום הגליל': 'merom-hagalil' };

/* קוד קבוצה: 6 תווים בלי תווים מבלבלים (0/O, 1/I/L) */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newCode() {
  const a = new Uint32Array(6); crypto.getRandomValues(a);
  return [...a].map(n => CODE_CHARS[n % CODE_CHARS.length]).join('');
}
export const normCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const showCode = c => (c || '').replace(/^(.{3})(.{3})$/, '$1-$2');

export const fmtDate = (d, t) => {
  if (!d) return 'מועד יעודכן';
  const dt = new Date(d + 'T12:00:00'); if (isNaN(dt)) return d;
  return dt.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }) + (t ? ' · ' + t : '');
};

/* סטטוס תחנה לפי תאריך: עברה / הבאה / עתידית */
export function stationStatus(stations, today = new Date().toISOString().slice(0, 10)) {
  const dated = stations.filter(s => s.date).sort((a, b) => a.date.localeCompare(b.date));
  const next = dated.find(s => s.date >= today);
  return s => !s.date ? 'upcoming' : s.date < today ? 'done' : (next && next.id === s.id ? 'current' : 'upcoming');
}
