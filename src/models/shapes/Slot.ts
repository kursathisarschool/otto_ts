import { type Schema } from './schema.js';

import { Bounds, Shape } from './Shape.js';
import {
    Color as GeoColor,
    Fill as GeoFill,
    Path as GeoPath,
    Vec as GeoVec,
    styleContainsPoint
} from '../../geometry/index.js';

const HIT_TEST_FILL:GeoFill = new GeoFill(new GeoColor(0, 0, 0, 1));

/**
 * Slot (stadium/obround) shape implementation
 * Bindable properties: centerX, centerY, length, slotWidth
 */
export class Slot extends Shape {
    static type: string = 'slot';

    static SCHEMA:Schema = {
        centerX: { type: 'number', default: (o) => o.position?.x ?? 0, bindable: true, translate: 'x', label: 'Center X' },
        centerY: { type: 'number', default: (o) => o.position?.y ?? 0, bindable: true, translate: 'y', label: 'Center Y' },
        length: { type: 'number', default: 50, bindable: true, min: 0, label: 'Length' },
        slotWidth: { type: 'number', default: 15, bindable: true, min: 0, label: 'Slot Width', aliases: ['width', 'slot_width'] }
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
        path.assignFill(HIT_TEST_FILL);
        return styleContainsPoint(path, new GeoVec(x, y));
    }
    
    render(ctx: CanvasRenderingContext2D): void {
        const path: GeoPath = this.toGeometryPath();
        ctx.beginPath();
        path.toCanvasPath(ctx);
        ctx.stroke();
    }

    toGeometryPath(): GeoPath {
        return GeoPath.fromPoints(this.getPoints().map(p => new GeoVec(p.x, p.y)), true);
    }

    getPoints(segments: number = 32): any[] {
        const points: any[] = [];
        const radius: number = this.slotWidth / 2;
        const centerDist: number = (this.length - this.slotWidth) / 2;

        // Right semicircle
        for (let i = 0; i <= segments / 2; i++) {
            const angle: number= -Math.PI / 2 + (i / (segments / 2)) * Math.PI;
            points.push({
                x: this.centerX + centerDist + Math.cos(angle) * radius,
                y: this.centerY + Math.sin(angle) * radius
            });
        }

        // Left semicircle
        for (let i = 0; i <= segments / 2; i++) {
            const angle: number = Math.PI / 2 + (i / (segments / 2)) * Math.PI;
            points.push({
                x: this.centerX - centerDist + Math.cos(angle) * radius,
                y: this.centerY + Math.sin(angle) * radius
            });
        }

        return points;
    }
}
