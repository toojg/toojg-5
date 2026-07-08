/* ============================================================================
   Flock of Cursors — boid-flocking pointer cursors on a 2D canvas.
   Core mechanism extracted from the original experiment; wrapped as a
   mount(container) module that fills its container and cleans up on destroy().
   ============================================================================ */

export function mount(container) {
  // ─── Behaviour weights ──────────────────────────────────────────────────
  const NUM_CURSORS = 35;
  const COHESION_WEIGHT = 0.003;
  const ALIGNMENT_WEIGHT = 0.04;
  const SEPARATION_WEIGHT = 1.8;
  const MOUSE_WEIGHT = 0.02;
  const SEPARATION_RADIUS = 28;
  const PERCEPTION_RADIUS = 100;
  const MAX_SPEED = 2.8;
  const MAX_FORCE = 0.12;
  const EDGE_MARGIN = 20;
  const EDGE_FORCE = 0.3;
  const TILT_RANGE = 18;       // degrees of tilt that maps to the full canvas
  const TILT_SMOOTHING = 0.1;  // per-frame lerp toward the tilt target

  // ─── Canvas (fills container, DPR-aware) ────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let W = 1, H = 1;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = container.clientWidth || 1;
    H = container.clientHeight || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();

  // ─── Input state ────────────────────────────────────────────────────────
  // Desktop: mouseX/Y track the pointer. Touch devices start in 'touch' mode
  // (flock follows the finger) and upgrade to 'tilt' once deviceorientation
  // data flows — the tilt target is smoothed into mouseX/Y in the frame loop.
  const isTouchDevice = matchMedia('(pointer: coarse)').matches;
  let inputMode = 'mouse';
  let mouseInBox = false, mouseX = W / 2, mouseY = H / 2;
  let targetX = W / 2, targetY = H / 2;

  // ─── Vector helpers ─────────────────────────────────────────────────────
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const mul = (a, s) => ({ x: a.x * s, y: a.y * s });
  const mag = (v) => Math.hypot(v.x, v.y);
  const norm = (v) => { const m = mag(v); return m > 0 ? { x: v.x / m, y: v.y / m } : { x: 0, y: 0 }; };
  const limit = (v, max) => { const m = mag(v); return m > max ? mul(v, max / m) : v; };
  const dist = (a, b) => mag(sub(a, b));

  // ─── Boid ───────────────────────────────────────────────────────────────
  class Boid {
    constructor() {
      this.pos = { x: 40 + Math.random() * (W - 80), y: 40 + Math.random() * (H - 80) };
      this.vel = { x: 0, y: 0 };
      this.acc = { x: 0, y: 0 };
      this.maxSpeed = MAX_SPEED * (0.7 + Math.random() * 0.6);
      this.maxForce = MAX_FORCE * (0.7 + Math.random() * 0.6);
      this.mouseAffinity = MOUSE_WEIGHT * (0.6 + Math.random() * 0.8);
      this.scale = 0.9 + Math.random() * 0.2;
      this.angle = Math.random() * Math.PI * 2;
    }
    applyForce(f) { this.acc = add(this.acc, limit(f, this.maxForce)); }
    cohesion(ns) {
      if (!ns.length) return { x: 0, y: 0 };
      let c = { x: 0, y: 0 };
      for (const n of ns) c = add(c, n.pos);
      c = mul(c, 1 / ns.length);
      return mul(sub(c, this.pos), COHESION_WEIGHT);
    }
    alignment(ns) {
      if (!ns.length) return { x: 0, y: 0 };
      let a = { x: 0, y: 0 };
      for (const n of ns) a = add(a, n.vel);
      a = mul(a, 1 / ns.length);
      return mul(sub(a, this.vel), ALIGNMENT_WEIGHT);
    }
    separation(ns) {
      let steer = { x: 0, y: 0 }, count = 0;
      for (const n of ns) {
        const d = dist(this.pos, n.pos);
        if (d < SEPARATION_RADIUS && d > 0) { steer = add(steer, mul(norm(sub(this.pos, n.pos)), 1 / d)); count++; }
      }
      return count ? mul(steer, SEPARATION_WEIGHT) : steer;
    }
    seekMouse() { return mul(sub({ x: mouseX, y: mouseY }, this.pos), this.mouseAffinity); }
    avoidEdges() {
      const s = { x: 0, y: 0 };
      if (this.pos.x < EDGE_MARGIN) s.x = EDGE_FORCE;
      if (this.pos.x > W - EDGE_MARGIN) s.x = -EDGE_FORCE;
      if (this.pos.y < EDGE_MARGIN) s.y = EDGE_FORCE;
      if (this.pos.y > H - EDGE_MARGIN) s.y = -EDGE_FORCE;
      return s;
    }
    update(all) {
      const ns = [];
      for (const o of all) { if (o !== this && dist(this.pos, o.pos) < PERCEPTION_RADIUS) ns.push(o); }
      if (mouseInBox) {
        this.applyForce(this.cohesion(ns));
        this.applyForce(this.alignment(ns));
        this.applyForce(this.separation(ns));
        this.applyForce(this.seekMouse());
      }
      this.applyForce(this.avoidEdges());
      this.vel = limit(add(this.vel, this.acc), this.maxSpeed);
      this.pos = add(this.pos, this.vel);
      this.acc = { x: 0, y: 0 };
      this.pos.x = Math.max(2, Math.min(W - 2, this.pos.x));
      this.pos.y = Math.max(2, Math.min(H - 2, this.pos.y));
      if (!mouseInBox) {
        this.vel = mul(this.vel, 0.92);
        if (mag(this.vel) < 0.05) this.vel = { x: 0, y: 0 };
      }
      if (mag(this.vel) > 0.2) {
        const target = Math.atan2(this.vel.y, this.vel.x);
        let diff = target - this.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.angle += diff * 0.12;
      }
    }
    draw() {
      ctx.save();
      ctx.translate(this.pos.x, this.pos.y);
      ctx.rotate(this.angle + Math.PI * 0.75);
      ctx.scale(this.scale, this.scale);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, 18); ctx.lineTo(5, 14); ctx.lineTo(9, 21);
      ctx.lineTo(12, 19.5); ctx.lineTo(8, 13); ctx.lineTo(13, 13);
      ctx.closePath();
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.restore();
    }
  }

  const boids = Array.from({ length: NUM_CURSORS }, () => new Boid());

  // ─── Loop ───────────────────────────────────────────────────────────────
  let raf = 0;
  function frame() {
    if (inputMode === 'tilt') {
      mouseX += (targetX - mouseX) * TILT_SMOOTHING;
      mouseY += (targetY - mouseY) * TILT_SMOOTHING;
    }
    ctx.clearRect(0, 0, W, H);
    for (const b of boids) b.update(boids);
    for (const b of boids) b.draw();
    raf = requestAnimationFrame(frame);
  }
  frame();

  // ─── Events: desktop mouse ──────────────────────────────────────────────
  const onEnter = () => { mouseInBox = true; };
  const onLeave = () => { mouseInBox = false; };
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left; mouseY = e.clientY - r.top;
  };

  // ─── Events: touch fallback (flock follows the finger) ─────────────────
  let baseTiltX = null, baseTiltY = null;
  const onTouchMove = (e) => {
    if (inputMode === 'tilt') return;
    inputMode = 'touch';
    mouseInBox = true;
    const t = e.touches[0];
    const r = canvas.getBoundingClientRect();
    mouseX = t.clientX - r.left; mouseY = t.clientY - r.top;
  };
  let lastTapTime = 0;
  const onTouchStart = (e) => {
    const now = Date.now();
    if (now - lastTapTime < 300) { baseTiltX = null; } // double-tap: recalibrate neutral pose
    lastTapTime = now;
    onTouchMove(e);
  };
  const onTouchEnd = () => { if (inputMode !== 'tilt') mouseInBox = false; };

  // ─── Events: device tilt ────────────────────────────────────────────────
  let sensorTimer = 0;
  const onOrientation = (e) => {
    if (e.beta == null || e.gamma == null) return;
    clearTimeout(sensorTimer);
    // Remap beta (front/back) and gamma (left/right) into screen-space tilt
    // so landscape works: angle is how far the screen is rotated from portrait.
    const angle = ((screen.orientation?.angle ?? window.orientation ?? 0) + 360) % 360;
    let tiltX, tiltY;
    if (angle === 90) { tiltX = e.beta; tiltY = -e.gamma; }
    else if (angle === 180) { tiltX = -e.gamma; tiltY = -e.beta; }
    else if (angle === 270) { tiltX = -e.beta; tiltY = e.gamma; }
    else { tiltX = e.gamma; tiltY = e.beta; }
    if (baseTiltX == null) { baseTiltX = tiltX; baseTiltY = tiltY; } // however the phone is held = center
    inputMode = 'tilt';
    mouseInBox = true;
    const unit = (v) => Math.max(-1, Math.min(1, v / TILT_RANGE));
    targetX = W / 2 + unit(tiltX - baseTiltX) * (W / 2 - EDGE_MARGIN);
    targetY = H / 2 + unit(tiltY - baseTiltY) * (H / 2 - EDGE_MARGIN);
  };

  // iOS gates motion sensors behind a permission prompt that can only be
  // triggered from a tap; Android fires deviceorientation freely.
  let hint = null;
  const onPermissionTap = () => {
    container.removeEventListener('click', onPermissionTap);
    if (hint) { hint.remove(); hint = null; }
    DeviceOrientationEvent.requestPermission()
      .then((state) => {
        if (state === 'granted') window.addEventListener('deviceorientation', onOrientation);
      })
      .catch(() => {}); // denied → stay in touch mode
  };

  if (isTouchDevice) {
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchEnd);
    const needsPermission = typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function';
    if (needsPermission) {
      if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
      hint = document.createElement('div');
      hint.textContent = 'tap to enable tilt';
      hint.style.cssText =
        'position:absolute;left:50%;bottom:10px;transform:translateX(-50%);' +
        'padding:4px 12px;border-radius:999px;background:rgba(0,0,0,.55);color:#fff;' +
        'font-family:inherit;font-size:11px;line-height:1.5;pointer-events:none;white-space:nowrap';
      container.appendChild(hint);
      container.addEventListener('click', onPermissionTap);
    } else if ('DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', onOrientation);
      // No event within 1.5s → no usable sensor; stay in touch mode.
      sensorTimer = setTimeout(() => window.removeEventListener('deviceorientation', onOrientation), 1500);
    }
  } else {
    canvas.addEventListener('mouseenter', onEnter);
    canvas.addEventListener('mouseleave', onLeave);
    canvas.addEventListener('mousemove', onMove);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  // ─── Teardown ───────────────────────────────────────────────────────────
  return {
    destroy() {
      cancelAnimationFrame(raf);
      clearTimeout(sensorTimer);
      ro.disconnect();
      canvas.removeEventListener('mouseenter', onEnter);
      canvas.removeEventListener('mouseleave', onLeave);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('deviceorientation', onOrientation);
      container.removeEventListener('click', onPermissionTap);
      if (hint) hint.remove();
      canvas.remove();
    }
  };
}
