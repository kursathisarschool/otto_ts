/**
 * @fileoverview SelectionModel — the single source of truth for everything
 * "selected" in a scene.
 * @module core/SelectionModel
 */
import EventBus, { EVENTS } from '../events/EventBus.js';
import { Edge, EdgeSelection } from '../geometry/edge/index.js';

interface SelectionModelDeps {
    getShape: (id: string) => any;
    getAllIds: () => string[];
}

interface HoveredEdgeInfo {
    edge: Edge;
    position: any;
}

export class SelectionModel {
    getShape: (id: string) => any;
    getAllIds: () => string[];
    eventBus: typeof EventBus;

    /** The full set of currently-selected shape IDs — the authoritative multi-selection. */
    selectedShapeIds: Set<string>;

    /** The "primary" selected shape id, or null when empty. */
    primaryId: string | null;

    /** Edge-selection bookkeeping delegate (add/remove/toggle/has). */
    edgeSelection: EdgeSelection;

    /** 'shape' — clicks select whole shapes; 'edge' — clicks select individual edges. */
    selectionMode: 'shape' | 'edge';

    /** The edge (plus cursor position) under the pointer, or null. Ephemeral. */
    hoveredEdge: HoveredEdgeInfo | null;

    /** The id of the shape under the pointer, or null. Ephemeral. */
    hoveredShapeId: string | null;

    constructor({ getShape, getAllIds }: SelectionModelDeps) {
        this.getShape = getShape;
        this.getAllIds = getAllIds;
        this.eventBus = EventBus;

        this.selectedShapeIds = new Set();
        this.primaryId = null;
        this.edgeSelection = new EdgeSelection();
        this.selectionMode = 'shape';
        this.hoveredEdge = null;
        this.hoveredShapeId = null;
    }

    // ── Shape selection ─────────────────────────────────────────────────

    /** @returns {?Object} The primary selected shape, or null. */
    getSelected():any {
        return this.primaryId ? this.getShape(this.primaryId) : null;
    }

    /**
     * Replace the entire selection with a single shape (or clear with null).
     * Emits SHAPE_SELECTED only when the primary actually changes.
     * @param {string|null} id
     */
    setSelected(id: string | null): void {
        const oldPrimary: string | null = this.primaryId;
        this.primaryId = id;
        this.selectedShapeIds.clear();
        if (id) {
            this.selectedShapeIds.add(id);
        }
        if (oldPrimary !== id) {
            this.eventBus.emit(EVENTS.SHAPE_SELECTED, {
                id,
                shape: id ? this.getShape(id) : null
            });
        }
    }

    /** @returns {Set<string>} A snapshot copy of the selected ids. */
    getSelectedIds(): Set <string> {
        return new Set(this.selectedShapeIds);
    }

    /**
     * Add a shape to the selection (Shift+click); it becomes primary.
     * No-op for unknown ids.
     * @param {string} id
     */
    addToSelection(id: string): void {
        if (this.getShape(id)) {
            this.selectedShapeIds.add(id);
            this.primaryId = id;
            this.eventBus.emit(EVENTS.SHAPE_SELECTED, {
                id,
                shape: this.getShape(id),
                selectedIds: Array.from(this.selectedShapeIds)
            });
        }
    }

    /**
     * Remove a shape from the selection; primary reassigns to the first
     * remaining id or null.
     * @param {string} id
     */
    removeFromSelection(id: string): void {
        this.selectedShapeIds.delete(id);
        if (this.primaryId === id) {
            this.primaryId = this.selectedShapeIds.size > 0
                ? Array.from(this.selectedShapeIds)[0]
                : null;
        }
        this.eventBus.emit(EVENTS.SHAPE_SELECTED, {
            id: this.primaryId,
            shape: this.primaryId ? this.getShape(this.primaryId) : null,
            selectedIds: Array.from(this.selectedShapeIds)
        });
    }

    /**
     * Replace the selection with a list of ids (rubber-band / batch select).
     * Unknown ids are dropped; the first id becomes primary.
     * @param {string[]} ids
     */
    setSelectedIds(ids: string[]): void {
        this.selectedShapeIds.clear();
        ids.forEach(id => {
            if (this.getShape(id)) {
                this.selectedShapeIds.add(id);
            }
        });
        this.primaryId = ids.length > 0 ? ids[0] : null;
        this.eventBus.emit(EVENTS.SHAPE_SELECTED, {
            id: this.primaryId,
            shape: this.primaryId ? this.getShape(this.primaryId) : null,
            selectedIds: Array.from(this.selectedShapeIds)
        });
    }

    /** Deselect everything and notify (payload of nulls hides the panel). */
    clearSelection(): void {
        this.primaryId = null;
        this.selectedShapeIds.clear();
        this.eventBus.emit(EVENTS.SHAPE_SELECTED, {
            id: null,
            shape: null,
            selectedIds: []
        });
    }

    /** Select every shape in the scene (Ctrl+A). */
    selectAll(): void {
        this.setSelectedIds(this.getAllIds());
    }

    /**
     * Drop selection entries whose shapes no longer exist (called after a
     * shape is removed from the store). Does NOT emit — removal cleanup is
     * silent, matching the old ShapeStore.remove() behavior.
     * @param {string} id - The removed shape's id.
     */
    pruneShape(id: string): void {
        this.selectedShapeIds.delete(id);
        if (this.primaryId === id) {
            this.primaryId = null;
        }
        if (this.hoveredShapeId === id) {
            this.hoveredShapeId = null;
        }
    }

    // ── Selection mode ──────────────────────────────────────────────────

    /**
     * Switch between 'shape' and 'edge' selection. Switching to 'shape'
     * clears edge selection + edge hover. Emits SELECTION_MODE_CHANGED.
     * @param {'shape'|'edge'} mode
     */
    setSelectionMode(mode: any): void {
        if (this.selectionMode !== mode) {
            this.selectionMode = mode;
            if (mode === 'shape') {
                this.edgeSelection.clear();
                this.hoveredEdge = null;
            }
            this.eventBus.emit(EVENTS.SELECTION_MODE_CHANGED, { mode });
        }
    }

    /** @returns {'shape'|'edge'} */
    getSelectionMode(): "shape" | "edge" {
        return this.selectionMode;
    }

    // ── Edge selection ──────────────────────────────────────────────────

    /**
     * Replace the edge selection with exactly one edge (plain click).
     * @param {Object} edge
     */
    selectEdge(edge: any): void {
        this.edgeSelection.set(edge);
        this.eventBus.emit(EVENTS.EDGE_SELECTED, {
            edge,
            edges: this.edgeSelection.all()
        });
    }

    /** Add an edge without clearing others (Shift+click). */
    addEdgeToSelection(edge: any): void {
        this.edgeSelection.add(edge);
        this.eventBus.emit(EVENTS.EDGE_SELECTED, {
            edge,
            edges: this.edgeSelection.all()
        });
    }

    /** Remove one edge from the selection. */
    removeEdgeFromSelection(edge: any): void {
        this.edgeSelection.remove(edge);
        this.eventBus.emit(EVENTS.EDGE_SELECTED, {
            edge: null,
            edges: this.edgeSelection.all()
        });
    }

    /** Toggle an edge's membership in the selection. */
    toggleEdgeSelection(edge: any): void {
        const isNowSelected: boolean = this.edgeSelection.toggle(edge);
        this.eventBus.emit(EVENTS.EDGE_SELECTED, {
            edge: isNowSelected ? edge : null,
            edges: this.edgeSelection.all()
        });
    }

    /** Deselect all edges and clear edge hover. */
    clearEdgeSelection(): void {
        this.edgeSelection.clear();
        this.hoveredEdge = null;
        this.eventBus.emit(EVENTS.EDGE_SELECTED, {
            edge: null,
            edges: []
        });
    }

    /** @returns {Object[]} Snapshot of the selected edges. */
    getSelectedEdges(): Edge[] {
        return this.edgeSelection.all();
    }

    /** @returns {boolean} */
    isEdgeSelected(edge: any): boolean{
        return this.edgeSelection.has(edge);
    }

    // ── Hover state ─────────────────────────────────────────────────────

    /**
     * Record the edge under the pointer (null = none). Emits EDGE_HOVERED.
     * @param {?Object} edge
     * @param {?Object} [position=null] - World-space cursor position.
     */
    setHoveredEdge(edge: any, position: any = null): void {
        this.hoveredEdge = edge ? { edge, position } : null;
        this.eventBus.emit(EVENTS.EDGE_HOVERED, { edge, position });
    }

    /** @returns {{edge: Object, position: Object}|null} */
    getHoveredEdge(): HoveredEdgeInfo | null {
        return this.hoveredEdge;
    }

    /**
     * Record the shape under the pointer; emits SHAPE_HOVERED only on change.
     * @param {string|null} shapeId
     */
    setHoveredShape(shapeId: any): void {
        if (this.hoveredShapeId !== shapeId) {
            this.hoveredShapeId = shapeId;
            this.eventBus.emit(EVENTS.SHAPE_HOVERED, { shapeId });
        }
    }

    /** @returns {string|null} */
    getHoveredShapeId(): string | null {
        return this.hoveredShapeId;
    }
}
