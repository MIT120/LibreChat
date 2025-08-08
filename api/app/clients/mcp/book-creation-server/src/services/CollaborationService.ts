/**
 * Collaboration Service - Real-time collaboration features for book writing
 */

import { BaseService, ServiceHealth, ServiceHealthStatus } from '../core/BaseService.js';
import { ILogger } from '../core/Logger.js';

export interface Collaborator {
    id: string;
    name: string;
    email: string;
    role: 'owner' | 'editor' | 'reviewer' | 'viewer';
    joinedAt: Date;
    lastActive: Date;
    permissions: {
        canEdit: boolean;
        canComment: boolean;
        canApprove: boolean;
        canInvite: boolean;
    };
}

export interface CollaborationSession {
    id: string;
    bookId: string;
    chapterId?: string;
    pageId?: string;
    collaborators: Collaborator[];
    activeUsers: string[];
    createdAt: Date;
    lastActivity: Date;
}

export interface Comment {
    id: string;
    contentId: string; // bookId, chapterId, or pageId
    contentType: 'book' | 'chapter' | 'page';
    authorId: string;
    authorName: string;
    text: string;
    position?: {
        start: number;
        end: number;
        selectedText: string;
    };
    replies: CommentReply[];
    resolved: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface CommentReply {
    id: string;
    authorId: string;
    authorName: string;
    text: string;
    createdAt: Date;
}

export interface ChangeRecord {
    id: string;
    contentId: string;
    contentType: 'book' | 'chapter' | 'page';
    changeType: 'create' | 'update' | 'delete';
    authorId: string;
    authorName: string;
    before: any;
    after: any;
    timestamp: Date;
    approved: boolean;
    approvedBy?: string;
    approvedAt?: Date;
}

export interface CollaborationInvite {
    id: string;
    bookId: string;
    invitedBy: string;
    invitedEmail: string;
    role: 'editor' | 'reviewer' | 'viewer';
    status: 'pending' | 'accepted' | 'declined' | 'expired';
    createdAt: Date;
    expiresAt: Date;
    token: string;
}

export interface ConflictResolution {
    contentId: string;
    contentType: 'book' | 'chapter' | 'page';
    conflictType: 'concurrent_edit' | 'version_mismatch';
    baseVersion: any;
    version1: any;
    version2: any;
    author1: string;
    author2: string;
    resolvedVersion?: any;
    resolvedBy?: string;
    resolvedAt?: Date;
    status: 'pending' | 'resolved' | 'escalated';
}

export class CollaborationService extends BaseService {
    private activeSessions = new Map<string, CollaborationSession>();
    private comments = new Map<string, Comment[]>();
    private changeHistory = new Map<string, ChangeRecord[]>();
    private pendingInvites = new Map<string, CollaborationInvite>();
    private conflicts = new Map<string, ConflictResolution>();

    constructor(logger: ILogger) {
        super(logger);
    }

    protected async onInitialize(): Promise<void> {
        this.logger.info('CollaborationService initialized');
    }

    protected async onDispose(): Promise<void> {
        this.logger.info('CollaborationService disposed');
    }

    protected async performHealthCheck(): Promise<ServiceHealth> {
        return {
            status: ServiceHealthStatus.HEALTHY,
            message: 'Collaboration service operational',
            details: {
                activeSessions: this.activeSessions.size,
                totalComments: Array.from(this.comments.values()).reduce((sum, comments) => sum + comments.length, 0),
                pendingInvites: this.pendingInvites.size,
                pendingConflicts: Array.from(this.conflicts.values()).filter(c => c.status === 'pending').length,
            },
            lastCheck: new Date(),
        };
    }

    /**
     * Start a collaboration session for a book/chapter/page
     */
    async startSession(
        bookId: string,
        userId: string,
        chapterId?: string,
        pageId?: string
    ): Promise<CollaborationSession> {
        return this.executeWithLogging('startSession', async () => {
            const sessionId = `${bookId}-${chapterId || 'book'}-${pageId || 'chapter'}`;

            let session = this.activeSessions.get(sessionId);
            if (!session) {
                session = {
                    id: sessionId,
                    bookId,
                    ...(chapterId && { chapterId }),
                    ...(pageId && { pageId }),
                    collaborators: [],
                    activeUsers: [],
                    createdAt: new Date(),
                    lastActivity: new Date(),
                };
                this.activeSessions.set(sessionId, session);
            }

            // Add user to active users if not already present
            if (!session.activeUsers.includes(userId)) {
                session.activeUsers.push(userId);
            }

            session.lastActivity = new Date();

            this.logger.info('Collaboration session started/joined', {
                sessionId,
                userId,
                activeUsers: session.activeUsers.length,
            });

            return session;
        }, { bookId, userId, chapterId, pageId });
    }

    /**
     * End a collaboration session for a user
     */
    async endSession(sessionId: string, userId: string): Promise<void> {
        return this.executeWithLogging('endSession', async () => {
            const session = this.activeSessions.get(sessionId);
            if (session) {
                session.activeUsers = session.activeUsers.filter(id => id !== userId);
                session.lastActivity = new Date();

                // Clean up empty sessions
                if (session.activeUsers.length === 0) {
                    this.activeSessions.delete(sessionId);
                }

                this.logger.info('User left collaboration session', {
                    sessionId,
                    userId,
                    remainingUsers: session.activeUsers.length,
                });
            }
        }, { sessionId, userId });
    }

    /**
     * Add a comment to content
     */
    async addComment(comment: Omit<Comment, 'id' | 'replies' | 'resolved' | 'createdAt' | 'updatedAt'>): Promise<Comment> {
        return this.executeWithLogging('addComment', async () => {
            const newComment: Comment = {
                ...comment,
                id: `comment-${Date.now()}-${Math.random()}`,
                replies: [],
                resolved: false,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const contentComments = this.comments.get(comment.contentId) || [];
            contentComments.push(newComment);
            this.comments.set(comment.contentId, contentComments);

            this.logger.info('Comment added', {
                commentId: newComment.id,
                contentId: comment.contentId,
                contentType: comment.contentType,
                authorId: comment.authorId,
            });

            return newComment;
        }, { contentId: comment.contentId, authorId: comment.authorId });
    }

    /**
     * Reply to a comment
     */
    async replyToComment(
        commentId: string,
        reply: Omit<CommentReply, 'id' | 'createdAt'>
    ): Promise<CommentReply> {
        return this.executeWithLogging('replyToComment', async () => {
            const newReply: CommentReply = {
                ...reply,
                id: `reply-${Date.now()}-${Math.random()}`,
                createdAt: new Date(),
            };

            // Find the comment across all content
            for (const [contentId, comments] of this.comments.entries()) {
                const comment = comments.find(c => c.id === commentId);
                if (comment) {
                    comment.replies.push(newReply);
                    comment.updatedAt = new Date();

                    this.logger.info('Reply added to comment', {
                        commentId,
                        replyId: newReply.id,
                        authorId: reply.authorId,
                    });

                    return newReply;
                }
            }

            throw new Error(`Comment ${commentId} not found`);
        }, { commentId, authorId: reply.authorId });
    }

    /**
     * Resolve a comment
     */
    async resolveComment(commentId: string, resolvedBy: string): Promise<void> {
        return this.executeWithLogging('resolveComment', async () => {
            for (const [contentId, comments] of this.comments.entries()) {
                const comment = comments.find(c => c.id === commentId);
                if (comment) {
                    comment.resolved = true;
                    comment.updatedAt = new Date();

                    this.logger.info('Comment resolved', {
                        commentId,
                        resolvedBy,
                    });

                    return;
                }
            }

            throw new Error(`Comment ${commentId} not found`);
        }, { commentId, resolvedBy });
    }

    /**
     * Get comments for content
     */
    async getComments(contentId: string, includeResolved = false): Promise<Comment[]> {
        return this.executeWithLogging('getComments', async () => {
            const comments = this.comments.get(contentId) || [];

            if (includeResolved) {
                return comments;
            }

            return comments.filter(comment => !comment.resolved);
        }, { contentId, includeResolved });
    }

    /**
     * Record a change for approval workflow
     */
    async recordChange(change: Omit<ChangeRecord, 'id' | 'timestamp' | 'approved'>): Promise<ChangeRecord> {
        return this.executeWithLogging('recordChange', async () => {
            const newChange: ChangeRecord = {
                ...change,
                id: `change-${Date.now()}-${Math.random()}`,
                timestamp: new Date(),
                approved: false,
            };

            const contentChanges = this.changeHistory.get(change.contentId) || [];
            contentChanges.push(newChange);
            this.changeHistory.set(change.contentId, contentChanges);

            this.logger.info('Change recorded', {
                changeId: newChange.id,
                contentId: change.contentId,
                changeType: change.changeType,
                authorId: change.authorId,
            });

            return newChange;
        }, { contentId: change.contentId, changeType: change.changeType });
    }

    /**
     * Approve a change
     */
    async approveChange(changeId: string, approvedBy: string): Promise<void> {
        return this.executeWithLogging('approveChange', async () => {
            for (const [contentId, changes] of this.changeHistory.entries()) {
                const change = changes.find(c => c.id === changeId);
                if (change) {
                    change.approved = true;
                    change.approvedBy = approvedBy;
                    change.approvedAt = new Date();

                    this.logger.info('Change approved', {
                        changeId,
                        approvedBy,
                    });

                    return;
                }
            }

            throw new Error(`Change ${changeId} not found`);
        }, { changeId, approvedBy });
    }

    /**
     * Get change history for content
     */
    async getChangeHistory(contentId: string, limit = 50): Promise<ChangeRecord[]> {
        return this.executeWithLogging('getChangeHistory', async () => {
            const changes = this.changeHistory.get(contentId) || [];
            return changes
                .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                .slice(0, limit);
        }, { contentId, limit });
    }

    /**
     * Send collaboration invite
     */
    async sendInvite(
        bookId: string,
        invitedBy: string,
        invitedEmail: string,
        role: 'editor' | 'reviewer' | 'viewer'
    ): Promise<CollaborationInvite> {
        return this.executeWithLogging('sendInvite', async () => {
            const invite: CollaborationInvite = {
                id: `invite-${Date.now()}-${Math.random()}`,
                bookId,
                invitedBy,
                invitedEmail,
                role,
                status: 'pending',
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                token: `token-${Date.now()}-${Math.random()}`,
            };

            this.pendingInvites.set(invite.id, invite);

            this.logger.info('Collaboration invite sent', {
                inviteId: invite.id,
                bookId,
                invitedEmail,
                role,
            });

            return invite;
        }, { bookId, invitedEmail, role });
    }

    /**
     * Accept collaboration invite
     */
    async acceptInvite(inviteId: string, userId: string): Promise<Collaborator> {
        return this.executeWithLogging('acceptInvite', async () => {
            const invite = this.pendingInvites.get(inviteId);
            if (!invite) {
                throw new Error('Invite not found');
            }

            if (invite.status !== 'pending') {
                throw new Error('Invite already processed');
            }

            if (invite.expiresAt < new Date()) {
                invite.status = 'expired';
                throw new Error('Invite has expired');
            }

            invite.status = 'accepted';

            const collaborator: Collaborator = {
                id: userId,
                name: 'User Name', // Would be fetched from user service
                email: invite.invitedEmail,
                role: invite.role,
                joinedAt: new Date(),
                lastActive: new Date(),
                permissions: this.getPermissionsForRole(invite.role),
            };

            this.logger.info('Collaboration invite accepted', {
                inviteId,
                userId,
                bookId: invite.bookId,
                role: invite.role,
            });

            return collaborator;
        }, { inviteId, userId });
    }

    /**
     * Detect and handle conflicts
     */
    async detectConflict(
        contentId: string,
        contentType: 'book' | 'chapter' | 'page',
        version1: any,
        version2: any,
        author1: string,
        author2: string
    ): Promise<ConflictResolution> {
        return this.executeWithLogging('detectConflict', async () => {
            const conflict: ConflictResolution = {
                contentId,
                contentType,
                conflictType: 'concurrent_edit',
                baseVersion: null, // Would be retrieved from version history
                version1,
                version2,
                author1,
                author2,
                status: 'pending',
            };

            this.conflicts.set(`${contentId}-${Date.now()}`, conflict);

            this.logger.warn('Conflict detected', {
                contentId,
                contentType,
                author1,
                author2,
            });

            return conflict;
        }, { contentId, contentType, author1, author2 });
    }

    /**
     * Get active sessions for a book
     */
    async getActiveSessions(bookId: string): Promise<CollaborationSession[]> {
        return this.executeWithLogging('getActiveSessions', async () => {
            const sessions = Array.from(this.activeSessions.values())
                .filter(session => session.bookId === bookId);

            return sessions;
        }, { bookId });
    }

    /**
     * Get real-time collaboration statistics
     */
    async getCollaborationStats(bookId: string): Promise<any> {
        return this.executeWithLogging('getCollaborationStats', async () => {
            const sessions = await this.getActiveSessions(bookId);
            const totalActiveUsers = sessions.reduce((sum, session) => sum + session.activeUsers.length, 0);

            const allComments = Array.from(this.comments.entries())
                .filter(([contentId]) => contentId.startsWith(bookId))
                .flatMap(([, comments]) => comments);

            const unresolvedComments = allComments.filter(comment => !comment.resolved);

            const allChanges = Array.from(this.changeHistory.entries())
                .filter(([contentId]) => contentId.startsWith(bookId))
                .flatMap(([, changes]) => changes);

            const pendingApprovals = allChanges.filter(change => !change.approved);

            return {
                activeSessions: sessions.length,
                activeUsers: totalActiveUsers,
                totalComments: allComments.length,
                unresolvedComments: unresolvedComments.length,
                totalChanges: allChanges.length,
                pendingApprovals: pendingApprovals.length,
                recentActivity: allChanges
                    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                    .slice(0, 10),
            };
        }, { bookId });
    }

    private getPermissionsForRole(role: string) {
        switch (role) {
            case 'owner':
                return {
                    canEdit: true,
                    canComment: true,
                    canApprove: true,
                    canInvite: true,
                };
            case 'editor':
                return {
                    canEdit: true,
                    canComment: true,
                    canApprove: false,
                    canInvite: false,
                };
            case 'reviewer':
                return {
                    canEdit: false,
                    canComment: true,
                    canApprove: true,
                    canInvite: false,
                };
            case 'viewer':
                return {
                    canEdit: false,
                    canComment: true,
                    canApprove: false,
                    canInvite: false,
                };
            default:
                return {
                    canEdit: false,
                    canComment: false,
                    canApprove: false,
                    canInvite: false,
                };
        }
    }
}

export default CollaborationService;
