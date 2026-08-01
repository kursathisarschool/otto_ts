/**
 * Shape Decorators - Decorator Pattern Implementation
 * @module models/shapes/decorators
 */
import { ShadowDecorator } from './ShadowDecorator.js';
import { FillDecorator } from './FillDecorator.js';
import { BorderDecorator } from './BorderDecorator.js';
import type { Shape } from '../Shape.js';
import type { ShapeDecorator as ShapeDecoratorType } from './ShapeDecorator.js';

export { ShapeDecorator } from './ShapeDecorator.js';
export { ShadowDecorator } from './ShadowDecorator.js';
export { FillDecorator } from './FillDecorator.js';
export { BorderDecorator } from './BorderDecorator.js';

type DecoratorLoader = () => Promise<any>;

/**
 * DecoratorRegistry - Registry for decorator types
 * Enables restoring decorated shapes from JSON
 */
export class DecoratorRegistry {
    static #registry: Map<string, DecoratorLoader> = new Map();

    static {
        this.register('shadow', async () => {
            const { ShadowDecorator } = await import('./ShadowDecorator.js');
            return ShadowDecorator;
        });
        this.register('fill', async () => {
            const { FillDecorator } = await import('./FillDecorator.js');
            return FillDecorator;
        });
        this.register('border', async () => {
            const { BorderDecorator } = await import('./BorderDecorator.js');
            return BorderDecorator;
        });
    }

    /** Register a decorator type. */
    static register(type: string, loaderFn: DecoratorLoader): void {
        this.#registry.set(type, loaderFn);
    }

    /** Get a decorator class by type. */
    static async get(type: string): Promise<any> {
        const loader = this.#registry.get(type);
        if (!loader) {
            throw new Error(`Unknown decorator type: ${type}`);
        }
        return await loader();
    }

    /** Check if a decorator type is registered. */
    static isRegistered(type: string): boolean {
        return this.#registry.has(type);
    }

    /** Get all registered decorator types. */
    static getAvailableTypes(): string[] {
        return Array.from(this.#registry.keys());
    }

    /** Apply decorators to a shape from JSON. */
    static async applyFromJSON(shape: Shape | ShapeDecoratorType, decorators: any[]): Promise<Shape | ShapeDecoratorType> {
        if (!decorators || !Array.isArray(decorators)) {
            return shape;
        }

        let decoratedShape = shape;

        for (const decoratorJson of decorators) {
            const DecoratorClass = await this.get(decoratorJson.type);
            decoratedShape = DecoratorClass.fromJSON(decoratedShape, decoratorJson);
        }

        return decoratedShape;
    }
}

/**
 * Helper function to create a decorated shape with fluent API.
 */
export function decorate(shape: Shape | ShapeDecoratorType): DecoratorBuilder {
    return new DecoratorBuilder(shape);
}

class DecoratorBuilder {
    shape: Shape | ShapeDecoratorType;

    constructor(shape: Shape | ShapeDecoratorType) {
        this.shape = shape;
    }

    withShadow(options: any = {}): this {
        this.shape = new ShadowDecorator(this.shape, options);
        return this;
    }

    withFill(options: any = {}): this {
        this.shape = new FillDecorator(this.shape, options);
        return this;
    }

    withBorder(options: any = {}): this {
        this.shape = new BorderDecorator(this.shape, options);
        return this;
    }

    build(): Shape | ShapeDecoratorType {
        return this.shape;
    }
}