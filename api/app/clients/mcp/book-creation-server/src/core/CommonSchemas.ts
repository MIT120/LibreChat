/**
 * Common validation schemas used across multiple tool handlers
 */

import { z } from 'zod';

/**
 * Utility functions for generating default IDs
 */
export const IdGenerators = {
    generateAuthorId: (prefix?: string): string => {
        const timestamp = Date.now();
        const basePrefix = prefix || 'author';
        return `${basePrefix}_${timestamp}`;
    },

    generateConversationId: (): string => {
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substr(2, 9);
        return `conv_${timestamp}_${randomSuffix}`;
    },

    generateWorkspaceId: (prefix?: string): string => {
        const timestamp = Date.now();
        const basePrefix = prefix || 'workspace';
        return `${basePrefix}_${timestamp}`;
    },

    generateUserId: (prefix?: string): string => {
        const timestamp = Date.now();
        const basePrefix = prefix || 'user';
        return `${basePrefix}_${timestamp}`;
    }
};

/**
 * Common field schemas
 */
export const CommonSchemas = {
    // Basic identifiers
    id: z.string().min(1, 'ID is required'),
    uuid: z.string().uuid('Invalid UUID format'),
    objectId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format'),

    // User identifiers
    authorId: z.string().min(1, 'Author ID is required'),
    userId: z.string().min(1, 'User ID is required'),
    conversationId: z.string().min(1, 'Conversation ID is required'),

    // Optional user identifiers with defaults (for creation)
    authorIdOptional: z.string().min(1).optional().transform(val => val || IdGenerators.generateAuthorId()),
    userIdOptional: z.string().min(1).optional().transform(val => val || IdGenerators.generateUserId()),
    conversationIdOptional: z.string().min(1).optional().transform(val => val || IdGenerators.generateConversationId()),

    // Text fields
    title: z.string().min(1, 'Title is required').max(300, 'Title too long'),
    subtitle: z.string().max(500, 'Subtitle too long').optional(),
    description: z.string().max(2000, 'Description too long').optional(),
    outline: z.string().optional(),
    notes: z.string().optional(),

    // Numbers
    positiveInteger: z.number().int().positive(),
    nonNegativeInteger: z.number().int().min(0),
    wordCount: z.number().int().min(0),
    targetWordCount: z.number().int().positive().optional(),
    chapterNumber: z.number().int().positive().optional(),
    pageNumber: z.number().int().positive().optional(),

    // Dates
    dateString: z.string().datetime().optional(),

    // Pagination
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0),

    // Content types
    content: z.string().min(1, 'Content is required'),
    contentOptional: z.string().optional(),
} as const;

/**
 * Enum schemas for consistent status values
 */
export const StatusSchemas = {
    bookStatus: z.enum([
        'planning',
        'outlining',
        'writing',
        'editing',
        'review',
        'completed',
        'published'
    ]),

    chapterStatus: z.enum([
        'planned',
        'in_progress',
        'draft',
        'review',
        'approved',
        'published'
    ]),

    pageStatus: z.enum([
        'planned',
        'draft',
        'in_progress',
        'review',
        'approved',
        'published'
    ]),

    priority: z.enum(['low', 'medium', 'high']),

    exportFormat: z.enum(['pdf', 'epub', 'docx', 'html', 'txt']),
} as const;

/**
 * Writing style schema - commonly used across book creation tools
 */
export const WritingStyleSchema = z.object({
    tone: z.enum([
        'formal', 'informal', 'academic', 'conversational',
        'humorous', 'serious', 'inspirational', 'dark',
        'atmospheric', 'suspenseful', 'dramatic', 'mysterious',
        'noir', 'romantic', 'melancholic', 'tense'
    ]),
    voice: z.enum(['first_person', 'second_person', 'third_person']),
    vocabulary: z.enum(['simple', 'intermediate', 'advanced', 'technical']),
    sentenceStructure: z.enum(['simple', 'complex', 'varied']),
    perspective: z.string().optional(),
    specialInstructions: z.string().optional(),
});

/**
 * Common object schemas
 */
export const ObjectSchemas = {
    writingStyle: WritingStyleSchema,

    pagination: z.object({
        limit: CommonSchemas.limit,
        offset: CommonSchemas.offset,
    }),

    bookFilters: z.object({
        status: StatusSchemas.bookStatus.optional(),
        genre: z.string().optional(),
        theme: z.string().optional(),
    }),

    timeRange: z.object({
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
    }),

    socialMediaPlatform: z.enum([
        'twitter', 'linkedin', 'instagram', 'youtube',
        'blog', 'tiktok', 'facebook'
    ]),
} as const;

/**
 * Complex schemas for specific entities
 */
export const EntitySchemas = {
    // Book creation request
    createBook: z.object({
        title: CommonSchemas.title,
        subtitle: CommonSchemas.subtitle,
        theme: z.string().min(1, 'Theme is required').max(200, 'Theme too long'),
        genre: z.string().min(1, 'Genre is required').max(100, 'Genre too long'),
        targetAudience: z.string().max(500, 'Target audience description too long').optional(),
        writingStyle: WritingStyleSchema,
        description: CommonSchemas.description,
        targetWordCount: CommonSchemas.targetWordCount,
        estimatedPages: z.number().int().min(0).optional(),
        authorId: CommonSchemas.authorIdOptional,
        conversationId: CommonSchemas.conversationIdOptional,
    }),

    // Book update request
    updateBook: z.object({
        title: CommonSchemas.title.optional(),
        subtitle: CommonSchemas.subtitle,
        theme: z.string().min(1).max(200).optional(),
        genre: z.string().min(1).max(100).optional(),
        targetAudience: z.string().max(500).optional(),
        writingStyle: WritingStyleSchema.optional(),
        description: CommonSchemas.description,
        targetWordCount: CommonSchemas.targetWordCount,
        estimatedPages: z.number().int().min(0).optional(),
        status: StatusSchemas.bookStatus.optional(),
    }),

    // Chapter creation request
    createChapter: z.object({
        bookId: CommonSchemas.id,
        conversationId: CommonSchemas.conversationIdOptional,
        title: CommonSchemas.title,
        description: CommonSchemas.description,
        outline: CommonSchemas.outline,
        targetWordCount: CommonSchemas.targetWordCount,
        chapterNumber: CommonSchemas.chapterNumber,
    }),

    // Chapter update request
    updateChapter: z.object({
        title: CommonSchemas.title.optional(),
        description: CommonSchemas.description,
        outline: CommonSchemas.outline,
        targetWordCount: CommonSchemas.targetWordCount,
        status: StatusSchemas.chapterStatus.optional(),
        notes: CommonSchemas.notes,
    }),

    // Page creation request
    createPage: z.object({
        chapterId: CommonSchemas.id,
        conversationId: CommonSchemas.conversationIdOptional,
        title: CommonSchemas.title,
        content: CommonSchemas.content,
        pageNumber: CommonSchemas.pageNumber,
        targetWordCount: CommonSchemas.targetWordCount,
        imagePrompt: z.string().optional(),
        notes: CommonSchemas.notes,
    }),

    // Page update request
    updatePage: z.object({
        title: CommonSchemas.title.optional(),
        content: CommonSchemas.contentOptional,
        targetWordCount: CommonSchemas.targetWordCount,
        status: StatusSchemas.pageStatus.optional(),
        imagePrompt: z.string().optional(),
        notes: CommonSchemas.notes,
    }),

    // List options
    listBooks: z.object({
        authorId: CommonSchemas.authorIdOptional,
        conversationId: CommonSchemas.conversationIdOptional,
        ...ObjectSchemas.bookFilters.shape,
        ...ObjectSchemas.pagination.shape,
    }),

    // List chapters - simpler schema requiring only bookId
    listChapters: z.object({
        bookId: CommonSchemas.id,
        limit: CommonSchemas.limit.optional(),
        offset: CommonSchemas.offset.optional(),
    }),

    // ID with author verification
    deleteWithAuthor: z.object({
        id: CommonSchemas.id,
        authorId: CommonSchemas.authorId,
    }),
} as const;

/**
 * Input schema generators for common patterns
 */
export const InputSchemaGenerators = {
    /**
     * Generate a basic CRUD input schema
     */
    basicCrud: (entityName: string) => ({
        create: {
            type: 'object',
            properties: {
                ...EntitySchemas[`create${entityName}` as keyof typeof EntitySchemas]?.shape || {},
            },
            required: Object.keys(EntitySchemas[`create${entityName}` as keyof typeof EntitySchemas]?.shape || {}),
        },

        get: {
            type: 'object',
            properties: {
                [`${entityName.toLowerCase()}Id`]: { type: 'string', description: `${entityName} identifier` },
            },
            required: [`${entityName.toLowerCase()}Id`],
        },

        update: {
            type: 'object',
            properties: {
                [`${entityName.toLowerCase()}Id`]: { type: 'string', description: `${entityName} identifier` },
                updates: {
                    type: 'object',
                    description: 'Object containing fields to update',
                    properties: EntitySchemas[`update${entityName}` as keyof typeof EntitySchemas]?.shape || {},
                },
            },
            required: [`${entityName.toLowerCase()}Id`, 'updates'],
        },

        delete: {
            type: 'object',
            properties: {
                [`${entityName.toLowerCase()}Id`]: { type: 'string', description: `${entityName} identifier` },
                authorId: { type: 'string', description: 'Author identifier for verification' },
            },
            required: [`${entityName.toLowerCase()}Id`, 'authorId'],
        },
    }),

    /**
     * Generate list input schema
     */
    list: (entityName: string, additionalFilters: Record<string, any> = {}) => ({
        type: 'object',
        properties: {
            authorId: { type: 'string', description: 'Author identifier (optional - will generate default if not provided)' },
            conversationId: { type: 'string', description: 'Conversation identifier (optional - will generate default if not provided)' },
            limit: { type: 'number', description: 'Maximum results (default: 20)', default: 20 },
            offset: { type: 'number', description: 'Pagination offset (default: 0)', default: 0 },
            ...additionalFilters,
        },
        required: [],
    }),
};

/**
 * Utility functions for schema composition
 */
export const SchemaUtils = {
    /**
     * Combine multiple schemas into one
     */
    combine: <T extends Record<string, z.ZodType>>(...schemas: T[]) => {
        return z.object(Object.assign({}, ...schemas.map(s => s.shape)));
    },

    /**
     * Make all fields in a schema optional
     */
    makeOptional: <T extends z.ZodRawShape>(schema: z.ZodObject<T>) => {
        return schema.partial();
    },

    /**
     * Pick specific fields from a schema
     */
    pick: <T extends z.ZodRawShape, K extends keyof T>(
        schema: z.ZodObject<T>,
        keys: K[]
    ) => {
        const pickObj = {} as any;
        keys.forEach(key => { pickObj[key] = true; });
        return schema.pick(pickObj);
    },

    /**
     * Omit specific fields from a schema
     */
    omit: <T extends z.ZodRawShape, K extends keyof T>(
        schema: z.ZodObject<T>,
        keys: K[]
    ) => {
        const omitObj = {} as any;
        keys.forEach(key => { omitObj[key] = true; });
        return schema.omit(omitObj);
    },
};
