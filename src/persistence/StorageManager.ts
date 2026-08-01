/**
 * @fileoverview Observer Pattern -- StorageManager keeps the application's
 * state persisted to localStorage at all times.
 * @module persistence/StorageManager
 */
import EventBus, { EVENTS } from '../events/EventBus.js';
import { Serializer } from './Serializer.js';
import type { TabManager } from '../core/TabManager.js';

/**
 * Manages automatic and manual persistence of the full application state to
 * localStorage. Acts as an observer of all state-mutating events emitted by
 * EventBus.
 */
export class StorageManager {
    /** The localStorage key under which the serialized application state is stored. */
    static AUTOSAVE_KEY = 'nova_otto_autosave';

    /** Interval in milliseconds between periodic safety-net autosaves. */
    static AUTOSAVE_INTERVAL = 30000;

    tabManager: TabManager;
    serializer: typeof Serializer;
    private autoSaveTimer: ReturnType<typeof setInterval> | null;

    constructor(tabManager: TabManager, serializer?: typeof Serializer) {
        this.tabManager = tabManager;
        this.serializer = Serializer;
        this.autoSaveTimer = null;

        this.subscribeToEvents();
    }

    /** Wire up the Observer Pattern subscriptions. */
    subscribeToEvents(): void {
        EventBus.subscribe(EVENTS.SHAPE_ADDED, () => this.autoSave());
        EventBus.subscribe(EVENTS.SHAPE_REMOVED, () => this.autoSave());
        EventBus.subscribe(EVENTS.SHAPE_MOVED, () => this.autoSave());
        EventBus.subscribe(EVENTS.PARAM_ADDED, () => this.autoSave());
        EventBus.subscribe(EVENTS.PARAM_REMOVED, () => this.autoSave());
        EventBus.subscribe(EVENTS.PARAM_CHANGED, () => this.autoSave());
        EventBus.subscribe(EVENTS.EDGE_JOINERY_CHANGED, () => this.autoSave());
        EventBus.subscribe(EVENTS.TAB_CREATED, () => this.autoSave());
        EventBus.subscribe(EVENTS.TAB_CLOSED, () => this.autoSave());
        EventBus.subscribe(EVENTS.TAB_SWITCHED, () => this.autoSave());
    }

    /** Start (or restart) the periodic safety-net autosave timer. */
    startAutoSave(): void {
        if (this.autoSaveTimer) {
            this.stopAutoSave();
        }

        this.autoSaveTimer = setInterval(() => {
            this.autoSave();
        }, StorageManager.AUTOSAVE_INTERVAL);

        console.log('AutoSave started');
    }

    /** Stop the periodic autosave timer if one is currently running. */
    stopAutoSave(): void {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
            console.log('AutoSave stopped');
        }
    }

    /** Serialize the current application state and write it to localStorage. */
    autoSave(): void {
        try {
            const json = Serializer.serialize(this.tabManager);
            localStorage.setItem(StorageManager.AUTOSAVE_KEY, json);
            EventBus.emit(EVENTS.SCENE_SAVED, { type: 'autosave' });
        } catch (error) {
            console.error('AutoSave error:', error);
        }
    }

    /** Perform an explicit (manual) save. */
    save(): boolean {
        try {
            const json = Serializer.serialize(this.tabManager);
            localStorage.setItem(StorageManager.AUTOSAVE_KEY, json);
            EventBus.emit(EVENTS.SCENE_SAVED, { type: 'manual' });
            return true;
        } catch (error) {
            console.error('Save error:', error);
            return false;
        }
    }

    /** Read the most recent autosave from localStorage and reconstruct the TabManager. */
    async load(): Promise<TabManager | null> {
        try {
            const json = localStorage.getItem(StorageManager.AUTOSAVE_KEY);
            if (!json) {
                return null;
            }

            const tabManager = await Serializer.deserialize(json);
            EventBus.emit(EVENTS.SCENE_LOADED, { type: 'autosave' });
            return tabManager;
        } catch (error) {
            console.error('Load error:', error);
            return null;
        }
    }

    /** Remove the autosave entry from localStorage. */
    clear(): void {
        localStorage.removeItem(StorageManager.AUTOSAVE_KEY);
        console.log('Storage cleared');
    }

    /** Check whether a previous autosave exists in localStorage. */
    hasAutoSave(): boolean {
        return localStorage.getItem(StorageManager.AUTOSAVE_KEY) !== null;
    }
}