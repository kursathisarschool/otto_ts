/**
 * Geometry Library - Units
 *
 * Unit conversion helpers for SVG import/export.
 */
export const units = ['in', 'ft', 'mm', 'cm', 'm', 'px', 'pc', 'pt'];
export const unitNames = {
    in: 'inches',
    ft: 'feet',
    mm: 'millimeters',
    cm: 'centimeters',
    m: 'meters',
    px: 'pixels',
    pc: 'picas',
    pt: 'points'
};
export const unitScaleFactors = {
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
export const isValidUnit = (unit) => {
    return Object.prototype.hasOwnProperty.call(unitNames, unit);
};
/** Returns a scale factor to convert from sourceUnit to targetUnit. */
export const scaleFactorForUnitConversion = (sourceUnit, targetUnit) => {
    return unitScaleFactors[sourceUnit] / unitScaleFactors[targetUnit];
};
/** Convert a unit name to a unit code. */
export const unitForUnitName = (unitName) => {
    for (let unit of units) {
        if (unitNames[unit] === unitName)
            return unit;
    }
    throw new Error(`Invalid unit name: ${unitName}`);
};
