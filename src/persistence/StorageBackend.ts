/**
 * StorageBackend - Abstract Interface for Storage Backends
 * @module persistence/StorageBackend
 */
interface NameSpaceOptions {
    namespace?: string;
}

export class StorageBackend {
    namespace: string;

    constructor(options: NameSpaceOptions = {}) {
        if (this.constructor === StorageBackend) {
            throw new Error('StorageBackend is abstract and cannot be instantiated directly');
        }

        this.namespace = options.namespace || 'otto_v2';
    }

    /** Get backend type identifier. */
    getType(): string {
        throw new Error('getType() must be implemented by subclass');
    }

    /** Check if the backend is available/supported. */
    async isAvailable(): Promise<boolean> {
        throw new Error('isAvailable() must be implemented by subclass');
    }

    /** Get maximum storage size in bytes (approximate). */
    async getMaxSize(): Promise<number> {
        throw new Error('getMaxSize() must be implemented by subclass');
    }

    /** Get current used storage size in bytes (approximate). */
    async getUsedSize(): Promise<number> {
        throw new Error('getUsedSize() must be implemented by subclass');
    }

    /** Save data with a key. */
    async save(key: string, data: any): Promise<boolean> {
        throw new Error('save() must be implemented by subclass');
    }

    /** Load data by key. */
    async load(key: string): Promise<any> {
        throw new Error('load() must be implemented by subclass');
    }

    /** Delete data by key. */
    async delete(key: string): Promise<boolean> {
        throw new Error('delete() must be implemented by subclass');
    }

    /** Check if key exists. */
    async exists(key: string): Promise<boolean> {
        throw new Error('exists() must be implemented by subclass');
    }

    /** List all keys in this backend's namespace. */
    async listKeys(): Promise<string[]> {
        throw new Error('listKeys() must be implemented by subclass');
    }

    /** Clear all data in this backend's namespace. */
    async clear(): Promise<boolean> {
        throw new Error('clear() must be implemented by subclass');
    }

    /** Get the full key with namespace prefix. */
    getFullKey(key: string): string {
        return `${this.namespace}_${key}`;
    }

    /** Remove namespace prefix from key. */
    getShortKey(fullKey: string): string {
        const prefix = `${this.namespace}_`;
        if (fullKey.startsWith(prefix)) {
            return fullKey.substring(prefix.length);
        }
        return fullKey;
    }

    /** Serialize data to string. */
    serialize(data: any): string {
        return JSON.stringify(data);
    }

    /** Deserialize string to data. */
    deserialize(str: string): any {
        if (!str) return null;
        return JSON.parse(str);
    }
}