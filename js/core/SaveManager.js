const DB_NAME = 'VoxelEngineDB';
// Увеличиваем версию до 5, чтобы гарантированно запустить onupgradeneeded у всех пользователей
const DB_VERSION = 5;

class SaveManager {
  constructor() { 
    this.db = null; 
    this.ready = false; 
  }

  async init() {
    if (this.ready) return;
    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          
          // Безопасное создание хранилища миров
          if (!db.objectStoreNames.contains('worlds')) {
            const store = db.createObjectStore('worlds', { keyPath: 'id' });
            store.createIndex('name', 'name', { unique: false });
            store.createIndex('timestamp', 'timestamp');
          } else {
            // Если хранилище есть, проверяем и создаем недостающие индексы
            const tx = event.target.transaction;
            const store = tx.objectStore('worlds');
            if (!store.indexNames.contains('name')) {
              store.createIndex('name', 'name', { unique: false });
            }
            if (!store.indexNames.contains('timestamp')) {
              store.createIndex('timestamp', 'timestamp');
            }
          }

          // Безопасное создание хранилища настроек
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'key' });
          }
        };

        request.onsuccess = (event) => { 
          this.db = event.target.result; 
          this.ready = true; 
          resolve(); 
        };
        
        request.onerror = (event) => reject(event.target.error);
        request.onblocked = () => console.warn('IndexedDB blocked');
      } catch (e) { 
        reject(e); 
      }
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
      } catch (e) { 
        reject(e); 
      }
    });
  }

  generateId() { 
    return 'world_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9); 
  }

  async saveWorld(id, name, data) {
    await this.init();
    return this._transaction('worlds', 'readwrite', (store, setResult) => {
      const record = { id, name, data, timestamp: Date.now(), stats: data.stats || {} };
      const req = store.put(record);
      req.onsuccess = () => setResult(true);
      req.onerror = (e) => { throw e.target.error; };
    });
  }

  async loadWorld(id) {
    await this.init();
    return this._transaction('worlds', 'readonly', (store, setResult) => {
      const req = store.get(id);
      req.onsuccess = () => setResult(req.result || null);
      req.onerror = (e) => { throw e.target.error; };
    });
  }

  async worldExists(name) {
    await this.init();
    return this._transaction('worlds', 'readonly', (store, setResult) => {
      // Теперь индекс name точно существует благодаря проверке в onupgradeneeded
      const index = store.index('name');
      const req = index.getAll(name);
      req.onsuccess = () => setResult(req.result && req.result.length > 0);
      req.onerror = (e) => { throw e.target.error; };
    });
  }

  async listWorlds() {
    await this.init();
    return this._transaction('worlds', 'readonly', (store, setResult) => {
      const req = store.getAll();
      req.onsuccess = () => setResult(
        req.result.map(w => ({ id: w.id, name: w.name, timestamp: w.timestamp, stats: w.stats, seed: w.data?.seed }))
          .sort((a, b) => b.timestamp - a.timestamp)
      );
      req.onerror = (e) => { throw e.target.error; };
    });
  }

  async renameWorld(id, newName) {
    await this.init();
    return this._transaction('worlds', 'readwrite', (store, setResult) => {
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result) {
          req.result.name = newName;
          store.put(req.result);
          setResult(true);
        } else setResult(false);
      };
      req.onerror = (e) => { throw e.target.error; };
    });
  }

  async deleteWorld(id) {
    await this.init();
    return this._transaction('worlds', 'readwrite', (store, setResult) => {
      const req = store.delete(id);
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