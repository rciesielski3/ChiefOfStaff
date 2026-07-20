import {
  KnowledgeExtractionService,
  extractFactsBatch,
} from '../../src/business-logic/knowledge-extraction';
import {
  KnowledgeFact,
  FactExtractionRequest,
  validateFact,
  CONFIDENCE_THRESHOLDS,
  meetsConfidenceThreshold,
} from '../../src/business-logic/knowledge-types';
import { InMemoryClassificationCache } from '../../src/business-logic/domain-classification-fallback';
import * as fs from 'fs';
import * as path from 'path';

describe('KnowledgeExtractionService', () => {
  const mockRequest: FactExtractionRequest = {
    article_id: 'article_001',
    title: 'Understanding Kubernetes',
    summary: 'A deep dive into container orchestration',
    url: 'https://example.com/k8s',
    full_text: `Kubernetes is a container orchestration platform that automates deployment, scaling, and management of containerized applications. It was originally developed by Google and is now maintained by the Cloud Native Computing Foundation.

Key concepts include Pods, Services, Deployments, and Namespaces. A Pod is the smallest deployable unit in Kubernetes. Services provide stable network endpoints for Pods. Deployments manage ReplicaSets and Pods with rolling updates.

Best practices include setting resource requests and limits for Pods to ensure proper scheduling and prevent node overload. Always use namespaces to organize resources and implement RBAC for security.

Common mistakes include not setting resource limits, using default namespaces in production, and not implementing network policies for Pod-to-Pod communication.`,
  };

  describe('fact schema validation', () => {
    const validFact: KnowledgeFact = {
      id: 'fact_001',
      article_id: 'article_001',
      content: 'Kubernetes is a container orchestration platform that automates deployment and management',
      type: 'DEFINITION',
      confidence: 0.95,
      extraction_method: 'claude',
      extracted_at: new Date().toISOString(),
      version: 1,
      status: 'active',
    };

    it('should validate a correct fact', () => {
      const errors = validateFact(validFact);
      expect(errors).toHaveLength(0);
    });

    it('should reject fact with missing id', () => {
      const fact = { ...validFact, id: '' };
      const errors = validateFact(fact);
      expect(errors.some(e => e.field === 'id')).toBe(true);
    });

    it('should reject fact with content too short', () => {
      const fact = { ...validFact, content: 'Too short' };
      const errors = validateFact(fact);
      expect(errors.some(e => e.field === 'content')).toBe(true);
    });

    it('should reject fact with content too long', () => {
      const fact = {
        ...validFact,
        content: 'a'.repeat(501),
      };
      const errors = validateFact(fact);
      expect(errors.some(e => e.field === 'content')).toBe(true);
    });

    it('should reject fact with invalid type', () => {
      const fact = { ...validFact, type: 'INVALID' as any };
      const errors = validateFact(fact);
      expect(errors.some(e => e.field === 'type')).toBe(true);
    });

    it('should reject fact with confidence out of range', () => {
      const fact = { ...validFact, confidence: 1.5 };
      const errors = validateFact(fact);
      expect(errors.some(e => e.field === 'confidence')).toBe(true);
    });

    it('should reject fact with invalid extraction method', () => {
      const fact = { ...validFact, extraction_method: 'invalid' as any };
      const errors = validateFact(fact);
      expect(errors.some(e => e.field === 'extraction_method')).toBe(true);
    });

    it('should reject fact with invalid timestamp', () => {
      const fact = { ...validFact, extracted_at: 'not-a-date' };
      const errors = validateFact(fact);
      expect(errors.some(e => e.field === 'extracted_at')).toBe(true);
    });

    it('should reject fact with version < 1', () => {
      const fact = { ...validFact, version: 0 };
      const errors = validateFact(fact);
      expect(errors.some(e => e.field === 'version')).toBe(true);
    });
  });

  describe('confidence filtering', () => {
    it('should filter facts by confidence threshold', () => {
      const fact: KnowledgeFact = {
        id: 'fact_001',
        article_id: 'article_001',
        content: 'Kubernetes uses declarative configuration',
        type: 'DEFINITION',
        confidence: 0.85,
        extraction_method: 'claude',
        extracted_at: new Date().toISOString(),
        version: 1,
        status: 'active',
      };

      // DEFINITION requires 0.90, so 0.85 is below threshold
      expect(meetsConfidenceThreshold(fact)).toBe(false);

      // Increase to 0.95
      fact.confidence = 0.95;
      expect(meetsConfidenceThreshold(fact)).toBe(true);
    });

    it('should use type-specific thresholds', () => {
      const baseContent = 'Sample fact';
      const timestamp = new Date().toISOString();

      // QUOTE requires 1.0
      const quote: KnowledgeFact = {
        id: 'fact_q1',
        article_id: 'article_001',
        content: baseContent,
        type: 'QUOTE',
        confidence: 0.99,
        extraction_method: 'claude',
        extracted_at: timestamp,
        version: 1,
        status: 'active',
      };
      expect(meetsConfidenceThreshold(quote)).toBe(false);

      quote.confidence = 1.0;
      expect(meetsConfidenceThreshold(quote)).toBe(true);

      // PATTERN requires 0.75
      const pattern: KnowledgeFact = {
        ...quote,
        id: 'fact_p1',
        type: 'PATTERN',
        confidence: 0.74,
      };
      expect(meetsConfidenceThreshold(pattern)).toBe(false);

      pattern.confidence = 0.75;
      expect(meetsConfidenceThreshold(pattern)).toBe(true);
    });
  });

  describe('article chunking', () => {
    it('should return single chunk for short text', () => {
      const service = new KnowledgeExtractionService();
      const shortText = 'This is a short article';

      // Access private method via any cast for testing
      const chunks = (service as any).chunkArticle(shortText);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(shortText);
    });

    it('should split long text at sentence boundaries', () => {
      const service = new KnowledgeExtractionService();
      const longText =
        'First sentence. ' +
        'Second sentence. ' +
        'Third sentence. '.repeat(600) +
        'Final sentence.';

      const chunks = (service as any).chunkArticle(longText);
      expect(chunks.length).toBeGreaterThan(1);

      // Each chunk should end with a period (except possibly the last)
      for (let i = 0; i < chunks.length - 1; i++) {
        expect(chunks[i]).toMatch(/\.$/);
      }
    });

    it('should not create empty chunks', () => {
      const service = new KnowledgeExtractionService();
      const longText = 'a'.repeat(10000);

      const chunks = (service as any).chunkArticle(longText) as string[];
      expect(chunks.every((c: string) => c.length > 0)).toBe(true);
    });
  });

  describe('fact conversion', () => {
    it('should convert raw facts to KnowledgeFact objects', () => {
      const service = new KnowledgeExtractionService();

      const rawFacts = [
        {
          content: 'Kubernetes automates container management',
          type: 'DEFINITION' as const,
          confidence: 0.92,
        },
      ];

      const converted = (service as any).convertToKnowledgeFacts('article_001', rawFacts);

      expect(converted).toHaveLength(1);
      expect(converted[0]).toMatchObject({
        article_id: 'article_001',
        content: 'Kubernetes automates container management',
        type: 'DEFINITION',
        confidence: 0.92,
        extraction_method: 'claude',
        version: 1,
        status: 'active',
      });
      expect(converted[0].id).toBeDefined();
      expect(converted[0].extracted_at).toBeDefined();
    });

    it('should generate unique IDs for each fact', () => {
      const service = new KnowledgeExtractionService();

      const rawFacts = [
        {
          content: 'Fact one',
          type: 'DEFINITION' as const,
          confidence: 0.9,
        },
        {
          content: 'Fact two',
          type: 'DEFINITION' as const,
          confidence: 0.9,
        },
      ];

      const converted = (service as any).convertToKnowledgeFacts('article_001', rawFacts);

      expect(converted[0].id).not.toBe(converted[1].id);
    });
  });

  describe('extraction error handling', () => {
    it('should handle missing ANTHROPIC_API_KEY gracefully', () => {
      const originalKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      expect(() => {
        new KnowledgeExtractionService();
      }).not.toThrow();

      if (originalKey) {
        process.env.ANTHROPIC_API_KEY = originalKey;
      }
    });

    it('should allow passing custom API key', () => {
      const service = new KnowledgeExtractionService('test-key');
      expect(service).toBeDefined();
    });
  });

  describe('confidence thresholds', () => {
    it('should define thresholds for all fact types', () => {
      const types = ['DEFINITION', 'TECHNIQUE', 'WARNING', 'BENCHMARK', 'QUOTE', 'PATTERN', 'INSIGHT'] as const;

      types.forEach(type => {
        expect(CONFIDENCE_THRESHOLDS[type]).toBeDefined();
        expect(CONFIDENCE_THRESHOLDS[type]).toBeGreaterThanOrEqual(0.7);
        expect(CONFIDENCE_THRESHOLDS[type]).toBeLessThanOrEqual(1.0);
      });
    });

    it('should require high confidence for WARNING type', () => {
      expect(CONFIDENCE_THRESHOLDS['WARNING']).toBe(0.95);
    });

    it('should require perfect confidence for QUOTE type', () => {
      expect(CONFIDENCE_THRESHOLDS['QUOTE']).toBe(1.0);
    });

    it('should allow lower confidence for PATTERN type', () => {
      expect(CONFIDENCE_THRESHOLDS['PATTERN']).toBe(0.75);
    });
  });

  describe('M6.2 domain classification pipeline', () => {
    it('should initialize domain classifiers on construction', () => {
      const service = new KnowledgeExtractionService();
      expect(service).toBeDefined();
      // Classifiers should be initialized (no errors thrown)
    });

    it('should initialize with custom fallback cache', () => {
      const cache = new InMemoryClassificationCache();
      const service = new KnowledgeExtractionService('test-key', 'claude-haiku-4-5', undefined, cache);
      expect(service).toBeDefined();
    });

    it('should classify facts with domain and domain_confidence fields', () => {
      const service = new KnowledgeExtractionService();

      // Create test fact with high-confidence domain keyword
      const testFact: KnowledgeFact = {
        id: 'fact_test_domain_001',
        article_id: 'article_test_001',
        content: 'Kubernetes automates container deployment and orchestration management',
        type: 'DEFINITION',
        confidence: 0.92,
        extraction_method: 'claude',
        extracted_at: new Date().toISOString(),
        version: 1,
        status: 'active',
      };

      // Classify using private method
      const result = (service as any).domainClassifier.classifyFact(testFact);
      expect(result).toBeDefined();
      expect(result.domain).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should attach domain field to facts after extraction', async () => {
      const service = new KnowledgeExtractionService();
      const testFact: KnowledgeFact = {
        id: 'fact_test_domain_002',
        article_id: 'article_test_002',
        content: 'React is a JavaScript library for building user interfaces with components',
        type: 'DEFINITION',
        confidence: 0.92,
        extraction_method: 'claude',
        extracted_at: new Date().toISOString(),
        version: 1,
        status: 'active',
      };

      // Manually call classifyFactsDomains
      const classifiedFacts = await (service as any).classifyFactsDomains([testFact], {
        title: 'Test Article',
        summary: 'Test',
        url: 'https://example.com',
        article_id: 'article_test_002',
        full_text: 'Test',
      });

      expect(classifiedFacts).toHaveLength(1);
      expect(classifiedFacts[0].domain).toBeDefined();
      expect(classifiedFacts[0].domain_confidence).toBeDefined();
      expect(typeof classifiedFacts[0].domain_confidence).toBe('number');
    });

    it('should classify all 26+ domain types without error', () => {
      const service = new KnowledgeExtractionService();
      const allDomains = [
        'ai-safety', 'ml-ops', 'nlp', 'computer-vision', 'reinforcement-learning', 'llm-applications',
        'cloud-infra', 'devops', 'databases', 'networking', 'security',
        'javascript', 'python', 'rust', 'go', 'other-languages',
        'web-dev', 'frontend-frameworks', 'css-design', 'accessibility',
        'cryptography', 'performance', 'testing', 'documentation', 'open-source', 'general',
      ];

      const classifier = (service as any).domainClassifier;
      const availableDomains = classifier.getAllDomains();

      expect(availableDomains.length).toBeGreaterThanOrEqual(26);
      allDomains.forEach(domain => {
        expect(availableDomains).toContain(domain);
      });
    });

    it('should handle cache load/save round-trip', async () => {
      const tempCachePath = '/tmp/test-classifier-cache.json';

      try {
        const service = new KnowledgeExtractionService();

        // Save initial cache (should be empty)
        await service.saveCacheSnapshots(tempCachePath);
        expect(fs.existsSync(tempCachePath)).toBe(true);

        // Load it back
        const service2 = new KnowledgeExtractionService();
        await service2.loadCacheSnapshots(tempCachePath);

        // Cache should be loaded without error
        const combined = service2.getCombinedCache();
        expect(combined).toBeDefined();
        expect(combined.fallback).toBeDefined();
      } finally {
        // Cleanup
        if (fs.existsSync(tempCachePath)) {
          fs.unlinkSync(tempCachePath);
        }
      }
    });

    it('should expose combined cache statistics', () => {
      const service = new KnowledgeExtractionService();
      const cache = service.getCombinedCache();

      expect(cache).toBeDefined();
      expect(cache.fallback).toBeDefined();
      expect(cache.fallback.size).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(cache.fallback.entries)).toBe(true);
    });

    it('should handle missing cache file gracefully', async () => {
      const service = new KnowledgeExtractionService();
      const nonExistentPath = '/tmp/does-not-exist-cache.json';

      // Should not throw, just log a warning
      await service.loadCacheSnapshots(nonExistentPath);
      expect(true).toBe(true); // If we get here, no error was thrown
    });

    it('should validate all classified facts meet schema requirements', async () => {
      const service = new KnowledgeExtractionService();
      const testFacts: KnowledgeFact[] = [
        {
          id: 'fact_domain_schema_001',
          article_id: 'article_schema_001',
          content: 'Docker is a containerization platform that uses images and containers',
          type: 'DEFINITION',
          confidence: 0.90,
          extraction_method: 'claude',
          extracted_at: new Date().toISOString(),
          version: 1,
          status: 'active',
        },
        {
          id: 'fact_domain_schema_002',
          article_id: 'article_schema_001',
          content: 'Always use resource limits in production deployments',
          type: 'TECHNIQUE',
          confidence: 0.85,
          extraction_method: 'claude',
          extracted_at: new Date().toISOString(),
          version: 1,
          status: 'active',
        },
      ];

      const classifiedFacts = await (service as any).classifyFactsDomains(testFacts, {
        title: 'Test',
        summary: 'Test',
        url: 'https://example.com',
        article_id: 'article_schema_001',
        full_text: 'Test',
      });

      // All classified facts should be valid
      classifiedFacts.forEach((fact: KnowledgeFact) => {
        const errors = validateFact(fact);
        expect(errors).toHaveLength(0);
        expect(fact.domain).toBeDefined();
        expect(fact.domain_confidence).toBeDefined();
      });
    });

    it('should populate domain_confidence as a number between 0 and 1', async () => {
      const service = new KnowledgeExtractionService();
      const testFact: KnowledgeFact = {
        id: 'fact_confidence_range_001',
        article_id: 'article_conf_001',
        content: 'React hooks allow state management in functional components',
        type: 'TECHNIQUE',
        confidence: 0.88,
        extraction_method: 'claude',
        extracted_at: new Date().toISOString(),
        version: 1,
        status: 'active',
      };

      const classifiedFacts = await (service as any).classifyFactsDomains([testFact], {
        title: 'React Article',
        summary: 'Guide',
        url: 'https://example.com/react',
        article_id: 'article_conf_001',
        full_text: 'Test',
      });

      const fact = classifiedFacts[0];
      expect(fact.domain_confidence).toBeGreaterThanOrEqual(0);
      expect(fact.domain_confidence).toBeLessThanOrEqual(1);
      expect(typeof fact.domain_confidence).toBe('number');
    });
  });
});
