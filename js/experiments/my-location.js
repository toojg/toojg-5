/* ============================================================================
   My Location — a dark, framed map pinned to Salt Lake City with a softly
   pulsing glow. Dark CARTO raster tiles (free, no API key) are composited on a
   2D canvas via hand-rolled Web Mercator math — no map library. A second canvas
   draws crisp US state outlines from a public-domain GeoJSON on top, so the
   borders read clearly against the dark land without a CSS filter fighting them.
   The map is display-only (never read back), so cross-origin tiles are fine.
   Wrapped as a mount(container) module that fills its container and cleans up
   on destroy().
   ============================================================================ */

// Generalised US state polygons (public-domain, from the Leaflet choropleth
// example). Fetched once and drawn as outlines; no labels, so nothing clashes
// with the base map's own text.
const STATES_URL = 'https://cdn.jsdelivr.net/gh/PublicaMundi/MappingAPI@master/data/geojson/us-states.json';

export function mount(container) {
  // ─── Fixed framing (owner's location) ───────────────────────────────────
  const CENTER = [40.7608, -111.8910]; // Salt Lake City, UT
  const ZOOM = 6;                      // regional view — neighbouring states visible
  const SCALE = 0.82;                  // fractional zoom-out from the tile zoom (1 = native)
  const TILE = 256;
  const RETINA = (window.devicePixelRatio || 1) > 1 ? '@2x' : '';
  const SUBDOMAINS = ['a', 'b', 'c', 'd'];

  // ─── Root + overlay ─────────────────────────────────────────────────────
  const root = document.createElement('div');
  root.className = 'loc';
  const canvas = document.createElement('canvas');
  canvas.className = 'loc__map';
  root.appendChild(canvas);
  const linesCanvas = document.createElement('canvas'); // state outlines, above the base
  linesCanvas.className = 'loc__lines';
  root.appendChild(linesCanvas);
  root.insertAdjacentHTML('beforeend', `
    <div class="loc__pin"></div>
    <div class="loc__attrib">© OpenStreetMap · CARTO</div>`);
  container.appendChild(root);
  const ctx = canvas.getContext('2d');
  const lctx = linesCanvas.getContext('2d');

  // ─── Web Mercator: lat/lon → global pixel at ZOOM ───────────────────────
  function project([lat, lon]) {
    const scale = TILE * 2 ** ZOOM;
    const x = ((lon + 180) / 360) * scale;
    const s = Math.sin((lat * Math.PI) / 180);
    const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
    return { x, y };
  }
  const centerPx = project(CENTER); // SLC lands dead-centre, so it never moves

  function tileUrl(x, y) {
    const s = SUBDOMAINS[((x % 4) + 4 + y) % 4];
    return `https://${s}.basemaps.cartocdn.com/dark_all/${ZOOM}/${x}/${y}${RETINA}.png`;
  }

  // ─── Tile cache + render ────────────────────────────────────────────────
  const tiles = new Map(); // url -> HTMLImageElement
  let states = null;       // parsed boundary GeoJSON, once fetched
  let W = 1, H = 1, faded = false, destroyed = false;

  // Top-left of the visible area in global px. The viewport spans W/SCALE ×
  // H/SCALE global px (smaller SCALE shows more), and a global pixel gx lands on
  // screen at (gx - tlx) * SCALE. Shared so base tiles and outlines stay aligned.
  function viewport() {
    const vw = W / SCALE, vh = H / SCALE;
    return { tlx: centerPx.x - vw / 2, tly: centerPx.y - vh / 2, vw, vh };
  }

  function render() {
    if (destroyed || !W || !H) return;
    ctx.clearRect(0, 0, W, H);
    const n = 2 ** ZOOM;
    const { tlx, tly, vw, vh } = viewport();
    // +1px on the drawn size closes the sub-pixel seams fractional scaling leaves
    const size = TILE * SCALE + 1;
    let painted = false;

    for (let ty = Math.floor(tly / TILE); ty <= Math.floor((tly + vh) / TILE); ty++) {
      if (ty < 0 || ty >= n) continue; // no tiles above/below the world
      for (let tx = Math.floor(tlx / TILE); tx <= Math.floor((tlx + vw) / TILE); tx++) {
        const wx = ((tx % n) + n) % n; // wrap horizontally
        const url = tileUrl(wx, ty);
        let img = tiles.get(url);
        if (!img) {
          img = new Image();
          img.onload = () => { if (!destroyed) render(); };
          img.src = url;
          tiles.set(url, img);
        }
        if (img.complete && img.naturalWidth) {
          ctx.drawImage(img, (tx * TILE - tlx) * SCALE, (ty * TILE - tly) * SCALE, size, size);
          painted = true;
        }
      }
    }
    if (painted && !faded) { faded = true; canvas.style.opacity = '1'; }
  }

  // ─── Boundary outlines (crisp light lines over the dark land) ───────────
  function renderLines() {
    if (destroyed || !W || !H) return;
    lctx.clearRect(0, 0, W, H);
    if (!states) return;
    const { tlx, tly } = viewport();
    lctx.beginPath();
    for (const feat of states.features) {
      const g = feat.geometry;
      if (!g) continue;
      // Polygon → [ring...]; MultiPolygon → [polygon...][ring...]
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      for (const poly of polys) {
        for (const ring of poly) {
          for (let i = 0; i < ring.length; i++) {
            const p = project([ring[i][1], ring[i][0]]); // GeoJSON is [lon, lat]
            const x = (p.x - tlx) * SCALE;
            const y = (p.y - tly) * SCALE;
            i === 0 ? lctx.moveTo(x, y) : lctx.lineTo(x, y);
          }
        }
      }
    }
    lctx.lineWidth = 1;
    lctx.lineJoin = 'round';
    lctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    lctx.stroke();
  }

  fetch(STATES_URL)
    .then((r) => r.json())
    .then((data) => { if (destroyed) return; states = data; renderLines(); })
    .catch(() => {}); // no outlines if the fetch fails — the base map still shows

  // ─── Sizing (DPR-aware, fills container) ────────────────────────────────
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = container.clientWidth || 1;
    H = container.clientHeight || 1;
    for (const c of [canvas, linesCanvas]) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    render();
    renderLines();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  // ─── Cleanup ────────────────────────────────────────────────────────────
  return {
    destroy() {
      destroyed = true;
      ro.disconnect();
      for (const img of tiles.values()) { img.onload = null; img.src = ''; }
      tiles.clear();
      root.remove();
    },
  };
}
