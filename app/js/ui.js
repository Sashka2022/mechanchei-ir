export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const byOrder = (a, b) => (a.order || 0) - (b.order || 0) || (a.id < b.id ? -1 : 1);

let toastT;
export function toast(msg) {
  const t = $('#toast'); if (!t) return;
  $('span', t).textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2800);
}

export function confirmDialog(text, okLabel = 'אישור') {
  return new Promise(res => {
    const d = document.createElement('dialog'); d.className = 'dlg';
    d.innerHTML = `<p>${esc(text)}</p><div class="row" style="margin-top:18px"><button class="btn pri" value="ok">${esc(okLabel)}</button><button class="btn" value="no">ביטול</button></div>`;
    d.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { d.close(b.value); } });
    d.addEventListener('close', () => { res(d.returnValue === 'ok'); d.remove(); });
    document.body.appendChild(d); d.showModal();
  });
}

/* תצוגה חיה: נרשמת לנתונים, מצייירת מחדש כשהם משתנים, ומקשרת אירועי data-act.
   כל עוד מקלידים בתוך התצוגה, הציור מחדש נדחה כדי לא למחוק טקסט באמצע כתיבה. */
export function createView(root, { watch, render, acts = {}, after }) {
  const st = { data: {}, ui: {} };
  const unsubs = [];
  let timer = null, dirty = false;
  const keys = new Set(), loaded = new Set();
  const typing = () => { const a = document.activeElement; return a && root.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); };
  let forced = false;
  const draw = f => {
    forced = forced || !!f; clearTimeout(timer);
    timer = setTimeout(() => {
      if ([...keys].some(k => !loaded.has(k))) return;
      if (!forced && typing()) { dirty = true; return; }
      forced = false; dirty = false; root.innerHTML = render(st); if (after) after(st, root);
    }, 30);
  };
  const redraw = () => draw(true);
  st.redraw = redraw;
  const onFocusOut = () => setTimeout(() => { if (dirty && !typing()) draw(true); }, 120);
  const onClick = e => {
    const el = e.target.closest('[data-act]'); if (!el || !root.contains(el) || el.disabled) return;
    const f = acts[el.dataset.act]; if (f) { e.preventDefault(); f(el.dataset, el, st, redraw); }
  };
  const onChange = e => { const el = e.target.closest('[data-change]'); if (el && acts[el.dataset.change]) acts[el.dataset.change](el.dataset, el, st, redraw); };
  root.addEventListener('click', onClick); root.addEventListener('change', onChange); root.addEventListener('focusout', onFocusOut);
  const sub = (key, ref, map) => {
    keys.add(key);
    unsubs.push(ref.onSnapshot(snap => { st.data[key] = map ? map(snap) : snap; loaded.add(key); draw(); },
      err => { st.errors = Object.assign(st.errors || {}, { [key]: err }); loaded.add(key); draw(); }));
  };
  watch(st, sub);
  root.innerHTML = '<div class="fr loading">טוענים</div>';
  return () => { unsubs.forEach(u => u()); clearTimeout(timer); root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); root.removeEventListener('focusout', onFocusOut); };
}

export const docs = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
export const docData = snap => snap.exists ? { id: snap.id, ...snap.data() } : null;
export const form = el => Object.fromEntries(new FormData(el).entries());
