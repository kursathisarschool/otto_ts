/**
 * @fileoverview Interpreter Pattern + Composite Pattern -- turns a
 * mathematical expression string into an AST, then evaluates it against a
 * variable context at runtime.
 * @module models/ExpressionParser
 */
/**
 * Abstract base class for every node in the expression AST.
 * @abstract
 */
export class ASTNode {
    /** Recursively evaluate this node and return a numeric result. */
    evaluate(context) {
        throw new Error('evaluate() must be implemented by subclass');
    }
}
/** Leaf node that holds a compile-time literal number. */
class NumberNode extends ASTNode {
    constructor(value) {
        super();
        this.value = value;
    }
    evaluate(context) {
        return this.value;
    }
}
/** Leaf node that represents a reference to a user-defined parameter by name. */
class ParameterRefNode extends ASTNode {
    constructor(name) {
        super();
        this.name = name;
    }
    evaluate(context) {
        if (context[this.name] === undefined) {
            console.warn(`Parameter '${this.name}' not found in context, using 0`);
            return 0;
        }
        return context[this.name];
    }
}
/** Composite (branch) node that combines two child AST nodes with a single arithmetic operator. */
class BinaryOpNode extends ASTNode {
    constructor(operator, left, right) {
        super();
        this.operator = operator;
        this.left = left;
        this.right = right;
    }
    evaluate(context) {
        const leftVal = this.left.evaluate(context);
        const rightVal = this.right.evaluate(context);
        switch (this.operator) {
            case '+':
                return leftVal + rightVal;
            case '-':
                return leftVal - rightVal;
            case '*':
                return leftVal * rightVal;
            case '/':
                if (rightVal === 0) {
                    throw new Error('Division by zero');
                }
                return leftVal / rightVal;
            default:
                throw new Error(`Unknown operator: ${this.operator}`);
        }
    }
}
/** Composite (branch) node that represents a function invocation. */
class FunctionCallNode extends ASTNode {
    constructor(functionName, args) {
        super();
        this.functionName = functionName.toLowerCase();
        this.args = args;
    }
    evaluate(context) {
        const argValues = this.args.map(arg => arg.evaluate(context));
        switch (this.functionName) {
            case 'sin':
                if (argValues.length !== 1)
                    throw new Error('sin() requires 1 argument');
                return Math.sin(argValues[0]);
            case 'cos':
                if (argValues.length !== 1)
                    throw new Error('cos() requires 1 argument');
                return Math.cos(argValues[0]);
            case 'sqrt':
                if (argValues.length !== 1)
                    throw new Error('sqrt() requires 1 argument');
                if (argValues[0] < 0)
                    throw new Error('sqrt() argument must be non-negative');
                return Math.sqrt(argValues[0]);
            case 'abs':
                if (argValues.length !== 1)
                    throw new Error('abs() requires 1 argument');
                return Math.abs(argValues[0]);
            case 'min':
                if (argValues.length < 1)
                    throw new Error('min() requires at least 1 argument');
                return Math.min(...argValues);
            case 'max':
                if (argValues.length < 1)
                    throw new Error('max() requires at least 1 argument');
                return Math.max(...argValues);
            default:
                throw new Error(`Unknown function: ${this.functionName}`);
        }
    }
}
/**
 * Stateless parser and evaluator for Otto's expression language.
 */
export class ExpressionParser {
    constructor() {
        this.supportedFunctions = ['sin', 'cos', 'sqrt', 'abs', 'min', 'max'];
    }
    /**
     * Compile an expression string into an AST using a recursive-descent parser.
     */
    parse(expression) {
        if (!expression || typeof expression !== 'string') {
            throw new Error('Expression must be a non-empty string');
        }
        expression = expression.replace(/\s+/g, '');
        if (expression.length === 0) {
            throw new Error('Expression cannot be empty');
        }
        let pos = 0;
        const parseExpression = () => {
            return parseAddition();
        };
        const parseAddition = () => {
            let left = parseMultiplication();
            while (pos < expression.length && (expression[pos] === '+' || expression[pos] === '-')) {
                const op = expression[pos++];
                const right = parseMultiplication();
                left = new BinaryOpNode(op, left, right);
            }
            return left;
        };
        const parseMultiplication = () => {
            let left = parseUnary();
            while (pos < expression.length && (expression[pos] === '*' || expression[pos] === '/')) {
                const op = expression[pos++];
                const right = parseUnary();
                left = new BinaryOpNode(op, left, right);
            }
            return left;
        };
        const parseUnary = () => {
            if (pos < expression.length && expression[pos] === '-') {
                pos++;
                return new BinaryOpNode('*', new NumberNode(-1), parseUnary());
            }
            return parsePrimary();
        };
        const parsePrimary = () => {
            if (pos >= expression.length) {
                throw new Error('Unexpected end of expression');
            }
            if (expression[pos] === '(') {
                pos++;
                const node = parseExpression();
                if (pos >= expression.length || expression[pos] !== ')') {
                    throw new Error('Unmatched parenthesis');
                }
                pos++;
                return node;
            }
            if (this.isDigit(expression[pos]) || expression[pos] === '.') {
                return parseNumber();
            }
            if (this.isLetter(expression[pos])) {
                const identifier = parseIdentifier();
                if (pos < expression.length && expression[pos] === '(') {
                    pos++;
                    const args = parseArguments();
                    if (pos >= expression.length || expression[pos] !== ')') {
                        throw new Error('Unmatched parenthesis in function call');
                    }
                    pos++;
                    return new FunctionCallNode(identifier, args);
                }
                else {
                    return new ParameterRefNode(identifier);
                }
            }
            throw new Error(`Unexpected character: ${expression[pos]} at position ${pos}`);
        };
        const parseNumber = () => {
            let numStr = '';
            while (pos < expression.length && (this.isDigit(expression[pos]) || expression[pos] === '.')) {
                numStr += expression[pos++];
            }
            const num = parseFloat(numStr);
            if (isNaN(num)) {
                throw new Error(`Invalid number: ${numStr}`);
            }
            return new NumberNode(num);
        };
        const parseIdentifier = () => {
            let ident = '';
            while (pos < expression.length && (this.isLetter(expression[pos]) || this.isDigit(expression[pos]))) {
                ident += expression[pos++];
            }
            return ident;
        };
        const parseArguments = () => {
            const args = [];
            if (pos >= expression.length || expression[pos] === ')') {
                return args;
            }
            args.push(parseExpression());
            while (pos < expression.length && expression[pos] === ',') {
                pos++;
                args.push(parseExpression());
            }
            return args;
        };
        try {
            const ast = parseExpression();
            if (pos < expression.length) {
                throw new Error(`Unexpected characters after expression: ${expression.substring(pos)}`);
            }
            return ast;
        }
        catch (error) {
            throw new Error(`Parse error: ${error.message}`);
        }
    }
    /** Evaluate a previously compiled AST against a variable context. */
    evaluate(ast, context = {}) {
        if (!ast) {
            throw new Error('AST is required for evaluation');
        }
        return ast.evaluate(context);
    }
    /** Return true if ch is an ASCII digit ('0'-'9'). */
    isDigit(ch) {
        return ch >= '0' && ch <= '9';
    }
    /** Return true if ch is an ASCII letter or underscore. */
    isLetter(ch) {
        return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
    }
}
