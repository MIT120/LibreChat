// Core entity interface
export interface IEntity {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
}

// Base repository interface
export interface IRepository<T extends IEntity> {
  create(data: Partial<T>): Promise<T>;
  findById(id: string): Promise<T | null>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<boolean>;
  findMany(query: Record<string, any>): Promise<T[]>;
}

// Pagination interfaces
export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Query options
export interface FindOptions {
  includeRelations?: boolean;
  select?: string[];
  sort?: Record<string, 1 | -1>;
}

// Error types
export interface ValidationIssue {
  field: string;
  message: string;
  code: string;
}

export interface ErrorContext {
  [key: string]: any;
}

// Service interfaces
export interface ILogger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

export interface ICache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface IValidator {
  validate<T>(schema: any, data: unknown): Promise<T>;
  validatePartial<T>(schema: any, data: unknown): Promise<Partial<T>>;
}

export interface IEventEmitter {
  emit(event: string, data: any): void;
  on(event: string, handler: (data: any) => void): void;
  off(event: string, handler: (data: any) => void): void;
}

// Configuration interfaces
export interface DatabaseConfig {
  uri: string;
  options: {
    bufferCommands: boolean;
    serverSelectionTimeoutMS: number;
    connectTimeoutMS: number;
    socketTimeoutMS: number;
    maxPoolSize: number;
    minPoolSize: number;
    maxIdleTimeMS: number;
    waitQueueTimeoutMS: number;
  };
}

export interface ServerConfig {
  name: string;
  version: string;
  port?: number;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text';
  destination: 'console' | 'file';
  filename?: string;
}

export interface FeatureFlags {
  enableCaching: boolean;
  enableMetrics: boolean;
  enableDebugMode: boolean;
}

export interface SystemLimits {
  maxBookSize: number;
  maxChapterSize: number;
  maxPageSize: number;
  requestTimeout: number;
}

export interface AppConfig {
  database: DatabaseConfig;
  server: ServerConfig;
  logging: LoggingConfig;
  features: FeatureFlags;
  limits: SystemLimits;
}