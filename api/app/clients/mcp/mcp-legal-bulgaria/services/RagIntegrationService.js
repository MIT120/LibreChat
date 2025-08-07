/**
 * RAG Integration Service for Bulgarian Legal MCP Server
 * Handles storing and retrieving legal documents from LibreChat's RAG system
 */

import axios from 'axios';
import FormData from 'form-data';
import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class RagIntegrationService {
    constructor() {
        this.ragApiUrl = process.env.RAG_API_URL || 'http://rag_api:8000';
        this.tempDir = path.join(__dirname, '../temp');
        this.legalDocsCollection = 'bulgarian_legal_docs';

        // Ensure temp directory exists
        this.ensureTempDir();
    }

    async ensureTempDir() {
        try {
            await fsPromises.mkdir(this.tempDir, { recursive: true });
        } catch (error) {
            console.warn('Could not create temp directory:', error.message);
        }
    }

    /**
     * Generate JWT token for RAG API authentication
     */
    generateAuthToken(userId = 'legal-mcp-server') {
        // In a real implementation, this should use LibreChat's auth service
        // For now, we'll use a placeholder
        return `legal-mcp-${Date.now()}`;
    }

    /**
     * Store legal document in RAG system
     */
    async storeLegalDocument(documentData, userId = 'legal-mcp-server') {
        try {
            const { title, content, metadata = {}, source = 'unknown' } = documentData;

            if (!content || content.length < 10) {
                throw new Error('Document content too short for embedding');
            }

            // Create temporary file for the document
            const tempFileName = `${uuidv4()}_${this.sanitizeFilename(title)}.txt`;
            const tempFilePath = path.join(this.tempDir, tempFileName);

            // Prepare document content with metadata
            const documentText = this.formatDocumentForStorage({
                title,
                content,
                metadata,
                source,
            });

            // Write to temporary file
            await fsPromises.writeFile(tempFilePath, documentText, 'utf8');

            // Generate file ID
            const fileId = uuidv4();

            // Upload to RAG system
            const result = await this.uploadToRag({
                filePath: tempFilePath,
                fileId,
                userId,
                metadata: {
                    ...metadata,
                    title,
                    source,
                    type: 'legal_document',
                    collection: this.legalDocsCollection,
                    uploadedAt: new Date().toISOString(),
                },
            });

            // Clean up temporary file
            await this.cleanupTempFile(tempFilePath);

            return {
                success: true,
                fileId,
                embedded: result.embedded,
                title,
                source,
            };
        } catch (error) {
            console.error('Error storing legal document in RAG:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Upload document to RAG API
     */
    async uploadToRag({ filePath, fileId, userId, metadata = {} }) {
        try {
            const formData = new FormData();
            formData.append('file_id', fileId);
            formData.append('file', fs.createReadStream(filePath));
            formData.append('entity_id', this.legalDocsCollection);

            // Add metadata
            if (metadata) {
                formData.append('metadata', JSON.stringify(metadata));
            }

            const response = await axios.post(`${this.ragApiUrl}/embed`, formData, {
                headers: {
                    Authorization: `Bearer ${this.generateAuthToken(userId)}`,
                    accept: 'application/json',
                    ...formData.getHeaders(),
                },
                timeout: 30000,
            });

            const responseData = response.data;

            if (!responseData.status) {
                throw new Error('RAG embedding failed');
            }

            return {
                embedded: Boolean(responseData.known_type),
                fileId,
                status: responseData.status,
            };
        } catch (error) {
            console.error('Error uploading to RAG API:', error);
            throw new Error(`RAG upload failed: ${error.message}`);
        }
    }

    /**
     * Query legal documents from RAG system
     */
    async queryLegalDocuments(query, options = {}) {
        try {
            const {
                userId = 'legal-mcp-server',
                limit = 5,
                collection = this.legalDocsCollection,
                minSimilarity = 0.7,
            } = options;

            // First, try to find documents in our collection
            const searchResults = await this.searchByCollection(collection, query, limit);

            if (searchResults.length === 0) {
                // If no collection-specific results, try general query
                return await this.generalQuery(query, userId, limit);
            }

            return {
                success: true,
                results: searchResults,
                query,
                source: 'rag_collection',
            };
        } catch (error) {
            console.error('Error querying RAG system:', error);
            return {
                success: false,
                error: error.message,
                results: [],
            };
        }
    }

    /**
     * Search by collection
     */
    async searchByCollection(collection, query, limit) {
        try {
            // This is a placeholder - in practice, you'd need to implement
            // collection-based filtering in the RAG API
            const response = await axios.post(
                `${this.ragApiUrl}/query`,
                {
                    query,
                    k: limit,
                    filter: {
                        collection: collection,
                    },
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.generateAuthToken()}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

            return response.data.results || [];
        } catch (error) {
            console.warn('Collection search failed, falling back to general search:', error.message);
            return [];
        }
    }

    /**
     * General query to RAG system
     */
    async generalQuery(query, userId, limit) {
        try {
            const response = await axios.post(
                `${this.ragApiUrl}/query`,
                {
                    query,
                    k: limit,
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.generateAuthToken(userId)}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

            return {
                success: true,
                results: response.data.results || [],
                query,
                source: 'rag_general',
            };
        } catch (error) {
            throw new Error(`RAG query failed: ${error.message}`);
        }
    }

    /**
     * Store multiple legal documents from search results
     */
    async storeLegalSearchResults(searchResults, searchQuery, source) {
        try {
            const results = [];

            for (const document of searchResults) {
                const documentData = {
                    title: document.title || 'Untitled Document',
                    content: this.extractDocumentContent(document),
                    metadata: {
                        url: document.url,
                        date: document.date,
                        type: document.type,
                        searchQuery,
                        extractedAt: new Date().toISOString(),
                    },
                    source,
                };

                const result = await this.storeLegalDocument(documentData);
                results.push({
                    ...result,
                    originalTitle: document.title,
                });

                // Add small delay to avoid overwhelming the RAG system
                await this.delay(100);
            }

            return {
                success: true,
                stored: results.filter((r) => r.success).length,
                failed: results.filter((r) => !r.success).length,
                results,
            };
        } catch (error) {
            console.error('Error storing search results:', error);
            return {
                success: false,
                error: error.message,
                results: [],
            };
        }
    }

    /**
     * Enhanced search that combines live scraping with RAG retrieval
     */
    async enhancedLegalSearch(query, searchFunction, options = {}) {
        try {
            const { storeResults = true, useRagFirst = true } = options;

            let ragResults = [];
            let liveResults = [];

            // Try RAG first if enabled
            if (useRagFirst) {
                const ragQuery = await this.queryLegalDocuments(query, options);
                if (ragQuery.success && ragQuery.results.length > 0) {
                    ragResults = ragQuery.results;
                }
            }

            // Get live results
            const liveSearch = await searchFunction(query);
            if (liveSearch.success) {
                liveResults = liveSearch.results || [];

                // Store new results in RAG if enabled
                if (storeResults && liveResults.length > 0) {
                    await this.storeLegalSearchResults(
                        liveResults.slice(0, 10), // Limit to avoid overloading
                        query,
                        liveSearch.source || 'live_search',
                    );
                }
            }

            // Combine and deduplicate results
            const combinedResults = this.combineAndRankResults(ragResults, liveResults, query);

            return {
                success: true,
                results: combinedResults,
                ragResults: ragResults.length,
                liveResults: liveResults.length,
                query,
            };
        } catch (error) {
            console.error('Error in enhanced legal search:', error);
            return {
                success: false,
                error: error.message,
                results: [],
            };
        }
    }

    /**
     * Format document for storage
     */
    formatDocumentForStorage({ title, content, metadata, source }) {
        const metadataText = Object.entries(metadata)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');

        return `TITLE: ${title}
SOURCE: ${source}
METADATA:
${metadataText}

CONTENT:
${content}`;
    }

    /**
     * Extract content from document object
     */
    extractDocumentContent(document) {
        const parts = [];

        if (document.title) parts.push(`Title: ${document.title}`);
        if (document.summary) parts.push(`Summary: ${document.summary}`);
        if (document.content) parts.push(`Content: ${document.content}`);
        if (document.date) parts.push(`Date: ${document.date}`);
        if (document.type) parts.push(`Type: ${document.type}`);

        return parts.join('\n\n');
    }

    /**
     * Combine and rank results from RAG and live search
     */
    combineAndRankResults(ragResults, liveResults, query) {
        const combined = [];
        const seen = new Set();

        // Add RAG results first (they're presumably more relevant)
        ragResults.forEach((result) => {
            const key = this.generateResultKey(result);
            if (!seen.has(key)) {
                seen.add(key);
                combined.push({
                    ...result,
                    source: 'rag',
                    relevanceScore: this.calculateRelevanceScore(result, query),
                });
            }
        });

        // Add live results
        liveResults.forEach((result) => {
            const key = this.generateResultKey(result);
            if (!seen.has(key)) {
                seen.add(key);
                combined.push({
                    ...result,
                    source: 'live',
                    relevanceScore: this.calculateRelevanceScore(result, query),
                });
            }
        });

        // Sort by relevance score
        return combined.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    /**
     * Generate a key for deduplication
     */
    generateResultKey(result) {
        return `${(result.title || '').toLowerCase().trim()}_${(result.url || '').toLowerCase()}`;
    }

    /**
     * Calculate relevance score for ranking
     */
    calculateRelevanceScore(result, query) {
        let score = 0;
        const queryLower = query.toLowerCase();

        // Title match
        if (result.title && result.title.toLowerCase().includes(queryLower)) {
            score += 0.5;
        }

        // Summary match
        if (result.summary && result.summary.toLowerCase().includes(queryLower)) {
            score += 0.3;
        }

        // Date recency (more recent = higher score)
        if (result.date) {
            const date = new Date(result.date);
            const now = new Date();
            const daysDiff = (now - date) / (1000 * 60 * 60 * 24);
            score += Math.max(0, 0.2 - (daysDiff / 365) * 0.2);
        }

        return score;
    }

    /**
     * Sanitize filename for safe storage
     */
    sanitizeFilename(filename) {
        return filename
            .replace(/[^a-zA-Z0-9\u0400-\u04FF\s.-]/g, '') // Keep Cyrillic
            .replace(/\s+/g, '_')
            .substring(0, 100);
    }

    /**
     * Clean up temporary file
     */
    async cleanupTempFile(filePath) {
        try {
            await fsPromises.unlink(filePath);
        } catch (error) {
            console.warn('Could not delete temp file:', error.message);
        }
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Delete document from RAG system
     */
    async deleteLegalDocument(fileId, userId = 'legal-mcp-server') {
        try {
            const response = await axios.delete(`${this.ragApiUrl}/documents/${fileId}`, {
                headers: {
                    Authorization: `Bearer ${this.generateAuthToken(userId)}`,
                },
            });

            return {
                success: true,
                fileId,
                deleted: response.data.deleted || true,
            };
        } catch (error) {
            console.error('Error deleting document from RAG:', error);
            return {
                success: false,
                error: error.message,
                fileId,
            };
        }
    }

    /**
     * Get document context from RAG system
     */
    async getDocumentContext(fileId, userId = 'legal-mcp-server') {
        try {
            const response = await axios.get(`${this.ragApiUrl}/documents/${fileId}/context`, {
                headers: {
                    Authorization: `Bearer ${this.generateAuthToken(userId)}`,
                },
            });

            return {
                success: true,
                context: response.data.context,
                fileId,
            };
        } catch (error) {
            console.error('Error getting document context:', error);
            return {
                success: false,
                error: error.message,
                fileId,
            };
        }
    }
}
