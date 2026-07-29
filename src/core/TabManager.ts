/**
 * @fileoverview Multi-tab scene management for Otto.
 * @module core/TabManager
 */
import EventBus, { EVENTS } from '../events/EventBus.js';
import { HistoryManager } from '../commands/HistoryManager.js';
import { SceneState } from './SceneState.js';

/**
 * Lightweight data holder representing a single tab in the tab bar.
 */
export class Tab {
    /** Per-tab undo/redo stack. Living on the Tab means history survives tab switches. */
    history: HistoryManager;
    id: string;
    name: string;
    sceneState: SceneState;

    constructor(id: string, name: string, sceneState: SceneState) {
        this.history = new HistoryManager(sceneState);
        this.id = id;
        this.name = name;
        this.sceneState = sceneState;
    }
}

/**
 * Owns the ordered list of tabs, tracks which one is active, and exposes
 * the CRUD operations that the tab-bar UI calls.
 */
export class TabManager {
    /** Ordered array of all open tabs. */
    tabs: Tab[];
    /** The ID of the tab that is currently displayed. */
    activeTabId: string | null;
    eventBus: typeof EventBus;

    constructor() {
        this.tabs = [];
        this.activeTabId = null;
        this.eventBus = EventBus;

        this.createTab('Scene 1');
    }

    /** Factory method: create a new tab, append it to the tab list, and conditionally activate it. */
    createTab(name: string): Tab {
        const id = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const sceneState = new SceneState();
        const tab = new Tab(id, name, sceneState);

        this.tabs.push(tab);
        if (!this.activeTabId && this.tabs.length > 0) {
            this.activeTabId = this.tabs[0].id;
        }

        this.eventBus.emit(EVENTS.TAB_CREATED, { tab });
        if (this.activeTabId === id) {
            this.eventBus.emit(EVENTS.TAB_SWITCHED, { tabId: id, tab });
        }

        return tab;
    }

    /** Close the tab with the given ID. The last remaining tab cannot be closed. */
    closeTab(id: string): void {
        if (this.tabs.length <= 1) {
            return;
        }

        const tabIndex = this.tabs.findIndex(tab => tab.id === id);
        if (tabIndex === -1) return;

        const wasActive = this.activeTabId === id;
        this.tabs.splice(tabIndex, 1);

        if (wasActive) {
            const newActiveIndex = Math.min(tabIndex, this.tabs.length - 1);
            this.activeTabId = this.tabs[newActiveIndex].id;
            this.eventBus.emit(EVENTS.TAB_SWITCHED, {
                tabId: this.activeTabId,
                tab: this.tabs[newActiveIndex]
            });
        }

        this.eventBus.emit(EVENTS.TAB_CLOSED, { tabId: id });
    }

    /** Make the tab with the given ID the active (visible) tab. */
    switchTab(id: string): void {
        const tab = this.tabs.find(t => t.id === id);
        if (!tab || tab.id === this.activeTabId) return;

        this.activeTabId = id;
        this.eventBus.emit(EVENTS.TAB_SWITCHED, { tabId: id, tab });
    }

    /** Change the display name of a tab. */
    renameTab(id: string, newName: string): void {
        const tab = this.tabs.find(t => t.id === id);
        if (!tab || !newName.trim()) return;

        tab.name = newName.trim();
        this.eventBus.emit(EVENTS.TAB_SWITCHED, { tabId: id, tab });
    }

    /** Return the Tab object that is currently active, or null. */
    getActiveTab(): Tab | null {
        return this.tabs.find(tab => tab.id === this.activeTabId) || null;
    }

    /** Convenience accessor that returns the SceneState of the active tab directly. */
    getActiveScene(): SceneState | null {
        const activeTab = this.getActiveTab();
        return activeTab ? activeTab.sceneState : null;
    }

    /** Look up a tab by its ID. */
    getTab(id: string): Tab | null {
        return this.tabs.find(tab => tab.id === id) || null;
    }

    /** Produce a plain-object snapshot of the full tab list and the active tab pointer. */
    toJSON(): { activeTabId: string | null; tabs: { id: string; name: string; sceneState: any }[] } {
        return {
            activeTabId: this.activeTabId,
            tabs: this.tabs.map(tab => ({
                id: tab.id,
                name: tab.name,
                sceneState: tab.sceneState.toJSON()
            }))
        };
    }

    /** Reconstruct the full tab list from a previously-serialised snapshot. */
    async fromJSON(json: any): Promise<void> {
        if (!json || !json.tabs) {
            throw new Error('Invalid TabManager JSON');
        }

        this.tabs = [];

        for (const tabJson of json.tabs) {
            const sceneState = new SceneState();
            await sceneState.fromJSON(tabJson.sceneState);
            const tab = new Tab(tabJson.id, tabJson.name, sceneState);
            this.tabs.push(tab);
        }

        this.activeTabId = json.activeTabId || (this.tabs.length > 0 ? this.tabs[0].id : null);

        if (this.activeTabId) {
            const activeTab = this.getActiveTab();
            if (activeTab) {
                this.eventBus.emit(EVENTS.TAB_SWITCHED, { tabId: this.activeTabId, tab: activeTab });
            }
        }
    }
}