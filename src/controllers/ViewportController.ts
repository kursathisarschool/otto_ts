/**
 * @fileoverview ViewportController — owns pan, zoom, and the screen↔world
 * coordinate transforms for the canvas.
 * @module controllers/ViewportController
 */
import EventBus, { EVENTS } from '../events/EventBus.js';

/** Zoom clamp range, matching the original canvas behavior. */
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

interface Viewport {
    x: number;
    y: number;
    zoom: number;
}

export class ViewportController {
    context: any;
    eventBus: typeof EventBus;

    /**
     * CSS-pixel size of the canvas (excludes devicePixelRatio inflation).
     * Updated by CanvasView on resize; used for ruler extents and the
     * base-zoom computation.
     */
    cssWidth: number;
    cssHeight: number;

    /**
     * The zoom at which the canvas shows the standard 300mm × 300mm work
     * area ("100%"). Recomputed on resize from the smaller CSS dimension.
     */
    baseZoom: number;

    /**
     * The first resize initializes the viewport zoom to baseZoom; later
     * resizes keep whatever zoom the user has chosen.
     */
    hasInitializedZoom: boolean;

    constructor(context: any) {
        this.context = context;
        this.eventBus = EventBus;

        this.cssWidth = 0;
        this.cssHeight = 0;

        this.baseZoom = 1;

        this.hasInitializedZoom = false;
    }

    /** Active tab's live viewport. */
    get viewport(): Viewport {
        return this.context.viewport;
    }

    /**
     * Record the canvas CSS size and derive baseZoom (min dimension / 300mm).
     * Called by CanvasView whenever the canvas element resizes.
     */
    setCanvasSize(cssWidth: number, cssHeight: number): void {
        this.cssWidth = cssWidth;
        this.cssHeight = cssHeight;
        this.baseZoom = Math.max(0.01, Math.min(cssWidth, cssHeight) / 300);
        if (!this.hasInitializedZoom) {
            this.viewport.zoom = this.baseZoom;
            this.hasInitializedZoom = true;
        }
    }

    /** Pan the viewport by a screen-space delta. */
    pan(dx: number, dy: number): void {
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
    zoom(factor: number, centerX: number, centerY: number): void {
        const worldPos = this.screenToWorld(centerX, centerY);
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.viewport.zoom * factor));

        this.viewport.x = centerX - worldPos.x * newZoom;
        this.viewport.y = centerY - worldPos.y * newZoom;
        this.viewport.zoom = newZoom;

        this.eventBus.emit(EVENTS.VIEWPORT_CHANGED, { viewport: this.viewport });
    }

    /** Convert screen (canvas CSS pixel) coordinates to world coordinates. */
    screenToWorld(x: number, y: number): { x: number; y: number } {
        return {
            x: (x - this.viewport.x) / this.viewport.zoom,
            y: (y - this.viewport.y) / this.viewport.zoom
        };
    }

    /** Convert world coordinates to screen (canvas CSS pixel) coordinates. */
    worldToScreen(x: number, y: number): { x: number; y: number } {
        return {
            x: x * this.viewport.zoom + this.viewport.x,
            y: y * this.viewport.zoom + this.viewport.y
        };
    }
}