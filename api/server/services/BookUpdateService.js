/**
 * Book Update Service - Real-time notifications for book changes
 */

const { logger } = require('~/config');

class BookUpdateService {
  constructor() {
    this.subscribers = new Map(); // conversationId -> Set<response objects>
    this.booksByConversation = new Map(); // conversationId -> bookId
  }

  /**
   * Subscribe to book updates for a conversation
   * @param {string} conversationId 
   * @param {Object} res - Express response object for SSE
   */
  subscribe(conversationId, res) {
    if (!this.subscribers.has(conversationId)) {
      this.subscribers.set(conversationId, new Set());
    }
    
    this.subscribers.get(conversationId).add(res);
    
    // Clean up on client disconnect
    res.on('close', () => {
      this.unsubscribe(conversationId, res);
    });

    logger.debug('BookUpdateService: Client subscribed', { conversationId });
  }

  /**
   * Unsubscribe from book updates
   * @param {string} conversationId 
   * @param {Object} res 
   */
  unsubscribe(conversationId, res) {
    const subscribers = this.subscribers.get(conversationId);
    if (subscribers) {
      subscribers.delete(res);
      if (subscribers.size === 0) {
        this.subscribers.delete(conversationId);
      }
    }
    logger.debug('BookUpdateService: Client unsubscribed', { conversationId });
  }

  /**
   * Associate a book with a conversation
   * @param {string} conversationId 
   * @param {string} bookId 
   */
  setBookForConversation(conversationId, bookId) {
    this.booksByConversation.set(conversationId, bookId);
    logger.debug('BookUpdateService: Book associated with conversation', { conversationId, bookId });
  }

  /**
   * Get book ID for a conversation
   * @param {string} conversationId 
   * @returns {string|undefined}
   */
  getBookForConversation(conversationId) {
    return this.booksByConversation.get(conversationId);
  }

  /**
   * Notify subscribers of book updates
   * @param {string} bookId 
   * @param {string} updateType - 'book_updated', 'chapter_updated', 'page_updated', 'export_ready'
   * @param {Object} data - Update data
   */
  notifyBookUpdate(bookId, updateType, data = {}) {
    // Find conversations that have this book
    const relevantConversations = [];
    for (const [conversationId, mappedBookId] of this.booksByConversation.entries()) {
      if (mappedBookId === bookId) {
        relevantConversations.push(conversationId);
      }
    }

    // Send updates to all relevant conversations
    for (const conversationId of relevantConversations) {
      this.sendUpdateToConversation(conversationId, updateType, {
        bookId,
        conversationId,
        timestamp: new Date().toISOString(),
        ...data
      });
    }

    // Auto-trigger export for content changes (but not for export_ready to avoid loops)
    if (updateType === 'book_updated' && relevantConversations.length > 0) {
      // Trigger export for the first conversation (they all point to the same book)
      const conversationId = relevantConversations[0];
      setTimeout(() => {
        this.triggerExportWithNotification(bookId, conversationId, { format: 'html' })
          .catch(error => {
            logger.warn('BookUpdateService: Auto-export failed after book update', { 
              error: error.message, 
              bookId, 
              conversationId 
            });
          });
      }, 1000); // Small delay to ensure book changes are saved
    }

    logger.debug('BookUpdateService: Notified book update', { 
      bookId, 
      updateType, 
      conversations: relevantConversations.length 
    });
  }

  /**
   * Send update to specific conversation subscribers
   * @param {string} conversationId 
   * @param {string} updateType 
   * @param {Object} data 
   */
  sendUpdateToConversation(conversationId, updateType, data) {
    const subscribers = this.subscribers.get(conversationId);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const eventData = {
      event: 'book_update',
      data: {
        type: updateType,
        ...data
      }
    };

    // Send to all subscribers
    const deadConnections = new Set();
    for (const res of subscribers) {
      try {
        if (!res.finished) {
          res.write(`event: book_update\ndata: ${JSON.stringify(eventData.data)}\n\n`);
        } else {
          deadConnections.add(res);
        }
      } catch (error) {
        logger.warn('BookUpdateService: Failed to send update to client', { error: error.message });
        deadConnections.add(res);
      }
    }

    // Clean up dead connections
    for (const deadRes of deadConnections) {
      subscribers.delete(deadRes);
    }
  }

  /**
   * Trigger export and notify when ready
   * @param {string} bookId 
   * @param {string} conversationId 
   * @param {Object} exportOptions 
   * @param {string} [userToken] - Optional user token for authentication
   */
  async triggerExportWithNotification(bookId, conversationId, exportOptions = {}, userToken = null) {
    try {
      logger.info('BookUpdateService: Triggering export', { bookId, conversationId });
      
      const headers = {
        'Content-Type': 'application/json',
      };
      
      // Add authorization if user token is provided
      if (userToken) {
        headers['Authorization'] = `Bearer ${userToken}`;
      }
      
      // Try to trigger the export via internal service first
      let response;
      try {
        const { getMCPManager } = require('~/config');
        const mcpManager = getMCPManager('system'); // Use system-level access
        
        const result = await mcpManager.callTool({
          serverName: 'book-creation-server',
          toolName: 'export_book',
          provider: 'openai',
          toolArguments: {
            bookId,
            format: 'html',
            includeMetadata: true,
            aliasFilename: `${conversationId}.html`,
            ...exportOptions,
          },
          flowManager: null, // No flow manager needed for system calls
          tokenMethods: {},
        });
        
        logger.info('BookUpdateService: Internal export successful', { result, bookId, conversationId });
        
        // Simulate response for the rest of the logic
        response = { ok: true, json: async () => ({ success: true, result }) };
      } catch (internalError) {
        logger.warn('BookUpdateService: Internal export failed, falling back to HTTP call', { 
          error: internalError.message 
        });
        
        // Fall back to HTTP call
        response = await fetch(`${process.env.SERVER_HOST || 'http://localhost:3080'}/api/mcp/book-creation-server/tools/export_book/call`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            arguments: {
              bookId,
              format: 'html',
              includeMetadata: true,
              aliasFilename: `${conversationId}.html`,
              ...exportOptions,
            },
          }),
        });
      }

      logger.info('BookUpdateService: Export response', { 
        status: response.status, 
        ok: response.ok,
        bookId, 
        conversationId 
      });

      if (response.ok) {
        const result = await response.json();
        logger.info('BookUpdateService: Export successful', { result, bookId, conversationId });
        
        // Extract the actual filename from the export result
        let actualFilename = `${conversationId}.html`; // fallback
        if (result?.result?.content?.[0]?.text) {
          const exportText = result.result.content[0].text;
          const filenameMatch = exportText.match(/\*\*Filename:\*\*\s*(.+)/);
          if (filenameMatch && filenameMatch[1]) {
            actualFilename = filenameMatch[1].trim();
            logger.info('BookUpdateService: Extracted filename from export result', { actualFilename });
          }
        }
        
        // Notify that export is ready
        this.notifyBookUpdate(bookId, 'export_ready', {
          format: 'html',
          filename: actualFilename,
          conversationId
        });
      } else {
        const errorText = await response.text();
        logger.error('BookUpdateService: Export failed', { 
          status: response.status, 
          error: errorText,
          bookId, 
          conversationId 
        });
      }
    } catch (error) {
      logger.error('BookUpdateService: Failed to trigger export', { error: error.message, bookId, conversationId });
    }
  }

  /**
   * Get statistics for monitoring
   * @returns {Object}
   */
  getStats() {
    return {
      totalSubscribers: Array.from(this.subscribers.values()).reduce((sum, set) => sum + set.size, 0),
      activeConversations: this.subscribers.size,
      bookMappings: this.booksByConversation.size
    };
  }
}

// Singleton instance
const bookUpdateService = new BookUpdateService();

module.exports = bookUpdateService;
