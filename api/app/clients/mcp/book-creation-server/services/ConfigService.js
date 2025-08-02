import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ConfigService {
  constructor() {
    this.config = this.loadConfig();
  }

  loadConfig() {
    const defaultConfig = {
      database: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/librechat',
        options: {
          useNewUrlParser: true,
          useUnifiedTopology: true,
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
      console.warn('Could not load config file, using defaults:', error.message);
    }

    return defaultConfig;
  }

  get(key) {
    return key.split('.').reduce((obj, k) => obj?.[k], this.config);
  }

  set(key, value) {
    const keys = key.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((obj, k) => {
      if (!obj[k]) obj[k] = {};
      return obj[k];
    }, this.config);
    target[lastKey] = value;
  }

  getDatabaseConfig() {
    return this.get('database');
  }

  getExportConfig() {
    return this.get('export');
  }

  getLimits() {
    return this.get('limits');
  }

  getFeatures() {
    return this.get('features');
  }

  getAIConfig() {
    return this.get('ai');
  }

  isFeatureEnabled(feature) {
    return this.get(`features.${feature}`) === true;
  }

  validateBookData(bookData) {
    const limits = this.getLimits();
    const errors = [];

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

  validateExportRequest(format) {
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

  ensureExportDirectory() {
    const exportDir = this.get('export.outputDirectory');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    return exportDir;
  }

  getExportPath(bookId, format, userId) {
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
