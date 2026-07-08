/* ============================================================================
   Logo cycler — Clerk-style vertical logo slots. Each .logos__slot's imgs get
   wrapped into a reel of fixed-height cells (plus a clone of the first for a
   seamless wrap); every beat all reels slide up one cell with a small stagger
   between slots. Pauses off-screen; stays static under reduced motion.
   ============================================================================ */

const INTERVAL = 2800;   // ms between beats
const STAGGER = 140;     // ms between slots within a beat
const SLIDE = 'transform .75s cubic-bezier(.3,.8,.3,1)';

export function mount(container) {
  if (!container) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const reels = [...container.querySelectorAll('.logos__slot')].map((slot) => {
    const reel = document.createElement('div');
    reel.className = 'logos__reel';
    const imgs = [...slot.children];
    for (const img of imgs.concat(imgs[0].cloneNode(true))) {
      const cell = document.createElement('div');
      cell.className = 'logos__cell';
      cell.appendChild(img);
      reel.appendChild(cell);
    }
    slot.replaceChildren(reel);
    return { slot, reel, step: 0, count: imgs.length };
  });

  function advance(r) {
    if (r.step >= r.count) {
      // Safety net: transitionend never fired (e.g. tab hidden mid-slide)
      r.reel.style.transition = 'none';
      r.reel.style.transform = 'translateY(0)';
      r.reel.getBoundingClientRect();
      r.step = 0;
    }
    r.step++;
    r.reel.style.transition = SLIDE;
    r.reel.style.transform = `translateY(${-r.step * r.slot.offsetHeight}px)`;
    if (r.step === r.count) {
      // Landed on the clone of the first logo — snap back invisibly
      r.reel.addEventListener('transitionend', () => {
        r.reel.style.transition = 'none';
        r.reel.style.transform = 'translateY(0)';
        r.reel.getBoundingClientRect(); // flush so the next slide transitions
        r.step = 0;
      }, { once: true });
    }
  }

  let timer = null;
  const timeouts = [];
  function start() {
    if (timer !== null) return;
    timer = setInterval(() => {
      reels.forEach((r, i) => timeouts.push(setTimeout(() => advance(r), i * STAGGER)));
    }, INTERVAL);
  }
  function stop() {
    clearInterval(timer);
    timer = null;
    timeouts.forEach(clearTimeout);
    timeouts.length = 0;
  }

  const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()));
  io.observe(container);
}
