/**
 * @fileoverview Rectangle -- axis-aligned rectangle defined by its top-left
 * corner (x, y) and size (width, height), all bindable.
 * @module models/shapes/Rectangle
 */
import { type Schema } from './schema.js';
import { Shape, type Bounds } from './Shape.js';
import {
    Color as GeoColor,
    Fill as GeoFill,
    Path as GeoPath,
    Vec as GeoVec,
    styleContainsPoint
} from '../../geometry/index.js';

/** Opaque black fill used exclusively for hit-testing. */
const HIT_TEST_FILL: GeoFill = new GeoFill(new GeoColor(0, 0, 0, 1));

/** Axis-aligned rectangle. */
export class Rectangle extends Shape {
    static type = 'rectangle';

    static SCHEMA: Schema = {
        x: { type: 'number', default: (o: any) => o.position?.x ?? 0, bindable: true, translate: 'x', label: 'X' },
        y: { type: 'number', default: (o: any) => o.position?.y ?? 0, bindable: true, translate: 'y', label: 'Y' },
        width: { type: 'number', default: 40, bindable: true, min: 0, label: 'Width' },
        height: { type: 'number', default: 40, bindable: true, min: 0, label: 'Height' }
    };

    /** The bounding box of an axis-aligned rectangle is the rectangle itself. */
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

    /** Test whether the canvas-space point (x, y) falls inside this rectangle. */
    containsPoint(x: number, y: number): boolean {
        const path = this.toGeometryPath();
        path.assignFill(HIT_TEST_FILL);
        return styleContainsPoint(path, new GeoVec(x, y));
    }

    /** Render the rectangle onto the given canvas context. */
    render(ctx: CanvasRenderingContext2D): void {
        const path = this.toGeometryPath();
        ctx.beginPath();
        path.toCanvasPath(ctx);
        ctx.stroke();
    }

    /** Build the geometry-library Path for this rectangle. */
    toGeometryPath(): GeoPath {
        return GeoPath.rect(this.x, this.y, this.width, this.height);
    }
}