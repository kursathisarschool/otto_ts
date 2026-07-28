/**
 * @fileoverview CommandCatalog — name → command-factory registry.
 * @module commands/CommandCatalog
 */
import { AddShapeCommand, RemoveShapesCommand, DuplicateShapesCommand, MutateShapesCommand, SetBindingCommand, SetShapePropertyCommand } from './shapeCommands.js';
import { AddParameterCommand, RemoveParameterCommand, SetParameterValueCommand, UpdateParameterMetaCommand } from './parameterCommands.js';
import { SetEdgeJoineryCommand, ReplaceSceneCommand } from './sceneCommands.js';
import type { Command } from './Command.js';

/** A factory function that builds a Command from arbitrary constructor args. */
type CommandFactory = (...args: any[]) => Command;

export class CommandCatalog {
    /** name → factory(...args) => Command */
    factories: Map<string, CommandFactory>;

    constructor() {
        this.factories = new Map();

        // Built-ins
        this.register('shape.add', (...args) => new (AddShapeCommand as any)(...args));
        this.register('shape.remove', (...args) => new (RemoveShapesCommand as any)(...args));
        this.register('shape.duplicate', (...args) => new (DuplicateShapesCommand as any)(...args));
        this.register('shape.mutate', (...args) => new (MutateShapesCommand as any)(...args));
        this.register('shape.setBinding', (...args) => new (SetBindingCommand as any)(...args));
        this.register('shape.setProperty', (...args) => new (SetShapePropertyCommand as any)(...args));
        this.register('param.add', (...args) => new (AddParameterCommand as any)(...args));
        this.register('param.remove', (...args) => new (RemoveParameterCommand as any)(...args));
        this.register('param.setValue', (...args) => new (SetParameterValueCommand as any)(...args));
        this.register('param.updateMeta', (...args) => new (UpdateParameterMetaCommand as any)(...args));
        this.register('edge.setJoinery', (...args) => new (SetEdgeJoineryCommand as any)(...args));
        this.register('scene.replace', (...args) => new (ReplaceSceneCommand as any)(...args));
    }

    /**
     * Register a command factory under a name. Plugins use this via
     * PluginAPI.registerCommand.
     */
    register(name: string, factory: CommandFactory): void {
        if (!name || typeof factory !== 'function') {
            throw new Error('CommandCatalog.register requires a name and a factory function');
        }
        this.factories.set(name, factory);
    }

    unregister(name: string): void {
        this.factories.delete(name);
    }

    has(name: string): boolean {
        return this.factories.has(name);
    }

    /** Build a command instance by name. Extra args are passed to the factory. */
    create(name: string, ...args: any[]): Command {
        const factory = this.factories.get(name);
        if (!factory) {
            throw new Error(`Unknown command: "${name}". Registered: ${Array.from(this.factories.keys()).join(', ')}`);
        }
        return factory(...args);
    }

    getNames(): string[] {
        return Array.from(this.factories.keys());
    }
}