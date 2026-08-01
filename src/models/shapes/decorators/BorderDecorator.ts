import { ShapeDecorator } from './ShapeDecorator.js';
import type { Shape } from '../Shape.js';

interface Options {
    color?: string;
    width?: number;
    style?: string;
    lineCap?: CanvasLineCap;
    lineJoin?: CanvasLineJoin;
    dashPattern?: number[];
}

/**
 * BorderDecorator - Adds custom border styling to shapes
 */
export class BorderDecorator extends ShapeDecorator {
    borderColor: string;
    borderWidth: number;
    borderStyle: string;
    lineCap: CanvasLineCap;
    lineJoin: CanvasLineJoin;
    dashPattern: number[] | null;

    constructor(shape: Shape | ShapeDecorator, options: Options = {}) {
        super(shape);
        this.borderColor = options.color || '#333333';
        this.borderWidth = options.width !== undefined ? options.width : 2;
        this.borderStyle = options.style || 'solid';
        this.lineCap = options.lineCap || 'round';
        this.lineJoin = options.lineJoin || 'round';
        this.dashPattern = options.dashPattern || null;
    }

    /** Get dash pattern based on style. */
    getDashPattern(): number[] {
        if (this.dashPattern) {
            return this.dashPattern;
        }

        switch (this.borderStyle) {
            case 'dashed':
                return [10, 5];
            case 'dotted':
                return [2, 4];
            case 'solid':
            default:
                return [];
        }
    }

    /** Render the shape with custom border. */
    render(ctx: CanvasRenderingContext2D): void {
        ctx.save();

        ctx.strokeStyle = this.borderColor;
        ctx.lineWidth = this.borderWidth;
        ctx.lineCap = this.lineCap;
        ctx.lineJoin = this.lineJoin;
        ctx.setLineDash(this.getDashPattern());

        this.renderBorder(ctx);

        ctx.restore();
    }

    /** Render just the border (trace path and stroke). */
    renderBorder(ctx: CanvasRenderingContext2D): void {
        const shape = this.getBaseShape() as any;
        const type = shape.type;

        ctx.beginPath();

        if (type === 'circle') {
            ctx.arc(shape.centerX, shape.centerY, shape.radius, 0, Math.PI * 2);
        } else if (type === 'rectangle') {
            ctx.rect(shape.x, shape.y, shape.width, shape.height);
        } else if (type === 'group') {
            const children = shape.getChildren();
            for (const child of children) {
                const borderedChild = new BorderDecorator(child, {
                    color: this.borderColor,
                    width: this.borderWidth,
                    style: this.borderStyle,
                    lineCap: this.lineCap,
                    lineJoin: this.lineJoin,
                    dashPattern: this.dashPattern ?? undefined
                });
                borderedChild.renderBorder(ctx);
            }
            return;
        } else {
            const bounds = shape.getBounds();
            ctx.rect(bounds.x, bounds.y, bounds.width, bounds.height);
        }

        ctx.stroke();
    }

    /** Get expanded bounds to include border width. */
    getBounds(): any {
        const bounds = this.wrappedShape.getBounds();
        const halfWidth = this.borderWidth / 2;

        return {
            x: bounds.x - halfWidth,
            y: bounds.y - halfWidth,
            width: bounds.width + this.borderWidth,
            height: bounds.height + this.borderWidth
        };
    }

    cloneWithShape(newShape: Shape | ShapeDecorator): BorderDecorator {
        return new BorderDecorator(newShape, {
            color: this.borderColor,
            width: this.borderWidth,
            style: this.borderStyle,
            lineCap: this.lineCap,
            lineJoin: this.lineJoin,
            dashPattern: this.dashPattern ? [...this.dashPattern] : undefined
        });
    }

    getDecoratorJSON(): any {
        return {
            type: 'border',
            color: this.borderColor,
            width: this.borderWidth,
            style: this.borderStyle,
            lineCap: this.lineCap,
            lineJoin: this.lineJoin,
            dashPattern: this.dashPattern
        };
    }

    /** Create BorderDecorator from JSON. */
    static fromJSON(shape: Shape | ShapeDecorator, json: any): BorderDecorator {
        return new BorderDecorator(shape, {
            color: json.color,
            width: json.width,
            style: json.style,
            lineCap: json.lineCap,
            lineJoin: json.lineJoin,
            dashPattern: json.dashPattern
        });
    }
}