/**
 * @fileoverview Abstract base class for every shape in the Otto parametric
 * design system.
 * @module models/shapes/Shape
 */
import { COMMON_SCHEMA, resolvePropertyValue, type Schema, type PropertyDescriptor } from './schema.js';
import type { Binding } from '../Binding.js';

export interface ShapeOptions {
    position?: { x: number; y: number };
    [key: string]: any;
}

export interface Bounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Abstract base class for all Otto shapes.
 * @abstract
 */
export class Shape {
    /** Registered type key (e.g. 'circle'). Concrete classes MUST override. */
    static type: string | null = null;

    /** Property descriptors for this class. Concrete classes override. */
    static SCHEMA: Schema = {};

    private static _fullSchema: Schema;

    /** Merged schema: the class's own SCHEMA first, then the common properties. Cached per class. */
    static get fullSchema(): Schema {
        if (!Object.prototype.hasOwnProperty.call(this, '_fullSchema')) {
            this._fullSchema = Object.freeze({ ...this.SCHEMA, ...COMMON_SCHEMA });
        }
        return this._fullSchema;
    }

    /** Unique, human-readable identifier (e.g. "Circle 3"). */
    id: string;
    /** Registered type key matching the ShapeRegistry entry. */
    type: string;
    /** Legacy position; shallow-copied to avoid shared references. */
    position: { x: number; y: number };
    /** Map from bindable property name to its active Binding object. */
    bindings: Record<string, Binding>;
    [key: string]: any;

    constructor(id: string, options: ShapeOptions = {}) {
        if (this.constructor === Shape) {
            throw new Error('Shape is an abstract class and cannot be instantiated directly');
        }
        const ctor = this.constructor as typeof Shape;
        if (!ctor.type) {
            throw new Error(`${ctor.name} must define a static type`);
        }
        this.id = id;
        this.type = ctor.type;
        this.position = { ...(options.position ?? { x: 0, y: 0 }) };
        this.bindings = {};

        for (const [prop, desc] of Object.entries(ctor.fullSchema)) {
            const value = resolvePropertyValue(prop, desc, options);
            this[prop] = desc.copy ? desc.copy(value) : value;
        }
    }

    /** Property names that can be driven by parameter bindings, in schema declaration order. */
    getBindableProperties(): string[] {
        const schema = (this.constructor as typeof Shape).fullSchema;
        return Object.keys(schema).filter(prop => schema[prop].bindable);
    }

    /** Look up the PropertyDescriptor for a property. */
    getPropertyDescriptor(property: string): PropertyDescriptor | null {
        return (this.constructor as typeof Shape).fullSchema[property] ?? null;
    }

    /**
     * Template Method — produce a fully-resolved copy of this shape with all
     * parameter bindings evaluated to their current values.
     */
    resolve(parameterStore: any, bindingResolver: any): Shape {
        const resolved = this.clone();

        this.getBindableProperties().forEach(property => {
            const binding = this.bindings[property];
            if (binding && bindingResolver) {
                resolved[property] = bindingResolver.resolveValue(binding);
            } else if (this[property] !== undefined) {
                resolved[property] = this[property];
            }
        });

        return resolved;
    }

    /** Compute the axis-aligned bounding box that encloses this shape. */
    getBounds(): Bounds {
        throw new Error('getBounds() must be implemented by subclass');
    }

    /** Whether the canvas-space point lies inside (or on the stroke of) this shape. */
    containsPoint(x: number, y: number): boolean {
        throw new Error('containsPoint() must be implemented by subclass');
    }

    /** Draw this shape onto the given 2D canvas rendering context. */
    render(ctx: CanvasRenderingContext2D): void {
        throw new Error('render() must be implemented by subclass');
    }

    /** Snapshot every schema property (plus position) into a plain options bag. */
    toOptions(): ShapeOptions {
        const options: ShapeOptions = { position: { ...this.position } };
        for (const [prop, desc] of Object.entries((this.constructor as typeof Shape).fullSchema)) {
            options[prop] = desc.copy ? desc.copy(this[prop]) : this[prop];
        }
        return options;
    }

    /** Deep-copy this shape, including all current property values AND all active bindings. */
    clone(): Shape {
        const ctor = this.constructor as new (id: string, options: ShapeOptions) => Shape;
        const copy = new ctor(this.id, this.toOptions());
        for (const property of Object.keys(this.bindings)) {
            copy.setBinding(property, this.bindings[property]);
        }
        return copy;
    }

    /** Shift this shape by (dx, dy): every schema property with a translate role moves accordingly. */
    translate(dx: number, dy: number): this {
        for (const [prop, desc] of Object.entries((this.constructor as typeof Shape).fullSchema)) {
            if (desc.translate === 'x') {
                this[prop] += dx;
            } else if (desc.translate === 'y') {
                this[prop] += dy;
            }
        }
        return this;
    }

    /** Attach a parameter Binding to a bindable property. */
    setBinding(property: string, binding: Binding): void {
        if (!this.getBindableProperties().includes(property)) {
            throw new Error(`Property ${property} is not bindable for ${this.type}`);
        }
        this.bindings[property] = binding;
    }

    /** The active Binding for a property, or null if it uses its literal value. */
    getBinding(property: string): Binding | null {
        return this.bindings[property] || null;
    }

    /** Serialize this shape into a plain JSON-safe object. */
    toJSON(): any {
        const json: any = {
            id: this.id,
            type: this.type,
            position: { ...this.position },
            bindings: {} as Record<string, any>
        };

        Object.keys(this.bindings).forEach(property => {
            json.bindings[property] = this.bindings[property].toJSON();
        });

        for (const [prop, desc] of Object.entries((this.constructor as typeof Shape).fullSchema)) {
            const value = this[prop];
            if (value === undefined) {
                continue;
            }
            if (this.bindings[prop] && !desc.alwaysSerialize) {
                continue;
            }
            if (desc.omitIfDefault && typeof desc.default !== 'function' && value === desc.default) {
                continue;
            }
            if (desc.omitIfNull && value == null) {
                continue;
            }
            json[prop] = desc.serialize ? desc.serialize(value) : value;
        }

        return json;
    }

    /** Reconstruct a shape of this concrete class from its serialized JSON. */
    static fromJSON(json: any): Shape {
        if (this === Shape) {
            throw new Error('Use ShapeRegistry.fromJSON() instead');
        }
        return new (this as any)(json.id, json);
    }
}