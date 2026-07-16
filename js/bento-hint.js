/* ============================================================================
   bento-hint — a reusable cursor-following label for bento boxes.
   On a hover-capable device, hovering the box shows a small glass pill (styled
   like the peek button's glass button) that smoothly trails the pointer. On
   mobile there's no hover, so the same text renders as a persistent caption
   beneath the box instead — matching the peek pattern's static caption.

   The module owns only the shared chrome (pill, follow loop, static caption);
   each adopting box supplies its own `text`.

   Usage:
     import { attachHint } from '../bento-hint.js';
     const hint = attachHint(boxEl, { text: 'Some label' });
     // later, from the adopter's teardown:
     hint.destroy();

   The pill is appended to <body> so an adopting box's overflow:hidden can't clip
   it, and it's pointer-events:none so it never blocks interactions underneath
   (e.g. the flock canvas's own mousemove tracking). destroy() removes the pill,
   the static caption, the box listeners, and cancels the follow loop.
   ============================================================================ */

const OFFSET_X = 18; // pill sits down-right of the cursor, like a native tooltip
const OFFSET_Y = 18;
const EASE = 0.2;    // per-frame lerp toward the pointer (higher = snappier)

const hoverCapable = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export function attachHint(box, { text = '' } = {}) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease = reduceMotion ? 1 : EASE; // reduced motion → snap, no trailing

  // ---- floating pill (body-level, follows the cursor) ----
  const pill = document.createElement('div');
  pill.className = 'hint-follow';
  pill.textContent = text;
  pill.setAttribute('aria-hidden', 'true');
  document.body.appendChild(pill);

  // ---- persistent, in-flow caption shown beneath the box on mobile (CSS-gated) ----
  const capStatic = document.createElement('p');
  capStatic.className = 'hint-caption-static';
  capStatic.textContent = text;
  box.insertAdjacentElement('afterend', capStatic);

  let raf = 0;
  let px = 0, py = 0; // current (rendered) position
  let tx = 0, ty = 0; // target position

  const tick = () => {
    px += (tx - px) * ease;
    py += (ty - py) * ease;
    pill.style.transform = `translate(${px}px, ${py}px)`;
    raf = requestAnimationFrame(tick);
  };

  const onEnter = (e) => {
    if (!hoverCapable()) return;
    // seed at the cursor so the pill doesn't fly in from the top-left corner
    tx = px = e.clientX + OFFSET_X;
    ty = py = e.clientY + OFFSET_Y;
    pill.style.transform = `translate(${px}px, ${py}px)`;
    pill.classList.add('is-visible');
    if (!raf) raf = requestAnimationFrame(tick);
  };

  const onMove = (e) => {
    tx = e.clientX + OFFSET_X;
    ty = e.clientY + OFFSET_Y;
  };

  const onLeave = () => {
    pill.classList.remove('is-visible');
    cancelAnimationFrame(raf);
    raf = 0;
  };

  box.addEventListener('mouseenter', onEnter);
  box.addEventListener('mousemove', onMove);
  box.addEventListener('mouseleave', onLeave);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      box.removeEventListener('mouseenter', onEnter);
      box.removeEventListener('mousemove', onMove);
      box.removeEventListener('mouseleave', onLeave);
      pill.remove();
      capStatic.remove();
    },
  };
}
