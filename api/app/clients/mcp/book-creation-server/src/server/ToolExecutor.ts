import { ZodSchema } from 'zod';
import { ValidationError } from '../../types/errors.js';
import { ILogger } from '../core/Logger.js';

type ToolExecutorParams<TInput, TResult> = {
    name: string;
    logger: ILogger;
    schema: ZodSchema<TInput>;
    args: unknown;
    perform: (validated: TInput) => Promise<TResult>;
    format: (result: TResult, validated: TInput) => Promise<any> | any; // string or MCP content array
};

export class ToolExecutor {
    static async run<TInput, TResult>(params: ToolExecutorParams<TInput, TResult>): Promise<any> {
        const { name, logger, schema, args, perform, format } = params;
        logger.debug(`Executing tool: ${name}: validating input`);

        let validated: TInput;
        try {
            validated = await schema.parseAsync(args);
        } catch (err: any) {
            const issues = (err?.issues || []).map((i: any) => ({
                field: i.path?.join('.') || 'input',
                message: i.message,
                code: i.code || 'INVALID',
            }));
            throw new ValidationError('Invalid tool input', issues);
        }

        logger.debug(`Executing tool: ${name}: running perform`);
        const result = await perform(validated);

        logger.debug(`Executing tool: ${name}: formatting output`);
        return await format(result, validated);
    }
}


