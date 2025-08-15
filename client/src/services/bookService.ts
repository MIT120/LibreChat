import { request } from 'librechat-data-provider';
import type {
  Book,
  ListUserBooksRequest,
  GetLatestExportRequest,
  ExportBookRequest,
  BookExportInfo,
  BookExport,
  GetBookExportHistoryRequest,
} from '~/types/books';

const API_BASE = '/api/mcp/book-creation/tools';

class BookService {
  /**
   * Fetches all books for a specific author
   */
  async listUserBooks(params: ListUserBooksRequest): Promise<Book[]> {
    const response = await request.post(`${API_BASE}/list_user_books/call`, {
      arguments: {
        authorId: params.authorId,
        conversationId: params.conversationId,
        limit: params.limit || 50,
      },
    });

    // Handle the actual MCP response format: result is [formattedContent, artifacts]
    let responseText: string | null = null;

    // Check the new format: result[0][0].text
    if (response?.result?.[0]?.[0]?.text) {
      responseText = response.result[0][0].text;
    }
    // Fallback to old format: result.content[0].text
    else if (response?.result?.content?.[0]?.text) {
      responseText = response.result.content[0].text;
    }

    if (responseText) {
      return this.parseBookListResponse(responseText);
    }

    return [];
  }

  /**
   * Gets the latest export for a specific book
   */
  async getLatestExport(params: GetLatestExportRequest): Promise<BookExportInfo | null> {
    try {
      const response = await request.post(
        `${API_BASE}/get_latest_export/call`,
        {
          arguments: {
            bookId: params.bookId,
            format: params.format,
            authorId: params.authorId,
          },
        },
      );

      // Handle the actual MCP response format: result is [formattedContent, artifacts]
      let exportText: string | null = null;

      // Check the new format: result[0][0].text
      if (response?.result?.[0]?.[0]?.text) {
        exportText = response.result[0][0].text;
      }
      // Fallback to old format: result.content[0].text
      else if (response?.result?.content?.[0]?.text) {
        exportText = response.result.content[0].text;
      }

      if (exportText) {
        return this.parseExportResponse(exportText);
      }

      return null;
    } catch (error) {
      console.error('Failed to get latest export:', error);
      return null;
    }
  }

  /**
   * Triggers a new export for a specific book
   */
  async exportBook(params: ExportBookRequest): Promise<BookExportInfo | null> {
    try {
      const response = await request.post(`${API_BASE}/export_book/call`, {
        arguments: {
          bookId: params.bookId,
          format: params.format,
          authorId: params.authorId,
          includeMetadata: params.includeMetadata,
          aliasFilename: params.aliasFilename,
        },
      });

      // Handle the actual MCP response format: result is [formattedContent, artifacts]
      let exportText: string | null = null;

      // Check the new format: result[0][0].text
      if (response?.result?.[0]?.[0]?.text) {
        exportText = response.result[0][0].text;
      }
      // Fallback to old format: result.content[0].text
      else if (response?.result?.content?.[0]?.text) {
        exportText = response.result.content[0].text;
      }

      if (exportText) {
        return this.parseExportResponse(exportText);
      }

      return null;
    } catch (error) {
      console.error('Failed to export book:', error);
      return null;
    }
  }

  /**
   * Gets export history for a specific book
   */
  async getBookExportHistory(params: GetBookExportHistoryRequest): Promise<BookExport[]> {
    try {
      const response = await request.post(`${API_BASE}/get_export_history/call`, {
        arguments: {
          bookId: params.bookId,
          authorId: params.authorId,
          format: params.format,
          status: params.status,
          limit: params.limit || 20,
          skip: params.skip || 0,
        },
      });

      // Handle the actual MCP response format: result is [formattedContent, artifacts]
      let responseText: string | null = null;

      // Check the new format: result[0][0].text
      if (response?.result?.[0]?.[0]?.text) {
        responseText = response.result[0][0].text;
      }
      // Fallback to old format: result.content[0].text
      else if (response?.result?.content?.[0]?.text) {
        responseText = response.result.content[0].text;
      }

      if (responseText) {
        return this.parseExportHistoryResponse(responseText);
      }

      return [];
    } catch (error) {
      console.error('Failed to get book export history:', error);
      return [];
    }
  }

  /**
   * Parses the book list response text into Book objects
   */
  private parseBookListResponse(responseText: string): Book[] {
    const books: Book[] = [];
    const lines = responseText.split('\n');
    let currentBook: Partial<Book> = {};

    for (const line of lines) {
      if (line.includes('**') && line.includes('**') && !line.includes('- **')) {
        // New book title
        if (currentBook._id) {
          books.push(currentBook as Book);
          currentBook = {};
        }
        const titleMatch = line.match(/\*\*(.+?)\*\*/);
        if (titleMatch) {
          currentBook.title = titleMatch[1];
        }
      } else if (line.includes('- **ID:**')) {
        const idMatch = line.match(/- \*\*ID:\*\*\s*`(.+?)`/);
        if (idMatch) {
          currentBook._id = idMatch[1];
        }
      } else if (line.includes('- **Genre:**')) {
        const genreMatch = line.match(/- \*\*Genre:\*\*\s*(.+)/);
        if (genreMatch) {
          currentBook.genre = genreMatch[1];
        }
      } else if (line.includes('- **Theme:**')) {
        const themeMatch = line.match(/- \*\*Theme:\*\*\s*(.+)/);
        if (themeMatch) {
          currentBook.theme = themeMatch[1];
        }
      } else if (line.includes('- **Status:**')) {
        const statusMatch = line.match(/- \*\*Status:\*\*\s*(.+)/);
        if (statusMatch) {
          currentBook.status = statusMatch[1] as Book['status'];
        }
      } else if (line.includes('- **Progress:**')) {
        const progressMatch = line.match(/- \*\*Progress:\*\*\s*([\d,]+)\s*words/);
        if (progressMatch) {
          currentBook.currentWordCount = parseInt(progressMatch[1].replace(/,/g, ''));
        }
        const targetMatch = line.match(/\/\s*([\d,]+)\s*\(/);
        if (targetMatch) {
          currentBook.targetWordCount = parseInt(targetMatch[1].replace(/,/g, ''));
        }
      } else if (line.includes('- **Description:**')) {
        const descMatch = line.match(/- \*\*Description:\*\*\s*(.+)/);
        if (descMatch) {
          currentBook.description = descMatch[1];
        }
      }
    }

    // Add the last book
    if (currentBook._id) {
      books.push(currentBook as Book);
    }

    return books;
  }

  /**
   * Parses export response text to extract URL and filename
   */
  private parseExportResponse(exportText: string): BookExportInfo | null {
    // Try to extract URL first (most reliable)
    const urlMatch = exportText.match(/\*\*URL:\*\*\s*(.+)/);
    if (urlMatch && urlMatch[1]) {
      return {
        url: urlMatch[1].trim(),
      };
    }

    // Fallback: Extract filename
    const filenameMatch = exportText.match(/\*\*Filename:\*\*\s*(.+)/);
    if (filenameMatch && filenameMatch[1]) {
      return {
        filename: filenameMatch[1].trim(),
      };
    }

    return null;
  }

  /**
   * Parses export history response text into BookExport objects
   */
  private parseExportHistoryResponse(responseText: string): BookExport[] {
    const exports: BookExport[] = [];

    try {
      // The response should be JSON containing export records
      const lines = responseText.split('\n');
      let jsonContent = '';
      let inJsonSection = false;

      for (const line of lines) {
        if (line.includes('```json')) {
          inJsonSection = true;
          continue;
        }
        if (line.includes('```') && inJsonSection) {
          break;
        }
        if (inJsonSection) {
          jsonContent += line + '\n';
        }
      }

      if (jsonContent.trim()) {
        const parsed = JSON.parse(jsonContent.trim());
        if (Array.isArray(parsed)) {
          return parsed.map((exp: any) => ({
            ...exp,
            url: exp.url || `/c/exports/${exp.filename}`,
          }));
        }
      }

      // Fallback: parse markdown format
      const lines2 = responseText.split('\n');
      let currentExport: Partial<BookExport> = {};

      for (const line of lines2) {
        if (line.includes('**Export ID:**')) {
          if (currentExport._id) {
            exports.push(currentExport as BookExport);
            currentExport = {};
          }
          const idMatch = line.match(/\*\*Export ID:\*\*\s*`(.+?)`/);
          if (idMatch) {
            currentExport._id = idMatch[1];
          }
        } else if (line.includes('**Filename:**')) {
          const filenameMatch = line.match(/\*\*Filename:\*\*\s*(.+)/);
          if (filenameMatch) {
            currentExport.filename = filenameMatch[1].trim();
          }
        } else if (line.includes('**Format:**')) {
          const formatMatch = line.match(/\*\*Format:\*\*\s*(.+)/);
          if (formatMatch) {
            currentExport.format = formatMatch[1].trim().toLowerCase() as any;
          }
        } else if (line.includes('**Version:**')) {
          const versionMatch = line.match(/\*\*Version:\*\*\s*(\d+)/);
          if (versionMatch) {
            currentExport.version = parseInt(versionMatch[1]);
          }
        } else if (line.includes('**Status:**')) {
          const statusMatch = line.match(/\*\*Status:\*\*\s*(.+)/);
          if (statusMatch) {
            currentExport.status = statusMatch[1].trim().toLowerCase() as any;
          }
        } else if (line.includes('**Created:**')) {
          const createdMatch = line.match(/\*\*Created:\*\*\s*(.+)/);
          if (createdMatch) {
            currentExport.createdAt = createdMatch[1].trim();
          }
        } else if (line.includes('**URL:**')) {
          const urlMatch = line.match(/\*\*URL:\*\*\s*(.+)/);
          if (urlMatch) {
            currentExport.url = urlMatch[1].trim();
          }
        }
      }

      // Add the last export
      if (currentExport._id) {
        exports.push(currentExport as BookExport);
      }
    } catch (error) {
      console.error('Failed to parse export history response:', error);
    }

    return exports;
  }
}

export const bookService = new BookService();
export default bookService;
