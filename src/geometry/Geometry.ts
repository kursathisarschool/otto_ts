/**
 * Geometry Library - Geometry
 *
 * Abstract base class for all geometry types.
 * In JavaScript we implement this as a regular class with default implementations.
 */

import { AffineMatrix, type TransformArgs } from './Matrix.js';
import type { Vec } from './Vec.js';
import type { BoundingBox } from './BoundingBox.js';
import type { Fill, Stroke } from './Style.js';

export interface ClosestPointResult {
    distance: number;
    position?: Vec;
    time?: number;
}

export interface ExportOptions {
    hairlineStrokeWidth?: number;
    maxPrecision?: number;
    useSVGPathClipping?: boolean;
}

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
    clone(): Geometry {
        throw new Error('clone() must be implemented by subclass');
    }

    /** Check if this geometry is valid. */
    isValid(): boolean {
        throw new Error('isValid() must be implemented by subclass');
    }

    /** Find the closest point within a maximum distance. */
    closestPointWithinDistanceToPoint(maxDistance: number, point: Vec): ClosestPointResult {
        return { distance: Infinity };
    }

    /** Apply an affine transformation matrix. */
    affineTransform(affineMatrix: AffineMatrix): Geometry {
        throw new Error('affineTransform() must be implemented by subclass');
    }

    /** Apply an affine transformation without translation. */
    affineTransformWithoutTranslation(affineMatrix: AffineMatrix): Geometry {
        throw new Error('affineTransformWithoutTranslation() must be implemented by subclass');
    }

    /** Apply a transform object. */
    transform(transform: TransformArgs): Geometry {
        return this.affineTransform(AffineMatrix.fromTransform(transform));
    }

    // =========================================================================
    // Collection methods (return empty by default)
    // =========================================================================

    /** Get all shapes in this geometry. */
    allShapes(): Geometry[] {
        return [];
    }

    /** Get all paths in this geometry. */
    allPaths(): Geometry[] {
        return [];
    }

    /** Get all anchors in this geometry. */
    allAnchors(): Geometry[] {
        return [];
    }

    /** Get all orphaned anchors (not part of a path). */
    allOrphanedAnchors(): Geometry[] {
        return [];
    }

    /** Get all shapes and orphaned paths. */
    allShapesAndOrphanedPaths(): Geometry[] {
        return [];
    }

    /** Get all intersectable geometry (paths and axes). */
    allIntersectables(): Geometry[] {
        return [];
    }

    // =========================================================================
    // Operations (return this by default)
    // =========================================================================

    /** Reverse the direction of this geometry. */
    reverse(): Geometry {
        return this;
    }

    // =========================================================================
    // Style methods (return this by default)
    // =========================================================================

    /** Assign a fill style. */
    assignFill(fill: Fill): Geometry {
        return this;
    }

    /** Remove fill style. */
    removeFill(): Geometry {
        return this;
    }

    /** Assign a stroke style. */
    assignStroke(stroke: Stroke): Geometry {
        return this;
    }

    /** Remove stroke style. */
    removeStroke(): Geometry {
        return this;
    }

    /** Assign both fill and stroke. */
    assignStyle(fill: Fill, stroke: Stroke): Geometry {
        return this;
    }

    /** Copy style from another geometry. */
    copyStyle(item: Geometry): Geometry {
        return this;
    }

    /** Scale stroke width. */
    scaleStroke(scaleFactor: number): Geometry {
        return this;
    }

    // =========================================================================
    // Export methods (return empty by default)
    // =========================================================================

    /** Convert to SVG string. */
    toSVGString(options?: ExportOptions): string {
        return '';
    }

    /** Convert to SVG path string. */
    toSVGPathString(options?: ExportOptions): string {
        return '';
    }

    /** Paint to canvas context. */
    paintToCanvas(ctx: CanvasRenderingContext2D, options?: ExportOptions): void {}

    // =========================================================================
    // Bounding box methods (return undefined by default)
    // =========================================================================

    /** Get loose bounding box (may be larger than tight). */
    looseBoundingBox(): BoundingBox | undefined {
        return undefined;
    }

    /** Get tight bounding box. */
    tightBoundingBox(): BoundingBox | undefined {
        return undefined;
    }

    // =========================================================================
    // Hit testing methods (return false by default)
    // =========================================================================

    /** Check if fully contained by a bounding box. */
    isContainedByBoundingBox(box: BoundingBox): boolean {
        return false;
    }

    /** Check if intersected by a bounding box. */
    isIntersectedByBoundingBox(box: BoundingBox): boolean {
        return false;
    }

    /** Check if overlapped by a bounding box. */
    isOverlappedByBoundingBox(box: BoundingBox): boolean {
        return false;
    }

    /** Check if contains a point. */
    containsPoint(point: Vec): boolean {
        return false;
    }

    /** Check if style contains a point (includes stroke width). */
    styleContainsPoint(point: Vec): boolean {
        return false;
    }

    // =========================================================================
    // Static validation
    // =========================================================================

    /** Validate that value is a valid Geometry. */
    static isValid(a: unknown): a is Geometry {
        if (a instanceof Geometry) return a.isValid();
        return false;
    }
}