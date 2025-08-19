/**
 * Workspace Service - Manages project workspaces and user preferences
 */

import { BaseService } from '../core/BaseService.js';
import { ILogger } from '../interfaces/ILogger.js';
import { Document } from 'mongoose';

// Type definition for ProjectWorkspace document
type ProjectWorkspaceDocument = any;
import { ProjectWorkspace } from '../../models/ProjectWorkspace.js';
import { Book } from '../../models/Book.js';
import { DatabaseError, NotFoundError, ValidationError } from '../../types/errors.js';
import { v4 as uuidv4 } from 'uuid';

// Service interfaces
export interface CreateWorkspaceRequest {
    name: string;
    description?: string;
    userId: string;
    writingTargets?: {
        daily?: number;
        weekly?: number;
        monthly?: number;
    };
    settings?: {
        theme?: 'light' | 'dark' | 'auto';
        defaultView?: 'timeline' | 'outline' | 'writing' | 'research' | 'planning';
    };
}

export interface UpdateWorkspaceRequest {
    name?: string;
    description?: string;
    writingTargets?: {
        daily?: number;
        weekly?: number;
        monthly?: number;
    };
    layout?: {
        sidebar?: { width?: number; collapsed?: boolean; position?: 'left' | 'right' };
        panels?: { [key: string]: boolean };
        views?: { [key: string]: any };
    };
    settings?: {
        theme?: 'light' | 'dark' | 'auto';
        defaultView?: string;
        autoSave?: boolean;
        notifications?: { [key: string]: boolean };
    };
}

export interface WorkspaceStats {
    totalWords: number;
    totalPages: number;
    totalChapters: number;
    totalBooks: number;
    longestStreak: number;
    currentStreak: number;
    lastWritingSession?: Date;
    dailyProgress: {
        today: number;
        thisWeek: number;
        thisMonth: number;
    };
    goalProgress: {
        daily: { target: number; achieved: number; percentage: number };
        weekly: { target: number; achieved: number; percentage: number };
        monthly: { target: number; achieved: number; percentage: number };
    };
}

export interface WorkspaceResponse extends Omit<ProjectWorkspaceDocument, 'toObject' | 'toJSON'> {
    stats?: WorkspaceStats;
    recentActivity?: Array<{
        type: 'book_created' | 'chapter_written' | 'goal_achieved' | 'milestone_reached';
        description: string;
        timestamp: Date;
        bookId?: string;
        chapterId?: string;
    }>;
}

export interface GetWorkspacesOptions {
    includeArchived?: boolean;
    includeStats?: boolean;
    includeRecentActivity?: boolean;
    limit?: number;
    offset?: number;
    sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'lastActivity';
    sortOrder?: 'asc' | 'desc';
}

export interface IWorkspaceService {
    createWorkspace(request: CreateWorkspaceRequest): Promise<WorkspaceResponse>;
    getWorkspace(workspaceId: string, userId: string, includeStats?: boolean): Promise<WorkspaceResponse>;
    getUserWorkspaces(userId: string, options?: GetWorkspacesOptions): Promise<WorkspaceResponse[]>;
    updateWorkspace(workspaceId: string, userId: string, updates: UpdateWorkspaceRequest): Promise<WorkspaceResponse>;
    deleteWorkspace(workspaceId: string, userId: string): Promise<void>;
    addBookToWorkspace(workspaceId: string, bookId: string, userId: string): Promise<WorkspaceResponse>;
    removeBookFromWorkspace(workspaceId: string, bookId: string, userId: string): Promise<WorkspaceResponse>;
    setActiveBook(workspaceId: string, bookId: string, userId: string): Promise<WorkspaceResponse>;
    updateWorkspaceStats(workspaceId: string): Promise<WorkspaceResponse>;
    getWorkspaceStats(workspaceId: string, userId: string): Promise<WorkspaceStats>;
}

export class WorkspaceService extends BaseService implements IWorkspaceService {
    constructor(logger: ILogger) {
        super(logger);
    }

    protected async onInitialize(): Promise<void> {
        this.logger.info('WorkspaceService initialized');
    }

    protected async onDispose(): Promise<void> {
        this.logger.info('WorkspaceService disposed');
    }

    async createWorkspace(request: CreateWorkspaceRequest): Promise<WorkspaceResponse> {
        return this.executeWithLogging('createWorkspace', async () => {
            this.validateCreateWorkspaceRequest(request);

            const workspaceId = uuidv4();
            const workspace = new ProjectWorkspace({
                _id: workspaceId,
                name: request.name,
                description: request.description,
                userId: request.userId,
                books: [],
                writingTargets: {
                    daily: request.writingTargets?.daily || 500,
                    weekly: request.writingTargets?.weekly || 3500,
                    monthly: request.writingTargets?.monthly || 15000,
                    customGoals: []
                },
                settings: {
                    theme: request.settings?.theme || 'auto',
                    language: 'en',
                    autoSave: true,
                    autoSaveInterval: 30,
                    backupEnabled: true,
                    backupFrequency: 'daily',
                    notifications: {
                        writeReminders: true,
                        goalReminders: true,
                        consistencyAlerts: true
                    },
                    privacy: {
                        shareProgress: false,
                        publicProfile: false
                    }
                },
                layout: {
                    sidebar: { width: 300, collapsed: false, position: 'left' },
                    panels: {
                        research: true,
                        outline: true,
                        characters: true,
                        timeline: true,
                        writing: true
                    },
                    views: {
                        defaultView: request.settings?.defaultView || 'writing',
                        lastView: request.settings?.defaultView || 'writing',
                        splitView: false,
                        focusMode: false
                    }
                },
                statistics: {
                    totalWords: 0,
                    totalPages: 0,
                    totalChapters: 0,
                    totalBooks: 0,
                    longestStreak: 0,
                    currentStreak: 0
                },
                collaborators: [{
                    userId: request.userId,
                    role: 'owner',
                    permissions: {
                        canEdit: true,
                        canComment: true,
                        canExport: true,
                        canInvite: true
                    },
                    invitedAt: new Date(),
                    joinedAt: new Date()
                }],
                tags: [],
                isArchived: false,
                isTemplate: false
            });

            try {
                const savedWorkspace = await workspace.save();
                return this.formatWorkspaceResponse(savedWorkspace);
            } catch (error) {
                throw new DatabaseError(`Failed to create workspace: ${(error as Error).message}`);
            }
        }, { name: request.name, userId: request.userId });
    }

    async getWorkspace(workspaceId: string, userId: string, includeStats = false): Promise<WorkspaceResponse> {
        return this.executeWithLogging('getWorkspace', async () => {
            const workspace = await ProjectWorkspace.findById(workspaceId);
            if (!workspace) {
                throw new NotFoundError('Workspace', workspaceId);
            }

            // Check if user has access
            if (!this.hasWorkspaceAccess(workspace, userId)) {
                throw new NotFoundError('Workspace', workspaceId);
            }

            const response = this.formatWorkspaceResponse(workspace);

            if (includeStats) {
                response.stats = await this.calculateWorkspaceStats(workspace);
            }

            return response;
        }, { workspaceId, userId });
    }

    async getUserWorkspaces(userId: string, options: GetWorkspacesOptions = {}): Promise<WorkspaceResponse[]> {
        return this.executeWithLogging('getUserWorkspaces', async () => {
            const query: any = {
                'collaborators.userId': userId
            };

            if (!options.includeArchived) {
                query.isArchived = { $ne: true };
            }

            let dbQuery = ProjectWorkspace.find(query);

            // Sorting
            if (options.sortBy) {
                const sortOrder = options.sortOrder === 'desc' ? -1 : 1;
                dbQuery = dbQuery.sort({ [options.sortBy]: sortOrder });
            } else {
                dbQuery = dbQuery.sort({ updatedAt: -1 });
            }

            // Pagination
            if (options.offset) {
                dbQuery = dbQuery.skip(options.offset);
            }
            if (options.limit) {
                dbQuery = dbQuery.limit(options.limit);
            }

            const workspaces = await dbQuery.exec();
            const responses: WorkspaceResponse[] = [];

            for (const workspace of workspaces) {
                const response = this.formatWorkspaceResponse(workspace);

                if (options.includeStats) {
                    response.stats = await this.calculateWorkspaceStats(workspace);
                }

                responses.push(response);
            }

            return responses;
        }, { userId, options });
    }

    async updateWorkspace(workspaceId: string, userId: string, updates: UpdateWorkspaceRequest): Promise<WorkspaceResponse> {
        return this.executeWithLogging('updateWorkspace', async () => {
            const workspace = await ProjectWorkspace.findById(workspaceId);
            if (!workspace) {
                throw new NotFoundError('Workspace', workspaceId);
            }

            if (!this.hasWorkspaceAccess(workspace, userId, 'edit')) {
                throw new ValidationError('Insufficient permissions to update workspace', []);
            }

            // Apply updates
            if (updates.name !== undefined) workspace.name = updates.name;
            if (updates.description !== undefined) workspace.description = updates.description;

            if (updates.writingTargets) {
                if (updates.writingTargets.daily !== undefined) {
                    workspace.writingTargets.daily = updates.writingTargets.daily;
                }
                if (updates.writingTargets.weekly !== undefined) {
                    workspace.writingTargets.weekly = updates.writingTargets.weekly;
                }
                if (updates.writingTargets.monthly !== undefined) {
                    workspace.writingTargets.monthly = updates.writingTargets.monthly;
                }
            }

            if (updates.layout) {
                if (updates.layout.sidebar) {
                    Object.assign(workspace.layout.sidebar, updates.layout.sidebar);
                }
                if (updates.layout.panels) {
                    Object.assign(workspace.layout.panels, updates.layout.panels);
                }
                if (updates.layout.views) {
                    Object.assign(workspace.layout.views, updates.layout.views);
                }
            }

            if (updates.settings) {
                Object.assign(workspace.settings, updates.settings);
            }

            try {
                const updatedWorkspace = await workspace.save();
                return this.formatWorkspaceResponse(updatedWorkspace);
            } catch (error) {
                throw new DatabaseError(`Failed to update workspace: ${(error as Error).message}`);
            }
        }, { workspaceId, userId });
    }

    async deleteWorkspace(workspaceId: string, userId: string): Promise<void> {
        return this.executeWithLogging('deleteWorkspace', async () => {
            const workspace = await ProjectWorkspace.findById(workspaceId);
            if (!workspace) {
                throw new NotFoundError('Workspace', workspaceId);
            }

            if (!this.hasWorkspaceAccess(workspace, userId, 'owner')) {
                throw new ValidationError('Only workspace owners can delete workspaces', []);
            }

            try {
                await ProjectWorkspace.findByIdAndDelete(workspaceId);
            } catch (error) {
                throw new DatabaseError(`Failed to delete workspace: ${(error as Error).message}`);
            }
        }, { workspaceId, userId });
    }

    async addBookToWorkspace(workspaceId: string, bookId: string, userId: string): Promise<WorkspaceResponse> {
        return this.executeWithLogging('addBookToWorkspace', async () => {
            const workspace = await ProjectWorkspace.findById(workspaceId);
            if (!workspace) {
                throw new NotFoundError('Workspace', workspaceId);
            }

            if (!this.hasWorkspaceAccess(workspace, userId, 'edit')) {
                throw new ValidationError('Insufficient permissions to add books to workspace', []);
            }

            // Verify book exists
            const book = await Book.findById(bookId);
            if (!book) {
                throw new NotFoundError('Book', bookId);
            }

            // Add book if not already in workspace
            // Add book to workspace
            if (!workspace.books.includes(bookId)) {
                workspace.books.push(bookId);
                await workspace.save();
            }

            // Set as active book if it's the first book
            if (!workspace.activeBookId) {
                workspace.activeBookId = bookId;
                await workspace.save();
            }

            return this.formatWorkspaceResponse(workspace);
        }, { workspaceId, bookId, userId });
    }

    async removeBookFromWorkspace(workspaceId: string, bookId: string, userId: string): Promise<WorkspaceResponse> {
        return this.executeWithLogging('removeBookFromWorkspace', async () => {
            const workspace = await ProjectWorkspace.findById(workspaceId);
            if (!workspace) {
                throw new NotFoundError('Workspace', workspaceId);
            }

            if (!this.hasWorkspaceAccess(workspace, userId, 'edit')) {
                throw new ValidationError('Insufficient permissions to remove books from workspace', []);
            }

            // Remove book from workspace
            const bookIndex = workspace.books.indexOf(bookId);
            if (bookIndex > -1) {
                workspace.books.splice(bookIndex, 1);
                await workspace.save();
            }
            return this.formatWorkspaceResponse(workspace);
        }, { workspaceId, bookId, userId });
    }

    async setActiveBook(workspaceId: string, bookId: string, userId: string): Promise<WorkspaceResponse> {
        return this.executeWithLogging('setActiveBook', async () => {
            const workspace = await ProjectWorkspace.findById(workspaceId);
            if (!workspace) {
                throw new NotFoundError('Workspace', workspaceId);
            }

            if (!this.hasWorkspaceAccess(workspace, userId)) {
                throw new ValidationError('Insufficient permissions to access workspace', []);
            }

            if (!workspace.books.includes(bookId)) {
                throw new ValidationError('Book not found in workspace', []);
            }

            workspace.activeBookId = bookId;
            const updatedWorkspace = await workspace.save();

            return this.formatWorkspaceResponse(updatedWorkspace);
        }, { workspaceId, bookId, userId });
    }

    async updateWorkspaceStats(workspaceId: string): Promise<WorkspaceResponse> {
        return this.executeWithLogging('updateWorkspaceStats', async () => {
            const workspace = await ProjectWorkspace.findById(workspaceId);
            if (!workspace) {
                throw new NotFoundError('Workspace', workspaceId);
            }

            const stats = await this.calculateWorkspaceStats(workspace);

            // Update workspace statistics
            workspace.statistics = {
                totalWords: stats.totalWords,
                totalPages: stats.totalPages,
                totalChapters: stats.totalChapters,
                totalBooks: stats.totalBooks,
                longestStreak: stats.longestStreak,
                currentStreak: stats.currentStreak,
                lastWritingSession: stats.lastWritingSession
            };

            const updatedWorkspace = await workspace.save();
            const response = this.formatWorkspaceResponse(updatedWorkspace);
            response.stats = stats;

            return response;
        }, { workspaceId });
    }

    async getWorkspaceStats(workspaceId: string, userId: string): Promise<WorkspaceStats> {
        return this.executeWithLogging('getWorkspaceStats', async () => {
            const workspace = await ProjectWorkspace.findById(workspaceId);
            if (!workspace) {
                throw new NotFoundError('Workspace', workspaceId);
            }

            if (!this.hasWorkspaceAccess(workspace, userId)) {
                throw new ValidationError('Insufficient permissions to access workspace', []);
            }

            return this.calculateWorkspaceStats(workspace);
        }, { workspaceId, userId });
    }

    // Helper methods
    private validateCreateWorkspaceRequest(request: CreateWorkspaceRequest): void {
        if (!request.name || request.name.trim().length === 0) {
            throw new ValidationError('Workspace name is required', []);
        }
        if (request.name.length > 100) {
            throw new ValidationError('Workspace name must be 100 characters or less', []);
        }
        if (!request.userId) {
            throw new ValidationError('User ID is required', []);
        }
        if (request.description && request.description.length > 500) {
            throw new ValidationError('Workspace description must be 500 characters or less', []);
        }
    }

    private hasWorkspaceAccess(workspace: any, userId: string, requiredRole?: string): boolean {
        const collaborator = workspace.collaborators.find((c: any) => c.userId === userId);
        if (!collaborator) return false;

        if (requiredRole === 'owner') {
            return collaborator.role === 'owner';
        }
        if (requiredRole === 'edit') {
            return ['owner', 'editor'].includes(collaborator.role) || collaborator.permissions.canEdit;
        }

        return true; // Basic access
    }

    private formatWorkspaceResponse(workspace: any): WorkspaceResponse {
        return workspace.toObject();
    }

    private async calculateWorkspaceStats(workspace: any): Promise<WorkspaceStats> {
        // This would calculate actual stats from related collections
        // For now, returning basic stats structure
        const stats: WorkspaceStats = {
            totalWords: workspace.statistics?.totalWords || 0,
            totalPages: workspace.statistics?.totalPages || 0,
            totalChapters: workspace.statistics?.totalChapters || 0,
            totalBooks: workspace.books?.length || 0,
            longestStreak: workspace.statistics?.longestStreak || 0,
            currentStreak: workspace.statistics?.currentStreak || 0,
            lastWritingSession: workspace.statistics?.lastWritingSession,
            dailyProgress: {
                today: 0, // Would calculate from WritingSession collection
                thisWeek: 0,
                thisMonth: 0
            },
            goalProgress: {
                daily: {
                    target: workspace.writingTargets?.daily || 500,
                    achieved: 0, // Would calculate from today's sessions
                    percentage: 0
                },
                weekly: {
                    target: workspace.writingTargets?.weekly || 3500,
                    achieved: 0, // Would calculate from this week's sessions
                    percentage: 0
                },
                monthly: {
                    target: workspace.writingTargets?.monthly || 15000,
                    achieved: 0, // Would calculate from this month's sessions
                    percentage: 0
                }
            }
        };

        // Calculate percentages
        stats.goalProgress.daily.percentage = Math.round((stats.dailyProgress.today / stats.goalProgress.daily.target) * 100);
        stats.goalProgress.weekly.percentage = Math.round((stats.dailyProgress.thisWeek / stats.goalProgress.weekly.target) * 100);
        stats.goalProgress.monthly.percentage = Math.round((stats.dailyProgress.thisMonth / stats.goalProgress.monthly.target) * 100);

        return stats;
    }
}
