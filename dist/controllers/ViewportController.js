/**
 * @fileoverview ViewportController — owns pan, zoom, and the screen↔world
 * coordinate transforms for the canvas.
 * @module controllers/ViewportController
 */
import EventBus, { EVENTS } from '../events/EventBus.js';
/** Zoom clamp range, matching the original canvas behavior. */
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
export class ViewportController {
    constructor(context) {
        this.context = context;
        this.eventBus = EventBus;
        this.cssWidth = 0;
        this.cssHeight = 0;
        this.baseZoom = 1;
        this.hasInitializedZoom = false;
    }
    /** Active tab's live viewport. */
    get viewport() {
        return this.context.viewport;
    }
    /**
     * Record the canvas CSS size and derive baseZoom (min dimension / 300mm).
     * Called by CanvasView whenever the canvas element resizes.
     */
    setCanvasSize(cssWidth, cssHeight) {
        this.cssWidth = cssWidth;
        this.cssHeight = cssHeight;
        this.baseZoom = Math.max(0.01, Math.min(cssWidth, cssHeight) / 300);
        if (!this.hasInitializedZoom) {
            this.viewport.zoom = this.baseZoom;
            this.hasInitializedZoom = true;
        }
    }
    /** Pan the viewport by a screen-space delta. */
    pan(dx, dy) {
        this.viewport.x += dx;
        this.viewport.y += dy;
        this.eventBus.emit(EVENTS.VIEWPORT_CHANGED, { viewport: this.viewport });
    }
    /**
     * Zoom by a factor around a screen-space center point, keeping the world
     * position under the cursor fixed. Zoom clamps to [0.1, 5].
     *
     * @param factor - e.g. 1.1 to zoom in, 0.9 to zoom out.
     * @param centerX - Screen X of the zoom center.
     * @param centerY - Screen Y of the zoom center.
     */
    zoom(factor, centerX, centerY) {
        const worldPos = this.screenToWorld(centerX, centerY);
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.viewport.zoom * factor));
        this.viewport.x = centerX - worldPos.x * newZoom;
        this.viewport.y = centerY - worldPos.y * newZoom;
        this.viewport.zoom = newZoom;
        this.eventBus.emit(EVENTS.VIEWPORT_CHANGED, { viewport: this.viewport });
    }
    /** Convert screen (canvas CSS pixel) coordinates to world coordinates. */
    screenToWorld(x, y) {
        return {
            x: (x - this.viewport.x) / this.viewport.zoom,
            y: (y - this.viewport.y) / this.viewport.zoom
        };
    }
    /** Convert world coordinates to screen (canvas CSS pixel) coordinates. */
    worldToScreen(x, y) {
        return {
            x: x * this.viewport.zoom + this.viewport.x,
            y: y * this.viewport.zoom + this.viewport.y
        };
    }
}
