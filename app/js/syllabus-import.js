/* ייבוא סילבוס ממסמך אחד: קורא Word (docx), טקסט או Markdown, ומפרק לתחנות.
   כל כותרת "תחנה N" (או כותרת מסמך, או מספור) פותחת תחנה חדשה. בתוך תחנה מזהים שדות לפי תווית:
   מקום, תאריך, שעה, שאלות הכנה, חומרי קריאה, שלב בתהליך. כל מה שנשאר הופך לתיאור. */
import { WS_STEPS } from './model.js';

/* ---------- קריאת קובץ ---------- */
export async function readSyllabusFile(file) {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.docx')) return docxToText(await file.arrayBuffer());
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return pdfToText(await file.arrayBuffer());
  if (/\.(txt|md|markdown|text)$/.test(name) || file.type.startsWith('text/')) return file.text();
  throw new Error(name.endsWith('.doc') ? 'קובץ doc ישן. שמרו אותו כ-docx או הדביקו את הטקסט.' : 'סוג הקובץ לא נתמך. אפשר docx, pdf, txt או הדבקת טקסט.');
}

async function inflateRaw(bytes) {
  const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

async function unzipEntry(buf, wanted) {
  const v = new DataView(buf), u8 = new Uint8Array(buf);
  let e = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('הקובץ אינו מסמך Word תקין');
  let p = v.getUint32(e + 16, true); const n = v.getUint16(e + 10, true), td = new TextDecoder();
  for (let k = 0; k < n; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
    const nm = td.decode(u8.subarray(p + 46, p + 46 + nl));
    if (nm === wanted) {
      const lh = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true), data = u8.subarray(lh, lh + csize);
      return td.decode(method === 0 ? data : await inflateRaw(data));
    }
    p += 46 + nl + xl + cl;
  }
  return null;
}

async function docxToText(buf) {
  const xml = await unzipEntry(buf, 'word/document.xml');
  if (!xml) throw new Error('לא נמצא טקסט במסמך');
  const rels = {}, relXml = await unzipEntry(buf, 'word/_rels/document.xml.rels');
  if (relXml) new DOMParser().parseFromString(relXml, 'application/xml').querySelectorAll('Relationship').forEach(r => { rels[r.getAttribute('Id')] = r.getAttribute('Target'); });
  const doc = new DOMParser().parseFromString(xml, 'application/xml'), W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const runText = el => { let t = ''; el.childNodes.forEach(c => { if (c.localName === 't') t += c.textContent; else if (c.localName === 'tab') t += ' '; else if (c.localName === 'br') t += '\n'; }); return t; };
  const out = [];
  for (const p of doc.getElementsByTagNameNS(W, 'p')) {
    let t = '';
    for (const c of p.childNodes) {
      if (c.localName === 'r') t += runText(c);
      else if (c.localName === 'hyperlink') {
        const txt = [...c.getElementsByTagNameNS(W, 'r')].map(runText).join(''), url = rels[c.getAttributeNS(R, 'id')];
        t += url && /^https?:/.test(url) ? `${txt} (${url})` : txt;
      }
    }
    t = t.replace(/[ \t]+$/g, '');
    if (!t.trim()) { out.push(''); continue; }
    const style = (p.getElementsByTagNameNS(W, 'pStyle')[0] || {}).getAttributeNS?.(W, 'val') || '';
    if (/^(heading|כותרת)\s*\d/i.test(style) || /^Title$/i.test(style)) out.push('# ' + t);
    else if (p.getElementsByTagNameNS(W, 'numPr').length) out.push('• ' + t);
    else out.push(t);
  }
  return out.join('\n');
}

/* PDF: טוענים את pdf.js רק בעת הצורך, ומרכיבים שורות לפי מיקום אנכי. בשורה עברית הסדר מימין לשמאל. */
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
let pdfLib;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return pdfLib || (pdfLib = new Promise((res, rej) => {
    const sc = document.createElement('script'); sc.src = PDFJS + 'pdf.min.js';
    sc.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; res(window.pdfjsLib); };
    sc.onerror = () => { pdfLib = null; rej(new Error('טעינת קורא ה-PDF נכשלה. בדקו חיבור לאינטרנט או הדביקו את הטקסט.')); };
    document.head.appendChild(sc);
  }));
}

const tidy = t => t.replace(/\s+([,.:;?!])/g, '$1').replace(/([\u0590-\u05FF])\s*["״]\s*([\u0590-\u05FF])/g, '$1"$2').replace(/([\u0590-\u05FF])\s+'\s*/g, "$1' ").replace(/\s{2,}/g, ' ').trim();
const DATE_CELL = /^\d{1,2}(?:-\d{1,2})?\.\d{1,2}\.\d{2,4}$/;

/* טבלת מפגשים (תאריך | סוגיות | שלב | עם מי נפגשים): כל שורה בטבלה הופכת לתחנה, ומוחזר טקסט בפורמט שהמפרק מכיר */
function pdfTable(pages) {
  let cols = null, rows = [], ended = false;
  for (const pg of pages) {
    if (ended) break;
    const head = pg.find(p => p.s.trim() === 'תאריך'); let top = Infinity;
    if (head) {
      top = head.y - 3;
      if (!cols) {
        const hp = pg.filter(p => Math.abs(p.y - head.y) < 3 && p.s.trim()).sort((a, b) => a.x - b.x), cl = [];
        for (const p of hp) { const c = cl[cl.length - 1]; if (c && p.x - c.right < 10) c.right = Math.max(c.right, p.x + p.w); else cl.push({ right: p.x + p.w }); }
        if (cl.length < 2) return null;
        cols = cl.map(c => c.right).sort((a, b) => b - a);
      }
    } else if (!cols) continue;
    let body = pg.filter(p => p.y < top && p.s.trim());
    const dates = body.filter(p => DATE_CELL.test(p.s.trim()) && Math.abs(p.x + p.w - cols[0]) < 12).sort((a, b) => b.y - a.y);
    if (!dates.length) { if (rows.length) ended = true; continue; }
    const size = dates[0].size, stop = body.filter(p => p.size > size + 1.5 && p.y < dates[0].y).sort((a, b) => b.y - a.y)[0];
    if (stop) { body = body.filter(p => p.y > stop.y + 2); ended = true; }
    dates.forEach((d, i) => {
      const lo = i + 1 < dates.length ? dates[i + 1].y : -Infinity, cells = cols.map(() => []);
      for (const p of body.filter(p => p.y <= d.y + 3 && p.y > lo + 3)) {
        // הטקסט מיושר לימין: מילה שייכת לעמודה הקרובה ביותר שהקצה הימני שלה נמצא מימין למילה
        const r = p.x + p.w; let k = 0;
        cols.forEach((c, j) => { if (c >= r - 8 && c < cols[k]) k = j; else if (cols[k] < r - 8) k = j; });
        cells[k].push(p);
      }
      rows.push(cells.map(c => {
        c.sort((a, b) => Math.abs(a.y - b.y) < 3 ? b.x - a.x : b.y - a.y);
        return tidy(c.map(p => p.s).join(' '));
      }));
    });
  }
  if (rows.length < 2) return null;
  return rows.map((r, i) => {
    const [date, issues = '', stage = '', who = ''] = r;
    let title = issues.split(/[.?!]\s|[.?!]$/)[0] || issues;
    if (title.length > 80) title = title.slice(0, 80).replace(/\s+\S*$/, '');
    title = title.replace(/[,:\s]+$/, '') || `מפגש ${i + 1}`;
    return [`תחנה ${i + 1}: ${title}`, `תאריך: ${date.replace(/^(\d{1,2})-(\d{1,2})\.(\d{1,2}\.\d{2,4})$/, '$1.$3')}${/-/.test(date) ? ' (' + date + ')' : ''}`,
      issues ? `תיאור: ${issues}` : '', stage ? `שלב: ${stage}
מרעיון לפעולה: ${stage}` : '', who ? `נפגשים עם: ${who}` : ''].filter(Boolean).join('\n');
  }).join('\n\n');
}

async function pdfToText(buf) {
  const lib = await loadPdfJs();
  let pdf; try { pdf = await lib.getDocument({ data: buf }).promise; } catch (e) { throw new Error('לא ניתן לקרוא את ה-PDF'); }
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const items = (await (await pdf.getPage(n)).getTextContent()).items.filter(i => i.str !== undefined && i.str.trim());
    pages.push(items.map(i => ({ x: i.transform[4], y: i.transform[5], w: i.width || 0, size: Math.abs(i.transform[3]) || i.height || 0, s: i.str })));
  }
  const table = pdfTable(pages); if (table) return table;
  const out = [];
  for (const parts0 of pages) {
    const rows = [];
    for (const it of parts0) {
      let r = rows.find(r => Math.abs(r.y - it.y) < 3); if (!r) rows.push(r = { y: it.y, parts: [] });
      r.parts.push(it);
    }
    rows.sort((a, b) => b.y - a.y);
    let prev = null;
    for (const r of rows) {
      const rtl = /[\u0590-\u05FF]/.test(r.parts.map(p => p.s).join(''));
      r.parts.sort((a, b) => rtl ? b.x - a.x : a.x - b.x);
      const line = tidy(r.parts.map(p => p.s).join(rtl ? ' ' : ''));
      if (prev !== null && prev - r.y > 22) out.push(''); // רווח גדול בין שורות = פסקה חדשה
      prev = r.y; out.push(line);
    }
    out.push('');
  }
  const text = out.join('\n').trim();
  if (!text) throw new Error('ב-PDF אין טקסט שאפשר לקרוא (אולי סריקה). הדביקו את הטקסט ידנית.');
  return text;
}

/* ---------- פירוק לתחנות ---------- */
const HEB_NUM = 'אבגדהוזחטיכלמנסעפצקרשת';
const HEAD_STATION = new RegExp(`^(?:#{1,4}\\s*)?(?:תחנה|מפגש|יום)\\s*(?:מס['׳]?\\s*)?(\\d{1,2}|[${HEB_NUM}]['׳]?)?\\s*[:.\\-–—)·|]*\\s*(.*)$`);
const HEAD_MD = /^#{1,4}\s*(.+)$/;
const HEAD_NUM = /^(\d{1,2})\s*[.)]\s+(\S.*)$/;

const LABELS = [
  ['place', /^(?:מקום|מיקום|כתובת|אתר)$/],
  ['date', /^(?:תאריך|מועד|יום)$/],
  ['time', /^(?:שעה|שעות|זמן)$/],
  ['description', /^(?:תיאור|על התחנה|תוכן|מה עושים)$/],
  ['prep', /^(?:שאלות הכנה|שאלות להכנה|הכנה|שאלות|שאלות למפגש)$/],
  ['readings', /^(?:חומרי קריאה(?: והשראה)?|קריאה|השראה|חומרים|קישורים|לקריאה)$/],
  ['step', /^(?:שלב|שלב בתהליך|תהליך|יוזמה|בתהליך היוזמה)$/]
];
const LABEL_LINE = /^[•\-*▪◦\s]*([^:：|]{2,30}?)\s*[:：]\s*(.*)$/;
const BULLET = /^\s*(?:[•\-*▪◦]|\d{1,2}[.)])\s+/;
const URL_RE = /https?:\/\/[^\s)>\]]+/;

const SCALAR = new Set(['place', 'date', 'time', 'step']);

function labelOf(line) {
  const m = LABEL_LINE.exec(line); if (!m) return null;
  const key = m[1].replace(/[*_]/g, '').trim();
  for (const [k, re] of LABELS) if (re.test(key)) return { key: k, rest: m[2].trim() };
  return null;
}

const MONTHS = { 'ינואר': 1, 'פברואר': 2, 'מרץ': 3, 'מרס': 3, 'אפריל': 4, 'מאי': 5, 'יוני': 6, 'יולי': 7, 'אוגוסט': 8, 'ספטמבר': 9, 'אוקטובר': 10, 'נובמבר': 11, 'דצמבר': 12 };
const pad = n => String(n).padStart(2, '0');

export function parseDate(s, today = new Date()) {
  let d, m, y, hit;
  s = s.replace(/(\d{1,2})\s*[-–]\s*\d{1,2}(\.\d{1,2}\.\d{2,4})/, '$1$2'); // טווח ימים: לוקחים את הראשון
  let r = /(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?/.exec(s);
  if (r) { d = +r[1]; m = +r[2]; y = r[3] ? +r[3] : 0; hit = r[0]; }
  else {
    r = new RegExp(`(\\d{1,2})\\s*(?:ב|ל)?(${Object.keys(MONTHS).join('|')})(?:\\s+(\\d{4}))?`).exec(s);
    if (r) { d = +r[1]; m = MONTHS[r[2]]; y = r[3] ? +r[3] : 0; hit = r[0]; }
  }
  if (!hit || m < 1 || m > 12 || d < 1 || d > 31) return null;
  if (y && y < 100) y += 2000;
  if (!y) { y = today.getFullYear(); if (new Date(y, m - 1, d) < new Date(today.getTime() - 60 * 864e5)) y++; }
  return { iso: `${y}-${pad(m)}-${pad(d)}`, hit };
}

export function parseTime(s) {
  const r = /(\d{1,2}):(\d{2})\s*(?:[-–—]|עד|ל)?\s*(?:(\d{1,2}):(\d{2}))?/.exec(s);
  if (!r) return null;
  const a = `${pad(+r[1])}:${r[2]}`;
  return { text: r[3] ? `${a} עד ${pad(+r[3])}:${r[4]}` : a, hit: r[0] };
}

const STEP_KEYWORDS = [[/עץ ה?בעיה/, 'tree'], [/תיאוריית שינוי/, 'toc'], [/תב.?ר/, 'budget'], [/רעיונ|רעיון לפתרון/, 'ideas'], [/פרזנטציה|פיצ/, 'pitch'], [/גיוס שותפים|שותפים/, 'partners'], [/כאב בטן/, 'phen']];

function matchStep(s) {
  const t = s.replace(/[״"׳']/g, '').trim(); if (!t) return '';
  const kw = STEP_KEYWORDS.find(([re]) => re.test(t)); if (kw) return kw[1];
  const num = /(?:שלב\s*)?(\d{1,2})\b/.exec(t);
  if (num) { const w = WS_STEPS.find(x => x.n === +num[1]); if (w) return w.id; }
  const norm = x => x.replace(/[״"׳']/g, '');
  const w = WS_STEPS.find(x => norm(x.label).includes(t) || t.includes(norm(x.label)) || t === x.id);
  return w ? w.id : '';
}

const listItems = a => a.map(l => l.replace(BULLET, '').trim()).filter(Boolean);
function toReading(l) {
  l = l.replace(BULLET, '').trim(); if (!l) return null;
  if (l.includes('|')) { const [t, ...u] = l.split('|'); return { title: t.trim(), url: u.join('|').trim() }; }
  const u = URL_RE.exec(l); if (!u) return { title: l, url: '' };
  const title = l.replace(u[0], '').replace(/[()\[\]<>]/g, '').replace(/[\s:\-–—|]+$/, '').replace(/^[\s:\-–—|]+/, '').trim();
  return { title: title || u[0].replace(/^https?:\/\/(www\.)?/, ''), url: u[0] };
}

function splitBlocks(lines) {
  const find = re => lines.map((l, i) => re.test(l.trim()) ? i : -1).filter(i => i >= 0);
  // "יום: ..." היא תווית תאריך ולא כותרת תחנה
  let idx = find(HEAD_STATION).filter(i => !/^(?:#{1,4}\s*)?יום\s*[:：]/.test(lines[i].trim()));
  let re = HEAD_STATION;
  if (idx.length < 2) { idx = find(HEAD_MD); re = HEAD_MD; }
  if (idx.length < 2) { idx = find(HEAD_NUM); re = HEAD_NUM; }
  if (idx.length < 2) return null;
  return idx.map((s, k) => {
    const e = k + 1 < idx.length ? idx[k + 1] : lines.length, h = lines[s].trim();
    let title;
    if (re === HEAD_STATION) title = HEAD_STATION.exec(h)[2];
    else if (re === HEAD_MD) title = HEAD_MD.exec(h)[1];
    else title = HEAD_NUM.exec(h)[2];
    return { title: title.replace(/[*_#]/g, '').trim(), body: lines.slice(s + 1, e), fallbackTitle: h.replace(/^#+\s*/, '') };
  });
}

function buildStation(b, today) {
  const st = { title: b.title, place: '', date: '', time: '', description: '', prep: [], readings: [], step: '' };
  const hd = parseDate(st.title, today); if (hd) { st.date = hd.iso; st.title = st.title.replace(hd.hit, ''); }
  const ht = parseTime(st.title); if (ht) { st.time = ht.text; st.title = st.title.replace(ht.hit, ''); }
  st.title = st.title.replace(/\s*[·|,\-–—:]+\s*$/g, '').replace(/^\s*[·|,\-–—:]+\s*/g, '').replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim() || b.fallbackTitle;
  let cur = 'description'; const buf = { description: [], prep: [], readings: [], step: [], place: [], date: [], time: [] };
  for (const raw of b.body) {
    const line = raw.trim(), lb = labelOf(line);
    if (lb) {
      cur = lb.key; if (lb.rest) buf[cur].push(lb.rest);
      if (lb.rest && SCALAR.has(cur)) cur = 'description'; // שדה חד-שורתי: המשך הטקסט הוא תיאור
      continue;
    }
    if (!line) { if (cur === 'description') buf.description.push(''); continue; }
    buf[cur].push(line);
  }
  st.place = buf.place.join(' ').trim();
  const dd = parseDate(buf.date.join(' ')); if (dd) st.date = dd.iso;
  const dt = parseTime(buf.time.join(' ') || buf.date.join(' ')); if (dt) st.time = dt.text;
  const stepTxt = buf.step.join(' '); if (stepTxt) st.step = matchStep(stepTxt);
  st.description = buf.description.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  st.prep = listItems(buf.prep);
  st.readings = buf.readings.map(toReading).filter(Boolean);
  return st;
}

export function parseSyllabus(text, today = new Date()) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const blocks = splitBlocks(lines);
  if (!blocks) {
    const t = lines.join('\n').trim(); if (!t) return [];
    return [buildStation({ title: 'תחנה 1', body: lines, fallbackTitle: 'תחנה 1' }, today)];
  }
  return blocks.map(b => buildStation(b, today)).filter(s => s.title);
}
