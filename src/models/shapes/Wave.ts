
import {type Schema } from './schema.js';

import { Bounds, Shape } from './Shape.js';
import {
    BoundingBox,
    Color as GeoColor,
    Fill as GeoFill,
    Path as GeoPath,
    Stroke as GeoStroke,
    Vec as GeoVec,
    styleContainsPoint
} from '../../geometry/index.js';

const HIT_TEST_STROKE:GeoStroke = new GeoStroke(new GeoColor(0, 0, 0, 1), false, 6, 'centered', 'round', 'round', 4);

/**
 * Wave shape implementation
 * Bindable properties: centerX, centerY, width, amplitude, frequency
 */
export class Wave extends Shape {
    static type = 'wave';

    static SCHEMA:Schema = {
        centerX: { type: 'number', default: (o) => o.position?.x ?? 0, bindable: true, translate: 'x', label: 'Center X' },
        centerY: { type: 'number', default: (o) => o.position?.y ?? 0, bindable: true, translate: 'y', label: 'Center Y' },
        width: { type: 'number', default: 50, bindable: true, min: 0, label: 'Width' },
        amplitude: { type: 'number', default: 10, bindable: true, min: 0, label: 'Amplitude' },
        frequency: { type: 'number', default: 2, bindable: true, min: 0.25, step: 0.25, label: 'Frequency' }
    };

    getBounds():Bounds {
        const path:GeoPath = this.toGeometryPath();
        const box:BoundingBox = path.tightBoundingBox() || path.looseBoundingBox();
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
    
    containsPoint(x: number, y: number):boolean {
        const path:GeoPath = this.toGeometryPath();
        const stroke: GeoStroke = HIT_TEST_STROKE.clone();
        stroke.width = 6;
        path.assignStroke(stroke);
        return styleContainsPoint(path, new GeoVec(x, y));
    }
    
    render(ctx: CanvasRenderingContext2D) : void{
        const path:GeoPath = this.toGeometryPath();
        ctx.beginPath();
        path.toCanvasPath(ctx);
        ctx.stroke();
    }

    toGeometryPath():GeoPath {
        return GeoPath.fromPoints(this.getPoints().map(p => new GeoVec(p.x, p.y)), false);
    }

    getPoints(segments:number = 50): any[] {
        const points: any[] = [];
        const startX: number = this.centerX - this.width / 2;
        
        for (let i = 0; i <= segments; i++) {
            const x: number = startX + (i / segments) * this.width;
            const relX : number= x - this.centerX + this.width / 2;
            const y : number= this.centerY + Math.sin((relX * this.frequency * Math.PI * 2) / this.width) * this.amplitude;
            points.push({ x, y });
        }

        return points;
    }
}
