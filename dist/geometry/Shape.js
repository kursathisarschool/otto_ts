/**
 * Geometry Library - Shape
 *
 * Multi-path shape with boolean operations support.
 * Note: Boolean operations require PathKit (not yet implemented).
 */
import { Anchor } from './Anchor.js';
import { Geometry } from './Geometry.js';
import { Group } from './Group.js';
import { Path } from './Path.js';
import { Fill, Stroke } from './Style.js';
import { Vec } from './Vec.js';
import { pathOrShapeToSVGString } from './svg.js';
import { computeTightBoundingBox, deletePkPath, emptyPkPath, fromPkPath, getPathKit, pkPathFromSVGPathString, performStroke, toPkPath } from './pathkit.js';
/**
 * Shape class representing multiple paths with shared style.
 * Useful for compound shapes like letters with holes.
 *
 * @example
 * const outer = Path.rect(0, 0, 100, 100);
 * const inner = Path.rect(20, 20, 60, 60);
 * const frame = new Shape([outer, inner]);
 */
export class Shape extends Geometry {
    constructor(paths = [], stroke, fill) {
        super();
        this.paths = paths;
        this.stroke = stroke;
        this.fill = fill;
    }
    /** Create a copy of this shape. */
    clone() {
        return new Shape(this.paths.map((path) => path.clone()), this.stroke?.clone(), this.fill?.clone());
    }
    /** Check if this shape is valid. */
    isValid() {
        return (Array.isArray(this.paths) &&
            this.paths.every(Path.isValid) &&
            (this.stroke === undefined || Stroke.isValid(this.stroke)) &&
            (this.fill === undefined || Fill.isValid(this.fill)));
    }
    /** Apply an affine transformation. */
    affineTransform(affineMatrix) {
        for (let path of this.paths)
            path.affineTransform(affineMatrix);
        return this;
    }
    /** Apply an affine transformation without translation. */
    affineTransformWithoutTranslation(affineMatrix) {
        for (let path of this.paths)
            path.affineTransformWithoutTranslation(affineMatrix);
        return this;
    }
    // =========================================================================
    // Collection methods
    // =========================================================================
    allShapes() {
        return [this];
    }
    allPaths() {
        return [...this.paths];
    }
    allAnchors() {
        return this.paths.flatMap((p) => p.anchors);
    }
    allShapesAndOrphanedPaths() {
        return [this];
    }
    allIntersectables() {
        return [...this.paths];
    }
    // =========================================================================
    // Style methods
    // =========================================================================
    assignFill(fill) {
        this.fill = fill.clone();
        return this;
    }
    removeFill() {
        this.fill = undefined;
        return this;
    }
    assignStroke(stroke) {
        this.stroke = stroke.clone();
        return this;
    }
    removeStroke() {
        this.stroke = undefined;
        return this;
    }
    assignStyle(fill, stroke) {
        this.stroke = stroke?.clone();
        this.fill = fill?.clone();
        return this;
    }
    copyStyle(item) {
        if (item instanceof Path || item instanceof Shape) {
            this.stroke = item.stroke?.clone();
            this.fill = item.fill?.clone();
        }
        return this;
    }
    scaleStroke(scaleFactor) {
        if (this.stroke && !this.stroke.hairline) {
            this.stroke.width *= scaleFactor;
        }
        return this;
    }
    // =========================================================================
    // SVG
    // =========================================================================
    toSVGPathString(options) {
        return this.paths.map((path) => path.toSVGPathString(options)).join('');
    }
    toSVGString(options) {
        return pathOrShapeToSVGString(this, options);
    }
    toCanvasPath(ctx) {
        if (!ctx)
            return;
        this.paths.forEach((path) => path.toCanvasPath(ctx));
    }
    // =========================================================================
    // Bounding Box
    // =========================================================================
    looseBoundingBox() {
        const { paths } = this;
        let box;
        for (let path of paths) {
            const pathBox = path.looseBoundingBox();
            if (box) {
                if (pathBox) {
                    box.expandToIncludeBoundingBox(pathBox);
                }
            }
            else {
                box = pathBox;
            }
        }
        return box;
    }
    tightBoundingBox() {
        const pk = getPathKit();
        if (pk) {
            return computeTightBoundingBox(this);
        }
        return this.looseBoundingBox();
    }
    isContainedByBoundingBox(box) {
        const tight = this.tightBoundingBox();
        return tight ? box.containsBoundingBox(tight) : false;
    }
    isIntersectedByBoundingBox(box) {
        return this.paths.some((path) => path.isIntersectedByBoundingBox(box));
    }
    isOverlappedByBoundingBox(box) {
        return this.paths.some((path) => path.isOverlappedByBoundingBox(box));
    }
    // =========================================================================
    // Closest Point
    // =========================================================================
    closestPointWithinDistanceToPoint(maxDistance, point) {
        const { paths } = this;
        let closestResult = { distance: Infinity };
        if (paths.length === 0)
            return closestResult;
        for (let path of paths) {
            const result = path.closestPointWithinDistanceToPoint(maxDistance, point);
            if (result.distance < closestResult.distance) {
                closestResult = result;
            }
        }
        return closestResult;
    }
    reverse() {
        this.paths.forEach((path) => path.reverse());
        this.paths.reverse();
        return this;
    }
    // =========================================================================
    // Static Methods
    // =========================================================================
    static isValid(a) {
        return a instanceof Shape && a.isValid();
    }
    /**
     * Create shape from SVG path string.
     * Note: Requires PathKit for full support. Basic implementation.
     */
    static fromSVGPathString(svgPathString) {
        const pk = getPathKit();
        if (pk) {
            const pkPath = pkPathFromSVGPathString(svgPathString);
            return fromPkPath(pkPath, true);
        }
        // Fallback: basic SVG path parsing (limited)
        const paths = [];
        const commands = svgPathString.match(/[MLCQAHVZS][^MLCQAHVZS]*/gi) || [];
        let currentPath = null;
        let currentX = 0;
        let currentY = 0;
        let startX = 0;
        let startY = 0;
        for (const cmd of commands) {
            const type = cmd[0].toUpperCase();
            const isRelative = cmd[0] === cmd[0].toLowerCase();
            const args = cmd.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
            switch (type) {
                case 'M':
                    if (currentPath && currentPath.anchors.length > 0) {
                        paths.push(currentPath);
                    }
                    currentPath = new Path([]);
                    currentX = isRelative ? currentX + args[0] : args[0];
                    currentY = isRelative ? currentY + args[1] : args[1];
                    startX = currentX;
                    startY = currentY;
                    currentPath.anchors.push(new Anchor(new Vec(currentX, currentY)));
                    break;
                case 'L':
                    currentX = isRelative ? currentX + args[0] : args[0];
                    currentY = isRelative ? currentY + args[1] : args[1];
                    if (currentPath) {
                        currentPath.anchors.push(new Anchor(new Vec(currentX, currentY)));
                    }
                    break;
                case 'Z':
                    if (currentPath) {
                        currentPath.closed = true;
                        paths.push(currentPath);
                        currentPath = null;
                    }
                    currentX = startX;
                    currentY = startY;
                    break;
                // TODO: Add C, Q, A, H, V, S support (requires PathKit for full support)
            }
        }
        if (currentPath && currentPath.anchors.length > 0) {
            paths.push(currentPath);
        }
        return new Shape(paths);
    }
    /** Boolean union of geometries. Note: Requires PathKit. Stub implementation. */
    static booleanUnion(items, fillRule = 'evenodd') {
        const pk = getPathKit();
        if (!pk) {
            console.warn('Shape.booleanUnion requires PathKit - returning combined paths');
            const paths = items.flatMap((item) => item.allPaths().map((p) => p.clone()));
            return new Shape(paths);
        }
        const unionItems = items.flatMap((item) => item.allShapesAndOrphanedPaths());
        const fillType = fillRule === 'winding' ? pk.FillType.WINDING : pk.FillType.EVENODD;
        let resultPkPath = emptyPkPath();
        for (let item of unionItems) {
            const pkPath = toPkPath(item, fillType);
            resultPkPath.op(pkPath, pk.PathOp.UNION);
            deletePkPath(pkPath);
        }
        return fromPkPath(resultPkPath, true);
    }
    /** Boolean intersection of geometries. Note: Requires PathKit. Stub implementation. */
    static booleanIntersect(items) {
        const pk = getPathKit();
        if (!pk) {
            console.warn('Shape.booleanIntersect requires PathKit - not implemented');
            return new Shape();
        }
        const pkPaths = preUnion(items);
        let resultPkPath = null;
        for (let pkPath of pkPaths) {
            if (resultPkPath === null) {
                resultPkPath = pkPath;
            }
            else {
                resultPkPath.op(pkPath, pk.PathOp.INTERSECT);
                deletePkPath(pkPath);
            }
        }
        if (resultPkPath === null)
            return new Shape();
        return fromPkPath(resultPkPath, true);
    }
    /** Boolean difference of geometries. Note: Requires PathKit. Stub implementation. */
    static booleanDifference(items) {
        const pk = getPathKit();
        if (!pk) {
            console.warn('Shape.booleanDifference requires PathKit - not implemented');
            return new Shape();
        }
        const pkPaths = preUnion(items);
        let resultPkPath = null;
        for (let pkPath of pkPaths) {
            if (resultPkPath === null) {
                resultPkPath = pkPath;
            }
            else {
                resultPkPath.op(pkPath, pk.PathOp.DIFFERENCE);
                deletePkPath(pkPath);
            }
        }
        if (resultPkPath === null)
            return new Shape();
        return fromPkPath(resultPkPath, true);
    }
    /** Create stroked shape from geometry. Note: Requires PathKit. Stub implementation. */
    static stroke(item, opts = {}) {
        let { width, miterLimit, join, cap } = opts;
        if (width === undefined)
            width = 1;
        if (cap === undefined)
            cap = 'butt';
        if (join === undefined)
            join = 'miter';
        if (miterLimit === undefined)
            miterLimit = 4;
        const pk = getPathKit();
        if (!pk) {
            console.warn('Shape.stroke requires PathKit - not implemented');
            return new Shape(item.allPaths().map((p) => p.clone()));
        }
        const pkPath = toPkPath(item);
        performStroke(pkPath, width, cap, join, miterLimit);
        return fromPkPath(pkPath, true);
    }
}
Shape.displayName = 'Shape';
/** Pre-union helper for boolean operations. */
const preUnion = (items) => {
    return items.map((item) => {
        if (item instanceof Group) {
            let resultPkPath = emptyPkPath();
            for (let groupItem of item.items) {
                const pkPath = toPkPath(groupItem);
                resultPkPath.op(pkPath, getPathKit().PathOp.UNION);
                deletePkPath(pkPath);
            }
            return resultPkPath;
        }
        return toPkPath(item);
    });
};
