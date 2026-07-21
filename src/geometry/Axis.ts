/**
 * Geometry Library - Axis
 *
 * Axis helper class for alignment and snapping operations.
 */

import { Geometry, type ClosestPointResult } from './Geometry.js';
import { Vec } from './Vec.js';
import type { AffineMatrix } from './Matrix.js';
import type { BoundingBox } from './BoundingBox.js';

/** Default axis directions for snapping. */
const defaultDirections: Vec[] = [
    new Vec(1, 0),
    new Vec(0, 1),
    new Vec(1, 1).normalize(),
    new Vec(1, -1).normalize(),
];

/**
 * Axis class representing an infinite line through an origin point.
 *
 * @example
 * const xAxis = new Axis(new Vec(0, 0), new Vec(1, 0));
 */
export class Axis extends Geometry {
    static displayName = 'Axis';

    origin: Vec;
    direction: Vec;

    constructor(origin: Vec = new Vec(), direction: Vec = new Vec(1, 0)) {
        super();
        this.origin = origin;
        this.direction = direction;
    }

    /** Create a copy of this axis. */
    clone(): Axis {
        return new Axis(this.origin.clone(), this.direction.clone());
    }

    /** Check if this axis is valid. */
    isValid(): boolean {
        return Vec.isValid(this.origin) && Vec.isValid(this.direction);
    }

    /** Apply an affine transformation. */
    affineTransform(affineMatrix: AffineMatrix): Axis {
        this.origin.affineTransform(affineMatrix);
        this.direction.affineTransformWithoutTranslation(affineMatrix);
        return this;
    }

    /** Apply an affine transformation without translation. */
    affineTransformWithoutTranslation(affineMatrix: AffineMatrix): Axis {
        this.direction.affineTransformWithoutTranslation(affineMatrix);
        return this;
    }

    // =========================================================================
    // Collection methods
    // =========================================================================

    /** Get all intersectable geometry. */
    allIntersectables(): Axis[] {
        return [this];
    }

    // =========================================================================
    // Closest Point
    // =========================================================================

    /** Find closest point within distance. */
    closestPointWithinDistanceToPoint(maxDistance: number, point: Vec): ClosestPointResult {
        const position = point
            .clone()
            .projectToLine(this.origin, this.origin.clone().add(this.direction));
        const distance = point.distance(position);
        if (distance <= maxDistance) {
            return { position, distance };
        }
        return { distance: Infinity };
    }

    // =========================================================================
    // Bounding Box (not applicable for infinite axis)
    // =========================================================================

    /** Get loose bounding box (undefined for infinite axis). */
    looseBoundingBox(): undefined {
        return undefined;
    }

    /** Get tight bounding box (undefined for infinite axis). */
    tightBoundingBox(): undefined {
        return undefined;
    }

    /** Check if contained by bounding box (always false for infinite axis). */
    isContainedByBoundingBox(box: BoundingBox): boolean {
        return false;
    }

    /**
     * Check if intersected by bounding box.
     * An infinite line intersects a box if the line passes through or near it.
     */
    isIntersectedByBoundingBox(box: BoundingBox): boolean {
        const center = box.center();
        const projected = center.clone().projectToLine(
            this.origin,
            this.origin.clone().add(this.direction)
        );
        const diagonal = box.max.distance(box.min);
        return projected.distance(center) <= diagonal;
    }

    /** Check if overlapped by bounding box. */
    isOverlappedByBoundingBox(box: BoundingBox): boolean {
        return this.isIntersectedByBoundingBox(box);
    }

    // =========================================================================
    // Static Methods
    // =========================================================================

    /** Validate that value is a valid Axis. */
    static isValid(a: unknown): a is Axis {
        return a instanceof Axis && a.isValid();
    }

    /**
     * Create axis from origin and closest predefined direction to a point.
     * Useful for snapping to common axis directions.
     */
    static fromOriginAndClosestDirectionToPoint(
        origin: Vec,
        point: Vec,
        directions: Vec[] = defaultDirections
    ): Axis {
        let direction = point.clone().sub(origin);
        let closestAxis = directions[0];
        let closestMag = -1;
        let closestD = 0;

        for (let axis of directions) {
            const d = axis.dot(direction);
            const mag = Math.abs(d);
            if (mag > closestMag) {
                closestAxis = axis;
                closestMag = mag;
                closestD = d;
            }
        }

        direction.copy(closestAxis).mulScalar(closestD);
        return new Axis(origin, direction);
    }
}