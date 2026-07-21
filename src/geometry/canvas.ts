/**
 * Geometry Library - Canvas
 *
 * Canvas rendering helpers and hit testing using Canvas APIs.
 */

import { Stroke, type Fill } from './Style.js';
import type { ExportOptions } from './Geometry.js';

/**
 * Minimal shape that canvas helpers need. Path and Shape both satisfy this
 * automatically once converted — no explicit link required (structural typing).
 */
interface CanvasPaintable {
    stroke?: Stroke;
    fill?: Fill;
    toCanvasPath(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): void;
}

// Dummy HTML Canvas context for running isPointInPath and isPointInStroke.
let dummyCanvasCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

if (typeof document !== 'undefined' && document.createElement) {
    const dummyCanvas = document.createElement('canvas');
    dummyCanvasCtx = dummyCanvas.getContext('2d');
} else if (typeof OffscreenCanvas !== 'undefined') {
    const dummyCanvas = new OffscreenCanvas(1, 1);
    dummyCanvasCtx = dummyCanvas.getContext('2d');
}

export { dummyCanvasCtx };

/** Check if a styled path or shape contains a point. */
export const styleContainsPoint = (geom: CanvasPaintable, point: { x: number; y: number }): boolean => {
    if (!dummyCanvasCtx) return false;

    const { stroke, fill } = geom;

    const hasVisibleFill = !!(fill && fill.color.a > 0);
    const hasVisibleStroke = !!(stroke && !stroke.hairline && stroke.color.a > 0);

    if (!hasVisibleFill && !hasVisibleStroke) return false;

    dummyCanvasCtx.beginPath();
    geom.toCanvasPath(dummyCanvasCtx);
    const isInPath = dummyCanvasCtx.isPointInPath(point.x, point.y, 'evenodd');

    if (hasVisibleFill && isInPath) return true;

    if (hasVisibleStroke && stroke) {
        dummyCanvasCtx.lineJoin = stroke.join;
        dummyCanvasCtx.lineCap = stroke.cap;
        dummyCanvasCtx.miterLimit = stroke.miterLimit;
        if (stroke.alignment === 'centered') {
            dummyCanvasCtx.lineWidth = stroke.width;
            return dummyCanvasCtx.isPointInStroke(point.x, point.y);
        } else if (stroke.alignment === 'outer') {
            dummyCanvasCtx.lineWidth = stroke.width * 2;
            return !isInPath && dummyCanvasCtx.isPointInStroke(point.x, point.y);
        } else if (stroke.alignment === 'inner') {
            dummyCanvasCtx.lineWidth = stroke.width * 2;
            return isInPath && dummyCanvasCtx.isPointInStroke(point.x, point.y);
        }
    }
    return false;
};

/** Paint a path or shape to a canvas context. */
export const paintToCanvas = (
    item: CanvasPaintable,
    ctx: CanvasRenderingContext2D,
    options: ExportOptions = {}
): void => {
    if (!ctx) return;

    ctx.beginPath();
    item.toCanvasPath(ctx);

    let stroke = item.stroke;
    let fill = item.fill;
    if (!stroke && !fill) {
        stroke = new Stroke();
    }

    if (fill) {
        ctx.fillStyle = fill.color.toCSSString();
        ctx.fill('evenodd');
    }

    if (stroke) {
        ctx.strokeStyle = stroke.color.toCSSString();
        ctx.lineCap = stroke.cap;
        ctx.lineJoin = stroke.join;
        ctx.miterLimit = stroke.miterLimit;

        const nonStandardAlignment =
            !stroke.hairline && (stroke.alignment === 'outer' || stroke.alignment === 'inner');
        if (stroke.hairline) {
            ctx.lineWidth = options?.hairlineStrokeWidth ?? 1;
        } else if (nonStandardAlignment) {
            ctx.lineWidth = stroke.width * 2;
        } else {
            ctx.lineWidth = stroke.width;
        }

        if (nonStandardAlignment) {
            ctx.save();
            ctx.clip('evenodd');
            ctx.stroke();
            ctx.restore();
        } else {
            ctx.stroke();
        }
    }
};