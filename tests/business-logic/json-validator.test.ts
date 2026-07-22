import { JsonValidator } from '../../src/business-logic/json-validator';

describe('JsonValidator', () => {
  const validator = new JsonValidator();

  const validSchema = {
    required: ['title', 'url'],
    type: {
      title: 'string',
      url: 'string',
      description: 'string',
      score: 'number',
    },
  };

  describe('validate', () => {
    it('should validate correct JSON structure', () => {
      const validData = {
        title: 'Test Article',
        url: 'https://example.com',
        description: 'A test article',
        score: 8.5,
      };

      const result = validator.validate(validData, validSchema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing required fields', () => {
      const invalidData = {
        title: 'Test Article',
        // missing url (required)
        description: 'A test article',
      };

      const result = validator.validate(invalidData, validSchema);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: url');
    });
  });

  describe('attemptRepair', () => {
    it('should detect and repair partial JSON', () => {
      const partialJson = '{"title": "Test", "url": "https://example.com"';
      const repaired = validator.attemptRepair(partialJson);

      expect(repaired).toBe('{"title": "Test", "url": "https://example.com"}');
      expect(() => JSON.parse(repaired)).not.toThrow();
    });
  });

  describe('getDefault', () => {
    it('should provide safe default on unrecoverable corruption', () => {
      const defaultData = validator.getDefault('article');

      expect(defaultData).toHaveProperty('title');
      expect(defaultData).toHaveProperty('url');
      expect(defaultData.title).toBe('');
      expect(defaultData.url).toBe('');
    });
  });
});
