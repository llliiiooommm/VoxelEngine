import { SEA, H } from './Constants.js';

let currentSeed = (Math.random() * 1e9) | 0;
let currentNoise = makeNoise(currentSeed);

export { currentSeed as SEED, currentNoise as noise };

export function regenerateNoise(newSeed) {
  currentSeed = newSeed;
  currentNoise = makeNoise(currentSeed);
}

export function makeNoise(seed) {
  const p = new Uint8Array(512), perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  let s = seed >>> 0;
  const r = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const G = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6, F3 = 1/3, G3 = 1/6;
  function n2(xin, yin) {
    const s = (xin + yin) * F2, i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2, x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2*G2, y2 = y0 - 1 + 2*G2;
    const ii = i & 255, jj = j & 255;
    let n = 0, tt, g;
    tt = 0.5 - x0*x0 - y0*y0; if (tt > 0) { g = G[p[ii + p[jj]] % 12]; tt *= tt; n += tt*tt*(g[0]*x0 + g[1]*y0); }
    tt = 0.5 - x1*x1 - y1*y1; if (tt > 0) { g = G[p[ii + i1 + p[jj + j1]] % 12]; tt *= tt; n += tt*tt*(g[0]*x1 + g[1]*y1); }
    tt = 0.5 - x2*x2 - y2*y2; if (tt > 0) { g = G[p[ii + 1 + p[jj + 1]] % 12]; tt *= tt; n += tt*tt*(g[0]*x2 + g[1]*y2); }
    return 70 * n;
  }
  function n3(xin, yin, zin) {
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=1;k2=0; }
      else if (x0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=0;k2=1; }
      else { i1=0;j1=0;k1=1;i2=1;j2=0;k2=1; }
    } else {
      if (y0 < z0) { i1=0;j1=0;k1=1;i2=0;j2=1;k2=1; }
      else if (x0 < z0) { i1=0;j1=1;k1=0;i2=0;j2=1;k2=1; }
      else { i1=0;j1=1;k1=0;i2=1;j2=1;k2=0; }
    }
    const x1=x0-i1+G3, y1=y0-j1+G3, z1=z0-k1+G3;
    const x2=x0-i2+2*G3, y2=y0-j2+2*G3, z2=z0-k2+2*G3;
    const x3=x0-1+3*G3, y3=y0-1+3*G3, z3=z0-1+3*G3;
    const ii=i&255, jj=j&255, kk=k&255;
    let n = 0, tt, g;
    tt = 0.6-x0*x0-y0*y0-z0*z0; if (tt>0) { g=G[p[ii+p[jj+p[kk]]]%12]; tt*=tt; n+=tt*tt*(g[0]*x0+g[1]*y0+g[2]*z0); }
    tt = 0.6-x1*x1-y1*y1-z1*z1; if (tt>0) { g=G[p[ii+i1+p[jj+j1+p[kk+k1]]]%12]; tt*=tt; n+=tt*tt*(g[0]*x1+g[1]*y1+g[2]*z1); }
    tt = 0.6-x2*x2-y2*y2-z2*z2; if (tt>0) { g=G[p[ii+i2+p[jj+j2+p[kk+k2]]]%12]; tt*=tt; n+=tt*tt*(g[0]*x2+g[1]*y2+g[2]*z2); }
    tt = 0.6-x3*x3-y3*y3-z3*z3; if (tt>0) { g=G[p[ii+1+p[jj+1+p[kk+1]]]%12]; tt*=tt; n+=tt*tt*(g[0]*x3+g[1]*y3+g[2]*z3); }
    return 32 * n;
  }
  return { n2, n3 };
}

export function hash3(x, y, z) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1442695041) ^ Math.imul(currentSeed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function fbm(x, z, oct) { 
  let a = 1, f = 1, s = 0, n = 0; 
  for (let i = 0; i < oct; i++) { s += currentNoise.n2(x*f, z*f) * a; n += a; a *= 0.5; f *= 2; } 
  return s / n; 
}

export function heightAt(x, z) {
  const cont = fbm(x * 0.0025, z * 0.0025, 3);
  const hills = fbm(x * 0.012, z * 0.012, 4);
  const m = currentNoise.n2(x * 0.006 + 200, z * 0.006 - 300);
  const mount = m > 0.25 ? (m - 0.25) * (m - 0.25) * 85 : 0;
  const h = SEA + 3 + cont * 12 + hills * 7 + mount;
  return Math.max(4, Math.min(H - 12, Math.floor(h)));
}