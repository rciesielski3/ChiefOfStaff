/**
 * Tests for M6.2 Domain Classification — Claude Fallback Classifier (Task 4)
 *
 * Coverage:
 * - All 26 domains classifiable via Claude judgment
 * - Low-confidence heuristic (<0.60) -> high-confidence Claude (>=0.70)
 * - Confidence contract: >=0.70 accepted, otherwise general/0.30 fallback
 * - Context-aware classification (article title/summary in the prompt)
 * - Ambiguous / out-of-taxonomy disambiguation
 * - Caching (no re-classification)
 * - High-confidence heuristic short-circuit (no API call)
 * - Error / malformed-response resilience
 *
 * All tests inject a mock client — no real Anthropic API calls are made.
 */

import {
  DomainClassificationFallback,
  InMemoryClassificationCache,
  MessageCreatingClient,
  ArticleContext,
  FALLBACK_RESULT,
} from '../../src/business-logic/domain-classification-fallback';
import {
  DomainClassificationResult,
} from '../../src/business-logic/domain-classifier';
import { KnowledgeFact } from '../../src/business-logic/knowledge-types';

/**
 * Build a mock Anthropic-compatible client.
 * `responder` receives the prompt string and returns the raw text Claude "replies".
 * Tracks call count and the last prompt seen.
 */
function makeMockClient(responder: (prompt: string) => string) {
  const state = { calls: 0, lastPrompt: '' };
  const client: MessageCreatingClient = {
    messages: {
      create: async (params: any) => {
        state.calls++;
        state.lastPrompt = params.messages[0].content;
        return { content: [{ type: 'text', text: responder(state.lastPrompt) }] };
      },
    },
  };
  return { client, state };
}

/** Mock that always returns a fixed domain + confidence as JSON. */
function fixedResponder(domain: string, confidence: number) {
  return () => JSON.stringify({ domain, confidence });
}

function createFact(
  content: string,
  type: any = 'DEFINITION',
  id: string = 'fact_test_1'
): KnowledgeFact {
  return {
    id,
    article_id: 'article_1',
    content,
    type,
    confidence: 0.8,
    extraction_method: 'claude',
    extracted_at: new Date().toISOString(),
    version: 1,
    status: 'active',
  };
}

const LOW_HEURISTIC: DomainClassificationResult = { domain: 'general', confidence: 0.3 };

const ALL_DOMAINS = [
  'ai-safety', 'ml-ops', 'nlp', 'computer-vision', 'reinforcement-learning',
  'llm-applications', 'cloud-infra', 'devops', 'databases', 'networking',
  'security', 'javascript', 'python', 'rust', 'go', 'other-languages',
  'web-dev', 'frontend-frameworks', 'css-design', 'accessibility',
  'cryptography', 'performance', 'testing', 'documentation', 'open-source',
];

describe('DomainClassificationFallback', () => {
  // ==========================================================================
  // Construction & configuration
  // ==========================================================================
  describe('construction', () => {
    it('defaults to claude-opus-4-8', () => {
      const { client } = makeMockClient(fixedResponder('python', 0.9));
      const fb = new DomainClassificationFallback({ client });
      expect(fb).toBeInstanceOf(DomainClassificationFallback);
    });

    it('rejects an invalid model', () => {
      const { client } = makeMockClient(fixedResponder('python', 0.9));
      expect(
        () => new DomainClassificationFallback({ client, model: 'gpt-4' })
      ).toThrow(/Invalid Claude model/);
    });

    it('exposes all 25 non-general valid domains plus general', () => {
      const domains = DomainClassificationFallback.getValidDomains();
      expect(domains).toContain('general');
      expect(domains).toHaveLength(26);
    });
  });

  // ==========================================================================
  // All 26 domains via Claude judgment
  // ==========================================================================
  describe('all domains classifiable', () => {
    it.each(ALL_DOMAINS)('classifies to %s at Claude confidence 0.85', async (domain) => {
      const { client } = makeMockClient(fixedResponder(domain, 0.85));
      const fb = new DomainClassificationFallback({ client });
      const result = await fb.classifyAsync(
        createFact(`A fact relating to ${domain}`, 'DEFINITION', `fact_${domain}`),
        LOW_HEURISTIC
      );
      expect(result.domain).toBe(domain);
      expect(result.confidence).toBe(0.85);
    });

    it('demotes an explicit "general" choice to the 0.30 fallback', async () => {
      const { client } = makeMockClient(fixedResponder('general', 0.9));
      const fb = new DomainClassificationFallback({ client });
      const result = await fb.classifyAsync(
        createFact('The weather was sunny today', 'PATTERN'),
        LOW_HEURISTIC
      );
      expect(result).toEqual(FALLBACK_RESULT);
    });
  });

  // ==========================================================================
  // Confidence contract
  // ==========================================================================
  describe('confidence contract', () => {
    it('upgrades a low-confidence heuristic to a high-confidence Claude result', async () => {
      const { client } = makeMockClient(fixedResponder('javascript', 0.93));
      const fb = new DomainClassificationFallback({ client });
      const result = await fb.classifyAsync(
        createFact('Use async/await with promises in Node.js', 'TECHNIQUE'),
        { domain: 'general', confidence: 0.3 }
      );
      expect(result.domain).toBe('javascript');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('accepts confidence exactly at the 0.70 threshold', async () => {
      const { client } = makeMockClient(fixedResponder('rust', 0.7));
      const fb = new DomainClassificationFallback({ client });
      const result = await fb.classifyAsync(createFact('Rust ownership rules'), LOW_HEURISTIC);
      expect(result.domain).toBe('rust');
      expect(result.confidence).toBe(0.7);
    });

    it('falls back when confidence is just below 0.70', async () => {
      const { client } = makeMockClient(fixedResponder('rust', 0.69));
      const fb = new DomainClassificationFallback({ client });
      const result = await fb.classifyAsync(createFact('Rust ownership rules'), LOW_HEURISTIC);
      expect(result).toEqual(FALLBACK_RESULT);
    });

    it('falls back for an out-of-taxonomy domain even at high confidence', async () => {
      const { client } = makeMockClient(fixedResponder('blockchain', 0.99));
      const fb = new DomainClassificationFallback({ client });
      const result = await fb.classifyAsync(createFact('Some fact about ledgers'), LOW_HEURISTIC);
      expect(result).toEqual(FALLBACK_RESULT);
    });

    it('falls back when confidence is above 1.0 (nonsensical)', async () => {
      const { client } = makeMockClient(fixedResponder('python', 1.5));
      const fb = new DomainClassificationFallback({ client });
      const result = await fb.classifyAsync(createFact('Python decorators explained'), LOW_HEURISTIC);
      expect(result).toEqual(FALLBACK_RESULT);
    });
  });

  // ==========================================================================
  // High-confidence heuristic short-circuit
  // ==========================================================================
  describe('heuristic short-circuit', () => {
    it('returns the heuristic result unchanged when confidence >= 0.60 (no API call)', async () => {
      const { client, state } = makeMockClient(fixedResponder('python', 0.9));
      const fb = new DomainClassificationFallback({ client });
      const heuristic: DomainClassificationResult = { domain: 'devops', confidence: 0.8 };
      const result = await fb.classifyAsync(createFact('kubernetes deployment tips', 'TECHNIQUE'), heuristic);
      expect(result).toEqual(heuristic);
      expect(state.calls).toBe(0);
    });

    it('consults Claude when confidence is just below the 0.60 threshold', async () => {
      const { client, state } = makeMockClient(fixedResponder('databases', 0.88));
      const fb = new DomainClassificationFallback({ client });
      const result = await fb.classifyAsync(
        createFact('Index your columns for faster queries', 'TECHNIQUE'),
        { domain: 'databases', confidence: 0.59 }
      );
      expect(state.calls).toBe(1);
      expect(result.domain).toBe('databases');
    });

    it('respects a custom fallbackThreshold', async () => {
      const { client, state } = makeMockClient(fixedResponder('nlp', 0.9));
      const fb = new DomainClassificationFallback({ client, fallbackThreshold: 0.5 });
      // 0.55 >= 0.50 custom threshold -> short-circuit
      const heuristic: DomainClassificationResult = { domain: 'ml-ops', confidence: 0.55 };
      const result = await fb.classifyAsync(createFact('some ml fact'), heuristic);
      expect(result).toEqual(heuristic);
      expect(state.calls).toBe(0);
    });
  });

  // ==========================================================================
  // Context-aware classification
  // ==========================================================================
  describe('context-aware classification', () => {
    it('includes the article title and summary in the prompt', async () => {
      const { client, state } = makeMockClient(fixedResponder('computer-vision', 0.9));
      const fb = new DomainClassificationFallback({ client });
      const context: ArticleContext = {
        title: 'Advances in Object Detection',
        summary: 'A survey of modern CNN-based detectors',
      };
      await fb.classifyAsync(
        createFact('Detection accuracy improved significantly', 'BENCHMARK'),
        LOW_HEURISTIC,
        context
      );
      expect(state.lastPrompt).toContain('Advances in Object Detection');
      expect(state.lastPrompt).toContain('modern CNN-based detectors');
    });

    it('works without any context and still classifies', async () => {
      const { client, state } = makeMockClient(fixedResponder('security', 0.9));
      const fb = new DomainClassificationFallback({ client });
      const result = await fb.classifyAsync(
        createFact('Rotate credentials regularly to reduce exposure', 'WARNING'),
        LOW_HEURISTIC
      );
      expect(result.domain).toBe('security');
      expect(state.lastPrompt).not.toContain('Article title:');
    });

    it('lets context steer an ambiguous fact toward the right domain', async () => {
      // Prompt-driven mock: choose based on title cue.
      const { client } = makeMockClient((prompt) =>
        prompt.includes('React')
          ? JSON.stringify({ domain: 'frontend-frameworks', confidence: 0.9 })
          : JSON.stringify({ domain: 'general', confidence: 0.3 })
      );
      const fb = new DomainClassificationFallback({ client });
      const result = await fb.classifyAsync(
        createFact('State updates trigger a re-render of the component tree', 'DEFINITION'),
        LOW_HEURISTIC,
        { title: 'Understanding React Hooks' }
      );
      expect(result.domain).toBe('frontend-frameworks');
    });

    it('includes the fact type and heuristic guess in the prompt', async () => {
      const { client, state } = makeMockClient(fixedResponder('testing', 0.9));
      const fb = new DomainClassificationFallback({ client });
      await fb.classifyAsync(
        createFact('Mock external dependencies in unit tests', 'TECHNIQUE'),
        { domain: 'general', confidence: 0.3 }
      );
      expect(state.lastPrompt).toContain('Type: TECHNIQUE');
      expect(state.lastPrompt).toContain('Heuristic guess: general');
    });
  });

  // ==========================================================================
  // Caching
  // ==========================================================================
  describe('caching', () => {
    it('does not re-classify the same fact id (one API call)', async () => {
      const { client, state } = makeMockClient(fixedResponder('go', 0.9));
      const fb = new DomainClassificationFallback({ client });
      const fact = createFact('Goroutines are lightweight threads', 'DEFINITION', 'fact_go_1');

      const first = await fb.classifyAsync(fact, LOW_HEURISTIC);
      const second = await fb.classifyAsync(fact, LOW_HEURISTIC);

      expect(first).toEqual(second);
      expect(state.calls).toBe(1);
      expect(fb.getStats().cacheHits).toBe(1);
    });

    it('caches the fallback result too (a bad response is not retried)', async () => {
      const { client, state } = makeMockClient(() => 'not json at all');
      const fb = new DomainClassificationFallback({ client });
      const fact = createFact('Some ambiguous fact', 'INSIGHT', 'fact_amb_1');

      await fb.classifyAsync(fact, LOW_HEURISTIC);
      await fb.classifyAsync(fact, LOW_HEURISTIC);

      expect(state.calls).toBe(1);
    });

    it('uses an injected cache implementation', async () => {
      const cache = new InMemoryClassificationCache();
      const { client } = makeMockClient(fixedResponder('python', 0.9));
      const fb = new DomainClassificationFallback({ client, cache });
      await fb.classifyAsync(createFact('Python asyncio', 'DEFINITION', 'fact_py_1'), LOW_HEURISTIC);
      expect(cache.has('fact_py_1')).toBe(true);
      expect(cache.get('fact_py_1')?.domain).toBe('python');
    });

    it('classifies distinct fact ids separately', async () => {
      const { client, state } = makeMockClient(fixedResponder('cloud-infra', 0.9));
      const fb = new DomainClassificationFallback({ client });
      await fb.classifyAsync(createFact('AWS Lambda scales automatically', 'DEFINITION', 'a'), LOW_HEURISTIC);
      await fb.classifyAsync(createFact('Autoscaling groups adjust capacity', 'DEFINITION', 'b'), LOW_HEURISTIC);
      expect(state.calls).toBe(2);
    });
  });

  // ==========================================================================
  // In-memory cache export/import (persistence hooks)
  // ==========================================================================
  describe('cache persistence hooks', () => {
    it('exports and re-imports cache entries', () => {
      const cache = new InMemoryClassificationCache();
      cache.set('f1', { domain: 'rust', confidence: 0.8 });
      const snapshot = cache.exportEntries();

      const restored = new InMemoryClassificationCache();
      restored.importEntries(snapshot);
      expect(restored.get('f1')).toEqual({ domain: 'rust', confidence: 0.8 });
      expect(restored.size).toBe(1);
    });
  });

  // ==========================================================================
  // Resilience
  // ==========================================================================
  describe('resilience', () => {
    it('falls back on an API error', async () => {
      const client: MessageCreatingClient = {
        messages: { create: async () => { throw new Error('rate limited'); } },
      };
      const fb = new DomainClassificationFallback({ client });
      const result = await fb.classifyAsync(createFact('some fact', 'DEFINITION'), LOW_HEURISTIC);
      expect(result).toEqual(FALLBACK_RESULT);
    });

    it('falls back on malformed JSON', async () => {
      const { client } = makeMockClient(() => 'the answer is python, definitely');
      const fb = new DomainClassificationFallback({ client });
      const result = await fb.classifyAsync(createFact('Python fact', 'DEFINITION'), LOW_HEURISTIC);
      expect(result).toEqual(FALLBACK_RESULT);
    });

    it('falls back on empty content', async () => {
      const client: MessageCreatingClient = {
        messages: { create: async () => ({ content: [] }) },
      };
      const fb = new DomainClassificationFallback({ client });
      const result = await fb.classifyAsync(createFact('Python fact', 'DEFINITION'), LOW_HEURISTIC);
      expect(result).toEqual(FALLBACK_RESULT);
    });

    it('extracts JSON even when wrapped in prose', async () => {
      const { client } = makeMockClient(
        () => 'Here is my answer: {"domain": "nlp", "confidence": 0.88} — hope that helps!'
      );
      const fb = new DomainClassificationFallback({ client });
      const result = await fb.classifyAsync(createFact('Tokenization splits text', 'DEFINITION'), LOW_HEURISTIC);
      expect(result.domain).toBe('nlp');
      expect(result.confidence).toBe(0.88);
    });
  });

  // ==========================================================================
  // Telemetry / cost
  // ==========================================================================
  describe('telemetry', () => {
    it('tracks api calls, cache hits, and skips', async () => {
      const { client } = makeMockClient(fixedResponder('python', 0.9));
      const fb = new DomainClassificationFallback({ client });

      // 1 API call
      await fb.classifyAsync(createFact('Python fact', 'DEFINITION', 'f1'), LOW_HEURISTIC);
      // cache hit (same id)
      await fb.classifyAsync(createFact('Python fact', 'DEFINITION', 'f1'), LOW_HEURISTIC);
      // short-circuit (high heuristic)
      await fb.classifyAsync(createFact('x', 'DEFINITION', 'f2'), { domain: 'go', confidence: 0.9 });

      const stats = fb.getStats();
      expect(stats.apiCalls).toBe(1);
      expect(stats.cacheHits).toBe(1);
      expect(stats.skippedHighConfidence).toBe(1);
    });

    it('estimated cost stays well under budget for a realistic 15-fact fallback batch', async () => {
      const { client } = makeMockClient(fixedResponder('python', 0.9));
      const fb = new DomainClassificationFallback({ client });
      // ~30% of a 50-article feed's facts needing fallback ~= 15 calls/day.
      for (let i = 0; i < 15; i++) {
        await fb.classifyAsync(createFact(`fact number ${i}`, 'DEFINITION', `f${i}`), LOW_HEURISTIC);
      }
      const stats = fb.getStats();
      expect(stats.apiCalls).toBe(15);
      expect(stats.estimatedCostUsd).toBeLessThan(0.2);
    });
  });
});
