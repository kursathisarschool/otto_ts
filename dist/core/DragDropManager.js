/**
 * @fileoverview Mediator that wires together the ShapeLibrary drag sources
 * and the canvas drop target.
 * @module core/DragDropManager
 */
import EventBus from '../events/EventBus.js';
import { AddShapeCommand } from '../commands/shapeCommands.js';
export class DragDropManager {
    constructor(canvas, context, shapeRegistry) {
        this.canvas = canvas;
        this.context = context;
        this.shapeRegistry = shapeRegistry;
        this.canvasContainer = canvas.parentElement;
        this.isDragging = false;
        this.draggedShapeType = null;
        this.dragPreviewPosition = { x: 0, y: 0 };
        this.screenToWorldConverter = null;
        this.setupDropTarget();
        this.subscribeToDragEvents();
    }
    /** Arm the EventBus listeners that keep drag state in sync with ShapeLibrary. */
    subscribeToDragEvents() {
        EventBus.subscribe('SHAPE_DRAG_START', (payload) => {
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
    setScreenToWorldConverter(converter) {
        this.screenToWorldConverter = converter;
    }
    /** Attach the four HTML5 drag-and-drop event listeners. */
    setupDropTarget() {
        const elements = [this.canvasContainer, this.canvas];
        elements.forEach(element => {
            element.addEventListener('dragover', (e) => {
                this.onDragOver(e);
            }, false);
            element.addEventListener('dragenter', (e) => {
                this.onDragEnter(e);
            }, false);
            element.addEventListener('dragleave', (e) => {
                this.onDragLeave(e);
            }, false);
            element.addEventListener('drop', (e) => {
                this.onDrop(e);
            }, false);
        });
        console.log('DragDropManager: Drop targets setup on canvas and container');
    }
    /** Fires repeatedly while the user drags an item over the drop zone. */
    onDragOver(e) {
        const hasJsonData = Array.from(e.dataTransfer.types).includes('application/json');
        if (hasJsonData) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
            if (this.isDragging && this.draggedShapeType) {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                this.updatePreview(x, y);
            }
        }
    }
    /** Fires once when a dragged item first enters the drop-zone boundary. */
    onDragEnter(e) {
        const hasJsonData = Array.from(e.dataTransfer.types).includes('application/json');
        if (hasJsonData) {
            e.preventDefault();
            e.stopPropagation();
            this.canvasContainer.classList.add('drag-over');
            this.isDragging = true;
            console.log('DragDropManager: Drag enter detected');
        }
    }
    /** Fires when the dragged item leaves the drop zone. */
    onDragLeave(e) {
        if (!this.canvasContainer.contains(e.relatedTarget)) {
            this.canvasContainer.classList.remove('drag-over');
            this.clearPreview();
        }
    }
    /** The core drop handler — turns a drag gesture into a new shape on the canvas. */
    onDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        this.canvasContainer.classList.remove('drag-over');
        console.log('DragDropManager: Drop event detected');
        console.log('DataTransfer types:', Array.from(e.dataTransfer.types));
        try {
            const dataStr = e.dataTransfer.getData('application/json');
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
                let worldPos;
                if (this.screenToWorldConverter) {
                    worldPos = this.screenToWorldConverter(x, y);
                    console.log(`Converted to world coordinates: (${worldPos.x}, ${worldPos.y})`);
                }
                else {
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
            }
            else {
                console.warn('DragDropManager: Invalid drop data:', data);
            }
        }
        catch (error) {
            console.error('DragDropManager: Error handling drop:', error);
            console.error(error.stack);
        }
        finally {
            this.clearPreview();
        }
    }
    /** Record the latest cursor position and tell the CanvasRenderer to redraw the preview ghost. */
    updatePreview(x, y) {
        this.dragPreviewPosition = { x, y };
        if (this.draggedShapeType) {
            EventBus.emit('DRAG_PREVIEW_UPDATE', {
                shapeType: this.draggedShapeType,
                position: this.dragPreviewPosition
            });
        }
    }
    /** Tear down all ephemeral drag state and instruct the CanvasRenderer to stop drawing the preview ghost. */
    clearPreview() {
        this.dragPreviewPosition = { x: 0, y: 0 };
        this.isDragging = false;
        this.draggedShapeType = null;
        EventBus.emit('DRAG_PREVIEW_CLEAR', {});
    }
}
