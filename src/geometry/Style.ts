/**
 * Geometry Library - Style
 *
 * Stroke and Fill classes for styling geometry.
 */

import { Color } from './Color.js';

/** Valid stroke alignment values. */
export type StrokeAlignment = 'centered' | 'inner' | 'outer';

/** Valid stroke cap values. */
export type StrokeCap = 'butt' | 'round' | 'square';

/** Valid stroke join values. */
export type StrokeJoin = 'miter' | 'round' | 'bevel';

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
    static displayName = 'Stroke';

    color: Color;
    hairline: boolean;
    width: number;
    alignment: StrokeAlignment;
    cap: StrokeCap;
    join: StrokeJoin;
    miterLimit: number;

    constructor(
        color: Color = new Color(),
        hairline: boolean = true,
        width: number = 0.1,
        alignment: StrokeAlignment = 'centered',
        cap: StrokeCap = 'butt',
        join: StrokeJoin = 'miter',
        miterLimit: number = 4
    ) {
        this.color = color;
        this.hairline = hairline;
        this.width = width;
        this.alignment = alignment;
        this.cap = cap;
        this.join = join;
        this.miterLimit = miterLimit;
    }

    /** Create a copy of this stroke. */
    clone(): Stroke {
        return new Stroke(
            this.color.clone(),
            this.hairline,
            this.width,
            this.alignment,
            this.cap,
            this.join,
            this.miterLimit
        );
    }

    /** Check if a value is a valid stroke alignment. */
    static isValidAlignment(alignment: unknown): alignment is StrokeAlignment {
        return alignment === 'centered' || alignment === 'inner' || alignment === 'outer';
    }

    /** Check if a value is a valid stroke cap. */
    static isValidCap(cap: unknown): cap is StrokeCap {
        return cap === 'butt' || cap === 'round' || cap === 'square';
    }

    /** Check if a value is a valid stroke join. */
    static isValidJoin(join: unknown): join is StrokeJoin {
        return join === 'miter' || join === 'round' || join === 'bevel';
    }

    /** Validate that value is a valid Stroke. */
    static isValid(stroke: unknown): stroke is Stroke {
        return (
            stroke instanceof Stroke &&
            Color.isValid(stroke.color) &&
            typeof stroke.hairline === 'boolean' &&
            typeof stroke.width === 'number' &&
            typeof stroke.miterLimit === 'number' &&
            Stroke.isValidAlignment(stroke.alignment) &&
            Stroke.isValidCap(stroke.cap) &&
            Stroke.isValidJoin(stroke.join)
        );
    }
}

/**
 * Fill style for geometry.
 *
 * @example
 * const fill = new Fill(new Color(0, 0, 1)); // Blue fill
 */
export class Fill {
    static displayName = 'Fill';

    color: Color;

    constructor(color: Color = new Color(0, 0, 0, 1)) {
        this.color = color;
    }

    /** Create a copy of this fill. */
    clone(): Fill {
        return new Fill(this.color.clone());
    }

    /** Validate that value is a valid Fill. */
    static isValid(fill: unknown): fill is Fill {
        return fill instanceof Fill && Color.isValid(fill.color);
    }
}