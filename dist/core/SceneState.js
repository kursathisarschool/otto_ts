import { ParameterStore } from "./ParameterStore.js";
import { BindingResolver } from "./BindingResolver.js";
import { ShapeStore } from "./ShapeStore.js";
export class SceneState {
    constructor() {
        this.parameterStore = new ParameterStore();
        this.expressionParser = {}; // TODO: gerçek ExpressionParser bulununca düzelt
        this.bindingResolver = new BindingResolver(this.parameterStore, this.expressionParser);
        this.shapeStore = new ShapeStore(this.parameterStore, this.bindingResolver);
        this.viewport = {
            x: 0,
            y: 0,
            zoom: 1
        };
    }
    /** Serialise the scene to a plain object for long-term persistence. */
    toJSON() {
        return {
            parameterStore: this.parameterStore.toJSON(),
            shapeStore: this.shapeStore.toJSON(),
            viewport: { ...this.viewport }
        };
    }
    /** Restore the scene from a previously-serialised JSON object. */
    async fromJSON(json) {
        if (!json) {
            throw new Error('Invalid SceneState JSON');
        }
        if (json.parameterStore) {
            await this.parameterStore.fromJSON(json.parameterStore);
        }
        if (json.shapeStore) {
            await this.shapeStore.fromJSON(json.shapeStore);
        }
        if (json.viewport) {
            this.viewport = { ...json.viewport };
        }
    }
}
