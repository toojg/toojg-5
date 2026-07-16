/* ============================================================================
   Photogrammetry Self-Portrait — orbit-draggable 3D head scan that floats and
   slowly drifts when idle. Two renders of the same 2021 Agisoft Metashape scan:
     'vertex'   — vertex-colors-only OBJ export (selfportrait-vc.glb)
     'textured' — photo-textured export, recovered from Vectary's CDN
                  (selfportrait-tex.glb)
   Both GLBs are meshopt-compressed and unlit. Needs three.js (via importmap).
   ============================================================================ */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { attachPeek } from '../bento-peek.js';

const VARIANTS = {
  // pitch/roll/yaw level out each export's arbitrary alignment
  vertex: { file: 'selfportrait-vc.glb', zUp: true, pitch: 0.22, roll: -0.12, yaw: 0 }, // built from the Z-up Metashape OBJ
  textured: { file: 'selfportrait-tex.glb', zUp: false, pitch: 0, roll: 0, yaw: 1.85 }, // Vectary exports Y-up glTF, facing -X
};

export function mount(container, { variant = 'vertex', zoom = 1, offsetY = 0 } = {}) {
  const ASSET_PATH = 'assets/photogrammetry/';
  const FLOAT_AMPLITUDE = 0.06;
  const FLOAT_SPEED = 0.0004;
  const DRIFT_SPEED = 0.00008;
  const RESUME_EASE = 0.03;
  const APPEAR_EASE = 0.04;

  const cfg = VARIANTS[variant] || VARIANTS.vertex;
  const w0 = container.clientWidth || 1, h0 = container.clientHeight || 1;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(40, w0 / h0, 0.1, 100);
  camera.position.set(0, 0.3, 4);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(w0, h0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;cursor:grab';

  const loadingEl = document.createElement('div');
  loadingEl.className = 'xp-stage__loading';
  loadingEl.textContent = 'Loading scan…';
  loadingEl.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none';
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  container.appendChild(loadingEl);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.5;

  let model = null, isInteracting = false, idleBlend = 1, baseRotationY = 0, appear = 0;
  let startTime = 0; // set when the stage first scrolls into view

  controls.addEventListener('start', () => { isInteracting = true; renderer.domElement.style.cursor = 'grabbing'; });
  controls.addEventListener('end', () => { isInteracting = false; renderer.domElement.style.cursor = 'grab'; });

  const pivot = new THREE.Group();
  scene.add(pivot);
  let fitScale = 1;

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(ASSET_PATH + cfg.file, (gltf) => {
    const obj = gltf.scene;
    // Photogrammetry lighting is baked in — force unlit materials.
    obj.traverse((child) => {
      if (!child.isMesh) return;
      if (!child.material.isMeshBasicMaterial) {
        const old = child.material;
        child.material = new THREE.MeshBasicMaterial({ map: old.map || null, vertexColors: old.vertexColors });
        old.dispose();
      }
    });
    const orient = new THREE.Group();
    if (cfg.zUp) orient.rotation.x = -Math.PI / 2;
    orient.rotation.x += cfg.pitch;
    orient.add(obj);
    const level = new THREE.Group();
    level.rotation.z = cfg.roll;
    level.add(orient);
    const bbox = new THREE.Box3().setFromObject(level);
    const center = bbox.getCenter(new THREE.Vector3());
    const size = bbox.getSize(new THREE.Vector3());
    fitScale = (2.5 / Math.max(size.x, size.y, size.z)) * zoom;
    level.position.sub(center);
    const face = new THREE.Group();
    face.rotation.y = 0.25 + cfg.yaw;
    face.add(level);
    face.position.y = offsetY; // nudge the framing up/down (world units, +up)
    face.scale.setScalar(0.0001);
    pivot.add(face);
    model = pivot;
    loadingEl.remove();
  }, undefined, (err) => {
    console.error('Error loading GLB:', err);
    loadingEl.textContent = 'Failed to load scan.';
  });

  let raf = 0;
  function animate() {
    raf = requestAnimationFrame(animate);
    const elapsed = performance.now() - startTime;
    idleBlend = isInteracting ? Math.max(0, idleBlend - RESUME_EASE) : Math.min(1, idleBlend + RESUME_EASE);
    if (model) {
      if (appear < 1) {
        appear = Math.min(1, appear + APPEAR_EASE);
        const ease = 1 - Math.pow(1 - appear, 3);
        model.children[0].scale.setScalar(fitScale * ease);
      }
      model.position.y = Math.sin(elapsed * FLOAT_SPEED) * FLOAT_AMPLITUDE * idleBlend;
      baseRotationY += DRIFT_SPEED * idleBlend;
      model.rotation.y = baseRotationY;
    }
    controls.update();
    renderer.render(scene, camera);
  }
  // Hold the animation (clock, float, drift, appear-scale) until the stage
  // enters the viewport, so the motion begins when it's actually seen.
  let started = false;
  const io = new IntersectionObserver((entries) => {
    if (started || !entries.some((e) => e.isIntersecting)) return;
    started = true;
    startTime = performance.now();
    io.disconnect();
    animate();
  }, { threshold: 0.2 });
  io.observe(container);

  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  // "Closer look" affordance — glass button + spotlight + modal/drawer (content TBD)
  const peek = attachPeek(container, { caption: 'Photogrammetry self portrait' });

  return {
    destroy() {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      peek.destroy();
      controls.dispose();
      loadingEl.remove();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      });
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
