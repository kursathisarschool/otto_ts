/**
 * Geometry Library - EdgeSelection
 *
 * Manages selection state for edges. Tracks which edges are selected
 * and provides utilities for selection operations.
 */

import { Edge } from './Edge.js';

/**
 * EdgeSelection manages a collection of selected edges.
 *
 * @example
 * const selection = new EdgeSelection();
 * selection.add(edge1);
 * selection.add(edge2);
 * selection.has(edge1); // true
 * selection.clear();
 */
export class EdgeSelection {
    _edges: Set<Edge>;
    _edgesByKey: Map<string, Edge>;

    constructor() {
        this._edges = new Set();
        this._edgesByKey = new Map();
    }

    /** Generate a unique key for an edge. */
    static keyFor(edge: Edge & { shapeId?: string; shapeID?: string; sourceShapeId?: string }): string {
        const shapeId = edge?.shapeId ?? edge?.shapeID ?? edge?.sourceShapeId ?? null;
        if (shapeId) {
            return `${shapeId}:${edge.pathIndex}:${edge.index}`;
        }
        return `${edge.pathIndex}:${edge.index}`;
    }

    /** Get the number of selected edges. */
    get size(): number {
        return this._edges.size;
    }

    /** Check if selection is empty. */
    isEmpty(): boolean {
        return this._edges.size === 0;
    }

    /** Check if an edge is selected. */
    has(edge: Edge): boolean {
        const key = EdgeSelection.keyFor(edge);
        return this._edgesByKey.has(key);
    }

    /** Add an edge to selection. */
    add(edge: Edge): EdgeSelection {
        const key = EdgeSelection.keyFor(edge);
        if (!this._edgesByKey.has(key)) {
            this._edges.add(edge);
            this._edgesByKey.set(key, edge);
        }
        return this;
    }

    /** Remove an edge from selection. Returns true if edge was removed. */
    remove(edge: Edge): boolean {
        const key = EdgeSelection.keyFor(edge);
        const existing = this._edgesByKey.get(key);
        if (existing) {
            this._edges.delete(existing);
            this._edgesByKey.delete(key);
            return true;
        }
        return false;
    }

    /** Toggle edge selection state. Returns true if now selected. */
    toggle(edge: Edge): boolean {
        if (this.has(edge)) {
            this.remove(edge);
            return false;
        }
        this.add(edge);
        return true;
    }

    /** Clear all selections. */
    clear(): EdgeSelection {
        this._edges.clear();
        this._edgesByKey.clear();
        return this;
    }

    /** Set selection to a single edge. */
    set(edge: Edge): EdgeSelection {
        this.clear();
        this.add(edge);
        return this;
    }

    /** Set selection to multiple edges. */
    setAll(edges: Edge[]): EdgeSelection {
        this.clear();
        edges.forEach((edge) => this.add(edge));
        return this;
    }

    /** Add multiple edges to selection. */
    addAll(edges: Edge[]): EdgeSelection {
        edges.forEach((edge) => this.add(edge));
        return this;
    }

    /** Get all selected edges. */
    all(): Edge[] {
        return Array.from(this._edges);
    }

    /** Get first selected edge. */
    first(): Edge | undefined {
        return this._edges.values().next().value;
    }

    /** Iterate over selected edges. */
    forEach(fn: (edge: Edge) => void): void {
        this._edges.forEach(fn);
    }

    /** Map over selected edges. */
    map<T>(fn: (edge: Edge) => T): T[] {
        return this.all().map(fn);
    }

    /** Filter selected edges. */
    filter(fn: (edge: Edge) => boolean): Edge[] {
        return this.all().filter(fn);
    }

    /** Check if any edge matches predicate. */
    some(fn: (edge: Edge) => boolean): boolean {
        return this.all().some(fn);
    }

    /** Check if all edges match predicate. */
    every(fn: (edge: Edge) => boolean): boolean {
        return this.all().every(fn);
    }

    /** Create a copy of this selection. */
    clone(): EdgeSelection {
        const copy = new EdgeSelection();
        copy.addAll(this.all());
        return copy;
    }
}