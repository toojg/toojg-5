/* ============================================================================
   Experiments registry — the single list the preview page renders from.
   Each entry lazy-loads its module (code-split) and exposes mount(container).
   Add / remove / reorder experiments here.
   ============================================================================ */

export const EXPERIMENTS = [
  {
    id: 'flock-of-cursors',
    name: 'Flock of Cursors',
    tech: 'Canvas 2D · vanilla JS',
    note: 'A few dozen pointer cursors sit idle until your mouse enters the frame — then they flock toward it with boid behaviour and freeze when you leave.',
    aspect: '1 / 1',
    load: () => import('./experiments/flock-of-cursors.js'),
  },
  {
    id: 'magnetic-typography',
    name: 'Magnetic Typography',
    tech: 'Canvas 2D · spring physics',
    note: 'Each letter is a spring-mass tied to home. The cursor repels nearby letters with an inverse-square force and a little torque; they spring back.',
    aspect: '1 / 1',
    load: () => import('./experiments/magnetic-typography.js'),
  },
  {
    id: 'photogrammetry',
    name: 'Photogrammetry Self-Portrait',
    tech: 'three.js · WebGL',
    note: 'A vertex-colored 3D head scan (2021 Metashape capture). Drag to orbit; when idle it floats and slowly drifts, blending the idle motion out smoothly while you interact.',
    aspect: '1 / 1',
    load: () => import('./experiments/photogrammetry.js').then((m) => ({ mount: (c) => m.mount(c, { variant: 'vertex', zoom: 1.15, offsetY: -0.28 }) })),
  },
  {
    id: 'photogrammetry-textured',
    name: 'Photogrammetry — Textured',
    tech: 'three.js · WebGL',
    note: 'The same scan with its baked photo texture — recovered from a long-forgotten Vectary AR link. Same orbit / idle-drift behaviour for an A/B comparison.',
    aspect: '1 / 1',
    load: () => import('./experiments/photogrammetry.js').then((m) => ({ mount: (c) => m.mount(c, { variant: 'textured', zoom: 1.15, offsetY: -0.28 }) })),
  },
  {
    id: 'scratch',
    name: "Scratch My Back",
    tech: 'Canvas 2D · Web Audio',
    note: 'Click-drag to scratch the skin with five finger-lines while a gritty fingernail-on-skin sound is synthesized live from filtered noise.',
    aspect: '1 / 1',
    load: () => import('./experiments/scratch.js'),
  },
  {
    id: 'connect4',
    name: 'Connect 4',
    tech: 'three.js · WebGL',
    note: 'A 3D board with a bouncy chip-drop, hover preview, win/draw detection and score keeping. The shared engine behind both original prototypes.',
    aspect: '4 / 3',
    wide: true,
    load: () => import('./experiments/connect4.js'),
  },
  {
    id: 'now-playing',
    name: 'Now Playing',
    tech: 'DOM · polling (mock)',
    note: 'A "currently listening" card that polls for the current track and cross-fades changes. Runs in mock mode; a real version needs a Spotify proxy backend.',
    aspect: '1 / 1',
    load: () => import('./experiments/now-playing.js'),
  },
  {
    id: 'my-location',
    name: 'My Location',
    tech: 'Canvas 2D · map tiles',
    note: 'A dark, hand-framed map pinned to Salt Lake City with a softly pulsing glow — dark CARTO tiles composited on canvas via Web Mercator math, no map library.',
    aspect: '3 / 2',
    load: () => import('./experiments/my-location.js'),
  },
  {
    id: 'boarding-pass',
    name: 'Boarding Pass',
    tech: 'DOM · vanilla JS',
    note: 'A Breeze boarding-pass carousel inside an iPhone over a city photo. It auto-advances and the city crossfades with each pass — or grab the cards and swipe them yourself.',
    aspect: '872 / 587',
    wide: true,
    load: () => import('./experiments/boarding-pass.js'),
  },
  {
    id: 'my-location-interactive',
    name: 'My Location (Interactive)',
    tech: 'Leaflet · dark map tiles',
    note: 'The same dark map, now pan-and-zoomable — Leaflet loaded on demand from a CDN, with a glowing marker pinned to Salt Lake City. Drag to explore, scroll to zoom.',
    aspect: '3 / 2',
    load: () => import('./experiments/my-location-interactive.js'),
  },
];
