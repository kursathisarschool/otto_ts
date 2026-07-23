/**
 * Geometry Library - Units
 *
 * Unit conversion helpers for SVG import/export.
 */

/** Valid length units. */
export type Unit = 'in' | 'ft' | 'mm' | 'cm' | 'm' | 'px' | 'pc' | 'pt';

/** Human-friendly unit names. */
export type UnitName = 'inches' | 'feet' | 'millimeters' | 'centimeters' | 'meters' | 'pixels' | 'picas' | 'points';

export const units: Unit[] = ['in', 'ft', 'mm', 'cm', 'm', 'px', 'pc', 'pt'];

export const unitNames: Record<Unit, UnitName> = {
    in: 'inches',
    ft: 'feet',
    mm: 'millimeters',
    cm: 'centimeters',
    m: 'meters',
    px: 'pixels',
    pc: 'picas',
    pt: 'points'
};

export const unitScaleFactors: Record<Unit, number> = {
    in: 1,
    ft: 12,
    mm: 1 / 25.4,
    cm: 1 / 2.54,
    m: 1000 / 25.4,
    px: 1 / 96,
    pc: 1 / 6,
    pt: 1 / 72
};

/** Check if a unit string is valid. */
export const isValidUnit = (unit: string): unit is Unit => {
    return Object.prototype.hasOwnProperty.call(unitNames, unit);
};

/** Returns a scale factor to convert from sourceUnit to targetUnit. */
export const scaleFactorForUnitConversion = (sourceUnit: Unit, targetUnit: Unit): number => {
    return unitScaleFactors[sourceUnit] / unitScaleFactors[targetUnit];
};

/** Convert a unit name to a unit code. */
export const unitForUnitName = (unitName: UnitName): Unit => {
    for (let unit of units) {
        if (unitNames[unit] === unitName) return unit;
    }
    throw new Error(`Invalid unit name: ${unitName}`);
};