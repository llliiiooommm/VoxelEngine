import { SENS, $, body } from '../utils/Constants.js';
import { player } from '../entities/Player.js';
import { state, fallbackLook, setState, enableFallback, lockPointer, selectSlot, sel, SPLASHES } from '../ui/UI.js';
import { dayTime } from '../world/Sky.js';
import { renderDist, setRenderDist } from '../world/World.js';

export const keys = new Set();
export const inputState = { lastSpace: 0, lastW: 0, mouseHeld: -1, holdT: 0 };

function safeBind(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
}

export function setupInput(canvas, callbacks) {
    document.addEventListener('pointerlockerror', enableFallback);
    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement === canvas) { 
            if (state !== 'playing') callbacks.setState('playing'); 
        } else if (state === 'playing' && !fallbackLook) { 
            callbacks.setState('paused'); 
        }
    });

    safeBind('btn-resume', 'click', callbacks.startPlaying);
    safeBind('btn-save-pause', 'click', callbacks.onSaveGame);
    safeBind('btn-settings-pause', 'click', callbacks.onOpenSettings);
    safeBind('btn-quit-to-menu', 'click', () => { 
        if (document.pointerLockElement) document.exitPointerLock(); 
        callbacks.setState('menu'); 
    });

    const DISTS = [4, 6, 8, 10, 12];
    document.querySelectorAll('.btn-dist').forEach(b => {
        b.onclick = () => {
            const idx = DISTS.indexOf(renderDist);
            const next = DISTS[(idx + 1) % DISTS.length];
            callbacks.setRenderDist(next);
            document.querySelectorAll('.btn-dist').forEach(x => x.textContent = `Дальность: ${next}`);
        };
    });

    const splashEl = $('#splash');
    if (splashEl) splashEl.textContent = SPLASHES[Math.random() * SPLASHES.length | 0];

    addEventListener('mousemove', e => {
        if (state !== 'playing' || (!document.pointerLockElement && !fallbackLook)) return;
        const sens = callbacks.getSensitivity ? callbacks.getSensitivity() : SENS;
        player.yaw -= e.movementX * sens;
        player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch - e.movementY * sens));
    });

    canvas.addEventListener('mousedown', e => {
        if (state !== 'playing') return;
        e.preventDefault();
        if (!document.pointerLockElement && !fallbackLook) { 
            callbacks.lockPointer(); 
            return; 
        }
        callbacks.onAction(e.button);
        if (e.button !== 1) { 
            inputState.mouseHeld = e.button; 
            inputState.holdT = 0; 
        }
    });

    addEventListener('mouseup', e => { 
        if (e.button === inputState.mouseHeld) inputState.mouseHeld = -1; 
    });
    
    addEventListener('contextmenu', e => e.preventDefault());
    
    addEventListener('wheel', e => { 
        if (state !== 'playing') return; 
        e.preventDefault(); 
        selectSlot(sel + Math.sign(e.deltaY)); 
    }, { passive: false });

    addEventListener('blur', () => keys.clear());

    addEventListener('keydown', e => {
        if (e.code === 'F3') { 
            e.preventDefault(); 
            if (state !== 'menu') callbacks.onToggleDebug(); 
            return; 
        }
        
        if (state === 'inventory' || state === 'settings') {
            if (e.code === 'KeyE' || e.code === 'Escape') { 
                e.preventDefault(); 
                if (state === 'settings') {
                    if (document.pointerLockElement) callbacks.setState('paused');
                    else callbacks.setState('menu');
                } else {
                    callbacks.startPlaying();
                }
            }
            else if (/^Digit[1-9]$/.test(e.code) && state === 'inventory') {
                selectSlot(+e.code.slice(5) - 1);
            }
            return;
        }

        if (state !== 'playing') return;
        
        if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code)) e.preventDefault();
        keys.add(e.code);
        if (e.repeat) return;
        
        const now = performance.now();
        if (e.code === 'Space') { 
            if (now - inputState.lastSpace < 280) { 
                callbacks.onToggleFly(); 
                inputState.lastSpace = 0; 
            } else inputState.lastSpace = now; 
        }
        if (e.code === 'KeyF') callbacks.onToggleFly();
        if (e.code === 'KeyE') { 
            callbacks.setState('inventory'); 
            if (document.pointerLockElement) document.exitPointerLock(); 
        }
        if (e.code === 'Escape' && fallbackLook) callbacks.setState('paused');
        if (/^Digit[1-9]$/.test(e.code)) selectSlot(+e.code.slice(5) - 1);
    });

    addEventListener('keyup', e => keys.delete(e.code));
    
    addEventListener('resize', callbacks.onResize);
}