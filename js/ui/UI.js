import { $, body } from '../utils/Constants.js';
import { BL } from '../world/Blocks.js';
import { icons } from '../utils/Textures.js';
import { DIRS } from '../utils/Constants.js';
import { chunks } from '../world/World.js';
import { player } from '../entities/Player.js';
import { dayTime } from '../world/Sky.js';

export const inventory = new Array(46).fill(0);
[1, 2, 3, 4, 6, 5, 10, 12, 18].forEach((id, i) => { inventory[37 + i] = id; });

export let selectedSlot = 0;
export let state = 'menu', fallbackLook = false;
let _debugOn = false;
let nameTimer = 0;
let previousState = 'menu';

let cursorItem = null;
let dragEl = null;
let dragTargetX = 0, dragTargetY = 0;
let dragCurrentX = 0, dragCurrentY = 0;
let hoverSlot = null;
let tooltip = null;
let lastClickTime = 0;
let lastClickSlot = null;

const MAX_STACK = 64;

export function getDebugOn() { return _debugOn; }
export function setDebugOn(v) { _debugOn = v; }
export function getPreviousState() { return previousState; }

const SCREEN_MAP = { menu: 'main-menu', worlds: 'worlds-screen', settings: 'settings-screen', paused: 'pause-screen', inventory: 'inventory' };

function toggleScreen(screenId, visible) { const el = document.getElementById(screenId); if (el) el.hidden = !visible; }

export function renderHotbar() {
  const hotbarEl = $('#hotbar');
  if (!hotbarEl) return;
  hotbarEl.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const id = inventory[37 + i];
    const slot = document.createElement('div');
    slot.className = 'slot' + (i === selectedSlot ? ' sel' : '');
    slot.dataset.slot = 37 + i;
    if (id) slot.innerHTML = `<img src="${icons[id]}"><span class="num">${i + 1}</span>`;
    else slot.innerHTML = `<span class="num">${i + 1}</span>`;
    hotbarEl.appendChild(slot);
  }
}

export function renderInventory() {
  const container = $('#inv-container');
  if (!container) return;
  container.innerHTML = `
    <div class="inv-window">
      <div class="inv-top">
        <div class="inv-player">
          <div class="armor-slots">
            <div class="inv-slot armor-slot" data-slot="0"><span class="slot-hint">🪖</span></div>
            <div class="inv-slot armor-slot" data-slot="1"><span class="slot-hint">👕</span></div>
            <div class="inv-slot armor-slot" data-slot="2"><span class="slot-hint">👖</span></div>
            <div class="inv-slot armor-slot" data-slot="3"><span class="slot-hint">👢</span></div>
          </div>
          <div class="inv-slot offhand-slot" data-slot="4"><span class="slot-hint">🛡️</span></div>
        </div>
        <div class="inv-craft">
          <div class="craft-grid">
            <div class="inv-slot craft-slot" data-slot="5"></div>
            <div class="inv-slot craft-slot" data-slot="6"></div>
            <div class="inv-slot craft-slot" data-slot="7"></div>
            <div class="inv-slot craft-slot" data-slot="8"></div>
          </div>
          <div class="craft-arrow">→</div>
          <div class="inv-slot craft-result" data-slot="9"></div>
        </div>
      </div>
      <div class="inv-main" id="inv-main-grid"></div>
      <div class="inv-hotbar" id="inv-hotbar-grid"></div>
    </div>`;
  const mainGrid = $('#inv-main-grid');
  for (let i = 10; i < 37; i++) mainGrid.appendChild(createSlotElement(i));
  const hotbarGrid = $('#inv-hotbar-grid');
  for (let i = 37; i < 46; i++) hotbarGrid.appendChild(createSlotElement(i));
  updateInventoryVisuals();
}

function createSlotElement(idx) {
  const slot = document.createElement('div');
  slot.className = 'inv-slot';
  slot.dataset.slot = idx;
  const id = inventory[idx];
  if (id) slot.innerHTML = `<img src="${icons[id]}">`;
  return slot;
}

function getSlotCount(idx) { return inventory[idx + '_count'] || (inventory[idx] ? 1 : 0); }
function setSlotCount(idx, count) {
  if (count <= 0) { inventory[idx] = 0; delete inventory[idx + '_count']; }
  else inventory[idx + '_count'] = count;
}

function updateInventoryVisuals() {
  document.querySelectorAll('.inv-slot').forEach(el => {
    const idx = parseInt(el.dataset.slot);
    const id = inventory[idx];
    const hint = el.querySelector('.slot-hint');
    const count = getSlotCount(idx);
    if (id) el.innerHTML = `<img src="${icons[id]}">${count > 1 ? `<span class="count">${count}</span>` : ''}`;
    else if (hint) el.innerHTML = hint.outerHTML;
    else el.innerHTML = '';
    el.classList.toggle('hovered', hoverSlot === idx);
  });
  renderHotbar();
}

function createDragGhost(id, count) {
  removeDragGhost();
  dragEl = document.createElement('div');
  dragEl.id = 'cursor-ghost';
  dragEl.innerHTML = `<img src="${icons[id]}">${count > 1 ? `<span class="count">${count}</span>` : ''}`;
  document.body.appendChild(dragEl);
  dragTargetX = dragCurrentX = (window.mouseX || 0) - 20;
  dragTargetY = dragCurrentY = (window.mouseY || 0) - 20;
  updateDragPosition();
}

function removeDragGhost() { if (dragEl) { dragEl.remove(); dragEl = null; } }

function updateDragPosition() {
  if (!dragEl) return;
  const dx = dragTargetX - dragCurrentX;
  const dy = dragTargetY - dragCurrentY;
  dragCurrentX += dx * 0.25;
  dragCurrentY += dy * 0.25;
  dragEl.style.transform = `translate(${dragCurrentX}px, ${dragCurrentY}px)`;
  if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) requestAnimationFrame(updateDragPosition);
}

window.addEventListener('mousemove', (e) => {
  window.mouseX = e.clientX;
  window.mouseY = e.clientY;
  if (state === 'inventory') {
    dragTargetX = e.clientX - 20;
    dragTargetY = e.clientY - 20;
    updateDragPosition();
    updateHoverSlot();
  }
});

document.addEventListener('mousedown', (e) => {
  if (state !== 'inventory') return;
  if (e.button === 0) handleLeftClick(e);
  else if (e.button === 2) handleRightClick(e);
});

document.addEventListener('contextmenu', (e) => { if (state === 'inventory') e.preventDefault(); });

function updateHoverSlot() {
  const slot = document.elementFromPoint(window.mouseX, window.mouseY)?.closest('.inv-slot');
  const newHover = slot ? parseInt(slot.dataset.slot) : null;
  if (newHover !== hoverSlot) { hoverSlot = newHover; updateInventoryVisuals(); updateTooltip(); }
}

function updateTooltip() {
  removeTooltip();
  if (hoverSlot === null) return;
  const id = inventory[hoverSlot];
  if (!id) return;
  const tt = document.createElement('div');
  tt.className = 'inv-tooltip';
  const count = getSlotCount(hoverSlot);
  tt.innerHTML = `<div class="tooltip-name">${BL[id].n}</div>${count > 1 ? `<div class="tooltip-count">×${count}</div>` : ''}`;
  document.body.appendChild(tt);
  tooltip = tt;
  positionTooltip();
}

function positionTooltip() { if (!tooltip) return; tooltip.style.left = (window.mouseX + 15) + 'px'; tooltip.style.top = (window.mouseY + 15) + 'px'; }
function removeTooltip() { if (tooltip) { tooltip.remove(); tooltip = null; } }

function handleLeftClick(e) {
  const slot = e.target.closest('.inv-slot');
  if (!slot) return;
  const idx = parseInt(slot.dataset.slot);
  const id = inventory[idx];
  const count = getSlotCount(idx);
  const now = Date.now();
  if (now - lastClickTime < 300 && lastClickSlot === idx && id !== 0 && !cursorItem) { collectAllItems(id); lastClickTime = 0; return; }
  lastClickTime = now; lastClickSlot = idx;
  if (cursorItem === null) {
    if (id !== 0) { cursorItem = { id, count }; setSlotCount(idx, 0); createDragGhost(id, count); slot.classList.add('slot-pop'); setTimeout(() => slot.classList.remove('slot-pop'), 150); }
  } else {
    if (id === 0) { inventory[idx] = cursorItem.id; setSlotCount(idx, cursorItem.count); cursorItem = null; removeDragGhost(); slot.classList.add('slot-drop'); setTimeout(() => slot.classList.remove('slot-drop'), 200); }
    else if (id === cursorItem.id) {
      const newCount = count + cursorItem.count;
      if (newCount <= MAX_STACK) { setSlotCount(idx, newCount); cursorItem = null; removeDragGhost(); }
      else { const space = MAX_STACK - count; setSlotCount(idx, MAX_STACK); cursorItem.count -= space; createDragGhost(cursorItem.id, cursorItem.count); }
    }
    else { const tempId = inventory[idx]; const tempCount = count; inventory[idx] = cursorItem.id; setSlotCount(idx, cursorItem.count); cursorItem = { id: tempId, count: tempCount }; createDragGhost(tempId, tempCount); slot.classList.add('slot-swap'); setTimeout(() => slot.classList.remove('slot-swap'), 200); }
  }
  updateInventoryVisuals();
}

function handleRightClick(e) {
  const slot = e.target.closest('.inv-slot');
  if (!slot) return;
  const idx = parseInt(slot.dataset.slot);
  const id = inventory[idx];
  const count = getSlotCount(idx);
  if (cursorItem === null) {
    if (id !== 0) { const takeCount = Math.ceil(count / 2); cursorItem = { id, count: takeCount }; setSlotCount(idx, count - takeCount); createDragGhost(id, takeCount); }
  } else {
    if (id === 0) { inventory[idx] = cursorItem.id; setSlotCount(idx, 1); cursorItem.count--; if (cursorItem.count <= 0) { cursorItem = null; removeDragGhost(); } else createDragGhost(cursorItem.id, cursorItem.count); }
    else if (id === cursorItem.id && count < MAX_STACK) { setSlotCount(idx, count + 1); cursorItem.count--; if (cursorItem.count <= 0) { cursorItem = null; removeDragGhost(); } else createDragGhost(cursorItem.id, cursorItem.count); }
  }
  updateInventoryVisuals();
}

function collectAllItems(targetId) {
  let total = 0;
  for (let i = 10; i < 46; i++) { if (inventory[i] === targetId && i !== hoverSlot) { total += getSlotCount(i); setSlotCount(i, 0); } }
  if (total > 0) {
    if (cursorItem && cursorItem.id === targetId) cursorItem.count += total;
    else cursorItem = { id: targetId, count: total };
    if (cursorItem.count > MAX_STACK) {
      const excess = cursorItem.count - MAX_STACK;
      cursorItem.count = MAX_STACK;
      for (let i = 10; i < 46; i++) { if (inventory[i] === 0) { inventory[i] = targetId; setSlotCount(i, excess); break; } }
    }
    createDragGhost(cursorItem.id, cursorItem.count);
    updateInventoryVisuals();
  }
}

export function openInventory(canvas) { previousState = state === 'playing' ? 'playing' : 'paused'; setState('inventory', canvas); }

export function closeInventory(canvas) {
  if (cursorItem) {
    let placed = false;
    for (let i = 10; i < 46; i++) {
      if (inventory[i] === 0) { inventory[i] = cursorItem.id; setSlotCount(i, cursorItem.count); placed = true; break; }
      else if (inventory[i] === cursorItem.id && getSlotCount(i) < MAX_STACK) {
        const space = MAX_STACK - getSlotCount(i);
        const toPlace = Math.min(space, cursorItem.count);
        setSlotCount(i, getSlotCount(i) + toPlace);
        cursorItem.count -= toPlace;
        if (cursorItem.count <= 0) { placed = true; break; }
      }
    }
    cursorItem = null;
    removeDragGhost();
  }
  hoverSlot = null;
  removeTooltip();
  setState(previousState, canvas);
}

export function dropItemFromSlot() {
  if (hoverSlot !== null && inventory[hoverSlot] !== 0) { inventory[hoverSlot] = 0; delete inventory[hoverSlot + '_count']; updateInventoryVisuals(); }
}

export function dropItemFromCursor() {
  if (cursorItem) { cursorItem = null; removeDragGhost(); }
}

export function selectSlot(i) {
  selectedSlot = ((i % 9) + 9) % 9;
  renderHotbar();
  const el = $('#item-name');
  if (el) { const id = inventory[37 + selectedSlot]; el.textContent = id ? BL[id].n : ''; el.classList.add('show'); clearTimeout(nameTimer); nameTimer = setTimeout(() => el.classList.remove('show'), 1400); }
}

export function setState(s, canvas) {
  state = s;
  Object.values(SCREEN_MAP).forEach(id => toggleScreen(id, false));
  if (SCREEN_MAP[s]) toggleScreen(SCREEN_MAP[s], true);
  body.classList.toggle('in-game', s !== 'menu' && s !== 'settings' && s !== 'worlds' && s !== 'inventory');
  body.classList.toggle('playing', s === 'playing');
  if (s === 'playing' && canvas) { try { if (document.pointerLockElement !== canvas) canvas.requestPointerLock(); } catch(e){} }
  else if (s !== 'playing' && document.pointerLockElement) document.exitPointerLock();
  if (s === 'inventory') { renderInventory(); document.body.style.cursor = 'default'; }
  else document.body.style.cursor = s === 'playing' ? 'none' : 'default';
}

export function enableFallback() { fallbackLook = true; body.classList.add('fallback'); if (state !== 'playing') setState('playing'); }
export function lockPointer(canvas) { if (fallbackLook) return; try { if (!canvas.requestPointerLock) { enableFallback(); return; } const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => enableFallback()); } catch { enableFallback(); } }

export function updateDebug(fps, target, SEED) {
  if (!_debugOn) return;
  const p = player.pos, tw = Math.PI * 2;
  const dir = DIRS[Math.round((((player.yaw % tw) + tw) % tw) / (Math.PI / 2)) % 4];
  const hours = (6 + dayTime * 24) % 24;
  const hh = String(Math.floor(hours)).padStart(2, '0');
  const mm = String(Math.floor((hours % 1) * 60)).padStart(2, '0');
  let meshes = 0; for (const c of chunks.values()) if (c.mesh) meshes++;
  const lines = [`VoxelEngine 1.0 · ${fps} FPS`, `XYZ: ${p.x.toFixed(2)} / ${p.y.toFixed(2)} / ${p.z.toFixed(2)}`, `Блок: ${Math.floor(p.x)} ${Math.floor(p.y)} ${Math.floor(p.z)}`, `Чанк: ${Math.floor(p.x/16)} ${Math.floor(p.z/16)}`, `Смотрит на: ${dir}`, `Время: ${hh}:${mm}`, `Чанков: ${chunks.size} · мешей: ${meshes}`, `Сид: ${SEED}`, target ? `Цель: ${BL[target.id].n} (${target.x} ${target.y} ${target.z})` : 'Цель: —'];
  const debugEl = $('#debug');
  if (debugEl) debugEl.innerHTML = lines.map(l => `<span>${l}</span>`).join('');
}

export const SPLASHES = ['Почти как оригинал!', 'Теперь с облаками!', 'Квадратное — это круто!', '100% процедурно!', 'Не копай вниз!', 'Ещё один блок…'];
export function getHoverSlot() { return hoverSlot; }