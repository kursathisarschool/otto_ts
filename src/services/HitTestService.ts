/**
 * @fileoverview HitTestService — pure hit-testing queries over the scene,
 * selection, viewport, and interaction state.
 * @module services/HitTestService
 */
import { PathShape } from '../models/shapes/PathShape.js';
import { getResizeStrategy } from '../ui/ShapeResizeStrategies.js';
import {
    EdgeHitTester,
    edgesFromItem,
    DEFAULT_HIT_DISTANCE
} from '../geometry/edge/index.js';
import {
    getRotationHandlePosition,
    getResizeHandlePositions,
    rotatePoint
} from '../views/canvas/canvasGeometry.js';

interface HitTestServiceDeps {
    context: any;
    viewportController: any;
    interaction: any;
}

export class HitTestService {
    context: any;
    vc: any;
    interaction: any;
    edgeHitTester: EdgeHitTester;

    constructor({ context, viewportController, interaction }: HitTestServiceDeps) {
        this.context = context;
        this.vc = viewportController;
        this.interaction = interaction;
        this.edgeHitTester = new EdgeHitTester({ tolerance: DEFAULT_HIT_DISTANCE });
    }

    /** Hit test - find shape at screen coordinates. */
    hitTest(x: number, y: number): any {
        const worldPos = this.vc.screenToWorld(x, y);
        const resolvedShapes = this.context.shapeStore.getResolvedSorted();

        for (let i = resolvedShapes.length - 1; i >= 0; i--) {
            const shape = resolvedShapes[i];
            const rotation = Number(shape.rotation || 0);
            let testX = worldPos.x;
            let testY = worldPos.y;
            if (rotation) {
                const bounds = shape.getBounds?.();
                if (bounds) {
                    const cx = bounds.x + bounds.width / 2;
                    const cy = bounds.y + bounds.height / 2;
                    const rotated = rotatePoint(testX, testY, cx, cy, -rotation);
                    testX = rotated.x;
                    testY = rotated.y;
                }
            }
            if (shape.containsPoint(testX, testY)) {
                return this.context.shapeStore.get(shape.id);
            }
        }

        return null;
    }

    /** Hit test for edges - find edge at screen coordinates. */
    hitTestEdge(x: number, y: number): any {
        const worldPos = this.vc.screenToWorld(x, y);
        const shapeStore = this.context.shapeStore;

        let edges: any[] = [];
        if (this.context.selection.selectedShapeIds.size > 0) {
            edges = shapeStore.getEdgesForSelectedShapes();
        } else if (shapeStore.getEdgesForAllShapes) {
            edges = shapeStore.getEdgesForAllShapes();
        } else {
            const resolvedShapes = shapeStore.getResolved();
            resolvedShapes.forEach((shape: any) => {
                if (shape.toGeometryPath) {
                    const path = shape.toGeometryPath();
                    edges.push(...edgesFromItem(path));
                }
            });
        }

        const tolerance = DEFAULT_HIT_DISTANCE / this.vc.viewport.zoom;
        this.edgeHitTester.setEdges(edges as any);
        this.edgeHitTester.tolerance = tolerance;

        return this.edgeHitTester.test(worldPos);
    }

    hitTestRotationHandle(worldX: number, worldY: number): { shapeId: string; center: { x: number; y: number } } | null {
        if (this.context.selection.selectedShapeIds.size !== 1) return null;
        const shapeId = Array.from(this.context.selection.selectedShapeIds)[0] as string;
        const shape = this.context.shapeStore.get(shapeId);
        if (!shape) return null;
        const resolved = this.context.bindingResolver.resolveShape(shape);
        if (!resolved || typeof resolved.getBounds !== 'function') return null;

        const bounds = resolved.getBounds();
        const rotation = Number(shape.rotation || 0);
        const handlePos = getRotationHandlePosition(bounds, rotation, this.vc.viewport.zoom);
        const radius = 8 / this.vc.viewport.zoom;
        const dx = worldX - handlePos.x;
        const dy = worldY - handlePos.y;
        if (dx * dx + dy * dy <= radius * radius) {
            return { shapeId, center: { x: handlePos.cx, y: handlePos.cy } };
        }
        return null;
    }

    hitTestResizeHandle(worldX: number, worldY: number): { shapeId: string; handle: string; bounds: any; strategy: any } | null {
        if (this.context.selection.selectedShapeIds.size !== 1) return null;
        const shapeId = Array.from(this.context.selection.selectedShapeIds)[0] as string;
        const shape = this.context.shapeStore.get(shapeId);
        if (!shape || shape.type === 'line') return null;

        const strategy = getResizeStrategy(shape);
        if (!strategy) return null;

        const resolved = this.context.bindingResolver.resolveShape(shape);
        if (!resolved || typeof resolved.getBounds !== 'function') return null;

        const bounds = resolved.getBounds();
        if (!bounds || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)) return null;

        const handles = getResizeHandlePositions(bounds);
        const hitSize = 10 / this.vc.viewport.zoom;
        for (const handle of handles) {
            if (Math.abs(worldX - handle.x) <= hitSize && Math.abs(worldY - handle.y) <= hitSize) {
                return { shapeId, handle: handle.name, bounds, strategy };
            }
        }
        return null;
    }

    /** Hit test for path anchor points. */
    hitTestPathPoint(worldX: number, worldY: number, hitRadius: number = 12): { shapeId: string; pointIndex: number } | null {
        const shapes = this.context.shapeStore.getAll();
        for (const shape of shapes) {
            if (shape.type !== 'path') continue;

            for (let i = 0; i < shape.points.length; i++) {
                const p = shape.points[i];
                const dx = worldX - p.x;
                const dy = worldY - p.y;
                if (dx * dx + dy * dy <= hitRadius * hitRadius) {
                    return { shapeId: shape.id, pointIndex: i };
                }
            }
        }
        return null;
    }

    /** Hit test for bezier handles. */
    hitTestHandle(worldX: number, worldY: number, hitRadius: number = 6): { shapeId: string; pointIndex: number; handleType: 'handleIn' | 'handleOut' } | null {
        if (!this.interaction.handleEditState) return null;

        const shape = this.context.shapeStore.get(this.interaction.handleEditState.shapeId);
        if (!shape || shape.type !== 'path') return null;

        const pointIndex = this.interaction.handleEditState.pointIndex;
        const point = shape.points[pointIndex];
        if (!point) return null;

        const handles = shape.getHandles(pointIndex);

        if (handles.handleOut) {
            const hx = point.x + handles.handleOut.x;
            const hy = point.y + handles.handleOut.y;
            const dx = worldX - hx;
            const dy = worldY - hy;
            if (dx * dx + dy * dy <= hitRadius * hitRadius) {
                return { shapeId: shape.id, pointIndex, handleType: 'handleOut' };
            }
        }

        if (handles.handleIn) {
            const hx = point.x + handles.handleIn.x;
            const hy = point.y + handles.handleIn.y;
            const dx = worldX - hx;
            const dy = worldY - hy;
            if (dx * dx + dy * dy <= hitRadius * hitRadius) {
                return { shapeId: shape.id, pointIndex, handleType: 'handleIn' };
            }
        }

        return null;
    }

    /** Hit test for joinery handles (depth adjustment, alignment toggle). */
    hitTestJoineryHandle(worldX: number, worldY: number): { edge: any; type: 'depth' | 'align'; handle: any } | null {
        if (!this.interaction.joineryHandles || this.interaction.joineryHandles.length === 0) return null;

        for (const handle of this.interaction.joineryHandles) {
            const dx = worldX - handle.x;
            const dy = worldY - handle.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const scaledRadius = handle.radius / this.vc.viewport.zoom * this.vc.viewport.zoom;
            if (dist <= handle.radius * 1.5) {
                return { edge: handle.edge, type: handle.type, handle };
            }
        }
        return null;
    }

    /** Hit test for preview handles while drawing a path. */
    hitTestPathDrawHandle(worldX: number, worldY: number, hitRadius: number = 12): { pointIndex: number; handleType: 'handleIn' | 'handleOut' } | null {
        if (!this.interaction.isPathDrawing) return null;
        const points = [...this.interaction.pathDrawPoints];
        const curveSegments = [...this.interaction.pathDrawCurveSegments];
        if (this.interaction.pathPreviewPos) {
            points.push({ x: this.interaction.pathPreviewPos.x, y: this.interaction.pathPreviewPos.y });
            curveSegments.push(this.interaction.nextSegmentCurved);
        }
        if (points.length < 2) return null;

        const previewShape = new PathShape('preview', {
            position: { x: 0, y: 0 },
            points,
            strokeWidth: 2,
            closed: false,
            curveSegments,
            handles: this.interaction.pathDrawHandles
        });

        const showBothAtLast = (this.interaction.pathDrawCurvedEndIndex !== null || this.interaction.nextSegmentCurved) && points.length >= 2;
        const lastFixedIndex = this.interaction.pathDrawCurvedEndIndex !== null
            ? this.interaction.pathDrawCurvedEndIndex
            : Math.max(0, points.length - 2);
        const fixedHandleLength = 35 / this.vc.viewport.zoom;
        for (let i = 0; i < points.length; i += 1) {
            if (showBothAtLast && i !== lastFixedIndex) {
                continue;
            }
            let handles = previewShape.getHandles(i);
            const point = points[i];
            if (showBothAtLast && i === lastFixedIndex) {
                let outDir = handles.handleOut;
                if (!outDir || (outDir.x === 0 && outDir.y === 0)) {
                    const prevPoint = points[i - 1] || points[i];
                    outDir = { x: point.x - prevPoint.x, y: point.y - prevPoint.y };
                }
                const outLen = Math.sqrt(outDir.x * outDir.x + outDir.y * outDir.y) || 1;
                const outNorm = { x: outDir.x / outLen, y: outDir.y / outLen };
                handles = {
                    handleOut: { x: outNorm.x * fixedHandleLength, y: outNorm.y * fixedHandleLength },
                    handleIn: { x: -outNorm.x * fixedHandleLength, y: -outNorm.y * fixedHandleLength }
                };
            }
            if (handles.handleOut) {
                const hx = point.x + handles.handleOut.x;
                const hy = point.y + handles.handleOut.y;
                const dx = worldX - hx;
                const dy = worldY - hy;
                if (dx * dx + dy * dy <= hitRadius * hitRadius) {
                    return { pointIndex: i, handleType: 'handleOut' };
                }
            }
            if (handles.handleIn) {
                const hx = point.x + handles.handleIn.x;
                const hy = point.y + handles.handleIn.y;
                const dx = worldX - hx;
                const dy = worldY - hy;
                if (dx * dx + dy * dy <= hitRadius * hitRadius) {
                    return { pointIndex: i, handleType: 'handleIn' };
                }
            }
        }

        return null;
    }

    /** Hit test for path anchor points while drawing. */
    hitTestPathDrawAnchor(worldX: number, worldY: number, hitRadius: number = 10): { pointIndex: number } | null {
        if (!this.interaction.isPathDrawing) return null;
        const points = this.interaction.pathDrawPoints;
        for (let i = 0; i < points.length; i += 1) {
            const p = points[i];
            const dx = worldX - p.x;
            const dy = worldY - p.y;
            if (dx * dx + dy * dy <= hitRadius * hitRadius) {
                return { pointIndex: i };
            }
        }
        return null;
    }
}