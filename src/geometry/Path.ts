/**
 * Geometry Library - Path
 *
 * Main path class with anchors, segments, and curve operations.
 */

import { Anchor } from './Anchor.js';
import { BoundingBox } from './BoundingBox.js';
import { clamp, tan } from './math.js';
import { AffineMatrix } from './Matrix.js';
import { Geometry, type ClosestPointResult, type ExportOptions } from './Geometry.js';
import {
    cubicFromSegment,
    cubicsBySplittingCubicAtTime,
    isSegmentLinear,
    lineFromSegment,
    partialSegmentLength,
    pointOnCubicAtTime,
    positionAndTimeAtClosestPointOnCubic,
    positionAndTimeAtClosestPointOnLine,
    segmentLength,
    lineLineIntersections,
    type Segment,
} from './Segment.js';
import { Fill, Stroke } from './Style.js';
import { pairs, rotateArray } from './util.js';
import { Vec } from './Vec.js';
import { pathOrShapeToSVGString } from './svg.js';
import { computeTightBoundingBox, getPathKit } from './pathkit.js';

/**
 * Path class representing a series of anchors with optional curves.
 *
 * @example
 * const triangle = Path.fromPoints([
 *     new Vec(0, 0),
 *     new Vec(100, 0),
 *     new Vec(50, 100)
 * ], true);
 */
export class Path extends Geometry {
    static displayName = 'Path';

    anchors: Anchor[];
    closed: boolean;
    stroke?: Stroke;
    fill?: Fill;

    constructor(anchors: Anchor[] = [], closed: boolean = false, stroke?: Stroke, fill?: Fill) {
        super();
        this.anchors = anchors;
        this.closed = closed;
        this.stroke = stroke;
        this.fill = fill;
    }

    /** Create a copy of this path. */
    clone(): Path {
        return new Path(
            this.anchors.map((anchor) => anchor.clone()),
            this.closed,
            this.stroke?.clone(),
            this.fill?.clone()
        );
    }

    /** Check if this path is valid. */
    isValid(): boolean {
        return (
            Array.isArray(this.anchors) &&
            this.anchors.every(Anchor.isValid) &&
            (this.stroke === undefined || Stroke.isValid(this.stroke)) &&
            (this.fill === undefined || Fill.isValid(this.fill))
        );
    }

    /** Apply an affine transformation. */
    affineTransform(affineMatrix: AffineMatrix): Path {
        for (let anchor of this.anchors) anchor.affineTransform(affineMatrix);
        return this;
    }

    /** Apply an affine transformation without translation. */
    affineTransformWithoutTranslation(affineMatrix: AffineMatrix): Path {
        for (let anchor of this.anchors) anchor.affineTransformWithoutTranslation(affineMatrix);
        return this;
    }

    // =========================================================================
    // Collection methods
    // =========================================================================

    allPaths(): Path[] {
        return [this];
    }

    allAnchors(): Anchor[] {
        return [...this.anchors];
    }

    allShapesAndOrphanedPaths(): Path[] {
        return [this];
    }

    allIntersectables(): Path[] {
        return [this];
    }

    // =========================================================================
    // Style methods
    // =========================================================================

    assignFill(fill: Fill): Path {
        this.fill = fill.clone();
        return this;
    }

    removeFill(): Path {
        this.fill = undefined;
        return this;
    }

    assignStroke(stroke: Stroke): Path {
        this.stroke = stroke.clone();
        return this;
    }

    removeStroke(): Path {
        this.stroke = undefined;
        return this;
    }

    assignStyle(fill?: Fill, stroke?: Stroke): Path {
        this.stroke = stroke?.clone();
        this.fill = fill?.clone();
        return this;
    }

    copyStyle(item: Geometry): Path {
        if (item instanceof Path) {
            this.stroke = item.stroke?.clone();
            this.fill = item.fill?.clone();
        }
        return this;
    }

    scaleStroke(scaleFactor: number): Path {
        if (this.stroke && !this.stroke.hairline) {
            this.stroke.width *= scaleFactor;
        }
        return this;
    }

    // =========================================================================
    // Anchor access
    // =========================================================================

    firstAnchor(): Anchor | undefined {
        return this.anchors[0];
    }

    lastAnchor(): Anchor | undefined {
        return this.anchors[this.anchors.length - 1];
    }

    segmentAtIndex(index: number): Path {
        return new Path(this.anchors.slice(index, index + 2));
    }

    segments(): Path[] {
        return pairs(this.anchors, this.closed).map((anchors) => new Path(anchors));
    }

    // =========================================================================
    // SVG
    // =========================================================================

    toSVGString(options?: ExportOptions): string {
        return pathOrShapeToSVGString(this, options);
    }

    toSVGPathString(options?: ExportOptions): string {
        const toString = (x: number): string => {
            if (options?.maxPrecision !== undefined) {
                return x.toFixed(options.maxPrecision);
            }
            return x.toString();
        };
        const SVGStringCommandForSegment = (a1: Anchor, a2: Anchor): string => {
            if (a1.handleOut.x !== 0 || a1.handleOut.y !== 0 || a2.handleIn.x !== 0 || a2.handleIn.y !== 0) {
                const x1 = toString(a1.position.x + a1.handleOut.x);
                const y1 = toString(a1.position.y + a1.handleOut.y);
                const x2 = toString(a2.position.x + a2.handleIn.x);
                const y2 = toString(a2.position.y + a2.handleIn.y);
                const x3 = toString(a2.position.x);
                const y3 = toString(a2.position.y);
                return `C${x1} ${y1} ${x2} ${y2} ${x3} ${y3} `;
            } else {
                const x = toString(a2.position.x);
                const y = toString(a2.position.y);
                return `L${x} ${y} `;
            }
        };

        if (this.anchors.length > 1) {
            const cmds: string[] = [];
            let a1 = this.anchors[0];
            const x = toString(a1.position.x);
            const y = toString(a1.position.y);
            cmds.push(`M${x} ${y} `);
            for (let i = 1, n = this.anchors.length; i < n; ++i) {
                let a2 = this.anchors[i];
                cmds.push(SVGStringCommandForSegment(a1, a2));
                a1 = a2;
            }
            if (this.closed) {
                cmds.push(SVGStringCommandForSegment(a1, this.anchors[0]));
                cmds.push('Z ');
            }
            return cmds.join('');
        }
        return ' ';
    }

    // =========================================================================
    // Canvas
    // =========================================================================

    toCanvasPath(ctx: CanvasRenderingContext2D): void {
        if (!ctx || this.anchors.length === 0) return;

        const drawSegment = (a1: Anchor, a2: Anchor): void => {
            const hasHandles =
                a1.handleOut.x !== 0 ||
                a1.handleOut.y !== 0 ||
                a2.handleIn.x !== 0 ||
                a2.handleIn.y !== 0;
            if (hasHandles) {
                ctx.bezierCurveTo(
                    a1.position.x + a1.handleOut.x,
                    a1.position.y + a1.handleOut.y,
                    a2.position.x + a2.handleIn.x,
                    a2.position.y + a2.handleIn.y,
                    a2.position.x,
                    a2.position.y
                );
            } else {
                ctx.lineTo(a2.position.x, a2.position.y);
            }
        };

        const first = this.anchors[0];
        ctx.moveTo(first.position.x, first.position.y);

        for (let i = 1, n = this.anchors.length; i < n; ++i) {
            drawSegment(this.anchors[i - 1], this.anchors[i]);
        }

        if (this.closed && this.anchors.length > 1) {
            drawSegment(this.anchors[this.anchors.length - 1], first);
            ctx.closePath();
        }
    }

    // =========================================================================
    // Bounding Box
    // =========================================================================

    looseBoundingBox(): BoundingBox | undefined {
        const { anchors, closed } = this;

        if (anchors.length === 0) return undefined;
        if (anchors.length === 1) return anchors[0].looseBoundingBox();

        const scratchPos = new Vec();

        let anchor = anchors[0];
        const box = new BoundingBox(anchor.position.clone(), anchor.position.clone());
        box.expandToIncludePoint(anchor.position.clone().add(anchor.handleOut));
        if (closed) {
            box.expandToIncludePoint(scratchPos.copy(anchor.position).add(anchor.handleIn));
        }

        const n1 = anchors.length - 1;
        for (let i = 1; i < n1; ++i) {
            anchor = anchors[i];
            box.expandToIncludePoint(anchor.position);
            box.expandToIncludePoint(scratchPos.copy(anchor.position).add(anchor.handleIn));
            box.expandToIncludePoint(scratchPos.copy(anchor.position).add(anchor.handleOut));
        }

        anchor = anchors[n1];
        box.expandToIncludePoint(anchor.position);
        box.expandToIncludePoint(scratchPos.copy(anchor.position).add(anchor.handleIn));
        if (closed) {
            box.expandToIncludePoint(scratchPos.copy(anchor.position).add(anchor.handleOut));
        }

        return box;
    }

    tightBoundingBox(): BoundingBox | undefined {
        if (this.anchors.length === 1) {
            return this.anchors[0].tightBoundingBox();
        }
        const pk = getPathKit();
        if (pk) {
            return computeTightBoundingBox(this);
        }
        return this.looseBoundingBox();
    }

    isContainedByBoundingBox(box: BoundingBox): boolean {
        const tight = this.tightBoundingBox();
        return tight ? box.containsBoundingBox(tight) : false;
    }

    isIntersectedByBoundingBox(box: BoundingBox): boolean {
        const looseBounds = this.looseBoundingBox();
        if (looseBounds?.overlapsBoundingBox(box)) {
            return true;
        }
        return false;
    }

    isOverlappedByBoundingBox(box: BoundingBox): boolean {
        return this.isContainedByBoundingBox(box) || this.isIntersectedByBoundingBox(box);
    }

    // =========================================================================
    // Direction
    // =========================================================================

    reverse(): Path {
        for (let anchor of this.anchors) {
            anchor.reverse();
        }
        this.anchors.reverse();
        return this;
    }

    // =========================================================================
    // Length
    // =========================================================================

    length(): number {
        let length = 0;
        for (let segment of pairs(this.anchors, this.closed)) {
            length += segmentLength(segment);
        }
        return length;
    }

    // =========================================================================
    // Time-based Operations
    // =========================================================================

    timeAtDistance(distance: number): number {
        const { anchors, closed } = this;

        let t = 0;
        let length = 0;
        for (let segment of pairs(anchors, closed)) {
            const segLen = segmentLength(segment);
            if (length + segLen > distance) {
                return t + (distance - length) / segLen;
            }
            length += segLen;
            t += 1;
        }

        return closed ? anchors.length : anchors.length - 1;
    }

    distanceAtTime(time: number): number {
        if (time <= 0) return 0;

        const { anchors, closed } = this;
        if (time >= (closed ? anchors.length : anchors.length - 1)) return this.length();

        const segmentIndex = time | 0;

        let distance = 0;
        for (let i = 0; i < segmentIndex; ++i) {
            const nextIndex = closed ? (i + 1) % anchors.length : i + 1;
            distance += segmentLength([anchors[i], anchors[nextIndex]]);
        }

        const segmentTime = time - segmentIndex;
        if (segmentTime > 0) {
            const nextIndex = closed ? (segmentIndex + 1) % anchors.length : segmentIndex + 1;
            const segment: Segment = [anchors[segmentIndex], anchors[nextIndex]];
            distance += partialSegmentLength(segment, segmentTime);
        }

        return distance;
    }

    positionAtTime(time: number): Vec {
        const { anchors, closed } = this;
        if (anchors.length === 0) return new Vec();
        if (anchors.length < 2) return anchors[0].position.clone();

        time = normalizeTimeForPath(time, this);
        const anchorIndex = time | 0;
        const anchor = anchors[anchorIndex];

        if (time === anchorIndex) {
            return anchor.position.clone();
        }

        let nextAnchorIndex = anchorIndex + 1;
        if (closed) nextAnchorIndex %= anchors.length;
        const nextAnchor = anchors[nextAnchorIndex];

        const segment: Segment = [anchor, nextAnchor];
        const segmentTime = time - anchorIndex;
        if (isSegmentLinear(segment)) {
            return anchor.position.clone().mix(nextAnchor.position, segmentTime);
        } else {
            const cubic = cubicFromSegment(segment);
            return pointOnCubicAtTime(new Vec(), cubic, segmentTime);
        }
    }

    derivativeAtTime(time: number): Vec {
        const { anchors, closed } = this;
        if (anchors.length < 2) return new Vec();

        time = normalizeTimeForPath(time, this);
        const anchorIndex = time | 0;
        const anchor = anchors[anchorIndex];

        if (time === anchorIndex) {
            if (!closed && anchorIndex === anchors.length - 1) {
                if (anchor.handleIn.isZero()) {
                    const prevAnchor = anchors[anchorIndex - 1];
                    return prevAnchor.position
                        .clone()
                        .add(prevAnchor.handleOut)
                        .sub(anchor.position)
                        .negate()
                        .normalize();
                }
                return anchor.handleIn.clone().negate().normalize();
            }
            if (anchor.handleOut.isZero()) {
                const nextAnchor = anchors[anchorIndex + 1];
                return nextAnchor.position
                    .clone()
                    .add(nextAnchor.handleIn)
                    .sub(anchor.position)
                    .normalize();
            }
            return anchor.handleOut.clone().normalize();
        }

        let nextAnchorIndex = anchorIndex + 1;
        if (closed) nextAnchorIndex %= anchors.length;
        const nextAnchor = anchors[nextAnchorIndex];

        const segment: Segment = [anchor, nextAnchor];
        if (isSegmentLinear(segment)) {
            return nextAnchor.position.clone().sub(anchor.position).normalize();
        } else {
            const segmentTime = time - anchorIndex;
            const cubic = cubicFromSegment(segment);
            const t = segmentTime;
            const mt = 1 - t;
            const [p0, p1, p2, p3] = cubic;
            return new Vec(
                3 * mt * mt * (p1.x - p0.x) + 6 * mt * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
                3 * mt * mt * (p1.y - p0.y) + 6 * mt * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y)
            ).normalize();
        }
    }

    tangentAtTime(time: number): Vec {
        return this.derivativeAtTime(time).normalize();
    }

    normalAtTime(time: number): Vec {
        return this.tangentAtTime(time).rotate90();
    }

    // =========================================================================
    // Anchor Insertion
    // =========================================================================

    insertAnchorAtTime(time: number): Anchor | undefined {
        const { anchors, closed } = this;

        if (anchors.length < 2) return undefined;

        time = normalizeTimeForPath(time, this);

        let anchorIndex1 = time | 0;
        if (time === anchorIndex1) {
            return anchors[anchorIndex1 % anchors.length];
        }

        const segmentTime = time - anchorIndex1;
        let anchorIndex2 = anchorIndex1 + 1;
        if (closed) {
            anchorIndex1 %= anchors.length;
            anchorIndex2 %= anchors.length;
        }

        const segment: Segment = [anchors[anchorIndex1], anchors[anchorIndex2]];

        let anchor = new Anchor();

        if (isSegmentLinear(segment)) {
            anchor.position.copy(segment[0].position).mix(segment[1].position, segmentTime);
        } else {
            const cubic = cubicFromSegment(segment);
            const [left, right] = cubicsBySplittingCubicAtTime(cubic, segmentTime);

            segment[0].handleOut.copy(left[1]).sub(segment[0].position);
            segment[1].handleIn.copy(right[2]).sub(segment[1].position);

            anchor.position.copy(right[0]);
            anchor.handleIn.copy(left[2]).sub(right[0]);
            anchor.handleOut.copy(right[1]).sub(right[0]);
        }

        anchors.splice(anchorIndex1 + 1, 0, anchor);

        return anchor;
    }

    splitAtAnchor(anchor: Anchor): Path[] {
        const { anchors, closed } = this;

        const anchorIndex = anchors.indexOf(anchor);
        if (anchorIndex === -1) return [this];

        if (closed) {
            if (anchorIndex > 0) rotateArray(anchors, anchorIndex);
            anchors.push(anchors[0].clone());
            this.closed = false;
            return [this];
        } else {
            const path1 = new Path(anchors.slice(0, anchorIndex));
            const path2 = new Path(anchors.slice(anchorIndex));
            path1.anchors.push(path2.anchors[0].clone());
            return [path1, path2];
        }
    }

    splitAtTime(time: number): Path[] {
        const anchor = this.insertAnchorAtTime(time);
        if (anchor) {
            return this.splitAtAnchor(anchor);
        }
        return [this];
    }

    polygonize(maxSegmentLength: number): Path {
        if (maxSegmentLength <= 0) return this;
        const newAnchors: Anchor[] = [];
        const segments = this.segments();
        for (let segment of segments) {
            const length = segment.length();
            const divisions = Math.ceil(length / maxSegmentLength);
            const step = length / divisions;
            for (let i = 0; i < divisions; i++) {
                const distance = i * step;
                const time = segment.timeAtDistance(distance);
                const point = segment.positionAtTime(time);
                newAnchors.push(new Anchor(point));
            }
        }
        this.anchors = newAnchors;
        return this;
    }

    // =========================================================================
    // Closest Point
    // =========================================================================

    closestPointWithinDistanceToPoint(maxDistance: number, point: Vec): ClosestPointResult {
        const closestResult: ClosestPointResult = { distance: Infinity };
        const { anchors, closed } = this;

        if (anchors.length === 0) return closestResult;
        if (anchors.length === 1) {
            return anchors[0].closestPointWithinDistanceToPoint(maxDistance, point);
        }

        const maxDistanceSq = maxDistance * maxDistance;

        let segmentIndex = 0;
        for (let segment of pairs(anchors, closed)) {
            if (isSegmentLinear(segment)) {
                const line = lineFromSegment(segment);
                const bounds = BoundingBox.fromPoints(line)!.expandScalar(maxDistance);
                if (bounds.containsPoint(point)) {
                    const { position, time } = positionAndTimeAtClosestPointOnLine(point, line);
                    const distanceSq = position.distanceSquared(point);
                    if (distanceSq < maxDistanceSq && distanceSq < closestResult.distance * closestResult.distance) {
                        closestResult.position = position;
                        closestResult.distance = Math.sqrt(distanceSq);
                        closestResult.time = segmentIndex + time;
                    }
                }
            } else {
                const cubic = cubicFromSegment(segment);
                const bounds = BoundingBox.fromCubic(cubic).expandScalar(maxDistance);
                if (bounds.containsPoint(point)) {
                    const { position, time } = positionAndTimeAtClosestPointOnCubic(point, cubic);
                    const distanceSq = position.distanceSquared(point);
                    if (distanceSq < maxDistanceSq && distanceSq < closestResult.distance * closestResult.distance) {
                        closestResult.position = position;
                        closestResult.distance = Math.sqrt(distanceSq);
                        closestResult.time = segmentIndex + time;
                    }
                }
            }
            ++segmentIndex;
        }

        return closestResult;
    }

    // =========================================================================
    // Static Methods
    // =========================================================================

    static isValid(a: unknown): a is Path {
        return a instanceof Path && a.isValid();
    }

    static fromPoints(points: Vec[], closed: boolean = false): Path {
        return new Path(
            points.map((point) => new Anchor(point.clone())),
            closed
        );
    }

    static fromCubicBezierPoints(points: Vec[], closed: boolean = false): Path {
        let prevAnchor = new Anchor(points[0].clone());
        const path = new Path([prevAnchor], closed);
        for (let i = 1, n = points.length; i < n;) {
            prevAnchor.handleOut.copy(points[i]).sub(prevAnchor.position);
            if (++i === n) break;
            const nextHandleIn = points[i].clone();
            if (++i === n) {
                if (closed) {
                    path.anchors[0].handleIn.copy(nextHandleIn).sub(path.anchors[0].position);
                } else {
                    path.anchors.push(new Anchor(nextHandleIn));
                }
                break;
            }
            const nextAnchor = new Anchor(points[i].clone(), nextHandleIn);
            nextAnchor.handleIn.sub(nextAnchor.position);
            path.anchors.push(nextAnchor);
            prevAnchor = nextAnchor;
            ++i;
        }
        return path;
    }

    static fromBoundingBox(box: BoundingBox): Path {
        const { min, max } = box;
        return new Path(
            [
                new Anchor(new Vec(min.x, min.y)),
                new Anchor(new Vec(max.x, min.y)),
                new Anchor(new Vec(max.x, max.y)),
                new Anchor(new Vec(min.x, max.y)),
            ],
            true
        );
    }

    static fromArc(center: Vec, radius: number, startAngle: number, endAngle: number): Path {
        const absAngle = Math.abs(startAngle - endAngle);
        const numSegments = Math.ceil(absAngle / 90);
        const segmentAngle = (endAngle - startAngle) / numSegments;

        const path = new Path([new Anchor(new Vec(1, 0))]);
        for (let i = 0; i < numSegments; i++) {
            const segment = arcSegment(segmentAngle);
            segment.transform({ rotation: i * segmentAngle });
            const lastAnchor = path.anchors[path.anchors.length - 1];
            lastAnchor.handleOut = segment.anchors[0].handleOut;
            path.anchors.push(segment.anchors[1]);
        }

        path.transform({
            position: center,
            rotation: startAngle,
            scale: radius,
        });

        return path;
    }

    static circle(center: Vec, radius: number): Path {
        return Path.fromArc(center, radius, 0, 360).close();
    }

    static rect(x: number, y: number, width: number, height: number): Path {
        return Path.fromBoundingBox(new BoundingBox(new Vec(x, y), new Vec(x + width, y + height)));
    }

    close(): Path {
        this.closed = true;
        return this;
    }
}

// =============================================================================
// Helper Functions
// =============================================================================

/** Normalize time for a path (handle closed loops and clamping). */
const normalizeTimeForPath = (time: number, path: Path): number => {
    const len = path.anchors.length;
    if (path.closed) {
        if (time >= 0) {
            return time % len;
        } else {
            return (time + len) % len;
        }
    }
    return clamp(time, 0, len - 1);
};

/** Create arc segment for a given angle. */
const arcSegment = (angle: number): Path => {
    const f = (4 / 3) * tan(angle / 4);
    return new Path([
        new Anchor(new Vec(1, 0), new Vec(0, 0), new Vec(0, f)),
        new Anchor(new Vec(1, 0).rotate(angle), new Vec(0, -f).rotate(angle), new Vec(0, 0)),
    ]);
};