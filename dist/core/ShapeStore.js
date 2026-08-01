/**
 * @fileoverview Central repository for all shapes in a single scene.
 * @module core/ShapeStore
 */
import EventBus, { EVENTS } from '../events/EventBus.js';
import { EdgeSelection, edgesFromItem } from '../geometry/edge/index.js';
import { SelectionModel } from './SelectionModel.js';
export class ShapeStore {
    constructor(parameterStore, bindingResolver) {
        this.shapes = new Map();
        this.parameterStore = parameterStore;
        this.bindingResolver = bindingResolver;
        this.eventBus = EventBus;
        this.selection = new SelectionModel({
            getShape: (id) => this.shapes.get(id) ?? null,
            getAllIds: () => Array.from(this.shapes.keys())
        });
        this.edgeJoinery = new Map();
    }
    // ── Backward-compatible selection accessors ─────────────────────────
    /** Primary selected shape id. */
    get selectedShapeId() {
        return this.selection.primaryId;
    }
    set selectedShapeId(id) {
        this.selection.primaryId = id;
    }
    /** The LIVE selected-ids set (not a copy). */
    get selectedShapeIds() {
        return this.selection.selectedShapeIds;
    }
    /** The edge-selection delegate. */
    get edgeSelection() {
        return this.selection.edgeSelection;
    }
    get selectionMode() {
        return this.selection.selectionMode;
    }
    get hoveredEdge() {
        return this.selection.hoveredEdge;
    }
    get hoveredShapeId() {
        return this.selection.hoveredShapeId;
    }
    /**
     * Insert a shape into the store and notify listeners.
     */
    add(shape) {
        if (this.shapes.has(shape.id)) {
            throw new Error(`Shape with id ${shape.id} already exists`);
        }
        this.shapes.set(shape.id, shape);
        this.eventBus.emit(EVENTS.SHAPE_ADDED, shape);
    }
    /**
     * Remove a shape and cascade-clean all state that references it.
     */
    remove(id) {
        const shape = this.shapes.get(id);
        if (shape) {
            this.shapes.delete(id);
            this.selection.pruneShape(id);
            const prefix = `${id}:`;
            for (const key of this.edgeJoinery.keys()) {
                if (key.startsWith(prefix)) {
                    this.edgeJoinery.delete(key);
                }
            }
            this.eventBus.emit(EVENTS.SHAPE_REMOVED, { id });
        }
    }
    /**
     * Replace a shape instance wholesale, keeping its position in the
     * insertion order (and therefore its paint order).
     */
    replace(shape) {
        if (!this.shapes.has(shape.id)) {
            throw new Error(`Shape with id ${shape.id} not found`);
        }
        this.shapes.set(shape.id, shape);
        this.eventBus.emit(EVENTS.SHAPE_UPDATED, { id: shape.id, shape });
        this.eventBus.emit(EVENTS.PARAM_CHANGED, { shapeId: shape.id });
    }
    /** Look up a single shape by its ID. */
    get(id) {
        return this.shapes.get(id) || null;
    }
    /** Return every shape in the store as a flat array. */
    getAll() {
        return Array.from(this.shapes.values());
    }
    /** Return all shapes with every parameter binding resolved to its current concrete value. */
    getResolved() {
        return this.bindingResolver.resolveAll(this.getAll());
    }
    /**
     * Resolved shapes sorted by 2.5D elevation (z), lowest first, with
     * insertion order breaking ties.
     */
    getResolvedSorted() {
        const resolved = this.getResolved();
        return resolved
            .map((shape, index) => ({ shape, index, z: Number(shape.z) || 0 }))
            .sort((a, b) => (a.z - b.z) || (a.index - b.index))
            .map(entry => entry.shape);
    }
    /** Overwrite a shape's position and notify listeners. */
    updatePosition(id, x, y) {
        const shape = this.shapes.get(id);
        if (!shape) {
            throw new Error(`Shape with id ${id} not found`);
        }
        const oldPosition = { ...shape.position };
        shape.position = { x, y };
        this.eventBus.emit(EVENTS.SHAPE_MOVED, {
            id,
            shape,
            oldPosition,
            newPosition: { x, y }
        });
    }
    /**
     * Attach or replace a Binding on a single property of a shape, then
     * signal that a re-render is needed.
     */
    updateBinding(shapeId, property, binding) {
        const shape = this.shapes.get(shapeId);
        if (!shape) {
            throw new Error(`Shape with id ${shapeId} not found`);
        }
        shape.setBinding(property, binding);
        this.eventBus.emit(EVENTS.PARAM_CHANGED, {
            shapeId,
            property
        });
    }
    // ── Shape Selection ─────────────────────────────────────────────────
    /** Return the single "primary" selected shape. */
    getSelected() {
        return this.selection.getSelected();
    }
    /** Replace the entire selection with a single shape. */
    setSelected(id) {
        this.selection.setSelected(id);
    }
    /** Return a snapshot of the currently-selected shape IDs. */
    getSelectedIds() {
        return this.selection.getSelectedIds();
    }
    /** Add a single shape to the existing selection (Shift+click behaviour). */
    addToSelection(id) {
        this.selection.addToSelection(id);
    }
    /** Remove a single shape from the selection. */
    removeFromSelection(id) {
        this.selection.removeFromSelection(id);
    }
    /** Replace the entire selection with the given list of IDs. */
    setSelectedIds(ids) {
        this.selection.setSelectedIds(ids);
    }
    /** Deselect everything. */
    clearSelection() {
        this.selection.clearSelection();
    }
    /** Select every shape in the store (Ctrl+A). */
    selectAll() {
        this.selection.selectAll();
    }
    // ── Edge Selection Methods ──────────────────────────────────────────
    /** Switch the global selection mode. */
    setSelectionMode(mode) {
        this.selection.setSelectionMode(mode);
    }
    /** Return the current selection mode string. */
    getSelectionMode() {
        return this.selection.getSelectionMode();
    }
    /** Extract the geometric edges of a single shape. */
    getEdgesForShape(shapeId) {
        const shape = this.shapes.get(shapeId);
        if (!shape)
            return [];
        const resolved = this.bindingResolver.resolveShape(shape);
        const path = resolved.toGeometryPath ? resolved.toGeometryPath() : null;
        if (!path)
            return [];
        const edges = edgesFromItem(path);
        edges.forEach((edge) => {
            edge.shapeId = shapeId;
        });
        return edges;
    }
    /** Extract the geometric edges of every shape currently in the store. */
    getEdgesForAllShapes() {
        const edges = [];
        const resolvedShapes = this.getResolved();
        resolvedShapes.forEach((shape) => {
            if (!shape.toGeometryPath)
                return;
            const path = shape.toGeometryPath();
            const shapeEdges = edgesFromItem(path);
            shapeEdges.forEach((edge) => {
                edge.shapeId = shape.id;
            });
            edges.push(...shapeEdges);
        });
        return edges;
    }
    /** Extract edges only for the shapes that are currently selected. */
    getEdgesForSelectedShapes() {
        const edges = [];
        this.selectedShapeIds.forEach((id) => {
            edges.push(...this.getEdgesForShape(id));
        });
        return edges;
    }
    /** Replace the current edge selection with exactly one edge. */
    selectEdge(edge) {
        this.selection.selectEdge(edge);
    }
    /** Add an edge to the current selection without clearing the others. */
    addEdgeToSelection(edge) {
        this.selection.addEdgeToSelection(edge);
    }
    /** Remove a specific edge from the selection without touching the rest. */
    removeEdgeFromSelection(edge) {
        this.selection.removeEdgeFromSelection(edge);
    }
    /** Toggle an edge's presence in the selection. */
    toggleEdgeSelection(edge) {
        this.selection.toggleEdgeSelection(edge);
    }
    /** Deselect every edge and clear the hovered-edge state. */
    clearEdgeSelection() {
        this.selection.clearEdgeSelection();
    }
    /** Return the array of all currently-selected edges. */
    getSelectedEdges() {
        return this.selection.getSelectedEdges();
    }
    // ── Edge Joinery ─────────────────────────────────────────────────────
    /** Persist joinery metadata for an edge. */
    setEdgeJoinery(edge, joinery) {
        if (!edge || !joinery)
            return;
        const key = EdgeSelection.keyFor(edge);
        this.edgeJoinery.set(key, {
            type: joinery.type,
            thicknessMm: joinery.thicknessMm,
            fingerCount: joinery.fingerCount,
            align: joinery.align || 'left'
        });
        this.eventBus.emit(EVENTS.EDGE_JOINERY_CHANGED, {
            edge,
            joinery: { ...joinery }
        });
    }
    /** Remove the joinery metadata for an edge (undo of setEdgeJoinery). */
    removeEdgeJoinery(edge) {
        if (!edge)
            return;
        const key = EdgeSelection.keyFor(edge);
        if (this.edgeJoinery.delete(key)) {
            this.eventBus.emit(EVENTS.EDGE_JOINERY_CHANGED, {
                edge,
                joinery: null
            });
        }
    }
    /** Retrieve the joinery metadata previously stored for an edge. */
    getEdgeJoinery(edge) {
        if (!edge)
            return null;
        const key = EdgeSelection.keyFor(edge);
        if (this.edgeJoinery.has(key)) {
            return this.edgeJoinery.get(key) || null;
        }
        if (edge?.shapeId) {
            const legacyKey = `${edge.pathIndex}:${edge.index}`;
            return this.edgeJoinery.get(legacyKey) || null;
        }
        return null;
    }
    /** Query whether a given edge is in the current edge selection. */
    isEdgeSelected(edge) {
        return this.selection.isEdgeSelected(edge);
    }
    // ── Hover State ──────────────────────────────────────────────────────
    /** Record which edge the pointer is currently over. */
    setHoveredEdge(edge, position = null) {
        this.selection.setHoveredEdge(edge, position);
    }
    /** Return the currently-hovered edge descriptor, or null. */
    getHoveredEdge() {
        return this.selection.getHoveredEdge();
    }
    /** Record which shape the pointer is currently over. */
    setHoveredShape(shapeId) {
        this.selection.setHoveredShape(shapeId);
    }
    /** Return the ID of the shape the pointer is currently hovering over. */
    getHoveredShapeId() {
        return this.selection.getHoveredShapeId();
    }
    // ── Serialization ─────────────────────────────────────────────────────
    /** Produce a plain-object snapshot of the store suitable for JSON.stringify. */
    toJSON() {
        return {
            shapes: Array.from(this.shapes.values()).map(shape => shape.toJSON()),
            selectedShapeId: this.selectedShapeId,
            selectedShapeIds: Array.from(this.selectedShapeIds),
            edgeJoinery: Array.from(this.edgeJoinery.entries()).map(([key, value]) => ({
                key,
                type: value.type,
                thicknessMm: value.thicknessMm,
                fingerCount: value.fingerCount,
                align: value.align || 'center'
            }))
        };
    }
    /** Reconstruct the store's state from a previously-serialised snapshot. */
    async fromJSON(json) {
        if (!json || !json.shapes) {
            throw new Error('Invalid ShapeStore JSON');
        }
        this.shapes.clear();
        const { ShapeRegistry } = await import('../models/shapes/ShapeRegistry.js');
        json.shapes.forEach((shapeJson) => {
            const shape = ShapeRegistry.fromJSON(shapeJson);
            this.shapes.set(shape.id, shape);
        });
        this.selectedShapeId = json.selectedShapeId || null;
        this.selectedShapeIds.clear();
        if (json.selectedShapeIds && Array.isArray(json.selectedShapeIds)) {
            json.selectedShapeIds.forEach((id) => {
                if (this.shapes.has(id)) {
                    this.selectedShapeIds.add(id);
                }
            });
        }
        this.edgeJoinery.clear();
        if (json.edgeJoinery && Array.isArray(json.edgeJoinery)) {
            json.edgeJoinery.forEach((entry) => {
                if (entry && entry.key && entry.type) {
                    this.edgeJoinery.set(entry.key, {
                        type: entry.type,
                        thicknessMm: entry.thicknessMm,
                        fingerCount: entry.fingerCount,
                        align: entry.align || 'center'
                    });
                }
            });
        }
    }
}
