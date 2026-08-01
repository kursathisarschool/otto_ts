/**
 * FileManager using Adapter Pattern
 * Handles file import/export operations
 */

import { Serializer } from './Serializer.js';
import type { TabManager } from '../core/TabManager.js';

export class FileManager {
    private readonly tabManager: TabManager;

    constructor(tabManager: TabManager) {
        this.tabManager = tabManager;
    }

    /**
     * Export to file (.pds format)
     *
     * @param filename Optional filename
     */
    exportToFile(filename?: string): boolean {
        try {
            const json: string = Serializer.serialize(this.tabManager);

            const date = new Date().toISOString().split('T')[0];
            const defaultFilename = filename ?? `nova_otto_${date}.pds`;

            this.createDownload(json, defaultFilename);
            return true;
        } catch (error: unknown) {
            console.error('Export error:', error);
            return false;
        }
    }

    /**
     * Import from file
     *
     * @param file File to import
     * @returns Imported TabManager or null
     */
    async importFromFile(file: File): Promise<TabManager | null> {
        try {
            if (!file) {
                throw new Error('No file provided');
            }

            if (!file.name.toLowerCase().endsWith('.pds')) {
                throw new Error('Invalid file format. Expected a .pds file');
            }

            const content = await this.readFile(file);
            return await Serializer.deserialize(content);
        } catch (error: unknown) {
            console.error('Import error:', error);

            const message =
                error instanceof Error
                    ? error.message
                    : 'An unknown import error occurred';

            window.alert(`Error importing file: ${message}`);
            return null;
        }
    }

    /**
     * Show import dialog
     *
     * @returns Imported TabManager or null
     */
    showImportDialog(): Promise<TabManager | null> {
        return new Promise<TabManager | null>((resolve) => {
            const input = document.createElement('input');

            input.type = 'file';
            input.accept = '.pds';

            input.addEventListener(
                'change',
                async (event: Event): Promise<void> => {
                    const target = event.target as HTMLInputElement;
                    const file = target.files?.[0];

                    if (!file) {
                        resolve(null);
                        return;
                    }

                    const tabManager = await this.importFromFile(file);
                    resolve(tabManager);
                },
                { once: true }
            );

            input.click();
        });
    }

    /**
     * Create and trigger a file download
     *
     * @param content File content
     * @param filename Download filename
     */
    private createDownload(content: string, filename: string): void {
        const blob = new Blob([content], {
            type: 'application/json;charset=utf-8'
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        try {
            link.href = url;
            link.download = filename;

            document.body.appendChild(link);
            link.click();
        } finally {
            link.remove();
            URL.revokeObjectURL(url);
        }
    }

    /**
     * Read file content
     *
     * @param file File to read
     */
    private readFile(file: File): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (): void => {
                if (typeof reader.result === 'string') {
                    resolve(reader.result);
                    return;
                }

                reject(new Error('File content is not valid text'));
            };

            reader.onerror = (): void => {
                reject(reader.error ?? new Error('Failed to read file'));
            };

            reader.readAsText(file);
        });
    }
}