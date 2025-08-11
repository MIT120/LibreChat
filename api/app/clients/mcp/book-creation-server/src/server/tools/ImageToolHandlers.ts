/**
 * Image Tool Handlers - MCP tools for image generation and management
 */

import { Book } from '../../../models/Book.js';
import { ValidationError } from '../../../types/errors.js';
import { ILogger } from '../../core/Logger.js';
import { IToolHandler } from '../../interfaces/index.js';
import { ImageService } from '../../services/ImageService.js';

export class ImageToolHandlers {
    private logger: ILogger;
    private imageService: ImageService;

    constructor(logger: ILogger, imageService: ImageService) {
        this.logger = logger.child('ImageToolHandlers');
        this.imageService = imageService;
    }

    getTools(): IToolHandler[] {
        return [
            {
                name: 'generate_contextual_image',
                description: 'Generate an image for a specific page in the book with context-aware styling',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: {
                            type: 'string',
                            description: 'Book identifier',
                        },
                        chapterId: {
                            type: 'string',
                            description: 'Chapter identifier',
                        },
                        pageId: {
                            type: 'string',
                            description: 'Page identifier (optional)',
                        },
                        pageNumber: {
                            type: 'string',
                            description: 'Page number (optional)',
                        },
                        targetPage: {
                            type: 'string',
                            description: 'Target page (optional)',
                        },
                        prompt: {
                            type: 'string',
                            description: 'Image generation prompt',
                        },
                        style: {
                            type: 'string',
                            description: 'Explicit image style override (optional) - overrides auto-detected style',
                        },
                        userStylePreference: {
                            type: 'string',
                            description: 'User-selected style when auto-detection prompts for input',
                        },
                        forceUserPrompt: {
                            type: 'boolean',
                            description: 'Force user style selection regardless of confidence',
                            default: false,
                        },
                        userId: {
                            type: 'string',
                            description: 'User ID for applying style preferences and configuration',
                        },
                    },
                    required: ['bookId', 'chapterId', 'prompt'],
                },
                handler: this.handleGenerateContextualImage.bind(this),
            },
            {
                name: 'analyze_book_image_style',
                description: 'Analyze a book to suggest appropriate image styles',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: {
                            type: 'string',
                            description: 'Book identifier',
                        },
                    },
                    required: ['bookId'],
                },
                handler: this.handleAnalyzeBookImageStyle.bind(this),
            },
            {
                name: 'get_available_image_styles',
                description: 'Get all available image styles for user selection',
                inputSchema: {
                    type: 'object',
                    properties: {},
                },
                handler: this.handleGetAvailableImageStyles.bind(this),
            },
            {
                name: 'manage_user_style_preferences',
                description: 'Get or update user style preferences for image generation',
                inputSchema: {
                    type: 'object',
                    properties: {
                        userId: {
                            type: 'string',
                            description: 'User identifier',
                        },
                        action: {
                            type: 'string',
                            enum: ['get', 'update'],
                            description: 'Action to perform - get or update preferences',
                        },
                        preferences: {
                            type: 'object',
                            description: 'Preference updates (only for update action)',
                            properties: {
                                defaultStyle: {
                                    type: 'string',
                                    description: 'Default style to use',
                                },
                                forceManualSelection: {
                                    type: 'boolean',
                                    description: 'Always prompt for style selection',
                                },
                                genreOverrides: {
                                    type: 'object',
                                    description: 'Genre-specific style overrides',
                                },
                                audienceOverrides: {
                                    type: 'object',
                                    description: 'Audience-specific style overrides',
                                },
                                bannedStyles: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Styles user never wants to use',
                                },
                            },
                        },
                    },
                    required: ['userId', 'action'],
                },
                handler: this.handleManageUserStylePreferences.bind(this),
            },
        ];
    }

    async handleGenerateContextualImage(args: any): Promise<any> {
        try {
            this.logger.info('Context-aware image generation requested', args);

            // Validate inputs
            if (!args.bookId || !args.chapterId || !args.prompt) {
                throw new ValidationError('Missing required fields for image generation', [
                    { field: 'bookId', message: 'Book ID is required', code: 'REQUIRED' },
                    { field: 'chapterId', message: 'Chapter ID is required', code: 'REQUIRED' },
                    { field: 'prompt', message: 'Image prompt is required', code: 'REQUIRED' },
                ]);
            }

            try {
                const result = await this.imageService.generateContextualImage({
                    bookId: args.bookId,
                    chapterId: args.chapterId,
                    pageId: args.pageId,
                    pageNumber: args.pageNumber,
                    prompt: args.prompt,
                    style: args.style,
                    userStylePreference: args.userStylePreference,
                    forceUserPrompt: args.forceUserPrompt,
                    userId: args.userId,
                });

                // Check if user style input is needed
                if (result.needsUserStyleInput) {
                    const styleOptions = result.availableStyles?.map(style => 
                        `• **${style.name}**: ${style.description} (${style.ageRating})`
                    ).join('\n') || '';

                    const textResponse = {
                        type: 'text',
                        text: `🎨 **Style Selection Required**\n\n📖 **Book:** ${args.bookId}\n📚 **Chapter:** ${args.chapterId}\n📄 **Page:** ${args.pageNumber ?? args.pageId ?? 'n/a'}\n🎨 **Prompt:** ${args.prompt}\n\n**Context Analysis:** ${result.styleAnalysis?.reasoning || 'Unable to determine appropriate style automatically'}\n\n**Available Styles:**\n${styleOptions}\n\n**Instructions:** Please call this tool again with the same parameters plus 'userStylePreference' set to your chosen style name.\n\n**Example:** Use 'userStylePreference': 'children_book_illustration' for kid-friendly illustrations.`
                    };
                    
                    return [textResponse];
                }

                // Successful generation
                const styleInfo = result.styleAnalysis ? 
                    `\n🎭 **Style Used:** ${result.styleAnalysis.primaryStyle}\n📊 **Confidence:** ${(result.styleAnalysis.confidenceScore * 100).toFixed(0)}%\n🧠 **Analysis:** ${result.styleAnalysis.reasoning}` :
                    '';

                const audienceWarning = result.styleAnalysis?.appropriateForAudience === false ?
                    `\n⚠️ **Note:** The selected style may not be optimal for the book's target audience.` :
                    '';

                const textResponse = {
                    type: 'text',
                    text: `✅ **Context-Aware Image Generated Successfully!**\n\n📖 **Book:** ${args.bookId}\n📚 **Chapter:** ${args.chapterId}\n📄 **Page:** ${args.pageNumber ?? args.pageId ?? 'n/a'}\n🎨 **Prompt:** ${args.prompt}${styleInfo}${audienceWarning}\n\n**Generated with OpenAI DALL-E 3** - Image automatically styled based on book context and stored in page record.\n\n🔗 **Direct Image URL:** ${result.imageUrl}`
                };

                if (!result.imageBase64) {
                    return [textResponse];
                }

                const imageResponse = {
                    type: 'image',
                    data: result.imageBase64,
                    mimeType: 'image/png'
                };

                return [textResponse, imageResponse];
            } catch (imageError) {
                const errorResponse = {
                    type: 'text',
                    text: `❌ **Context-Aware Image Generation Failed**\n\n📖 **Book:** ${args.bookId}\n📚 **Chapter:** ${args.chapterId}\n📄 **Page:** ${args.pageNumber ?? args.pageId ?? 'n/a'}\n🎨 **Prompt:** ${args.prompt}\n\n**Error:** ${(imageError as Error).message}\n\n**Suggestions:**\n• Check OpenAI API key and quota\n• Try with explicit 'style' parameter\n• Verify book context (genre, audience) is set\n• Use 'forceUserPrompt': true to manually select style`
                };
                return [errorResponse];
            }
        } catch (error) {
            this.logger.error('Failed to generate context-aware image', error as Error, { args });
            throw error;
        }
    }

    async handleAnalyzeBookImageStyle(args: any): Promise<any> {
        try {
            this.logger.info('Book style analysis requested', args);

            // Validate inputs
            if (!args.bookId) {
                throw new ValidationError('Missing required fields for style analysis', [
                    { field: 'bookId', message: 'Book ID is required', code: 'REQUIRED' },
                ]);
            }

            try {
                const analysis = await this.imageService.analyzeBookForImageStyle(args.bookId);

                const textResponse = {
                    type: 'text',
                    text: `🎭 **Book Style Analysis Complete**\n\n📖 **Book:** ${args.bookId}\n\n**Recommended Primary Style:** ${analysis.primaryStyle}\n📊 **Confidence Level:** ${(analysis.confidenceScore * 100).toFixed(0)}%\n🎯 **Audience Appropriate:** ${analysis.appropriateForAudience ? 'Yes' : 'No'}\n🤖 **Auto-Detection:** ${analysis.fallbackToUserPrompt ? 'Needs manual selection' : 'Confident'}\n\n**Analysis Reasoning:**\n${analysis.reasoning}\n\n**Style Modifiers:**\n${analysis.styleModifiers.length > 0 ? analysis.styleModifiers.map(m => `• ${m}`).join('\n') : 'None detected'}\n\n**Recommendation:**\n${analysis.fallbackToUserPrompt ? 
                        'Use \'forceUserPrompt\': true when generating images to manually select style.' : 
                        'Images will automatically use the recommended style based on book context.'}`
                };

                return [textResponse];
            } catch (analysisError) {
                const errorResponse = {
                    type: 'text',
                    text: `❌ **Style Analysis Failed**\n\n📖 **Book:** ${args.bookId}\n\n**Error:** ${(analysisError as Error).message}\n\n**Suggestion:** Verify the book exists and has genre/audience information set.`
                };
                return [errorResponse];
            }
        } catch (error) {
            this.logger.error('Failed to analyze book image style', error as Error, { args });
            throw error;
        }
    }

    async handleGetAvailableImageStyles(args: any): Promise<any> {
        try {
            this.logger.info('Available styles requested');

            try {
                const styles = await this.imageService.getAvailableStyles();

                const styleList = styles.map(style => 
                    `• **${style.name}** (${style.ageRating}): ${style.description}`
                ).join('\n');

                const textResponse = {
                    type: 'text',
                    text: `🎨 **Available Image Styles**\n\n${styleList}\n\n**Usage Instructions:**\n• Styles are automatically selected based on book context (genre, audience, writing style)\n• Use 'userStylePreference' parameter to override automatic selection\n• Use 'forceUserPrompt': true to always choose manually\n• Explicit 'style' parameter overrides all automatic detection\n\n**Age Ratings:**\n• **all-ages**: Safe for children and family content\n• **teen**: Suitable for young adult content\n• **adult**: For mature content and themes\n• **mature**: For content with adult themes`
                };

                return [textResponse];
            } catch (stylesError) {
                const errorResponse = {
                    type: 'text',
                    text: `❌ **Failed to Retrieve Styles**\n\n**Error:** ${(stylesError as Error).message}\n\n**Suggestion:** Contact system administrator - style configuration may be corrupted.`
                };
                return [errorResponse];
            }
        } catch (error) {
            this.logger.error('Failed to get available image styles', error as Error, { args });
            throw error;
        }
    }

    async handleManageUserStylePreferences(args: any): Promise<any> {
        try {
            this.logger.info('User style preferences management requested', args);

            // Validate inputs
            if (!args.userId || !args.action) {
                throw new ValidationError('Missing required fields for preference management', [
                    { field: 'userId', message: 'User ID is required', code: 'REQUIRED' },
                    { field: 'action', message: 'Action is required', code: 'REQUIRED' },
                ]);
            }

            try {
                if (args.action === 'get') {
                    const preferences = await this.imageService.getUserStylePreferences(args.userId);

                    const textResponse = {
                        type: 'text',
                        text: `⚙️ **User Style Preferences**\n\n👤 **User:** ${args.userId}\n\n**Current Settings:**\n• **Default Style:** ${preferences.defaultStyle || 'Auto-detect'}\n• **Force Manual Selection:** ${preferences.forceManualSelection ? 'Yes' : 'No'}\n• **Banned Styles:** ${preferences.bannedStyles?.length ? preferences.bannedStyles.join(', ') : 'None'}\n\n**Genre Overrides:**\n${preferences.genreOverrides ? Object.entries(preferences.genreOverrides).map(([genre, style]) => `• ${genre}: ${style}`).join('\n') : 'None'}\n\n**Audience Overrides:**\n${preferences.audienceOverrides ? Object.entries(preferences.audienceOverrides).map(([audience, style]) => `• ${audience}: ${style}`).join('\n') : 'None'}\n\n**To update preferences, use action: 'update' with preferences object.**`
                    };

                    return [textResponse];
                } else if (args.action === 'update') {
                    if (!args.preferences) {
                        throw new ValidationError('Preferences object required for update action', [
                            { field: 'preferences', message: 'Preferences object is required', code: 'REQUIRED' },
                        ]);
                    }

                    const updatedPreferences = await this.imageService.updateUserStylePreferences(
                        args.userId,
                        args.preferences
                    );

                    const textResponse = {
                        type: 'text',
                        text: `✅ **Style Preferences Updated Successfully!**\n\n👤 **User:** ${args.userId}\n\n**Updated Settings:**\n• **Default Style:** ${updatedPreferences.defaultStyle || 'Auto-detect'}\n• **Force Manual Selection:** ${updatedPreferences.forceManualSelection ? 'Yes' : 'No'}\n• **Banned Styles:** ${updatedPreferences.bannedStyles?.length ? updatedPreferences.bannedStyles.join(', ') : 'None'}\n\n**Genre Overrides:**\n${updatedPreferences.genreOverrides ? Object.entries(updatedPreferences.genreOverrides).map(([genre, style]) => `• ${genre}: ${style}`).join('\n') : 'None'}\n\n**Audience Overrides:**\n${updatedPreferences.audienceOverrides ? Object.entries(updatedPreferences.audienceOverrides).map(([audience, style]) => `• ${audience}: ${style}`).join('\n') : 'None'}\n\n**These preferences will now be applied to all future image generation requests.**`
                    };

                    return [textResponse];
                } else {
                    throw new ValidationError('Invalid action specified', [
                        { field: 'action', message: 'Action must be "get" or "update"', code: 'INVALID' },
                    ]);
                }
            } catch (preferencesError) {
                const errorResponse = {
                    type: 'text',
                    text: `❌ **Preference Management Failed**\n\n👤 **User:** ${args.userId}\n🎯 **Action:** ${args.action}\n\n**Error:** ${(preferencesError as Error).message}\n\n**Suggestion:** Verify user ID and preference format.`
                };
                return [errorResponse];
            }
        } catch (error) {
            this.logger.error('Failed to manage user style preferences', error as Error, { args });
            throw error;
        }
    }
}
