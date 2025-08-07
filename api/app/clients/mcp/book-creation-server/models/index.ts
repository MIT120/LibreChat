// Export all models
export { Book, type IBookDocument } from './Book.js';
export { Chapter, type IChapterDocument } from './Chapter.js';
export { Page, type IPageDocument, type IPageImage, type IImagePlacement, type IContextAnalysis, type IPageWithImages } from './Page.js';

// Re-export types for convenience
export type {
  IBook,
  IChapter,
  IPage,
  IWritingStyle,
  IPublishingInfo,
  IBookMetadata,
  IBookSettings,
  BookStatus,
  ChapterStatus,
  PageStatus,
  WritingTone,
  WritingVoice,
  VocabularyLevel,
  SentenceStructure,
  ExportFormat,
  BackupFrequency
} from '../types/book.js';