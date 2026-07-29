/**
 * @fileoverview Mediator that wires together the ShapeLibrary drag sources
 * and the canvas drop target.
 * @module core/DragDropManager
 */
import EventBus from '../events/EventBus.js';
import { AddShapeCommand } from '../commands/shapeCommands.js';
import type { SceneContext } from './SceneContext.js';

export class DragDropManager {
    canvas: HTMLCanvasElement;
    /** SceneContext — resolves the ACTIVE tab's shape store lazily. */
    context: SceneContext;
    shapeRegistry: any;
    /** The parent DOM element of the canvas. */
    canvasContainer: HTMLElement;

    isDragging: boolean;
    /** The string type key of the shape currently being dragged. */
    draggedShapeType: string | null;
    /** Last known screen-space position of the dragged item. */
    dragPreviewPosition: { x: number; y: number };
    /** Converts CSS-pixel coordinates into Otto world coordinates. */
    screenToWorldConverter: ((x: number, y: number) => { x: number; y: number }) | null;

    constructor(canvas: HTMLCanvasElement, context: SceneContext, shapeRegistry: any) {
        this.canvas = canvas;
        this.context = context;
        this.shapeRegistry = shapeRegistry;
        this.canvasContainer = canvas.parentElement as HTMLElement;

        this.isDragging = false;
        this.draggedShapeType = null;
        this.dragPreviewPosition = { x: 0, y: 0 };
        this.screenToWorldConverter = null;

        this.setupDropTarget();
        this.subscribeToDragEvents();
    }

    /** Arm the EventBus listeners that keep drag state in sync with ShapeLibrary. */
    subscribeToDragEvents(): void {
        EventBus.subscribe('SHAPE_DRAG_START', (payload: any) => {
            if (payload && payload.shapeType) {
                this.draggedShapeType = payload.shapeType;
                this.isDragging = true;
            }
        });

        EventBus.subscribe('SHAPE_DRAG_END', () => {
            this.clearPreview();
        });
    }

    /** Inject the screen-to-world coordinate converter. */
    setScreenToWorldConverter(converter: (x: number, y: number) => { x: number; y: number }): void {
        this.screenToWorldConverter = converter;
    }

    /** Attach the four HTML5 drag-and-drop event listeners. */
    setupDropTarget(): void {
        const elements = [this.canvasContainer, this.canvas];

        elements.forEach(element => {
            element.addEventListener('dragover', (e: Event) => {
                this.onDragOver(e as DragEvent);
            }, false);

            element.addEventListener('dragenter', (e: Event) => {
                this.onDragEnter(e as DragEvent);
            }, false);

            element.addEventListener('dragleave', (e: Event) => {
                this.onDragLeave(e as DragEvent);
            }, false);

            element.addEventListener('drop', (e: Event) => {
                this.onDrop(e as DragEvent);
            }, false);
        });

        console.log('DragDropManager: Drop targets setup on canvas and container');
    }

    /** Fires repeatedly while the user drags an item over the drop zone. */
    onDragOver(e: DragEvent): void {
        const hasJsonData = Array.from(e.dataTransfer!.types).includes('application/json');

        if (hasJsonData) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer!.dropEffect = 'copy';

            if (this.isDragging && this.draggedShapeType) {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                this.updatePreview(x, y);
            }
        }
    }

    /** Fires once when a dragged item first enters the drop-zone boundary. */
    onDragEnter(e: DragEvent): void {
        const hasJsonData = Array.from(e.dataTransfer!.types).includes('application/json');

        if (hasJsonData) {
            e.preventDefault();
            e.stopPropagation();
            this.canvasContainer.classList.add('drag-over');
            this.isDragging = true;
            console.log('DragDropManager: Drag enter detected');
        }
    }

    /** Fires when the dragged item leaves the drop zone. */
    onDragLeave(e: DragEvent): void {
        if (!this.canvasContainer.contains(e.relatedTarget as Node)) {
            this.canvasContainer.classList.remove('drag-over');
            this.clearPreview();
        }
    }

    /** The core drop handler — turns a drag gesture into a new shape on the canvas. */
    onDrop(e: DragEvent): void {
        e.preventDefault();
        e.stopPropagation();
        this.canvasContainer.classList.remove('drag-over');

        console.log('DragDropManager: Drop event detected');
        console.log('DataTransfer types:', Array.from(e.dataTransfer!.types));

        try {
            const dataStr = e.dataTransfer!.getData('application/json');
            console.log('Drop data string:', dataStr);

            if (!dataStr) {
                console.warn('DragDropManager: No drag data available');
                this.clearPreview();
                return;
            }

            const data = JSON.parse(dataStr);
            console.log('Parsed drop data:', data);

            if (data.type === 'shape' && data.shapeType) {
                this.draggedShapeType = data.shapeType;

                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                console.log(`Drop at screen coordinates: (${x}, ${y})`);

                let worldPos: { x: number; y: number };
                if (this.screenToWorldConverter) {
                    worldPos = this.screenToWorldConverter(x, y);
                    console.log(`Converted to world coordinates: (${worldPos.x}, ${worldPos.y})`);
                } else {
                    worldPos = { x, y };
                    console.warn('No screenToWorldConverter, using screen coordinates');
                }

                const shape = this.shapeRegistry.create(data.shapeType, {
                    x: worldPos.x,
                    y: worldPos.y
                }, {}, this.context.shapeStore);

                console.log('Created shape:', shape);

                this.context.history.execute(new AddShapeCommand(shape));

                console.log('Shape added and selected successfully');
            } else {
                console.warn('DragDropManager: Invalid drop data:', data);
            }
        } catch (error: any) {
            console.error('DragDropManager: Error handling drop:', error);
            console.error(error.stack);
        } finally {
            this.clearPreview();
        }
    }

    /** Record the latest cursor position and tell the CanvasRenderer to redraw the preview ghost. */
    updatePreview(x: number, y: number): void {
        this.dragPreviewPosition = { x, y };

        if (this.draggedShapeType) {
            EventBus.emit('DRAG_PREVIEW_UPDATE', {
                shapeType: this.draggedShapeType,
                position: this.dragPreviewPosition
            });
        }
    }

    /** Tear down all ephemeral drag state and instruct the CanvasRenderer to stop drawing the preview ghost. */
    clearPreview(): void {
        this.dragPreviewPosition = { x: 0, y: 0 };
        this.isDragging = false;
        this.draggedShapeType = null;

        EventBus.emit('DRAG_PREVIEW_CLEAR', {});
    }
}