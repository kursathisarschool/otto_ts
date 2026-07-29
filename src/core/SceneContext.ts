import { Tab, TabManager } from './TabManager.js';
import { SceneState } from './SceneState.js';
import { ShapeStore } from './ShapeStore.js';
import { ParameterStore } from './ParameterStore.js';
import { BindingResolver } from './BindingResolver.js';
import { SelectionModel } from './SelectionModel.js';
import { HistoryManager } from '../commands/HistoryManager.js';

export class SceneContext {

    tabManagerSource: TabManager | (() => TabManager);

    /**
     * @param tabManagerSource - The TabManager, or a function returning the
     *   CURRENT TabManager. Pass a function when the owner may replace its
     *   TabManager instance so the context never goes stale.
     */
    constructor(tabManagerSource: TabManager | (() => TabManager)) {
        this.tabManagerSource = tabManagerSource;
    }

    get tabManager(): TabManager {
        return typeof this.tabManagerSource === 'function'
            ? this.tabManagerSource()
            : this.tabManagerSource;
    }

    /** The active tab. */
    get activeTab(): Tab | null {
        return this.tabManager.getActiveTab();
    }

    /** The active scene. */
    get scene(): SceneState | null {
        return this.tabManager.getActiveScene();
    }

    get shapeStore(): ShapeStore {
        return this.scene!.shapeStore;
    }

    get parameterStore(): ParameterStore {
        return this.scene!.parameterStore;
    }

    get bindingResolver(): BindingResolver {
        return this.scene!.bindingResolver;
    }

    get selection(): SelectionModel {
        return this.scene!.shapeStore.selection;
    }

    /** The live viewport object. */
    get viewport(): { x: number; y: number; zoom: number } {
        return this.scene!.viewport;
    }

    /** The active tab's undo history. */
    get history(): HistoryManager {
        return this.activeTab!.history;
    }
}