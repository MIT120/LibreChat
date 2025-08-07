#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { BilingualService } from './services/BilingualService.js';
import { CaseLawService } from './services/CaseLawService.js';
import { CitationService } from './services/CitationService.js';
import { ComplianceService } from './services/ComplianceService.js';
import { DocumentAnalysisService } from './services/DocumentAnalysisService.js';
import { LegalResearchService } from './services/LegalResearchService.js';

class BulgarianLegalServer {
  constructor() {
    this.server = new Server(
      {
        name: 'bulgarian-legal-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    // Initialize services
    this.caseLawService = new CaseLawService();
    this.documentAnalysisService = new DocumentAnalysisService();
    this.citationService = new CitationService();
    this.bilingualService = new BilingualService();
    this.legalResearchService = new LegalResearchService();
    this.complianceService = new ComplianceService();

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // Case Law Research Tools
          {
            name: 'search_case_law',
            description:
              'Search Bulgarian case law by legal article, law reference, party liability, and other criteria. Finds relevant court decisions with summaries and reasoning.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Natural language query describing the legal issue or case type',
                  minLength: 10,
                  maxLength: 500,
                },
                legalArticle: {
                  type: 'string',
                  description: 'Specific legal article number (e.g., "чл. 45" or "Art. 45")',
                  maxLength: 50,
                },
                lawReference: {
                  type: 'string',
                  description: 'Law name or code reference (e.g., "ГК", "ТЗ", "ЗОЗЗ")',
                  maxLength: 100,
                },
                partyLiability: {
                  type: 'string',
                  enum: [
                    'seller_liable',
                    'buyer_liable',
                    'plaintiff_liable',
                    'defendant_liable',
                    'shared_liability',
                    'no_liability',
                    'any',
                  ],
                  description: 'Filter by which party was held liable in the decision',
                  default: 'any',
                },
                courtLevel: {
                  type: 'string',
                  enum: ['supreme', 'appeals', 'district', 'administrative', 'any'],
                  description: 'Court level that issued the decision',
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
                    to: { type: 'string', format: 'date', description: 'End date (YYYY-MM-DD)' },
                    lastCount: {
                      type: 'number',
                      description: 'Get last N decisions (e.g., 20)',
                      minimum: 1,
                      maximum: 100,
                    },
                  },
                  description: 'Date range or count filter for decisions',
                },
                caseOutcome: {
                  type: 'string',
                  enum: [
                    'favorable_plaintiff',
                    'favorable_defendant',
                    'partially_favorable',
                    'dismissed',
                    'settled',
                    'any',
                  ],
                  description: 'Filter by case outcome',
                  default: 'any',
                },
                includeClauseValidation: {
                  type: 'boolean',
                  description: 'Whether to validate if specific clauses were part of the agreement',
                  default: false,
                },
                maxResults: {
                  type: 'number',
                  description: 'Maximum number of results to return',
                  default: 20,
                  minimum: 1,
                  maximum: 100,
                },
                language: {
                  type: 'string',
                  enum: ['bulgarian', 'english', 'bilingual'],
                  description: 'Language for response and summaries',
                  default: 'english',
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
                partyLiability: {
                  type: 'string',
                  enum: [
                    'seller_liable',
                    'buyer_liable',
                    'plaintiff_wins',
                    'defendant_wins',
                    'partial_liability',
                    'any',
                  ],
                  description: 'Party liability outcome (critical for lawyer queries)',
                  default: 'any',
                },
                contractClause: {
                  type: 'string',
                  description:
                    'Specific contract clause to verify presence (e.g., "гаранционен срок")',
                  maxLength: 200,
                },
                legalOutcome: {
                  type: 'string',
                  enum: ['upheld', 'overturned', 'remanded', 'settled', 'any'],
                  description: 'How the case was ultimately decided',
                  default: 'any',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'analyze_legal_precedent',
            description:
              'Analyze legal precedents for a specific case or situation, providing detailed reasoning and applicable law interpretation.',
            inputSchema: {
              type: 'object',
              properties: {
                caseId: {
                  type: 'string',
                  description: 'Case ID from previous search or direct case reference',
                },
                factPattern: {
                  type: 'string',
                  description:
                    'Description of the current fact pattern to compare against precedents',
                  maxLength: 2000,
                },
                legalIssues: {
                  type: 'array',
                  items: { type: 'string', maxLength: 200 },
                  description: 'Specific legal issues to analyze',
                  maxItems: 10,
                },
                analysisDepth: {
                  type: 'string',
                  enum: ['basic', 'detailed', 'comprehensive'],
                  description: 'Level of analysis detail',
                  default: 'detailed',
                },
                language: {
                  type: 'string',
                  enum: ['bulgarian', 'english', 'bilingual'],
                  description: 'Language for analysis',
                  default: 'english',
                },
              },
              required: ['factPattern'],
            },
          },
          // Document Analysis Tools
          {
            name: 'analyze_contract_compliance',
            description:
              'Analyze a contract for compliance with Bulgarian civil and commercial law, identifying potential issues and risks.',
            inputSchema: {
              type: 'object',
              properties: {
                contractText: {
                  type: 'string',
                  description: 'Full text of the contract to analyze',
                  minLength: 100,
                },
                contractType: {
                  type: 'string',
                  enum: [
                    'sale',
                    'service',
                    'employment',
                    'lease',
                    'partnership',
                    'loan',
                    'insurance',
                    'franchise',
                    'other',
                  ],
                  description: 'Type of contract being analyzed',
                },
                specificClauses: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific clauses to focus analysis on',
                },
                complianceStandards: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: [
                      'civil_code',
                      'commercial_code',
                      'consumer_protection',
                      'gdpr',
                      'labor_code',
                      'insurance_code',
                    ],
                  },
                  description: 'Legal standards to check compliance against',
                  default: ['civil_code', 'commercial_code'],
                },
                riskLevel: {
                  type: 'string',
                  enum: ['conservative', 'moderate', 'aggressive'],
                  description: 'Risk tolerance level for recommendations',
                  default: 'moderate',
                },
                language: {
                  type: 'string',
                  enum: ['bulgarian', 'english', 'bilingual'],
                  description: 'Language for analysis results',
                  default: 'english',
                },
              },
              required: ['contractText', 'contractType'],
            },
          },
          {
            name: 'check_gdpr_compliance',
            description:
              'Analyze document or process for GDPR compliance according to Bulgarian Personal Data Protection Act implementation.',
            inputSchema: {
              type: 'object',
              properties: {
                documentText: {
                  type: 'string',
                  description: 'Text of privacy policy, contract, or process description',
                },
                dataProcessingType: {
                  type: 'string',
                  enum: ['collection', 'processing', 'storage', 'transfer', 'deletion', 'all'],
                  description: 'Type of data processing to analyze',
                  default: 'all',
                },
                dataSubjects: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: [
                      'employees',
                      'customers',
                      'clients',
                      'website_visitors',
                      'minors',
                      'sensitive_categories',
                    ],
                  },
                  description: 'Types of data subjects involved',
                },
                organizationType: {
                  type: 'string',
                  enum: [
                    'small_business',
                    'medium_enterprise',
                    'large_corporation',
                    'public_entity',
                    'non_profit',
                  ],
                  description: 'Type of organization for context',
                },
                crossBorderTransfer: {
                  type: 'boolean',
                  description: 'Whether cross-border data transfer is involved',
                  default: false,
                },
                language: {
                  type: 'string',
                  enum: ['bulgarian', 'english', 'bilingual'],
                  description: 'Language for compliance report',
                  default: 'english',
                },
              },
              required: ['documentText'],
            },
          },
          // Citation and Research Management
          {
            name: 'create_legal_citation',
            description:
              'Create properly formatted Bulgarian legal citations for cases, laws, regulations, and legal documents.',
            inputSchema: {
              type: 'object',
              properties: {
                citationType: {
                  type: 'string',
                  enum: [
                    'case_law',
                    'legislation',
                    'regulation',
                    'directive',
                    'international_treaty',
                    'legal_article',
                    'book',
                  ],
                  description: 'Type of legal source to cite',
                },
                sourceDetails: {
                  type: 'object',
                  description: 'Details about the legal source',
                  properties: {
                    title: { type: 'string', description: 'Title of the source' },
                    courtName: { type: 'string', description: 'Name of the court (for case law)' },
                    caseNumber: { type: 'string', description: 'Case number or reference' },
                    decisionDate: {
                      type: 'string',
                      format: 'date',
                      description: 'Date of decision',
                    },
                    publicationSource: {
                      type: 'string',
                      description: 'Where published (e.g., State Gazette)',
                    },
                    articleNumber: { type: 'string', description: 'Article or section number' },
                    authors: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Authors (for books/articles)',
                    },
                    year: { type: 'number', description: 'Year of publication' },
                    pages: { type: 'string', description: 'Page numbers' },
                    url: { type: 'string', description: 'URL if available online' },
                  },
                },
                citationStyle: {
                  type: 'string',
                  enum: ['bulgarian_legal', 'international', 'academic'],
                  description: 'Citation style to use',
                  default: 'bulgarian_legal',
                },
                language: {
                  type: 'string',
                  enum: ['bulgarian', 'english', 'bilingual'],
                  description: 'Language for citation',
                  default: 'bulgarian',
                },
              },
              required: ['citationType', 'sourceDetails'],
            },
          },
          {
            name: 'create_legal_research_note',
            description:
              'Create and store a legal research note with categorization, tags, and source tracking.',
            inputSchema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Title of the research note',
                  minLength: 1,
                  maxLength: 200,
                },
                content: {
                  type: 'string',
                  description: 'Content of the research note',
                  minLength: 10,
                },
                legalArea: {
                  type: 'string',
                  enum: [
                    'civil_law',
                    'commercial_law',
                    'criminal_law',
                    'administrative_law',
                    'constitutional_law',
                    'european_law',
                    'international_law',
                  ],
                  description: 'Legal area this research relates to',
                },
                caseReference: {
                  type: 'string',
                  description: 'Reference to related case or client matter',
                },
                sourceTypes: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: [
                      'case_law',
                      'legislation',
                      'doctrine',
                      'practice',
                      'news',
                      'eu_directive',
                    ],
                  },
                  description: 'Types of sources referenced',
                },
                tags: {
                  type: 'array',
                  items: { type: 'string', maxLength: 50 },
                  description: 'Tags for categorization and search',
                  maxItems: 15,
                },
                priority: {
                  type: 'string',
                  enum: ['urgent', 'high', 'medium', 'low', 'reference'],
                  description: 'Priority level for follow-up',
                  default: 'medium',
                },
                confidentiality: {
                  type: 'string',
                  enum: ['public', 'internal', 'client_confidential', 'attorney_work_product'],
                  description: 'Confidentiality level of the note',
                  default: 'internal',
                },
                language: {
                  type: 'string',
                  enum: ['bulgarian', 'english', 'bilingual'],
                  description: 'Language of the note',
                  default: 'bulgarian',
                },
              },
              required: ['title', 'content', 'legalArea'],
            },
          },
          // Bilingual Support Tools
          {
            name: 'translate_legal_term',
            description:
              'Translate legal terms between Bulgarian and English with context and legal definitions.',
            inputSchema: {
              type: 'object',
              properties: {
                term: {
                  type: 'string',
                  description: 'Legal term to translate',
                  minLength: 1,
                  maxLength: 200,
                },
                sourceLanguage: {
                  type: 'string',
                  enum: ['bulgarian', 'english', 'auto'],
                  description: 'Source language of the term',
                  default: 'auto',
                },
                targetLanguage: {
                  type: 'string',
                  enum: ['bulgarian', 'english'],
                  description: 'Target language for translation',
                },
                legalContext: {
                  type: 'string',
                  enum: [
                    'civil_law',
                    'commercial_law',
                    'criminal_law',
                    'administrative_law',
                    'constitutional_law',
                    'procedural_law',
                    'general',
                  ],
                  description: 'Legal context for more accurate translation',
                  default: 'general',
                },
                includeDefinition: {
                  type: 'boolean',
                  description: 'Include legal definition and explanation',
                  default: true,
                },
                includeUsageExamples: {
                  type: 'boolean',
                  description: 'Include usage examples in legal context',
                  default: false,
                },
              },
              required: ['term', 'targetLanguage'],
            },
          },
          // Legal Trend Analysis
          {
            name: 'analyze_legal_trends',
            description:
              'Analyze trends in court decisions, legal precedents, and judicial patterns for strategic insights.',
            inputSchema: {
              type: 'object',
              properties: {
                analysisType: {
                  type: 'string',
                  enum: [
                    'court_decisions',
                    'judge_patterns',
                    'precedent_evolution',
                    'success_rates',
                    'legal_arguments',
                  ],
                  description: 'Type of trend analysis to perform',
                },
                legalArea: {
                  type: 'string',
                  enum: [
                    'civil_law',
                    'commercial_law',
                    'criminal_law',
                    'administrative_law',
                    'all',
                  ],
                  description: 'Legal area to focus analysis on',
                  default: 'all',
                },
                timeframe: {
                  type: 'object',
                  properties: {
                    from: { type: 'string', format: 'date' },
                    to: { type: 'string', format: 'date' },
                    period: {
                      type: 'string',
                      enum: ['last_year', 'last_2_years', 'last_5_years', 'custom'],
                    },
                  },
                  description: 'Time period for trend analysis',
                },
                courtLevel: {
                  type: 'string',
                  enum: ['supreme', 'appeals', 'district', 'all'],
                  description: 'Court level to analyze',
                  default: 'all',
                },
                specificCriteria: {
                  type: 'object',
                  properties: {
                    judgeName: { type: 'string', description: 'Specific judge to analyze' },
                    legalArgument: {
                      type: 'string',
                      description: 'Specific legal argument or doctrine',
                    },
                    partyType: {
                      type: 'string',
                      description: 'Type of party (individual, corporation, etc.)',
                    },
                  },
                  description: 'Additional specific criteria for analysis',
                },
                includeRecommendations: {
                  type: 'boolean',
                  description: 'Include strategic recommendations based on trends',
                  default: true,
                },
                language: {
                  type: 'string',
                  enum: ['bulgarian', 'english', 'bilingual'],
                  description: 'Language for analysis report',
                  default: 'english',
                },
              },
              required: ['analysisType'],
            },
          },
          // Document Workflow Management
          {
            name: 'manage_legal_document_workflow',
            description:
              'Manage and track legal document workflows, deadlines, and case management tasks.',
            inputSchema: {
              type: 'object',
              properties: {
                action: {
                  type: 'string',
                  enum: [
                    'create_workflow',
                    'update_status',
                    'add_deadline',
                    'get_status',
                    'list_pending',
                  ],
                  description: 'Workflow management action to perform',
                },
                workflowId: {
                  type: 'string',
                  description: 'Workflow ID (for update/status operations)',
                },
                documentType: {
                  type: 'string',
                  enum: [
                    'contract',
                    'pleading',
                    'motion',
                    'brief',
                    'discovery',
                    'correspondence',
                    'court_filing',
                  ],
                  description: 'Type of legal document',
                },
                caseReference: {
                  type: 'string',
                  description: 'Case or client matter reference',
                },
                priority: {
                  type: 'string',
                  enum: ['urgent', 'high', 'medium', 'low'],
                  description: 'Priority level',
                  default: 'medium',
                },
                deadlines: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      task: { type: 'string' },
                      dueDate: { type: 'string', format: 'date-time' },
                      responsible: { type: 'string' },
                    },
                  },
                  description: 'List of deadlines and responsible parties',
                },
                status: {
                  type: 'string',
                  enum: ['draft', 'review', 'revision', 'approval', 'filed', 'completed'],
                  description: 'Current status of the document/workflow',
                },
                notes: {
                  type: 'string',
                  description: 'Additional notes or comments',
                  maxLength: 1000,
                },
              },
              required: ['action'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_case_law':
            return await this.handleSearchCaseLaw(args);
          case 'search_supreme_court_cassation':
            return await this.handleSearchSupremeCourt(args);
          case 'analyze_legal_precedent':
            return await this.handleAnalyzeLegalPrecedent(args);
          case 'analyze_contract_compliance':
            return await this.handleAnalyzeContractCompliance(args);
          case 'check_gdpr_compliance':
            return await this.handleCheckGdprCompliance(args);
          case 'create_legal_citation':
            return await this.handleCreateLegalCitation(args);
          case 'create_legal_research_note':
            return await this.handleCreateLegalResearchNote(args);
          case 'translate_legal_term':
            return await this.handleTranslateLegalTerm(args);
          case 'analyze_legal_trends':
            return await this.handleAnalyzeLegalTrends(args);
          case 'manage_legal_document_workflow':
            return await this.handleManageLegalDocumentWorkflow(args);
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing tool ${name}: ${error.message}`,
        );
      }
    });
  }

  // Case Law Research Handlers
  async handleSearchCaseLaw(args) {
    const results = await this.caseLawService.searchCaseLaw(args);

    const summary = `Found ${results.totalCount} case law decisions matching your criteria.

**Search Parameters:**
- Query: ${args.query}
${args.legalArticle ? `- Legal Article: ${args.legalArticle}` : ''}
${args.lawReference ? `- Law Reference: ${args.lawReference}` : ''}
- Party Liability: ${args.partyLiability || 'any'}
- Court Level: ${args.courtLevel || 'any'}

**Key Findings:**
${results.cases
        .slice(0, 5)
        .map(
          (case_, idx) => `
${idx + 1}. **${case_.title}**
   - Court: ${case_.court}
   - Date: ${case_.date}
   - Outcome: ${case_.outcome}
   - Key Legal Ground: ${case_.legalBasis}
   - Summary: ${case_.summary}
   - Reference: ${case_.reference}
`,
        )
        .join('')}

${results.totalCount > 5 ? `\n*Showing 5 of ${results.totalCount} results. Use more specific filters to narrow down results.*` : ''}`;

    return {
      content: [
        {
          type: 'text',
          text: summary,
        },
      ],
    };
  }

  async handleSearchSupremeCourt(args) {
    try {
      // Enhance query for Supreme Court specific search
      const enhancedQuery = `Върховен касационен съд ${args.query}`;

      // Build search parameters for Supreme Court specific search
      const searchParams = {
        query: enhancedQuery,
        courtLevel: 'supreme',
        useRag: true,
        storeResults: true,
        limit: args.maxResults || 15,
        ...args,
      };

      // If chamber is specified, add it to the query
      if (args.chamber && args.chamber !== 'any') {
        searchParams.query += ` ${args.chamber === 'civil'
            ? 'гражданска колегия'
            : args.chamber === 'criminal'
              ? 'наказателна колегия'
              : args.chamber === 'commercial'
                ? 'търговска колегия'
                : ''
          }`;
      }

      // If decision type is specified, add it to the query
      if (args.decisionType && args.decisionType !== 'any') {
        searchParams.query += ` ${args.decisionType === 'cassation'
            ? 'касационно решение'
            : args.decisionType === 'interpretation'
              ? 'тълкувателно решение'
              : args.decisionType === 'unification'
                ? 'обединително решение'
                : ''
          }`;
      }

      // Search using enhanced legal search for better results
      const results = await this.handleEnhancedLegalSearch({
        query: searchParams.query,
        sources: ['both'],
        useRagFirst: true,
        storeResults: true,
        limit: searchParams.limit,
      });

      // Process and format results specifically for Supreme Court
      const supremeCourtResponse = await this.formatSupremeCourtResults(results, args);

      return supremeCourtResponse;
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Грешка при търсене във Върховния касационен съд: ${error.message}`,
          },
        ],
      };
    }
  }

  async formatSupremeCourtResults(searchResults, originalArgs) {
    if (!searchResults || !searchResults.content || !searchResults.content[0]) {
      return {
        content: [
          {
            type: 'text',
            text: '❌ Няма намерени резултати от Върховния касационен съд.',
          },
        ],
      };
    }

    const baseResponse = searchResults.content[0].text;

    // Add Supreme Court specific formatting and analysis
    const supremeCourtHeader = `🏛️ **ТЪРСЕНЕ ВЪВ ВЪРХОВНИЯ КАСАЦИОНЕН СЪД**\n\n`;

    const searchParams = `**Параметри на търсенето:**
- Заявка: ${originalArgs.query}
${originalArgs.caseNumber ? `- Номер на делото: ${originalArgs.caseNumber}` : ''}
${originalArgs.legalArticle ? `- Правна разпоредба: ${originalArgs.legalArticle}` : ''}
- Колегия: ${originalArgs.chamber === 'civil'
        ? 'Гражданска'
        : originalArgs.chamber === 'criminal'
          ? 'Наказателна'
          : originalArgs.chamber === 'commercial'
            ? 'Търговска'
            : 'Всички'
      }
- Тип решение: ${originalArgs.decisionType === 'cassation'
        ? 'Касационно'
        : originalArgs.decisionType === 'interpretation'
          ? 'Тълкувателно'
          : originalArgs.decisionType === 'unification'
            ? 'Обединително'
            : 'Всички типове'
      }
${originalArgs.legalArea && originalArgs.legalArea !== 'any' ? `- Правна област: ${originalArgs.legalArea}` : ''}

`;

    const precedentNote = `\n\n**📋 Забележка за прецедентната стойност:**
Решенията на Върховния касационен съд имат висока прецедентна стойност в българската правна система. Тълкувателните решения са задължителни за всички съдилища, а касационните решения създават важни правни прецеденти.

**⚖️ Правна значимост:**
- Касационни решения: Установяват единна съдебна практика
- Тълкувателни решения: Задължителни за всички съдилища  
- Обединителни решения: Решават противоречия в съдебната практика`;

    const formattedResponse = supremeCourtHeader + searchParams + baseResponse + precedentNote;

    return {
      content: [
        {
          type: 'text',
          text: formattedResponse,
        },
      ],
    };
  }

  async handleAnalyzeLegalPrecedent(args) {
    const analysis = await this.caseLawService.analyzeLegalPrecedent(args);

    return {
      content: [
        {
          type: 'text',
          text: `**Legal Precedent Analysis**

**Fact Pattern Analysis:**
${analysis.factPatternComparison}

**Applicable Precedents:**
${analysis.applicablePrecedents
              .map(
                (p) => `
- **${p.title}** (${p.court}, ${p.date})
  - Similarity Score: ${p.similarityScore}%
  - Key Legal Principle: ${p.legalPrinciple}
  - Reasoning: ${p.reasoning}
  - Applicability: ${p.applicability}
`,
              )
              .join('')}

**Legal Analysis:**
${analysis.legalAnalysis}

**Strategic Recommendations:**
${analysis.recommendations.map((r) => `• ${r}`).join('\n')}

**Risk Assessment:**
${analysis.riskAssessment}`,
        },
      ],
    };
  }

  // Document Analysis Handlers
  async handleAnalyzeContractCompliance(args) {
    const analysis = await this.documentAnalysisService.analyzeContractCompliance(args);

    return {
      content: [
        {
          type: 'text',
          text: `**Contract Compliance Analysis**

**Overall Compliance Score:** ${analysis.complianceScore}/100

**Compliance Standards Checked:**
${analysis.standardsChecked.map((s) => `✓ ${s}`).join('\n')}

**Issues Identified:**
${analysis.issues
              .map(
                (issue) => `
**${issue.severity.toUpperCase()}: ${issue.title}**
- **Legal Basis:** ${issue.legalBasis}
- **Description:** ${issue.description}
- **Recommendation:** ${issue.recommendation}
- **Risk Level:** ${issue.riskLevel}
`,
              )
              .join('')}

**Compliance Summary by Area:**
${Object.entries(analysis.complianceByArea)
              .map(([area, score]) => `- ${area}: ${score}/100`)
              .join('\n')}

**Recommended Actions:**
${analysis.recommendedActions.map((action, idx) => `${idx + 1}. ${action}`).join('\n')}

**Legal References:**
${analysis.legalReferences.map((ref) => `- ${ref}`).join('\n')}`,
        },
      ],
    };
  }

  async handleCheckGdprCompliance(args) {
    const compliance = await this.complianceService.checkGdprCompliance(args);

    return {
      content: [
        {
          type: 'text',
          text: `**GDPR Compliance Analysis**

**Overall Compliance Level:** ${compliance.complianceLevel}
**Risk Score:** ${compliance.riskScore}/100

**Data Processing Assessment:**
${compliance.dataProcessingAssessment}

**Compliance Issues:**
${compliance.issues
              .map(
                (issue) => `
**${issue.severity}: ${issue.category}**
- **Issue:** ${issue.description}
- **GDPR Article:** ${issue.gdprArticle}
- **Bulgarian Law Reference:** ${issue.bulgarianLawRef}
- **Required Action:** ${issue.requiredAction}
- **Priority:** ${issue.priority}
`,
              )
              .join('')}

**Rights Implementation Status:**
${Object.entries(compliance.rightsImplementation)
              .map(([right, status]) => `- ${right}: ${status}`)
              .join('\n')}

**Recommendations:**
${compliance.recommendations.map((rec, idx) => `${idx + 1}. ${rec}`).join('\n')}

**Next Steps:**
${compliance.nextSteps.map((step) => `• ${step}`).join('\n')}`,
        },
      ],
    };
  }

  // Citation and Research Handlers
  async handleCreateLegalCitation(args) {
    const citation = await this.citationService.createLegalCitation(args);

    return {
      content: [
        {
          type: 'text',
          text: `**Legal Citation Created**

**Formatted Citation:**
${citation.formattedCitation}

**Citation Details:**
- **Type:** ${citation.type}
- **Style:** ${citation.style}
- **Language:** ${citation.language}

**Additional Information:**
${citation.additionalInfo ? citation.additionalInfo : 'None'}

**Usage Notes:**
${citation.usageNotes}`,
        },
      ],
    };
  }

  async handleCreateLegalResearchNote(args) {
    const note = await this.legalResearchService.createResearchNote(args);

    return {
      content: [
        {
          type: 'text',
          text: `**Legal Research Note Created**

**Note ID:** ${note.id}
**Title:** ${note.title}
**Legal Area:** ${note.legalArea}
**Priority:** ${note.priority}
**Confidentiality:** ${note.confidentiality}

**Content Preview:**
${note.content.substring(0, 200)}${note.content.length > 200 ? '...' : ''}

**Tags:** ${note.tags.join(', ')}

**Research Note Successfully Stored and Indexed for Future Reference**`,
        },
      ],
    };
  }

  // Bilingual Support Handlers
  async handleTranslateLegalTerm(args) {
    const translation = await this.bilingualService.translateLegalTerm(args);

    return {
      content: [
        {
          type: 'text',
          text: `**Legal Term Translation**

**Original Term:** ${translation.originalTerm} (${translation.sourceLanguage})
**Translation:** ${translation.translatedTerm} (${translation.targetLanguage})

**Legal Context:** ${translation.legalContext}

${translation.definition
              ? `**Definition:**
${translation.definition}`
              : ''
            }

${translation.usageExamples
              ? `**Usage Examples:**
${translation.usageExamples.map((ex) => `• ${ex}`).join('\n')}`
              : ''
            }

**Alternative Translations:**
${translation.alternatives.map((alt) => `- ${alt.term} (${alt.context})`).join('\n')}

**Notes:**
${translation.notes}`,
        },
      ],
    };
  }

  // Trend Analysis Handlers
  async handleAnalyzeLegalTrends(args) {
    const trends = await this.caseLawService.analyzeLegalTrends(args);

    return {
      content: [
        {
          type: 'text',
          text: `**Legal Trend Analysis**

**Analysis Type:** ${args.analysisType}
**Period:** ${trends.period}
**Data Points Analyzed:** ${trends.dataPoints}

**Key Trends Identified:**
${trends.keyTrends
              .map(
                (trend) => `
**${trend.title}**
- **Trend Direction:** ${trend.direction}
- **Confidence Level:** ${trend.confidence}%
- **Description:** ${trend.description}
- **Impact:** ${trend.impact}
`,
              )
              .join('')}

**Statistical Summary:**
${Object.entries(trends.statistics)
              .map(([key, value]) => `- ${key}: ${value}`)
              .join('\n')}

**Strategic Insights:**
${trends.strategicInsights.map((insight) => `• ${insight}`).join('\n')}

${trends.recommendations
              ? `**Recommendations:**
${trends.recommendations.map((rec) => `• ${rec}`).join('\n')}`
              : ''
            }`,
        },
      ],
    };
  }

  // Workflow Management Handlers
  async handleManageLegalDocumentWorkflow(args) {
    const result = await this.legalResearchService.manageDocumentWorkflow(args);

    return {
      content: [
        {
          type: 'text',
          text: `**Document Workflow Management**

**Action:** ${args.action}
**Status:** ${result.status}

${result.workflowId ? `**Workflow ID:** ${result.workflowId}` : ''}

**Details:**
${result.details}

${result.upcomingDeadlines
              ? `**Upcoming Deadlines:**
${result.upcomingDeadlines.map((deadline) => `• ${deadline.task} - Due: ${deadline.dueDate} (${deadline.responsible})`).join('\n')}`
              : ''
            }

${result.nextActions
              ? `**Next Actions:**
${result.nextActions.map((action) => `• ${action}`).join('\n')}`
              : ''
            }`,
        },
      ],
    };
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
