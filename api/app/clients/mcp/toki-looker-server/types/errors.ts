/**
 * Custom Error Types for Looker MCP Server
 */

export class LookerError extends Error {
    constructor(message: string, public statusCode?: number, public details?: any) {
        super(message);
        this.name = 'LookerError';
    }
}

export class AuthenticationError extends LookerError {
    constructor(message: string, details?: any) {
        super(message, 401, details);
        this.name = 'AuthenticationError';
    }
}

export class AuthorizationError extends LookerError {
    constructor(message: string, details?: any) {
        super(message, 403, details);
        this.name = 'AuthorizationError';
    }
}

export class NotFoundError extends LookerError {
    constructor(resource: string, id?: string) {
        const message = id
            ? `${resource} with ID '${id}' not found`
            : `${resource} not found`;
        super(message, 404);
        this.name = 'NotFoundError';
    }
}

export class ValidationError extends LookerError {
    constructor(message: string, details?: any) {
        super(message, 400, details);
        this.name = 'ValidationError';
    }
}

export class RateLimitError extends LookerError {
    constructor(message: string = 'Rate limit exceeded') {
        super(message, 429);
        this.name = 'RateLimitError';
    }
}

export class ConfigurationError extends LookerError {
    constructor(message: string, details?: any) {
        super(message, 500, details);
        this.name = 'ConfigurationError';
    }
}

export class NetworkError extends LookerError {
    constructor(message: string, details?: any) {
        super(message, 500, details);
        this.name = 'NetworkError';
    }
}
