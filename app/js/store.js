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

/* משתתפים נכנסים בלי סיסמה בכלל. הסיסמה הפנימית נגזרת מהמייל, והמשתמש.ת לא רואה אותה.
   חשבונות חדשים נפתחים על כתובת פנימית (alias) שנגזרת מהמייל, כך שהם לא מתנגשים לעולם בחשבון קיים על אותו מייל
   (למשל חשבון Google של מנהל.ת, או חשבון ישן שהוגדרה לו סיסמה). חשבונות ותיקים על המייל עצמו ממשיכים לעבוד. */
const BAD_CREDS = ['auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-login-credentials', 'auth/user-not-found'];
const hex = async (s, n) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].slice(0, n).map(b => b.toString(16).padStart(2, '0')).join('');
const defaultPw = async email => 'mhi-' + await hex('mhi-open:' + email, 12);
const aliasEmail = async email => 'p-' + await hex('mhi-alias:' + email, 16) + '@mechanchei-ir-25939.firebaseapp.com';

export const store = {
  mode,
  demo: demoFlag,
  ready: init(),
  get db() { return db; },
  get auth() { return auth; },
  get user() { return auth && auth.currentUser; },
  isSuper: u => !!(u && ((u.email && SUPER_ADMINS.includes(u.email.toLowerCase())) || (u.isAnonymous && store.adminUid === u.uid))),
  /* מחכה עד שמצב ההתחברות ידוע (אחרי טעינת הדף) */
  authState() { return new Promise(res => { const off = auth.onAuthStateChanged(u => { off(); res(u); }); }); },
  async signInManager(email, name) {
    if (mode === 'local') return auth.devManagerSignIn(email, name);
    const r = await auth.signInWithPopup(googleProvider); return r.user;
  },
  /* כניסת מנהלים עם קוד אחד: כניסה אנונימית, ואז כתיבת הקוד למסמך admins/{uid}. הכללים מאשרים את המסמך רק עם הקוד הנכון. */
  adminUid: null,
  async signInAdmin(code) {
    if (auth.currentUser && !auth.currentUser.isAnonymous) await auth.signOut();
    const u = auth.currentUser || (await auth.signInAnonymously()).user;
    try { await db.doc('admins/' + u.uid).set({ code: String(code || '').trim() }); }
    catch (x) { if (x.code === 'permission-denied') throw Object.assign(x, { code: 'wrong-code' }); throw x; }
    store.adminUid = u.uid; return u;
  },
  /* כניסת משתתף.ת עם מייל בלבד, בלי סיסמה. סדר: חשבון alias (כל החשבונות החדשים), חשבון ותיק על המייל עצמו, ואם אין, פתיחת alias.
     זורק code: 'need-name' כשזו כניסה ראשונה ולא נכתב שם. */
  async signInParticipant(email, name) {
    const e = String(email || '').trim().toLowerCase();
    if (!e) throw Object.assign(new Error('missing-email'), { code: 'missing-email' });
    const def = await defaultPw(e), alias = await aliasEmail(e);
    const tryIn = async addr => { try { return (await auth.signInWithEmailAndPassword(addr, def)).user; } catch (x) { if (BAD_CREDS.includes(x.code)) return null; throw x; } };
    const named = async u => { if (name && u.displayName !== name) { try { await u.updateProfile({ displayName: name }); } catch (x) {} } return u; };
    let u = await tryIn(alias);
    if (u) return { user: await named(u) };
    u = await tryIn(e);   // חשבונות שנפתחו לפני המעבר ל-alias
    if (u) return { user: await named(u) };
    if (!name) throw Object.assign(new Error('need-name'), { code: 'need-name' });
    const r = await auth.createUserWithEmailAndPassword(alias, def);
    await r.user.updateProfile({ displayName: name });
    return { user: r.user, isNew: true };
  },
  signOut: () => auth.signOut()
};
