import mongoose from 'mongoose';

/**
 * Influencer Profile Model
 * Stores comprehensive data about influencers for autobiography creation
 */
const SocialMediaAccountSchema = new mongoose.Schema(
    {
        platform: {
            type: String,
            enum: [
                'twitter',
                'instagram',
                'youtube',
                'tiktok',
                'linkedin',
                'facebook',
                'twitch',
                'snapchat',
                'pinterest',
                'reddit',
                'discord',
                'clubhouse',
                'threads',
                'other',
            ],
            required: true,
        },
        username: {
            type: String,
            required: true,
            trim: true,
        },
        handle: {
            type: String,
            trim: true,
        },
        url: {
            type: String,
            trim: true,
        },
        followerCount: {
            type: Number,
            min: 0,
        },
        followingCount: {
            type: Number,
            min: 0,
        },
        postCount: {
            type: Number,
            min: 0,
        },
        verificationStatus: {
            type: Boolean,
            default: false,
        },
        bio: {
            type: String,
            trim: true,
            maxLength: 1000,
        },
        joinDate: {
            type: Date,
        },
        lastActivity: {
            type: Date,
        },
        engagementRate: {
            type: Number,
            min: 0,
            max: 100,
        },
    },
    { _id: false },
);

const CareerMilestoneSchema = new mongoose.Schema(
    {
        year: {
            type: Number,
            required: true,
        },
        event: {
            type: String,
            required: true,
            trim: true,
            maxLength: 500,
        },
        description: {
            type: String,
            trim: true,
            maxLength: 2000,
        },
        source: {
            type: String,
            trim: true,
        },
        sourceUrl: {
            type: String,
            trim: true,
        },
        significance: {
            type: String,
            enum: ['high', 'medium', 'low'],
            default: 'medium',
        },
        category: {
            type: String,
            enum: [
                'award',
                'achievement',
                'collaboration',
                'controversy',
                'career_change',
                'breakthrough',
                'milestone',
                'personal',
                'other',
            ],
            default: 'other',
        },
    },
    { _id: false },
);

const ContentAnalysisSchema = new mongoose.Schema(
    {
        totalPosts: {
            type: Number,
            min: 0,
        },
        averageEngagement: {
            type: Number,
            min: 0,
        },
        topicCategories: [
            {
                category: String,
                percentage: {
                    type: Number,
                    min: 0,
                    max: 100,
                },
            },
        ],
        commonHashtags: [String],
        postingFrequency: {
            type: String,
            enum: ['daily', 'weekly', 'monthly', 'irregular'],
        },
        bestPerformingContent: [
            {
                url: String,
                description: String,
                engagementMetrics: {
                    likes: Number,
                    shares: Number,
                    comments: Number,
                },
            },
        ],
        contentStyle: {
            type: String,
            enum: ['educational', 'entertainment', 'lifestyle', 'promotional', 'mixed'],
            default: 'mixed',
        },
    },
    { _id: false },
);

const PersonalInfoSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            trim: true,
            maxLength: 200,
        },
        knownAs: [String], // nicknames, stage names, etc.
        dateOfBirth: {
            type: Date,
        },
        birthPlace: {
            type: String,
            trim: true,
            maxLength: 200,
        },
        nationality: {
            type: String,
            trim: true,
            maxLength: 100,
        },
        currentLocation: {
            type: String,
            trim: true,
            maxLength: 200,
        },
        education: [
            {
                institution: String,
                degree: String,
                field: String,
                year: Number,
            },
        ],
        family: {
            spouse: String,
            children: Number,
            siblings: [String],
            parents: [String],
        },
        languages: [String],
        interests: [String],
        skills: [String],
    },
    { _id: false },
);

const ProfessionalInfoSchema = new mongoose.Schema(
    {
        primaryOccupation: {
            type: String,
            trim: true,
            maxLength: 200,
        },
        industry: {
            type: String,
            trim: true,
            maxLength: 100,
        },
        specializations: [String],
        companies: [
            {
                name: String,
                role: String,
                startDate: Date,
                endDate: Date,
                description: String,
            },
        ],
        achievements: [
            {
                title: String,
                year: Number,
                description: String,
                source: String,
            },
        ],
        collaborations: [
            {
                name: String,
                type: String, // brand, person, organization
                description: String,
                year: Number,
            },
        ],
        netWorth: {
            estimated: Number,
            currency: String,
            year: Number,
            source: String,
        },
        businessVentures: [
            {
                name: String,
                type: String,
                description: String,
                startDate: Date,
                status: String, // active, sold, closed
            },
        ],
    },
    { _id: false },
);

const ControversySchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxLength: 300,
        },
        description: {
            type: String,
            required: true,
            trim: true,
        },
        date: {
            type: Date,
            required: true,
        },
        severity: {
            type: String,
            enum: ['minor', 'moderate', 'major'],
            required: true,
        },
        category: {
            type: String,
            enum: [
                'legal',
                'ethical',
                'professional',
                'personal',
                'financial',
                'public_statement',
                'behavior',
                'other',
            ],
            default: 'other',
        },
        resolution: {
            type: String,
            trim: true,
        },
        impact: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium',
        },
        sources: [String],
    },
    { _id: false },
);

const ResearchMetadataSchema = new mongoose.Schema(
    {
        researchStarted: {
            type: Date,
            default: Date.now,
        },
        lastUpdated: {
            type: Date,
            default: Date.now,
        },
        sourcesCount: {
            type: Number,
            default: 0,
        },
        completionPercentage: {
            type: Number,
            min: 0,
            max: 100,
            default: 0,
        },
        verificationStatus: {
            type: String,
            enum: ['unverified', 'partially_verified', 'verified'],
            default: 'unverified',
        },
        researchQuality: {
            type: String,
            enum: ['poor', 'fair', 'good', 'excellent'],
            default: 'fair',
        },
        dataGaps: [String], // areas where more research is needed
        researchNotes: {
            type: String,
            trim: true,
        },
    },
    { _id: false },
);

const InfluencerProfileSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            required: true,
        },
        // Basic identification
        primaryName: {
            type: String,
            required: true,
            trim: true,
            maxLength: 200,
        },
        category: {
            type: String,
            required: true,
            enum: [
                'content_creator',
                'entrepreneur',
                'athlete',
                'musician',
                'actor',
                'author',
                'scientist',
                'politician',
                'activist',
                'chef',
                'fashion',
                'beauty',
                'gaming',
                'fitness',
                'tech',
                'education',
                'lifestyle',
                'other',
            ],
        },

        // Core information sections
        personalInfo: PersonalInfoSchema,
        professionalInfo: ProfessionalInfoSchema,
        socialMediaAccounts: [SocialMediaAccountSchema],
        careerMilestones: [CareerMilestoneSchema],
        contentAnalysis: ContentAnalysisSchema,
        controversies: [ControversySchema],

        // Book-related fields
        bookId: {
            type: String,
            required: true,
            ref: 'Book',
        },
        authorId: {
            type: String,
            required: true,
        },

        // Research tracking
        researchMetadata: {
            type: ResearchMetadataSchema,
            default: {},
        },

        // Media and content
        photos: [
            {
                url: String,
                description: String,
                date: Date,
                source: String,
            },
        ],
        videos: [
            {
                url: String,
                title: String,
                description: String,
                platform: String,
                viewCount: Number,
                publishDate: Date,
            },
        ],

        // External sources and references
        externalSources: [
            {
                type: String,
                url: String,
                title: String,
                description: String,
                dateAccessed: Date,
                reliability: {
                    type: String,
                    enum: ['high', 'medium', 'low'],
                    default: 'medium',
                },
            },
        ],

        // Status and metadata
        status: {
            type: String,
            enum: ['research_started', 'data_gathering', 'verification', 'completed'],
            default: 'research_started',
        },
        priority: {
            type: String,
            enum: ['high', 'medium', 'low'],
            default: 'medium',
        },
        tags: [String],
        notes: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
    },
);

// Indexes for efficient querying
InfluencerProfileSchema.index({ bookId: 1, authorId: 1 });
InfluencerProfileSchema.index({ primaryName: 1 });
InfluencerProfileSchema.index({ category: 1 });
InfluencerProfileSchema.index({ status: 1 });
InfluencerProfileSchema.index({ 'researchMetadata.completionPercentage': 1 });

// Virtual fields
InfluencerProfileSchema.virtual('totalFollowers').get(function () {
    return this.socialMediaAccounts.reduce((total, account) => {
        return total + (account.followerCount || 0);
    }, 0);
});

InfluencerProfileSchema.virtual('mainPlatform').get(function () {
    if (!this.socialMediaAccounts.length) return null;
    return this.socialMediaAccounts.reduce((main, account) => {
        return account.followerCount > (main.followerCount || 0) ? account : main;
    });
});

// Static methods
InfluencerProfileSchema.statics.findByBook = function (bookId, authorId, options = {}) {
    const query = { bookId, authorId };

    if (options.category) query.category = options.category;
    if (options.status) query.status = options.status;
    if (options.tags && options.tags.length > 0) query.tags = { $in: options.tags };

    return this.find(query)
        .sort({ 'researchMetadata.lastUpdated': -1 })
        .limit(options.limit || 50)
        .skip(options.offset || 0);
};

// Instance methods
InfluencerProfileSchema.methods.updateResearchProgress = function (percentage, notes) {
    this.researchMetadata.completionPercentage = percentage;
    this.researchMetadata.lastUpdated = new Date();
    if (notes) this.researchMetadata.researchNotes = notes;

    // Auto-update status based on completion
    if (percentage >= 90) {
        this.status = 'completed';
    } else if (percentage >= 60) {
        this.status = 'verification';
    } else if (percentage >= 20) {
        this.status = 'data_gathering';
    }

    return this.save();
};

InfluencerProfileSchema.methods.addSocialMediaAccount = function (accountData) {
    // Check if account already exists
    const existing = this.socialMediaAccounts.find(
        (acc) => acc.platform === accountData.platform && acc.username === accountData.username,
    );

    if (!existing) {
        this.socialMediaAccounts.push(accountData);
        this.researchMetadata.lastUpdated = new Date();
        return this.save();
    }

    return Promise.resolve(this);
};

InfluencerProfileSchema.methods.addCareerMilestone = function (milestoneData) {
    this.careerMilestones.push(milestoneData);
    this.careerMilestones.sort((a, b) => a.year - b.year);
    this.researchMetadata.lastUpdated = new Date();
    return this.save();
};

export const InfluencerProfile = mongoose.model('InfluencerProfile', InfluencerProfileSchema);
