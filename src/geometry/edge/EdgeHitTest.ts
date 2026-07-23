/**
 * Geometry Library - EdgeHitTest
 *
 * Hit testing utilities for detecting when a point is near an edge.
 * Supports both linear and curved (bezier) edges.
 */

import { BoundingBox } from '../BoundingBox.js';
import { Vec } from '../Vec.js';
import { Edge } from './Edge.js';
import { edgesFromItem } from './edgeHelpers.js';
import type { Path } from '../Path.js';
import type { Shape } from '../Shape.js';
import type { Group } from '../Group.js';

export interface EdgeHitResult {
    /** The edge that was hit */
    edge: Edge;
    /** Closest point on edge */
    position: Vec;
    /** Parameter (0-1) along edge */
    time: number;
    /** Distance from test point to edge */
    distance: number;
}

/** Default hit distance in pixels. */
export const DEFAULT_HIT_DISTANCE = 6;

/** Test if a point hits an edge within tolerance. */
export const hitTestEdge = (
    edge: Edge,
    point: Vec | { x: number; y: number },
    tolerance: number = DEFAULT_HIT_DISTANCE
): EdgeHitResult | null => {
    const result = edge.closestPoint(point);
    if (result.distance <= tolerance) {
        return {
            edge,
            position: result.position,
            time: result.time,
            distance: result.distance,
        };
    }
    return null;
};

interface HitTestEdgesOptions {
    maxDistance?: number;
}

/** Find the closest edge to a point from an array of edges. */
export const hitTestEdges = (
    edges: Edge[],
    point: Vec | { x: number; y: number },
    options: HitTestEdgesOptions = {}
): EdgeHitResult | null => {
    const maxDistance = options.maxDistance ?? DEFAULT_HIT_DISTANCE;
    let closest: EdgeHitResult | null = null;

    for (const edge of edges) {
        const result = edge.closestPoint(point);
        if (result.distance > maxDistance) continue;
        if (!closest || result.distance < closest.distance) {
            closest = {
                edge,
                position: result.position,
                time: result.time,
                distance: result.distance,
            };
        }
    }

    return closest;
};

/** Find all edges within tolerance of a point. */
export const hitTestEdgesAll = (
    edges: Edge[],
    point: Vec | { x: number; y: number },
    tolerance: number = DEFAULT_HIT_DISTANCE
): EdgeHitResult[] => {
    const results: EdgeHitResult[] = [];
    for (const edge of edges) {
        const result = edge.closestPoint(point);
        if (result.distance <= tolerance) {
            results.push({
                edge,
                position: result.position,
                time: result.time,
                distance: result.distance,
            });
        }
    }
    return results.sort((a, b) => a.distance - b.distance);
};

type GeometryItem = Path | Shape | Group;

interface HitTestItemEdgesOptions {
    maxDistance?: number;
}

/** Test if a point hits any edge of a geometry item. */
export const hitTestItemEdges = (
    item: GeometryItem,
    point: Vec | { x: number; y: number },
    options: HitTestItemEdgesOptions = {}
): EdgeHitResult | null => {
    const edges = edgesFromItem(item);
    return hitTestEdges(edges, point, options);
};

/** Find all edges of an item within tolerance of a point. */
export const hitTestItemEdgesAll = (
    item: GeometryItem,
    point: Vec | { x: number; y: number },
    tolerance: number = DEFAULT_HIT_DISTANCE
): EdgeHitResult[] => {
    const edges = edgesFromItem(item);
    return hitTestEdgesAll(edges, point, tolerance);
};

/** Find edges that intersect a rectangular region. */
export const edgesIntersectingBox = (edges: Edge[], box: BoundingBox): Edge[] => {
    const results: Edge[] = [];
    for (const edge of edges) {
        const edgePath = edge.toPath();
        const edgeBox = edgePath.looseBoundingBox();
        if (edgeBox && box.overlapsBoundingBox(edgeBox)) {
            results.push(edge);
        }
    }
    return results;
};

/** Find edges fully contained within a rectangular region. */
export const edgesContainedInBox = (edges: Edge[], box: BoundingBox): Edge[] => {
    const results: Edge[] = [];
    for (const edge of edges) {
        const p1 = edge.anchor1.position;
        const p2 = edge.anchor2.position;
        if (box.containsPoint(p1) && box.containsPoint(p2)) {
            // For curved edges, also check control points
            if (!edge.isLinear()) {
                const handleOut = p1.clone().add(edge.anchor1.handleOut);
                const handleIn = p2.clone().add(edge.anchor2.handleIn);
                if (!box.containsPoint(handleOut) || !box.containsPoint(handleIn)) {
                    continue;
                }
            }
            results.push(edge);
        }
    }
    return results;
};

interface EdgeHitTesterOptions {
    tolerance?: number;
}

interface TestBoxOptions {
    fullyContained?: boolean;
}

/** EdgeHitTester provides stateful hit testing with caching. */
export class EdgeHitTester {
    tolerance: number;
    _edges: Edge[];
    _bounds: BoundingBox | null;

    constructor(options: EdgeHitTesterOptions = {}) {
        this.tolerance = options.tolerance ?? DEFAULT_HIT_DISTANCE;
        this._edges = [];
        this._bounds = null;
    }

    /** Set edges to test against. */
    setEdges(edges: Edge[]): EdgeHitTester {
        this._edges = edges;
        this._bounds = null;
        return this;
    }

    /** Set edges from a geometry item. */
    setItem(item: GeometryItem): EdgeHitTester {
        this._edges = edgesFromItem(item);
        this._bounds = null;
        return this;
    }

    /** Get cached bounds of all edges. */
    getBounds(): BoundingBox | null {
        if (!this._bounds && this._edges.length > 0) {
            const allPoints: Vec[] = [];
            for (const edge of this._edges) {
                allPoints.push(edge.anchor1.position);
                allPoints.push(edge.anchor2.position);
            }
            this._bounds = BoundingBox.fromPoints(allPoints);
        }
        return this._bounds;
    }

    /** Test a point against all edges. */
    test(point: Vec | { x: number; y: number }): EdgeHitResult | null {
        // Quick bounds check
        const bounds = this.getBounds();
        if (bounds) {
            const expandedBounds = bounds.clone().expandScalar(this.tolerance);
            const p = Vec.isValid(point) ? point : new Vec(point.x, point.y);
            if (!expandedBounds.containsPoint(p)) {
                return null;
            }
        }
        return hitTestEdges(this._edges, point, { maxDistance: this.tolerance });
    }

    /** Find all hits at a point. */
    testAll(point: Vec | { x: number; y: number }): EdgeHitResult[] {
        const bounds = this.getBounds();
        if (bounds) {
            const expandedBounds = bounds.clone().expandScalar(this.tolerance);
            const p = Vec.isValid(point) ? point : new Vec(point.x, point.y);
            if (!expandedBounds.containsPoint(p)) {
                return [];
            }
        }
        return hitTestEdgesAll(this._edges, point, this.tolerance);
    }

    /** Find edges in a box region. */
    testBox(box: BoundingBox, options: TestBoxOptions = {}): Edge[] {
        if (options.fullyContained) {
            return edgesContainedInBox(this._edges, box);
        }
        return edgesIntersectingBox(this._edges, box);
    }
}