/**
 * React hooks for revision management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
interface TextSelection {
    startOffset: number;
    endOffset: number;
    selectedText: string;
    contextBefore?: string;
    contextAfter?: string;
}

interface RevisionInstruction {
    type: 'rewrite' | 'expand' | 'condense' | 'improve_tone' | 'fix_grammar' | 'change_style' | 'add_detail' | 'custom';
    description: string;
    specificInstructions?: string;
    targetTone?: string;
    targetLength?: string;
    preserveElements?: string[];
    avoidElements?: string[];
}

interface RevisionResult {
    generatedText: string;
    confidence: number;
    alternativeVersions?: Array<{
        text: string;
        variant: string;
        confidence: number;
    }>;
    changes: Array<{
        type: 'addition' | 'deletion' | 'modification' | 'restructure';
        description: string;
        impact: 'minor' | 'moderate' | 'significant';
    }>;
}

interface RevisionRequest {
    id: string;
    bookId: string;
    chapterId?: string;
    pageId?: string;
    conversationId: string;
    messageId?: string;
    userId: string;
    selection: TextSelection;
    instruction: RevisionInstruction;
    result?: RevisionResult;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'applied';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    createdAt: Date;
    updatedAt: Date;
    notes?: string;
}

interface CreateRevisionRequest {
    bookId: string;
    chapterId?: string;
    pageId?: string;
    conversationId: string;
    messageId?: string;
    selection: TextSelection;
    instruction: RevisionInstruction;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    notes?: string;
}

interface RevisionFeedback {
    rating: number;
    feedback?: string;
    acceptedVersion: string;
    customEdits?: string;
}

interface RevisionFilters {
    bookId?: string;
    chapterId?: string;
    pageId?: string;
    conversationId?: string;
    status?: string;
    priority?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: string;
}

// API functions
const revisionApi = {
    create: async (data: CreateRevisionRequest): Promise<{ success: boolean; revisionId: string; revision: RevisionRequest; message: string }> => {
        const response = await fetch('/api/revisions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error('Failed to create revision request');
        }

        return response.json();
    },

    getById: async (revisionId: string): Promise<{ success: boolean; revision: RevisionRequest }> => {
        const response = await fetch(`/api/revisions/${revisionId}`, {
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch revision request');
        }

        return response.json();
    },

    getRevisions: async (filters: RevisionFilters = {}): Promise<{ success: boolean; revisions: RevisionRequest[]; count: number }> => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined) {
                params.append(key, value.toString());
            }
        });

        const response = await fetch(`/api/revisions?${params}`, {
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch revisions');
        }

        return response.json();
    },

    apply: async (revisionId: string, versionToApply = 'generated'): Promise<{ success: boolean; revision: RevisionRequest; message: string }> => {
        const response = await fetch(`/api/revisions/${revisionId}/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ versionToApply }),
        });

        if (!response.ok) {
            throw new Error('Failed to apply revision');
        }

        return response.json();
    },

    cancel: async (revisionId: string, reason?: string): Promise<{ success: boolean; revision: RevisionRequest; message: string }> => {
        const response = await fetch(`/api/revisions/${revisionId}/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
        });

        if (!response.ok) {
            throw new Error('Failed to cancel revision');
        }

        return response.json();
    },

    getHistory: async (pageId: string): Promise<{ success: boolean; revisions: RevisionRequest[]; count: number }> => {
        const response = await fetch(`/api/revisions/page/${pageId}/history`, {
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch revision history');
        }

        return response.json();
    },
};

// Hooks
export const useRevisions = (filters: RevisionFilters = {}) => {
    return useQuery({
        queryKey: ['revisions', filters],
        queryFn: () => revisionApi.getRevisions(filters),
        staleTime: 30000, // 30 seconds
    });
};

export const useRevision = (revisionId: string) => {
    return useQuery({
        queryKey: ['revision', revisionId],
        queryFn: () => revisionApi.getById(revisionId),
        enabled: !!revisionId,
    });
};

export const useRevisionHistory = (pageId: string) => {
    return useQuery({
        queryKey: ['revision-history', pageId],
        queryFn: () => revisionApi.getHistory(pageId),
        enabled: !!pageId,
    });
};

export const useCreateRevision = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: revisionApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['revisions'] });
            console.log('Revision request created successfully');
        },
        onError: (error: Error) => {
            console.error('Failed to create revision request:', error.message);
        },
    });
};

export const useApplyRevision = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ revisionId, versionToApply }: { revisionId: string; versionToApply?: string }) =>
            revisionApi.apply(revisionId, versionToApply),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['revision', variables.revisionId] });
            queryClient.invalidateQueries({ queryKey: ['revisions'] });
            // Also invalidate page/chapter content that was updated
            queryClient.invalidateQueries({ queryKey: ['page'] });
            queryClient.invalidateQueries({ queryKey: ['chapter'] });
            console.log('Revision applied successfully');
        },
        onError: (error: Error) => {
            console.error('Failed to apply revision:', error.message);
        },
    });
};

export const useCancelRevision = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ revisionId, reason }: { revisionId: string; reason?: string }) =>
            revisionApi.cancel(revisionId, reason),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['revision', variables.revisionId] });
            queryClient.invalidateQueries({ queryKey: ['revisions'] });
            console.log('Revision cancelled');
        },
        onError: (error: Error) => {
            console.error('Failed to cancel revision:', error.message);
        },
    });
};