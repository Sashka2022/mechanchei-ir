/* בדיקות אוטומטיות למודל מרחב העבודה: node --test tests/ */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WS_STEPS, WS_STATIONS, nextStepId, stationOfStep } from '../app/js/model.js';
import { parseSyllabus } from '../app/js/syllabus-import.js';

const html = readFileSync(new URL('../app/initiative.html', import.meta.url), 'utf8');

test('ארבע תחנות, וכל כלי שייך לתחנה אחת בדיוק', () => {
  assert.deepEqual(WS_STATIONS.map(s => s.label), ['בעיה', 'רעיון', 'התנסות', 'למידה']);
  for (const w of WS_STEPS) assert.equal(WS_STATIONS.filter(s => s.steps.includes(w.id)).length, 1, w.id);
});

test('סדר הכלים בתחנות זהה לסדר WS_STEPS (ניווט קודם/הבא רציף)', () => {
  assert.deepEqual(WS_STATIONS.flatMap(s => s.steps), WS_STEPS.map(w => w.id));
});

test('STATIONS ב-initiative.html זהה ל-WS_STATIONS במודל', () => {
  const block = html.match(/const STATIONS = \[([\s\S]*?)\n\];/)[1];
  const parsed = [...block.matchAll(/id: '(\w+)'.*?label: '([^']+)'.*?steps: \[([^\]]*)\]/g)]
    .map(m => ({ id: m[1], label: m[2], steps: [...m[3].matchAll(/'(\w+)'/g)].map(x => x[1]) }));
  assert.deepEqual(parsed, WS_STATIONS.map(({ id, label, steps }) => ({ id, label, steps })));
});

test('מזהי הכלים ב-initiative.html (STEPS) זהים ל-WS_STEPS: שומר על קישורים עמוקים ?step=', () => {
  const block = html.match(/const STEPS = \[([\s\S]*?)\n\];/)[1];
  const ids = [...block.matchAll(/\{ id: '(\w+)'/g)].map(m => m[1]);
  assert.deepEqual(ids, WS_STEPS.map(w => w.id));
});

test('nextStepId: הכלי הראשון שלא הושלם, ובסוף תיק הפרויקט', () => {
  assert.equal(nextStepId({}), 'setup');
  assert.equal(nextStepId({ setup: true, phen: true }), 'tree');
  assert.equal(nextStepId(Object.fromEntries(WS_STEPS.map(w => [w.id, true]))), 'board');
  assert.equal(stationOfStep('toc').id, 'idea');
});

test('ייבוא סילבוס: טקסט עם כותרות תחנה מתפרק לתחנות', () => {
  const st = parseSyllabus('תחנה 1: הנמל\nמקום: הנמל\nתאריך: 12.11.2026\n\nתחנה 2: הדר\nסיור', new Date('2026-10-24'));
  assert.equal(st.length, 2);
  assert.equal(st[0].date, '2026-11-12');
  assert.equal(st[1].title, 'הדר');
});
