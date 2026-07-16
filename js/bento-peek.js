/* ============================================================================
   bento-peek — a reusable "closer look" affordance for bento boxes.
   Adds a small glass binoculars button to a box's bottom-left corner. On a
   hover-capable device, hovering the button dims the rest of the page and
   spotlights the whole box with a descriptive caption beneath it; a click opens
   a centered modal. On mobile it opens a bottom drawer instead.

   The module owns only the shared chrome (button, scrim, dialog frame, focus /
   scroll / a11y plumbing). Each adopting box supplies its own dialog content via
   the `content` option, so no two boxes share content.

   Usage:
     import { attachPeek } from '../bento-peek.js';
     const peek = attachPeek(boxEl, { caption, content });
     // later, from the adopter's teardown:
     peek.destroy();

   Because adopting boxes clip their contents (overflow:hidden) and may scale
   their inner stage, every overlay node is appended to <body>, and destroy()
   removes them all plus any window/document listeners.
   ============================================================================ */

const BINOCULARS = `<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false"><path d="M237.2,151.87v0a47.1,47.1,0,0,0-2.35-5.45L193.26,51.8a7.82,7.82,0,0,0-1.66-2.44,32,32,0,0,0-45.26,0A8,8,0,0,0,144,55V80H112V55a8,8,0,0,0-2.34-5.66,32,32,0,0,0-45.26,0,7.82,7.82,0,0,0-1.66,2.44L21.15,146.4a47.1,47.1,0,0,0-2.35,5.45v0A48,48,0,1,0,112,168V96h32v72a48,48,0,1,0,93.2-16.13ZM76.71,59.75a16,16,0,0,1,19.29-1v73.51a47.9,47.9,0,0,0-46.79-9.92ZM64,200a32,32,0,1,1,32-32A32,32,0,0,1,64,200ZM160,58.74a16,16,0,0,1,19.29,1l27.5,62.58A47.9,47.9,0,0,0,160,132.25ZM192,200a32,32,0,1,1,32-32A32,32,0,0,1,192,200Z"></path></svg>`;

const CLOSE_ICON = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const hoverCapable = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const isMobile = () => window.matchMedia('(max-width: 900px)').matches;

export function attachPeek(box, { caption = '', label, content, icon = BINOCULARS } = {}) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- glass button (lives inside the box, bottom-left) ----
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'peek-btn';
  btn.setAttribute('aria-label', label || caption || 'Take a closer look');
  btn.innerHTML = icon;
  // keep a press from starting a drag/swipe in an interactive box underneath
  btn.addEventListener('pointerdown', (e) => e.stopPropagation());
  box.appendChild(btn);

  // ---- body-level chrome (hidden until used) ----
  const scrim = document.createElement('div');
  scrim.className = 'peek-scrim';
  document.body.appendChild(scrim);

  const cap = document.createElement('div');
  cap.className = 'peek-caption';
  cap.textContent = caption;
  document.body.appendChild(cap);

  // Persistent, in-flow caption shown beneath the box on mobile (CSS-gated).
  // The fixed hover caption above is desktop-only; this one always shows.
  const capStatic = document.createElement('p');
  capStatic.className = 'peek-caption-static';
  capStatic.textContent = caption;
  box.insertAdjacentElement('afterend', capStatic);

  let panel = null;     // the open modal/drawer element
  let lastFocus = null; // focus to restore on close
  let isOpen = false;

  // ---- desktop hover spotlight ----
  const showSpotlight = () => {
    if (isOpen || !hoverCapable()) return;
    scrim.classList.add('is-dim');
    box.classList.add('peek-lifted');
    const r = box.getBoundingClientRect();
    cap.style.left = `${r.left}px`;      // left-aligned to the component
    cap.style.top = `${r.bottom + 12}px`;
    cap.classList.add('is-visible');
  };
  const hideSpotlight = () => {
    if (isOpen) return;
    scrim.classList.remove('is-dim');
    box.classList.remove('peek-lifted');
    cap.classList.remove('is-visible');
  };
  btn.addEventListener('mouseenter', showSpotlight);
  btn.addEventListener('mouseleave', hideSpotlight);
  btn.addEventListener('blur', hideSpotlight);

  // ---- modal / drawer ----
  const onKeydown = (e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') trapTab(e);
  };

  const trapTab = (e) => {
    const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => !el.disabled);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const buildPanel = (mobile) => {
    const p = document.createElement('div');
    p.className = mobile ? 'peek-drawer' : 'peek-modal';
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-modal', 'true');
    p.setAttribute('aria-label', caption || label || 'Details');
    p.innerHTML =
      `${mobile ? '<span class="peek-drawer__handle" aria-hidden="true"></span>' : ''}
       <button type="button" class="peek-dialog__close" aria-label="Close">${CLOSE_ICON}</button>
       <div class="peek-dialog__body"></div>`;
    const body = p.querySelector('.peek-dialog__body');
    if (typeof content === 'function') content(body);
    else if (typeof content === 'string') body.innerHTML = content;
    else body.innerHTML = '<p class="peek-placeholder">Coming soon.</p>';
    p.querySelector('.peek-dialog__close').addEventListener('click', close);
    return p;
  };

  const open = () => {
    if (isOpen) return;
    isOpen = true;
    lastFocus = document.activeElement;

    // drop any hover spotlight state, keep the scrim as the backdrop
    box.classList.remove('peek-lifted');
    cap.classList.remove('is-visible');

    panel = buildPanel(isMobile());
    document.body.appendChild(panel);
    document.body.style.overflow = 'hidden'; // lock scroll

    scrim.classList.remove('is-dim');
    scrim.classList.add('is-open');
    // next frame so the entry transition runs from the hidden state
    requestAnimationFrame(() => panel && panel.classList.add('is-shown'));

    panel.querySelector('.peek-dialog__close').focus();
    document.addEventListener('keydown', onKeydown);
    scrim.addEventListener('click', close);
  };

  // `immediate` skips the exit animation (teardown only); event handlers pass an
  // event object, so require an explicit `true` rather than any truthy value
  const close = (immediate) => {
    if (!isOpen) return;
    isOpen = false;
    document.removeEventListener('keydown', onKeydown);
    scrim.removeEventListener('click', close);
    document.body.style.overflow = '';

    scrim.classList.remove('is-open');
    const p = panel;
    panel = null;
    if (p) {
      p.classList.remove('is-shown');
      if (immediate === true || reduceMotion) {
        p.remove();
      } else {
        let done = false;
        const finish = () => { if (done) return; done = true; p.remove(); };
        p.addEventListener('transitionend', finish, { once: true });
        setTimeout(finish, 400);
      }
    }
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  };

  btn.addEventListener('click', open);

  // ---- teardown ----
  const destroy = () => {
    close(true);
    btn.remove();
    scrim.remove();
    cap.remove();
    capStatic.remove();
    if (panel) panel.remove();
    document.removeEventListener('keydown', onKeydown);
    document.body.style.overflow = '';
  };

  return { destroy, open, close };
}
