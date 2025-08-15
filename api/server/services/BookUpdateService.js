/**
 * Book Update Service - Real-time notifications for book changes
 */

const { logger } = require('~/config');

class BookUpdateService {
  constructor() {
    this.subscribers = new Map(); // conversationId -> Set<response objects>
    this.booksByConversation = new Map(); // conversationId -> bookId
    this.bookSubscribers = new Map(); // bookId -> Set<response objects>
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
   * Subscribe to book updates for a specific book
   * @param {string} bookId
   * @param {Object} res - Express response object for SSE
   */
  subscribeToBook(bookId, res) {
    if (!this.bookSubscribers.has(bookId)) {
      this.bookSubscribers.set(bookId, new Set());
    }

    this.bookSubscribers.get(bookId).add(res);

    // Clean up on client disconnect
    res.on('close', () => {
      this.unsubscribeFromBook(bookId, res);
    });

    logger.debug('BookUpdateService: Client subscribed to book', { bookId });
  }

  /**
   * Unsubscribe from book updates for a specific book
   * @param {string} bookId
   * @param {Object} res
   */
  unsubscribeFromBook(bookId, res) {
    const subscribers = this.bookSubscribers.get(bookId);
    if (subscribers) {
      subscribers.delete(res);
      if (subscribers.size === 0) {
        this.bookSubscribers.delete(bookId);
      }
    }

    logger.debug('BookUpdateService: Client unsubscribed from book', { bookId });
  }

  /**
   * Associate a book with a conversation
   * @param {string} conversationId
   * @param {string} bookId
   */
  setBookForConversation(conversationId, bookId) {
    this.booksByConversation.set(conversationId, bookId);
    logger.debug('BookUpdateService: Book associated with conversation', {
      conversationId,
      bookId,
    });
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
        ...data,
      });
    }

    // Also send updates to book-specific subscribers
    this.sendUpdateToBookSubscribers(bookId, updateType, {
      bookId,
      timestamp: new Date().toISOString(),
      ...data,
    });

    // Auto-trigger export for content changes (but not for export_ready to avoid loops)
    if (updateType === 'book_updated' && relevantConversations.length > 0) {
      // Trigger export for the first conversation (they all point to the same book)
      const conversationId = relevantConversations[0];
      setTimeout(() => {
        this.triggerExportWithNotification(bookId, conversationId, { format: 'html' }).catch(
          (error) => {
            logger.warn('BookUpdateService: Auto-export failed after book update', {
              error: error.message,
              bookId,
              conversationId,
            });
          },
        );
      }, 1000); // Small delay to ensure book changes are saved
    }

    logger.debug('BookUpdateService: Notified book update', {
      bookId,
      updateType,
      conversations: relevantConversations.length,
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
        ...data,
      },
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

    logger.debug('BookUpdateService: Sent update to conversation', {
      conversationId,
      updateType,
      subscriberCount: subscribers.size,
    });
  }

  /**
   * Send update to book-specific subscribers
   * @param {string} bookId
   * @param {string} updateType
   * @param {Object} data
   */
  sendUpdateToBookSubscribers(bookId, updateType, data) {
    const subscribers = this.bookSubscribers.get(bookId);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const eventData = {
      event: 'book_update',
      data: {
        type: updateType,
        ...data,
      },
    };

    // Send to all book subscribers
    const deadConnections = new Set();
    for (const res of subscribers) {
      try {
        if (!res.finished) {
          res.write(`event: book_update\ndata: ${JSON.stringify(eventData.data)}\n\n`);
        } else {
          deadConnections.add(res);
        }
      } catch (error) {
        logger.warn('BookUpdateService: Failed to send update to book subscriber', {
          error: error.message,
        });
        deadConnections.add(res);
      }
    }

    // Clean up dead connections
    for (const deadRes of deadConnections) {
      subscribers.delete(deadRes);
    }

    logger.debug('BookUpdateService: Sent update to book subscribers', {
      bookId,
      updateType,
      subscriberCount: subscribers.size,
    });
  }

  /**
   * Trigger export and notify when ready
   * @param {string} bookId
   * @param {string} conversationId
   * @param {Object} exportOptions
   * @param {string} [userToken] - Optional user token for authentication
   */
  async triggerExportWithNotification(
    bookId,
    conversationId,
    exportOptions = {},
    userToken = null,
  ) {
    try {
      logger.info('BookUpdateService: Triggering export', { bookId, conversationId });

      const headers = {
        'Content-Type': 'application/json',
      };

      // Add authorization if user token is provided
      if (userToken) {
        headers['Authorization'] = `Bearer ${userToken}`;
      }

      // Generate a better filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
      const filename = `book-${bookId.slice(0, 8)}-${timestamp}.html`;

      // Use the new unauthenticated endpoint for book-creation
      const response = await fetch(
        `${process.env.SERVER_HOST || 'http://localhost:3080'}/api/mcp/book-creation/tools/export_book/call`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            arguments: {
              bookId,
              format: exportOptions.format || 'html',
              includeMetadata: true,
              aliasFilename: filename,
              conversationId: conversationId, // Auto-inject conversationId
              ...exportOptions,
            },
          }),
        },
      );

      logger.info('BookUpdateService: Export response', {
        status: response.status,
        ok: response.ok,
        bookId,
        conversationId,
      });

      if (response.ok) {
        const result = await response.json();
        logger.info('BookUpdateService: Export successful', { result, bookId, conversationId });

        // Extract the actual filename from the export result
        let actualFilename = filename; // Use our generated filename as default
        if (result?.result?.content?.[0]?.text) {
          const exportText = result.result.content[0].text;
          const filenameMatch = exportText.match(/\*\*Filename:\*\*\s*(.+)/);
          if (filenameMatch && filenameMatch[1]) {
            actualFilename = filenameMatch[1].trim();
            logger.info('BookUpdateService: Extracted filename from export result', {
              actualFilename,
            });
          }
        }

        // Generate the full URL for the export
        const exportUrl = `/c/exports/${actualFilename}`;

        // Notify that export is ready
        this.notifyBookUpdate(bookId, 'export_ready', {
          format: exportOptions.format || 'html',
          filename: actualFilename,
          url: exportUrl,
          conversationId,
          timestamp: new Date().toISOString(),
        });
      } else {
        const errorText = await response.text();
        logger.error('BookUpdateService: Export failed', {
          status: response.status,
          error: errorText,
          bookId,
          conversationId,
        });
      }
    } catch (error) {
      logger.error('BookUpdateService: Failed to trigger export', {
        error: error.message,
        bookId,
        conversationId,
      });
    }
  }

  /**
   * Get statistics for monitoring
   * @returns {Object}
   */
  getStats() {
    return {
      totalSubscribers: Array.from(this.subscribers.values()).reduce(
        (sum, set) => sum + set.size,
        0,
      ),
      totalBookSubscribers: Array.from(this.bookSubscribers.values()).reduce(
        (sum, set) => sum + set.size,
        0,
      ),
      activeConversations: this.subscribers.size,
      activeBookConnections: this.bookSubscribers.size,
      bookMappings: this.booksByConversation.size,
    };
  }
}

// Singleton instance
const bookUpdateService = new BookUpdateService();

module.exports = bookUpdateService;
