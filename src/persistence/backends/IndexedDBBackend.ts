import { StorageBackend } from '../StorageBackend.js';

interface IndexedDBOptions {
    namespace?: string;
    storeName?: string;
    version?: number;
}

/**
 * IndexedDBBackend - IndexedDB Implementation
 */
export class IndexedDBBackend extends StorageBackend {
    dbName: string;
    storeName: string;
    version: number;
    private _db: IDBDatabase | null;

    constructor(options: IndexedDBOptions = {}) {
        super(options);
        this.dbName = `${this.namespace}_db`;
        this.storeName = options.storeName || 'scenes';
        this.version = options.version || 1;
        this._db = null;
    }

    getType(): string {
        return 'indexedDB';
    }

    async isAvailable(): Promise<boolean> {
        return 'indexedDB' in window;
    }

    async getMaxSize(): Promise<number> {
        if (navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            return estimate.quota || 50 * 1024 * 1024;
        }
        return 50 * 1024 * 1024;
    }

    async getUsedSize(): Promise<number> {
        if (navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            return estimate.usage || 0;
        }
        return 0;
    }

    /** Open the database connection. */
    async openDatabase(): Promise<IDBDatabase> {
        if (this._db) {
            return this._db;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                reject(new Error(`Failed to open IndexedDB: ${request.error}`));
            };

            request.onsuccess = () => {
                this._db = request.result;
                resolve(this._db);
            };

            request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                const db = (event.target as IDBOpenDBRequest).result;

                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'key' });
                }
            };
        });
    }

    /** Close the database connection. */
    closeDatabase(): void {
        if (this._db) {
            this._db.close();
            this._db = null;
        }
    }

    async save(key: string, data: any): Promise<boolean> {
        try {
            const db = await this.openDatabase();
            const fullKey = this.getFullKey(key);

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);

                const record = {
                    key: fullKey,
                    data: data,
                    timestamp: Date.now()
                };

                const request = store.put(record);

                request.onsuccess = () => resolve(true);
                request.onerror = () => {
                    console.error('IndexedDB save error:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('IndexedDB save error:', error);
            return false;
        }
    }

    async load(key: string): Promise<any> {
        try {
            const db = await this.openDatabase();
            const fullKey = this.getFullKey(key);

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.get(fullKey);

                request.onsuccess = () => {
                    const result = request.result;
                    resolve(result ? result.data : null);
                };

                request.onerror = () => {
                    console.error('IndexedDB load error:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('IndexedDB load error:', error);
            return null;
        }
    }

    async delete(key: string): Promise<boolean> {
        try {
            const db = await this.openDatabase();
            const fullKey = this.getFullKey(key);

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.delete(fullKey);

                request.onsuccess = () => resolve(true);
                request.onerror = () => {
                    console.error('IndexedDB delete error:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('IndexedDB delete error:', error);
            return false;
        }
    }

    async exists(key: string): Promise<boolean> {
        try {
            const db = await this.openDatabase();
            const fullKey = this.getFullKey(key);

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.count(IDBKeyRange.only(fullKey));

                request.onsuccess = () => resolve(request.result > 0);
                request.onerror = () => {
                    console.error('IndexedDB exists error:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('IndexedDB exists error:', error);
            return false;
        }
    }

    async listKeys(): Promise<string[]> {
        try {
            const db = await this.openDatabase();
            const prefix = `${this.namespace}_`;

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.getAllKeys();

                request.onsuccess = () => {
                    const allKeys = request.result as string[];
                    const filteredKeys = allKeys
                        .filter(key => key.startsWith(prefix))
                        .map(key => this.getShortKey(key));
                    resolve(filteredKeys);
                };

                request.onerror = () => {
                    console.error('IndexedDB listKeys error:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('IndexedDB listKeys error:', error);
            return [];
        }
    }

    async clear(): Promise<boolean> {
        try {
            const keys = await this.listKeys();
            for (const key of keys) {
                await this.delete(key);
            }
            return true;
        } catch (error) {
            console.error('IndexedDB clear error:', error);
            return false;
        }
    }

    /** Delete the entire database. */
    async deleteDatabase(): Promise<boolean> {
        this.closeDatabase();

        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(this.dbName);

            request.onsuccess = () => resolve(true);
            request.onerror = () => {
                console.error('Failed to delete IndexedDB:', request.error);
                reject(request.error);
            };
        });
    }
}