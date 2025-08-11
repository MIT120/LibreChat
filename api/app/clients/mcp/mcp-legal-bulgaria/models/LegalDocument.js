/**
 * Legal Document model for contract and document analysis
 */
export class LegalDocument {
  constructor(data = {}) {
    this.id = data.id || null;
    this.title = data.title || '';
    this.type = data.type || ''; // contract, agreement, ruling, etc.
    this.content = data.content || '';
    this.parties = data.parties || [];
    this.clauses = data.clauses || [];
    this.legalReferences = data.legalReferences || [];
    this.language = data.language || 'bg';
    this.dateCreated = data.dateCreated || new Date();
    this.metadata = {
      jurisdiction: data.metadata?.jurisdiction || 'Bulgaria',
      practiceArea: data.metadata?.practiceArea || '',
      complexity: data.metadata?.complexity || 'medium',
      status: data.metadata?.status || 'active',
    };
  }

  /**
   * Extract clauses from document content
   */
  extractClauses() {
    const clauses = [];
    const content = this.content;

    // Pattern for numbered clauses (1., 2., etc.)
    const numberedClausePattern = /(\d+)\.\s*([^\.]*\.)/g;
    let match;

    while ((match = numberedClausePattern.exec(content)) !== null) {
      clauses.push({
        number: match[1],
        text: match[2].trim(),
        type: 'numbered',
      });
    }

    // Pattern for article references (чл. XX)
    const articlePattern = /(чл\.\s*\d+[а-я]*)/gi;
    const articleMatches = content.match(articlePattern) || [];

    articleMatches.forEach((article) => {
      clauses.push({
        text: article,
        type: 'legal_reference',
      });
    });

    this.clauses = clauses;
    return clauses;
  }

  /**
   * Find legal references in the document
   */
  extractLegalReferences() {
    const references = [];
    const content = this.content;

    // Bulgarian law patterns
    const lawPatterns = [
      /(?:закон|ЗЗД|ТЗ|НК|ГПК|НПК)\s*[\w\s]*/gi,
      /чл\.\s*\d+[а-я]*\s*(?:от|на)\s*[\w\s]*/gi,
      /ал\.\s*\d+/gi,
      /т\.\s*\d+/gi,
    ];

    lawPatterns.forEach((pattern) => {
      const matches = content.match(pattern) || [];
      matches.forEach((match) => {
        references.push({
          text: match.trim(),
          type: 'legal_reference',
          confidence: 0.8,
        });
      });
    });

    this.legalReferences = references;
    return references;
  }

  /**
   * Analyze document for potential legal issues
   */
  analyzeLegalIssues() {
    const issues = [];
    const content = this.content.toLowerCase();

    // Check for common problematic clauses
    const problematicTerms = [
      { term: 'неограничена отговорност', severity: 'high', issue: 'Unlimited liability clause' },
      { term: 'безвъзвратно', severity: 'medium', issue: 'Irrevocable terms' },
      { term: 'без право на обжалване', severity: 'high', issue: 'No appeal rights clause' },
      { term: 'еднострана промяна', severity: 'medium', issue: 'Unilateral modification clause' },
    ];

    problematicTerms.forEach(({ term, severity, issue }) => {
      if (content.includes(term)) {
        issues.push({
          issue,
          severity,
          description: `Document contains potentially problematic clause: "${term}"`,
          recommendation: `Review and consider modifying this clause`,
        });
      }
    });

    return issues;
  }

  /**
   * Generate document summary
   */
  generateSummary() {
    const wordCount = this.content.split(/\s+/).length;
    const clauseCount = this.clauses.length;
    const referenceCount = this.legalReferences.length;

    return {
      type: this.type,
      wordCount,
      clauseCount,
      referenceCount,
      parties: this.parties.length,
      jurisdiction: this.metadata.jurisdiction,
      complexity: this.metadata.complexity,
      keyElements: this.clauses.slice(0, 5).map((c) => c.text),
    };
  }
}
