/**
 * Geometry Library - BoundingBox
 *
 * Axis-aligned bounding box for 2D geometry.
 */
import { Vec } from './Vec.js';
/**
 * Axis-aligned bounding box defined by min and max corners.
 *
 * @example
 * const box = new BoundingBox(new Vec(0, 0), new Vec(100, 100));
 * box.width();  // 100
 * box.center(); // Vec(50, 50)
 */
export class BoundingBox {
    constructor(min = new Vec(), max = new Vec()) {
        this.min = min;
        this.max = max;
    }
    /** Create a copy of this bounding box. */
    clone() {
        return new BoundingBox(this.min.clone(), this.max.clone());
    }
    /** Get the center point. */
    center() {
        return this.min.clone().add(this.max).mulScalar(0.5);
    }
    /** Get the size as a vector (width, height). */
    size() {
        return this.max.clone().sub(this.min);
    }
    /** Get the width. */
    width() {
        return this.max.x - this.min.x;
    }
    /** Get the height. */
    height() {
        return this.max.y - this.min.y;
    }
    /** Check if both corners are finite. */
    isFinite() {
        return this.min.isFinite() && this.max.isFinite();
    }
    /** Ensure min <= max for both axes (swap if needed). */
    canonicalize() {
        const { x: x1, y: y1 } = this.min;
        const { x: x2, y: y2 } = this.max;
        this.min.set(Math.min(x1, x2), Math.min(y1, y2));
        this.max.set(Math.max(x1, x2), Math.max(y1, y2));
        return this;
    }
    /** Expand to include a point. */
    expandToIncludePoint(point) {
        this.min.min(point);
        this.max.max(point);
        return this;
    }
    /** Expand to include another bounding box. */
    expandToIncludeBoundingBox(box) {
        return this.expandToIncludePoint(box.min).expandToIncludePoint(box.max);
    }
    /** Expand by a distance in all directions. */
    expandScalar(distance) {
        this.min.subScalar(distance);
        this.max.addScalar(distance);
        return this;
    }
    /** Check if a point is inside the box (inclusive). */
    containsPoint({ x, y }) {
        return x >= this.min.x && x <= this.max.x && y >= this.min.y && y <= this.max.y;
    }
    /** Check if another bounding box is fully contained. */
    containsBoundingBox({ min, max }) {
        return min.x >= this.min.x && max.x <= this.max.x && min.y >= this.min.y && max.y <= this.max.y;
    }
    /** Check if another bounding box overlaps this one. */
    overlapsBoundingBox({ min, max }) {
        return max.x >= this.min.x && min.x <= this.max.x && max.y >= this.min.y && min.y <= this.max.y;
    }
    /** Create a bounding box from an array of points. Returns null if points array is empty. */
    static fromPoints(points) {
        if (points.length === 0)
            return null;
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
    static fromCubic([p1, p2, p3, p4]) {
        return new BoundingBox(new Vec(Math.min(p1.x, p2.x, p3.x, p4.x), Math.min(p1.y, p2.y, p3.y, p4.y)), new Vec(Math.max(p1.x, p2.x, p3.x, p4.x), Math.max(p1.y, p2.y, p3.y, p4.y)));
    }
    /** Validate that value is a valid BoundingBox. */
    static isValid(box) {
        return box instanceof BoundingBox && Vec.isValid(box.min) && Vec.isValid(box.max);
    }
}
BoundingBox.displayName = 'BoundingBox';
