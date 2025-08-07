import mongoose from 'mongoose';

/**
 * Citation Model
 * Represents bibliographic citations and references for academic/non-fiction books
 */
const citationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'book',
        'journal_article',
        'website',
        'newspaper',
        'magazine',
        'thesis',
        'conference_paper',
        'government_document',
        'interview',
        'podcast',
        'video',
        'blog_post',
        'other',
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxLength: 500,
    },
    authors: [
      {
        firstName: String,
        lastName: String,
        fullName: String,
      },
    ],
    editors: [
      {
        firstName: String,
        lastName: String,
        fullName: String,
      },
    ],
    publicationInfo: {
      publisher: String,
      journal: String,
      volume: String,
      issue: String,
      pages: String,
      edition: String,
      year: Number,
      month: String,
      day: Number,
    },
    url: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: 'Invalid URL format',
      },
    },
    doi: {
      type: String,
      trim: true,
    },
    isbn: {
      type: String,
      trim: true,
    },
    dateAccessed: {
      type: Date,
      default: Date.now,
    },
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
    },
    authorId: {
      type: String,
      required: true,
    },
    tags: [
      {
        type: String,
        trim: true,
        maxLength: 50,
      },
    ],
    notes: {
      type: String,
      trim: true,
      maxLength: 2000,
    },
    citationKey: {
      type: String,
      trim: true,
      unique: true,
      sparse: true, // Allows multiple null values
    },
    usedInChapters: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chapter',
      },
    ],
    customFields: {
      type: Map,
      of: String,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for efficient querying
citationSchema.index({ bookId: 1, authorId: 1 });
citationSchema.index({ type: 1 });
citationSchema.index({ 'authors.lastName': 1 });
citationSchema.index({ 'publicationInfo.year': -1 });
// citationKey index is automatically created by unique: true constraint
citationSchema.index({ tags: 1 });

// Virtual for formatted author names
citationSchema.virtual('formattedAuthors').get(function () {
  if (!this.authors || this.authors.length === 0) return 'Unknown Author';

  return this.authors
    .map((author) => {
      if (author.fullName) return author.fullName;
      if (author.lastName && author.firstName) {
        return `${author.lastName}, ${author.firstName}`;
      }
      return author.lastName || author.firstName || 'Unknown';
    })
    .join('; ');
});

// Virtual for short citation
citationSchema.virtual('shortCitation').get(function () {
  const author =
    this.authors && this.authors.length > 0
      ? this.authors[0].lastName || this.authors[0].fullName || 'Unknown'
      : 'Unknown';
  const year = this.publicationInfo?.year || 'n.d.';
  return `${author}, ${year}`;
});

// Static method to generate APA citation
citationSchema.statics.generateAPA = function (citation) {
  let apa = '';

  // Authors
  if (citation.authors && citation.authors.length > 0) {
    const authors = citation.authors.map((author) => {
      if (author.fullName) return author.fullName;
      if (author.lastName && author.firstName) {
        return `${author.lastName}, ${author.firstName.charAt(0)}.`;
      }
      return author.lastName || author.firstName || 'Unknown';
    });

    if (authors.length === 1) {
      apa += authors[0];
    } else if (authors.length === 2) {
      apa += `${authors[0]} & ${authors[1]}`;
    } else {
      apa += `${authors[0]} et al.`;
    }
  } else {
    apa += 'Unknown Author';
  }

  // Year
  const year = citation.publicationInfo?.year || 'n.d.';
  apa += ` (${year}). `;

  // Title
  apa += `${citation.title}. `;

  // Publication info based on type
  switch (citation.type) {
    case 'book':
      if (citation.publicationInfo?.publisher) {
        apa += citation.publicationInfo.publisher;
      }
      break;
    case 'journal_article':
      if (citation.publicationInfo?.journal) {
        apa += `*${citation.publicationInfo.journal}*`;
        if (citation.publicationInfo?.volume) {
          apa += `, ${citation.publicationInfo.volume}`;
        }
        if (citation.publicationInfo?.issue) {
          apa += `(${citation.publicationInfo.issue})`;
        }
        if (citation.publicationInfo?.pages) {
          apa += `, ${citation.publicationInfo.pages}`;
        }
      }
      break;
    case 'website':
      if (citation.url) {
        apa += `Retrieved from ${citation.url}`;
      }
      break;
  }

  return apa.trim();
};

// Static method to generate MLA citation
citationSchema.statics.generateMLA = function (citation) {
  let mla = '';

  // Author
  if (citation.authors && citation.authors.length > 0) {
    const firstAuthor = citation.authors[0];
    if (firstAuthor.fullName) {
      mla += firstAuthor.fullName;
    } else if (firstAuthor.lastName && firstAuthor.firstName) {
      mla += `${firstAuthor.lastName}, ${firstAuthor.firstName}`;
    } else {
      mla += firstAuthor.lastName || firstAuthor.firstName || 'Unknown Author';
    }

    if (citation.authors.length > 1) {
      mla += ' et al.';
    }
  } else {
    mla += 'Unknown Author';
  }

  // Title
  mla += `. "${citation.title}." `;

  // Publication info
  if (citation.publicationInfo?.journal) {
    mla += `*${citation.publicationInfo.journal}*`;
    if (citation.publicationInfo?.volume) {
      mla += `, vol. ${citation.publicationInfo.volume}`;
    }
    if (citation.publicationInfo?.issue) {
      mla += `, no. ${citation.publicationInfo.issue}`;
    }
  } else if (citation.publicationInfo?.publisher) {
    mla += citation.publicationInfo.publisher;
  }

  if (citation.publicationInfo?.year) {
    mla += `, ${citation.publicationInfo.year}`;
  }

  if (citation.publicationInfo?.pages) {
    mla += `, pp. ${citation.publicationInfo.pages}`;
  }

  return mla.trim();
};

// Static method to find citations by book
citationSchema.statics.findByBook = function (bookId, authorId, options = {}) {
  const query = { bookId, authorId };

  if (options.type) {
    query.type = options.type;
  }

  if (options.tags && options.tags.length > 0) {
    query.tags = { $in: options.tags };
  }

  let sortField = { 'authors.lastName': 1 };
  if (options.sortBy === 'date') {
    sortField = { 'publicationInfo.year': -1 };
  } else if (options.sortBy === 'title') {
    sortField = { title: 1 };
  }

  return this.find(query)
    .sort(sortField)
    .limit(options.limit || 100)
    .skip(options.offset || 0);
};

// Instance method to generate citation key
citationSchema.methods.generateCitationKey = function () {
  let key = '';

  if (this.authors && this.authors.length > 0) {
    const firstAuthor = this.authors[0];
    const lastName = firstAuthor.lastName || firstAuthor.fullName?.split(' ').pop() || 'Unknown';
    key += lastName.replace(/[^a-zA-Z]/g, '').toLowerCase();
  } else {
    key += 'unknown';
  }

  const year = this.publicationInfo?.year || new Date().getFullYear();
  key += year;

  // Add first word of title
  const titleWord = this.title
    .split(' ')[0]
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase();
  if (titleWord) {
    key += titleWord;
  }

  this.citationKey = key;
  return key;
};

export const Citation = mongoose.model('Citation', citationSchema);
