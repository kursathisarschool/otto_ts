/**
 * Geometry Library - Group
 *
 * Geometry container for grouping multiple geometry items.
 */
import { DEFAULT_TOLERANCE } from './constants.js';
import { Geometry } from './Geometry.js';
/**
 * Group class for containing multiple geometry items.
 *
 * @example
 * const rect = Path.rect(0, 0, 100, 50);
 * const circle = Path.circle(new Vec(50, 25), 20);
 * const group = new Group([rect, circle]);
 */
export class Group extends Geometry {
    constructor(items = []) {
        super();
        this.items = items;
    }
    /** Create a copy of this group. */
    clone() {
        return new Group(this.items.map((item) => item.clone()));
    }
    /** Check if this group is valid. */
    isValid() {
        return Array.isArray(this.items) && this.items.every(Geometry.isValid);
    }
    /** Apply an affine transformation. */
    affineTransform(affineMatrix) {
        for (let item of this.items)
            item.affineTransform(affineMatrix);
        return this;
    }
    /** Apply an affine transformation without translation. */
    affineTransformWithoutTranslation(affineMatrix) {
        for (let item of this.items)
            item.affineTransformWithoutTranslation(affineMatrix);
        return this;
    }
    // =========================================================================
    // Collection methods
    // =========================================================================
    allShapes() {
        return this.items.flatMap((item) => item.allShapes());
    }
    allPaths() {
        return this.items.flatMap((item) => item.allPaths());
    }
    allAnchors() {
        return this.items.flatMap((item) => item.allAnchors());
    }
    allOrphanedAnchors() {
        return this.items.flatMap((item) => item.allOrphanedAnchors());
    }
    allShapesAndOrphanedPaths() {
        return this.items.flatMap((item) => item.allShapesAndOrphanedPaths());
    }
    allIntersectables() {
        return this.items.flatMap((item) => item.allIntersectables());
    }
    // =========================================================================
    // Style methods
    // =========================================================================
    assignFill(fill) {
        for (let item of this.items)
            item.assignFill(fill);
        return this;
    }
    removeFill() {
        for (let item of this.items)
            item.removeFill();
        return this;
    }
    assignStroke(stroke) {
        for (let item of this.items)
            item.assignStroke(stroke);
        return this;
    }
    removeStroke() {
        for (let item of this.items)
            item.removeStroke();
        return this;
    }
    assignStyle(fill, stroke) {
        for (let item of this.items)
            item.assignStyle(fill, stroke);
        return this;
    }
    copyStyle(itemToCopy) {
        for (let item of this.items)
            item.copyStyle(itemToCopy);
        return this;
    }
    scaleStroke(scaleFactor) {
        for (let item of this.items)
            item.scaleStroke(scaleFactor);
        return this;
    }
    // =========================================================================
    // SVG
    // =========================================================================
    toSVGString(options) {
        const childrenString = this.items.map((item) => item.toSVGString?.(options) || '').join('\n');
        return `<g>\n${indentString(childrenString)}\n</g>`;
    }
    toSVGPathString(options) {
        return this.items.map((item) => item.toSVGPathString?.(options) || '').join('');
    }
    // =========================================================================
    // Bounding Box
    // =========================================================================
    looseBoundingBox() {
        const { items } = this;
        if (items.length === 0)
            return undefined;
        let box;
        for (let item of items) {
            const itemBox = item.looseBoundingBox();
            if (itemBox) {
                if (box === undefined)
                    box = itemBox;
                else
                    box.expandToIncludeBoundingBox(itemBox);
            }
        }
        return box;
    }
    tightBoundingBox() {
        const { items } = this;
        if (items.length === 0)
            return undefined;
        let box;
        for (let item of items) {
            const itemBox = item.tightBoundingBox();
            if (itemBox) {
                if (box === undefined)
                    box = itemBox;
                else
                    box.expandToIncludeBoundingBox(itemBox);
            }
        }
        return box;
    }
    isContainedByBoundingBox(box) {
        if (this.items.length === 0)
            return false;
        return this.items.every((item) => item.isContainedByBoundingBox(box));
    }
    isIntersectedByBoundingBox(box) {
        return this.items.some((item) => item.isIntersectedByBoundingBox(box));
    }
    isOverlappedByBoundingBox(box) {
        return this.items.some((item) => item.isOverlappedByBoundingBox(box));
    }
    // =========================================================================
    // Closest Point
    // =========================================================================
    closestPointWithinDistanceToPoint(maxDistance, point) {
        const { items } = this;
        let closestResult = { distance: Infinity };
        if (items.length === 0)
            return closestResult;
        for (let item of items) {
            const result = item.closestPointWithinDistanceToPoint(maxDistance, point);
            if (result.distance < closestResult.distance) {
                closestResult = result;
            }
        }
        return closestResult;
    }
    containsPoint(point) {
        return this.items.some((item) => item.containsPoint?.(point));
    }
    reverse() {
        this.items.forEach((item) => item.reverse());
        this.items.reverse();
        return this;
    }
    // =========================================================================
    // Static Methods
    // =========================================================================
    static isValid(a) {
        return a instanceof Group && a.isValid();
    }
    /** Join paths that share endpoints within tolerance. */
    static byJoiningPaths(paths, tolerance = DEFAULT_TOLERANCE) {
        if (paths.length <= 1)
            return new Group(paths);
        const toleranceSq = tolerance * tolerance;
        // Clone because we're mutating the input paths
        let inPaths = paths.map((path) => path.clone());
        let outPaths = [];
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
                    if (outPath.closed)
                        continue;
                    const outStart = outPath.anchors[0];
                    const outEnd = outPath.anchors[outPath.anchors.length - 1];
                    if (inStart.position.distanceSquared(outEnd.position) <= toleranceSq) {
                        outEnd.handleOut.copy(inStart.handleOut);
                        outPath.anchors.push(...inPath.anchors.slice(1));
                        break;
                    }
                    else if (inStart.position.distanceSquared(outStart.position) <= toleranceSq) {
                        outStart.handleIn.copy(inStart.handleOut);
                        outPath.anchors.splice(0, 0, ...inPath.reverse().anchors.slice(0, -1));
                        break;
                    }
                    else if (inEnd.position.distanceSquared(outStart.position) <= toleranceSq) {
                        outStart.handleIn.copy(inEnd.handleIn);
                        outPath.anchors.splice(0, 0, ...inPath.anchors.slice(0, -1));
                        break;
                    }
                    else if (inEnd.position.distanceSquared(outEnd.position) <= toleranceSq) {
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
            if (outPaths.length === inPaths.length)
                break;
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
Group.displayName = 'Group';
// =============================================================================
// Helper Functions
// =============================================================================
/** Indent a string by two spaces per line. */
const indentString = (s) => {
    return '  ' + s.replace(/\n/g, '\n  ');
};
