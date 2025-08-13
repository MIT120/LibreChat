/**
 * Writing Assistant Tool Handlers - MCP integration for writing assistance features
 */

import { IToolHandler } from '../../interfaces/index.js';
import { ILogger } from '../../core/Logger.js';
import WritingAssistantService, { 
    WritingAssistanceRequest, 
    WritingSuggestion, 
    ContentContinuation,
    DialogueEnhancement,
    StyleConsistencyReport,
    RealTimeWritingFeedback
} from '../../services/WritingAssistantService.js';
import PlotAnalysisService from '../../services/PlotAnalysisService.js';

export class WritingAssistantToolHandlers {
    private readonly writingAssistantService: WritingAssistantService;
    private readonly plotAnalysisService: PlotAnalysisService;
    private readonly logger: ILogger;

    constructor(
        writingAssistantService: WritingAssistantService,
        plotAnalysisService: PlotAnalysisService,
        logger: ILogger
    ) {
        this.writingAssistantService = writingAssistantService;
        this.plotAnalysisService = plotAnalysisService;
        this.logger = logger.child('WritingAssistantToolHandlers');
    }

    /**
     * Get all writing assistant tools
     */
    getTools(): IToolHandler[] {
        const tools = [
            // Real-time writing suggestions
            {
                name: 'get_writing_suggestions',
                description: 'Get AI-powered writing suggestions based on style analysis from reference books',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'ID of the book being written' },
                        userId: { type: 'string', description: 'ID of the user requesting suggestions' },
                        content: { type: 'string', description: 'Current text content to analyze' },
                        context: {
                            type: 'object',
                            properties: {
                                chapterId: { type: 'string', description: 'Current chapter ID' },
                                sectionType: { 
                                    type: 'string', 
                                    enum: ['dialogue', 'narrative', 'description', 'action'],
                                    description: 'Type of section being written'
                                },
                                characterContext: { 
                                    type: 'array', 
                                    items: { type: 'string' },
                                    description: 'Characters involved in the current scene'
                                },
                                previousParagraphs: { 
                                    type: 'array', 
                                    items: { type: 'string' },
                                    description: 'Previous paragraphs for context'
                                },
                                targetStyle: {
                                    type: 'object',
                                    properties: {
                                        tone: { type: 'string', description: 'Desired tone' },
                                        vocabulary: { type: 'string', description: 'Vocabulary level' },
                                        voice: { type: 'string', description: 'Narrative voice' }
                                    }
                                }
                            }
                        }
                    },
                    required: ['bookId', 'userId', 'content', 'context']
                }
            },

            // Content continuation for writer's block
            {
                name: 'generate_content_continuation',
                description: 'AI-powered chapter/scene continuation when writers hit blocks',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'ID of the book being written' },
                        userId: { type: 'string', description: 'ID of the user requesting continuation' },
                        content: { type: 'string', description: 'Current text content to continue from' },
                        context: {
                            type: 'object',
                            properties: {
                                chapterId: { type: 'string', description: 'Current chapter ID' },
                                sectionType: { 
                                    type: 'string', 
                                    enum: ['dialogue', 'narrative', 'description', 'action'],
                                    description: 'Type of section being written'
                                },
                                characterContext: { 
                                    type: 'array', 
                                    items: { type: 'string' },
                                    description: 'Characters involved in the current scene'
                                },
                                targetStyle: {
                                    type: 'object',
                                    properties: {
                                        tone: { type: 'string', description: 'Desired tone' },
                                        vocabulary: { type: 'string', description: 'Vocabulary level' },
                                        voice: { type: 'string', description: 'Narrative voice' }
                                    }
                                }
                            }
                        }
                    },
                    required: ['bookId', 'userId', 'content', 'context']
                }
            },

            // Dialogue enhancement
            {
                name: 'enhance_dialogue',
                description: 'AI tools to improve dialogue realism and character voice consistency',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'ID of the book being written' },
                        userId: { type: 'string', description: 'ID of the user requesting enhancement' },
                        content: { type: 'string', description: 'Dialogue content to enhance' },
                        context: {
                            type: 'object',
                            properties: {
                                characterContext: { 
                                    type: 'array', 
                                    items: { type: 'string' },
                                    description: 'Characters speaking in the dialogue'
                                },
                                chapterId: { type: 'string', description: 'Current chapter ID' }
                            }
                        }
                    },
                    required: ['bookId', 'userId', 'content', 'context']
                }
            },

            // Style consistency checker
            {
                name: 'check_style_consistency',
                description: 'Monitor and maintain consistent tone, voice, and style throughout the book',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'ID of the book to analyze' },
                        userId: { type: 'string', description: 'ID of the user requesting analysis' },
                        targetStyle: {
                            type: 'object',
                            properties: {
                                tone: { type: 'string', description: 'Target tone' },
                                vocabulary: { type: 'string', description: 'Target vocabulary level' },
                                voice: { type: 'string', description: 'Target narrative voice' }
                            },
                            description: 'Optional target style to check against'
                        }
                    },
                    required: ['bookId', 'userId']
                }
            },

            // Real-time writing feedback
            {
                name: 'get_realtime_feedback',
                description: 'Get real-time writing feedback as user types',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'ID of the book being written' },
                        userId: { type: 'string', description: 'ID of the user requesting feedback' },
                        content: { type: 'string', description: 'Current text content being written' },
                        context: {
                            type: 'object',
                            properties: {
                                chapterId: { type: 'string', description: 'Current chapter ID' },
                                targetStyle: {
                                    type: 'object',
                                    properties: {
                                        tone: { type: 'string', description: 'Desired tone' },
                                        vocabulary: { type: 'string', description: 'Vocabulary level' },
                                        voice: { type: 'string', description: 'Narrative voice' }
                                    }
                                }
                            }
                        }
                    },
                    required: ['bookId', 'userId', 'content', 'context']
                }
            },

            // Plot hole detection
            {
                name: 'detect_plot_holes',
                description: 'AI analysis to identify inconsistencies or gaps in plot development',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'ID of the book to analyze' },
                        userId: { type: 'string', description: 'ID of the user requesting analysis' },
                        scope: { 
                            type: 'string', 
                            enum: ['full', 'chapter', 'recent'],
                            description: 'Scope of analysis',
                            default: 'full'
                        },
                        chapterIds: { 
                            type: 'array', 
                            items: { type: 'string' },
                            description: 'Specific chapters to analyze (for chapter scope)'
                        },
                        focusAreas: {
                            type: 'array',
                            items: { 
                                type: 'string',
                                enum: ['character_consistency', 'timeline', 'causality', 'world_building']
                            },
                            description: 'Specific areas to focus on'
                        }
                    },
                    required: ['bookId', 'userId']
                }
            },

            // Story consistency report
            {
                name: 'generate_consistency_report',
                description: 'Generate comprehensive story consistency report',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'ID of the book to analyze' },
                        userId: { type: 'string', description: 'ID of the user requesting report' },
                        scope: { 
                            type: 'string', 
                            enum: ['full', 'chapter', 'recent'],
                            description: 'Scope of analysis',
                            default: 'full'
                        },
                        focusAreas: {
                            type: 'array',
                            items: { 
                                type: 'string',
                                enum: ['character_consistency', 'timeline', 'causality', 'world_building']
                            },
                            description: 'Specific areas to focus on'
                        }
                    },
                    required: ['bookId', 'userId']
                }
            },

            // Character arc analysis
            {
                name: 'analyze_character_arcs',
                description: 'Track character arcs and development consistency',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'ID of the book to analyze' },
                        userId: { type: 'string', description: 'ID of the user requesting analysis' }
                    },
                    required: ['bookId', 'userId']
                }
            },

            // Find unresolved plot threads
            {
                name: 'find_unresolved_threads',
                description: 'Identify unresolved plot threads',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'ID of the book to analyze' },
                        userId: { type: 'string', description: 'ID of the user requesting analysis' }
                    },
                    required: ['bookId', 'userId']
                }
            },

            // Validate story logic
            {
                name: 'validate_story_logic',
                description: 'Validate story logic and causality',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'ID of the book to analyze' },
                        userId: { type: 'string', description: 'ID of the user requesting validation' }
                    },
                    required: ['bookId', 'userId']
                }
            }
        ];

        // Add handler function to each tool
        return tools.map(tool => ({
            ...tool,
            handler: async (args: any) => this.handleToolCall(tool.name, args)
        }));
    }

    /**
     * Handle tool execution
     */
    async handleToolCall(name: string, args: any): Promise<any> {
        this.logger.info('Handling writing assistant tool call', { toolName: name });

        switch (name) {
            case 'get_writing_suggestions':
                return await this.getWritingSuggestions(args);
            
            case 'generate_content_continuation':
                return await this.generateContentContinuation(args);
            
            case 'enhance_dialogue':
                return await this.enhanceDialogue(args);
            
            case 'check_style_consistency':
                return await this.checkStyleConsistency(args);
            
            case 'get_realtime_feedback':
                return await this.getRealtimeFeedback(args);
            
            case 'detect_plot_holes':
                return await this.detectPlotHoles(args);
            
            case 'generate_consistency_report':
                return await this.generateConsistencyReport(args);
            
            case 'analyze_character_arcs':
                return await this.analyzeCharacterArcs(args);
            
            case 'find_unresolved_threads':
                return await this.findUnresolvedThreads(args);
            
            case 'validate_story_logic':
                return await this.validateStoryLogic(args);
            
            default:
                throw new Error(`Unknown writing assistant tool: ${name}`);
        }
    }

    // Tool implementation methods

    private async getWritingSuggestions(args: any): Promise<{
        success: boolean;
        suggestions: WritingSuggestion[];
        metadata: {
            analysisTime: number;
            suggestionsCount: number;
            highPrioritySuggestions: number;
        };
    }> {
        try {
            const request: WritingAssistanceRequest = {
                bookId: args.bookId,
                userId: args.userId,
                content: args.content,
                context: args.context,
                assistanceType: 'suggestions'
            };

            const startTime = Date.now();
            const suggestions = await this.writingAssistantService.getWritingSuggestions(request);
            const analysisTime = Date.now() - startTime;

            const highPrioritySuggestions = suggestions.filter(s => s.severity === 'high').length;

            return {
                success: true,
                suggestions,
                metadata: {
                    analysisTime,
                    suggestionsCount: suggestions.length,
                    highPrioritySuggestions
                }
            };
        } catch (error) {
            this.logger.error('Failed to get writing suggestions', error as Error);
            return {
                success: false,
                suggestions: [],
                metadata: {
                    analysisTime: 0,
                    suggestionsCount: 0,
                    highPrioritySuggestions: 0
                }
            };
        }
    }

    private async generateContentContinuation(args: any): Promise<{
        success: boolean;
        continuation: ContentContinuation | null;
        metadata: {
            generationTime: number;
            suggestionsGenerated: number;
        };
    }> {
        try {
            const request: WritingAssistanceRequest = {
                bookId: args.bookId,
                userId: args.userId,
                content: args.content,
                context: args.context,
                assistanceType: 'continuation'
            };

            const startTime = Date.now();
            const continuation = await this.writingAssistantService.generateContentContinuation(request);
            const generationTime = Date.now() - startTime;

            return {
                success: true,
                continuation,
                metadata: {
                    generationTime,
                    suggestionsGenerated: continuation.suggestions.length
                }
            };
        } catch (error) {
            this.logger.error('Failed to generate content continuation', error as Error);
            return {
                success: false,
                continuation: null,
                metadata: {
                    generationTime: 0,
                    suggestionsGenerated: 0
                }
            };
        }
    }

    private async enhanceDialogue(args: any): Promise<{
        success: boolean;
        enhancement: DialogueEnhancement | null;
        metadata: {
            enhancementTime: number;
            versionsGenerated: number;
        };
    }> {
        try {
            const request: WritingAssistanceRequest = {
                bookId: args.bookId,
                userId: args.userId,
                content: args.content,
                context: args.context,
                assistanceType: 'dialogue_enhancement'
            };

            const startTime = Date.now();
            const enhancement = await this.writingAssistantService.enhanceDialogue(request);
            const enhancementTime = Date.now() - startTime;

            return {
                success: true,
                enhancement,
                metadata: {
                    enhancementTime,
                    versionsGenerated: enhancement.enhancedVersions.length
                }
            };
        } catch (error) {
            this.logger.error('Failed to enhance dialogue', error as Error);
            return {
                success: false,
                enhancement: null,
                metadata: {
                    enhancementTime: 0,
                    versionsGenerated: 0
                }
            };
        }
    }

    private async checkStyleConsistency(args: any): Promise<{
        success: boolean;
        report: StyleConsistencyReport | null;
        metadata: {
            analysisTime: number;
            overallScore: number;
            issuesFound: number;
        };
    }> {
        try {
            const startTime = Date.now();
            const report = await this.writingAssistantService.checkStyleConsistency(
                args.bookId,
                args.userId,
                args.targetStyle
            );
            const analysisTime = Date.now() - startTime;

            const issuesFound = Object.values(report.elements).reduce((total, element) => {
                const elementIssues = 'issues' in element ? element.issues?.length || 0 : 
                                    'inconsistencies' in element ? element.inconsistencies?.length || 0 :
                                    'levelVariations' in element ? element.levelVariations?.length || 0 : 0;
                return total + elementIssues;
            }, 0);

            return {
                success: true,
                report,
                metadata: {
                    analysisTime,
                    overallScore: report.overallScore,
                    issuesFound
                }
            };
        } catch (error) {
            this.logger.error('Failed to check style consistency', error as Error);
            return {
                success: false,
                report: null,
                metadata: {
                    analysisTime: 0,
                    overallScore: 0,
                    issuesFound: 0
                }
            };
        }
    }

    private async getRealtimeFeedback(args: any): Promise<{
        success: boolean;
        feedback: RealTimeWritingFeedback | null;
        metadata: {
            responseTime: number;
            feedbackScore: number;
        };
    }> {
        try {
            const request: WritingAssistanceRequest = {
                bookId: args.bookId,
                userId: args.userId,
                content: args.content,
                context: args.context,
                assistanceType: 'suggestions'
            };

            const startTime = Date.now();
            const feedback = await this.writingAssistantService.getRealTimeFeedback(request);
            const responseTime = Date.now() - startTime;

            return {
                success: true,
                feedback,
                metadata: {
                    responseTime,
                    feedbackScore: feedback.styleScore
                }
            };
        } catch (error) {
            this.logger.error('Failed to get realtime feedback', error as Error);
            return {
                success: false,
                feedback: null,
                metadata: {
                    responseTime: 0,
                    feedbackScore: 0
                }
            };
        }
    }

    private async detectPlotHoles(args: any): Promise<{
        success: boolean;
        plotHoles: any[];
        metadata: {
            analysisTime: number;
            totalHoles: number;
            criticalHoles: number;
        };
    }> {
        try {
            const request = {
                bookId: args.bookId,
                userId: args.userId,
                scope: args.scope || 'full',
                chapterIds: args.chapterIds,
                focusAreas: args.focusAreas
            };

            const startTime = Date.now();
            const plotHoles = await this.plotAnalysisService.detectPlotHoles(request);
            const analysisTime = Date.now() - startTime;

            const criticalHoles = plotHoles.filter(hole => hole.severity === 'critical').length;

            return {
                success: true,
                plotHoles,
                metadata: {
                    analysisTime,
                    totalHoles: plotHoles.length,
                    criticalHoles
                }
            };
        } catch (error) {
            this.logger.error('Failed to detect plot holes', error as Error);
            return {
                success: false,
                plotHoles: [],
                metadata: {
                    analysisTime: 0,
                    totalHoles: 0,
                    criticalHoles: 0
                }
            };
        }
    }

    private async generateConsistencyReport(args: any): Promise<{
        success: boolean;
        report: any;
        metadata: {
            analysisTime: number;
            overallScore: number;
        };
    }> {
        try {
            const request = {
                bookId: args.bookId,
                userId: args.userId,
                scope: args.scope || 'full',
                focusAreas: args.focusAreas
            };

            const startTime = Date.now();
            const report = await this.plotAnalysisService.generateConsistencyReport(request);
            const analysisTime = Date.now() - startTime;

            return {
                success: true,
                report,
                metadata: {
                    analysisTime,
                    overallScore: report.overallScore
                }
            };
        } catch (error) {
            this.logger.error('Failed to generate consistency report', error as Error);
            return {
                success: false,
                report: null,
                metadata: {
                    analysisTime: 0,
                    overallScore: 0
                }
            };
        }
    }

    private async analyzeCharacterArcs(args: any): Promise<{
        success: boolean;
        arcs: any[];
        metadata: {
            analysisTime: number;
            charactersAnalyzed: number;
        };
    }> {
        try {
            const startTime = Date.now();
            const arcs = await this.plotAnalysisService.analyzeCharacterArcs(args.bookId, args.userId);
            const analysisTime = Date.now() - startTime;

            return {
                success: true,
                arcs,
                metadata: {
                    analysisTime,
                    charactersAnalyzed: arcs.length
                }
            };
        } catch (error) {
            this.logger.error('Failed to analyze character arcs', error as Error);
            return {
                success: false,
                arcs: [],
                metadata: {
                    analysisTime: 0,
                    charactersAnalyzed: 0
                }
            };
        }
    }

    private async findUnresolvedThreads(args: any): Promise<{
        success: boolean;
        threads: any[];
        metadata: {
            analysisTime: number;
            threadsFound: number;
            majorThreads: number;
        };
    }> {
        try {
            const startTime = Date.now();
            const threads = await this.plotAnalysisService.findUnresolvedThreads(args.bookId, args.userId);
            const analysisTime = Date.now() - startTime;

            const majorThreads = threads.filter(thread => thread.severity === 'major').length;

            return {
                success: true,
                threads,
                metadata: {
                    analysisTime,
                    threadsFound: threads.length,
                    majorThreads
                }
            };
        } catch (error) {
            this.logger.error('Failed to find unresolved threads', error as Error);
            return {
                success: false,
                threads: [],
                metadata: {
                    analysisTime: 0,
                    threadsFound: 0,
                    majorThreads: 0
                }
            };
        }
    }

    private async validateStoryLogic(args: any): Promise<{
        success: boolean;
        validation: any;
        metadata: {
            analysisTime: number;
            logicScore: number;
            violationsFound: number;
        };
    }> {
        try {
            const startTime = Date.now();
            const validation = await this.plotAnalysisService.validateStoryLogic(args.bookId, args.userId);
            const analysisTime = Date.now() - startTime;

            return {
                success: true,
                validation,
                metadata: {
                    analysisTime,
                    logicScore: validation.logicScore,
                    violationsFound: validation.violations.length
                }
            };
        } catch (error) {
            this.logger.error('Failed to validate story logic', error as Error);
            return {
                success: false,
                validation: null,
                metadata: {
                    analysisTime: 0,
                    logicScore: 0,
                    violationsFound: 0
                }
            };
        }
    }
}

export default WritingAssistantToolHandlers;
