import { getBlock, setBlock } from '../world/World.js';
import { BL, SOLID, OPAQUE } from '../world/Blocks.js';
import { player } from '../entities/Player.js';
import { HW, PH } from '../utils/Constants.js';
import { soundManager } from './SoundManager.js';

export function raycast(o, d, max) {
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
  const tdx = sx ? Math.abs(1/d.x) : Infinity, tdy = sy ? Math.abs(1/d.y) : Infinity, tdz = sz ? Math.abs(1/d.z) : Infinity;
  let tmx = sx > 0 ? (x + 1 - o.x)*tdx : sx < 0 ? (o.x - x)*tdx : Infinity;
  let tmy = sy > 0 ? (y + 1 - o.y)*tdy : sy < 0 ? (o.y - y)*tdy : Infinity;
  let tmz = sz > 0 ? (z + 1 - o.z)*tdz : sz < 0 ? (o.z - z)*tdz : Infinity;
  let face = [0,0,0], t = 0;
  
  for (let i = 0; i < 64; i++) {
    const id = getBlock(x, y, z);
    // ИСПРАВЛЕНИЕ: Используем SOLID, чтобы ловить листву (8), стекло (11) и воду (10)
    if (id && SOLID[id]) return { x, y, z, id, face };
    
    if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; face = [-sx,0,0]; }
    else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; face = [0,-sy,0]; }
    else { z += sz; t = tmz; tmz += tdz; face = [0,0,-sz]; }
    if (t > max) return null;
  }
  return null;
}

export function intersectsPlayer(x, y, z) {
  const p = player.pos;
  return p.x + HW > x && p.x - HW < x + 1 && p.y + PH > y && p.y < y + 1 && p.z + HW > z && p.z - HW < z + 1;
}

export function doAction(btn, target, slots, sel, selectSlot, renderHotbar, spawnParticlesFn, setBlockFn, getBlockFn) {
  if (!target) { 
    if (btn !== 1) window.swingT = 1; 
    return; 
  }
  const h = target;
  
  // ЛКМ: Ломание
  if (btn === 0) {
    setBlockFn(h.x, h.y, h.z, 0);
    spawnParticlesFn(h.x, h.y, h.z, h.id);
    soundManager.playBreak();
    
    // Ломаем растения сверху, если ломаете блок под ними
    const above = getBlockFn(h.x, h.y + 1, h.z);
    if (above && BL[above].cross) setBlockFn(h.x, h.y + 1, h.z, 0);
    
    window.swingT = 1;
  } 
  // ПКМ: Установка
  else if (btn === 2) {
    const id = slots[sel]; 
    const b = BL[id];
    let tx = h.x, ty = h.y, tz = h.z;
    
    if (!BL[h.id].replace) { 
      tx += h.face[0]; ty += h.face[1]; tz += h.face[2]; 
    }
    
    if (ty < 0 || ty >= 96) return;
    const cur = getBlockFn(tx, ty, tz);
    if (cur && !BL[cur].replace) return;
    
    if (b.cross) { 
      const below = getBlockFn(tx, ty - 1, tz); 
      if (below !== 1 && below !== 2) return; 
    }
    
    if (b.solid && intersectsPlayer(tx, ty, tz)) return;
    
    setBlockFn(tx, ty, tz, id);
    if (OPAQUE[id] && getBlockFn(tx, ty - 1, tz) === 1) setBlockFn(tx, ty - 1, tz, 2);
    
    soundManager.playPlace();
    window.swingT = 1;
  } 
  // СКМ: Взять блок
  else if (btn === 1) {
    const i = slots.indexOf(h.id);
    if (i >= 0) selectSlot(i); 
    else { 
      slots[sel] = h.id; 
      renderHotbar(); 
      selectSlot(sel); 
    }
  }
}