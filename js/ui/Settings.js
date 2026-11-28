import { saveManager } from '../core/SaveManager.js';
import { soundManager } from '../core/SoundManager.js';
import { setRenderDist } from '../world/World.js';

const DEFAULTS = { renderDist: 6, mouseSens: 0.0022, fov: 75, showDebug: false, language: 'ru', volumeMaster: 0.7, volumeSfx: 0.8, volumeAmbient: 0.4, keyBindings: { KeyW: 'вперёд', KeyS: 'назад', KeyA: 'влево', KeyD: 'вправо', Space: 'прыжок', ShiftLeft: 'красться', ControlLeft: 'бег', KeyE: 'инвентарь', Digit1: 'слот 1', Digit2: 'слот 2', Digit3: 'слот 3', Digit4: 'слот 4', Digit5: 'слот 5', Digit6: 'слот 6', Digit7: 'слот 7', Digit8: 'слот 8', Digit9: 'слот 9' } };
let settings = { ...DEFAULTS };
let tempBindings = {};

export async function loadSettings() { try { for (const key of Object.keys(DEFAULTS)) { const val = await saveManager.getSetting(key, DEFAULTS[key]); settings[key] = val; } applySettings(); } catch (e) { console.warn('Не удалось загрузить настройки', e); } }
export async function saveCurrentSettings() { settings.keyBindings = { ...tempBindings }; for (const key of Object.keys(settings)) { try { await saveManager.setSetting(key, settings[key]); } catch (e) { console.error(e); } } applySettings(); }
export function resetToDefaults() { settings = JSON.parse(JSON.stringify(DEFAULTS)); tempBindings = { ...settings.keyBindings }; renderSettingsScreen(); applySettings(); }
function applySettings() { document.documentElement.style.setProperty('--render-dist', settings.renderDist); setRenderDist(settings.renderDist); soundManager.setVolume('master', settings.volumeMaster); soundManager.setVolume('sfx', settings.volumeSfx); soundManager.setVolume('ambient', settings.volumeAmbient); }
export function getSetting(key) { return settings[key]; }

export function renderSettingsScreen() {
  const container = document.getElementById('settings-content');
  if (!container) return;
  tempBindings = { ...settings.keyBindings };
  let html = `<h3 style="color:#fff;font-size:10px;margin:0 0 12px;width:100%">Графика</h3>`;
  html += `<div class="setting-row"><label>Дальность прорисовки</label><input type="range" id="opt-renderDist" min="4" max="16" step="2" value="${settings.renderDist}"><span id="val-renderDist">${settings.renderDist}</span></div>`;
  html += `<div class="setting-row"><label>Поле зрения (FOV)</label><input type="range" id="opt-fov" min="60" max="110" step="5" value="${settings.fov}"><span id="val-fov">${settings.fov}</span></div>`;
  html += `<h3 style="color:#fff;font-size:10px;margin:16px 0 12px;width:100%">Звук</h3>`;
  html += `<div class="setting-row"><label>Общая громкость</label><input type="range" id="opt-volumeMaster" min="0" max="1" step="0.05" value="${settings.volumeMaster}"><span id="val-volumeMaster">${Math.round(settings.volumeMaster*100)}%</span></div>`;
  html += `<div class="setting-row"><label>Эффекты</label><input type="range" id="opt-volumeSfx" min="0" max="1" step="0.05" value="${settings.volumeSfx}"><span id="val-volumeSfx">${Math.round(settings.volumeSfx*100)}%</span></div>`;
  html += `<div class="setting-row"><label>Фоновые звуки</label><input type="range" id="opt-volumeAmbient" min="0" max="1" step="0.05" value="${settings.volumeAmbient}"><span id="val-volumeAmbient">${Math.round(settings.volumeAmbient*100)}%</span></div>`;
  html += `<h3 style="color:#fff;font-size:10px;margin:16px 0 12px;width:100%">Управление</h3>`;
  html += `<div class="setting-row"><label>Чувствительность мыши</label><input type="range" id="opt-mouseSens" min="0.001" max="0.01" step="0.0001" value="${settings.mouseSens}"><span id="val-mouseSens">${(settings.mouseSens * 1000).toFixed(1)}</span></div>`;
  for (const [code, action] of Object.entries(tempBindings)) html += `<div class="key-bind-row"><span>${action}</span><button class="key-bind-btn" data-code="${code}">${code}</button></div>`;
  container.innerHTML = html;
  document.getElementById('opt-renderDist').oninput = (e) => { const v = parseInt(e.target.value); document.getElementById('val-renderDist').textContent = v; settings.renderDist = v; setRenderDist(v); };
  document.getElementById('opt-fov').oninput = (e) => { const v = parseInt(e.target.value); document.getElementById('val-fov').textContent = v; settings.fov = v; };
  document.getElementById('opt-volumeMaster').oninput = (e) => { const v = parseFloat(e.target.value); document.getElementById('val-volumeMaster').textContent = Math.round(v*100)+'%'; settings.volumeMaster = v; soundManager.setVolume('master', v); };
  document.getElementById('opt-volumeSfx').oninput = (e) => { const v = parseFloat(e.target.value); document.getElementById('val-volumeSfx').textContent = Math.round(v*100)+'%'; settings.volumeSfx = v; soundManager.setVolume('sfx', v); };
  document.getElementById('opt-volumeAmbient').oninput = (e) => { const v = parseFloat(e.target.value); document.getElementById('val-volumeAmbient').textContent = Math.round(v*100)+'%'; settings.volumeAmbient = v; soundManager.setVolume('ambient', v); };
  document.getElementById('opt-mouseSens').oninput = (e) => { const v = parseFloat(e.target.value); document.getElementById('val-mouseSens').textContent = (v * 1000).toFixed(1); settings.mouseSens = v; };
  container.querySelectorAll('.key-bind-btn').forEach(btn => { btn.onclick = () => { btn.classList.add('listening'); btn.textContent = 'Нажмите клавишу...'; const handler = (e) => { e.preventDefault(); const newCode = e.code; tempBindings[newCode] = tempBindings[btn.dataset.code]; delete tempBindings[btn.dataset.code]; btn.dataset.code = newCode; btn.textContent = newCode; btn.classList.remove('listening'); window.removeEventListener('keydown', handler); }; window.addEventListener('keydown', handler, { once: true }); }; });
}