import fs from 'fs';
import path from 'path';
import { Book } from '../models/Book.js';
import { Chapter } from '../models/Chapter.js';
import { Page } from '../models/Page.js';
import { ConfigService } from './ConfigService.js';

export class ExportService {
  constructor() {
    this.configService = new ConfigService();
  }

  async exportBook(bookId, format, options = {}) {
    try {
      // Validate the export request
      const validation = this.configService.validateExportRequest(format);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      // Get the book with all content
      const book = await this._getBookWithContent(bookId);

      // Verify author permission if provided
      if (options.authorId && book.authorId !== options.authorId) {
        throw new Error('Unauthorized: You can only export your own books');
      }

      // Generate the export based on format
      const exportData = await this._generateExport(book, format, options);

      return exportData;
    } catch (error) {
      throw new Error(`Failed to export book: ${error.message}`);
    }
  }

  async _getBookWithContent(bookId) {
    // Note: Database connection is handled by the BookService in the main server
    const book = await Book.findById(bookId);
    if (!book) {
      throw new Error(`Book with ID ${bookId} not found`);
    }

    // Get all chapters
    const chapters = await Chapter.find({ bookId }).sort({ chapterNumber: 1 });

    // Get all pages for each chapter
    for (const chapter of chapters) {
      chapter.pages = await Page.find({ chapterId: chapter._id }).sort({ pageNumber: 1 });
    }

    return {
      ...book.toObject(),
      chapters,
    };
  }

  async _generateExport(book, format, options) {
    switch (format.toLowerCase()) {
      case 'txt':
        return await this._exportAsTxt(book, options);
      case 'html':
        return await this._exportAsHtml(book, options);
      case 'pdf':
        return await this._exportAsPdf(book, options);
      case 'epub':
        return await this._exportAsEpub(book, options);
      case 'docx':
        return await this._exportAsDocx(book, options);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  async _exportAsTxt(book, options) {
    let content = '';

    if (options.includeMetadata !== false) {
      content += `${book.title}\n`;
      if (book.subtitle) content += `${book.subtitle}\n`;
      content += `${'='.repeat(50)}\n\n`;
      content += `Author: ${book.authorId}\n`;
      content += `Genre: ${book.genre}\n`;
      content += `Theme: ${book.theme}\n`;
      if (book.description) content += `Description: ${book.description}\n`;
      content += `\n${'='.repeat(50)}\n\n`;
    }

    // Add chapters and pages
    for (const chapter of book.chapters || []) {
      content += `Chapter ${chapter.chapterNumber}: ${chapter.title}\n`;
      content += `${'-'.repeat(30)}\n`;

      if (chapter.description) {
        content += `${chapter.description}\n\n`;
      }

      for (const page of chapter.pages || []) {
        content += `${page.title}\n\n`;
        content += `${page.content}\n\n`;
      }

      content += '\n';
    }

    const filePath = this.configService.getExportPath(book._id, 'txt');
    fs.writeFileSync(filePath, content, 'utf8');

    return {
      path: filePath,
      size: Buffer.byteLength(content, 'utf8'),
      format: 'txt',
      bookId: book._id,
      exportedAt: new Date(),
    };
  }

  async _exportAsHtml(book, options) {
    let html = `<!DOCTYPE html>
<html lang="${book.metadata?.language || 'en'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${book.title}</title>
    <style>
        body { font-family: Georgia, serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
        .book-title { font-size: 2.5em; text-align: center; margin-bottom: 0.5em; }
        .book-subtitle { font-size: 1.5em; text-align: center; color: #666; margin-bottom: 2em; }
        .metadata { border: 1px solid #ddd; padding: 20px; margin-bottom: 2em; background: #f9f9f9; }
        .chapter { margin-bottom: 3em; page-break-before: always; }
        .chapter-title { font-size: 1.8em; border-bottom: 2px solid #333; padding-bottom: 0.5em; }
        .page { margin-bottom: 2em; }
        .page-title { font-size: 1.3em; margin-bottom: 1em; font-weight: bold; }
        .page-content { margin-bottom: 1.5em; }
    </style>
</head>
<body>`;

    if (options.includeMetadata !== false) {
      html += `
    <div class="book-header">
        <h1 class="book-title">${book.title}</h1>
        ${book.subtitle ? `<h2 class="book-subtitle">${book.subtitle}</h2>` : ''}
    </div>
    
    <div class="metadata">
        <h3>Book Information</h3>
        <p><strong>Author:</strong> ${book.authorId}</p>
        <p><strong>Genre:</strong> ${book.genre}</p>
        <p><strong>Theme:</strong> ${book.theme}</p>
        ${book.description ? `<p><strong>Description:</strong> ${book.description}</p>` : ''}
        <p><strong>Status:</strong> ${book.status}</p>
        <p><strong>Word Count:</strong> ${book.currentWordCount}</p>
    </div>`;
    }

    // Add chapters
    for (const chapter of book.chapters || []) {
      html += `
    <div class="chapter">
        <h2 class="chapter-title">Chapter ${chapter.chapterNumber}: ${chapter.title}</h2>
        ${chapter.description ? `<p><em>${chapter.description}</em></p>` : ''}`;

      for (const page of chapter.pages || []) {
        html += `
        <div class="page">
            <h3 class="page-title">${page.title}</h3>
            <div class="page-content">${page.content.replace(/\n/g, '<br>')}</div>
        </div>`;
      }

      html += `</div>`;
    }

    html += `
</body>
</html>`;

    const filePath = this.configService.getExportPath(book._id, 'html');
    fs.writeFileSync(filePath, html, 'utf8');

    return {
      path: filePath,
      size: Buffer.byteLength(html, 'utf8'),
      format: 'html',
      bookId: book._id,
      exportedAt: new Date(),
    };
  }

  async _exportAsPdf(book, options) {
    // For now, we'll create a simple text version and note that PDF generation
    // would require additional libraries like puppeteer or PDFKit
    const txtExport = await this._exportAsTxt(book, options);

    // Move the file to have .pdf extension
    const pdfPath = this.configService.getExportPath(book._id, 'pdf');
    fs.renameSync(txtExport.path, pdfPath);

    return {
      ...txtExport,
      path: pdfPath,
      format: 'pdf',
      note: 'PDF export is currently in text format. Full PDF formatting requires additional libraries.',
    };
  }

  async _exportAsEpub(book, options) {
    // EPUB is a complex format requiring zip and XML generation
    // For now, we'll export as HTML and note the limitation
    const htmlExport = await this._exportAsHtml(book, options);

    const epubPath = this.configService.getExportPath(book._id, 'epub');
    fs.renameSync(htmlExport.path, epubPath);

    return {
      ...htmlExport,
      path: epubPath,
      format: 'epub',
      note: 'EPUB export is currently in HTML format. Full EPUB generation requires additional libraries.',
    };
  }

  async _exportAsDocx(book, options) {
    // DOCX requires complex XML generation
    // For now, we'll export as HTML and note the limitation
    const htmlExport = await this._exportAsHtml(book, options);

    const docxPath = this.configService.getExportPath(book._id, 'docx');
    fs.renameSync(htmlExport.path, docxPath);

    return {
      ...htmlExport,
      path: docxPath,
      format: 'docx',
      note: 'DOCX export is currently in HTML format. Full DOCX generation requires additional libraries.',
    };
  }

  async listExports(bookId) {
    const exportDir = this.configService.get('export.outputDirectory');
    if (!fs.existsSync(exportDir)) {
      return [];
    }

    const files = fs.readdirSync(exportDir);
    const bookExports = files
      .filter((file) => file.startsWith(`book-${bookId}-`))
      .map((file) => {
        const filePath = path.join(exportDir, file);
        const stats = fs.statSync(filePath);
        const format = path.extname(file).substring(1);

        return {
          filename: file,
          path: filePath,
          format,
          size: stats.size,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    return bookExports;
  }

  async deleteExport(filePath) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }
}
