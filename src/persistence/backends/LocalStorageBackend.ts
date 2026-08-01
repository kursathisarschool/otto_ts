import { StorageBackend } from '../StorageBackend.js';

interface LocalStorageOptions {
    namespace?: string;
}

/**
 * LocalStorageBackend - localStorage Implementation
 */
export class LocalStorageBackend extends StorageBackend {
    constructor(options: LocalStorageOptions = {}) {
        super(options);
    }

    getType(): string {
        return 'localStorage';
    }

    async isAvailable(): Promise<boolean> {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    async getMaxSize(): Promise<number> {
        return 5 * 1024 * 1024;
    }

    async getUsedSize(): Promise<number> {
        let total = 0;
        for (const key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += (localStorage[key].length + key.length) * 2;
            }
        }
        return total;
    }

    async save(key: string, data: any): Promise<boolean> {
        try {
            const fullKey = this.getFullKey(key);
            const serialized = this.serialize(data);

            const dataSize = serialized.length * 2;
            const maxSize = await this.getMaxSize();
            const usedSize = await this.getUsedSize();

            if (usedSize + dataSize > maxSize) {
                console.warn(`LocalStorage may be full. Used: ${usedSize}, Needed: ${dataSize}`);
            }

            localStorage.setItem(fullKey, serialized);
            return true;
        } catch (error: any) {
            if (error.name === 'QuotaExceededError') {
                console.error('LocalStorage quota exceeded');
            } else {
                console.error('LocalStorage save error:', error);
            }
            return false;
        }
    }

    async load(key: string): Promise<any> {
        try {
            const fullKey = this.getFullKey(key);
            const serialized = localStorage.getItem(fullKey);

            if (serialized === null) {
                return null;
            }

            return this.deserialize(serialized);
        } catch (error) {
            console.error('LocalStorage load error:', error);
            return null;
        }
    }

    async delete(key: string): Promise<boolean> {
        try {
            const fullKey = this.getFullKey(key);
            localStorage.removeItem(fullKey);
            return true;
        } catch (error) {
            console.error('LocalStorage delete error:', error);
            return false;
        }
    }

    async exists(key: string): Promise<boolean> {
        const fullKey = this.getFullKey(key);
        return localStorage.getItem(fullKey) !== null;
    }

    async listKeys(): Promise<string[]> {
        const keys: string[] = [];
        const prefix = `${this.namespace}_`;

        for (const key in localStorage) {
            if (localStorage.hasOwnProperty(key) && key.startsWith(prefix)) {
                keys.push(this.getShortKey(key));
            }
        }

        return keys;
    }

    async clear(): Promise<boolean> {
        try {
            const keys = await this.listKeys();
            for (const key of keys) {
                await this.delete(key);
            }
            return true;
        } catch (error) {
            console.error('LocalStorage clear error:', error);
            return false;
        }
    }

    /** Get remaining space in bytes (approximate). */
    async getRemainingSpace(): Promise<number> {
        const max = await this.getMaxSize();
        const used = await this.getUsedSize();
        return Math.max(0, max - used);
    }
}