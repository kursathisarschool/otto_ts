/**
 * @fileoverview Declarative property schemas for Otto shapes.
 * @module models/shapes/schema
 */

export interface PropertyDescriptor {
    type?: 'number' | 'boolean' | 'points' | 'segments' | 'handles';
    default?: any | ((options: any) => any);
    bindable?: boolean;
    translate?: 'x' | 'y';
    aliases?: string[];
    copy?: (value: any) => any;
    serialize?: (value: any) => any;
    alwaysSerialize?: boolean;
    omitIfDefault?: boolean;
    omitIfNull?: boolean;
    min?: number;
    max?: number;
    step?: number;
    label?: string;
    unit?: string;
}

export type Schema = Record<string, PropertyDescriptor>;

/**
 * Properties shared by every shape. Merged after each class's own SCHEMA.
 */
export const COMMON_SCHEMA: Schema = {
    rotation: {
        type: 'number',
        default: 0,
        bindable: true,
        omitIfDefault: true,
        label: 'Rotation',
        unit: 'deg',
        step: 1
    },
    depth: {
        type: 'number',
        default: 3,
        bindable: true,
        min: 0.5,
        omitIfDefault: true,
        label: 'Depth',
        unit: 'mm'
    },
    z: {
        type: 'number',
        default: 0,
        bindable: true,
        omitIfDefault: true,
        label: 'Elevation',
        unit: 'mm'
    }
};

/**
 * Resolve a property's value from constructor options: direct name first,
 * then aliases, then the descriptor default. null counts as absent so that
 * legacy call sites passing explicit nulls fall through to defaults.
 */
export function resolvePropertyValue(prop: string, desc: PropertyDescriptor, options: any): any {
    let value = options[prop];
    if (value == null && desc.aliases) {
        for (const alias of desc.aliases) {
            if (options[alias] != null) {
                value = options[alias];
                break;
            }
        }
    }
    if (value == null) {
        value = typeof desc.default === 'function' ? desc.default(options) : desc.default;
    }
    return value;
}