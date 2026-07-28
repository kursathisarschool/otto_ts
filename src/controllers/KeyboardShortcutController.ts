/**
 * @fileoverview KeyboardShortcutController — canvas keyboard shortcuts.
 * @module controllers/KeyboardShortcutController
 */
import EventBus, { EVENTS } from '../events/EventBus.js';
import { LiteralBinding } from '../models/Binding.js';
import { DuplicateShapesCommand, RemoveShapesCommand, MutateShapesCommand } from '../commands/shapeCommands.js';
import type { InteractionState } from './InteractionState.js';

interface KeyboardShortcutControllerDeps {
    view: any;
    context: any;
    interaction: InteractionState;
    input: any;
}

export class KeyboardShortcutController {
    view: any;
    context: any;
    interaction: InteractionState;
    input: any;

    constructor({ view, context, interaction, input }: KeyboardShortcutControllerDeps) {
        this.view = view;
        this.context = context;
        this.interaction = interaction;
        this.input = input;
        this.attach();
    }

    attach(): void {
        window.addEventListener('keydown', (e: KeyboardEvent) => this.onKeyDown(e));
        window.addEventListener('keyup', (e: KeyboardEvent) => this.onKeyUp(e));
    }

    isEditableTarget(target: EventTarget | null): boolean {
        const el = target instanceof Element ? target : null;
        if (!el) return false;
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return true;
        if ((el as HTMLElement).isContentEditable) return true;
        if (el.closest('.CodeMirror')) return true;
        if (el.closest('.blockly-workspace') || el.closest('#blockly-container')) return true;
        return false;
    }

    /** Ids to operate on: the multi-selection, falling back to the primary. */
    selectedIds(): string[] {
        const selection = this.context.selection;
        const ids: string[] = Array.from(selection.selectedShapeIds);
        if (ids.length === 0 && selection.primaryId) {
            ids.push(selection.primaryId);
        }
        return ids;
    }

    onKeyDown(e: KeyboardEvent): void {
        const ix = this.interaction;
        ix.pressedKeys.add(e.key);
        if (this.isEditableTarget(e.target)) {
            return;
        }

        const shapeStore = this.context.shapeStore;

        if (e.key === 'e' || e.key === 'E') {
            e.preventDefault();
            const currentMode = shapeStore.getSelectionMode();
            shapeStore.setSelectionMode(currentMode === 'edge' ? 'shape' : 'edge');
            return;
        }

        if (e.key === 'Escape') {
            if (shapeStore.getSelectionMode() === 'edge') {
                shapeStore.setSelectionMode('shape');
                return;
            }
        }

        if (ix.isPathDrawing) {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.input.finishPathDrawing();
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                this.input.resetPathDrawState();
                this.view.requestRender();
                return;
            }
        }

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            const ids = this.selectedIds();
            if (ids.length > 0) {
                const step = e.shiftKey ? 10 : 1;
                let dx = 0, dy = 0;

                if (e.key === 'ArrowUp') dy = -step;
                else if (e.key === 'ArrowDown') dy = step;
                else if (e.key === 'ArrowLeft') dx = -step;
                else if (e.key === 'ArrowRight') dx = step;

                const before: Record<string, any> = {};
                ids.forEach(shapeId => {
                    const shape = shapeStore.get(shapeId);
                    if (!shape) return;
                    before[shapeId] = shape.toJSON();
                    shape.translate(dx, dy);
                    this.syncTranslatedBindings(shape);
                });

                EventBus.emit(EVENTS.PARAM_CHANGED);
                this.recordNudge(before);
                this.view.requestRender();
            }
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            e.preventDefault();
            shapeStore.selectAll();
            this.view.requestRender();
        }

        if (e.key === 'Escape') {
            if (ix.handleEditState) {
                ix.handleEditState = null;
                ix.isDraggingHandle = false;
                this.view.requestRender();
                return;
            }
            shapeStore.clearSelection();
            this.view.requestRender();
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
            e.preventDefault();
            const ids = this.selectedIds();
            if (ids.length > 0) {
                this.context.history.execute(new DuplicateShapesCommand(ids));
                this.view.requestRender();
            }
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            const ids = this.selectedIds();
            if (ids.length > 0) {
                this.context.history.execute(new RemoveShapesCommand(ids));
                this.view.requestRender();
            }
        }
    }

    /**
     * Record an arrow-key nudge (already applied live) as a coalescing
     * MutateShapesCommand so a run of taps collapses to one undo step.
     */
    recordNudge(beforeSnapshots: Record<string, any>): void {
        const entries: Record<string, { before: any; after: any }> = {};
        let changed = false;
        for (const [id, before] of Object.entries(beforeSnapshots)) {
            const shape = this.context.shapeStore.get(id);
            if (!shape) continue;
            const after = shape.toJSON();
            entries[id] = { before, after };
            if (JSON.stringify(before) !== JSON.stringify(after)) changed = true;
        }
        if (changed) {
            this.context.history.record(new MutateShapesCommand('Nudge shapes', entries));
        }
    }

    onKeyUp(e: KeyboardEvent): void {
        this.interaction.pressedKeys.delete(e.key);
    }

    /**
     * After translate(), keep literal bindings on moved properties in step
     * with the new raw values so resolve() doesn't snap the shape back.
     */
    syncTranslatedBindings(shape: any): void {
        const schema = shape.constructor.fullSchema ?? {};
        for (const [prop, desc] of Object.entries(schema) as [string, any][]) {
            if (!desc.translate || !desc.bindable) continue;
            const binding = shape.getBinding(prop);
            if (!binding) {
                shape.setBinding(prop, new LiteralBinding(shape[prop]));
            } else if (binding.type === 'literal') {
                binding.value = shape[prop];
            }
        }
    }
}