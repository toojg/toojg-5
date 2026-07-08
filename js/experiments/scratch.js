/* ============================================================================
   Scratch My Back — drag to "scratch" the image with five finger-lines while a
   procedural Web-Audio scratch sound plays. Core mechanism extracted; wrapped
   as a mount() module. Needs assets/scratch/back-jon.jpg.
   ============================================================================ */

export function mount(container) {
  const FINGER_COUNT = 5;
  const FINGER_SPACING = 4;
  const MIN_SEGMENT_LENGTH = 2;
  const WOBBLE_AMOUNT = 0.5;
  const PERP_SMOOTHING = 0.7;
  const FINGERS = [
    { width: 0.8, opacity: 0.45, wobble: 0.8 },
    { width: 1.1, opacity: 0.55, wobble: 0.5 },
    { width: 1.4, opacity: 0.65, wobble: 0.3 },
    { width: 1.1, opacity: 0.55, wobble: 0.5 },
    { width: 0.8, opacity: 0.45, wobble: 0.8 },
  ];

  // ─── DOM: image under a transparent scratch canvas ──────────────────────
  container.style.position = container.style.position || 'relative';
  const img = document.createElement('img');
  img.src = 'assets/scratch/back-jon.jpg';
  img.alt = '';
  img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;cursor:grab';
  container.appendChild(img);
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = (container.clientWidth || 1) * dpr;
    canvas.height = (container.clientHeight || 1) * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();

  // ─── State ──────────────────────────────────────────────────────────────
  let isScratching = false, lastPoint = null, lastPerp = null, lastFingers = null;

  // ─── Audio (synthesized fingernail-on-skin) ─────────────────────────────
  let audioCtx = null, gainNode = null, crackle = null;
  function initAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const sr = audioCtx.sampleRate, len = sr * 2;
    const buf = audioCtx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const spike = Math.random() < 0.12 ? (Math.random() * 2 - 1) * 1.5 : 0;
      data[i] = (Math.random() * 2 - 1) * 0.3 + spike;
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const hipass = audioCtx.createBiquadFilter();
    hipass.type = 'highpass'; hipass.frequency.value = 2500; hipass.Q.value = 0.5;
    const peak = audioCtx.createBiquadFilter();
    peak.type = 'peaking'; peak.frequency.value = 4500; peak.Q.value = 2.0; peak.gain.value = 6;
    const shelf = audioCtx.createBiquadFilter();
    shelf.type = 'highshelf'; shelf.frequency.value = 6000; shelf.gain.value = 3;
    gainNode = audioCtx.createGain(); gainNode.gain.value = 0;
    src.connect(hipass); hipass.connect(peak); peak.connect(shelf); shelf.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    src.start();
  }
  function startSound() {
    if (!audioCtx) initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
    gainNode.gain.setTargetAtTime(0.09, audioCtx.currentTime, 0.02);
    crackle = setInterval(() => {
      if (!gainNode) return;
      gainNode.gain.setTargetAtTime(0.06 + Math.random() * 0.06, audioCtx.currentTime, 0.015);
    }, 60);
  }
  function stopSound() {
    if (crackle) { clearInterval(crackle); crackle = null; }
    if (!gainNode) return;
    gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
    gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.06);
  }

  // ─── Drawing ────────────────────────────────────────────────────────────
  const getPos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  function drawSegment(point, perp) {
    const half = (FINGER_COUNT - 1) / 2;
    const next = [];
    for (let i = 0; i < FINGER_COUNT; i++) {
      const f = FINGERS[i];
      const offset = (i - half) * FINGER_SPACING;
      const wx = (Math.random() - 0.5) * WOBBLE_AMOUNT * 2 * f.wobble;
      const wy = (Math.random() - 0.5) * WOBBLE_AMOUNT * 2 * f.wobble;
      const x = point.x + perp.x * offset + wx;
      const y = point.y + perp.y * offset + wy;
      next.push({ x, y });
      if (lastFingers) {
        ctx.beginPath();
        ctx.moveTo(lastFingers[i].x, lastFingers[i].y);
        ctx.lineTo(x, y);
        ctx.strokeStyle = `rgba(0,0,0,${f.opacity})`;
        ctx.lineWidth = f.width;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.stroke();
      }
    }
    lastFingers = next;
  }

  // ─── Events ─────────────────────────────────────────────────────────────
  const onDown = (e) => {
    isScratching = true; lastPoint = getPos(e); lastPerp = null; lastFingers = null;
    canvas.style.cursor = 'grabbing'; startSound();
  };
  const onMove = (e) => {
    if (!isScratching) return;
    const p = getPos(e);
    const dx = p.x - lastPoint.x, dy = p.y - lastPoint.y, d = Math.hypot(dx, dy);
    if (d < MIN_SEGMENT_LENGTH) return;
    let px = -dy / d, py = dx / d;
    if (lastPerp) {
      px = lastPerp.x * PERP_SMOOTHING + px * (1 - PERP_SMOOTHING);
      py = lastPerp.y * PERP_SMOOTHING + py * (1 - PERP_SMOOTHING);
      const len = Math.hypot(px, py); px /= len; py /= len;
    }
    const perp = { x: px, y: py };
    drawSegment(p, perp);
    lastPoint = p; lastPerp = perp;
  };
  const stop = () => {
    if (!isScratching) return;
    isScratching = false; lastFingers = null; canvas.style.cursor = 'grab'; stopSound();
  };

  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseup', stop);
  canvas.addEventListener('mouseleave', stop);
  window.addEventListener('mouseup', stop);
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  return {
    destroy() {
      stop();
      if (crackle) clearInterval(crackle);
      if (audioCtx) audioCtx.close();
      ro.disconnect();
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseup', stop);
      canvas.removeEventListener('mouseleave', stop);
      window.removeEventListener('mouseup', stop);
      canvas.remove(); img.remove();
    }
  };
}
