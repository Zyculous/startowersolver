// Rendering (three.js) and page UI. Depends on js/logic.js being loaded first.
// ---------------- rendering ----------------
const CSSV = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const COLORVAR = ['--pW', '--pR', '--pO', '--pM', '--pB', '--pY', '--pG'];
const PCOL = () => COLORVAR.map(CSSV);
const R = 1, RI = R * 0.381966, H = 0.62, GAP = 0.012;
const D2R = Math.PI / 180;
const P = (r, phiDeg) => [r * Math.sin(phiDeg * D2R), r * Math.cos(phiDeg * D2R)];

function wedgePoly(c) { const pts = []; const n = 14; for (let i = 0; i <= n; i++) pts.push({ p: P(R, 72 * c + 72 * i / n), outer: i < n }); pts.push({ p: P(RI, 72 * c + 36), outer: false }); return pts; }
function pointPoly(t) { return [{ p: P(R, 72 * t), outer: false }, { p: P(RI, 72 * t - 36), outer: false }, { p: P(RI, 72 * t + 36), outer: false }]; }
function centerPoly() { return [0, 1, 2, 3, 4].map(c => ({ p: P(RI, 72 * c + 36), outer: false })); }

function inset(poly, d) {
  const n = poly.length; const cx = poly.reduce((a, v) => a + v.p[0], 0) / n, cz = poly.reduce((a, v) => a + v.p[1], 0) / n;
  const nrm = (a, b) => { let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; let nx = -dz / l, nz = dx / l; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; if ((cx - mx) * nx + (cz - mz) * nz < 0) { nx = -nx; nz = -nz; } return [nx, nz]; };
  return poly.map((v, i) => {
    const a = poly[(i - 1 + n) % n].p, b = v.p, c = poly[(i + 1) % n].p;
    const n1 = nrm(a, b), n2 = nrm(b, c); const dot = n1[0] * n2[0] + n1[1] * n2[1]; const s = d / Math.max(0.15, 1 + dot);
    return { p: [b[0] + (n1[0] + n2[0]) * s, b[1] + (n1[1] + n2[1]) * s], outer: v.outer };
  });
}
// Prism geometry with groups: 0 top cap, 1 bottom cap, 2 outer curved wall, 3 inner walls
function prism(poly, y0, y1) {
  const pos = [], nor = [], groups = [[], [], [], []];
  const n = poly.length; const cx = poly.reduce((a, v) => a + v.p[0], 0) / n, cz = poly.reduce((a, v) => a + v.p[1], 0) / n;
  const tri = (g, A, B, C, NA, NB, NC, want) => {
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const cxp = uy * vz - uz * vy, cyp = uz * vx - ux * vz, czp = ux * vy - uy * vx;
    if (cxp * want[0] + cyp * want[1] + czp * want[2] < 0) { [B, C] = [C, B]; [NB, NC] = [NC, NB]; }
    groups[g].push([A, B, C, NA, NB, NC]);
  };
  for (let i = 0; i < n; i++) {
    const a = poly[i].p, b = poly[(i + 1) % n].p;
    tri(0, [cx, y1, cz], [a[0], y1, a[1]], [b[0], y1, b[1]], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0]);
    tri(1, [cx, y0, cz], [a[0], y0, a[1]], [b[0], y0, b[1]], [0, -1, 0], [0, -1, 0], [0, -1, 0], [0, -1, 0]);
    const outer = poly[i].outer; const g = outer ? 2 : 3;
    let na, nb; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    if (outer) { const la = Math.hypot(a[0], a[1]), lb = Math.hypot(b[0], b[1]); na = [a[0] / la, 0, a[1] / la]; nb = [b[0] / lb, 0, b[1] / lb]; }
    else { let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; let nx = dz / l, nz = -dx / l; if ((mx - cx) * nx + (mz - cz) * nz < 0) { nx = -nx; nz = -nz; } na = nb = [nx, 0, nz]; }
    const want = [(na[0] + nb[0]), 0, (na[2] + nb[2])];
    tri(g, [a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], na, nb, nb, want);
    tri(g, [a[0], y0, a[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], na, nb, na, want);
  }
  const geo = new THREE.BufferGeometry(); let start = 0;
  groups.forEach((list, gi) => { for (const [A, B, C, NA, NB, NC] of list) { pos.push(...A, ...B, ...C); nor.push(...NA, ...NB, ...NC); } geo.addGroup(start, list.length * 3, gi); start += list.length * 3; });
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return geo;
}

const host = document.getElementById('three');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
host.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
camera.position.set(1.3, 3.0, 5.2);
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enablePan = false; controls.enableDamping = true; controls.minDistance = 3.6; controls.maxDistance = 9; controls.target.set(0, 0, 0);
scene.add(new THREE.HemisphereLight(0xffffff, 0x50506a, 0.85));
const key = new THREE.DirectionalLight(0xffffff, 0.75); key.position.set(3, 6, 4); scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(-4, -2, -3); scene.add(fill);

const mats = {};
function mat(hex) { if (!mats[hex]) mats[hex] = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.42, metalness: 0.02 }); return mats[hex]; }
const meshes = [];
function buildMeshes() {
  meshes.forEach(m => { scene.remove(m); m.geometry.dispose(); });
  meshes.length = 0;
  const col = PCOL(); const dark = CSSV('--pK') || '#2a2b3a';
  const yr = { T: [H / 2 + GAP, 1.5 * H], M: [-H / 2 + GAP, H / 2 - GAP], B: [-1.5 * H, -H / 2 - GAP] };
  PIECES.forEach((pc) => {
    let poly; if (pc.kind === 'w') poly = wedgePoly(pc.slot); else if (pc.kind === 'p') poly = pointPoly(pc.slot); else poly = centerPoly();
    const [y0, y1] = yr[pc.home];
    const geo = prism(inset(poly, GAP), y0, y1);
    const faceHex = pc.face === Y ? col[5] : pc.face === G ? col[6] : dark;
    const sideHex = pc.kind === 'w' ? col[pc.side] : dark;
    const capT = pc.home === 'T' ? faceHex : dark, capB = pc.home === 'B' ? faceHex : dark;
    const m = new THREE.Mesh(geo, [mat(capT), mat(capB), mat(sideHex), mat(dark)]);
    scene.add(m); meshes.push(m);
  });
}
// cut guide + front marker
const guide = new THREE.Group(); scene.add(guide);
function buildGuide() {
  while (guide.children.length) guide.remove(guide.children[0]);
  // accent ribbon laid along the cut line on the top and bottom faces
  const a = P(R, -72), b = P(R, 72); const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const rm = new THREE.MeshBasicMaterial({ color: new THREE.Color(CSSV('--accent')), side: THREE.DoubleSide });
  for (const y of [1.5 * H + 0.003, -1.5 * H - 0.003]) {
    const rib = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.03), rm);
    rib.rotation.x = -Math.PI / 2; rib.position.set((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2); guide.add(rib);
  }
  const tg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.12, -1.5 * H, 1.42), new THREE.Vector3(0.12, -1.5 * H, 1.42), new THREE.Vector3(0, -1.5 * H, 1.2)]);
  tg.setIndex([0, 2, 1]); tg.computeVertexNormals();
  guide.add(new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: new THREE.Color(CSSV('--accent')), side: THREE.DoubleSide })));
}
const qY = (deg) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deg * D2R);
const qZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
function placeAll(s) {
  const where = {};
  const reg = (arr, L, kind) => arr.forEach((id, i) => { where[id] = { L, i, kind }; });
  reg(s.TW, 'T'); reg(s.MW, 'M'); reg(s.BW, 'B'); reg(s.TP, 'T'); reg(s.MP, 'M'); reg(s.BP, 'B');
  PIECES.forEach((pc, id) => {
    const m = meshes[id]; m.position.set(0, 0, 0);
    if (pc.kind === 'c') { m.quaternion.identity(); return; }
    const w = where[id];
    const flipped = pc.home !== 'M' && w.L !== pc.home;
    if (!flipped) m.quaternion.copy(qY(72 * (w.i - pc.slot)));
    else { const mirrored = pc.kind === 'w' ? 4 - pc.slot : mod5(-pc.slot); m.quaternion.multiplyQuaternions(qY(72 * (w.i - mirrored)), qZ); }
  });
}
function resize() { const r = host.getBoundingClientRect(); const w = Math.max(1, r.width), h = Math.max(1, r.height); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(host);

// ---------------- state, queue, animation ----------------
let state = solvedState();
let history = []; // {state, move}
let moveCount = 0, flipCount = 0;
const queue = []; let anim = null;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let speed = 1;
function movingIds(s, m) {
  if (m.L === 'U') return [...s.TW, ...s.TP, 30];
  if (m.L === 'E') return [...s.MW, ...s.MP, 31];
  if (m.L === 'D') return [...s.BW, ...s.BP, 32];
  return [s.TW[0], s.TW[4], s.BW[0], s.BW[4], s.MW[0], s.MW[4], s.TP[0], s.BP[0], s.MP[0]];
}
function enqueue(ms, opts = {}) { for (const m of ms) queue.push({ m, ...opts }); }
function startNext() {
  if (anim || !queue.length) return;
  const job = queue.shift(); const m = job.m;
  const pivot = new THREE.Group(); scene.add(pivot);
  movingIds(state, m).forEach(id => pivot.attach(meshes[id]));
  const axis = m.L === '/' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const angle = m.L === '/' ? Math.PI : internalAmount(m) * 72 * D2R;
  const base = (m.L === '/' ? 420 : 200 + 70 * Math.abs(m.k)) / speed;
  anim = { job, pivot, axis, angle, t0: performance.now(), dur: reduceMotion ? 1 : base };
}
function finishAnim() {
  const { job, pivot } = anim;
  [...pivot.children].forEach(c => scene.attach(c)); scene.remove(pivot);
  const prev = state; state = applyMove(state, job.m);
  if (job.undo) { const h = history.pop(); if (h) { moveCount--; if (h.move.L === '/') flipCount--; } }
  else { history.push({ state: prev, move: job.m }); moveCount++; if (job.m.L === '/') flipCount++; }
  placeAll(state); anim = null;
  if (job.onDone) job.onDone();
  if (!job.fromSolution) markSolutionStale();
  refreshUI();
}
function tick(now) {
  if (anim) {
    const t = Math.min(1, (now - anim.t0) / anim.dur); const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    anim.pivot.quaternion.setFromAxisAngle(anim.axis, anim.angle * e);
    if (t >= 1) finishAnim();
  }
  if (!anim) startNext();
  controls.update(); renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
function setStateInstant(s, clearHistory = true) {
  queue.length = 0; if (anim) { [...anim.pivot.children].forEach(c => scene.attach(c)); scene.remove(anim.pivot); anim = null; }
  state = s; if (clearHistory) { history = []; moveCount = 0; flipCount = 0; }
  placeAll(state); markSolutionStale(); refreshUI();
}

// ---------------- flat map (net) ----------------
const NET_ORDER = [3, 4, 0, 1, 2]; // strip left to right, front tip between 4 and 0
let editing = false, paint = null, paintColor = 0;
function paintFromState(s) { return { tf: s.TW.map(faceOf), ts: s.TW.map(sideOf), ms: s.MW.map(sideOf), bf: s.BW.map(faceOf), bs: s.BW.map(sideOf), tp: s.TP.map(faceOf), bp: s.BP.map(faceOf) }; }
function polyStr(poly, cx, cy, sc, flipY) { return poly.map(v => `${(cx + v.p[0] * sc).toFixed(1)},${(cy + (flipY ? -1 : 1) * v.p[1] * sc).toFixed(1)}`).join(' '); }
function starSVG(cx, cy, sc, faces, pts, kWedge, kPt, bottom) {
  const col = PCOL(); let s = '';
  for (let c = 0; c < 5; c++) s += `<polygon data-k="${kWedge}" data-i="${c}" points="${polyStr(inset(wedgePoly(c), 0.025), cx, cy, sc, bottom)}" fill="${col[faces[c]]}" stroke="var(--ink)" stroke-opacity=".35" stroke-width="1"/>`;
  for (let t = 0; t < 5; t++) s += `<polygon data-k="${kPt}" data-i="${t}" points="${polyStr(inset(pointPoly(t), 0.02), cx, cy, sc, bottom)}" fill="${col[pts[t]]}" stroke="var(--ink)" stroke-opacity=".35" stroke-width="1"/>`;
  s += `<polygon points="${polyStr(inset(centerPoly(), 0.02), cx, cy, sc, bottom)}" fill="${col[bottom ? 6 : 5]}" stroke="var(--ink)" stroke-opacity=".35" stroke-width="1"/>`;
  const fy = bottom ? cy - sc - 9 : cy + sc + 15;
  s += `<text x="${cx}" y="${fy}" text-anchor="middle" font-size="10" fill="var(--muted)" font-family="Figtree, sans-serif">front</text>`;
  return s;
}
function renderNet() {
  const p = editing ? paint : paintFromState(state); const col = PCOL();
  const W = 400, sc = 58; let s = `<svg viewBox="0 0 ${W} 300" role="img" aria-label="Flat map of the puzzle">`;
  s += `<text x="100" y="14" text-anchor="middle" font-size="11" font-weight="600" letter-spacing="1" fill="var(--muted)" font-family="Figtree, sans-serif">TOP (from above)</text>`;
  s += `<text x="300" y="14" text-anchor="middle" font-size="11" font-weight="600" letter-spacing="1" fill="var(--muted)" font-family="Figtree, sans-serif">BOTTOM (tipped toward you)</text>`;
  s += starSVG(100, 86, sc, p.tf, p.tp, 'tf', 'tp', false);
  s += starSVG(300, 102, sc, p.bf, p.bp, 'bf', 'bp', true);
  const x0 = 40, cw = 64, ch = 26, y0 = 182;
  ['ts', 'ms', 'bs'].forEach((k, r) => {
    s += `<text x="${x0 - 8}" y="${y0 + r * (ch + 4) + ch / 2 + 4}" text-anchor="end" font-size="10" fill="var(--muted)" font-family="Figtree, sans-serif">${['Top', 'Mid', 'Bot'][r]}</text>`;
    NET_ORDER.forEach((c, j) => { s += `<rect data-k="${k}" data-i="${c}" x="${x0 + j * cw + 1}" y="${y0 + r * (ch + 4)}" width="${cw - 2}" height="${ch}" rx="5" fill="${col[p[k][c]]}" stroke="var(--ink)" stroke-opacity=".3"/>`; });
  });
  ['back-left', 'front-left', 'front-right', 'back-right', 'back'].forEach((n, j) => { s += `<text x="${x0 + j * cw + cw / 2}" y="${y0 + 3 * (ch + 4) + 10}" text-anchor="middle" font-size="10" fill="var(--muted)" font-family="Figtree, sans-serif">${n}</text>`; });
  s += `<text x="${x0 + 2 * cw}" y="${y0 - 5}" text-anchor="middle" font-size="11" fill="var(--accent)">▼</text>`;
  s += '</svg>';
  document.getElementById('net').innerHTML = s;
}
document.getElementById('net').addEventListener('click', (e) => {
  if (!editing) return; const el = e.target.closest('[data-k]'); if (!el) return;
  const k = el.dataset.k, i = +el.dataset.i;
  if (k === 'tf' || k === 'bf' || k === 'tp' || k === 'bp') paint[k][i] = paint[k][i] === Y ? G : Y;
  else paint[k][i] = paintColor;
  renderNet();
});
function renderPalette() {
  const col = PCOL();
  document.getElementById('palette').innerHTML = SIDE_NAMES.map((n, i) => `<button class="pchip" aria-label="${n}" title="${n}" aria-pressed="${i === paintColor}" data-c="${i}" style="background:${col[i]}"></button>`).join('');
}
document.getElementById('palette').addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (!b) return; paintColor = +b.dataset.c; renderPalette(); });
function setEditing(on) {
  editing = on; document.getElementById('netbox').classList.toggle('editing', on);
  document.getElementById('editbar').hidden = !on; document.getElementById('editbtn').hidden = on;
  document.getElementById('editmsg').hidden = true;
  document.getElementById('nettitle').textContent = on ? 'Copy your puzzle\'s colors' : 'Flat map · top, bottom, sides';
  if (on) { paint = paintFromState(state); renderPalette(); }
  renderNet();
}
document.getElementById('editbtn').onclick = () => setEditing(true);
document.getElementById('editcancel').onclick = () => setEditing(false);
document.getElementById('editload').onclick = () => {
  const r = stateFromPaint(paint, state.MP); const box = document.getElementById('editmsg');
  if (r.errs) { box.innerHTML = r.errs.map(x => `<div>${x}</div>`).join(''); box.hidden = false; return; }
  setEditing(false); setStateInstant(r.state);
  selectTab('solve');
};

// ---------------- UI wiring ----------------
function refreshUI() {
  const b = document.getElementById('badge'); const ok = isSolved(state);
  b.classList.toggle('solved', ok); b.querySelector('span').textContent = ok ? 'Solved' : 'Scrambled';
  document.getElementById('counter').textContent = `${moveCount} moves · ${flipCount} flips`;
  renderNet(); updateSolutionCursor();
}
document.querySelectorAll('.mv').forEach(b => b.addEventListener('click', () => enqueue(parseAlg(b.dataset.m))));
document.getElementById('scramble').onclick = () => { setStateInstant(applyAlg(solvedState(), randomScramble(14))); };
document.getElementById('reset').onclick = () => setStateInstant(solvedState());
document.getElementById('undo').onclick = () => { if (anim || queue.length || !history.length) return; const h = history[history.length - 1]; enqueue(invert([h.move]), { undo: true }); };
document.getElementById('speed').addEventListener('input', (e) => { speed = +e.target.value; });
const KEYS = { u: 'U', y: "U'", e: 'E', w: "E'", d: 'D', s: "D'", ' ': '/', '/': '/' };
window.addEventListener('keydown', (e) => {
  if (e.target.closest('input,textarea,select') || e.metaKey || e.ctrlKey || e.altKey) return;
  const m = KEYS[e.key.toLowerCase()]; if (!m) return; e.preventDefault(); enqueue(parseAlg(m));
});
function selectTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', t.dataset.tab === name));
  document.querySelectorAll('[data-panel]').forEach(p => p.hidden = p.dataset.panel !== name);
  try { localStorage.setItem('st-tab', name); } catch (e) {}
}
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => selectTab(t.dataset.tab)));

// ---------------- solution panel ----------------
let solution = null; // {flat:[{m,step,idx}], cursor, startState}
function markSolutionStale() {
  if (!solution || solution.applying) return;
  solution = null;
  const out = document.getElementById('solveout');
  if (out.dataset.has) { out.innerHTML = '<p class="muted small">The puzzle changed. Press Find a solution again.</p>'; delete out.dataset.has; }
  setPlayButtons();
}
function setPlayButtons() {
  const has = !!solution, left = has && solution.cursor < solution.flat.length;
  document.getElementById('playbtn').disabled = !left; document.getElementById('stepbtn').disabled = !left;
  document.getElementById('backbtn').disabled = !(has && solution.cursor > 0);
  document.getElementById('playbtn').textContent = has && solution.playing ? 'Pause' : 'Play';
}
const STEP_COLORS = { mid: 'var(--pO)', faces: 'var(--pY)', cols: 'var(--pB)' };
const STEP_NOTES = {
  mid: 'Swap pairs of middle pieces with E turns and single flips until it reads white, red, orange, magenta, blue going clockwise from above.',
  faces: 'Only U, D and pairs of flips from here on, so the middle stays put while yellow moves up and green moves down.',
  cols: 'Top 3-cycles, bottom 3-cycles and the double swap, aimed with U and D turns, move each wedge into its column.',
};
document.getElementById('solvebtn').onclick = () => {
  if (anim || queue.length) return;
  const out = document.getElementById('solveout');
  if (isSolved(state)) { out.innerHTML = '<p class="muted small">Already solved. Press Scramble or enter your own puzzle first.</p>'; return; }
  out.innerHTML = '<p class="muted small">Working…</p>';
  setTimeout(() => {
    const r = solveAll(state);
    if (r.error) { out.innerHTML = `<div class="msg err">${r.error}</div>`; return; }
    const flat = []; r.steps.forEach((st, si) => st.moves.forEach((m, mi) => flat.push({ m, si, mi })));
    solution = { flat, cursor: 0, playing: false, steps: r.steps };
    out.dataset.has = '1';
    out.innerHTML = r.steps.map((st, si) => {
      const nf = st.moves.filter(m => m.L === '/').length;
      const chips = st.moves.length ? st.moves.map((m, mi) => `<span class="chip${m.L === '/' ? ' f' : ''}" data-s="${si}" data-i="${mi}">${fmtMove(m)}</span>`).join('') : '<span class="muted small">Already done, nothing to do.</span>';
      return `<div class="step"><div class="stephead"><span class="num" style="background:${STEP_COLORS[st.id]};color:#1a1c34">${si + 1}</span><h3>${st.title}</h3><span class="meta">${st.moves.length} moves · ${nf} flips</span></div><p class="small muted">${STEP_NOTES[st.id]}</p><div class="chips">${chips}</div></div>`;
    }).join('') + `<p class="small muted">Total ${flat.length} moves. Press Play to watch, or Next move to go one at a time alongside your real puzzle.</p>`;
    setPlayButtons(); updateSolutionCursor();
  }, 20);
};
function updateSolutionCursor() {
  if (!solution) return;
  document.querySelectorAll('#solveout .chip').forEach(ch => {
    const idx = solution.flat.findIndex(f => f.si === +ch.dataset.s && f.mi === +ch.dataset.i);
    ch.classList.toggle('done', idx < solution.cursor); ch.classList.toggle('cur', idx === solution.cursor);
  });
  setPlayButtons();
}
function stepForward(after) {
  if (!solution || solution.cursor >= solution.flat.length) { if (solution) solution.playing = false; setPlayButtons(); return; }
  const f = solution.flat[solution.cursor]; solution.applying = true;
  enqueue([f.m], { fromSolution: true, onDone: () => { solution.applying = false; solution.cursor++; updateSolutionCursor(); if (after) after(); } });
}
function playLoop() { if (!solution || !solution.playing) return; stepForward(() => { if (solution && solution.playing) { if (solution.cursor < solution.flat.length) playLoop(); else { solution.playing = false; setPlayButtons(); } } }); }
document.getElementById('playbtn').onclick = () => { if (!solution) return; solution.playing = !solution.playing; setPlayButtons(); if (solution.playing && !anim && !queue.length) playLoop(); };
document.getElementById('stepbtn').onclick = () => { if (!solution || anim || queue.length) return; solution.playing = false; stepForward(); };
document.getElementById('backbtn').onclick = () => {
  if (!solution || anim || queue.length || solution.cursor === 0) return; solution.playing = false;
  const f = solution.flat[solution.cursor - 1]; solution.applying = true;
  enqueue(invert([f.m]), { fromSolution: true, undo: true, onDone: () => { solution.applying = false; solution.cursor--; updateSolutionCursor(); } });
};

// ---------------- algorithm library ----------------
const ALGS = [
  { tag: 'Step 1 · Middle', name: 'Swap two middle pieces', alg: '/', arrows: ['M'],
    text: 'Swaps the front-left and front-right middle pieces. Turn E first to bring the pair you want to the front, then undo the E turn. Top and bottom get mixed, so use it only in Step 1.' },
  { tag: 'Step 1 · Middle', name: 'Middle 3-cycle', alg: "E' / E /", arrows: ['M'],
    text: 'Cycles three middle pieces and puts everything else back. Handy when you want to fix the middle without disturbing a solved top and bottom.' },
  { tag: 'Step 2 · Faces', name: 'Point swap', alg: "D' U / D U' / D U / D2' /", arrows: [], mode: 'case',
    text: 'Case: the top star point at the front tip is green and the bottom one under it is yellow. This trades them. Every wedge stays on its own layer and the middle stays put; wedge side colors get shuffled, which Step 3 fixes.' },
  { tag: 'Step 2 · Faces', name: 'Wedge face swap', alg: "/ D / D / D2' /", arrows: [], mode: 'case',
    text: 'Case: the top front-right wedge is green and the bottom front-right wedge is yellow. This trades them and keeps the middle. Turn U and D first to line the two wedges up there.' },
  { tag: 'Step 2 · Faces', name: 'Wedge face swap, far', alg: "/ D2' / D2' / D' /", arrows: [], mode: 'case',
    text: 'Case: the top front-right wedge is green and the yellow wedge is at the back of the bottom layer. This trades them in one go.' },
  { tag: 'Step 3 · Columns', name: 'Top 3-cycle', alg: 'U / U2 / U / U2 /', arrows: ['T'],
    text: 'Cycles three top wedges: front-left to front-right, front-right to back-right, back-right to front-left. Nothing else moves. Do it twice to cycle the other way.' },
  { tag: 'Step 3 · Columns', name: 'Top 3-cycle, reverse', alg: "/ U2' / U' / U2' / U'", arrows: ['T'],
    text: 'The same three top wedges, cycled the other way. It is the Top 3-cycle played backwards.' },
  { tag: 'Step 3 · Columns', name: 'Bottom 3-cycle', alg: 'D / D2 / D / D2 /', arrows: ['B'],
    text: 'The mirror of the Top 3-cycle for the bottom layer: front-right to front-left, front-left to back-left, back-left to front-right.' },
  { tag: 'Step 3 · Parity', name: 'Double swap', alg: "U' D / D' / U D / U' / U D'", arrows: ['T', 'B'],
    text: 'Swaps the front two top wedges and, at the same time, the front two bottom wedges. Use it when a single pair is left swapped on top and on the bottom.' },
  { tag: 'Step 3 · Parity', name: 'Top double swap', alg: 'U2 / U2 / U / U\' / U / U2 /', arrows: ['T'],
    text: 'Swaps two pairs of top wedges at once: front-left with front-right, and back-right with back. Bottom and middle stay solved.' },
];
function effectSVG(alg, arrows, mode) {
  const col = PCOL(); const s0 = solvedState();
  // 'case' diagrams show the position the algorithm fixes; others show what it does to a solved puzzle
  const isCase = mode === 'case';
  const r = isCase ? applyAlg(s0, invert(parseAlg(alg))) : applyAlg(s0, parseAlg(alg));
  const sideFill = (id) => isCase ? 'var(--soft)' : col[sideOf(id)];
  const x0 = 34, cw = 50, ch = 18, top = 22, W = x0 + 5 * cw + 14; const rows = [['T', r.TW], ['M', r.MW], ['B', r.BW]];
  const xOf = (c) => x0 + NET_ORDER.indexOf(c) * cw + cw / 2; const yOf = (ri) => top + ri * (ch + 6) + ch / 2;
  let s = `<svg viewBox="0 0 ${W} ${top + 3 * (ch + 6) + 18}" role="img" aria-label="Effect of ${alg}"><defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--ink)"/></marker></defs>`;
  rows.forEach(([L, arr], ri) => {
    s += `<text x="${x0 - 8}" y="${yOf(ri) + 4}" text-anchor="end" font-size="10" fill="var(--muted)" font-family="Figtree, sans-serif">${L === 'T' ? 'Top' : L === 'M' ? 'Mid' : 'Bot'}</text>`;
    NET_ORDER.forEach((c, j) => {
      const id = arr[c]; const x = x0 + j * cw + 2, y = top + ri * (ch + 6);
      s += `<rect x="${x}" y="${y}" width="${cw - 4}" height="${ch}" rx="4" fill="${sideFill(id)}" stroke="var(--ink)" stroke-opacity=".25"/>`;
      if (L !== 'M') { const f = faceOf(id); const by = L === 'T' ? y - 5 : y + ch + 1; s += `<rect x="${x}" y="${by}" width="${cw - 4}" height="4" rx="2" fill="${col[f]}" stroke="var(--ink)" stroke-opacity="${f !== (L === 'T' ? Y : G) ? .9 : .2}" stroke-width="${f !== (L === 'T' ? Y : G) ? 1.4 : .6}"/>`; }
    });
  });
  // star points along the strip edges
  const tipX = (t) => { if (t === 3) return x0 + 5 * cw; return x0 + (NET_ORDER.indexOf(t) - 0) * cw; };
  [['T', r.TP, top - 9, Y], ['B', r.BP, top + 2 * (ch + 6) + ch + 9, G]].forEach(([L, arr, y, home]) => {
    arr.forEach((id, t) => { const f = faceOf(id); if (f === home) return; const x = tipX(t); s += `<polygon points="${x - 6},${y + (L === 'T' ? -4 : 4)} ${x + 6},${y + (L === 'T' ? -4 : 4)} ${x},${y + (L === 'T' ? 5 : -5)}" fill="${col[f]}" stroke="var(--ink)" stroke-width="1.2"/>`; });
  });
  for (const L of arrows) {
    const ri = { T: 0, M: 1, B: 2 }[L]; const arr = rows[ri][1]; const base = { T: 0, M: 5, B: 10 }[L];
    arr.forEach((id, dst) => { const src = id - base; if (src === dst) return; const x1 = xOf(src), x2 = xOf(dst), y = yOf(ri); const bend = (x2 > x1 ? -1 : 1) * (8 + Math.abs(x2 - x1) * 0.12) * (L === 'B' ? -1 : 1);
      s += `<path d="M${x1},${y} Q${(x1 + x2) / 2},${y + bend * 1.6} ${x2},${y}" fill="none" stroke="var(--ink)" stroke-width="1.6" marker-end="url(#ah)"/>`; });
  }
  s += `<text x="${x0 + 2 * cw}" y="${top + 3 * (ch + 6) + 14}" text-anchor="middle" font-size="10" fill="var(--accent)">▲ front</text>`;
  return s + '</svg>';
}
function renderAlgs() {
  document.getElementById('alglist').innerHTML = ALGS.map((a, i) => {
    const ms = parseAlg(a.alg); const nf = ms.filter(m => m.L === '/').length;
    return `<article class="alg"><span class="tag">${a.tag}</span><h3>${a.name}</h3>${effectSVG(a.alg, a.arrows, a.mode)}<div class="chips">${ms.map(m => `<span class="chip${m.L === '/' ? ' f' : ''}">${fmtMove(m)}</span>`).join('')}</div><p class="small muted">${a.text}</p><p class="small muted">${ms.length} moves · ${nf} flip${nf === 1 ? '' : 's'}</p><div class="row"><button class="btn primary" data-watch="${i}">Watch</button><button class="btn" data-apply="${i}">Apply</button><button class="btn" data-copy="${i}">Copy</button></div></article>`;
  }).join('');
}
document.getElementById('alglist').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.watch) { const a = ALGS[+b.dataset.watch]; const ms = parseAlg(a.alg); setStateInstant(applyAlg(solvedState(), invert(ms))); setTimeout(() => enqueue(ms), 350); window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); }
  if (b.dataset.apply) { enqueue(parseAlg(ALGS[+b.dataset.apply].alg)); }
  if (b.dataset.copy) { const txt = ALGS[+b.dataset.copy].alg; const done = () => { b.textContent = 'Copied'; setTimeout(() => b.textContent = 'Copy', 1200); };
    try { navigator.clipboard.writeText(txt).then(done, () => { b.textContent = txt; }); } catch (err) { b.textContent = txt; } }
});

// ---------------- boot ----------------
function rebuildColors() { Object.keys(mats).forEach(k => { mats[k].dispose(); delete mats[k]; }); buildMeshes(); buildGuide(); placeAll(state); renderNet(); renderAlgs(); if (editing) renderPalette(); }
buildMeshes(); buildGuide(); placeAll(state); resize(); renderAlgs(); refreshUI();
try { const t = localStorage.getItem('st-tab'); if (t) selectTab(t); } catch (e) {}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', rebuildColors);
new MutationObserver(rebuildColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
// open in a scrambled working state so the solver has something to do
setStateInstant(applyAlg(solvedState(), parseAlg("U / D2' E / U2 D / E' / U' D2 / U2 E2 / D'")));
requestAnimationFrame(tick);
