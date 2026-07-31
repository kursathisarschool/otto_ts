/**
 * @fileoverview Circle -- the simplest closed shape in the Otto parametric
 * design system.
 * @module models/shapes/Circle
 */

import { Shape, type Bounds } from './Shape.js';
import { type Schema } from './schema.js';
import {
    Color as GeoColor,
    Fill as GeoFill,
    Path as GeoPath,
    Vec as GeoVec,
    styleContainsPoint
} from '../../geometry/index.js';

/** Opaque black fill used exclusively for hit-testing. */
const HIT_TEST_FILL: GeoFill = new GeoFill(new GeoColor(0, 0, 0, 1));

/** Circle shape. Defined by a centre point and a radius. */
export class Circle extends Shape {
    static type = 'circle';

    static SCHEMA: Schema = {
        centerX: { type: 'number', default: (o: any) => o.position?.x ?? 0, bindable: true, translate: 'x', label: 'Center X' },
        centerY: { type: 'number', default: (o: any) => o.position?.y ?? 0, bindable: true, translate: 'y', label: 'Center Y' },
        radius: { type: 'number', default: 20, bindable: true, min: 0, label: 'Radius' }
    };

    /** Compute the axis-aligned bounding box by delegating to the geometry path. */
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

    /** Test whether the canvas-space point (x, y) falls inside this circle. */
    containsPoint(x: number, y: number): boolean {
        const path = this.toGeometryPath();
        path.assignFill(HIT_TEST_FILL);
        return styleContainsPoint(path, new GeoVec(x, y));
    }

    /** Render the circle onto the given canvas context. */
    render(ctx: CanvasRenderingContext2D): void {
        const path = this.toGeometryPath();
        ctx.beginPath();
        path.toCanvasPath(ctx);
        ctx.stroke();
    }

    /** Build the geometry-library Path for this circle. */
    toGeometryPath(): GeoPath {
        return GeoPath.circle(new GeoVec(this.centerX, this.centerY), this.radius);
    }
}