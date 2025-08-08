/**
 * Content Organization Service - Advanced content structuring and organization
 */

import { BaseService, ServiceHealth, ServiceHealthStatus } from '../core/BaseService.js';
import { ILogger } from '../core/Logger.js';

export interface ContentOutline {
    id: string;
    title: string;
    level: number; // 1 = chapter, 2 = section, 3 = subsection
    description?: string;
    estimatedWordCount?: number;
    children: ContentOutline[];
    order: number;
    status: 'planned' | 'in_progress' | 'completed';
    notes?: string;
}

export interface ContentTemplate {
    id: string;
    name: string;
    description: string;
    structure: ContentOutline[];
    category: 'fiction' | 'non-fiction' | 'academic' | 'technical';
    targetWordCount: number;
}

export interface ReorganizationSuggestion {
    type: 'move_section' | 'split_chapter' | 'merge_sections' | 'reorder_content';
    description: string;
    impact: 'high' | 'medium' | 'low';
    confidence: number;
    currentStructure: any;
    suggestedStructure: any;
    reasoning: string;
}

export class ContentOrganizationService extends BaseService {
    private outlines = new Map<string, ContentOutline[]>();
    private templates = new Map<string, ContentTemplate>();

    constructor(logger: ILogger) {
        super(logger);
        this.initializeTemplates();
    }

    protected async onInitialize(): Promise<void> {
        this.logger.info('ContentOrganizationService initialized');
    }

    protected async onDispose(): Promise<void> {
        this.logger.info('ContentOrganizationService disposed');
    }

    protected async performHealthCheck(): Promise<ServiceHealth> {
        return {
            status: ServiceHealthStatus.HEALTHY,
            message: 'Content organization service operational',
            details: {
                outlinesCount: this.outlines.size,
                templatesCount: this.templates.size,
            },
            lastCheck: new Date(),
        };
    }

    async createOutline(bookId: string, title: string, structure: ContentOutline[]): Promise<void> {
        return this.executeWithLogging('createOutline', async () => {
            this.outlines.set(bookId, structure);

            this.logger.info('Outline created', {
                bookId,
                title,
                sectionsCount: structure.length,
            });
        }, { bookId, title });
    }

    async getOutline(bookId: string): Promise<ContentOutline[]> {
        return this.executeWithLogging('getOutline', async () => {
            return this.outlines.get(bookId) || [];
        }, { bookId });
    }

    async generateOutlineFromTemplate(templateId: string, customizations?: Partial<ContentTemplate>): Promise<ContentOutline[]> {
        return this.executeWithLogging('generateOutlineFromTemplate', async () => {
            const template = this.templates.get(templateId);
            if (!template) {
                throw new Error(`Template ${templateId} not found`);
            }

            let outline = JSON.parse(JSON.stringify(template.structure));

            if (customizations) {
                // Apply customizations
                if (customizations.targetWordCount) {
                    outline = this.adjustWordCounts(outline, customizations.targetWordCount);
                }
            }

            return outline;
        }, { templateId });
    }

    async analyzeStructure(bookId: string): Promise<ReorganizationSuggestion[]> {
        return this.executeWithLogging('analyzeStructure', async () => {
            const outline = this.outlines.get(bookId) || [];
            const suggestions: ReorganizationSuggestion[] = [];

            // Mock analysis - real implementation would analyze content flow, length, etc.
            const totalSections = this.countSections(outline);

            if (totalSections > 20) {
                suggestions.push({
                    type: 'split_chapter',
                    description: 'Consider splitting large chapters into smaller, more focused sections',
                    impact: 'medium',
                    confidence: 0.7,
                    currentStructure: outline,
                    suggestedStructure: outline, // Would be modified
                    reasoning: 'Large chapters can overwhelm readers and make navigation difficult',
                });
            }

            return suggestions;
        }, { bookId });
    }

    async getTemplates(category?: string): Promise<ContentTemplate[]> {
        return this.executeWithLogging('getTemplates', async () => {
            const allTemplates = Array.from(this.templates.values());

            if (category) {
                return allTemplates.filter(template => template.category === category);
            }

            return allTemplates;
        }, { category });
    }

    async reorderContent(bookId: string, newOrder: Array<{ id: string; newPosition: number }>): Promise<void> {
        return this.executeWithLogging('reorderContent', async () => {
            const outline = this.outlines.get(bookId) || [];

            // Apply reordering logic
            newOrder.forEach(({ id, newPosition }) => {
                const item = this.findOutlineItem(outline, id);
                if (item) {
                    item.order = newPosition;
                }
            });

            // Sort by new order
            this.sortOutlineByOrder(outline);

            this.outlines.set(bookId, outline);

            this.logger.info('Content reordered', {
                bookId,
                changesCount: newOrder.length,
            });
        }, { bookId, changesCount: newOrder.length });
    }

    private initializeTemplates(): void {
        // Fiction novel template
        this.templates.set('fiction-novel', {
            id: 'fiction-novel',
            name: 'Fiction Novel',
            description: 'Standard three-act structure for fiction novels',
            category: 'fiction',
            targetWordCount: 80000,
            structure: [
                {
                    id: 'act1',
                    title: 'Act I - Setup',
                    level: 1,
                    description: 'Introduction, inciting incident, first plot point',
                    estimatedWordCount: 20000,
                    children: [
                        {
                            id: 'opening',
                            title: 'Opening Hook',
                            level: 2,
                            estimatedWordCount: 2000,
                            children: [],
                            order: 1,
                            status: 'planned',
                        },
                        {
                            id: 'inciting-incident',
                            title: 'Inciting Incident',
                            level: 2,
                            estimatedWordCount: 5000,
                            children: [],
                            order: 2,
                            status: 'planned',
                        },
                    ],
                    order: 1,
                    status: 'planned',
                },
                {
                    id: 'act2',
                    title: 'Act II - Confrontation',
                    level: 1,
                    description: 'Rising action, midpoint, second plot point',
                    estimatedWordCount: 40000,
                    children: [],
                    order: 2,
                    status: 'planned',
                },
                {
                    id: 'act3',
                    title: 'Act III - Resolution',
                    level: 1,
                    description: 'Climax, falling action, denouement',
                    estimatedWordCount: 20000,
                    children: [],
                    order: 3,
                    status: 'planned',
                },
            ],
        });

        // Non-fiction book template
        this.templates.set('non-fiction-guide', {
            id: 'non-fiction-guide',
            name: 'Non-Fiction Guide',
            description: 'Structured approach for educational non-fiction',
            category: 'non-fiction',
            targetWordCount: 60000,
            structure: [
                {
                    id: 'introduction',
                    title: 'Introduction',
                    level: 1,
                    description: 'Overview and objectives',
                    estimatedWordCount: 5000,
                    children: [],
                    order: 1,
                    status: 'planned',
                },
                {
                    id: 'fundamentals',
                    title: 'Fundamentals',
                    level: 1,
                    description: 'Core concepts and principles',
                    estimatedWordCount: 15000,
                    children: [],
                    order: 2,
                    status: 'planned',
                },
                {
                    id: 'advanced-topics',
                    title: 'Advanced Topics',
                    level: 1,
                    description: 'Complex concepts and applications',
                    estimatedWordCount: 25000,
                    children: [],
                    order: 3,
                    status: 'planned',
                },
                {
                    id: 'practical-application',
                    title: 'Practical Application',
                    level: 1,
                    description: 'Real-world examples and exercises',
                    estimatedWordCount: 10000,
                    children: [],
                    order: 4,
                    status: 'planned',
                },
                {
                    id: 'conclusion',
                    title: 'Conclusion',
                    level: 1,
                    description: 'Summary and next steps',
                    estimatedWordCount: 5000,
                    children: [],
                    order: 5,
                    status: 'planned',
                },
            ],
        });
    }

    private adjustWordCounts(outline: ContentOutline[], targetWordCount: number): ContentOutline[] {
        const totalEstimated = this.calculateTotalWordCount(outline);
        const ratio = targetWordCount / totalEstimated;

        return outline.map(section => {
            const adjusted: ContentOutline = {
                ...section,
                children: this.adjustWordCounts(section.children, targetWordCount * 0.1), // Adjust children proportionally
            };

            if (section.estimatedWordCount) {
                adjusted.estimatedWordCount = Math.round(section.estimatedWordCount * ratio);
            }

            return adjusted;
        });
    }

    private calculateTotalWordCount(outline: ContentOutline[]): number {
        return outline.reduce((total, section) => {
            const sectionCount = section.estimatedWordCount || 0;
            const childrenCount = this.calculateTotalWordCount(section.children);
            return total + sectionCount + childrenCount;
        }, 0);
    }

    private countSections(outline: ContentOutline[]): number {
        return outline.reduce((count, section) => {
            return count + 1 + this.countSections(section.children);
        }, 0);
    }

    private findOutlineItem(outline: ContentOutline[], id: string): ContentOutline | null {
        for (const item of outline) {
            if (item.id === id) {
                return item;
            }
            const found = this.findOutlineItem(item.children, id);
            if (found) {
                return found;
            }
        }
        return null;
    }

    private sortOutlineByOrder(outline: ContentOutline[]): void {
        outline.sort((a, b) => a.order - b.order);
        outline.forEach(item => this.sortOutlineByOrder(item.children));
    }
}

export default ContentOrganizationService;
