/* ============================================================================
   Now Playing — a "currently listening" card that polls a backend and
   cross-fades track changes. Ships in MOCK mode (cycles example tracks).

   To go live: set USE_MOCK = false and point API_ENDPOINT at a Spotify proxy
   backend that returns { is_playing, track:{ name, artist, album_art, type } }.
   ============================================================================ */

export function mount(container) {
  const USE_MOCK = true;
  const API_ENDPOINT = '/api/now-playing';
  const POLL_INTERVAL = 30000;

  const MOCK_TRACKS = [
    { is_playing: true,  track: { name: 'Skinny Love', artist: 'Bon Iver', album_art: 'https://i.scdn.co/image/ab67616d0000b273bf7c317a63c4f128b8823406', type: 'track' } },
    { is_playing: false, track: { name: 'Holocene',    artist: 'Bon Iver', album_art: 'https://i.scdn.co/image/ab67616d0000b2734b6b1547455bbecb9f6bba64', type: 'track' } },
    { is_playing: true,  track: { name: 'Hey, Ma',     artist: 'Bon Iver', album_art: 'https://i.scdn.co/image/ab67616d0000b2735cc90d375ab1e4423615654c', type: 'track' } },
  ];
  let mockIndex = 0;

  // ─── Markup ─────────────────────────────────────────────────────────────
  const root = document.createElement('div');
  root.className = 'np';
  root.innerHTML = `
    <span class="np-empty">Loading…</span>
    <div class="np-card">
      <div class="np-art"><img class="np-img" alt="Album art"></div>
      <div class="np-info">
        <div class="np-track"></div>
        <div class="np-artist"></div>
        <div class="np-listening"><span class="np-dot"></span><span class="np-label">Now listening</span></div>
      </div>
    </div>`;
  container.appendChild(root);

  const cardEl = root.querySelector('.np-card');
  const img = root.querySelector('.np-img');
  const trackEl = root.querySelector('.np-track');
  const artistEl = root.querySelector('.np-artist');
  const listeningEl = root.querySelector('.np-listening');
  const emptyEl = root.querySelector('.np-empty');

  // ─── Fetch + render ─────────────────────────────────────────────────────
  async function fetchNowPlaying() {
    if (USE_MOCK) {
      const data = MOCK_TRACKS[mockIndex];
      mockIndex = (mockIndex + 1) % MOCK_TRACKS.length;
      renderTrack(data);
      return;
    }
    try {
      const res = await fetch(API_ENDPOINT);
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      renderTrack(await res.json());
    } catch (err) { console.warn('Failed to fetch now playing:', err); }
  }

  function renderTrack(data) {
    const track = data && data.track;
    if (!track || (track.type && track.type !== 'track')) {
      emptyEl.textContent = 'Nothing played recently';
      emptyEl.classList.remove('is-hidden');
      cardEl.classList.remove('is-visible');
      return;
    }
    emptyEl.classList.add('is-hidden');
    trackEl.textContent = track.name;
    artistEl.textContent = track.artist;
    if (track.album_art && track.album_art !== img.src) {
      img.classList.remove('is-loaded');
      img.onload = () => img.classList.add('is-loaded');
      img.onerror = () => img.classList.remove('is-loaded');
      img.src = track.album_art;
    }
    listeningEl.classList.toggle('is-active', !!data.is_playing);
    cardEl.classList.add('is-visible');
  }

  // ─── Polling ────────────────────────────────────────────────────────────
  let pollTimer = null;
  const interval = () => (USE_MOCK ? 5000 : POLL_INTERVAL);
  function startPolling() {
    fetchNowPlaying();
    pollTimer = setInterval(fetchNowPlaying, interval());
  }
  const onVisibility = () => {
    if (document.hidden) { clearInterval(pollTimer); pollTimer = null; }
    else { fetchNowPlaying(); pollTimer = setInterval(fetchNowPlaying, interval()); }
  };
  document.addEventListener('visibilitychange', onVisibility);
  startPolling();

  return {
    destroy() {
      if (pollTimer) clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      root.remove();
    }
  };
}
