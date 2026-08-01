/**
 * @fileoverview Command base class — the unit of undoable work in Otto.
 * ... (yorumlar aynen kalıyor)
 * @module commands/Command
 */
export class Command {
    constructor(label = 'Command') {
        this.label = label;
        this.timestamp = Date.now();
    }
    /** Apply the change. */
    execute(scene) {
        throw new Error('execute() must be implemented');
    }
    /** Revert the change exactly. */
    undo(scene) {
        throw new Error('undo() must be implemented');
    }
    /**
     * Try to absorb a newer command into this one (slider drags, nudges).
     * Returns true if absorbed (next is NOT pushed to history).
     */
    coalesceWith(next) {
        return false;
    }
}
/**
 * A batch of commands undone/redone as one history entry.
 * Executes in order, undoes in reverse order.
 */
export class CompositeCommand extends Command {
    constructor(label, commands = []) {
        super(label);
        this.commands = commands;
    }
    add(command) {
        this.commands.push(command);
    }
    get size() {
        return this.commands.length;
    }
    async execute(scene) {
        for (const command of this.commands) {
            await command.execute(scene);
        }
    }
    async undo(scene) {
        for (let i = this.commands.length - 1; i >= 0; i--) {
            await this.commands[i].undo(scene);
        }
    }
}
