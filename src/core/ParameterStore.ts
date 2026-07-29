/**
 * ParameterStore using Repository Pattern
 * Manages parameters and emits events via EventBus
 */
import EventBus, { EVENTS } from '../events/EventBus.js';
import { Parameter } from '../models/Parameter.js';

export class ParameterStore {
    parameters: Map<string, Parameter>;
    eventBus: typeof EventBus;

    constructor() {
        this.parameters = new Map<string, Parameter>(); // Map<id, Parameter>
        this.eventBus = EventBus;
    }
    
    /**
     * Add a parameter
     * @param {Parameter} parameter 
     */
    add(parameter: Parameter): void {
        if (this.parameters.has(parameter.id)) {
            throw new Error(`Parameter with id ${parameter.id} already exists`);
        }
        this.parameters.set(parameter.id, parameter);
        this.eventBus.emit(EVENTS.PARAM_ADDED, parameter);
    }
    
    /**
     * Remove a parameter by id
     * @param {string} id 
     */
    remove(id: string): void {
        const parameter = this.parameters.get(id);
        if (parameter) {
            this.parameters.delete(id);
            this.eventBus.emit(EVENTS.PARAM_REMOVED, { id });
        }
    }
    
    /**
     * Get a parameter by id
     * @param {string} id 
     * @returns {Parameter|null}
     */
    get(id: string): Parameter | null {
        return this.parameters.get(id) || null;
    }
    
    /**
     * Get a parameter by name
     * @param {string} name 
     * @returns {Parameter|null}
     */
    getByName(name: string): Parameter | null {
        for (const param of this.parameters.values()) {
            if (param.name === name) {
                return param;
            }
        }
        return null;
    }
    
    /**
     * Get all parameters
     * @returns {Array<Parameter>}
     */
    getAll(): Parameter[] {
        return Array.from(this.parameters.values());
    }
    
    /**
     * Set value for a parameter
     * @param {string} id 
     * @param {number} value 
     */
    setValue(id: string, value: number): void {
        const parameter = this.parameters.get(id);
        if (!parameter) {
            throw new Error(`Parameter with id ${id} not found`);
        }
        const oldValue: number = parameter.getValue();
        parameter.setValue(value);
        
        // Emit event only if value actually changed
        if (oldValue !== parameter.getValue()) {
            this.eventBus.emit(EVENTS.PARAM_CHANGED, {
                id,
                parameter,
                oldValue,
                newValue: parameter.getValue()
            });
        }
    }
    
    /**
     * Serialize to JSON
     * @returns {Object}
     */
    toJSON(): { parameters: { id: string; name: string; value: number; min: number; max: number; step: number; }[]; } {
        return {
            parameters: Array.from(this.parameters.values()).map(param => param.toJSON())
        };
    }
    
    /**
     * Deserialize from JSON
     * @param {Object} json 
     */
    async fromJSON(json: any): Promise<void> {
        if (!json || !json.parameters) {
            throw new Error('Invalid ParameterStore JSON');
        }
        
        this.parameters.clear();
        const { Parameter } = await import('../models/Parameter.js');
        
        json.parameters.forEach(paramJson => {
            const param: Parameter = Parameter.fromJSON(paramJson);
            this.parameters.set(param.id, param);
        });
    }
}
