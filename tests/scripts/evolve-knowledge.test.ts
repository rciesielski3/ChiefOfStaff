/**
 * Tests for evolve-knowledge script resilience to malformed JSON
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { KnowledgeFact } from '../../src/business-logic/knowledge-types';

describe('evolve-knowledge resilience', () => {
  let tempDir: string;
  let inputFile: string;
  let outputFile: string;
  let embeddingsCacheFile: string;

  beforeAll(() => {
    // Create temporary directory for test fixtures
    tempDir = fs.mkdtempSync(path.join(__dirname, '../../tmp-'));
    inputFile = path.join(tempDir, 'input_facts.ndjson');
    outputFile = path.join(tempDir, 'output_facts.ndjson');
    embeddingsCacheFile = path.join(tempDir, 'embeddings_cache.ndjson');
  });

  afterAll(() => {
    // Cleanup temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should recover from malformed JSON and continue processing valid facts', () => {
    // Create a valid fact
    const validFact1: KnowledgeFact = {
      id: 'fact-1',
      article_id: 'article-1',
      content: 'This is a valid fact with enough characters to meet minimum length requirement',
      type: 'DEFINITION',
      confidence: 0.95,
      extraction_method: 'claude',
      extracted_at: new Date().toISOString(),
      version: 1,
      status: 'active',
    };

    // Create malformed JSON string
    const malformedJson = '{"id": "fact-2", "article_id": "article-2", "content": "incomplete json';

    // Create another valid fact
    const validFact2: KnowledgeFact = {
      id: 'fact-3',
      article_id: 'article-3',
      content: 'Another valid fact with sufficient characters to satisfy minimum length constraint',
      type: 'TECHNIQUE',
      confidence: 0.85,
      extraction_method: 'claude',
      extracted_at: new Date().toISOString(),
      version: 1,
      status: 'active',
    };

    // Write the mixed input file (valid → invalid → valid)
    const lines = [
      JSON.stringify(validFact1),
      malformedJson,
      JSON.stringify(validFact2),
    ];
    fs.writeFileSync(inputFile, lines.join('\n'));

    // Ensure embeddings cache exists
    fs.writeFileSync(embeddingsCacheFile, '');

    // Run the script - should exit with 0 (success) despite malformed JSON
    const output = execSync(
      `INPUT_FACTS=${inputFile} OUTPUT_FACTS=${outputFile} EMBEDDINGS_CACHE=${embeddingsCacheFile} npm run evolve-knowledge`,
      {
        cwd: path.join(__dirname, '../../'),
        encoding: 'utf-8',
      }
    );

    // Verify the output contains skip information in results
    expect(output).toContain('Skipped facts: 1');

    // Verify output file was written and contains valid facts (or evolution results)
    expect(fs.existsSync(outputFile)).toBe(true);
  });

  it('should report count of skipped facts due to parse errors', () => {
    // Create multiple valid facts
    const validFact1: KnowledgeFact = {
      id: 'fact-1',
      article_id: 'article-1',
      content: 'First valid fact with enough content to satisfy character count requirements',
      type: 'DEFINITION',
      confidence: 0.92,
      extraction_method: 'claude',
      extracted_at: new Date().toISOString(),
      version: 1,
      status: 'active',
    };

    const validFact2: KnowledgeFact = {
      id: 'fact-2',
      article_id: 'article-2',
      content: 'Second valid fact with enough content to meet minimum character count requirement',
      type: 'WARNING',
      confidence: 0.98,
      extraction_method: 'claude',
      extracted_at: new Date().toISOString(),
      version: 1,
      status: 'active',
    };

    // Create malformed JSON strings
    const malformedJson1 = '{"id": "bad-1", "content": "incomplete';
    const malformedJson2 = 'not json at all {]';

    // Write input file with multiple malformed lines
    const lines = [
      JSON.stringify(validFact1),
      malformedJson1,
      JSON.stringify(validFact2),
      malformedJson2,
    ];
    fs.writeFileSync(inputFile, lines.join('\n'));

    // Ensure embeddings cache exists
    fs.writeFileSync(embeddingsCacheFile, '');

    // Run the script
    const output = execSync(
      `INPUT_FACTS=${inputFile} OUTPUT_FACTS=${outputFile} EMBEDDINGS_CACHE=${embeddingsCacheFile} npm run evolve-knowledge`,
      {
        cwd: path.join(__dirname, '../../'),
        encoding: 'utf-8',
      }
    );

    // Verify it reports count of skipped facts (should show in Evolution results)
    expect(output).toContain('Skipped facts: 2');
  });
});
