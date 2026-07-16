/* ============================================================================
   Boarding Pass — a travel bento block.
   A city photo fills the block; an iPhone shows a Breeze "Boarding Pass" app.
   The card carousel auto-advances (PVU→SFO, CHS→LAS, CAK→MCO) and the photo
   crossfades to the matching city. Cards are draggable/swipeable inside the
   phone; the step dots below double as tap targets, and a one-time nudge on
   first view hints that the cards can be swiped.
   Geometry mirrors the Figma design: stage 872×587, phone UI in a 458-wide
   coordinate space scaled onto the phone screen.
   ============================================================================ */

import { attachPeek } from '../bento-peek.js';

const ASSETS = 'assets/boarding-pass';

// Stage design space. Landscape (desktop) mirrors the Figma "Scene" frame; the
// portrait variant (mobile) keeps the exact same phone + card internals but on a
// narrower, taller stage so the phone fills most of the width and the city photo
// sits behind it. The single scale transform maps whichever geometry to the
// container, so on-screen phone size = phoneWidth / stage.w × containerWidth.
const STAGE = {
  landscape: { w: 872, h: 532, phoneLeft: 466, phoneTop: 33 },
  portrait: { w: 500, h: 720, phoneLeft: 83.34, phoneTop: 190 },
};
const PORTRAIT_MAX = 560; // container px at/below which we switch to portrait

// Phone UI design space (Figma "APP" frame inside the 499×1024 phone)
const UI_W = 458;
const CARD_W = 381.06;
const CARD_STEP = 390.83; // card width + 9.77 gap
// Track snap offsets per index: first left-aligned, middle centered,
// last right-aligned (matches Figma scene 1/2/3 within a few px)
const OFFSETS = [19.54, (UI_W - CARD_W) / 2 - CARD_STEP, UI_W - CARD_W - 19.54 - 2 * CARD_STEP];

const SCENES = [
  { city: 'sfo', pass: 'pass-sfo.svg', photoAlt: 'Golden Gate Bridge, San Francisco' },
  { city: 'las', pass: 'pass-las.svg', photoAlt: 'Welcome to Las Vegas sign' },
  { city: 'mco', pass: 'pass-mco.svg', photoAlt: 'Palm trees and skyline at dusk' },
];

const AUTO_MS = 4000;
const SNAP_EASE = 'cubic-bezier(.3,.8,.3,1)';
const SNAP_MS = 550;

export function mount(container) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  container.innerHTML = `
    <div class="bp">
      <div class="bp-stage">
        <div class="bp-photos">
          ${SCENES.map((s, i) => `<img class="bp-photo bp-photo--${s.city}${i === 0 ? ' is-active' : ''}" src="${ASSETS}/${s.city}.webp" alt="${s.photoAlt}" ${i ? 'loading="lazy"' : ''} draggable="false" />`).join('')}
        </div>
        <div class="bp-phone">
          <div class="bp-screen">
            <div class="bp-ui">
              <img class="bp-screen-bg" src="${ASSETS}/screen-bg.webp" alt="" draggable="false" />
              <div class="bp-header">
                <img class="bp-statusbar" src="${ASSETS}/status-bar.svg" alt="" draggable="false" />
                <img class="bp-title" src="${ASSETS}/header-title.svg" alt="Boarding Pass" draggable="false" />
              </div>
              <div class="bp-track">
                ${SCENES.map((s) => `<div class="bp-card"><img src="${ASSETS}/${s.pass}" alt="Boarding pass" draggable="false" /></div>`).join('')}
              </div>
              <div class="bp-dots">
                ${SCENES.map((_, i) => `<button type="button" class="bp-dot${i === 0 ? ' is-active' : ''}" aria-label="Show boarding pass ${i + 1}"></button>`).join('')}
              </div>
              <img class="bp-tabbar" src="${ASSETS}/tab-bar.svg" alt="" draggable="false" />
            </div>
          </div>
          <img class="bp-frame" src="${ASSETS}/iphone.webp" alt="" draggable="false" />
        </div>
      </div>
    </div>`;

  const root = container.querySelector('.bp');
  const stage = root.querySelector('.bp-stage');
  const photos = [...root.querySelectorAll('.bp-photo')];
  const track = root.querySelector('.bp-track');
  const dots = [...root.querySelectorAll('.bp-dot')];
  const screen = root.querySelector('.bp-screen');
  const phone = root.querySelector('.bp-phone');

  // "Closer look" affordance — glass button + spotlight + modal/drawer (content TBD)
  const peek = attachPeek(container, { caption: 'Modernized a digital boarding pass for a startup airline' });

  let index = 0;
  let stageScale = 1;
  let autoTimer = null;
  let interacted = false; // any manual control → autoplay stops for good
  let visible = false;
  let hinted = false;     // one-time swipe nudge fires on first reveal
  let hintTimer = null;

  // ---- rendering ----
  const setTrack = (x, animate) => {
    track.style.transition = animate && !reduceMotion ? `transform ${SNAP_MS}ms ${SNAP_EASE}` : 'none';
    track.style.transform = `translateX(${x}px)`;
  };

  const setPhotos = (active, blend = null) => {
    // blend: { i, t } fades photo i in with opacity t on top of `active`
    photos.forEach((p, i) => {
      if (blend && i === blend.i) {
        p.style.transition = 'none';
        p.style.opacity = blend.t;
        p.classList.toggle('is-active', blend.t > 0.5);
      } else {
        p.style.transition = '';
        p.style.opacity = '';
        p.classList.toggle('is-active', i === active);
      }
    });
  };

  const goTo = (i, { animate = true } = {}) => {
    index = Math.max(0, Math.min(SCENES.length - 1, i));
    setTrack(OFFSETS[index], animate);
    setPhotos(index);
    dots.forEach((d, di) => d.classList.toggle('is-active', di === index));
  };

  // ---- autoplay ----
  const stopAuto = () => { clearInterval(autoTimer); autoTimer = null; };
  const startAuto = () => {
    if (reduceMotion || interacted || autoTimer || !visible) return;
    autoTimer = setInterval(() => goTo((index + 1) % SCENES.length), AUTO_MS);
  };
  const userTookOver = () => { interacted = true; stopAuto(); };

  // ---- step dots double as tap targets ----
  dots.forEach((dot, i) => {
    // keep taps on a dot from starting a drag on the screen underneath
    dot.addEventListener('pointerdown', (e) => e.stopPropagation());
    dot.addEventListener('click', () => { userTookOver(); goTo(i); });
  });

  // ---- one-time hint: nudge the track to reveal the next card, then settle.
  // Teaches the swipe gesture without any persistent chrome. Fires once. ----
  const hint = () => {
    if (reduceMotion || interacted) return;
    const peek = 34; // UI-space px of the neighbor to expose
    track.style.transition = `transform 420ms ${SNAP_EASE}`;
    track.style.transform = `translateX(${OFFSETS[index] - peek}px)`;
    const settle = () => {
      track.removeEventListener('transitionend', settle);
      if (interacted) return; // user grabbed mid-hint — leave their position
      track.style.transition = `transform 560ms ${SNAP_EASE}`;
      track.style.transform = `translateX(${OFFSETS[index]}px)`;
    };
    track.addEventListener('transitionend', settle);
  };

  // ---- drag / swipe (pointer events on the phone screen) ----
  const drag = { active: false, moved: false, startX: 0, dx: 0, lastX: 0, lastT: 0, vx: 0 };

  const uiScale = () => stageScale * 0.66797; // stage scale × phone-UI scale

  const onPointerDown = (e) => {
    if (!e.isPrimary) return;
    drag.active = true;
    drag.moved = false;
    drag.startX = e.clientX;
    drag.dx = 0;
    drag.lastX = e.clientX;
    drag.lastT = performance.now();
    drag.vx = 0;
    screen.setPointerCapture(e.pointerId);
    track.style.transition = 'none';
  };

  const onPointerMove = (e) => {
    if (!drag.active) return;
    const now = performance.now();
    const dt = now - drag.lastT;
    if (dt > 0) drag.vx = (e.clientX - drag.lastX) / dt;
    drag.lastX = e.clientX;
    drag.lastT = now;

    drag.dx = (e.clientX - drag.startX) / uiScale();
    if (Math.abs(drag.dx) > 4) drag.moved = true;
    if (!drag.moved) return;

    userTookOver();
    // rubber-band beyond the ends
    let dx = drag.dx;
    if ((index === 0 && dx > 0) || (index === SCENES.length - 1 && dx < 0)) dx *= 0.35;
    track.style.transform = `translateX(${OFFSETS[index] + dx}px)`;

    // reveal the neighboring city photo proportionally to the drag
    const t = Math.min(1, Math.abs(dx) / CARD_STEP);
    const ni = dx < 0 ? index + 1 : index - 1;
    if (ni >= 0 && ni < SCENES.length) setPhotos(index, { i: ni, t });
  };

  const endDrag = () => {
    if (!drag.active) return;
    drag.active = false;
    if (!drag.moved) return;

    const flick = Math.abs(drag.vx) > 0.4; // px/ms in viewport space
    const past = Math.abs(drag.dx) > CARD_W * 0.25;
    let target = index;
    if ((past || flick) && drag.dx < 0) target = index + 1;
    if ((past || flick) && drag.dx > 0) target = index - 1;
    goTo(target);
  };

  screen.addEventListener('pointerdown', onPointerDown);
  screen.addEventListener('pointermove', onPointerMove);
  screen.addEventListener('pointerup', endDrag);
  screen.addEventListener('pointercancel', endDrag);

  // ---- scale stage to container / pause offscreen ----
  const ro = new ResizeObserver(() => {
    const w = container.clientWidth;
    const g = w <= PORTRAIT_MAX ? STAGE.portrait : STAGE.landscape;
    stageScale = w / g.w;
    stage.style.width = `${g.w}px`;
    stage.style.height = `${g.h}px`;
    stage.style.transform = `scale(${stageScale})`;
    root.style.height = `${g.h * stageScale}px`;
    root.classList.toggle('bp--portrait', g === STAGE.portrait);
    phone.style.left = `${g.phoneLeft}px`;
    phone.style.top = `${g.phoneTop}px`;
  });
  ro.observe(container);

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) {
      startAuto();
      if (!hinted && !reduceMotion) { hinted = true; hintTimer = setTimeout(hint, 700); }
    } else stopAuto();
  }, { threshold: 0.3 });
  io.observe(container);

  goTo(0, { animate: false });

  return {
    destroy() {
      stopAuto();
      clearTimeout(hintTimer);
      ro.disconnect();
      io.disconnect();
      peek.destroy();
      container.innerHTML = '';
    },
  };
}
