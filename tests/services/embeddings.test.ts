import { EmbeddingsService } from '../../src/services/embeddings';

describe('EmbeddingsService', () => {
  let service: EmbeddingsService;

  beforeAll(async () => {
    service = new EmbeddingsService();
    await service.loadModel();
  });

  test('embedFact returns vector with 384 dimensions', () => {
    const fact = { id: 'fact1', content: 'Kubernetes simplifies container orchestration' };
    const result = service.embedFact(fact);

    expect(result.fact_id).toBe('fact1');
    expect(Array.isArray(result.vector)).toBe(true);
    expect(result.vector.length).toBe(384); // all-MiniLM-L6-v2 dimension
  });

  test('similar facts have high cosine similarity (>0.8)', () => {
    const fact1 = { id: 'f1', content: 'Docker containers isolate applications' };
    const fact2 = { id: 'f2', content: 'Containers isolate applications from the host' };

    service.embedFact(fact1);
    service.embedFact(fact2);

    const related = service.similaritySearch('f1', 10);
    const f2Match = related.find(r => r.related_fact_id === 'f2');

    expect(f2Match).toBeDefined();
    expect(f2Match!.similarity_score).toBeGreaterThan(0.8);
  });

  test('dissimilar facts have low cosine similarity (<0.7)', () => {
    const fact1 = { id: 'f1', content: 'Cloud computing reduces capital expenditure' };
    const fact2 = { id: 'f2', content: 'The weather in Seattle is rainy' };

    service.embedFact(fact1);
    service.embedFact(fact2);

    const related = service.similaritySearch('f1', 10);
    const f2Match = related.find(r => r.related_fact_id === 'f2');

    expect(f2Match).toBeUndefined(); // Not in top 10 results
  });

  test('embeddings persisted to NDJSON and reloaded', () => {
    const testPath = 'data/test-embeddings.ndjson';
    service.saveCacheToNDJSON(testPath);

    const newService = new EmbeddingsService();
    newService.loadCacheFromNDJSON(testPath);

    const related = newService.similaritySearch('f1', 5);
    expect(related.length).toBeGreaterThan(0);

    // Cleanup
    if (require('fs').existsSync(testPath)) {
      require('fs').unlinkSync(testPath);
    }
  });
});
