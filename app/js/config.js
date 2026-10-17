/* קונפיגורציה של האפליקציה.
   FIREBASE_CONFIG = null  ->  מצב הדגמה מקומי (הנתונים נשארים בדפדפן בלבד).
   כדי לעבור לעבודה אמיתית: ממלאים את האובייקט מתוך Firebase Console, הגדרות הפרויקט, "האפליקציות שלך". ראו SETUP.md. */
export const FIREBASE_CONFIG = null;
/* דוגמה:
export const FIREBASE_CONFIG = {
  apiKey: '...', authDomain: '...firebaseapp.com', projectId: '...', storageBucket: '...', messagingSenderId: '...', appId: '...'
};
*/

/* מנהל.ת על: מוסיף.ה מנהלי קבוצות ורואה את כל הקבוצות. חייב להיות זהה לרשימה ב-firestore.rules. */
export const SUPER_ADMINS = ['edu-design@tfi.org.il'];

export const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
