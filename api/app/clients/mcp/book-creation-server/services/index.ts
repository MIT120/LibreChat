// Export all services
export { BookService } from './BookService.js';
export { ConfigService } from './ConfigService.js';

// Re-export service interfaces for convenience
export type {
  IBookService,
  IChapterService,
  IPageService,
  IContentService,
  IExportService,
  IConfigService,
  IBookRepository,
  IChapterRepository,
  IPageRepository,
  ContentGenerationOptions,
  PageGenerationOptions,
  ContentImprovementOptions,
  ExportOptions,
  ExportResult
} from '../types/services.js';