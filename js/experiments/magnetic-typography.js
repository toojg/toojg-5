/* ============================================================================
   Magnetic Typography — spring-mass letters that scatter from the cursor and
   spring back home. Core mechanism extracted; wrapped as a mount() module.
   ============================================================================ */

export function mount(container) {
  const PHRASE = 'DESIGN IS MY PASSION';

  // Physics
  const SPRING_K = 0.025;
  const DAMPING = 0.88;
  const REPULSE_RADIUS = 150;
  const REPULSE_STRENGTH = 12000;
  const MAX_VEL = 18;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let W = 1, H = 1, FONT_SIZE = 56, LINE_HEIGHT = 66;
  function sizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = container.clientWidth || 1;
    H = container.clientHeight || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Scale type to the box so the phrase fits nicely at any size
    FONT_SIZE = Math.max(24, Math.min(56, W * 0.11));
    LINE_HEIGHT = FONT_SIZE * 1.18;
  }

  let mouseInBox = false, mouseX = -9999, mouseY = -9999, letters = [];

  class Letter {
    constructor(char, homeX, homeY) {
      this.char = char;
      this.homeX = homeX; this.homeY = homeY;
      this.x = homeX; this.y = homeY;
      this.vx = 0; this.vy = 0;
      this.rotation = 0; this.rotVel = 0;
    }
    update() {
      let fx = (this.homeX - this.x) * SPRING_K;
      let fy = (this.homeY - this.y) * SPRING_K;
      if (mouseInBox) {
        const mx = this.x - mouseX, my = this.y - mouseY;
        const d = Math.hypot(mx, my);
        if (d < REPULSE_RADIUS && d > 1) {
          const force = REPULSE_STRENGTH / (d * d);
          fx += (mx / d) * force;
          fy += (my / d) * force;
          this.rotVel += (mx / d) * force * 0.0008;
        }
      }
      this.vx = (this.vx + fx) * DAMPING;
      this.vy = (this.vy + fy) * DAMPING;
      const speed = Math.hypot(this.vx, this.vy);
      if (speed > MAX_VEL) { this.vx = (this.vx / speed) * MAX_VEL; this.vy = (this.vy / speed) * MAX_VEL; }
      this.x += this.vx; this.y += this.vy;
      this.rotVel -= this.rotation * 0.06;
      this.rotVel *= 0.9;
      this.rotation += this.rotVel;
      const m = 10;
      if (this.x < m) { this.x = m; this.vx *= -0.4; }
      if (this.x > W - m) { this.x = W - m; this.vx *= -0.4; }
      if (this.y < m) { this.y = m; this.vy *= -0.4; }
      if (this.y > H - m) { this.y = H - m; this.vy *= -0.4; }
    }
    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.fillStyle = '#fff';
      ctx.font = `${FONT_SIZE}px 'Roobert', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.char, 0, 0);
      ctx.restore();
    }
  }

  function computeHomePositions() {
    ctx.font = `${FONT_SIZE}px 'Roobert', sans-serif`;
    const words = PHRASE.split(' ');
    const lines = [];
    let cur = '';
    const maxWidth = W - 60;
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && cur) { lines.push(cur); cur = w; }
      else cur = test;
    }
    if (cur) lines.push(cur);

    const totalHeight = lines.length * LINE_HEIGHT;
    const startY = (H - totalHeight) / 2 + LINE_HEIGHT / 2;
    letters = [];
    for (let l = 0; l < lines.length; l++) {
      const line = lines[l];
      const lineWidth = ctx.measureText(line).width;
      let x = (W - lineWidth) / 2;
      const y = startY + l * LINE_HEIGHT;
      for (const char of line) {
        const cw = ctx.measureText(char).width;
        if (char !== ' ') letters.push(new Letter(char, x + cw / 2, y));
        x += cw;
      }
    }
  }

  let raf = 0;
  function frame() {
    ctx.clearRect(0, 0, W, H);
    for (const l of letters) l.update();
    for (const l of letters) l.draw();
    raf = requestAnimationFrame(frame);
  }

  const onEnter = () => { mouseInBox = true; };
  const onLeave = () => { mouseInBox = false; mouseX = -9999; mouseY = -9999; };
  const onMove = (e) => { const r = canvas.getBoundingClientRect(); mouseX = e.clientX - r.left; mouseY = e.clientY - r.top; };
  canvas.addEventListener('mouseenter', onEnter);
  canvas.addEventListener('mouseleave', onLeave);
  canvas.addEventListener('mousemove', onMove);

  const ro = new ResizeObserver(() => { sizeCanvas(); computeHomePositions(); });
  ro.observe(container);

  // Wait for Roobert before measuring glyphs
  const ready = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  let started = false;
  ready.then(() => { sizeCanvas(); computeHomePositions(); started = true; frame(); });

  return {
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('mouseenter', onEnter);
      canvas.removeEventListener('mouseleave', onLeave);
      canvas.removeEventListener('mousemove', onMove);
      canvas.remove();
    }
  };
}
