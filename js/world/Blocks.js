import { T, AC, AR } from '../utils/Constants.js';

export const BL = [null,
  {n:'Блок травы', t:[0,2,1], category:'nature'}, 
  {n:'Земля', t:2, category:'nature'}, 
  {n:'Камень', t:3, category:'building'}, 
  {n:'Булыжник', t:4, category:'building'},
  {n:'Дубовое бревно', t:[6,6,5], category:'nature'}, 
  {n:'Дубовые доски', t:7, category:'building'}, 
  {n:'Листва', t:8, leaves:1, category:'nature'},
  {n:'Песок', t:9, category:'nature'}, 
  {n:'Вода', t:10, liquid:1, category:'nature'}, 
  {n:'Стекло', t:11, glass:1, category:'building'},
  {n:'Коренная порода', t:12, category:'building'}, 
  {n:'Кирпичи', t:13, category:'building'}, 
  {n:'Угольная руда', t:14, category:'building'}, 
  {n:'Железная руда', t:15, category:'building'},
  {n:'Трава', t:16, cross:1, category:'plants'}, 
  {n:'Мак', t:17, cross:1, category:'plants'}, 
  {n:'Одуванчик', t:18, cross:1, category:'plants'},
  {n:'Книжная полка', t:[7,7,19], category:'decoration'}, 
  {n:'Белая шерсть', t:20, category:'decoration'}, 
  {n:'Золотой блок', t:21, category:'decoration'},
  {n:'Обсидиан', t:22, category:'building'}, 
  {n:'Снег', t:23, category:'nature'}, 
  {n:'Гравий', t:24, category:'nature'},
];

export const OPAQUE = new Uint8Array(256), SOLID = new Uint8Array(256), SHADOW = new Uint8Array(256), PICK = new Uint8Array(256), OCC = new Uint8Array(256);
for (let i = 1; i < BL.length; i++) {
  const b = BL[i];
  if (!Array.isArray(b.t)) b.t = [b.t, b.t, b.t];
  b.opaque = !(b.leaves || b.liquid || b.glass || b.cross);
  b.solid = !(b.liquid || b.cross);
  b.replace = !!(b.liquid || b.cross);
  OPAQUE[i] = b.opaque ? 1 : 0; OCC[i] = OPAQUE[i];
  SOLID[i] = b.solid ? 1 : 0;
  SHADOW[i] = (b.opaque || b.leaves) ? 1 : 0;
  PICK[i] = b.liquid ? 0 : 1;
}

export const FACES = [
  {n:[1,0,0],  c:[[1,0,1],[1,0,0],[1,1,0],[1,1,1]], s:0.6},
  {n:[-1,0,0], c:[[0,0,0],[0,0,1],[0,1,1],[0,1,0]], s:0.6},
  {n:[0,1,0],  c:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]], s:1.0},
  {n:[0,-1,0], c:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]], s:0.5},
  {n:[0,0,1],  c:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]], s:0.8},
  {n:[0,0,-1], c:[[1,0,0],[0,0,0],[0,1,0],[1,1,0]], s:0.8},
];
for (const F of FACES) {
  const ax = F.n.findIndex(v => v !== 0), o = [0,1,2].filter(a => a !== ax);
  F.ao = F.c.map(c => {
    const d1 = [0,0,0], d2 = [0,0,0];
    d1[o[0]] = c[o[0]]*2 - 1; d2[o[1]] = c[o[1]]*2 - 1;
    const n = F.n;
    return [n[0]+d1[0], n[1]+d1[1], n[2]+d1[2], n[0]+d2[0], n[1]+d2[1], n[2]+d2[2], n[0]+d1[0]+d2[0], n[1]+d1[1]+d2[1], n[2]+d1[2]+d2[2]];
  });
}

export const CROSS = [[[.15,0,.15],[.85,0,.85],[.85,1,.85],[.15,1,.15]], [[.15,0,.85],[.85,0,.15],[.85,1,.15],[.15,1,.85]]];
export const AOC = [0.45, 0.64, 0.82, 1];
export const TUV = [];
for (let t = 0; t < AC*AR; t++) { const c = t % AC, r = (t / AC) | 0; TUV[t] = [c/AC + 0.0006, (c+1)/AC - 0.0006, r/AR + 0.0012, (r+1)/AR - 0.0012]; }
export const uvU = (uv, k) => (k === 0 || k === 3) ? uv[0] : uv[1];
export const uvV = (uv, k) => k < 2 ? uv[3] : uv[2];