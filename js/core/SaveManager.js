const DB_NAME = 'VoxelEngineDB';
const DB_VERSION = 3;

class SaveManager {
  constructor() { this.db = null; this.ready = false; }
  async init() {
    if (this.ready) return;
    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('worlds')) {
            const store = db.createObjectStore('worlds', { keyPath: 'name' });
            store.createIndex('timestamp', 'timestamp');
          }
          if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
        };
        request.onsuccess = (event) => { this.db = event.target.result; this.ready = true; resolve(); };
        request.onerror = (event) => reject(event.target.error);
        request.onblocked = () => console.warn('IndexedDB blocked');
      } catch (e) { reject(e); }
    });
  }
  _transaction(storeName, mode, callback) {
    return new Promise((resolve, reject) => {
      if (!this.db) { reject(new Error('DB not initialized')); return; }
      try {
        const tx = this.db.transaction([storeName], mode);
        const store = tx.objectStore(storeName);
        let result = null;
        tx.oncomplete = () => resolve(result);
        tx.onerror = (e) => reject(e.target.error || new Error('Transaction error'));
        tx.onabort = (e) => reject(new Error('Transaction aborted'));
        callback(store, (r) => { result = r; });
      } catch (e) { reject(e); }
    });
  }
  async saveWorld(name, data) {
    await this.init();
    return this._transaction('worlds', 'readwrite', (store, setResult) => {
      const record = { name, data, timestamp: Date.now(), stats: data.stats || {} };
      const req = store.put(record);
      req.onsuccess = () => setResult(true);
      req.onerror = (e) => { throw e.target.error; };
    });
  }
  async loadWorld(name) {
    await this.init();
    return this._transaction('worlds', 'readonly', (store, setResult) => {
      const req = store.get(name);
      req.onsuccess = () => setResult(req.result?.data || null);
      req.onerror = (e) => { throw e.target.error; };
    });
  }
  async worldExists(name) {
    await this.init();
    return this._transaction('worlds', 'readonly', (store, setResult) => {
      const req = store.get(name);
      req.onsuccess = () => setResult(!!req.result);
      req.onerror = (e) => { throw e.target.error; };
    });
  }
  async listWorlds() {
    await this.init();
    return this._transaction('worlds', 'readonly', (store, setResult) => {
      const req = store.getAll();
      req.onsuccess = () => setResult(req.result.map(w => ({ name: w.name, timestamp: w.timestamp, stats: w.stats })).sort((a, b) => b.timestamp - a.timestamp));
      req.onerror = (e) => { throw e.target.error; };
    });
  }
  async deleteWorld(name) {
    await this.init();
    return this._transaction('worlds', 'readwrite', (store, setResult) => {
      const req = store.delete(name);
      req.onsuccess = () => setResult(true);
      req.onerror = (e) => { throw e.target.error; };
    });
  }
  async getSetting(key, defaultValue = null) {
    await this.init();
    return this._transaction('settings', 'readonly', (store, setResult) => {
      const req = store.get(key);
      req.onsuccess = () => setResult(req.result ? req.result.value : defaultValue);
      req.onerror = (e) => { throw e.target.error; };
    });
  }
  async setSetting(key, value) {
    await this.init();
    return this._transaction('settings', 'readwrite', (store, setResult) => {
      const req = store.put({ key, value });
      req.onsuccess = () => setResult(true);
      req.onerror = (e) => { throw e.target.error; };
    });
  }
}

export const saveManager = new SaveManager();