import { $, body } from '../utils/Constants.js';
import { BL } from '../world/Blocks.js';
import { icons } from '../utils/Textures.js';
import { DIRS } from '../utils/Constants.js';
import { chunks } from '../world/World.js';
import { player } from '../entities/Player.js';
import { dayTime } from '../world/Sky.js';

export const slots = [1, 2, 3, 4, 6, 5, 10, 12, 18];
export let sel = 0;
export let state = 'menu', fallbackLook = false;
let _debugOn = false;
let nameTimer = 0;

export function getDebugOn() { return _debugOn; }
export function setDebugOn(v) { _debugOn = v; }

const SCREEN_MAP = {
    menu: 'main-menu',
    worlds: 'worlds-screen',
    settings: 'settings-screen',
    paused: 'pause-screen',
    inventory: 'inventory'
};

function toggleScreen(screenId, visible) {
    const el = document.getElementById(screenId);
    if (el) el.hidden = !visible;
}

export function renderHotbar() {
    const hotbarEl = $('#hotbar');
    if (!hotbarEl) return;
    hotbarEl.innerHTML = slots.map((id, i) => `<div class="slot${i === sel ? ' sel' : ''}"><img alt="" src="${icons[id]}"><span class="num">${i + 1}</span></div>`).join('');
}

export function selectSlot(i) {
    sel = (i + 9) % 9; 
    renderHotbar();
    const el = $('#item-name'); 
    if (el) {
        el.textContent = BL[slots[sel]].n; 
        el.classList.add('show');
        clearTimeout(nameTimer); 
        nameTimer = setTimeout(() => el.classList.remove('show'), 1400);
    }
    if (state === 'inventory') renderInventory();
}

export function renderInventory() {
    const grid = $('#inv-grid'); 
    const hb = $('#inv-hotbar');
    if (!grid || !hb) return;

    grid.innerHTML = '';
    for (let id = 1; id < BL.length; id++) {
        const b = document.createElement('button');
        b.className = 'inv-slot'; b.title = BL[id].n; b.setAttribute('aria-label', BL[id].n);
        b.innerHTML = `<img alt="" src="${icons[id]}">`;
        b.onclick = () => { slots[sel] = id; selectSlot(sel); };
        grid.appendChild(b);
    }
    
    hb.innerHTML = '';
    slots.forEach((id, i) => {
        const b = document.createElement('button');
        b.className = 'inv-slot' + (i === sel ? ' sel' : ''); 
        b.setAttribute('aria-label', `Слот ${i + 1}: ${BL[id].n}`);
        b.innerHTML = `<img alt="" src="${icons[id]}">`;
        b.onclick = () => selectSlot(i);
        hb.appendChild(b);
    });
}

export function setState(s, canvas) {
    state = s;
    Object.values(SCREEN_MAP).forEach(id => toggleScreen(id, false));
    if (SCREEN_MAP[s]) toggleScreen(SCREEN_MAP[s], true);
    body.classList.toggle('in-game', s !== 'menu' && s !== 'settings' && s !== 'worlds');
    body.classList.toggle('playing', s === 'playing');
    if (s === 'playing' && canvas) {
        try { if (!document.pointerLockElement) canvas.requestPointerLock(); } catch(e){}
    } else if (s !== 'playing' && document.pointerLockElement) {
        document.exitPointerLock();
    }
    if (s === 'inventory') renderInventory();
}

export function enableFallback() {
    fallbackLook = true; 
    body.classList.add('fallback');
    if (state !== 'playing') setState('playing');
}

export function lockPointer(canvas) {
    if (fallbackLook) return;
    try {
        if (!canvas.requestPointerLock) { enableFallback(); return; }
        const r = canvas.requestPointerLock();
        if (r && r.catch) r.catch(() => enableFallback());
    } catch { enableFallback(); }
}

export function updateDebug(fps, target, SEED) {
    if (!_debugOn) return;
    const p = player.pos, tw = Math.PI * 2;
    const dir = DIRS[Math.round((((player.yaw % tw) + tw) % tw) / (Math.PI / 2)) % 4];
    const hours = (6 + dayTime * 24) % 24, hh = String(Math.floor(hours)).padStart(2, '0'), mm = String(Math.floor((hours % 1) * 60)).padStart(2, '0');
    let meshes = 0; for (const c of chunks.values()) if (c.mesh) meshes++;
    const lines = [
        `VoxelEngine 1.0 · ${fps} FPS`,
        `XYZ: ${p.x.toFixed(2)} / ${p.y.toFixed(2)} / ${p.z.toFixed(2)}`,
        `Блок: ${Math.floor(p.x)} ${Math.floor(p.y)} ${Math.floor(p.z)}`,
        `Чанк: ${Math.floor(p.x/16)} ${Math.floor(p.z/16)}`,
        `Смотрит на: ${dir}`,
        `Время: ${hh}:${mm}`,
        `Чанков: ${chunks.size} · мешей: ${meshes}`,
        `Сид: ${SEED}`,
        target ? `Цель: ${BL[target.id].n} (${target.x} ${target.y} ${target.z})` : 'Цель: —',
    ];
    const debugEl = $('#debug');
    if (debugEl) debugEl.innerHTML = lines.map(l => `<span>${l}</span>`).join('');
}

export const SPLASHES = ['Почти как оригинал!', 'Теперь с облаками!', 'Квадратное — это круто!', '100% процедурно!', 'Не копай вниз!', 'Ещё один блок…'];