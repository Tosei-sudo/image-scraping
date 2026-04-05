const DB_NAME = 'image-scraping';
const STORE_NAME = 'images';
const DB_VERSION = 1;

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('projectCode', 'projectCode', { unique: false });
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

export async function saveImage(projectCode, orderNumber, fileName, blob) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.add({ projectCode, orderNumber, fileName, blob });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export async function getImages(projectCode) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const index = tx.objectStore(STORE_NAME).index('projectCode');
        const req = index.getAll(projectCode);
        req.onsuccess = () => resolve(req.result.sort((a, b) => a.orderNumber - b.orderNumber));
        req.onerror = () => reject(req.error);
    });
}

export async function deleteImages(projectCode) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('projectCode');
        const req = index.getAllKeys(projectCode);
        req.onsuccess = () => {
            const keys = req.result;
            if (keys.length === 0) { resolve(); return; }
            let remaining = keys.length;
            keys.forEach(key => {
                const delReq = store.delete(key);
                delReq.onsuccess = () => { if (--remaining === 0) resolve(); };
                delReq.onerror = () => reject(delReq.error);
            });
        };
        req.onerror = () => reject(req.error);
    });
}
