import * as THREE from 'https://esm.sh/three@0.170.0';
THREE.ColorManagement.enabled = false;

import { $, SEA, baseFov, DAY_LEN } from './utils/Constants.js';
import { regenerateNoise, SEED, heightAt, getSeed } from './utils/Noise.js';
import { atlasTex } from './utils/Textures.js';
import { chunks, key, getBlock, setBlock, updateChunks, setRenderDist, serializeModifiedChunks, applyModifiedChunks } from './world/World.js';
import { generate, buildMesh } from './world/Chunk.js';
import { SOLID } from './world/Blocks.js';
import { player, updatePlayer, getBob, getBobAmp, setBobAmp } from './entities/Player.js';
import { raycast, doAction } from './core/Actions.js';
import { spawnParticles, updateParticles } from './world/Particles.js';
import { initSky, updateSky, dayTime, cloudDrift, setDayTime, setCloudDrift, getCloudDrift, getDayTime } from './world/Sky.js';
import { initHand, updateHand, handScene, handCam, handMat, setSwingT } from './entities/Hand.js';
import { inventory, selectedSlot, selectSlot, renderHotbar, state, getDebugOn, setDebugOn, setState, lockPointer, updateDebug, SPLASHES, openInventory, closeInventory } from './ui/UI.js';
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
let currentWorldId = null;
let currentWorldName = null;
let autoSaveTimer = 0;
let previousState = 'menu';

// Фоновая сцена меню
let bgScene, bgCamera, bgChunks = new Map();

function updateTarget() { 
  if (state !== 'playing' && state !== 'paused') { outline.visible = false; target = null; return; } 
  camera.getWorldDirection(tmpDir); 
  target = raycast(camera.position, tmpDir, 5); 
  outline.visible = !!target; 
  if (target) outline.position.set(target.x + .5, target.y + .5, target.z + .5); 
}

let spawn = { x: 0.5, z: 0.5 };
function surfaceY(x, z) { for (let y = 95; y >= 0; y--) if (SOLID[getBlock(x, y, z)]) return y + 1; return SEA + 2; }
function respawn() { const p = player.pos; p.set(spawn.x, 0, spawn.z); p.y = surfaceY(Math.floor(spawn.x), Math.floor(spawn.z)); player.vel.set(0, 0, 0); }
function resetPlayerState() { player.vel.set(0, 0, 0); player.flying = true; player.sprinting = false; player.sneak = false; player.inWater = false; player.onGround = false; }

async function initWorld(newSeed, worldName = null, savedData = null, seedValue = null) {
  if (newSeed || seedValue !== null) {
    const newS = seedValue !== null ? seedValue : (Math.random() * 1e9) | 0;
    regenerateNoise(newS);
  }
  
  for (const c of chunks.values()) { 
    if (c.mesh) { scene.remove(c.mesh); c.mesh.geometry.dispose(); } 
    if (c.water) { scene.remove(c.water); c.water.geometry.dispose(); } 
  }
  chunks.clear();
  
  if (!savedData) { 
    for (let i = 0; i < 46; i++) { inventory[i] = 0; } 
    [1, 2, 3, 4, 6, 5, 10, 12, 18].forEach((id, i) => { inventory[37 + i] = id; }); 
  }
  
  for (let r = 0; r < 400; r += 8) {
    for (let a = 0; a < 8; a++) { 
      const x = Math.round(Math.cos(a * Math.PI / 4) * r);
      const z = Math.round(Math.sin(a * Math.PI / 4) * r);
      const h = heightAt(x, z);
      if (h > SEA + 1 && h < SEA + 22) { spawn = { x: x + .5, z: z + .5 }; r = 400; break; } 
    }
    if (r === 0) break;
  }
  
  const cx = Math.floor(spawn.x / 16), cz = Math.floor(spawn.z / 16);
  for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) generate(cx + dx, cz + dz, chunks, key);
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) buildMesh(chunks.get(key(cx + dx, cz + dz)), chunks, key, worldMat, waterMat, scene);
  
  if (savedData && savedData.modifiedChunks) { 
    applyModifiedChunks(savedData.modifiedChunks); 
    for (const c of chunks.values()) { if (c.dirty) buildMesh(c, chunks, key, worldMat, waterMat, scene); } 
  }
  
  if (savedData && savedData.inventory) { 
    for (let i = 0; i < 46; i++) { inventory[i] = savedData.inventory[i] || 0; } 
  }
  
  if (savedData && savedData.playerPos) { 
    player.pos.set(savedData.playerPos.x, savedData.playerPos.y, savedData.playerPos.z); 
    player.yaw = savedData.playerYaw ?? 0.6; 
    player.pitch = savedData.playerPitch ?? -0.12; 
    setDayTime(savedData.time ?? 0.06); 
    selectSlot(savedData.selectedSlot ?? 0); 
  } else { respawn(); setDayTime(0.06); }
  
  resetPlayerState();
  currentWorldName = worldName;
  renderHotbar();
  if (worldName && !savedData) await saveCurrentWorld();
}

async function saveCurrentWorld() {
  if (!currentWorldName || !currentWorldId) return false;
  try {
    const worldData = { 
      seed: getSeed(), 
      playerPos: { x: player.pos.x, y: player.pos.y, z: player.pos.z }, 
      playerYaw: player.yaw, 
      playerPitch: player.pitch, 
      time: getDayTime(), 
      selectedSlot, 
      inventory: [...inventory], 
      modifiedChunks: serializeModifiedChunks(), 
      stats: {} 
    };
    await saveManager.saveWorld(currentWorldId, currentWorldName, worldData);
    return true;
  } catch (e) { console.error('Ошибка сохранения:', e); return false; }
}

function startPlaying() { soundManager.init(); soundManager.startAmbient(); setState('playing', canvas); lockPointer(canvas); }
function onTimeToggle() { const current = getDayTime(); setDayTime(current < 0.5 ? 0.55 : 0.06); }
function onAction(btn) { if (btn === 0 || btn === 2) setSwingT(1); doAction(btn, target, inventory, 37 + selectedSlot, selectSlot, renderHotbar, (x,y,z,id) => spawnParticles(x,y,z,id, getDayTime() < 0.5 ? 0.5 : 1, scene), setBlock, getBlock); }
function onToggleFly() { player.flying = !player.flying; player.vel.y = 0; if (soundManager.playFly) soundManager.playFly(); }
function onToggleDebug() { setDebugOn(!getDebugOn()); const el = $('#debug'); if (el) el.hidden = !getDebugOn(); }

function showConfirmModal(title, message, onYes) {
  $('#confirm-title').textContent = title;
  $('#confirm-message').textContent = message;
  $('#confirm-modal').hidden = false;
  $('#btn-confirm-yes').onclick = () => { $('#confirm-modal').hidden = true; onYes(); };
  $('#btn-confirm-no').onclick = () => { $('#confirm-modal').hidden = true; };
}

function returnFromSettings() { if (previousState === 'paused') setState('paused', canvas); else if (previousState === 'playing') startPlaying(); else setState('menu', canvas); }
function returnFromSubScreen() { if (state === 'settings') returnFromSettings(); else setState('menu', canvas); }

function initBackgroundScene() {
  bgScene = new THREE.Scene();
  bgScene.fog = new THREE.Fog(0x78a7ff, 30, 100);
  bgCamera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 500);
  bgCamera.position.set(0, 20, 40);
  bgCamera.lookAt(0, 5, 0);
  const bgWorldMat = new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true, alphaTest: 0.5 });
  const bgWaterMat = new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide });
  const bgSkyObjs = initSky(bgScene, bgCamera);
  bgScene.userData = { bgWorldMat, bgWaterMat, bgSkyObjs };
  const bgCx = 0, bgCz = 0;
  for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) generate(bgCx + dx, bgCz + dz, bgChunks, key);
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) buildMesh(bgChunks.get(key(bgCx + dx, bgCz + dz)), bgChunks, key, bgWorldMat, bgWaterMat, bgScene);
}

function updateBackgroundScene(time) {
  if (!bgScene) return;
  bgCamera.position.x = Math.sin(time * 0.0001) * 40;
  bgCamera.position.z = Math.cos(time * 0.0001) * 40;
  bgCamera.position.y = 20 + Math.sin(time * 0.0002) * 3;
  bgCamera.lookAt(0, 5, 0);
  const { bgWorldMat, bgWaterMat, bgSkyObjs } = bgScene.userData;
  updateSky(bgSkyObjs, bgScene, bgCamera, renderer, bgWorldMat, bgWaterMat, null);
  renderer.clear();
  renderer.render(bgScene, bgCamera);
}

function cleanupBackgroundScene() {
  if (!bgScene) return;
  for (const c of bgChunks.values()) { 
    if (c.mesh) { bgScene.remove(c.mesh); c.mesh.geometry.dispose(); } 
    if (c.water) { bgScene.remove(c.water); c.water.geometry.dispose(); } 
  }
  bgChunks.clear(); bgScene = null; bgCamera = null;
}

(async () => {
  try {
    await loadSettings();
    const savedDist = getSetting('renderDist');
    if (savedDist) setRenderDist(savedDist);
    soundManager.setVolume('master', getSetting('volumeMaster') ?? 0.7);
    soundManager.setVolume('sfx', getSetting('volumeSfx') ?? 0.8);
    soundManager.setVolume('ambient', getSetting('volumeAmbient') ?? 0.4);
    if (getSetting('showDebug')) { const el = $('#debug'); if (el) el.hidden = false; }
    initBackgroundScene();
    setupUI();
    renderHotbar();
    $('#loading').remove();
  } catch (e) { console.error('Критическая ошибка инициализации:', e); $('#loading').textContent = 'Ошибка загрузки: ' + e.message; }
})();

function createWorldItem(w) {
  const div = document.createElement('div');
  div.className = 'world-item';
  const info = document.createElement('div'); info.className = 'world-info';
  const h3 = document.createElement('h3'); h3.textContent = w.name;
  const p = document.createElement('p'); p.textContent = `Seed: ${w.seed ?? '???'} · Сохранено: ${new Date(w.timestamp).toLocaleString()}`;
  info.appendChild(h3); info.appendChild(p);
  const actions = document.createElement('div'); actions.className = 'world-actions';
  const playBtn = document.createElement('button'); playBtn.className = 'btn-play'; playBtn.textContent = 'Играть';
  const renameBtn = document.createElement('button'); renameBtn.className = 'btn-rename'; renameBtn.textContent = 'Переименовать';
  const delBtn = document.createElement('button'); delBtn.className = 'btn-del'; delBtn.textContent = 'Удалить';
  actions.appendChild(playBtn); actions.appendChild(renameBtn); actions.appendChild(delBtn);
  div.appendChild(info); div.appendChild(actions);
  
  playBtn.onclick = async (e) => { e.stopPropagation(); try { const savedData = await saveManager.loadWorld(w.id); if (savedData) { await initWorld(false, w.name, savedData.data, savedData.data?.seed); startPlaying(); soundManager.playClick(); } } catch (e) { console.error(e); alert('Ошибка загрузки: ' + e.message); } };
  renameBtn.onclick = (e) => { e.stopPropagation(); const newName = prompt('Новое название:', w.name); if (newName && newName.trim() && newName !== w.name) { saveManager.renameWorld(w.id, newName.trim()).then(() => { h3.textContent = newName.trim(); soundManager.playClick(); }).catch(err => alert('Ошибка: ' + err.message)); } soundManager.playClick(); };
  delBtn.onclick = (e) => { e.stopPropagation(); showConfirmModal('Удалить мир?', `Вы уверены, что хотите удалить "${w.name}"? Это действие нельзя отменить.`, async () => { try { await saveManager.deleteWorld(w.id); div.remove(); soundManager.playClick(); } catch (e) { console.error(e); alert('Ошибка удаления: ' + e.message); } }); soundManager.playClick(); };
  return div;
}

function setupUI() {
  const safeBind = (id, handler) => { const el = document.getElementById(id); if (el) el.addEventListener('click', () => { soundManager.playClick(); handler(); }); };
  
  safeBind('btn-singleplayer', () => {
    const list = document.getElementById('worlds-list-container'); list.innerHTML = '';
    saveManager.listWorlds().then(worlds => {
      if (worlds.length === 0) { const p = document.createElement('p'); p.style.cssText = 'color:#aaa;font-size:10px;text-align:center;padding:20px;'; p.textContent = 'Нет сохранённых миров. Создайте первый!'; list.appendChild(p); }
      else worlds.forEach(w => list.appendChild(createWorldItem(w)));
    }).catch(e => { const p = document.createElement('p'); p.textContent = 'Ошибка загрузки'; list.appendChild(p); });
    setState('singleplayer', canvas);
  });
  
  safeBind('btn-create-world', () => { setState('createworld', canvas); $('#new-world-name').value = ''; $('#new-world-seed').value = ''; });
  safeBind('btn-confirm-create', async () => {
    const name = $('#new-world-name').value.trim() || `Мир ${Date.now()}`;
    const seedStr = $('#new-world-seed').value.trim();
    let seedValue = null;
    if (seedStr) { const numSeed = parseInt(seedStr); if (!isNaN(numSeed)) seedValue = numSeed; else seedValue = seedStr.split('').reduce((a,c) => a + c.charCodeAt(0), 0); }
    if (!/^[a-zA-Zа-яА-Я0-9 _-]+$/.test(name)) { alert('Недопустимые символы в названии'); return; }
    try {
      const exists = await saveManager.worldExists(name);
      if (exists && !confirm(`Мир "${name}" уже существует. Перезаписать?`)) return;
      const worldId = saveManager.generateId();
      currentWorldId = worldId;
      setState('menu', canvas);
      await initWorld(true, name, null, seedValue);
      startPlaying();
    } catch (e) { console.error(e); alert('Ошибка создания: ' + e.message); }
  });
  safeBind('btn-cancel-create', () => { setState('singleplayer', canvas); });
  safeBind('btn-back-from-singleplayer', () => { setState('menu', canvas); });
  safeBind('btn-settings', () => { previousState = 'menu'; renderSettingsScreen(); setState('settings', canvas); });
  safeBind('btn-about', () => { setState('about', canvas); });
  safeBind('btn-back-from-about', () => { setState('menu', canvas); });
  safeBind('btn-exit', () => { showConfirmModal('Выход', 'Закрыть вкладку игры? Несохранённый прогресс будет потерян.', () => { try { window.close(); } catch(e){} document.body.innerHTML = '<div style="color:#fff;text-align:center;padding:40px;font-family:monospace"><h1>Игра закрыта</h1><p>Можете закрыть вкладку.</p></div>'; }); });
  safeBind('btn-save-settings', async () => { await saveCurrentSettings(); returnFromSettings(); });
  safeBind('btn-default-settings', () => { resetToDefaults(); soundManager.playClick(); });
  safeBind('btn-back-from-settings', () => { returnFromSettings(); });
  safeBind('btn-resume', () => startPlaying());
  safeBind('btn-save-game', async () => { if (!currentWorldName) { alert('Сначала создайте мир!'); return; } const ok = await saveCurrentWorld(); alert(ok ? 'Мир сохранён!' : 'Ошибка сохранения!'); });
  safeBind('btn-settings-pause', () => { previousState = 'paused'; renderSettingsScreen(); setState('settings', canvas); });
  safeBind('btn-quit-to-menu', async () => { if (currentWorldName) await saveCurrentWorld(); if (document.pointerLockElement) document.exitPointerLock(); setState('menu', canvas); });

  setupInput(canvas, {
    initWorld, startPlaying, setState: (s) => { if (s !== 'settings' && s !== 'about') previousState = state; setState(s, canvas); }, lockPointer: () => lockPointer(canvas),
    onTimeToggle, onAction, onToggleFly, onToggleDebug, setRenderDist, returnFromSubScreen,
    onOpenInventory: () => openInventory(canvas),
    onSaveGame: async () => { if (!currentWorldName) return; const ok = await saveCurrentWorld(); alert(ok ? 'Сохранено!' : 'Ошибка!'); },
    onOpenSettings: () => { previousState = 'paused'; renderSettingsScreen(); setState('settings', canvas); },
    onQuitToMenu: async () => { if (currentWorldName) await saveCurrentWorld(); if (document.pointerLockElement) document.exitPointerLock(); setState('menu', canvas); },
    getSensitivity: () => getSetting('mouseSens') || 0.0022,
    onResize: () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = handCam.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); handCam.updateProjectionMatrix(); if (bgCamera) { bgCamera.aspect = innerWidth / innerHeight; bgCamera.updateProjectionMatrix(); } }
  });
}

let last = performance.now(), fpsFrames = 0, fpsTime = 0, fps = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state === 'menu' || state === 'singleplayer' || state === 'createworld' || state === 'about') updateBackgroundScene(now);
  if (state === 'playing') {
    updatePlayer(dt, keys, inputState, respawn);
    if (inputState.mouseHeld >= 0) { inputState.holdT += dt; if (inputState.holdT >= 0.25) { inputState.holdT = 0; updateTarget(); onAction(inputState.mouseHeld); } }
    autoSaveTimer += dt; if (autoSaveTimer > 60 && currentWorldName) { saveCurrentWorld(); autoSaveTimer = 0; }
    soundManager.updateAmbient(dt, getDayTime());
    updateChunks(7, dt, player.pos, worldMat, waterMat, scene);
    updateSky(skyObjs, scene, camera, renderer, worldMat, waterMat, handMat);
    updateTarget(); updateParticles(dt, scene);
    const hs = Math.hypot(player.vel.x, player.vel.z);
    const bobOn = player.onGround && hs > 0.5 && !player.flying;
    const currentBobAmp = getBobAmp();
    setBobAmp(currentBobAmp + ((bobOn ? 1 : 0) - currentBobAmp) * Math.min(1, dt * 8));
    const eye = player.sneak && !player.flying ? 1.32 : 1.62;
    const currentBob = getBob();
    camera.position.set(player.pos.x + Math.cos(player.yaw) * Math.sin(currentBob) * 0.04 * getBobAmp(), player.pos.y + eye - Math.abs(Math.cos(currentBob)) * 0.05 * getBobAmp(), player.pos.z - Math.sin(player.yaw) * Math.sin(currentBob) * 0.04 * getBobAmp());
    camera.rotation.set(player.pitch, player.yaw, 0);
    const targetFov = (getSetting('fov') || baseFov) * (player.sprinting && hs > 3 ? 1.12 : 1) * (player.flying && player.sprinting ? 1.05 : 1);
    if (Math.abs(camera.fov - targetFov) > 0.05) { camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 10); camera.updateProjectionMatrix(); }
    updateHand(dt, inventory, 37 + selectedSlot, currentBob, getBobAmp());
    $('#mode').textContent = player.flying ? 'Полёт' : '';
    renderer.clear(); renderer.render(scene, camera); renderer.clearDepth(); renderer.render(handScene, handCam);
  }
  if (state === 'playing' || state === 'menu') { setDayTime((getDayTime() + dt / DAY_LEN) % 1); setCloudDrift(getCloudDrift() + dt * 1.2); }
  fpsFrames++; fpsTime += dt;
  if (fpsTime >= 0.5) { fps = Math.round(fpsFrames / fpsTime); fpsFrames = 0; fpsTime = 0; if (getDebugOn()) updateDebug(fps, target, getSeed()); }
}
requestAnimationFrame(frame);