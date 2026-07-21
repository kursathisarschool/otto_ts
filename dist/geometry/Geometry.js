/**
 * Geometry Library - Geometry
 *
 * Abstract base class for all geometry types.
 * In JavaScript we implement this as a regular class with default implementations.
 */
import { AffineMatrix } from './Matrix.js';
/**
 * Abstract base class for all geometry types.
 * Provides default implementations that subclasses override.
 *
 * Subclasses must implement:
 * - clone()
 * - isValid()
 * - closestPointWithinDistanceToPoint()
 * - affineTransform()
 * - affineTransformWithoutTranslation()
 */
export class Geometry {
    /** Create a copy of this geometry. */
    clone() {
        throw new Error('clone() must be implemented by subclass');
    }
    /** Check if this geometry is valid. */
    isValid() {
        throw new Error('isValid() must be implemented by subclass');
    }
    /** Find the closest point within a maximum distance. */
    closestPointWithinDistanceToPoint(maxDistance, point) {
        return { distance: Infinity };
    }
    /** Apply an affine transformation matrix. */
    affineTransform(affineMatrix) {
        throw new Error('affineTransform() must be implemented by subclass');
    }
    /** Apply an affine transformation without translation. */
    affineTransformWithoutTranslation(affineMatrix) {
        throw new Error('affineTransformWithoutTranslation() must be implemented by subclass');
    }
    /** Apply a transform object. */
    transform(transform) {
        return this.affineTransform(AffineMatrix.fromTransform(transform));
    }
    // =========================================================================
    // Collection methods (return empty by default)
    // =========================================================================
    /** Get all shapes in this geometry. */
    allShapes() {
        return [];
    }
    /** Get all paths in this geometry. */
    allPaths() {
        return [];
    }
    /** Get all anchors in this geometry. */
    allAnchors() {
        return [];
    }
    /** Get all orphaned anchors (not part of a path). */
    allOrphanedAnchors() {
        return [];
    }
    /** Get all shapes and orphaned paths. */
    allShapesAndOrphanedPaths() {
        return [];
    }
    /** Get all intersectable geometry (paths and axes). */
    allIntersectables() {
        return [];
    }
    // =========================================================================
    // Operations (return this by default)
    // =========================================================================
    /** Reverse the direction of this geometry. */
    reverse() {
        return this;
    }
    // =========================================================================
    // Style methods (return this by default)
    // =========================================================================
    /** Assign a fill style. */
    assignFill(fill) {
        return this;
    }
    /** Remove fill style. */
    removeFill() {
        return this;
    }
    /** Assign a stroke style. */
    assignStroke(stroke) {
        return this;
    }
    /** Remove stroke style. */
    removeStroke() {
        return this;
    }
    /** Assign both fill and stroke. */
    assignStyle(fill, stroke) {
        return this;
    }
    /** Copy style from another geometry. */
    copyStyle(item) {
        return this;
    }
    /** Scale stroke width. */
    scaleStroke(scaleFactor) {
        return this;
    }
    // =========================================================================
    // Export methods (return empty by default)
    // =========================================================================
    /** Convert to SVG string. */
    toSVGString(options) {
        return '';
    }
    /** Convert to SVG path string. */
    toSVGPathString(options) {
        return '';
    }
    /** Paint to canvas context. */
    paintToCanvas(ctx, options) { }
    // =========================================================================
    // Bounding box methods (return undefined by default)
    // =========================================================================
    /** Get loose bounding box (may be larger than tight). */
    looseBoundingBox() {
        return undefined;
    }
    /** Get tight bounding box. */
    tightBoundingBox() {
        return undefined;
    }
    // =========================================================================
    // Hit testing methods (return false by default)
    // =========================================================================
    /** Check if fully contained by a bounding box. */
    isContainedByBoundingBox(box) {
        return false;
    }
    /** Check if intersected by a bounding box. */
    isIntersectedByBoundingBox(box) {
        return false;
    }
    /** Check if overlapped by a bounding box. */
    isOverlappedByBoundingBox(box) {
        return false;
    }
    /** Check if contains a point. */
    containsPoint(point) {
        return false;
    }
    /** Check if style contains a point (includes stroke width). */
    styleContainsPoint(point) {
        return false;
    }
    // =========================================================================
    // Static validation
    // =========================================================================
    /** Validate that value is a valid Geometry. */
    static isValid(a) {
        if (a instanceof Geometry)
            return a.isValid();
        return false;
    }
}
