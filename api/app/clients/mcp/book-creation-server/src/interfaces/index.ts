/**
 * Core interfaces for the Book Creation MCP Server
 * These interfaces define the contracts for all services
 */

// Import specific types we need first
import { ContentGenerationOptions, ContentImprovementOptions, PageGenerationOptions } from '../../types/book.js';
import { ILogger, ValidationIssue } from '../../types/index.js';
import { IBookService, IConfigService } from '../../types/services.js';

// Re-export all types after importing what we need
export * from '../../types/book.js';
export * from '../../types/errors.js';
export * from '../../types/index.js';
export * from '../../types/services.js';

// Service interface tokens for dependency injection
export const SERVICE_TOKENS = {
    // Core services
    CONFIG_SERVICE: Symbol('ConfigService'),
    DATABASE_SERVICE: Symbol('DatabaseService'),
    LOGGER: Symbol('Logger'),

    // Business services
    BOOK_SERVICE: Symbol('BookService'),
    CHAPTER_SERVICE: Symbol('ChapterService'),
    PAGE_SERVICE: Symbol('PageService'),
    CONTENT_SERVICE: Symbol('ContentService'),
    EXPORT_SERVICE: Symbol('ExportService'),

    // Feature services
    AI_CONTENT_SERVICE: Symbol('AIContentService'),
    IMAGE_SERVICE: Symbol('ImageService'),
    RESEARCH_SERVICE: Symbol('ResearchService'),
    COLLABORATION_SERVICE: Symbol('CollaborationService'),
    ANALYTICS_SERVICE: Symbol('WritingAnalyticsService'),
    WORLD_BUILDING_SERVICE: Symbol('WorldBuildingService'),
    GRAMMAR_STYLE_SERVICE: Symbol('GrammarStyleService'),
    CONTENT_ORGANIZATION_SERVICE: Symbol('ContentOrganizationService'),
    INFLUENCER_RESEARCH_SERVICE: Symbol('InfluencerResearchService'),
    WEB_SCOUTING_SERVICE: Symbol('WebScoutingService'),
} as const;

/**
 * Tool handler interface for MCP tools
 */
export interface IToolHandler {
    name: string;
    description: string;
    inputSchema: Record<string, any>;
    handler: (args: any) => Promise<any>;
}

/**
 * MCP Server interface
 */
export interface IMCPServer {
    initialize(): Promise<void>;
    registerTool(tool: IToolHandler): void;
    registerTools(tools: IToolHandler[]): void;
    start(): Promise<void>;
    stop(): Promise<void>;
    getRegisteredTools(): IToolHandler[];
}

/**
 * Database connection interface
 */
export interface IDatabaseService {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    getConnectionState(): string;
    ping(): Promise<boolean>;
}

/**
 * Event system interfaces
 */
export interface IEventData {
    timestamp: Date;
    source: string;
    type: string;
    data: Record<string, any>;
}

export interface IEventEmitter {
    emit(event: string, data: IEventData): void;
    on(event: string, handler: (data: IEventData) => void | Promise<void>): void;
    off(event: string, handler: (data: IEventData) => void | Promise<void>): void;
    once(event: string, handler: (data: IEventData) => void | Promise<void>): void;
    removeAllListeners(event?: string): void;
}

/**
 * Validation interfaces
 */
export interface IValidationRule<T = any> {
    field: keyof T;
    validator: (value: any) => boolean | Promise<boolean>;
    message: string;
    code: string;
}

export interface IValidator<T = any> {
    addRule(rule: IValidationRule<T>): void;
    validate(data: T): Promise<ValidationIssue[]>;
    validateField(field: keyof T, value: any): Promise<ValidationIssue[]>;
}

/**
 * Caching interfaces
 */
export interface ICacheOptions {
    ttl?: number; // Time to live in milliseconds
    tags?: string[]; // Cache tags for invalidation
}

export interface ICache {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, options?: ICacheOptions): Promise<void>;
    delete(key: string): Promise<boolean>;
    clear(tag?: string): Promise<void>;
    has(key: string): Promise<boolean>;
    keys(pattern?: string): Promise<string[]>;
}

/**
 * Metrics and monitoring interfaces
 */
export interface IMetric {
    name: string;
    value: number;
    timestamp: Date;
    tags?: Record<string, string>;
}

export interface IMetricsCollector {
    counter(name: string, value?: number, tags?: Record<string, string>): void;
    gauge(name: string, value: number, tags?: Record<string, string>): void;
    histogram(name: string, value: number, tags?: Record<string, string>): void;
    timing(name: string, duration: number, tags?: Record<string, string>): void;
    getMetrics(): IMetric[];
    clearMetrics(): void;
}

/**
 * Backup and recovery interfaces
 */
export interface IBackupOptions {
    includeImages?: boolean;
    includeMetadata?: boolean;
    compression?: boolean;
    format?: 'json' | 'zip' | 'tar';
}

export interface IBackupResult {
    filename: string;
    filepath: string;
    size: number;
    checksum: string;
    createdAt: Date;
    options: IBackupOptions;
}

export interface IBackupService {
    createBackup(bookId: string, options?: IBackupOptions): Promise<IBackupResult>;
    restoreBackup(backupPath: string, targetBookId?: string): Promise<void>;
    listBackups(bookId?: string): Promise<IBackupResult[]>;
    deleteBackup(backupPath: string): Promise<void>;
    scheduleBackup(bookId: string, schedule: string, options?: IBackupOptions): Promise<void>;
}

/**
 * Plugin system interfaces
 */
export interface IPlugin {
    name: string;
    version: string;
    description: string;
    initialize(context: IPluginContext): Promise<void>;
    destroy(): Promise<void>;
}

export interface IPluginContext {
    services: {
        bookService: IBookService;
        configService: IConfigService;
        logger: ILogger;
    };
    registerTool(tool: IToolHandler): void;
    emit(event: string, data: any): void;
}

export interface IPluginManager {
    loadPlugin(plugin: IPlugin): Promise<void>;
    unloadPlugin(name: string): Promise<void>;
    getLoadedPlugins(): IPlugin[];
    enablePlugin(name: string): Promise<void>;
    disablePlugin(name: string): Promise<void>;
}

/**
 * Content generation interfaces
 */
export interface IContentGenerator {
    generateChapterContent(params: ContentGenerationOptions): Promise<string>;
    generatePageContent(params: PageGenerationOptions): Promise<string>;
    improveContent(content: string, options: ContentImprovementOptions): Promise<string>;
    generateOutline(params: any): Promise<string>;
}

export interface IAIProvider {
    name: string;
    generateText(prompt: string, options?: any): Promise<string>;
    generateImage(prompt: string, options?: any): Promise<string>;
    analyzeText(text: string, options?: any): Promise<any>;
}

/**
 * Search and indexing interfaces
 */
export interface ISearchResult<T = any> {
    item: T;
    score: number;
    highlights?: string[];
}

export interface ISearchOptions {
    query: string;
    filters?: Record<string, any>;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface ISearchService {
    index(id: string, content: any): Promise<void>;
    search<T>(options: ISearchOptions): Promise<ISearchResult<T>[]>;
    remove(id: string): Promise<void>;
    clear(): Promise<void>;
    reindex(): Promise<void>;
}

/**
 * Notification interfaces
 */
export interface INotification {
    id: string;
    type: 'info' | 'warning' | 'error' | 'success';
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
    metadata?: Record<string, any>;
}

export interface INotificationService {
    send(notification: Omit<INotification, 'id' | 'timestamp' | 'read'>): Promise<void>;
    getNotifications(userId: string, options?: { unreadOnly?: boolean; limit?: number }): Promise<INotification[]>;
    markAsRead(notificationId: string): Promise<void>;
    markAllAsRead(userId: string): Promise<void>;
    deleteNotification(notificationId: string): Promise<void>;
}
