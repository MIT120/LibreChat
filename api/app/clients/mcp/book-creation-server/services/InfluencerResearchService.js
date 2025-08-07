import { v4 as uuidv4 } from 'uuid';
import { InfluencerProfile } from '../models/InfluencerProfile.js';
import { ResearchNote } from '../models/ResearchNote.js';

/**
 * Influencer Research Service
 * Handles comprehensive research and data gathering for influencer biographies
 */
export class InfluencerResearchService {
    /**
     * Initiates research for a new influencer profile
     * @param {Object} profileData - Initial profile data
     * @returns {Promise<Object>} Created influencer profile
     */
    async initiateInfluencerResearch(profileData) {
        const {
            primaryName,
            category,
            bookId,
            authorId,
            initialInfo = {},
            priority = 'medium',
            tags = [],
        } = profileData;

        if (!primaryName || !category || !bookId || !authorId) {
            throw new Error(
                'Missing required fields: primaryName, category, bookId, and authorId are required',
            );
        }

        const profile = new InfluencerProfile({
            _id: uuidv4(),
            primaryName,
            category,
            bookId,
            authorId,
            priority,
            tags,
            status: 'research_started',
            personalInfo: initialInfo.personalInfo || {},
            professionalInfo: initialInfo.professionalInfo || {},
            socialMediaAccounts: initialInfo.socialMediaAccounts || [],
            researchMetadata: {
                researchStarted: new Date(),
                lastUpdated: new Date(),
                completionPercentage: 0,
                verificationStatus: 'unverified',
                researchQuality: 'fair',
            },
        });

        await profile.save();
        return profile;
    }

    /**
     * Gets an influencer profile with full details
     * @param {string} profileId - Profile ID
     * @param {string} authorId - Author ID for verification
     * @returns {Promise<Object>} Influencer profile
     */
    async getInfluencerProfile(profileId, authorId) {
        const profile = await InfluencerProfile.findOne({ _id: profileId, authorId });

        if (!profile) {
            throw new Error('Influencer profile not found or access denied');
        }

        return profile;
    }

    /**
     * Lists influencer profiles for a book
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Profiles and metadata
     */
    async listInfluencerProfiles(params) {
        const {
            bookId,
            authorId,
            category,
            status,
            tags,
            limit = 50,
            offset = 0,
            sortBy = 'lastUpdated',
            sortOrder = 'desc',
        } = params;

        const query = { bookId, authorId };

        if (category) query.category = category;
        if (status) query.status = status;
        if (tags && tags.length > 0) query.tags = { $in: tags };

        let sortField = {};
        if (sortBy === 'lastUpdated') {
            sortField = { 'researchMetadata.lastUpdated': sortOrder === 'desc' ? -1 : 1 };
        } else if (sortBy === 'completion') {
            sortField = { 'researchMetadata.completionPercentage': sortOrder === 'desc' ? -1 : 1 };
        } else if (sortBy === 'name') {
            sortField = { primaryName: sortOrder === 'desc' ? -1 : 1 };
        } else {
            sortField[sortBy] = sortOrder === 'desc' ? -1 : 1;
        }

        const [profiles, total] = await Promise.all([
            InfluencerProfile.find(query).sort(sortField).limit(limit).skip(offset),
            InfluencerProfile.countDocuments(query),
        ]);

        return {
            profiles,
            total,
            limit,
            offset,
            hasMore: total > offset + limit,
        };
    }

    /**
     * Adds social media account data to an influencer profile
     * @param {string} profileId - Profile ID
     * @param {Object} accountData - Social media account data
     * @param {string} authorId - Author ID for verification
     * @returns {Promise<Object>} Updated profile
     */
    async addSocialMediaAccount(profileId, accountData, authorId) {
        const profile = await InfluencerProfile.findOne({ _id: profileId, authorId });

        if (!profile) {
            throw new Error('Influencer profile not found or access denied');
        }

        const {
            platform,
            username,
            handle,
            url,
            followerCount,
            followingCount,
            postCount,
            verificationStatus = false,
            bio,
            joinDate,
            lastActivity,
            engagementRate,
        } = accountData;

        const newAccount = {
            platform,
            username,
            handle,
            url,
            followerCount,
            followingCount,
            postCount,
            verificationStatus,
            bio,
            joinDate,
            lastActivity,
            engagementRate,
        };

        await profile.addSocialMediaAccount(newAccount);
        return profile;
    }

    /**
     * Adds a career milestone to an influencer profile
     * @param {string} profileId - Profile ID
     * @param {Object} milestoneData - Career milestone data
     * @param {string} authorId - Author ID for verification
     * @returns {Promise<Object>} Updated profile
     */
    async addCareerMilestone(profileId, milestoneData, authorId) {
        const profile = await InfluencerProfile.findOne({ _id: profileId, authorId });

        if (!profile) {
            throw new Error('Influencer profile not found or access denied');
        }

        const {
            year,
            event,
            description,
            source,
            sourceUrl,
            significance = 'medium',
            category = 'other',
        } = milestoneData;

        const milestone = {
            year,
            event,
            description,
            source,
            sourceUrl,
            significance,
            category,
        };

        await profile.addCareerMilestone(milestone);
        return profile;
    }

    /**
     * Updates personal information for an influencer
     * @param {string} profileId - Profile ID
     * @param {Object} personalData - Personal information data
     * @param {string} authorId - Author ID for verification
     * @returns {Promise<Object>} Updated profile
     */
    async updatePersonalInfo(profileId, personalData, authorId) {
        const profile = await InfluencerProfile.findOne({ _id: profileId, authorId });

        if (!profile) {
            throw new Error('Influencer profile not found or access denied');
        }

        // Merge new personal data with existing
        if (personalData.fullName) profile.personalInfo.fullName = personalData.fullName;
        if (personalData.knownAs) profile.personalInfo.knownAs = personalData.knownAs;
        if (personalData.dateOfBirth) profile.personalInfo.dateOfBirth = personalData.dateOfBirth;
        if (personalData.birthPlace) profile.personalInfo.birthPlace = personalData.birthPlace;
        if (personalData.nationality) profile.personalInfo.nationality = personalData.nationality;
        if (personalData.currentLocation)
            profile.personalInfo.currentLocation = personalData.currentLocation;
        if (personalData.education) profile.personalInfo.education = personalData.education;
        if (personalData.family)
            profile.personalInfo.family = { ...profile.personalInfo.family, ...personalData.family };
        if (personalData.languages) profile.personalInfo.languages = personalData.languages;
        if (personalData.interests) profile.personalInfo.interests = personalData.interests;
        if (personalData.skills) profile.personalInfo.skills = personalData.skills;

        profile.researchMetadata.lastUpdated = new Date();
        await profile.save();
        return profile;
    }

    /**
     * Updates professional information for an influencer
     * @param {string} profileId - Profile ID
     * @param {Object} professionalData - Professional information data
     * @param {string} authorId - Author ID for verification
     * @returns {Promise<Object>} Updated profile
     */
    async updateProfessionalInfo(profileId, professionalData, authorId) {
        const profile = await InfluencerProfile.findOne({ _id: profileId, authorId });

        if (!profile) {
            throw new Error('Influencer profile not found or access denied');
        }

        // Merge new professional data with existing
        if (professionalData.primaryOccupation)
            profile.professionalInfo.primaryOccupation = professionalData.primaryOccupation;
        if (professionalData.industry) profile.professionalInfo.industry = professionalData.industry;
        if (professionalData.specializations)
            profile.professionalInfo.specializations = professionalData.specializations;
        if (professionalData.companies) profile.professionalInfo.companies = professionalData.companies;
        if (professionalData.achievements)
            profile.professionalInfo.achievements = professionalData.achievements;
        if (professionalData.collaborations)
            profile.professionalInfo.collaborations = professionalData.collaborations;
        if (professionalData.netWorth) profile.professionalInfo.netWorth = professionalData.netWorth;
        if (professionalData.businessVentures)
            profile.professionalInfo.businessVentures = professionalData.businessVentures;

        profile.researchMetadata.lastUpdated = new Date();
        await profile.save();
        return profile;
    }

    /**
     * Adds a controversy record to an influencer profile
     * @param {string} profileId - Profile ID
     * @param {Object} controversyData - Controversy data
     * @param {string} authorId - Author ID for verification
     * @returns {Promise<Object>} Updated profile
     */
    async addControversy(profileId, controversyData, authorId) {
        const profile = await InfluencerProfile.findOne({ _id: profileId, authorId });

        if (!profile) {
            throw new Error('Influencer profile not found or access denied');
        }

        const {
            title,
            description,
            date,
            severity,
            category = 'other',
            resolution,
            impact = 'medium',
            sources = [],
        } = controversyData;

        const controversy = {
            title,
            description,
            date,
            severity,
            category,
            resolution,
            impact,
            sources,
        };

        profile.controversies.push(controversy);
        profile.researchMetadata.lastUpdated = new Date();
        await profile.save();
        return profile;
    }

    /**
     * Updates content analysis for an influencer
     * @param {string} profileId - Profile ID
     * @param {Object} contentData - Content analysis data
     * @param {string} authorId - Author ID for verification
     * @returns {Promise<Object>} Updated profile
     */
    async updateContentAnalysis(profileId, contentData, authorId) {
        const profile = await InfluencerProfile.findOne({ _id: profileId, authorId });

        if (!profile) {
            throw new Error('Influencer profile not found or access denied');
        }

        // Merge content analysis data
        if (contentData.totalPosts !== undefined)
            profile.contentAnalysis.totalPosts = contentData.totalPosts;
        if (contentData.averageEngagement !== undefined)
            profile.contentAnalysis.averageEngagement = contentData.averageEngagement;
        if (contentData.topicCategories)
            profile.contentAnalysis.topicCategories = contentData.topicCategories;
        if (contentData.commonHashtags)
            profile.contentAnalysis.commonHashtags = contentData.commonHashtags;
        if (contentData.postingFrequency)
            profile.contentAnalysis.postingFrequency = contentData.postingFrequency;
        if (contentData.bestPerformingContent)
            profile.contentAnalysis.bestPerformingContent = contentData.bestPerformingContent;
        if (contentData.contentStyle) profile.contentAnalysis.contentStyle = contentData.contentStyle;

        profile.researchMetadata.lastUpdated = new Date();
        await profile.save();
        return profile;
    }

    /**
     * Adds external sources and references
     * @param {string} profileId - Profile ID
     * @param {Object} sourceData - External source data
     * @param {string} authorId - Author ID for verification
     * @returns {Promise<Object>} Updated profile
     */
    async addExternalSource(profileId, sourceData, authorId) {
        const profile = await InfluencerProfile.findOne({ _id: profileId, authorId });

        if (!profile) {
            throw new Error('Influencer profile not found or access denied');
        }

        const { type, url, title, description, reliability = 'medium' } = sourceData;

        const source = {
            type,
            url,
            title,
            description,
            dateAccessed: new Date(),
            reliability,
        };

        profile.externalSources.push(source);
        profile.researchMetadata.sourcesCount = profile.externalSources.length;
        profile.researchMetadata.lastUpdated = new Date();
        await profile.save();
        return profile;
    }

    /**
     * Updates research progress and status
     * @param {string} profileId - Profile ID
     * @param {Object} progressData - Progress data
     * @param {string} authorId - Author ID for verification
     * @returns {Promise<Object>} Updated profile
     */
    async updateResearchProgress(profileId, progressData, authorId) {
        const profile = await InfluencerProfile.findOne({ _id: profileId, authorId });

        if (!profile) {
            throw new Error('Influencer profile not found or access denied');
        }

        const { completionPercentage, verificationStatus, researchQuality, dataGaps, researchNotes } =
            progressData;

        if (completionPercentage !== undefined) {
            await profile.updateResearchProgress(completionPercentage, researchNotes);
        }

        if (verificationStatus) profile.researchMetadata.verificationStatus = verificationStatus;
        if (researchQuality) profile.researchMetadata.researchQuality = researchQuality;
        if (dataGaps) profile.researchMetadata.dataGaps = dataGaps;

        return profile;
    }

    /**
     * Generates research summary for an influencer
     * @param {string} profileId - Profile ID
     * @param {string} authorId - Author ID for verification
     * @returns {Promise<Object>} Research summary
     */
    async generateResearchSummary(profileId, authorId) {
        const profile = await InfluencerProfile.findOne({ _id: profileId, authorId });

        if (!profile) {
            throw new Error('Influencer profile not found or access denied');
        }

        // Calculate research metrics
        const totalSocialAccounts = profile.socialMediaAccounts.length;
        const totalFollowers = profile.totalFollowers;
        const mainPlatform = profile.mainPlatform;
        const totalMilestones = profile.careerMilestones.length;
        const totalSources = profile.externalSources.length;
        const totalControversies = profile.controversies.length;

        // Research completeness assessment
        const completenessFactors = {
            basicInfo: profile.personalInfo.fullName ? 10 : 0,
            socialMedia: Math.min(totalSocialAccounts * 5, 20),
            career: Math.min(totalMilestones * 3, 15),
            professional: profile.professionalInfo.primaryOccupation ? 10 : 0,
            content: profile.contentAnalysis.totalPosts ? 15 : 0,
            sources: Math.min(totalSources * 2, 20),
            verification:
                profile.researchMetadata.verificationStatus === 'verified'
                    ? 10
                    : profile.researchMetadata.verificationStatus === 'partially_verified'
                        ? 5
                        : 0,
        };

        const calculatedCompletion = Object.values(completenessFactors).reduce(
            (sum, score) => sum + score,
            0,
        );

        // Update completion percentage if calculated value is higher
        if (calculatedCompletion > profile.researchMetadata.completionPercentage) {
            profile.researchMetadata.completionPercentage = calculatedCompletion;
            await profile.save();
        }

        return {
            profile: {
                id: profile._id,
                name: profile.primaryName,
                category: profile.category,
                status: profile.status,
            },
            metrics: {
                completionPercentage: profile.researchMetadata.completionPercentage,
                researchQuality: profile.researchMetadata.researchQuality,
                verificationStatus: profile.researchMetadata.verificationStatus,
                totalSocialAccounts,
                totalFollowers,
                mainPlatform: mainPlatform ? mainPlatform.platform : null,
                totalMilestones,
                totalSources,
                totalControversies,
            },
            dataGaps: profile.researchMetadata.dataGaps || [],
            lastUpdated: profile.researchMetadata.lastUpdated,
            researchDuration: Math.floor(
                (new Date() - profile.researchMetadata.researchStarted) / (1000 * 60 * 60 * 24),
            ),
            completenessBreakdown: completenessFactors,
        };
    }

    /**
     * Searches influencer profiles and related research data
     * @param {Object} params - Search parameters
     * @returns {Promise<Object>} Search results
     */
    async searchInfluencerData(params) {
        const {
            bookId,
            authorId,
            query,
            searchProfiles = true,
            searchNotes = true,
            limit = 20,
        } = params;

        const results = { profiles: [], researchNotes: [] };

        if (searchProfiles) {
            // Search in profile names, categories, and tags
            const profileQuery = {
                bookId,
                authorId,
                $or: [
                    { primaryName: { $regex: query, $options: 'i' } },
                    { category: { $regex: query, $options: 'i' } },
                    { tags: { $in: [new RegExp(query, 'i')] } },
                    { 'personalInfo.fullName': { $regex: query, $options: 'i' } },
                    { 'professionalInfo.primaryOccupation': { $regex: query, $options: 'i' } },
                ],
            };

            results.profiles = await InfluencerProfile.find(profileQuery)
                .limit(limit)
                .sort({ 'researchMetadata.lastUpdated': -1 });
        }

        if (searchNotes) {
            // Search related research notes
            const noteQuery = {
                bookId,
                authorId,
                $or: [
                    { title: { $regex: query, $options: 'i' } },
                    { content: { $regex: query, $options: 'i' } },
                    { tags: { $in: [new RegExp(query, 'i')] } },
                ],
            };

            results.researchNotes = await ResearchNote.find(noteQuery)
                .limit(limit)
                .sort({ dateAdded: -1 });
        }

        return {
            query,
            results,
            totalResults: results.profiles.length + results.researchNotes.length,
        };
    }

    /**
     * Gets research statistics for all influencer profiles in a book
     * @param {string} bookId - Book ID
     * @param {string} authorId - Author ID
     * @returns {Promise<Object>} Research statistics
     */
    async getInfluencerResearchStatistics(bookId, authorId) {
        const [
            totalProfiles,
            profilesByStatus,
            profilesByCategory,
            averageCompletion,
            totalFollowers,
            totalSources,
        ] = await Promise.all([
            InfluencerProfile.countDocuments({ bookId, authorId }),
            InfluencerProfile.aggregate([
                { $match: { bookId, authorId } },
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),
            InfluencerProfile.aggregate([
                { $match: { bookId, authorId } },
                { $group: { _id: '$category', count: { $sum: 1 } } },
            ]),
            InfluencerProfile.aggregate([
                { $match: { bookId, authorId } },
                {
                    $group: { _id: null, avgCompletion: { $avg: '$researchMetadata.completionPercentage' } },
                },
            ]),
            InfluencerProfile.aggregate([
                { $match: { bookId, authorId } },
                { $unwind: '$socialMediaAccounts' },
                { $group: { _id: null, total: { $sum: '$socialMediaAccounts.followerCount' } } },
            ]),
            InfluencerProfile.aggregate([
                { $match: { bookId, authorId } },
                { $group: { _id: null, totalSources: { $sum: { $size: '$externalSources' } } } },
            ]),
        ]);

        return {
            overview: {
                totalProfiles,
                averageCompletion: averageCompletion[0]?.avgCompletion || 0,
                totalFollowers: totalFollowers[0]?.total || 0,
                totalSources: totalSources[0]?.totalSources || 0,
            },
            breakdown: {
                profilesByStatus: profilesByStatus.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {}),
                profilesByCategory: profilesByCategory.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {}),
            },
        };
    }

    /**
     * Deletes an influencer profile and related data
     * @param {string} profileId - Profile ID
     * @param {string} authorId - Author ID for verification
     * @returns {Promise<void>}
     */
    async deleteInfluencerProfile(profileId, authorId) {
        const profile = await InfluencerProfile.findOne({ _id: profileId, authorId });

        if (!profile) {
            throw new Error('Influencer profile not found or access denied');
        }

        await InfluencerProfile.findByIdAndDelete(profileId);
    }
}
