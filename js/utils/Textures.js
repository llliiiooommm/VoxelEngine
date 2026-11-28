import * as THREE from 'https://esm.sh/three@0.170.0';
import { T, AC, AR } from './Constants.js';
import { BL, FACES, CROSS, TUV, uvU, uvV } from '../world/Blocks.js';

export const atlas = document.createElement('canvas');
atlas.width = AC * T; atlas.height = AR * T;
const actx = atlas.getContext('2d');
export const AI = actx.createImageData(atlas.width, atlas.height);
let rs = 1337;
const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
function paint(t, fn) {
  const ox = (t % AC) * T, oy = ((t / AC) | 0) * T;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const c = fn(x, y); if (!c) continue;
    const i = ((oy + y) * atlas.width + ox + x) * 4;
    AI.data[i] = c[0]; AI.data[i+1] = c[1]; AI.data[i+2] = c[2]; AI.data[i+3] = c[3] ?? 255;
  }
}
const V = (c, v) => { const k = 1 + (rnd() - 0.5) * v; return [c[0]*k, c[1]*k, c[2]*k]; };
const M = (c, k) => [c[0]*k, c[1]*k, c[2]*k];
const GRASS = [96,156,56], DIRT = [134,96,67], STONE = [128,128,128], PLANK = [162,130,78];
const dirtPx = () => { const r = rnd(); return r < 0.1 ? V([104,74,50],0.15) : r < 0.16 ? V([164,124,92],0.1) : V(DIRT,0.22); };
const stonePx = () => rnd() < 0.1 ? V(M(STONE,0.78),0.1) : V(STONE,0.18);

paint(0, () => rnd() < 0.12 ? M(V(GRASS,0.2),0.8) : V(GRASS,0.3));
{ const drip = Array.from({length:16}, () => 3 + (rnd()*2|0) + (rnd() < 0.2 ? 2 : 0));
  paint(1, (x, y) => y < drip[x] ? V(GRASS,0.3) : dirtPx()); }
paint(2, dirtPx); paint(3, stonePx);
{ const pts = Array.from({length:9}, () => ({x: rnd()*16, y: rnd()*16, s: 0.72 + rnd()*0.4}));
  paint(4, (x, y) => { let d1 = 99, d2 = 99, best = pts[0]; for (const p of pts) { let dx = Math.abs(x + .5 - p.x); dx = Math.min(dx, 16 - dx); let dy = Math.abs(y + .5 - p.y); dy = Math.min(dy, 16 - dy); const d = Math.hypot(dx, dy); if (d < d1) { d2 = d1; d1 = d; best = p; } else if (d < d2) d2 = d; } return d2 - d1 < 1.1 ? V([62,62,62],0.2) : V(M(STONE,best.s),0.14); }); }
{ const cols = Array.from({length:16}, () => 0.82 + rnd()*0.3); paint(5, x => rnd() < 0.08 ? M(V([104,82,50],0.1), 0.65*cols[x]) : M(V([108,85,52],0.12), cols[x])); }
paint(6, (x, y) => { const r = Math.max(Math.abs(x-7.5), Math.abs(y-7.5)); if (r > 6.5) return M(V([104,82,50],0.15),0.85); return Math.floor(r) % 2 ? V([176,140,88],0.08) : V([156,122,74],0.08); });
paint(7, (x, y) => { const b = y >> 2; if ((y & 3) === 3) return V([98,76,44],0.1); if (x === ((b*7+3) & 15)) return V([110,86,52],0.1); return M(V(PLANK,0.1), b % 2 ? 0.94 : 1); });
paint(8, () => rnd() < 0.2 ? null : (rnd() < 0.25 ? V([40,96,24],0.2) : V([62,134,38],0.35)));
paint(9, () => V([219,207,163],0.12));
paint(10, (x, y) => ((x + y*3) % 11 === 0 || (x*2 + y) % 13 === 0) ? V([90,134,230],0.08) : V([48,92,206],0.1));
paint(11, (x, y) => { if (x === 0 || y === 0 || x === 15 || y === 15) return V([208,228,234],0.06); if ((x - y === 4 || x - y === 5) && x > 5 && x < 12) return [236,246,250]; if (x - y === -6 && x > 2 && x < 6) return [236,246,250]; return null; });
paint(12, () => { const r = rnd(); return V(r < .3 ? [42,42,42] : r < .6 ? [86,86,86] : r < .85 ? [118,118,118] : [60,60,60], 0.1); });
paint(13, (x, y) => { const row = y >> 2; if ((y & 3) === 3 || ((x + (row & 1)*4) & 7) === 7) return V([178,170,160],0.08); return V([152,72,56],0.16); });
function ore(t, color) { const blobs = Array.from({length:5}, () => [1.5 + rnd()*13, 1.5 + rnd()*13]); paint(t, (x, y) => { for (const b of blobs) { if (Math.hypot(x + .5 - b[0], y + .5 - b[1]) < 1.7 && rnd() < 0.85) return V(color,0.2); } return stonePx(); }); }
ore(14, [36,36,36]); ore(15, [214,170,140]);
{ const hs = Array.from({length:16}, () => rnd() < 0.65 ? 4 + (rnd()*11|0) : 0); paint(16, (x, y) => (hs[x] && y >= 16 - hs[x]) ? V(GRASS,0.35) : null); }
const stem = (x, y) => ((x === 7 || x === 8) && y >= 8) ? V([60,120,40],0.15) : ((x === 6 && y === 11) || (x === 5 && y === 11) || (x === 9 && y === 12) || (x === 10 && y === 12)) ? V([70,140,46],0.15) : null;
paint(17, (x, y) => { const d = Math.hypot(x - 7.5, y - 5); if (d < 1.2) return [110,20,18]; if (d < 3.2) return V([204,32,30],0.2); return stem(x, y); });
paint(18, (x, y) => { const d = Math.hypot(x - 7.5, y - 6.5); if (d < 1) return [200,140,20]; if (d < 2.6) return V([244,214,46],0.12); return stem(x, y); });
{ const BC = [[150,40,40],[44,72,140],[62,120,52],[166,132,56],[110,60,120]]; const books = Array.from({length:16}, () => ({c: BC[rnd()*5|0], h: rnd()*3|0}));
  paint(19, (x, y) => { if (y < 2 || y > 13 || y === 7 || y === 8 || x === 0 || x === 15) return M(V(PLANK,0.1), (y === 8 || y === 1) ? 0.78 : 1); const shelf = y < 7 ? 0 : 1, top = shelf ? 9 : 2, bk = books[shelf*8 + (x >> 1)]; if (y - top < bk.h) return [46,34,22]; return M(V(bk.c,0.12), x & 1 ? 0.8 : 1); }); }
paint(20, (x, y) => V([234,234,234], (x + y) % 4 === 0 ? 0.04 : 0.1));
paint(21, (x, y) => M(V([248,206,56],0.08), (x === 0 || y === 0) ? 1.12 : (x === 15 || y === 15) ? 0.8 : 1));
paint(22, () => rnd() < 0.08 ? V([62,40,92],0.2) : V([22,18,32],0.4));
paint(23, () => V([242,248,252],0.04));
paint(24, () => { const r = rnd(); return V(r < .3 ? [110,104,100] : r < .6 ? [146,138,134] : r < .8 ? [90,84,82] : [168,160,154], 0.1); });
actx.putImageData(AI, 0, 0);

export const atlasTex = new THREE.CanvasTexture(atlas);
atlasTex.magFilter = THREE.NearestFilter; atlasTex.minFilter = THREE.NearestFilter;
atlasTex.generateMipmaps = false; atlasTex.flipY = false;

export const icons = [];
function drawIcon(id) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const b = BL[id];
  const face = (tile, m, dark) => {
    g.setTransform(...m);
    const sx = (tile % AC)*T, sy = ((tile / AC) | 0)*T;
    g.globalCompositeOperation = 'source-over';
    g.drawImage(atlas, sx, sy, 16, 16, 0, 0, 16, 16);
    if (dark) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = `rgba(0,0,0,${dark})`; g.fillRect(0, 0, 16, 16); }
  };
  if (b.cross) face(b.t[2], [4,0,0,4,0,0], 0);
  else { const k = 28/16, h = 14/16; face(b.t[0], [k, h, -k, h, 32, 4], 0); face(b.t[2], [k, h, 0, k, 4, 18], 0.42); face(b.t[2], [k, -h, 0, k, 32, 32], 0.22); }
  return c.toDataURL();
}
for (let i = 1; i < BL.length; i++) icons[i] = drawIcon(i);
{ const s = document.createElement('canvas'); s.width = s.height = 16; s.getContext('2d').drawImage(atlas, 3*T, 0, 16, 16, 0, 0, 16, 16);
  document.documentElement.style.setProperty('--stone', `url(${s.toDataURL()})`);
  const b = document.createElement('canvas'); b.width = b.height = 16; const bg = b.getContext('2d'); bg.drawImage(atlas, 3*T, 0, 16, 16, 0, 0, 16, 16); bg.fillStyle = 'rgba(110,110,110,.55)'; bg.fillRect(0,0,16,16);
  document.documentElement.style.setProperty('--btn', `url(${b.toDataURL()})`); }

export function blockGeometry(id) {
  if (!id || !BL[id]) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([], 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute([], 3));
    g.setIndex([]);
    return g;
  }
  const b = BL[id], P = [], U = [], C = [], I = [];
  const quad = (cs, tile, s, both) => {
    const base = P.length / 3, uv = TUV[tile];
    cs.forEach((c, k) => { P.push(c[0]-.5, c[1]-.5, c[2]-.5); U.push(uvU(uv,k), uvV(uv,k)); C.push(s, s, s); });
    I.push(base, base+1, base+2, base, base+2, base+3);
    if (both) I.push(base, base+2, base+1, base, base+3, base+2);
  };
  if (b.cross) CROSS.forEach(q => quad(q, b.t[2], 1, false));
  else FACES.forEach((F, f) => quad(F.c, f === 2 ? b.t[0] : f === 3 ? b.t[1] : b.t[2], F.s, false));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(I); return g;
}