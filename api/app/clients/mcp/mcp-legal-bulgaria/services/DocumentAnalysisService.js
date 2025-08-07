/**
 * Document Analysis Service for Bulgarian legal documents
 * Handles analysis of contracts, legal documents, and clause verification
 */

import { LegalDocument } from '../models/LegalDocument.js';
import { BulgarianLegalParser } from '../utils/BulgarianLegalParser.js';

export class DocumentAnalysisService {
    constructor() {
        this.parser = new BulgarianLegalParser();
    }

    /**
     * Analyze a legal document
     */
    async analyzeDocument(documentText, documentType = 'contract') {
        try {
            const document = new LegalDocument({
                content: documentText,
                type: documentType,
                dateCreated: new Date(),
            });

            // Parse document structure
            const parsedContent = this.parser.parseDocument(documentText);

            // Extract clauses and legal references
            const clauses = document.extractClauses();
            const legalReferences = document.extractLegalReferences();
            const issues = document.analyzeLegalIssues();
            const summary = document.generateSummary();

            // Risk assessment
            const riskAssessment = this.performRiskAssessment(document, issues);

            // Compliance check
            const complianceCheck = this.checkCompliance(legalReferences);

            return {
                document: {
                    type: documentType,
                    summary,
                    wordCount: parsedContent.wordCount,
                },
                structure: {
                    clauses: clauses.length,
                    legalReferences: legalReferences.length,
                    articles: parsedContent.articles.length,
                    courts: parsedContent.courts.length,
                    dates: parsedContent.dates.length,
                },
                analysis: {
                    clauses,
                    legalReferences,
                    parsedContent,
                    issues,
                    riskAssessment,
                    complianceCheck,
                },
                recommendations: this.generateRecommendations(issues, riskAssessment),
            };
        } catch (error) {
            throw new Error(`Document analysis failed: ${error.message}`);
        }
    }

    /**
     * Verify specific contract clauses
     */
    async verifyContractClauses(documentText, clausesToVerify = []) {
        try {
            const document = new LegalDocument({
                content: documentText,
                type: 'contract',
            });

            const documentClauses = document.extractClauses();
            const verificationResults = [];

            for (const targetClause of clausesToVerify) {
                const verification = await this.verifyClause(targetClause, documentClauses, documentText);
                verificationResults.push(verification);
            }

            return {
                documentAnalysis: {
                    totalClauses: documentClauses.length,
                    verifiedClauses: clausesToVerify.length,
                    foundClauses: verificationResults.filter((v) => v.found).length,
                },
                verificationResults,
                recommendations: this.generateClauseRecommendations(verificationResults),
            };
        } catch (error) {
            throw new Error(`Clause verification failed: ${error.message}`);
        }
    }

    /**
     * Compare two documents for similarities and differences
     */
    async compareDocuments(document1Text, document2Text) {
        try {
            const doc1 = new LegalDocument({ content: document1Text });
            const doc2 = new LegalDocument({ content: document2Text });

            const doc1Clauses = doc1.extractClauses();
            const doc2Clauses = doc2.extractClauses();

            const doc1References = doc1.extractLegalReferences();
            const doc2References = doc2.extractLegalReferences();

            // Calculate similarity
            const textSimilarity = this.parser.calculateSimilarity(document1Text, document2Text);

            // Find common and unique clauses
            const clauseComparison = this.compareClauses(doc1Clauses, doc2Clauses);

            // Find common and unique legal references
            const referenceComparison = this.compareReferences(doc1References, doc2References);

            return {
                similarity: {
                    overall: textSimilarity,
                    clauses: clauseComparison.similarity,
                    references: referenceComparison.similarity,
                },
                document1: {
                    clauses: doc1Clauses.length,
                    references: doc1References.length,
                    uniqueClauses: clauseComparison.doc1Only.length,
                },
                document2: {
                    clauses: doc2Clauses.length,
                    references: doc2References.length,
                    uniqueClauses: clauseComparison.doc2Only.length,
                },
                comparison: {
                    commonClauses: clauseComparison.common,
                    uniqueToDoc1: clauseComparison.doc1Only,
                    uniqueToDoc2: clauseComparison.doc2Only,
                    commonReferences: referenceComparison.common,
                    uniqueReferencesToDoc1: referenceComparison.doc1Only,
                    uniqueReferencesToDoc2: referenceComparison.doc2Only,
                },
                recommendations: this.generateComparisonRecommendations(
                    clauseComparison,
                    referenceComparison,
                ),
            };
        } catch (error) {
            throw new Error(`Document comparison failed: ${error.message}`);
        }
    }

    /**
     * Extract key terms and definitions
     */
    async extractKeyTerms(documentText) {
        try {
            const terms = [];
            const definitions = [];

            // Pattern for definitions (usually in format "term" означава/е...)
            const definitionPattern = /"([^"]+)"\s+означава|"([^"]+)"\s+е\s+([^.]+)/gi;
            let match;

            while ((match = definitionPattern.exec(documentText)) !== null) {
                definitions.push({
                    term: match[1] || match[2],
                    definition: match[3] || match[0],
                    position: match.index,
                });
            }

            // Extract important legal terms
            const legalTerms = [
                'договор',
                'сделка',
                'задължение',
                'право',
                'отговорност',
                'неустойка',
                'обезщетение',
                'гаранция',
                'срок',
                'условие',
            ];

            legalTerms.forEach((term) => {
                const regex = new RegExp(`\\b${term}\\b`, 'gi');
                const matches = [...documentText.matchAll(regex)];
                if (matches.length > 0) {
                    terms.push({
                        term,
                        frequency: matches.length,
                        positions: matches.map((m) => m.index),
                    });
                }
            });

            return {
                keyTerms: terms.sort((a, b) => b.frequency - a.frequency),
                definitions,
                summary: {
                    totalTerms: terms.length,
                    totalDefinitions: definitions.length,
                    mostFrequent: terms[0]?.term || 'None',
                },
            };
        } catch (error) {
            throw new Error(`Key terms extraction failed: ${error.message}`);
        }
    }

    /**
     * Perform risk assessment on document
     */
    performRiskAssessment(document, issues) {
        let riskScore = 0;
        const riskFactors = [];

        // High-risk issues
        const highRiskIssues = issues.filter((issue) => issue.severity === 'high');
        riskScore += highRiskIssues.length * 3;
        riskFactors.push(...highRiskIssues.map((issue) => `High: ${issue.issue}`));

        // Medium-risk issues
        const mediumRiskIssues = issues.filter((issue) => issue.severity === 'medium');
        riskScore += mediumRiskIssues.length * 2;
        riskFactors.push(...mediumRiskIssues.map((issue) => `Medium: ${issue.issue}`));

        // Missing legal references
        if (document.legalReferences.length === 0) {
            riskScore += 2;
            riskFactors.push('No legal references found');
        }

        // Very short or very long documents
        const wordCount = document.content.split(/\s+/).length;
        if (wordCount < 100) {
            riskScore += 1;
            riskFactors.push('Document too short');
        } else if (wordCount > 10000) {
            riskScore += 1;
            riskFactors.push('Document very lengthy');
        }

        let riskLevel;
        if (riskScore >= 8) riskLevel = 'High';
        else if (riskScore >= 4) riskLevel = 'Medium';
        else riskLevel = 'Low';

        return {
            score: riskScore,
            level: riskLevel,
            factors: riskFactors,
            recommendations: this.generateRiskRecommendations(riskLevel, riskFactors),
        };
    }

    /**
     * Check compliance with Bulgarian legal requirements
     */
    checkCompliance(legalReferences) {
        const compliance = {
            score: 0,
            issues: [],
            recommendations: [],
        };

        // Check for required legal references
        const requiredReferences = ['ЗЗД', 'ТЗ'];
        const foundReferences = legalReferences.map((ref) => ref.text);

        requiredReferences.forEach((required) => {
            const found = foundReferences.some((ref) => ref.includes(required));
            if (found) {
                compliance.score += 1;
            } else {
                compliance.issues.push(`Missing reference to ${required}`);
            }
        });

        // Check article references format
        const articleRefs = legalReferences.filter((ref) => ref.text.includes('чл.'));
        const validArticleFormat = articleRefs.filter((ref) => /чл\.\s*\d+/.test(ref.text));

        if (articleRefs.length > 0) {
            const formatScore = validArticleFormat.length / articleRefs.length;
            compliance.score += formatScore;

            if (formatScore < 1) {
                compliance.issues.push('Some article references have incorrect format');
            }
        }

        compliance.percentage = Math.round((compliance.score / 3) * 100);

        if (compliance.percentage < 60) {
            compliance.recommendations.push('Review and add proper legal references');
        }
        if (compliance.issues.length > 0) {
            compliance.recommendations.push('Ensure all legal references follow proper Bulgarian format');
        }

        return compliance;
    }

    /**
     * Verify a specific clause
     */
    async verifyClause(targetClause, documentClauses, fullText) {
        const similarity = this.parser.calculateSimilarity(
            targetClause.toLowerCase(),
            fullText.toLowerCase(),
        );

        const found =
            similarity > 0.6 ||
            documentClauses.some((clause) =>
                clause.text.toLowerCase().includes(targetClause.toLowerCase()),
            );

        const matchingClauses = documentClauses.filter(
            (clause) => this.parser.calculateSimilarity(clause.text, targetClause) > 0.5,
        );

        return {
            clause: targetClause,
            found,
            similarity,
            matchingClauses,
            confidence: found ? 'high' : 'low',
            recommendation: found
                ? 'Clause found with good confidence'
                : 'Clause not found - consider adding it',
        };
    }

    /**
     * Compare clauses between documents
     */
    compareClauses(clauses1, clauses2) {
        const common = [];
        const doc1Only = [];
        const doc2Only = [...clauses2];

        clauses1.forEach((clause1) => {
            const matchIndex = doc2Only.findIndex(
                (clause2) => this.parser.calculateSimilarity(clause1.text, clause2.text) > 0.7,
            );

            if (matchIndex !== -1) {
                common.push({
                    clause1: clause1.text,
                    clause2: doc2Only[matchIndex].text,
                    similarity: this.parser.calculateSimilarity(clause1.text, doc2Only[matchIndex].text),
                });
                doc2Only.splice(matchIndex, 1);
            } else {
                doc1Only.push(clause1);
            }
        });

        return {
            common,
            doc1Only,
            doc2Only,
            similarity: common.length / Math.max(clauses1.length, clauses2.length),
        };
    }

    /**
     * Compare legal references between documents
     */
    compareReferences(refs1, refs2) {
        const common = [];
        const doc1Only = [];
        const doc2Only = [...refs2];

        refs1.forEach((ref1) => {
            const matchIndex = doc2Only.findIndex(
                (ref2) => ref1.text.toLowerCase() === ref2.text.toLowerCase(),
            );

            if (matchIndex !== -1) {
                common.push(ref1.text);
                doc2Only.splice(matchIndex, 1);
            } else {
                doc1Only.push(ref1.text);
            }
        });

        return {
            common,
            doc1Only,
            doc2Only,
            similarity: common.length / Math.max(refs1.length, refs2.length),
        };
    }

    /**
     * Generate recommendations based on analysis
     */
    generateRecommendations(issues, riskAssessment) {
        const recommendations = [];

        if (issues.length > 0) {
            recommendations.push(`Address ${issues.length} identified legal issues`);
            issues.forEach((issue) => {
                recommendations.push(`${issue.severity.toUpperCase()}: ${issue.recommendation}`);
            });
        }

        if (riskAssessment.level === 'High') {
            recommendations.push('High risk document - consider legal review');
        }

        if (recommendations.length === 0) {
            recommendations.push('Document appears to be well-structured');
        }

        return recommendations;
    }

    /**
     * Generate clause-specific recommendations
     */
    generateClauseRecommendations(verificationResults) {
        const recommendations = [];
        const notFound = verificationResults.filter((v) => !v.found);

        if (notFound.length > 0) {
            recommendations.push(`Consider adding ${notFound.length} missing clause(s)`);
            notFound.forEach((clause) => {
                recommendations.push(`Missing: ${clause.clause}`);
            });
        }

        const lowConfidence = verificationResults.filter((v) => v.confidence === 'low');
        if (lowConfidence.length > 0) {
            recommendations.push(`Review ${lowConfidence.length} clause(s) with low confidence`);
        }

        return recommendations;
    }

    /**
     * Generate comparison recommendations
     */
    generateComparisonRecommendations(clauseComparison, referenceComparison) {
        const recommendations = [];

        if (clauseComparison.doc1Only.length > 0) {
            recommendations.push(`Document 1 has ${clauseComparison.doc1Only.length} unique clause(s)`);
        }

        if (clauseComparison.doc2Only.length > 0) {
            recommendations.push(`Document 2 has ${clauseComparison.doc2Only.length} unique clause(s)`);
        }

        if (clauseComparison.similarity < 0.5) {
            recommendations.push('Documents have significant structural differences');
        }

        if (referenceComparison.similarity < 0.5) {
            recommendations.push('Legal references differ significantly between documents');
        }

        return recommendations;
    }

    /**
     * Generate risk-based recommendations
     */
    generateRiskRecommendations(riskLevel, riskFactors) {
        const recommendations = [];

        if (riskLevel === 'High') {
            recommendations.push('Immediate legal review recommended');
            recommendations.push('Consider professional legal consultation');
        } else if (riskLevel === 'Medium') {
            recommendations.push('Review identified issues before finalizing');
        }

        riskFactors.forEach((factor) => {
            if (factor.includes('No legal references')) {
                recommendations.push('Add appropriate legal references for your jurisdiction');
            }
            if (factor.includes('too short')) {
                recommendations.push('Consider adding more detailed terms and conditions');
            }
        });

        return recommendations;
    }
}
