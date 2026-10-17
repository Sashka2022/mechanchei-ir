/* קונפיגורציה של האפליקציה.
   FIREBASE_CONFIG = null  ->  האפליקציה מציגה "לא מחוברת לענן" ולא שומרת נתונים.
   מילוי: Firebase Console, הגדרות הפרויקט, "האפליקציות שלך". ראו SETUP.md. */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBCAdPYgnJwhlG-KPH-qY7c7J-klIhyvy8',
  authDomain: 'mechanchei-ir-25939.firebaseapp.com',
  projectId: 'mechanchei-ir-25939',
  storageBucket: 'mechanchei-ir-25939.firebasestorage.app',
  messagingSenderId: '864161914700',
  appId: '1:864161914700:web:16410900afdb0aa3d7f9e9'
};
/* מפתח ה-API של Firebase ציבורי מטבעו. האבטחה נשענת על firestore.rules ועל הדומיינים המורשים בהגדרות Authentication. */

/* מנהל.ת על: מוסיף.ה מנהלי קבוצות ורואה את כל הקבוצות. חייב להיות זהה לרשימה ב-firestore.rules. */
export const SUPER_ADMINS = ['edu-design@tfi.org.il', 'tovtuv@gmail.com'];

export const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
