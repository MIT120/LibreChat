import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { IConfigService } from '../types/services.js';
import { AppConfig, DatabaseConfig } from '../types/index.js';
import { ValidationError } from '../types/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ExportConfig {
  outputDirectory: string;
  maxFileSize: number;
  allowedFormats: string[];
  compression: boolean;
}

interface SystemLimits {
  maxTitleLength: number;
  maxDescriptionLength: number;
  maxWordCount: number;
  maxChaptersPerBook: number;
  maxPagesPerChapter: number;
}

interface FeatureFlags {
  enableExport: boolean;
  enableCollaboration: boolean;
  enableAutoSave: boolean;
  enableBackup: boolean;
}

interface AIConfig {
  maxTokens: number;
  temperature: number;
  model: string;
}

interface BookCreationConfig {
  database: DatabaseConfig;
  export: ExportConfig;
  limits: SystemLimits;
  features: FeatureFlags;
  ai: AIConfig;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

interface ExportPath {
  fullPath: string;
  relativePath: string;
  filename: string;
}

export class ConfigService implements IConfigService {
  private config: BookCreationConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): BookCreationConfig {
    const defaultConfig: BookCreationConfig = {
      database: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/librechat',
        options: {
          bufferCommands: false,
          serverSelectionTimeoutMS: 15000,
          connectTimeoutMS: 20000,
          socketTimeoutMS: 45000,
          maxPoolSize: 10,
          minPoolSize: 1,
          maxIdleTimeMS: 30000,
          waitQueueTimeoutMS: 10000,
        },
      },
      export: {
        outputDirectory:
          process.env.EXPORT_DIR ||
          path.resolve(__dirname, '..', '..', '..', '..', '..', 'uploads'),
        maxFileSize: 50 * 1024 * 1024, // 50MB
        allowedFormats: ['pdf', 'epub', 'docx', 'html', 'txt'],
        compression: true,
      },
      limits: {
        maxTitleLength: 300,
        maxDescriptionLength: 2000,
        maxWordCount: 1000000, // 1 million words max
        maxChaptersPerBook: 100,
        maxPagesPerChapter: 50,
      },
      features: {
        enableExport: true,
        enableCollaboration: false,
        enableAutoSave: true,
        enableBackup: true,
      },
      ai: {
        maxTokens: 4000,
        temperature: 0.7,
        model: 'claude-3-sonnet',
      },
    };

    try {
      // Try to load config from file if it exists
      const configPath = process.env.CONFIG_PATH || './config.json';
      if (fs.existsSync(configPath)) {
        const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return { ...defaultConfig, ...fileConfig };
      }
    } catch (error) {
      console.warn('Could not load config file, using defaults:', (error as Error).message);
    }

    return defaultConfig;
  }

  get<T>(key: string): T {
    return key.split('.').reduce((obj: any, k: string) => obj?.[k], this.config) as T;
  }

  set<T>(key: string, value: T): void {
    const keys = key.split('.');
    const lastKey = keys.pop();
    if (!lastKey) return;

    const target = keys.reduce((obj: any, k: string) => {
      if (!obj[k]) obj[k] = {};
      return obj[k];
    }, this.config);
    
    target[lastKey] = value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  getAll(): Record<string, any> {
    return { ...this.config };
  }

  getDatabaseConfig(): DatabaseConfig {
    return this.get<DatabaseConfig>('database');
  }

  getExportConfig(): ExportConfig {
    return this.get<ExportConfig>('export');
  }

  getLimits(): SystemLimits {
    return this.get<SystemLimits>('limits');
  }

  getFeatures(): FeatureFlags {
    return this.get<FeatureFlags>('features');
  }

  getAIConfig(): AIConfig {
    return this.get<AIConfig>('ai');
  }

  isFeatureEnabled(feature: keyof FeatureFlags): boolean {
    return this.get<boolean>(`features.${feature}`) === true;
  }

  validateBookData(bookData: {
    title?: string;
    description?: string;
    targetWordCount?: number;
  }): ValidationResult {
    const limits = this.getLimits();
    const errors: string[] = [];

    if (bookData.title && bookData.title.length > limits.maxTitleLength) {
      errors.push(`Title exceeds maximum length of ${limits.maxTitleLength} characters`);
    }

    if (bookData.description && bookData.description.length > limits.maxDescriptionLength) {
      errors.push(
        `Description exceeds maximum length of ${limits.maxDescriptionLength} characters`,
      );
    }

    if (bookData.targetWordCount && bookData.targetWordCount > limits.maxWordCount) {
      errors.push(`Target word count exceeds maximum of ${limits.maxWordCount} words`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  validateExportRequest(format: string): ValidationResult {
    const exportConfig = this.getExportConfig();

    if (!this.isFeatureEnabled('enableExport')) {
      return {
        isValid: false,
        errors: ['Export feature is disabled'],
      };
    }

    if (!exportConfig.allowedFormats.includes(format)) {
      return {
        isValid: false,
        errors: [
          `Format '${format}' is not supported. Allowed formats: ${exportConfig.allowedFormats.join(', ')}`,
        ],
      };
    }

    return {
      isValid: true,
      errors: [],
    };
  }

  ensureExportDirectory(): string {
    const exportDir = this.get<string>('export.outputDirectory');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    return exportDir;
  }

  getExportPath(bookId: string, format: string, userId: string): ExportPath {
    const exportDir = this.ensureExportDirectory();
    // Create user-specific directory
    const userDir = path.join(exportDir, userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `book-${bookId}-${timestamp}.${format}`;
    return {
      fullPath: path.join(userDir, filename),
      relativePath: path.posix.join('/', 'uploads', userId, filename),
      filename: filename,
    };
  }
}