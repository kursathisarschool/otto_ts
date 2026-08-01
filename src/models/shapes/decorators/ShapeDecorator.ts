import type { Shape } from '../Shape.js';
import type { Binding } from '../../Binding.js';

/**
 * ShapeDecorator - Base Decorator Pattern Implementation
 *
 * Wraps a shape to add visual effects without modifying the original shape class.
 */
export class ShapeDecorator {
    wrappedShape: Shape | ShapeDecorator;

    constructor(shape: Shape | ShapeDecorator) {
        if (!shape) {
            throw new Error('ShapeDecorator requires a shape to wrap');
        }
        this.wrappedShape = shape;
    }

    getBaseShape(): Shape {
        if (this.wrappedShape instanceof ShapeDecorator) {
            return this.wrappedShape.getBaseShape();
        }
        return this.wrappedShape;
    }

    getWrappedShape(): Shape | ShapeDecorator {
        return this.wrappedShape;
    }

    get id(): string {
        return this.wrappedShape.id;
    }

    get type(): string {
        return this.wrappedShape.type;
    }

    get position(): { x: number; y: number } {
        return this.wrappedShape.position;
    }

    set position(value: { x: number; y: number }) {
        this.wrappedShape.position = value;
    }

    get bindings(): Record<string, Binding> {
        return this.wrappedShape.bindings;
    }

    getBindableProperties(): string[] {
        return this.wrappedShape.getBindableProperties();
    }

    getBounds(): any {
        return this.wrappedShape.getBounds();
    }

    containsPoint(x: number, y: number): boolean {
        return this.wrappedShape.containsPoint(x, y);
    }

    render(ctx: CanvasRenderingContext2D): void {
        this.wrappedShape.render(ctx);
    }

    renderBefore(ctx: CanvasRenderingContext2D): void {
        // Override in subclasses
    }

    renderAfter(ctx: CanvasRenderingContext2D): void {
        // Override in subclasses
    }

    resolve(parameterStore: any, bindingResolver: any): ShapeDecorator {
        const resolvedShape = this.wrappedShape.resolve(parameterStore, bindingResolver);
        return this.cloneWithShape(resolvedShape);
    }

    clone(): ShapeDecorator {
        const clonedShape = this.wrappedShape.clone();
        return this.cloneWithShape(clonedShape);
    }

    /**
     * Create a new decorator of the same type wrapping a different shape.
     * Subclasses must override this to preserve their specific properties.
     */
    cloneWithShape(newShape: Shape | ShapeDecorator): ShapeDecorator {
        return new ShapeDecorator(newShape);
    }

    setBinding(property: string, binding: Binding): void {
        this.wrappedShape.setBinding(property, binding);
    }

    getBinding(property: string): Binding | null {
        return this.wrappedShape.getBinding(property);
    }

    toJSON(): any {
        const json = this.wrappedShape.toJSON();
        json.decorators = json.decorators || [];
        json.decorators.push(this.getDecoratorJSON());
        return json;
    }

    getDecoratorJSON(): { type: string } {
        return {
            type: 'base'
        };
    }

    hasDecorator(decoratorType: string): boolean {
        if (this.getDecoratorJSON().type === decoratorType) {
            return true;
        }
        if (this.wrappedShape instanceof ShapeDecorator) {
            return this.wrappedShape.hasDecorator(decoratorType);
        }
        return false;
    }

    removeDecorator(decoratorType: string): Shape | ShapeDecorator {
        if (this.getDecoratorJSON().type === decoratorType) {
            return this.wrappedShape;
        }
        if (this.wrappedShape instanceof ShapeDecorator) {
            const newWrapped = this.wrappedShape.removeDecorator(decoratorType);
            return this.cloneWithShape(newWrapped);
        }
        return this;
    }
}