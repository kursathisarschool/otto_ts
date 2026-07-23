/**
 * Geometry Library - Group
 *
 * Geometry container for grouping multiple geometry items.
 */

import { Anchor } from './Anchor.js';
import { BoundingBox } from './BoundingBox.js';
import { DEFAULT_TOLERANCE } from './constants.js';
import { Geometry, type ClosestPointResult, type ExportOptions } from './Geometry.js';
import { Path } from './Path.js';
import { Shape } from './Shape.js';
import { Fill, Stroke } from './Style.js';
import { Vec } from './Vec.js';
import type { AffineMatrix } from './Matrix.js';

/**
 * Group class for containing multiple geometry items.
 *
 * @example
 * const rect = Path.rect(0, 0, 100, 50);
 * const circle = Path.circle(new Vec(50, 25), 20);
 * const group = new Group([rect, circle]);
 */
export class Group extends Geometry {
    static displayName = 'Group';

    items: Geometry[];

    constructor(items: Geometry[] = []) {
        super();
        this.items = items;
    }

    /** Create a copy of this group. */
    clone(): Group {
        return new Group(this.items.map((item) => item.clone()));
    }

    /** Check if this group is valid. */
    isValid(): boolean {
        return Array.isArray(this.items) && this.items.every(Geometry.isValid);
    }

    /** Apply an affine transformation. */
    affineTransform(affineMatrix: AffineMatrix): Group {
        for (let item of this.items) item.affineTransform(affineMatrix);
        return this;
    }

    /** Apply an affine transformation without translation. */
    affineTransformWithoutTranslation(affineMatrix: AffineMatrix): Group {
        for (let item of this.items) item.affineTransformWithoutTranslation(affineMatrix);
        return this;
    }

    // =========================================================================
    // Collection methods
    // =========================================================================

    allShapes(): Shape[] {
        return this.items.flatMap((item) => item.allShapes()) as Shape[];
    }

    allPaths(): Path[] {
        return this.items.flatMap((item) => item.allPaths()) as Path[];
    }

    allAnchors(): Anchor[] {
        return this.items.flatMap((item) => item.allAnchors()) as Anchor[];
    }

    allOrphanedAnchors(): Anchor[] {
        return this.items.flatMap((item) => item.allOrphanedAnchors()) as Anchor[];
    }

    allShapesAndOrphanedPaths(): (Shape | Path)[] {
        return this.items.flatMap((item) => item.allShapesAndOrphanedPaths()) as (Shape | Path)[];
    }

    allIntersectables(): Geometry[] {
        return this.items.flatMap((item) => item.allIntersectables());
    }

    // =========================================================================
    // Style methods
    // =========================================================================

    assignFill(fill: Fill): Group {
        for (let item of this.items) item.assignFill(fill);
        return this;
    }

    removeFill(): Group {
        for (let item of this.items) item.removeFill();
        return this;
    }

    assignStroke(stroke: Stroke): Group {
        for (let item of this.items) item.assignStroke(stroke);
        return this;
    }

    removeStroke(): Group {
        for (let item of this.items) item.removeStroke();
        return this;
    }

    assignStyle(fill: Fill, stroke: Stroke): Group {
        for (let item of this.items) item.assignStyle(fill, stroke);
        return this;
    }

    copyStyle(itemToCopy: Geometry): Group {
        for (let item of this.items) item.copyStyle(itemToCopy);
        return this;
    }

    scaleStroke(scaleFactor: number): Group {
        for (let item of this.items) item.scaleStroke(scaleFactor);
        return this;
    }

    // =========================================================================
    // SVG
    // =========================================================================

    toSVGString(options?: ExportOptions): string {
        const childrenString = this.items.map((item) => item.toSVGString?.(options) || '').join('\n');
        return `<g>\n${indentString(childrenString)}\n</g>`;
    }

    toSVGPathString(options?: ExportOptions): string {
        return this.items.map((item) => item.toSVGPathString?.(options) || '').join('');
    }

    // =========================================================================
    // Bounding Box
    // =========================================================================

    looseBoundingBox(): BoundingBox | undefined {
        const { items } = this;
        if (items.length === 0) return undefined;

        let box: BoundingBox | undefined;
        for (let item of items) {
            const itemBox = item.looseBoundingBox();
            if (itemBox) {
                if (box === undefined) box = itemBox;
                else box.expandToIncludeBoundingBox(itemBox);
            }
        }
        return box;
    }

    tightBoundingBox(): BoundingBox | undefined {
        const { items } = this;
        if (items.length === 0) return undefined;

        let box: BoundingBox | undefined;
        for (let item of items) {
            const itemBox = item.tightBoundingBox();
            if (itemBox) {
                if (box === undefined) box = itemBox;
                else box.expandToIncludeBoundingBox(itemBox);
            }
        }
        return box;
    }

    isContainedByBoundingBox(box: BoundingBox): boolean {
        if (this.items.length === 0) return false;
        return this.items.every((item) => item.isContainedByBoundingBox(box));
    }

    isIntersectedByBoundingBox(box: BoundingBox): boolean {
        return this.items.some((item) => item.isIntersectedByBoundingBox(box));
    }

    isOverlappedByBoundingBox(box: BoundingBox): boolean {
        return this.items.some((item) => item.isOverlappedByBoundingBox(box));
    }

    // =========================================================================
    // Closest Point
    // =========================================================================

    closestPointWithinDistanceToPoint(maxDistance: number, point: Vec): ClosestPointResult {
        const { items } = this;
        let closestResult: ClosestPointResult = { distance: Infinity };
        if (items.length === 0) return closestResult;

        for (let item of items) {
            const result = item.closestPointWithinDistanceToPoint(maxDistance, point);
            if (result.distance < closestResult.distance) {
                closestResult = result;
            }
        }

        return closestResult;
    }

    containsPoint(point: Vec): boolean {
        return this.items.some((item) => item.containsPoint?.(point));
    }

    reverse(): Group {
        this.items.forEach((item) => item.reverse());
        this.items.reverse();
        return this;
    }

    // =========================================================================
    // Static Methods
    // =========================================================================

    static isValid(a: unknown): a is Group {
        return a instanceof Group && a.isValid();
    }

    /** Join paths that share endpoints within tolerance. */
    static byJoiningPaths(paths: Path[], tolerance: number = DEFAULT_TOLERANCE): Group {
        if (paths.length <= 1) return new Group(paths);

        const toleranceSq = tolerance * tolerance;

        // Clone because we're mutating the input paths
        let inPaths = paths.map((path) => path.clone());
        let outPaths: Path[] = [];

        while (true) {
            outPaths = [];
            for (let inPath of inPaths) {
                if (inPath.closed) {
                    outPaths.push(inPath);
                    continue;
                }

                const inStart = inPath.anchors[0];
                const inEnd = inPath.anchors[inPath.anchors.length - 1];

                let i = 0;
                for (let n = outPaths.length; i < n; ++i) {
                    const outPath = outPaths[i];
                    if (outPath.closed) continue;
                    const outStart = outPath.anchors[0];
                    const outEnd = outPath.anchors[outPath.anchors.length - 1];

                    if (inStart.position.distanceSquared(outEnd.position) <= toleranceSq) {
                        outEnd.handleOut.copy(inStart.handleOut);
                        outPath.anchors.push(...inPath.anchors.slice(1));
                        break;
                    } else if (inStart.position.distanceSquared(outStart.position) <= toleranceSq) {
                        outStart.handleIn.copy(inStart.handleOut);
                        outPath.anchors.splice(0, 0, ...inPath.reverse().anchors.slice(0, -1));
                        break;
                    } else if (inEnd.position.distanceSquared(outStart.position) <= toleranceSq) {
                        outStart.handleIn.copy(inEnd.handleIn);
                        outPath.anchors.splice(0, 0, ...inPath.anchors.slice(0, -1));
                        break;
                    } else if (inEnd.position.distanceSquared(outEnd.position) <= toleranceSq) {
                        outEnd.handleOut.copy(inEnd.handleIn);
                        outPath.anchors.push(...inPath.reverse().anchors.slice(1));
                        break;
                    }
                }

                if (i === outPaths.length) {
                    // Path was not merged, append for next iteration
                    outPaths.push(inPath);
                }
            }

            if (outPaths.length === inPaths.length) break;
            inPaths = outPaths;
        }

        // Close any remaining paths that have matching endpoints
        for (let path of outPaths) {
            if (path.anchors.length > 1) {
                const start = path.anchors[0];
                const end = path.anchors[path.anchors.length - 1];
                if (start.position.distanceSquared(end.position) <= toleranceSq) {
                    start.handleIn.copy(end.handleIn);
                    path.anchors.splice(-1, 1);
                    path.closed = true;
                }
            }
        }

        return new Group(outPaths);
    }
}

// =============================================================================
// Helper Functions
// =============================================================================

/** Indent a string by two spaces per line. */
const indentString = (s: string): string => {
    return '  ' + s.replace(/\n/g, '\n  ');
};