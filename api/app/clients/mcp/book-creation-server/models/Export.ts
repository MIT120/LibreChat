/**
 * Export Model - Track book export history and metadata
 */

import mongoose from 'mongoose';

export interface IExport {
    _id?: string;
    bookId: string;
    authorId: string;
    conversationId: string;
    format: 'pdf' | 'html' | 'txt' | 'epub' | 'docx';
    filename: string;
    filepath: string;
    size: number;
    version: number;
    metadata: {
        includeMetadata: boolean;
        aliasFilename?: string;
        bookTitle: string;
        bookTheme?: string;
        bookGenre?: string;
        exportOptions?: Record<string, any>;
    };
    status: 'pending' | 'completed' | 'failed' | 'deleted';
    error?: string;
    downloadCount: number;
    lastDownloaded?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const exportSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true,
    },
    bookId: {
        type: String,
        required: true,
        index: true,
    },
    authorId: {
        type: String,
        required: true,
        index: true,
    },
    conversationId: {
        type: String,
        required: true,
        index: true,
    },
    format: {
        type: String,
        required: true,
        enum: ['pdf', 'html', 'txt', 'epub', 'docx'],
        index: true,
    },
    filename: {
        type: String,
        required: true,
        trim: true,
    },
    filepath: {
        type: String,
        required: true,
    },
    size: {
        type: Number,
        required: true,
        min: 0,
    },
    version: {
        type: Number,
        required: true,
        default: 1,
        min: 1,
    },
    metadata: {
        includeMetadata: {
            type: Boolean,
            default: true,
        },
        aliasFilename: {
            type: String,
            trim: true,
        },
        bookTitle: {
            type: String,
            required: true,
            trim: true,
        },
        bookTheme: {
            type: String,
            trim: true,
        },
        bookGenre: {
            type: String,
            trim: true,
        },
        exportOptions: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'deleted'],
        default: 'pending',
        index: true,
    },
    error: {
        type: String,
        trim: true,
    },
    downloadCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    lastDownloaded: {
        type: Date,
    },
}, {
    _id: false,
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// Indexes for efficient queries
exportSchema.index({ bookId: 1, format: 1, status: 1 });
exportSchema.index({ authorId: 1, createdAt: -1 });
exportSchema.index({ conversationId: 1 });
exportSchema.index({ authorId: 1, conversationId: 1 });
exportSchema.index({ bookId: 1, version: -1 });
exportSchema.index({ createdAt: -1 });
exportSchema.index({ status: 1, createdAt: -1 });

// Virtual for URL generation
exportSchema.virtual('url').get(function() {
    return `/c/exports/${this.filename}`;
});

// Virtual for file exists check
exportSchema.virtual('isAvailable').get(function() {
    return this.status === 'completed' && !this.error;
});

// Define interfaces for static and instance methods
interface IExportDocument extends Omit<IExport, '_id'>, mongoose.Document {
    markDownloaded(): Promise<IExportDocument>;
    markDeleted(): Promise<IExportDocument>;
}

interface IExportModel extends mongoose.Model<IExportDocument> {
    getLatestExport(bookId: string, format: string, authorId?: string): Promise<IExportDocument | null>;
    getBookExportHistory(bookId: string, authorId?: string, options?: any): Promise<IExportDocument[]>;
    getNextVersion(bookId: string, format: string): Promise<number>;
}

// Static method to get latest export for a book/format
exportSchema.statics.getLatestExport = function(bookId: string, format: string, authorId?: string) {
    const query: any = { bookId, format, status: 'completed' };
    if (authorId) {
        query.authorId = authorId;
    }
    return this.findOne(query).sort({ version: -1, createdAt: -1 });
};

// Static method to get export history for a book
exportSchema.statics.getBookExportHistory = function(bookId: string, authorId?: string, options: any = {}) {
    const query: any = { bookId };
    if (authorId) {
        query.authorId = authorId;
    }
    
    const { format, status, limit = 50, skip = 0 } = options;
    if (format) query.format = format;
    if (status) query.status = status;
    
    return this.find(query)
        .sort({ createdAt: -1, version: -1 })
        .limit(limit)
        .skip(skip);
};

// Static method to get next version number
exportSchema.statics.getNextVersion = async function(bookId: string, format: string) {
    const latestExport = await this.findOne({ bookId, format })
        .sort({ version: -1 })
        .select('version');
    
    return latestExport ? latestExport.version + 1 : 1;
};

// Method to mark as downloaded
exportSchema.methods.markDownloaded = function() {
    this.downloadCount += 1;
    this.lastDownloaded = new Date();
    return this.save();
};

// Method to mark as deleted
exportSchema.methods.markDeleted = function() {
    this.status = 'deleted';
    return this.save();
};

const Export = mongoose.model<IExportDocument, IExportModel>('Export', exportSchema);

export default Export;
export type { IExportDocument, IExportModel };
