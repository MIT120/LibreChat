import { Citation } from '../models/Citation.js';
import { ResearchNote } from '../models/ResearchNote.js';

/**
 * Research Management Service
 * Handles research notes, citations, and bibliography generation
 */
export class ResearchService {
  /**
   * Creates a new research note
   * @param {Object} noteData - Research note data
   * @returns {Promise<Object>} Created research note
   */
  async createResearchNote(noteData) {
    const {
      title,
      content,
      source,
      sourceUrl,
      bookId,
      chapterId,
      authorId,
      tags = [],
      category = 'other',
      reliability = 'unverified',
      notes,
      priority = 'medium',
    } = noteData;

    const researchNote = new ResearchNote({
      title,
      content,
      source,
      sourceUrl,
      bookId,
      chapterId,
      authorId,
      tags,
      category,
      reliability,
      notes,
      priority,
    });

    await researchNote.save();
    return researchNote;
  }

  /**
   * Gets research notes for a book or chapter
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Research notes and metadata
   */
  async getResearchNotes(params) {
    const {
      bookId,
      authorId,
      chapterId,
      category,
      tags,
      reliability,
      priority,
      limit = 50,
      offset = 0,
      sortBy = 'dateAdded',
      sortOrder = 'desc',
    } = params;

    const query = { bookId, authorId };

    if (chapterId) query.chapterId = chapterId;
    if (category) query.category = category;
    if (reliability) query.reliability = reliability;
    if (priority) query.priority = priority;
    if (tags && tags.length > 0) query.tags = { $in: tags };

    const sortField = {};
    sortField[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [notes, total] = await Promise.all([
      ResearchNote.find(query)
        .sort(sortField)
        .limit(limit)
        .skip(offset)
        .populate('chapterId', 'title chapterNumber'),
      ResearchNote.countDocuments(query),
    ]);

    return {
      notes,
      total,
      limit,
      offset,
      hasMore: total > offset + limit,
    };
  }

  /**
   * Updates a research note
   * @param {string} noteId - Research note ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated research note
   */
  async updateResearchNote(noteId, updates) {
    const allowedUpdates = [
      'title',
      'content',
      'source',
      'sourceUrl',
      'tags',
      'category',
      'reliability',
      'notes',
      'priority',
      'isFactChecked',
    ];

    const filteredUpdates = {};
    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    const note = await ResearchNote.findByIdAndUpdate(noteId, filteredUpdates, {
      new: true,
      runValidators: true,
    });

    if (!note) {
      throw new Error('Research note not found');
    }

    return note;
  }

  /**
   * Deletes a research note
   * @param {string} noteId - Research note ID
   * @param {string} authorId - Author ID for verification
   * @returns {Promise<void>}
   */
  async deleteResearchNote(noteId, authorId) {
    const note = await ResearchNote.findOne({ _id: noteId, authorId });

    if (!note) {
      throw new Error('Research note not found or access denied');
    }

    await ResearchNote.findByIdAndDelete(noteId);
  }

  /**
   * Creates a new citation
   * @param {Object} citationData - Citation data
   * @returns {Promise<Object>} Created citation
   */
  async createCitation(citationData) {
    const {
      type,
      title,
      authors = [],
      editors = [],
      publicationInfo = {},
      url,
      doi,
      isbn,
      bookId,
      authorId,
      tags = [],
      notes,
      customFields = {},
    } = citationData;

    const citation = new Citation({
      type,
      title,
      authors,
      editors,
      publicationInfo,
      url,
      doi,
      isbn,
      bookId,
      authorId,
      tags,
      notes,
      customFields,
    });

    // Generate citation key
    citation.generateCitationKey();

    await citation.save();
    return citation;
  }

  /**
   * Gets citations for a book
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Citations and metadata
   */
  async getCitations(params) {
    const {
      bookId,
      authorId,
      type,
      tags,
      limit = 100,
      offset = 0,
      sortBy = 'authors',
      sortOrder = 'asc',
    } = params;

    const query = { bookId, authorId };

    if (type) query.type = type;
    if (tags && tags.length > 0) query.tags = { $in: tags };

    let sortField = {};
    if (sortBy === 'authors') {
      sortField = { 'authors.lastName': sortOrder === 'asc' ? 1 : -1 };
    } else if (sortBy === 'date') {
      sortField = { 'publicationInfo.year': sortOrder === 'asc' ? 1 : -1 };
    } else if (sortBy === 'title') {
      sortField = { title: sortOrder === 'asc' ? 1 : -1 };
    } else {
      sortField[sortBy] = sortOrder === 'asc' ? 1 : -1;
    }

    const [citations, total] = await Promise.all([
      Citation.find(query).sort(sortField).limit(limit).skip(offset),
      Citation.countDocuments(query),
    ]);

    return {
      citations,
      total,
      limit,
      offset,
      hasMore: total > offset + limit,
    };
  }

  /**
   * Updates a citation
   * @param {string} citationId - Citation ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated citation
   */
  async updateCitation(citationId, updates) {
    const allowedUpdates = [
      'type',
      'title',
      'authors',
      'editors',
      'publicationInfo',
      'url',
      'doi',
      'isbn',
      'tags',
      'notes',
      'customFields',
    ];

    const filteredUpdates = {};
    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    const citation = await Citation.findByIdAndUpdate(citationId, filteredUpdates, {
      new: true,
      runValidators: true,
    });

    if (!citation) {
      throw new Error('Citation not found');
    }

    // Regenerate citation key if relevant fields changed
    if (updates.authors || updates.title || updates.publicationInfo) {
      citation.generateCitationKey();
      await citation.save();
    }

    return citation;
  }

  /**
   * Deletes a citation
   * @param {string} citationId - Citation ID
   * @param {string} authorId - Author ID for verification
   * @returns {Promise<void>}
   */
  async deleteCitation(citationId, authorId) {
    const citation = await Citation.findOne({ _id: citationId, authorId });

    if (!citation) {
      throw new Error('Citation not found or access denied');
    }

    await Citation.findByIdAndDelete(citationId);
  }

  /**
   * Generates a bibliography for a book
   * @param {Object} params - Bibliography parameters
   * @returns {Promise<Object>} Generated bibliography
   */
  async generateBibliography(params) {
    const {
      bookId,
      authorId,
      style = 'apa',
      sortBy = 'authors',
      filterByChapter,
      includeTags,
      excludeTypes = [],
    } = params;

    const query = { bookId, authorId };

    if (filterByChapter) {
      query.usedInChapters = filterByChapter;
    }

    if (includeTags && includeTags.length > 0) {
      query.tags = { $in: includeTags };
    }

    if (excludeTypes.length > 0) {
      query.type = { $nin: excludeTypes };
    }

    let sortField = {};
    if (sortBy === 'authors') {
      sortField = { 'authors.lastName': 1 };
    } else if (sortBy === 'date') {
      sortField = { 'publicationInfo.year': -1 };
    } else if (sortBy === 'title') {
      sortField = { title: 1 };
    }

    const citations = await Citation.find(query).sort(sortField);

    const formattedCitations = citations.map((citation) => {
      let formatted = '';

      switch (style.toLowerCase()) {
        case 'apa':
          formatted = Citation.generateAPA(citation);
          break;
        case 'mla':
          formatted = Citation.generateMLA(citation);
          break;
        default:
          formatted = `${citation.formattedAuthors}. ${citation.title}. ${citation.publicationInfo?.year || 'n.d.'}`;
      }

      return {
        id: citation._id,
        formatted,
        citationKey: citation.citationKey,
        type: citation.type,
        shortCitation: citation.shortCitation,
      };
    });

    return {
      style,
      totalCitations: citations.length,
      citations: formattedCitations,
      generatedAt: new Date(),
      sortBy,
    };
  }

  /**
   * Gets research statistics for a book
   * @param {string} bookId - Book ID
   * @param {string} authorId - Author ID
   * @returns {Promise<Object>} Research statistics
   */
  async getResearchStatistics(bookId, authorId) {
    const [
      totalNotes,
      totalCitations,
      notesByCategory,
      notesByReliability,
      citationsByType,
      factCheckedCount,
      highPriorityCount,
    ] = await Promise.all([
      ResearchNote.countDocuments({ bookId, authorId }),
      Citation.countDocuments({ bookId, authorId }),
      ResearchNote.aggregate([
        { $match: { bookId: bookId, authorId } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
      ResearchNote.aggregate([
        { $match: { bookId: bookId, authorId } },
        { $group: { _id: '$reliability', count: { $sum: 1 } } },
      ]),
      Citation.aggregate([
        { $match: { bookId: bookId, authorId } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
      ResearchNote.countDocuments({ bookId, authorId, isFactChecked: true }),
      ResearchNote.countDocuments({ bookId, authorId, priority: 'high' }),
    ]);

    return {
      overview: {
        totalNotes,
        totalCitations,
        factCheckedNotes: factCheckedCount,
        highPriorityNotes: highPriorityCount,
      },
      breakdown: {
        notesByCategory: notesByCategory.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        notesByReliability: notesByReliability.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        citationsByType: citationsByType.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
      },
    };
  }

  /**
   * Searches research notes and citations
   * @param {Object} params - Search parameters
   * @returns {Promise<Object>} Search results
   */
  async searchResearch(params) {
    const {
      bookId,
      authorId,
      query,
      searchNotes = true,
      searchCitations = true,
      limit = 20,
    } = params;

    const searchQuery = {
      bookId,
      authorId,
      $text: { $search: query },
    };

    const results = { notes: [], citations: [] };

    if (searchNotes) {
      results.notes = await ResearchNote.find(searchQuery)
        .limit(limit)
        .sort({ score: { $meta: 'textScore' } });
    }

    if (searchCitations) {
      results.citations = await Citation.find(searchQuery)
        .limit(limit)
        .sort({ score: { $meta: 'textScore' } });
    }

    return {
      query,
      results,
      totalResults: results.notes.length + results.citations.length,
    };
  }
}
