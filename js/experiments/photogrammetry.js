/* ============================================================================
   Photogrammetry Self-Portrait — orbit-draggable vertex-colored 3D scan that
   floats and slowly drifts when idle. Core mechanism extracted; wrapped as a
   mount() module. Needs three.js (via importmap) + assets/photogrammetry/*.
   ============================================================================ */

import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function mount(container) {
  const ASSET_PATH = 'assets/photogrammetry/';
  const FLOAT_AMPLITUDE = 0.06;
  const FLOAT_SPEED = 0.0004;
  const DRIFT_SPEED = 0.00008;
  const RESUME_EASE = 0.03;

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

  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const dir = new THREE.DirectionalLight(0xffffff, 0.5);
  dir.position.set(2, 3, 4);
  scene.add(dir);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.5;

  let model = null, isInteracting = false, idleBlend = 1, baseRotationY = 0;
  const startTime = performance.now();

  controls.addEventListener('start', () => { isInteracting = true; renderer.domElement.style.cursor = 'grabbing'; });
  controls.addEventListener('end', () => { isInteracting = false; renderer.domElement.style.cursor = 'grab'; });

  const pivot = new THREE.Group();
  scene.add(pivot);

  const loader = new OBJLoader();
  loader.load(ASSET_PATH + 'selfportrait_01.obj', (obj) => {
    obj.traverse((child) => { if (child.isMesh) child.material = new THREE.MeshBasicMaterial({ vertexColors: true }); });
    const bbox = new THREE.Box3().setFromObject(obj);
    const center = bbox.getCenter(new THREE.Vector3());
    const size = bbox.getSize(new THREE.Vector3());
    const fitScale = 2.5 / Math.max(size.x, size.y, size.z);
    obj.position.set(-center.x, -center.y, -center.z);
    const orient = new THREE.Group();
    orient.rotation.x = -Math.PI / 2;
    orient.add(obj);
    const face = new THREE.Group();
    face.rotation.y = 0.25;
    face.add(orient);
    face.scale.setScalar(fitScale);
    pivot.add(face);
    model = pivot;
  }, undefined, (err) => console.error('Error loading OBJ:', err));

  let raf = 0;
  function animate() {
    raf = requestAnimationFrame(animate);
    const elapsed = performance.now() - startTime;
    idleBlend = isInteracting ? Math.max(0, idleBlend - RESUME_EASE) : Math.min(1, idleBlend + RESUME_EASE);
    if (model) {
      model.position.y = Math.sin(elapsed * FLOAT_SPEED) * FLOAT_AMPLITUDE * idleBlend;
      if (idleBlend > 0.01) baseRotationY += DRIFT_SPEED * idleBlend;
      model.rotation.y = baseRotationY * idleBlend;
    }
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
