/**
 * Codex Tool Handlers - MCP tools for story bible and context retrieval
 */

import { IToolHandler } from '../../interfaces/index.js';
import { ILogger } from '../../core/Logger.js';
import { CodexRagService, ContextPreview, ReferenceDetection } from '../../services/CodexRagService.js';
import { BaseToolHandler } from './BaseToolHandler.js';
import { z } from 'zod';
import { ToolExecutor } from '../../utils/ToolExecutor.js';

export class CodexToolHandlers extends BaseToolHandler {
    private codexService: CodexRagService;

    constructor(logger: ILogger, codexService: CodexRagService) {
        super(logger);
        this.codexService = codexService;
    }

    override getTools(): IToolHandler[] {
        return [
            // Sync book data to codex
            {
                name: 'sync_book_to_codex',
                description: 'Synchronize all story elements (characters, world elements, timeline) to the RAG-powered Codex for context retrieval',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: {
                            type: 'string',
                            description: 'The ID of the book to sync'
                        },
                        conversationId: {
                            type: 'string',
                            description: 'The conversation ID for context'
                        },
                        force: {
                            type: 'boolean',
                            description: 'Force re-sync even if already synced',
                            default: false
                        }
                    },
                    required: ['bookId', 'conversationId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        bookId: z.string().min(1),
                        conversationId: z.string().min(1),
                        force: z.boolean().default(false)
                    });

                    return ToolExecutor.run({
                        name: 'sync_book_to_codex',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ bookId, conversationId, force }) => {
                            const result = await this.codexService.syncBookToCodex(bookId, conversationId);
                            
                            if (result.success) {
                                return `✅ **Codex Sync Completed**

📚 **Synced Elements:** ${result.syncedElements} story elements added to Codex
🎯 **Book ID:** ${bookId}
🔗 **Conversation:** ${conversationId}

**What's Now Available:**
- **Character Profiles** with personality, appearance, and relationships
- **World Elements** with descriptions, properties, and connections  
- **Timeline Events** with participants, causality, and plot significance

**Next Steps:**
- Use \`query_codex_context\` to search for story elements
- Use \`detect_story_references\` to find references in your writing
- The Codex will automatically provide context previews when writing

${force ? '🔄 **Force sync completed** - All elements refreshed' : ''}`;
                            } else {
                                let errorSummary = `❌ **Codex Sync Issues**

⚠️ **Synced:** ${result.syncedElements} elements (partial success)
❌ **Errors:** ${result.errors.length}

**Error Details:**
${result.errors.slice(0, 5).map(err => `- ${err}`).join('\n')}
${result.errors.length > 5 ? `- ... and ${result.errors.length - 5} more errors` : ''}

**Recommendation:** Check your story elements for missing required fields and try again.`;
                                
                                return errorSummary;
                            }
                        }
                    });
                }
            },

            // Query codex for context
            {
                name: 'query_codex_context',
                description: 'Search the story Codex for relevant characters, locations, and events based on a query',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'Search query for story elements (e.g., "main character", "royal palace", "the betrayal")'
                        },
                        bookId: {
                            type: 'string',
                            description: 'The book ID to search within'
                        },
                        limit: {
                            type: 'number',
                            description: 'Maximum number of results to return',
                            default: 5,
                            minimum: 1,
                            maximum: 20
                        },
                        types: {
                            type: 'array',
                            items: {
                                type: 'string',
                                enum: ['character', 'world_element', 'timeline_event']
                            },
                            description: 'Filter by element types (optional)'
                        },
                        minRelevance: {
                            type: 'number',
                            description: 'Minimum relevance score (0.0 to 1.0)',
                            default: 0.7,
                            minimum: 0.0,
                            maximum: 1.0
                        }
                    },
                    required: ['query', 'bookId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        query: z.string().min(1),
                        bookId: z.string().min(1),
                        limit: z.number().min(1).max(20).default(5),
                        types: z.array(z.enum(['character', 'world_element', 'timeline_event'])).optional(),
                        minRelevance: z.number().min(0).max(1).default(0.7)
                    });

                    return ToolExecutor.run({
                        name: 'query_codex_context',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ query, bookId, limit, types, minRelevance }) => {
                            const results = await this.codexService.queryCodexContext(query, bookId, {
                                limit,
                                types,
                                minRelevance
                            });

                            if (results.length === 0) {
                                return `📚 **No Codex Results Found**

🔍 **Query:** "${query}"
📖 **Book ID:** ${bookId}
🎯 **Filters:** ${types ? types.join(', ') : 'All types'} (min relevance: ${minRelevance})

**Suggestions:**
- Try a broader search term
- Lower the minimum relevance score
- Make sure the book has been synced to the Codex with \`sync_book_to_codex\`
- Check if story elements exist for this book`;
                            }

                            let response = `📚 **Codex Search Results**

🔍 **Query:** "${query}"
📊 **Found:** ${results.length} relevant ${results.length === 1 ? 'element' : 'elements'}

`;

                            for (const [index, result] of results.entries()) {
                                const typeIcon = result.type === 'character' ? '👤' : 
                                               result.type === 'world_element' ? '🌍' : '⏰';
                                
                                response += `${typeIcon} **${result.name}** (${(result.relevance * 100).toFixed(0)}% relevance)
${result.summary}

`;

                                if (result.lastAppeared) {
                                    response += `📖 Last appeared: Chapter ${result.lastAppeared}\n`;
                                }

                                if (result.relationships && result.relationships.length > 0) {
                                    response += `🔗 Connected to: ${result.relationships.slice(0, 3).join(', ')}${result.relationships.length > 3 ? '...' : ''}\n`;
                                }

                                response += '\n---\n\n';
                            }

                            response += `**💡 Pro Tip:** Use these results to maintain consistency when writing. The Codex ensures your story elements remain coherent across chapters.`;

                            return response;
                        }
                    });
                }
            },

            // Detect references in content
            {
                name: 'detect_story_references',
                description: 'Automatically detect references to characters, locations, and events in text content and provide context previews',
                inputSchema: {
                    type: 'object',
                    properties: {
                        content: {
                            type: 'string',
                            description: 'The text content to analyze for story references'
                        },
                        bookId: {
                            type: 'string',
                            description: 'The book ID for context lookup'
                        },
                        conversationId: {
                            type: 'string',
                            description: 'The conversation ID for context'
                        },
                        includeDetails: {
                            type: 'boolean',
                            description: 'Whether to include full details for each reference',
                            default: false
                        }
                    },
                    required: ['content', 'bookId', 'conversationId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        content: z.string().min(1),
                        bookId: z.string().min(1),
                        conversationId: z.string().min(1),
                        includeDetails: z.boolean().default(false)
                    });

                    return ToolExecutor.run({
                        name: 'detect_story_references',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ content, bookId, conversationId, includeDetails }) => {
                            const detections = await this.codexService.detectReferences(content, bookId, conversationId);

                            if (detections.length === 0) {
                                return `📝 **Reference Detection Results**

✅ **Text analyzed:** ${content.length} characters
🔍 **References found:** None

**Analysis:**
- No known characters, locations, or events detected in the provided text
- This could mean:
  - The text contains new elements not yet in the Codex
  - Character/location names are not exactly matching stored versions
  - The book hasn't been synced to the Codex yet

**Suggestion:** Use \`sync_book_to_codex\` to ensure all story elements are searchable.`;
                            }

                            let response = `📝 **Reference Detection Results**

✅ **Text analyzed:** ${content.length} characters
🎯 **References found:** ${detections.length}

`;

                            const groupedRefs = this.groupReferencesByType(detections);

                            for (const [type, refs] of Object.entries(groupedRefs)) {
                                const typeIcon = type === 'character' ? '👤' : 
                                               type === 'location' ? '🌍' : 
                                               type === 'event' ? '⏰' : '📦';
                                
                                response += `${typeIcon} **${type.toUpperCase()}S** (${refs.length})\n`;
                                
                                for (const ref of refs) {
                                    response += `- **${ref.text}** at position ${ref.position.start}-${ref.position.end} (${(ref.confidence * 100).toFixed(0)}% confidence)\n`;
                                    
                                    if (includeDetails) {
                                        response += `  └─ ${ref.preview.summary}\n`;
                                        if (ref.preview.lastAppeared) {
                                            response += `  └─ Last appeared: Chapter ${ref.preview.lastAppeared}\n`;
                                        }
                                    }
                                }
                                response += '\n';
                            }

                            response += `**💡 Context Integration:**
- These references can provide automatic context hints while writing
- Use \`query_codex_context\` to get detailed information about any element
- References help maintain story consistency across chapters

**🔄 Auto-Enhancement:** Consider using these detections to automatically insert context-aware suggestions in your writing interface.`;

                            return response;
                        }
                    });
                }
            },

            // Get context preview for specific element
            {
                name: 'get_element_preview',
                description: 'Get a detailed context preview for a specific story element by name',
                inputSchema: {
                    type: 'object',
                    properties: {
                        elementName: {
                            type: 'string',
                            description: 'Name of the character, location, or event'
                        },
                        bookId: {
                            type: 'string',
                            description: 'The book ID to search within'
                        },
                        elementType: {
                            type: 'string',
                            enum: ['character', 'world_element', 'timeline_event', 'any'],
                            description: 'Type of element to search for',
                            default: 'any'
                        }
                    },
                    required: ['elementName', 'bookId']
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        elementName: z.string().min(1),
                        bookId: z.string().min(1),
                        elementType: z.enum(['character', 'world_element', 'timeline_event', 'any']).default('any')
                    });

                    return ToolExecutor.run({
                        name: 'get_element_preview',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ elementName, bookId, elementType }) => {
                            const types = elementType === 'any' ? 
                                ['character', 'world_element', 'timeline_event'] as const : 
                                [elementType as 'character' | 'world_element' | 'timeline_event'];

                            const results = await this.codexService.queryCodexContext(elementName, bookId, {
                                limit: 1,
                                types,
                                minRelevance: 0.5
                            });

                            if (results.length === 0) {
                                return `❌ **Element Not Found**

🔍 **Searched for:** "${elementName}"
📖 **Book ID:** ${bookId}
🎯 **Type filter:** ${elementType}

**Possible reasons:**
- Element name doesn't match exactly (try variations)
- Element hasn't been created or synced to Codex
- Element exists under a different name

**Suggestions:**
- Use \`query_codex_context\` with a broader search
- Check spelling and try alternative names
- Sync the book to Codex if recently added`;
                            }

                            const element = results[0];
                            const typeIcon = element.type === 'character' ? '👤' : 
                                           element.type === 'world_element' ? '🌍' : '⏰';

                            let response = `${typeIcon} **${element.name}** (${element.type.replace('_', ' ')})

${element.details}

📊 **Relevance:** ${(element.relevance * 100).toFixed(0)}%`;

                            if (element.lastAppeared) {
                                response += `\n📖 **Last Appearance:** Chapter ${element.lastAppeared}`;
                            }

                            if (element.relationships && element.relationships.length > 0) {
                                response += `\n\n🔗 **Connected Elements:**\n${element.relationships.map(rel => `- ${rel}`).join('\n')}`;
                            }

                            response += `\n\n**💡 Usage Tips:**
- Reference this information to maintain consistency
- Use relationships to create interconnected story moments
- Track appearances to manage character presence across chapters`;

                            return response;
                        }
                    });
                }
            }
        ];
    }

    /**
     * Group references by type for better display
     */
    private groupReferencesByType(detections: ReferenceDetection[]): Record<string, ReferenceDetection[]> {
        const grouped: Record<string, ReferenceDetection[]> = {};
        
        for (const detection of detections) {
            const type = detection.type;
            if (!grouped[type]) {
                grouped[type] = [];
            }
            grouped[type].push(detection);
        }
        
        return grouped;
    }
}
