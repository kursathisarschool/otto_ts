import { StorageBackend } from '../StorageBackend.js';

interface CloudStorageOptions {
    namespace?: string;
    apiUrl?: string;
    authToken?: string;
    timeout?: number;
}

interface SyncResult {
    uploaded?: string[];
    downloaded?: string[];
    failed: string[];
}

/**
 * CloudStorageBackend - Cloud Storage Implementation (Stub)
 */
export class CloudStorageBackend extends StorageBackend {
    apiUrl: string | null;
    authToken: string | null;
    timeout: number;
    private _isAuthenticated: boolean;

    constructor(options: CloudStorageOptions = {}) {
        super(options);
        this.apiUrl = options.apiUrl || null;
        this.authToken = options.authToken || null;
        this.timeout = options.timeout || 30000;
        this._isAuthenticated = false;
    }

    getType(): string {
        return 'cloud';
    }

    async isAvailable(): Promise<boolean> {
        if (!this.apiUrl) {
            return false;
        }

        try {
            const response = await this._fetch('/health', { method: 'GET' });
            return response.ok;
        } catch (error: any) {
            console.warn('Cloud storage not available:', error.message);
            return false;
        }
    }

    async getMaxSize(): Promise<number> {
        return 100 * 1024 * 1024;
    }

    async getUsedSize(): Promise<number> {
        if (!this._isAuthenticated) {
            return 0;
        }

        try {
            const response = await this._fetch('/usage', { method: 'GET' });
            const data = await response.json();
            return data.usedBytes || 0;
        } catch (error) {
            console.warn('Failed to get cloud usage:', error);
            return 0;
        }
    }

    /** Authenticate with the cloud service. */
    async authenticate(token: string): Promise<boolean> {
        this.authToken = token;

        try {
            const response = await this._fetch('/auth/verify', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            this._isAuthenticated = response.ok;
            return this._isAuthenticated;
        } catch (error) {
            console.error('Cloud authentication failed:', error);
            this._isAuthenticated = false;
            return false;
        }
    }

    /** Check if authenticated. */
    isAuthenticated(): boolean {
        return this._isAuthenticated;
    }

    async save(key: string, data: any): Promise<boolean> {
        if (!this._isAuthenticated) {
            console.warn('Cloud storage: not authenticated');
            return false;
        }

        try {
            const fullKey = this.getFullKey(key);
            const response = await this._fetch(`/scenes/${encodeURIComponent(fullKey)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ data, timestamp: Date.now() })
            });

            return response.ok;
        } catch (error) {
            console.error('Cloud save error:', error);
            return false;
        }
    }

    async load(key: string): Promise<any> {
        if (!this._isAuthenticated) {
            console.warn('Cloud storage: not authenticated');
            return null;
        }

        try {
            const fullKey = this.getFullKey(key);
            const response = await this._fetch(`/scenes/${encodeURIComponent(fullKey)}`, {
                method: 'GET'
            });

            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            return result.data;
        } catch (error) {
            console.error('Cloud load error:', error);
            return null;
        }
    }

    async delete(key: string): Promise<boolean> {
        if (!this._isAuthenticated) {
            console.warn('Cloud storage: not authenticated');
            return false;
        }

        try {
            const fullKey = this.getFullKey(key);
            const response = await this._fetch(`/scenes/${encodeURIComponent(fullKey)}`, {
                method: 'DELETE'
            });

            return response.ok;
        } catch (error) {
            console.error('Cloud delete error:', error);
            return false;
        }
    }

    async exists(key: string): Promise<boolean> {
        if (!this._isAuthenticated) {
            return false;
        }

        try {
            const fullKey = this.getFullKey(key);
            const response = await this._fetch(`/scenes/${encodeURIComponent(fullKey)}`, {
                method: 'HEAD'
            });

            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async listKeys(): Promise<string[]> {
        if (!this._isAuthenticated) {
            return [];
        }

        try {
            const response = await this._fetch('/scenes', { method: 'GET' });

            if (!response.ok) {
                return [];
            }

            const data = await response.json();
            const prefix = `${this.namespace}_`;

            return (data.keys || [])
                .filter((key: string) => key.startsWith(prefix))
                .map((key: string) => this.getShortKey(key));
        } catch (error) {
            console.error('Cloud listKeys error:', error);
            return [];
        }
    }

    async clear(): Promise<boolean> {
        if (!this._isAuthenticated) {
            return false;
        }

        try {
            const keys = await this.listKeys();
            for (const key of keys) {
                await this.delete(key);
            }
            return true;
        } catch (error) {
            console.error('Cloud clear error:', error);
            return false;
        }
    }

    /** Internal fetch wrapper with auth and timeout. */
    async _fetch(path: string, options: RequestInit = {}): Promise<Response> {
        if (!this.apiUrl) {
            throw new Error('Cloud API URL not configured');
        }

        const url = `${this.apiUrl}${path}`;
        const headers: Record<string, string> = {
            ...(options.headers as Record<string, string> | undefined)
        };

        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                ...options,
                headers,
                signal: controller.signal
            });
            return response;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /** Sync local changes to cloud. */
    async syncFromLocal(localBackend: StorageBackend): Promise<SyncResult> {
        const localKeys = await localBackend.listKeys();
        const uploaded: string[] = [];
        const failed: string[] = [];

        for (const key of localKeys) {
            try {
                const data = await localBackend.load(key);
                const success = await this.save(key, data);
                if (success) {
                    uploaded.push(key);
                } else {
                    failed.push(key);
                }
            } catch (error) {
                failed.push(key);
            }
        }

        return { uploaded, failed };
    }

    /** Download cloud data to local. */
    async syncToLocal(localBackend: StorageBackend): Promise<SyncResult> {
        const cloudKeys = await this.listKeys();
        const downloaded: string[] = [];
        const failed: string[] = [];

        for (const key of cloudKeys) {
            try {
                const data = await this.load(key);
                const success = await localBackend.save(key, data);
                if (success) {
                    downloaded.push(key);
                } else {
                    failed.push(key);
                }
            } catch (error) {
                failed.push(key);
            }
        }

        return { downloaded, failed };
    }
}