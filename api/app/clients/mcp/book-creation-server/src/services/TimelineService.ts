/**
 * Timeline Service - Manages story timelines and narrative events
 */

import { BaseService } from '../core/BaseService.js';
import { ILogger } from '../interfaces/ILogger.js';
import { Document } from 'mongoose';

// Type definition for StoryTimeline document
type StoryTimelineDocument = any;
import { StoryTimeline } from '../../models/StoryTimeline.js';
import { Book } from '../../models/Book.js';
import { Chapter } from '../../models/Chapter.js';
import { Page } from '../../models/Page.js';
import { CharacterEvolution } from '../../models/NarrativeElements.js';
import { DatabaseError, NotFoundError, ValidationError } from '../../types/errors.js';
import { v4 as uuidv4 } from 'uuid';

// Service interfaces
export interface CreateTimelineRequest {
    bookId: string;
    name?: string;
    description?: string;
    templateCategory?: string;
}

export interface TimelineEvent {
    id?: string;
    type: 'plot_point' | 'character_event' | 'world_event' | 'conflict' | 'resolution' | 'milestone';
    title: string;
    description?: string;
    chapterId?: string;
    pageId?: string;
    position: number; // 0-100
    color?: string;
    icon?: string;
    participants?: Array<{
        characterId: string;
        role?: 'protagonist' | 'antagonist' | 'witness' | 'catalyst' | 'victim' | 'instigator';
    }>;
    consequences?: string[];
    importance?: 'low' | 'medium' | 'high' | 'critical';
    tags?: string[];
}

export interface PlotArc {
    id?: string;
    name: string;
    description?: string;
    type: 'main' | 'subplot' | 'character_arc' | 'relationship_arc' | 'mystery' | 'romance';
    startPosition: number;
    endPosition: number;
    color?: string;
    tension: {
        start: number;
        peak: number;
        end: number;
    };
    milestones?: Array<{
        position: number;
        title: string;
        description?: string;
        achieved?: boolean;
    }>;
    characters?: Array<{
        characterId: string;
        importance: 'primary' | 'secondary' | 'minor';
    }>;
}

export interface CharacterArcMarker {
    id?: string;
    characterId: string;
    characterName: string;
    position: number;
    eventType: 'introduction' | 'development' | 'conflict' | 'growth' | 'setback' | 'revelation' | 'transformation';
    title: string;
    description?: string;
    emotionalState?: {
        before: string;
        after: string;
    };
    relationships?: Array<{
        withCharacter: string;
        changeType: 'strengthened' | 'weakened' | 'changed' | 'formed' | 'broken';
        description?: string;
    }>;
    color?: string;
}

export interface UpdateTimelineRequest {
    name?: string;
    description?: string;
    settings?: {
        scale?: 'chapter' | 'scene' | 'page' | 'custom';
        showCharacters?: boolean;
        showPlotArcs?: boolean;
        showRelationships?: boolean;
        showTension?: boolean;
        groupBy?: 'chronological' | 'character' | 'plotline' | 'location';
        filters?: {
            eventTypes?: string[];
            characters?: string[];
            plotArcs?: string[];
            importanceLevel?: string[];
        };
        view?: {
            zoom?: number;
            centerPosition?: number;
            showMinimap?: boolean;
            showGrid?: boolean;
        };
    };
}

export interface TimelineAnalysis {
    totalEvents: number;
    totalPlotArcs: number;
    totalCharacterArcs: number;
    tensionCurve: Array<{ position: number; tension: number }>;
    pacingAnalysis: {
        averageEventsPerChapter: number;
        highTensionPoints: number[];
        lowTensionPoints: number[];
        recommendations: string[];
    };
    characterInvolvement: Array<{
        characterId: string;
        characterName: string;
        eventCount: number;
        firstAppearance: number;
        lastAppearance: number;
        arcCompleteness: number; // percentage
    }>;
    plotArcBalance: {
        mainArcCoverage: number; // percentage of timeline
        subplotCount: number;
        arcOverlaps: Array<{
            arc1: string;
            arc2: string;
            overlapPercentage: number;
        }>;
    };
    timelineConsistency: {
        score: number; // 0-100
        issues: Array<{
            type: 'chronology' | 'character_presence' | 'arc_continuity' | 'tension_flow';
            description: string;
            severity: 'low' | 'medium' | 'high';
            suggestions: string[];
        }>;
    };
}

export interface ITimelineService {
    createTimeline(request: CreateTimelineRequest): Promise<StoryTimelineDocument>;
    getTimeline(timelineId: string): Promise<StoryTimelineDocument>;
    getTimelineByBook(bookId: string): Promise<StoryTimelineDocument | null>;
    updateTimeline(timelineId: string, updates: UpdateTimelineRequest): Promise<StoryTimelineDocument>;
    deleteTimeline(timelineId: string): Promise<void>;

    addEvent(timelineId: string, event: TimelineEvent): Promise<StoryTimelineDocument>;
    updateEvent(timelineId: string, eventId: string, updates: Partial<TimelineEvent>): Promise<StoryTimelineDocument>;
    removeEvent(timelineId: string, eventId: string): Promise<StoryTimelineDocument>;

    addPlotArc(timelineId: string, arc: PlotArc): Promise<StoryTimelineDocument>;
    updatePlotArc(timelineId: string, arcId: string, updates: Partial<PlotArc>): Promise<StoryTimelineDocument>;
    removePlotArc(timelineId: string, arcId: string): Promise<StoryTimelineDocument>;

    addCharacterArc(timelineId: string, arc: CharacterArcMarker): Promise<StoryTimelineDocument>;
    updateCharacterArc(timelineId: string, arcId: string, updates: Partial<CharacterArcMarker>): Promise<StoryTimelineDocument>;
    removeCharacterArc(timelineId: string, arcId: string): Promise<StoryTimelineDocument>;

    analyzeTimeline(timelineId: string): Promise<TimelineAnalysis>;
    generateTimelineFromContent(bookId: string): Promise<StoryTimelineDocument>;
    exportTimeline(timelineId: string, format: 'json' | 'csv' | 'markdown'): Promise<string>;
}

export class TimelineService extends BaseService implements ITimelineService {
    constructor(logger: ILogger) {
        super(logger);
    }

    protected async onInitialize(): Promise<void> {
        this.logger.info('TimelineService initialized');
    }

    protected async onDispose(): Promise<void> {
        this.logger.info('TimelineService disposed');
    }

    async createTimeline(request: CreateTimelineRequest): Promise<StoryTimelineDocument> {
        return this.executeWithLogging('createTimeline', async () => {
            this.validateCreateTimelineRequest(request);

            // Verify book exists
            const book = await Book.findById(request.bookId);
            if (!book) {
                throw new NotFoundError('Book', request.bookId);
            }

            const timelineId = uuidv4();
            const timeline = new StoryTimeline({
                _id: timelineId,
                bookId: request.bookId,
                name: request.name || 'Main Timeline',
                description: request.description,
                events: [],
                plotArcs: [],
                characterArcs: [],
                settings: {
                    scale: 'chapter',
                    showCharacters: true,
                    showPlotArcs: true,
                    showRelationships: false,
                    showTension: true,
                    groupBy: 'chronological',
                    filters: {
                        eventTypes: [],
                        characters: [],
                        plotArcs: [],
                        importanceLevel: []
                    },
                    view: {
                        zoom: 1,
                        centerPosition: 0,
                        showMinimap: true,
                        showGrid: true
                    }
                },
                metadata: {
                    totalEvents: 0,
                    totalPlotArcs: 0,
                    totalCharacterArcs: 0,
                    timelineSpan: { start: '', end: '' },
                    lastCalculated: new Date()
                },
                isTemplate: false,
                templateCategory: request.templateCategory
            });

            try {
                const savedTimeline = await timeline.save();
                return savedTimeline;
            } catch (error) {
                throw new DatabaseError(`Failed to create timeline: ${(error as Error).message}`);
            }
        }, { bookId: request.bookId });
    }

    async getTimeline(timelineId: string): Promise<StoryTimelineDocument> {
        return this.executeWithLogging('getTimeline', async () => {
            const timeline = await StoryTimeline.findById(timelineId);
            if (!timeline) {
                throw new NotFoundError('Timeline', timelineId);
            }
            return timeline;
        }, { timelineId });
    }

    async getTimelineByBook(bookId: string): Promise<StoryTimelineDocument | null> {
        return this.executeWithLogging('getTimelineByBook', async () => {
            const timeline = await StoryTimeline.findOne({ bookId });
            return timeline;
        }, { bookId });
    }

    async updateTimeline(timelineId: string, updates: UpdateTimelineRequest): Promise<StoryTimelineDocument> {
        return this.executeWithLogging('updateTimeline', async () => {
            const timeline = await StoryTimeline.findById(timelineId);
            if (!timeline) {
                throw new NotFoundError('Timeline', timelineId);
            }

            if (updates.name !== undefined) timeline.name = updates.name;
            if (updates.description !== undefined) timeline.description = updates.description;

            if (updates.settings) {
                Object.assign(timeline.settings, updates.settings);
            }

            timeline.metadata.lastCalculated = new Date();

            try {
                const updatedTimeline = await timeline.save();
                return updatedTimeline;
            } catch (error) {
                throw new DatabaseError(`Failed to update timeline: ${(error as Error).message}`);
            }
        }, { timelineId });
    }

    async deleteTimeline(timelineId: string): Promise<void> {
        return this.executeWithLogging('deleteTimeline', async () => {
            const timeline = await StoryTimeline.findById(timelineId);
            if (!timeline) {
                throw new NotFoundError('Timeline', timelineId);
            }

            try {
                await StoryTimeline.findByIdAndDelete(timelineId);
            } catch (error) {
                throw new DatabaseError(`Failed to delete timeline: ${(error as Error).message}`);
            }
        }, { timelineId });
    }

    async addEvent(timelineId: string, event: TimelineEvent): Promise<StoryTimelineDocument> {
        return this.executeWithLogging('addEvent', async () => {
            const timeline = await StoryTimeline.findById(timelineId);
            if (!timeline) {
                throw new NotFoundError('Timeline', timelineId);
            }

            const eventData = {
                ...event,
                id: event.id || `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                color: event.color || this.getDefaultEventColor(event.type),
                icon: event.icon || this.getDefaultEventIcon(event.type),
                importance: event.importance || 'medium',
                participants: event.participants || [],
                consequences: event.consequences || [],
                tags: event.tags || [],
                visibility: {
                    showInOutline: true,
                    showInWriting: false,
                    showInExport: true
                }
            };

            // Add event to timeline
            timeline.events.push(eventData);
            await timeline.save();
            return timeline;
        }, { timelineId, eventType: event.type });
    }

    async updateEvent(timelineId: string, eventId: string, updates: Partial<TimelineEvent>): Promise<StoryTimelineDocument> {
        return this.executeWithLogging('updateEvent', async () => {
            const timeline = await StoryTimeline.findById(timelineId);
            if (!timeline) {
                throw new NotFoundError('Timeline', timelineId);
            }

            const eventIndex = timeline.events.findIndex(e => e.id === eventId);
            if (eventIndex === -1) {
                throw new NotFoundError('Event', eventId);
            }

            Object.assign(timeline.events[eventIndex], updates);
            timeline.metadata.lastCalculated = new Date();

            try {
                const updatedTimeline = await timeline.save();
                return updatedTimeline;
            } catch (error) {
                throw new DatabaseError(`Failed to update event: ${(error as Error).message}`);
            }
        }, { timelineId, eventId });
    }

    async removeEvent(timelineId: string, eventId: string): Promise<StoryTimelineDocument> {
        return this.executeWithLogging('removeEvent', async () => {
            const timeline = await StoryTimeline.findById(timelineId);
            if (!timeline) {
                throw new NotFoundError('Timeline', timelineId);
            }

            // Remove event from timeline
            const filteredEvents = timeline.events.filter(e => e.id !== eventId);
            timeline.events = filteredEvents as any;
            await timeline.save();
            timeline.metadata.totalEvents = timeline.events.length;
            timeline.metadata.lastCalculated = new Date();

            try {
                const updatedTimeline = await timeline.save();
                return updatedTimeline;
            } catch (error) {
                throw new DatabaseError(`Failed to remove event: ${(error as Error).message}`);
            }
        }, { timelineId, eventId });
    }

    async addPlotArc(timelineId: string, arc: PlotArc): Promise<StoryTimelineDocument> {
        return this.executeWithLogging('addPlotArc', async () => {
            const timeline = await StoryTimeline.findById(timelineId);
            if (!timeline) {
                throw new NotFoundError('Timeline', timelineId);
            }

            const arcData = {
                ...arc,
                id: arc.id || `arc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                color: arc.color || this.getDefaultArcColor(arc.type),
                milestones: arc.milestones || [],
                characters: arc.characters || []
            };

            // Add plot arc to timeline
            timeline.plotArcs.push(arcData);
            await timeline.save();
            return timeline;
        }, { timelineId, arcType: arc.type });
    }

    async updatePlotArc(timelineId: string, arcId: string, updates: Partial<PlotArc>): Promise<StoryTimelineDocument> {
        return this.executeWithLogging('updatePlotArc', async () => {
            const timeline = await StoryTimeline.findById(timelineId);
            if (!timeline) {
                throw new NotFoundError('Timeline', timelineId);
            }

            const arcIndex = timeline.plotArcs.findIndex(a => a.id === arcId);
            if (arcIndex === -1) {
                throw new NotFoundError('Plot Arc', arcId);
            }

            Object.assign(timeline.plotArcs[arcIndex], updates);
            timeline.metadata.lastCalculated = new Date();

            try {
                const updatedTimeline = await timeline.save();
                return updatedTimeline;
            } catch (error) {
                throw new DatabaseError(`Failed to update plot arc: ${(error as Error).message}`);
            }
        }, { timelineId, arcId });
    }

    async removePlotArc(timelineId: string, arcId: string): Promise<StoryTimelineDocument> {
        return this.executeWithLogging('removePlotArc', async () => {
            const timeline = await StoryTimeline.findById(timelineId);
            if (!timeline) {
                throw new NotFoundError('Timeline', timelineId);
            }

            // Remove plot arc from timeline
            const filteredArcs = timeline.plotArcs.filter(a => a.id !== arcId);
            timeline.plotArcs = filteredArcs as any;
            await timeline.save();
            timeline.metadata.totalPlotArcs = timeline.plotArcs.length;
            timeline.metadata.lastCalculated = new Date();

            try {
                const updatedTimeline = await timeline.save();
                return updatedTimeline;
            } catch (error) {
                throw new DatabaseError(`Failed to remove plot arc: ${(error as Error).message}`);
            }
        }, { timelineId, arcId });
    }

    async addCharacterArc(timelineId: string, arc: CharacterArcMarker): Promise<StoryTimelineDocument> {
        return this.executeWithLogging('addCharacterArc', async () => {
            const timeline = await StoryTimeline.findById(timelineId);
            if (!timeline) {
                throw new NotFoundError('Timeline', timelineId);
            }

            const arcData = {
                ...arc,
                id: arc.id || `char_arc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                color: arc.color || '#8854d0',
                emotionalState: arc.emotionalState || { before: '', after: '' },
                relationships: arc.relationships || []
            };

            // Add character arc to timeline
            timeline.characterArcs.push(arcData);
            await timeline.save();
            return timeline;
        }, { timelineId, characterId: arc.characterId });
    }

    async updateCharacterArc(timelineId: string, arcId: string, updates: Partial<CharacterArcMarker>): Promise<StoryTimelineDocument> {
        return this.executeWithLogging('updateCharacterArc', async () => {
            const timeline = await StoryTimeline.findById(timelineId);
            if (!timeline) {
                throw new NotFoundError('Timeline', timelineId);
            }

            const arcIndex = timeline.characterArcs.findIndex(a => a.id === arcId);
            if (arcIndex === -1) {
                throw new NotFoundError('Character Arc', arcId);
            }

            Object.assign(timeline.characterArcs[arcIndex], updates);
            timeline.metadata.lastCalculated = new Date();

            try {
                const updatedTimeline = await timeline.save();
                return updatedTimeline;
            } catch (error) {
                throw new DatabaseError(`Failed to update character arc: ${(error as Error).message}`);
            }
        }, { timelineId, arcId });
    }

    async removeCharacterArc(timelineId: string, arcId: string): Promise<StoryTimelineDocument> {
        return this.executeWithLogging('removeCharacterArc', async () => {
            const timeline = await StoryTimeline.findById(timelineId);
            if (!timeline) {
                throw new NotFoundError('Timeline', timelineId);
            }

            // Remove character arc from timeline
            const filteredCharArcs = timeline.characterArcs.filter(a => a.id !== arcId);
            timeline.characterArcs = filteredCharArcs as any;
            await timeline.save();
            timeline.metadata.totalCharacterArcs = timeline.characterArcs.length;
            timeline.metadata.lastCalculated = new Date();

            try {
                const updatedTimeline = await timeline.save();
                return updatedTimeline;
            } catch (error) {
                throw new DatabaseError(`Failed to remove character arc: ${(error as Error).message}`);
            }
        }, { timelineId, arcId });
    }

    async analyzeTimeline(timelineId: string): Promise<TimelineAnalysis> {
        return this.executeWithLogging('analyzeTimeline', async () => {
            const timeline = await StoryTimeline.findById(timelineId);
            if (!timeline) {
                throw new NotFoundError('Timeline', timelineId);
            }

            // This is a comprehensive analysis - would be more sophisticated in real implementation
            const analysis: TimelineAnalysis = {
                totalEvents: timeline.events.length,
                totalPlotArcs: timeline.plotArcs.length,
                totalCharacterArcs: timeline.characterArcs.length,
                tensionCurve: this.calculateTensionCurve(timeline),
                pacingAnalysis: this.analyzePacing(timeline),
                characterInvolvement: this.analyzeCharacterInvolvement(timeline),
                plotArcBalance: this.analyzePlotArcBalance(timeline),
                timelineConsistency: this.analyzeConsistency(timeline)
            };

            return analysis;
        }, { timelineId });
    }

    async generateTimelineFromContent(bookId: string): Promise<StoryTimelineDocument> {
        return this.executeWithLogging('generateTimelineFromContent', async () => {
            // This would analyze existing book content and automatically generate timeline events
            // For now, creating a basic timeline structure

            const book = await Book.findById(bookId);
            if (!book) {
                throw new NotFoundError('Book', bookId);
            }

            const chapters = await Chapter.find({ bookId }).sort({ chapterNumber: 1 });

            const request: CreateTimelineRequest = {
                bookId,
                name: `${book.title} Timeline`,
                description: 'Auto-generated timeline from book content'
            };

            const timeline = await this.createTimeline(request);

            // Add chapter milestones
            for (let i = 0; i < chapters.length; i++) {
                const chapter = chapters[i];
                const position = (i / Math.max(chapters.length - 1, 1)) * 100;

                await this.addEvent(timeline._id, {
                    type: 'milestone',
                    title: chapter.title,
                    description: chapter.description || '',
                    chapterId: chapter._id,
                    position,
                    importance: 'medium',
                    tags: ['chapter', 'milestone']
                });
            }

            return timeline;
        }, { bookId });
    }

    async exportTimeline(timelineId: string, format: 'json' | 'csv' | 'markdown'): Promise<string> {
        return this.executeWithLogging('exportTimeline', async () => {
            const timeline = await StoryTimeline.findById(timelineId);
            if (!timeline) {
                throw new NotFoundError('Timeline', timelineId);
            }

            switch (format) {
                case 'json':
                    return JSON.stringify(timeline.toObject(), null, 2);

                case 'csv':
                    return this.exportTimelineAsCsv(timeline);

                case 'markdown':
                    return this.exportTimelineAsMarkdown(timeline);

                default:
                    throw new ValidationError(`Unsupported export format: ${format}`, []);
            }
        }, { timelineId, format });
    }

    // Helper methods
    private validateCreateTimelineRequest(request: CreateTimelineRequest): void {
        if (!request.bookId) {
            throw new ValidationError('Book ID is required', []);
        }
        if (request.name && request.name.length > 100) {
            throw new ValidationError('Timeline name must be 100 characters or less', []);
        }
        if (request.description && request.description.length > 500) {
            throw new ValidationError('Timeline description must be 500 characters or less', []);
        }
    }

    private getDefaultEventColor(type: string): string {
        const colors = {
            plot_point: '#4b7bec',
            character_event: '#20bf6b',
            world_event: '#fa8231',
            conflict: '#fc5c65',
            resolution: '#26de81',
            milestone: '#fed330'
        };
        return colors[type as keyof typeof colors] || '#4b7bec';
    }

    private getDefaultEventIcon(type: string): string {
        const icons = {
            plot_point: 'star',
            character_event: 'user',
            world_event: 'globe',
            conflict: 'zap',
            resolution: 'check',
            milestone: 'flag'
        };
        return icons[type as keyof typeof icons] || 'circle';
    }

    private getDefaultArcColor(type: string): string {
        const colors = {
            main: '#4b7bec',
            subplot: '#20bf6b',
            character_arc: '#8854d0',
            relationship_arc: '#fc5c65',
            mystery: '#2d3436',
            romance: '#e84393'
        };
        return colors[type as keyof typeof colors] || '#4b7bec';
    }

    private calculateTensionCurve(timeline: any): Array<{ position: number; tension: number }> {
        // Simplified tension calculation
        const curve: Array<{ position: number; tension: number }> = [];

        for (let position = 0; position <= 100; position += 5) {
            let tension = 1; // Base tension

            // Find nearby events and arcs to influence tension
            timeline.events.forEach((event: any) => {
                const distance = Math.abs(event.position - position);
                if (distance <= 10) {
                    const influence = (10 - distance) / 10;
                    if (event.type === 'conflict') tension += influence * 3;
                    else if (event.type === 'resolution') tension += influence * 2;
                    else tension += influence;
                }
            });

            timeline.plotArcs.forEach((arc: any) => {
                if (position >= arc.startPosition && position <= arc.endPosition) {
                    const arcProgress = (position - arc.startPosition) / (arc.endPosition - arc.startPosition);
                    const arcTension = this.interpolateTension(arcProgress, arc.tension);
                    tension = Math.max(tension, arcTension);
                }
            });

            curve.push({ position, tension: Math.min(tension, 10) });
        }

        return curve;
    }

    private interpolateTension(progress: number, tension: any): number {
        if (progress <= 0.5) {
            // From start to peak
            return tension.start + (tension.peak - tension.start) * (progress * 2);
        } else {
            // From peak to end
            return tension.peak + (tension.end - tension.peak) * ((progress - 0.5) * 2);
        }
    }

    private analyzePacing(timeline: any): any {
        const chapters = timeline.events.filter((e: any) => e.chapterId).length;
        const averageEventsPerChapter = chapters > 0 ? timeline.events.length / chapters : 0;

        const tensionCurve = this.calculateTensionCurve(timeline);
        const highTensionPoints = tensionCurve.filter(p => p.tension >= 7).map(p => p.position);
        const lowTensionPoints = tensionCurve.filter(p => p.tension <= 3).map(p => p.position);

        const recommendations = [];
        if (averageEventsPerChapter < 2) {
            recommendations.push('Consider adding more events per chapter to maintain reader engagement');
        }
        if (highTensionPoints.length < 3) {
            recommendations.push('Story may benefit from more high-tension moments');
        }

        return {
            averageEventsPerChapter,
            highTensionPoints,
            lowTensionPoints,
            recommendations
        };
    }

    private analyzeCharacterInvolvement(timeline: any): any {
        const characterMap = new Map();

        timeline.events.forEach((event: any) => {
            event.participants?.forEach((participant: any) => {
                if (!characterMap.has(participant.characterId)) {
                    characterMap.set(participant.characterId, {
                        characterId: participant.characterId,
                        characterName: participant.characterId, // Would lookup actual name
                        eventCount: 0,
                        firstAppearance: 100,
                        lastAppearance: 0,
                        arcCompleteness: 0
                    });
                }

                const char = characterMap.get(participant.characterId);
                char.eventCount++;
                char.firstAppearance = Math.min(char.firstAppearance, event.position);
                char.lastAppearance = Math.max(char.lastAppearance, event.position);
            });
        });

        return Array.from(characterMap.values());
    }

    private analyzePlotArcBalance(timeline: any): any {
        const mainArcs = timeline.plotArcs.filter((arc: any) => arc.type === 'main');
        const subplots = timeline.plotArcs.filter((arc: any) => arc.type === 'subplot');

        const mainArcCoverage = mainArcs.length > 0 ?
            Math.max(...mainArcs.map((arc: any) => arc.endPosition - arc.startPosition)) : 0;

        const arcOverlaps: any[] = [];
        for (let i = 0; i < timeline.plotArcs.length; i++) {
            for (let j = i + 1; j < timeline.plotArcs.length; j++) {
                const arc1 = timeline.plotArcs[i];
                const arc2 = timeline.plotArcs[j];
                const overlap = this.calculateArcOverlap(arc1, arc2);
                if (overlap > 0) {
                    arcOverlaps.push({
                        arc1: arc1.name,
                        arc2: arc2.name,
                        overlapPercentage: overlap
                    });
                }
            }
        }

        return {
            mainArcCoverage,
            subplotCount: subplots.length,
            arcOverlaps
        };
    }

    private calculateArcOverlap(arc1: any, arc2: any): number {
        const start = Math.max(arc1.startPosition, arc2.startPosition);
        const end = Math.min(arc1.endPosition, arc2.endPosition);

        if (start >= end) return 0;

        const overlapLength = end - start;
        const totalLength = Math.max(arc1.endPosition, arc2.endPosition) - Math.min(arc1.startPosition, arc2.startPosition);

        return (overlapLength / totalLength) * 100;
    }

    private analyzeConsistency(timeline: any): any {
        const issues: any[] = [];
        let score = 100;

        // Check for chronological issues
        const sortedEvents = timeline.events.slice().sort((a: any, b: any) => a.position - b.position);
        for (let i = 1; i < sortedEvents.length; i++) {
            if (sortedEvents[i].position === sortedEvents[i - 1].position) {
                issues.push({
                    type: 'chronology',
                    description: `Multiple events at position ${sortedEvents[i].position}`,
                    severity: 'medium',
                    suggestions: ['Adjust event positions to avoid overlaps']
                });
                score -= 5;
            }
        }

        // Check for character presence consistency
        const characterEvents = new Map();
        timeline.events.forEach((event: any) => {
            event.participants?.forEach((participant: any) => {
                if (!characterEvents.has(participant.characterId)) {
                    characterEvents.set(participant.characterId, []);
                }
                characterEvents.get(participant.characterId).push(event.position);
            });
        });

        characterEvents.forEach((positions: number[], characterId: string) => {
            positions.sort((a, b) => a - b);
            for (let i = 1; i < positions.length; i++) {
                if (positions[i] - positions[i - 1] > 30) {
                    issues.push({
                        type: 'character_presence',
                        description: `Character ${characterId} has large gap in appearances`,
                        severity: 'low',
                        suggestions: ['Consider adding connecting events or explanations']
                    });
                    score -= 2;
                }
            }
        });

        return {
            score: Math.max(score, 0),
            issues
        };
    }

    private exportTimelineAsCsv(timeline: any): string {
        const headers = ['Type', 'Title', 'Description', 'Position', 'Chapter', 'Importance', 'Tags'];
        const rows = [headers.join(',')];

        timeline.events.forEach((event: any) => {
            const row = [
                event.type,
                `"${event.title}"`,
                `"${event.description || ''}"`,
                event.position,
                event.chapterId || '',
                event.importance,
                `"${event.tags?.join(';') || ''}"`
            ];
            rows.push(row.join(','));
        });

        return rows.join('\n');
    }

    private exportTimelineAsMarkdown(timeline: any): string {
        let markdown = `# ${timeline.name}\n\n`;

        if (timeline.description) {
            markdown += `${timeline.description}\n\n`;
        }

        markdown += '## Events\n\n';

        const sortedEvents = timeline.events.slice().sort((a: any, b: any) => a.position - b.position);

        sortedEvents.forEach((event: any) => {
            markdown += `### ${event.title} (${event.position}%)\n\n`;
            markdown += `**Type:** ${event.type}\n\n`;
            if (event.description) {
                markdown += `${event.description}\n\n`;
            }
            if (event.participants && event.participants.length > 0) {
                markdown += `**Participants:** ${event.participants.map((p: any) => p.characterId).join(', ')}\n\n`;
            }
            markdown += '---\n\n';
        });

        if (timeline.plotArcs.length > 0) {
            markdown += '## Plot Arcs\n\n';
            timeline.plotArcs.forEach((arc: any) => {
                markdown += `### ${arc.name}\n\n`;
                markdown += `**Type:** ${arc.type}\n\n`;
                markdown += `**Duration:** ${arc.startPosition}% - ${arc.endPosition}%\n\n`;
                if (arc.description) {
                    markdown += `${arc.description}\n\n`;
                }
                markdown += '---\n\n';
            });
        }

        return markdown;
    }
}
