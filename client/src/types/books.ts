export interface Book {
  _id: string;
  title: string;
  genre: string;
  theme: string;
  status: BookStatus;
  currentWordCount: number;
  targetWordCount?: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export type BookStatus =
  | 'planning'
  | 'outlining'
  | 'writing'
  | 'editing'
  | 'review'
  | 'completed'
  | 'published';

export interface ListUserBooksRequest {
  authorId: string;
  conversationId: string;
  limit?: number;
}

export interface ListUserBooksResponse {
  result: [
    Array<{
      type: string;
      text: string;
    }>,
    any // artifacts, usually null
  ] | {
    content: Array<{
      text: string;
    }>;
  };
}

export interface GetLatestExportRequest {
  bookId: string;
  format: 'html' | 'pdf' | 'docx';
  authorId: string;
}

export interface GetLatestExportResponse {
  result: [
    Array<{
      type: string;
      text: string;
    }>,
    any // artifacts, usually null
  ] | {
    content: Array<{
      text: string;
    }>;
  };
}

export interface ExportBookRequest {
  bookId: string;
  format: 'html' | 'pdf' | 'docx';
  authorId: string;
  includeMetadata?: boolean;
  aliasFilename?: string;
}

export interface ExportBookResponse {
  result: [
    Array<{
      type: string;
      text: string;
    }>,
    any // artifacts, usually null
  ] | {
    content: Array<{
      text: string;
    }>;
  };
}

export interface BookExportInfo {
  url?: string;
  filename?: string;
}

export interface BookExport {
  _id: string;
  bookId: string;
  authorId: string;
  conversationId: string;
  format: 'pdf' | 'html' | 'txt' | 'epub' | 'docx';
  filename: string;
  filepath: string;
  size: number;
  version: number;
  metadata: {
    includeMetadata: boolean;
    aliasFilename?: string;
    bookTitle: string;
    bookTheme?: string;
    bookGenre?: string;
    exportOptions?: Record<string, any>;
  };
  status: 'pending' | 'completed' | 'failed' | 'deleted';
  error?: string;
  downloadCount: number;
  lastDownloaded?: string;
  createdAt: string;
  updatedAt: string;
  url?: string;
}

export interface GetBookExportHistoryRequest {
  bookId: string;
  authorId: string;
  format?: string;
  status?: string;
  limit?: number;
  skip?: number;
}

export interface GetBookExportHistoryResponse {
  result: [
    Array<{
      type: string;
      text: string;
    }>,
    any // artifacts, usually null
  ] | {
    content: Array<{
      text: string;
    }>;
  };
}
