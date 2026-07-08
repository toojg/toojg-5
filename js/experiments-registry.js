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
    note: 'A vertex-colored 3D head scan. Drag to orbit; when idle it floats and slowly drifts, blending the idle motion out smoothly while you interact.',
    aspect: '1 / 1',
    load: () => import('./experiments/photogrammetry.js'),
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
];
