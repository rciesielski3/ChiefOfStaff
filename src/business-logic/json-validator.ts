/**
 * JSON Validator - Validates JSON structure and provides corruption recovery
 */

interface ValidationSchema {
  required: string[];
  type: Record<string, string>;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class JsonValidator {
  /**
   * Validate JSON data against a schema
   * @param data Object to validate
   * @param schema Validation schema with required fields and types
   * @returns Validation result with errors if any
   */
  validate(data: unknown, schema: ValidationSchema): ValidationResult {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
      errors.push('Data must be an object');
      return { valid: false, errors };
    }

    const obj = data as Record<string, unknown>;

    // Check required fields
    for (const field of schema.required) {
      if (!(field in obj)) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Check field types
    for (const [field, expectedType] of Object.entries(schema.type)) {
      if (field in obj) {
        const actualType = typeof obj[field];
        if (actualType !== expectedType) {
          errors.push(`Field ${field}: expected ${expectedType}, got ${actualType}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Attempt to repair partial/corrupted JSON by closing unclosed structures
   * @param partial Partial JSON string
   * @returns Repaired JSON string
   */
  attemptRepair(partial: string): string {
    let repaired = partial.trim();

    // Count open braces and close them
    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < repaired.length; i++) {
      const char = repaired[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') openBraces++;
        if (char === '}') openBraces--;
        if (char === '[') openBrackets++;
        if (char === ']') openBrackets--;
      }
    }

    // Close unclosed structures
    while (openBrackets > 0) {
      repaired += ']';
      openBrackets--;
    }

    while (openBraces > 0) {
      repaired += '}';
      openBraces--;
    }

    return repaired;
  }

  /**
   * Get safe default data for corrupted files
   * @param type Data type (e.g., 'article')
   * @returns Default object with required fields
   */
  getDefault(type: string): Record<string, unknown> {
    const defaults: Record<string, Record<string, unknown>> = {
      article: {
        title: '',
        url: '',
        description: '',
        source: '',
        publishedDate: '',
        score: 0,
        createdAt: new Date().toISOString(),
      },
      insight: {
        id: '',
        content: '',
        category: '',
        confidence: 0,
        createdAt: new Date().toISOString(),
      },
    };

    return defaults[type] || { error: 'Unknown type' };
  }
}
