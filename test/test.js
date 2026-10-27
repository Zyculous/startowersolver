// Run with: node test/test.js   (or: npm test)
// Checks every algorithm in the library does what its card says, and that the
// solver solves random scrambles and random hand-entered puzzles.
const assert = require('assert');
const A = require('../js/logic.js');
const S = A.solvedState();
const run = (alg) => A.applyAlg(S, A.parseAlg(alg));
let failures = 0;
function check(name, fn) { try { fn(); console.log('ok   ', name); } catch (e) { failures++; console.log('FAIL ', name, '-', e.message); } }

// Pure permutation algorithms: compare the exact resulting layer contents.
// Column indices: 0 front-right, 1 back-right, 2 back, 3 back-left, 4 front-left.
const exact = {
  'Top 3-cycle':           ['U / U2 / U / U2 /',            { TW: [4, 0, 2, 3, 1] }],
  'Top 3-cycle, reverse':  ["/ U2' / U' / U2' / U'",        { TW: [1, 4, 2, 3, 0] }],
  'Bottom 3-cycle':        ['D / D2 / D / D2 /',            { BW: [13, 11, 12, 14, 10] }],
  'Double swap':           ["U' D / D' / U D / U' / U D'",   { TW: [4, 1, 2, 3, 0], BW: [14, 11, 12, 13, 10] }],
  'Top double swap':       ["U2 / U2 / U / U' / U / U2 /",   { TW: [4, 2, 1, 3, 0] }],
  'Middle 3-cycle':        ["E' / E /",                     { MW: [9, 5, 7, 8, 6] }],
};
for (const [name, [alg, want]] of Object.entries(exact)) check(name, () => {
  const r = run(alg); const exp = { ...S, ...want };
  for (const k of ['TW', 'MW', 'BW']) assert.deepStrictEqual(r[k], exp[k], k);
  for (const k of ['TP', 'BP']) assert.deepStrictEqual(r[k].map(A.faceOf), S[k].map(A.faceOf), k + ' faces');
});

// Face-fixing algorithms: applied to their case they restore faces and keep the middle.
const faceFixes = {
  'Point swap':            ["D' U / D U' / D U / D2' /",     s => { s.TP[0] = 25; s.BP[0] = 15; }],
  'Wedge face swap':       ["/ D / D / D2' /",               s => { s.TW[0] = 10; s.BW[0] = 0; }],
  'Wedge face swap, far':  ["/ D2' / D2' / D' /",            s => { s.TW[0] = 12; s.BW[2] = 0; }],
};
for (const [name, [alg, setup]] of Object.entries(faceFixes)) check(name, () => {
  const c = JSON.parse(JSON.stringify(S)); setup(c);
  const r = A.applyAlg(c, A.parseAlg(alg));
  assert.ok(r.TW.every(id => A.faceOf(id) === A.Y) && r.TP.every(id => A.faceOf(id) === A.Y), 'top all yellow');
  assert.ok(r.BW.every(id => A.faceOf(id) === A.G) && r.BP.every(id => A.faceOf(id) === A.G), 'bottom all green');
  assert.deepStrictEqual(r.MW, S.MW, 'middle unchanged');
});

check('solver: 200 random scrambles', () => {
  for (let i = 0; i < 200; i++) {
    const s = A.applyAlg(S, A.randomScramble(20)); if (A.isSolved(s)) continue;
    const r = A.solveAll(s); assert.ok(!r.error, r.error);
    assert.ok(A.isSolved(A.applyAlg(s, r.steps.flatMap(x => x.moves))), 'solution solves');
  }
});

check('solver: 200 random hand-entered puzzles', () => {
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  let tried = 0;
  while (tried < 200) {
    const w = shuffle([...Array(10).keys()]); const pc = x => ({ side: x % 5, face: x < 5 ? A.Y : A.G });
    const p = { tf: [], ts: [], bf: [], bs: [], ms: shuffle([0, 1, 2, 3, 4]), tp: [], bp: [] };
    for (let c = 0; c < 5; c++) { const a = pc(w[c]), b = pc(w[5 + c]); p.tf.push(a.face); p.ts.push(a.side); p.bf.push(b.face); p.bs.push(b.side); }
    const pts = shuffle([5, 5, 5, 5, 5, 6, 6, 6, 6, 6]); p.tp = pts.slice(0, 5); p.bp = pts.slice(5);
    const r = A.stateFromPaint(p, [20, 21, 22, 23, 24]); if (r.errs) continue; // odd parity: impossible position, correctly rejected
    tried++;
    const sol = A.solveAll(r.state); assert.ok(!sol.error && sol.ok, sol.error || 'not solved');
  }
});

if (failures) { console.log(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nAll checks passed');
