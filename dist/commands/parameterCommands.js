/**
 * @fileoverview Parameter commands.
 * @module commands/parameterCommands
 */
import { Command } from './Command.js';
import { Parameter } from '../models/Parameter.js';
import EventBus, { EVENTS } from '../events/EventBus.js';
const COALESCE_WINDOW_MS = 1200;
export class AddParameterCommand extends Command {
    constructor(parameter) {
        super(`Add parameter ${parameter.name}`);
        this.paramJSON = parameter.toJSON();
        this._liveParam = parameter;
    }
    execute(scene) {
        const param = this._liveParam ?? Parameter.fromJSON(this.paramJSON);
        this._liveParam = null;
        scene.parameterStore.add(param);
    }
    undo(scene) {
        scene.parameterStore.remove(this.paramJSON.id);
    }
}
export class RemoveParameterCommand extends Command {
    constructor(parameterId) {
        super('Remove parameter');
        this.parameterId = parameterId;
        this.paramJSON = null;
    }
    execute(scene) {
        const param = scene.parameterStore.get(this.parameterId);
        if (!param)
            return;
        this.paramJSON = param.toJSON();
        scene.parameterStore.remove(this.parameterId);
    }
    undo(scene) {
        if (this.paramJSON) {
            scene.parameterStore.add(Parameter.fromJSON(this.paramJSON));
        }
    }
}
/**
 * Change a parameter's value. Rapid changes to the same parameter coalesce.
 */
export class SetParameterValueCommand extends Command {
    constructor(parameterId, value) {
        super('Change parameter');
        this.parameterId = parameterId;
        this.value = value;
        this.previousValue = undefined;
    }
    execute(scene) {
        const param = scene.parameterStore.get(this.parameterId);
        if (!param)
            return;
        if (this.previousValue === undefined) {
            this.previousValue = param.getValue();
        }
        scene.parameterStore.setValue(this.parameterId, this.value);
    }
    undo(scene) {
        if (this.previousValue !== undefined) {
            scene.parameterStore.setValue(this.parameterId, this.previousValue);
        }
    }
    coalesceWith(next) {
        if (!(next instanceof SetParameterValueCommand))
            return false;
        if (next.parameterId !== this.parameterId)
            return false;
        if (next.timestamp - this.timestamp > COALESCE_WINDOW_MS)
            return false;
        this.value = next.value;
        this.timestamp = next.timestamp;
        return true;
    }
}
/**
 * Patch parameter metadata (name, min, max, step).
 */
export class UpdateParameterMetaCommand extends Command {
    constructor(parameterId, patch) {
        super('Edit parameter');
        this.parameterId = parameterId;
        this.patch = patch;
        this.previous = null;
    }
    execute(scene) {
        const param = scene.parameterStore.get(this.parameterId);
        if (!param)
            return;
        this.previous = {};
        for (const key of Object.keys(this.patch)) {
            this.previous[key] = param[key];
            param[key] = this.patch[key];
        }
        EventBus.emit(EVENTS.PARAM_UPDATED, { id: this.parameterId, patch: this.patch });
    }
    undo(scene) {
        const param = scene.parameterStore.get(this.parameterId);
        if (!param || !this.previous)
            return;
        for (const key of Object.keys(this.previous)) {
            param[key] = this.previous[key];
        }
        EventBus.emit(EVENTS.PARAM_UPDATED, { id: this.parameterId, patch: this.previous });
    }
}
