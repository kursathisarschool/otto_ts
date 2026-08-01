import type { Shape } from '../Shape.js';
import { ShapeDecorator } from './ShapeDecorator.js';

interface GradientStop {
    offset: number;
    color: string;
}

interface GradientConfig {
    type: 'linear' | 'radial';
    stops?: GradientStop[];
    angle?: number;
}

interface Options {
    color?: string;
    opacity?: number;
    gradient?: GradientConfig;
}

export class FillDecorator extends ShapeDecorator {
    fillColor: string;
    fillOpacity: number;
    gradient: GradientConfig | null;

    constructor(shape: Shape | ShapeDecorator, options: Options = {}) {
        super(shape);
        this.fillColor = options.color || '#3498db';
        this.fillOpacity = options.opacity !== undefined ? options.opacity : 1;
        this.gradient = options.gradient || null;
    }

    /** Render the shape with fill. */
    render(ctx: CanvasRenderingContext2D): void {
        ctx.save();

        ctx.globalAlpha = this.fillOpacity;

        if (this.gradient) {
            ctx.fillStyle = this.createGradient(ctx);
        } else {
            ctx.fillStyle = this.fillColor;
        }

        this.renderFill(ctx);

        ctx.globalAlpha = 1;

        this.wrappedShape.render(ctx);

        ctx.restore();
    }

    /** Render just the fill (trace path and fill). */
    renderFill(ctx: CanvasRenderingContext2D): void {
        const shape = this.getBaseShape();
        const type = shape.type;

        ctx.beginPath();

        if (type === 'circle') {
            ctx.arc(shape.centerX, shape.centerY, shape.radius, 0, Math.PI * 2);
        } else if (type === 'rectangle') {
            ctx.rect(shape.x, shape.y, shape.width, shape.height);
        } else if (type === 'group') {
            const children = shape.getChildren();
            for (const child of children) {
                const filledChild = new FillDecorator(child, {
                    color: this.fillColor,
                    opacity: 1,
                    gradient: this.gradient ?? undefined
                });
                filledChild.renderFill(ctx);
            }
            return;
        } else {
            const bounds = shape.getBounds();
            ctx.rect(bounds.x, bounds.y, bounds.width, bounds.height);
        }

        ctx.fill();
    }

    /** Create gradient from configuration. */
    createGradient(ctx: CanvasRenderingContext2D): CanvasGradient | string {
        const bounds = this.wrappedShape.getBounds();
        const { type, stops, angle = 0 } = this.gradient!;

        let gradient: CanvasGradient;

        if (type === 'linear') {
            const radians = (angle * Math.PI) / 180;
            const centerX = bounds.x + bounds.width / 2;
            const centerY = bounds.y + bounds.height / 2;
            const length = Math.sqrt(bounds.width * bounds.width + bounds.height * bounds.height) / 2;

            const x1 = centerX - Math.cos(radians) * length;
            const y1 = centerY - Math.sin(radians) * length;
            const x2 = centerX + Math.cos(radians) * length;
            const y2 = centerY + Math.sin(radians) * length;

            gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        } else if (type === 'radial') {
            const centerX = bounds.x + bounds.width / 2;
            const centerY = bounds.y + bounds.height / 2;
            const radius = Math.max(bounds.width, bounds.height) / 2;

            gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        } else {
            return this.fillColor;
        }

        if (stops && Array.isArray(stops)) {
            for (const stop of stops) {
                gradient.addColorStop(stop.offset, stop.color);
            }
        }

        return gradient;
    }

    cloneWithShape(newShape: Shape | ShapeDecorator): FillDecorator {
        return new FillDecorator(newShape, {
            color: this.fillColor,
            opacity: this.fillOpacity,
            gradient: this.gradient ? { ...this.gradient } : undefined
        });
    }

    getDecoratorJSON(): any {
        return {
            type: 'fill',
            color: this.fillColor,
            opacity: this.fillOpacity,
            gradient: this.gradient
        };
    }

    /** Create FillDecorator from JSON. */
    static fromJSON(shape: Shape | ShapeDecorator, json: any): FillDecorator {
        return new FillDecorator(shape, {
            color: json.color,
            opacity: json.opacity,
            gradient: json.gradient
        });
    }
}