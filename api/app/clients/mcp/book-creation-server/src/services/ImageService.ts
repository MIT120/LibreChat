/**
 * Image Service - Provides access to images associated with books/chapters/pages
 */

import { Chapter } from '../../models/Chapter.js';
import { Page } from '../../models/Page.js';
import { BaseService, ServiceHealth, ServiceHealthStatus } from '../core/BaseService.js';
import { ILogger } from '../core/Logger.js';

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
    constructor(logger: ILogger) {
        super(logger);
    }

    protected async onInitialize(): Promise<void> {
        // No-op for now
    }

    protected async onDispose(): Promise<void> {
        // No-op for now
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
        pageNumber?: string | number;
        prompt: string;
        style?: string;
    }): Promise<{ imageUrl: string; imageBase64?: string; attachedToPageId?: string }>{
        return this.executeWithLogging('generateContextualImage', async () => {
            const openaiApiKey = process.env.OPENAI_API_KEY;
            if (!openaiApiKey) {
                throw new Error('OPENAI_API_KEY not configured');
            }

            const dallePrompt = this.buildDallePrompt(args.prompt, args.style);

            // Generate image URL
            const imageUrl = await this.requestDalleImageUrl(openaiApiKey, dallePrompt);

            // Attempt to download and convert to base64 (optional, best-effort)
            let imageBase64: string | undefined;
            try {
                imageBase64 = await this.downloadImageAsBase64(imageUrl);
            } catch (error) {
                this.logger.warn('Base64 conversion failed, proceeding with URL only', error as Error, {
                    imageUrl: imageUrl.substring(0, 50) + '...',
                });
            }

            // Attach to page if provided
            let attachedToPageId: string | undefined;
            try {
                attachedToPageId = await this.storeImageInPage(
                    {
                        bookId: args.bookId,
                        chapterId: args.chapterId,
                        pageId: args.pageId,
                        pageNumber: args.pageNumber,
                    },
                    imageUrl,
                    dallePrompt
                );
            } catch (error) {
                this.logger.warn('Failed to store image on page', error as Error, {
                    bookId: args.bookId,
                    chapterId: args.chapterId,
                    pageId: args.pageId,
                    pageNumber: args.pageNumber,
                });
            }

            return { imageUrl, imageBase64, attachedToPageId };
        }, { bookId: args.bookId, chapterId: args.chapterId });
    }

    private buildDallePrompt(prompt: string, style?: string): string {
        const baseStyle = style || 'book_illustration';
        return `Children's book illustration: ${prompt}. Style: cartoon illustration, bright colors, kid-friendly, professional book quality. Category: ${baseStyle}`;
    }

    private async requestDalleImageUrl(apiKey: string, prompt: string): Promise<string> {
        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'dall-e-3',
                prompt,
                n: 1,
                size: '1024x1024',
                quality: 'standard',
                style: 'vivid',
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
            if (ref.pageId) {
                pageToUpdate = await Page.findOne({ pageId: ref.pageId });
            } else if (ref.pageNumber && ref.chapterId) {
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


