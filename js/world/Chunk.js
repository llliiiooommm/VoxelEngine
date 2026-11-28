import * as THREE from 'https://esm.sh/three@0.170.0';
import { CS, H, SEA } from '../utils/Constants.js';
import { heightAt, hash3, noise } from '../utils/Noise.js';
import { BL, SHADOW, OPAQUE, FACES, CROSS, TUV, uvU, uvV, AOC, OCC } from './Blocks.js';

export function columnInfo(c, x, z) {
  let t = -1, mx = 0;
  for (let y = H - 1; y >= 0; y--) {
    const id = c.data[(y*16 + z)*16 + x];
    if (!id) continue;
    if (!mx) mx = y;
    if (SHADOW[id]) { t = y; break; }
  }
  c.top[z*16 + x] = t;
  return mx;
}

export function generate(cx, cz, chunks, keyFn) {
  const c = { cx, cz, data: new Uint8Array(CS*CS*H), top: new Int16Array(256), maxY: 0, dirty: true, modified: false, mesh: null, water: null };
  const d = c.data, X0 = cx*16, Z0 = cz*16;
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const wx = X0 + x, wz = Z0 + z, h = heightAt(wx, wz);
    const surf = h < SEA - 3 ? 23 : h <= SEA + 1 ? 8 : h > SEA + 34 ? 22 : 1;
    const under = surf === 1 ? 2 : surf === 22 ? 3 : surf;
    const topY = Math.max(h, SEA);
    const cavesAllowed = h > SEA + 3;
    for (let y = 0; y <= topY; y++) {
      let id;
      if (y === 0 || (y < 3 && hash3(wx, y, wz) < (y === 1 ? 0.6 : 0.3))) id = 11;
      else if (y < h - 3) { id = 3; if (hash3(wx >> 1, y >> 1, wz >> 1) < 0.014 && hash3(wx, y, wz) < 0.65) id = 13; else if (y < SEA && hash3((wx >> 1) + 999, y >> 1, wz >> 1) < 0.008 && hash3(wx, y, wz) < 0.6) id = 14; }
      else if (y < h) id = under;
      else if (y === h) id = surf;
      else id = 9;
      if (id !== 9 && id !== 11 && y >= 3 && y <= h && (cavesAllowed || y < h - 4)) { if (noise.n3(wx*0.035, y*0.06, wz*0.035) > 0.55) id = 0; }
      d[(y*16 + z)*16 + x] = id;
    }
    if (surf === 1 && d[(h*16 + z)*16 + x] === 1 && h + 1 < H) { const g = hash3(wx, 3, wz), dens = 0.04 + Math.max(0, noise.n2(wx*0.02 + 9, wz*0.02)) * 0.3; if (g < dens) d[((h+1)*16 + z)*16 + x] = g < dens*0.88 ? 15 : (hash3(wx, 4, wz) < 0.5 ? 16 : 17); }
  }
  for (let tz = Z0 - 2; tz < Z0 + 18; tz++) for (let tx = X0 - 2; tx < X0 + 18; tx++) {
    const forest = noise.n2(tx*0.008 + 40, tz*0.008 - 40);
    if (hash3(tx, 7, tz) >= 0.002 + Math.max(0, forest)*0.045) continue;
    const h = heightAt(tx, tz);
    if (h <= SEA + 1 || h > SEA + 30) continue;
    const th = 4 + (hash3(tx, 8, tz)*3 | 0);
    const put = (x, y, z, id, force) => { const lx = x - X0, lz = z - Z0; if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || y < 0 || y >= H) return; const i = (y*16 + lz)*16 + lx, cur = d[i]; if (force || cur === 0 || BL[cur].cross) d[i] = id; };
    for (let ly = th - 2; ly <= th + 1; ly++) { const r = ly >= th ? 1 : 2; for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { if (Math.abs(dx) === r && Math.abs(dz) === r && (ly === th + 1 || hash3(tx + dx, h + ly, tz + dz) < 0.5)) continue; put(tx + dx, h + ly, tz + dz, 7, false); } }
    for (let y = 1; y <= th; y++) put(tx, h + y, tz, 5, true);
    put(tx, h, tz, 2, true);
  }
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) c.maxY = Math.max(c.maxY, columnInfo(c, x, z));
  chunks.set(keyFn(cx, cz), c); return c;
}

export function makeMesh(c, A, mat, order, scene) {
  if (!A.i.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(A.p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(A.u, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(A.c, 3));
  g.setIndex(A.i); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, mat);
  m.position.set(c.cx*16, 0, c.cz*16); m.matrixAutoUpdate = false; m.updateMatrix(); m.renderOrder = order;
  scene.add(m); return m;
}

export function dropMesh(c, scene) {
  for (const w of ['mesh', 'water']) if (c[w]) { scene.remove(c[w]); c[w].geometry.dispose(); c[w] = null; }
}

const LV = [0,0,0,0];
export function buildMesh(c, chunks, keyFn, worldMat, waterMat, scene) {
  const N = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) N.push(chunks.get(keyFn(c.cx + dx, c.cz + dz)));
  const get = (x, y, z) => { if (y < 0) return 11; if (y >= H) return 0; let i = 4; if (x < 0) { i--; x += 16; } else if (x > 15) { i++; x -= 16; } if (z < 0) { i -= 3; z += 16; } else if (z > 15) { i += 3; z -= 16; } return N[i].data[(y*16 + z)*16 + x]; };
  const topAt = (x, z) => { let i = 4; if (x < 0) { i--; x += 16; } else if (x > 15) { i++; x -= 16; } if (z < 0) { i -= 3; z += 16; } else if (z > 15) { i += 3; z -= 16; } return N[i].top[z*16 + x]; };
  const O = {p:[], u:[], c:[], i:[]}, W = {p:[], u:[], c:[], i:[]};
  const d = c.data;
  for (let y = 0; y <= c.maxY; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const id = d[(y*16 + z)*16 + x]; if (!id) continue;
    const b = BL[id];
    if (b.cross) { const t = topAt(x, z), s = y > t ? 1 : Math.max(0.3, 0.8 - (t - y)*0.04), uv = TUV[b.t[2]]; for (const q of CROSS) { const base = O.p.length / 3; for (let k = 0; k < 4; k++) { O.p.push(x + q[k][0], y + q[k][1], z + q[k][2]); O.u.push(uvU(uv,k), uvV(uv,k)); O.c.push(s, s, s); } O.i.push(base, base+1, base+2, base, base+2, base+3, base, base+2, base+1, base, base+3, base+2); } continue; }
    const A = b.liquid ? W : O;
    const wt = b.liquid && get(x, y + 1, z) !== id ? 0.875 : 1;
    for (let f = 0; f < 6; f++) {
      const F = FACES[f], nx = x + F.n[0], ny = y + F.n[1], nz = z + F.n[2];
      const nid = get(nx, ny, nz);
      if (nid && (OPAQUE[nid] || (nid === id && !b.leaves))) continue;
      const t = topAt(nx, nz), sun = ny > t ? 1 : Math.max(0.3, 0.8 - (t - ny)*0.04);
      const uv = TUV[f === 2 ? b.t[0] : f === 3 ? b.t[1] : b.t[2]];
      const base = A.p.length / 3;
      for (let k = 0; k < 4; k++) {
        const cc = F.c[k];
        A.p.push(x + cc[0], (cc[1] && wt !== 1) ? y + wt : y + cc[1], z + cc[2]);
        A.u.push(uvU(uv,k), uvV(uv,k));
        let a = 3;
        if (!b.liquid) { const o = F.ao[k]; const s1 = OCC[get(x+o[0], y+o[1], z+o[2])], s2 = OCC[get(x+o[3], y+o[4], z+o[5])], cr = OCC[get(x+o[6], y+o[7], z+o[8])]; a = (s1 && s2) ? 0 : 3 - s1 - s2 - cr; }
        LV[k] = a;
        const s = F.s * sun * AOC[a]; A.c.push(s, s, s);
      }
      if (LV[0] + LV[2] < LV[1] + LV[3]) A.i.push(base+1, base+2, base+3, base+1, base+3, base);
      else A.i.push(base, base+1, base+2, base, base+2, base+3);
    }
  }
  dropMesh(c, scene);
  c.mesh = makeMesh(c, O, worldMat, 0, scene);
  c.water = makeMesh(c, W, waterMat, 1, scene);
  c.dirty = false;
}