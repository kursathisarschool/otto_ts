/**
 * @fileoverview InteractionState — the ephemeral view-model shared between
 * the canvas input controllers (which write it) and the render passes
 * (which read it).
 *
 * @module controllers/InteractionState
 */
import { NoSnap } from '../core/SnapStrategy.js';
export class InteractionState {
    constructor() {
        // ── Dragging (viewport pan or shape move) ───────────────────────
        this.isDragging = false;
        this.dragStart = null;
        this.dragShape = null;
        // ── Rubber-band selection rectangle ─────────────────────────────
        this.isSelecting = false;
        this.selectionStart = null;
        this.selectionRect = null;
        /** Candidate ids collected during the marquee; committed on mouse-up. */
        this.marqueeIds = null;
        this.marqueeAdditive = false;
        // ── Tool mode: 'select' (pointer) or 'path' (free-draw) ─────────
        this.toolMode = 'select';
        // ── Resize handles ───────────────────────────────────────────────
        this.isResizing = false;
        this.resizeState = null;
        this.hoveredResizeHandle = null;
        // ── Rotation handle ──────────────────────────────────────────────
        this.isRotating = false;
        this.rotationState = null;
        // ── Path drawing (click-to-place anchors, optional curves) ──────
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
        // ── Bezier handle editing (post-creation) ───────────────────────
        this.handleEditState = null;
        this.isDraggingHandle = false;
        this.handleDragStart = null;
        // ── Palette drag preview (ghost while dragging from ShapeLibrary)
        this.dragPreviewType = null;
        this.dragPreviewPos = null;
        // ── Joinery handle interaction ──────────────────────────────────
        /** Hit-test cache rebuilt by JoineryPass every frame. */
        this.joineryHandles = [];
        this.hoveredJoineryHandle = null;
        this.isDraggingJoineryHandle = false;
        this.joineryDragStart = null;
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
    reset() {
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
