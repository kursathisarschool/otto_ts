/**
 * Shape Decorators - Decorator Pattern Implementation
 *
 * Provides composable visual effects for shapes without modifying shape classes.
 *
 * Example usage:
 * ```javascript
 * import { ShadowDecorator, FillDecorator, BorderDecorator } from './decorators';
 *
 * // Stack multiple decorators
 * let shape = new Circle(...);
 * shape = new FillDecorator(shape, { color: '#3498db' });
 * shape = new BorderDecorator(shape, { color: '#2980b9', width: 2 });
 * shape = new ShadowDecorator(shape, { blur: 10, offsetX: 5, offsetY: 5 });
 *
 * // Render - all effects are applied
 * shape.render(ctx);
 * ```
 */
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _a, _DecoratorRegistry_registry;
export { ShapeDecorator } from './ShapeDecorator.js';
export { ShadowDecorator } from './ShadowDecorator.js';
export { FillDecorator } from './FillDecorator.js';
export { BorderDecorator } from './BorderDecorator.js';
/**
 * DecoratorRegistry - Registry for decorator types
 * Enables restoring decorated shapes from JSON
 */
export class DecoratorRegistry {
    /**
     * Register a decorator type
     * @param {string} type - Decorator type identifier
     * @param {Function} loaderFn - Async function that returns the decorator class
     */
    static register(type, loaderFn) {
        __classPrivateFieldGet(this, _a, "f", _DecoratorRegistry_registry).set(type, loaderFn);
    }
    /**
     * Get a decorator class by type
     * @param {string} type
     * @returns {Promise<Class>}
     */
    static async get(type) {
        const loader = __classPrivateFieldGet(this, _a, "f", _DecoratorRegistry_registry).get(type);
        if (!loader) {
            throw new Error(`Unknown decorator type: ${type}`);
        }
        return await loader();
    }
    /**
     * Check if a decorator type is registered
     * @param {string} type
     * @returns {boolean}
     */
    static isRegistered(type) {
        return __classPrivateFieldGet(this, _a, "f", _DecoratorRegistry_registry).has(type);
    }
    /**
     * Get all registered decorator types
     * @returns {Array<string>}
     */
    static getAvailableTypes() {
        return Array.from(__classPrivateFieldGet(this, _a, "f", _DecoratorRegistry_registry).keys());
    }
    /**
     * Apply decorators to a shape from JSON
     * @param {Shape} shape - Base shape
     * @param {Array<Object>} decorators - Array of decorator JSON configs
     * @returns {Promise<Shape>} - Decorated shape
     */
    static async applyFromJSON(shape, decorators) {
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
_a = DecoratorRegistry;
_DecoratorRegistry_registry = { value: new Map() };
(() => {
    // Register built-in decorators
    _a.register('shadow', async () => {
        const { ShadowDecorator } = await import('./ShadowDecorator.js');
        return ShadowDecorator;
    });
    _a.register('fill', async () => {
        const { FillDecorator } = await import('./FillDecorator.js');
        return FillDecorator;
    });
    _a.register('border', async () => {
        const { BorderDecorator } = await import('./BorderDecorator.js');
        return BorderDecorator;
    });
})();
/**
 * Helper function to create a decorated shape with fluent API
 *
 * Usage:
 * const decoratedCircle = decorate(circle)
 *     .withFill({ color: '#3498db' })
 *     .withBorder({ color: '#2980b9', width: 2 })
 *     .withShadow({ blur: 10 })
 *     .build();
 */
export function decorate(shape) {
    return new DecoratorBuilder(shape);
}
class DecoratorBuilder {
    constructor(shape) {
        this.shape = shape;
    }
    withShadow(options = {}) {
        const { ShadowDecorator } = require('./ShadowDecorator.js');
        this.shape = new ShadowDecorator(this.shape, options);
        return this;
    }
    withFill(options = {}) {
        const { FillDecorator } = require('./FillDecorator.js');
        this.shape = new FillDecorator(this.shape, options);
        return this;
    }
    withBorder(options = {}) {
        const { BorderDecorator } = require('./BorderDecorator.js');
        this.shape = new BorderDecorator(this.shape, options);
        return this;
    }
    build() {
        return this.shape;
    }
}
