/**
 * @fileoverview Shape commands — every undoable shape mutation.
 * @module commands/shapeCommands
 */
import { Command } from './Command.js';
import { ShapeRegistry } from '../models/shapes/ShapeRegistry.js';
import { createBindingFromJSON } from '../models/BindingRegistry.js';
import { LiteralBinding } from '../models/Binding.js';
import EventBus, { EVENTS } from '../events/EventBus.js';
const COALESCE_WINDOW_MS = 1200;
/**
 * Add one shape. First execution can use a live instance; redo rebuilds
 * from the captured JSON.
 */
export class AddShapeCommand extends Command {
    constructor(shape, { select = true } = {}) {
        super(`Add ${shape.type}`);
        this.shapeJSON = shape.toJSON();
        this.select = select;
        this._liveShape = shape;
    }
    execute(scene) {
        const shape = this._liveShape ?? ShapeRegistry.fromJSON(this.shapeJSON);
        this._liveShape = null;
        scene.shapeStore.add(shape);
        if (this.select) {
            scene.shapeStore.setSelected(shape.id);
        }
    }
    undo(scene) {
        scene.shapeStore.remove(this.shapeJSON.id);
        scene.shapeStore.clearSelection();
    }
}
/**
 * Remove shapes; undo restores them with paint order, joinery, and
 * selection intact.
 */
export class RemoveShapesCommand extends Command {
    constructor(shapeIds) {
        super(`Delete ${shapeIds.length} shape(s)`);
        this.shapeIds = shapeIds;
        this.removed = null;
        this.storeOrder = null;
        this.selectionIds = null;
    }
    execute(scene) {
        const store = scene.shapeStore;
        this.storeOrder = Array.from(store.shapes.keys());
        this.selectionIds = Array.from(store.selection.selectedShapeIds);
        this.removed = [];
        this.shapeIds.forEach((id) => {
            const shape = store.get(id);
            if (!shape)
                return;
            const prefix = `${id}:`;
            const joinery = Array.from(store.edgeJoinery.entries())
                .filter(([key]) => key.startsWith(prefix));
            this.removed.push({ json: shape.toJSON(), joinery });
            store.remove(id);
        });
        store.clearSelection();
    }
    undo(scene) {
        const store = scene.shapeStore;
        this.removed.forEach(({ json, joinery }) => {
            store.add(ShapeRegistry.fromJSON(json));
            joinery.forEach(([key, value]) => {
                store.edgeJoinery.set(key, { ...value });
            });
        });
        const ordered = new Map();
        this.storeOrder.forEach((id) => {
            if (store.shapes.has(id)) {
                ordered.set(id, store.shapes.get(id));
            }
        });
        store.shapes.forEach((shape, id) => {
            if (!ordered.has(id))
                ordered.set(id, shape);
        });
        store.shapes.clear();
        ordered.forEach((shape, id) => store.shapes.set(id, shape));
        store.setSelectedIds(this.selectionIds);
        EventBus.emit(EVENTS.EDGE_JOINERY_CHANGED, {});
    }
}
/**
 * Duplicate shapes via clone(), offset, and select the copies.
 */
export class DuplicateShapesCommand extends Command {
    constructor(shapeIds, { offsetX = 20, offsetY = 20 } = {}) {
        super(`Duplicate ${shapeIds.length} shape(s)`);
        this.shapeIds = shapeIds;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.createdJSONs = null;
    }
    execute(scene) {
        const store = scene.shapeStore;
        if (this.createdJSONs) {
            this.createdJSONs.forEach((json) => store.add(ShapeRegistry.fromJSON(json)));
            store.setSelectedIds(this.createdJSONs.map((json) => json.id));
            return;
        }
        this.createdJSONs = [];
        this.shapeIds.forEach((id) => {
            const original = store.get(id);
            if (!original)
                return;
            const copy = original.clone();
            copy.id = ShapeRegistry.generateId(original.type, store);
            copy.translate(this.offsetX, this.offsetY);
            syncLiteralBindingsForTranslate(copy);
            store.add(copy);
            this.createdJSONs.push(copy.toJSON());
        });
        store.setSelectedIds(this.createdJSONs.map((json) => json.id));
    }
    undo(scene) {
        (this.createdJSONs ?? []).forEach((json) => {
            scene.shapeStore.remove(json.id);
        });
        scene.shapeStore.clearSelection();
    }
}
/**
 * Generic gesture command: {before, after} full-shape snapshots.
 */
export class MutateShapesCommand extends Command {
    constructor(label, entries) {
        super(label);
        this.entries = entries;
    }
    execute(scene) {
        for (const { after } of Object.values(this.entries)) {
            scene.shapeStore.replace(ShapeRegistry.fromJSON(after));
        }
    }
    undo(scene) {
        for (const { before } of Object.values(this.entries)) {
            scene.shapeStore.replace(ShapeRegistry.fromJSON(before));
        }
    }
    coalesceWith(next) {
        if (!(next instanceof MutateShapesCommand))
            return false;
        if (next.label !== this.label)
            return false;
        if (next.timestamp - this.timestamp > COALESCE_WINDOW_MS)
            return false;
        const ids = Object.keys(this.entries);
        const nextIds = Object.keys(next.entries);
        if (ids.length !== nextIds.length || !nextIds.every((id) => this.entries[id]))
            return false;
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
    constructor(shapeId, property, bindingJSON) {
        super(`Bind ${shapeId}.${property}`);
        this.shapeId = shapeId;
        this.property = property;
        this.bindingJSON = bindingJSON;
        this.previousBindingJSON = undefined;
    }
    execute(scene) {
        const shape = scene.shapeStore.get(this.shapeId);
        if (!shape)
            return;
        const existing = shape.getBinding(this.property);
        this.previousBindingJSON = existing ? existing.toJSON() : null;
        this.applyBinding(scene, shape, this.bindingJSON);
    }
    undo(scene) {
        const shape = scene.shapeStore.get(this.shapeId);
        if (!shape)
            return;
        this.applyBinding(scene, shape, this.previousBindingJSON);
    }
    applyBinding(scene, shape, bindingJSON) {
        if (bindingJSON) {
            scene.shapeStore.updateBinding(this.shapeId, this.property, createBindingFromJSON(bindingJSON));
        }
        else {
            delete shape.bindings[this.property];
            EventBus.emit(EVENTS.PARAM_CHANGED, { shapeId: this.shapeId, property: this.property });
        }
    }
}
/**
 * Set one literal property value.
 */
export class SetShapePropertyCommand extends Command {
    constructor(shapeId, property, value) {
        super(`Set ${shapeId}.${property}`);
        this.shapeId = shapeId;
        this.property = property;
        this.value = value;
        this.previousValue = undefined;
        this.previousBindingJSON = undefined;
    }
    execute(scene) {
        const shape = scene.shapeStore.get(this.shapeId);
        if (!shape)
            return;
        this.previousValue = shape[this.property];
        const binding = shape.getBinding(this.property);
        this.previousBindingJSON = binding ? binding.toJSON() : null;
        this.apply(shape, this.value);
    }
    undo(scene) {
        const shape = scene.shapeStore.get(this.shapeId);
        if (!shape)
            return;
        shape[this.property] = this.previousValue;
        if (shape.getBindableProperties().includes(this.property)) {
            if (this.previousBindingJSON) {
                shape.bindings[this.property] = createBindingFromJSON(this.previousBindingJSON);
            }
            else {
                delete shape.bindings[this.property];
            }
        }
        this.emitChange(shape);
    }
    coalesceWith(next) {
        if (!(next instanceof SetShapePropertyCommand))
            return false;
        if (next.shapeId !== this.shapeId || next.property !== this.property)
            return false;
        if (next.timestamp - this.timestamp > COALESCE_WINDOW_MS)
            return false;
        this.value = next.value;
        this.timestamp = next.timestamp;
        return true;
    }
    apply(shape, value) {
        shape[this.property] = value;
        if (shape.getBindableProperties().includes(this.property)) {
            const binding = shape.getBinding(this.property);
            if (!binding) {
                shape.setBinding(this.property, new LiteralBinding(value));
            }
            else if (binding.type === 'literal') {
                binding.value = value;
            }
        }
        this.emitChange(shape);
    }
    /** Emit the right change events so model observers and the canvas refresh. */
    emitChange(shape) {
        EventBus.emit(EVENTS.SHAPE_UPDATED, { id: this.shapeId, shape });
        EventBus.emit(EVENTS.PARAM_CHANGED, { shapeId: this.shapeId, property: this.property });
    }
}
/**
 * Sync literal bindings on a shape's translated properties to the current
 * raw values.
 */
export function syncLiteralBindingsForTranslate(shape) {
    const schema = shape.constructor.fullSchema ?? {};
    for (const [prop, desc] of Object.entries(schema)) {
        if (!desc.translate || !desc.bindable)
            continue;
        const binding = shape.getBinding(prop);
        if (!binding) {
            shape.setBinding(prop, new LiteralBinding(shape[prop]));
        }
        else if (binding.type === 'literal') {
            binding.value = shape[prop];
        }
    }
}
