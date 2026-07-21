/**
 * Geometry Library - BoundingBox
 *
 * Axis-aligned bounding box for 2D geometry.
 */

import { Vec } from './Vec.js';
import type { Cubic } from './bezier.js';

/**
 * Axis-aligned bounding box defined by min and max corners.
 *
 * @example
 * const box = new BoundingBox(new Vec(0, 0), new Vec(100, 100));
 * box.width();  // 100
 * box.center(); // Vec(50, 50)
 */
export class BoundingBox {
    static displayName = 'BoundingBox';

    min: Vec;
    max: Vec;

    constructor(min: Vec = new Vec(), max: Vec = new Vec()) {
        this.min = min;
        this.max = max;
    }

    /** Create a copy of this bounding box. */
    clone(): BoundingBox {
        return new BoundingBox(this.min.clone(), this.max.clone());
    }

    /** Get the center point. */
    center(): Vec {
        return this.min.clone().add(this.max).mulScalar(0.5);
    }

    /** Get the size as a vector (width, height). */
    size(): Vec {
        return this.max.clone().sub(this.min);
    }

    /** Get the width. */
    width(): number {
        return this.max.x - this.min.x;
    }

    /** Get the height. */
    height(): number {
        return this.max.y - this.min.y;
    }

    /** Check if both corners are finite. */
    isFinite(): boolean {
        return this.min.isFinite() && this.max.isFinite();
    }

    /** Ensure min <= max for both axes (swap if needed). */
    canonicalize(): BoundingBox {
        const { x: x1, y: y1 } = this.min;
        const { x: x2, y: y2 } = this.max;
        this.min.set(Math.min(x1, x2), Math.min(y1, y2));
        this.max.set(Math.max(x1, x2), Math.max(y1, y2));
        return this;
    }

    /** Expand to include a point. */
    expandToIncludePoint(point: Vec): BoundingBox {
        this.min.min(point);
        this.max.max(point);
        return this;
    }

    /** Expand to include another bounding box. */
    expandToIncludeBoundingBox(box: BoundingBox): BoundingBox {
        return this.expandToIncludePoint(box.min).expandToIncludePoint(box.max);
    }

    /** Expand by a distance in all directions. */
    expandScalar(distance: number): BoundingBox {
        this.min.subScalar(distance);
        this.max.addScalar(distance);
        return this;
    }

    /** Check if a point is inside the box (inclusive). */
    containsPoint({ x, y }: Vec): boolean {
        return x >= this.min.x && x <= this.max.x && y >= this.min.y && y <= this.max.y;
    }

    /** Check if another bounding box is fully contained. */
    containsBoundingBox({ min, max }: BoundingBox): boolean {
        return min.x >= this.min.x && max.x <= this.max.x && min.y >= this.min.y && max.y <= this.max.y;
    }

    /** Check if another bounding box overlaps this one. */
    overlapsBoundingBox({ min, max }: BoundingBox): boolean {
        return max.x >= this.min.x && min.x <= this.max.x && max.y >= this.min.y && min.y <= this.max.y;
    }

    /** Create a bounding box from an array of points. Returns null if points array is empty. */
    static fromPoints(points: Vec[]): BoundingBox | null {
        if (points.length === 0) return null;
        const box = new BoundingBox(points[0].clone(), points[0].clone());
        for (let i = 1, n = points.length; i < n; ++i) {
            box.expandToIncludePoint(points[i]);
        }
        return box;
    }

    /**
     * Create a bounding box from a cubic bezier's control points.
     * Note: This is a loose bound (control polygon), not tight.
     */
    static fromCubic([p1, p2, p3, p4]: Cubic): BoundingBox {
        return new BoundingBox(
            new Vec(Math.min(p1.x, p2.x, p3.x, p4.x), Math.min(p1.y, p2.y, p3.y, p4.y)),
            new Vec(Math.max(p1.x, p2.x, p3.x, p4.x), Math.max(p1.y, p2.y, p3.y, p4.y))
        );
    }

    /** Validate that value is a valid BoundingBox. */
    static isValid(box: unknown): box is BoundingBox {
        return box instanceof BoundingBox && Vec.isValid((box as BoundingBox).min) && Vec.isValid((box as BoundingBox).max);
    }
}