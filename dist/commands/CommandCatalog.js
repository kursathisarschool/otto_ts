/**
 * @fileoverview CommandCatalog — name → command-factory registry.
 * @module commands/CommandCatalog
 */
import { AddShapeCommand, RemoveShapesCommand, DuplicateShapesCommand, MutateShapesCommand, SetBindingCommand, SetShapePropertyCommand } from './shapeCommands.js';
import { AddParameterCommand, RemoveParameterCommand, SetParameterValueCommand, UpdateParameterMetaCommand } from './parameterCommands.js';
import { SetEdgeJoineryCommand, ReplaceSceneCommand } from './sceneCommands.js';
export class CommandCatalog {
    constructor() {
        this.factories = new Map();
        // Built-ins
        this.register('shape.add', (...args) => new AddShapeCommand(...args));
        this.register('shape.remove', (...args) => new RemoveShapesCommand(...args));
        this.register('shape.duplicate', (...args) => new DuplicateShapesCommand(...args));
        this.register('shape.mutate', (...args) => new MutateShapesCommand(...args));
        this.register('shape.setBinding', (...args) => new SetBindingCommand(...args));
        this.register('shape.setProperty', (...args) => new SetShapePropertyCommand(...args));
        this.register('param.add', (...args) => new AddParameterCommand(...args));
        this.register('param.remove', (...args) => new RemoveParameterCommand(...args));
        this.register('param.setValue', (...args) => new SetParameterValueCommand(...args));
        this.register('param.updateMeta', (...args) => new UpdateParameterMetaCommand(...args));
        this.register('edge.setJoinery', (...args) => new SetEdgeJoineryCommand(...args));
        this.register('scene.replace', (...args) => new ReplaceSceneCommand(...args));
    }
    /**
     * Register a command factory under a name. Plugins use this via
     * PluginAPI.registerCommand.
     */
    register(name, factory) {
        if (!name || typeof factory !== 'function') {
            throw new Error('CommandCatalog.register requires a name and a factory function');
        }
        this.factories.set(name, factory);
    }
    unregister(name) {
        this.factories.delete(name);
    }
    has(name) {
        return this.factories.has(name);
    }
    /** Build a command instance by name. Extra args are passed to the factory. */
    create(name, ...args) {
        const factory = this.factories.get(name);
        if (!factory) {
            throw new Error(`Unknown command: "${name}". Registered: ${Array.from(this.factories.keys()).join(', ')}`);
        }
        return factory(...args);
    }
    getNames() {
        return Array.from(this.factories.keys());
    }
}
