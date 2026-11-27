import * as THREE from 'https://esm.sh/three@0.170.0';
THREE.ColorManagement.enabled = false;
import { $, SEA, baseFov, DAY_LEN } from './utils/Constants.js';
import { regenerateNoise, SEED, heightAt } from './utils/Noise.js';
import { atlasTex } from './utils/Textures.js';
import { chunks, key, getBlock, setBlock, updateChunks, setRenderDist } from './world/World.js';
import { generate, buildMesh } from './world/Chunk.js';
import { SOLID } from './world/Blocks.js';
import { player, updatePlayer, getBob, getBobAmp, setBobAmp } from './entities/Player.js';
import { raycast, doAction } from './core/Actions.js';
import { spawnParticles, updateParticles } from './world/Particles.js';
import { initSky, updateSky, dayTime, cloudDrift, setDayTime, setCloudDrift, getCloudDrift } from './world/Sky.js';
import { initHand, updateHand, handScene, handCam, handMat, setSwingT } from './entities/Hand.js';
import { slots, sel, selectSlot, renderHotbar, state, getDebugOn, setDebugOn, setState, lockPointer, updateDebug, SPLASHES } from './ui/UI.js';
import { keys, inputState, setupInput } from './core/Input.js';
import { saveManager } from './core/SaveManager.js';
import { loadSettings, getSetting, renderSettingsScreen, saveCurrentSettings, resetToDefaults } from './ui/Settings.js';
import { soundManager } from './core/SoundManager.js';

const canvas = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.autoClear = false;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x78a7ff, 50, 90);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 1200);
camera.rotation.order = 'YXZ';
const worldMat = new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true, alphaTest: 0.5 });
const waterMat = new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide });
const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 }));
outline.visible = false; scene.add(outline);
initHand(scene, camera, atlasTex);
const skyObjs = initSky(scene, camera);
let target = null;
const tmpDir = new THREE.Vector3();
let currentWorldName = null;
let worldAlreadySaved = false;
let autoSaveTimer = 0;
let previousState = 'menu';

function updateTarget() {
  if (state !== 'playing' && state !== 'paused') { outline.visible = false; target = null; return; }
  camera.getWorldDirection(tmpDir);
  target = raycast(camera.position, tmpDir, 5);
  outline.visible = !!target;
  if (target) outline.position.set(target.x + .5, target.y + .5, target.z + .5);
}

let spawn = { x: 0.5, z: 0.5 };
function surfaceY(x, z) { for (let y = 95; y >= 0; y--) if (SOLID[getBlock(x, y, z)]) return y + 1; return SEA + 2; }
function respawn() { const p = player.pos; p.set(spawn.x, 0, spawn.z); p.y = surfaceY(Math.floor(spawn.x), Math.floor(spawn.z)); player.vel.set(0, 0, 0); player.flying = false; }

async function initWorld(newSeed, worldName = null, savedData = null) {
  if (newSeed) { const newS = (Math.random() * 1e9) | 0; regenerateNoise(newS); }
  if (savedData && savedData.seed) { regenerateNoise(savedData.seed); }
  for (const c of chunks.values()) { if (c.mesh) { scene.remove(c.mesh); c.mesh.geometry.dispose(); } if (c.water) { scene.remove(c.water); c.water.geometry.dispose(); } }
  chunks.clear();
  for (let r = 0; r < 400; r += 8) for (let a = 0; a < 8; a++) {
    const x = Math.round(Math.cos(a * Math.PI / 4) * r), z = Math.round(Math.sin(a * Math.PI / 4) * r);
    const h = heightAt(x, z);
    if (h > SEA + 1 && h < SEA + 22) { spawn = { x: x + .5, z: z + .5 }; r = 400; break; }
    if (r === 0) break;
  }
  const cx = Math.floor(spawn.x / 16), cz = Math.floor(spawn.z / 16);
  for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) generate(cx + dx, cz + dz, chunks, key);
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) buildMesh(chunks.get(key(cx + dx, cz + dz)), chunks, key, worldMat, waterMat, scene);
  if (savedData && savedData.playerPos) {
    player.pos.set(savedData.playerPos.x, savedData.playerPos.y, savedData.playerPos.z);
    player.yaw = savedData.playerYaw || 0.6;
    player.pitch = savedData.playerPitch || -0.12;
    setDayTime(savedData.time || 0.06);
    if (savedData.slots) savedData.slots.forEach((id, i) => { if (slots[i] !== undefined) slots[i] = id; });
  } else { respawn(); setDayTime(0.06); }
  currentWorldName = worldName;
  worldAlreadySaved = !!savedData;
  renderHotbar();
}

async function saveCurrentWorld() {
  if (!currentWorldName) return false;
  try {
    const worldData = { seed: SEED, playerPos: { x: player.pos.x, y: player.pos.y, z: player.pos.z }, playerYaw: player.yaw, playerPitch: player.pitch, time: dayTime, slots: [...slots], stats: {} };
    await saveManager.saveWorld(currentWorldName, worldData);
    worldAlreadySaved = true;
    return true;
  } catch (e) { console.error('Ошибка сохранения:', e); return false; }
}

function startPlaying() {
  soundManager.init();
  soundManager.startAmbient();
  setState('playing', canvas);
  lockPointer(canvas);
}

function onTimeToggle() { const current = dayTime; setDayTime(current < 0.5 ? 0.55 : 0.06); const btn = $('#btn-time'); if (btn) btn.textContent = dayTime < 0.5 ? 'Время: день' : 'Время: ночь'; }
function onAction(btn) { if (btn === 0 || btn === 2) setSwingT(1); doAction(btn, target, slots, sel, selectSlot, renderHotbar, (x,y,z,id) => spawnParticles(x,y,z,id, dayTime < 0.5 ? 0.5 : 1, scene), setBlock, getBlock); }
function onToggleFly() { player.flying = !player.flying; player.vel.y = 0; }
function onToggleDebug() { setDebugOn(!getDebugOn()); const el = $('#debug'); if (el) el.hidden = !getDebugOn(); }

function showNameModal() { const modal = $('#name-modal'); const input = $('#world-name-input'); if (modal && input) { modal.hidden = false; input.value = ''; input.focus(); } }
function hideNameModal() { const modal = $('#name-modal'); if (modal) modal.hidden = true; }

function returnFromSettings() {
  if (previousState === 'paused') {
    setState('paused', canvas);
  } else if (previousState === 'playing') {
    startPlaying();
  } else {
    setState('menu', canvas);
  }
}

(async () => {
  await loadSettings();
  const savedDist = getSetting('renderDist');
  if (savedDist) setRenderDist(savedDist);
  soundManager.setVolume('master', getSetting('volumeMaster') ?? 0.7);
  soundManager.setVolume('sfx', getSetting('volumeSfx') ?? 0.8);
  soundManager.setVolume('ambient', getSetting('volumeAmbient') ?? 0.4);
  setupUI();
  renderHotbar();
  initWorld(false);
  $('#loading').remove();
})();

function setupUI() {
  const safeBind = (id, event, handler) => { const el = document.getElementById(id); if (el) el.addEventListener(event, handler); };
  const nameInput = $('#world-name-input');
  const btnConfirmName = $('#btn-confirm-name');
  const btnCancelName = $('#btn-cancel-name');
  
  safeBind('btn-new-game', 'click', () => { showNameModal(); });
  
  if (btnConfirmName) {
    btnConfirmName.onclick = async () => {
      const name = nameInput.value.trim();
      if (!name) { nameInput.style.borderColor = '#f44'; return; }
      const exists = await saveManager.worldExists(name);
      if (exists) { if (!confirm(`Мир "${name}" уже существует. Перезаписать?`)) return; }
      hideNameModal();
      await initWorld(true, name, null);
      startPlaying();
    };
  }
  if (btnCancelName) btnCancelName.onclick = () => { hideNameModal(); };
  if (nameInput) {
    nameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && btnConfirmName) btnConfirmName.click(); if (e.key === 'Escape') hideNameModal(); });
  }
  
  safeBind('btn-select-world', 'click', async () => {
    const list = document.getElementById('worlds-list');
    if (!list) return;
    try {
      const worlds = await saveManager.listWorlds();
      list.innerHTML = worlds.length === 0 ? '<p style="color:#aaa;font-size:9px">Нет сохранённых миров</p>' : '';
      worlds.forEach(w => {
        const div = document.createElement('div');
        div.className = 'world-item';
        div.innerHTML = `<div class="world-info" style="flex:1;cursor:pointer"><h3>${w.name}</h3><p>${new Date(w.timestamp).toLocaleString()}</p></div><button class="btn-del" data-name="${w.name}">Удалить</button>`;
        div.querySelector('.world-info').onclick = async () => {
          const savedData = await saveManager.loadWorld(w.name);
          if (savedData) { await initWorld(false, w.name, savedData); startPlaying(); }
        };
        div.querySelector('.btn-del').onclick = async (e) => { e.stopPropagation(); if (confirm(`Удалить мир "${w.name}"?`)) { await saveManager.deleteWorld(w.name); div.remove(); } };
        list.appendChild(div);
      });
    } catch (e) { console.error(e); }
    previousState = state;
    setState('worlds', canvas);
  });
  
  // КНОПКА НАСТРОЕК ИЗ ГЛАВНОГО МЕНЮ
  safeBind('btn-settings', 'click', () => { 
    previousState = 'menu';
    renderSettingsScreen(); 
    setState('settings', canvas); 
  });
  
  safeBind('btn-exit', 'click', () => { alert('Вы вышли из игры. Перезагрузите страницу для повторного входа.'); });
  safeBind('btn-back-from-worlds', 'click', () => { setState('menu', canvas); });
  
  safeBind('btn-resume', 'click', startPlaying);
  
  safeBind('btn-save-pause', 'click', async () => { 
    if (!currentWorldName) { alert('Сначала создайте мир с именем!'); return; }
    const success = await saveCurrentWorld(); 
    const btn = $('#btn-save-pause'); 
    if (btn) { btn.textContent = success ? 'Сохранено!' : 'Ошибка!'; setTimeout(() => btn.textContent = 'Сохранить игру', 1500); } 
  });
  
  // КНОПКА НАСТРОЕК ИЗ ПАУЗЫ — запоминаем что пришли из paused
  safeBind('btn-settings-pause', 'click', () => { 
    previousState = 'paused';
    renderSettingsScreen(); 
    setState('settings', canvas); 
  });
  
  safeBind('btn-quit-to-menu', 'click', async () => { 
    if (currentWorldName && worldAlreadySaved) await saveCurrentWorld();
    soundManager.stopAmbient();
    if (document.pointerLockElement) document.exitPointerLock(); 
    setState('menu', canvas); 
  });
  
  // СОХРАНИТЬ НАСТРОЙКИ + ВЕРНУТЬСЯ КУДА ПРИШЛИ
  safeBind('btn-save-settings', 'click', async () => { 
    await saveCurrentSettings(); 
    returnFromSettings();
  });
  
  // ПО УМОЛЧАНИЮ — просто сброс без возврата
  safeBind('btn-default-settings', 'click', () => { resetToDefaults(); });
  
  // НАЗАД — просто возврат без сохранения
  safeBind('btn-back-from-settings', 'click', () => { 
    returnFromSettings();
  });

  setupInput(canvas, {
    initWorld, startPlaying, setState: (s) => { previousState = state; setState(s, canvas); }, lockPointer: () => lockPointer(canvas),
    onTimeToggle, onAction, onToggleFly, onToggleDebug, setRenderDist,
    getSensitivity: () => getSetting('mouseSens') || 0.0022,
    onResize: () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = handCam.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); handCam.updateProjectionMatrix(); }
  });
}

let last = performance.now(), fpsFrames = 0, fpsTime = 0, fps = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state === 'playing') {
    updatePlayer(dt, keys, inputState, respawn);
    if (inputState.mouseHeld >= 0) { inputState.holdT += dt; if (inputState.holdT >= 0.25) { inputState.holdT = 0; updateTarget(); onAction(inputState.mouseHeld); } }
    autoSaveTimer += dt; 
    if (autoSaveTimer > 30 && currentWorldName && worldAlreadySaved) { saveCurrentWorld(); autoSaveTimer = 0; }
    soundManager.updateAmbient(dt, dayTime);
  } else if (state === 'menu') { player.yaw += dt * 0.035; player.pitch = -0.1; }
  if (state === 'playing' || state === 'menu') { setDayTime((dayTime + dt / DAY_LEN) % 1); setCloudDrift(getCloudDrift() + dt * 1.2); }
  const hs = Math.hypot(player.vel.x, player.vel.z);
  const bobOn = state === 'playing' && player.onGround && hs > 0.5 && !player.flying;
  const currentBobAmp = getBobAmp();
  setBobAmp(currentBobAmp + ((bobOn ? 1 : 0) - currentBobAmp) * Math.min(1, dt * 8));
  const eye = player.sneak && !player.flying ? 1.32 : 1.62;
  const currentBob = getBob();
  camera.position.set(player.pos.x + Math.cos(player.yaw) * Math.sin(currentBob) * 0.04 * getBobAmp(), player.pos.y + eye - Math.abs(Math.cos(currentBob)) * 0.05 * getBobAmp(), player.pos.z - Math.sin(player.yaw) * Math.sin(currentBob) * 0.04 * getBobAmp());
  camera.rotation.set(player.pitch, player.yaw, 0);
  const targetFov = getSetting('fov') || baseFov;
  const finalFov = targetFov * (player.sprinting && hs > 3 ? 1.12 : 1) * (player.flying && player.sprinting ? 1.05 : 1);
  if (Math.abs(camera.fov - finalFov) > 0.05) { camera.fov += (finalFov - camera.fov) * Math.min(1, dt * 10); camera.updateProjectionMatrix(); }
  updateChunks(state === 'menu' ? 12 : 7, dt, player.pos, worldMat, waterMat, scene);
  updateSky(skyObjs, scene, camera, renderer, worldMat, waterMat, handMat);
  updateTarget();
  updateParticles(dt, scene);
  updateHand(dt, slots, sel, currentBob, getBobAmp());
  $('#mode').textContent = state === 'menu' ? '' : player.flying ? 'Полёт' : '';
  renderer.clear();
  renderer.render(scene, camera);
  if (state !== 'menu' && state !== 'settings' && state !== 'worlds') { renderer.clearDepth(); renderer.render(handScene, handCam); }
  fpsFrames++; fpsTime += dt;
  if (fpsTime >= 0.5) { fps = Math.round(fpsFrames / fpsTime); fpsFrames = 0; fpsTime = 0; if (getDebugOn()) updateDebug(fps, target, SEED); }
}
requestAnimationFrame(frame);