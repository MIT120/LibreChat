/**
 * LookML Tool Handlers - Model management, validation, and deployment
 */

import { BaseToolHandler } from '../tools/BaseToolHandler.js';
import { ILogger } from '../../interfaces/ILogger.js';
import { LookerService } from '../../services/LookerService.js';
import { IToolHandler } from '../../interfaces/index.js';
import { z } from 'zod';
import {
    LookMLFile,
    ValidationResult,
    DeploymentResult
} from '../../../types/index.js';

export class LookMLToolHandlers extends BaseToolHandler {
    private lookerService: LookerService;

    constructor(logger: ILogger, lookerService: LookerService) {
        super(logger);
        this.lookerService = lookerService;
    }

    getTools(): IToolHandler[] {
        return [
            this.createGetLookMLFilesHandler(),
            this.createValidateLookMLHandler(),
            this.createDeployModelHandler(),
            this.createGetProjectHandler(),
            this.createGetAllProjectsHandler(),
            this.createUpdateLookMLFileHandler(),
            this.createDeleteLookMLFileHandler(),
            this.createGetModelValidationStatusHandler(),
            this.createGetGitIntegrationStatusHandler(),
            this.createValidateAndDeployHandler(),
            this.createGetLookMLFileContentHandler(),
            this.createCreateLookMLFileHandler(),
            this.createGetProjectStructureHandler()
        ];
    }

    /**
     * Get LookML files for a project
     */
    async getLookMLFiles(args: {
        projectId: string;
    }): Promise<LookMLFile[]> {
        this.logger.info('Getting LookML files', { projectId: args.projectId });

        try {
            const files = await this.lookerService.lookml.getLookMLFiles(args.projectId);

            this.logger.info('Retrieved LookML files', {
                projectId: args.projectId,
                fileCount: files.length,
                fileNames: files.map(f => f.name)
            });

            return files;
        } catch (error) {
            this.logger.error('Failed to get LookML files', error);
            throw error;
        }
    }

    /**
     * Validate LookML syntax and structure
     */
    async validateLookML(args: {
        lookml: string;
    }): Promise<ValidationResult> {
        this.logger.info('Validating LookML', { contentLength: args.lookml.length });

        try {
            const result = await this.lookerService.lookml.validateLookML(args.lookml);

            this.logger.info('LookML validation completed', {
                valid: result.valid,
                errorCount: result.errors.length,
                warningCount: result.warnings.length,
                suggestionCount: result.suggestions.length
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to validate LookML', error);
            throw error;
        }
    }

    /**
     * Deploy model changes to Looker
     */
    async deployModel(args: {
        projectId: string;
        branch?: string;
    }): Promise<DeploymentResult> {
        this.logger.info('Deploying model', {
            projectId: args.projectId,
            branch: args.branch
        });

        try {
            const result = await this.lookerService.lookml.deployModel(args.projectId, args.branch);

            this.logger.info('Model deployment completed', {
                projectId: args.projectId,
                branch: args.branch,
                success: result.success,
                deploymentId: result.deployment_id
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to deploy model', error);
            throw error;
        }
    }

    /**
     * Get project information
     */
    async getProject(args: {
        projectId: string;
    }): Promise<any> {
        this.logger.info('Getting project information', { projectId: args.projectId });

        try {
            const project = await this.lookerService.lookml.getProject(args.projectId);

            this.logger.info('Retrieved project information', {
                projectId: args.projectId,
                projectName: project.name,
                status: project.status
            });

            return project;
        } catch (error) {
            this.logger.error('Failed to get project information', error);
            throw error;
        }
    }

    /**
     * Get all projects
     */
    async getAllProjects(): Promise<any[]> {
        this.logger.info('Getting all projects');

        try {
            const projects = await this.lookerService.lookml.getAllProjects();

            this.logger.info('Retrieved all projects', {
                projectCount: projects.length,
                projectNames: projects.map(p => p.name)
            });

            return projects;
        } catch (error) {
            this.logger.error('Failed to get all projects', error);
            throw error;
        }
    }

    /**
     * Create or update a LookML file
     */
    async updateLookMLFile(args: {
        projectId: string;
        fileName: string;
        content: string;
    }): Promise<LookMLFile> {
        this.logger.info('Updating LookML file', {
            projectId: args.projectId,
            fileName: args.fileName,
            contentLength: args.content.length
        });

        try {
            const file = await this.lookerService.lookml.updateLookMLFile(
                args.projectId,
                args.fileName,
                args.content
            );

            this.logger.info('LookML file updated successfully', {
                projectId: args.projectId,
                fileName: args.fileName,
                size: file.size
            });

            return file;
        } catch (error) {
            this.logger.error('Failed to update LookML file', error);
            throw error;
        }
    }

    /**
     * Delete a LookML file
     */
    async deleteLookMLFile(args: {
        projectId: string;
        fileName: string;
    }): Promise<void> {
        this.logger.info('Deleting LookML file', {
            projectId: args.projectId,
            fileName: args.fileName
        });

        try {
            await this.lookerService.lookml.deleteLookMLFile(args.projectId, args.fileName);

            this.logger.info('LookML file deleted successfully', {
                projectId: args.projectId,
                fileName: args.fileName
            });
        } catch (error) {
            this.logger.error('Failed to delete LookML file', error);
            throw error;
        }
    }

    /**
     * Get model validation status
     */
    async getModelValidationStatus(args: {
        projectId: string;
    }): Promise<{
        valid: boolean;
        errors: string[];
        warnings: string[];
        last_validated: string;
    }> {
        this.logger.info('Getting model validation status', { projectId: args.projectId });

        try {
            const status = await this.lookerService.lookml.getModelValidationStatus(args.projectId);

            this.logger.info('Retrieved model validation status', {
                projectId: args.projectId,
                valid: status.valid,
                errorCount: status.errors.length,
                warningCount: status.warnings.length
            });

            return status;
        } catch (error) {
            this.logger.error('Failed to get model validation status', error);
            throw error;
        }
    }

    /**
     * Get Git integration status
     */
    async getGitIntegrationStatus(args: {
        projectId: string;
    }): Promise<{
        connected: boolean;
        remote_url?: string;
        branch?: string;
        last_sync?: string;
        status?: string;
    }> {
        this.logger.info('Getting Git integration status', { projectId: args.projectId });

        try {
            const status = await this.lookerService.lookml.getGitIntegrationStatus(args.projectId);

            this.logger.info('Retrieved Git integration status', {
                projectId: args.projectId,
                connected: status.connected,
                branch: status.branch,
                remoteUrl: status.remote_url
            });

            return status;
        } catch (error) {
            this.logger.error('Failed to get Git integration status', error);
            throw error;
        }
    }

    /**
     * Validate and deploy LookML changes
     */
    async validateAndDeploy(args: {
        projectId: string;
        lookmlContent: string;
        fileName: string;
        branch?: string;
    }): Promise<{
        validation: ValidationResult;
        deployment?: DeploymentResult;
        success: boolean;
    }> {
        this.logger.info('Validating and deploying LookML changes', {
            projectId: args.projectId,
            fileName: args.fileName,
            branch: args.branch
        });

        try {
            // First validate the LookML
            const validation = await this.lookerService.lookml.validateLookML(args.lookmlContent);

            if (!validation.valid) {
                this.logger.warn('LookML validation failed', {
                    projectId: args.projectId,
                    fileName: args.fileName,
                    errors: validation.errors.length
                });

                return {
                    validation,
                    success: false
                };
            }

            // Update the file
            await this.lookerService.lookml.updateLookMLFile(
                args.projectId,
                args.fileName,
                args.lookmlContent
            );

            // Deploy the changes
            const deployment = await this.lookerService.lookml.deployModel(args.projectId, args.branch);

            const result = {
                validation,
                deployment,
                success: deployment.success
            };

            this.logger.info('LookML validation and deployment completed', {
                projectId: args.projectId,
                fileName: args.fileName,
                success: result.success,
                deploymentId: deployment.deployment_id
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to validate and deploy LookML changes', error);
            throw error;
        }
    }

    /**
     * Get LookML file content
     */
    async getLookMLFileContent(args: {
        projectId: string;
        fileName: string;
    }): Promise<{
        content: string;
        file: LookMLFile;
    }> {
        this.logger.info('Getting LookML file content', {
            projectId: args.projectId,
            fileName: args.fileName
        });

        try {
            const files = await this.lookerService.lookml.getLookMLFiles(args.projectId);
            const file = files.find(f => f.name === args.fileName);

            if (!file) {
                throw new Error(`LookML file not found: ${args.fileName}`);
            }

            this.logger.info('Retrieved LookML file content', {
                projectId: args.projectId,
                fileName: args.fileName,
                contentLength: file.content.length
            });

            return {
                content: file.content,
                file
            };
        } catch (error) {
            this.logger.error('Failed to get LookML file content', error);
            throw error;
        }
    }

    /**
     * Create a new LookML file
     */
    async createLookMLFile(args: {
        projectId: string;
        fileName: string;
        content: string;
        validate?: boolean;
    }): Promise<{
        file: LookMLFile;
        validation?: ValidationResult;
    }> {
        this.logger.info('Creating LookML file', {
            projectId: args.projectId,
            fileName: args.fileName,
            contentLength: args.content.length,
            validate: args.validate
        });

        try {
            let validation: ValidationResult | undefined;

            // Validate if requested
            if (args.validate) {
                validation = await this.lookerService.lookml.validateLookML(args.content);

                if (!validation.valid) {
                    this.logger.warn('LookML validation failed during creation', {
                        projectId: args.projectId,
                        fileName: args.fileName,
                        errors: validation.errors.length
                    });
                }
            }

            // Create the file
            const file = await this.lookerService.lookml.updateLookMLFile(
                args.projectId,
                args.fileName,
                args.content
            );

            const result = {
                file,
                validation
            };

            this.logger.info('LookML file created successfully', {
                projectId: args.projectId,
                fileName: args.fileName,
                size: file.size,
                validated: !!validation
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to create LookML file', error);
            throw error;
        }
    }

    /**
     * Get project structure and dependencies
     */
    async getProjectStructure(args: {
        projectId: string;
    }): Promise<{
        files: LookMLFile[];
        structure: {
            models: string[];
            views: string[];
            explores: string[];
            dashboards: string[];
        };
        dependencies: Record<string, string[]>;
    }> {
        this.logger.info('Getting project structure', { projectId: args.projectId });

        try {
            const files = await this.lookerService.lookml.getLookMLFiles(args.projectId);

            const structure = {
                models: [] as string[],
                views: [] as string[],
                explores: [] as string[],
                dashboards: [] as string[]
            };

            const dependencies: Record<string, string[]> = {};

            // Parse files to extract structure
            files.forEach(file => {
                const lines = file.content.split('\n');
                let currentBlock = '';
                let currentName = '';

                lines.forEach(line => {
                    const trimmedLine = line.trim();

                    if (trimmedLine.startsWith('model:')) {
                        currentBlock = 'model';
                        currentName = trimmedLine.split(':')[1]?.trim() || '';
                        if (currentName) structure.models.push(currentName);
                    } else if (trimmedLine.startsWith('view:')) {
                        currentBlock = 'view';
                        currentName = trimmedLine.split(':')[1]?.trim() || '';
                        if (currentName) structure.views.push(currentName);
                    } else if (trimmedLine.startsWith('explore:')) {
                        currentBlock = 'explore';
                        currentName = trimmedLine.split(':')[1]?.trim() || '';
                        if (currentName) structure.explores.push(currentName);
                    } else if (trimmedLine.includes('from:') && currentBlock === 'explore') {
                        const fromValue = trimmedLine.split(':')[1]?.trim() || '';
                        if (fromValue && currentName) {
                            if (!dependencies[currentName]) {
                                dependencies[currentName] = [];
                            }
                            dependencies[currentName].push(fromValue);
                        }
                    }
                });
            });

            const result = {
                files,
                structure,
                dependencies
            };

            this.logger.info('Retrieved project structure', {
                projectId: args.projectId,
                fileCount: files.length,
                modelCount: structure.models.length,
                viewCount: structure.views.length,
                exploreCount: structure.explores.length
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to get project structure', error);
            throw error;
        }
    }

    // Tool handler creation methods

    private createGetLookMLFilesHandler(): IToolHandler {
        return {
            name: 'looker-get-lookml-files',
            description: 'Get all LookML files for a project',
            inputSchema: this.toJsonSchema(z.object({
                projectId: z.string().describe('ID of the Looker project')
            })),
            handler: async (args) => {
                return await this.getLookMLFiles(args);
            }
        };
    }

    private createValidateLookMLHandler(): IToolHandler {
        return {
            name: 'looker-validate-lookml',
            description: 'Validate LookML syntax and structure',
            inputSchema: this.toJsonSchema(z.object({
                lookml: z.string().describe('LookML content to validate')
            })),
            handler: async (args) => {
                return await this.validateLookML(args);
            }
        };
    }

    private createDeployModelHandler(): IToolHandler {
        return {
            name: 'looker-deploy-model',
            description: 'Deploy model changes to Looker',
            inputSchema: this.toJsonSchema(z.object({
                projectId: z.string().describe('ID of the Looker project'),
                branch: z.string().optional().describe('Git branch to deploy (default: main)')
            })),
            handler: async (args) => {
                return await this.deployModel(args);
            }
        };
    }

    private createGetProjectHandler(): IToolHandler {
        return {
            name: 'looker-get-project',
            description: 'Get project information',
            inputSchema: this.toJsonSchema(z.object({
                projectId: z.string().describe('ID of the Looker project')
            })),
            handler: async (args) => {
                return await this.getProject(args);
            }
        };
    }

    private createGetAllProjectsHandler(): IToolHandler {
        return {
            name: 'looker-get-all-projects',
            description: 'Get all projects',
            inputSchema: this.toJsonSchema(z.object({})),
            handler: async () => {
                return await this.getAllProjects();
            }
        };
    }

    private createUpdateLookMLFileHandler(): IToolHandler {
        return {
            name: 'looker-update-lookml-file',
            description: 'Create or update a LookML file',
            inputSchema: this.toJsonSchema(z.object({
                projectId: z.string().describe('ID of the Looker project'),
                fileName: z.string().describe('Name of the LookML file'),
                content: z.string().describe('Content of the LookML file')
            })),
            handler: async (args) => {
                return await this.updateLookMLFile(args);
            }
        };
    }

    private createDeleteLookMLFileHandler(): IToolHandler {
        return {
            name: 'looker-delete-lookml-file',
            description: 'Delete a LookML file',
            inputSchema: this.toJsonSchema(z.object({
                projectId: z.string().describe('ID of the Looker project'),
                fileName: z.string().describe('Name of the LookML file to delete')
            })),
            handler: async (args) => {
                return await this.deleteLookMLFile(args);
            }
        };
    }

    private createGetModelValidationStatusHandler(): IToolHandler {
        return {
            name: 'looker-get-model-validation-status',
            description: 'Get model validation status',
            inputSchema: this.toJsonSchema(z.object({
                projectId: z.string().describe('ID of the Looker project')
            })),
            handler: async (args) => {
                return await this.getModelValidationStatus(args);
            }
        };
    }

    private createGetGitIntegrationStatusHandler(): IToolHandler {
        return {
            name: 'looker-get-git-integration-status',
            description: 'Get Git integration status',
            inputSchema: this.toJsonSchema(z.object({
                projectId: z.string().describe('ID of the Looker project')
            })),
            handler: async (args) => {
                return await this.getGitIntegrationStatus(args);
            }
        };
    }

    private createValidateAndDeployHandler(): IToolHandler {
        return {
            name: 'looker-validate-and-deploy',
            description: 'Validate and deploy LookML changes',
            inputSchema: this.toJsonSchema(z.object({
                projectId: z.string().describe('ID of the Looker project'),
                lookmlContent: z.string().describe('LookML content to validate and deploy'),
                fileName: z.string().describe('Name of the LookML file'),
                branch: z.string().optional().describe('Git branch to deploy (default: main)')
            })),
            handler: async (args) => {
                return await this.validateAndDeploy(args);
            }
        };
    }

    private createGetLookMLFileContentHandler(): IToolHandler {
        return {
            name: 'looker-get-lookml-file-content',
            description: 'Get LookML file content',
            inputSchema: this.toJsonSchema(z.object({
                projectId: z.string().describe('ID of the Looker project'),
                fileName: z.string().describe('Name of the LookML file')
            })),
            handler: async (args) => {
                return await this.getLookMLFileContent(args);
            }
        };
    }

    private createCreateLookMLFileHandler(): IToolHandler {
        return {
            name: 'looker-create-lookml-file',
            description: 'Create a new LookML file',
            inputSchema: this.toJsonSchema(z.object({
                projectId: z.string().describe('ID of the Looker project'),
                fileName: z.string().describe('Name of the LookML file'),
                content: z.string().describe('Content of the LookML file'),
                validate: z.boolean().optional().describe('Whether to validate the LookML content')
            })),
            handler: async (args) => {
                return await this.createLookMLFile(args);
            }
        };
    }

    private createGetProjectStructureHandler(): IToolHandler {
        return {
            name: 'looker-get-project-structure',
            description: 'Get project structure and dependencies',
            inputSchema: this.toJsonSchema(z.object({
                projectId: z.string().describe('ID of the Looker project')
            })),
            handler: async (args) => {
                return await this.getProjectStructure(args);
            }
        };
    }
}
