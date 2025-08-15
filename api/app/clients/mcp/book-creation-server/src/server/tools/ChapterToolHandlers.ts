/**
 * Chapter Tool Handlers - MCP tools for chapter management
 * Refactored to use BaseToolHandler and reusable components
 */

import { CreateChapterRequest, UpdateChapterRequest, ChapterResponse } from '../../../types/book.js';
import { ILogger } from '../../core/Logger.js';
import { BaseToolHandler } from '../../core/BaseToolHandler.js';
import { ChapterFormatters, GenericFormatters } from '../../core/ResponseFormatters.js';
import { ToolFactory } from '../../core/ToolFactory.js';
import { IChapterService } from '../../interfaces/index.js';
import { NarrativeConsistencyService } from '../../services/NarrativeConsistencyService.js';

export class ChapterToolHandlers extends BaseToolHandler {
    private chapterService: IChapterService;
    private narrativeService?: NarrativeConsistencyService;

    constructor(logger: ILogger, chapterService: IChapterService, narrativeService?: NarrativeConsistencyService) {
        super(logger, 'ChapterToolHandlers');
        this.chapterService = chapterService;
        this.narrativeService = narrativeService;
        this.initialize();
    }

    protected defineTools(): void {
        // Register CRUD operations using the tool factory
        const crudTools = ToolFactory.createCrudTools<ChapterResponse, CreateChapterRequest, UpdateChapterRequest, any>(
            'Chapter',
            'chapter',
            {
                create: this.handleCreateChapter.bind(this),
                get: this.handleGetChapter.bind(this),
                list: this.handleListChapters.bind(this),
                update: this.handleUpdateChapter.bind(this),
                delete: this.handleDeleteChapter.bind(this),
            },
            {
                created: ChapterFormatters.created,
                detail: ChapterFormatters.detail,
                list: this.formatChapterList.bind(this),
                updated: this.formatChapterUpdate.bind(this),
                deleted: (chapterId: string) => GenericFormatters.deleted('Chapter', chapterId),
            }
        );

        // Register CRUD tools
        crudTools.forEach(tool => this.registerTool(tool));
    }

    // Handler methods - now much cleaner without validation logic

    private async handleCreateChapter(input: CreateChapterRequest): Promise<ChapterResponse> {
        const chapter = await this.chapterService.createChapter(input);
        
        // Record chapter creation in timeline if narrative service available
        if (this.narrativeService) {
            try {
                await this.narrativeService.recordTimelineEvent(
                    input.bookId,
                    input.conversationId,
                    {
                        name: `Chapter Created: ${input.title}`,
                        description: input.description || `New chapter "${input.title}" created`,
                        type: 'plot_point',
                        timing: {
                            sequenceNumber: input.chapterNumber || chapter.chapterNumber,
                            relativeTime: `Chapter ${chapter.chapterNumber}`
                        },
                        participants: [],
                        impact: {
                            plotSignificance: 'moderate'
                        }
                    },
                    {
                        chapterId: chapter._id,
                        pageId: '',
                        scenePosition: 'opening'
                    }
                );
            } catch (error) {
                this.logger.warn('Failed to record chapter creation in timeline', error as Error);
            }
        }
        
        return chapter;
    }

    private async handleGetChapter(id: string, options?: { includePages?: boolean }): Promise<ChapterResponse> {
        return await this.chapterService.getChapter(id, options?.includePages);
    }

    private async handleListChapters(input: { bookId: string }): Promise<{ data: ChapterResponse[]; pagination: any }> {
        const chapters = await this.chapterService.listChapters(input.bookId);
        return {
            data: chapters,
            pagination: { total: chapters.length, offset: 0, limit: chapters.length, hasMore: false }
        };
    }

    private async handleUpdateChapter(id: string, updates: UpdateChapterRequest): Promise<ChapterResponse> {
        return await this.chapterService.updateChapter(id, updates);
    }

    private async handleDeleteChapter(id: string, authorId: string): Promise<void> {
        await this.chapterService.deleteChapter(id, authorId);
    }

    // Custom formatters

    private formatChapterList(result: { data: ChapterResponse[]; pagination: any }): string {
        if (result.data.length === 0) {
            return `📚 No chapters found.`;
        }

        return this.createListResponse(
            'Chapter',
            result.data,
            (chapter: ChapterResponse, index: number) => ChapterFormatters.listItem(chapter, index),
            result.pagination.total,
            result.pagination
        );
    }

    private formatChapterUpdate(chapter: ChapterResponse): string {
        return this.createSuccessResponse('Chapter', 'updated', chapter);
    }
}
