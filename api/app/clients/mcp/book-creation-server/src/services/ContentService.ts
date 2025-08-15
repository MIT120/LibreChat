/**
 * Content Service - Advanced content management and generation
 */

import { Book } from '../../models/Book.js';
import { Chapter } from '../../models/Chapter.js';
import { Page } from '../../models/Page.js';
import { BaseService, ServiceHealth, ServiceHealthStatus } from '../core/BaseService.js';
import { ILogger } from '../core/Logger.js';
import {
    ContentGenerationOptions, ContentImprovementOptions,
    ContentSuggestion, IChapterService, IContentService, IPageService, IWritingStyle, NotFoundError, PageGenerationOptions, PageResponse
} from '../interfaces/index.js';

export interface ContentTemplate {
    id: string;
    name: string;
    description: string;
    category: 'chapter' | 'page' | 'scene' | 'dialogue';
    template: string;
    placeholders: string[];
    writingStyle?: Partial<IWritingStyle>;
}

export interface ContentAnalysis {
    readabilityScore: number;
    sentimentScore: number;
    toneConsistency: number;
    vocabularyComplexity: 'simple' | 'intermediate' | 'advanced' | 'technical';
    suggestions: string[];
    keyPhrases: string[];
    wordFrequency: Record<string, number>;
}

export interface ContentOutline {
    structure: Array<{
        type: 'chapter' | 'section' | 'scene';
        title: string;
        description: string;
        estimatedWordCount: number;
        keyElements: string[];
    }>;
    totalEstimatedWordCount: number;
    recommendedChapterCount: number;
}

export class ContentService extends BaseService implements IContentService {
    private chapterService?: IChapterService;
    private pageService?: IPageService;

    constructor(
        logger: ILogger,
        chapterService?: IChapterService,
        pageService?: IPageService
    ) {
        super(logger);
        if (chapterService) {
            this.chapterService = chapterService;
        }
        if (pageService) {
            this.pageService = pageService;
        }
    }

    protected async onInitialize(): Promise<void> {
        this.logger.info('ContentService initialized');
    }

    protected async onDispose(): Promise<void> {
        this.logger.info('ContentService disposed');
    }

    protected async performHealthCheck(): Promise<ServiceHealth> {
        return {
            status: ServiceHealthStatus.HEALTHY,
            message: 'Content service operational',
            details: {
                hasChapterService: !!this.chapterService,
                hasPageService: !!this.pageService,
            },
            lastCheck: new Date(),
        };
    }

    async generateContentSuggestion(chapterId: string, context: Record<string, any> = {}): Promise<ContentSuggestion> {
        return this.executeWithLogging('generateContentSuggestion', async () => {
            const chapter = await Chapter.findById(chapterId);
            if (!chapter) {
                throw new NotFoundError('Chapter', chapterId);
            }

            const book = await Book.findById(chapter.bookId);
            if (!book) {
                throw new NotFoundError('Book', chapter.bookId);
            }

            const pages = await Page.find({ chapterId }).sort({ pageNumber: 1 });

            // Calculate suggested word count for next page
            const avgWordsPerPage = pages.length > 0
                ? Math.round(pages.reduce((sum, page) => sum + page.wordCount, 0) / pages.length)
                : 500;

            const recommendedWordCount = Math.max(200, avgWordsPerPage);

            // Generate writing prompt based on context
            const writingPrompt = this.generateWritingPrompt(book, chapter, pages, context);

            return {
                bookContext: {
                    title: book.title,
                    theme: book.theme,
                    genre: book.genre,
                    writingStyle: book.writingStyle,
                    targetAudience: book.targetAudience,
                },
                chapterContext: {
                    title: chapter.title,
                    description: chapter.description,
                    outline: chapter.outline,
                    chapterNumber: chapter.chapterNumber,
                },
                existingContent: pages.map(page => ({
                    pageNumber: page.pageNumber,
                    title: page.title,
                    wordCount: page.wordCount,
                })),
                suggestions: {
                    nextPageTitle: `Page ${pages.length + 1}`,
                    recommendedWordCount,
                    writingPrompt,
                },
            };
        }, { chapterId, contextKeys: Object.keys(context) });
    }

    async generateChapterContent(chapterId: string, options: ContentGenerationOptions): Promise<string> {
        return this.executeWithLogging('generateChapterContent', async () => {
            const chapter = await Chapter.findById(chapterId);
            if (!chapter) {
                throw new NotFoundError('Chapter', chapterId);
            }

            const book = await Book.findById(chapter.bookId);
            if (!book) {
                throw new NotFoundError('Book', chapter.bookId);
            }

            // This is a placeholder implementation
            // In a real system, this would integrate with AI content generation
            const content = this.generateMockChapterContent(book, chapter, options);

            this.logger.info('Chapter content generated', {
                chapterId,
                contentLength: content.length,
                wordCount: this.countWords(content),
            });

            return content;
        }, { chapterId, contentType: options.contentType });
    }

    async generatePageContent(chapterId: string, options: PageGenerationOptions): Promise<PageResponse> {
        return this.executeWithLogging('generatePageContent', async () => {
            if (!this.pageService) {
                throw new Error('PageService not available');
            }

            const chapter = await Chapter.findById(chapterId);
            if (!chapter) {
                throw new NotFoundError('Chapter', chapterId);
            }

            const book = await Book.findById(chapter.bookId);
            if (!book) {
                throw new NotFoundError('Book', chapter.bookId);
            }

            // Generate content using AI (mock implementation)
            const content = this.generateMockPageContent(book, chapter, options);

            // Create the page using PageService
            const pageData = {
                chapterId,
                conversationId: book.conversationId,
                title: options.pageTitle,
                content,
                notes: `Generated content based on: ${options.contentPrompt}`,
            };

            return await this.pageService.createPage(pageData);
        }, { chapterId, pageTitle: options.pageTitle });
    }

    async improveContent(contentId: string, options: ContentImprovementOptions): Promise<string> {
        return this.executeWithLogging('improveContent', async () => {
            let content: string;

            // Get content based on type
            if (options.contentType === 'page') {
                const page = await Page.findOne({ pageId: contentId });
                if (!page) {
                    throw new NotFoundError('Page', contentId);
                }
                content = page.content;
            } else {
                // Assume chapter content
                const chapter = await Chapter.findById(contentId);
                if (!chapter) {
                    throw new NotFoundError('Chapter', contentId);
                }

                // Get all pages content
                const pages = await Page.find({ chapterId: contentId }).sort({ pageNumber: 1 });
                content = pages.map(page => page.content).join('\n\n');
            }

            // Apply improvements (mock implementation)
            const improvedContent = this.generateImprovedContent(content, options);

            this.logger.info('Content improved', {
                contentId,
                originalLength: content.length,
                improvedLength: improvedContent.length,
                improvementType: options.improvementType,
            });

            return improvedContent;
        }, { contentId, improvementType: options.improvementType });
    }

    async analyzeContent(content: string): Promise<ContentAnalysis> {
        return this.executeWithLogging('analyzeContent', async () => {
            const words = content.toLowerCase().match(/\b\w+\b/g) || [];
            const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
            const wordFrequency: Record<string, number> = {};

            // Calculate word frequency
            words.forEach(word => {
                wordFrequency[word] = (wordFrequency[word] || 0) + 1;
            });

            // Mock analysis values (in a real implementation, these would use NLP libraries)
            const analysis: ContentAnalysis = {
                readabilityScore: Math.round(Math.random() * 40 + 60), // 60-100
                sentimentScore: Math.round((Math.random() - 0.5) * 100), // -50 to 50
                toneConsistency: Math.round(Math.random() * 30 + 70), // 70-100
                vocabularyComplexity: this.assessVocabularyComplexity(words),
                suggestions: this.generateContentSuggestions(content, words),
                keyPhrases: this.extractKeyPhrases(words, wordFrequency),
                wordFrequency,
            };

            return analysis;
        }, { contentLength: content.length });
    }

    async generateOutline(bookId: string, targetWordCount: number): Promise<ContentOutline> {
        return this.executeWithLogging('generateOutline', async () => {
            const book = await Book.findById(bookId);
            if (!book) {
                throw new NotFoundError('Book', bookId);
            }

            const recommendedChapterCount = Math.ceil(targetWordCount / 3000); // ~3000 words per chapter
            const wordsPerChapter = Math.round(targetWordCount / recommendedChapterCount);

            const structure = [];
            for (let i = 1; i <= recommendedChapterCount; i++) {
                structure.push({
                    type: 'chapter' as const,
                    title: `Chapter ${i}`,
                    description: `Chapter ${i} content for ${book.theme}`,
                    estimatedWordCount: wordsPerChapter,
                    keyElements: [
                        'Introduction of key concepts',
                        'Development of main ideas',
                        'Supporting examples and evidence',
                        'Transition to next chapter',
                    ],
                });
            }

            return {
                structure,
                totalEstimatedWordCount: targetWordCount,
                recommendedChapterCount,
            };
        }, { bookId, targetWordCount });
    }

    async getContentTemplates(category?: string): Promise<ContentTemplate[]> {
        return this.executeWithLogging('getContentTemplates', async () => {
            // Mock templates - in a real implementation, these would be stored in database
            const allTemplates: ContentTemplate[] = [
                {
                    id: 'chapter-intro',
                    name: 'Chapter Introduction',
                    description: 'Standard chapter opening template',
                    category: 'chapter',
                    template: 'In this chapter, we will explore {TOPIC}. We begin by examining {OPENING_CONCEPT} and then progress to {MAIN_CONTENT}.',
                    placeholders: ['TOPIC', 'OPENING_CONCEPT', 'MAIN_CONTENT'],
                },
                {
                    id: 'dialogue-scene',
                    name: 'Dialogue Scene',
                    description: 'Template for dialogue-heavy scenes',
                    category: 'scene',
                    template: '"{OPENING_LINE}," said {CHARACTER1}.\n\n{CHARACTER2} {REACTION}. "{RESPONSE}"',
                    placeholders: ['OPENING_LINE', 'CHARACTER1', 'CHARACTER2', 'REACTION', 'RESPONSE'],
                },
                {
                    id: 'descriptive-passage',
                    name: 'Descriptive Passage',
                    description: 'Template for detailed descriptions',
                    category: 'page',
                    template: 'The {SETTING} {DESCRIPTION}. {SENSORY_DETAILS} filled the air, while {VISUAL_ELEMENTS} created a {MOOD} atmosphere.',
                    placeholders: ['SETTING', 'DESCRIPTION', 'SENSORY_DETAILS', 'VISUAL_ELEMENTS', 'MOOD'],
                },
            ];

            if (category) {
                return allTemplates.filter(template => template.category === category);
            }

            return allTemplates;
        }, { category });
    }

    private generateWritingPrompt(book: any, chapter: any, existingPages: any[], context: Record<string, any>): string {
        const contextBrackets = book.spec?.contextBracketFormat === true;
        const characterGuide = (book.spec?.characters || [])
            .slice(0, 3)
            .map((c: any) => `${c.name} (${(c.visualTraits || []).join(', ')})`)
            .join('; ');
        const worldGuide = book.spec?.world?.setting ? `${book.spec.world.setting}; rules: ${(book.spec.world.rules || []).join('; ')}` : '';
        const palette = book.spec?.colorPalette?.primary ? `palette: ${book.spec.colorPalette.primary}${book.spec.colorPalette.secondary ? `/${book.spec.colorPalette.secondary}` : ''}` : '';
        const rules = (book.spec?.narrativeRules || []).slice(0, 5).join('; ');

        const base = `Continue "${chapter.title}" in ${book.genre} maintaining ${book.writingStyle.tone} tone and ${book.writingStyle.voice} voice; theme: ${book.theme}.`;
        const extras = [
            characterGuide ? `characters: ${characterGuide}` : '',
            worldGuide,
            palette,
            rules ? `narrative rules: ${rules}` : '',
            context?.specificFocus ? `focus: ${context.specificFocus}` : '',
            context?.mood ? `mood: ${context.mood}` : '',
        ].filter(Boolean).join(' | ');

        if (!contextBrackets) {
            return `${base}${extras ? ' | ' + extras : ''}`;
        }

        return `[[CONTEXT:: ${extras || 'n/a'}]]\n${base}`;
    }

    private generateMockChapterContent(book: any, chapter: any, options: ContentGenerationOptions): string {
        const contentTypes = {
            'full_chapter': `# ${chapter.title}\n\nThis chapter explores ${book.theme} in the context of ${book.genre}. The content is written in a ${book.writingStyle.tone} tone with ${book.writingStyle.vocabulary} vocabulary.\n\n## Introduction\n\nThe key concepts covered in this chapter include...\n\n## Main Content\n\nAs we delve deeper into ${book.theme}, we discover...\n\n## Conclusion\n\nIn summary, this chapter has demonstrated...`,
            'opening': `The opening of ${chapter.title} sets the stage for exploring ${book.theme}. Written in a ${book.writingStyle.tone} style, this introduction engages the reader with...`,
            'continuation': `Continuing from the previous section, we now turn our attention to the central elements of ${book.theme}. The narrative develops through...`,
            'conclusion': `As we conclude ${chapter.title}, the key insights about ${book.theme} become clear. The ${book.genre} elements have been woven together to create...`,
        };

        const baseContent = contentTypes[options.contentType as keyof typeof contentTypes] || contentTypes.full_chapter;

        if (options.includeDialogue) {
            return baseContent + '\n\n"This is where dialogue would be naturally integrated," explained the narrator, "bringing characters to life within the narrative."';
        }

        return baseContent;
    }

    private generateMockPageContent(book: any, chapter: any, options: PageGenerationOptions): string {
        let content = `This page content for "${options.pageTitle}" is generated based on the prompt: ${options.contentPrompt}\n\n`;
        content += `The content maintains the ${book.writingStyle.tone} tone and ${book.writingStyle.voice} voice as specified in the book's writing style.\n\n`;
        content += `This ${book.genre} content relates to the chapter "${chapter.title}" and the overall theme of ${book.theme}.`;

        if (options.continuePrevious) {
            content = `Building upon the previous page, ` + content;
        }

        // Extend content to reach target word count if specified
        const targetWords = options.wordCount || 300;
        const currentWords = this.countWords(content);

        if (currentWords < targetWords) {
            const additionalContent = ` Additional content would be generated here to reach the target word count of ${targetWords} words. This placeholder text demonstrates how the content generation system would expand the text to meet specific requirements while maintaining consistency with the book's theme and writing style.`;
            content += additionalContent;
        }

        return content;
    }

    private generateImprovedContent(content: string, options: ContentImprovementOptions): string {
        let improved = content;

        switch (options.improvementType) {
            case 'grammar':
                improved = `[Grammar-improved version of the content]\n\n${content}`;
                break;
            case 'style':
                improved = `[Style-enhanced version with improved flow and readability]\n\n${content}`;
                break;
            case 'flow':
                improved = `[Content with improved logical flow and transitions]\n\n${content}`;
                break;
            case 'clarity':
                improved = `[Clarified version with clearer explanations and structure]\n\n${content}`;
                break;
            case 'engagement':
                improved = `[More engaging version with enhanced hooks and interest]\n\n${content}`;
                break;
            default:
                improved = `[Comprehensively improved version]\n\n${content}`;
        }

        if (options.specificInstructions) {
            improved = `[Applied specific instructions: ${options.specificInstructions}]\n\n` + improved;
        }

        return improved;
    }

    private assessVocabularyComplexity(words: string[]): 'simple' | 'intermediate' | 'advanced' | 'technical' {
        const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;

        if (avgWordLength < 4) return 'simple';
        if (avgWordLength < 6) return 'intermediate';
        if (avgWordLength < 8) return 'advanced';
        return 'technical';
    }

    private generateContentSuggestions(content: string, words: string[]): string[] {
        const suggestions = [];

        if (words.length < 100) {
            suggestions.push('Consider expanding the content with more detailed explanations');
        }

        if (content.split('\n').length < 3) {
            suggestions.push('Break content into more paragraphs for better readability');
        }

        suggestions.push('Add more descriptive language to enhance engagement');
        suggestions.push('Consider including examples to illustrate key points');

        return suggestions;
    }

    private extractKeyPhrases(words: string[], wordFrequency: Record<string, number>): string[] {
        // Simple key phrase extraction based on frequency
        const sortedWords = Object.entries(wordFrequency)
            .filter(([word]) => word.length > 3) // Filter short words
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([word]) => word);

        return sortedWords;
    }

    private countWords(text: string): number {
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }
}

export default ContentService;
