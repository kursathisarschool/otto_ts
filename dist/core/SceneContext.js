export class SceneContext {
    /**
     * @param tabManagerSource - The TabManager, or a function returning the
     *   CURRENT TabManager. Pass a function when the owner may replace its
     *   TabManager instance so the context never goes stale.
     */
    constructor(tabManagerSource) {
        this.tabManagerSource = tabManagerSource;
    }
    get tabManager() {
        return typeof this.tabManagerSource === 'function'
            ? this.tabManagerSource()
            : this.tabManagerSource;
    }
    /** The active tab. */
    get activeTab() {
        return this.tabManager.getActiveTab();
    }
    /** The active scene. */
    get scene() {
        return this.tabManager.getActiveScene();
    }
    get shapeStore() {
        return this.scene.shapeStore;
    }
    get parameterStore() {
        return this.scene.parameterStore;
    }
    get bindingResolver() {
        return this.scene.bindingResolver;
    }
    get selection() {
        return this.scene.shapeStore.selection;
    }
    /** The live viewport object. */
    get viewport() {
        return this.scene.viewport;
    }
    /** The active tab's undo history. */
    get history() {
        return this.activeTab.history;
    }
}
