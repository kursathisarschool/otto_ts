/**
 * @fileoverview Scene-level commands: edge joinery assignment and whole-scene replacement.
 * @module commands/sceneCommands
 */
import { Command } from './Command.js';
export class SetEdgeJoineryCommand extends Command {
    constructor(edge, joinery) {
        super(joinery ? 'Set joinery' : 'Remove joinery');
        this.edge = edge;
        this.joinery = joinery ? { ...joinery } : null;
        this.previousJoinery = undefined;
    }
    execute(scene) {
        const store = scene.shapeStore;
        const existing = store.getEdgeJoinery(this.edge);
        this.previousJoinery = existing ? { ...existing } : null;
        this.apply(store, this.joinery);
    }
    undo(scene) {
        this.apply(scene.shapeStore, this.previousJoinery);
    }
    apply(store, joinery) {
        if (joinery) {
            store.setEdgeJoinery(this.edge, joinery);
        }
        else {
            store.removeEdgeJoinery(this.edge);
        }
    }
}
/**
 * Replace the scene's shapes + parameters wholesale — the undo boundary for
 * operations that rebuild the scene.
 */
export class ReplaceSceneCommand extends Command {
    constructor(label, scene) {
        super(label);
        this.before = ReplaceSceneCommand.snapshot(scene);
        this.after = null;
    }
    /** Capture the AFTER state once the wrapped operation has run. */
    captureAfter(scene) {
        this.after = ReplaceSceneCommand.snapshot(scene);
    }
    /** True if the operation actually changed anything. */
    isNoop() {
        return this.after !== null &&
            JSON.stringify(this.before) === JSON.stringify(this.after);
    }
    async execute(scene) {
        await ReplaceSceneCommand.restore(scene, this.after);
    }
    async undo(scene) {
        await ReplaceSceneCommand.restore(scene, this.before);
    }
    static snapshot(scene) {
        return {
            parameters: scene.parameterStore.toJSON().parameters,
            shapes: scene.shapeStore.toJSON().shapes,
            edgeJoinery: scene.shapeStore.toJSON().edgeJoinery,
            selectedShapeId: scene.shapeStore.selectedShapeId
        };
    }
    static async restore(scene, snap) {
        if (!snap)
            return;
        await scene.parameterStore.fromJSON({ parameters: snap.parameters });
        await scene.shapeStore.fromJSON({
            shapes: snap.shapes,
            selectedShapeId: snap.selectedShapeId || null,
            edgeJoinery: snap.edgeJoinery || []
        });
        const { default: EventBus, EVENTS } = await import('../events/EventBus.js');
        EventBus.emit(EVENTS.SCENE_LOADED, { scene });
    }
}
