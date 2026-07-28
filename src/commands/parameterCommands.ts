/**
 * @fileoverview Parameter commands.
 * @module commands/parameterCommands
 */
import { Command, type SceneState } from './Command.js';
import { Parameter } from '../models/Parameter.js';
import EventBus, { EVENTS } from '../events/EventBus.js';

const COALESCE_WINDOW_MS = 1200;

export class AddParameterCommand extends Command {
    paramJSON: any;
    private _liveParam: Parameter | null;

    constructor(parameter: Parameter) {
        super(`Add parameter ${parameter.name}`);
        this.paramJSON = parameter.toJSON();
        this._liveParam = parameter;
    }

    execute(scene: SceneState): void {
        const param = this._liveParam ?? Parameter.fromJSON(this.paramJSON);
        this._liveParam = null;
        scene.parameterStore.add(param);
    }

    undo(scene: SceneState): void {
        scene.parameterStore.remove(this.paramJSON.id);
    }
}

export class RemoveParameterCommand extends Command {
    parameterId: string;
    paramJSON: any;

    constructor(parameterId: string) {
        super('Remove parameter');
        this.parameterId = parameterId;
        this.paramJSON = null;
    }

    execute(scene: SceneState): void {
        const param = scene.parameterStore.get(this.parameterId);
        if (!param) return;
        this.paramJSON = param.toJSON();
        scene.parameterStore.remove(this.parameterId);
    }

    undo(scene: SceneState): void {
        if (this.paramJSON) {
            scene.parameterStore.add(Parameter.fromJSON(this.paramJSON));
        }
    }
}

/**
 * Change a parameter's value. Rapid changes to the same parameter coalesce.
 */
export class SetParameterValueCommand extends Command {
    parameterId: string;
    value: number;
    previousValue: number | undefined;

    constructor(parameterId: string, value: number) {
        super('Change parameter');
        this.parameterId = parameterId;
        this.value = value;
        this.previousValue = undefined;
    }

    execute(scene: SceneState): void {
        const param = scene.parameterStore.get(this.parameterId);
        if (!param) return;
        if (this.previousValue === undefined) {
            this.previousValue = param.getValue();
        }
        scene.parameterStore.setValue(this.parameterId, this.value);
    }

    undo(scene: SceneState): void {
        if (this.previousValue !== undefined) {
            scene.parameterStore.setValue(this.parameterId, this.previousValue);
        }
    }

    coalesceWith(next: Command): boolean {
        if (!(next instanceof SetParameterValueCommand)) return false;
        if (next.parameterId !== this.parameterId) return false;
        if (next.timestamp - this.timestamp > COALESCE_WINDOW_MS) return false;
        this.value = next.value;
        this.timestamp = next.timestamp;
        return true;
    }
}

interface ParameterMetaPatch {
    name?: string;
    min?: number;
    max?: number;
    step?: number;
}

/**
 * Patch parameter metadata (name, min, max, step).
 */
export class UpdateParameterMetaCommand extends Command {
    parameterId: string;
    patch: ParameterMetaPatch;
    previous: Record<string, any> | null;

    constructor(parameterId: string, patch: ParameterMetaPatch) {
        super('Edit parameter');
        this.parameterId = parameterId;
        this.patch = patch;
        this.previous = null;
    }

    execute(scene: SceneState): void {
        const param = scene.parameterStore.get(this.parameterId);
        if (!param) return;
        this.previous = {};
        for (const key of Object.keys(this.patch)) {
            this.previous[key] = param[key];
            param[key] = (this.patch as any)[key];
        }
        EventBus.emit(EVENTS.PARAM_UPDATED, { id: this.parameterId, patch: this.patch });
    }

    undo(scene: SceneState): void {
        const param = scene.parameterStore.get(this.parameterId);
        if (!param || !this.previous) return;
        for (const key of Object.keys(this.previous)) {
            param[key] = this.previous[key];
        }
        EventBus.emit(EVENTS.PARAM_UPDATED, { id: this.parameterId, patch: this.previous });
    }
}