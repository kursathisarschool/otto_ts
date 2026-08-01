import { Shape } from './Shape.js';
import { Color as GeoColor, Fill as GeoFill, Path as GeoPath, Vec as GeoVec, styleContainsPoint } from '../../geometry/index.js';
/** Opaque black fill used exclusively for hit-testing. */
const HIT_TEST_FILL = new GeoFill(new GeoColor(0, 0, 0, 1));
/** Axis-aligned rectangle. */
export class Rectangle extends Shape {
    /** The bounding box of an axis-aligned rectangle is the rectangle itself. */
    getBounds() {
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
    containsPoint(x, y) {
        const path = this.toGeometryPath();
        path.assignFill(HIT_TEST_FILL);
        return styleContainsPoint(path, new GeoVec(x, y));
    }
    /** Render the rectangle onto the given canvas context. */
    render(ctx) {
        const path = this.toGeometryPath();
        ctx.beginPath();
        path.toCanvasPath(ctx);
        ctx.stroke();
    }
    /** Build the geometry-library Path for this rectangle. */
    toGeometryPath() {
        return GeoPath.rect(this.x, this.y, this.width, this.height);
    }
}
Rectangle.type = 'rectangle';
Rectangle.SCHEMA = {
    x: { type: 'number', default: (o) => o.position?.x ?? 0, bindable: true, translate: 'x', label: 'X' },
    y: { type: 'number', default: (o) => o.position?.y ?? 0, bindable: true, translate: 'y', label: 'Y' },
    width: { type: 'number', default: 40, bindable: true, min: 0, label: 'Width' },
    height: { type: 'number', default: 40, bindable: true, min: 0, label: 'Height' }
};
