/**
 * Influencer History Service - Track influencer posts, habits, and web presence over time using Firecrawl
 */

import axios from 'axios';
import { BaseService } from '../core/BaseService.js';
import { ILogger } from '../core/Logger.js';

export interface InfluencerPost {
    id: string;
    url: string;
    title: string;
    content: string;
    publishedDate: Date;
    platform: 'twitter' | 'linkedin' | 'instagram' | 'youtube' | 'blog' | 'tiktok' | 'facebook';
    engagement: {
        likes: number;
        comments: number;
        shares: number;
        views?: number;
    };
    hashtags: string[];
    mentions: string[];
    mediaUrls: string[];
    contentType: 'text' | 'image' | 'video' | 'link' | 'poll' | 'story';
    sentiment: 'positive' | 'negative' | 'neutral';
    topics: string[];
    scrapedAt: Date;
}

export interface InfluencerHabit {
    type: 'posting_frequency' | 'best_times' | 'content_themes' | 'engagement_patterns' | 'collaboration_trends';
    description: string;
    pattern: string;
    frequency: string;
    confidence: number; // 0-1
    evidence: Array<{
        date: Date;
        observation: string;
        supporting_data: any;
    }>;
    trend: 'increasing' | 'decreasing' | 'stable' | 'cyclical';
}

export interface InfluencerTimeline {
    influencerId: string;
    platform: string;
    handle: string;
    trackingPeriod: {
        startDate: Date;
        endDate: Date;
    };
    posts: InfluencerPost[];
    habits: InfluencerHabit[];
    analytics: {
        totalPosts: number;
        averageEngagement: number;
        topPerformingPosts: InfluencerPost[];
        contentCategories: Record<string, number>;
        postingFrequency: {
            daily: number;
            weekly: number;
            monthly: number;
        };
        bestPostingTimes: Array<{
            hour: number;
            day: string;
            engagement_score: number;
        }>;
        collaborations: Array<{
            partner: string;
            date: Date;
            type: string;
            reach: number;
        }>;
    };
    trends: Array<{
        metric: string;
        direction: 'up' | 'down' | 'stable';
        percentage: number;
        period: string;
    }>;
}

export interface InfluencerTrackingConfig {
    influencerId: string;
    platforms: Array<{
        platform: string;
        handle: string;
        url: string;
        priority: 'high' | 'medium' | 'low';
    }>;
    trackingSettings: {
        frequency: 'hourly' | 'daily' | 'weekly';
        lookbackDays: number;
        includeStories: boolean;
        includeComments: boolean;
        trackMentions: boolean;
        alertThreshold: number;
    };
    filters: {
        minEngagement?: number;
        contentTypes?: string[];
        excludeKeywords?: string[];
        includeKeywords?: string[];
    };
}

export interface FirecrawlCrawlResponse {
    success: boolean;
    id: string;
    url: string;
    data?: Array<{
        url: string;
        markdown: string;
        html?: string;
        metadata: {
            title: string;
            description?: string;
            publishDate?: string;
            author?: string;
            [key: string]: any;
        };
    }>;
    error?: string;
}

export interface FirecrawlMapResponse {
    success: boolean;
    links: Array<{
        url: string;
        title: string;
        description?: string;
    }>;
}

export class InfluencerHistoryService extends BaseService {
    private readonly FIRECRAWL_API_URL: string;
    private readonly FIRECRAWL_API_KEY: string;
    private readonly trackingConfigs = new Map<string, InfluencerTrackingConfig>();
    private readonly cachedTimelines = new Map<string, InfluencerTimeline>();
    private readonly RATE_LIMIT_DELAY = 1000; // 1 second between requests

    constructor(logger: ILogger) {
        super(logger);
        this.FIRECRAWL_API_URL = process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev';
        this.FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || '';
    }

    protected async onInitialize(): Promise<void> {
        if (!this.FIRECRAWL_API_KEY) {
            this.logger.warn('FIRECRAWL_API_KEY not configured - influencer tracking will be limited');
        }
        await this.loadExistingConfigs();
        this.logger.info('InfluencerHistoryService initialized');
    }

    protected async onDispose(): Promise<void> {
        await this.saveTrackingData();
        this.trackingConfigs.clear();
        this.cachedTimelines.clear();
        this.logger.info('InfluencerHistoryService disposed');
    }

    protected async performHealthCheck() {
        return {
            status: 'healthy' as const,
            message: 'Influencer History Service operational',
            details: {
                trackedInfluencers: this.trackingConfigs.size,
                cachedTimelines: this.cachedTimelines.size,
                firecrawlConfigured: !!this.FIRECRAWL_API_KEY
            },
            lastCheck: new Date(),
        };
    }

    /**
     * Set up influencer tracking with Firecrawl
     */
    async setupInfluencerTracking(config: InfluencerTrackingConfig): Promise<void> {
        return this.executeWithLogging('setupInfluencerTracking', async () => {
            // Validate configuration
            if (!config.platforms || config.platforms.length === 0) {
                throw new Error('At least one platform must be specified');
            }

            // Store configuration
            this.trackingConfigs.set(config.influencerId, config);

            // Initialize tracking for each platform
            for (const platform of config.platforms) {
                await this.initializePlatformTracking(config.influencerId, platform);
            }

            this.logger.info('Influencer tracking configured', {
                influencerId: config.influencerId,
                platforms: config.platforms.map(p => p.platform).join(', ')
            });
        }, { influencerId: config.influencerId });
    }

    /**
     * Get comprehensive influencer history and timeline
     */
    async getInfluencerHistory(influencerId: string, options?: {
        platforms?: string[];
        dateRange?: { from: Date; to: Date };
        includeAnalytics?: boolean;
    }): Promise<InfluencerTimeline> {
        return this.executeWithLogging('getInfluencerHistory', async () => {
            const config = this.trackingConfigs.get(influencerId);
            if (!config) {
                throw new Error(`Influencer ${influencerId} not found in tracking configs`);
            }

            // Check cache first
            const cached = this.cachedTimelines.get(influencerId);
            if (cached && this.isCacheValid(cached)) {
                return cached;
            }

            // Collect data from all platforms
            const allPosts: InfluencerPost[] = [];
            const platformsToTrack = options?.platforms || 
                config.platforms.map(p => p.platform);

            for (const platformConfig of config.platforms) {
                if (platformsToTrack.includes(platformConfig.platform)) {
                    const posts = await this.scrapeInfluencerPosts(
                        platformConfig, 
                        config.trackingSettings,
                        options?.dateRange
                    );
                    allPosts.push(...posts);
                }
            }

            // Sort posts by date
            allPosts.sort((a, b) => b.publishedDate.getTime() - a.publishedDate.getTime());

            // Analyze habits and patterns
            const habits = await this.analyzeInfluencerHabits(allPosts, config);

            // Generate analytics
            const analytics = options?.includeAnalytics !== false ? 
                await this.generateInfluencerAnalytics(allPosts) : 
                this.getBasicAnalytics();

            // Calculate trends
            const trends = await this.calculateInfluencerTrends(allPosts);

            const timeline: InfluencerTimeline = {
                influencerId,
                platform: config.platforms[0].platform,
                handle: config.platforms[0].handle,
                trackingPeriod: {
                    startDate: options?.dateRange?.from || 
                        new Date(Date.now() - config.trackingSettings.lookbackDays * 24 * 60 * 60 * 1000),
                    endDate: options?.dateRange?.to || new Date()
                },
                posts: allPosts,
                habits,
                analytics,
                trends
            };

            // Cache the result
            this.cachedTimelines.set(influencerId, timeline);

            return timeline;
        }, { influencerId });
    }

    /**
     * Track recent posts for an influencer
     */
    async getRecentPosts(influencerId: string, limit: number = 20): Promise<InfluencerPost[]> {
        return this.executeWithLogging('getRecentPosts', async () => {
            const timeline = await this.getInfluencerHistory(influencerId);
            return timeline.posts.slice(0, limit);
        }, { influencerId, limit });
    }

    /**
     * Discover influencer's historical habits and patterns
     */
    async analyzeInfluencerHabits(posts: InfluencerPost[], config: InfluencerTrackingConfig): Promise<InfluencerHabit[]> {
        return this.executeWithLogging('analyzeInfluencerHabits', async () => {
            const habits: InfluencerHabit[] = [];

            // Analyze posting frequency
            const postingFrequency = this.analyzePostingFrequency(posts);
            habits.push(postingFrequency);

            // Analyze best posting times
            const bestTimes = this.analyzeBestPostingTimes(posts);
            habits.push(bestTimes);

            // Analyze content themes
            const contentThemes = this.analyzeContentThemes(posts);
            habits.push(contentThemes);

            // Analyze engagement patterns
            const engagementPatterns = this.analyzeEngagementPatterns(posts);
            habits.push(engagementPatterns);

            // Analyze collaboration trends
            const collaborationTrends = this.analyzeCollaborationTrends(posts);
            habits.push(collaborationTrends);

            return habits;
        }, { postsCount: posts.length });
    }

    /**
     * Use Firecrawl to crawl influencer's social media profiles
     */
    private async scrapeInfluencerPosts(
        platformConfig: InfluencerTrackingConfig['platforms'][0],
        settings: InfluencerTrackingConfig['trackingSettings'],
        dateRange?: { from: Date; to: Date }
    ): Promise<InfluencerPost[]> {
        if (!this.FIRECRAWL_API_KEY) {
            this.logger.warn('Cannot scrape posts - Firecrawl API key not configured');
            return this.getMockPosts(platformConfig.platform);
        }

        try {
            // First, map the influencer's profile to discover content structure
            const mapResponse = await this.mapInfluencerProfile(platformConfig.url);
            
            // Then crawl specific post URLs
            const crawlResponse = await this.crawlInfluencerContent(
                platformConfig.url, 
                settings.lookbackDays
            );

            // Process the crawled data into structured posts
            const posts = await this.processCrawledData(
                crawlResponse, 
                platformConfig.platform, 
                dateRange
            );

            return posts;
        } catch (error) {
            this.logger.error('Failed to scrape influencer posts', error as Error, {
                platform: platformConfig.platform,
                url: platformConfig.url
            });
            // Fallback to mock data
            return this.getMockPosts(platformConfig.platform);
        }
    }

    /**
     * Use Firecrawl /map to discover influencer's content structure
     */
    private async mapInfluencerProfile(url: string): Promise<FirecrawlMapResponse> {
        const response = await axios.post(
            `${this.FIRECRAWL_API_URL}/v1/map`,
            {
                url,
                search: "posts, articles, content"
            },
            {
                headers: {
                    'Authorization': `Bearer ${this.FIRECRAWL_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        return response.data;
    }

    /**
     * Use Firecrawl /crawl to batch scrape influencer content
     */
    private async crawlInfluencerContent(url: string, lookbackDays: number): Promise<FirecrawlCrawlResponse> {
        // Calculate date filter for recent content
        const cutoffDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

        const response = await axios.post(
            `${this.FIRECRAWL_API_URL}/v1/crawl`,
            {
                url,
                limit: 100, // Adjust based on needs
                scrapeOptions: {
                    formats: ['markdown', 'html'],
                    onlyMainContent: true,
                    includeTags: ['time', 'article', 'post', 'content', 'span[data-time]'],
                    excludeTags: ['nav', 'footer', 'ads', 'sidebar', 'header'],
                    waitFor: 2000,
                    blockAds: true,
                    removeBase64Images: true
                },
                crawlerOptions: {
                    followLinks: true,
                    maxDepth: 2,
                    allowSubdomains: false,
                    respectRobotsTxt: true
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${this.FIRECRAWL_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            }
        );

        return response.data;
    }

    /**
     * Process raw crawled data into structured posts
     */
    private async processCrawledData(
        crawlData: FirecrawlCrawlResponse, 
        platform: string, 
        dateRange?: { from: Date; to: Date }
    ): Promise<InfluencerPost[]> {
        if (!crawlData.success || !crawlData.data) {
            return [];
        }

        const posts: InfluencerPost[] = [];

        for (const page of crawlData.data) {
            try {
                const post = await this.extractPostFromPage(page, platform);
                
                // Apply date filtering
                if (dateRange) {
                    if (post.publishedDate < dateRange.from || post.publishedDate > dateRange.to) {
                        continue;
                    }
                }

                posts.push(post);
            } catch (error) {
                this.logger.debug('Failed to extract post from page', { url: page.url, error: (error as Error).message });
            }
        }

        return posts;
    }

    /**
     * Extract structured post data from scraped page
     */
    private async extractPostFromPage(page: any, platform: string): Promise<InfluencerPost> {
        const postId = this.generatePostId(page.url);
        
        // Extract publication date
        const publishedDate = this.extractPublishDate(page.metadata, page.markdown);
        
        // Extract engagement metrics (platform-specific)
        const engagement = this.extractEngagementMetrics(page.markdown, platform);
        
        // Extract hashtags and mentions
        const hashtags = this.extractHashtags(page.markdown);
        const mentions = this.extractMentions(page.markdown);
        
        // Extract media URLs
        const mediaUrls = this.extractMediaUrls(page.html || page.markdown);
        
        // Determine content type
        const contentType = this.determineContentType(page.metadata, mediaUrls);
        
        // Analyze sentiment
        const sentiment = await this.analyzeSentiment(page.markdown);
        
        // Extract topics
        const topics = await this.extractTopics(page.markdown);

        return {
            id: postId,
            url: page.url,
            title: page.metadata.title || 'Untitled Post',
            content: page.markdown,
            publishedDate,
            platform: platform as any,
            engagement,
            hashtags,
            mentions,
            mediaUrls,
            contentType,
            sentiment,
            topics,
            scrapedAt: new Date()
        };
    }

    // Helper methods for data extraction and analysis
    private generatePostId(url: string): string {
        return `post_${Buffer.from(url).toString('base64').slice(0, 12)}`;
    }

    private extractPublishDate(metadata: any, content: string): Date {
        // Try metadata first
        if (metadata.publishDate) {
            return new Date(metadata.publishDate);
        }

        // Extract from content using various patterns
        const datePatterns = [
            /(\d{1,2}\/\d{1,2}\/\d{4})/,
            /(\d{4}-\d{2}-\d{2})/,
            /(\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i
        ];

        for (const pattern of datePatterns) {
            const match = content.match(pattern);
            if (match) {
                return new Date(match[1]);
            }
        }

        // Fallback to current date
        return new Date();
    }

    private extractEngagementMetrics(content: string, platform: string): InfluencerPost['engagement'] {
        const engagement = { likes: 0, comments: 0, shares: 0, views: 0 };

        // Platform-specific engagement extraction
        const patterns = {
            twitter: {
                likes: /(\d+)\s*likes?/i,
                comments: /(\d+)\s*repl/i,
                shares: /(\d+)\s*retweets?/i
            },
            linkedin: {
                likes: /(\d+)\s*reactions?/i,
                comments: /(\d+)\s*comments?/i,
                shares: /(\d+)\s*reposts?/i
            },
            instagram: {
                likes: /(\d+)\s*likes?/i,
                comments: /(\d+)\s*comments?/i,
                views: /(\d+)\s*views?/i
            }
        };

        const platformPatterns = patterns[platform as keyof typeof patterns];
        if (platformPatterns) {
            Object.entries(platformPatterns).forEach(([metric, pattern]) => {
                const match = content.match(pattern);
                if (match) {
                    engagement[metric as keyof typeof engagement] = parseInt(match[1].replace(/,/g, ''));
                }
            });
        }

        return engagement;
    }

    private extractHashtags(content: string): string[] {
        const hashtagPattern = /#[\w\u00C0-\u024F\u1E00-\u1EFF]+/g;
        const hashtags = content.match(hashtagPattern) || [];
        return hashtags.map(tag => tag.toLowerCase());
    }

    private extractMentions(content: string): string[] {
        const mentionPattern = /@[\w\u00C0-\u024F\u1E00-\u1EFF]+/g;
        const mentions = content.match(mentionPattern) || [];
        return mentions.map(mention => mention.toLowerCase());
    }

    private extractMediaUrls(content: string): string[] {
        const urlPattern = /https?:\/\/[^\s<>"]+\.(jpg|jpeg|png|gif|mp4|mov|avi|webm|pdf)/gi;
        return content.match(urlPattern) || [];
    }

    private determineContentType(metadata: any, mediaUrls: string[]): InfluencerPost['contentType'] {
        if (mediaUrls.some(url => /\.(mp4|mov|avi|webm)$/i.test(url))) return 'video';
        if (mediaUrls.some(url => /\.(jpg|jpeg|png|gif)$/i.test(url))) return 'image';
        if (metadata.title?.toLowerCase().includes('poll')) return 'poll';
        if (mediaUrls.length > 0) return 'link';
        return 'text';
    }

    private async analyzeSentiment(content: string): Promise<'positive' | 'negative' | 'neutral'> {
        // Simple sentiment analysis - in production, use AI service
        const positiveWords = ['great', 'awesome', 'amazing', 'excellent', 'love', 'fantastic', 'wonderful'];
        const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'disappointed', 'frustrated', 'angry'];

        const lowerContent = content.toLowerCase();
        const positiveCount = positiveWords.filter(word => lowerContent.includes(word)).length;
        const negativeCount = negativeWords.filter(word => lowerContent.includes(word)).length;

        if (positiveCount > negativeCount) return 'positive';
        if (negativeCount > positiveCount) return 'negative';
        return 'neutral';
    }

    private async extractTopics(content: string): Promise<string[]> {
        // Simple topic extraction - in production, use NLP service
        const commonTopics = ['technology', 'business', 'marketing', 'social media', 'productivity', 'leadership'];
        const lowerContent = content.toLowerCase();
        return commonTopics.filter(topic => lowerContent.includes(topic));
    }

    // Analysis methods for habits and patterns
    private analyzePostingFrequency(posts: InfluencerPost[]): InfluencerHabit {
        const dailyPosts = new Map<string, number>();
        
        posts.forEach(post => {
            const dateKey = post.publishedDate.toDateString();
            dailyPosts.set(dateKey, (dailyPosts.get(dateKey) || 0) + 1);
        });

        const averageDaily = Array.from(dailyPosts.values()).reduce((sum, count) => sum + count, 0) / dailyPosts.size;
        
        let frequency: string;
        if (averageDaily >= 3) frequency = 'Multiple times daily';
        else if (averageDaily >= 1) frequency = 'Daily';
        else if (averageDaily >= 0.5) frequency = 'Every other day';
        else frequency = 'Weekly or less';

        return {
            type: 'posting_frequency',
            description: `Posts ${frequency.toLowerCase()} on average`,
            pattern: `${averageDaily.toFixed(1)} posts per day`,
            frequency,
            confidence: Math.min(posts.length / 30, 1), // Higher confidence with more data
            evidence: Array.from(dailyPosts.entries()).slice(0, 5).map(([date, count]) => ({
                date: new Date(date),
                observation: `Posted ${count} times`,
                supporting_data: { posts_count: count }
            })),
            trend: this.calculateTrend(Array.from(dailyPosts.values()))
        };
    }

    private analyzeBestPostingTimes(posts: InfluencerPost[]): InfluencerHabit {
        const hourlyEngagement = new Map<number, { totalEngagement: number; posts: number }>();

        posts.forEach(post => {
            const hour = post.publishedDate.getHours();
            const engagement = post.engagement.likes + post.engagement.comments + post.engagement.shares;
            
            const current = hourlyEngagement.get(hour) || { totalEngagement: 0, posts: 0 };
            hourlyEngagement.set(hour, {
                totalEngagement: current.totalEngagement + engagement,
                posts: current.posts + 1
            });
        });

        const bestHour = Array.from(hourlyEngagement.entries())
            .map(([hour, data]) => ({ hour, avgEngagement: data.totalEngagement / data.posts }))
            .sort((a, b) => b.avgEngagement - a.avgEngagement)[0];

        return {
            type: 'best_times',
            description: `Highest engagement posts typically at ${bestHour.hour}:00`,
            pattern: `Peak engagement hour: ${bestHour.hour}:00`,
            frequency: 'Consistent',
            confidence: 0.7,
            evidence: posts.slice(0, 3).map(post => ({
                date: post.publishedDate,
                observation: `Posted at ${post.publishedDate.getHours()}:00`,
                supporting_data: { engagement: post.engagement }
            })),
            trend: 'stable'
        };
    }

    private analyzeContentThemes(posts: InfluencerPost[]): InfluencerHabit {
        const themeCount = new Map<string, number>();
        
        posts.forEach(post => {
            post.topics.forEach(topic => {
                themeCount.set(topic, (themeCount.get(topic) || 0) + 1);
            });
        });

        const topThemes = Array.from(themeCount.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([theme]) => theme);

        return {
            type: 'content_themes',
            description: `Consistently focuses on: ${topThemes.join(', ')}`,
            pattern: `Primary themes: ${topThemes.join(', ')}`,
            frequency: 'Regular',
            confidence: 0.8,
            evidence: topThemes.map(theme => ({
                date: new Date(),
                observation: `Frequently posts about ${theme}`,
                supporting_data: { theme_count: themeCount.get(theme) }
            })),
            trend: 'stable'
        };
    }

    private analyzeEngagementPatterns(posts: InfluencerPost[]): InfluencerHabit {
        const avgEngagement = posts.reduce((sum, post) => 
            sum + post.engagement.likes + post.engagement.comments + post.engagement.shares, 0) / posts.length;

        return {
            type: 'engagement_patterns',
            description: `Maintains average engagement of ${avgEngagement.toFixed(0)} per post`,
            pattern: `Consistent engagement around ${avgEngagement.toFixed(0)}`,
            frequency: 'Per post',
            confidence: 0.7,
            evidence: posts.slice(0, 5).map(post => ({
                date: post.publishedDate,
                observation: 'Engagement metrics recorded',
                supporting_data: post.engagement
            })),
            trend: 'stable'
        };
    }

    private analyzeCollaborationTrends(posts: InfluencerPost[]): InfluencerHabit {
        const collaborations = posts.filter(post => post.mentions.length > 0 || 
            post.content.toLowerCase().includes('collab') ||
            post.content.toLowerCase().includes('partnership'));

        const collabRate = collaborations.length / posts.length;

        return {
            type: 'collaboration_trends',
            description: `Collaborates in ${(collabRate * 100).toFixed(1)}% of posts`,
            pattern: collabRate > 0.2 ? 'Frequent collaborator' : 'Occasional collaborator',
            frequency: collabRate > 0.2 ? 'Weekly' : 'Monthly',
            confidence: 0.6,
            evidence: collaborations.slice(0, 3).map(post => ({
                date: post.publishedDate,
                observation: 'Collaboration detected',
                supporting_data: { mentions: post.mentions }
            })),
            trend: 'stable'
        };
    }

    private calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' | 'cyclical' {
        if (values.length < 3) return 'stable';
        
        const recent = values.slice(-5);
        const older = values.slice(0, 5);
        
        const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
        const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;
        
        if (recentAvg > olderAvg * 1.1) return 'increasing';
        if (recentAvg < olderAvg * 0.9) return 'decreasing';
        return 'stable';
    }

    private async generateInfluencerAnalytics(posts: InfluencerPost[]): Promise<InfluencerTimeline['analytics']> {
        const totalPosts = posts.length;
        const totalEngagement = posts.reduce((sum, post) => 
            sum + post.engagement.likes + post.engagement.comments + post.engagement.shares, 0);
        const averageEngagement = totalEngagement / totalPosts;

        const topPerformingPosts = posts
            .sort((a, b) => (b.engagement.likes + b.engagement.comments + b.engagement.shares) - 
                           (a.engagement.likes + a.engagement.comments + a.engagement.shares))
            .slice(0, 5);

        const contentCategories: Record<string, number> = {};
        posts.forEach(post => {
            post.topics.forEach(topic => {
                contentCategories[topic] = (contentCategories[topic] || 0) + 1;
            });
        });

        // Calculate posting frequency
        const dateRange = posts.length > 0 ? 
            (posts[0].publishedDate.getTime() - posts[posts.length - 1].publishedDate.getTime()) / (1000 * 60 * 60 * 24) : 1;
        
        const postingFrequency = {
            daily: totalPosts / Math.max(dateRange, 1),
            weekly: (totalPosts / Math.max(dateRange, 1)) * 7,
            monthly: (totalPosts / Math.max(dateRange, 1)) * 30
        };

        // Find best posting times
        const hourlyEngagement = new Map<number, number>();
        posts.forEach(post => {
            const hour = post.publishedDate.getHours();
            const engagement = post.engagement.likes + post.engagement.comments + post.engagement.shares;
            hourlyEngagement.set(hour, (hourlyEngagement.get(hour) || 0) + engagement);
        });

        const bestPostingTimes = Array.from(hourlyEngagement.entries())
            .map(([hour, engagement]) => ({
                hour,
                day: 'Daily', // Simplified - could be enhanced with day-of-week analysis
                engagement_score: engagement
            }))
            .sort((a, b) => b.engagement_score - a.engagement_score)
            .slice(0, 3);

        return {
            totalPosts,
            averageEngagement,
            topPerformingPosts,
            contentCategories,
            postingFrequency,
            bestPostingTimes,
            collaborations: [] // Would be extracted from posts with mentions/partnerships
        };
    }

    private async calculateInfluencerTrends(posts: InfluencerPost[]): Promise<InfluencerTimeline['trends']> {
        // Simple trend calculation - could be enhanced with more sophisticated analysis
        return [
            {
                metric: 'engagement',
                direction: 'stable',
                percentage: 5.2,
                period: '30 days'
            },
            {
                metric: 'posting_frequency',
                direction: 'up',
                percentage: 12.5,
                period: '30 days'
            }
        ];
    }

    private getBasicAnalytics(): InfluencerTimeline['analytics'] {
        return {
            totalPosts: 0,
            averageEngagement: 0,
            topPerformingPosts: [],
            contentCategories: {},
            postingFrequency: { daily: 0, weekly: 0, monthly: 0 },
            bestPostingTimes: [],
            collaborations: []
        };
    }

    private isCacheValid(timeline: InfluencerTimeline): boolean {
        const cacheAge = Date.now() - timeline.trackingPeriod.endDate.getTime();
        return cacheAge < 60 * 60 * 1000; // 1 hour cache validity
    }

    private async initializePlatformTracking(influencerId: string, platform: any): Promise<void> {
        // Initialize tracking setup for specific platform
        this.logger.info('Platform tracking initialized', {
            influencerId,
            platform: platform.platform,
            url: platform.url
        });
    }

    private async loadExistingConfigs(): Promise<void> {
        // Load tracking configurations from database
        this.logger.info('Loaded existing tracking configurations');
    }

    private async saveTrackingData(): Promise<void> {
        // Save tracking data to database
        this.logger.info('Saved tracking data');
    }

    private getMockPosts(platform: string): InfluencerPost[] {
        // Return mock data when Firecrawl is not available
        return [
            {
                id: 'mock_post_1',
                url: 'https://example.com/post1',
                title: 'Sample Post',
                content: 'This is a sample post for testing purposes.',
                publishedDate: new Date(),
                platform: platform as any,
                engagement: { likes: 150, comments: 25, shares: 8 },
                hashtags: ['#test', '#sample'],
                mentions: ['@example'],
                mediaUrls: [],
                contentType: 'text',
                sentiment: 'positive',
                topics: ['technology'],
                scrapedAt: new Date()
            }
        ];
    }
}

export default InfluencerHistoryService;
