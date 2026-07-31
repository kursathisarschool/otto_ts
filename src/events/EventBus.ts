/**
 * @fileoverview Application-wide publish/subscribe event bus.
 * @module events/EventBus
 */
class EventBus {
    /** The single instance held by the class. */
    static #instance: EventBus | null = null;

    /** Catalogue of every named event that Otto components may emit or subscribe to. */
    static EVENTS = {
        PARAM_CHANGED: 'PARAM_CHANGED',
        PARAM_ADDED: 'PARAM_ADDED',
        PARAM_REMOVED: 'PARAM_REMOVED',
        PARAM_UPDATED: 'PARAM_UPDATED',
        SHAPE_ADDED: 'SHAPE_ADDED',
        SHAPE_REMOVED: 'SHAPE_REMOVED',
        SHAPE_MOVED: 'SHAPE_MOVED',
        SHAPE_SELECTED: 'SHAPE_SELECTED',
        SHAPE_UPDATED: 'SHAPE_UPDATED',
        SHAPE_TYPE_REGISTERED: 'SHAPE_TYPE_REGISTERED',
        SHAPE_KEYBOARD_ADD: 'SHAPE_KEYBOARD_ADD',
        TAB_SWITCHED: 'TAB_SWITCHED',
        TAB_CREATED: 'TAB_CREATED',
        TAB_CLOSED: 'TAB_CLOSED',
        SCENE_LOADED: 'SCENE_LOADED',
        SCENE_SAVED: 'SCENE_SAVED',
        VIEWPORT_CHANGED: 'VIEWPORT_CHANGED',
        NODE_LINK_CREATED: 'NODE_LINK_CREATED',
        NODE_LINK_REMOVED: 'NODE_LINK_REMOVED',
        NODE_MODULE_EDITED: 'NODE_MODULE_EDITED',
        NODE_PARAM_CREATED: 'NODE_PARAM_CREATED',
        NODE_EXPRESSION_CHANGED: 'NODE_EXPRESSION_CHANGED',
        EDGE_SELECTED: 'EDGE_SELECTED',
        EDGE_HOVERED: 'EDGE_HOVERED',
        EDGE_JOINERY_CHANGED: 'EDGE_JOINERY_CHANGED',
        SELECTION_MODE_CHANGED: 'SELECTION_MODE_CHANGED',
        SHAPE_HOVERED: 'SHAPE_HOVERED',
        CODE_EXECUTED: 'CODE_EXECUTED',
        CODE_UPDATED: 'CODE_UPDATED',
        BLOCKS_EXECUTED: 'BLOCKS_EXECUTED',
        BLOCKS_UPDATED: 'BLOCKS_UPDATED',
        SHAPE_DRAG_START: 'SHAPE_DRAG_START',
        SHAPE_DRAG_END: 'SHAPE_DRAG_END',
        DRAG_PREVIEW_UPDATE: 'DRAG_PREVIEW_UPDATE',
        DRAG_PREVIEW_CLEAR: 'DRAG_PREVIEW_CLEAR',
        TOOL_CHANGED: 'TOOL_CHANGED',
        HISTORY_CHANGED: 'HISTORY_CHANGED'
    };

    /** Internal subscriber registry: event-type string → Set of callbacks. */
    #subscribers: Map<string, Set<(payload: any) => void>> = new Map();

    /** Singleton guard. Returns the existing instance if one already exists. */
    constructor() {
        if (EventBus.#instance) {
            return EventBus.#instance;
        }
        EventBus.#instance = this;
    }

    /** Lazy singleton factory. Returns the one and only EventBus instance. */
    static getInstance(): EventBus {
        if (!EventBus.#instance) {
            EventBus.#instance = new EventBus();
        }
        return EventBus.#instance;
    }

    /**
     * Register a callback to be invoked every time emit() is called with
     * the given event type. Returns an unsubscribe function.
     */
    subscribe(eventType: string, callback: (payload: any) => void): () => void {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }

        if (!this.#subscribers.has(eventType)) {
            this.#subscribers.set(eventType, new Set());
        }

        this.#subscribers.get(eventType)!.add(callback);

        return () => this.unsubscribe(eventType, callback);
    }

    /** Remove a previously-registered callback from the given event type. */
    unsubscribe(eventType: string, callback: (payload: any) => void): void {
        const callbacks = this.#subscribers.get(eventType);
        if (callbacks) {
            callbacks.delete(callback);
            if (callbacks.size === 0) {
                this.#subscribers.delete(eventType);
            }
        }
    }

    /** Notify every subscriber of eventType by invoking their callbacks with payload. */
    emit(eventType: string, payload: any = null): void {
        const callbacks = this.#subscribers.get(eventType);
        if (callbacks) {
            const callbacksCopy = new Set(callbacks);
            callbacksCopy.forEach(callback => {
                try {
                    callback(payload);
                } catch (error) {
                    console.error(`Error in event callback for ${eventType}:`, error);
                }
            });
        }
    }

    /**
     * Tear down subscriber state. With an eventType argument, only that
     * event's subscribers are removed. With no argument, ALL are removed.
     */
    clear(eventType?: string): void {
        if (eventType) {
            this.#subscribers.delete(eventType);
        } else {
            this.#subscribers.clear();
        }
    }

    /** Return the number of callbacks currently subscribed to a given event type. */
    getSubscriberCount(eventType: string): number {
        const callbacks = this.#subscribers.get(eventType);
        return callbacks ? callbacks.size : 0;
    }
}

const eventBusInstance = EventBus.getInstance();

export { EventBus };
export const EVENTS = EventBus.EVENTS;

export default eventBusInstance;