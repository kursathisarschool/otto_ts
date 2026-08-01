import { LocalStorageBackend } from './backends/LocalStorageBackend.js';
import { IndexedDBBackend } from './backends/IndexedDBBackend.js';
import { CloudStorageBackend } from './backends/CloudStorageBackend.js';
import { StorageBackend } from './StorageBackend.js';

interface BackendInfo {
    type: string;
    available: boolean;
    maxSize?: number;
    usedSize?: number;
    error?: string;
}

export class StorageFactory {
    static _backends: Map<string, typeof StorageBackend> = new Map();

    static {
        this._backends.set('localStorage', LocalStorageBackend);
        this._backends.set('indexedDB', IndexedDBBackend);
        this._backends.set('cloud', CloudStorageBackend);
    }

    // ... register, unregister, getAvailableTypes, isRegistered, create, vs. hep aynı kalıyor

    /** Register a custom storage backend type. */
    static register(type: string, BackendClass: typeof StorageBackend): void {
        this._backends.set(type.toLowerCase(), BackendClass);
    }

    /** Unregister a storage backend type. */
    static unregister(type: string): void {
        this._backends.delete(type.toLowerCase());
    }

    /** Get available backend types. */
    static getAvailableTypes(): string[] {
        return Array.from(this._backends.keys());
    }

    /** Check if a backend type is registered. */
    static isRegistered(type: string): boolean {
        return this._backends.has(type.toLowerCase());
    }

    /** Create a storage backend instance. */
    static create(type: string, options: any = {}): StorageBackend {
        const normalizedType = type.toLowerCase();
        const BackendClass = this._backends.get(normalizedType);

        if (!BackendClass) {
            const available = Array.from(this._backends.keys()).join(', ');
            throw new Error(
                `Unknown storage backend type: "${type}". ` +
                `Available types: ${available}`
            );
        }

        return new (BackendClass as any)(options);
    }

    /** Create a storage backend with automatic fallback. */
    static async createWithFallback(preferences: string[] = ['indexedDB', 'localStorage'], options: any = {}): Promise<StorageBackend> {
        for (const type of preferences) {
            try {
                const backend = this.create(type, options);
                const available = await backend.isAvailable();

                if (available) {
                    console.log(`Using ${type} storage backend`);
                    return backend;
                } else {
                    console.log(`${type} storage not available, trying next...`);
                }
            } catch (error: any) {
                console.warn(`Failed to create ${type} backend:`, error.message);
            }
        }

        throw new Error('No storage backend available');
    }

    /** Create the best available backend based on data size. */
    static async createForSize(estimatedSize: number, options: any = {}): Promise<StorageBackend> {
        const localStorageLimit = 4 * 1024 * 1024;

        if (estimatedSize > localStorageLimit) {
            try {
                const indexedDB = this.create('indexedDB', options);
                if (await indexedDB.isAvailable()) {
                    console.log('Using IndexedDB for large data');
                    return indexedDB;
                }
            } catch (error) {
                console.warn('IndexedDB not available for large data');
            }
        }

        const localStorage = this.create('localStorage', options);
        if (await localStorage.isAvailable()) {
            return localStorage;
        }

        throw new Error('No suitable storage backend available');
    }

    /** Get information about all backends. */
    static async getBackendInfo(): Promise<BackendInfo[]> {
        const info: BackendInfo[] = [];

        for (const type of this._backends.keys()) {
            try {
                const backend = this.create(type);
                const available = await backend.isAvailable();

                info.push({
                    type,
                    available,
                    maxSize: available ? await backend.getMaxSize() : 0,
                    usedSize: available ? await backend.getUsedSize() : 0
                });
            } catch (error: any) {
                info.push({
                    type,
                    available: false,
                    error: error.message
                });
            }
        }

        return info;
    }
}

/**
 * MultiBackendStorage - Combines multiple backends with sync
 */
export class MultiBackendStorage {
    primary: StorageBackend;
    secondary: StorageBackend | null;

    constructor(primary: StorageBackend, secondary: StorageBackend | null = null) {
        this.primary = primary;
        this.secondary = secondary;
    }

    /** Save to primary and optionally sync to secondary. */
    async save(key: string, data: any): Promise<boolean> {
        const primaryResult = await this.primary.save(key, data);

        if (this.secondary) {
            this.secondary.save(key, data).catch(error => {
                console.warn('Secondary storage sync failed:', error);
            });
        }

        return primaryResult;
    }

    /** Load from primary, falling back to secondary if not found. */
    async load(key: string): Promise<any> {
        let data = await this.primary.load(key);

        if (data === null && this.secondary) {
            data = await this.secondary.load(key);

            if (data !== null) {
                console.log('Restored data from secondary storage');
                await this.primary.save(key, data);
            }
        }

        return data;
    }

    /** Delete from both backends. */
    async delete(key: string): Promise<boolean> {
        const primaryResult = await this.primary.delete(key);

        if (this.secondary) {
            await this.secondary.delete(key).catch(() => {});
        }

        return primaryResult;
    }

    /** Check existence in primary. */
    async exists(key: string): Promise<boolean> {
        return this.primary.exists(key);
    }

    /** List keys from primary. */
    async listKeys(): Promise<string[]> {
        return this.primary.listKeys();
    }

    /** Clear both backends. */
    async clear(): Promise<boolean> {
        const primaryResult = await this.primary.clear();

        if (this.secondary) {
            await this.secondary.clear().catch(() => {});
        }

        return primaryResult;
    }
}