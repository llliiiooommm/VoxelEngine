import * as THREE from 'https://esm.sh/three@0.170.0';
import { T, AC } from '../utils/Constants.js';
import { BL, SOLID } from '../world/Blocks.js';
import { getBlock } from './World.js';
import { atlas, AI } from '../utils/Textures.js';

export const particles = [];
const partGeo = new THREE.BoxGeometry(0.11, 0.11, 0.11);

export function spawnParticles(x, y, z, id, daylight, scene) {
  const tile = Array.isArray(BL[id].t) ? BL[id].t[2] : BL[id].t;
  const ox = (tile % AC) * T, oy = ((tile / AC) | 0) * T;
  
  for (let n = 0; n < 14; n++) {
    let r = 0, g = 0, b = 0;
    for (let tries = 0; tries < 10; tries++) {
      const i = ((oy + (Math.random() * 16 | 0)) * atlas.width + ox + (Math.random() * 16 | 0)) * 4;
      if (AI.data[i + 3] > 0) { r = AI.data[i]; g = AI.data[i + 1]; b = AI.data[i + 2]; break; }
    }
    const m = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(r / 255 * daylight, g / 255 * daylight, b / 255 * daylight) }));
    m.position.set(x + .2 + Math.random() * .6, y + .2 + Math.random() * .6, z + .2 + Math.random() * .6);
    scene.add(m);
    particles.push({ m, v: new THREE.Vector3((Math.random() - .5) * 3, Math.random() * 3 + 1, (Math.random() - .5) * 3), life: 0.5 + Math.random() * 0.5 });
  }
}

export function updateParticles(dt, scene) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.life -= dt;
    if (p.life <= 0) { scene.remove(p.m); p.m.material.dispose(); particles.splice(i, 1); continue; }
    p.v.y -= 18 * dt;
    p.m.position.addScaledVector(p.v, dt);
    const q = p.m.position;
    if (SOLID[getBlock(Math.floor(q.x), Math.floor(q.y - 0.06), Math.floor(q.z))]) { 
      q.y = Math.floor(q.y - 0.06) + 1.06; p.v.set(p.v.x * 0.6, 0, p.v.z * 0.6); 
    }
  }
}