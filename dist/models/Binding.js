/**
 * @fileoverview Strategy Pattern -- each Binding subclass is a distinct strategy
 * for computing a shape property's value at resolve time.
 *
 * Concrete strategies defined here:
 *   - LiteralBinding    : fixed numeric value (no parameter connection)
 *   - ParameterBinding  : live reference to a single Parameter by ID
 *   - ExpressionBinding : arbitrary math expression that may reference multiple
 *                         parameters by name (e.g. "width * 2 + offset")
 */
/**
 * Abstract base class for all binding strategies.
 * @abstract
 */
export class Binding {
    constructor(type) {
        if (this.constructor === Binding) {
            throw new Error('Binding is an abstract class and cannot be instantiated directly');
        }
        this.type = type;
    }
    /**
     * Strategy interface -- resolve this binding to a concrete numeric value.
     */
    resolve(parameterStore, expressionParser = null) {
        throw new Error('resolve() must be implemented by subclass');
    }
    /**
     * Serialize this binding to a plain object suitable for JSON.stringify.
     */
    toJSON() {
        throw new Error('toJSON() must be implemented by subclass');
    }
}
/**
 * The simplest binding strategy: a single, fixed numeric value that has no
 * connection to any user-defined parameter.
 */
export class LiteralBinding extends Binding {
    constructor(value) {
        super('literal');
        this.value = value;
    }
    /** Return the stored literal value. Both arguments are ignored. */
    resolve(parameterStore, expressionParser = null) {
        return this.value;
    }
    /** Serialize to a plain object containing only the type discriminant and the fixed value. */
    toJSON() {
        return {
            type: this.type,
            value: this.value
        };
    }
}
/**
 * Binding strategy that links a shape property directly to a single
 * user-defined parameter (slider).
 */
export class ParameterBinding extends Binding {
    constructor(parameterId) {
        super('parameter');
        this.parameterId = parameterId;
    }
    /**
     * Look up the referenced parameter in the store and return its current
     * value. If the parameter no longer exists, a warning is logged and 0
     * is returned so rendering can continue.
     */
    resolve(parameterStore, expressionParser = null) {
        if (!parameterStore) {
            throw new Error('ParameterStore is required for ParameterBinding');
        }
        const param = parameterStore.get(this.parameterId);
        if (!param) {
            console.warn(`Parameter ${this.parameterId} not found, returning 0`);
            return 0;
        }
        return param.getValue();
    }
    /** Serialize to a plain object containing the type discriminant and the target parameter's ID. */
    toJSON() {
        return {
            type: this.type,
            parameterId: this.parameterId
        };
    }
}
/**
 * The most powerful binding strategy. Holds an arbitrary mathematical
 * expression string that may reference any number of user-defined
 * parameters by name.
 */
export class ExpressionBinding extends Binding {
    constructor(expression) {
        super('expression');
        this.expression = expression;
        this._cachedAST = null;
    }
    /**
     * Resolve the expression to a numeric value.
     *
     * Steps performed on each call:
     *   1. If _cachedAST is null the expression string is parsed into an AST
     *      and the result is cached.
     *   2. A context object is built by iterating every parameter in the
     *      store and mapping parameter.name to parameter.getValue().
     *   3. The cached AST is evaluated against that context.
     */
    resolve(parameterStore, expressionParser = null) {
        if (!expressionParser) {
            throw new Error('ExpressionParser is required for ExpressionBinding');
        }
        if (!parameterStore) {
            throw new Error('ParameterStore is required for ExpressionBinding');
        }
        if (!this._cachedAST) {
            this._cachedAST = expressionParser.parse(this.expression);
        }
        const context = {};
        const allParams = parameterStore.getAll();
        allParams.forEach((param) => {
            context[param.name] = param.getValue();
        });
        return expressionParser.evaluate(this._cachedAST, context);
    }
    /**
     * Serialize to a plain object containing the type discriminant and the
     * raw expression string. The cached AST is intentionally omitted.
     */
    toJSON() {
        return {
            type: this.type,
            expression: this.expression
        };
    }
}
/**
 * Re-export BindingRegistry and its companion helper createBindingFromJSON
 * from this module for backward compatibility.
 */
export { BindingRegistry, createBindingFromJSON } from './BindingRegistry.js';
