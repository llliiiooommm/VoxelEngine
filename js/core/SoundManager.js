const DEFAULT_VOLUME = { master: 0.7, sfx: 0.8, ambient: 0.4 };

class SoundManager {
  constructor() { this.ctx = null; this.masterGain = null; this.sfxGain = null; this.ambientGain = null; this.initialized = false; this.volumes = { ...DEFAULT_VOLUME }; this.stepTimer = 0; this.stepInterval = 0.45; this.birdTimer = 0; this.windNode = null; this.buffers = {}; }
  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain(); this.masterGain.gain.value = this.volumes.master; this.masterGain.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = this.volumes.sfx; this.sfxGain.connect(this.masterGain);
      this.ambientGain = this.ctx.createGain(); this.ambientGain.gain.value = this.volumes.ambient; this.ambientGain.connect(this.masterGain);
      this._generateBuffers();
      this.initialized = true;
    } catch (e) { console.warn('Web Audio не поддерживается:', e); }
  }
  _generateBuffers() {
    const sr = this.ctx.sampleRate;
    this.buffers.step_grass = this._makeNoiseBuf(0.12, sr, 'lowpass', 800);
    this.buffers.step_stone = this._makeNoiseBuf(0.10, sr, 'highpass', 2000);
    this.buffers.step_wood = this._makeNoiseBuf(0.14, sr, 'bandpass', 400);
    this.buffers.step_sand = this._makeNoiseBuf(0.18, sr, 'lowpass', 1200);
    this.buffers.step_water = this._makeNoiseBuf(0.25, sr, 'lowpass', 500);
    this.buffers.break = this._makeNoiseBuf(0.20, sr, 'bandpass', 1500);
    this.buffers.place = this._makeNoiseBuf(0.15, sr, 'lowpass', 600);
    this.buffers.splash = this._makeNoiseBuf(0.30, sr, 'lowpass', 700);
  }
  _makeNoiseBuf(duration, sr, filterType, freq) {
    const buf = this.ctx.createBuffer(1, sr * duration, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    return { buffer: buf, filterType, freq };
  }
  _playBuffer(bufData, gainNode, volume = 1, pitch = 1) {
    if (!this.ctx || !bufData) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const src = this.ctx.createBufferSource(); src.buffer = bufData.buffer; src.playbackRate.value = pitch;
    const filter = this.ctx.createBiquadFilter(); filter.type = bufData.filterType; filter.frequency.value = bufData.freq;
    const gain = this.ctx.createGain(); gain.gain.value = volume;
    src.connect(filter); filter.connect(gain); gain.connect(gainNode);
    src.start(); src.onended = () => { src.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
  _playTone(freq, duration, gainNode, type = 'sine', volume = 0.5, pitchBend = 0) {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const osc = this.ctx.createOscillator(); osc.type = type; osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (pitchBend !== 0) osc.frequency.exponentialRampToValueAtTime(Math.max(50, freq + pitchBend), this.ctx.currentTime + duration);
    const gain = this.ctx.createGain(); gain.gain.setValueAtTime(volume, this.ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain); gain.connect(gainNode); osc.start(); osc.stop(this.ctx.currentTime + duration);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  playStep(surface) {
    if (!this.initialized) return;
    const now = performance.now() / 1000;
    if (now - this.stepTimer < this.stepInterval) return;
    this.stepTimer = now;
    const bufMap = { 1: this.buffers.step_grass, 2: this.buffers.step_grass, 3: this.buffers.step_stone, 4: this.buffers.step_stone, 5: this.buffers.step_wood, 6: this.buffers.step_wood, 7: this.buffers.step_wood, 8: this.buffers.step_grass, 9: this.buffers.step_sand, 10: this.buffers.step_water, 11: this.buffers.step_stone, 12: this.buffers.step_stone, 13: this.buffers.step_stone, 22: this.buffers.step_stone, 23: this.buffers.step_sand, 24: this.buffers.step_stone };
    const buf = bufMap[surface] || this.buffers.step_grass;
    this._playBuffer(buf, this.sfxGain, 0.6, 0.85 + Math.random() * 0.3);
  }
  playBreak() { if (this.initialized) this._playBuffer(this.buffers.break, this.sfxGain, 0.7, 0.9 + Math.random() * 0.2); }
  playPlace() { if (this.initialized) this._playBuffer(this.buffers.place, this.sfxGain, 0.5, 1.0 + Math.random() * 0.15); }
  playJump() { if (this.initialized) this._playTone(220, 0.15, this.sfxGain, 'sine', 0.3, 180); }
  playSplash() { if (this.initialized) this._playBuffer(this.buffers.splash, this.sfxGain, 0.5, 0.8); }
  playFly() { if (this.initialized) this._playTone(150, 0.3, this.sfxGain, 'sine', 0.2, 100); }
  startAmbient() {
    if (!this.initialized || this.windNode) return;
    const bufferSize = 2 * this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
    const noise = this.ctx.createBufferSource(); noise.buffer = buffer; noise.loop = true;
    const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 400;
    const gain = this.ctx.createGain(); gain.gain.value = 0.15;
    noise.connect(filter); filter.connect(gain); gain.connect(this.ambientGain); noise.start();
    this.windNode = noise;
  }
  stopAmbient() { if (this.windNode) { try { this.windNode.stop(); } catch(e){} this.windNode = null; } }
  updateAmbient(dt, timeOfDay) {
    if (!this.initialized) return;
    this.birdTimer += dt;
    if (this.birdTimer > 8 + Math.random() * 15 && timeOfDay > 0.2 && timeOfDay < 0.8) {
      this.birdTimer = 0;
      const baseFreq = 1800 + Math.random() * 1200;
      const count = 1 + (Math.random() * 3 | 0);
      for (let i = 0; i < count; i++) setTimeout(() => this._playTone(baseFreq + Math.random() * 400, 0.08, this.ambientGain, 'sine', 0.15, 600), i * 120);
    }
  }
  setVolume(type, value) { this.volumes[type] = value; if (!this.initialized) return; if (type === 'master') this.masterGain.gain.value = value; else if (type === 'sfx') this.sfxGain.gain.value = value; else if (type === 'ambient') this.ambientGain.gain.value = value; }
  getVolume(type) { return this.volumes[type]; }
}

export const soundManager = new SoundManager();