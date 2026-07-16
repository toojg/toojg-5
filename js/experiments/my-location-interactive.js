/* ============================================================================
   My Location (Interactive) — the same dark map, now pan-and-zoomable.
   Leaflet is loaded on demand from a CDN (ESM build, like the page's three.js)
   and rendered with dark CARTO tiles + a glowing marker pinned to Salt Lake
   City. Wrapped as a mount(container) module that fills its container and
   cleans up on destroy().
   ============================================================================ */

const LEAFLET_JS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet-src.esm.js';
const LEAFLET_CSS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';

export function mount(container) {
  const CENTER = [40.7608, -111.8910]; // Salt Lake City, UT
  const ZOOM = 8;                      // closer than the static card — invites exploring

  // Leaflet's stylesheet, injected once and shared across mounts.
  if (!document.getElementById('leaflet-css')) {
    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = LEAFLET_CSS;
    document.head.appendChild(link);
  }

  // ─── Root + overlay ─────────────────────────────────────────────────────
  const root = document.createElement('div');
  root.className = 'loc-i';
  const mapEl = document.createElement('div');
  mapEl.className = 'loc-i__map';
  root.appendChild(mapEl);
  container.appendChild(root);

  let map = null;
  let destroyed = false;

  import(LEAFLET_JS)
    .then((L) => {
      if (destroyed) return;
      map = L.map(mapEl, { zoomControl: false, attributionControl: true }).setView(CENTER, ZOOM);
      L.control.zoom({ position: 'topright' }).addTo(map);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19,
        attribution: '© OpenStreetMap · CARTO',
      }).addTo(map);

      // Reuse the glowing pulse from the canvas card (.loc__pin).
      const icon = L.divIcon({
        className: 'loc-i__marker',
        html: '<div class="loc__pin"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker(CENTER, { icon, keyboard: false }).addTo(map);

      map.invalidateSize(); // container may have resized during the async load
    })
    .catch((err) => { if (!destroyed) console.error('Leaflet failed to load', err); });

  // ─── Cleanup ────────────────────────────────────────────────────────────
  return {
    destroy() {
      destroyed = true;
      if (map) { map.remove(); map = null; }
      root.remove();
    },
  };
}
