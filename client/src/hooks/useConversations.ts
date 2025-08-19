/**
 * React hooks for conversation management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
interface ConversationSummary {
    id: string;
    conversationId: string;
    title: string;
    bookTitle: string;
    bookId: string;
    bookGenre?: string;
    type: string;
    status: string;
    messageCount: number;
    wordsGenerated: number;
    lastActivity: Date;
    duration: number;
    productivity: number;
    tags: string[];
    isActive: boolean;
    isPinned: boolean;
    isFavorited?: boolean;
    lastMessage?: {
        content: string;
        sender: 'user' | 'assistant';
        timestamp: Date;
    };
    goals?: {
        completed: number;
        total: number;
    };
}

interface CreateConversationRequest {
    conversationId: string;
    bookId: string;
    workspaceId: string;
    title?: string;
    description?: string;
    type?: string;
    goals?: any;
    context?: any;
}

interface UpdateConversationRequest {
    title?: string;
    description?: string;
    status?: string;
    goals?: any;
    context?: any;
    tags?: string[];
    category?: string;
    settings?: any;
}

interface ConversationFilters {
    bookId?: string;
    workspaceId?: string;
    status?: string;
    type?: string;
    includeArchived?: boolean;
    limit?: number;
    sortBy?: string;
}

// API functions
const conversationApi = {
    getSummaries: async (
        filters: ConversationFilters = {},
    ): Promise<{ summaries: ConversationSummary[]; count: number }> => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined) {
                params.append(key, value.toString());
            }
        });

        const response = await fetch(`/api/conversations/summaries?${params}`, {
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch conversation summaries');
        }

        return response.json();
    },

    create: async (data: CreateConversationRequest) => {
        const response = await fetch('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error('Failed to create conversation');
        }

        return response.json();
    },

    getById: async (id: string) => {
        const response = await fetch(`/api/conversations/${id}`, {
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch conversation');
        }

        return response.json();
    },

    getByConversationId: async (conversationId: string) => {
        const response = await fetch(`/api/conversations/by-conversation/${conversationId}`, {
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch conversation by conversation ID');
        }

        return response.json();
    },

    update: async (id: string, data: UpdateConversationRequest) => {
        const response = await fetch(`/api/conversations/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error('Failed to update conversation');
        }

        return response.json();
    },

    pin: async (id: string, pinned: boolean) => {
        const response = await fetch(`/api/conversations/${id}/pin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pinned }),
        });

        if (!response.ok) {
            throw new Error('Failed to pin conversation');
        }

        return response.json();
    },

    archive: async (id: string, reason?: string) => {
        const response = await fetch(`/api/conversations/${id}/archive`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
        });

        if (!response.ok) {
            throw new Error('Failed to archive conversation');
        }

        return response.json();
    },
};

// Hooks
export const useConversationSummaries = (filters: ConversationFilters = {}) => {
    return useQuery({
        queryKey: ['conversation-summaries', filters],
        queryFn: () => conversationApi.getSummaries(filters),
        staleTime: 30000, // 30 seconds
    });
};

export const useConversation = (id: string) => {
    return useQuery({
        queryKey: ['conversation', id],
        queryFn: () => conversationApi.getById(id),
        enabled: !!id,
    });
};

export const useConversationByConversationId = (conversationId: string) => {
    return useQuery({
        queryKey: ['conversation-by-id', conversationId],
        queryFn: () => conversationApi.getByConversationId(conversationId),
        enabled: !!conversationId,
    });
};

export const useCreateConversation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: conversationApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['conversation-summaries'] });
            console.log('Conversation created successfully');
        },
        onError: (error: Error) => {
            console.error('Failed to create conversation:', error.message);
        },
    });
};

export const useUpdateConversation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateConversationRequest }) =>
            conversationApi.update(id, data),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['conversation', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['conversation-summaries'] });
            console.log('Conversation updated successfully');
        },
        onError: (error: Error) => {
            console.error('Failed to update conversation:', error.message);
        },
    });
};

export const usePinConversation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => conversationApi.pin(id, pinned),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['conversation', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['conversation-summaries'] });
            console.log(variables.pinned ? 'Conversation pinned' : 'Conversation unpinned');
        },
        onError: (error: Error) => {
            console.error('Failed to pin conversation:', error.message);
        },
    });
};

export const useArchiveConversation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, reason }: { id: string; reason?: string }) => conversationApi.archive(id, reason),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['conversation', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['conversation-summaries'] });
            console.log('Conversation archived');
        },
        onError: (error: Error) => {
            console.error('Failed to archive conversation:', error.message);
        },
    });
};