/**
 * Bulgarian Legal Text Parser
 * Utilities for parsing Bulgarian legal documents and extracting legal references
 */

import natural from 'natural';

export class BulgarianLegalParser {
    constructor() {
        // Bulgarian legal terminology
        this.legalTerms = {
            courts: [
                'Върховен касационен съд',
                'Върховен административен съд',
                'Апелативен съд',
                'Окръжен съд',
                'Районен съд',
                'Административен съд',
            ],
            laws: [
                'Закон за задълженията и договорите',
                'Търговски закон',
                'Наказателен кодекс',
                'Гражданско-процесуален кодекс',
                'Наказателно-процесуален кодекс',
                'Административно-процесуален кодекс',
                'ЗЗД',
                'ТЗ',
                'НК',
                'ГПК',
                'НПК',
                'АПК',
            ],
            parties: [
                'ищец',
                'ответник',
                'жалбоподател',
                'обжалван',
                'купувач',
                'продавач',
                'наемател',
                'наемодател',
                'кредитор',
                'длъжник',
                'застрахователь',
                'застрахован',
            ],
        };

        // Regex patterns for Bulgarian legal references
        this.patterns = {
            article: /чл\.\s*(\d+[а-я]*)\s*(?:от\s*)?(.*?)(?=\s|$|,|;|\.|чл\.)/gi,
            paragraph: /ал\.\s*(\d+)/gi,
            point: /т\.\s*(\d+)/gi,
            caseNumber: /(?:дело|решение|определение)\s*№?\s*(\d+\/\d{4})/gi,
            court:
                /(Върховен\s+(?:касационен|административен)\s+съд|Апелативен\s+съд|Окръжен\s+съд|Районен\s+съд|Административен\s+съд)/gi,
            date: /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s*г\.?/g,
        };
    }

    /**
     * Parse legal article references from text
     */
    parseArticleReferences(text) {
        const references = [];
        let match;

        this.patterns.article.lastIndex = 0;
        while ((match = this.patterns.article.exec(text)) !== null) {
            const article = match[1];
            const lawText = match[2] ? match[2].trim() : '';

            references.push({
                type: 'article',
                article: `чл. ${article}`,
                law: this.identifyLaw(lawText),
                fullText: match[0],
                position: match.index,
            });
        }

        return references;
    }

    /**
     * Parse case numbers from text
     */
    parseCaseNumbers(text) {
        const caseNumbers = [];
        let match;

        this.patterns.caseNumber.lastIndex = 0;
        while ((match = this.patterns.caseNumber.exec(text)) !== null) {
            caseNumbers.push({
                type: 'case_number',
                number: match[1],
                fullText: match[0],
                position: match.index,
            });
        }

        return caseNumbers;
    }

    /**
     * Parse court references from text
     */
    parseCourtReferences(text) {
        const courts = [];
        let match;

        this.patterns.court.lastIndex = 0;
        while ((match = this.patterns.court.exec(text)) !== null) {
            courts.push({
                type: 'court',
                name: match[1],
                fullText: match[0],
                position: match.index,
            });
        }

        return courts;
    }

    /**
     * Parse dates from Bulgarian legal text
     */
    parseDates(text) {
        const dates = [];
        let match;

        this.patterns.date.lastIndex = 0;
        while ((match = this.patterns.date.exec(text)) !== null) {
            const day = parseInt(match[1]);
            const month = parseInt(match[2]);
            const year = parseInt(match[3]);

            dates.push({
                type: 'date',
                day,
                month,
                year,
                date: new Date(year, month - 1, day),
                fullText: match[0],
                position: match.index,
            });
        }

        return dates;
    }

    /**
     * Identify which law is being referenced
     */
    identifyLaw(lawText) {
        const text = lawText.toLowerCase();

        if (text.includes('ззд') || text.includes('задълженията и договорите')) {
            return 'ЗЗД';
        }
        if (text.includes('тз') || text.includes('търговски')) {
            return 'ТЗ';
        }
        if (text.includes('нк') || text.includes('наказателен кодекс')) {
            return 'НК';
        }
        if (text.includes('гпк') || text.includes('гражданско-процесуален')) {
            return 'ГПК';
        }
        if (text.includes('нпк') || text.includes('наказателно-процесуален')) {
            return 'НПК';
        }
        if (text.includes('апк') || text.includes('административно-процесуален')) {
            return 'АПК';
        }

        return lawText || 'Unknown';
    }

    /**
     * Extract party information from text
     */
    parseParties(text) {
        const parties = [];
        const lowerText = text.toLowerCase();

        this.legalTerms.parties.forEach((partyType) => {
            const pattern = new RegExp(`(${partyType})\\s*[:-]\\s*([^,;.]+)`, 'gi');
            let match;

            while ((match = pattern.exec(lowerText)) !== null) {
                parties.push({
                    type: match[1],
                    name: match[2].trim(),
                    fullText: match[0],
                    position: match.index,
                });
            }
        });

        return parties;
    }

    /**
     * Calculate similarity between two legal texts
     */
    calculateSimilarity(text1, text2) {
        const tokens1 = this.tokenizeLegalText(text1);
        const tokens2 = this.tokenizeLegalText(text2);

        return natural.JaroWinklerDistance(tokens1.join(' '), tokens2.join(' '));
    }

    /**
     * Tokenize Bulgarian legal text
     */
    tokenizeLegalText(text) {
        // Remove common Bulgarian stop words and legal boilerplate
        const stopWords = new Set([
            'в',
            'на',
            'от',
            'до',
            'за',
            'с',
            'по',
            'при',
            'след',
            'преди',
            'че',
            'да',
            'се',
            'и',
            'или',
            'но',
            'а',
            'също',
            'както',
            'съгласно',
            'основание',
            'предвид',
            'поради',
        ]);

        return natural.WordTokenizer.tokenize(text.toLowerCase()).filter(
            (token) => !stopWords.has(token) && token.length > 2,
        );
    }

    /**
     * Parse full legal document structure
     */
    parseDocument(text) {
        return {
            articles: this.parseArticleReferences(text),
            caseNumbers: this.parseCaseNumbers(text),
            courts: this.parseCourtReferences(text),
            dates: this.parseDates(text),
            parties: this.parseParties(text),
            wordCount: text.split(/\s+/).length,
            language: 'bg',
        };
    }
}
