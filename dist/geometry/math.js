/**
 * Geometry Library - Math Utilities
 *
 * Mathematical functions for geometry operations including trigonometry
 * (in degrees), interpolation, clamping, and floating-point comparisons.
 */
import { DEFAULT_EPSILON, DEFAULT_PRECISION, DEFAULT_TOLERANCE, DEGREES_PER_RADIAN, RADIANS_PER_DEGREE, } from './constants.js';
// =============================================================================
// Trigonometric Functions (Degrees)
// =============================================================================
export const sin = (angle) => Math.sin(angle * RADIANS_PER_DEGREE);
export const cos = (angle) => Math.cos(angle * RADIANS_PER_DEGREE);
export const tan = (angle) => Math.tan(angle * RADIANS_PER_DEGREE);
export const asin = (x) => Math.asin(x) * DEGREES_PER_RADIAN;
export const acos = (x) => Math.acos(x) * DEGREES_PER_RADIAN;
export const atan = (x) => Math.atan(x) * DEGREES_PER_RADIAN;
export const atan2 = (y, x) => Math.atan2(y, x) * DEGREES_PER_RADIAN;
// =============================================================================
// Pass-through Math Functions
// =============================================================================
export const sqrt = Math.sqrt;
export const abs = Math.abs;
export const max = Math.max;
export const min = Math.min;
// =============================================================================
// Interpolation Functions
// =============================================================================
export const mix = (a, b, t) => a + (b - a) * t;
export const clamp = (x, minVal, maxVal) => {
    return x < minVal ? minVal : x > maxVal ? maxVal : x;
};
export const saturate = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smoothstep = (edge0, edge1, x) => {
    x = saturate((x - edge0) / (edge1 - edge0));
    return x * x * (3 - 2 * x);
};
// =============================================================================
// Modular Arithmetic
// =============================================================================
export const modulo = (x, base) => {
    const result = x % base;
    return result < 0 ? result + base : result;
};
export const moduloDistance = (a, b, base) => {
    const diff = Math.abs(b - a) % base;
    return diff > base / 2 ? base - diff : diff;
};
export const angularDistance = (a, b) => {
    return moduloDistance(a, b, 360);
};
// =============================================================================
// Precision & Rounding
// =============================================================================
export const roundToFixed = (x, fractionDigits) => {
    const scale = Math.pow(10, fractionDigits);
    return Math.round(x * scale) / scale;
};
// =============================================================================
// Floating-Point Comparison
// =============================================================================
export const equalWithinRelativeEpsilon = (a, b, epsilon = DEFAULT_EPSILON) => {
    const d = Math.abs(b - a);
    a = Math.abs(a);
    b = Math.abs(b);
    return d <= Math.max(a, b) * epsilon;
};
export const equalWithinTolerance = (a, b, tolerance = DEFAULT_TOLERANCE) => {
    return Math.abs(a - b) <= tolerance;
};
// =============================================================================
// String Formatting
// =============================================================================
export const limitedPrecisionStringForNumber = (x, minFractionDigits, maxFractionDigits) => {
    const str = x.toFixed(maxFractionDigits);
    let len = str.length;
    let i = len;
    if (maxFractionDigits > 0) {
        for (let j = maxFractionDigits + 1; --j >= minFractionDigits && --i >= 0 && str[i] === '0';)
            ;
        if (str[i] !== '.')
            i++;
    }
    return str.slice(0, i);
};
export const expressionCodeForNumber = (x, minFractionDigits = 0, maxFractionDigits = DEFAULT_PRECISION) => {
    return limitedPrecisionStringForNumber(x, minFractionDigits, maxFractionDigits);
};
