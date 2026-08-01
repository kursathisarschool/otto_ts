/**
 * @fileoverview CanvasInputController — the controller for pointer-driven
 * canvas interaction.
 * @module controllers/CanvasInputController
 */
import EventBus, { EVENTS } from '../events/EventBus.js';
import { LiteralBinding } from '../models/Binding.js';
import { NoSnap, GridSnap } from '../core/SnapStrategy.js';
import { EdgeJoineryMenu } from '../ui/EdgeJoineryMenu.js';
import { getResizeCursor, computeResizedBounds } from '../views/canvas/canvasGeometry.js';
import { edgesFromItem, DEFAULT_HIT_DISTANCE } from '../geometry/edge/index.js';
import { PathShape } from '../models/shapes/PathShape.js';
import { AddShapeCommand, MutateShapesCommand } from '../commands/shapeCommands.js';
import { SetEdgeJoineryCommand } from '../commands/sceneCommands.js';
export class CanvasInputController {
    constructor({ view, context, viewportController, interaction, hitTest }) {
        this.view = view;
        this.context = context;
        this.vc = viewportController;
        this.interaction = interaction;
        this.hits = hitTest;
        this.edgeJoineryMenu = new EdgeJoineryMenu({
            getShapeStore: () => this.context.shapeStore
        });
        this.touchPoints = new Map();
        this.touchGesture = null;
        this.attach();
    }
    /** Wire the canvas DOM events (window resize belongs to CanvasView). */
    attach() {
        const canvas = this.view.canvas;
        canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
        canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        canvas.addEventListener('pointerdown', (e) => this.onTouchPointerDown(e));
        canvas.addEventListener('pointermove', (e) => this.onTouchPointerMove(e));
        canvas.addEventListener('pointerup', (e) => this.onTouchPointerUp(e));
        canvas.addEventListener('pointercancel', (e) => this.onTouchPointerUp(e));
        canvas.addEventListener('mouseleave', () => {
            if (this.interaction.isDragging) {
                this.onMouseUp(new MouseEvent('mouseup'));
            }
        });
        document.addEventListener('contextmenu', (e) => {
            if (e.target === canvas) {
                e.preventDefault();
            }
        });
    }
    /**
     * Capture toJSON() snapshots for a set of shapes.
     */
    snapshotShapes(ids) {
        const map = {};
        ids.forEach(id => {
            const shape = this.context.shapeStore.get(id);
            if (shape) {
                map[id] = shape.toJSON();
            }
        });
        return map;
    }
    /**
     * Record a gesture as a MutateShapesCommand from before-snapshots and
     * the shapes' current state. Skips no-op gestures.
     */
    recordMutation(label, beforeSnapshots) {
        const entries = {};
        let changed = false;
        for (const [id, before] of Object.entries(beforeSnapshots)) {
            const shape = this.context.shapeStore.get(id);
            if (!shape)
                continue;
            const after = shape.toJSON();
            entries[id] = { before, after };
            if (JSON.stringify(before) !== JSON.stringify(after)) {
                changed = true;
            }
        }
        if (changed) {
            this.context.history.record(new MutateShapesCommand(label, entries));
        }
    }
    /** Convert a MouseEvent to canvas-relative CSS pixel coordinates. */
    eventPoint(e) {
        const rect = this.view.canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    // ─────────────────────────────────────────────────────────────────────
    // Touch navigation
    // ─────────────────────────────────────────────────────────────────────
    /** Return midpoint + distance for the first two active touch points. */
    touchMetrics() {
        const points = Array.from(this.touchPoints.values());
        if (points.length === 0)
            return null;
        if (points.length === 1) {
            return { center: points[0], distance: 0 };
        }
        const [a, b] = points;
        return {
            center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
            distance: Math.hypot(b.x - a.x, b.y - a.y)
        };
    }
    /** Start or re-baseline a one-finger pan / two-finger pinch gesture. */
    resetTouchGesture() {
        const metrics = this.touchMetrics();
        if (!metrics) {
            this.touchGesture = null;
            return;
        }
        this.touchGesture = {
            mode: this.touchPoints.size >= 2 ? 'pinch' : 'pan',
            lastCenter: { ...metrics.center },
            lastDistance: metrics.distance
        };
    }
    onTouchPointerDown(e) {
        if (e.pointerType !== 'touch')
            return;
        e.preventDefault();
        this.view.canvas.setPointerCapture?.(e.pointerId);
        this.touchPoints.set(e.pointerId, this.eventPoint(e));
        this.resetTouchGesture();
        this.view.canvas.style.cursor = 'grabbing';
    }
    onTouchPointerMove(e) {
        if (e.pointerType !== 'touch' || !this.touchPoints.has(e.pointerId))
            return;
        e.preventDefault();
        this.touchPoints.set(e.pointerId, this.eventPoint(e));
        const metrics = this.touchMetrics();
        const gesture = this.touchGesture;
        if (!metrics || !gesture) {
            this.resetTouchGesture();
            return;
        }
        if (this.touchPoints.size === 1 && gesture.mode === 'pan') {
            this.vc.pan(metrics.center.x - gesture.lastCenter.x, metrics.center.y - gesture.lastCenter.y);
        }
        else if (this.touchPoints.size >= 2 && gesture.mode === 'pinch') {
            this.vc.pan(metrics.center.x - gesture.lastCenter.x, metrics.center.y - gesture.lastCenter.y);
            if (gesture.lastDistance > 0 && metrics.distance > 0) {
                const factor = Math.max(0.5, Math.min(2, metrics.distance / gesture.lastDistance));
                this.vc.zoom(factor, metrics.center.x, metrics.center.y);
            }
        }
        else {
            this.resetTouchGesture();
            return;
        }
        this.touchGesture.lastCenter = { ...metrics.center };
        this.touchGesture.lastDistance = metrics.distance;
    }
    onTouchPointerUp(e) {
        if (e.pointerType !== 'touch')
            return;
        e.preventDefault();
        this.touchPoints.delete(e.pointerId);
        try {
            this.view.canvas.releasePointerCapture?.(e.pointerId);
        }
        catch (_) { /* already released */ }
        this.resetTouchGesture();
        if (this.touchPoints.size === 0)
            this.view.canvas.style.cursor = 'crosshair';
    }
    // ─────────────────────────────────────────────────────────────────────
    // Edge hover / click
    // ─────────────────────────────────────────────────────────────────────
    updateEdgeHover(x, y) {
        const shapeStore = this.context.shapeStore;
        const selectionMode = shapeStore.getSelectionMode();
        const hit = this.hits.hitTestEdge(x, y);
        if (selectionMode === 'edge') {
            if (hit) {
                shapeStore.setHoveredEdge(hit.edge, hit.position);
            }
            else {
                shapeStore.setHoveredEdge(null);
            }
        }
        else if (selectionMode === 'shape') {
            if (hit) {
                const worldPos = this.vc.screenToWorld(x, y);
                const resolvedShapes = shapeStore.getResolved();
                let hoveredShapeId = null;
                const tolerance = DEFAULT_HIT_DISTANCE / this.vc.viewport.zoom;
                for (const shape of resolvedShapes) {
                    if (shape.toGeometryPath) {
                        const path = shape.toGeometryPath();
                        const shapeEdges = edgesFromItem(path);
                        for (const edge of shapeEdges) {
                            const edgeResult = edge.closestPoint(worldPos);
                            if (edgeResult.distance <= tolerance) {
                                hoveredShapeId = shape.id;
                                break;
                            }
                        }
                        if (hoveredShapeId)
                            break;
                    }
                }
                shapeStore.setHoveredShape(hoveredShapeId);
            }
            else {
                shapeStore.setHoveredShape(null);
            }
        }
    }
    /** Handle edge click in edge selection mode. */
    handleEdgeClick(x, y, shiftKey) {
        const shapeStore = this.context.shapeStore;
        const hit = this.hits.hitTestEdge(x, y);
        if (hit) {
            if (shiftKey) {
                shapeStore.toggleEdgeSelection(hit.edge);
            }
            else {
                shapeStore.selectEdge(hit.edge);
            }
        }
        else if (!shiftKey) {
            shapeStore.clearEdgeSelection();
        }
    }
    // ─────────────────────────────────────────────────────────────────────
    // Mouse down
    // ─────────────────────────────────────────────────────────────────────
    onMouseDown(e) {
        const { x, y } = this.eventPoint(e);
        const ix = this.interaction;
        if (e.button === 0 && ix.toolMode === 'path') {
            const worldPos = this.vc.screenToWorld(x, y);
            const anchorHit = this.hits.hitTestPathDrawAnchor(worldPos.x, worldPos.y);
            if (anchorHit) {
                ix.isDrawingAnchorDrag = true;
                ix.pathDrawAnchorIndex = anchorHit.pointIndex;
                this.view.canvas.style.cursor = 'move';
                this.view.requestRender();
                e.preventDefault();
                return;
            }
            const handleHit = this.hits.hitTestPathDrawHandle(worldPos.x, worldPos.y);
            if (handleHit) {
                ix.isDrawingHandleDrag = true;
                ix.pathDrawHandleState = handleHit;
                this.view.canvas.style.cursor = 'move';
                this.view.requestRender();
                e.preventDefault();
                return;
            }
            if (ix.skipNextPathClick) {
                ix.skipNextPathClick = false;
                e.preventDefault();
                return;
            }
            const now = Date.now();
            const isDoubleClick = ix.lastPathClickPos &&
                (now - ix.lastPathClickTime) < 400 &&
                Math.abs(worldPos.x - ix.lastPathClickPos.x) < 10 &&
                Math.abs(worldPos.y - ix.lastPathClickPos.y) < 10;
            if (isDoubleClick && ix.isPathDrawing) {
                if (ix.pathDrawPoints.length >= 3) {
                    const firstPoint = ix.pathDrawPoints[0];
                    const distanceToFirst = Math.hypot(worldPos.x - firstPoint.x, worldPos.y - firstPoint.y);
                    const closeThreshold = 15 / this.vc.viewport.zoom;
                    if (distanceToFirst < closeThreshold) {
                        this.finishPathDrawing(true);
                        ix.skipNextPathClick = true;
                        ix.lastPathClickTime = 0;
                        ix.lastPathClickPos = null;
                        e.preventDefault();
                        return;
                    }
                }
                ix.nextSegmentCurved = true;
                ix.pathDrawEditSegmentIndex = null;
                ix.skipNextPathClick = true;
                ix.lastPathClickTime = 0;
                ix.lastPathClickPos = null;
            }
            else if (!ix.isPathDrawing) {
                ix.isPathDrawing = true;
                ix.pathDrawPoints = [{ x: worldPos.x, y: worldPos.y }];
                ix.pathDrawCurveSegments = [];
                ix.pathDrawHandles = [{ handleIn: null, handleOut: null }];
                ix.pathDrawEditSegmentIndex = null;
                ix.pathDrawCurvedEndIndex = null;
                ix.nextSegmentCurved = false;
                ix.lastPathClickTime = now;
                ix.lastPathClickPos = { x: worldPos.x, y: worldPos.y };
            }
            else {
                const firstPoint = ix.pathDrawPoints[0];
                const distanceToFirst = Math.hypot(worldPos.x - firstPoint.x, worldPos.y - firstPoint.y);
                const closeThreshold = 15 / this.vc.viewport.zoom;
                if (ix.pathDrawPoints.length >= 3 && distanceToFirst < closeThreshold) {
                    this.finishPathDrawing(true);
                    e.preventDefault();
                    return;
                }
                ix.pathDrawPoints.push({ x: worldPos.x, y: worldPos.y });
                ix.pathDrawCurveSegments.push(ix.nextSegmentCurved);
                ix.pathDrawHandles.push({ handleIn: null, handleOut: null });
                if (ix.nextSegmentCurved) {
                    ix.pathDrawCurvedEndIndex = ix.pathDrawPoints.length - 1;
                }
                ix.nextSegmentCurved = false;
                ix.pathDrawEditSegmentIndex = null;
                ix.lastPathClickTime = now;
                ix.lastPathClickPos = { x: worldPos.x, y: worldPos.y };
            }
            ix.pathPreviewPos = { x: worldPos.x, y: worldPos.y };
            this.view.canvas.style.cursor = 'crosshair';
            this.view.requestRender();
            e.preventDefault();
            return;
        }
        if (e.button === 2) {
            const hit = this.hits.hitTestEdge(x, y);
            if (hit && hit.edge) {
                this.edgeJoineryMenu.show({
                    x: e.clientX,
                    y: e.clientY,
                    edge: hit.edge
                });
                e.preventDefault();
                return;
            }
            ix.isDragging = true;
            ix.dragStart = { x, y, viewportX: this.vc.viewport.x, viewportY: this.vc.viewport.y };
            this.view.canvas.style.cursor = 'grabbing';
            e.preventDefault();
            return;
        }
        if (e.button === 0) {
            const worldPos = this.vc.screenToWorld(x, y);
            const shapeStore = this.context.shapeStore;
            const selection = this.context.selection;
            const joineryHit = this.hits.hitTestJoineryHandle(worldPos.x, worldPos.y);
            if (joineryHit) {
                if (joineryHit.type === 'align') {
                    const currentJoinery = shapeStore.getEdgeJoinery(joineryHit.edge);
                    if (currentJoinery) {
                        const newAlign = currentJoinery.align === 'left' ? 'right' : 'left';
                        this.context.history.execute(new SetEdgeJoineryCommand(joineryHit.edge, {
                            ...currentJoinery,
                            align: newAlign
                        }));
                    }
                    e.preventDefault();
                    return;
                }
                else if (joineryHit.type === 'depth') {
                    ix.isDraggingJoineryHandle = true;
                    ix.joineryDragStart = {
                        edge: joineryHit.edge,
                        handle: joineryHit.handle,
                        startX: worldPos.x,
                        startY: worldPos.y,
                        originalThickness: joineryHit.handle.joinery.thicknessMm,
                        originalJoinery: { ...(shapeStore.getEdgeJoinery(joineryHit.edge) ?? joineryHit.handle.joinery) }
                    };
                    this.view.canvas.style.cursor = 'ns-resize';
                    e.preventDefault();
                    return;
                }
            }
            if (shapeStore.getSelectionMode() === 'edge') {
                this.handleEdgeClick(x, y, e.shiftKey);
                e.preventDefault();
                return;
            }
            if (ix.handleEditState) {
                const handleHit = this.hits.hitTestHandle(worldPos.x, worldPos.y);
                if (handleHit) {
                    ix.isDraggingHandle = true;
                    ix.handleEditState.activeHandle = handleHit.handleType;
                    ix.handleDragStart = { x: worldPos.x, y: worldPos.y };
                    ix.handleEditState.beforeSnapshots = this.snapshotShapes([ix.handleEditState.shapeId]);
                    this.view.canvas.style.cursor = 'move';
                    e.preventDefault();
                    return;
                }
            }
            const rotationHit = this.hits.hitTestRotationHandle(worldPos.x, worldPos.y);
            if (rotationHit) {
                const shape = shapeStore.get(rotationHit.shapeId);
                if (shape) {
                    const startRotation = Number(shape.rotation || 0);
                    const startAngle = Math.atan2(worldPos.y - rotationHit.center.y, worldPos.x - rotationHit.center.x);
                    ix.isRotating = true;
                    ix.rotationState = {
                        shapeId: rotationHit.shapeId,
                        center: rotationHit.center,
                        startAngle,
                        startRotation,
                        beforeSnapshots: this.snapshotShapes([rotationHit.shapeId])
                    };
                    this.view.canvas.style.cursor = 'grabbing';
                    e.preventDefault();
                    return;
                }
            }
            const resizeHit = this.hits.hitTestResizeHandle(worldPos.x, worldPos.y);
            if (resizeHit) {
                const shape = shapeStore.get(resizeHit.shapeId);
                const resolvedShape = shape ? this.context.bindingResolver.resolveShape(shape) : null;
                const startBounds = resizeHit.bounds;
                const strategy = resizeHit.strategy;
                const startState = strategy && typeof strategy.init === 'function'
                    ? strategy.init(shape, resolvedShape || shape, startBounds)
                    : {};
                ix.isResizing = true;
                ix.resizeState = {
                    shapeId: resizeHit.shapeId,
                    handle: resizeHit.handle,
                    startBounds,
                    startState,
                    strategy,
                    changedProps: [],
                    beforeSnapshots: this.snapshotShapes([resizeHit.shapeId])
                };
                this.view.canvas.style.cursor = getResizeCursor(resizeHit.handle);
                e.preventDefault();
                return;
            }
            const shape = this.hits.hitTest(x, y);
            if (e.shiftKey && shape) {
                if (selection.selectedShapeIds.has(shape.id)) {
                    shapeStore.removeFromSelection(shape.id);
                }
                else {
                    shapeStore.addToSelection(shape.id);
                }
                this.view.requestRender();
                return;
            }
            if (shape) {
                const isAlreadySelected = selection.selectedShapeIds.has(shape.id);
                if (ix.handleEditState && ix.handleEditState.shapeId !== shape.id) {
                    ix.handleEditState = null;
                }
                if (!e.shiftKey && !isAlreadySelected) {
                    shapeStore.setSelected(shape.id);
                }
                else if (!isAlreadySelected) {
                    shapeStore.addToSelection(shape.id);
                }
                else {
                    selection.primaryId = shape.id;
                }
                const selectedIdsArray = Array.from(selection.selectedShapeIds);
                const initialPositions = {};
                selectedIdsArray.forEach((id) => {
                    const selShape = shapeStore.get(id);
                    if (!selShape)
                        return;
                    const resolvedSelShape = this.context.bindingResolver.resolveShape(selShape);
                    const moveState = this.getShapeMoveState(selShape, resolvedSelShape);
                    if (moveState) {
                        initialPositions[id] = moveState;
                    }
                });
                ix.isDragging = true;
                ix.dragStart = {
                    x,
                    y,
                    shapeId: shape.id,
                    selectedIds: selectedIdsArray,
                    initialPositions,
                    beforeSnapshots: this.snapshotShapes(selectedIdsArray)
                };
                this.view.canvas.style.cursor = 'grabbing';
            }
            else {
                if (!e.shiftKey) {
                    shapeStore.clearSelection();
                    ix.handleEditState = null;
                }
                ix.isSelecting = true;
                ix.selectionStart = { x: worldPos.x, y: worldPos.y, screenX: x, screenY: y };
                ix.marqueeIds = e.shiftKey ? new Set(selection.selectedShapeIds) : new Set();
                ix.marqueeAdditive = e.shiftKey;
                this.view.canvas.style.cursor = 'crosshair';
            }
        }
    }
    // ─────────────────────────────────────────────────────────────────────
    // Mouse move
    // ─────────────────────────────────────────────────────────────────────
    onMouseMove(e) {
        const { x, y } = this.eventPoint(e);
        const ix = this.interaction;
        this.updateEdgeHover(x, y);
        if (ix.isDrawingAnchorDrag && ix.pathDrawAnchorIndex !== null) {
            const worldPos = this.vc.screenToWorld(x, y);
            const index = ix.pathDrawAnchorIndex;
            if (ix.pathDrawPoints[index]) {
                ix.pathDrawPoints[index] = { x: worldPos.x, y: worldPos.y };
                this.view.requestRender();
            }
            return;
        }
        if (ix.isDrawingHandleDrag && ix.pathDrawHandleState) {
            const worldPos = this.vc.screenToWorld(x, y);
            const point = ix.pathDrawPoints[ix.pathDrawHandleState.pointIndex];
            if (point) {
                const handleVec = {
                    x: worldPos.x - point.x,
                    y: worldPos.y - point.y
                };
                const showBothAtLast = ix.pathDrawCurvedEndIndex !== null && ix.pathDrawPoints.length >= 2;
                const lastFixedIndex = ix.pathDrawCurvedEndIndex !== null
                    ? ix.pathDrawCurvedEndIndex
                    : Math.max(0, ix.pathDrawPoints.length - 2);
                if (!ix.pathDrawHandles[ix.pathDrawHandleState.pointIndex]) {
                    ix.pathDrawHandles[ix.pathDrawHandleState.pointIndex] = { handleIn: null, handleOut: null };
                }
                if (showBothAtLast && ix.pathDrawHandleState.pointIndex === lastFixedIndex) {
                    const fixedHandleLength = 35 / this.vc.viewport.zoom;
                    const len = Math.sqrt(handleVec.x * handleVec.x + handleVec.y * handleVec.y) || 1;
                    const nx = handleVec.x / len;
                    const ny = handleVec.y / len;
                    ix.pathDrawHandles[lastFixedIndex].handleOut = {
                        x: nx * fixedHandleLength,
                        y: ny * fixedHandleLength
                    };
                    ix.pathDrawHandles[lastFixedIndex].handleIn = {
                        x: -nx * fixedHandleLength,
                        y: -ny * fixedHandleLength
                    };
                }
                else {
                    ix.pathDrawHandles[ix.pathDrawHandleState.pointIndex][ix.pathDrawHandleState.handleType] = handleVec;
                }
                this.view.requestRender();
            }
            return;
        }
        if (ix.isPathDrawing) {
            const worldPos = this.vc.screenToWorld(x, y);
            ix.pathPreviewPos = { x: worldPos.x, y: worldPos.y };
            this.view.requestRender();
            return;
        }
        if (ix.isRotating && ix.rotationState) {
            const worldPos = this.vc.screenToWorld(x, y);
            const angle = Math.atan2(worldPos.y - ix.rotationState.center.y, worldPos.x - ix.rotationState.center.x);
            const delta = (angle - ix.rotationState.startAngle) * 180 / Math.PI;
            let nextRotation = ix.rotationState.startRotation + delta;
            if (e.shiftKey) {
                const snap = 15;
                nextRotation = Math.round(nextRotation / snap) * snap;
            }
            const shape = this.context.shapeStore.get(ix.rotationState.shapeId);
            if (shape) {
                shape.rotation = nextRotation;
                this.view.requestRender();
            }
            return;
        }
        if (ix.isDraggingHandle && ix.handleEditState) {
            const worldPos = this.vc.screenToWorld(x, y);
            const shape = this.context.shapeStore.get(ix.handleEditState.shapeId);
            if (shape && shape.type === 'path') {
                const point = shape.points[ix.handleEditState.pointIndex];
                if (point) {
                    const handleValue = {
                        x: worldPos.x - point.x,
                        y: worldPos.y - point.y
                    };
                    shape.setHandle(ix.handleEditState.pointIndex, ix.handleEditState.activeHandle, handleValue);
                    this.view.requestRender();
                }
            }
            return;
        }
        if (ix.isDraggingJoineryHandle && ix.joineryDragStart) {
            const worldPos = this.vc.screenToWorld(x, y);
            const handle = ix.joineryDragStart.handle;
            const dx = worldPos.x - handle.p1.x - handle.ux * (handle.length / 2);
            const dy = worldPos.y - handle.p1.y - handle.uy * (handle.length / 2);
            const projectedDist = (dx * handle.nx + dy * handle.ny) * handle.direction;
            const newThickness = Math.max(1, Math.min(50, projectedDist));
            const shapeStore = this.context.shapeStore;
            const currentJoinery = shapeStore.getEdgeJoinery(ix.joineryDragStart.edge);
            if (currentJoinery) {
                shapeStore.setEdgeJoinery(ix.joineryDragStart.edge, {
                    ...currentJoinery,
                    thicknessMm: Math.round(newThickness * 10) / 10
                });
            }
            return;
        }
        if (ix.isResizing && ix.resizeState) {
            const worldPos = this.vc.screenToWorld(x, y);
            const snappedPos = ix.snapStrategy.snap(worldPos.x, worldPos.y, { gridSize: ix.gridSize });
            const shape = this.context.shapeStore.get(ix.resizeState.shapeId);
            if (shape) {
                const newBounds = computeResizedBounds(ix.resizeState.startBounds, ix.resizeState.handle, snappedPos);
                const strategy = ix.resizeState.strategy;
                if (strategy && typeof strategy.apply === 'function') {
                    const changedProps = strategy.apply(shape, ix.resizeState.startState, newBounds) || [];
                    ix.resizeState.changedProps = changedProps;
                }
                this.view.requestRender();
            }
            return;
        }
        if (!ix.isDragging && !ix.isSelecting) {
            const worldPos = this.vc.screenToWorld(x, y);
            const joineryHit = this.hits.hitTestJoineryHandle(worldPos.x, worldPos.y);
            if (joineryHit) {
                ix.hoveredJoineryHandle = { edge: joineryHit.edge, type: joineryHit.type };
                this.view.canvas.style.cursor = joineryHit.type === 'depth' ? 'ns-resize' : 'pointer';
                this.view.requestRender();
                return;
            }
            else if (ix.hoveredJoineryHandle) {
                ix.hoveredJoineryHandle = null;
                this.view.requestRender();
            }
        }
        if (!ix.isDragging && !ix.isSelecting && !ix.isResizing && !ix.isRotating && !ix.isPathDrawing && !ix.handleEditState) {
            const worldPos = this.vc.screenToWorld(x, y);
            const rotationHit = this.hits.hitTestRotationHandle(worldPos.x, worldPos.y);
            if (rotationHit) {
                this.view.canvas.style.cursor = 'grab';
                return;
            }
            const resizeHit = this.hits.hitTestResizeHandle(worldPos.x, worldPos.y);
            if (resizeHit) {
                ix.hoveredResizeHandle = resizeHit.handle;
                this.view.canvas.style.cursor = getResizeCursor(resizeHit.handle);
            }
            else if (ix.hoveredResizeHandle) {
                ix.hoveredResizeHandle = null;
                this.view.canvas.style.cursor = 'crosshair';
            }
        }
        if (ix.isPathDrawing && !ix.isDragging) {
            const worldPos = this.vc.screenToWorld(x, y);
            const handleHit = this.hits.hitTestPathDrawHandle(worldPos.x, worldPos.y);
            this.view.canvas.style.cursor = handleHit ? 'move' : 'crosshair';
        }
        else if (ix.handleEditState && !ix.isDragging) {
            const worldPos = this.vc.screenToWorld(x, y);
            const handleHit = this.hits.hitTestHandle(worldPos.x, worldPos.y);
            this.view.canvas.style.cursor = handleHit ? 'move' : 'crosshair';
        }
        if (ix.isDragging) {
            if (ix.dragStart.viewportX !== undefined) {
                const dx = x - ix.dragStart.x;
                const dy = y - ix.dragStart.y;
                this.vc.viewport.x = ix.dragStart.viewportX + dx;
                this.vc.viewport.y = ix.dragStart.viewportY + dy;
                this.view.requestRender();
            }
            else if (ix.dragStart.shapeId) {
                const selectedIds = ix.dragStart.selectedIds || [ix.dragStart.shapeId];
                const initialWorldPos = this.vc.screenToWorld(ix.dragStart.x, ix.dragStart.y);
                let currentWorldPos = this.vc.screenToWorld(x, y);
                currentWorldPos = ix.snapStrategy.snap(currentWorldPos.x, currentWorldPos.y, {
                    gridSize: ix.gridSize,
                    shapes: this.context.shapeStore.getResolved()
                });
                const dx = currentWorldPos.x - initialWorldPos.x;
                const dy = currentWorldPos.y - initialWorldPos.y;
                selectedIds.forEach((shapeId) => {
                    const shape = this.context.shapeStore.get(shapeId);
                    if (!shape)
                        return;
                    const initialPos = ix.dragStart.initialPositions?.[shapeId];
                    if (initialPos) {
                        this.applyShapeMoveState(shape, initialPos, dx, dy);
                    }
                });
                this.view.requestRender();
            }
        }
        else if (ix.isSelecting && ix.selectionStart) {
            const currentWorldPos = this.vc.screenToWorld(x, y);
            ix.selectionRect = {
                x: Math.min(ix.selectionStart.x, currentWorldPos.x),
                y: Math.min(ix.selectionStart.y, currentWorldPos.y),
                width: Math.abs(currentWorldPos.x - ix.selectionStart.x),
                height: Math.abs(currentWorldPos.y - ix.selectionStart.y)
            };
            const shapes = this.context.shapeStore.getResolved();
            const inRect = new Set();
            shapes.forEach((shape) => {
                const bounds = shape.getBounds();
                if (this.isRectOverlapping(ix.selectionRect, bounds)) {
                    inRect.add(shape.id);
                }
            });
            if (ix.marqueeAdditive) {
                inRect.forEach(id => ix.marqueeIds.add(id));
            }
            else {
                ix.marqueeIds = inRect;
            }
            this.context.selection.selectedShapeIds.clear();
            ix.marqueeIds.forEach((id) => this.context.selection.selectedShapeIds.add(id));
            this.view.requestRender();
        }
    }
    // ─────────────────────────────────────────────────────────────────────
    // Move-state helpers (duck-typed by property presence)
    // ─────────────────────────────────────────────────────────────────────
    getShapeMoveState(shape, resolvedShape) {
        const ref = resolvedShape || shape;
        if (!ref)
            return null;
        if (shape.type === 'path' && Array.isArray(shape.points)) {
            return {
                kind: 'points',
                points: shape.points.map((p) => ({ x: p.x, y: p.y }))
            };
        }
        if (Number.isFinite(ref.centerX) && Number.isFinite(ref.centerY)) {
            return { kind: 'center', centerX: ref.centerX, centerY: ref.centerY };
        }
        if (Number.isFinite(ref.x) && Number.isFinite(ref.y)) {
            return { kind: 'xy', x: ref.x, y: ref.y };
        }
        if (Number.isFinite(ref.x1) && Number.isFinite(ref.y1) && Number.isFinite(ref.x2) && Number.isFinite(ref.y2)) {
            return { kind: 'line', x1: ref.x1, y1: ref.y1, x2: ref.x2, y2: ref.y2 };
        }
        if (shape.position && Number.isFinite(shape.position.x) && Number.isFinite(shape.position.y)) {
            return { kind: 'position', x: shape.position.x, y: shape.position.y };
        }
        return null;
    }
    applyShapeMoveState(shape, state, dx, dy) {
        if (!shape || !state)
            return;
        switch (state.kind) {
            case 'points':
                shape.points = state.points.map((p) => ({
                    x: p.x + dx,
                    y: p.y + dy
                }));
                break;
            case 'center':
                shape.centerX = state.centerX + dx;
                shape.centerY = state.centerY + dy;
                break;
            case 'xy':
                shape.x = state.x + dx;
                shape.y = state.y + dy;
                break;
            case 'line':
                shape.x1 = state.x1 + dx;
                shape.y1 = state.y1 + dy;
                shape.x2 = state.x2 + dx;
                shape.y2 = state.y2 + dy;
                break;
            case 'position':
                shape.position.x = state.x + dx;
                shape.position.y = state.y + dy;
                break;
            default:
                break;
        }
    }
    /** Check if two rectangles overlap. */
    isRectOverlapping(rect1, rect2) {
        return !(rect1.x + rect1.width < rect2.x ||
            rect2.x + rect2.width < rect1.x ||
            rect1.y + rect1.height < rect2.y ||
            rect2.y + rect2.height < rect1.y);
    }
    /**
     * Sync literal bindings to the current raw values of the given properties.
     */
    updateBindingsForProperties(shape, properties) {
        if (!shape || !Array.isArray(properties))
            return;
        properties.forEach((property) => {
            if (shape[property] === undefined)
                return;
            const binding = shape.getBinding(property);
            if (!binding) {
                shape.setBinding(property, new LiteralBinding(shape[property]));
            }
            else if (binding.type === 'literal') {
                binding.value = shape[property];
            }
        });
    }
    /**
     * Every bindable schema property with a translate role.
     */
    translatablePropertiesOf(shape) {
        const schema = shape.constructor.fullSchema ?? {};
        return Object.keys(schema).filter(prop => schema[prop].translate && schema[prop].bindable);
    }
    // ─────────────────────────────────────────────────────────────────────
    // Mouse up
    // ─────────────────────────────────────────────────────────────────────
    onMouseUp(e) {
        const ix = this.interaction;
        if (ix.isDraggingJoineryHandle) {
            const dragStart = ix.joineryDragStart;
            if (dragStart) {
                const finalJoinery = this.context.shapeStore.getEdgeJoinery(dragStart.edge);
                if (finalJoinery && dragStart.originalJoinery &&
                    finalJoinery.thicknessMm !== dragStart.originalJoinery.thicknessMm) {
                    const command = new SetEdgeJoineryCommand(dragStart.edge, { ...finalJoinery });
                    command.previousJoinery = { ...dragStart.originalJoinery };
                    this.context.history.record(command);
                }
            }
            ix.isDraggingJoineryHandle = false;
            ix.joineryDragStart = null;
            this.view.canvas.style.cursor = 'default';
            this.view.requestRender();
            return;
        }
        if (ix.isRotating && ix.rotationState) {
            const shape = this.context.shapeStore.get(ix.rotationState.shapeId);
            if (shape) {
                EventBus.emit(EVENTS.PARAM_CHANGED, { shapeId: shape.id });
                this.recordMutation('Rotate shape', ix.rotationState.beforeSnapshots ?? {});
            }
            ix.isRotating = false;
            ix.rotationState = null;
            this.view.canvas.style.cursor = 'crosshair';
            this.view.requestRender();
            return;
        }
        if (ix.isResizing && ix.resizeState) {
            const shape = this.context.shapeStore.get(ix.resizeState.shapeId);
            if (shape) {
                this.updateBindingsForProperties(shape, ix.resizeState.changedProps || []);
                EventBus.emit(EVENTS.PARAM_CHANGED, { shapeId: shape.id });
                this.recordMutation('Resize shape', ix.resizeState.beforeSnapshots ?? {});
            }
            ix.isResizing = false;
            ix.resizeState = null;
            this.view.canvas.style.cursor = 'crosshair';
            this.view.requestRender();
            return;
        }
        if (ix.isPathDrawing) {
            if (ix.isDrawingAnchorDrag) {
                ix.isDrawingAnchorDrag = false;
                ix.pathDrawAnchorIndex = null;
                this.view.canvas.style.cursor = 'crosshair';
                this.view.requestRender();
                return;
            }
            if (ix.isDrawingHandleDrag) {
                ix.isDrawingHandleDrag = false;
                ix.pathDrawHandleState = null;
                this.view.canvas.style.cursor = 'crosshair';
                this.view.requestRender();
            }
            return;
        }
        if (ix.isDraggingHandle) {
            if (ix.handleEditState?.beforeSnapshots) {
                this.recordMutation('Edit path handles', ix.handleEditState.beforeSnapshots);
                ix.handleEditState.beforeSnapshots = null;
            }
            ix.isDraggingHandle = false;
            ix.handleDragStart = null;
            if (ix.handleEditState) {
                ix.handleEditState.activeHandle = null;
            }
            this.view.canvas.style.cursor = 'crosshair';
            this.view.requestRender();
            return;
        }
        if (ix.isDragging) {
            if (ix.dragStart && ix.dragStart.shapeId) {
                const selectedIds = ix.dragStart.selectedIds || [ix.dragStart.shapeId];
                selectedIds.forEach((shapeId) => {
                    const shape = this.context.shapeStore.get(shapeId);
                    if (!shape)
                        return;
                    this.updateBindingsForProperties(shape, this.translatablePropertiesOf(shape));
                    EventBus.emit(EVENTS.PARAM_CHANGED, { shapeId });
                });
                this.recordMutation('Move shapes', ix.dragStart.beforeSnapshots ?? {});
            }
            ix.isDragging = false;
            ix.dragStart = null;
            this.view.canvas.style.cursor = 'crosshair';
        }
        else if (ix.isSelecting) {
            const ids = Array.from(ix.marqueeIds ?? []);
            if (ids.length > 0) {
                this.context.shapeStore.setSelectedIds(ids);
            }
            else {
                this.context.shapeStore.clearSelection();
            }
            ix.selectionRect = null;
            ix.isSelecting = false;
            ix.selectionStart = null;
            ix.marqueeIds = null;
            ix.marqueeAdditive = false;
        }
        this.view.canvas.style.cursor = 'crosshair';
        this.view.requestRender();
    }
    // ─────────────────────────────────────────────────────────────────────
    // Double click
    // ─────────────────────────────────────────────────────────────────────
    onDoubleClick(e) {
        const { x, y } = this.eventPoint(e);
        const worldPos = this.vc.screenToWorld(x, y);
        const ix = this.interaction;
        if (ix.toolMode === 'path' && ix.isPathDrawing) {
            if (ix.pathDrawPoints.length >= 3) {
                const firstPoint = ix.pathDrawPoints[0];
                const distanceToFirst = Math.hypot(worldPos.x - firstPoint.x, worldPos.y - firstPoint.y);
                const closeThreshold = 15 / this.vc.viewport.zoom;
                if (distanceToFirst < closeThreshold) {
                    this.finishPathDrawing(true);
                    e.preventDefault();
                    return;
                }
            }
            ix.nextSegmentCurved = true;
            this.view.requestRender();
            e.preventDefault();
            return;
        }
        if (ix.toolMode === 'select') {
            const hitResult = this.hits.hitTestPathPoint(worldPos.x, worldPos.y);
            if (hitResult) {
                this.startHandleEditing(hitResult.shapeId, hitResult.pointIndex);
                e.preventDefault();
                return;
            }
            if (ix.handleEditState) {
                ix.handleEditState = null;
                this.view.requestRender();
            }
        }
    }
    // ─────────────────────────────────────────────────────────────────────
    // Handle editing / path finishing / tool mode / wheel / snap
    // ─────────────────────────────────────────────────────────────────────
    startHandleEditing(shapeId, pointIndex) {
        const shape = this.context.shapeStore.get(shapeId);
        if (!shape || shape.type !== 'path')
            return;
        if (pointIndex > 0 && pointIndex - 1 < shape.curveSegments.length) {
            shape.curveSegments[pointIndex - 1] = true;
        }
        if (pointIndex < shape.curveSegments.length) {
            shape.curveSegments[pointIndex] = true;
        }
        if (!shape.handles) {
            shape.handles = shape.points.map(() => ({ handleIn: null, handleOut: null }));
        }
        while (shape.handles.length < shape.points.length) {
            shape.handles.push({ handleIn: null, handleOut: null });
        }
        const point = shape.points[pointIndex];
        const prevPoint = shape.points[pointIndex - 1];
        const nextPoint = shape.points[pointIndex + 1];
        if (nextPoint && !shape.handles[pointIndex].handleOut) {
            const dx = nextPoint.x - point.x;
            const dy = nextPoint.y - point.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0.001) {
                const handleLen = len / 3;
                shape.handles[pointIndex].handleOut = {
                    x: dx / len * handleLen,
                    y: dy / len * handleLen
                };
            }
        }
        if (prevPoint && !shape.handles[pointIndex].handleIn) {
            const dx = prevPoint.x - point.x;
            const dy = prevPoint.y - point.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0.001) {
                const handleLen = len / 3;
                shape.handles[pointIndex].handleIn = {
                    x: dx / len * handleLen,
                    y: dy / len * handleLen
                };
            }
        }
        if (!nextPoint && prevPoint && !shape.handles[pointIndex].handleOut) {
            const dx = point.x - prevPoint.x;
            const dy = point.y - prevPoint.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0.001) {
                const handleLen = len / 3;
                shape.handles[pointIndex].handleOut = {
                    x: dx / len * handleLen,
                    y: dy / len * handleLen
                };
            }
        }
        this.interaction.handleEditState = { shapeId, pointIndex, activeHandle: null };
        this.context.shapeStore.setSelected(shapeId);
        this.view.requestRender();
    }
    /** Finish path drawing and add the shape to the store. */
    finishPathDrawing(closed = false) {
        const ix = this.interaction;
        if (ix.pathDrawPoints.length > 1) {
            const shape = new PathShape(`path-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, {
                position: { x: 0, y: 0 },
                points: ix.pathDrawPoints,
                strokeWidth: 1,
                closed,
                curveSegments: ix.pathDrawCurveSegments,
                handles: ix.pathDrawHandles
            });
            this.context.history.execute(new AddShapeCommand(shape));
            const lastPointIndex = shape.points.length - 1;
            this.startHandleEditing(shape.id, lastPointIndex);
        }
        this.resetPathDrawState();
        this.view.requestRender();
    }
    /** Clear all in-progress path-drawing state. */
    resetPathDrawState() {
        const ix = this.interaction;
        ix.isPathDrawing = false;
        ix.pathDrawPoints = [];
        ix.pathPreviewPos = null;
        ix.pathDrawCurveSegments = [];
        ix.pathDrawHandles = [];
        ix.isDrawingAnchorDrag = false;
        ix.pathDrawAnchorIndex = null;
        ix.pathDrawEditSegmentIndex = null;
        ix.lastPathClickTime = 0;
        ix.lastPathClickPos = null;
        ix.nextSegmentCurved = false;
        ix.skipNextPathClick = false;
    }
    /** Set the active tool. */
    setToolMode(mode) {
        const ix = this.interaction;
        ix.toolMode = mode;
        if (mode === 'path') {
            ix.isSelecting = false;
            ix.isDragging = false;
            this.view.canvas.style.cursor = 'crosshair';
        }
        else {
            this.resetPathDrawState();
        }
        EventBus.emit(EVENTS.TOOL_CHANGED, { mode });
    }
    /** Wheel zoom centered on the cursor. */
    onWheel(e) {
        e.preventDefault();
        const { x, y } = this.eventPoint(e);
        const sensitivity = e.ctrlKey ? 0.01 : 0.002;
        const factor = Math.max(0.8, Math.min(1.25, Math.exp(-e.deltaY * sensitivity)));
        this.vc.zoom(factor, x, y);
    }
    /** Set snap strategy (Strategy Pattern). */
    setSnapStrategy(strategy) {
        this.interaction.snapStrategy = strategy;
    }
    /** Toggle between grid snapping and free movement. */
    toggleGridSnap() {
        if (this.interaction.snapStrategy instanceof GridSnap) {
            this.interaction.snapStrategy = new NoSnap();
        }
        else {
            this.interaction.snapStrategy = new GridSnap(this.interaction.gridSize);
        }
    }
}
