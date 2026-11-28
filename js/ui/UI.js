import { $, body } from '../utils/Constants.js';
import { BL } from '../world/Blocks.js';
import { icons } from '../utils/Textures.js';
import { DIRS } from '../utils/Constants.js';
import { chunks } from '../world/World.js';
import { player } from '../entities/Player.js';
import { dayTime, getDayTime } from '../world/Sky.js';
import { soundManager } from '../core/SoundManager.js';

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
let currentCategory = 'all';
let searchQuery = '';

const CATEGORIES = {
  all: 'Все',
  building: 'Строительство',
  nature: 'Природа',
  plants: 'Растительность',
  decoration: 'Декор'
};

export function getDebugOn() { return _debugOn; }
export function setDebugOn(v) { _debugOn = v; }
export function getPreviousState() { return previousState; }
export function getSelectedSlot() { return selectedSlot; }

const SCREEN_MAP = { menu: 'main-menu', singleplayer: 'singleplayer-screen', createworld: 'create-world-screen', settings: 'settings-screen', about: 'about-screen', paused: 'pause-screen', inventory: 'inventory-screen' };

function toggleScreen(screenId, visible) {
  const el = document.getElementById(screenId);
  if (el) {
    if (visible) { el.hidden = false; requestAnimationFrame(() => el.classList.add('active')); }
    else { el.classList.remove('active'); setTimeout(() => { if (!el.classList.contains('active')) el.hidden = true; }, 300); }
  }
}

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
      <input type="text" class="inv-search" id="inv-search" placeholder="Поиск блоков...">
      <div class="inv-categories" id="inv-categories"></div>
      <div class="inv-grid" id="inv-main-grid"></div>
      <div class="inv-hotbar-inv" id="inv-hotbar-grid"></div>
    </div>`;
  const categoriesEl = $('#inv-categories');
  for (const [catKey, catName] of Object.entries(CATEGORIES)) {
    const btn = document.createElement('button');
    btn.className = 'category-btn' + (catKey === currentCategory ? ' active' : '');
    btn.textContent = catName;
    btn.dataset.category = catKey;
    btn.onclick = () => { currentCategory = catKey; renderInventory(); soundManager.playClick(); };
    categoriesEl.appendChild(btn);
  }
  const searchInput = $('#inv-search');
  searchInput.value = searchQuery;
  searchInput.oninput = (e) => { searchQuery = e.target.value.toLowerCase(); renderInventoryGrid(); };
  renderInventoryGrid();
  const hotbarGrid = $('#inv-hotbar-grid');
  for (let i = 37; i < 46; i++) hotbarGrid.appendChild(createSlotElement(i));
  updateInventoryVisuals();
}

function renderInventoryGrid() {
  const mainGrid = $('#inv-main-grid');
  if (!mainGrid) return;
  mainGrid.innerHTML = '';
  for (let id = 1; id < BL.length; id++) {
    const b = BL[id];
    if (currentCategory !== 'all' && b.category !== currentCategory) continue;
    if (searchQuery && !b.n.toLowerCase().includes(searchQuery)) continue;
    mainGrid.appendChild(createSlotElement(id, true));
  }
}

function createSlotElement(id, isCatalog = false) {
  const slot = document.createElement('div');
  slot.className = 'inv-slot';
  if (isCatalog) {
    slot.dataset.catalogId = id;
  } else {
    slot.dataset.slot = id;
  }
  if (id && BL[id]) slot.innerHTML = `<img src="${icons[id]}">`;
  return slot;
}

function updateInventoryVisuals() {
  document.querySelectorAll('.inv-slot[data-slot]').forEach(el => {
    const idx = parseInt(el.dataset.slot);
    const id = inventory[idx];
    if (id && BL[id]) el.innerHTML = `<img src="${icons[id]}">`;
    else el.innerHTML = '';
    el.classList.toggle('hovered', hoverSlot === idx);
  });
  renderHotbar();
}

function createDragGhost(id, count) {
  removeDragGhost();
  dragEl = document.createElement('div');
  dragEl.id = 'cursor-ghost';
  dragEl.innerHTML = `<img src="${icons[id]}">`;
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
  if (!id || !BL[id]) return;
  const tt = document.createElement('div');
  tt.className = 'inv-tooltip';
  tt.innerHTML = `<div class="tooltip-name">${BL[id].n}</div><div class="tooltip-category">${CATEGORIES[BL[id].category] || 'Прочее'}</div>`;
  document.body.appendChild(tt);
  tooltip = tt;
  positionTooltip();
}

function positionTooltip() { if (!tooltip) return; tooltip.style.left = (window.mouseX + 15) + 'px'; tooltip.style.top = (window.mouseY + 15) + 'px'; }
function removeTooltip() { if (tooltip) { tooltip.remove(); tooltip = null; } }

function handleLeftClick(e) {
  const slot = e.target.closest('.inv-slot');
  if (!slot) return;
  const catalogId = slot.dataset.catalogId ? parseInt(slot.dataset.catalogId) : null;
  const slotIdx = slot.dataset.slot ? parseInt(slot.dataset.slot) : null;
  if (catalogId) {
    inventory[37 + selectedSlot] = catalogId;
    renderHotbar();
    soundManager.playClick();
    const el = $('#item-name');
    if (el) { el.textContent = BL[catalogId].n; el.classList.add('show'); clearTimeout(nameTimer); nameTimer = setTimeout(() => el.classList.remove('show'), 1400); }
  } else if (slotIdx !== null) {
    const id = inventory[slotIdx];
    if (cursorItem === null) {
      if (id !== 0) { cursorItem = { id }; inventory[slotIdx] = 0; createDragGhost(id); soundManager.playClick(); }
    } else {
      if (id === 0) { inventory[slotIdx] = cursorItem.id; cursorItem = null; removeDragGhost(); soundManager.playClick(); }
      else { const temp = inventory[slotIdx]; inventory[slotIdx] = cursorItem.id; cursorItem = { id: temp }; createDragGhost(temp); soundManager.playClick(); }
    }
    updateInventoryVisuals();
  }
}

function handleRightClick(e) {
  const slot = e.target.closest('.inv-slot');
  if (!slot) return;
  const slotIdx = slot.dataset.slot ? parseInt(slot.dataset.slot) : null;
  if (slotIdx !== null) {
    const id = inventory[slotIdx];
    if (cursorItem === null) {
      if (id !== 0) { cursorItem = { id }; inventory[slotIdx] = 0; createDragGhost(id); soundManager.playClick(); }
    } else {
      if (id === 0 || id === cursorItem.id) { inventory[slotIdx] = cursorItem.id; cursorItem = null; removeDragGhost(); soundManager.playClick(); }
    }
    updateInventoryVisuals();
  }
}

export function openInventory(canvas) { previousState = state === 'playing' ? 'playing' : 'paused'; setState('inventory', canvas); }

export function closeInventory(canvas) {
  if (cursorItem) {
    let placed = false;
    for (let i = 37; i < 46; i++) {
      if (inventory[i] === 0) { inventory[i] = cursorItem.id; placed = true; break; }
    }
    if (!placed) {
      for (let i = 10; i < 37; i++) {
        if (inventory[i] === 0) { inventory[i] = cursorItem.id; placed = true; break; }
      }
    }
    cursorItem = null;
    removeDragGhost();
  }
  hoverSlot = null;
  removeTooltip();
  setState(previousState, canvas);
}

export function selectSlot(i) {
  selectedSlot = ((i % 9) + 9) % 9;
  renderHotbar();
  const el = $('#item-name');
  if (el) { const id = inventory[37 + selectedSlot]; el.textContent = id && BL[id] ? BL[id].n : ''; el.classList.add('show'); clearTimeout(nameTimer); nameTimer = setTimeout(() => el.classList.remove('show'), 1400); }
}

export function setState(s, canvas) {
  state = s;
  Object.values(SCREEN_MAP).forEach(id => toggleScreen(id, false));
  if (SCREEN_MAP[s]) toggleScreen(SCREEN_MAP[s], true);
  body.classList.toggle('in-game', s !== 'menu' && s !== 'settings' && s !== 'singleplayer' && s !== 'createworld' && s !== 'about' && s !== 'inventory');
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