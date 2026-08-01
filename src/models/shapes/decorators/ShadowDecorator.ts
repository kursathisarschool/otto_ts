import { ShapeDecorator } from './ShapeDecorator.js';
import type { Shape } from '../Shape.js';

interface ShadowOptions {
    color?: string;
    blur?: number;
    offsetX?: number;
    offsetY?: number;
}

/**
 * ShadowDecorator - Adds drop shadow effect to shapes
 */
export class ShadowDecorator extends ShapeDecorator {
    shadowColor: string;
    shadowBlur: number;
    shadowOffsetX: number;
    shadowOffsetY: number;

    constructor(shape: Shape | ShapeDecorator, options: ShadowOptions = {}) {
        super(shape);
        this.shadowColor = options.color || 'rgba(0, 0, 0, 0.3)';
        this.shadowBlur = options.blur !== undefined ? options.blur : 10;
        this.shadowOffsetX = options.offsetX !== undefined ? options.offsetX : 5;
        this.shadowOffsetY = options.offsetY !== undefined ? options.offsetY : 5;
    }

    /** Render the shape with shadow effect. */
    render(ctx: CanvasRenderingContext2D): void {
        ctx.save();

        ctx.shadowColor = this.shadowColor;
        ctx.shadowBlur = this.shadowBlur;
        ctx.shadowOffsetX = this.shadowOffsetX;
        ctx.shadowOffsetY = this.shadowOffsetY;

        this.wrappedShape.render(ctx);

        ctx.restore();
    }

    /** Get expanded bounds to include shadow. */
    getBounds(): any {
        const bounds = this.wrappedShape.getBounds();
        const expansion = this.shadowBlur + Math.max(Math.abs(this.shadowOffsetX), Math.abs(this.shadowOffsetY));

        return {
            x: bounds.x - expansion,
            y: bounds.y - expansion,
            width: bounds.width + expansion * 2,
            height: bounds.height + expansion * 2
        };
    }

    cloneWithShape(newShape: Shape | ShapeDecorator): ShadowDecorator {
        return new ShadowDecorator(newShape, {
            color: this.shadowColor,
            blur: this.shadowBlur,
            offsetX: this.shadowOffsetX,
            offsetY: this.shadowOffsetY
        });
    }

    getDecoratorJSON(): any {
        return {
            type: 'shadow',
            color: this.shadowColor,
            blur: this.shadowBlur,
            offsetX: this.shadowOffsetX,
            offsetY: this.shadowOffsetY
        };
    }

    /** Create ShadowDecorator from JSON. */
    static fromJSON(shape: Shape | ShapeDecorator, json: any): ShadowDecorator {
        return new ShadowDecorator(shape, {
            color: json.color,
            blur: json.blur,
            offsetX: json.offsetX,
            offsetY: json.offsetY
        });
    }
}