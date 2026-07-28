/**
 * @fileoverview InteractionState — the ephemeral view-model shared between
 * the canvas input controllers (which write it) and the render passes
 * (which read it).
 *
 * @module controllers/InteractionState
 */
import { NoSnap } from '../core/SnapStrategy.js';

interface ResizeState {
    shapeId: string;
    handle: 'ne' | 'nw' | 'se' | 'sw';
    startBounds: any;
    startState: any;
    strategy: any;
    changedProps: any;
}

interface RotationState {
    shapeId: string;
    center: any;
    startAngle: number;
    startRotation: number;
}

interface PathDrawHandleState {
    pointIndex: number;
    handleType: string;
}

interface HandleEditState {
    shapeId: string;
    pointIndex: number;
    activeHandle: any;
}

interface JoineryHandleHover {
    edge: any;
    type: 'depth' | 'align';
}

export class InteractionState {
    // ── Dragging (viewport pan or shape move) ───────────────────────
    isDragging: boolean = false;
    dragStart: any = null;
    dragShape: any = null;

    // ── Rubber-band selection rectangle ─────────────────────────────
    isSelecting: boolean = false;
    selectionStart: any = null;
    selectionRect: any = null;
    /** Candidate ids collected during the marquee; committed on mouse-up. */
    marqueeIds: Set<string> | null = null;
    marqueeAdditive: boolean = false;

    // ── Tool mode: 'select' (pointer) or 'path' (free-draw) ─────────
    toolMode: 'select' | 'path' = 'select';

    // ── Resize handles ───────────────────────────────────────────────
    isResizing: boolean = false;
    resizeState: ResizeState | null = null;
    hoveredResizeHandle: any = null;

    // ── Rotation handle ──────────────────────────────────────────────
    isRotating: boolean = false;
    rotationState: RotationState | null = null;

    // ── Path drawing (click-to-place anchors, optional curves) ──────
    isPathDrawing: boolean = false;
    pathDrawPoints: any[] = [];
    pathPreviewPos: any = null;
    pathDrawCurveSegments: any[] = [];
    pathDrawHandles: any[] = [];
    isDrawingHandleDrag: boolean = false;
    pathDrawHandleState: PathDrawHandleState | null = null;
    isDrawingAnchorDrag: boolean = false;
    pathDrawAnchorIndex: number | null = null;
    pathDrawEditSegmentIndex: number | null = null;
    pathDrawCurvedEndIndex: number | null = null;
    lastPathClickTime: number = 0;
    lastPathClickPos: any = null;
    nextSegmentCurved: boolean = false;
    skipNextPathClick: boolean = false;

    // ── Bezier handle editing (post-creation) ───────────────────────
    handleEditState: HandleEditState | null = null;
    isDraggingHandle: boolean = false;
    handleDragStart: any = null;

    // ── Palette drag preview (ghost while dragging from ShapeLibrary)
    dragPreviewType: string | null = null;
    dragPreviewPos: any = null;

    // ── Joinery handle interaction ──────────────────────────────────
    /** Hit-test cache rebuilt by JoineryPass every frame. */
    joineryHandles: any[] = [];
    hoveredJoineryHandle: JoineryHandleHover | null = null;
    isDraggingJoineryHandle: boolean = false;
    joineryDragStart: any = null;

    // ── Settings that survive tab switches ──────────────────────────
    /** Grid cell size in screen pixels (constant visual size). */
    gridSize: number;
    showGrid: boolean;
    snapStrategy: any;
    /** Currently pressed keyboard keys. */
    pressedKeys: Set<string>;

    constructor() {
        this.reset();

        this.gridSize = 20;
        this.showGrid = true;
        this.snapStrategy = new NoSnap();
        this.pressedKeys = new Set();
    }

    /**
     * Clear all transient interaction state (drag, selection rect, path
     * drawing, handle editing, previews). Settings (grid, snap) are preserved.
     */
    reset(): void {
        this.isDragging = false;
        this.dragStart = null;
        this.dragShape = null;

        this.isSelecting = false;
        this.selectionStart = null;
        this.selectionRect = null;
        this.marqueeIds = null;
        this.marqueeAdditive = false;

        this.toolMode = 'select';

        this.isResizing = false;
        this.resizeState = null;
        this.hoveredResizeHandle = null;

        this.isRotating = false;
        this.rotationState = null;

        this.isPathDrawing = false;
        this.pathDrawPoints = [];
        this.pathPreviewPos = null;
        this.pathDrawCurveSegments = [];
        this.pathDrawHandles = [];
        this.isDrawingHandleDrag = false;
        this.pathDrawHandleState = null;
        this.isDrawingAnchorDrag = false;
        this.pathDrawAnchorIndex = null;
        this.pathDrawEditSegmentIndex = null;
        this.pathDrawCurvedEndIndex = null;
        this.lastPathClickTime = 0;
        this.lastPathClickPos = null;
        this.nextSegmentCurved = false;
        this.skipNextPathClick = false;

        this.handleEditState = null;
        this.isDraggingHandle = false;
        this.handleDragStart = null;

        this.dragPreviewType = null;
        this.dragPreviewPos = null;

        this.joineryHandles = [];
        this.hoveredJoineryHandle = null;
        this.isDraggingJoineryHandle = false;
        this.joineryDragStart = null;
    }
}