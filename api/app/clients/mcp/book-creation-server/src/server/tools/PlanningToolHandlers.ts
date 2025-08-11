/**
 * Planning Tool Handlers - MCP tools to generate and refine a book spec (characters, world, rules)
 */

import { z } from 'zod';
import { IBookSpec } from '../../../types/book.js';
import { ILogger } from '../../core/Logger.js';
import { IBookService, IToolHandler } from '../../interfaces/index.js';
import { ToolExecutor } from '../ToolExecutor.js';

export class PlanningToolHandlers {
    private logger: ILogger;
    private bookService: IBookService;

    constructor(logger: ILogger, bookService: IBookService) {
        this.logger = logger.child('PlanningToolHandlers');
        this.bookService = bookService;
    }

    getTools(): IToolHandler[] {
        return [
            {
                name: 'generate_book_plan',
                description:
                    'Generate a structured plan/spec for a book, including characters, world, image style, and narrative rules',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'Book identifier' },
                        prompt: { type: 'string', description: 'High-level concept or planning prompt' },
                    },
                    required: ['bookId', 'prompt'],
                },
                handler: async (args: any) => {
                    const schema = z.object({ bookId: z.string().min(1), prompt: z.string().min(1) });
                    return ToolExecutor.run({
                        name: 'generate_book_plan',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ bookId, prompt }) => {
                            // Simple heuristic generator for initial plan scaffold; real implementation would call AI.
                            const spec: IBookSpec = {
                                colorPalette: { primary: '#4b7bec', accents: ['#20bf6b', '#8854d0'], mood: 'cinematic, vibrant' },
                                characters: [
                                    { id: 'protagonist', name: 'Alex', role: 'protagonist', description: 'Curious, resilient, resourceful', narrativeTraits: ['curiosity', 'loyalty'] },
                                    { id: 'mentor', name: 'Mara', role: 'mentor', description: 'Wise, enigmatic, patient', narrativeTraits: ['wisdom', 'mystery'] },
                                ],
                                world: {
                                    setting: 'Near-future coastal metropolis',
                                    rules: ['No time travel', 'Technology has trade-offs', 'Consequences for every shortcut'],
                                    themes: ['identity', 'trust', 'reinvention'],
                                    toneGuide: 'grounded but hopeful',
                                },
                                imageStyle: { style: "children's book illustration", rendering: 'watercolor', negativeCues: ['inconsistent character traits'] },
                                narrativeRules: [
                                    'Keep POV consistent per chapter',
                                    'Raise stakes every 2-3 pages',
                                    'Ensure character goals are explicit',
                                ],
                                contextBracketFormat: true,
                                planMarkdown: `# Plan\n\nPrompt: ${prompt}\n\n## Characters\n- Alex: Curious, resilient\n- Mara: Wise, enigmatic\n\n## World\n- Near-future coastal metropolis\n\n## Narrative Rules\n- Keep POV consistent\n- Raise stakes regularly\n`,
                            };

                            const updated = await this.bookService.updateBook(bookId, { spec });
                            return updated;
                        },
                        format: (updated) => `✅ Plan generated and attached to "${updated.title}"\n\nPreview:\n${updated.spec?.planMarkdown ?? 'No planMarkdown'}`,
                    });
                },
            },
            {
                name: 'refine_book_plan',
                description: 'Refine or merge an existing book spec with new details',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'Book identifier' },
                        partialSpec: { type: 'object', description: 'Partial IBookSpec fields to merge' },
                    },
                    required: ['bookId', 'partialSpec'],
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        bookId: z.string().min(1),
                        partialSpec: z.record(z.any()),
                    });

                    return ToolExecutor.run({
                        name: 'refine_book_plan',
                        logger: this.logger,
                        schema,
                        args,
                        perform: async ({ bookId, partialSpec }) => {
                            // Shallow-merge spec; service will persist it
                            const updated = await this.bookService.updateBook(bookId, { spec: partialSpec as Partial<IBookSpec> });
                            return updated;
                        },
                        format: (updated) => `✅ Plan updated for "${updated.title}"\n\nKeys: ${Object.keys(updated.spec ?? {}).join(', ')}`,
                    });
                },
            },
        ];
    }
}

export default PlanningToolHandlers;


