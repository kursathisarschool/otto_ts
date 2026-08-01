/**
 * @fileoverview Serializer Pattern -- converts the entire Otto application
 * state to and from a JSON string.
 * @module persistence/Serializer
 */
import type { TabManager, Tab } from '../core/TabManager.js';
import type { SceneState } from '../core/SceneState.js';

export class Serializer {
    /** Format version stamp written into every serialized payload. */
    static VERSION = '2.0.0';

    /** Convert a fully-populated TabManager into a human-readable JSON string. */
    static serialize(tabManager: TabManager): string {
        const data = {
            version: this.VERSION,
            activeTab: tabManager.activeTabId,
            tabs: tabManager.tabs.map(tab => this.serializeTab(tab))
        };
        return JSON.stringify(data, null, 2);
    }

    /** Reconstruct a TabManager from a JSON string previously produced by serialize(). */
    static async deserialize(json: string): Promise<TabManager> {
        let data: any = JSON.parse(json);

        if (!data.version) {
            throw new Error('Invalid file format: missing version');
        }

        const { migrate } = await import('./Migrations.js');
        data = migrate(data);

        if (data.version !== this.VERSION) {
            throw new Error(
                `Unsupported scene version "${data.version}" (this build reads ${this.VERSION}). ` +
                `The file may have been saved by a newer version of Otto.`
            );
        }

        const { TabManager } = await import('../core/TabManager.js');
        const tabManager = new TabManager();

        tabManager.tabs = [];
        tabManager.activeTabId = null;

        if (data.tabs && Array.isArray(data.tabs)) {
            for (const tabData of data.tabs) {
                const tab = await this.deserializeTab(tabData);
                tabManager.tabs.push(tab);
            }
        }

        if (data.activeTab && tabManager.tabs.length > 0) {
            const activeTab = tabManager.tabs.find(t => t.id === data.activeTab);
            tabManager.activeTabId = activeTab ? data.activeTab : tabManager.tabs[0].id;
        } else if (tabManager.tabs.length > 0) {
            tabManager.activeTabId = tabManager.tabs[0].id;
        }

        return tabManager;
    }

    /** Extract the persisted state of a single Tab into a plain object. */
    static serializeTab(tab: Tab): any {
        return {
            id: tab.id,
            name: tab.name,
            parameters: tab.sceneState.parameterStore.toJSON().parameters,
            shapes: tab.sceneState.shapeStore.toJSON().shapes,
            edgeJoinery: tab.sceneState.shapeStore.toJSON().edgeJoinery,
            selectedShapeId: tab.sceneState.shapeStore.selectedShapeId,
            viewport: { ...tab.sceneState.viewport }
        };
    }

    /** Reconstruct a single Tab from a plain object previously produced by serializeTab(). */
    static async deserializeTab(json: any): Promise<Tab> {
        const { Tab } = await import('../core/TabManager.js');
        const { SceneState } = await import('../core/SceneState.js');

        const sceneState = new SceneState();

        if (json.parameters) {
            sceneState.parameterStore.fromJSON({ parameters: json.parameters });
        }

        if (json.shapes) {
            await sceneState.shapeStore.fromJSON({
                shapes: json.shapes,
                selectedShapeId: json.selectedShapeId || null,
                edgeJoinery: json.edgeJoinery || []
            });
        }

        if (json.viewport) {
            sceneState.viewport = { ...json.viewport };
        }

        const tab = new Tab(json.id, json.name, sceneState);
        return tab;
    }

    /** Serialize a standalone SceneState (without its containing tab) into a plain object. */
    static serializeSceneState(sceneState: SceneState): any {
        return {
            parameters: sceneState.parameterStore.toJSON().parameters,
            shapes: sceneState.shapeStore.toJSON().shapes,
            edgeJoinery: sceneState.shapeStore.toJSON().edgeJoinery,
            selectedShapeId: sceneState.shapeStore.selectedShapeId,
            viewport: { ...sceneState.viewport }
        };
    }

    /** Reconstruct a standalone SceneState from a plain object previously produced by serializeSceneState(). */
    static async deserializeSceneState(json: any): Promise<SceneState> {
        const { SceneState } = await import('../core/SceneState.js');
        const sceneState = new SceneState();

        if (json.parameters) {
            await sceneState.parameterStore.fromJSON({ parameters: json.parameters });
        }

        if (json.shapes) {
            await sceneState.shapeStore.fromJSON({
                shapes: json.shapes,
                selectedShapeId: json.selectedShapeId || null,
                edgeJoinery: json.edgeJoinery || []
            });
        }

        if (json.viewport) {
            sceneState.viewport = { ...json.viewport };
        }

        return sceneState;
    }
}