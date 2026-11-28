import * as THREE from 'https://esm.sh/three@0.170.0';
import { HW, PH, EPS } from '../utils/Constants.js';
import { getBlock, chunks, key } from '../world/World.js';
import { SOLID } from '../world/Blocks.js';

export const player = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0.6, pitch: -0.12, onGround: false, flying: true, sprinting: false, sneak: false, inWater: false };
let _bob = 0, _bobAmp = 0;
let wasInWater = false;

export function getBob() { return _bob; }
export function setBob(v) { _bob = v; }
export function getBobAmp() { return _bobAmp; }
export function setBobAmp(v) { _bobAmp = v; }

export function wouldFallOff(dx, dz) { const p = player.pos; const nx = p.x + dx, nz = p.z + dz; for (const ox of [-HW, HW]) for (const oz of [-HW, HW]) if (SOLID[getBlock(Math.floor(nx + ox), Math.floor(p.y - 0.1), Math.floor(nz + oz))]) return false; return true; }

export function collide(axis, d) {
  if (!d) return;
  const p = player.pos; p[axis] += d;
  const h = player.sneak && !player.flying ? 1.5 : PH;
  const x0 = Math.floor(p.x - HW), x1 = Math.floor(p.x + HW - 1e-7);
  const y0 = Math.floor(p.y), y1 = Math.floor(p.y + h - 1e-7);
  const z0 = Math.floor(p.z - HW), z1 = Math.floor(p.z + HW - 1e-7);
  let hit = false;
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    if (!SOLID[getBlock(x, y, z)]) continue;
    hit = true;
    if (axis === 'x') p.x = d > 0 ? Math.min(p.x, x - HW - EPS) : Math.max(p.x, x + 1 + HW + EPS);
    else if (axis === 'z') p.z = d > 0 ? Math.min(p.z, z - HW - EPS) : Math.max(p.z, z + 1 + HW + EPS);
    else p.y = d > 0 ? Math.min(p.y, y - h - EPS) : Math.max(p.y, y + 1);
  }
  if (hit) { player.vel[axis] = 0; if (axis === 'y' && d < 0) player.onGround = true; }
}

export function updatePlayer(dt, keys, inputState, respawnFn, keyBindings) {
  if (!chunks.has(key(Math.floor(player.pos.x / 16), Math.floor(player.pos.z / 16)))) return;
  const k = c => keys.has(c);
  const fwd = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
  const str = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
  player.sneak = k('ShiftLeft') || k('ShiftRight');
  const ctrlHeld = k('ControlLeft') || k('ControlRight');
  if (ctrlHeld && fwd > 0 && !player.sneak) player.sprinting = true;
  else player.sprinting = false;
  const sn = Math.sin(player.yaw), cs = Math.cos(player.yaw);
  let wx = -sn*fwd + cs*str, wz = -cs*fwd - sn*str;
  const len = Math.hypot(wx, wz); if (len) { wx /= len; wz /= len; }
  const p = player.pos;
  player.inWater = getBlock(Math.floor(p.x), Math.floor(p.y + 0.4), Math.floor(p.z)) === 10;
  let speed = player.flying ? (player.sprinting ? 21 : 10.9) : player.sneak ? 1.3 : player.sprinting ? 5.6 : 4.317;
  if (player.inWater && !player.flying) speed *= 0.5;
  const accel = player.flying ? 8 : player.onGround ? 18 : 4;
  const v = player.vel;
  v.x += (wx*speed - v.x) * Math.min(1, accel*dt);
  v.z += (wz*speed - v.z) * Math.min(1, accel*dt);
  if (player.flying) { const vy = ((k('Space') ? 1 : 0) - (player.sneak ? 1 : 0)) * 7.5; v.y += (vy - v.y) * Math.min(1, 10*dt); }
  else if (player.inWater) { v.y -= 10*dt; if (k('Space')) v.y = Math.min(v.y + 30*dt, 3.6); v.y = Math.max(v.y, -4); }
  else { v.y = Math.max(v.y - 32*dt, -60); if (k('Space') && player.onGround) v.y = 9; }
  if (player.sneak && player.onGround && !player.flying) { if (wouldFallOff(v.x*dt, 0)) v.x = 0; if (wouldFallOff(0, v.z*dt)) v.z = 0; }
  const wasGround = player.onGround;
  player.onGround = false;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)) * dt / 0.4));
  for (let i = 0; i < steps; i++) { collide('y', v.y*dt/steps); collide('x', v.x*dt/steps); collide('z', v.z*dt/steps); }
  // ИСПРАВЛЕНИЕ: полёт НЕ отключается автоматически при приземлении
  const hs = Math.hypot(v.x, v.z);
  if (player.onGround && hs > 0.5) setBob(getBob() + hs * dt * 1.7);
  if (player.inWater && !wasInWater) wasInWater = true;
  wasInWater = player.inWater;
  if (p.y < -30) respawnFn();
}