/**
 * Image Service - Provides access to images associated with books/chapters/pages
 */

import { Chapter } from '../../models/Chapter.js';
import { Page } from '../../models/Page.js';
import { Book } from '../../models/Book.js';
import { BaseService, ServiceHealth, ServiceHealthStatus } from '../core/BaseService.js';
import { ILogger } from '../core/Logger.js';
import ImageStyleAnalyzer, { StyleAnalysisResult } from './ImageStyleAnalyzer.js';
import ImageStyleConfig from './ImageStyleConfig.js';

export interface ImageRecord {
    id?: string;
    url?: string;
    localPath?: string;
    chapterId?: string;
    pageId?: string;
    pageNumber?: number;
    placement?: { position: 'before' | 'after' | 'between' };
    prompt?: string;
    status?: string;
}

export class ImageService extends BaseService {
    private styleAnalyzer: ImageStyleAnalyzer;
    private styleConfig: ImageStyleConfig;
    
    constructor(logger: ILogger) {
        super(logger);
        this.styleAnalyzer = new ImageStyleAnalyzer(logger);
        this.styleConfig = new ImageStyleConfig(logger);
    }

    protected async onInitialize(): Promise<void> {
        await this.styleAnalyzer.initialize();
        await this.styleConfig.initialize();
    }

    protected async onDispose(): Promise<void> {
        await this.styleAnalyzer.dispose();
        await this.styleConfig.dispose();
    }

    protected async performHealthCheck(): Promise<ServiceHealth> {
        return {
            status: ServiceHealthStatus.HEALTHY,
            message: 'Image service operational',
            lastCheck: new Date(),
        };
    }

    /**
     * Fetch all images for a given book by scanning chapters and pages
     */
    async getBookImages(bookId: string): Promise<ImageRecord[]> {
        return this.executeWithLogging('getBookImages', async () => {
            if (!bookId) {
                return [];
            }

            // Find chapters for book
            const chapters = await Chapter.find({ bookId }).select({ _id: 1 }).lean();
            const chapterIds = chapters.map((c) => c._id);
            if (chapterIds.length === 0) return [];

            // Find pages for chapters
            const pages = await Page.find({ chapterId: { $in: chapterIds } })
                .select({ pageId: 1, chapterId: 1, pageNumber: 1, images: 1 })
                .lean();

            const images: ImageRecord[] = [];
            for (const page of pages) {
                const pageImages = Array.isArray((page as any).images) ? (page as any).images : [];
                for (const img of pageImages) {
                    images.push({
                        id: img.id,
                        url: img.url,
                        localPath: img.localPath,
                        chapterId: page.chapterId,
                        pageId: page.pageId,
                        pageNumber: page.pageNumber,
                        placement: img.placement,
                        prompt: img.prompt,
                        status: img.status,
                    });
                }
            }

            return images;
        }, { bookId });
    }

    /**
     * Generate an image via OpenAI (DALL-E 3) based on prompt and attach it to a page if present
     * Returns the generated image URL and optional base64 data for inline preview
     */
    async generateContextualImage(args: {
        bookId: string;
        chapterId: string;
        pageId?: string;
        pageNumber?: string;
        prompt: string;
        style?: string;
        userStylePreference?: string; // User-provided style when auto-detection is not confident
        forceUserPrompt?: boolean; // Force user to choose style regardless of confidence
        userId?: string; // User ID for applying preferences
    }): Promise<{ 
        imageUrl: string; 
        imageBase64?: string; 
        attachedToPageId?: string;
        styleAnalysis?: StyleAnalysisResult;
        needsUserStyleInput?: boolean;
        availableStyles?: Array<{ name: string; description: string; ageRating: string }>;
    }>{
        return this.executeWithLogging('generateContextualImage', async () => {
            const openaiApiKey = process.env.OPENAI_API_KEY;
            if (!openaiApiKey) {
                throw new Error('OPENAI_API_KEY not configured');
            }

            // Get book information for context analysis
            const book = await Book.findById(args.bookId);
            if (!book) {
                throw new Error(`Book not found: ${args.bookId}`);
            }

            // Analyze book context to determine appropriate style
            const styleAnalysis = await this.styleAnalyzer.analyzeBookForImageStyle(book);

            // Apply user preferences if userId provided
            let adjustedStyle = styleAnalysis.primaryStyle;
            let adjustedConfidenceThreshold = styleAnalysis.confidenceScore;
            
            if (args.userId) {
                adjustedStyle = this.styleConfig.applyUserPreferences(
                    args.userId, 
                    styleAnalysis.primaryStyle, 
                    book.genre, 
                    book.targetAudience
                );
                
                // Get user's confidence threshold
                const confidenceThreshold = this.styleConfig.getConfidenceThreshold(args.userId);
                adjustedConfidenceThreshold = Math.max(styleAnalysis.confidenceScore, confidenceThreshold);
            }

            // Check if we need user input for style selection
            const needsUserInput = (
                styleAnalysis.fallbackToUserPrompt || 
                args.forceUserPrompt || 
                adjustedConfidenceThreshold < 0.5 ||
                !adjustedStyle // Style was filtered out by user preferences
            ) && !args.userStylePreference;

            if (needsUserInput) {
                // Return early requesting user style input
                return {
                    imageUrl: '', // Will be empty as we need user input first
                    needsUserStyleInput: true,
                    styleAnalysis,
                    availableStyles: this.styleAnalyzer.getAvailableStyles()
                };
            }

            // Determine final style to use
            let finalStyle = args.style; // Explicit style parameter takes precedence
            if (!finalStyle) {
                finalStyle = args.userStylePreference || adjustedStyle;
            }

            // Validate that final style is allowed for user
            if (args.userId && !this.styleConfig.isStyleAllowedForUser(args.userId, finalStyle)) {
                this.logger.warn('Requested style is not allowed for user, using default', {
                    userId: args.userId,
                    requestedStyle: finalStyle,
                    bookId: args.bookId
                });
                finalStyle = 'children_book_illustration'; // Safe default
            }

            // Check content appropriateness for the chosen style
            if (!styleAnalysis.appropriateForAudience) {
                this.logger.warn('Style may not be appropriate for target audience', {
                    bookId: args.bookId,
                    style: finalStyle,
                    targetAudience: book.targetAudience,
                    reasoning: styleAnalysis.reasoning
                });
            }

            // Validate content appropriateness for the image prompt
            if (!this.styleAnalyzer.analyzeContentAppropriatenesss(args.prompt, finalStyle)) {
                this.logger.warn('Image prompt may contain content inappropriate for chosen style', {
                    bookId: args.bookId,
                    style: finalStyle,
                    prompt: args.prompt.substring(0, 100) + '...'
                });
            }

            const dallePrompt = this.buildDallePrompt(args.prompt, finalStyle, styleAnalysis.styleModifiers);

            // Generate image URL
            const imageUrl = await this.requestDalleImageUrl(openaiApiKey, dallePrompt, {
                model,
                size,
                quality,
                style: renderStyle,
            });

            // Attempt to download and convert to base64 (optional, best-effort)
            let imageBase64: string | undefined;
            try {
                imageBase64 = await this.downloadImageAsBase64(imageUrl);
            } catch (error) {
                this.logger.warn('Base64 conversion failed, proceeding with URL only', {
                    imageUrl: imageUrl.substring(0, 50) + '...',
                    error: (error as Error).message,
                });
            }

            // Attach to page if provided
            let attachedToPageId: string | undefined;
            try {
                const ref: { bookId: string; chapterId: string; pageId?: string; pageNumber?: string | number } = {
                    bookId: args.bookId,
                    chapterId: args.chapterId,
                };
                if (typeof args.pageId === 'string') {
                    ref.pageId = args.pageId;
                }
                if (args.pageNumber !== undefined && args.pageNumber !== null) {
                    ref.pageNumber = args.pageNumber as string | number;
                }
                attachedToPageId = await this.storeImageInPage(ref, imageUrl, dallePrompt);
            } catch (error) {
                this.logger.warn('Failed to store image on page', {
                    bookId: args.bookId,
                    chapterId: args.chapterId,
                    pageId: args.pageId,
                    pageNumber: args.pageNumber,
                    error: (error as Error).message,
                });
            }

            return { 
                imageUrl, 
                imageBase64, 
                attachedToPageId,
                styleAnalysis,
                needsUserStyleInput: false
            };
        }, { bookId: args.bookId, chapterId: args.chapterId });
    }

    /**
     * Get available image styles for user selection
     */
    async getAvailableStyles(): Promise<Array<{ name: string; description: string; ageRating: string }>> {
        return this.styleAnalyzer.getAvailableStyles();
    }

    /**
     * Analyze a book's context to suggest appropriate image styles
     */
    async analyzeBookForImageStyle(bookId: string): Promise<StyleAnalysisResult> {
        return this.executeWithLogging('analyzeBookForImageStyle', async () => {
            const book = await Book.findById(bookId);
            if (!book) {
                throw new Error(`Book not found: ${bookId}`);
            }
            
            return this.styleAnalyzer.analyzeBookForImageStyle(book);
        }, { bookId });
    }

    /**
     * Get user's style preferences
     */
    async getUserStylePreferences(userId: string) {
        return this.styleConfig.getUserStylePreferences(userId);
    }

    /**
     * Update user's style preferences
     */
    async updateUserStylePreferences(userId: string, updates: any) {
        return this.styleConfig.updateUserStylePreferences(userId, updates);
    }

    /**
     * Get system configuration
     */
    getSystemStyleConfig() {
        return this.styleConfig.getSystemConfig();
    }

    /**
     * Update system configuration (admin only)
     */
    async updateSystemStyleConfig(updates: any) {
        return this.styleConfig.updateSystemConfig(updates);
    }

    private buildDallePrompt(prompt: string, style?: string, styleModifiers: string[] = []): string {
        const styleName = style || 'children_book_illustration';
        
        // Get the base DALL-E prompt for this style from the style config
        const styleConfig = this.styleAnalyzer['styleConfig']?.styles[styleName];
        let basePrompt = styleConfig?.dallePrompt || 'professional illustration, high quality, detailed artwork';
        
        // Add style modifiers if any
        if (styleModifiers.length > 0) {
            basePrompt += `, ${styleModifiers.join(', ')}`;
        }
        
        // Combine user prompt with style directives
        return `${prompt}. ${basePrompt}`;
    }

    private async requestDalleImageUrl(apiKey: string, prompt: string): Promise<string> {
        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: opts.model,
                prompt,
                n: 1,
                size: opts.size,
                quality: opts.quality,
                style: opts.style,
            }),
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        const imageResult = await response.json();
        const imageUrl = imageResult?.data?.[0]?.url;
        if (!imageUrl) {
            throw new Error('OpenAI API returned no image URL');
        }
        return imageUrl;
    }

    private async downloadImageAsBase64(imageUrl: string): Promise<string> {
        const imgResponse = await fetch(imageUrl, {
            method: 'GET',
            headers: { 'User-Agent': 'LibreChat-BookCreation/1.0' },
            // @ts-ignore Node 18+ supports AbortSignal.timeout
            signal: AbortSignal.timeout(30000),
        });

        if (!imgResponse.ok) {
            throw new Error(`Failed to download: ${imgResponse.status} ${imgResponse.statusText}`);
        }

        const contentType = imgResponse.headers.get('content-type');
        if (contentType && !contentType.startsWith('image/')) {
            throw new Error(`Invalid content type: ${contentType}, expected image/*`);
        }

        const buffer = await imgResponse.arrayBuffer();
        if (buffer.byteLength === 0) {
            throw new Error('Received empty image data');
        }

        const base64 = Buffer.from(buffer).toString('base64');

        // Validate base64 characters
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        if (!base64Regex.test(base64)) {
            throw new Error('Contains invalid Base64 characters');
        }

        return base64;
    }

    /**
     * Store the generated image in the corresponding page document
     * Returns the pageId if attachment succeeded
     */
    private async storeImageInPage(
        ref: { bookId: string; chapterId: string; pageId?: string; pageNumber?: string | number },
        imageUrl: string,
        prompt: string
    ): Promise<string | undefined> {
        try {
            const { Page } = await import('../../models/Page.js');

            // Find the page to update
            let pageToUpdate: any;
            if (typeof ref.pageId === 'string') {
                pageToUpdate = await Page.findOne({ pageId: ref.pageId });
            } else if (ref.pageNumber !== undefined && ref.pageNumber !== null && ref.chapterId) {
                pageToUpdate = await Page.findOne({
                    chapterId: ref.chapterId,
                    pageNumber: parseInt(String(ref.pageNumber), 10),
                });
            }

            if (!pageToUpdate) {
                this.logger.warn('Page not found for image storage', {
                    pageId: ref.pageId,
                    pageNumber: ref.pageNumber,
                    chapterId: ref.chapterId,
                });
                return undefined;
            }

            const imageRecord = {
                id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                url: imageUrl,
                localPath: null as any,
                placement: { position: 'after' as const },
                prompt,
                status: 'generated',
            };

            const pageData = pageToUpdate as any;
            if (!pageData.images) {
                pageData.images = [];
            }
            pageData.images.push(imageRecord);

            await pageToUpdate.save();

            this.logger.info('Image stored in page successfully', {
                pageId: pageToUpdate.pageId,
                imageId: imageRecord.id,
                imageUrl: imageUrl.substring(0, 50) + '...',
            });

            return pageToUpdate.pageId as string;
        } catch (error) {
            this.logger.error('Failed to store image in page', error as Error, {
                pageId: ref.pageId,
                pageNumber: ref.pageNumber,
                chapterId: ref.chapterId,
            });
            // do not throw; attachment failure should not block tool response
            return undefined;
        }
    }
}

export default ImageService;


