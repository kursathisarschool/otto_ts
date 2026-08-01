/**
 * @fileoverview Declarative property schemas for Otto shapes.
 * @module models/shapes/schema
 */
/**
 * Properties shared by every shape. Merged after each class's own SCHEMA.
 */
export const COMMON_SCHEMA = {
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
export function resolvePropertyValue(prop, desc, options) {
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
