import { type Schema } from './schema.js';
import { Shape, type Bounds } from './Shape.js';
import {
    Anchor as GeoAnchor,
    Color as GeoColor,
    Fill as GeoFill,
    Path as GeoPath,
    Stroke as GeoStroke,
    Vec as GeoVec,
    styleContainsPoint
} from '../../geometry/index.js';

const HIT_TEST_FILL: GeoFill = new GeoFill(new GeoColor(0, 0, 0, 1));
const HIT_TEST_STROKE: GeoStroke = new GeoStroke(new GeoColor(0, 0, 0, 1), false, 6, 'centered', 'round', 'round', 4);

interface HandleEntry {
    handleIn: { x: number; y: number } | null;
    handleOut: { x: number; y: number } | null;
}

/** Deep-copy a handles array ({handleIn, handleOut} offsets per point) or null. */
function copyHandles(handles: any): HandleEntry[] | null {
    if (!Array.isArray(handles)) {
        return null;
    }
    return handles.map((h: any) => ({
        handleIn: h?.handleIn ? { x: h.handleIn.x, y: h.handleIn.y } : null,
        handleOut: h?.handleOut ? { x: h.handleOut.x, y: h.handleOut.y } : null
    }));
}

/**
 * Freeform path shape backed by geometry Path.
 */
export class PathShape extends Shape {
    static type = 'path';

    static SCHEMA: Schema = {
        strokeWidth: {
            type: 'number', default: 2, bindable: true, alwaysSerialize: true,
            min: 0.1, label: 'Stroke Width'
        },
        points: {
            type: 'points',
            default: () => [],
            copy: (pts: any) => (Array.isArray(pts) ? pts.map((p: any) => ({ x: p.x, y: p.y })) : []),
            serialize: (pts: any) => pts.map((p: any) => ({ x: p.x, y: p.y }))
        },
        closed: { type: 'boolean', default: false },
        curveSegments: {
            type: 'segments',
            default: (o: any) => new Array(Math.max(0, (Array.isArray(o.points) ? o.points.length : 0) - 1)).fill(!!o.smooth),
            copy: (v: any) => (Array.isArray(v) ? v.map(Boolean) : []),
            serialize: (v: any) => (Array.isArray(v) ? v.map(Boolean) : [])
        },
        handles: {
            type: 'handles',
            default: null,
            omitIfNull: true,
            copy: copyHandles,
            serialize: copyHandles
        }
    };

    getBounds(): Bounds {
        const path = this.toGeometryPath();
        const box = path.tightBoundingBox() || path.looseBoundingBox();
        if (!box) {
            return { x: 0, y: 0, width: 0, height: 0 };
        }
        return {
            x: box.min.x,
            y: box.min.y,
            width: box.width(),
            height: box.height()
        };
    }

    containsPoint(x: number, y: number): boolean {
        const path = this.toGeometryPath();
        if (this.closed) {
            path.assignFill(HIT_TEST_FILL);
        } else {
            const stroke = HIT_TEST_STROKE.clone();
            stroke.width = Math.max(this.strokeWidth, 2);
            path.assignStroke(stroke);
        }
        return styleContainsPoint(path, new GeoVec(x, y));
    }

    render(ctx: CanvasRenderingContext2D): void {
        const path = this.toGeometryPath();
        ctx.save();
        ctx.beginPath();
        path.toCanvasPath(ctx);
        ctx.lineWidth = this.strokeWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000';
        ctx.stroke();
        ctx.restore();
    }

    /** Move the path by shifting every point. */
    translate(dx: number, dy: number): this {
        super.translate(dx, dy);
        this.points = this.points.map((p: any) => ({ x: p.x + dx, y: p.y + dy }));
        return this;
    }

    /** Set a custom handle for a point. */
    setHandle(pointIndex: number, handleType: 'handleIn' | 'handleOut', value: { x: number; y: number } | null): void {
        if (!this.handles) {
            this.handles = this.points.map(() => ({ handleIn: null, handleOut: null }));
        }
        while (this.handles.length < this.points.length) {
            this.handles.push({ handleIn: null, handleOut: null });
        }
        if (this.handles[pointIndex]) {
            this.handles[pointIndex][handleType] = value ? { x: value.x, y: value.y } : null;
        }
    }

    /** Get handle positions for a point (returns calculated handles if no custom ones). */
    getHandles(pointIndex: number): HandleEntry {
        if (this.handles && this.handles[pointIndex]) {
            const h = this.handles[pointIndex];
            if (h.handleIn || h.handleOut) {
                return {
                    handleIn: h.handleIn ? { ...h.handleIn } : null,
                    handleOut: h.handleOut ? { ...h.handleOut } : null
                };
            }
        }

        return this.calculateDefaultHandles(pointIndex);
    }

    /** Calculate default handles for a point based on neighboring segments. */
    calculateDefaultHandles(pointIndex: number): HandleEntry {
        const result: HandleEntry = { handleIn: null, handleOut: null };
        const n = this.points.length;
        if (n < 2) return result;

        const segmentCount = this.closed ? n : n - 1;

        const prevSegIdx = this.closed ? (pointIndex - 1 + n) % n : pointIndex - 1;
        const hasPrevCurve = prevSegIdx >= 0 && prevSegIdx < segmentCount && this.curveSegments[prevSegIdx];

        const nextSegIdx = pointIndex;
        const hasNextCurve = nextSegIdx >= 0 && nextSegIdx < segmentCount && this.curveSegments[nextSegIdx];

        if (!hasPrevCurve && !hasNextCurve) return result;

        const getPoint = (idx: number): { x: number; y: number } => {
            if (this.closed) {
                return this.points[(idx + n) % n];
            }
            return this.points[Math.max(0, Math.min(n - 1, idx))];
        };

        const p = getPoint(pointIndex);
        const pPrev = getPoint(pointIndex - 1);
        const pNext = getPoint(pointIndex + 1);

        const dxNext = pNext.x - p.x;
        const dyNext = pNext.y - p.y;
        const lenNext = Math.sqrt(dxNext * dxNext + dyNext * dyNext);

        const dxPrev = p.x - pPrev.x;
        const dyPrev = p.y - pPrev.y;
        const lenPrev = Math.sqrt(dxPrev * dxPrev + dyPrev * dyPrev);

        if (hasNextCurve && lenNext > 0.001) {
            const handleLen = lenNext / 3;
            const tangentX = pNext.x - pPrev.x;
            const tangentY = pNext.y - pPrev.y;
            const tangentLen = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
            if (tangentLen > 0.001) {
                result.handleOut = {
                    x: tangentX / tangentLen * handleLen,
                    y: tangentY / tangentLen * handleLen
                };
            } else {
                result.handleOut = {
                    x: dxNext / lenNext * handleLen,
                    y: dyNext / lenNext * handleLen
                };
            }
        }

        if (hasPrevCurve && lenPrev > 0.001) {
            const handleLen = lenPrev / 3;
            const pPrevPrev = getPoint(pointIndex - 2);
            const tangentX = pPrevPrev.x - pNext.x;
            const tangentY = pPrevPrev.y - pNext.y;
            const tangentLen = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
            if (tangentLen > 0.001) {
                result.handleIn = {
                    x: tangentX / tangentLen * handleLen,
                    y: tangentY / tangentLen * handleLen
                };
            } else {
                result.handleIn = {
                    x: -dxPrev / lenPrev * handleLen,
                    y: -dyPrev / lenPrev * handleLen
                };
            }
        }

        return result;
    }

    toGeometryPath(): GeoPath {
        return PathShape.buildGeometryPath(this.points, this.closed, this.curveSegments, false, this.handles);
    }

    static buildGeometryPath(
        points: { x: number; y: number }[],
        closed: boolean,
        curveSegments: boolean[],
        smooth: boolean = false,
        customHandles: (HandleEntry | null)[] | null = null
    ): GeoPath {
        if (!points || points.length === 0) {
            return new GeoPath([]);
        }
        const vecs = points.map((p) => new GeoVec(p.x, p.y));

        if (vecs.length < 2) {
            return GeoPath.fromPoints(vecs, closed);
        }

        const segmentCount = closed ? vecs.length : vecs.length - 1;
        const segmentFlags = Array.isArray(curveSegments)
            ? curveSegments.slice(0, segmentCount).map(Boolean)
            : (smooth ? new Array(segmentCount).fill(true) : null);

        const hasCustomHandles = customHandles && customHandles.some(h => h?.handleIn || h?.handleOut);

        if ((!segmentFlags || !segmentFlags.some(Boolean)) && !hasCustomHandles) {
            return GeoPath.fromPoints(vecs, closed);
        }

        const anchors = vecs.map(
            (v) => new GeoAnchor(v.clone(), new GeoVec(0, 0), new GeoVec(0, 0))
        );

        const getPoint = (idx: number): GeoVec => {
            if (closed) {
                return vecs[(idx + vecs.length) % vecs.length];
            }
            return vecs[Math.max(0, Math.min(vecs.length - 1, idx))];
        };

        const getAnchor = (idx: number): GeoAnchor => {
            if (closed) {
                return anchors[(idx + anchors.length) % anchors.length];
            }
            return anchors[Math.max(0, Math.min(anchors.length - 1, idx))];
        };

        const getCustomHandle = (pointIdx: number, type: 'handleIn' | 'handleOut'): { x: number; y: number } | null => {
            if (customHandles && customHandles[pointIdx] && customHandles[pointIdx]![type]) {
                return customHandles[pointIdx]![type];
            }
            return null;
        };

        for (let i = 0; i < segmentCount; i++) {
            const customOutHandle = getCustomHandle(i, 'handleOut');
            const customInHandle = getCustomHandle(closed ? (i + 1) % vecs.length : Math.min(i + 1, vecs.length - 1), 'handleIn');

            if (customOutHandle) {
                getAnchor(i).handleOut = new GeoVec(customOutHandle.x, customOutHandle.y);
            }
            if (customInHandle) {
                getAnchor(i + 1).handleIn = new GeoVec(customInHandle.x, customInHandle.y);
            }

            if (!segmentFlags || !segmentFlags[i]) {
                continue;
            }

            const p1 = getPoint(i);
            const p2 = getPoint(i + 1);

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const segmentLength = Math.sqrt(dx * dx + dy * dy);

            if (segmentLength < 0.001) {
                continue;
            }

            const handleLen = segmentLength / 3;

            if (!customOutHandle) {
                const p0 = getPoint(i - 1);
                let outX: number, outY: number;

                if (!closed && i === 0) {
                    outX = dx / segmentLength * handleLen;
                    outY = dy / segmentLength * handleLen;
                } else {
                    const tangentX = p2.x - p0.x;
                    const tangentY = p2.y - p0.y;
                    const tangentLen = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
                    if (tangentLen > 0.001) {
                        outX = tangentX / tangentLen * handleLen;
                        outY = tangentY / tangentLen * handleLen;
                    } else {
                        outX = dx / segmentLength * handleLen;
                        outY = dy / segmentLength * handleLen;
                    }
                }
                getAnchor(i).handleOut = new GeoVec(outX, outY);
            }

            if (!customInHandle) {
                const p3 = getPoint(i + 2);
                let inX: number, inY: number;

                if (!closed && i === segmentCount - 1) {
                    inX = -dx / segmentLength * handleLen;
                    inY = -dy / segmentLength * handleLen;
                } else {
                    const tangentX = p1.x - p3.x;
                    const tangentY = p1.y - p3.y;
                    const tangentLen = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
                    if (tangentLen > 0.001) {
                        inX = tangentX / tangentLen * handleLen;
                        inY = tangentY / tangentLen * handleLen;
                    } else {
                        inX = -dx / segmentLength * handleLen;
                        inY = -dy / segmentLength * handleLen;
                    }
                }
                getAnchor(i + 1).handleIn = new GeoVec(inX, inY);
            }
        }

        return new GeoPath(anchors, closed);
    }
}