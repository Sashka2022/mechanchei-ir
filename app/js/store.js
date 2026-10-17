/* שכבת נתונים אחת לכל האפליקציה: Firestore אמיתי כשיש קונפיגורציה, אחרת הדגמה מקומית.
   שני המצבים חושפים את אותו ממשק (db.collection().doc()..., auth.onAuthStateChanged...). */
import { FIREBASE_CONFIG, FIREBASE_SDK, SUPER_ADMINS } from './config.js';
import { createLocalDb, createLocalAuth } from './localdb.js';

const loadScript = src => new Promise((res, rej) => {
  const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('נכשלה טעינת ' + src));
  document.head.appendChild(s);
});

const mode = FIREBASE_CONFIG ? 'firebase' : 'local';
let db, auth, googleProvider;

async function init() {
  if (mode === 'local') { db = createLocalDb(); auth = createLocalAuth(); return; }
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
    if (mode === 'local') return auth.demoManagerSignIn(email, name);
    const r = await auth.signInWithPopup(googleProvider); return r.user;
  },
  async signInParticipant() {
    if (auth.currentUser && auth.currentUser.isAnonymous) return auth.currentUser;
    const r = await auth.signInAnonymously(); return r.user || r;
  },
  signOut: () => auth.signOut()
};
