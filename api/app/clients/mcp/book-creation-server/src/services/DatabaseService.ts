/**
 * Database Service - MongoDB connection and management
 */

import mongoose from 'mongoose';
import { ConfigurationError, ConnectionError } from '../../types/errors.js';
import { BaseService, ServiceHealth, ServiceHealthStatus } from '../core/BaseService.js';
import { ILogger } from '../core/Logger.js';
import { DatabaseConfig, IDatabaseService } from '../interfaces/index.js';

export class DatabaseService extends BaseService implements IDatabaseService {
    private config: DatabaseConfig;
    private connectionState: string = 'disconnected';

    constructor(logger: ILogger, config: DatabaseConfig) {
        super(logger);
        this.config = config;
        this.setupEventListeners();
    }

    protected async onInitialize(): Promise<void> {
        await this.connect();
    }

    protected async onDispose(): Promise<void> {
        await this.disconnect();
    }

    protected async performHealthCheck(): Promise<ServiceHealth> {
        try {
            if (!this.isConnected()) {
                return {
                    status: ServiceHealthStatus.UNHEALTHY,
                    message: 'Database not connected',
                    details: { connectionState: this.connectionState },
                    lastCheck: new Date(),
                };
            }

            // Perform a simple ping to verify connection
            const pingResult = await this.ping();
            if (!pingResult) {
                return {
                    status: ServiceHealthStatus.DEGRADED,
                    message: 'Database ping failed',
                    details: { connectionState: this.connectionState },
                    lastCheck: new Date(),
                };
            }

            return {
                status: ServiceHealthStatus.HEALTHY,
                message: 'Database connection is healthy',
                details: {
                    connectionState: this.connectionState,
                    readyState: mongoose.connection.readyState,
                    host: mongoose.connection.host,
                    port: mongoose.connection.port,
                    name: mongoose.connection.name,
                },
                lastCheck: new Date(),
            };
        } catch (error) {
            return {
                status: ServiceHealthStatus.UNHEALTHY,
                message: `Health check failed: ${(error as Error).message}`,
                details: { error: (error as Error).stack },
                lastCheck: new Date(),
            };
        }
    }

    async connect(): Promise<void> {
        return this.executeWithLogging('connect', async () => {
            if (!this.config?.uri) {
                throw new ConfigurationError('Database URI is not configured');
            }

            if (this.isConnected()) {
                this.logger.info('Database already connected');
                return;
            }

            this.logger.info('Connecting to database', { uri: this.maskUri(this.config.uri) });

            try {
                await mongoose.connect(this.config.uri, this.config.options);
                this.connectionState = 'connected';
                this.logger.info('Database connected successfully');
            } catch (error) {
                this.connectionState = 'error';
                throw new ConnectionError(`Failed to connect to database: ${(error as Error).message}`);
            }
        });
    }

    async disconnect(): Promise<void> {
        return this.executeWithLogging('disconnect', async () => {
            if (!this.isConnected()) {
                this.logger.info('Database already disconnected');
                return;
            }

            this.logger.info('Disconnecting from database');

            try {
                await mongoose.disconnect();
                this.connectionState = 'disconnected';
                this.logger.info('Database disconnected successfully');
            } catch (error) {
                this.logger.error('Error during database disconnection', error as Error);
                throw error;
            }
        });
    }

    isConnected(): boolean {
        return mongoose.connection.readyState === 1; // 1 = connected
    }

    getConnectionState(): string {
        const readyState = mongoose.connection.readyState;
        const states = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting',
        };
        return states[readyState as keyof typeof states] || 'unknown';
    }

    async ping(): Promise<boolean> {
        try {
            if (!this.isConnected()) {
                return false;
            }

                  // Use mongoose's built-in admin command to ping
      const db = mongoose.connection.db;
      if (!db) return false;
      
      const admin = db.admin();
      const result = await admin.ping();
      return result.ok === 1;
        } catch (error) {
            this.logger.warn('Database ping failed', { error: (error as Error).message });
            return false;
        }
    }

    /**
     * Get database statistics
     */
    async getStats(): Promise<any> {
        if (!this.isConnected()) {
            throw new ConnectionError('Database not connected');
        }

            try {
      const db = mongoose.connection.db;
      if (!db) throw new ConnectionError('Database not available');
      
      const stats = await db.stats();
            return {
                collections: stats.collections,
                dataSize: stats.dataSize,
                storageSize: stats.storageSize,
                indexes: stats.indexes,
                indexSize: stats.indexSize,
                objects: stats.objects,
            };
        } catch (error) {
            throw new Error(`Failed to get database stats: ${(error as Error).message}`);
        }
    }

    /**
     * List all collections in the database
     */
    async listCollections(): Promise<string[]> {
        if (!this.isConnected()) {
            throw new ConnectionError('Database not connected');
        }

            try {
      const db = mongoose.connection.db;
      if (!db) throw new ConnectionError('Database not available');
      
      const collections = await db.listCollections().toArray();
            return collections.map(col => col.name);
        } catch (error) {
            throw new Error(`Failed to list collections: ${(error as Error).message}`);
        }
    }

    /**
     * Create database indexes for better performance
     */
    async createIndexes(): Promise<void> {
        if (!this.isConnected()) {
            throw new ConnectionError('Database not connected');
        }

        this.logger.info('Creating database indexes');

        try {
            // Book indexes
            await mongoose.connection.collection('books').createIndex({ authorId: 1 });
            await mongoose.connection.collection('books').createIndex({ status: 1 });
            await mongoose.connection.collection('books').createIndex({ genre: 1 });
            await mongoose.connection.collection('books').createIndex({ 'metadata.tags': 1 });
            await mongoose.connection.collection('books').createIndex({ createdAt: -1 });

            // Chapter indexes
            await mongoose.connection.collection('chapters').createIndex({ bookId: 1 });
            await mongoose.connection.collection('chapters').createIndex({ bookId: 1, chapterNumber: 1 });
            await mongoose.connection.collection('chapters').createIndex({ status: 1 });

            // Page indexes
            await mongoose.connection.collection('pages').createIndex({ chapterId: 1 });
            await mongoose.connection.collection('pages').createIndex({ chapterId: 1, pageNumber: 1 });
            await mongoose.connection.collection('pages').createIndex({ status: 1 });

            // Research indexes
            await mongoose.connection.collection('researchnotes').createIndex({ bookId: 1 });
            await mongoose.connection.collection('researchnotes').createIndex({ authorId: 1 });
            await mongoose.connection.collection('researchnotes').createIndex({ 'tags': 1 });

            // Image indexes
            await mongoose.connection.collection('images').createIndex({ bookId: 1 });
            await mongoose.connection.collection('images').createIndex({ chapterId: 1 });
            await mongoose.connection.collection('images').createIndex({ status: 1 });

            this.logger.info('Database indexes created successfully');
        } catch (error) {
            this.logger.error('Failed to create database indexes', error as Error);
            throw error;
        }
    }

    private setupEventListeners(): void {
        mongoose.connection.on('connecting', () => {
            this.connectionState = 'connecting';
            this.logger.debug('Database connecting');
        });

        mongoose.connection.on('connected', () => {
            this.connectionState = 'connected';
            this.logger.info('Database connected');
        });

        mongoose.connection.on('disconnecting', () => {
            this.connectionState = 'disconnecting';
            this.logger.debug('Database disconnecting');
        });

        mongoose.connection.on('disconnected', () => {
            this.connectionState = 'disconnected';
            this.logger.info('Database disconnected');
        });

        mongoose.connection.on('error', (error) => {
            this.connectionState = 'error';
            this.logger.error('Database error', error);
        });

        mongoose.connection.on('reconnected', () => {
            this.connectionState = 'connected';
            this.logger.info('Database reconnected');
        });
    }

    private maskUri(uri: string): string {
        // Mask password in URI for logging
        return uri.replace(/:([^:@]+)@/, ':***@');
    }
}
