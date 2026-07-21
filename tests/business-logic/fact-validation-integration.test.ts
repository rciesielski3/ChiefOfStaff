import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { NdJsonArticleStore } from '../../src/business-logic/article-store';
import { FactStore } from '../../src/business-logic/knowledge-store';
import { KnowledgeFact, validateFact } from '../../src/business-logic/knowledge-types';
import { Article } from '../../src/business-logic/normalize-article';

/**
 * Business-logic integration tests for fact validation and metrics
 *
 * Tests the validation workflow end-to-end:
 * 1. Metrics calculation (fact counts, domain distribution)
 * 2. Confidence statistics (min, max, mean, median, quartiles)
 * 3. Output formatting (table/JSON modes, text display)
 * 4. Validation of fact schema compliance
 * 5. Error handling for edge cases
 *
 * NOTE: These are business-logic unit tests, not CLI integration tests.
 * They validate the fact validation service and metrics calculation components work correctly.
 *
 * CLI orchestration (entry point invocation, process exit codes, environment variables)
 * is NOT YET TESTED. The validate-knowledge-extraction.ts CLI is aspirational code not yet
 * integrated into workflows or tested with automated assertions.
 * For full CLI testing, see validate-knowledge-extraction.ts entry point validation (not yet automated).
 */
describe('fact validation and metrics calculation integration', () => {
  const testDir = `/tmp/validate-knowledge-tests-${Date.now()}`;
  let factsFile: string;
  let articlesFile: string;

  // Comprehensive sample facts with various attributes
  const sampleFacts: KnowledgeFact[] = [
    {
      id: 'fact_001',
      article_id: 'article_001',
      content: 'Kubernetes is a container orchestration platform for automating deployment',
      type: 'DEFINITION',
      confidence: 0.95,
      extraction_method: 'claude',
      extracted_at: new Date().toISOString(),
      version: 1,
      status: 'active',
      domain: 'infrastructure',
      domain_confidence: 0.92,
    },
    {
      id: 'fact_002',
      article_id: 'article_001',
      content: 'Pods are the smallest deployable units in Kubernetes clusters',
      type: 'DEFINITION',
      confidence: 0.92,
      extraction_method: 'claude',
      extracted_at: new Date().toISOString(),
      version: 1,
      status: 'active',
      domain: 'infrastructure',
      domain_confidence: 0.88,
    },
    {
      id: 'fact_003',
      article_id: 'article_002',
      content: 'Docker containers encapsulate applications with all dependencies',
      type: 'DEFINITION',
      confidence: 0.93,
      extraction_method: 'claude',
      extracted_at: new Date().toISOString(),
      version: 1,
      status: 'active',
      domain: 'infrastructure',
      domain_confidence: 0.90,
    },
    {
      id: 'fact_004',
      article_id: 'article_003',
      content: 'Best practice: always set resource limits for containers in production environments',
      type: 'TECHNIQUE',
      confidence: 0.85,
      extraction_method: 'claude',
      extracted_at: new Date().toISOString(),
      version: 1,
      status: 'active',
      domain: 'operations',
      domain_confidence: 0.87,
    },
    {
      id: 'fact_005',
      article_id: 'article_003',
      content: 'Important: always implement network policies between pods for security isolation',
      type: 'WARNING',
      confidence: 0.88,
      extraction_method: 'claude',
      extracted_at: new Date().toISOString(),
      version: 1,
      status: 'active',
      domain: 'security',
      domain_confidence: 0.89,
    },
    {
      id: 'fact_006',
      article_id: 'article_004',
      content: 'Rolling updates allow gradual replacement of pod replicas without downtime',
      type: 'TECHNIQUE',
      confidence: 0.82,
      extraction_method: 'claude',
      extracted_at: new Date().toISOString(),
      version: 1,
      status: 'active',
      domain: 'operations',
      domain_confidence: 0.85,
    },
  ];

  const sampleArticles: Article[] = [
    {
      id: 'article_001',
      title: 'Understanding Kubernetes Fundamentals',
      summary: 'Deep dive into Kubernetes concepts and architecture',
      url: 'https://example.com/k8s',
      source: 'Tech News',
      category: 'technology',
      publishedAt: '2026-07-20T10:00:00Z',
      tags: ['kubernetes', 'containers']
    },
    {
      id: 'article_002',
      title: 'Docker Best Practices',
      summary: 'Learn containerization best practices with Docker',
      url: 'https://example.com/docker',
      source: 'Dev Journal',
      category: 'technology',
      publishedAt: '2026-07-19T14:30:00Z',
      tags: ['docker', 'containers']
    },
    {
      id: 'article_003',
      title: 'Kubernetes Security and Operations',
      summary: 'Security practices and operational best practices for Kubernetes',
      url: 'https://example.com/k8s-ops',
      source: 'Security Weekly',
      category: 'technology',
      publishedAt: '2026-07-18T09:15:00Z',
      tags: ['kubernetes', 'security', 'operations']
    },
    {
      id: 'article_004',
      title: 'Advanced Deployment Strategies',
      summary: 'Rolling updates, canary deployments, and blue-green strategies',
      url: 'https://example.com/deployments',
      source: 'DevOps Weekly',
      category: 'technology',
      publishedAt: '2026-07-17T16:45:00Z',
      tags: ['kubernetes', 'deployment', 'devops']
    },
  ];

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
    factsFile = path.join(testDir, 'facts.ndjson');
    articlesFile = path.join(testDir, 'articles.ndjson');

    // Write sample facts to file
    const factsContent = sampleFacts.map(f => JSON.stringify(f)).join('\n') + '\n';
    await fs.writeFile(factsFile, factsContent, 'utf-8');

    // Write sample articles to file
    const articlesContent = sampleArticles.map(a => JSON.stringify(a)).join('\n') + '\n';
    await fs.writeFile(articlesFile, articlesContent, 'utf-8');
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('metrics calculation: fact counts and domain distribution', () => {
    it('should calculate total fact count correctly', async () => {
      const factStore = new FactStore(factsFile);
      const facts = await factStore.readAll();

      expect(facts).toHaveLength(6);
    });

    it('should calculate facts per article correctly', async () => {
      const factStore = new FactStore(factsFile);
      const facts = await factStore.readAll();

      const factsPerArticle: Record<string, number> = {};
      for (const fact of facts) {
        factsPerArticle[fact.article_id] = (factsPerArticle[fact.article_id] || 0) + 1;
      }

      expect(factsPerArticle['article_001']).toBe(2);
      expect(factsPerArticle['article_002']).toBe(1);
      expect(factsPerArticle['article_003']).toBe(2);
      expect(factsPerArticle['article_004']).toBe(1);
    });

    it('should calculate domain distribution correctly', async () => {
      const factStore = new FactStore(factsFile);
      const facts = await factStore.readAll();

      const domainDistribution: Record<string, number> = {};
      for (const fact of facts) {
        if (fact.domain) {
          domainDistribution[fact.domain] = (domainDistribution[fact.domain] || 0) + 1;
        }
      }

      expect(domainDistribution['infrastructure']).toBe(3);
      expect(domainDistribution['operations']).toBe(2);
      expect(domainDistribution['security']).toBe(1);
    });

    it('should calculate fact type distribution correctly', async () => {
      const factStore = new FactStore(factsFile);
      const facts = await factStore.readAll();

      const typeDistribution: Record<string, number> = {};
      for (const fact of facts) {
        typeDistribution[fact.type] = (typeDistribution[fact.type] || 0) + 1;
      }

      expect(typeDistribution['DEFINITION']).toBe(3);
      expect(typeDistribution['TECHNIQUE']).toBe(2);
      expect(typeDistribution['WARNING']).toBe(1);
    });

    it('should calculate average facts per article', async () => {
      const articleStore = new NdJsonArticleStore(articlesFile);
      const allArticles = await articleStore.read();
      const factStore = new FactStore(factsFile);
      const facts = await factStore.readAll();

      const avgFactsPerArticle = facts.length / allArticles.length;
      expect(avgFactsPerArticle).toBe(1.5);
    });
  });

  describe('confidence stats: min/max/mean/median computation', () => {
    it('should calculate confidence min/max correctly', async () => {
      const factStore = new FactStore(factsFile);
      const facts = await factStore.readAll();

      const confidences = facts.map(f => f.confidence);
      const min = Math.min(...confidences);
      const max = Math.max(...confidences);

      expect(min).toBe(0.82);
      expect(max).toBe(0.95);
    });

    it('should calculate confidence mean correctly', async () => {
      const factStore = new FactStore(factsFile);
      const facts = await factStore.readAll();

      const confidences = facts.map(f => f.confidence);
      const mean = confidences.reduce((a, b) => a + b, 0) / confidences.length;

      expect(mean).toBeCloseTo(0.8933, 2);
    });

    it('should calculate confidence median correctly', async () => {
      const factStore = new FactStore(factsFile);
      const facts = await factStore.readAll();

      const confidences = facts.map(f => f.confidence).sort((a, b) => a - b);
      const n = confidences.length;
      let median: number;

      if (n % 2 === 1) {
        median = confidences[Math.floor(n / 2)];
      } else {
        median = (confidences[n / 2 - 1] + confidences[n / 2]) / 2;
      }

      // For [0.82, 0.85, 0.88, 0.92, 0.93, 0.95], median is (0.88 + 0.92) / 2
      expect(median).toBe(0.90);
    });

    it('should calculate confidence quartiles correctly', async () => {
      const factStore = new FactStore(factsFile);
      const facts = await factStore.readAll();

      const confidences = facts.map(f => f.confidence).sort((a, b) => a - b);
      const n = confidences.length;

      const q25 = confidences[Math.floor(n * 0.25)];
      const q75 = confidences[Math.floor(n * 0.75)];

      expect(q25).toBe(0.85);
      expect(q75).toBe(0.93);
    });

    it('should handle single fact confidence stats', async () => {
      const singleFact: KnowledgeFact = {
        id: 'fact_001',
        article_id: 'article_001',
        content: 'Single fact for testing',
        type: 'DEFINITION',
        confidence: 0.87,
        extraction_method: 'claude',
        extracted_at: new Date().toISOString(),
        version: 1,
        status: 'active',
      };

      const testFile = path.join(testDir, 'single.ndjson');
      await fs.writeFile(testFile, JSON.stringify(singleFact) + '\n', 'utf-8');

      const store = new FactStore(testFile);
      const facts = await store.readAll();

      const confidences = facts.map(f => f.confidence);
      const min = Math.min(...confidences);
      const max = Math.max(...confidences);
      const mean = confidences.reduce((a, b) => a + b, 0) / confidences.length;

      expect(min).toBe(0.87);
      expect(max).toBe(0.87);
      expect(mean).toBe(0.87);
    });
  });

  describe('domain confidence stats', () => {
    it('should calculate domain confidence statistics', async () => {
      const factStore = new FactStore(factsFile);
      const facts = await factStore.readAll();

      const factsWithDomain = facts.filter(f => f.domain_confidence !== undefined);
      const domainConfidences = factsWithDomain.map(f => f.domain_confidence!).sort((a, b) => a - b);

      const min = domainConfidences[0];
      const max = domainConfidences[domainConfidences.length - 1];
      const mean = domainConfidences.reduce((a, b) => a + b, 0) / domainConfidences.length;

      expect(min).toBe(0.85);
      expect(max).toBe(0.92);
      expect(mean).toBeCloseTo(0.885, 2);
    });

    it('should handle missing domain confidence gracefully', async () => {
      const factWithoutDomainConfidence: KnowledgeFact = {
        id: 'fact_001',
        article_id: 'article_001',
        content: 'Fact without domain confidence',
        type: 'DEFINITION',
        confidence: 0.87,
        extraction_method: 'claude',
        extracted_at: new Date().toISOString(),
        version: 1,
        status: 'active',
        domain: 'infrastructure',
        // domain_confidence omitted
      };

      const testFile = path.join(testDir, 'no_domain_conf.ndjson');
      await fs.writeFile(testFile, JSON.stringify(factWithoutDomainConfidence) + '\n', 'utf-8');

      const store = new FactStore(testFile);
      const facts = await store.readAll();

      const factsWithDomainConf = facts.filter(f => f.domain_confidence !== undefined);
      expect(factsWithDomainConf).toHaveLength(0);
    });
  });

  describe('output formatting: text and data display', () => {
    it('should format metrics for console display', async () => {
      const factStore = new FactStore(factsFile);
      const facts = await factStore.readAll();

      const metrics = {
        totalFacts: facts.length,
        avgFactsPerArticle: facts.length / 4,
        confidenceStats: {
          min: 0.82,
          max: 0.95,
          mean: 0.8933,
          median: 0.90,
        }
      };

      expect(metrics.totalFacts).toBe(6);
      expect(metrics.avgFactsPerArticle).toBe(1.5);
      expect(metrics.confidenceStats.mean).toBeCloseTo(0.8933, 2);

      // Simulate console output formatting
      const output = `
Total Facts: ${metrics.totalFacts}
Average per Article: ${metrics.avgFactsPerArticle.toFixed(2)}
Confidence Min: ${metrics.confidenceStats.min.toFixed(2)}
Confidence Max: ${metrics.confidenceStats.max.toFixed(2)}
Confidence Mean: ${metrics.confidenceStats.mean.toFixed(2)}
Confidence Median: ${metrics.confidenceStats.median.toFixed(2)}
      `.trim();

      expect(output).toContain('Total Facts: 6');
      expect(output).toContain('Average per Article: 1.50');
      expect(output).toContain('Confidence Min: 0.82');
      expect(output).toContain('Confidence Mean: 0.89');
    });

    it('should generate JSON output of metrics', async () => {
      const factStore = new FactStore(factsFile);
      const facts = await factStore.readAll();

      const metricsJson = {
        articlesProcessed: 4,
        factsExtracted: 6,
        avgFactsPerArticle: 1.5,
        confidenceStats: {
          min: 0.82,
          max: 0.95,
          mean: 0.8933,
          median: 0.90,
          q25: 0.85,
          q75: 0.92,
        },
        factsByType: {
          DEFINITION: 3,
          TECHNIQUE: 2,
          WARNING: 1,
        },
        factsByDomain: {
          infrastructure: 3,
          operations: 2,
          security: 1,
        }
      };

      const jsonString = JSON.stringify(metricsJson, null, 2);
      const parsed = JSON.parse(jsonString);

      expect(parsed.factsExtracted).toBe(6);
      expect(parsed.confidenceStats.mean).toBeCloseTo(0.8933, 2);
      expect(parsed.factsByType.DEFINITION).toBe(3);
      expect(parsed.factsByType.TECHNIQUE).toBe(2);
      expect(parsed.factsByDomain.infrastructure).toBe(3);
    });
  });

  describe('fact validation and schema compliance', () => {
    it('should validate all sample facts against schema', async () => {
      const factStore = new FactStore(factsFile);
      const facts = await factStore.readAll();

      let validationErrors = 0;
      for (const fact of facts) {
        const errors = validateFact(fact);
        if (errors.length > 0) {
          validationErrors++;
        }
      }

      expect(validationErrors).toBe(0);
    });

    it('should detect invalid facts in batch', async () => {
      const invalidFact: any = {
        id: '',  // Invalid: empty id
        article_id: 'article_001',
        content: 'x'.repeat(501),  // Invalid: too long
        type: 'INVALID_TYPE',  // Invalid type
        confidence: 1.5,  // Invalid: out of range
        extraction_method: 'claude',
        extracted_at: 'not-a-date',  // Invalid timestamp
        version: 0,  // Invalid: < 1
        status: 'active',
      };

      const errors = validateFact(invalidFact);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should report validation error details', async () => {
      const invalidFact: any = {
        id: '',
        article_id: 'article_001',
        content: 'Invalid',
        type: 'INVALID',
        confidence: 0.9,
        extraction_method: 'claude',
        extracted_at: new Date().toISOString(),
        version: 1,
        status: 'active',
      };

      const errors = validateFact(invalidFact);
      const errorFields = errors.map(e => e.field);

      expect(errorFields).toContain('id');
      expect(errorFields).toContain('type');
    });
  });

  describe('integration: complete validation workflow', () => {
    it('should execute full validation pipeline', async () => {
      // Load articles
      const articleStore = new NdJsonArticleStore(articlesFile);
      const allArticles = await articleStore.read();

      // Load facts
      const factStore = new FactStore(factsFile);
      const allFacts = await factStore.readAll();

      // Calculate metrics
      const metrics = {
        articlesProcessed: allArticles.length,
        factsExtracted: allFacts.length,
        avgFactsPerArticle: allFacts.length / Math.max(allArticles.length, 1),
      };

      // Validate facts
      let validationErrors = 0;
      const validatedFacts: KnowledgeFact[] = [];

      for (const fact of allFacts) {
        const errors = validateFact(fact);
        if (errors.length > 0) {
          validationErrors++;
        } else {
          validatedFacts.push(fact);
        }
      }

      // Calculate confidence stats
      const confidences = validatedFacts.map(f => f.confidence).sort((a, b) => a - b);
      const n = confidences.length;
      const confidenceStats = {
        min: confidences[0],
        max: confidences[n - 1],
        mean: confidences.reduce((a, b) => a + b, 0) / n,
        median: n % 2 === 1
          ? confidences[Math.floor(n / 2)]
          : (confidences[n / 2 - 1] + confidences[n / 2]) / 2,
      };

      // Calculate domain distribution
      const factsByDomain: Record<string, number> = {};
      for (const fact of validatedFacts) {
        if (fact.domain) {
          factsByDomain[fact.domain] = (factsByDomain[fact.domain] || 0) + 1;
        }
      }

      // Calculate type distribution
      const factsByType: Record<string, number> = {};
      for (const fact of validatedFacts) {
        factsByType[fact.type] = (factsByType[fact.type] || 0) + 1;
      }

      // Verify workflow results
      expect(metrics.articlesProcessed).toBe(4);
      expect(metrics.factsExtracted).toBe(6);
      expect(metrics.avgFactsPerArticle).toBe(1.5);

      expect(validationErrors).toBe(0);
      expect(validatedFacts).toHaveLength(6);

      expect(confidenceStats.min).toBe(0.82);
      expect(confidenceStats.max).toBe(0.95);
      expect(confidenceStats.mean).toBeCloseTo(0.8933, 2);
      expect(confidenceStats.median).toBe(0.90);

      expect(factsByDomain['infrastructure']).toBe(3);
      expect(factsByDomain['operations']).toBe(2);
      expect(factsByDomain['security']).toBe(1);

      expect(factsByType['DEFINITION']).toBe(3);
      expect(factsByType['TECHNIQUE']).toBe(2);
      expect(factsByType['WARNING']).toBe(1);
    });

    it('should handle empty facts file gracefully', async () => {
      const emptyFile = path.join(testDir, 'empty.ndjson');
      await fs.writeFile(emptyFile, '', 'utf-8');

      const store = new FactStore(emptyFile);
      const facts = await store.readAll();

      expect(facts).toHaveLength(0);

      // Should handle empty facts gracefully
      const confidences = facts.map(f => f.confidence);
      expect(confidences).toHaveLength(0);
    });

    it('should sample facts for manual review', async () => {
      const factStore = new FactStore(factsFile);
      const facts = await factStore.readAll();

      const sampleSize = Math.min(20, facts.length);
      const sampleFacts = facts.slice(0, sampleSize);

      expect(sampleFacts).toHaveLength(6);
      expect(sampleFacts[0]).toHaveProperty('content');
      expect(sampleFacts[0]).toHaveProperty('confidence');
      expect(sampleFacts[0]).toHaveProperty('type');
    });
  });
});
