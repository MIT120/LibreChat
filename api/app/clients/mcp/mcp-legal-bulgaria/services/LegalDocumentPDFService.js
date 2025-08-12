/**
 * Legal Document PDF Export Service
 * Handles creation of professional PDF documents for legal cases, contracts, and analysis
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class LegalDocumentPDFService {
  constructor() {
    this.outputDir = path.join(__dirname, '../exports/pdf');
    this.tempDir = path.join(__dirname, '../temp');
    this.logoPath = path.join(__dirname, '../assets/logo.png');

    // Font paths for Bulgarian text support
    this.fonts = {
      regular: path.join(__dirname, '../assets/fonts/DejaVuSans.ttf'),
      bold: path.join(__dirname, '../assets/fonts/DejaVuSans-Bold.ttf'),
      italic: path.join(__dirname, '../assets/fonts/DejaVuSans-Oblique.ttf'),
    };

    this.ensureDirectories();
  }

  async ensureDirectories() {
    try {
      await fsPromises.mkdir(this.outputDir, { recursive: true });
      await fsPromises.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.warn('Could not create directories:', error.message);
    }
  }

  /**
   * Export case law search results to PDF
   */
  async exportCaseLawToPDF(caseLawData, options = {}) {
    try {
      const {
        title = 'Анализ на съдебна практика',
        subtitle = '',
        includeFullText = false,
        includeSummary = true,
        includeAnalysis = true,
        watermark = '',
        template = 'professional',
      } = options;

      const filename = `case_law_${Date.now()}_${uuidv4().substring(0, 8)}.pdf`;
      const outputPath = path.join(this.outputDir, filename);

      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: title,
          Author: 'Правен асистент AI',
          Subject: 'Анализ на съдебна практика',
          Keywords: 'съдебна практика, България, правен анализ',
          Creator: 'LibreChat Legal Assistant',
          Producer: 'LibreChat MCP Legal Bulgaria',
        },
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Register fonts for Bulgarian text
      await this.registerFonts(doc);

      // Add content based on template
      switch (template) {
        case 'professional':
          await this.createProfessionalCaseLawPDF(doc, caseLawData, {
            title,
            subtitle,
            includeFullText,
            includeSummary,
            includeAnalysis,
            watermark,
          });
          break;
        case 'brief':
          await this.createBriefCaseLawPDF(doc, caseLawData, { title, subtitle });
          break;
        case 'detailed':
          await this.createDetailedCaseLawPDF(doc, caseLawData, {
            title,
            subtitle,
            includeFullText: true,
            includeSummary: true,
            includeAnalysis: true,
          });
          break;
        default:
          await this.createProfessionalCaseLawPDF(doc, caseLawData, {
            title,
            subtitle,
            includeFullText,
            includeSummary,
            includeAnalysis,
            watermark,
          });
      }

      doc.end();

      return new Promise((resolve, reject) => {
        stream.on('finish', () => {
          resolve({
            success: true,
            filename,
            outputPath,
            size: fs.statSync(outputPath).size,
            pages: doc.bufferedPageRange().count,
          });
        });
        stream.on('error', reject);
      });
    } catch (error) {
      console.error('PDF export error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Export legal document analysis to PDF
   */
  async exportLegalAnalysisToPDF(analysisData, options = {}) {
    try {
      const {
        title = 'Правен анализ на документ',
        documentType = 'Договор',
        clientName = '',
        lawyerName = '',
        includeRecommendations = true,
        includeRiskAssessment = true,
        template = 'professional',
      } = options;

      const filename = `legal_analysis_${Date.now()}_${uuidv4().substring(0, 8)}.pdf`;
      const outputPath = path.join(this.outputDir, filename);

      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: title,
          Author: lawyerName || 'Правен асистент AI',
          Subject: `Анализ на ${documentType}`,
          Keywords: 'правен анализ, България, документ, договор',
          Creator: 'LibreChat Legal Assistant',
        },
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      await this.registerFonts(doc);
      await this.createLegalAnalysisPDF(doc, analysisData, {
        title,
        documentType,
        clientName,
        lawyerName,
        includeRecommendations,
        includeRiskAssessment,
      });

      doc.end();

      return new Promise((resolve, reject) => {
        stream.on('finish', () => {
          resolve({
            success: true,
            filename,
            outputPath,
            size: fs.statSync(outputPath).size,
            pages: doc.bufferedPageRange().count,
          });
        });
        stream.on('error', reject);
      });
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Export contract template to PDF
   */
  async exportContractToPDF(contractData, options = {}) {
    try {
      const {
        title = 'Договор',
        contractType = 'Общ договор',
        parties = { first: '', second: '' },
        terms = [],
        signatures = true,
        notarization = false,
      } = options;

      const filename = `contract_${Date.now()}_${uuidv4().substring(0, 8)}.pdf`;
      const outputPath = path.join(this.outputDir, filename);

      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: title,
          Subject: contractType,
          Keywords: 'договор, България, правен документ',
        },
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      await this.registerFonts(doc);
      await this.createContractPDF(doc, contractData, {
        title,
        contractType,
        parties,
        terms,
        signatures,
        notarization,
      });

      doc.end();

      return new Promise((resolve, reject) => {
        stream.on('finish', () => {
          resolve({
            success: true,
            filename,
            outputPath,
            size: fs.statSync(outputPath).size,
            pages: doc.bufferedPageRange().count,
          });
        });
        stream.on('error', reject);
      });
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Register fonts for Bulgarian text support
   */
  async registerFonts(doc) {
    try {
      // Check if font files exist, use fallback if not
      if (await this.fileExists(this.fonts.regular)) {
        doc.registerFont('Regular', this.fonts.regular);
        doc.registerFont('Bold', this.fonts.bold);
        doc.registerFont('Italic', this.fonts.italic);
      } else {
        // Use built-in fonts as fallback
        console.warn('Custom fonts not found, using built-in fonts');
      }
    } catch (error) {
      console.warn('Font registration failed:', error.message);
    }
  }

  /**
   * Create professional case law PDF
   */
  async createProfessionalCaseLawPDF(doc, caseLawData, options) {
    const { title, subtitle, includeFullText, includeSummary, includeAnalysis, watermark } =
      options;
    let yPosition = 50;

    // Header
    yPosition = await this.addHeader(doc, title, subtitle, yPosition);
    yPosition += 20;

    // Metadata section
    if (caseLawData.searchMethods) {
      yPosition = await this.addSectionTitle(doc, 'ИНФОРМАЦИЯ ЗА ТЪРСЕНЕТО', yPosition);
      yPosition = await this.addText(
        doc,
        `Методи: ${caseLawData.searchMethods.join(', ')}`,
        yPosition,
      );
      if (caseLawData.timestamp) {
        yPosition = await this.addText(
          doc,
          `Дата на търсене: ${new Date(caseLawData.timestamp).toLocaleString('bg-BG')}`,
          yPosition,
        );
      }
      yPosition += 15;
    }

    // Search criteria
    if (caseLawData.criteria) {
      yPosition = await this.addSectionTitle(doc, 'КРИТЕРИИ ЗА ТЪРСЕНЕ', yPosition);
      yPosition = await this.addSearchCriteria(doc, caseLawData.criteria, yPosition);
      yPosition += 15;
    }

    // Summary statistics
    yPosition = await this.addSectionTitle(doc, 'ОБОБЩЕНИЕ', yPosition);
    yPosition = await this.addText(doc, `Общо намерени случаи: ${caseLawData.total}`, yPosition);
    if (caseLawData.ragResultsCount) {
      yPosition = await this.addText(
        doc,
        `От RAG база данни: ${caseLawData.ragResultsCount}`,
        yPosition,
      );
    }
    if (caseLawData.liveScrapingCount) {
      yPosition = await this.addText(
        doc,
        `От live scraping: ${caseLawData.liveScrapingCount}`,
        yPosition,
      );
    }
    yPosition += 20;

    // Case law results
    if (caseLawData.results && caseLawData.results.length > 0) {
      for (let i = 0; i < caseLawData.results.length; i++) {
        const caseLaw = caseLawData.results[i];

        // Check if we need a new page
        if (yPosition > 700) {
          doc.addPage();
          yPosition = 50;
        }

        yPosition = await this.addCaseLawEntry(doc, caseLaw, i + 1, yPosition, {
          includeFullText,
          includeSummary,
          includeAnalysis,
        });
        yPosition += 15;
      }
    }

    // Analysis section
    if (includeAnalysis) {
      yPosition = await this.addAnalysisSection(doc, caseLawData, yPosition);
    }

    // Footer with watermark
    if (watermark) {
      this.addWatermark(doc, watermark);
    }

    await this.addFooter(doc);
  }

  /**
   * Create brief case law PDF
   */
  async createBriefCaseLawPDF(doc, caseLawData, options) {
    const { title, subtitle } = options;
    let yPosition = 50;

    yPosition = await this.addHeader(doc, title, subtitle, yPosition);
    yPosition += 30;

    // Summary table
    yPosition = await this.addSectionTitle(doc, 'РЕЗУЛТАТИ', yPosition);

    if (caseLawData.results && caseLawData.results.length > 0) {
      // Table headers
      const tableY = yPosition;
      const colWidths = [40, 150, 100, 120, 80];
      let tableX = 50;

      doc
        .font('Bold')
        .fontSize(10)
        .text('№', tableX, tableY)
        .text('Дело', tableX + colWidths[0], tableY)
        .text('Съд', tableX + colWidths[0] + colWidths[1], tableY)
        .text('Основание', tableX + colWidths[0] + colWidths[1] + colWidths[2], tableY)
        .text(
          'Резултат',
          tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
          tableY,
        );

      yPosition += 20;

      // Table rows
      for (let i = 0; i < Math.min(caseLawData.results.length, 20); i++) {
        const caseLaw = caseLawData.results[i];
        tableX = 50;

        if (yPosition > 750) {
          doc.addPage();
          yPosition = 50;
        }

        doc
          .font('Regular')
          .fontSize(9)
          .text(`${i + 1}`, tableX, yPosition)
          .text(caseLaw.caseNumber || 'N/A', tableX + colWidths[0], yPosition, {
            width: colWidths[1] - 5,
          })
          .text(caseLaw.court || 'N/A', tableX + colWidths[0] + colWidths[1], yPosition, {
            width: colWidths[2] - 5,
          })
          .text(
            caseLaw.legalBasis?.articles?.map((a) => a.article).join(', ') || 'N/A',
            tableX + colWidths[0] + colWidths[1] + colWidths[2],
            yPosition,
            { width: colWidths[3] - 5 },
          )
          .text(
            this.translateOutcome(caseLaw.outcome),
            tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
            yPosition,
            { width: colWidths[4] - 5 },
          );

        yPosition += 15;
      }
    }

    await this.addFooter(doc);
  }

  /**
   * Create detailed case law PDF
   */
  async createDetailedCaseLawPDF(doc, caseLawData, options) {
    // Similar to professional but with more detailed content
    await this.createProfessionalCaseLawPDF(doc, caseLawData, {
      ...options,
      includeFullText: true,
      includeSummary: true,
      includeAnalysis: true,
    });
  }

  /**
   * Create legal analysis PDF
   */
  async createLegalAnalysisPDF(doc, analysisData, options) {
    const {
      title,
      documentType,
      clientName,
      lawyerName,
      includeRecommendations,
      includeRiskAssessment,
    } = options;
    let yPosition = 50;

    // Header
    yPosition = await this.addHeader(doc, title, `Тип документ: ${documentType}`, yPosition);

    // Client/Lawyer info
    if (clientName || lawyerName) {
      yPosition += 10;
      if (clientName) {
        yPosition = await this.addText(doc, `Клиент: ${clientName}`, yPosition, {
          font: 'Regular',
          size: 10,
        });
      }
      if (lawyerName) {
        yPosition = await this.addText(doc, `Юрист: ${lawyerName}`, yPosition, {
          font: 'Regular',
          size: 10,
        });
      }
    }

    yPosition += 20;

    // Document information
    if (analysisData.document) {
      yPosition = await this.addSectionTitle(doc, 'ИНФОРМАЦИЯ ЗА ДОКУМЕНТА', yPosition);
      yPosition = await this.addText(doc, `Тип: ${analysisData.document.type}`, yPosition);
      yPosition = await this.addText(
        doc,
        `Дължина: ${analysisData.document.wordCount} думи`,
        yPosition,
      );
      yPosition += 15;
    }

    // Structure analysis
    if (analysisData.structure) {
      yPosition = await this.addSectionTitle(doc, 'СТРУКТУРЕН АНАЛИЗ', yPosition);
      yPosition = await this.addText(doc, `Клаузули: ${analysisData.structure.clauses}`, yPosition);
      yPosition = await this.addText(
        doc,
        `Правни препратки: ${analysisData.structure.legalReferences}`,
        yPosition,
      );
      yPosition += 15;
    }

    // Risk assessment
    if (includeRiskAssessment && analysisData.analysis?.riskAssessment) {
      yPosition = await this.addSectionTitle(doc, 'РИСКОВА ОЦЕНКА', yPosition);
      const risk = analysisData.analysis.riskAssessment;
      yPosition = await this.addText(
        doc,
        `Ниво на риск: ${risk.level} (${risk.score}/100)`,
        yPosition,
        {
          font: 'Bold',
          color: this.getRiskColor(risk.level),
        },
      );

      if (risk.factors && risk.factors.length > 0) {
        yPosition = await this.addText(doc, 'Рискови фактори:', yPosition);
        for (const factor of risk.factors) {
          yPosition = await this.addText(doc, `• ${factor}`, yPosition + 5, { indent: 20 });
        }
      }
      yPosition += 15;
    }

    // Issues
    if (analysisData.analysis?.issues && analysisData.analysis.issues.length > 0) {
      yPosition = await this.addSectionTitle(doc, 'ИДЕНТИФИЦИРАНИ ПРОБЛЕМИ', yPosition);

      for (const issue of analysisData.analysis.issues) {
        if (yPosition > 700) {
          doc.addPage();
          yPosition = 50;
        }

        yPosition = await this.addText(
          doc,
          `${issue.severity.toUpperCase()}: ${issue.issue}`,
          yPosition,
          {
            font: 'Bold',
            color: this.getSeverityColor(issue.severity),
          },
        );
        yPosition = await this.addText(doc, issue.description, yPosition + 5, { indent: 20 });
        yPosition += 10;
      }
      yPosition += 10;
    }

    // Recommendations
    if (
      includeRecommendations &&
      analysisData.recommendations &&
      analysisData.recommendations.length > 0
    ) {
      yPosition = await this.addSectionTitle(doc, 'ПРЕПОРЪКИ', yPosition);

      for (let i = 0; i < analysisData.recommendations.length; i++) {
        if (yPosition > 750) {
          doc.addPage();
          yPosition = 50;
        }

        yPosition = await this.addText(
          doc,
          `${i + 1}. ${analysisData.recommendations[i]}`,
          yPosition,
        );
        yPosition += 5;
      }
    }

    await this.addFooter(doc);
  }

  /**
   * Create contract PDF
   */
  async createContractPDF(doc, contractData, options) {
    const { title, contractType, parties, terms, signatures, notarization } = options;
    let yPosition = 50;

    // Contract header
    yPosition = await this.addHeader(doc, title, contractType, yPosition);
    yPosition += 30;

    // Parties
    yPosition = await this.addSectionTitle(doc, 'СТРАНИ ПО ДОГОВОРА', yPosition);
    if (parties.first) {
      yPosition = await this.addText(doc, `Първа страна: ${parties.first}`, yPosition);
    }
    if (parties.second) {
      yPosition = await this.addText(doc, `Втора страна: ${parties.second}`, yPosition);
    }
    yPosition += 20;

    // Contract content
    if (contractData.content) {
      yPosition = await this.addSectionTitle(doc, 'СЪДЪРЖАНИЕ НА ДОГОВОРА', yPosition);
      yPosition = await this.addText(doc, contractData.content, yPosition, {
        width: 500,
        lineGap: 2,
      });
      yPosition += 20;
    }

    // Terms
    if (terms && terms.length > 0) {
      yPosition = await this.addSectionTitle(doc, 'УСЛОВИЯ', yPosition);
      for (let i = 0; i < terms.length; i++) {
        if (yPosition > 700) {
          doc.addPage();
          yPosition = 50;
        }
        yPosition = await this.addText(doc, `${i + 1}. ${terms[i]}`, yPosition);
        yPosition += 10;
      }
      yPosition += 20;
    }

    // Signatures section
    if (signatures) {
      if (yPosition > 650) {
        doc.addPage();
        yPosition = 50;
      }

      yPosition = await this.addSectionTitle(doc, 'ПОДПИСИ', yPosition);
      yPosition += 50;

      // Signature lines
      const signatureY = yPosition;
      doc.moveTo(70, signatureY).lineTo(250, signatureY).stroke();
      doc.moveTo(350, signatureY).lineTo(530, signatureY).stroke();

      doc.fontSize(10).text('Първа страна', 70, signatureY + 10);
      doc.text('Втора страна', 350, signatureY + 10);

      yPosition += 40;

      // Date line
      doc.moveTo(200, yPosition).lineTo(400, yPosition).stroke();
      doc.text('Дата', 300, yPosition + 10, { align: 'center' });
    }

    // Notarization note
    if (notarization) {
      yPosition += 40;
      yPosition = await this.addText(
        doc,
        'Забележка: Този договор подлежи на нотариално заверяване.',
        yPosition,
        {
          font: 'Italic',
          size: 10,
        },
      );
    }

    await this.addFooter(doc);
  }

  /**
   * Add header to document
   */
  async addHeader(doc, title, subtitle, yPosition) {
    // Title
    doc.font('Bold').fontSize(18).text(title, 50, yPosition, { align: 'center', width: 500 });

    yPosition += 30;

    // Subtitle
    if (subtitle) {
      doc
        .font('Regular')
        .fontSize(12)
        .text(subtitle, 50, yPosition, { align: 'center', width: 500 });
      yPosition += 20;
    }

    // Date
    doc
      .font('Regular')
      .fontSize(10)
      .text(`Генериран на: ${new Date().toLocaleString('bg-BG')}`, 50, yPosition, {
        align: 'center',
        width: 500,
      });

    // Horizontal line
    yPosition += 15;
    doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();

    return yPosition + 10;
  }

  /**
   * Add section title
   */
  async addSectionTitle(doc, title, yPosition) {
    doc.font('Bold').fontSize(14).text(title, 50, yPosition);

    return yPosition + 20;
  }

  /**
   * Add text with formatting options
   */
  async addText(doc, text, yPosition, options = {}) {
    const {
      font = 'Regular',
      size = 10,
      color = 'black',
      indent = 0,
      width = 500,
      align = 'left',
      lineGap = 0,
    } = options;

    doc
      .font(font)
      .fontSize(size)
      .fillColor(color)
      .text(text, 50 + indent, yPosition, {
        width: width - indent,
        align,
        lineGap,
      });

    return yPosition + Math.ceil(text.length / 80) * (size + lineGap + 2) + 5;
  }

  /**
   * Add search criteria to PDF
   */
  async addSearchCriteria(doc, criteria, yPosition) {
    if (criteria.articles && criteria.articles.length > 0) {
      yPosition = await this.addText(doc, `Членове: ${criteria.articles.join(', ')}`, yPosition);
    }
    if (criteria.laws && criteria.laws.length > 0) {
      yPosition = await this.addText(doc, `Закони: ${criteria.laws.join(', ')}`, yPosition);
    }
    if (criteria.court) {
      yPosition = await this.addText(doc, `Съд: ${criteria.court}`, yPosition);
    }
    if (criteria.parties && criteria.parties.length > 0) {
      yPosition = await this.addText(doc, `Страни: ${criteria.parties.join(', ')}`, yPosition);
    }
    if (criteria.outcome) {
      yPosition = await this.addText(
        doc,
        `Резултат: ${this.translateOutcome(criteria.outcome)}`,
        yPosition,
      );
    }
    if (criteria.keywords && criteria.keywords.length > 0) {
      yPosition = await this.addText(
        doc,
        `Ключови думи: ${criteria.keywords.join(', ')}`,
        yPosition,
      );
    }

    return yPosition;
  }

  /**
   * Add case law entry to PDF
   */
  async addCaseLawEntry(doc, caseLaw, index, yPosition, options) {
    const { includeFullText, includeSummary, includeAnalysis } = options;

    // Case header
    const sourceIcon =
      caseLaw.source === 'rag_database'
        ? '📚'
        : caseLaw.source === 'vks'
          ? '⚖️'
          : caseLaw.source === 'vas'
            ? '🏛️'
            : caseLaw.source === 'lexbg'
              ? '📖'
              : '📋';

    yPosition = await this.addText(
      doc,
      `${sourceIcon} ${index}. ${caseLaw.generateCitation()}`,
      yPosition,
      {
        font: 'Bold',
        size: 12,
      },
    );

    // Legal basis
    if (caseLaw.legalBasis && caseLaw.legalBasis.articles.length > 0) {
      const articles = caseLaw.legalBasis.articles
        .map((a) => `${a.article} от ${a.law}`)
        .join(', ');
      yPosition = await this.addText(doc, `Основание: ${articles}`, yPosition, { indent: 20 });
    }

    // Outcome
    if (caseLaw.outcome) {
      yPosition = await this.addText(
        doc,
        `Резултат: ${this.translateOutcome(caseLaw.outcome)}`,
        yPosition,
        { indent: 20 },
      );
    }

    // Precedent value
    if (caseLaw.precedentValue) {
      yPosition = await this.addText(
        doc,
        `Прецедентна стойност: ${this.translatePrecedentValue(caseLaw.precedentValue)}`,
        yPosition,
        { indent: 20 },
      );
    }

    // RAG score
    if (caseLaw.ragScore) {
      yPosition = await this.addText(
        doc,
        `Релевантност: ${Math.round(caseLaw.ragScore * 100)}%`,
        yPosition,
        { indent: 20 },
      );
    }

    // Summary
    if (includeSummary && caseLaw.summary) {
      yPosition = await this.addText(doc, `Резюме: ${caseLaw.summary}`, yPosition, {
        indent: 20,
        width: 480,
        lineGap: 1,
      });
    }

    // Reasoning
    if (includeAnalysis && caseLaw.reasoning) {
      yPosition = await this.addText(doc, `Мотиви: ${caseLaw.reasoning}`, yPosition, {
        indent: 20,
        width: 480,
        lineGap: 1,
      });
    }

    // Key points
    if (caseLaw.keyPoints && caseLaw.keyPoints.length > 0) {
      yPosition = await this.addText(doc, 'Ключови точки:', yPosition, {
        indent: 20,
        font: 'Bold',
      });
      for (const point of caseLaw.keyPoints.slice(0, 3)) {
        yPosition = await this.addText(doc, `• ${point}`, yPosition, { indent: 40, size: 9 });
      }
    }

    // Full text (if requested)
    if (includeFullText && caseLaw.fullText) {
      yPosition = await this.addText(doc, 'Пълен текст:', yPosition, { indent: 20, font: 'Bold' });
      yPosition = await this.addText(doc, caseLaw.fullText.substring(0, 1000) + '...', yPosition, {
        indent: 20,
        width: 480,
        size: 9,
        lineGap: 1,
      });
    }

    // Document URL
    if (caseLaw.documentUrl) {
      yPosition = await this.addText(doc, `URL: ${caseLaw.documentUrl}`, yPosition, {
        indent: 20,
        size: 8,
        color: 'blue',
      });
    }

    return yPosition;
  }

  /**
   * Add analysis section
   */
  async addAnalysisSection(doc, caseLawData, yPosition) {
    if (yPosition > 600) {
      doc.addPage();
      yPosition = 50;
    }

    yPosition = await this.addSectionTitle(doc, 'АНАЛИЗ НА РЕЗУЛТАТИТЕ', yPosition);

    // Outcome distribution
    const outcomes = {};
    caseLawData.results.forEach((caseLaw) => {
      const outcome = caseLaw.outcome || 'неизвестен';
      outcomes[outcome] = (outcomes[outcome] || 0) + 1;
    });

    yPosition = await this.addText(doc, 'Разпределение по резултати:', yPosition, { font: 'Bold' });
    Object.entries(outcomes).forEach(([outcome, count]) => {
      const percentage = Math.round((count / caseLawData.results.length) * 100);
      yPosition = this.addText(
        doc,
        `${this.translateOutcome(outcome)}: ${count} (${percentage}%)`,
        yPosition,
        { indent: 20 },
      );
    });

    // Court distribution
    const courts = {};
    caseLawData.results.forEach((caseLaw) => {
      const court = caseLaw.court || 'неизвестен съд';
      courts[court] = (courts[court] || 0) + 1;
    });

    yPosition += 15;
    yPosition = await this.addText(doc, 'Разпределение по съдилища:', yPosition, { font: 'Bold' });
    Object.entries(courts)
      .slice(0, 5)
      .forEach(([court, count]) => {
        yPosition = this.addText(doc, `${court}: ${count}`, yPosition, { indent: 20 });
      });

    return yPosition;
  }

  /**
   * Add footer
   */
  async addFooter(doc) {
    const pageCount = doc.bufferedPageRange().count;

    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);

      // Footer line
      doc.moveTo(50, 780).lineTo(550, 780).stroke();

      // Footer text
      doc
        .font('Regular')
        .fontSize(8)
        .text(
          `Генериран от LibreChat Legal Assistant | Страница ${i + 1} от ${pageCount}`,
          50,
          785,
          {
            width: 500,
            align: 'center',
          },
        );
    }
  }

  /**
   * Add watermark
   */
  addWatermark(doc, text) {
    const pageCount = doc.bufferedPageRange().count;

    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);

      doc
        .save()
        .translate(300, 400)
        .rotate(-45)
        .font('Bold')
        .fontSize(50)
        .fillColor('lightgray')
        .fillOpacity(0.3)
        .text(text, -100, 0, { align: 'center' })
        .restore();
    }
  }

  /**
   * Helper methods
   */
  translateOutcome(outcome) {
    const translations = {
      upheld: 'Уважено',
      rejected: 'Отхвърлено',
      partially_upheld: 'Частично уважено',
      guilty: 'Виновен',
      not_guilty: 'Невиновен',
      liable: 'Отговорен',
      not_liable: 'Неотговорен',
    };
    return translations[outcome] || outcome;
  }

  translatePrecedentValue(value) {
    const translations = {
      high: 'Висока',
      medium: 'Средна',
      low: 'Ниска',
    };
    return translations[value] || value;
  }

  getRiskColor(level) {
    switch (level?.toLowerCase()) {
      case 'high':
        return 'red';
      case 'medium':
        return 'orange';
      case 'low':
        return 'green';
      default:
        return 'black';
    }
  }

  getSeverityColor(severity) {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'red';
      case 'high':
        return 'orange';
      case 'medium':
        return 'blue';
      case 'low':
        return 'green';
      default:
        return 'black';
    }
  }

  async fileExists(filePath) {
    try {
      await fsPromises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get list of exported PDFs
   */
  async listExportedPDFs() {
    try {
      const files = await fsPromises.readdir(this.outputDir);
      const pdfFiles = files.filter((file) => file.endsWith('.pdf'));

      const fileDetails = await Promise.all(
        pdfFiles.map(async (filename) => {
          const filePath = path.join(this.outputDir, filename);
          const stats = await fsPromises.stat(filePath);

          return {
            filename,
            path: filePath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
          };
        }),
      );

      return fileDetails.sort((a, b) => b.created - a.created);
    } catch (error) {
      return [];
    }
  }

  /**
   * Delete exported PDF
   */
  async deletePDF(filename) {
    try {
      const filePath = path.join(this.outputDir, filename);
      await fsPromises.unlink(filePath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get PDF file stream for download
   */
  getPDFStream(filename) {
    const filePath = path.join(this.outputDir, filename);
    return fs.createReadStream(filePath);
  }
}
