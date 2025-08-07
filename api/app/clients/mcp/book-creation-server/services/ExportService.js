import fs from 'fs';
import { FileSources } from 'librechat-data-provider';
import path from 'path';
import PDFDocument from 'pdfkit';
import { v4 as uuidv4 } from 'uuid';
import { createFile } from '../../../../../models/File.js';

export class ExportService {
  constructor(bookService, imageService) {
    this.bookService = bookService;
    this.imageService = imageService;
    this.exportsDir = path.join(process.cwd(), 'exports');
    this.ensureExportsDirectory();
  }

  ensureExportsDirectory() {
    try {
      if (!fs.existsSync(this.exportsDir)) {
        fs.mkdirSync(this.exportsDir, { recursive: true });
      }
      // Test write permissions by creating a test file
      const testFile = path.join(this.exportsDir, '.write-test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
    } catch (error) {
      if (error.code === 'EACCES' || error.code === 'ENOENT') {
        console.warn(
          `Permission denied or directory not accessible: ${this.exportsDir}. Falling back to temporary directory.`,
        );
        // Try to create in a different location if the main one fails
        const fallbackDir = '/tmp/exports';
        console.log(`Falling back to ${fallbackDir}`);
        this.exportsDir = fallbackDir;
        try {
          fs.mkdirSync(this.exportsDir, { recursive: true });
          console.log(`Successfully created fallback directory: ${this.exportsDir}`);
        } catch (fallbackError) {
          console.error('Failed to create fallback directory:', fallbackError);
          throw new Error(
            `Cannot create exports directory in either ${path.join(process.cwd(), 'exports')} or ${fallbackDir}`,
          );
        }
      } else {
        console.error('Unexpected error creating exports directory:', error);
        throw error;
      }
    }
  }

  // Helper method to detect Cyrillic characters
  containsCyrillic(text) {
    if (!text) return false;
    // Cyrillic Unicode range: U+0400-U+04FF
    const cyrillicRegex = /[\u0400-\u04FF]/;
    return cyrillicRegex.test(text);
  }

  // Helper method to set appropriate font based on text content
  setFont(doc, fontType, text = '') {
    const needsCyrillic = this.containsCyrillic(text);

    if (needsCyrillic) {
      // Use Times fonts which have better Unicode support in PDFKit
      switch (fontType) {
        case 'bold':
          doc.font('Times-Bold');
          break;
        case 'italic':
          doc.font('Times-Italic');
          break;
        case 'bold-italic':
          doc.font('Times-BoldItalic');
          break;
        default:
          doc.font('Times-Roman');
          break;
      }
    } else {
      // Use Helvetica for non-Cyrillic text
      switch (fontType) {
        case 'bold':
          doc.font('Helvetica-Bold');
          break;
        case 'italic':
          doc.font('Helvetica-Oblique');
          break;
        case 'bold-italic':
          doc.font('Helvetica-BoldOblique');
          break;
        default:
          doc.font('Helvetica');
          break;
      }
    }
    return doc;
  }

  // Helper method to check if any content in book data contains Cyrillic
  bookContainsCyrillic(bookData) {
    const textsToCheck = [
      bookData.title,
      bookData.subtitle,
      bookData.description,
      bookData.genre,
      bookData.theme,
      bookData.targetAudience,
    ];

    // Check chapters and pages
    if (bookData.chapters) {
      bookData.chapters.forEach((chapter) => {
        textsToCheck.push(chapter.title, chapter.description);
        if (chapter.pages) {
          chapter.pages.forEach((page) => {
            textsToCheck.push(page.title, page.content);
          });
        }
      });
    }

    return textsToCheck.some((text) => this.containsCyrillic(text));
  }

  async exportBook(bookId, format, options = {}) {
    const { includeMetadata = true, authorId } = options;

    try {
      // Fetch the complete book data with chapters and pages
      const bookData = await this.bookService.getBook(bookId, {
        includeChapters: true,
        includePages: true,
      });

      // Verify author permissions
      if (bookData.authorId !== authorId) {
        throw new Error('Unauthorized: You can only export your own books');
      }

      // Fetch images for the book
      const bookImages = this.imageService
        ? await this.imageService.getBookImages(bookId, { status: 'approved' })
        : [];

      // Organize images by chapter and page
      bookData.imagesByChapter = this.organizeImagesByChapter(bookImages);
      bookData.allImages = bookImages;

      switch (format) {
        case 'pdf':
          return await this.exportToPDF(bookData, includeMetadata);
        case 'txt':
          return await this.exportToText(bookData, includeMetadata);
        case 'html':
          return await this.exportToHTML(bookData, includeMetadata);
        case 'docx':
          return await this.exportToDocx(bookData, includeMetadata);
        default:
          throw new Error(
            `Export format '${format}' is not supported yet. Supported formats: pdf, txt, html, docx`,
          );
      }
    } catch (error) {
      throw new Error(`Export failed: ${error.message}`);
    }
  }

  async exportToPDF(bookData, includeMetadata) {
    const filename = this.generateFilename(bookData.title, 'pdf');
    const filepath = path.join(this.exportsDir, filename);
    const fileId = uuidv4();

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: {
            top: 72,
            bottom: 72,
            left: 72,
            right: 72,
          },
          bufferPages: true,
          autoFirstPage: false,
          info: {
            Title: bookData.title,
            Author: bookData.publishingInfo?.publisher || 'Unknown',
            Subject: bookData.theme,
            Keywords: bookData.metadata?.keywords?.join(', ') || '',
            Creator: 'LibreChat Book Creation System',
          },
        });

        // Add first page to enable Unicode text rendering
        doc.addPage();

        const stream = fs.createWriteStream(filepath);
        doc.pipe(stream);

        // Generate PDF content
        this.generateTitlePage(doc, bookData, includeMetadata);
        this.generateTableOfContents(doc, bookData);
        this.generateBookContent(doc, bookData);

        doc.end();

        stream.on('finish', async () => {
          try {
            const stats = fs.statSync(filepath);

            // Register file with LibreChat
            const registration = await this.registerFileWithLibreChat(
              filename,
              filepath,
              bookData.authorId,
              stats.size,
              'pdf',
            );

            const downloadUrl = registration.success
              ? `files/download/${bookData.authorId}/${registration.file.file_id}`
              : `exports/${filename}`;

            resolve({
              success: true,
              bookTitle: bookData.title,
              format: 'pdf',
              filename: filename,
              filepath: filepath,
              file_id: registration.file?.file_id || fileId,
              userId: bookData.authorId,
              size: stats.size,
              exportedAt: new Date().toISOString(),
              downloadInfo: {
                downloadMethods: [
                  {
                    method: registration.success ? 'librechat' : 'direct',
                    url: downloadUrl,
                    filename: filename,
                  },
                ],
              },
              librechatRegistered: registration.librechatRegistered,
              registrationError: registration.error,
              exportMode: 'standard',
            });
          } catch (error) {
            reject(new Error(`PDF file creation failed: ${error.message}`));
          }
        });

        stream.on('error', (error) => {
          reject(new Error(`PDF generation failed: ${error.message}`));
        });
      } catch (error) {
        reject(new Error(`PDF export error: ${error.message}`));
      }
    });
  }

  generateTitlePage(doc, bookData, includeMetadata) {
    // Title page
    doc.fontSize(28);
    this.setFont(doc, 'bold', bookData.title);
    doc.text(bookData.title, { align: 'center' });

    if (bookData.subtitle) {
      doc.moveDown(0.5);
      doc.fontSize(18);
      this.setFont(doc, 'normal', bookData.subtitle);
      doc.text(bookData.subtitle, { align: 'center' });
    }

    doc.moveDown(2);
    doc.fontSize(14);
    this.setFont(doc, 'normal', bookData.genre + bookData.theme);
    doc.text(`Genre: ${bookData.genre}`, { align: 'center' });
    doc.text(`Theme: ${bookData.theme}`, { align: 'center' });

    if (bookData.targetAudience) {
      doc.text(`Target Audience: ${bookData.targetAudience}`, { align: 'center' });
    }

    // Metadata section
    if (includeMetadata && bookData.metadata) {
      doc.moveDown(2);
      doc.fontSize(12);
      this.setFont(doc, 'bold', 'Book Information');
      doc.text('Book Information', { align: 'left' });
      this.setFont(doc, 'normal', bookData.description || '');

      if (bookData.description) {
        doc.moveDown(0.5);
        doc.text('Description:', { continued: false });
        doc.text(bookData.description, {
          width: doc.page.width - 144,
          align: 'justify',
        });
      }

      if (bookData.publishingInfo) {
        doc.moveDown(1);
        if (bookData.publishingInfo.publisher) {
          doc.text(`Publisher: ${bookData.publishingInfo.publisher}`);
        }
        if (bookData.publishingInfo.isbn) {
          doc.text(`ISBN: ${bookData.publishingInfo.isbn}`);
        }
        if (bookData.publishingInfo.publicationDate) {
          doc.text(
            `Publication Date: ${new Date(bookData.publishingInfo.publicationDate).toLocaleDateString()}`,
          );
        }
      }

      // Writing style information
      if (bookData.writingStyle) {
        doc.moveDown(1);
        doc.text('Writing Style:', { continued: false });
        doc.text(`Tone: ${bookData.writingStyle.tone}`);
        doc.text(`Voice: ${bookData.writingStyle.voice}`);
        doc.text(`Vocabulary: ${bookData.writingStyle.vocabulary}`);
        doc.text(`Sentence Structure: ${bookData.writingStyle.sentenceStructure}`);
      }

      // Statistics
      doc.moveDown(1);
      doc.text(`Word Count: ${bookData.currentWordCount.toLocaleString()}`);
      if (bookData.targetWordCount) {
        doc.text(`Target Word Count: ${bookData.targetWordCount.toLocaleString()}`);
      }
      if (bookData.chapters) {
        doc.text(`Chapters: ${bookData.chapters.length}`);
        const totalPages = bookData.chapters.reduce(
          (total, chapter) => total + (chapter.pages ? chapter.pages.length : 0),
          0,
        );
        doc.text(`Total Pages: ${totalPages}`);
      }
    }

    // Add creation date
    doc.moveDown(2);
    doc.fontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });

    doc.addPage();
  }

  generateTableOfContents(doc, bookData) {
    if (!bookData.chapters || bookData.chapters.length === 0) {
      return;
    }

    doc.fontSize(20);
    this.setFont(doc, 'bold', 'Table of Contents');
    doc.text('Table of Contents', { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(12);
    // Check if any chapter titles contain Cyrillic
    const chaptersText = bookData.chapters.map((ch) => ch.title).join(' ');
    this.setFont(doc, 'normal', chaptersText);

    bookData.chapters.forEach((chapter, index) => {
      const chapterText = `Chapter ${chapter.chapterNumber}: ${chapter.title}`;
      doc.text(chapterText, {
        continued: true,
        width: doc.page.width - 200,
      });

      // Add dots and page number (simplified - in real implementation you'd track actual page numbers)
      const dots = '.'.repeat(Math.max(1, 50 - chapterText.length));
      doc.text(` ${dots} ${index + 3}`, { align: 'right' });

      // Show pages if they exist
      if (chapter.pages && chapter.pages.length > 0) {
        chapter.pages.forEach((page) => {
          const pageText = `  ${page.title}`;
          doc.fontSize(10);
          doc.text(pageText, {
            continued: true,
            width: doc.page.width - 220,
            indent: 20,
          });
          const pageDots = '.'.repeat(Math.max(1, 45 - pageText.length));
          doc.text(` ${pageDots} ${index + 3}`, { align: 'right' });
          doc.fontSize(12);
        });
      }

      doc.moveDown(0.3);
    });

    doc.addPage();
  }

  generateBookContent(doc, bookData) {
    if (!bookData.chapters || bookData.chapters.length === 0) {
      doc.fontSize(14);
      this.setFont(doc, 'normal', 'No content available for this book.');
      doc.text('No content available for this book.');
      return;
    }

    bookData.chapters.forEach((chapter, chapterIndex) => {
      // Chapter title
      doc.fontSize(18);
      const chapterTitle = `Chapter ${chapter.chapterNumber}: ${chapter.title}`;
      this.setFont(doc, 'bold', chapterTitle);
      doc.text(chapterTitle, {
        align: 'left',
      });

      // Chapter description
      if (chapter.description) {
        doc.moveDown(0.5);
        doc.fontSize(12);
        this.setFont(doc, 'italic', chapter.description);
        doc.text(chapter.description, {
          width: doc.page.width - 144,
          align: 'justify',
        });
      }

      doc.moveDown(1);

      // Chapter pages
      if (chapter.pages && chapter.pages.length > 0) {
        const chapterImages = bookData.imagesByChapter[chapter._id] || [];

        chapter.pages.forEach((page, pageIndex) => {
          // Add images before page
          const beforeImages = this.getImagesForPage(chapterImages, page.pageNumber, 'before');
          beforeImages.forEach((image) => {
            doc.fontSize(10);
            this.setFont(doc, 'italic', `[IMAGE: ${image.prompt.original}]`);
            doc.text(`[IMAGE: ${image.prompt.original}]`, { align: 'center' });
            doc.fontSize(9);
            this.setFont(doc, 'normal', `(Image file: ${image.filename})`);
            doc.text(`(Image file: ${image.filename})`, { align: 'center' });
            doc.moveDown(0.5);
          });

          // Page title
          doc.fontSize(14);
          this.setFont(doc, 'bold', page.title);
          doc.text(page.title);
          doc.moveDown(0.5);

          // Page content
          doc.fontSize(11);
          this.setFont(doc, 'normal', page.content);
          doc.text(page.content, {
            width: doc.page.width - 144,
            align: 'justify',
            lineGap: 2,
          });

          // Page notes if available
          if (page.notes) {
            doc.moveDown(0.5);
            doc.fontSize(9);
            this.setFont(doc, 'italic', page.notes);
            doc.text(`Notes: ${page.notes}`, {
              width: doc.page.width - 144,
            });
          }

          // Add images between/after page
          const betweenImages = this.getImagesForPage(chapterImages, page.pageNumber, 'between');
          const afterImages = this.getImagesForPage(chapterImages, page.pageNumber, 'after');

          [...betweenImages, ...afterImages].forEach((image) => {
            doc.moveDown(0.5);
            doc.fontSize(10);
            this.setFont(doc, 'italic', `[IMAGE: ${image.prompt.original}]`);
            doc.text(`[IMAGE: ${image.prompt.original}]`, { align: 'center' });
            doc.fontSize(9);
            this.setFont(doc, 'normal', `(Image file: ${image.filename})`);
            doc.text(`(Image file: ${image.filename})`, { align: 'center' });
          });

          // Add space between pages
          if (pageIndex < chapter.pages.length - 1) {
            doc.moveDown(1);
            this.setFont(doc, 'normal', '---');
            doc.text('---', { align: 'center' });
            doc.moveDown(1);
          }
        });
      } else {
        // No pages in chapter
        doc.fontSize(11);
        this.setFont(doc, 'italic', '[Chapter content not yet written]');
        doc.text('[Chapter content not yet written]');
      }

      // Add page break between chapters (except for the last one)
      if (chapterIndex < bookData.chapters.length - 1) {
        doc.addPage();
      }
    });
  }

  async exportToText(bookData, includeMetadata) {
    const filename = this.generateFilename(bookData.title, 'txt');
    const filepath = path.join(this.exportsDir, filename);
    const fileId = uuidv4();

    let content = '';

    // Title and metadata
    content += `${bookData.title}\n`;
    if (bookData.subtitle) {
      content += `${bookData.subtitle}\n`;
    }
    content += '='.repeat(Math.max(bookData.title.length, 50)) + '\n\n';

    if (includeMetadata) {
      content += `Genre: ${bookData.genre}\n`;
      content += `Theme: ${bookData.theme}\n`;
      if (bookData.targetAudience) {
        content += `Target Audience: ${bookData.targetAudience}\n`;
      }
      if (bookData.description) {
        content += `\nDescription:\n${bookData.description}\n`;
      }
      content += `\nWord Count: ${bookData.currentWordCount.toLocaleString()}\n`;
      if (bookData.chapters) {
        content += `Chapters: ${bookData.chapters.length}\n`;
      }
      content += `\nGenerated on: ${new Date().toLocaleDateString()}\n`;
      content += '\n' + '='.repeat(50) + '\n\n';
    }

    // Table of contents
    if (bookData.chapters && bookData.chapters.length > 0) {
      content += 'TABLE OF CONTENTS\n\n';
      bookData.chapters.forEach((chapter) => {
        content += `Chapter ${chapter.chapterNumber}: ${chapter.title}\n`;
        if (chapter.pages && chapter.pages.length > 0) {
          chapter.pages.forEach((page) => {
            content += `  - ${page.title}\n`;
          });
        }
      });
      content += '\n' + '='.repeat(50) + '\n\n';
    }

    // Book content
    if (bookData.chapters && bookData.chapters.length > 0) {
      bookData.chapters.forEach((chapter) => {
        content += `CHAPTER ${chapter.chapterNumber}: ${chapter.title.toUpperCase()}\n`;
        content += '-'.repeat(Math.max(chapter.title.length + 20, 50)) + '\n\n';

        if (chapter.description) {
          content += `${chapter.description}\n\n`;
        }

        if (chapter.pages && chapter.pages.length > 0) {
          const chapterImages = bookData.imagesByChapter[chapter._id] || [];

          chapter.pages.forEach((page) => {
            // Add images before page
            const beforeImages = this.getImagesForPage(chapterImages, page.pageNumber, 'before');
            beforeImages.forEach((image) => {
              content += `[IMAGE: ${image.prompt.original}]\n`;
              content += `(Image file: ${image.filename})\n\n`;
            });

            content += `${page.title}\n`;
            content += '~'.repeat(page.title.length) + '\n\n';
            content += `${page.content}\n\n`;

            if (page.notes) {
              content += `Notes: ${page.notes}\n\n`;
            }

            // Add images between/after page
            const betweenImages = this.getImagesForPage(chapterImages, page.pageNumber, 'between');
            const afterImages = this.getImagesForPage(chapterImages, page.pageNumber, 'after');

            [...betweenImages, ...afterImages].forEach((image) => {
              content += `[IMAGE: ${image.prompt.original}]\n`;
              content += `(Image file: ${image.filename})\n\n`;
            });
          });
        } else {
          content += '[Chapter content not yet written]\n\n';
        }

        content += '\n';
      });
    } else {
      content += 'No content available for this book.\n';
    }

    try {
      fs.writeFileSync(filepath, content, 'utf8');
      const stats = fs.statSync(filepath);

      // Register file with LibreChat
      const registration = await this.registerFileWithLibreChat(
        filename,
        filepath,
        bookData.authorId,
        stats.size,
        'txt',
      );

      const downloadUrl = registration.success
        ? `files/download/${bookData.authorId}/${registration.file.file_id}`
        : `exports/${filename}`;

      return {
        success: true,
        bookTitle: bookData.title,
        format: 'txt',
        filename: filename,
        filepath: filepath,
        file_id: registration.file?.file_id || fileId,
        userId: bookData.authorId,
        size: stats.size,
        exportedAt: new Date().toISOString(),
        downloadInfo: {
          downloadMethods: [
            {
              method: registration.success ? 'librechat' : 'direct',
              url: downloadUrl,
              filename: filename,
            },
          ],
        },
        librechatRegistered: registration.librechatRegistered,
        registrationError: registration.error,
        exportMode: 'standard',
      };
    } catch (error) {
      throw new Error(`Text export failed: ${error.message}`);
    }
  }

  async exportToHTML(bookData, includeMetadata) {
    const filename = this.generateFilename(bookData.title, 'html');
    const filepath = path.join(this.exportsDir, filename);
    const fileId = uuidv4();

    let html = `<!DOCTYPE html>
<html lang="${bookData.metadata?.language || 'en'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(bookData.title)}</title>
    <style>
        body {
            font-family: 'Georgia', 'Times New Roman', serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #fafafa;
        }
        .title-page {
            text-align: center;
            margin-bottom: 40px;
            padding: 40px 0;
            border-bottom: 2px solid #333;
        }
        .book-title {
            font-size: 2.5em;
            margin-bottom: 10px;
            color: #333;
        }
        .book-subtitle {
            font-size: 1.3em;
            margin-bottom: 20px;
            color: #666;
        }
        .metadata {
            text-align: left;
            margin: 20px 0;
            padding: 20px;
            background-color: #f0f0f0;
            border-radius: 5px;
        }
        .toc {
            margin: 30px 0;
            padding: 20px;
            background-color: #f9f9f9;
            border-left: 4px solid #333;
        }
        .toc h2 {
            margin-top: 0;
        }
        .toc ul {
            list-style-type: none;
            padding-left: 0;
        }
        .toc li {
            margin: 5px 0;
            padding: 5px 0;
            border-bottom: 1px dotted #ccc;
        }
        .chapter {
            margin: 40px 0;
            padding: 20px 0;
            border-top: 2px solid #ddd;
        }
        .chapter-title {
            font-size: 1.8em;
            margin-bottom: 10px;
            color: #333;
        }
        .chapter-description {
            font-style: italic;
            margin-bottom: 20px;
            color: #666;
        }
        .page {
            margin: 25px 0;
            padding: 15px;
            background-color: white;
            border-radius: 5px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .page-title {
            font-size: 1.2em;
            font-weight: bold;
            margin-bottom: 10px;
            color: #444;
        }
        .page-content {
            text-align: justify;
            margin-bottom: 10px;
        }
        .page-notes {
            font-size: 0.9em;
            font-style: italic;
            color: #666;
            border-left: 3px solid #ddd;
            padding-left: 10px;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding: 20px;
            font-size: 0.9em;
            color: #666;
            border-top: 1px solid #ddd;
        }
        .image-container {
            text-align: center;
            margin: 2rem 0;
            page-break-inside: avoid;
        }
        .book-image {
            max-width: 100%;
            height: auto;
            border: 1px solid #ddd;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .image-caption {
            font-style: italic;
            color: #666;
            margin-top: 0.5rem;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>`;

    // Title page
    html += `
    <div class="title-page">
        <h1 class="book-title">${this.escapeHtml(bookData.title)}</h1>`;

    if (bookData.subtitle) {
      html += `
        <h2 class="book-subtitle">${this.escapeHtml(bookData.subtitle)}</h2>`;
    }

    html += `
        <p><strong>Genre:</strong> ${this.escapeHtml(bookData.genre)}</p>
        <p><strong>Theme:</strong> ${this.escapeHtml(bookData.theme)}</p>`;

    if (bookData.targetAudience) {
      html += `
        <p><strong>Target Audience:</strong> ${this.escapeHtml(bookData.targetAudience)}</p>`;
    }

    html += `
    </div>`;

    // Metadata
    if (includeMetadata) {
      html += `
    <div class="metadata">
        <h3>Book Information</h3>`;

      if (bookData.description) {
        html += `
        <p><strong>Description:</strong><br>${this.escapeHtml(bookData.description)}</p>`;
      }

      if (bookData.publishingInfo) {
        if (bookData.publishingInfo.publisher) {
          html += `<p><strong>Publisher:</strong> ${this.escapeHtml(bookData.publishingInfo.publisher)}</p>`;
        }
        if (bookData.publishingInfo.isbn) {
          html += `<p><strong>ISBN:</strong> ${this.escapeHtml(bookData.publishingInfo.isbn)}</p>`;
        }
      }

      if (bookData.writingStyle) {
        html += `
        <p><strong>Writing Style:</strong></p>
        <ul>
            <li><strong>Tone:</strong> ${this.escapeHtml(bookData.writingStyle.tone)}</li>
            <li><strong>Voice:</strong> ${this.escapeHtml(bookData.writingStyle.voice)}</li>
            <li><strong>Vocabulary:</strong> ${this.escapeHtml(bookData.writingStyle.vocabulary)}</li>
            <li><strong>Sentence Structure:</strong> ${this.escapeHtml(bookData.writingStyle.sentenceStructure)}</li>
        </ul>`;
      }

      html += `
        <p><strong>Word Count:</strong> ${bookData.currentWordCount.toLocaleString()}</p>`;

      if (bookData.chapters) {
        html += `<p><strong>Chapters:</strong> ${bookData.chapters.length}</p>`;
      }

      html += `
        <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
    </div>`;
    }

    // Table of contents
    if (bookData.chapters && bookData.chapters.length > 0) {
      html += `
    <div class="toc">
        <h2>Table of Contents</h2>
        <ul>`;

      bookData.chapters.forEach((chapter) => {
        html += `
            <li><strong>Chapter ${chapter.chapterNumber}:</strong> ${this.escapeHtml(chapter.title)}`;

        if (chapter.pages && chapter.pages.length > 0) {
          html += `
                <ul>`;
          chapter.pages.forEach((page) => {
            html += `
                    <li>${this.escapeHtml(page.title)}</li>`;
          });
          html += `
                </ul>`;
        }

        html += `
            </li>`;
      });

      html += `
        </ul>
    </div>`;
    }

    // Book content
    if (bookData.chapters && bookData.chapters.length > 0) {
      bookData.chapters.forEach((chapter) => {
        html += `
    <div class="chapter">
        <h2 class="chapter-title">Chapter ${chapter.chapterNumber}: ${this.escapeHtml(chapter.title)}</h2>`;

        if (chapter.description) {
          html += `
        <p class="chapter-description">${this.escapeHtml(chapter.description)}</p>`;
        }

        if (chapter.pages && chapter.pages.length > 0) {
          const chapterImages = bookData.imagesByChapter[chapter._id] || [];

          chapter.pages.forEach((page) => {
            // Add images before page
            const beforeImages = this.getImagesForPage(chapterImages, page.pageNumber, 'before');
            beforeImages.forEach((image) => {
              html += `
        <div class="image-container">
            <img src="${image.url}" alt="${this.escapeHtml(image.prompt.original)}" class="book-image" loading="lazy" />
            <div class="image-caption">${this.escapeHtml(image.prompt.original)}</div>
        </div>`;
            });

            html += `
        <div class="page">
            <h3 class="page-title">${this.escapeHtml(page.title)}</h3>
            <div class="page-content">${this.escapeHtml(page.content).replace(/\n/g, '<br>')}</div>`;

            if (page.notes) {
              html += `
            <div class="page-notes">Notes: ${this.escapeHtml(page.notes)}</div>`;
            }

            html += `
        </div>`;

            // Add images between/after page
            const betweenImages = this.getImagesForPage(chapterImages, page.pageNumber, 'between');
            const afterImages = this.getImagesForPage(chapterImages, page.pageNumber, 'after');

            [...betweenImages, ...afterImages].forEach((image) => {
              html += `
        <div class="image-container">
            <img src="${image.url}" alt="${this.escapeHtml(image.prompt.original)}" class="book-image" loading="lazy" />
            <div class="image-caption">${this.escapeHtml(image.prompt.original)}</div>
        </div>`;
            });
          });
        } else {
          html += `
        <p><em>[Chapter content not yet written]</em></p>`;
        }

        html += `
    </div>`;
      });
    } else {
      html += `
    <div class="chapter">
        <p>No content available for this book.</p>
    </div>`;
    }

    // Footer
    html += `
    <div class="footer">
        <p>Generated by LibreChat Book Creation System on ${new Date().toLocaleDateString()}</p>
    </div>
</body>
</html>`;

    try {
      fs.writeFileSync(filepath, html, 'utf8');
      const stats = fs.statSync(filepath);

      // Register file with LibreChat
      const registration = await this.registerFileWithLibreChat(
        filename,
        filepath,
        bookData.authorId,
        stats.size,
        'html',
      );

      const downloadUrl = registration.success
        ? `files/download/${bookData.authorId}/${registration.file.file_id}`
        : `exports/${filename}`;

      return {
        success: true,
        bookTitle: bookData.title,
        format: 'html',
        filename: filename,
        filepath: filepath,
        file_id: registration.file?.file_id || fileId,
        userId: bookData.authorId,
        size: stats.size,
        exportedAt: new Date().toISOString(),
        downloadInfo: {
          downloadMethods: [
            {
              method: registration.success ? 'librechat' : 'direct',
              url: downloadUrl,
              filename: filename,
            },
          ],
        },
        librechatRegistered: registration.librechatRegistered,
        registrationError: registration.error,
        exportMode: 'standard',
      };
    } catch (error) {
      throw new Error(`HTML export failed: ${error.message}`);
    }
  }

  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Organizes images by chapter and page for easy access during export
   * @param {Array} images - Array of image objects
   * @returns {Object} Images organized by chapter ID
   */
  organizeImagesByChapter(images) {
    const imagesByChapter = {};

    images.forEach((image) => {
      if (!imagesByChapter[image.chapterId]) {
        imagesByChapter[image.chapterId] = [];
      }
      imagesByChapter[image.chapterId].push(image);
    });

    // Sort images within each chapter by target page number
    Object.keys(imagesByChapter).forEach((chapterId) => {
      imagesByChapter[chapterId].sort((a, b) => a.targetPageNumber - b.targetPageNumber);
    });

    return imagesByChapter;
  }

  /**
   * Gets images that should be placed around a specific page
   * @param {Array} chapterImages - Images for the chapter
   * @param {number} pageNumber - Target page number
   * @param {string} position - Image position ('before', 'after', 'between')
   * @returns {Array} Relevant images for this position
   */
  getImagesForPage(chapterImages, pageNumber, position) {
    if (!chapterImages) return [];

    return chapterImages.filter(
      (image) => image.targetPageNumber === pageNumber && image.placement.position === position,
    );
  }

  /**
   * Exports book to DOCX format with embedded images
   * @param {Object} bookData - Complete book data
   * @param {boolean} includeMetadata - Whether to include metadata
   * @returns {Object} Export result
   */
  async exportToDocx(bookData, includeMetadata) {
    const filename = this.generateFilename(bookData.title, 'docx');
    const filepath = path.join(this.exportsDir, filename);
    const fileId = uuidv4();

    try {
      // Create DOCX content (placeholder implementation)
      // In a real implementation, you would use a library like docx or officegen
      let docxContent = `Book: ${bookData.title}\n\n`;

      if (includeMetadata) {
        docxContent += `Genre: ${bookData.genre}\n`;
        docxContent += `Theme: ${bookData.theme}\n`;
        if (bookData.description) {
          docxContent += `Description: ${bookData.description}\n`;
        }
        docxContent += '\n';
      }

      // Add chapters with images
      bookData.chapters.forEach((chapter) => {
        docxContent += `\n\nChapter ${chapter.chapterNumber}: ${chapter.title}\n`;
        docxContent += '='.repeat(chapter.title.length + 10) + '\n\n';

        const chapterImages = bookData.imagesByChapter[chapter._id] || [];

        chapter.pages.forEach((page) => {
          // Add images before page
          const beforeImages = this.getImagesForPage(chapterImages, page.pageNumber, 'before');
          beforeImages.forEach((image) => {
            docxContent += `[IMAGE: ${image.prompt.original}]\n`;
            docxContent += `[Image file: ${image.filename}]\n\n`;
          });

          docxContent += `\n${page.title}\n`;
          docxContent += '-'.repeat(page.title.length) + '\n\n';
          docxContent += `${page.content}\n\n`;

          // Add images between/after page
          const betweenImages = this.getImagesForPage(chapterImages, page.pageNumber, 'between');
          const afterImages = this.getImagesForPage(chapterImages, page.pageNumber, 'after');

          [...betweenImages, ...afterImages].forEach((image) => {
            docxContent += `[IMAGE: ${image.prompt.original}]\n`;
            docxContent += `[Image file: ${image.filename}]\n\n`;
          });
        });
      });

      // Write file (placeholder - in real implementation, create actual DOCX)
      fs.writeFileSync(filepath, docxContent, 'utf8');
      const stats = fs.statSync(filepath);

      // Register file with LibreChat
      const registration = await this.registerFileWithLibreChat(
        filename,
        filepath,
        bookData.authorId,
        stats.size,
        'docx',
      );

      const downloadUrl = registration.success
        ? `files/download/${bookData.authorId}/${registration.file.file_id}`
        : `exports/${filename}`;

      return {
        success: true,
        bookTitle: bookData.title,
        format: 'docx',
        filename: filename,
        filepath: filepath,
        file_id: registration.file?.file_id || fileId,
        userId: bookData.authorId,
        size: stats.size,
        imageCount: bookData.allImages.length,
        exportedAt: new Date().toISOString(),
        downloadInfo: {
          downloadMethods: [
            {
              method: registration.success ? 'librechat' : 'direct',
              url: downloadUrl,
              filename: filename,
            },
          ],
        },
        librechatRegistered: registration.librechatRegistered,
        registrationError: registration.error,
        exportMode: 'standard',
      };
    } catch (error) {
      throw new Error(`DOCX export failed: ${error.message}`);
    }
  }

  generateFilename(title, format) {
    const sanitizedTitle = title
      .replace(/[^a-zA-Z0-9\s-_]/g, '')
      .replace(/\s+/g, '_')
      .toLowerCase()
      .substring(0, 50);

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    return `${sanitizedTitle}_${timestamp}.${format}`;
  }

  async registerFileWithLibreChat(filename, filepath, userId, fileSize, format) {
    try {
      const fileData = {
        user: userId,
        file_id: uuidv4(),
        bytes: fileSize,
        filename: filename,
        filepath: filepath,
        type: this.getMimeType(format),
        source: FileSources.local,
        usage: 0,
      };

      const registeredFile = await createFile(fileData);
      return {
        success: true,
        file: registeredFile,
        librechatRegistered: true,
      };
    } catch (error) {
      console.warn('Failed to register file with LibreChat:', error.message);
      return {
        success: false,
        error: error.message,
        librechatRegistered: false,
      };
    }
  }

  getMimeType(format) {
    const mimeTypes = {
      pdf: 'application/pdf',
      html: 'text/html',
      txt: 'text/plain',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      epub: 'application/epub+zip',
    };
    return mimeTypes[format] || 'application/octet-stream';
  }
}
