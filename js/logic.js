// Star Tower puzzle model and solver. No DOM access, so it also runs in Node (see test/).
const Y = 5, G = 6;
const SIDE_NAMES = ['White', 'Red', 'Orange', 'Magenta', 'Blue'];
const PIECES = [];
for (let c = 0; c < 5; c++) PIECES.push({ kind: 'w', home: 'T', slot: c, side: c, face: Y });
for (let c = 0; c < 5; c++) PIECES.push({ kind: 'w', home: 'M', slot: c, side: c, face: null });
for (let c = 0; c < 5; c++) PIECES.push({ kind: 'w', home: 'B', slot: c, side: c, face: G });
for (let t = 0; t < 5; t++) PIECES.push({ kind: 'p', home: 'T', slot: t, face: Y });
for (let t = 0; t < 5; t++) PIECES.push({ kind: 'p', home: 'M', slot: t, face: null });
for (let t = 0; t < 5; t++) PIECES.push({ kind: 'p', home: 'B', slot: t, face: G });
PIECES.push({ kind: 'c', home: 'T', face: Y }, { kind: 'c', home: 'M', face: null }, { kind: 'c', home: 'B', face: G });
const rng5 = (a) => [0, 1, 2, 3, 4].map(i => a + i);
function solvedState() { return { TW: rng5(0), MW: rng5(5), BW: rng5(10), TP: rng5(15), MP: rng5(20), BP: rng5(25) }; }
function clone(s) { return { TW: s.TW.slice(), MW: s.MW.slice(), BW: s.BW.slice(), TP: s.TP.slice(), MP: s.MP.slice(), BP: s.BP.slice() }; }
const mod5 = (k) => ((k % 5) + 5) % 5;
function rot(a, k) { k = mod5(k); return a.map((_, i) => a[mod5(i - k)]); }
// Standard notation -> internal amount (internal + = counter-clockwise seen from top)
function internalAmount(m) { return m.L === 'U' ? -m.k : m.k; }
function applyMove(s, m) {
  const n = clone(s);
  if (m.L === '/') {
    n.TW[0] = s.BW[4]; n.TW[4] = s.BW[0]; n.BW[0] = s.TW[4]; n.BW[4] = s.TW[0];
    n.MW[0] = s.MW[4]; n.MW[4] = s.MW[0]; n.TP[0] = s.BP[0]; n.BP[0] = s.TP[0];
  } else {
    const k = internalAmount(m);
    if (m.L === 'U') { n.TW = rot(s.TW, k); n.TP = rot(s.TP, k); }
    if (m.L === 'E') { n.MW = rot(s.MW, k); n.MP = rot(s.MP, k); }
    if (m.L === 'D') { n.BW = rot(s.BW, k); n.BP = rot(s.BP, k); }
  }
  return n;
}
function parseAlg(str) {
  return str.trim().split(/\s+/).filter(Boolean).map(t => {
    if (t === '/') return { L: '/' };
    let k = 1; const L = t[0]; let r = t.slice(1);
    if (r.startsWith('2')) { k = 2; r = r.slice(1); }
    if (r === "'") k = -k;
    return { L, k };
  });
}
function fmtMove(m) { return m.L === '/' ? '/' : m.L + (Math.abs(m.k) === 2 ? '2' : '') + (m.k < 0 ? "'" : ''); }
function fmtAlg(ms) { return ms.map(fmtMove).join(' '); }
function invert(ms) { return ms.slice().reverse().map(m => m.L === '/' ? m : { L: m.L, k: -m.k }); }
function applyAlg(s, ms) { for (const m of ms) s = applyMove(s, m); return s; }
function normK(k) { k = mod5(k); return k > 2 ? k - 5 : k; }
function simplify(ms) {
  const res = []; let buf = { U: 0, E: 0, D: 0 };
  const flush = () => { for (const L of ['U', 'E', 'D']) { const k = normK(buf[L]); if (k) res.push({ L, k }); } buf = { U: 0, E: 0, D: 0 }; };
  for (const m of ms) {
    if (m.L === '/') { flush(); if (res.length && res[res.length - 1].L === '/') res.pop(); else res.push(m); }
    else buf[m.L] += m.k;
  }
  flush();
  // a second pass handles turns that became adjacent after a "/ /" cancelled
  return res.length !== ms.length ? simplify(res) : res;
}
const sideOf = (id) => PIECES[id].side, faceOf = (id) => PIECES[id].face;
function isSolved(s) {
  for (let i = 0; i < 5; i++) {
    if (faceOf(s.TW[i]) !== Y || faceOf(s.BW[i]) !== G || faceOf(s.TP[i]) !== Y || faceOf(s.BP[i]) !== G) return false;
    if (!(sideOf(s.TW[i]) === sideOf(s.MW[i]) && sideOf(s.MW[i]) === sideOf(s.BW[i]))) return false;
  }
  return true;
}
function midInOrder(mw) { for (let i = 0; i < 5; i++) if (mod5(mw[(i + 1) % 5] - mw[i]) !== 1) return false; return true; }

// ---- tiny binary heap ----
class Heap { constructor() { this.a = []; }
  push(p, v) { const a = this.a; a.push([p, v]); let i = a.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (a[j][0] <= a[i][0]) break; [a[i], a[j]] = [a[j], a[i]]; i = j; } }
  pop() { const a = this.a; const top = a[0]; const last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } } return top; }
  get size() { return this.a.length; } }

function dijkstra(start, keyOf, edges, isGoal) {
  const dist = new Map(), prev = new Map(); const k0 = keyOf(start);
  dist.set(k0, 0); const h = new Heap(); h.push(0, start); const node = new Map([[k0, start]]);
  while (h.size) {
    const [d, s] = h.pop(); const ks = keyOf(s);
    if (d > dist.get(ks)) continue;
    if (isGoal(s)) { const path = []; let k = ks; while (prev.has(k)) { const [pk, lab] = prev.get(k); path.push(lab); k = pk; } return path.reverse(); }
    for (const [cost, lab, f] of edges) {
      const n = f(s); const kn = keyOf(n); const nd = d + cost;
      if (!dist.has(kn) || nd < dist.get(kn) - 1e-9) { dist.set(kn, nd); prev.set(kn, [ks, lab]); node.set(kn, n); h.push(nd, n); }
    }
  }
  return null;
}

// Step 1: middle ring order, using E turns and single flips
function solveMiddle(s) {
  const turns = [1, -1, 2, -2].map(k => [0.01, [{ L: 'E', k }], (mw) => rot(mw, internalAmount({ L: 'E', k }))]);
  const flipE = [1, [{ L: '/' }], (mw) => { const n = mw.slice(); n[0] = mw[4]; n[4] = mw[0]; return n; }];
  const mw0 = s.MW.map(sideOf);
  const path = dijkstra(mw0, a => a.join(''), [...turns, flipE], midInOrder);
  return path ? simplify(path.flat()) : null;
}

// Step 2: faces. State code: bits0-4 TW yellow, 5-9 BW yellow, 10-14 TP yellow, 15-19 BP yellow, 20 flip parity.
function faceCode(s) {
  let c = 0;
  for (let i = 0; i < 5; i++) {
    if (faceOf(s.TW[i]) === Y) c |= 1 << i;
    if (faceOf(s.BW[i]) === Y) c |= 1 << (5 + i);
    if (faceOf(s.TP[i]) === Y) c |= 1 << (10 + i);
    if (faceOf(s.BP[i]) === Y) c |= 1 << (15 + i);
  }
  return c;
}
function rotField(code, off, k) { k = mod5(k); const f = (code >> off) & 31; let g = 0; for (let i = 0; i < 5; i++) if (f & (1 << i)) g |= 1 << mod5(i + k); return (code & ~(31 << off)) | (g << off); }
function turnCode(code, u, d) { // internal amounts
  if (u) { code = rotField(code, 0, u); code = rotField(code, 10, u); }
  if (d) { code = rotField(code, 5, d); code = rotField(code, 15, d); }
  return code;
}
function swapBits(c, a, b) { const x = (c >> a) & 1, y = (c >> b) & 1; if (x !== y) c ^= (1 << a) | (1 << b); return c; }
function flipCode(c) { c = swapBits(c, 0, 9); c = swapBits(c, 4, 5); c = swapBits(c, 10, 15); return c ^ (1 << 20); }
const FACE_TARGET = 31 | (31 << 10);
let FACE_DIST = null;
const TURN_PAIRS = []; for (let u = 0; u < 5; u++) for (let d = 0; d < 5; d++) TURN_PAIRS.push([u, d]);
function buildFaceTable() {
  const dist = new Int8Array(1 << 21).fill(-1);
  dist[FACE_TARGET] = 0; let level = [FACE_TARGET], L = 0;
  while (level.length) {
    const next = [];
    for (const s of level) { const f = flipCode(s); for (const [u, d] of TURN_PAIRS) { const s2 = turnCode(f, u, d); if (dist[s2] < 0) { dist[s2] = L + 1; next.push(s2); } } }
    level = next; L++;
  }
  FACE_DIST = dist;
}
function turnMovesFromInternal(u, d) { // internal amounts -> standard moves
  const out = []; const ku = normK(-u), kd = normK(d);
  if (ku) out.push({ L: 'U', k: ku }); if (kd) out.push({ L: 'D', k: kd }); return out;
}
function solveFaces(s) {
  if (!FACE_DIST) buildFaceTable();
  let c = faceCode(s); const moves = [];
  if (FACE_DIST[c] < 0) return null;
  let guard = 0;
  while (FACE_DIST[c] > 0 && guard++ < 60) {
    let found = false;
    for (const [u, d] of TURN_PAIRS) { const c2 = flipCode(turnCode(c, u, d)); if (FACE_DIST[c2] === FACE_DIST[c] - 1) { moves.push(...turnMovesFromInternal(u, d), { L: '/' }); c = c2; found = true; break; } }
    if (!found) return null;
  }
  return simplify(moves);
}

// Step 3: columns, with three macros conjugated by U / D turns
const MACROS = [
  { name: 'Top 3-cycle', alg: 'U / U2 / U / U2 /' },
  { name: 'Top 3-cycle (reverse)', alg: "/ U2' / U' / U2' / U'" },
  { name: 'Bottom 3-cycle', alg: 'D / D2 / D / D2 /' },
  { name: 'Bottom 3-cycle (reverse)', alg: "/ D2' / D' / D2' / D'" },
  { name: 'Double swap', alg: "U' D / D' / U D / U' / U D'" },
].map(m => {
  const ms = parseAlg(m.alg); const r = applyAlg(solvedState(), ms);
  const pT = r.TW.map(id => { if (id > 4) throw new Error('macro moves wedge layer'); return id; });
  const pB = r.BW.map(id => { if (id < 10) throw new Error('macro moves wedge layer'); return id - 10; });
  return { ...m, ms, pT, pB, flips: ms.filter(x => x.L === '/').length };
});
function solveColumns(s) {
  const mid = s.MW.map(sideOf);
  const start = { t: s.TW.map(sideOf), b: s.BW.map(sideOf) };
  const edges = [];
  for (const k of [1, -1, 2, -2]) {
    edges.push([0.02, [{ L: 'U', k }], (x) => ({ t: rot(x.t, internalAmount({ L: 'U', k })), b: x.b })]);
    edges.push([0.02, [{ L: 'D', k }], (x) => ({ t: x.t, b: rot(x.b, internalAmount({ L: 'D', k })) })]);
  }
  for (const m of MACROS) edges.push([m.flips, m.ms, (x) => ({ t: m.pT.map(i => x.t[i]), b: m.pB.map(i => x.b[i]) })]);
  const path = dijkstra(start, x => x.t.join('') + x.b.join(''), edges, x => x.t.every((v, i) => v === mid[i]) && x.b.every((v, i) => v === mid[i]));
  return path ? simplify(path.flat()) : null;
}
function solveAll(s) {
  const steps = [];
  const m1 = solveMiddle(s); if (!m1) return { error: 'Could not order the middle ring.' };
  let cur = applyAlg(s, m1); steps.push({ id: 'mid', title: 'Order the middle ring', moves: m1 });
  const m2 = solveFaces(cur); if (!m2) return { error: 'This color arrangement cannot be reached by legal moves.' };
  cur = applyAlg(cur, m2); steps.push({ id: 'faces', title: 'Yellow on top, green on the bottom', moves: m2 });
  const m3 = solveColumns(cur); if (!m3) return { error: 'This color arrangement cannot be reached by legal moves. Two pieces may be entered swapped.' };
  cur = applyAlg(cur, m3); steps.push({ id: 'cols', title: 'Line up every column', moves: m3 });
  return { steps, ok: isSolved(cur) };
}
function randomScramble(n) {
  const out = []; const ks = [1, -1, 2, -2];
  for (let i = 0; i < n; i++) {
    for (const L of ['U', 'E', 'D']) if (Math.random() < 0.75) out.push({ L, k: ks[Math.floor(Math.random() * 4)] });
    out.push({ L: '/' });
  }
  return simplify(out);
}
// Build a state from painted colors (used by the editor)
function stateFromPaint(p, prevMP) {
  const errs = [];
  const TW = [], BW = [], MW = [], TP = [], BP = [];
  for (let c = 0; c < 5; c++) {
    TW.push(p.tf[c] === Y ? p.ts[c] : 10 + p.ts[c]);
    BW.push(p.bf[c] === G ? 10 + p.bs[c] : p.bs[c]);
    MW.push(5 + p.ms[c]);
  }
  if (new Set(MW).size !== 5) errs.push('The middle ring needs each of the five side colors exactly once.');
  const wset = new Set([...TW, ...BW]);
  if (wset.size !== 10) {
    for (let c = 0; c < 5; c++) {
      const yc = [...TW, ...BW].filter(id => id === c).length, gc = [...TW, ...BW].filter(id => id === 10 + c).length;
      if (yc !== 1) errs.push(`There should be exactly one ${SIDE_NAMES[c].toLowerCase()} piece with a yellow face (found ${yc}).`);
      if (gc !== 1) errs.push(`There should be exactly one ${SIDE_NAMES[c].toLowerCase()} piece with a green face (found ${gc}).`);
    }
  }
  let yi = 15, gi = 25; const pts = [...p.tp, ...p.bp]; const ny = pts.filter(x => x === Y).length;
  if (ny !== 5) errs.push(`There should be 5 yellow and 5 green star points (found ${ny} yellow).`);
  if (errs.length) return { errs };
  for (let t = 0; t < 5; t++) TP.push(p.tp[t] === Y ? yi++ : gi++);
  for (let t = 0; t < 5; t++) BP.push(p.bp[t] === Y ? yi++ : gi++);
  // wedge permutation parity: every legal move is an even permutation of the 10 wedges
  const idx = (id) => id < 5 ? id : id - 5;
  const perm = [...TW, ...BW].map(idx); let parity = 0; const seen = new Array(10).fill(false);
  for (let i = 0; i < 10; i++) { if (seen[i]) continue; let j = i, len = 0; while (!seen[j]) { seen[j] = true; j = perm[j]; len++; } parity += len - 1; }
  if (parity % 2) return { errs: ['These colors cannot happen on a real Star Tower: two top or bottom pieces are probably entered swapped. Recheck the side colors.'] };
  return { state: { TW, MW, BW, TP, MP: prevMP.slice(), BP } };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Y, G, SIDE_NAMES, PIECES, solvedState, applyMove, applyAlg, parseAlg, fmtAlg, fmtMove, invert, simplify,
    isSolved, solveAll, randomScramble, stateFromPaint, MACROS, sideOf, faceOf };
}
