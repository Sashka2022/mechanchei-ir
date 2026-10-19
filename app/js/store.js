/* שכבת נתונים אחת לכל האפליקציה: Firestore (ענן) בלבד; מנוע מקומי רק למפתחים, ראו הערה למטה.
   שני המצבים חושפים את אותו ממשק (db.collection().doc()..., auth.onAuthStateChanged...). */
import { FIREBASE_CONFIG, FIREBASE_SDK, SUPER_ADMINS } from './config.js';

const loadScript = src => new Promise((res, rej) => {
  const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('נכשלה טעינת ' + src));
  document.head.appendChild(s);
});

/* האפליקציה עובדת רק מול Firebase. בלי קונפיגורציה היא מציגה מסך "לא מחוברת לענן" ולא שומרת כלום.
   חריג למפתחים בלבד: במחשב המקומי, אחרי פתיחת הכתובת עם ?dev=1, נטען מנוע בדיקות מקומי מתיקיית dev/ (ללא נתוני אמת). */
const onLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
try { const dv = new URLSearchParams(location.search).get('dev'); if (onLocalhost && dv === '1') localStorage.setItem('mhi-dev', '1'); else if (onLocalhost && dv === '0') localStorage.removeItem('mhi-dev'); } catch (e) {}
const devFlag = (() => { try { return onLocalhost && localStorage.getItem('mhi-dev') === '1'; } catch (e) { return false; } })();
/* הקוד 1111 בעמוד הכניסה מדליק מצב הדגמה: אותו מנוע מקומי, בכל דומיין, ובלי שום גישה לענן. */
const demoFlag = (() => { try { return localStorage.getItem('mhi-demo') === '1'; } catch (e) { return false; } })();
const mode = devFlag || demoFlag ? 'local' : FIREBASE_CONFIG ? 'firebase' : 'unconfigured';
let db, auth, googleProvider;

async function init() {
  if (mode === 'unconfigured') throw Object.assign(new Error('האפליקציה עוד לא מחוברת לענן'), { code: 'not-configured' });
  if (mode === 'local') { const m = await import('../../dev/localdb.js'); db = m.createLocalDb(); auth = m.createLocalAuth(); return; }
  await loadScript(FIREBASE_SDK + 'firebase-app-compat.js');
  await Promise.all([loadScript(FIREBASE_SDK + 'firebase-auth-compat.js'), loadScript(FIREBASE_SDK + 'firebase-firestore-compat.js')]);
  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE_CONFIG);
  auth = firebase.auth(app); db = firebase.firestore(app);
  googleProvider = new firebase.auth.GoogleAuthProvider();
  auth.languageCode = 'iw';   // מייל איפוס הסיסמה בעברית
  await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
}

/* חשבון בלי סיסמה: הסיסמה בפועל נגזרת מהמייל. מי שמגדיר.ה סיסמה מחליפ.ה אותה בסיסמה שלו.ה. */
const BAD_CREDS = ['auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-login-credentials', 'auth/user-not-found'];
async function defaultPw(email) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('mhi-open:' + email));
  return 'mhi-' + [...new Uint8Array(h)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const store = {
  mode,
  demo: demoFlag,
  ready: init(),
  get db() { return db; },
  get auth() { return auth; },
  get user() { return auth && auth.currentUser; },
  isSuper: u => !!(u && u.email && SUPER_ADMINS.includes(u.email.toLowerCase())),
  /* מחכה עד שמצב ההתחברות ידוע (אחרי טעינת הדף) */
  authState() { return new Promise(res => { const off = auth.onAuthStateChanged(u => { off(); res(u); }); }); },
  async signInManager(email, name) {
    if (mode === 'local') return auth.devManagerSignIn(email, name);
    const r = await auth.signInWithPopup(googleProvider); return r.user;
  },
  /* כניסת משתתף.ת עם מייל. בפעם הראשונה נפתח חשבון בלי סיסמה (הסיסמה הפנימית נגזרת מהמייל), ואפשר להגדיר סיסמה אחר כך.
     זורק שגיאה עם code: 'need-name' (כניסה ראשונה או סיסמה, חסר שם), 'need-password' או 'wrong-password'. */
  async signInParticipant(email, name, password) {
    const e = String(email || '').trim().toLowerCase();
    if (!e) throw Object.assign(new Error('missing-email'), { code: 'missing-email' });
    const def = await defaultPw(e);
    if (password) {
      try { return { user: (await auth.signInWithEmailAndPassword(e, password)).user }; }
      catch (x) { throw BAD_CREDS.includes(x.code) ? Object.assign(x, { code: 'wrong-password' }) : x; }
    }
    try { return { user: (await auth.signInWithEmailAndPassword(e, def)).user }; }
    catch (x) { if (!BAD_CREDS.includes(x.code)) throw x; }
    if (!name) throw Object.assign(new Error('need-name'), { code: 'need-name' });
    try {
      const r = await auth.createUserWithEmailAndPassword(e, def);
      await r.user.updateProfile({ displayName: name });
      return { user: r.user, isNew: true };
    } catch (x) { throw x.code === 'auth/email-already-in-use' ? Object.assign(x, { code: 'need-password' }) : x; }
  },
  /* הגדרת סיסמה, החלפה, או הסרה (next ריק = חזרה לכניסה בלי סיסמה). current = הסיסמה הנוכחית אם יש. */
  async changePassword(current, next) {
    const u = auth.currentUser, def = await defaultPw(u.email);
    try { await auth.signInWithEmailAndPassword(u.email, current || def); }
    catch (x) { throw BAD_CREDS.includes(x.code) ? Object.assign(x, { code: 'wrong-password' }) : x; }
    await auth.currentUser.updatePassword(next || def);
  },
  /* מייל איפוס סיסמה: מי שמקבל.ת אותו קובע.ת סיסמה חדשה */
  sendReset: email => auth.sendPasswordResetEmail(String(email || '').trim().toLowerCase()),
  signOut: () => auth.signOut()
};
