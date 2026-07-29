/**
 * @fileoverview Central repository for all shapes in a single scene.
 * @module core/ShapeStore
 */
import EventBus, { EVENTS } from '../events/EventBus.js';
import { Edge, EdgeSelection, edgesFromItem } from '../geometry/edge/index.js';
import { SelectionModel } from './SelectionModel.js';

interface JoineryData {
    type: string;
    thicknessMm: number;
    fingerCount: number;
    align: string;
}

export class ShapeStore {
    /** The canonical shape map for this scene. Keys are shape IDs; values are Shape objects. */
    shapes: Map<string, any>;
    parameterStore: any;
    bindingResolver: any;
    eventBus: typeof EventBus;
    selection: SelectionModel;
    /** Persistent map of joinery metadata keyed by a canonical edge key string. */
    edgeJoinery: Map<string, JoineryData>;

    constructor(parameterStore: any, bindingResolver: any) {
        this.shapes = new Map();
        this.parameterStore = parameterStore;
        this.bindingResolver = bindingResolver;

        this.eventBus = EventBus;

        this.selection = new SelectionModel({
            getShape: (id: string) => this.shapes.get(id) ?? null,
            getAllIds: () => Array.from(this.shapes.keys())
        });

        this.edgeJoinery = new Map();
    }

    // ── Backward-compatible selection accessors ─────────────────────────

    /** Primary selected shape id. */
    get selectedShapeId(): string | null {
        return this.selection.primaryId;
    }

    set selectedShapeId(id: string | null) {
        this.selection.primaryId = id;
    }

    /** The LIVE selected-ids set (not a copy). */
    get selectedShapeIds(): Set<string> {
        return this.selection.selectedShapeIds;
    }

    /** The edge-selection delegate. */
    get edgeSelection(): EdgeSelection {
        return this.selection.edgeSelection;
    }

    get selectionMode(): 'shape' | 'edge' {
        return this.selection.selectionMode;
    }

    get hoveredEdge(): { edge: Edge; position: any } | null {
        return this.selection.hoveredEdge;
    }

    get hoveredShapeId(): string | null {
        return this.selection.hoveredShapeId;
    }

    /**
     * Insert a shape into the store and notify listeners.
     */
    add(shape: any): void {
        if (this.shapes.has(shape.id)) {
            throw new Error(`Shape with id ${shape.id} already exists`);
        }
        this.shapes.set(shape.id, shape);
        this.eventBus.emit(EVENTS.SHAPE_ADDED, shape);
    }

    /**
     * Remove a shape and cascade-clean all state that references it.
     */
    remove(id: string): void {
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
    replace(shape: any): void {
        if (!this.shapes.has(shape.id)) {
            throw new Error(`Shape with id ${shape.id} not found`);
        }
        this.shapes.set(shape.id, shape);
        this.eventBus.emit(EVENTS.SHAPE_UPDATED, { id: shape.id, shape });
        this.eventBus.emit(EVENTS.PARAM_CHANGED, { shapeId: shape.id });
    }

    /** Look up a single shape by its ID. */
    get(id: string): any {
        return this.shapes.get(id) || null;
    }

    /** Return every shape in the store as a flat array. */
    getAll(): any[] {
        return Array.from(this.shapes.values());
    }

    /** Return all shapes with every parameter binding resolved to its current concrete value. */
    getResolved(): any[] {
        return this.bindingResolver.resolveAll(this.getAll());
    }

    /**
     * Resolved shapes sorted by 2.5D elevation (z), lowest first, with
     * insertion order breaking ties.
     */
    getResolvedSorted(): any[] {
        const resolved = this.getResolved();
        return resolved
            .map((shape, index) => ({ shape, index, z: Number(shape.z) || 0 }))
            .sort((a, b) => (a.z - b.z) || (a.index - b.index))
            .map(entry => entry.shape);
    }

    /** Overwrite a shape's position and notify listeners. */
    updatePosition(id: string, x: number, y: number): void {
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
    updateBinding(shapeId: string, property: string, binding: any): void {
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
    getSelected(): any {
        return this.selection.getSelected();
    }

    /** Replace the entire selection with a single shape. */
    setSelected(id: string | null): void {
        this.selection.setSelected(id);
    }

    /** Return a snapshot of the currently-selected shape IDs. */
    getSelectedIds(): Set<string> {
        return this.selection.getSelectedIds();
    }

    /** Add a single shape to the existing selection (Shift+click behaviour). */
    addToSelection(id: string): void {
        this.selection.addToSelection(id);
    }

    /** Remove a single shape from the selection. */
    removeFromSelection(id: string): void {
        this.selection.removeFromSelection(id);
    }

    /** Replace the entire selection with the given list of IDs. */
    setSelectedIds(ids: string[]): void {
        this.selection.setSelectedIds(ids);
    }

    /** Deselect everything. */
    clearSelection(): void {
        this.selection.clearSelection();
    }

    /** Select every shape in the store (Ctrl+A). */
    selectAll(): void {
        this.selection.selectAll();
    }

    // ── Edge Selection Methods ──────────────────────────────────────────

    /** Switch the global selection mode. */
    setSelectionMode(mode: 'shape' | 'edge'): void {
        this.selection.setSelectionMode(mode);
    }

    /** Return the current selection mode string. */
    getSelectionMode(): 'shape' | 'edge' {
        return this.selection.getSelectionMode();
    }

    /** Extract the geometric edges of a single shape. */
    getEdgesForShape(shapeId: string): Edge[] {
        const shape = this.shapes.get(shapeId);
        if (!shape) return [];

        const resolved = this.bindingResolver.resolveShape(shape);
        const path = resolved.toGeometryPath ? resolved.toGeometryPath() : null;
        if (!path) return [];

        const edges = edgesFromItem(path);
        edges.forEach((edge: any) => {
            edge.shapeId = shapeId;
        });
        return edges;
    }

    /** Extract the geometric edges of every shape currently in the store. */
    getEdgesForAllShapes(): Edge[] {
        const edges: Edge[] = [];
        const resolvedShapes = this.getResolved();
        resolvedShapes.forEach((shape: any) => {
            if (!shape.toGeometryPath) return;
            const path = shape.toGeometryPath();
            const shapeEdges = edgesFromItem(path);
            shapeEdges.forEach((edge: any) => {
                edge.shapeId = shape.id;
            });
            edges.push(...shapeEdges);
        });
        return edges;
    }

    /** Extract edges only for the shapes that are currently selected. */
    getEdgesForSelectedShapes(): Edge[] {
        const edges: Edge[] = [];
        this.selectedShapeIds.forEach((id: string) => {
            edges.push(...this.getEdgesForShape(id));
        });
        return edges;
    }

    /** Replace the current edge selection with exactly one edge. */
    selectEdge(edge: Edge): void {
        this.selection.selectEdge(edge);
    }

    /** Add an edge to the current selection without clearing the others. */
    addEdgeToSelection(edge: Edge): void {
        this.selection.addEdgeToSelection(edge);
    }

    /** Remove a specific edge from the selection without touching the rest. */
    removeEdgeFromSelection(edge: Edge): void {
        this.selection.removeEdgeFromSelection(edge);
    }

    /** Toggle an edge's presence in the selection. */
    toggleEdgeSelection(edge: Edge): void {
        this.selection.toggleEdgeSelection(edge);
    }

    /** Deselect every edge and clear the hovered-edge state. */
    clearEdgeSelection(): void {
        this.selection.clearEdgeSelection();
    }

    /** Return the array of all currently-selected edges. */
    getSelectedEdges(): Edge[] {
        return this.selection.getSelectedEdges();
    }

    // ── Edge Joinery ─────────────────────────────────────────────────────

    /** Persist joinery metadata for an edge. */
    setEdgeJoinery(edge: Edge, joinery: Partial<JoineryData>): void {
        if (!edge || !joinery) return;
        const key = EdgeSelection.keyFor(edge as any);
        this.edgeJoinery.set(key, {
            type: joinery.type!,
            thicknessMm: joinery.thicknessMm!,
            fingerCount: joinery.fingerCount!,
            align: joinery.align || 'left'
        });
        this.eventBus.emit(EVENTS.EDGE_JOINERY_CHANGED, {
            edge,
            joinery: { ...joinery }
        });
    }

    /** Remove the joinery metadata for an edge (undo of setEdgeJoinery). */
    removeEdgeJoinery(edge: Edge): void {
        if (!edge) return;
        const key = EdgeSelection.keyFor(edge as any);
        if (this.edgeJoinery.delete(key)) {
            this.eventBus.emit(EVENTS.EDGE_JOINERY_CHANGED, {
                edge,
                joinery: null
            });
        }
    }

    /** Retrieve the joinery metadata previously stored for an edge. */
    getEdgeJoinery(edge: any): JoineryData | null {
        if (!edge) return null;
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
    isEdgeSelected(edge: Edge): boolean {
        return this.selection.isEdgeSelected(edge);
    }

    // ── Hover State ──────────────────────────────────────────────────────

    /** Record which edge the pointer is currently over. */
    setHoveredEdge(edge: Edge | null, position: any = null): void {
        this.selection.setHoveredEdge(edge, position);
    }

    /** Return the currently-hovered edge descriptor, or null. */
    getHoveredEdge(): { edge: Edge; position: any } | null {
        return this.selection.getHoveredEdge();
    }

    /** Record which shape the pointer is currently over. */
    setHoveredShape(shapeId: string | null): void {
        this.selection.setHoveredShape(shapeId);
    }

    /** Return the ID of the shape the pointer is currently hovering over. */
    getHoveredShapeId(): string | null {
        return this.selection.getHoveredShapeId();
    }

    // ── Serialization ─────────────────────────────────────────────────────

    /** Produce a plain-object snapshot of the store suitable for JSON.stringify. */
    toJSON(): {
        shapes: any[];
        selectedShapeId: string | null;
        selectedShapeIds: string[];
        edgeJoinery: any[];
    } {
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
    async fromJSON(json: any): Promise<void> {
        if (!json || !json.shapes) {
            throw new Error('Invalid ShapeStore JSON');
        }

        this.shapes.clear();
        const { ShapeRegistry } = await import('../models/shapes/ShapeRegistry.js');

        json.shapes.forEach((shapeJson: any) => {
            const shape = ShapeRegistry.fromJSON(shapeJson);
            this.shapes.set(shape.id, shape);
        });

        this.selectedShapeId = json.selectedShapeId || null;
        this.selectedShapeIds.clear();
        if (json.selectedShapeIds && Array.isArray(json.selectedShapeIds)) {
            json.selectedShapeIds.forEach((id: string) => {
                if (this.shapes.has(id)) {
                    this.selectedShapeIds.add(id);
                }
            });
        }

        this.edgeJoinery.clear();
        if (json.edgeJoinery && Array.isArray(json.edgeJoinery)) {
            json.edgeJoinery.forEach((entry: any) => {
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