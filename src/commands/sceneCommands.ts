/**
 * @fileoverview Scene-level commands: edge joinery assignment and whole-scene replacement.
 * @module commands/sceneCommands
 */
import { Command, type SceneState } from './Command.js';

export class SetEdgeJoineryCommand extends Command {
    edge: any;
    joinery: any;
    previousJoinery: any;

    constructor(edge: any, joinery: any) {
        super(joinery ? 'Set joinery' : 'Remove joinery');
        this.edge = edge;
        this.joinery = joinery ? { ...joinery } : null;
        this.previousJoinery = undefined;
    }

    execute(scene: SceneState): void {
        const store = scene.shapeStore;
        const existing = store.getEdgeJoinery(this.edge);
        this.previousJoinery = existing ? { ...existing } : null;
        this.apply(store, this.joinery);
    }

    undo(scene: SceneState): void {
        this.apply(scene.shapeStore, this.previousJoinery);
    }

    private apply(store: any, joinery: any): void {
        if (joinery) {
            store.setEdgeJoinery(this.edge, joinery);
        } else {
            store.removeEdgeJoinery(this.edge);
        }
    }
}

interface SceneSnapshot {
    parameters: any;
    shapes: any;
    edgeJoinery: any;
    selectedShapeId: any;
}

/**
 * Replace the scene's shapes + parameters wholesale — the undo boundary for
 * operations that rebuild the scene.
 */
export class ReplaceSceneCommand extends Command {
    before: SceneSnapshot;
    after: SceneSnapshot | null;

    constructor(label: string, scene: SceneState) {
        super(label);
        this.before = ReplaceSceneCommand.snapshot(scene);
        this.after = null;
    }

    /** Capture the AFTER state once the wrapped operation has run. */
    captureAfter(scene: SceneState): void {
        this.after = ReplaceSceneCommand.snapshot(scene);
    }

    /** True if the operation actually changed anything. */
    isNoop(): boolean {
        return this.after !== null &&
            JSON.stringify(this.before) === JSON.stringify(this.after);
    }

    async execute(scene: SceneState): Promise<void> {
        await ReplaceSceneCommand.restore(scene, this.after);
    }

    async undo(scene: SceneState): Promise<void> {
        await ReplaceSceneCommand.restore(scene, this.before);
    }

    private static snapshot(scene: SceneState): SceneSnapshot {
        return {
            parameters: scene.parameterStore.toJSON().parameters,
            shapes: scene.shapeStore.toJSON().shapes,
            edgeJoinery: scene.shapeStore.toJSON().edgeJoinery,
            selectedShapeId: scene.shapeStore.selectedShapeId
        };
    }

    private static async restore(scene: SceneState, snap: SceneSnapshot | null): Promise<void> {
        if (!snap) return;
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