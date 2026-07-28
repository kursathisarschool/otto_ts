/**
 * @fileoverview Command base class — the unit of undoable work in Otto.
 * ... (yorumlar aynen kalıyor)
 * @module commands/Command
 */

// TODO: core/SceneState.ts çevrilince gerçek tipini import edeceğiz.
export type SceneState = any;

export class Command {
    label: string;
    /** Creation timestamp; coalescing windows use it. */
    timestamp: number;

    constructor(label: string = 'Command') {
        this.label = label;
        this.timestamp = Date.now();
    }

    /** Apply the change. */
    execute(scene: SceneState): void | Promise<void> {
        throw new Error('execute() must be implemented');
    }

    /** Revert the change exactly. */
    undo(scene: SceneState): void | Promise<void> {
        throw new Error('undo() must be implemented');
    }

    /**
     * Try to absorb a newer command into this one (slider drags, nudges).
     * Returns true if absorbed (next is NOT pushed to history).
     */
    coalesceWith(next: Command): boolean {
        return false;
    }
}

/**
 * A batch of commands undone/redone as one history entry.
 * Executes in order, undoes in reverse order.
 */
export class CompositeCommand extends Command {
    commands: Command[];

    constructor(label: string, commands: Command[] = []) {
        super(label);
        this.commands = commands;
    }

    add(command: Command): void {
        this.commands.push(command);
    }

    get size(): number {
        return this.commands.length;
    }

    async execute(scene: SceneState): Promise<void> {
        for (const command of this.commands) {
            await command.execute(scene);
        }
    }

    async undo(scene: SceneState): Promise<void> {
        for (let i = this.commands.length - 1; i >= 0; i--) {
            await this.commands[i].undo(scene);
        }
    }
}