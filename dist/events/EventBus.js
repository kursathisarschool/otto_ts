var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var _a, _EventBus_instance, _EventBus_subscribers;
/**
 * @fileoverview Application-wide publish/subscribe event bus.
 * @module events/EventBus
 */
class EventBus {
    /** Singleton guard. Returns the existing instance if one already exists. */
    constructor() {
        /** Internal subscriber registry: event-type string → Set of callbacks. */
        _EventBus_subscribers.set(this, new Map());
        if (__classPrivateFieldGet(_a, _a, "f", _EventBus_instance)) {
            return __classPrivateFieldGet(_a, _a, "f", _EventBus_instance);
        }
        __classPrivateFieldSet(_a, _a, this, "f", _EventBus_instance);
    }
    /** Lazy singleton factory. Returns the one and only EventBus instance. */
    static getInstance() {
        if (!__classPrivateFieldGet(_a, _a, "f", _EventBus_instance)) {
            __classPrivateFieldSet(_a, _a, new _a(), "f", _EventBus_instance);
        }
        return __classPrivateFieldGet(_a, _a, "f", _EventBus_instance);
    }
    /**
     * Register a callback to be invoked every time emit() is called with
     * the given event type. Returns an unsubscribe function.
     */
    subscribe(eventType, callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }
        if (!__classPrivateFieldGet(this, _EventBus_subscribers, "f").has(eventType)) {
            __classPrivateFieldGet(this, _EventBus_subscribers, "f").set(eventType, new Set());
        }
        __classPrivateFieldGet(this, _EventBus_subscribers, "f").get(eventType).add(callback);
        return () => this.unsubscribe(eventType, callback);
    }
    /** Remove a previously-registered callback from the given event type. */
    unsubscribe(eventType, callback) {
        const callbacks = __classPrivateFieldGet(this, _EventBus_subscribers, "f").get(eventType);
        if (callbacks) {
            callbacks.delete(callback);
            if (callbacks.size === 0) {
                __classPrivateFieldGet(this, _EventBus_subscribers, "f").delete(eventType);
            }
        }
    }
    /** Notify every subscriber of eventType by invoking their callbacks with payload. */
    emit(eventType, payload = null) {
        const callbacks = __classPrivateFieldGet(this, _EventBus_subscribers, "f").get(eventType);
        if (callbacks) {
            const callbacksCopy = new Set(callbacks);
            callbacksCopy.forEach(callback => {
                try {
                    callback(payload);
                }
                catch (error) {
                    console.error(`Error in event callback for ${eventType}:`, error);
                }
            });
        }
    }
    /**
     * Tear down subscriber state. With an eventType argument, only that
     * event's subscribers are removed. With no argument, ALL are removed.
     */
    clear(eventType) {
        if (eventType) {
            __classPrivateFieldGet(this, _EventBus_subscribers, "f").delete(eventType);
        }
        else {
            __classPrivateFieldGet(this, _EventBus_subscribers, "f").clear();
        }
    }
    /** Return the number of callbacks currently subscribed to a given event type. */
    getSubscriberCount(eventType) {
        const callbacks = __classPrivateFieldGet(this, _EventBus_subscribers, "f").get(eventType);
        return callbacks ? callbacks.size : 0;
    }
}
_a = EventBus, _EventBus_subscribers = new WeakMap();
/** The single instance held by the class. */
_EventBus_instance = { value: null };
/** Catalogue of every named event that Otto components may emit or subscribe to. */
EventBus.EVENTS = {
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
const eventBusInstance = EventBus.getInstance();
export { EventBus };
export const EVENTS = EventBus.EVENTS;
export default eventBusInstance;
