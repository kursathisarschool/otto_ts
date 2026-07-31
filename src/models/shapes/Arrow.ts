import { type Schema } from './schema.js';
import { Bounds, Shape } from './Shape.js';
import {
    Color as GeoColor,
    Fill as GeoFill,
    Path as GeoPath,
    Vec as GeoVec,
    styleContainsPoint
} from '../../geometry/index.js';

const HIT_TEST_FILL: GeoFill = new GeoFill(new GeoColor(0, 0, 0, 1));

/**
 * Arrow shape implementation
 * Bindable properties: x, y, length, headWidth, headLength
 */
export class Arrow extends Shape {
    static type = 'arrow';

    static SCHEMA: Schema = {
        x: { type: 'number', default: (o) => o.position?.x ?? 0, bindable: true, translate: 'x', label: 'X' },
        y: { type: 'number', default: (o) => o.position?.y ?? 0, bindable: true, translate: 'y', label: 'Y' },
        length: { type: 'number', default: 50, bindable: true, min: 0, label: 'Length' },
        headWidth: { type: 'number', default: 15, bindable: true, min: 0, label: 'Head Width', aliases: ['head_width'] },
        headLength: { type: 'number', default: 12.5, bindable: true, min: 0, label: 'Head Length', aliases: ['head_length'] }
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
    
    containsPoint(px: number, py: number): boolean {
        const path = this.toGeometryPath();
        path.assignFill(HIT_TEST_FILL);
        return styleContainsPoint(path, new GeoVec(px, py));
    }
    
    render(ctx: CanvasRenderingContext2D): void {
        const path = this.toGeometryPath();
        ctx.beginPath();
        path.toCanvasPath(ctx);
        ctx.stroke();
    }

    toGeometryPath(): GeoPath {
        return GeoPath.fromPoints(this.getPoints().map(p => new GeoVec(p.x, p.y)), true);
    }

    getPoints(): {
        x: any;
        y: any;
    }[] {
        const sx: number = this.x;
        const sy: number = this.y;

        const headWidth: number = Math.max(2, this.headWidth);
        const headLength: number = Math.max(2, Math.min(this.headLength, this.length));
        const shaftWidth: number = Math.max(2, Math.min(headWidth * 0.3, headWidth - 2));
        const shaftEndX: number = sx + this.length - headLength;

        return [
            // Tail cap (thin rectangle end)
            { x: sx, y: sy - shaftWidth / 2 },
            { x: shaftEndX, y: sy - shaftWidth / 2 },
            // Head (triangle)
            { x: shaftEndX, y: sy - headWidth / 2 },
            { x: sx + this.length, y: sy },
            { x: shaftEndX, y: sy + headWidth / 2 },
            // Back to shaft
            { x: shaftEndX, y: sy + shaftWidth / 2 },
            { x: sx, y: sy + shaftWidth / 2 }
        ];
    }
}
