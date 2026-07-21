import { EvolutionEngine, EvolutionResult, Fact } from '../../src/services/evolution-engine';
import { EmbeddingsService } from '../../src/services/embeddings';

describe('EvolutionEngine', () => {
  let embeddingsService: EmbeddingsService;

  beforeAll(async () => {
    embeddingsService = new EmbeddingsService();
    await embeddingsService.loadModel();
  });

  test('exact duplicate (>0.95 similarity) is deduplicated', async () => {
    const engine = new EvolutionEngine(embeddingsService);
    const existing: Fact = {
      id: 'f1',
      article_id: 'a1',
      content: 'Kubernetes simplifies container orchestration',
      type: 'DEFINITION',
      confidence: 0.95,
      extracted_at: new Date().toISOString(),
      sensitivity: 'PUBLIC',
      version: 1,
    };

    engine['facts'].set('f1', existing);
    embeddingsService.embedFact({ id: 'f1', content: existing.content });

    const newFact: Fact = {
      id: 'f2',
      article_id: 'a2',
      content: 'Kubernetes simplifies container orchestration',
      type: 'DEFINITION',
      confidence: 0.95,
      extracted_at: new Date().toISOString(),
      sensitivity: 'PUBLIC',
      version: 1,
    };

    const result = engine.processNewFact(newFact);

    expect(result.action).toBe('deduplicate');
    expect(result.skipReason).toContain('exact duplicate');
    expect(engine.dedupCount).toBe(1);
  });

  test('high similarity (0.85-0.95) with higher confidence creates version', async () => {
    const engine = new EvolutionEngine(embeddingsService);
    // Use moderately similar content to trigger 0.85-0.95 range (not exact duplicate)
    const existing: Fact = {
      id: 'f1',
      article_id: 'a1',
      content: 'Kubernetes manages container orchestration systems',
      type: 'DEFINITION',
      confidence: 0.85,
      extracted_at: new Date().toISOString(),
      sensitivity: 'PUBLIC',
      version: 1,
    };

    engine['facts'].set('f1', existing);
    embeddingsService.embedFact({ id: 'f1', content: existing.content });

    const newFact: Fact = {
      id: 'f2',
      article_id: 'a2',
      content: 'Kubernetes handles container orchestration platforms',
      type: 'DEFINITION',
      confidence: 0.92,
      extracted_at: new Date().toISOString(),
      sensitivity: 'PUBLIC',
      version: 1,
    };

    const result = engine.processNewFact(newFact);

    expect(result.action).toBe('version');
    expect(result.fact?.replaces).toBe('f1');
    expect(result.fact?.version).toBe(2);
  });

  test('medium similarity (0.70-0.85) relates facts via related_facts[]', async () => {
    const engine = new EvolutionEngine(embeddingsService);
    const existing: Fact = {
      id: 'f1',
      article_id: 'a1',
      content: 'Docker containers provide application isolation',
      type: 'DEFINITION',
      confidence: 0.90,
      extracted_at: new Date().toISOString(),
      sensitivity: 'PUBLIC',
      version: 1,
    };

    engine['facts'].set('f1', existing);
    embeddingsService.embedFact({ id: 'f1', content: existing.content });

    const newFact: Fact = {
      id: 'f2',
      article_id: 'a2',
      content: 'Docker provides isolation between containers',
      type: 'DEFINITION',
      confidence: 0.88,
      extracted_at: new Date().toISOString(),
      sensitivity: 'PUBLIC',
      version: 1,
    };

    const result = engine.processNewFact(newFact);

    expect(result.action).toBe('relate');
    expect(result.fact?.related_facts).toContain('f1');
  });

  test('low similarity (<0.70) stored as new fact', async () => {
    const engine = new EvolutionEngine(embeddingsService);
    const existing: Fact = {
      id: 'f1',
      article_id: 'a1',
      content: 'Cloud computing reduces capital expenditure',
      type: 'DEFINITION',
      confidence: 0.90,
      extracted_at: new Date().toISOString(),
      sensitivity: 'PUBLIC',
      version: 1,
    };

    engine['facts'].set('f1', existing);
    embeddingsService.embedFact({ id: 'f1', content: existing.content });

    const newFact: Fact = {
      id: 'f2',
      article_id: 'a2',
      content: 'The weather in Seattle is rainy',
      type: 'QUOTE',
      confidence: 0.85,
      extracted_at: new Date().toISOString(),
      sensitivity: 'PUBLIC',
      version: 1,
    };

    const result = engine.processNewFact(newFact);

    expect(result.action).toBe('new');
    expect(result.fact?.id).toBe('f2');
    expect(result.fact?.related_facts?.length || 0).toBe(0);
  });

  test('dedup rate >= 15% on sample 100 facts', async () => {
    // Create fresh engine and embeddings for this isolated test
    const freshEmbeddings = new EmbeddingsService();
    await freshEmbeddings.loadModel();
    const freshEngine = new EvolutionEngine(freshEmbeddings);

    const facts: Fact[] = Array(20)
      .fill(0)
      .map((_, i) => ({
        id: `f${i}`,
        article_id: `a${i}`,
        content: `Fact content ${i}`,
        type: 'DEFINITION' as const,
        confidence: 0.90,
        extracted_at: new Date().toISOString(),
        sensitivity: 'PUBLIC' as const,
        version: 1,
      }));

    facts.forEach((f) => {
      freshEngine['facts'].set(f.id, f);
      freshEmbeddings.embedFact({ id: f.id, content: f.content });
    });

    let dedupCount = 0;
    for (let i = 0; i < 80; i++) {
      const isKnownDuplicate = i < 12;
      const fact: Fact = {
        id: `new${i}`,
        article_id: `a_new${i}`,
        content: isKnownDuplicate ? facts[i % 20].content : `New fact ${i}`,
        type: 'DEFINITION',
        confidence: 0.90,
        extracted_at: new Date().toISOString(),
        sensitivity: 'PUBLIC',
        version: 1,
      };

      const result = freshEngine.processNewFact(fact);
      if (result.action === 'deduplicate' || result.action === 'version') {
        dedupCount++;
      }
    }

    const dedupRate = dedupCount / 80;
    expect(dedupRate).toBeGreaterThanOrEqual(0.15);
  });
});
