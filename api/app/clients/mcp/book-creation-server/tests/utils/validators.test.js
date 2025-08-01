/**
 * Tests for validation utilities
 */

const {
  ValidationError,
  validateCreateBookParams,
  validateBookId,
  validateChapterId,
  validateApproveChapterParams,
  validateRegenerateChapterParams,
  validateExportBookParams,
  validateApproveOutlineParams,
  validateListBooksParams,
  validateGetBookProgressParams,
  validateDeleteBookParams,
  validateString,
  validateNumber,
  validateEnum,
  sanitizeString,
  sanitizeAndValidate,
  formatValidationErrors,
  createValidationResult,
  validateMultiple,
} = require('../../utils/validators.js');

describe('Validation Utilities', () => {
  describe('ValidationError', () => {
    it('should create validation error with message', () => {
      const error = new ValidationError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('ValidationError');
    });

    it('should create validation error with field and value', () => {
      const error = new ValidationError('Test error', 'testField', 'testValue');
      expect(error.field).toBe('testField');
      expect(error.value).toBe('testValue');
    });
  });

  describe('validateCreateBookParams', () => {
    it('should validate valid book creation parameters', () => {
      const params = {
        theme: 'Science Fiction Adventure',
        title: 'Journey to Mars',
        genre: 'fiction',
        chapterCount: 12,
        writingStyle: 'creative',
        targetAudience: 'young adults',
      };

      const result = validateCreateBookParams(params);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require theme, title, and genre', () => {
      const params = {};
      const result = validateCreateBookParams(params);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('theme is required and must be a non-empty string');
      expect(result.errors).toContain('title is required and must be a non-empty string');
      expect(result.errors).toContain('genre is required and must be a non-empty string');
    });

    it('should validate genre enum', () => {
      const params = {
        theme: 'Test',
        title: 'Test',
        genre: 'invalid-genre',
      };

      const result = validateCreateBookParams(params);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.includes('genre must be one of'))).toBe(true);
    });

    it('should validate chapter count range', () => {
      const params = {
        theme: 'Test',
        title: 'Test',
        genre: 'fiction',
        chapterCount: 2, // Below minimum
      };

      const result = validateCreateBookParams(params);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('chapterCount must be a number between 3 and 50');
    });

    it('should validate writing style enum', () => {
      const params = {
        theme: 'Test',
        title: 'Test',
        genre: 'fiction',
        writingStyle: 'invalid-style',
      };

      const result = validateCreateBookParams(params);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.includes('writingStyle must be one of'))).toBe(
        true,
      );
    });
  });

  describe('validateBookId', () => {
    it('should validate valid book ID', () => {
      const result = validateBookId('book-123_test');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty or null book ID', () => {
      expect(validateBookId('').isValid).toBe(false);
      expect(validateBookId(null).isValid).toBe(false);
      expect(validateBookId(undefined).isValid).toBe(false);
    });

    it('should reject book ID with invalid characters', () => {
      const result = validateBookId('book@123!');
      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.includes('alphanumeric characters'))).toBe(true);
    });
  });

  describe('validateChapterId', () => {
    it('should validate valid chapter ID', () => {
      const result = validateChapterId('chapter-1_intro');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid chapter ID', () => {
      const result = validateChapterId('chapter#1');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateApproveChapterParams', () => {
    it('should validate valid approval parameters', () => {
      const params = {
        bookId: 'book-123',
        chapterId: 'chapter-1',
        feedback: 'Great chapter!',
      };

      const result = validateApproveChapterParams(params);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require bookId and chapterId', () => {
      const params = {};
      const result = validateApproveChapterParams(params);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.includes('bookId is required'))).toBe(true);
      expect(result.errors.some((error) => error.includes('chapterId is required'))).toBe(true);
    });

    it('should validate feedback type', () => {
      const params = {
        bookId: 'book-123',
        chapterId: 'chapter-1',
        feedback: 123, // Should be string
      };

      const result = validateApproveChapterParams(params);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('feedback must be a string if provided');
    });
  });

  describe('validateRegenerateChapterParams', () => {
    it('should validate valid regeneration parameters', () => {
      const params = {
        bookId: 'book-123',
        chapterId: 'chapter-1',
        feedback: 'Please make it more exciting',
      };

      const result = validateRegenerateChapterParams(params);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require feedback for regeneration', () => {
      const params = {
        bookId: 'book-123',
        chapterId: 'chapter-1',
        // Missing feedback
      };

      const result = validateRegenerateChapterParams(params);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.includes('feedback is required'))).toBe(true);
    });
  });

  describe('validateExportBookParams', () => {
    it('should validate valid export parameters', () => {
      const params = {
        bookId: 'book-123',
        format: 'pdf',
      };

      const result = validateExportBookParams(params);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate format enum', () => {
      const params = {
        bookId: 'book-123',
        format: 'invalid-format',
      };

      const result = validateExportBookParams(params);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.includes('format must be one of'))).toBe(true);
    });
  });

  describe('validateString', () => {
    it('should validate valid string', () => {
      const result = validateString('test string', 'testField');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle required validation', () => {
      const result = validateString(null, 'testField', { required: true });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('testField is required');
    });

    it('should validate string length', () => {
      const result = validateString('ab', 'testField', { minLength: 3 });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.includes('at least 3 characters'))).toBe(true);
    });

    it('should validate pattern', () => {
      const pattern = /^[a-z]+$/;
      const result = validateString('Test123', 'testField', { pattern });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('testField format is invalid');
    });
  });

  describe('validateNumber', () => {
    it('should validate valid number', () => {
      const result = validateNumber(42, 'testField');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle required validation', () => {
      const result = validateNumber(null, 'testField', { required: true });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('testField is required');
    });

    it('should validate number range', () => {
      const result = validateNumber(5, 'testField', { min: 10, max: 20 });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('testField must be at least 10');
    });

    it('should validate integer constraint', () => {
      const result = validateNumber(3.14, 'testField', { integer: true });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('testField must be an integer');
    });
  });

  describe('validateEnum', () => {
    it('should validate valid enum value', () => {
      const result = validateEnum('option1', 'testField', ['option1', 'option2']);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid enum value', () => {
      const result = validateEnum('invalid', 'testField', ['option1', 'option2']);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.includes('must be one of'))).toBe(true);
    });

    it('should handle required validation', () => {
      const result = validateEnum(null, 'testField', ['option1', 'option2'], true);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('testField is required');
    });
  });

  describe('sanitizeString', () => {
    it('should trim whitespace', () => {
      const result = sanitizeString('  test string  ');
      expect(result).toBe('test string');
    });

    it('should remove HTML tags', () => {
      const result = sanitizeString('test <script>alert("xss")</script> string');
      expect(result).toBe('test scriptalert("xss")/script string');
    });

    it('should normalize whitespace', () => {
      const result = sanitizeString('test   multiple    spaces');
      expect(result).toBe('test multiple spaces');
    });

    it('should handle non-string input', () => {
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
      expect(sanitizeString(123)).toBe('');
    });
  });

  describe('validateApproveOutlineParams', () => {
    it('should validate valid approve outline parameters', () => {
      const params = {
        bookId: 'book-123',
        feedback: 'Looks good!',
      };

      const result = validateApproveOutlineParams(params);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require bookId', () => {
      const params = {};
      const result = validateApproveOutlineParams(params);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.includes('bookId is required'))).toBe(true);
    });

    it('should validate feedback type', () => {
      const params = {
        bookId: 'book-123',
        feedback: 123, // Should be string
      };

      const result = validateApproveOutlineParams(params);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('feedback must be a string if provided');
    });
  });

  describe('validateListBooksParams', () => {
    it('should validate valid list books parameters', () => {
      const params = {
        status: 'in_progress',
        genre: 'fiction',
        limit: 10,
      };

      const result = validateListBooksParams(params);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate empty parameters', () => {
      const params = {};
      const result = validateListBooksParams(params);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate status enum', () => {
      const params = {
        status: 'invalid-status',
      };

      const result = validateListBooksParams(params);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.includes('status must be one of'))).toBe(true);
    });

    it('should validate genre enum', () => {
      const params = {
        genre: 'invalid-genre',
      };

      const result = validateListBooksParams(params);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.includes('genre must be one of'))).toBe(true);
    });

    it('should validate limit range', () => {
      const params = {
        limit: 0, // Below minimum
      };

      const result = validateListBooksParams(params);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.includes('limit must be at least 1'))).toBe(true);
    });
  });

  describe('validateGetBookProgressParams', () => {
    it('should validate valid get book progress parameters', () => {
      const params = {
        bookId: 'book-123',
      };

      const result = validateGetBookProgressParams(params);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require bookId', () => {
      const params = {};
      const result = validateGetBookProgressParams(params);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.includes('bookId is required'))).toBe(true);
    });
  });

  describe('validateDeleteBookParams', () => {
    it('should validate valid delete book parameters', () => {
      const params = {
        bookId: 'book-123',
        confirm: true,
      };

      const result = validateDeleteBookParams(params);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require bookId and confirmation', () => {
      const params = {};
      const result = validateDeleteBookParams(params);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.includes('bookId is required'))).toBe(true);
      expect(result.errors.some((error) => error.includes('confirm must be true'))).toBe(true);
    });

    it('should require explicit confirmation', () => {
      const params = {
        bookId: 'book-123',
        confirm: false,
      };

      const result = validateDeleteBookParams(params);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('confirm must be true to delete a book');
    });
  });

  describe('sanitizeAndValidate', () => {
    it('should sanitize and validate parameters', () => {
      const params = {
        theme: '  Science Fiction  ',
        title: 'Journey<script>alert("xss")</script>to Mars',
        genre: 'fiction',
      };

      const result = sanitizeAndValidate(params, validateCreateBookParams);

      expect(result.isValid).toBe(true);
      expect(result.params.theme).toBe('Science Fiction');
      expect(result.params.title).toBe('Journeyscriptalert("xss")/scriptto Mars');
    });

    it('should preserve non-string parameters', () => {
      const params = {
        theme: 'Test',
        title: 'Test',
        genre: 'fiction',
        chapterCount: 10,
      };

      const result = sanitizeAndValidate(params, validateCreateBookParams);

      expect(result.params.chapterCount).toBe(10);
      expect(typeof result.params.chapterCount).toBe('number');
    });
  });

  describe('formatValidationErrors', () => {
    it('should return empty string for no errors', () => {
      const result = formatValidationErrors([]);
      expect(result).toBe('');
    });

    it('should format single error', () => {
      const errors = ['Field is required'];
      const result = formatValidationErrors(errors, 'Test validation');
      expect(result).toBe('Test validation failed: Field is required');
    });

    it('should format multiple errors', () => {
      const errors = ['Field is required', 'Field must be a string'];
      const result = formatValidationErrors(errors, 'Test validation');
      expect(result).toContain('Test validation failed with 2 errors:');
      expect(result).toContain('1. Field is required');
      expect(result).toContain('2. Field must be a string');
    });

    it('should use default context', () => {
      const errors = ['Field is required'];
      const result = formatValidationErrors(errors);
      expect(result).toBe('Input validation failed: Field is required');
    });
  });

  describe('createValidationResult', () => {
    it('should create valid result', () => {
      const result = createValidationResult(true, [], []);

      expect(result.isValid).toBe(true);
      expect(result.hasErrors).toBe(false);
      expect(result.hasWarnings).toBe(false);
      expect(result.errorCount).toBe(0);
      expect(result.warningCount).toBe(0);
      expect(result.summary).toBe('Validation passed');
    });

    it('should create invalid result with errors', () => {
      const errors = ['Error 1', 'Error 2'];
      const warnings = ['Warning 1'];
      const result = createValidationResult(false, errors, warnings);

      expect(result.isValid).toBe(false);
      expect(result.hasErrors).toBe(true);
      expect(result.hasWarnings).toBe(true);
      expect(result.errorCount).toBe(2);
      expect(result.warningCount).toBe(1);
      expect(result.summary).toBe('Validation failed with 2 error(s)');
    });

    it('should include additional data', () => {
      const data = { customField: 'value' };
      const result = createValidationResult(true, [], [], data);

      expect(result.customField).toBe('value');
    });
  });

  describe('validateMultiple', () => {
    it('should validate multiple parameters successfully', () => {
      const validationMap = {
        bookId: validateBookId,
        chapterId: validateChapterId,
      };
      const params = {
        bookId: 'book-123',
        chapterId: 'chapter-1',
      };

      const result = validateMultiple(validationMap, params);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.individualResults.bookId.isValid).toBe(true);
      expect(result.individualResults.chapterId.isValid).toBe(true);
    });

    it('should collect errors from multiple validators', () => {
      const validationMap = {
        bookId: validateBookId,
        chapterId: validateChapterId,
      };
      const params = {
        bookId: '', // Invalid
        chapterId: 'invalid@id', // Invalid
      };

      const result = validateMultiple(validationMap, params);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((error) => error.includes('bookId:'))).toBe(true);
      expect(result.errors.some((error) => error.includes('chapterId:'))).toBe(true);
    });

    it('should skip undefined parameters', () => {
      const validationMap = {
        bookId: validateBookId,
        chapterId: validateChapterId,
      };
      const params = {
        bookId: 'book-123',
        // chapterId is undefined
      };

      const result = validateMultiple(validationMap, params);

      expect(result.isValid).toBe(true);
      expect(result.individualResults.bookId).toBeDefined();
      expect(result.individualResults.chapterId).toBeUndefined();
    });
  });
});
