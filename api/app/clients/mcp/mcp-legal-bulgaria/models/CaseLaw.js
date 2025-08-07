/**
 * Case Law model for Bulgarian legal database
 */
export class CaseLaw {
    constructor(data = {}) {
        this.id = data.id || null;
        this.caseNumber = data.caseNumber || '';
        this.court = data.court || '';
        this.date = data.date || null;
        this.parties = {
            plaintiff: data.parties?.plaintiff || '',
            defendant: data.parties?.defendant || '',
            type: data.parties?.type || '', // buyer, seller, etc.
        };
        this.legalBasis = {
            articles: data.legalBasis?.articles || [], // [{ article: 'чл. 15', law: 'ЗЗД' }]
            laws: data.legalBasis?.laws || [],
            regulations: data.legalBasis?.regulations || [],
        };
        this.summary = data.summary || '';
        this.reasoning = data.reasoning || '';
        this.decision = data.decision || '';
        this.outcome = data.outcome || ''; // guilty, not_guilty, liable, not_liable
        this.keyPoints = data.keyPoints || [];
        this.precedentValue = data.precedentValue || 'low'; // low, medium, high
        this.documentUrl = data.documentUrl || '';
        this.fullText = data.fullText || '';
        this.tags = data.tags || [];
        this.relatedCases = data.relatedCases || [];
        this.lastUpdated = data.lastUpdated || new Date();
    }

    /**
     * Check if case matches search criteria
     */
    matchesCriteria(criteria) {
        if (criteria.articles && criteria.articles.length > 0) {
            const caseArticles = this.legalBasis.articles.map((a) => a.article.toLowerCase());
            const hasMatchingArticle = criteria.articles.some((article) =>
                caseArticles.some((caseArticle) => caseArticle.includes(article.toLowerCase())),
            );
            if (!hasMatchingArticle) return false;
        }

        if (criteria.laws && criteria.laws.length > 0) {
            const caseLaws = this.legalBasis.laws.map((l) => l.toLowerCase());
            const hasMatchingLaw = criteria.laws.some((law) =>
                caseLaws.some((caseLaw) => caseLaw.includes(law.toLowerCase())),
            );
            if (!hasMatchingLaw) return false;
        }

        if (criteria.partyType && this.parties.type !== criteria.partyType) {
            return false;
        }

        if (criteria.outcome && this.outcome !== criteria.outcome) {
            return false;
        }

        if (criteria.court && !this.court.toLowerCase().includes(criteria.court.toLowerCase())) {
            return false;
        }

        if (criteria.dateFrom && this.date < criteria.dateFrom) {
            return false;
        }

        if (criteria.dateTo && this.date > criteria.dateTo) {
            return false;
        }

        return true;
    }

    /**
     * Generate a formatted citation for this case
     */
    generateCitation() {
        return `${this.caseNumber}, ${this.court}, ${this.date?.toLocaleDateString('bg-BG')}`;
    }

    /**
     * Extract key legal elements for comparison
     */
    getLegalFingerprint() {
        return {
            articles: this.legalBasis.articles,
            laws: this.legalBasis.laws,
            outcome: this.outcome,
            court: this.court,
            keyPoints: this.keyPoints,
        };
    }
}
