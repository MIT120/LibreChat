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

import { CaseLawService } from './services/CaseLawService.js';
import { CitationService } from './services/CitationService.js';
import { DocumentAnalysisService } from './services/DocumentAnalysisService.js';

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
                            'Search Bulgarian case law based on legal articles, parties, court, date range, and other criteria. Example: Find last 20 rulings on article 15 of ZZD where seller was held liable.',
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
                                    description: 'Case outcome (liable, not_liable, guilty, not_guilty)',
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

                    case 'find_similar_cases':
                        return await this.handleFindSimilarCases(args);

                    case 'generate_legal_citations':
                        return await this.handleGenerateLegalCitations(args);

                    case 'extract_key_terms':
                        return await this.handleExtractKeyTerms(args);

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

        return {
            content: [
                {
                    type: 'text',
                    text:
                        `Намерени са ${result.total} съдебни решения:\n\n` +
                        result.results
                            .map(
                                (caseLaw, index) =>
                                    `${index + 1}. ${caseLaw.generateCitation()}\n` +
                                    `   Основание: ${caseLaw.legalBasis.articles.map((a) => a.article).join(', ')}\n` +
                                    `   Резултат: ${caseLaw.outcome}\n` +
                                    `   Резюме: ${caseLaw.summary}\n` +
                                    `   Мотиви: ${caseLaw.reasoning}\n\n`,
                            )
                            .join(''),
                },
            ],
        };
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
