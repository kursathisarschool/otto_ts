/**
 * @fileoverview N-pointed star, constructed by alternating between an outer and an inner
 * radius as the vertices are walked around the centre.
 *
 * A star with P points has 2*P vertices in total: one outer tip and one inner valley per
 * point.  The point count is clamped to a minimum of 3 inside toGeometryPath() (a
 * 2-pointed star degenerates into a line).  Like Polygon, the first vertex starts at
 * angle -PI/2 so that the top tip points straight up.
 *
 * The visual appearance of a star is controlled by the ratio outerRadius / innerRadius.
 * A ratio close to 1 produces a nearly-circular shape; a very small innerRadius relative
 * to outerRadius produces thin, spiky points.  Both radii are independently bindable, so
 * users can animate either or both via parameter sliders.
 *
 * @module models/shapes/Star
 */
import { type Schema } from './schema.js';
import { Bounds, Shape } from './Shape.js';
import {
    BoundingBox,
    Color as GeoColor,
    Fill as GeoFill,
    Path as GeoPath,
    Vec as GeoVec,
    styleContainsPoint
} from '../../geometry/index.js';

/**
 * Opaque black fill for hit-testing.  See Circle.js for full explanation.
 * @type {import('../../geometry/index.js').Fill}
 * @constant
 * @private
 */
const HIT_TEST_FILL: GeoFill = new GeoFill(new GeoColor(0, 0, 0, 1));

/**
 * N-pointed star shape.
 *
 * Bindable properties: {@code centerX}, {@code centerY}, {@code outerRadius},
 * {@code innerRadius}, {@code points}.
 *
 * @extends Shape
 */
export class Star extends Shape {
    static type = 'star';

    static SCHEMA: Schema = {
        centerX: { type: 'number', default: (o) => o.position?.x ?? 0, bindable: true, translate: 'x', label: 'Center X' },
        centerY: { type: 'number', default: (o) => o.position?.y ?? 0, bindable: true, translate: 'y', label: 'Center Y' },
        outerRadius: { type: 'number', default: 20, bindable: true, min: 0, label: 'Outer Radius', aliases: ['outer_radius'] },
        innerRadius: { type: 'number', default: 10, bindable: true, min: 0, label: 'Inner Radius', aliases: ['inner_radius'] },
        points: { type: 'number', default: 5, bindable: true, min: 3, step: 1, label: 'Points' }
    };

    /**
     * Compute the AABB by delegating to the geometry path.
     * @returns {{x: number, y: number, width: number, height: number}}
     */
    getBounds():Bounds {
        const path:GeoPath = this.toGeometryPath();
        const box: BoundingBox = path.tightBoundingBox() || path.looseBoundingBox();
        if (!box) {
            return { x: 0, y: 0, width: 0, height: 0 };
        }
        return {
            x: box.min.x,
            y: box.min.y,
            width: box.width(),
            height: box.height()
        };
    }

    /**
     * Test whether (x, y) is inside the star using a fill-based hit test.
     *
     * @param {number} x - X coordinate to test.
     * @param {number} y - Y coordinate to test.
     * @returns {boolean} True if the point is inside or on the star boundary.
     */
    containsPoint(x: number, y: number): boolean {
        const path:GeoPath = this.toGeometryPath();
        path.assignFill(HIT_TEST_FILL);
        return styleContainsPoint(path, new GeoVec(x, y));
    }

    /**
     * Render the star outline onto the canvas.
     * @param {CanvasRenderingContext2D} ctx - The Otto canvas 2D context.
     */
    render(ctx: CanvasRenderingContext2D):void {
        const path:GeoPath = this.toGeometryPath();
        ctx.beginPath();
        path.toCanvasPath(ctx);
        ctx.stroke();
    }

    /**
     * Build the geometry-library Path by generating 2*P vertices that alternate
     * between outerRadius (tips) and innerRadius (valleys).
     *
     * Vertex placement algorithm:
     *   - Total vertices = numPoints * 2.
     *   - The full 2*PI angular range is divided into numPoints equal sectors.
     *     Each sector contains two vertices, so the angular step between consecutive
     *     vertices is (2*PI / numPoints) / 2.
     *   - Vertex 0 (even index) is at outerRadius; vertex 1 (odd index) is at innerRadius.
     *   - The loop index i drives both the angle (startAngle + i * halfStep) and the
     *     radius selection (even = outer, odd = inner).
     *   - startAngle is -PI/2 so the first tip points straight up.
     *
     * The resulting path is closed.
     *
     * @returns {import('../../geometry/Path.js').Path} A closed 2*P-vertex GeoPath.
     */
    toGeometryPath(): GeoPath {
        const points: any[] = [];
        const numPoints: number = Math.max(3, Math.floor(this.points));
        const angleStep : number = (2 * Math.PI) / numPoints;

        // Start at top (90 degrees offset)
        const startAngle: number = -Math.PI / 2;

        for (let i = 0; i < numPoints * 2; i++) {
            const angle: number= startAngle + (i * angleStep) / 2;
            const radius: number = i % 2 === 0 ? this.outerRadius : this.innerRadius;
            const x: number = this.centerX + radius * Math.cos(angle);
            const y: number = this.centerY + radius * Math.sin(angle);
            points.push(new GeoVec(x, y));
        }

        return GeoPath.fromPoints(points, true); // Closed star
    }
}
