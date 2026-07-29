import { Binding } from "../models/Binding.js";

/**
 * BindingResolver using Facade Pattern
 * Provides a simple interface for resolving bindings and shapes
 */
export class BindingResolver {

    parameterStore: any;
    expressionParser: any;

    constructor(parameterStore: any, expressionParser: any) {
        this.parameterStore = parameterStore;
        this.expressionParser = expressionParser;
    }
    
    /** Resolve a binding to a number value. */
    resolveValue(binding: Binding): number {
        if (!binding) {
            throw new Error('Binding is required');
        }
        
        return binding.resolve(this.parameterStore, this.expressionParser);
    }
    
    /** Resolve all bindings in a shape. */
    resolveShape(shape: any): any {
        if (!shape) {
            throw new Error('Shape is required');
        }
        
        return shape.resolve(this.parameterStore, this);
    }
    
    /** Batch resolve multiple shapes. */
    resolveAll(shapes: any[]): any[] {
        if (!Array.isArray(shapes)) {
            throw new Error('Shapes must be an array');
        }
        
        return shapes.map(shape => this.resolveShape(shape));
    }
}