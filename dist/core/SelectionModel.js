/**
 * @fileoverview SelectionModel — the single source of truth for everything
 * "selected" in a scene.
 * @module core/SelectionModel
 */
import EventBus, { EVENTS } from '../events/EventBus.js';
import { EdgeSelection } from '../geometry/edge/index.js';
export class SelectionModel {
    constructor({ getShape, getAllIds }) {
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
    getSelected() {
        return this.primaryId ? this.getShape(this.primaryId) : null;
    }
    /**
     * Replace the entire selection with a single shape (or clear with null).
     * Emits SHAPE_SELECTED only when the primary actually changes.
     * @param {string|null} id
     */
    setSelected(id) {
        const oldPrimary = this.primaryId;
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
    getSelectedIds() {
        return new Set(this.selectedShapeIds);
    }
    /**
     * Add a shape to the selection (Shift+click); it becomes primary.
     * No-op for unknown ids.
     * @param {string} id
     */
    addToSelection(id) {
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
    removeFromSelection(id) {
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
    setSelectedIds(ids) {
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
    clearSelection() {
        this.primaryId = null;
        this.selectedShapeIds.clear();
        this.eventBus.emit(EVENTS.SHAPE_SELECTED, {
            id: null,
            shape: null,
            selectedIds: []
        });
    }
    /** Select every shape in the scene (Ctrl+A). */
    selectAll() {
        this.setSelectedIds(this.getAllIds());
    }
    /**
     * Drop selection entries whose shapes no longer exist (called after a
     * shape is removed from the store). Does NOT emit — removal cleanup is
     * silent, matching the old ShapeStore.remove() behavior.
     * @param {string} id - The removed shape's id.
     */
    pruneShape(id) {
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
    setSelectionMode(mode) {
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
    getSelectionMode() {
        return this.selectionMode;
    }
    // ── Edge selection ──────────────────────────────────────────────────
    /**
     * Replace the edge selection with exactly one edge (plain click).
     * @param {Object} edge
     */
    selectEdge(edge) {
        this.edgeSelection.set(edge);
        this.eventBus.emit(EVENTS.EDGE_SELECTED, {
            edge,
            edges: this.edgeSelection.all()
        });
    }
    /** Add an edge without clearing others (Shift+click). */
    addEdgeToSelection(edge) {
        this.edgeSelection.add(edge);
        this.eventBus.emit(EVENTS.EDGE_SELECTED, {
            edge,
            edges: this.edgeSelection.all()
        });
    }
    /** Remove one edge from the selection. */
    removeEdgeFromSelection(edge) {
        this.edgeSelection.remove(edge);
        this.eventBus.emit(EVENTS.EDGE_SELECTED, {
            edge: null,
            edges: this.edgeSelection.all()
        });
    }
    /** Toggle an edge's membership in the selection. */
    toggleEdgeSelection(edge) {
        const isNowSelected = this.edgeSelection.toggle(edge);
        this.eventBus.emit(EVENTS.EDGE_SELECTED, {
            edge: isNowSelected ? edge : null,
            edges: this.edgeSelection.all()
        });
    }
    /** Deselect all edges and clear edge hover. */
    clearEdgeSelection() {
        this.edgeSelection.clear();
        this.hoveredEdge = null;
        this.eventBus.emit(EVENTS.EDGE_SELECTED, {
            edge: null,
            edges: []
        });
    }
    /** @returns {Object[]} Snapshot of the selected edges. */
    getSelectedEdges() {
        return this.edgeSelection.all();
    }
    /** @returns {boolean} */
    isEdgeSelected(edge) {
        return this.edgeSelection.has(edge);
    }
    // ── Hover state ─────────────────────────────────────────────────────
    /**
     * Record the edge under the pointer (null = none). Emits EDGE_HOVERED.
     * @param {?Object} edge
     * @param {?Object} [position=null] - World-space cursor position.
     */
    setHoveredEdge(edge, position = null) {
        this.hoveredEdge = edge ? { edge, position } : null;
        this.eventBus.emit(EVENTS.EDGE_HOVERED, { edge, position });
    }
    /** @returns {{edge: Object, position: Object}|null} */
    getHoveredEdge() {
        return this.hoveredEdge;
    }
    /**
     * Record the shape under the pointer; emits SHAPE_HOVERED only on change.
     * @param {string|null} shapeId
     */
    setHoveredShape(shapeId) {
        if (this.hoveredShapeId !== shapeId) {
            this.hoveredShapeId = shapeId;
            this.eventBus.emit(EVENTS.SHAPE_HOVERED, { shapeId });
        }
    }
    /** @returns {string|null} */
    getHoveredShapeId() {
        return this.hoveredShapeId;
    }
}
