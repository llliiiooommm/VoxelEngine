const DB_NAME = 'VoxelEngineDB';
const DB_VERSION = 2;
class SaveManager {
    constructor() { this.db = null; this.ready = false; }
    async init() {
        if (this.ready) return;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('worlds')) db.createObjectStore('worlds', { keyPath: 'name' });
                if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
            };
            request.onsuccess = (event) => { this.db = event.target.result; this.ready = true; resolve(); };
            request.onerror = (event) => reject(event.target.error);
        });
    }
    async saveWorld(name, data) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['worlds'], 'readwrite');
            const req = tx.objectStore('worlds').put({ name, data, timestamp: Date.now(), stats: data.stats || {} });
            req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
        });
    }
    async loadWorld(name) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['worlds'], 'readonly');
            const req = tx.objectStore('worlds').get(name);
            req.onsuccess = () => resolve(req.result?.data || null); req.onerror = () => reject(req.error);
        });
    }
    async worldExists(name) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['worlds'], 'readonly');
            const req = tx.objectStore('worlds').get(name);
            req.onsuccess = () => resolve(!!req.result); req.onerror = () => reject(req.error);
        });
    }
    async listWorlds() {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['worlds'], 'readonly');
            const req = tx.objectStore('worlds').getAll();
            req.onsuccess = () => resolve(req.result.map(w => ({ name: w.name, timestamp: w.timestamp, stats: w.stats })).sort((a, b) => b.timestamp - a.timestamp));
            req.onerror = () => reject(req.error);
        });
    }
    async deleteWorld(name) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['worlds'], 'readwrite');
            const req = tx.objectStore('worlds').delete(name);
            req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
        });
    }
    async getSetting(key, defaultValue = null) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['settings'], 'readonly');
            const req = tx.objectStore('settings').get(key);
            req.onsuccess = () => resolve(req.result ? req.result.value : defaultValue); req.onerror = () => reject(req.error);
        });
    }
    async setSetting(key, value) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['settings'], 'readwrite');
            const req = tx.objectStore('settings').put({ key, value });
            req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
        });
    }
}
export const saveManager = new SaveManager();