/**
 * @fileoverview Shape commands — every undoable shape mutation.
 * @module commands/shapeCommands
 */
import { Command, type SceneState } from './Command.js';
import { ShapeRegistry } from '../models/shapes/ShapeRegistry.js';
import { createBindingFromJSON } from '../models/BindingRegistry.js';
import { LiteralBinding } from '../models/Binding.js';
import EventBus, { EVENTS } from '../events/EventBus.js';

const COALESCE_WINDOW_MS = 1200;

interface AddShapeOptions {
    select?: boolean;
}

/**
 * Add one shape. First execution can use a live instance; redo rebuilds
 * from the captured JSON.
 */
export class AddShapeCommand extends Command {
    shapeJSON: any;
    select: boolean;
    private _liveShape: any;

    constructor(shape: any, { select = true }: AddShapeOptions = {}) {
        super(`Add ${shape.type}`);
        this.shapeJSON = shape.toJSON();
        this.select = select;
        this._liveShape = shape;
    }

    execute(scene: SceneState): void {
        const shape = this._liveShape ?? ShapeRegistry.fromJSON(this.shapeJSON);
        this._liveShape = null;
        scene.shapeStore.add(shape);
        if (this.select) {
            scene.shapeStore.setSelected(shape.id);
        }
    }

    undo(scene: SceneState): void {
        scene.shapeStore.remove(this.shapeJSON.id);
        scene.shapeStore.clearSelection();
    }
}

/**
 * Remove shapes; undo restores them with paint order, joinery, and
 * selection intact.
 */
export class RemoveShapesCommand extends Command {
    shapeIds: string[];
    removed: { json: any; joinery: [string, any][] }[] | null;
    storeOrder: string[] | null;
    selectionIds: string[] | null;

    constructor(shapeIds: string[]) {
        super(`Delete ${shapeIds.length} shape(s)`);
        this.shapeIds = shapeIds;
        this.removed = null;
        this.storeOrder = null;
        this.selectionIds = null;
    }

    execute(scene: SceneState): void {
        const store = scene.shapeStore;
        this.storeOrder = Array.from(store.shapes.keys());
        this.selectionIds = Array.from(store.selection.selectedShapeIds);
        this.removed = [];

        this.shapeIds.forEach((id: string) => {
            const shape = store.get(id);
            if (!shape) return;
            const prefix = `${id}:`;
            const joinery = Array.from(store.edgeJoinery.entries() as [string, any][])
                .filter(([key]) => key.startsWith(prefix));
            this.removed!.push({ json: shape.toJSON(), joinery });
            store.remove(id);
        });
        store.clearSelection();
    }

    undo(scene: SceneState): void {
        const store = scene.shapeStore;
        this.removed!.forEach(({ json, joinery }) => {
            store.add(ShapeRegistry.fromJSON(json));
            joinery.forEach(([key, value]) => {
                store.edgeJoinery.set(key, { ...value });
            });
        });

        const ordered = new Map();
        this.storeOrder!.forEach((id: string) => {
            if (store.shapes.has(id)) {
                ordered.set(id, store.shapes.get(id));
            }
        });
        store.shapes.forEach((shape: any, id: string) => {
            if (!ordered.has(id)) ordered.set(id, shape);
        });
        store.shapes.clear();
        ordered.forEach((shape, id) => store.shapes.set(id, shape));

        store.setSelectedIds(this.selectionIds);
        EventBus.emit(EVENTS.EDGE_JOINERY_CHANGED, {});
    }
}

interface DuplicateOptions {
    offsetX?: number;
    offsetY?: number;
}

/**
 * Duplicate shapes via clone(), offset, and select the copies.
 */
export class DuplicateShapesCommand extends Command {
    shapeIds: string[];
    offsetX: number;
    offsetY: number;
    createdJSONs: any[] | null;

    constructor(shapeIds: string[], { offsetX = 20, offsetY = 20 }: DuplicateOptions = {}) {
        super(`Duplicate ${shapeIds.length} shape(s)`);
        this.shapeIds = shapeIds;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.createdJSONs = null;
    }

    execute(scene: SceneState): void {
        const store = scene.shapeStore;

        if (this.createdJSONs) {
            this.createdJSONs.forEach((json: any) => store.add(ShapeRegistry.fromJSON(json)));
            store.setSelectedIds(this.createdJSONs.map((json: any) => json.id));
            return;
        }

        this.createdJSONs = [];
        this.shapeIds.forEach((id: string) => {
            const original = store.get(id);
            if (!original) return;
            const copy = original.clone();
            copy.id = ShapeRegistry.generateId(original.type, store);
            copy.translate(this.offsetX, this.offsetY);
            syncLiteralBindingsForTranslate(copy);
            store.add(copy);
            this.createdJSONs!.push(copy.toJSON());
        });
        store.setSelectedIds(this.createdJSONs.map((json: any) => json.id));
    }

    undo(scene: SceneState): void {
        (this.createdJSONs ?? []).forEach((json: any) => {
            scene.shapeStore.remove(json.id);
        });
        scene.shapeStore.clearSelection();
    }
}

interface MutationEntry {
    before: any;
    after: any;
}

/**
 * Generic gesture command: {before, after} full-shape snapshots.
 */
export class MutateShapesCommand extends Command {
    entries: Record<string, MutationEntry>;

    constructor(label: string, entries: Record<string, MutationEntry>) {
        super(label);
        this.entries = entries;
    }

    execute(scene: SceneState): void {
        for (const { after } of Object.values(this.entries)) {
            scene.shapeStore.replace(ShapeRegistry.fromJSON(after));
        }
    }

    undo(scene: SceneState): void {
        for (const { before } of Object.values(this.entries)) {
            scene.shapeStore.replace(ShapeRegistry.fromJSON(before));
        }
    }

    coalesceWith(next: Command): boolean {
        if (!(next instanceof MutateShapesCommand)) return false;
        if (next.label !== this.label) return false;
        if (next.timestamp - this.timestamp > COALESCE_WINDOW_MS) return false;
        const ids = Object.keys(this.entries);
        const nextIds = Object.keys(next.entries);
        if (ids.length !== nextIds.length || !nextIds.every((id) => this.entries[id])) return false;

        nextIds.forEach((id) => {
            this.entries[id].after = next.entries[id].after;
        });
        this.timestamp = next.timestamp;
        return true;
    }
}

/**
 * Attach, replace, or clear a binding on one property.
 */
export class SetBindingCommand extends Command {
    shapeId: string;
    property: string;
    bindingJSON: any;
    previousBindingJSON: any;

    constructor(shapeId: string, property: string, bindingJSON: any) {
        super(`Bind ${shapeId}.${property}`);
        this.shapeId = shapeId;
        this.property = property;
        this.bindingJSON = bindingJSON;
        this.previousBindingJSON = undefined;
    }

    execute(scene: SceneState): void {
        const shape = scene.shapeStore.get(this.shapeId);
        if (!shape) return;
        const existing = shape.getBinding(this.property);
        this.previousBindingJSON = existing ? existing.toJSON() : null;
        this.applyBinding(scene, shape, this.bindingJSON);
    }

    undo(scene: SceneState): void {
        const shape = scene.shapeStore.get(this.shapeId);
        if (!shape) return;
        this.applyBinding(scene, shape, this.previousBindingJSON);
    }

    private applyBinding(scene: SceneState, shape: any, bindingJSON: any): void {
        if (bindingJSON) {
            scene.shapeStore.updateBinding(this.shapeId, this.property, createBindingFromJSON(bindingJSON));
        } else {
            delete shape.bindings[this.property];
            EventBus.emit(EVENTS.PARAM_CHANGED, { shapeId: this.shapeId, property: this.property });
        }
    }
}

/**
 * Set one literal property value.
 */
export class SetShapePropertyCommand extends Command {
    shapeId: string;
    property: string;
    value: any;
    previousValue: any;
    previousBindingJSON: any;

    constructor(shapeId: string, property: string, value: any) {
        super(`Set ${shapeId}.${property}`);
        this.shapeId = shapeId;
        this.property = property;
        this.value = value;
        this.previousValue = undefined;
        this.previousBindingJSON = undefined;
    }

    execute(scene: SceneState): void {
        const shape = scene.shapeStore.get(this.shapeId);
        if (!shape) return;
        this.previousValue = shape[this.property];
        const binding = shape.getBinding(this.property);
        this.previousBindingJSON = binding ? binding.toJSON() : null;

        this.apply(shape, this.value);
    }

    undo(scene: SceneState): void {
        const shape = scene.shapeStore.get(this.shapeId);
        if (!shape) return;
        shape[this.property] = this.previousValue;
        if (shape.getBindableProperties().includes(this.property)) {
            if (this.previousBindingJSON) {
                shape.bindings[this.property] = createBindingFromJSON(this.previousBindingJSON);
            } else {
                delete shape.bindings[this.property];
            }
        }
        this.emitChange(shape);
    }

    coalesceWith(next: Command): boolean {
        if (!(next instanceof SetShapePropertyCommand)) return false;
        if (next.shapeId !== this.shapeId || next.property !== this.property) return false;
        if (next.timestamp - this.timestamp > COALESCE_WINDOW_MS) return false;
        this.value = next.value;
        this.timestamp = next.timestamp;
        return true;
    }

    private apply(shape: any, value: any): void {
        shape[this.property] = value;
        if (shape.getBindableProperties().includes(this.property)) {
            const binding = shape.getBinding(this.property);
            if (!binding) {
                shape.setBinding(this.property, new LiteralBinding(value));
            } else if (binding.type === 'literal') {
                binding.value = value;
            }
        }
        this.emitChange(shape);
    }

    /** Emit the right change events so model observers and the canvas refresh. */
    private emitChange(shape: any): void {
        EventBus.emit(EVENTS.SHAPE_UPDATED, { id: this.shapeId, shape });
        EventBus.emit(EVENTS.PARAM_CHANGED, { shapeId: this.shapeId, property: this.property });
    }
}

/**
 * Sync literal bindings on a shape's translated properties to the current
 * raw values.
 */
export function syncLiteralBindingsForTranslate(shape: any): void {
    const schema = shape.constructor.fullSchema ?? {};
    for (const [prop, desc] of Object.entries(schema) as [string, any][]) {
        if (!desc.translate || !desc.bindable) continue;
        const binding = shape.getBinding(prop);
        if (!binding) {
            shape.setBinding(prop, new LiteralBinding(shape[prop]));
        } else if (binding.type === 'literal') {
            binding.value = shape[prop];
        }
    }
}