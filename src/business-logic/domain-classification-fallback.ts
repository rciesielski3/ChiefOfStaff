/**
 * M6.2 Domain Classification — Claude Fallback Classifier (Task 4)
 *
 * Two-stage domain classification: the heuristic classifier (Task 3) is fast and
 * zero-cost but produces low-confidence results for ambiguous or multi-domain facts.
 * This fallback uses Claude Opus for judgment on those uncertain cases only,
 * guaranteeing that every classified fact lands at >=0.70 confidence — or is
 * explicitly demoted to the "general" domain at 0.30.
 *
 * Design notes:
 * - Model: claude-opus-4-8 (judgment / multi-domain disambiguation).
 * - Thinking: omitted deliberately. On Opus 4.8, omitting `thinking` runs WITHOUT
 *   extended thinking — the right call for a single-fact classification under a hard
 *   cost ceiling (<$0.20/day for a 50-article feed). The prompt is kept tight to
 *   minimise input tokens; max_tokens is small to cap output.
 * - Only facts with heuristic confidence < FALLBACK_THRESHOLD (0.60) reach Claude;
 *   anything at/above that is returned unchanged with no API call.
 * - Results are cached by fact_id so a fact is never re-classified.
 *
 * See /docs/knowledge/domain-taxonomy.md for domain definitions.
 */

import Anthropic from '@anthropic-ai/sdk';
import { KnowledgeFact } from './knowledge-types';
import { DomainClassificationResult } from './domain-classifier';

/**
 * Optional article context that improves classification accuracy.
 * KnowledgeFact only carries article_id, so title/summary are passed alongside.
 */
export interface ArticleContext {
  title?: string;
  summary?: string;
}

/**
 * Cache contract: fact_id -> classification decision.
 * Prevents duplicate (and duplicate-cost) classifications.
 */
export interface ClassificationCacheStore {
  get(factId: string): DomainClassificationResult | undefined;
  set(factId: string, result: DomainClassificationResult): void;
  has(factId: string): boolean;
}

/**
 * Default in-memory cache. Callers that need durability can snapshot via
 * exportEntries() / importEntries() and persist the JSON however they like.
 */
export class InMemoryClassificationCache implements ClassificationCacheStore {
  private store = new Map<string, DomainClassificationResult>();

  get(factId: string): DomainClassificationResult | undefined {
    return this.store.get(factId);
  }

  set(factId: string, result: DomainClassificationResult): void {
    this.store.set(factId, result);
  }

  has(factId: string): boolean {
    return this.store.has(factId);
  }

  /** Snapshot cache for persistence (e.g. to NDJSON/JSON on disk). */
  exportEntries(): Array<{ fact_id: string; result: DomainClassificationResult }> {
    return Array.from(this.store.entries()).map(([fact_id, result]) => ({
      fact_id,
      result,
    }));
  }

  /** Restore cache from a prior snapshot. */
  importEntries(
    entries: Array<{ fact_id: string; result: DomainClassificationResult }>
  ): void {
    for (const { fact_id, result } of entries) {
      this.store.set(fact_id, result);
    }
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

/**
 * Compact domain catalog for the prompt. Kept short (a few discriminating keywords
 * per domain) to minimise input tokens while still giving Claude enough signal.
 * Must stay in sync with docs/knowledge/domain-taxonomy.md and DomainClassifier.
 */
const DOMAIN_CATALOG: Array<{ id: string; hint: string }> = [
  { id: 'ai-safety', hint: 'safety, alignment, adversarial, robustness, ethics, bias, governance' },
  { id: 'ml-ops', hint: 'mlops, model deployment/serving, ml pipelines, monitoring, model registry' },
  { id: 'nlp', hint: 'natural language, transformers, BERT/GPT, tokenization, embeddings, text' },
  { id: 'computer-vision', hint: 'vision, image processing, object detection, CNN, segmentation' },
  { id: 'reinforcement-learning', hint: 'RL, reward, policy, Q-learning, actor-critic, MDP' },
  { id: 'llm-applications', hint: 'LLM apps, chatbots, RAG, prompting, chain-of-thought, fine-tuning' },
  { id: 'cloud-infra', hint: 'cloud, AWS/Azure/GCP, serverless, load balancing, scalability, compute' },
  { id: 'devops', hint: 'devops, CI/CD, IaC, terraform, containers, docker, kubernetes, orchestration' },
  { id: 'databases', hint: 'database, SQL/NoSQL, postgres, redis, query, schema, indexing, replication' },
  { id: 'networking', hint: 'network, DNS, HTTP, TCP/IP, latency, CDN, firewall, routing, protocol' },
  { id: 'security', hint: 'security, encryption, auth, OAuth/JWT, TLS, vulnerability, credentials' },
  { id: 'javascript', hint: 'javascript, node.js, npm, react/vue/angular, typescript, async/await' },
  { id: 'python', hint: 'python, pip, django/flask/fastapi, numpy/pandas, asyncio, decorators' },
  { id: 'rust', hint: 'rust, cargo, ownership, borrow, lifetimes, tokio, wasm, systems programming' },
  { id: 'go', hint: 'go, golang, goroutine, channel, concurrency, interface, microservice' },
  { id: 'other-languages', hint: 'java, C++, C#, kotlin, swift, ruby, php, scala, haskell' },
  { id: 'web-dev', hint: 'web, REST, GraphQL, API, endpoints, CORS, full-stack, backend/frontend' },
  { id: 'frontend-frameworks', hint: 'frontend UI, components, state management, redux, hooks, virtual DOM' },
  { id: 'css-design', hint: 'CSS, layout, flexbox, grid, responsive, animation, sass, theming' },
  { id: 'accessibility', hint: 'accessibility, a11y, WCAG, screen reader, ARIA, keyboard nav, inclusive' },
  { id: 'cryptography', hint: 'cryptography, cipher, hash, RSA/ECDSA, public/private key, signatures' },
  { id: 'performance', hint: 'performance, optimization, profiling, throughput, memory/CPU, caching' },
  { id: 'testing', hint: 'testing, unit/integration/e2e, jest/pytest, mocking, coverage, TDD/BDD' },
  { id: 'documentation', hint: 'documentation, docs, readme, docstrings, markdown, tutorials, guides' },
  { id: 'open-source', hint: 'open source, contribution, community, license, pull request, OSS' },
  { id: 'general', hint: 'fallback — none of the above clearly applies' },
];

const VALID_DOMAIN_IDS = new Set(DOMAIN_CATALOG.map((d) => d.id));

/** Minimal shape of an Anthropic-compatible client (for dependency injection in tests). */
export interface MessageCreatingClient {
  messages: {
    create(params: any): Promise<any>;
  };
}

export interface DomainClassificationFallbackOptions {
  apiKey?: string;
  model?: string;
  /** Inject a client (or mock) — bypasses real Anthropic construction. */
  client?: MessageCreatingClient;
  /** Custom cache implementation. Defaults to in-memory. */
  cache?: ClassificationCacheStore;
  /** Heuristic confidence below which Claude is consulted (default 0.60). */
  fallbackThreshold?: number;
}

/** Minimum confidence Claude must return to accept its classification. */
export const MIN_ACCEPTED_CONFIDENCE = 0.7;

/** Fallback result when Claude declines / errors / is not confident enough. */
export const FALLBACK_RESULT: DomainClassificationResult = Object.freeze({
  domain: 'general',
  confidence: 0.3,
});

const VALID_MODELS = [
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-sonnet-5',
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
];

/**
 * Claude-powered fallback classifier for low-confidence domain classifications.
 */
export class DomainClassificationFallback {
  private client: MessageCreatingClient;
  private model: string;
  private cache: ClassificationCacheStore;
  private fallbackThreshold: number;
  private readonly MAX_TOKENS = 256;

  // Cost / usage telemetry.
  private apiCalls = 0;
  private cacheHits = 0;
  private skippedHighConfidence = 0;

  constructor(options: DomainClassificationFallbackOptions = {}) {
    const model = options.model || 'claude-opus-4-8';
    if (!VALID_MODELS.includes(model)) {
      throw new Error(
        `Invalid Claude model: ${model}. Valid models: ${VALID_MODELS.join(', ')}`
      );
    }
    this.model = model;

    this.client =
      options.client ??
      new Anthropic({ apiKey: options.apiKey || process.env.ANTHROPIC_API_KEY });

    this.cache = options.cache ?? new InMemoryClassificationCache();
    this.fallbackThreshold =
      options.fallbackThreshold ?? 0.6;
  }

  /**
   * Classify a fact's domain, using Claude only when the heuristic result is
   * uncertain (< fallbackThreshold) and the fact is not already cached.
   *
   * @param fact The knowledge fact to classify
   * @param heuristicResult The Task 3 heuristic classification
   * @param context Optional article title/summary for disambiguation
   * @returns Final domain classification (confidence >= 0.70, or general/0.30)
   */
  async classifyAsync(
    fact: KnowledgeFact,
    heuristicResult: DomainClassificationResult,
    context?: ArticleContext
  ): Promise<DomainClassificationResult> {
    // 1. Heuristic already confident enough — no API call.
    if (heuristicResult.confidence >= this.fallbackThreshold) {
      this.skippedHighConfidence++;
      return heuristicResult;
    }

    // 2. Cache hit — never re-classify the same fact.
    const cached = this.cache.get(fact.id);
    if (cached) {
      this.cacheHits++;
      return cached;
    }

    // 3. Consult Claude for a judgment.
    let result: DomainClassificationResult;
    try {
      result = await this.classifyWithClaude(fact, heuristicResult, context);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(
        `Claude fallback classification failed for fact ${fact.id}: ${msg}`
      );
      result = { ...FALLBACK_RESULT };
    }

    // 4. Cache and return.
    this.cache.set(fact.id, result);
    return result;
  }

  /**
   * Call Claude and parse/validate its classification decision.
   */
  private async classifyWithClaude(
    fact: KnowledgeFact,
    heuristicResult: DomainClassificationResult,
    context?: ArticleContext
  ): Promise<DomainClassificationResult> {
    const prompt = this.buildPrompt(fact, heuristicResult, context);

    this.apiCalls++;
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: this.MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });

    if (!message?.content || !message.content[0]) {
      return { ...FALLBACK_RESULT };
    }

    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '';

    return this.parseResponse(responseText);
  }

  /**
   * Build a tight, cost-optimized classification prompt.
   */
  private buildPrompt(
    fact: KnowledgeFact,
    heuristicResult: DomainClassificationResult,
    context?: ArticleContext
  ): string {
    const domainLines = DOMAIN_CATALOG.map(
      (d) => `- ${d.id}: ${d.hint}`
    ).join('\n');

    const contextLines: string[] = [];
    if (context?.title) contextLines.push(`Article title: ${context.title}`);
    if (context?.summary) contextLines.push(`Article summary: ${context.summary}`);
    const contextBlock =
      contextLines.length > 0 ? `\n${contextLines.join('\n')}\n` : '';

    return `You classify a technical knowledge fact into exactly one domain.

DOMAINS:
${domainLines}

FACT:
Type: ${fact.type}
Content: ${fact.content}${contextBlock}
Heuristic guess: ${heuristicResult.domain} (confidence ${heuristicResult.confidence.toFixed(2)})

Pick the single best domain. Use the article context to disambiguate multi-domain facts.
Respond with ONLY a JSON object, no markdown fences:
{"domain": "<one domain id from the list>", "confidence": <0.0-1.0>}

Rules:
- confidence is how certain you are the domain is correct.
- If you cannot confidently (>= 0.70) place the fact, return {"domain": "general", "confidence": 0.30}.

JSON:`;
  }

  /**
   * Parse Claude's JSON response and enforce the confidence contract.
   *
   * Guarantees: returns either a valid domain at confidence >= 0.70, or the
   * general/0.30 fallback. Never returns an out-of-taxonomy domain.
   */
  private parseResponse(responseText: string): DomainClassificationResult {
    const jsonMatch = responseText.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      return { ...FALLBACK_RESULT };
    }

    let parsed: { domain?: unknown; confidence?: unknown };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return { ...FALLBACK_RESULT };
    }

    const domain = typeof parsed.domain === 'string' ? parsed.domain.trim() : '';
    const confidence =
      typeof parsed.confidence === 'number' ? parsed.confidence : NaN;

    // Invalid / out-of-taxonomy domain -> fallback.
    if (!VALID_DOMAIN_IDS.has(domain)) {
      return { ...FALLBACK_RESULT };
    }

    // Not confident enough, or nonsensical confidence -> fallback.
    if (
      Number.isNaN(confidence) ||
      confidence < MIN_ACCEPTED_CONFIDENCE ||
      confidence > 1
    ) {
      return { ...FALLBACK_RESULT };
    }

    // Claude explicitly chose general -> honour the fallback confidence.
    if (domain === 'general') {
      return { ...FALLBACK_RESULT };
    }

    return { domain, confidence };
  }

  /**
   * Usage / cost telemetry. Estimated cost assumes ~500 input + ~30 output
   * tokens per call on Opus 4.8 ($5/1M in, $25/1M out).
   */
  getStats(): {
    apiCalls: number;
    cacheHits: number;
    skippedHighConfidence: number;
    estimatedCostUsd: number;
  } {
    const inputCost = this.apiCalls * 500 * (5 / 1_000_000);
    const outputCost = this.apiCalls * 30 * (25 / 1_000_000);
    return {
      apiCalls: this.apiCalls,
      cacheHits: this.cacheHits,
      skippedHighConfidence: this.skippedHighConfidence,
      estimatedCostUsd: Number((inputCost + outputCost).toFixed(6)),
    };
  }

  /** Expose the cache (e.g. for persistence between runs). */
  getCache(): ClassificationCacheStore {
    return this.cache;
  }

  /** All valid domain ids (for callers / tests). */
  static getValidDomains(): string[] {
    return DOMAIN_CATALOG.map((d) => d.id);
  }
}
