interface Vertex3D {
    x: number;
    y: number;
    z: number;
}

interface Vertex2D {
    x: number;
    y: number;
}

interface Bounds3D {
    min: Vertex3D;
    max: Vertex3D;
}

interface ParsedSTL {
    triangles: Vertex3D[][];
    bounds: Bounds3D;
}

interface FootprintResult {
    points: Vertex2D[];
    depth: number;
    width: number;
    height: number;
    plane: string;
}

interface SilhouetteOptions {
    scale?: number;
    plane?: string;
    resolution?: number;
    simplify?: boolean;
}

interface SilhouetteResult extends FootprintResult {
    holes: number;
}

export class StlImporter {
    /** Parse an STL into triangles and bounds. */
    static parse(buffer: ArrayBuffer): ParsedSTL {
        const triangles: Vertex3D[][] = this.isBinary(buffer)
            ? this.parseBinary(buffer)
            : this.parseAscii(new TextDecoder().decode(buffer));

        if (!triangles.length) {
            throw new Error('STL contains no triangles');
        }
        return { triangles, bounds: this.computeBounds(triangles) };
    }

    /** Binary iff the header's triangle count exactly accounts for the file size. */
    static isBinary(buffer: ArrayBuffer): boolean {
        if (buffer.byteLength < 84) return false;
        const view = new DataView(buffer);
        const count = view.getUint32(80, true);
        return buffer.byteLength === 84 + count * 50;
    }

    static parseBinary(buffer: ArrayBuffer): Vertex3D[][] {
        const view = new DataView(buffer);
        const count = view.getUint32(80, true);
        const triangles: Vertex3D[][] = [];
        let offset = 84;
        for (let i = 0; i < count; i++) {
            const v: Vertex3D[] = [];
            for (let j = 0; j < 3; j++) {
                const base = offset + 12 + j * 12;
                v.push({
                    x: view.getFloat32(base, true),
                    y: view.getFloat32(base + 4, true),
                    z: view.getFloat32(base + 8, true)
                });
            }
            triangles.push(v);
            offset += 50;
        }
        return triangles;
    }

    static parseAscii(text: string): Vertex3D[][] {
        const triangles: Vertex3D[][] = [];
        const re = /vertex\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)/g;
        const verts: Vertex3D[] = [];
        let m;
        while ((m = re.exec(text)) !== null) {
            verts.push({ x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) });
        }
        for (let i = 0; i + 2 < verts.length; i += 3) {
            triangles.push([verts[i], verts[i + 1], verts[i + 2]]);
        }
        return triangles;
    }

    /** Axis-aligned bounds over all triangle vertices. */
    static computeBounds(triangles: Vertex3D[][]): Bounds3D {
        const min: Vertex3D = { x: Infinity, y: Infinity, z: Infinity };
        const max: Vertex3D = { x: -Infinity, y: -Infinity, z: -Infinity };
        for (const tri of triangles) {
            for (const p of tri) {
                min.x = Math.min(min.x, p.x); max.x = Math.max(max.x, p.x);
                min.y = Math.min(min.y, p.y); max.y = Math.max(max.y, p.y);
                min.z = Math.min(min.z, p.z); max.z = Math.max(max.z, p.z);
            }
        }
        return { min, max };
    }

    /** Project a vertex onto a viewing plane, returning the 2D outline point. */
    static projectVertex(v: Vertex3D, plane: string): Vertex2D {
        if (plane === 'xz') return { x: v.x, y: -v.z };
        if (plane === 'yz') return { x: v.y, y: -v.z };
        return { x: v.x, y: v.y };
    }

    /** Extent (max-min) along the axis perpendicular to a viewing plane. */
    static extrudeExtent(bounds: Bounds3D, plane: string): number {
        if (plane === 'xz') return bounds.max.y - bounds.min.y;
        if (plane === 'yz') return bounds.max.x - bounds.min.x;
        return bounds.max.z - bounds.min.z;
    }

    /**
     * Reduce a parsed STL to a 2D footprint: the convex hull of every vertex
     * projected onto the chosen viewing plane, plus the depth.
     */
    static footprint({ triangles, bounds }: ParsedSTL, scale: number = 1, plane: string = 'xy'): FootprintResult {
        const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
        const pts: Vertex2D[] = [];
        for (const tri of triangles) {
            for (const v of tri) {
                const p = this.projectVertex(v, plane);
                pts.push({ x: p.x * s, y: p.y * s });
            }
        }
        const hull = this.convexHull(pts);
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of hull) {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        }
        return {
            points: hull,
            plane,
            depth: Math.max(0.5, this.extrudeExtent(bounds, plane) * s),
            width: hull.length ? maxX - minX : 0,
            height: hull.length ? maxY - minY : 0
        };
    }

    /** Choose the viewing plane whose silhouette is most distinctive. */
    static bestPlane(parsed: ParsedSTL): string {
        const order = ['xz', 'yz', 'xy'];
        let best = 'xy';
        let bestVerts = -1;
        let bestArea = -1;
        for (const plane of order) {
            const fp = this.footprint(parsed, 1, plane);
            const verts = fp.points.length;
            const area = fp.width * fp.height;
            if (verts > bestVerts || (verts === bestVerts && area > bestArea)) {
                best = plane;
                bestVerts = verts;
                bestArea = area;
            }
        }
        return best;
    }

    /** Suggest a scale that fits a raw footprint into a target size. */
    static suggestScale(fp: { width: number; height: number }, target: number = 150): number {
        const maxDim = Math.max(fp.width, fp.height);
        if (!(maxDim > 0)) return 1;
        if (maxDim >= 5 && maxDim <= 600) return 1;
        return Number((target / maxDim).toPrecision(3));
    }

    /** 2D convex hull (Andrew's monotone chain). */
    static convexHull(points: Vertex2D[]): Vertex2D[] {
        const unique: Vertex2D[] = [];
        const seen = new Set<string>();
        for (const p of points) {
            const key = `${p.x},${p.y}`;
            if (!seen.has(key)) { seen.add(key); unique.push(p); }
        }
        if (unique.length < 3) return unique;

        unique.sort((a, b) => (a.x - b.x) || (a.y - b.y));
        const cross = (o: Vertex2D, a: Vertex2D, b: Vertex2D) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

        const lower: Vertex2D[] = [];
        for (const p of unique) {
            while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
                lower.pop();
            }
            lower.push(p);
        }
        const upper: Vertex2D[] = [];
        for (let i = unique.length - 1; i >= 0; i--) {
            const p = unique[i];
            while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
                upper.pop();
            }
            upper.push(p);
        }
        lower.pop();
        upper.pop();
        return lower.concat(upper);
    }

    /** The TRUE 2D silhouette of the mesh on a viewing plane. */
    static silhouette({ triangles, bounds }: ParsedSTL, { scale = 1, plane = 'xy', resolution = 220, simplify = true }: SilhouetteOptions = {}): SilhouetteResult {
        const s = Number.isFinite(scale) && scale > 0 ? scale : 1;

        const tris: Vertex2D[][] = triangles.map(t => t.map(v => {
            const p = this.projectVertex(v, plane);
            return { x: p.x * s, y: p.y * s };
        }));

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const t of tris) for (const p of t) {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        }
        const spanX = maxX - minX;
        const spanY = maxY - minY;
        const depth = Math.max(0.5, this.extrudeExtent(bounds, plane) * s);

        if (!(spanX > 0) || !(spanY > 0)) {
            const hull = this.footprint({ triangles, bounds }, scale, plane);
            return { ...hull, holes: 0 };
        }

        const res = Math.max(16, Math.floor(resolution));
        const cell = Math.max(spanX, spanY) / res;
        const nx = Math.max(1, Math.ceil(spanX / cell));
        const ny = Math.max(1, Math.ceil(spanY / cell));
        const grid = new Uint8Array(nx * ny);

        for (const t of tris) this.rasterizeTriangle(t, grid, nx, ny, minX, minY, cell);

        const loops = this.traceLoops(grid, nx, ny);
        if (!loops.length) {
            const hull = this.footprint({ triangles, bounds }, scale, plane);
            return { ...hull, holes: 0 };
        }

        let contours: Vertex2D[][] = loops.map(loop =>
            loop.map(pt => ({ x: minX + pt.x * cell, y: minY + pt.y * cell })));
        if (simplify) {
            const eps = cell * 1.3;
            contours = contours.map(c => this.simplifyClosed(c, eps)).filter(c => c.length >= 3);
        }
        if (!contours.length) {
            const hull = this.footprint({ triangles, bounds }, scale, plane);
            return { ...hull, holes: 0 };
        }

        contours.sort((a, b) => Math.abs(this.polygonArea(b)) - Math.abs(this.polygonArea(a)));
        const outer = contours[0];

        let oMinX = Infinity, oMinY = Infinity, oMaxX = -Infinity, oMaxY = -Infinity;
        for (const p of outer) {
            oMinX = Math.min(oMinX, p.x); oMaxX = Math.max(oMaxX, p.x);
            oMinY = Math.min(oMinY, p.y); oMaxY = Math.max(oMaxY, p.y);
        }
        return {
            points: outer,
            plane,
            depth,
            width: oMaxX - oMinX,
            height: oMaxY - oMinY,
            holes: contours.length - 1
        };
    }

    /** Fill grid cells whose centre lies inside a projected triangle. */
    static rasterizeTriangle(tri: Vertex2D[], grid: Uint8Array, nx: number, ny: number, minX: number, minY: number, cell: number): void {
        const [a, b, c] = tri;
        const gx0 = Math.max(0, Math.floor((Math.min(a.x, b.x, c.x) - minX) / cell));
        const gx1 = Math.min(nx - 1, Math.ceil((Math.max(a.x, b.x, c.x) - minX) / cell));
        const gy0 = Math.max(0, Math.floor((Math.min(a.y, b.y, c.y) - minY) / cell));
        const gy1 = Math.min(ny - 1, Math.ceil((Math.max(a.y, b.y, c.y) - minY) / cell));

        const sign = (px: number, py: number, p: Vertex2D, q: Vertex2D) => (px - q.x) * (p.y - q.y) - (p.x - q.x) * (py - q.y);
        for (let gy = gy0; gy <= gy1; gy++) {
            const py = minY + (gy + 0.5) * cell;
            for (let gx = gx0; gx <= gx1; gx++) {
                const px = minX + (gx + 0.5) * cell;
                const d1 = sign(px, py, a, b);
                const d2 = sign(px, py, b, c);
                const d3 = sign(px, py, c, a);
                const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
                const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
                if (!(hasNeg && hasPos)) grid[gy * nx + gx] = 1;
            }
        }
    }

    /** Trace the boundary between filled and empty cells into closed loops. */
    static traceLoops(grid: Uint8Array, nx: number, ny: number): Vertex2D[][] {
        const inside = (x: number, y: number) => x >= 0 && x < nx && y >= 0 && y < ny && grid[y * nx + x] === 1;
        const key = (x: number, y: number) => `${x},${y}`;
        const out = new Map<string, { x: number; y: number; used: boolean }[]>();
        const addEdge = (ax: number, ay: number, bx: number, by: number): void => {
            const k = key(ax, ay);
            if (!out.has(k)) out.set(k, []);
            out.get(k)!.push({ x: bx, y: by, used: false });
        };

        for (let cy = 0; cy < ny; cy++) {
            for (let cx = 0; cx < nx; cx++) {
                if (!inside(cx, cy)) continue;
                if (!inside(cx, cy - 1)) addEdge(cx + 1, cy, cx, cy);
                if (!inside(cx - 1, cy)) addEdge(cx, cy, cx, cy + 1);
                if (!inside(cx, cy + 1)) addEdge(cx, cy + 1, cx + 1, cy + 1);
                if (!inside(cx + 1, cy)) addEdge(cx + 1, cy + 1, cx + 1, cy);
            }
        }

        const loops: Vertex2D[][] = [];
        for (const [startKey, edges] of out) {
            for (const startEdge of edges) {
                if (startEdge.used) continue;
                const [sx, sy] = startKey.split(',').map(Number);
                const loop: Vertex2D[] = [{ x: sx, y: sy }];
                let cx = sx, cy = sy;
                let edge: { x: number; y: number; used: boolean } | undefined | null = startEdge;
                let guard = 0;
                const maxSteps = nx * ny * 4 + 8;
                while (edge && !edge.used && guard++ < maxSteps) {
                    edge.used = true;
                    cx = edge.x; cy = edge.y;
                    loop.push({ x: cx, y: cy });
                    if (cx === sx && cy === sy) break;
                    const cand = out.get(key(cx, cy));
                    edge = cand ? cand.find(e => !e.used) : null;
                }
                if (loop.length >= 4) loops.push(loop);
            }
        }
        return loops;
    }

    /** Signed area of a polygon (shoelace). */
    static polygonArea(poly: Vertex2D[]): number {
        let area = 0;
        for (let i = 0, n = poly.length; i < n; i++) {
            const a = poly[i];
            const b = poly[(i + 1) % n];
            area += a.x * b.y - b.x * a.y;
        }
        return area / 2;
    }

    /** Simplify a closed loop with Douglas–Peucker. */
    static simplifyClosed(loop: Vertex2D[], epsilon: number): Vertex2D[] {
        const pts = loop.slice();
        if (pts.length > 1) {
            const f = pts[0], l = pts[pts.length - 1];
            if (f.x === l.x && f.y === l.y) pts.pop();
        }
        if (pts.length < 4) return pts;

        const a0 = pts[0];
        let bi = 0, bd = -1;
        for (let i = 1; i < pts.length; i++) {
            const dx = pts[i].x - a0.x, dy = pts[i].y - a0.y;
            const d = dx * dx + dy * dy;
            if (d > bd) { bd = d; bi = i; }
        }
        const arc1 = pts.slice(0, bi + 1);
        const arc2 = pts.slice(bi).concat([pts[0]]);
        const s1 = this.rdp(arc1, epsilon);
        const s2 = this.rdp(arc2, epsilon);
        return s1.slice(0, -1).concat(s2.slice(0, -1));
    }

    /** Douglas–Peucker on an open polyline. */
    static rdp(points: Vertex2D[], epsilon: number): Vertex2D[] {
        if (points.length < 3) return points.slice();
        const first = points[0];
        const last = points[points.length - 1];
        let idx = -1, dmax = 0;
        for (let i = 1; i < points.length - 1; i++) {
            const d = this.perpDistance(points[i], first, last);
            if (d > dmax) { dmax = d; idx = i; }
        }
        if (dmax > epsilon) {
            const left = this.rdp(points.slice(0, idx + 1), epsilon);
            const right = this.rdp(points.slice(idx), epsilon);
            return left.slice(0, -1).concat(right);
        }
        return [first, last];
    }

    /** Perpendicular distance from p to the segment a–b. */
    static perpDistance(p: Vertex2D, a: Vertex2D, b: Vertex2D): number {
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
        return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
    }
}