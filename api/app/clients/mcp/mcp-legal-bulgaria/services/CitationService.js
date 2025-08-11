/**
 * Citation Service for Bulgarian legal references
 * Handles generation and formatting of legal citations according to Bulgarian standards
 */

export class CitationService {
  constructor() {
    this.citationFormats = {
      court: 'bulgarian_court',
      law: 'bulgarian_law',
      article: 'bulgarian_article',
      regulation: 'bulgarian_regulation',
    };
  }

  /**
   * Generate properly formatted citations for cases
   */
  async generateCaseCitations(cases) {
    try {
      const citations = cases.map((caseLaw) => {
        return this.formatCourtCitation(caseLaw);
      });

      return {
        citations,
        bibliography: this.generateBibliography(citations),
        count: citations.length,
      };
    } catch (error) {
      throw new Error(`Citation generation failed: ${error.message}`);
    }
  }

  /**
   * Format a single court case citation
   */
  formatCourtCitation(caseLaw) {
    // Bulgarian court citation format: [Court], [Case Number], [Date]
    const court = this.standardizeCourt(caseLaw.court);
    const date = this.formatBulgarianDate(caseLaw.date);

    return {
      full: `${court}, дело № ${caseLaw.caseNumber}, ${date}`,
      short: `${caseLaw.caseNumber}/${caseLaw.date?.getFullYear()}`,
      court,
      caseNumber: caseLaw.caseNumber,
      date,
      url: caseLaw.documentUrl,
      style: 'bulgarian_court',
    };
  }

  /**
   * Generate legal reference citations
   */
  generateLegalReferenceCitations(references) {
    const citations = references.map((ref) => {
      if (ref.text.includes('чл.')) {
        return this.formatArticleCitation(ref);
      } else if (this.isLawReference(ref.text)) {
        return this.formatLawCitation(ref);
      } else {
        return this.formatGeneralReference(ref);
      }
    });

    return {
      citations,
      formatted: citations.map((c) => c.full),
      count: citations.length,
    };
  }

  /**
   * Format article citation (чл. XX от Закон YY)
   */
  formatArticleCitation(reference) {
    const text = reference.text;
    const articleMatch = text.match(/чл\.\s*(\d+[а-я]*)/i);
    const lawMatch = text.match(/(?:от|на)\s*(.*?)(?:\s|$|,|;|\.)/i);

    const article = articleMatch ? articleMatch[1] : '';
    const law = lawMatch ? lawMatch[1].trim() : '';

    return {
      full: law ? `чл. ${article} от ${law}` : `чл. ${article}`,
      short: `чл. ${article}`,
      article,
      law,
      style: 'bulgarian_article',
    };
  }

  /**
   * Format law citation
   */
  formatLawCitation(reference) {
    const text = reference.text;
    let lawName = text;

    // Standardize law names
    const lawMappings = {
      ззд: 'Закон за задълженията и договорите',
      тз: 'Търговски закон',
      нк: 'Наказателен кодекс',
      гпк: 'Граждански процесуален кодекс',
      нпк: 'Наказателно процесуален кодекс',
      апк: 'Административно процесуален кодекс',
    };

    const standardLaw = lawMappings[lawName.toLowerCase()] || lawName;

    return {
      full: standardLaw,
      short: lawName.toUpperCase(),
      law: standardLaw,
      style: 'bulgarian_law',
    };
  }

  /**
   * Format general legal reference
   */
  formatGeneralReference(reference) {
    return {
      full: reference.text,
      short: reference.text,
      style: 'general',
    };
  }

  /**
   * Generate bibliography from citations
   */
  generateBibliography(citations) {
    const bibliography = {
      courtCases: [],
      laws: [],
      articles: [],
      general: [],
    };

    citations.forEach((citation) => {
      switch (citation.style) {
        case 'bulgarian_court':
          bibliography.courtCases.push(citation.full);
          break;
        case 'bulgarian_law':
          bibliography.laws.push(citation.full);
          break;
        case 'bulgarian_article':
          bibliography.articles.push(citation.full);
          break;
        default:
          bibliography.general.push(citation.full);
      }
    });

    // Remove duplicates and sort
    Object.keys(bibliography).forEach((key) => {
      bibliography[key] = [...new Set(bibliography[key])].sort();
    });

    return bibliography;
  }

  /**
   * Generate formatted bibliography text
   */
  generateBibliographyText(bibliography) {
    let text = 'ИЗПОЛЗВАНИ ИЗТОЧНИЦИ:\n\n';

    if (bibliography.courtCases.length > 0) {
      text += 'Съдебна практика:\n';
      bibliography.courtCases.forEach((citation, index) => {
        text += `${index + 1}. ${citation}\n`;
      });
      text += '\n';
    }

    if (bibliography.laws.length > 0) {
      text += 'Нормативни актове:\n';
      bibliography.laws.forEach((citation, index) => {
        text += `${index + 1}. ${citation}\n`;
      });
      text += '\n';
    }

    if (bibliography.articles.length > 0) {
      text += 'Правни разпоредби:\n';
      bibliography.articles.forEach((citation, index) => {
        text += `${index + 1}. ${citation}\n`;
      });
      text += '\n';
    }

    return text.trim();
  }

  /**
   * Validate citation format
   */
  validateCitation(citation, expectedStyle = null) {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
    };

    if (!citation || !citation.trim()) {
      validation.valid = false;
      validation.errors.push('Citation is empty');
      return validation;
    }

    // Validate court citation format
    if (expectedStyle === 'court' || this.looksLikeCourtCitation(citation)) {
      if (!citation.includes('дело') && !citation.includes('№')) {
        validation.warnings.push('Court citation should include case number');
      }
      if (!this.hasValidDate(citation)) {
        validation.warnings.push('Court citation should include date');
      }
    }

    // Validate article citation format
    if (expectedStyle === 'article' || citation.includes('чл.')) {
      if (!/чл\.\s*\d+/.test(citation)) {
        validation.errors.push('Article citation format is incorrect');
        validation.valid = false;
      }
    }

    // Validate law citation
    if (expectedStyle === 'law' || this.isLawReference(citation)) {
      const knownLaws = ['ззд', 'тз', 'нк', 'гпк', 'нпк', 'апк'];
      const hasKnownLaw = knownLaws.some((law) => citation.toLowerCase().includes(law));

      if (!hasKnownLaw && citation.length < 5) {
        validation.warnings.push('Law reference might be incomplete');
      }
    }

    return validation;
  }

  /**
   * Standardize court names
   */
  standardizeCourt(courtName) {
    const standardNames = {
      вкс: 'Върховен касационен съд',
      вас: 'Върховен административен съд',
      апелативен: 'Апелативен съд',
      окръжен: 'Окръжен съд',
      районен: 'Районен съд',
      административен: 'Административен съд',
    };

    const lowerCourt = courtName.toLowerCase();
    for (const [abbrev, full] of Object.entries(standardNames)) {
      if (lowerCourt.includes(abbrev)) {
        return full;
      }
    }

    return courtName;
  }

  /**
   * Format Bulgarian date
   */
  formatBulgarianDate(date) {
    if (!date) return '';

    if (typeof date === 'string') {
      date = new Date(date);
    }

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    return `${day}.${month}.${year} г.`;
  }

  /**
   * Check if text looks like a court citation
   */
  looksLikeCourtCitation(text) {
    return (
      text.includes('съд') ||
      text.includes('дело') ||
      text.includes('решение') ||
      text.includes('определение') ||
      /\d+\/\d{4}/.test(text)
    );
  }

  /**
   * Check if text is a law reference
   */
  isLawReference(text) {
    const lawKeywords = ['закон', 'кодекс', 'наредба', 'правилник', 'постановление'];
    const lawAbbreviations = ['ззд', 'тз', 'нк', 'гпк', 'нпк', 'апк'];

    const lowerText = text.toLowerCase();

    return (
      lawKeywords.some((keyword) => lowerText.includes(keyword)) ||
      lawAbbreviations.some((abbrev) => lowerText.includes(abbrev))
    );
  }

  /**
   * Check if citation has valid date
   */
  hasValidDate(citation) {
    return /\d{1,2}\.\d{1,2}\.\d{4}/.test(citation);
  }

  /**
   * Generate URL for court case (if available)
   */
  generateCaseUrl(caseNumber, court) {
    // In a real implementation, this would generate actual URLs to court databases
    const courtUrls = {
      'върховен касационен съд': 'https://vks.bg',
      'върховен административен съд': 'https://vas.bg',
      'апелативен съд': 'https://sofia-aps.org',
    };

    const baseUrl = courtUrls[court.toLowerCase()];
    if (baseUrl && caseNumber) {
      return `${baseUrl}/case/${caseNumber}`;
    }

    return null;
  }

  /**
   * Export citations in different formats
   */
  exportCitations(citations, format = 'text') {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(citations, null, 2);

      case 'csv':
        const headers = 'Citation,Type,Court,Case Number,Date,URL\n';
        const rows = citations
          .map(
            (c) =>
              `"${c.full}","${c.style}","${c.court || ''}","${c.caseNumber || ''}","${c.date || ''}","${c.url || ''}"`,
          )
          .join('\n');
        return headers + rows;

      case 'bibtex':
        return citations.map((c) => this.toBibTeX(c)).join('\n\n');

      default:
        return citations.map((c) => c.full).join('\n');
    }
  }

  /**
   * Convert citation to BibTeX format
   */
  toBibTeX(citation) {
    if (citation.style === 'bulgarian_court') {
      return `@misc{${citation.caseNumber?.replace('/', '_')},
  title={${citation.full}},
  court={${citation.court}},
  year={${citation.date?.split('.')[2] || 'unknown'}},
  url={${citation.url || 'unknown'}}
}`;
    }

    return `@misc{citation,
  title={${citation.full}}
}`;
  }
}
