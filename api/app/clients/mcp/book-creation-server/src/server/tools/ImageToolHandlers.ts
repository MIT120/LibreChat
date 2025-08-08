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
                description: 'Generate an image for a specific page in the book',
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
                            description: 'Image style (e.g., book_illustration, cartoon, realistic)',
                            default: 'book_illustration',
                        },
                    },
                    required: ['bookId', 'chapterId', 'prompt'],
                },
                handler: this.handleGenerateContextualImage.bind(this),
            },
        ];
    }

    async handleGenerateContextualImage(args: any): Promise<any> {
        try {
            this.logger.info('Image generation requested', args);

            // Validate inputs
            if (!args.bookId || !args.chapterId || !args.prompt) {
                throw new ValidationError('Missing required fields for image generation', [
                    { field: 'bookId', message: 'Book ID is required', code: 'REQUIRED' },
                    { field: 'chapterId', message: 'Chapter ID is required', code: 'REQUIRED' },
                    { field: 'prompt', message: 'Image prompt is required', code: 'REQUIRED' },
                ]);
            }

            // Build a spec-aware image prompt for consistent characters/style
            let dallePrompt = `Children's book illustration: ${args.prompt}.`;
            try {
                const book = await Book.findById(args.bookId);
                if (book?.spec) {
                    const ch = Array.isArray(book.spec.characters) ? book.spec.characters : [];
                    const mainChars = ch.slice(0, 3).map((c: any) => `${c.name}: ${(c.visualTraits || []).join(', ')}`).join('; ');
                    const palette = book.spec.colorPalette?.primary ? `palette ${book.spec.colorPalette.primary}${book.spec.colorPalette.secondary ? '/' + book.spec.colorPalette.secondary : ''}` : '';
                    const world = book.spec.world?.setting ? `world ${book.spec.world.setting}` : '';
                    const style = book.spec.imageStyle?.style || 'book illustration';
                    const neg = (book.spec.imageStyle?.negativeCues || []).join(', ');
                    const styleBlock = [`style ${style}`, palette, world, mainChars ? `characters ${mainChars}` : ''].filter(Boolean).join(' | ');
                    dallePrompt = `${dallePrompt} ${styleBlock}${neg ? `. avoid: ${neg}` : ''}`;
                } else {
                    dallePrompt = `${dallePrompt} Style: cartoon illustration, bright colors, kid-friendly, professional book quality`;
                }
            } catch (e) {
                this.logger.error('Failed to enrich image prompt with spec; using default', e as Error, { bookId: args.bookId });
                dallePrompt = `${dallePrompt} Style: cartoon illustration, bright colors, kid-friendly, professional book quality`;
            }
            try {
                const { imageUrl, imageBase64 } = await this.imageService.generateContextualImage({
                    bookId: args.bookId,
                    chapterId: args.chapterId,
                    pageId: args.pageId,
                    pageNumber: args.pageNumber,
                    prompt: dallePrompt,
                    style: args.style,
                });

                const textResponse = {
                    type: 'text',
                    text: `✅ **Image Generated Successfully!**\n\n📖 **Book:** ${args.bookId}\n📚 **Chapter:** ${args.chapterId}\n📄 **Page:** ${args.pageNumber ?? args.pageId ?? 'n/a'}\n🎨 **Prompt:** ${args.prompt}\n\n**Generated with OpenAI DALL-E 3** - Image stored in page record and will appear in book exports.\n\n🔗 **Direct Image URL:** ${imageUrl}`
                };

                if (!imageBase64) {
                    return [textResponse];
                }

                const imageResponse = {
                    type: 'image',
                    data: imageBase64,
                    mimeType: 'image/png'
                };

                return [textResponse, imageResponse];
            } catch (imageError) {
                const errorResponse = {
                    type: 'text',
                    text: `❌ **Image Generation Failed**\n\n📖 **Book:** ${args.bookId}\n📚 **Chapter:** ${args.chapterId}\n📄 **Page:** ${args.pageNumber ?? args.pageId ?? 'n/a'}\n🎨 **Prompt:** ${args.prompt}\n\n**Error:** ${(imageError as Error).message}\n\n**Suggestion:** Check OpenAI API key and quota, or try again later.`
                };
                return [errorResponse];
            }
        } catch (error) {
            this.logger.error('Failed to generate contextual image', error as Error, { args });
            throw error;
        }
    }
}
