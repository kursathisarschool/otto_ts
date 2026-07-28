/**
 * @fileoverview HistoryManager — the per-tab undo/redo stack.
 * @module commands/HistoryManager
 */
import EventBus, { EVENTS } from '../events/EventBus.js';
import { CompositeCommand, type Command, type SceneState } from './Command.js';

const DEFAULT_CAP = 100;

export class HistoryManager {
    sceneState: SceneState;
    maxSize: number;
    stack: Command[];
    /** Index of the last APPLIED command; -1 = nothing to undo. */
    index: number;
    /** Open batch, if any. */
    batch: CompositeCommand | null;
    eventBus: typeof EventBus;

    constructor(sceneState: SceneState, maxSize: number = DEFAULT_CAP) {
        this.sceneState = sceneState;
        this.maxSize = maxSize;
        this.stack = [];
        this.index = -1;
        this.batch = null;
        this.eventBus = EventBus;
    }

    canUndo(): boolean {
        return this.index >= 0;
    }

    canRedo(): boolean {
        return this.index < this.stack.length - 1;
    }

    /** Run a command against this history's scene, then push it. */
    async execute(command: Command): Promise<void> {
        await command.execute(this.sceneState);
        this.push(command);
    }

    /** Push a command that was ALREADY applied (live-mutating gesture). */
    record(command: Command): void {
        this.push(command);
    }

    /**
     * Internal: add to the open batch, or coalesce with the top entry, or
     * append. Appending truncates the redo tail.
     */
    private push(command: Command): void {
        if (this.batch) {
            this.batch.add(command);
            return;
        }

        const top = this.index >= 0 ? this.stack[this.index] : null;
        if (top && this.index === this.stack.length - 1 && top.coalesceWith(command)) {
            this.emitChanged();
            return;
        }

        this.stack.length = this.index + 1;
        this.stack.push(command);
        if (this.stack.length > this.maxSize) {
            this.stack.shift();
        }
        this.index = this.stack.length - 1;
        this.emitChanged();
    }

    /**
     * Group subsequent execute()/record() calls into one history entry until
     * endBatch(). Nested calls are not supported (throws).
     */
    beginBatch(label: string): void {
        if (this.batch) {
            throw new Error('HistoryManager: batch already open');
        }
        this.batch = new CompositeCommand(label);
    }

    /**
     * Close the open batch. Empty batches are dropped; single-command
     * batches push the inner command directly.
     */
    endBatch(): void {
        const batch = this.batch;
        this.batch = null;
        if (!batch || batch.size === 0) {
            return;
        }
        const entry = batch.size === 1 ? batch.commands[0] : batch;
        this.push(entry);
    }

    /** Undo the newest applied command. */
    async undo(): Promise<boolean> {
        if (!this.canUndo()) return false;
        const command = this.stack[this.index];
        await command.undo(this.sceneState);
        this.index--;
        this.emitChanged();
        return true;
    }

    /** Re-apply the next undone command. */
    async redo(): Promise<boolean> {
        if (!this.canRedo()) return false;
        const command = this.stack[this.index + 1];
        await command.execute(this.sceneState);
        this.index++;
        this.emitChanged();
        return true;
    }

    /** Drop all history (e.g. after loading a file into this tab). */
    clear(): void {
        this.stack = [];
        this.index = -1;
        this.batch = null;
        this.emitChanged();
    }

    private emitChanged(): void {
        this.eventBus.emit(EVENTS.HISTORY_CHANGED, {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            label: this.index >= 0 ? this.stack[this.index].label : null
        });
    }
}