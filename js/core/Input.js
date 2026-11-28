import { SENS, $, body } from '../utils/Constants.js';
import { player } from '../entities/Player.js';
import { 
  state, fallbackLook, setState, enableFallback, lockPointer, 
  selectSlot, getSelectedSlot, inventory, SPLASHES, 
  openInventory, closeInventory, getHoverSlot 
} from '../ui/UI.js';
import { dayTime } from '../world/Sky.js';
import { renderDist, setRenderDist } from '../world/World.js';
import { soundManager } from './SoundManager.js';
// ИСПРАВЛЕНИЕ: Убран импорт getKeyBindings, так как он отсутствует в Settings.js
// import { getKeyBindings } from '../ui/Settings.js'; 

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
  
  // Привязка кнопок меню паузы
  safeBind('btn-resume', 'click', () => { soundManager.playClick(); callbacks.startPlaying(); });
  safeBind('btn-save-game', 'click', () => { soundManager.playClick(); callbacks.onSaveGame(); });
  safeBind('btn-settings-pause', 'click', () => { soundManager.playClick(); callbacks.onOpenSettings(); });
  safeBind('btn-quit-to-menu', 'click', () => { 
    soundManager.playClick();
    if (document.pointerLockElement) document.exitPointerLock(); 
    callbacks.onQuitToMenu(); 
  });
  
  const splashEl = $('#splash');
  if (splashEl) splashEl.textContent = SPLASHES[Math.random() * SPLASHES.length | 0];
  
  // Управление камерой
  addEventListener('mousemove', e => { 
    if (state !== 'playing' || (!document.pointerLockElement && !fallbackLook)) return; 
    const sens = callbacks.getSensitivity ? callbacks.getSensitivity() : SENS;
    player.yaw -= e.movementX * sens; 
    player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch - e.movementY * sens)); 
  });
  
  // Действия мыши в игре
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
  
  addEventListener('contextmenu', e => { 
    if (state === 'playing') e.preventDefault(); 
  });
  
  // Колесо мыши для смены слотов
  addEventListener('wheel', e => { 
    if (state !== 'playing') return; 
    e.preventDefault(); 
    selectSlot(getSelectedSlot() + Math.sign(e.deltaY)); 
  }, { passive: false });
  
  // Сброс ввода при потере фокуса окна
  addEventListener('blur', () => { 
    keys.clear(); 
    inputState.mouseHeld = -1; 
    inputState.holdT = 0; 
  });
  
  // Обработка клавиатуры
  addEventListener('keydown', e => {
    // F3 работает везде кроме меню выбора мира
    if (e.code === 'F3') { 
      e.preventDefault(); 
      if (state !== 'menu' && state !== 'singleplayer' && state !== 'createworld' && state !== 'about') { 
        callbacks.onToggleDebug(); 
        soundManager.playClick(); 
      } 
      return; 
    }
    
    // Логика инвентаря
    if (state === 'inventory') {
      if (e.key === 'e' || e.key === 'E' || e.key === 'Escape') { 
        e.preventDefault(); 
        closeInventory(canvas); 
        soundManager.playClick(); 
        return; 
      }
      if (e.key === 'q' || e.key === 'Q') { 
        e.preventDefault(); 
        // В творческом режиме Q просто сбрасывает предмет с курсора
        dropItemFromCursor(); 
        soundManager.playClick(); 
        return; 
      }
      if (/^Digit[1-9]$/.test(e.code)) { 
        const num = parseInt(e.code.slice(5)); 
        if (num >= 1 && num <= 9) { 
          selectSlot(num - 1); 
          soundManager.playClick(); 
        } 
      }
      return;
    }
    
    // Escape в настройках или окне "О проекте"
    if (state === 'settings' || state === 'about') { 
      if (e.code === 'Escape') { 
        e.preventDefault(); 
        callbacks.returnFromSubScreen(); 
        soundManager.playClick(); 
      } 
      return; 
    }
    
    // Игровые действия
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
      callbacks.onOpenInventory(); 
      if (document.pointerLockElement) document.exitPointerLock(); 
      soundManager.playClick(); 
    }
    if (e.code === 'Escape' && fallbackLook) { 
      callbacks.setState('paused'); 
      soundManager.playClick(); 
    }
    if (/^Digit[1-9]$/.test(e.code)) { 
      selectSlot(+e.code.slice(5) - 1); 
      soundManager.playClick(); 
    }
  });

  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('resize', callbacks.onResize);
}

// Вспомогательная функция для сброса предмета с курсора (творческий режим)
export function dropItemFromCursor() {
  // В творческом режиме предметы не выбрасываются в мир, 
  // они просто исчезают с курсора или возвращаются в инвентарь при закрытии
}