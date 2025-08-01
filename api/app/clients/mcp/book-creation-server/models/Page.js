const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const { v4: uuidv4 } = require('uuid');

// Define the page schema for page-by-page content generation
const pageSchema = new mongoose.Schema(
    {
        pageId: {
            type: String,
            unique: true,
            required: true,
            index: true,
        },
        chapterId: {
            type: String,
            required: true,
            index: true,
        },
        bookId: {
            type: String,
            required: true,
            index: true,
        },
        user: {
            type: String,
            required: true,
            index: true,
        },
        chapterNumber: {
            type: Number,
            required: true,
            min: 1,
        },
        pageNumber: {
            type: Number,
            required: true,
            min: 1,
        },
        content: {
            type: String,
            required: true,
            maxlength: 5000, // ~2,500 words max per page
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'generating'],
            default: 'generating',
            index: true,
        },
        feedback: {
            type: String,
            trim: true,
            maxlength: 1000,
        },
        wordCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        generationContext: {
            previousPageSummaries: [
                {
                    type: String,
                    maxlength: 500,
                },
            ],
            chapterContext: {
                type: String,
                maxlength: 1000,
            },
            specificRequirements: {
                type: String,
                trim: true,
                maxlength: 1000,
            },
            pageType: {
                type: String,
                enum: ['opening', 'development', 'transition', 'climax', 'conclusion'],
                default: 'development',
            },
        },
        approvedAt: {
            type: Date,
        },
        rejectedAt: {
            type: Date,
        },
        regenerationCount: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    },
);

// Indexes for efficient queries
pageSchema.index({ chapterId: 1, pageNumber: 1 }, { unique: true });
pageSchema.index({ bookId: 1, chapterNumber: 1, pageNumber: 1 }, { unique: true });
pageSchema.index({ user: 1, status: 1 });
pageSchema.index({ chapterId: 1, status: 1 });
pageSchema.index({ pageId: 1, user: 1 }, { unique: true });

// Virtual for estimated reading time (assuming 200 words per minute)
pageSchema.virtual('estimatedReadingTime').get(function () {
    if (!this.wordCount || this.wordCount === 0) {
        return 0;
    }
    return Math.ceil(this.wordCount / 200); // Reading time in minutes
});

// Pre-save middleware to generate pageId and calculate word count
pageSchema.pre('save', function (next) {
    try {
        // Generate pageId if not present
        if (!this.pageId) {
            this.pageId = uuidv4();
        }

        // Calculate word count
        if (this.content) {
            this.wordCount = this.content
                .trim()
                .split(/\s+/)
                .filter((word) => word.length > 0).length;
        }

        next();
    } catch (error) {
        logger.error('[PageModel] Error in pre-save middleware:', error);
        next(error);
    }
});

// Pre-update middleware for findOneAndUpdate operations
pageSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function (next) {
    try {
        const update = this.getUpdate();

        // Calculate word count if content is being updated
        if (update.content || (update.$set && update.$set.content)) {
            const content = update.content || update.$set.content;
            const wordCount = content
                .trim()
                .split(/\s+/)
                .filter((word) => word.length > 0).length;

            if (update.$set) {
                update.$set.wordCount = wordCount;
            } else {
                update.wordCount = wordCount;
            }
        }

        next();
    } catch (error) {
        logger.error('[PageModel] Error in pre-update middleware:', error);
        next(error);
    }
});

/**
 * Static Methods
 */

/**
 * Find pages by chapter with optional filtering
 */
pageSchema.statics.findByChapter = async function (chapterId, userId, options = {}) {
    try {
        const query = { chapterId, user: userId };

        if (options.status) {
            query.status = options.status;
        }

        const pages = await this.find(query).sort({ pageNumber: 1 });
        return pages;
    } catch (error) {
        logger.error('[PageModel] Error finding pages by chapter:', error);
        throw error;
    }
};

/**
 * Find page by ID and user
 */
pageSchema.statics.findByIdAndUser = async function (pageId, userId) {
    try {
        const page = await this.findOne({ pageId, user: userId });
        return page;
    } catch (error) {
        logger.error('[PageModel] Error finding page by ID and user:', error);
        throw error;
    }
};

/**
 * Update page by ID and user
 */
pageSchema.statics.updateByIdAndUser = async function (pageId, userId, updateData) {
    try {
        const page = await this.findOneAndUpdate({ pageId, user: userId }, updateData, {
            new: true,
            runValidators: true,
        });
        return page;
    } catch (error) {
        logger.error('[PageModel] Error updating page:', error);
        throw error;
    }
};

/**
 * Get chapter completion status based on pages
 */
pageSchema.statics.getChapterCompletionStatus = async function (chapterId, userId) {
    try {
        const pages = await this.find({ chapterId, user: userId });

        if (pages.length === 0) {
            return { isComplete: false, totalPages: 0, approvedPages: 0 };
        }

        const approvedPages = pages.filter((page) => page.status === 'approved');
        const pendingPages = pages.filter((page) => page.status === 'pending');
        const rejectedPages = pages.filter((page) => page.status === 'rejected');

        return {
            isComplete:
                approvedPages.length > 0 && pendingPages.length === 0 && rejectedPages.length === 0,
            totalPages: pages.length,
            approvedPages: approvedPages.length,
            pendingPages: pendingPages.length,
            rejectedPages: rejectedPages.length,
            pages: pages.sort((a, b) => a.pageNumber - b.pageNumber),
        };
    } catch (error) {
        logger.error('[PageModel] Error getting chapter completion status:', error);
        throw error;
    }
};

/**
 * Assemble approved pages into chapter content
 */
pageSchema.statics.assembleChapterFromPages = async function (chapterId, userId) {
    try {
        const pages = await this.find({
            chapterId,
            user: userId,
            status: 'approved',
        }).sort({ pageNumber: 1 });

        if (pages.length === 0) {
            return { content: '', wordCount: 0 };
        }

        const content = pages.map((page) => page.content).join('\n\n');
        const totalWordCount = pages.reduce((sum, page) => sum + page.wordCount, 0);

        return {
            content,
            wordCount: totalWordCount,
            pageCount: pages.length,
        };
    } catch (error) {
        logger.error('[PageModel] Error assembling chapter from pages:', error);
        throw error;
    }
};

const Page = mongoose.model('Page', pageSchema);

module.exports = Page;
