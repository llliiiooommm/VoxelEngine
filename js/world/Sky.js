import * as THREE from 'https://esm.sh/three@0.170.0';
import { DAY_LEN, DAY, NIGHT, DUSK, $ } from '../utils/Constants.js';
import { getBlock, renderDist } from './World.js';
export let dayTime = 0.06, daylight = 1;
export let cloudDrift = 0;
export let underwater = false;
export function setDayTime(value) { dayTime = value; }
export function setCloudDrift(value) { cloudDrift = value; }
export function getCloudDrift() { return cloudDrift; }
export function initSky(scene, camera) {
  const skyGroup = new THREE.Group(); scene.add(skyGroup);
  function squareTex(draw) { const c = document.createElement('canvas'); c.width = c.height = 32; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t; }
  const sunTex = squareTex(g => { g.fillStyle = 'rgba(255,250,200,.25)'; g.fillRect(2,2,28,28); g.fillStyle = 'rgba(255,250,200,.5)'; g.fillRect(6,6,20,20); g.fillStyle = '#fffbe0'; g.fillRect(9,9,14,14); });
  const moonTex = squareTex(g => { g.fillStyle = '#c8ccd8'; g.fillRect(9,9,14,14); g.fillStyle = '#9ea4b4'; [[11,12],[17,10],[15,17],[19,19],[12,19]].forEach(([x,y]) => g.fillRect(x,y,2,2)); });
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, fog: false, depthWrite: false }));
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(55, 55), new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, fog: false, depthWrite: false }));
  skyGroup.add(sun, moon);
  const starGroup = new THREE.Group(); skyGroup.add(starGroup);
  { const pos = []; for (let i = 0; i < 700; i++) { const u = Math.random()*2 - 1, a = Math.random()*Math.PI*2, r = Math.sqrt(1 - u*u); pos.push(Math.cos(a)*r*450, u*450, Math.sin(a)*r*450); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); starGroup.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }))); }
  const cloudTex = (() => { const N = 64; let g = new Uint8Array(N*N).map(() => Math.random() < 0.42 ? 1 : 0); for (let it = 0; it < 4; it++) { const n = new Uint8Array(N*N); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += g[((y+dy+N)%N)*N + (x+dx+N)%N]; n[y*N + x] = s >= 5 ? 1 : 0; } g = n; } const c = document.createElement('canvas'); c.width = c.height = N; const ctx = c.getContext('2d'); const d = ctx.createImageData(N, N); for (let i = 0; i < N*N; i++) { d.data[i*4] = d.data[i*4+1] = d.data[i*4+2] = 255; d.data[i*4+3] = g[i] ? 255 : 0; } ctx.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1600/768, 1600/768); return t; })();
  const cloudMat = new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, opacity: 0.82, fog: false, depthWrite: false, side: THREE.DoubleSide });
  const clouds = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), cloudMat);
  clouds.rotation.x = -Math.PI/2; scene.add(clouds);
  return { skyGroup, sun, moon, starGroup, starMat: starGroup.children[0].material, clouds, cloudMat, cloudTex };
}
export function updateSky(skyObjs, scene, camera, renderer, worldMat, waterMat, handMat) {
  const a = dayTime * Math.PI * 2, sh = Math.sin(a);
  daylight = THREE.MathUtils.clamp(sh * 1.8 + 0.35, 0.16, 1);
  const t = (daylight - 0.16) / 0.84;
  const dusk = Math.max(0, 1 - Math.abs(sh) / 0.28) * 0.6;
  const col = [0,1,2].map(k => { const c = NIGHT[k] + (DAY[k] - NIGHT[k]) * t; return c + (DUSK[k] - c) * dusk; });
  underwater = getBlock(Math.floor(camera.position.x), Math.floor(camera.position.y), Math.floor(camera.position.z)) === 9;
  const skyCol = new THREE.Color();
  if (underwater) { skyCol.setRGB(0.06 * daylight + 0.02, 0.15 * daylight + 0.02, 0.42 * daylight + 0.04); scene.fog.near = 0.5; scene.fog.far = 18; }
  else { skyCol.setRGB(col[0], col[1], col[2]); scene.fog.near = renderDist * 16 * 0.55; scene.fog.far = renderDist * 16 * 0.95; }
  $('#water-tint').style.display = underwater ? 'block' : 'none';
  scene.fog.color.copy(skyCol);
  renderer.setClearColor(skyCol);
  worldMat.color.setScalar(daylight); waterMat.color.setScalar(daylight);
  if (handMat) handMat.color.setScalar(Math.max(daylight, 0.35));
  skyObjs.cloudMat.color.setScalar(Math.max(daylight, 0.2));
  skyObjs.skyGroup.position.copy(camera.position);
  skyObjs.skyGroup.updateMatrixWorld(true);
  skyObjs.sun.position.set(Math.cos(a) * 400, Math.sin(a) * 400, 60); skyObjs.sun.lookAt(camera.position);
  skyObjs.moon.position.set(-Math.cos(a) * 400, -Math.sin(a) * 400, -60); skyObjs.moon.lookAt(camera.position);
  skyObjs.starGroup.rotation.z = a;
  skyObjs.starMat.opacity = THREE.MathUtils.clamp(1 - t * 1.6, 0, 1);
  skyObjs.clouds.position.set(camera.position.x, 120, camera.position.z);
  skyObjs.cloudTex.offset.set((camera.position.x + cloudDrift) / 768, -camera.position.z / 768);
}