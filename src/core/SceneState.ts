import { ParameterStore } from "./ParameterStore.js";
import { BindingResolver } from "./BindingResolver.js";
import { ShapeStore } from "./ShapeStore.js";
// TODO: ExpressionParser'ı bulup gerçek import ekleyeceğiz.

type ExpressionParser = any;

interface Viewport {
    x: number;
    y: number;
    zoom: number;
}

export class SceneState {
    /** Repository of user-defined numeric parameters (sliders). Root of the binding dependency chain. */
    parameterStore: ParameterStore;
    /** Parser that can evaluate mathematical expressions referencing parameters. */
    expressionParser: ExpressionParser;
    /** Facade that resolves any Binding into a concrete number. */
    bindingResolver: BindingResolver;
    /** Central repository for all shapes in this scene. */
    shapeStore: ShapeStore;
    /** Current pan and zoom state of the canvas viewport. */
    viewport: Viewport;

    constructor() {
        this.parameterStore = new ParameterStore();
        this.expressionParser = {} as ExpressionParser; // TODO: gerçek ExpressionParser bulununca düzelt
        this.bindingResolver = new BindingResolver(this.parameterStore, this.expressionParser);
        this.shapeStore = new ShapeStore(this.parameterStore, this.bindingResolver);
        this.viewport = {
            x: 0,
            y: 0,
            zoom: 1
        };
    }

    /** Serialise the scene to a plain object for long-term persistence. */
    toJSON(): { parameterStore: any; shapeStore: any; viewport: Viewport } {
        return {
            parameterStore: this.parameterStore.toJSON(),
            shapeStore: this.shapeStore.toJSON(),
            viewport: { ...this.viewport }
        };
    }

    /** Restore the scene from a previously-serialised JSON object. */
    async fromJSON(json: any): Promise<void> {
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