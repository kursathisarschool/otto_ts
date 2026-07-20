/**
 * Geometry Library - Math Utilities
 *
 * Mathematical functions for geometry operations including trigonometry
 * (in degrees), interpolation, clamping, and floating-point comparisons.
 */

import {
    DEFAULT_EPSILON,
    DEFAULT_PRECISION,
    DEFAULT_TOLERANCE,
    DEGREES_PER_RADIAN,
    RADIANS_PER_DEGREE,
} from './constants.js';

// =============================================================================
// Trigonometric Functions (Degrees)
// =============================================================================

export const sin = (angle: number): number => Math.sin(angle * RADIANS_PER_DEGREE);
export const cos = (angle: number): number => Math.cos(angle * RADIANS_PER_DEGREE);
export const tan = (angle: number): number => Math.tan(angle * RADIANS_PER_DEGREE);
export const asin = (x: number): number => Math.asin(x) * DEGREES_PER_RADIAN;
export const acos = (x: number): number => Math.acos(x) * DEGREES_PER_RADIAN;
export const atan = (x: number): number => Math.atan(x) * DEGREES_PER_RADIAN;
export const atan2 = (y: number, x: number): number => Math.atan2(y, x) * DEGREES_PER_RADIAN;

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

export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

export const clamp = (x: number, minVal: number, maxVal: number): number => {
    return x < minVal ? minVal : x > maxVal ? maxVal : x;
};

export const saturate = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
    x = saturate((x - edge0) / (edge1 - edge0));
    return x * x * (3 - 2 * x);
};

// =============================================================================
// Modular Arithmetic
// =============================================================================

export const modulo = (x: number, base: number): number => {
    const result = x % base;
    return result < 0 ? result + base : result;
};

export const moduloDistance = (a: number, b: number, base: number): number => {
    const diff = Math.abs(b - a) % base;
    return diff > base / 2 ? base - diff : diff;
};

export const angularDistance = (a: number, b: number): number => {
    return moduloDistance(a, b, 360);
};

// =============================================================================
// Precision & Rounding
// =============================================================================

export const roundToFixed = (x: number, fractionDigits: number): number => {
    const scale = Math.pow(10, fractionDigits);
    return Math.round(x * scale) / scale;
};

// =============================================================================
// Floating-Point Comparison
// =============================================================================

export const equalWithinRelativeEpsilon = (a: number, b: number, epsilon: number = DEFAULT_EPSILON): boolean => {
    const d = Math.abs(b - a);
    a = Math.abs(a);
    b = Math.abs(b);
    return d <= Math.max(a, b) * epsilon;
};

export const equalWithinTolerance = (a: number, b: number, tolerance: number = DEFAULT_TOLERANCE): boolean => {
    return Math.abs(a - b) <= tolerance;
};

// =============================================================================
// String Formatting
// =============================================================================

export const limitedPrecisionStringForNumber = (x: number, minFractionDigits: number, maxFractionDigits: number): string => {
    const str = x.toFixed(maxFractionDigits);
    let len = str.length;
    let i = len;
    if (maxFractionDigits > 0) {
        for (let j = maxFractionDigits + 1; --j >= minFractionDigits && --i >= 0 && str[i] === '0'; );
        if (str[i] !== '.') i++;
    }
    return str.slice(0, i);
};

export const expressionCodeForNumber = (x: number, minFractionDigits: number = 0, maxFractionDigits: number = DEFAULT_PRECISION): string => {
    return limitedPrecisionStringForNumber(x, minFractionDigits, maxFractionDigits);
};