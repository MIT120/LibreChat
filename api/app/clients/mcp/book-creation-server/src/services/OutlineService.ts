/**
 * Outline Service - Business logic for managing story outlines
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseService } from '../core/BaseService.js';
import { ILogger } from '../interfaces/ILogger.js';
import { DatabaseError, NotFoundError, ValidationError } from '../../types/errors.js';
import { Outline, IOutline, IScene, IChapterOutline, IActOutline } from '../../models/Outline.js';

export interface CreateOutlineRequest {
    bookId: string;
    title: string;
    description?: string;
    structure: 'three-act' | 'four-act' | 'five-act' | 'hero-journey' | 'custom';
    authorId: string;
    conversationId: string;
}

export interface UpdateOutlineRequest {
    title?: string;
    description?: string;
    structure?: 'three-act' | 'four-act' | 'five-act' | 'hero-journey' | 'custom';
    settings?: Partial<IOutline['settings']>;
}

export interface CreateSceneRequest {
    title: string;
    description?: string;
    summary?: string;
    chapterId?: string;
    order?: number;
    status?: 'planned' | 'writing' | 'draft' | 'review' | 'completed';
    wordCount?: number;
    targetWordCount?: number;
    tags?: string[];
    notes?: string;
    pov?: string;
    setting?: string;
    timeOfDay?: string;
    conflict?: string;
    goal?: string;
    outcome?: string;
    tension?: number;
    importance?: 'low' | 'medium' | 'high' | 'critical';
    position?: { x: number; y: number };
    color?: string;
    authorId: string;
}

export interface UpdateSceneRequest {
    title?: string;
    description?: string;
    summary?: string;
    chapterId?: string;
    status?: 'planned' | 'writing' | 'draft' | 'review' | 'completed';
    wordCount?: number;
    targetWordCount?: number;
    tags?: string[];
    notes?: string;
    pov?: string;
    setting?: string;
    timeOfDay?: string;
    conflict?: string;
    goal?: string;
    outcome?: string;
    tension?: number;
    importance?: 'low' | 'medium' | 'high' | 'critical';
    position?: { x: number; y: number };
    color?: string;
}

export interface CreateChapterRequest {
    title: string;
    description?: string;
    order?: number;
    targetWordCount?: number;
    tags?: string[];
    notes?: string;
    color?: string;
    position?: { x: number; y: number };
}

export interface ReorderRequest {
    sceneIds: string[];
}

export interface IOutlineService {
    createOutline(data: CreateOutlineRequest): Promise<IOutline>;
    getOutline(outlineId: string): Promise<IOutline>;
    getOutlineByBookId(bookId: string): Promise<IOutline | null>;
    updateOutline(outlineId: string, data: UpdateOutlineRequest): Promise<IOutline>;
    deleteOutline(outlineId: string): Promise<void>;

    // Scene management
    addScene(outlineId: string, data: CreateSceneRequest): Promise<IScene>;
    updateScene(outlineId: string, sceneId: string, data: UpdateSceneRequest): Promise<IScene>;
    deleteScene(outlineId: string, sceneId: string): Promise<void>;
    reorderScenes(outlineId: string, data: ReorderRequest): Promise<IOutline>;

    // Chapter management
    addChapter(outlineId: string, data: CreateChapterRequest): Promise<IChapterOutline>;
    updateChapter(outlineId: string, chapterId: string, data: Partial<CreateChapterRequest>): Promise<IChapterOutline>;
    deleteChapter(outlineId: string, chapterId: string): Promise<void>;
    reorderChapters(outlineId: string, chapterIds: string[]): Promise<IOutline>;

    // Bulk operations
    importScenes(outlineId: string, scenes: CreateSceneRequest[]): Promise<IScene[]>;
    exportOutline(outlineId: string, format: 'json' | 'csv' | 'markdown'): Promise<string>;

    // Analytics
    getOutlineStats(outlineId: string): Promise<{
        totalScenes: number;
        totalChapters: number;
        totalWordCount: number;
        completionPercentage: number;
        scenesByStatus: Record<string, number>;
        averageSceneLength: number;
        longestScene: IScene | null;
        shortestScene: IScene | null;
    }>;
}

export class OutlineService extends BaseService implements IOutlineService {
    constructor(logger: ILogger) {
        super(logger.child('OutlineService'));
    }

    async createOutline(data: CreateOutlineRequest): Promise<IOutline> {
        return this.executeWithLogging('createOutline', async () => {
            // Validate input
            if (!data.bookId || !data.title || !data.authorId || !data.conversationId) {
                throw new ValidationError('Missing required fields: bookId, title, authorId, conversationId');
            }

            // Check if outline already exists for this book
            const existingOutline = await Outline.findOne({ bookId: data.bookId });
            if (existingOutline) {
                throw new ValidationError('Outline already exists for this book');
            }

            // Create default structure based on type
            const acts = this.createDefaultStructure(data.structure);

            const outline = new Outline({
                _id: uuidv4(),
                bookId: data.bookId,
                title: data.title,
                description: data.description,
                structure: data.structure,
                acts,
                scenes: [],
                chapters: [],
                settings: {
                    defaultView: 'outline',
                    gridColumns: 4,
                    matrixRows: 3,
                    showWordCounts: true,
                    showStatus: true,
                    showTags: false,
                    colorCoding: 'status',
                    autoSave: true
                },
                metadata: {
                    totalScenes: 0,
                    totalChapters: 0,
                    totalWordCount: 0,
                    targetWordCount: 0,
                    completionPercentage: 0,
                    lastModified: new Date(),
                    version: 1
                },
                authorId: data.authorId,
                conversationId: data.conversationId
            });

            try {
                const savedOutline = await outline.save();
                return savedOutline;
            } catch (error) {
                throw new DatabaseError(`Failed to create outline: ${(error as Error).message}`);
            }
        }, { bookId: data.bookId, title: data.title });
    }

    async getOutline(outlineId: string): Promise<IOutline> {
        return this.executeWithLogging('getOutline', async () => {
            const outline = await Outline.findById(outlineId);
            if (!outline) {
                throw new NotFoundError(`Outline not found: ${outlineId}`);
            }
            return outline;
        }, { outlineId });
    }

    async getOutlineByBookId(bookId: string): Promise<IOutline | null> {
        return this.executeWithLogging('getOutlineByBookId', async () => {
            const outline = await Outline.findOne({ bookId });
            return outline;
        }, { bookId });
    }

    async updateOutline(outlineId: string, data: UpdateOutlineRequest): Promise<IOutline> {
        return this.executeWithLogging('updateOutline', async () => {
            const outline = await Outline.findById(outlineId);
            if (!outline) {
                throw new NotFoundError(`Outline not found: ${outlineId}`);
            }

            // Update fields
            if (data.title) outline.title = data.title;
            if (data.description !== undefined) outline.description = data.description;
            if (data.structure) {
                outline.structure = data.structure;
                // Regenerate acts if structure changed
                outline.acts = this.createDefaultStructure(data.structure);
            }
            if (data.settings) {
                outline.settings = { ...outline.settings, ...data.settings };
            }

            try {
                const savedOutline = await outline.save();
                return savedOutline;
            } catch (error) {
                throw new DatabaseError(`Failed to update outline: ${(error as Error).message}`);
            }
        }, { outlineId });
    }

    async deleteOutline(outlineId: string): Promise<void> {
        return this.executeWithLogging('deleteOutline', async () => {
            const result = await Outline.findByIdAndDelete(outlineId);
            if (!result) {
                throw new NotFoundError(`Outline not found: ${outlineId}`);
            }
        }, { outlineId });
    }

    async addScene(outlineId: string, data: CreateSceneRequest): Promise<IScene> {
        return this.executeWithLogging('addScene', async () => {
            const outline = await Outline.findById(outlineId);
            if (!outline) {
                throw new NotFoundError(`Outline not found: ${outlineId}`);
            }

            const newScene: IScene = {
                _id: uuidv4(),
                title: data.title,
                description: data.description,
                summary: data.summary,
                chapterId: data.chapterId,
                order: data.order !== undefined ? data.order : outline.scenes.length,
                status: data.status || 'planned',
                wordCount: data.wordCount || 0,
                targetWordCount: data.targetWordCount,
                tags: data.tags || [],
                notes: data.notes,
                pov: data.pov,
                setting: data.setting,
                timeOfDay: data.timeOfDay,
                conflict: data.conflict,
                goal: data.goal,
                outcome: data.outcome,
                tension: data.tension,
                importance: data.importance || 'medium',
                position: data.position || { x: 0, y: 0 },
                color: data.color,
                metadata: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    lastModifiedBy: data.authorId
                }
            };

            outline.scenes.push(newScene);

            try {
                await outline.save();
                return newScene;
            } catch (error) {
                throw new DatabaseError(`Failed to add scene: ${(error as Error).message}`);
            }
        }, { outlineId, sceneTitle: data.title });
    }

    async updateScene(outlineId: string, sceneId: string, data: UpdateSceneRequest): Promise<IScene> {
        return this.executeWithLogging('updateScene', async () => {
            const outline = await Outline.findById(outlineId);
            if (!outline) {
                throw new NotFoundError(`Outline not found: ${outlineId}`);
            }

            const scene = outline.scenes.find((s: IScene) => s._id === sceneId);
            if (!scene) {
                throw new NotFoundError(`Scene not found: ${sceneId}`);
            }

            // Update scene properties
            Object.assign(scene, data);
            scene.metadata = {
                ...scene.metadata,
                updatedAt: new Date()
            };

            try {
                await outline.save();
                return scene;
            } catch (error) {
                throw new DatabaseError(`Failed to update scene: ${(error as Error).message}`);
            }
        }, { outlineId, sceneId });
    }

    async deleteScene(outlineId: string, sceneId: string): Promise<void> {
        return this.executeWithLogging('deleteScene', async () => {
            const outline = await Outline.findById(outlineId);
            if (!outline) {
                throw new NotFoundError(`Outline not found: ${outlineId}`);
            }

            const sceneIndex = outline.scenes.findIndex((s: IScene) => s._id === sceneId);
            if (sceneIndex === -1) {
                throw new NotFoundError(`Scene not found: ${sceneId}`);
            }

            outline.scenes.splice(sceneIndex, 1);

            // Reorder remaining scenes
            outline.scenes.forEach((scene: IScene, index: number) => {
                scene.order = index;
            });

            try {
                await outline.save();
            } catch (error) {
                throw new DatabaseError(`Failed to delete scene: ${(error as Error).message}`);
            }
        }, { outlineId, sceneId });
    }

    async reorderScenes(outlineId: string, data: ReorderRequest): Promise<IOutline> {
        return this.executeWithLogging('reorderScenes', async () => {
            const outline = await Outline.findById(outlineId);
            if (!outline) {
                throw new NotFoundError(`Outline not found: ${outlineId}`);
            }

            // Validate all scene IDs exist
            const sceneMap = new Map(outline.scenes.map((scene: IScene) => [scene._id, scene]));
            for (const sceneId of data.sceneIds) {
                if (!sceneMap.has(sceneId)) {
                    throw new ValidationError(`Scene not found: ${sceneId}`);
                }
            }

            // Reorder scenes
            outline.scenes = data.sceneIds.map((id, index) => {
                const scene = sceneMap.get(id)!;
                scene.order = index;
                return scene;
            });

            try {
                const savedOutline = await outline.save();
                return savedOutline;
            } catch (error) {
                throw new DatabaseError(`Failed to reorder scenes: ${(error as Error).message}`);
            }
        }, { outlineId, sceneCount: data.sceneIds.length });
    }

    async addChapter(outlineId: string, data: CreateChapterRequest): Promise<IChapterOutline> {
        return this.executeWithLogging('addChapter', async () => {
            const outline = await Outline.findById(outlineId);
            if (!outline) {
                throw new NotFoundError(`Outline not found: ${outlineId}`);
            }

            const newChapter: IChapterOutline = {
                _id: uuidv4(),
                title: data.title,
                description: data.description,
                order: data.order !== undefined ? data.order : outline.chapters.length,
                scenes: [],
                wordCount: 0,
                targetWordCount: data.targetWordCount,
                status: 'planned',
                tags: data.tags || [],
                notes: data.notes,
                color: data.color,
                position: data.position || { x: 0, y: 0 }
            };

            outline.chapters.push(newChapter);

            try {
                await outline.save();
                return newChapter;
            } catch (error) {
                throw new DatabaseError(`Failed to add chapter: ${(error as Error).message}`);
            }
        }, { outlineId, chapterTitle: data.title });
    }

    async updateChapter(outlineId: string, chapterId: string, data: Partial<CreateChapterRequest>): Promise<IChapterOutline> {
        return this.executeWithLogging('updateChapter', async () => {
            const outline = await Outline.findById(outlineId);
            if (!outline) {
                throw new NotFoundError(`Outline not found: ${outlineId}`);
            }

            const chapter = outline.chapters.find((c: IChapterOutline) => c._id === chapterId);
            if (!chapter) {
                throw new NotFoundError(`Chapter not found: ${chapterId}`);
            }

            // Update chapter properties
            Object.assign(chapter, data);

            try {
                await outline.save();
                return chapter;
            } catch (error) {
                throw new DatabaseError(`Failed to update chapter: ${(error as Error).message}`);
            }
        }, { outlineId, chapterId });
    }

    async deleteChapter(outlineId: string, chapterId: string): Promise<void> {
        return this.executeWithLogging('deleteChapter', async () => {
            const outline = await Outline.findById(outlineId);
            if (!outline) {
                throw new NotFoundError(`Outline not found: ${outlineId}`);
            }

            const chapterIndex = outline.chapters.findIndex((c: IChapterOutline) => c._id === chapterId);
            if (chapterIndex === -1) {
                throw new NotFoundError(`Chapter not found: ${chapterId}`);
            }

            outline.chapters.splice(chapterIndex, 1);

            // Reorder remaining chapters
            outline.chapters.forEach((chapter: IChapterOutline, index: number) => {
                chapter.order = index;
            });

            try {
                await outline.save();
            } catch (error) {
                throw new DatabaseError(`Failed to delete chapter: ${(error as Error).message}`);
            }
        }, { outlineId, chapterId });
    }

    async reorderChapters(outlineId: string, chapterIds: string[]): Promise<IOutline> {
        return this.executeWithLogging('reorderChapters', async () => {
            const outline = await Outline.findById(outlineId);
            if (!outline) {
                throw new NotFoundError(`Outline not found: ${outlineId}`);
            }

            // Validate all chapter IDs exist
            const chapterMap = new Map(outline.chapters.map((chapter: IChapterOutline) => [chapter._id, chapter]));
            for (const chapterId of chapterIds) {
                if (!chapterMap.has(chapterId)) {
                    throw new ValidationError(`Chapter not found: ${chapterId}`);
                }
            }

            // Reorder chapters
            outline.chapters = chapterIds.map((id, index) => {
                const chapter = chapterMap.get(id)!;
                chapter.order = index;
                return chapter;
            });

            try {
                const savedOutline = await outline.save();
                return savedOutline;
            } catch (error) {
                throw new DatabaseError(`Failed to reorder chapters: ${(error as Error).message}`);
            }
        }, { outlineId, chapterCount: chapterIds.length });
    }

    async importScenes(outlineId: string, scenes: CreateSceneRequest[]): Promise<IScene[]> {
        return this.executeWithLogging('importScenes', async () => {
            const outline = await Outline.findById(outlineId);
            if (!outline) {
                throw new NotFoundError(`Outline not found: ${outlineId}`);
            }

            const newScenes: IScene[] = scenes.map((sceneData, index) => ({
                _id: uuidv4(),
                title: sceneData.title,
                description: sceneData.description,
                summary: sceneData.summary,
                chapterId: sceneData.chapterId,
                order: outline.scenes.length + index,
                status: sceneData.status || 'planned',
                wordCount: sceneData.wordCount || 0,
                targetWordCount: sceneData.targetWordCount,
                tags: sceneData.tags || [],
                notes: sceneData.notes,
                pov: sceneData.pov,
                setting: sceneData.setting,
                timeOfDay: sceneData.timeOfDay,
                conflict: sceneData.conflict,
                goal: sceneData.goal,
                outcome: sceneData.outcome,
                tension: sceneData.tension,
                importance: sceneData.importance || 'medium',
                position: sceneData.position || { x: 0, y: 0 },
                color: sceneData.color,
                metadata: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    lastModifiedBy: sceneData.authorId
                }
            }));

            outline.scenes.push(...newScenes);

            try {
                await outline.save();
                return newScenes;
            } catch (error) {
                throw new DatabaseError(`Failed to import scenes: ${(error as Error).message}`);
            }
        }, { outlineId, sceneCount: scenes.length });
    }

    async exportOutline(outlineId: string, format: 'json' | 'csv' | 'markdown'): Promise<string> {
        return this.executeWithLogging('exportOutline', async () => {
            const outline = await Outline.findById(outlineId);
            if (!outline) {
                throw new NotFoundError(`Outline not found: ${outlineId}`);
            }

            switch (format) {
                case 'json':
                    return JSON.stringify(outline.toObject(), null, 2);

                case 'csv':
                    return this.exportToCsv(outline);

                case 'markdown':
                    return this.exportToMarkdown(outline);

                default:
                    throw new ValidationError(`Unsupported export format: ${format}`);
            }
        }, { outlineId, format });
    }

    async getOutlineStats(outlineId: string): Promise<{
        totalScenes: number;
        totalChapters: number;
        totalWordCount: number;
        completionPercentage: number;
        scenesByStatus: Record<string, number>;
        averageSceneLength: number;
        longestScene: IScene | null;
        shortestScene: IScene | null;
    }> {
        return this.executeWithLogging('getOutlineStats', async () => {
            const outline = await Outline.findById(outlineId);
            if (!outline) {
                throw new NotFoundError(`Outline not found: ${outlineId}`);
            }

            const scenesByStatus = outline.scenes.reduce((acc: Record<string, number>, scene: IScene) => {
                acc[scene.status] = (acc[scene.status] || 0) + 1;
                return acc;
            }, {});

            const scenesWithWordCount = outline.scenes.filter((scene: IScene) => scene.wordCount && scene.wordCount > 0);
            const longestScene = scenesWithWordCount.reduce((prev: IScene | null, current: IScene) => {
                return (!prev || (current.wordCount || 0) > (prev.wordCount || 0)) ? current : prev;
            }, null);

            const shortestScene = scenesWithWordCount.reduce((prev: IScene | null, current: IScene) => {
                return (!prev || (current.wordCount || 0) < (prev.wordCount || 0)) ? current : prev;
            }, null);

            return {
                totalScenes: outline.metadata.totalScenes,
                totalChapters: outline.metadata.totalChapters,
                totalWordCount: outline.metadata.totalWordCount,
                completionPercentage: outline.metadata.completionPercentage,
                scenesByStatus,
                averageSceneLength: outline.metadata.totalScenes > 0
                    ? outline.metadata.totalWordCount / outline.metadata.totalScenes
                    : 0,
                longestScene,
                shortestScene
            };
        }, { outlineId });
    }

    private createDefaultStructure(structure: string): IActOutline[] {
        const structures: Record<string, { title: string; description: string }[]> = {
            'three-act': [
                { title: 'Act I: Setup', description: 'Introduction, inciting incident, plot point 1' },
                { title: 'Act II: Confrontation', description: 'Rising action, midpoint, plot point 2' },
                { title: 'Act III: Resolution', description: 'Climax, falling action, resolution' }
            ],
            'four-act': [
                { title: 'Act I: Setup', description: 'Introduction and setup' },
                { title: 'Act II-A: Rising Action', description: 'First half of confrontation' },
                { title: 'Act II-B: Midpoint Crisis', description: 'Second half leading to climax' },
                { title: 'Act III: Resolution', description: 'Climax and resolution' }
            ],
            'five-act': [
                { title: 'Act I: Exposition', description: 'Introduction and setup' },
                { title: 'Act II: Rising Action', description: 'Complications begin' },
                { title: 'Act III: Climax', description: 'Turning point' },
                { title: 'Act IV: Falling Action', description: 'Consequences unfold' },
                { title: 'Act V: Denouement', description: 'Resolution and conclusion' }
            ],
            'hero-journey': [
                { title: 'Ordinary World', description: 'Hero in familiar surroundings' },
                { title: 'Adventure Begins', description: 'Call to adventure, crossing threshold' },
                { title: 'Trials and Tribulations', description: 'Tests, allies, enemies' },
                { title: 'Ordeal and Reward', description: 'Crisis and revelation' },
                { title: 'Return Transformed', description: 'Journey home with wisdom' }
            ],
            'custom': [
                { title: 'Part 1', description: 'Beginning section' },
                { title: 'Part 2', description: 'Middle section' },
                { title: 'Part 3', description: 'End section' }
            ]
        };

        const actTemplates = structures[structure] || structures['custom'];

        return actTemplates.map((template, index) => ({
            _id: uuidv4(),
            title: template.title,
            description: template.description,
            order: index,
            chapters: [],
            wordCount: 0,
            targetWordCount: 0,
            theme: '',
            conflict: '',
            color: undefined
        }));
    }

    private exportToCsv(outline: IOutline): string {
        const headers = [
            'Scene ID', 'Title', 'Description', 'Chapter', 'Order', 'Status',
            'Word Count', 'Target Word Count', 'POV', 'Setting', 'Conflict', 'Goal', 'Outcome',
            'Tension', 'Importance', 'Tags', 'Notes'
        ];

        const rows = outline.scenes.map((scene: IScene) => [
            scene._id,
            scene.title,
            scene.description || '',
            scene.chapterId || '',
            scene.order.toString(),
            scene.status,
            (scene.wordCount || 0).toString(),
            (scene.targetWordCount || 0).toString(),
            scene.pov || '',
            scene.setting || '',
            scene.conflict || '',
            scene.goal || '',
            scene.outcome || '',
            (scene.tension || '').toString(),
            scene.importance || '',
            (scene.tags || []).join(';'),
            scene.notes || ''
        ]);

        return [headers, ...rows].map(row =>
            row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
        ).join('\n');
    }

    private exportToMarkdown(outline: IOutline): string {
        let markdown = `# ${outline.title}\n\n`;

        if (outline.description) {
            markdown += `${outline.description}\n\n`;
        }

        markdown += `## Outline Structure: ${outline.structure}\n\n`;

        for (const act of outline.acts) {
            markdown += `### ${act.title}\n\n`;
            if (act.description) {
                markdown += `${act.description}\n\n`;
            }

            const actChapters = outline.chapters.filter((ch: IChapterOutline) =>
                act.chapters.some((actCh: IChapterOutline) => actCh._id === ch._id)
            );

            for (const chapter of actChapters) {
                markdown += `#### ${chapter.title}\n\n`;
                if (chapter.description) {
                    markdown += `${chapter.description}\n\n`;
                }

                const chapterScenes = outline.scenes.filter((scene: IScene) => scene.chapterId === chapter._id);
                for (const scene of chapterScenes) {
                    markdown += `##### ${scene.title}\n\n`;
                    if (scene.description) {
                        markdown += `${scene.description}\n\n`;
                    }
                    if (scene.summary) {
                        markdown += `**Summary:** ${scene.summary}\n\n`;
                    }
                    if (scene.pov) {
                        markdown += `**POV:** ${scene.pov}\n\n`;
                    }
                    if (scene.setting) {
                        markdown += `**Setting:** ${scene.setting}\n\n`;
                    }
                    if (scene.conflict) {
                        markdown += `**Conflict:** ${scene.conflict}\n\n`;
                    }
                    if (scene.notes) {
                        markdown += `**Notes:** ${scene.notes}\n\n`;
                    }
                    markdown += '---\n\n';
                }
            }
        }

        // Add standalone scenes (not in chapters)
        const standaloneScenes = outline.scenes.filter((scene: IScene) => !scene.chapterId);
        if (standaloneScenes.length > 0) {
            markdown += `## Standalone Scenes\n\n`;
            for (const scene of standaloneScenes) {
                markdown += `### ${scene.title}\n\n`;
                if (scene.description) {
                    markdown += `${scene.description}\n\n`;
                }
                if (scene.summary) {
                    markdown += `**Summary:** ${scene.summary}\n\n`;
                }
                markdown += '---\n\n';
            }
        }

        return markdown;
    }
}
