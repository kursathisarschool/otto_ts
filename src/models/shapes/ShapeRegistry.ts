/**
 * ShapeRegistry using Registry Pattern
 * @module models/shapes/ShapeRegistry
 */
import { Circle } from './Circle.js';
import { Line } from './Line.js';
import { Rectangle } from './Rectangle.js';
import { PathShape } from './PathShape.js';
import { Polygon } from './Polygon.js';
import { Star } from './Star.js';
import { Triangle } from './Triangle.js';
import { Ellipse } from './Ellipse.js';
import { Arc } from './Arc.js';
import { RoundedRectangle } from './RoundedRectangle.js';
import { Donut } from './Donut.js';
import { Cross } from './Cross.js';
import { Gear } from './Gear.js';
import { Spiral } from './Spiral.js';
import { Wave } from './Wave.js';
import { Slot } from './Slot.js';
import { Arrow } from './Arrow.js';
import { ChamferRectangle } from './ChamferRectangle.js';
import { createBindingFromJSON } from '../BindingRegistry.js';
import EventBus, { EVENTS } from '../../events/EventBus.js';
import type { Shape } from './Shape.js';

type CreateFunction = (id: string, position: { x: number; y: number }, options: any) => Shape;
type FromJSONFunction = (json: any) => Shape;

/** Shape registry entry. */
class ShapeRegistryEntry {
    create: CreateFunction;
    fromJSON: FromJSONFunction;

    constructor(createFunction: CreateFunction, fromJSONFunction: FromJSONFunction) {
        this.create = createFunction;
        this.fromJSON = fromJSONFunction;
    }
}

export class ShapeRegistry {
    static #registry: Map<string, ShapeRegistryEntry> = new Map();
    static #idCounters: Map<string, number> = new Map();
    static #initialized = false;

    static {
        [
            Circle, Line, Rectangle, PathShape, Polygon, Star, Triangle,
            Ellipse, Arc, RoundedRectangle, Donut, Cross, Gear, Spiral,
            Wave, Slot, Arrow, ChamferRectangle
        ].forEach(cls => this.registerClass(cls as any));
        this.#initialized = true;
    }

    /**
     * Register a schema-driven Shape subclass. The class must define
     * static type and extend Shape.
     */
    static registerClass(ShapeClass: typeof Shape & { type: string }): void {
        if (!ShapeClass || !ShapeClass.type) {
            throw new Error('registerClass requires a Shape subclass with a static type');
        }
        this.register(
            ShapeClass.type,
            (id: string, position: any, options: any) => new (ShapeClass as any)(id, { ...options, position }),
            (json: any) => (ShapeClass as any).fromJSON(json)
        );
    }

    /** Register a new shape type (Registry Pattern). */
    static register(type: string, createFunction: CreateFunction, fromJSONFunction: FromJSONFunction): void {
        if (!type || typeof type !== 'string') {
            throw new Error('Type must be a non-empty string');
        }
        if (typeof createFunction !== 'function') {
            throw new Error('createFunction must be a function');
        }
        if (typeof fromJSONFunction !== 'function') {
            throw new Error('fromJSONFunction must be a function');
        }

        const normalizedType = type.toLowerCase();
        this.#registry.set(normalizedType, new ShapeRegistryEntry(
            createFunction,
            fromJSONFunction
        ));
        this.#notifyRegistered(normalizedType);
    }

    /** Emit SHAPE_TYPE_REGISTERED so listeners (e.g. ShapeLibrary) refresh. */
    static #notifyRegistered(type: string): void {
        if (!this.#initialized) return;
        EventBus.emit(EVENTS.SHAPE_TYPE_REGISTERED, { type });
    }

    /** Unregister a shape type. */
    static unregister(type: string | (typeof Shape & { type: string })): void {
        const typeName = (typeof type === 'function' && (type as any).type) ? (type as any).type : type;
        if (!typeName || typeof typeName !== 'string') return;
        this.#registry.delete(typeName.toLowerCase());
    }

    /** Check if a shape type is registered. */
    static isRegistered(type: string): boolean {
        return this.#registry.has(type.toLowerCase());
    }

    /** Get available shape types. */
    static getAvailableTypes(): string[] {
        return Array.from(this.#registry.keys());
    }

    /** Create a shape by type (Registry Pattern - no switch statement!). */
    static create(type: string, position: { x: number; y: number } = { x: 0, y: 0 }, options: any = {}, shapeStore: any = null): Shape {
        const normalizedType = type.toLowerCase();
        const entry = this.#registry.get(normalizedType);

        if (!entry) {
            const available = Array.from(this.#registry.keys()).join(', ');
            throw new Error(
                `Unknown shape type: "${type}". ` +
                `Available types: ${available}. ` +
                `Use ShapeRegistry.register() to add new types.`
            );
        }

        const id = options.id || this.generateId(normalizedType, shapeStore);
        return entry.create(id, position, options);
    }

    /** Create shape from JSON (Registry Pattern - no switch statement!). */
    static fromJSON(json: any): Shape {
        if (!json || !json.type) {
            throw new Error('Invalid shape JSON: type is required');
        }

        const normalizedType = json.type.toLowerCase();
        const entry = this.#registry.get(normalizedType);

        if (!entry) {
            const available = Array.from(this.#registry.keys()).join(', ');
            throw new Error(
                `Unknown shape type: "${json.type}". ` +
                `Available types: ${available}.`
            );
        }

        const shape = entry.fromJSON(json);

        if (json.bindings) {
            Object.keys(json.bindings).forEach(property => {
                try {
                    const binding = createBindingFromJSON(json.bindings[property]);
                    shape.setBinding(property, binding);
                } catch (error) {
                    console.warn(`Failed to restore binding for ${property}:`, error);
                }
            });
        }

        return shape;
    }

    /** Generate a readable ID for a shape (e.g., "Circle 1", "Rectangle 2"). */
    static generateId(type: string, shapeStore: any = null): string {
        const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);

        let counter = this.#idCounters.get(type) || 0;

        if (shapeStore && typeof shapeStore.getAll === 'function') {
            const allShapes = shapeStore.getAll();
            const existingNumbers: number[] = [];

            allShapes.forEach((shape: Shape) => {
                if (shape.type === type) {
                    const match = shape.id.match(new RegExp(`^${capitalizedType}\\s+(\\d+)$`, 'i'));
                    if (match) {
                        existingNumbers.push(parseInt(match[1], 10));
                    }
                }
            });

            if (existingNumbers.length > 0) {
                counter = Math.max(...existingNumbers);
            }
        }

        counter++;
        this.#idCounters.set(type, counter);

        return `${capitalizedType} ${counter}`;
    }

    /** Reset ID counters. */
    static resetIdCounters(): void {
        this.#idCounters.clear();
    }
}