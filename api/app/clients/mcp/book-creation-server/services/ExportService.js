import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { v4 as uuidv4 } from 'uuid';

export class ExportService {
    constructor(bookService) {
        this.bookService = bookService;
        this.exportsDir = path.join(process.cwd(), 'exports');
        this.ensureExportsDirectory();
    }

    ensureExportsDirectory() {
        if (!fs.existsSync(this.exportsDir)) {
            fs.mkdirSync(this.exportsDir, { recursive: true });
        }
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

            switch (format) {
                case 'pdf':
                    return await this.exportToPDF(bookData, includeMetadata);
                case 'txt':
                    return await this.exportToText(bookData, includeMetadata);
                case 'html':
                    return await this.exportToHTML(bookData, includeMetadata);
                default:
                    throw new Error(
                        `Export format '${format}' is not supported yet. Supported formats: pdf, txt, html`,
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
                    info: {
                        Title: bookData.title,
                        Author: bookData.publishingInfo?.publisher || 'Unknown',
                        Subject: bookData.theme,
                        Keywords: bookData.metadata?.keywords?.join(', ') || '',
                        Creator: 'LibreChat Book Creation System',
                    },
                });

                const stream = fs.createWriteStream(filepath);
                doc.pipe(stream);

                // Generate PDF content
                this.generateTitlePage(doc, bookData, includeMetadata);
                this.generateTableOfContents(doc, bookData);
                this.generateBookContent(doc, bookData);

                doc.end();

                stream.on('finish', () => {
                    const stats = fs.statSync(filepath);

                    resolve({
                        success: true,
                        bookTitle: bookData.title,
                        format: 'pdf',
                        filename: filename,
                        filepath: filepath,
                        file_id: fileId,
                        userId: bookData.authorId,
                        size: stats.size,
                        exportedAt: new Date().toISOString(),
                        downloadInfo: {
                            downloadMethods: [
                                {
                                    method: 'direct',
                                    url: `exports/${filename}`,
                                    filename: filename,
                                },
                            ],
                        },
                        librechatRegistered: true,
                        exportMode: 'standard',
                    });
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
        doc.fontSize(28).font('Helvetica-Bold');
        doc.text(bookData.title, { align: 'center' });

        if (bookData.subtitle) {
            doc.moveDown(0.5);
            doc.fontSize(18).font('Helvetica');
            doc.text(bookData.subtitle, { align: 'center' });
        }

        doc.moveDown(2);
        doc.fontSize(14).font('Helvetica');
        doc.text(`Genre: ${bookData.genre}`, { align: 'center' });
        doc.text(`Theme: ${bookData.theme}`, { align: 'center' });

        if (bookData.targetAudience) {
            doc.text(`Target Audience: ${bookData.targetAudience}`, { align: 'center' });
        }

        // Metadata section
        if (includeMetadata && bookData.metadata) {
            doc.moveDown(2);
            doc.fontSize(12).font('Helvetica-Bold');
            doc.text('Book Information', { align: 'left' });
            doc.font('Helvetica');

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

        doc.fontSize(20).font('Helvetica-Bold');
        doc.text('Table of Contents', { align: 'center' });
        doc.moveDown(1);

        doc.fontSize(12).font('Helvetica');

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
            doc.text('No content available for this book.');
            return;
        }

        bookData.chapters.forEach((chapter, chapterIndex) => {
            // Chapter title
            doc.fontSize(18).font('Helvetica-Bold');
            doc.text(`Chapter ${chapter.chapterNumber}: ${chapter.title}`, {
                align: 'left',
            });

            // Chapter description
            if (chapter.description) {
                doc.moveDown(0.5);
                doc.fontSize(12).font('Helvetica-Oblique');
                doc.text(chapter.description, {
                    width: doc.page.width - 144,
                    align: 'justify',
                });
            }

            doc.moveDown(1);

            // Chapter pages
            if (chapter.pages && chapter.pages.length > 0) {
                chapter.pages.forEach((page, pageIndex) => {
                    // Page title
                    doc.fontSize(14).font('Helvetica-Bold');
                    doc.text(page.title);
                    doc.moveDown(0.5);

                    // Page content
                    doc.fontSize(11).font('Helvetica');
                    doc.text(page.content, {
                        width: doc.page.width - 144,
                        align: 'justify',
                        lineGap: 2,
                    });

                    // Page notes if available
                    if (page.notes) {
                        doc.moveDown(0.5);
                        doc.fontSize(9).font('Helvetica-Oblique');
                        doc.text(`Notes: ${page.notes}`, {
                            width: doc.page.width - 144,
                        });
                    }

                    // Add space between pages
                    if (pageIndex < chapter.pages.length - 1) {
                        doc.moveDown(1);
                        doc.text('---', { align: 'center' });
                        doc.moveDown(1);
                    }
                });
            } else {
                // No pages in chapter
                doc.fontSize(11).font('Helvetica-Oblique');
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
                    chapter.pages.forEach((page) => {
                        content += `${page.title}\n`;
                        content += '~'.repeat(page.title.length) + '\n\n';
                        content += `${page.content}\n\n`;

                        if (page.notes) {
                            content += `Notes: ${page.notes}\n\n`;
                        }
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

            return {
                success: true,
                bookTitle: bookData.title,
                format: 'txt',
                filename: filename,
                filepath: filepath,
                file_id: fileId,
                userId: bookData.authorId,
                size: stats.size,
                exportedAt: new Date().toISOString(),
                downloadInfo: {
                    downloadMethods: [
                        {
                            method: 'direct',
                            url: `exports/${filename}`,
                            filename: filename,
                        },
                    ],
                },
                librechatRegistered: true,
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
                    chapter.pages.forEach((page) => {
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

            return {
                success: true,
                bookTitle: bookData.title,
                format: 'html',
                filename: filename,
                filepath: filepath,
                file_id: fileId,
                userId: bookData.authorId,
                size: stats.size,
                exportedAt: new Date().toISOString(),
                downloadInfo: {
                    downloadMethods: [
                        {
                            method: 'direct',
                            url: `exports/${filename}`,
                            filename: filename,
                        },
                    ],
                },
                librechatRegistered: true,
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

    generateFilename(title, format) {
        const sanitizedTitle = title
            .replace(/[^a-zA-Z0-9\s-_]/g, '')
            .replace(/\s+/g, '_')
            .toLowerCase()
            .substring(0, 50);

        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        return `${sanitizedTitle}_${timestamp}.${format}`;
    }
}
