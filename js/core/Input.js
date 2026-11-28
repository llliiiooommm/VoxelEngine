import { SENS, $, body } from '../utils/Constants.js';
import { player } from '../entities/Player.js';
import { state, fallbackLook, setState, enableFallback, lockPointer, selectSlot, selectedSlot, inventory, SPLASHES, openInventory, closeInventory, dropItemFromSlot, dropItemFromCursor, getHoverSlot } from '../ui/UI.js';
import { dayTime } from '../world/Sky.js';
import { renderDist, setRenderDist } from '../world/World.js';

export const keys = new Set();
export const inputState = { lastSpace: 0, lastW: 0, mouseHeld: -1, holdT: 0 };

function safeBind(id, event, handler) { const el = document.getElementById(id); if (el) el.addEventListener(event, handler); }

export function setupInput(canvas, callbacks) {
  document.addEventListener('pointerlockerror', enableFallback);
  document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement === canvas) { if (state !== 'playing') callbacks.setState('playing'); } else if (state === 'playing' && !fallbackLook) { callbacks.setState('paused'); } });
  safeBind('btn-resume', 'click', callbacks.startPlaying);
  safeBind('btn-save-pause', 'click', callbacks.onSaveGame);
  safeBind('btn-settings-pause', 'click', callbacks.onOpenSettings);
  safeBind('btn-quit-to-menu', 'click', () => { if (document.pointerLockElement) document.exitPointerLock(); callbacks.setState('menu'); });
  const splashEl = $('#splash');
  if (splashEl) splashEl.textContent = SPLASHES[Math.random() * SPLASHES.length | 0];
  addEventListener('mousemove', e => { if (state !== 'playing' || (!document.pointerLockElement && !fallbackLook)) return; const sens = callbacks.getSensitivity ? callbacks.getSensitivity() : SENS; player.yaw -= e.movementX * sens; player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch - e.movementY * sens)); });
  canvas.addEventListener('mousedown', e => { if (state !== 'playing') return; e.preventDefault(); if (!document.pointerLockElement && !fallbackLook) { callbacks.lockPointer(); return; } callbacks.onAction(e.button); if (e.button !== 1) { inputState.mouseHeld = e.button; inputState.holdT = 0; } });
  addEventListener('mouseup', e => { if (e.button === inputState.mouseHeld) inputState.mouseHeld = -1; });
  addEventListener('contextmenu', e => { if (state === 'playing') e.preventDefault(); });
  addEventListener('wheel', e => { if (state !== 'playing') return; e.preventDefault(); selectSlot(selectedSlot + Math.sign(e.deltaY)); }, { passive: false });
  addEventListener('blur', () => { keys.clear(); inputState.mouseHeld = -1; inputState.holdT = 0; });
  addEventListener('keydown', e => {
    if (e.code === 'F3') { e.preventDefault(); if (state !== 'menu') callbacks.onToggleDebug(); return; }
    if (state === 'inventory') {
      if (e.key === 'e' || e.key === 'E' || e.key === 'Escape') { e.preventDefault(); closeInventory(canvas); return; }
      if (e.key === 'q' || e.key === 'Q') { e.preventDefault(); if (e.ctrlKey) { const hs = getHoverSlot(); if (hs !== null && inventory[hs] !== 0) { inventory[hs] = 0; delete inventory[hs + '_count']; } } else { dropItemFromSlot(); } dropItemFromCursor(); return; }
      if (/^Digit[1-9]$/.test(e.code)) { const num = parseInt(e.code.slice(5)); if (num >= 1 && num <= 9) selectedSlot = num - 1; }
      return;
    }
    if (state === 'settings') { if (e.code === 'Escape') { e.preventDefault(); callbacks.returnFromSettings(); } return; }
    if (state !== 'playing') return;
    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    if (e.repeat) return;
    const now = performance.now();
    if (e.code === 'Space') { if (now - inputState.lastSpace < 280) { callbacks.onToggleFly(); inputState.lastSpace = 0; } else inputState.lastSpace = now; }
    if (e.code === 'KeyF') callbacks.onToggleFly();
    if (e.code === 'KeyE') { callbacks.onOpenInventory(); if (document.pointerLockElement) document.exitPointerLock(); }
    if (e.code === 'Escape' && fallbackLook) callbacks.setState('paused');
    if (/^Digit[1-9]$/.test(e.code)) selectSlot(+e.code.slice(5) - 1);
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('resize', callbacks.onResize);
}