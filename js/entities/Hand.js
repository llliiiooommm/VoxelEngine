import * as THREE from 'https://esm.sh/three@0.170.0';
import { blockGeometry } from '../utils/Textures.js';
import { BL } from '../world/Blocks.js';

export let swingT = 0;
export function setSwingT(v) { swingT = v; }
export let handMesh = null, handId = -1;
export let handScene, handCam, handMat;

export function initHand(scene, camera, atlasTex) {
  handScene = new THREE.Scene();
  handCam = new THREE.PerspectiveCamera(70, camera.aspect, 0.01, 10);
  handMat = new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, fog: false });
}

export function updateHand(dt, slots, sel, bob, bobAmp) {
  const id = slots[sel];
  if (id === 0 || !BL[id]) {
    if (handMesh) handMesh.visible = false;
    return;
  }
  if (handMesh) handMesh.visible = true;
  if (id !== handId) {
    if (handMesh) { handScene.remove(handMesh); handMesh.geometry.dispose(); }
    handMesh = new THREE.Mesh(blockGeometry(id), handMat);
    handScene.add(handMesh);
    handId = id;
  }
  swingT = Math.max(0, swingT - dt * 4.5);
  const sw = Math.sin((1 - swingT) * Math.PI) * (swingT > 0 ? 1 : 0);
  const bx = Math.cos(bob) * 0.035 * bobAmp, by = -Math.abs(Math.sin(bob)) * 0.04 * bobAmp;
  handMesh.position.set(0.62 + bx - sw * 0.18, -0.56 + by + sw * 0.12, -1.0 - sw * 0.15);
  handMesh.rotation.set(-sw * 0.7, Math.PI / 4 + 0.15 - sw * 0.3, 0);
  handMesh.scale.setScalar(BL[id].cross ? 0.55 : 0.42);
}