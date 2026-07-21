/**
 * Geometry Library - Style
 *
 * Stroke and Fill classes for styling geometry.
 */
import { Color } from './Color.js';
/**
 * Stroke style for geometry outlines.
 *
 * @example
 * const stroke = new Stroke(new Color(1, 0, 0), false, 2);
 * // Red stroke, 2 units wide
 *
 * @example
 * const hairline = new Stroke(new Color(0, 0, 0), true);
 * // Black hairline stroke (width depends on zoom)
 */
export class Stroke {
    constructor(color = new Color(), hairline = true, width = 0.1, alignment = 'centered', cap = 'butt', join = 'miter', miterLimit = 4) {
        this.color = color;
        this.hairline = hairline;
        this.width = width;
        this.alignment = alignment;
        this.cap = cap;
        this.join = join;
        this.miterLimit = miterLimit;
    }
    /** Create a copy of this stroke. */
    clone() {
        return new Stroke(this.color.clone(), this.hairline, this.width, this.alignment, this.cap, this.join, this.miterLimit);
    }
    /** Check if a value is a valid stroke alignment. */
    static isValidAlignment(alignment) {
        return alignment === 'centered' || alignment === 'inner' || alignment === 'outer';
    }
    /** Check if a value is a valid stroke cap. */
    static isValidCap(cap) {
        return cap === 'butt' || cap === 'round' || cap === 'square';
    }
    /** Check if a value is a valid stroke join. */
    static isValidJoin(join) {
        return join === 'miter' || join === 'round' || join === 'bevel';
    }
    /** Validate that value is a valid Stroke. */
    static isValid(stroke) {
        return (stroke instanceof Stroke &&
            Color.isValid(stroke.color) &&
            typeof stroke.hairline === 'boolean' &&
            typeof stroke.width === 'number' &&
            typeof stroke.miterLimit === 'number' &&
            Stroke.isValidAlignment(stroke.alignment) &&
            Stroke.isValidCap(stroke.cap) &&
            Stroke.isValidJoin(stroke.join));
    }
}
Stroke.displayName = 'Stroke';
/**
 * Fill style for geometry.
 *
 * @example
 * const fill = new Fill(new Color(0, 0, 1)); // Blue fill
 */
export class Fill {
    constructor(color = new Color(0, 0, 0, 1)) {
        this.color = color;
    }
    /** Create a copy of this fill. */
    clone() {
        return new Fill(this.color.clone());
    }
    /** Validate that value is a valid Fill. */
    static isValid(fill) {
        return fill instanceof Fill && Color.isValid(fill.color);
    }
}
Fill.displayName = 'Fill';
