/* S9: arsip riwayat lama di IndexedDB. Async; gagal apa pun = jangan pindahkan data. */
const Archive = (() => {
  const DB_NAME = 'rutin-buah-archive';
  const DB_VERSION = 1;
  const STORES = ['completion-old', 'consumption-old'];
  let dbPromise = null;

  function available() {
    return typeof indexedDB !== 'undefined' && indexedDB != null;
  }

  function open() {
    if (!available()) return Promise.resolve(null);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      let req;
      try {
        req = indexedDB.open(DB_NAME, DB_VERSION);
      } catch {
        resolve(null);
        return;
      }
      req.onupgradeneeded = () => {
        const db = req.result;
        STORES.forEach((name) => {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
        });
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    });
    return dbPromise;
  }

  function run(storeName, mode, fn, fallback) {
    if (!STORES.includes(storeName)) return Promise.resolve(fallback);
    return open().then((db) => {
      if (!db) return fallback;
      return new Promise((resolve) => {
        let tx;
        try {
          tx = db.transaction(storeName, mode);
          const result = fn(tx.objectStore(storeName));
          let value = result;
          if (result && typeof result === 'object' && 'onsuccess' in result) {
            value = undefined;
            result.onsuccess = () => { value = result.result; };
          }
          tx.oncomplete = () => resolve(value === undefined ? true : value);
          tx.onerror = () => resolve(fallback);
          tx.onabort = () => resolve(fallback);
        } catch {
          resolve(fallback);
        }
      });
    }).catch(() => fallback);
  }

  /** Tulis ke IndexedDB lebih dulu. Mengembalikan true hanya bila transaksi komit. */
  function put(storeName, key, value) {
    return run(storeName, 'readwrite', (store) => {
      store.put(value, key);
      return true;
    }, false);
  }

  function get(storeName, key) {
    return run(storeName, 'readonly', (store) => store.get(key), null).then((v) => v == null ? null : v);
  }

  /** Semua entri sebagai objek { key: value } untuk ekspor/impor. */
  function all(storeName) {
    return run(storeName, 'readonly', (store) => {
      const out = {};
      const cur = store.openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (!c) return;
        out[String(c.key)] = c.value;
        c.continue();
      };
      return out;
    }, {}).then((v) => v || {});
  }

  function clear(storeName) {
    return run(storeName, 'readwrite', (store) => {
      store.clear();
      return true;
    }, false);
  }

  /** Dipakai tes: tutup koneksi supaya db dibuka ulang. */
  function reset() {
    const p = dbPromise;
    dbPromise = null;
    if (!p) return Promise.resolve();
    return p.then((db) => { if (db) db.close(); }).catch(() => {});
  }

  return { DB_NAME, STORES, available, put, get, all, clear, reset };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Archive;
