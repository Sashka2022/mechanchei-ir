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
const mode = devFlag ? 'local' : FIREBASE_CONFIG ? 'firebase' : 'unconfigured';
let db, auth, googleProvider;

async function init() {
  if (mode === 'unconfigured') throw Object.assign(new Error('האפליקציה עוד לא מחוברת לענן'), { code: 'not-configured' });
  if (mode === 'local') { const m = await import('../../dev/localdb.js'); db = m.createLocalDb(); auth = m.createLocalAuth(); return; }
  await loadScript(FIREBASE_SDK + 'firebase-app-compat.js');
  await Promise.all([loadScript(FIREBASE_SDK + 'firebase-auth-compat.js'), loadScript(FIREBASE_SDK + 'firebase-firestore-compat.js')]);
  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE_CONFIG);
  auth = firebase.auth(app); db = firebase.firestore(app);
  googleProvider = new firebase.auth.GoogleAuthProvider();
  await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
}

export const store = {
  mode,
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
  async signInParticipant() {
    if (auth.currentUser && auth.currentUser.isAnonymous) return auth.currentUser;
    const r = await auth.signInAnonymously(); return r.user || r;
  },
  signOut: () => auth.signOut()
};
