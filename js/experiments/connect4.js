/* ============================================================================
   Connect 4 — 3D board with a bouncy chip-drop, win/draw detection, hover
   preview, and score keeping. Core engine extracted from the prototype (the
   single shared engine behind both original variants); wrapped as a mount()
   module with a minimal self-contained HUD. Needs three.js (via importmap).
   ============================================================================ */

import * as THREE from 'three';

export function mount(container) {
  // ─── Constants ──────────────────────────────────────────────────────────
  const COLS = 7, ROWS = 6, CELL = 1.2, HOLE_R = 0.48;
  const CHIP_R = 0.44, CHIP_H = 0.35, BOARD_D = 0.8, BOARD_W = 9.0, BOARD_H = 7.8, CR = 0.3;
  const EMPTY = 0, RED = 1, YLW = 2;
  const CLR = { [RED]: 0xef4444, [YLW]: 0xeab308 };
  const NAME = { [RED]: 'Red', [YLW]: 'Yellow' };
  const CLR_CSS = { [RED]: '#ef4444', [YLW]: '#eab308' };
  const CLR_GLOW = { [RED]: 'rgba(239,68,68,0.5)', [YLW]: 'rgba(234,179,8,0.5)' };

  // ─── State ──────────────────────────────────────────────────────────────
  let grid, cur, over, animating;
  const scores = { [RED]: 0, [YLW]: 0 };
  const chips = [];
  function resetState() {
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    cur = cur === RED ? YLW : RED;
    if (cur === undefined) cur = RED;
    over = false; animating = false;
  }
  resetState();

  // ─── Minimal HUD (self-contained) ───────────────────────────────────────
  container.style.position = container.style.position || 'relative';
  const hud = document.createElement('div');
  hud.style.cssText = 'position:absolute;top:16px;left:0;width:100%;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;z-index:5;font-family:var(--font-sans)';
  hud.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px">
      <span class="c4-dot" style="width:12px;height:12px;border-radius:50%;background:#ef4444"></span>
      <span class="c4-turn" style="color:var(--color-text);font-size:var(--text-body);line-height:var(--leading-body);font-weight:var(--weight-light)">Red's turn</span>
    </div>
    <div style="display:flex;gap:20px;font-size:var(--text-label);line-height:var(--leading-label);letter-spacing:var(--tracking-label);font-weight:var(--weight-regular)">
      <span class="c4-sr" style="color:#ef4444">Red: 0</span>
      <span class="c4-sy" style="color:#eab308">Yellow: 0</span>
    </div>`;
  const msg = document.createElement('div');
  msg.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) scale(.9);background:rgba(0,0,0,.85);color:var(--color-text);padding:20px 36px;border-radius:16px;text-align:center;z-index:6;border:1px solid var(--color-stroke);opacity:0;pointer-events:none;transition:opacity .3s,transform .3s;font-family:var(--font-sans);font-size:var(--text-caption);line-height:var(--leading-caption);font-weight:var(--weight-regular)';
  container.appendChild(hud);
  container.appendChild(msg);
  const dotEl = hud.querySelector('.c4-dot');
  const turnEl = hud.querySelector('.c4-turn');
  const srEl = hud.querySelector('.c4-sr');
  const syEl = hud.querySelector('.c4-sy');

  // ─── Scene ──────────────────────────────────────────────────────────────
  const w0 = container.clientWidth || 1, h0 = container.clientHeight || 1;
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(42, w0 / h0, 0.1, 100);
  camera.position.set(0, 1.8, 15);
  camera.lookAt(0, -0.2, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(w0, h0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';

  // ─── Lights ─────────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(5, 10, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 30;
  sun.shadow.camera.left = -10; sun.shadow.camera.right = 10;
  sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -10;
  sun.shadow.bias = -0.001;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8ecae6, 0.3);
  fill.position.set(-4, 3, 5);
  scene.add(fill);

  const cPos = (c, r) => new THREE.Vector3((c - 3) * CELL, (r - 2.5) * CELL, 0);

  // ─── Board ──────────────────────────────────────────────────────────────
  function makeBoard() {
    const hw = BOARD_W / 2, hh = BOARD_H / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-hw + CR, -hh);
    shape.lineTo(hw - CR, -hh);
    shape.quadraticCurveTo(hw, -hh, hw, -hh + CR);
    shape.lineTo(hw, hh - CR);
    shape.quadraticCurveTo(hw, hh, hw - CR, hh);
    shape.lineTo(-hw + CR, hh);
    shape.quadraticCurveTo(-hw, hh, -hw, hh - CR);
    shape.lineTo(-hw, -hh + CR);
    shape.quadraticCurveTo(-hw, -hh, -hw + CR, -hh);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = cPos(c, r);
        const hole = new THREE.Path();
        hole.absarc(p.x, p.y, HOLE_R, 0, Math.PI * 2, true);
        shape.holes.push(hole);
      }
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: BOARD_D, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 28 });
    const mat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.35, metalness: 0.08 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.z = -BOARD_D;
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
  }
  makeBoard();

  const bp = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_W - 0.2, BOARD_H - 0.2), new THREE.MeshStandardMaterial({ color: 0x172554, roughness: 0.7 }));
  bp.position.z = -BOARD_D - 0.01; scene.add(bp);
  const base = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W + 0.3, 0.45, BOARD_D + 0.5), new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.35, metalness: 0.08 }));
  base.position.set(0, -BOARD_H / 2 - 0.225, -BOARD_D / 2); base.castShadow = true; base.receiveShadow = true; scene.add(base);
  // Shadow-only ground: catches chip/board shadows but stays invisible so the
  // container background shows through the transparent canvas.
  const gnd = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), new THREE.ShadowMaterial({ opacity: 0.35 }));
  gnd.rotation.x = -Math.PI / 2; gnd.position.y = -BOARD_H / 2 - 0.45; gnd.receiveShadow = true; scene.add(gnd);

  // Column hit zones
  const zones = [];
  for (let c = 0; c < COLS; c++) {
    const z = new THREE.Mesh(new THREE.PlaneGeometry(CELL, BOARD_H + 3), new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
    z.position.set(cPos(c, 0).x, 0.5, 0.5);
    z.userData.col = c;
    scene.add(z); zones.push(z);
  }

  // Preview chip
  const pvMat = new THREE.MeshStandardMaterial({ color: CLR[RED], transparent: true, opacity: 0.45, roughness: 0.4 });
  const preview = new THREE.Mesh(new THREE.CylinderGeometry(CHIP_R, CHIP_R, CHIP_H, 32), pvMat);
  preview.rotation.x = Math.PI / 2; preview.visible = false; scene.add(preview);
  let hoverCol = -1;

  function makeChip(player) {
    const mat = new THREE.MeshStandardMaterial({ color: CLR[player], roughness: 0.3, metalness: 0.12, emissive: CLR[player], emissiveIntensity: 0.08 });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(CHIP_R, CHIP_R, CHIP_H, 32), mat);
    m.rotation.x = Math.PI / 2; m.castShadow = true;
    return m;
  }

  // ─── Animation ──────────────────────────────────────────────────────────
  function easeOutBounce(t) {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  }
  function dropAnim(chip, startY, endY, dur, cb) {
    const t0 = performance.now();
    (function tick() {
      const t = Math.min((performance.now() - t0) / dur, 1);
      chip.position.y = startY + (endY - startY) * easeOutBounce(t);
      if (t < 1) requestAnimationFrame(tick);
      else { chip.position.y = endY; cb(); }
    })();
  }

  // ─── Game logic ─────────────────────────────────────────────────────────
  const lowestRow = (c) => { for (let r = 0; r < ROWS; r++) if (grid[r][c] === 0) return r; return -1; };
  function checkWin(c, r, p) {
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dx, dy] of dirs) {
      let cnt = 1; const cells = [[c, r]];
      for (const s of [1, -1]) {
        let cc = c + dx * s, rr = r + dy * s;
        while (cc >= 0 && cc < COLS && rr >= 0 && rr < ROWS && grid[rr][cc] === p) { cnt++; cells.push([cc, rr]); cc += dx * s; rr += dy * s; }
      }
      if (cnt >= 4) return cells;
    }
    return null;
  }
  const isDraw = () => grid[ROWS - 1].every((v) => v !== 0);

  function drop(col) {
    if (over || animating) return;
    const row = lowestRow(col);
    if (row < 0) return;
    animating = true;
    const player = cur;
    grid[row][col] = player;
    const chip = makeChip(player);
    const target = cPos(col, row);
    chip.position.set(target.x, BOARD_H / 2 + 2, -BOARD_D / 2);
    scene.add(chip); chips.push(chip);
    dropAnim(chip, chip.position.y, target.y, 550, () => {
      animating = false;
      const win = checkWin(col, row, player);
      if (win) { over = true; scores[player]++; updScores(); highlightWin(win); showMsg(`${NAME[player]} wins!`); resetTimer = setTimeout(resetGame, 2200); return; }
      if (isDraw()) { over = true; showMsg("It's a draw!"); resetTimer = setTimeout(resetGame, 2200); return; }
      cur = cur === RED ? YLW : RED; updTurn();
    });
  }
  function highlightWin(cells) {
    chips.forEach((ch) => {
      const isWin = cells.some(([c, r]) => { const p = cPos(c, r); return Math.abs(ch.position.x - p.x) < 0.05 && Math.abs(ch.position.y - p.y) < 0.05; });
      if (!isWin) { ch.material.opacity = 0.25; ch.material.transparent = true; }
      else { ch.material.emissiveIntensity = 0.5; }
    });
  }
  let resetTimer = null;
  function resetGame() {
    chips.forEach((ch) => { scene.remove(ch); ch.geometry.dispose(); ch.material.dispose(); });
    chips.length = 0; resetState(); updTurn(); hideMsg();
  }

  // ─── HUD updates ────────────────────────────────────────────────────────
  function updTurn() {
    dotEl.style.background = CLR_CSS[cur];
    dotEl.style.boxShadow = `0 0 8px ${CLR_GLOW[cur]}`;
    turnEl.textContent = `${NAME[cur]}'s turn`;
    pvMat.color.setHex(CLR[cur]);
  }
  function updScores() { srEl.textContent = `Red: ${scores[RED]}`; syEl.textContent = `Yellow: ${scores[YLW]}`; }
  function showMsg(t) { msg.textContent = t; msg.style.opacity = '1'; msg.style.transform = 'translate(-50%,-50%) scale(1)'; }
  function hideMsg() { msg.style.opacity = '0'; msg.style.transform = 'translate(-50%,-50%) scale(.9)'; }

  // ─── Interaction (container-relative) ───────────────────────────────────
  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  function setMouse(clientX, clientY) {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.x = ((clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -((clientY - r.top) / r.height) * 2 + 1;
  }
  function updateHover() {
    ray.setFromCamera(mouse, camera);
    const hits = ray.intersectObjects(zones);
    if (hits.length && !over && !animating) {
      const c = hits[0].object.userData.col;
      if (lowestRow(c) >= 0) {
        hoverCol = c; preview.visible = true;
        preview.position.set(cPos(c, 0).x, BOARD_H / 2 + 1, -BOARD_D / 2);
        renderer.domElement.style.cursor = 'pointer';
        return;
      }
    }
    hoverCol = -1; preview.visible = false; renderer.domElement.style.cursor = 'default';
  }
  const onMove = (e) => { setMouse(e.clientX, e.clientY); updateHover(); };
  const onClick = () => { if (hoverCol >= 0) drop(hoverCol); };
  const onTouch = (e) => {
    const t = e.touches[0];
    setMouse(t.clientX, t.clientY);
    ray.setFromCamera(mouse, camera);
    const hits = ray.intersectObjects(zones);
    if (hits.length && !over && !animating) { const c = hits[0].object.userData.col; if (lowestRow(c) >= 0) drop(c); }
  };
  renderer.domElement.addEventListener('mousemove', onMove);
  renderer.domElement.addEventListener('click', onClick);
  renderer.domElement.addEventListener('touchstart', onTouch, { passive: true });

  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  // ─── Loop ───────────────────────────────────────────────────────────────
  let raf = 0, floatT = 0;
  function animate() {
    raf = requestAnimationFrame(animate);
    if (preview.visible) { floatT += 0.04; preview.position.y = BOARD_H / 2 + 1 + Math.sin(floatT) * 0.08; }
    renderer.render(scene, camera);
  }
  animate();
  updTurn();

  return {
    destroy() {
      cancelAnimationFrame(raf);
      if (resetTimer) clearTimeout(resetTimer);
      ro.disconnect();
      renderer.domElement.removeEventListener('mousemove', onMove);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('touchstart', onTouch);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
      hud.remove(); msg.remove();
    }
  };
}
