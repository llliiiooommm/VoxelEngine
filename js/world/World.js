import { H } from '../utils/Constants.js';
import { generate, buildMesh, dropMesh, columnInfo } from './Chunk.js';

export const chunks = new Map();
export const key = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);

export function getBlock(x, y, z) {
  if (y < 0 || y >= H) return 0;
  const c = chunks.get(key(x >> 4, z >> 4));
  return c ? c.data[(y*16 + (z & 15))*16 + (x & 15)] : 0;
}

export function setBlock(x, y, z, id) {
  if (y < 0 || y >= H) return;
  const c = chunks.get(key(x >> 4, z >> 4));
  if (!c) return;
  const lx = x & 15, lz = z & 15;
  c.data[(y*16 + lz)*16 + lx] = id;
  c.modified = true;
  columnInfo(c, lx, lz);
  if (y >= c.maxY && id === 0) {
    c.maxY = 0;
    for (let zz = 0; zz < 16; zz++) {
      for (let xx = 0; xx < 16; xx++) {
        for (let yy = H - 1; yy >= 0; yy--) {
          if (c.data[(yy*16 + zz)*16 + xx]) {
            if (yy > c.maxY) c.maxY = yy;
            break;
          }
        }
      }
    }
  } else if (y > c.maxY) {
    c.maxY = y;
  }
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const n = chunks.get(key((x + dx) >> 4, (z + dz) >> 4));
      if (n) n.dirty = true;
    }
  }
}

export function serializeModifiedChunks() {
  const modified = [];
  for (const c of chunks.values()) {
    if (c.modified) {
      const blocks = [];
      for (let i = 0; i < c.data.length; i++) {
        if (c.data[i] !== 0) blocks.push([i, c.data[i]]);
      }
      modified.push({
        cx: c.cx, cz: c.cz,
        maxY: c.maxY,
        top: Array.from(c.top),
        blocks: blocks
      });
    }
  }
  return modified;
}

export function applyModifiedChunks(modifiedChunks) {
  if (!modifiedChunks || !Array.isArray(modifiedChunks)) return;
  for (const mc of modifiedChunks) {
    const c = chunks.get(key(mc.cx, mc.cz));
    if (!c) continue;
    c.maxY = mc.maxY;
    c.top = new Int16Array(mc.top);
    for (const [idx, id] of mc.blocks) {
      c.data[idx] = id;
    }
    c.modified = true;
    c.dirty = true;
  }
}

export function neighborsReady(c) {
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!chunks.has(key(c.cx + dx, c.cz + dz))) return false;
    }
  }
  return true;
}

export let renderDist = 6, offsets = [];
export function buildOffsets() {
  offsets = [];
  const r = renderDist + 2;
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      const d2 = dx*dx + dz*dz;
      if (d2 <= (r + .5)**2) offsets.push([dx, dz, d2]);
    }
  }
  offsets.sort((a, b) => a[2] - b[2]);
}
buildOffsets();

export function setRenderDist(d) { renderDist = d; buildOffsets(); }

let unloadTimer = 0;
export function updateChunks(budget, dt, playerPos, worldMat, waterMat, scene) {
  const t0 = performance.now();
  const pcx = Math.floor(playerPos.x / 16), pcz = Math.floor(playerPos.z / 16);
  for (const [dx, dz] of offsets) {
    if (Math.abs(dx) > renderDist + 2 || Math.abs(dz) > renderDist + 2) continue;
    if (performance.now() - t0 > budget * 0.5) break;
    if (!chunks.has(key(pcx + dx, pcz + dz))) generate(pcx + dx, pcz + dz, chunks, key);
  }
  const R2 = (renderDist + .5)**2;
  for (const [dx, dz, d2] of offsets) {
    if (d2 > R2) continue;
    if (performance.now() - t0 > budget) break;
    const c = chunks.get(key(pcx + dx, pcz + dz));
    if (c && c.dirty && neighborsReady(c)) buildMesh(c, chunks, key, worldMat, waterMat, scene);
  }
  unloadTimer += dt;
  if (unloadTimer > 1) {
    unloadTimer = 0;
    for (const [k, c] of chunks) {
      const dd = Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz));
      if (dd > renderDist + 2 && (c.mesh || c.water)) { dropMesh(c, scene); c.dirty = true; }
      if (dd > renderDist + 5 && !c.modified) chunks.delete(k);
    }
  }
}