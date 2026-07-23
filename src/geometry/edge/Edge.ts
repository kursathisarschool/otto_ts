/**
 * Geometry Library - Edge
 *
 * Represents a single segment between two anchors.
 */

import { Anchor } from '../Anchor.js';
import { Path } from '../Path.js';
import { Vec } from '../Vec.js';
import {
    cubicFromSegment,
    isSegmentLinear,
    Line,
    lineFromSegment,
    positionAndTimeAtClosestPointOnCubic,
    positionAndTimeAtClosestPointOnLine,
    segmentLength,
} from '../Segment.js';
import { Cubic } from '../bezier.js';

/**
 * Edge represents one path segment between two anchors.
 */
interface EdgeOptions {
    index?: number;
    pathIndex?: number;
    closed?: boolean;
}

export class Edge {
    anchor1: Anchor;
    anchor2: Anchor;
    index: number;
    pathIndex: number;
    closed: boolean;

    constructor(anchor1: Anchor, anchor2: Anchor, options: EdgeOptions = {}) {
        this.anchor1 = anchor1;
        this.anchor2 = anchor2;
        this.index = options.index ?? 0;
        this.pathIndex = options.pathIndex ?? 0;
        this.closed = options.closed ?? false;
    }

    /**
     * Check if this edge is valid.
     * @returns {boolean}
     */
    isValid(): boolean {
        return Anchor.isValid(this.anchor1) && Anchor.isValid(this.anchor2);
    }

    /**
     * Get the underlying segment anchors.
     * @returns {[Anchor, Anchor]}
     */
    segment(): [Anchor,Anchor] {
        return [this.anchor1, this.anchor2];
    }

    /**
     * Check if this edge is a straight line.
     * @returns {boolean}
     */
    isLinear(): boolean {
        return isSegmentLinear(this.segment());
    }

    /**
     * Get edge length.
     * @returns {number}
     */
    length(): number {
        return segmentLength(this.segment());
    }

    /**
     * Get line representation.
     * @returns {import('../Segment.js').Line}
     */
    toLine(): Line {
        return lineFromSegment(this.segment());
    }

    /**
     * Get cubic representation.
     * @returns {import('../Segment.js').Cubic}
     */
    toCubic(): Cubic {
        return cubicFromSegment(this.segment());
    }

    /**
     * Convert edge to a standalone Path for rendering.
     * @returns {Path}
     */
    toPath(): Path {
        return new Path([this.anchor1.clone(), this.anchor2.clone()]);
    }

    /**
     * Find closest point on the edge to a point.
     * @param {Vec|{x:number,y:number}} point
     * @returns {{position: Vec, time: number, distance: number}}
     */
    closestPoint(point: Vec | { x: number; y: number }): { position: Vec; time: number; distance: number } {
        const p = Vec.isValid(point) ? point : new Vec(point.x, point.y);
        const segment = this.segment();

        let result: { position: Vec; time: number } ;
        if (this.isLinear()) {
            result = positionAndTimeAtClosestPointOnLine(p, lineFromSegment(segment));
        } else {
            result = positionAndTimeAtClosestPointOnCubic(p, cubicFromSegment(segment));
        }

        const distance = result.position.distance(p);
        return {
            position: result.position,
            time: result.time,
            distance,
        };
    }
}
