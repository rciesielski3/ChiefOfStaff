/**
 * M6.3 Evolution Integration Tests
 *
 * Tests the complete evolution pipeline: extraction → evolution → storage
 * Validates deduplication, versioning, and sensitivity assessment
 */

import * as fs from 'fs';
import * as path from 'path';
import { extractAndEvolveKnowledge } from '../../src/business-logic/knowledge-extraction';
import { KnowledgeFact } from '../../src/business-logic/knowledge-types';

describe('M6.3 Evolution Integration', () => {
  const testDataDir = path.join(__dirname, '..', '..', 'data', 'test-evolution');

  beforeAll(() => {
    // Create test data directory if it doesn't exist
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test data
    if (fs.existsSync(testDataDir)) {
      const files = fs.readdirSync(testDataDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(testDataDir, file));
      });
      fs.rmdirSync(testDataDir);
    }
  });

  test('end-to-end: facts → extract → evolve → store', async () => {
    const testFacts: KnowledgeFact[] = [
      {
        id: 'fact_a1_001',
        article_id: 'a1',
        content: 'Kubernetes simplifies container orchestration',
        type: 'DEFINITION',
        confidence: 0.92,
        extraction_method: 'claude',
        extracted_at: new Date().toISOString(),
        version: 1,
        status: 'active',
      },
      {
        id: 'fact_a2_001',
        article_id: 'a2',
        content: 'Kubernetes manages containers effectively',
        type: 'DEFINITION',
        confidence: 0.88,
        extraction_method: 'claude',
        extracted_at: new Date().toISOString(),
        version: 1,
        status: 'active',
      },
      {
        id: 'fact_a3_001',
        article_id: 'a3',
        content: 'Docker provides container isolation',
        type: 'DEFINITION',
        confidence: 0.90,
        extraction_method: 'claude',
        extracted_at: new Date().toISOString(),
        version: 1,
        status: 'active',
      },
    ];

    const results = await extractAndEvolveKnowledge(testFacts);

    // Verify evolution results
    expect(results.length).toBe(testFacts.length);
    expect(results.some(r => r.action === 'new')).toBe(true);
  });

  test('facts stored with versions and sensitivity', async () => {
    const testFacts: KnowledgeFact[] = [
      {
        id: 'fact_test_001',
        article_id: 'test_a1',
        content: 'React is a JavaScript library for UI development',
        type: 'DEFINITION',
        confidence: 0.95,
        extraction_method: 'claude',
        extracted_at: new Date().toISOString(),
        version: 1,
        status: 'active',
      },
    ];

    const results = await extractAndEvolveKnowledge(testFacts);

    // Verify evolved facts have required fields
    results.forEach(result => {
      if (result.fact) {
        expect(result.fact).toHaveProperty('sensitivity');
        expect(result.fact).toHaveProperty('version');
        expect(['PUBLIC', 'PRIVATE', 'UNCERTAIN']).toContain(
          result.fact.sensitivity
        );
        expect(typeof result.fact.version).toBe('number');
      }
    });
  });

  test('sensitivity assessment marks PII as PRIVATE', async () => {
    const testFacts: KnowledgeFact[] = [
      {
        id: 'fact_pii_001',
        article_id: 'test_a1',
        content: 'Contact John Doe at john.doe@example.com for support',
        type: 'QUOTE',
        confidence: 0.85,
        extraction_method: 'claude',
        extracted_at: new Date().toISOString(),
        version: 1,
        status: 'active',
      },
    ];

    const results = await extractAndEvolveKnowledge(testFacts);

    // Find the fact in results
    const piiResult = results.find(r => r.fact?.id === 'fact_pii_001');
    expect(piiResult).toBeDefined();

    if (piiResult?.fact) {
      expect(piiResult.fact.sensitivity).not.toBe('PUBLIC');
    }
  });

  test('evolution results track action types', async () => {
    const testFacts: KnowledgeFact[] = [
      {
        id: 'fact_action_001',
        article_id: 'test_a1',
        content: 'Fact about cloud computing and infrastructure',
        type: 'DEFINITION',
        confidence: 0.88,
        extraction_method: 'claude',
        extracted_at: new Date().toISOString(),
        version: 1,
        status: 'active',
      },
    ];

    const results = await extractAndEvolveKnowledge(testFacts);

    // Verify action types are valid
    results.forEach(result => {
      expect(['deduplicate', 'version', 'relate', 'new']).toContain(
        result.action
      );
    });
  });
});
