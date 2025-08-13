#!/usr/bin/env node

/**
 * Bulgarian Legal Assistance MCP Server
 * Provides case law search, legal document analysis, and citation tools for Bulgarian lawyers
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { ApisService } from './services/ApisService.js';
import { CaseLawService } from './services/CaseLawService.js';
import { CitationService } from './services/CitationService.js';
import { DocumentAnalysisService } from './services/DocumentAnalysisService.js';
import { LawyerToolsService } from './services/LawyerToolsService.js';
import { LexBgService } from './services/LexBgService.js';
import { LegalDocumentPDFService } from './services/LegalDocumentPDFService.js';

class BulgarianLegalServer {
  constructor() {
    this.server = new Server(
      {
        name: 'mcp-legal-bulgaria',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.caseLawService = new CaseLawService();
    this.documentAnalysisService = new DocumentAnalysisService();
    this.citationService = new CitationService();
    this.lexBgService = new LexBgService();
    this.apisService = new ApisService();
    this.lawyerToolsService = new LawyerToolsService();
    this.pdfService = new LegalDocumentPDFService();

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_case_law',
            description:
              'Enhanced search for Bulgarian case law using Firecrawl for live scraping and RAG database for stored cases. Searches legal articles, parties, court, date range, and other criteria. Example: Find last 20 rulings on article 15 of ZZD where seller was held liable.',
            inputSchema: {
              type: 'object',
              properties: {
                articles: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Legal articles to search for (e.g., ["чл. 15", "чл. 220"])',
                  default: [],
                },
                laws: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Laws to search in (e.g., ["ЗЗД", "ТЗ"])',
                  default: [],
                },
                parties: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Party types (e.g., ["seller", "buyer", "plaintiff"])',
                  default: [],
                },
                court: {
                  type: 'string',
                  description: 'Court name or type to filter by',
                  default: '',
                },
                dateFrom: {
                  type: 'string',
                  description: 'Start date in YYYY-MM-DD format',
                  default: null,
                },
                dateTo: {
                  type: 'string',
                  description: 'End date in YYYY-MM-DD format',
                  default: null,
                },
                outcome: {
                  type: 'string',
                  description:
                    'Case outcome (upheld, rejected, partially_upheld, guilty, not_guilty)',
                  default: '',
                },
                keywords: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Keywords to search in case text',
                  default: [],
                },
                limit: {
                  type: 'integer',
                  description: 'Maximum number of results to return',
                  default: 20,
                  minimum: 1,
                  maximum: 100,
                },
                useFirecrawl: {
                  type: 'boolean',
                  description: 'Use Firecrawl for live scraping of court websites',
                  default: true,
                },
                useRag: {
                  type: 'boolean',
                  description: 'Search RAG database for previously stored cases',
                  default: true,
                },
                saveToRag: {
                  type: 'boolean',
                  description: 'Save new scraped cases to RAG database for future use',
                  default: true,
                },
                sources: {
                  type: 'array',
                  items: { type: 'string', enum: ['vks', 'vas', 'lexbg'] },
                  description:
                    'Court sources to search (vks=Supreme Court, vas=Administrative Court, lexbg=Lex.bg)',
                  default: ['vks', 'vas', 'lexbg'],
                },
              },
              required: [],
            },
          },
          {
            name: 'analyze_legal_document',
            description:
              'Analyze a Bulgarian legal document to extract clauses, legal references, identify issues, and perform risk assessment.',
            inputSchema: {
              type: 'object',
              properties: {
                documentText: {
                  type: 'string',
                  description: 'Full text of the legal document to analyze',
                  minLength: 10,
                },
                documentType: {
                  type: 'string',
                  description: 'Type of document (contract, agreement, ruling, etc.)',
                  default: 'contract',
                },
              },
              required: ['documentText'],
            },
          },
          {
            name: 'verify_contract_clauses',
            description:
              'Verify if specific clauses are present in a contract and check their enforceability based on precedents.',
            inputSchema: {
              type: 'object',
              properties: {
                documentText: {
                  type: 'string',
                  description: 'Full text of the contract to analyze',
                  minLength: 10,
                },
                clausesToVerify: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of specific clauses to verify in the contract',
                  minItems: 1,
                },
              },
              required: ['documentText', 'clausesToVerify'],
            },
          },
          {
            name: 'compare_legal_documents',
            description:
              'Compare two legal documents to identify similarities, differences, and provide recommendations.',
            inputSchema: {
              type: 'object',
              properties: {
                document1Text: {
                  type: 'string',
                  description: 'Full text of the first document',
                  minLength: 10,
                },
                document2Text: {
                  type: 'string',
                  description: 'Full text of the second document',
                  minLength: 10,
                },
              },
              required: ['document1Text', 'document2Text'],
            },
          },
          {
            name: 'generate_case_summary',
            description:
              'Generate a comprehensive summary of multiple cases including common patterns, trends, and legal analysis.',
            inputSchema: {
              type: 'object',
              properties: {
                searchCriteria: {
                  type: 'object',
                  description: 'Criteria used to find the cases to summarize',
                  properties: {
                    articles: { type: 'array', items: { type: 'string' } },
                    laws: { type: 'array', items: { type: 'string' } },
                    court: { type: 'string' },
                    dateFrom: { type: 'string' },
                    dateTo: { type: 'string' },
                    limit: { type: 'integer', default: 20 },
                  },
                },
              },
              required: ['searchCriteria'],
            },
          },
          {
            name: 'live_scrape_case_law',
            description:
              'Perform live scraping of Bulgarian court websites using Firecrawl to find the most recent case law. Automatically saves results to RAG database.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query in Bulgarian or English',
                  minLength: 3,
                },
                sources: {
                  type: 'array',
                  items: { type: 'string', enum: ['vks', 'vas', 'lexbg'] },
                  description: 'Court sources to scrape',
                  default: ['vks', 'vas'],
                },
                maxResults: {
                  type: 'integer',
                  description: 'Maximum number of cases to scrape',
                  default: 10,
                  minimum: 1,
                  maximum: 50,
                },
                relevanceThreshold: {
                  type: 'number',
                  description: 'Minimum relevance score (0-100)',
                  default: 70,
                  minimum: 0,
                  maximum: 100,
                },
                saveToRag: {
                  type: 'boolean',
                  description: 'Save scraped cases to RAG database',
                  default: true,
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'analyze_case_law_trends',
            description:
              'Analyze trends in case law over time, identify patterns in court decisions, and provide insights for legal strategy.',
            inputSchema: {
              type: 'object',
              properties: {
                searchCriteria: {
                  type: 'object',
                  description: 'Criteria to find cases for trend analysis',
                  properties: {
                    articles: { type: 'array', items: { type: 'string' } },
                    laws: { type: 'array', items: { type: 'string' } },
                    court: { type: 'string' },
                    dateFrom: { type: 'string' },
                    dateTo: { type: 'string' },
                    keywords: { type: 'array', items: { type: 'string' } },
                  },
                },
                analysisType: {
                  type: 'string',
                  enum: [
                    'temporal',
                    'outcome_patterns',
                    'precedent_evolution',
                    'court_consistency',
                  ],
                  description: 'Type of trend analysis to perform',
                  default: 'temporal',
                },
                timeGranularity: {
                  type: 'string',
                  enum: ['monthly', 'quarterly', 'yearly'],
                  description: 'Time granularity for temporal analysis',
                  default: 'yearly',
                },
              },
              required: ['searchCriteria'],
            },
          },
          {
            name: 'export_case_law_to_pdf',
            description:
              'Export case law search results to a professional PDF document with customizable options for legal documentation.',
            inputSchema: {
              type: 'object',
              properties: {
                caseLawData: {
                  type: 'object',
                  description: 'Case law search results to export',
                  required: true,
                },
                title: {
                  type: 'string',
                  description: 'Title for the PDF document',
                  default: 'Анализ на съдебна практика',
                },
                subtitle: {
                  type: 'string',
                  description: 'Subtitle for the PDF document',
                  default: '',
                },
                template: {
                  type: 'string',
                  enum: ['professional', 'brief', 'detailed'],
                  description: 'PDF template style',
                  default: 'professional',
                },
                includeFullText: {
                  type: 'boolean',
                  description: 'Include full text of cases in the PDF',
                  default: false,
                },
                includeSummary: {
                  type: 'boolean',
                  description: 'Include case summaries',
                  default: true,
                },
                includeAnalysis: {
                  type: 'boolean',
                  description: 'Include analysis section',
                  default: true,
                },
                watermark: {
                  type: 'string',
                  description: 'Watermark text for the document',
                  default: '',
                },
              },
              required: ['caseLawData'],
            },
          },
          {
            name: 'export_legal_analysis_to_pdf',
            description:
              'Export legal document analysis to a professional PDF report with risk assessment and recommendations.',
            inputSchema: {
              type: 'object',
              properties: {
                analysisData: {
                  type: 'object',
                  description: 'Legal analysis data to export',
                  required: true,
                },
                title: {
                  type: 'string',
                  description: 'Title for the PDF document',
                  default: 'Правен анализ на документ',
                },
                documentType: {
                  type: 'string',
                  description: 'Type of the analyzed document',
                  default: 'Договор',
                },
                clientName: {
                  type: 'string',
                  description: 'Client name for the report',
                  default: '',
                },
                lawyerName: {
                  type: 'string',
                  description: 'Lawyer name for the report',
                  default: '',
                },
                includeRecommendations: {
                  type: 'boolean',
                  description: 'Include recommendations section',
                  default: true,
                },
                includeRiskAssessment: {
                  type: 'boolean',
                  description: 'Include risk assessment section',
                  default: true,
                },
              },
              required: ['analysisData'],
            },
          },
          {
            name: 'export_contract_to_pdf',
            description:
              'Export contract content to a professional PDF document with signature lines and legal formatting.',
            inputSchema: {
              type: 'object',
              properties: {
                contractData: {
                  type: 'object',
                  description: 'Contract data to export',
                  properties: {
                    content: { type: 'string', description: 'Main contract content' },
                    clauses: { type: 'array', items: { type: 'string' }, description: 'Contract clauses' },
                  },
                  required: ['content'],
                },
                title: {
                  type: 'string',
                  description: 'Contract title',
                  default: 'Договор',
                },
                contractType: {
                  type: 'string',
                  description: 'Type of contract',
                  default: 'Общ договор',
                },
                parties: {
                  type: 'object',
                  description: 'Contract parties',
                  properties: {
                    first: { type: 'string', description: 'First party name' },
                    second: { type: 'string', description: 'Second party name' },
                  },
                  default: { first: '', second: '' },
                },
                terms: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Additional contract terms',
                  default: [],
                },
                signatures: {
                  type: 'boolean',
                  description: 'Include signature lines',
                  default: true,
                },
                notarization: {
                  type: 'boolean',
                  description: 'Include notarization note',
                  default: false,
                },
              },
              required: ['contractData'],
            },
          },
          {
            name: 'list_exported_pdfs',
            description:
              'List all exported PDF documents with details like file size, creation date, and download links.',
            inputSchema: {
              type: 'object',
              properties: {},
              required: [],
            },
          },
          {
            name: 'delete_exported_pdf',
            description:
              'Delete a specific exported PDF document from the server.',
            inputSchema: {
              type: 'object',
              properties: {
                filename: {
                  type: 'string',
                  description: 'Name of the PDF file to delete',
                  minLength: 1,
                },
              },
              required: ['filename'],
            },
          },
          {
            name: 'find_similar_cases',
            description:
              'Find cases similar to a reference case or legal situation based on legal elements and facts.',
            inputSchema: {
              type: 'object',
              properties: {
                referenceCase: {
                  type: 'object',
                  description: 'Reference case or legal situation to match against',
                  properties: {
                    summary: { type: 'string', description: 'Brief summary of the case facts' },
                    legalBasis: {
                      type: 'object',
                      properties: {
                        articles: { type: 'array', items: { type: 'object' } },
                        laws: { type: 'array', items: { type: 'string' } },
                      },
                    },
                    outcome: { type: 'string', description: 'Desired or expected outcome' },
                    keyPoints: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['summary'],
                },
                limit: {
                  type: 'integer',
                  description: 'Maximum number of similar cases to return',
                  default: 10,
                  minimum: 1,
                  maximum: 50,
                },
              },
              required: ['referenceCase'],
            },
          },
          {
            name: 'generate_legal_citations',
            description:
              'Generate properly formatted Bulgarian legal citations for cases and legal references.',
            inputSchema: {
              type: 'object',
              properties: {
                sources: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string', enum: ['case', 'law', 'article'] },
                      caseNumber: { type: 'string' },
                      court: { type: 'string' },
                      date: { type: 'string' },
                      law: { type: 'string' },
                      article: { type: 'string' },
                      url: { type: 'string' },
                    },
                  },
                  description: 'List of legal sources to generate citations for',
                  minItems: 1,
                },
                format: {
                  type: 'string',
                  enum: ['text', 'json', 'csv', 'bibtex'],
                  description: 'Output format for citations',
                  default: 'text',
                },
                includeBibliography: {
                  type: 'boolean',
                  description: 'Whether to include a formatted bibliography',
                  default: true,
                },
              },
              required: ['sources'],
            },
          },
          {
            name: 'extract_key_terms',
            description: 'Extract key legal terms and definitions from a Bulgarian legal document.',
            inputSchema: {
              type: 'object',
              properties: {
                documentText: {
                  type: 'string',
                  description: 'Full text of the legal document',
                  minLength: 10,
                },
                includeDefinitions: {
                  type: 'boolean',
                  description: 'Whether to extract formal definitions',
                  default: true,
                },
              },
              required: ['documentText'],
            },
          },
          {
            name: 'search_lex_bg',
            description:
              'Search legal documents and news from lex.bg - the most visited Bulgarian legal portal. Find court decisions, legal updates, and professional news.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query for legal documents or topics',
                  minLength: 2,
                },
                documentType: {
                  type: 'string',
                  description: 'Type of document to search for',
                  default: '',
                },
                institution: {
                  type: 'string',
                  description: 'Institution or court name',
                  default: '',
                },
                dateFrom: {
                  type: 'string',
                  description: 'Start date (YYYY-MM-DD format)',
                  default: '',
                },
                dateTo: {
                  type: 'string',
                  description: 'End date (YYYY-MM-DD format)',
                  default: '',
                },
                limit: {
                  type: 'integer',
                  description: 'Maximum number of results to return',
                  default: 20,
                  minimum: 1,
                  maximum: 50,
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'search_apis_legislation',
            description:
              'Search Bulgarian legislation and legal information from АПИС - the leading Bulgarian legal information provider. Access laws, regulations, case law and legal updates.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query for legal documents',
                  minLength: 2,
                },
                database: {
                  type: 'string',
                  enum: ['law', 'eu_law', 'finance', 'company', 'gdpr', 'construction'],
                  description: 'АПИС database to search in',
                  default: 'law',
                },
                dateFrom: {
                  type: 'string',
                  description: 'Start date (YYYY-MM-DD format)',
                  default: '',
                },
                dateTo: {
                  type: 'string',
                  description: 'End date (YYYY-MM-DD format)',
                  default: '',
                },
                documentType: {
                  type: 'string',
                  description: 'Type of document (law, regulation, case, etc.)',
                  default: '',
                },
                limit: {
                  type: 'integer',
                  description: 'Maximum number of results to return',
                  default: 20,
                  minimum: 1,
                  maximum: 50,
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'get_legal_news',
            description: 'Get the latest legal news and updates from lex.bg and АПИС sources.',
            inputSchema: {
              type: 'object',
              properties: {
                category: {
                  type: 'string',
                  description: 'News category to filter by',
                  default: '',
                },
                limit: {
                  type: 'integer',
                  description: 'Maximum number of news items to return',
                  default: 10,
                  minimum: 1,
                  maximum: 25,
                },
              },
              required: [],
            },
          },
          {
            name: 'comprehensive_legal_research',
            description:
              'Perform comprehensive legal research combining multiple Bulgarian legal databases (lex.bg, АПИС) to provide complete legal analysis.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Legal research topic or question',
                  minLength: 3,
                },
                includeLegislation: {
                  type: 'boolean',
                  description: 'Include legislation search',
                  default: true,
                },
                includeCaselaw: {
                  type: 'boolean',
                  description: 'Include case law search',
                  default: true,
                },
                includeNews: {
                  type: 'boolean',
                  description: 'Include recent legal news',
                  default: true,
                },
                includeEULaw: {
                  type: 'boolean',
                  description: 'Include EU law search',
                  default: false,
                },
                maxResults: {
                  type: 'integer',
                  description: 'Maximum total results across all sources',
                  default: 50,
                  minimum: 10,
                  maximum: 100,
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'analyze_document_with_real_data',
            description:
              'Analyze a legal document using real Bulgarian case law and legislation data to identify risks, compliance issues, and provide recommendations.',
            inputSchema: {
              type: 'object',
              properties: {
                documentText: {
                  type: 'string',
                  description: 'Full text of the legal document to analyze',
                  minLength: 10,
                },
                analysisType: {
                  type: 'string',
                  enum: ['general', 'contract', 'compliance', 'risk'],
                  description: 'Type of analysis to perform',
                  default: 'general',
                },
              },
              required: ['documentText'],
            },
          },
          {
            name: 'generate_case_strategy',
            description:
              'Generate legal case strategy based on similar Bulgarian cases and precedents from real legal databases.',
            inputSchema: {
              type: 'object',
              properties: {
                caseType: {
                  type: 'string',
                  description: 'Type of legal case',
                  minLength: 3,
                },
                facts: {
                  type: 'string',
                  description: 'Brief description of case facts',
                  minLength: 10,
                },
                legalBasis: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Legal articles or laws that apply',
                  default: [],
                },
                desiredOutcome: {
                  type: 'string',
                  description: 'Desired case outcome',
                  default: '',
                },
                timeline: {
                  type: 'string',
                  description: 'Available timeline for the case',
                  default: '',
                },
              },
              required: ['caseType', 'facts'],
            },
          },
          {
            name: 'monitor_legal_changes',
            description:
              'Monitor recent legal changes and updates relevant to specific practice areas using real-time data from Bulgarian legal sources.',
            inputSchema: {
              type: 'object',
              properties: {
                practiceAreas: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Legal practice areas to monitor',
                  default: [],
                },
                keywords: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Additional keywords to monitor',
                  default: [],
                },
              },
              required: [],
            },
          },
          {
            name: 'generate_client_advice',
            description:
              'Generate comprehensive client advice based on their legal situation using real Bulgarian legal research and precedents.',
            inputSchema: {
              type: 'object',
              properties: {
                situation: {
                  type: 'string',
                  description: "Description of the client's legal situation",
                  minLength: 10,
                },
                legalQuestions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific legal questions from the client',
                  default: [],
                },
                urgency: {
                  type: 'string',
                  enum: ['low', 'normal', 'high', 'urgent'],
                  description: 'Urgency level of the situation',
                  default: 'normal',
                },
                clientType: {
                  type: 'string',
                  enum: ['individual', 'business', 'organization'],
                  description: 'Type of client',
                  default: 'individual',
                },
              },
              required: ['situation'],
            },
          },
          {
            name: 'test_data_sources',
            description:
              'Test connectivity and availability of real legal data sources (lex.bg and АПИС).',
            inputSchema: {
              type: 'object',
              properties: {},
              required: [],
            },
          },
          {
            name: 'query_rag_legal_documents',
            description:
              'Query previously stored legal documents from RAG system for fast retrieval.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query for stored legal documents',
                  minLength: 2,
                },
                limit: {
                  type: 'integer',
                  description: 'Maximum number of results to return',
                  default: 10,
                  minimum: 1,
                  maximum: 50,
                },
                minSimilarity: {
                  type: 'number',
                  description: 'Minimum similarity score (0.0-1.0)',
                  default: 0.7,
                  minimum: 0.0,
                  maximum: 1.0,
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'store_legal_document_in_rag',
            description: 'Store a legal document in RAG system for future retrieval and analysis.',
            inputSchema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Title of the legal document',
                  minLength: 3,
                },
                content: {
                  type: 'string',
                  description: 'Full content of the legal document',
                  minLength: 10,
                },
                metadata: {
                  type: 'object',
                  description: 'Additional metadata about the document',
                  properties: {
                    url: { type: 'string' },
                    date: { type: 'string' },
                    type: { type: 'string' },
                    court: { type: 'string' },
                    caseNumber: { type: 'string' },
                  },
                  default: {},
                },
                source: {
                  type: 'string',
                  description: 'Source of the document',
                  default: 'manual_upload',
                },
              },
              required: ['title', 'content'],
            },
          },
          {
            name: 'enhanced_legal_search',
            description:
              'Perform enhanced legal search that combines RAG retrieval with live scraping for comprehensive results.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Legal search query',
                  minLength: 2,
                },
                sources: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['lex.bg', 'apis', 'both'],
                  },
                  description: 'Sources to search',
                  default: ['both'],
                },
                useRagFirst: {
                  type: 'boolean',
                  description: 'Check RAG system first before live search',
                  default: true,
                },
                storeResults: {
                  type: 'boolean',
                  description: 'Store new results in RAG system',
                  default: true,
                },
                limit: {
                  type: 'integer',
                  description: 'Maximum total results to return',
                  default: 20,
                  minimum: 5,
                  maximum: 50,
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'search_supreme_court_cassation',
            description:
              'Search decisions and case law from the Bulgarian Supreme Court of Cassation (Върховен Касационен съд). Specialized search for highest court precedents in civil and criminal matters.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query for Supreme Court decisions (in Bulgarian or English)',
                  minLength: 5,
                  maxLength: 500,
                },
                caseNumber: {
                  type: 'string',
                  description: 'Specific case number (e.g., "№ 123/2023")',
                  maxLength: 50,
                },
                legalArticle: {
                  type: 'string',
                  description: 'Specific legal article cited (e.g., "чл. 45 от ГК")',
                  maxLength: 100,
                },
                chamber: {
                  type: 'string',
                  enum: ['civil', 'criminal', 'commercial', 'any'],
                  description: 'Supreme Court chamber (civil, criminal, commercial)',
                  default: 'any',
                },
                decisionType: {
                  type: 'string',
                  enum: ['cassation', 'interpretation', 'unification', 'any'],
                  description: 'Type of Supreme Court decision',
                  default: 'any',
                },
                dateRange: {
                  type: 'object',
                  properties: {
                    from: {
                      type: 'string',
                      format: 'date',
                      description: 'Start date (YYYY-MM-DD)',
                    },
                    to: {
                      type: 'string',
                      format: 'date',
                      description: 'End date (YYYY-MM-DD)',
                    },
                    lastYears: {
                      type: 'number',
                      description: 'Search decisions from last N years',
                      minimum: 1,
                      maximum: 20,
                    },
                  },
                  description: 'Date range filter for decisions',
                },
                legalArea: {
                  type: 'string',
                  enum: [
                    'civil_law',
                    'criminal_law',
                    'commercial_law',
                    'family_law',
                    'property_law',
                    'contract_law',
                    'tort_law',
                    'procedural_law',
                    'any',
                  ],
                  description: 'Area of law',
                  default: 'any',
                },
                precedentValue: {
                  type: 'string',
                  enum: ['binding', 'persuasive', 'interpretive', 'any'],
                  description: 'Precedential value of the decision',
                  default: 'any',
                },
                maxResults: {
                  type: 'number',
                  description: 'Maximum number of results to return',
                  default: 15,
                  minimum: 1,
                  maximum: 50,
                },
                includeAnalysis: {
                  type: 'boolean',
                  description: 'Include detailed legal analysis of decisions',
                  default: true,
                },
                language: {
                  type: 'string',
                  enum: ['bulgarian', 'english', 'bilingual'],
                  description: 'Language for response',
                  default: 'bulgarian',
                },
              },
              required: ['query'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case 'search_case_law':
            return await this.handleSearchCaseLaw(args);

          case 'analyze_legal_document':
            return await this.handleAnalyzeLegalDocument(args);

          case 'verify_contract_clauses':
            return await this.handleVerifyContractClauses(args);

          case 'compare_legal_documents':
            return await this.handleCompareLegalDocuments(args);

          case 'generate_case_summary':
            return await this.handleGenerateCaseSummary(args);

          case 'live_scrape_case_law':
            return await this.handleLiveScrapeCaseLaw(args);

          case 'analyze_case_law_trends':
            return await this.handleAnalyzeCaseLawTrends(args);

          case 'export_case_law_to_pdf':
            return await this.handleExportCaseLawToPDF(args);

          case 'export_legal_analysis_to_pdf':
            return await this.handleExportLegalAnalysisToPDF(args);

          case 'export_contract_to_pdf':
            return await this.handleExportContractToPDF(args);

          case 'list_exported_pdfs':
            return await this.handleListExportedPDFs(args);

          case 'delete_exported_pdf':
            return await this.handleDeleteExportedPDF(args);

          case 'find_similar_cases':
            return await this.handleFindSimilarCases(args);

          case 'generate_legal_citations':
            return await this.handleGenerateLegalCitations(args);

          case 'extract_key_terms':
            return await this.handleExtractKeyTerms(args);

          case 'search_lex_bg':
            return await this.handleSearchLexBg(args);

          case 'search_apis_legislation':
            return await this.handleSearchApisLegislation(args);

          case 'get_legal_news':
            return await this.handleGetLegalNews(args);

          case 'comprehensive_legal_research':
            return await this.handleComprehensiveLegalResearch(args);

          case 'analyze_document_with_real_data':
            return await this.handleAnalyzeDocumentWithRealData(args);

          case 'generate_case_strategy':
            return await this.handleGenerateCaseStrategy(args);

          case 'monitor_legal_changes':
            return await this.handleMonitorLegalChanges(args);

          case 'generate_client_advice':
            return await this.handleGenerateClientAdvice(args);

          case 'test_data_sources':
            return await this.handleTestDataSources(args);

          case 'query_rag_legal_documents':
            return await this.handleQueryRagLegalDocuments(args);

          case 'store_legal_document_in_rag':
            return await this.handleStoreLegalDocumentInRag(args);

          case 'enhanced_legal_search':
            return await this.handleEnhancedLegalSearch(args);

          case 'search_supreme_court_cassation':
            return await this.handleSearchSupremeCourt(args);

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error.message}`);
      }
    });
  }

  async handleSearchCaseLaw(args) {
    const result = await this.caseLawService.searchCaseLaw(args);

    // Enhanced response with search method information
    const searchInfo = [];
    if (result.searchMethods && result.searchMethods.length > 0) {
      searchInfo.push(`🔍 Методи на търсене: ${result.searchMethods.join(', ')}`);
      if (result.ragResultsCount > 0) {
        searchInfo.push(`📚 RAG база данни: ${result.ragResultsCount} резултата`);
      }
      if (result.liveScrapingCount > 0) {
        searchInfo.push(`🔥 Live scraping: ${result.liveScrapingCount} резултата`);
      }
    }

    const searchHeader = searchInfo.length > 0 ? searchInfo.join('\n') + '\n\n' : '';

    return {
      content: [
        {
          type: 'text',
          text:
            searchHeader +
            `📋 Намерени са ${result.total} съдебни решения:\n\n` +
            result.results
              .map((caseLaw, index) => {
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

                const ragScore = caseLaw.ragScore
                  ? ` (релевантност: ${Math.round(caseLaw.ragScore * 100)}%)`
                  : '';
                const precedentIcon =
                  caseLaw.precedentValue === 'high'
                    ? '⭐⭐⭐'
                    : caseLaw.precedentValue === 'medium'
                      ? '⭐⭐'
                      : '⭐';

                return (
                  `${sourceIcon} ${index + 1}. ${caseLaw.generateCitation()}${ragScore}\n` +
                  `   📜 Основание: ${caseLaw.legalBasis.articles.map((a) => `${a.article} от ${a.law}`).join(', ')}\n` +
                  `   ⚖️ Резултат: ${this.translateOutcome(caseLaw.outcome)}\n` +
                  `   ${precedentIcon} Прецедентна стойност: ${this.translatePrecedentValue(caseLaw.precedentValue)}\n` +
                  `   📝 Резюме: ${caseLaw.summary.substring(0, 200)}${caseLaw.summary.length > 200 ? '...' : ''}\n` +
                  `   🧠 Мотиви: ${caseLaw.reasoning.substring(0, 200)}${caseLaw.reasoning.length > 200 ? '...' : ''}\n`
                );
              })
              .join('\n') +
            (result.criteria && Object.keys(result.criteria).length > 0
              ? `\n\n🔍 Критерии за търсене:\n${this.formatSearchCriteria(result.criteria)}`
              : '') +
            (result.timestamp
              ? `\n\n⏰ Търсене извършено на: ${new Date(result.timestamp).toLocaleString('bg-BG')}`
              : ''),
        },
      ],
    };
  }

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

  formatSearchCriteria(criteria) {
    const parts = [];
    if (criteria.articles && criteria.articles.length > 0) {
      parts.push(`📜 Членове: ${criteria.articles.join(', ')}`);
    }
    if (criteria.laws && criteria.laws.length > 0) {
      parts.push(`⚖️ Закони: ${criteria.laws.join(', ')}`);
    }
    if (criteria.court) {
      parts.push(`🏛️ Съд: ${criteria.court}`);
    }
    if (criteria.parties && criteria.parties.length > 0) {
      parts.push(`👥 Страни: ${criteria.parties.join(', ')}`);
    }
    if (criteria.outcome) {
      parts.push(`📊 Резултат: ${this.translateOutcome(criteria.outcome)}`);
    }
    if (criteria.keywords && criteria.keywords.length > 0) {
      parts.push(`🔎 Ключови думи: ${criteria.keywords.join(', ')}`);
    }
    return parts.join('\n');
  }

  async handleAnalyzeLegalDocument(args) {
    const result = await this.documentAnalysisService.analyzeDocument(
      args.documentText,
      args.documentType,
    );

    return {
      content: [
        {
          type: 'text',
          text:
            `Анализ на правен документ:\n\n` +
            `Тип: ${result.document.type}\n` +
            `Дума: ${result.document.wordCount}\n` +
            `Клаузули: ${result.structure.clauses}\n` +
            `Правни препратки: ${result.structure.legalReferences}\n\n` +
            `РИСКОВА ОЦЕНКА: ${result.analysis.riskAssessment.level} (${result.analysis.riskAssessment.score})\n` +
            `Рискови фактори: ${result.analysis.riskAssessment.factors.join(', ')}\n\n` +
            `ПРОБЛЕМИ:\n${result.analysis.issues
              .map(
                (issue) =>
                  `• ${issue.severity.toUpperCase()}: ${issue.issue} - ${issue.description}`,
              )
              .join('\n')}\n\n` +
            `ПРЕПОРЪКИ:\n${result.recommendations.map((rec) => `• ${rec}`).join('\n')}`,
        },
      ],
    };
  }

  async handleVerifyContractClauses(args) {
    const result = await this.documentAnalysisService.verifyContractClauses(
      args.documentText,
      args.clausesToVerify,
    );

    return {
      content: [
        {
          type: 'text',
          text:
            `Проверка на договорни клаузули:\n\n` +
            `Общо клаузули в документа: ${result.documentAnalysis.totalClauses}\n` +
            `Проверени клаузули: ${result.documentAnalysis.verifiedClauses}\n` +
            `Намерени клаузули: ${result.documentAnalysis.foundClauses}\n\n` +
            `РЕЗУЛТАТИ:\n` +
            result.verificationResults
              .map(
                (v) =>
                  `• "${v.clause}": ${v.found ? 'НАМЕРЕНА' : 'НЕ Е НАМЕРЕНА'} ` +
                  `(Сигурност: ${v.confidence}, Сходство: ${(v.similarity * 100).toFixed(1)}%)\n` +
                  `  Препоръка: ${v.recommendation}`,
              )
              .join('\n\n') +
            '\n\n' +
            `ОБЩИ ПРЕПОРЪКИ:\n${result.recommendations.map((rec) => `• ${rec}`).join('\n')}`,
        },
      ],
    };
  }

  async handleCompareLegalDocuments(args) {
    const result = await this.documentAnalysisService.compareDocuments(
      args.document1Text,
      args.document2Text,
    );

    return {
      content: [
        {
          type: 'text',
          text:
            `Сравнение на правни документи:\n\n` +
            `ОБЩО СХОДСТВО: ${(result.similarity.overall * 100).toFixed(1)}%\n` +
            `Сходство на клаузули: ${(result.similarity.clauses * 100).toFixed(1)}%\n` +
            `Сходство на препратки: ${(result.similarity.references * 100).toFixed(1)}%\n\n` +
            `ДОКУМЕНТ 1:\n` +
            `- Клаузули: ${result.document1.clauses}\n` +
            `- Препратки: ${result.document1.references}\n` +
            `- Уникални клаузули: ${result.document1.uniqueClauses}\n\n` +
            `ДОКУМЕНТ 2:\n` +
            `- Клаузули: ${result.document2.clauses}\n` +
            `- Препратки: ${result.document2.references}\n` +
            `- Уникални клаузули: ${result.document2.uniqueClauses}\n\n` +
            `ОБЩИ КЛАУЗУЛИ: ${result.comparison.commonClauses.length}\n` +
            `ОБЩИ ПРЕПРАТКИ: ${result.comparison.commonReferences.join(', ')}\n\n` +
            `ПРЕПОРЪКИ:\n${result.recommendations.map((rec) => `• ${rec}`).join('\n')}`,
        },
      ],
    };
  }

  async handleGenerateCaseSummary(args) {
    const cases = await this.caseLawService.searchCaseLaw(args.searchCriteria);
    const summary = await this.caseLawService.generateCasesSummary(cases.results);

    return {
      content: [
        {
          type: 'text',
          text: summary.summary,
        },
      ],
    };
  }

  async handleFindSimilarCases(args) {
    const result = await this.caseLawService.findSimilarCases(args.referenceCase, args.limit);

    return {
      content: [
        {
          type: 'text',
          text:
            `Намерени ${result.total} сходни случая:\n\n` +
            result.results
              .map(
                (item, index) =>
                  `${index + 1}. ${item.case.generateCitation()}\n` +
                  `   Сходство: ${(item.similarity * 100).toFixed(1)}%\n` +
                  `   Основание: ${item.reasoning}\n` +
                  `   Резюме: ${item.case.summary}\n\n`,
              )
              .join(''),
        },
      ],
    };
  }

  async handleGenerateLegalCitations(args) {
    const citations = [];

    for (const source of args.sources) {
      if (source.type === 'case') {
        const mockCase = {
          caseNumber: source.caseNumber,
          court: source.court,
          date: source.date ? new Date(source.date) : new Date(),
          documentUrl: source.url,
        };
        citations.push(this.citationService.formatCourtCitation(mockCase));
      } else if (source.type === 'law') {
        citations.push(this.citationService.formatLawCitation({ text: source.law }));
      } else if (source.type === 'article') {
        citations.push(
          this.citationService.formatArticleCitation({
            text: `${source.article} от ${source.law}`,
          }),
        );
      }
    }

    let output = '';

    if (args.format === 'json') {
      output = JSON.stringify(citations, null, 2);
    } else if (args.includeBibliography) {
      const bibliography = this.citationService.generateBibliography(citations);
      output = this.citationService.generateBibliographyText(bibliography);
    } else {
      output = citations.map((c) => c.full).join('\n');
    }

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
    };
  }

  async handleExtractKeyTerms(args) {
    const result = await this.documentAnalysisService.extractKeyTerms(args.documentText);

    return {
      content: [
        {
          type: 'text',
          text:
            `Ключови термини в документа:\n\n` +
            `Общо термини: ${result.summary.totalTerms}\n` +
            `Дефиниции: ${result.summary.totalDefinitions}\n` +
            `Най-често срещан: ${result.summary.mostFrequent}\n\n` +
            `ТЕРМИНИ ПО ЧЕСТОТА:\n` +
            result.keyTerms
              .slice(0, 10)
              .map((term) => `• ${term.term}: ${term.frequency} пъти`)
              .join('\n') +
            '\n\n' +
            (result.definitions.length > 0
              ? `ДЕФИНИЦИИ:\n` +
                result.definitions.map((def) => `• "${def.term}": ${def.definition}`).join('\n')
              : 'Няма намерени формални дефиниции.'),
        },
      ],
    };
  }

  // New real-data integration handlers

  async handleSearchLexBg(args) {
    try {
      // Use the new Firecrawl-enabled search method
      const result = await this.lexBgService.searchWithFirecrawl(args.query, {
        documentType: args.documentType || '',
        institution: args.institution || '',
        limit: args.limit || 10,
      });

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Грешка при търсене в lex.bg с Firecrawl: ${result.error}`,
            },
          ],
        };
      }

      const { results, fromVectorDB, searchMethods } = result;

      let responseText = `🔥 **ТЪРСЕНЕ В LEX.BG С FIRECRAWL**\n\n`;
      responseText += `📊 **Резултати:** ${results.length}\n`;
      responseText += `💾 **Източник:** ${fromVectorDB ? 'Vector Database' : 'Live Scraping + Saved to Vector DB'}\n`;
      if (searchMethods && searchMethods.length > 0) {
        responseText += `🔍 **Методи:** ${searchMethods.join(', ')}\n`;
      }
      responseText += `\n`;

      if (results.length === 0) {
        responseText += `Няма намерени резултати за "${args.query}".\n\n`;
        responseText += `💡 **Съвети:**\n`;
        responseText += `- Опитайте с различни ключови думи\n`;
        responseText += `- Използвайте по-кратки фрази\n`;
        responseText += `- Проверете правописа на българските думи\n`;
      } else {
        results.forEach((doc, index) => {
          responseText += `**${index + 1}. ${doc.title}**\n`;
          if (doc.source) responseText += `   📰 Източник: ${doc.source}\n`;
          if (doc.date) responseText += `   📅 Дата: ${doc.date}\n`;
          if (doc.type) responseText += `   📄 Тип: ${doc.type}\n`;
          if (doc.url) responseText += `   🔗 URL: ${doc.url}\n`;
          if (doc.summary) responseText += `   📝 Резюме: ${doc.summary}\n`;
          if (doc.content && doc.content.length > 200) {
            responseText += `   📖 Съдържание: ${doc.content.substring(0, 300)}...\n`;
          }
          responseText += `\n`;
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Системна грешка при търсене в lex.bg: ${error.message}`,
          },
        ],
      };
    }
  }

  async handleSearchApisLegislation(args) {
    const result = await this.apisService.searchLegislation(args);

    return {
      content: [
        {
          type: 'text',
          text: result.success
            ? `Търсене в АПИС (${args.database}) намери ${result.results.length} резултата:\n\n` +
              result.results
                .map(
                  (doc, index) =>
                    `${index + 1}. ${doc.title}\n` +
                    `   Източник: ${doc.source}\n` +
                    `   Дата: ${doc.date}\n` +
                    `   Тип: ${doc.type}\n` +
                    `   URL: ${doc.url}\n` +
                    `   Резюме: ${doc.summary}\n\n`,
                )
                .join('')
            : `Грешка при търсене в АПИС: ${result.error}`,
        },
      ],
    };
  }

  async handleGetLegalNews(args) {
    const [lexNews, apisNews] = await Promise.allSettled([
      this.lexBgService.getLegalNews(args),
      this.apisService.getLatestUpdates('law', args.limit || 5),
    ]);

    let newsText = 'Последни правни новини:\n\n';

    if (lexNews.status === 'fulfilled' && lexNews.value.success) {
      newsText += '📰 lex.bg новини:\n';
      lexNews.value.news.forEach((item, index) => {
        newsText += `${index + 1}. ${item.title}\n`;
        if (item.date) newsText += `   Дата: ${item.date}\n`;
        if (item.summary) newsText += `   ${item.summary.substring(0, 150)}...\n`;
        if (item.url) newsText += `   URL: ${item.url}\n`;
        newsText += '\n';
      });
    }

    if (apisNews.status === 'fulfilled' && apisNews.value.success) {
      newsText += '\n📚 АПИС актуализации:\n';
      apisNews.value.updates.forEach((item, index) => {
        newsText += `${index + 1}. ${item.title}\n`;
        if (item.date) newsText += `   Дата: ${item.date}\n`;
        if (item.summary) newsText += `   ${item.summary.substring(0, 150)}...\n`;
        if (item.url) newsText += `   URL: ${item.url}\n`;
        newsText += '\n';
      });
    }

    return {
      content: [
        {
          type: 'text',
          text: newsText,
        },
      ],
    };
  }

  async handleComprehensiveLegalResearch(args) {
    const result = await this.lawyerToolsService.comprehensiveLegalResearch(args.query, args);

    if (!result.success) {
      return {
        content: [
          {
            type: 'text',
            text: `Грешка при изследването: ${result.error}`,
          },
        ],
      };
    }

    const { results, totalItems, sources } = result;

    let researchText = `🔍 Обширно правно изследване за: "${args.query}"\n`;
    researchText += `📊 Общо намерени документи: ${totalItems}\n`;
    researchText += `🔗 Търсени източници: ${sources.join(', ')}\n\n`;

    researchText += `📋 Резюме: ${results.summary}\n\n`;

    if (results.legislation.length > 0) {
      researchText += `⚖️ ЗАКОНОДАТЕЛСТВО (${results.legislation.length}):\n`;
      results.legislation.slice(0, 10).forEach((item, index) => {
        researchText += `${index + 1}. ${item.title}\n`;
        if (item.summary) researchText += `   ${item.summary.substring(0, 100)}...\n`;
        researchText += '\n';
      });
    }

    if (results.caselaw.length > 0) {
      researchText += `🏛️ СЪДЕБНА ПРАКТИКА (${results.caselaw.length}):\n`;
      results.caselaw.slice(0, 10).forEach((item, index) => {
        researchText += `${index + 1}. ${item.title}\n`;
        if (item.summary) researchText += `   ${item.summary.substring(0, 100)}...\n`;
        researchText += '\n';
      });
    }

    if (results.news.length > 0) {
      researchText += `📰 НОВИНИ И АКТУАЛИЗАЦИИ (${results.news.length}):\n`;
      results.news.slice(0, 5).forEach((item, index) => {
        researchText += `${index + 1}. ${item.title}\n`;
        if (item.date) researchText += `   Дата: ${item.date}\n`;
        researchText += '\n';
      });
    }

    return {
      content: [
        {
          type: 'text',
          text: researchText,
        },
      ],
    };
  }

  async handleAnalyzeDocumentWithRealData(args) {
    const result = await this.lawyerToolsService.analyzeLegalDocument(
      args.documentText,
      args.analysisType,
    );

    if (!result.success) {
      return {
        content: [
          {
            type: 'text',
            text: `Грешка при анализа: ${result.error}`,
          },
        ],
      };
    }

    const { analysis, confidence } = result;

    let analysisText = `📋 АНАЛИЗ НА ПРАВЕН ДОКУМЕНТ\n`;
    analysisText += `🎯 Степен на увереност: ${Math.round(confidence * 100)}%\n\n`;

    analysisText += `📄 Тип документ: ${analysis.documentType}\n`;
    analysisText += `🔗 Правни препратки: ${analysis.legalReferences.length}\n`;
    analysisText += `🔑 Ключови термини: ${analysis.keyTerms.join(', ')}\n\n`;

    if (analysis.riskAssessment.high.length > 0) {
      analysisText += `⚠️ ВИСОКИ РИСКОВЕ:\n`;
      analysis.riskAssessment.high.forEach((risk) => {
        analysisText += `• ${risk}\n`;
      });
      analysisText += '\n';
    }

    if (analysis.riskAssessment.medium.length > 0) {
      analysisText += `⚡ СРЕДНИ РИСКОВЕ:\n`;
      analysis.riskAssessment.medium.forEach((risk) => {
        analysisText += `• ${risk}\n`;
      });
      analysisText += '\n';
    }

    if (analysis.recommendations.length > 0) {
      analysisText += `💡 ПРЕПОРЪКИ:\n`;
      analysis.recommendations.forEach((rec) => {
        analysisText += `• ${rec}\n`;
      });
      analysisText += '\n';
    }

    if (analysis.relatedCases.length > 0) {
      analysisText += `🏛️ СВЪРЗАНИ ДЕЛА (${analysis.relatedCases.length}):\n`;
      analysis.relatedCases.slice(0, 5).forEach((case_item, index) => {
        analysisText += `${index + 1}. ${case_item.title}\n`;
      });
    }

    return {
      content: [
        {
          type: 'text',
          text: analysisText,
        },
      ],
    };
  }

  async handleGenerateCaseStrategy(args) {
    const result = await this.lawyerToolsService.generateCaseStrategy(args);

    if (!result.success) {
      return {
        content: [
          {
            type: 'text',
            text: `Грешка при генериране на стратегия: ${result.error}`,
          },
        ],
      };
    }

    const { strategy, similarCases, confidence } = result;

    let strategyText = `⚖️ ПРАВНА СТРАТЕГИЯ ЗА ДЕЛО\n`;
    strategyText += `🎯 Степен на увереност: ${Math.round(confidence * 100)}%\n\n`;

    strategyText += `📋 Тип дело: ${args.caseType}\n`;
    strategyText += `📝 Факти: ${args.facts}\n\n`;

    if (strategy.legalArguments.length > 0) {
      strategyText += `⚖️ ПРАВНИ АРГУМЕНТИ:\n`;
      strategy.legalArguments.forEach((arg) => {
        strategyText += `• ${arg}\n`;
      });
      strategyText += '\n';
    }

    if (strategy.riskFactors.length > 0) {
      strategyText += `⚠️ РИСКОВИ ФАКТОРИ:\n`;
      strategy.riskFactors.forEach((risk) => {
        strategyText += `• ${risk}\n`;
      });
      strategyText += '\n';
    }

    strategyText += `⏱️ Прогнозен срок: ${strategy.timeline}\n`;
    strategyText += `📊 Вероятност за успех: ${Math.round(strategy.successProbability * 100)}%\n\n`;

    if (strategy.strategicRecommendations.length > 0) {
      strategyText += `💡 СТРАТЕГИЧЕСКИ ПРЕПОРЪКИ:\n`;
      strategy.strategicRecommendations.forEach((rec) => {
        strategyText += `• ${rec}\n`;
      });
      strategyText += '\n';
    }

    if (similarCases.length > 0) {
      strategyText += `🏛️ ПОДОБНИ ДЕЛА (${similarCases.length}):\n`;
      similarCases.slice(0, 5).forEach((case_item, index) => {
        strategyText += `${index + 1}. ${case_item.title}\n`;
      });
    }

    return {
      content: [
        {
          type: 'text',
          text: strategyText,
        },
      ],
    };
  }

  async handleMonitorLegalChanges(args) {
    const result = await this.lawyerToolsService.monitorLegalChanges(
      args.practiceAreas,
      args.keywords,
    );

    if (!result.success) {
      return {
        content: [
          {
            type: 'text',
            text: `Грешка при мониторинг: ${result.error}`,
          },
        ],
      };
    }

    const { changes, practiceAreas, lastUpdated } = result;

    let monitorText = `📡 МОНИТОРИНГ НА ПРАВНИ ПРОМЕНИ\n`;
    monitorText += `🎯 Области: ${practiceAreas.join(', ')}\n`;
    monitorText += `🕐 Последна актуализация: ${new Date(lastUpdated).toLocaleString('bg-BG')}\n\n`;

    if (changes.alerts.length > 0) {
      monitorText += `🚨 ВАЖНИ ИЗВЕСТИЯ:\n`;
      changes.alerts.forEach((alert) => {
        monitorText += `• ${alert.title} (${alert.priority})\n`;
      });
      monitorText += '\n';
    }

    if (changes.legislation.length > 0) {
      monitorText += `⚖️ НОВИ НОРМАТИВНИ АКТОВЕ:\n`;
      changes.legislation.slice(0, 10).forEach((item, index) => {
        monitorText += `${index + 1}. ${item.title}\n`;
        if (item.date) monitorText += `   Дата: ${item.date}\n`;
        monitorText += '\n';
      });
    }

    if (changes.caselaw.length > 0) {
      monitorText += `🏛️ НОВА СЪДЕБНА ПРАКТИКА:\n`;
      changes.caselaw.slice(0, 10).forEach((item, index) => {
        monitorText += `${index + 1}. ${item.title}\n`;
        if (item.date) monitorText += `   Дата: ${item.date}\n`;
        monitorText += '\n';
      });
    }

    return {
      content: [
        {
          type: 'text',
          text: monitorText,
        },
      ],
    };
  }

  async handleGenerateClientAdvice(args) {
    const result = await this.lawyerToolsService.generateClientAdvice(args);

    if (!result.success) {
      return {
        content: [
          {
            type: 'text',
            text: `Грешка при генериране на съвет: ${result.error}`,
          },
        ],
      };
    }

    const { advice, research, confidence } = result;

    let adviceText = `💼 ПРАВЕН СЪВЕТ ЗА КЛИЕНТ\n`;
    adviceText += `🎯 Степен на увереност: ${Math.round(confidence * 100)}%\n\n`;

    adviceText += `📋 Ситуация: ${args.situation}\n`;
    adviceText += `⚡ Спешност: ${args.urgency}\n`;
    adviceText += `👤 Тип клиент: ${args.clientType}\n\n`;

    adviceText += `📝 РЕЗЮМЕ:\n${advice.summary}\n\n`;

    if (advice.recommendedActions.length > 0) {
      adviceText += `✅ ПРЕПОРЪЧАНИ ДЕЙСТВИЯ:\n`;
      advice.recommendedActions.forEach((action) => {
        adviceText += `• ${action}\n`;
      });
      adviceText += '\n';
    }

    if (advice.risks.length > 0) {
      adviceText += `⚠️ РИСКОВЕ:\n`;
      advice.risks.forEach((risk) => {
        adviceText += `• ${risk}\n`;
      });
      adviceText += '\n';
    }

    if (advice.nextSteps.length > 0) {
      adviceText += `➡️ СЛЕДВАЩИ СТЪПКИ:\n`;
      advice.nextSteps.forEach((step) => {
        adviceText += `• ${step}\n`;
      });
      adviceText += '\n';
    }

    if (advice.legalOptions.length > 0) {
      adviceText += `⚖️ ПРАВНИ ОПЦИИ:\n`;
      advice.legalOptions.forEach((option, index) => {
        adviceText += `${index + 1}. ${option.option} (${option.viability} вероятност)\n`;
        adviceText += `   Цена: ${option.cost}, Време: ${option.timeframe}\n`;
      });
    }

    return {
      content: [
        {
          type: 'text',
          text: adviceText,
        },
      ],
    };
  }

  async handleTestDataSources(args) {
    const [lexTest, apisTest] = await Promise.allSettled([
      this.lexBgService.testConnection(),
      this.apisService.testConnection(),
    ]);

    let testText = '🔧 ТЕСТ НА ИЗТОЧНИЦИ НА ДАННИ\n\n';

    testText += '📍 lex.bg:\n';
    if (lexTest.status === 'fulfilled') {
      const result = lexTest.value;
      testText += `   Статус: ${result.success ? '✅ Работи' : '❌ Не работи'}\n`;
      testText += `   HTTP код: ${result.status}\n`;
      testText += `   Съобщение: ${result.message}\n`;
    } else {
      testText += '   Статус: ❌ Грешка при тест\n';
      testText += `   Грешка: ${lexTest.reason}\n`;
    }

    testText += '\n📚 АПИС:\n';
    if (apisTest.status === 'fulfilled') {
      const result = apisTest.value;
      testText += `   Статус: ${result.success ? '✅ Работи' : '❌ Не работи'}\n`;
      testText += `   HTTP код: ${result.status}\n`;
      testText += `   Съобщение: ${result.message}\n`;
    } else {
      testText += '   Статус: ❌ Грешка при тест\n';
      testText += `   Грешка: ${apisTest.reason}\n`;
    }

    const availableDatabases = this.apisService.getAvailableDatabases();
    if (availableDatabases.success) {
      testText += '\n📊 Налични АПИС бази данни:\n';
      Object.entries(availableDatabases.databases).forEach(([key, name]) => {
        testText += `   • ${key}: ${name}\n`;
      });
    }

    return {
      content: [
        {
          type: 'text',
          text: testText,
        },
      ],
    };
  }

  // RAG Integration Handlers

  async handleQueryRagLegalDocuments(args) {
    if (!process.env.RAG_API_URL) {
      return {
        content: [
          {
            type: 'text',
            text: '❌ RAG система не е налична. Моля, настройте RAG_API_URL.',
          },
        ],
      };
    }

    try {
      const result = await this.lawyerToolsService.ragService.queryLegalDocuments(args.query, {
        limit: args.limit || 10,
        minSimilarity: args.minSimilarity || 0.7,
      });

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Грешка при търсене в RAG: ${result.error}`,
            },
          ],
        };
      }

      let responseText = `🔍 RAG ТЪРСЕНЕ: "${args.query}"\n`;
      responseText += `📊 Намерени документи: ${result.results.length}\n\n`;

      if (result.results.length === 0) {
        responseText += '❗ Няма намерени документи в RAG системата.\n';
        responseText +=
          'Използвайте enhanced_legal_search за нови търсения или store_legal_document_in_rag за добавяне на документи.\n';
      } else {
        result.results.forEach((doc, index) => {
          responseText += `${index + 1}. ${doc.title || 'Неизвестен документ'}\n`;
          if (doc.metadata) {
            if (doc.metadata.source) responseText += `   📍 Източник: ${doc.metadata.source}\n`;
            if (doc.metadata.date) responseText += `   📅 Дата: ${doc.metadata.date}\n`;
            if (doc.metadata.type) responseText += `   📋 Тип: ${doc.metadata.type}\n`;
          }
          if (doc.similarity)
            responseText += `   🎯 Сходство: ${Math.round(doc.similarity * 100)}%\n`;
          if (doc.content) responseText += `   📄 ${doc.content.substring(0, 200)}...\n`;
          responseText += '\n';
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Системна грешка: ${error.message}`,
          },
        ],
      };
    }
  }

  async handleStoreLegalDocumentInRag(args) {
    if (!process.env.RAG_API_URL) {
      return {
        content: [
          {
            type: 'text',
            text: '❌ RAG система не е налична. Моля, настройте RAG_API_URL.',
          },
        ],
      };
    }

    try {
      const documentData = {
        title: args.title,
        content: args.content,
        metadata: args.metadata || {},
        source: args.source || 'manual_upload',
      };

      const result = await this.lawyerToolsService.ragService.storeLegalDocument(documentData);

      let responseText = `📄 СЪХРАНЯВАНЕ В RAG\n\n`;
      responseText += `📋 Заглавие: ${args.title}\n`;
      responseText += `📍 Източник: ${args.source || 'manual_upload'}\n`;
      responseText += `📊 Размер: ${args.content.length} символа\n\n`;

      if (result.success) {
        responseText += `✅ Документът е успешно съхранен в RAG системата!\n`;
        responseText += `🆔 ID на файла: ${result.fileId}\n`;
        responseText += `🔗 Вградено: ${result.embedded ? 'Да' : 'Не'}\n\n`;
        responseText += `💡 Документът вече може да се търси чрез query_rag_legal_documents.`;
      } else {
        responseText += `❌ Грешка при съхраняването: ${result.error}\n`;
        responseText += `💡 Моля, проверете дали RAG системата работи правилно.`;
      }

      return {
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Системна грешка при съхраняването: ${error.message}`,
          },
        ],
      };
    }
  }

  async handleEnhancedLegalSearch(args) {
    // If RAG is not available, use Firecrawl-enhanced search instead
    if (!process.env.RAG_API_URL) {
      console.log('⚠️ RAG система не е налична. Използва се Firecrawl търсене.');
      return await this.handleEnhancedSearchWithoutRAG(args);
    }

    try {
      const {
        query,
        sources = ['both'],
        useRagFirst = true,
        storeResults = true,
        limit = 20,
      } = args;

      let searchPromises = [];

      // Determine which sources to search
      const searchLex = sources.includes('lex.bg') || sources.includes('both');
      const searchApis = sources.includes('apis') || sources.includes('both');

      if (searchLex) {
        searchPromises.push(
          this.lexBgService
            .searchLegalDocuments({
              query,
              useRag: useRagFirst,
              storeResults,
              limit: Math.floor(limit / (searchApis ? 2 : 1)),
            })
            .then((result) => ({ source: 'lex.bg', ...result })),
        );
      }

      if (searchApis) {
        searchPromises.push(
          this.apisService
            .searchLegislation({
              query,
              useRag: useRagFirst,
              storeResults,
              limit: Math.floor(limit / (searchLex ? 2 : 1)),
            })
            .then((result) => ({ source: 'apis', ...result })),
        );
      }

      const searchResults = await Promise.allSettled(searchPromises);

      let responseText = `🔍 РАЗШИРЕНО ПРАВНО ТЪРСЕНЕ\n`;
      responseText += `📝 Запитване: "${query}"\n`;
      responseText += `📡 Използва RAG: ${useRagFirst ? 'Да' : 'Не'}\n`;
      responseText += `💾 Съхранява резултати: ${storeResults ? 'Да' : 'Не'}\n\n`;

      let totalResults = 0;
      let ragResults = 0;
      let liveResults = 0;

      searchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          const data = result.value;
          const sourceName = data.source;

          responseText += `📊 ${sourceName.toUpperCase()} РЕЗУЛТАТИ:\n`;
          responseText += `   Общо: ${data.results ? data.results.length : 0}\n`;

          if (data.ragResults !== undefined) {
            responseText += `   От RAG: ${data.ragResults}\n`;
            responseText += `   Нови: ${data.liveResults}\n`;
            ragResults += data.ragResults;
            liveResults += data.liveResults;
          }

          responseText += '\n';

          if (data.results && data.results.length > 0) {
            totalResults += data.results.length;

            data.results.slice(0, 5).forEach((item, idx) => {
              responseText += `${idx + 1}. ${item.title}\n`;
              if (item.source) responseText += `   📍 ${item.source}\n`;
              if (item.date) responseText += `   📅 ${item.date}\n`;
              if (item.summary) responseText += `   📄 ${item.summary.substring(0, 100)}...\n`;
              responseText += '\n';
            });

            if (data.results.length > 5) {
              responseText += `... и още ${data.results.length - 5} резултата\n\n`;
            }
          }
        } else {
          const sourceName = sources[index] || 'неизвестен източник';
          responseText += `❌ Грешка в ${sourceName}: ${result.reason || 'неизвестна грешка'}\n\n`;
        }
      });

      responseText += `📈 ОБОБЩЕНИЕ:\n`;
      responseText += `   Общо документи: ${totalResults}\n`;
      if (useRagFirst) {
        responseText += `   От RAG: ${ragResults}\n`;
        responseText += `   Нови търсения: ${liveResults}\n`;
      }

      return {
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Грешка при разширеното търсене: ${error.message}`,
          },
        ],
      };
    }
  }

  /**
   * Enhanced search without RAG - uses Firecrawl for all sources
   */
  async handleEnhancedSearchWithoutRAG(args) {
    try {
      const {
        query,
        sources = ['both'],
        limit = 20,
      } = args;

      let searchPromises = [];

      // Determine which sources to search
      const searchLex = sources.includes('lex.bg') || sources.includes('both');
      const searchApis = sources.includes('apis') || sources.includes('both');

      console.log(`🔥 Enhanced Firecrawl search for: "${query}"`);

      if (searchLex) {
        searchPromises.push(
          this.lexBgService.searchWithFirecrawl(query, { limit: Math.ceil(limit / 2) })
            .then(result => ({ source: 'lex.bg', ...result }))
            .catch(error => ({ source: 'lex.bg', success: false, error: error.message, results: [] }))
        );
      }

      if (searchApis) {
        searchPromises.push(
          this.apisService.searchLegislation({ query, limit: Math.ceil(limit / 2) })
            .then(result => ({ source: 'apis', ...result }))
            .catch(error => ({ source: 'apis', success: false, error: error.message, results: [] }))
        );
      }

      // Execute searches in parallel
      const searchResults = await Promise.all(searchPromises);

      // Combine and process results
      const allResults = [];
      let responseText = `🔥 **ENHANCED FIRECRAWL LEGAL SEARCH**\n\n`;
      responseText += `🔍 **Заявка:** ${query}\n`;
      responseText += `📊 **Търсене в:** ${sources.join(', ')}\n\n`;

      searchResults.forEach(result => {
        if (result.success && result.results.length > 0) {
          responseText += `✅ **${result.source.toUpperCase()}:** ${result.results.length} резултата\n`;
          if (result.fromVectorDB) {
            responseText += `   💾 Източник: Vector Database\n`;
          } else if (result.method) {
            responseText += `   🔍 Метод: ${result.method}\n`;
          }
          allResults.push(...result.results.map(r => ({ ...r, source: result.source })));
        } else {
          responseText += `❌ **${result.source.toUpperCase()}:** Грешка - ${result.error || 'Няма резултати'}\n`;
        }
      });

      responseText += `\n📋 **ОБЩО РЕЗУЛТАТИ: ${allResults.length}**\n\n`;

      if (allResults.length === 0) {
        responseText += `❗ Няма намерени резултати за "${query}".\n\n`;
        responseText += `💡 **Препоръки:**\n`;
        responseText += `- Опитайте с различни ключови думи\n`;
        responseText += `- Използвайте синоними\n`;
        responseText += `- Проверете правописа\n`;
      } else {
        // Sort by relevance and show top results
        const sortedResults = allResults
          .sort((a, b) => (b.vectorScore || 0) - (a.vectorScore || 0))
          .slice(0, limit);

        sortedResults.forEach((doc, index) => {
          responseText += `**${index + 1}. ${doc.title}**\n`;
          responseText += `   📰 Източник: ${doc.source}\n`;
          if (doc.date) responseText += `   📅 Дата: ${doc.date}\n`;
          if (doc.type) responseText += `   📄 Тип: ${doc.type}\n`;
          if (doc.url) responseText += `   🔗 URL: ${doc.url}\n`;
          if (doc.summary) responseText += `   📝 Резюме: ${doc.summary.substring(0, 200)}...\n`;
          if (doc.vectorScore) responseText += `   🎯 Релевантност: ${(doc.vectorScore * 100).toFixed(1)}%\n`;
          responseText += `\n`;
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Грешка при разширено търсене: ${error.message}`,
          },
        ],
      };
    }
  }

  async handleSearchSupremeCourt(args) {
    try {
      // Use the new Firecrawl-enabled VKS search
      const searchCriteria = {
        query: args.query,
        chamber: args.chamber || 'any',
        decisionType: args.decisionType || 'any',
        dateFrom: args.dateFrom || '',
        dateTo: args.dateTo || '',
        caseNumber: args.caseNumber || '',
        maxResults: args.maxResults || 20,
      };

      const result = await this.vksScraperService.searchVKSWithFirecrawl(searchCriteria);

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Грешка при търсене във ВКС с Firecrawl: ${result.error}`,
            },
          ],
        };
      }

      const { results, fromVectorDB, searchMethods, totalResults } = result;

      let responseText = `🔥 **ТЪРСЕНЕ ВЪВ ВЪРХОВНИЯ КАСАЦИОНЕН СЪД С FIRECRAWL**\n\n`;
      responseText += `**Параметри на търсенето:**\n`;
      responseText += `- Заявка: ${args.query}\n`;
      if (args.caseNumber) responseText += `- Номер на делото: ${args.caseNumber}\n`;
      if (args.legalArticle) responseText += `- Правна разпоредба: ${args.legalArticle}\n`;
      const chamberMapping = {
        civil: 'Гражданска',
        criminal: 'Наказателна',
        commercial: 'Търговска'
      };
      responseText += `- Колегия: ${chamberMapping[searchCriteria.chamber] || 'Всички'}\n`;
      const decisionTypeMapping = {
        'решение': 'Решение',
        'определение': 'Определение',
        'постановление': 'Постановление'
      };
      responseText += `- Тип решение: ${decisionTypeMapping[searchCriteria.decisionType] || 'Всички типове'}\n`;
      responseText += `💾 **Източник:** ${fromVectorDB ? 'Vector Database' : 'Live Scraping + Saved to Vector DB'}\n`;
      if (searchMethods && searchMethods.length > 0) {
        responseText += `🔍 **Методи:** ${searchMethods.join(', ')}\n`;
      }
      responseText += `\n📊 **Намерени решения: ${totalResults || results.length}**\n\n`;

      if (results.length === 0) {
        responseText += `❗ Няма намерени решения от Върховния касационен съд за тази заявка.\n`;
        responseText += `💡 Препоръки:\n`;
        responseText += `- Опитайте с по-общи термини\n`;
        responseText += `- Проверете правописа на българските термини\n`;
        responseText += `- Използвайте синоними или свързани правни понятия\n`;
      } else {
        responseText += `⚖️ **РЕЗУЛТАТИ:**\n\n`;

        results.slice(0, 10).forEach((decision, index) => {
          responseText += `**${index + 1}. ${decision.title || 'Решение на ВКС'}**\n`;
          if (decision.source) responseText += `📍 Източник: ${decision.source}\n`;
          if (decision.date) responseText += `📅 Дата: ${decision.date}\n`;
          if (decision.url) responseText += `🔗 URL: ${decision.url}\n`;
          if (decision.type) responseText += `📄 Тип: ${decision.type}\n`;
          if (decision.caseNumber) responseText += `📋 Дело: ${decision.caseNumber}\n`;
          if (decision.chamber) responseText += `🏛️ Колегия: ${decision.chamber}\n`;
          if (decision.content && decision.content.length > 200) {
            responseText += `📖 Съдържание: ${decision.content.substring(0, 300)}...\n`;
          } else if (decision.summary) {
            responseText += `📝 Резюме: ${decision.summary}\n`;
          }
          responseText += '\n';
        });

        if (results.length > 10) {
          responseText += `... и още ${results.length - 10} резултата\n\n`;
        }
      }

      responseText += `\n**📋 Забележка за прецедентната стойност:**\n`;
      responseText += `Решенията на Върховния касационен съд имат висока прецедентна стойност в българската правна система. Тълкувателните решения са задължителни за всички съдилища, а касационните решения създават важни правни прецеденти.\n\n`;

      responseText += `**⚖️ Правна значимост:**\n`;
      responseText += `- Касационни решения: Установяват единна съдебна практика\n`;
      responseText += `- Тълкувателни решения: Задължителни за всички съдилища\n`;
      responseText += `- Обединителни решения: Решават противоречия в съдебната практика\n`;

      return {
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Системна грешка при търсене във ВКС: ${error.message}`,
          },
        ],
      };
    }
  }

  /**
   * Handle live scraping of case law using Firecrawl
   */
  async handleLiveScrapeCaseLaw(args) {
    try {
      // Import the service if not already imported
      if (!this.caseLawFirecrawlService) {
        const { CaseLawFirecrawlService } = await import('./services/CaseLawFirecrawlService.js');
        this.caseLawFirecrawlService = new CaseLawFirecrawlService();
      }

      const {
        query,
        sources = ['vks', 'vas'],
        maxResults = 10,
        relevanceThreshold = 70,
        saveToRag = true
      } = args;

      console.log(`🔥 Starting live scrape for: "${query}"`);

      const result = await this.caseLawFirecrawlService.searchAndScrapeCaseLaw({
        keywords: [query],
        limit: maxResults,
        sources,
        useFirecrawl: true,
        useRag: false, // Don't use RAG for live scraping
        saveToRag
      });

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Грешка при live scraping: ${result.error || 'Неизвестна грешка'}`,
            },
          ],
        };
      }

      const responseText = `🔥 LIVE SCRAPING РЕЗУЛТАТИ\n` +
        `🔍 Търсене: "${query}"\n` +
        `📊 Намерени случаи: ${result.results.length}\n` +
        `📚 Използвани източници: ${result.sources.join(', ')}\n` +
        `💾 Запазени в RAG: ${saveToRag ? 'Да' : 'Не'}\n\n` +
        result.results.map((caseLaw, index) => {
          const sourceIcon = caseLaw.source === 'vks' ? '⚖️' :
                           caseLaw.source === 'vas' ? '🏛️' : 
                           caseLaw.source === 'lexbg' ? '📖' : '📋';
          
          return `${sourceIcon} ${index + 1}. ${caseLaw.generateCitation()}\n` +
                 `   📜 Основание: ${caseLaw.legalBasis.articles.map((a) => `${a.article} от ${a.law}`).join(', ')}\n` +
                 `   ⚖️ Резултат: ${this.translateOutcome(caseLaw.outcome)}\n` +
                 `   📝 Резюме: ${caseLaw.summary.substring(0, 200)}${caseLaw.summary.length > 200 ? '...' : ''}\n` +
                 `   🔗 URL: ${caseLaw.documentUrl}\n`;
        }).join('\n') +
        `\n⏰ Scraping извършено на: ${new Date().toLocaleString('bg-BG')}`;

      return {
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      };

    } catch (error) {
      console.error('Live scraping error:', error);
      return {
        content: [
          {
            type: 'text',
            text: `❌ Грешка при live scraping: ${error.message}`,
          },
        ],
      };
    }
  }

  /**
   * Handle case law trends analysis
   */
  async handleAnalyzeCaseLawTrends(args) {
    try {
      const {
        searchCriteria,
        analysisType = 'temporal',
        timeGranularity = 'yearly'
      } = args;

      // First get the cases for analysis
      const casesResult = await this.caseLawService.searchCaseLaw({
        ...searchCriteria,
        limit: 100, // Get more cases for trend analysis
        useFirecrawl: true,
        useRag: true
      });

      if (casesResult.total === 0) {
        return {
          content: [
            {
              type: 'text',
              text: '❗ Няма намерени случаи за анализ на тенденции.',
            },
          ],
        };
      }

      let analysisText = `📊 АНАЛИЗ НА ТЕНДЕНЦИИ В СЪДЕБНАТА ПРАКТИКА\n\n`;
      analysisText += `🔍 Анализирани случаи: ${casesResult.total}\n`;
      analysisText += `📈 Тип анализ: ${this.translateAnalysisType(analysisType)}\n`;
      analysisText += `⏰ Период: ${timeGranularity === 'yearly' ? 'Годишно' : timeGranularity === 'quarterly' ? 'Тримесечно' : 'Месечно'}\n\n`;

      const cases = casesResult.results;

      switch (analysisType) {
        case 'temporal':
          analysisText += this.analyzeTemporalTrends(cases, timeGranularity);
          break;
        case 'outcome_patterns':
          analysisText += this.analyzeOutcomePatterns(cases);
          break;
        case 'precedent_evolution':
          analysisText += this.analyzePrecedentEvolution(cases);
          break;
        case 'court_consistency':
          analysisText += this.analyzeCourtConsistency(cases);
          break;
        default:
          analysisText += this.analyzeTemporalTrends(cases, timeGranularity);
      }

      return {
        content: [
          {
            type: 'text',
            text: analysisText,
          },
        ],
      };

    } catch (error) {
      console.error('Trends analysis error:', error);
      return {
        content: [
          {
            type: 'text',
            text: `❌ Грешка при анализ на тенденции: ${error.message}`,
          },
        ],
      };
    }
  }

  translateAnalysisType(type) {
    const translations = {
      'temporal': 'Времев анализ',
      'outcome_patterns': 'Анализ на резултатите',
      'precedent_evolution': 'Еволюция на прецедентите',
      'court_consistency': 'Последователност на съдилищата'
    };
    return translations[type] || type;
  }

  analyzeTemporalTrends(cases, granularity) {
    const timeGroups = {};
    const outcomesByTime = {};

    cases.forEach(caseLaw => {
      if (!caseLaw.date) return;

      const date = new Date(caseLaw.date);
      let timeKey;

      switch (granularity) {
        case 'monthly':
          timeKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'quarterly':
          const quarter = Math.floor(date.getMonth() / 3) + 1;
          timeKey = `${date.getFullYear()}-Q${quarter}`;
          break;
        default: // yearly
          timeKey = date.getFullYear().toString();
      }

      if (!timeGroups[timeKey]) {
        timeGroups[timeKey] = 0;
        outcomesByTime[timeKey] = {};
      }
      timeGroups[timeKey]++;

      const outcome = caseLaw.outcome || 'неизвестен';
      outcomesByTime[timeKey][outcome] = (outcomesByTime[timeKey][outcome] || 0) + 1;
    });

    let analysis = `📅 ВРЕМЕВ АНАЛИЗ:\n\n`;
    
    const sortedPeriods = Object.keys(timeGroups).sort();
    sortedPeriods.forEach(period => {
      const count = timeGroups[period];
      const outcomes = outcomesByTime[period];
      const mostCommonOutcome = Object.entries(outcomes)
        .sort(([,a], [,b]) => b - a)[0];

      analysis += `${period}: ${count} случая`;
      if (mostCommonOutcome) {
        analysis += ` (най-често: ${this.translateOutcome(mostCommonOutcome[0])} - ${mostCommonOutcome[1]} случая)`;
      }
      analysis += '\n';
    });

    // Trend analysis
    if (sortedPeriods.length > 1) {
      const firstPeriodCount = timeGroups[sortedPeriods[0]];
      const lastPeriodCount = timeGroups[sortedPeriods[sortedPeriods.length - 1]];
      const trend = lastPeriodCount > firstPeriodCount ? '📈 нарастващ' : '📉 намаляващ';
      
      analysis += `\n📊 Тенденция: ${trend} тренд в броя на случаите\n`;
    }

    return analysis;
  }

  analyzeOutcomePatterns(cases) {
    const outcomes = {};
    const outcomesbyLaw = {};

    cases.forEach(caseLaw => {
      const outcome = caseLaw.outcome || 'неизвестен';
      outcomes[outcome] = (outcomes[outcome] || 0) + 1;

      caseLaw.legalBasis.laws.forEach(law => {
        if (!outcomesbyLaw[law]) outcomesbyLaw[law] = {};
        outcomesbyLaw[law][outcome] = (outcomesbyLaw[law][outcome] || 0) + 1;
      });
    });

    let analysis = `⚖️ АНАЛИЗ НА РЕЗУЛТАТИТЕ:\n\n`;
    
    // Overall outcome distribution
    analysis += `📊 Общо разпределение:\n`;
    Object.entries(outcomes)
      .sort(([,a], [,b]) => b - a)
      .forEach(([outcome, count]) => {
        const percentage = Math.round((count / cases.length) * 100);
        analysis += `   ${this.translateOutcome(outcome)}: ${count} (${percentage}%)\n`;
      });

    // Outcomes by law
    analysis += `\n📜 Резултати по закони:\n`;
    Object.entries(outcomesbyLaw).forEach(([law, lawOutcomes]) => {
      analysis += `   ${law}:\n`;
      Object.entries(lawOutcomes)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3) // Top 3 outcomes
        .forEach(([outcome, count]) => {
          analysis += `     - ${this.translateOutcome(outcome)}: ${count}\n`;
        });
    });

    return analysis;
  }

  analyzePrecedentEvolution(cases) {
    const precedentsByYear = {};
    const highPrecedentCases = cases.filter(c => c.precedentValue === 'high');

    cases.forEach(caseLaw => {
      if (!caseLaw.date) return;
      const year = new Date(caseLaw.date).getFullYear();
      
      if (!precedentsByYear[year]) {
        precedentsByYear[year] = { high: 0, medium: 0, low: 0 };
      }
      precedentsByYear[year][caseLaw.precedentValue || 'low']++;
    });

    let analysis = `⭐ ЕВОЛЮЦИЯ НА ПРЕЦЕДЕНТИТЕ:\n\n`;
    
    analysis += `🏆 Случаи с висока прецедентна стойност: ${highPrecedentCases.length}\n\n`;
    
    if (highPrecedentCases.length > 0) {
      analysis += `📋 Ключови прецеденти:\n`;
      highPrecedentCases.slice(0, 5).forEach((caseLaw, index) => {
        analysis += `   ${index + 1}. ${caseLaw.generateCitation()}\n`;
        analysis += `      ${caseLaw.summary.substring(0, 100)}...\n`;
      });
    }

    analysis += `\n📅 Прецеденти по години:\n`;
    Object.entries(precedentsByYear)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([year, precedents]) => {
        analysis += `   ${year}: Висока(${precedents.high}) Средна(${precedents.medium}) Ниска(${precedents.low})\n`;
      });

    return analysis;
  }

  analyzeCourtConsistency(cases) {
    const courtOutcomes = {};
    
    cases.forEach(caseLaw => {
      const court = caseLaw.court || 'неизвестен съд';
      if (!courtOutcomes[court]) courtOutcomes[court] = {};
      
      const outcome = caseLaw.outcome || 'неизвестен';
      courtOutcomes[court][outcome] = (courtOutcomes[court][outcome] || 0) + 1;
    });

    let analysis = `🏛️ ПОСЛЕДОВАТЕЛНОСТ НА СЪДИЛИЩАТА:\n\n`;

    Object.entries(courtOutcomes).forEach(([court, outcomes]) => {
      const totalCases = Object.values(outcomes).reduce((a, b) => a + b, 0);
      const mostCommon = Object.entries(outcomes)
        .sort(([,a], [,b]) => b - a)[0];
      
      const consistency = mostCommon ? Math.round((mostCommon[1] / totalCases) * 100) : 0;
      
      analysis += `📍 ${court}:\n`;
      analysis += `   📊 Общо случаи: ${totalCases}\n`;
      analysis += `   🎯 Последователност: ${consistency}% (${this.translateOutcome(mostCommon[0])})\n`;
      
      Object.entries(outcomes)
        .sort(([,a], [,b]) => b - a)
        .forEach(([outcome, count]) => {
          const percentage = Math.round((count / totalCases) * 100);
          analysis += `   - ${this.translateOutcome(outcome)}: ${count} (${percentage}%)\n`;
        });
      analysis += '\n';
    });

    return analysis;
  }

  /**
   * Handle PDF export for case law
   */
  async handleExportCaseLawToPDF(args) {
    try {
      const result = await this.pdfService.exportCaseLawToPDF(args.caseLawData, {
        title: args.title,
        subtitle: args.subtitle,
        template: args.template,
        includeFullText: args.includeFullText,
        includeSummary: args.includeSummary,
        includeAnalysis: args.includeAnalysis,
        watermark: args.watermark
      });

      if (result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `📄 PDF експорт успешен!\n\n` +
                    `📁 Файл: ${result.filename}\n` +
                    `📊 Страници: ${result.pages}\n` +
                    `💾 Размер: ${Math.round(result.size / 1024)} KB\n` +
                    `📍 Път: ${result.outputPath}\n\n` +
                    `✅ Документът е готов за изтегляне и използване.`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Грешка при експорт на PDF: ${result.error}`,
            },
          ],
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Системна грешка при PDF експорт: ${error.message}`,
          },
        ],
      };
    }
  }

  /**
   * Handle PDF export for legal analysis
   */
  async handleExportLegalAnalysisToPDF(args) {
    try {
      const result = await this.pdfService.exportLegalAnalysisToPDF(args.analysisData, {
        title: args.title,
        documentType: args.documentType,
        clientName: args.clientName,
        lawyerName: args.lawyerName,
        includeRecommendations: args.includeRecommendations,
        includeRiskAssessment: args.includeRiskAssessment
      });

      if (result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `📄 Правен анализ експортиран успешно!\n\n` +
                    `📁 Файл: ${result.filename}\n` +
                    `📊 Страници: ${result.pages}\n` +
                    `💾 Размер: ${Math.round(result.size / 1024)} KB\n` +
                    `👤 Клиент: ${args.clientName || 'Неуточнен'}\n` +
                    `⚖️ Юрист: ${args.lawyerName || 'AI Асистент'}\n` +
                    `📄 Тип документ: ${args.documentType}\n\n` +
                    `✅ Анализът е готов за предоставяне на клиента.`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Грешка при експорт на анализ: ${result.error}`,
            },
          ],
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Системна грешка при експорт на анализ: ${error.message}`,
          },
        ],
      };
    }
  }

  /**
   * Handle PDF export for contracts
   */
  async handleExportContractToPDF(args) {
    try {
      const result = await this.pdfService.exportContractToPDF(args.contractData, {
        title: args.title,
        contractType: args.contractType,
        parties: args.parties,
        terms: args.terms,
        signatures: args.signatures,
        notarization: args.notarization
      });

      if (result.success) {
        const partiesText = args.parties ? 
          `${args.parties.first || 'Неуточнена'} и ${args.parties.second || 'Неуточнена'}` : 
          'Неуточнени страни';

        return {
          content: [
            {
              type: 'text',
              text: `📄 Договор експортиран успешно!\n\n` +
                    `📁 Файл: ${result.filename}\n` +
                    `📊 Страници: ${result.pages}\n` +
                    `💾 Размер: ${Math.round(result.size / 1024)} KB\n` +
                    `📋 Тип: ${args.contractType}\n` +
                    `👥 Страни: ${partiesText}\n` +
                    `✍️ Подписи: ${args.signatures ? 'Включени' : 'Не включени'}\n` +
                    `📝 Нотариално заверяване: ${args.notarization ? 'Необходимо' : 'Не е необходимо'}\n\n` +
                    `✅ Договорът е готов за подписване.`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Грешка при експорт на договор: ${result.error}`,
            },
          ],
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Системна грешка при експорт на договор: ${error.message}`,
          },
        ],
      };
    }
  }

  /**
   * Handle listing exported PDFs
   */
  async handleListExportedPDFs(args) {
    try {
      const pdfList = await this.pdfService.listExportedPDFs();

      if (pdfList.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: '📂 Няма експортирани PDF документи.\n\nИзползвайте export_case_law_to_pdf, export_legal_analysis_to_pdf или export_contract_to_pdf за да създадете документи.',
            },
          ],
        };
      }

      let responseText = `📂 ЕКСПОРТИРАНИ PDF ДОКУМЕНТИ (${pdfList.length})\n\n`;

      pdfList.forEach((file, index) => {
        const sizeKB = Math.round(file.size / 1024);
        const createdDate = file.created.toLocaleString('bg-BG');
        const modifiedDate = file.modified.toLocaleString('bg-BG');

        responseText += `${index + 1}. 📄 ${file.filename}\n`;
        responseText += `   💾 Размер: ${sizeKB} KB\n`;
        responseText += `   📅 Създаден: ${createdDate}\n`;
        responseText += `   🔄 Модифициран: ${modifiedDate}\n`;
        responseText += `   📍 Път: ${file.path}\n\n`;
      });

      responseText += `💡 Използвайте delete_exported_pdf за да изтриете файл.\n`;
      responseText += `📥 Файловете са готови за изтегляне от папката exports/pdf/.`;

      return {
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Грешка при листване на PDF файлове: ${error.message}`,
          },
        ],
      };
    }
  }

  /**
   * Handle deleting exported PDF
   */
  async handleDeleteExportedPDF(args) {
    try {
      const result = await this.pdfService.deletePDF(args.filename);

      if (result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `✅ PDF файлът "${args.filename}" беше изтрит успешно.`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Грешка при изтриване на файла: ${result.error}`,
            },
          ],
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Системна грешка при изтриване на файл: ${error.message}`,
          },
        ],
      };
    }
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Bulgarian Legal MCP Server running on stdio');
  }
}

const server = new BulgarianLegalServer();
server.run().catch(console.error);
