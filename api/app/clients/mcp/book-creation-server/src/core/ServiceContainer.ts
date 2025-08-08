/**
 * Service Container for Dependency Injection
 * Manages service instances and their dependencies
 */

export type ServiceIdentifier<T = any> = string | symbol | Function | (abstract new (...args: any[]) => T);

export interface ServiceDefinition<T = any> {
    implementation: new (...args: any[]) => T;
    dependencies?: ServiceIdentifier[];
    singleton?: boolean;
}

export class ServiceContainer {
    private readonly services = new Map<ServiceIdentifier, ServiceDefinition>();
    private readonly instances = new Map<ServiceIdentifier, any>();

    /**
     * Register a service with the container
     */
    register<T>(
        identifier: ServiceIdentifier<T>,
        implementation: new (...args: any[]) => T,
        options?: {
            dependencies?: ServiceIdentifier[];
            singleton?: boolean;
        }
    ): this {
        this.services.set(identifier, {
            implementation,
            dependencies: options?.dependencies || [],
            singleton: options?.singleton ?? true,
        });
        return this;
    }

    /**
     * Register a singleton service
     */
    registerSingleton<T>(
        identifier: ServiceIdentifier<T>,
        implementation: new (...args: any[]) => T,
        dependencies?: ServiceIdentifier[]
    ): this {
        return this.register(identifier, implementation, {
            dependencies: dependencies || [],
            singleton: true,
        });
    }

    /**
     * Register a transient service (new instance each time)
     */
    registerTransient<T>(
        identifier: ServiceIdentifier<T>,
        implementation: new (...args: any[]) => T,
        dependencies?: ServiceIdentifier[]
    ): this {
        return this.register(identifier, implementation, {
            dependencies: dependencies || [],
            singleton: false,
        });
    }

    /**
     * Register an instance directly
     */
    registerInstance<T>(identifier: ServiceIdentifier<T>, instance: T): this {
        this.instances.set(identifier, instance);
        return this;
    }

    /**
     * Resolve a service from the container
     */
    resolve<T>(identifier: ServiceIdentifier<T>): T {
        // Check if we have a direct instance
        if (this.instances.has(identifier)) {
            return this.instances.get(identifier);
        }

        const serviceDefinition = this.services.get(identifier);
        if (!serviceDefinition) {
            throw new Error(`Service ${String(identifier)} is not registered`);
        }

        // For singletons, check if already instantiated
        if (serviceDefinition.singleton && this.instances.has(identifier)) {
            return this.instances.get(identifier);
        }

        // Resolve dependencies
        const dependencies = (serviceDefinition.dependencies || []).map(dep => this.resolve(dep));

        // Create instance
        const instance = new serviceDefinition.implementation(...dependencies);

        // Store singleton instances
        if (serviceDefinition.singleton) {
            this.instances.set(identifier, instance);
        }

        return instance;
    }

    /**
     * Check if a service is registered
     */
    has(identifier: ServiceIdentifier): boolean {
        return this.services.has(identifier) || this.instances.has(identifier);
    }

    /**
     * Clear all services and instances
     */
    clear(): void {
        this.services.clear();
        this.instances.clear();
    }

    /**
     * Get all registered service identifiers
     */
    getRegisteredServices(): ServiceIdentifier[] {
        return Array.from(this.services.keys());
    }
}

// Global container instance
export const container = new ServiceContainer();

// Service decorator for automatic registration
export function Service(identifier?: ServiceIdentifier) {
    return function <T extends new (...args: any[]) => any>(constructor: T) {
        const serviceId = identifier || constructor;
        container.register(serviceId, constructor);
        return constructor;
    };
}

// Injectable decorator for dependency injection
export function Injectable() {
    return function <T extends new (...args: any[]) => any>(constructor: T) {
        return constructor;
    };
}
