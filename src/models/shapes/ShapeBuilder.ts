import { ShapeRegistry } from './ShapeRegistry.js';
import type { Shape } from './Shape.js';
import type { Binding } from '../Binding.js';

interface Decorator {
    type: string;
    options: any;
}

/**
 * ShapeBuilder - Builder Pattern Implementation
 *
 * Provides fluent API for complex shape construction with validation.
 */
export class ShapeBuilder {
    _type: string;
    _id: string | null;
    _position: { x: number; y: number };
    _properties: Record<string, any>;
    _bindings: Record<string, Binding>;
    _decorators: Decorator[];

    constructor(type: string) {
        if (!type) {
            throw new Error('ShapeBuilder requires a shape type');
        }

        this._type = type.toLowerCase();
        this._id = null;
        this._position = { x: 0, y: 0 };
        this._properties = {};
        this._bindings = {};
        this._decorators = [];
    }

    /** Set custom ID for the shape. */
    withId(id: string): this {
        this._id = id;
        return this;
    }

    /** Set position of the shape. */
    at(x: number, y: number): this {
        this._position = { x, y };
        return this;
    }

    /** Set position using an object. */
    atPosition(position: { x: number; y: number }): this {
        this._position = { ...position };
        return this;
    }

    /** Set a property value. */
    withProperty(name: string, value: any): this {
        this._properties[name] = value;
        return this;
    }

    /** Set multiple properties at once. */
    withProperties(properties: Record<string, any>): this {
        Object.assign(this._properties, properties);
        return this;
    }

    /** Set a binding for a property. */
    withBinding(property: string, binding: Binding): this {
        this._bindings[property] = binding;
        return this;
    }

    /** Set multiple bindings at once. */
    withBindings(bindings: Record<string, Binding>): this {
        Object.assign(this._bindings, bindings);
        return this;
    }

    /** Add a decorator to be applied after building. */
    withDecorator(type: string, options: any = {}): this {
        this._decorators.push({ type, options });
        return this;
    }

    /** Add shadow decorator. */
    withShadow(options: any = {}): this {
        return this.withDecorator('shadow', options);
    }

    /** Add fill decorator. */
    withFill(options: any = {}): this {
        return this.withDecorator('fill', options);
    }

    /** Add border decorator. */
    withBorder(options: any = {}): this {
        return this.withDecorator('border', options);
    }

    /** Set circle-specific properties. */
    asCircle(centerX: number, centerY: number, radius: number): this {
        this._type = 'circle';
        return this.withProperties({ centerX, centerY, radius });
    }

    /** Set rectangle-specific properties. */
    asRectangle(x: number, y: number, width: number, height: number): this {
        this._type = 'rectangle';
        return this.withProperties({ x, y, width, height });
    }

    /** Validate the builder configuration. */
    validate(): string[] {
        const errors: string[] = [];

        if (!ShapeRegistry.isRegistered(this._type)) {
            errors.push(`Unknown shape type: "${this._type}". Available types: ${ShapeRegistry.getAvailableTypes().join(', ')}`);
        }

        if (this._type === 'circle') {
            if (this._properties.radius !== undefined && this._properties.radius <= 0) {
                errors.push('Circle radius must be positive');
            }
        }

        if (this._type === 'rectangle') {
            if (this._properties.width !== undefined && this._properties.width <= 0) {
                errors.push('Rectangle width must be positive');
            }
            if (this._properties.height !== undefined && this._properties.height <= 0) {
                errors.push('Rectangle height must be positive');
            }
        }

        return errors;
    }

    /** Build the shape with all configured options. */
    async build(): Promise<Shape> {
        const errors = this.validate();
        if (errors.length > 0) {
            throw new Error(`ShapeBuilder validation failed:\n- ${errors.join('\n- ')}`);
        }

        const options = {
            ...this._properties,
            id: this._id
        };

        let shape = ShapeRegistry.create(this._type, this._position, options);

        for (const [property, binding] of Object.entries(this._bindings)) {
            shape.setBinding(property, binding);
        }

        if (this._decorators.length > 0) {
            shape = await this.applyDecorators(shape);
        }

        return shape;
    }

    /** Build synchronously (without decorators). */
    buildSync(): Shape {
        const errors = this.validate();
        if (errors.length > 0) {
            throw new Error(`ShapeBuilder validation failed:\n- ${errors.join('\n- ')}`);
        }

        const options = {
            ...this._properties,
            id: this._id
        };

        const shape = ShapeRegistry.create(this._type, this._position, options);

        for (const [property, binding] of Object.entries(this._bindings)) {
            shape.setBinding(property, binding);
        }

        if (this._decorators.length > 0) {
            console.warn('ShapeBuilder.buildSync() does not apply decorators. Use build() instead.');
        }

        return shape;
    }

    /** Apply decorators to the shape. */
    async applyDecorators(shape: Shape): Promise<Shape> {
        let decoratedShape = shape;

        for (const { type, options } of this._decorators) {
            const DecoratorClass = await this.getDecoratorClass(type);
            decoratedShape = new DecoratorClass(decoratedShape, options);
        }

        return decoratedShape;
    }

    /** Get decorator class by type. */
    async getDecoratorClass(type: string): Promise<any> {
        switch (type) {
            case 'shadow': {
                const { ShadowDecorator } = await import('./decorators/ShadowDecorator.js');
                return ShadowDecorator;
            }
            case 'fill': {
                const { FillDecorator } = await import('./decorators/FillDecorator.js');
                return FillDecorator;
            }
            case 'border': {
                const { BorderDecorator } = await import('./decorators/BorderDecorator.js');
                return BorderDecorator;
            }
            default:
                throw new Error(`Unknown decorator type: ${type}`);
        }
    }

    /** Create a copy of this builder. */
    clone(): ShapeBuilder {
        const cloned = new ShapeBuilder(this._type);
        cloned._id = this._id;
        cloned._position = { ...this._position };
        cloned._properties = { ...this._properties };
        cloned._bindings = { ...this._bindings };
        cloned._decorators = [...this._decorators];
        return cloned;
    }

    /** Reset the builder to initial state. */
    reset(): this {
        this._id = null;
        this._position = { x: 0, y: 0 };
        this._properties = {};
        this._bindings = {};
        this._decorators = [];
        return this;
    }
}

/** Convenience function to create a ShapeBuilder. */
export function shape(type: string): ShapeBuilder {
    return new ShapeBuilder(type);
}

/** Convenience functions for common shapes. */
export function circle(): ShapeBuilder {
    return new ShapeBuilder('circle');
}

export function rectangle(): ShapeBuilder {
    return new ShapeBuilder('rectangle');
}