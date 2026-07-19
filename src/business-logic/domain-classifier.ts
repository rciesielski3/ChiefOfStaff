/**
 * M6.2 Domain Classification — Heuristic Engine
 *
 * Fast, zero-API domain classifier for knowledge facts.
 * Uses keyword matching and fact type hints to classify facts into 26 domains.
 * Confidence scoring reflects match quality (0.0-1.0).
 * Claude fallback (Task 4) handles low-confidence cases.
 *
 * See /docs/knowledge/domain-taxonomy.md for domain definitions and keywords.
 */

import { KnowledgeFact, FactType } from './knowledge-types';

/**
 * Classification result for a fact
 */
export interface DomainClassificationResult {
  domain: string;
  confidence: number;
}

/**
 * Domain definition with keywords
 */
interface DomainDefinition {
  id: string;
  name: string;
  keywords: Set<string>;
  preferredFactTypes: FactType[];
}

/**
 * Heuristic domain classifier for knowledge facts
 *
 * Classifies facts into one of 26 domains using keyword matching + type hints.
 * Zero external API calls. Target: <10ms per fact.
 */
export class DomainClassifier {
  private domains: Map<string, DomainDefinition>;

  constructor() {
    this.domains = this.initializeDomains();
  }

  /**
   * Initialize 26-domain taxonomy with keywords
   */
  private initializeDomains(): Map<string, DomainDefinition> {
    const domains: DomainDefinition[] = [
      // AI/ML (6 domains)
      {
        id: 'ai-safety',
        name: 'AI/ML - Safety',
        keywords: new Set([
          'safety', 'alignment', 'x-risk', 'adversarial', 'robustness',
          'interpretability', 'ethics', 'bias', 'governance', 'attack',
          'exploit', 'jailbreak', 'responsible ai', 'harmful',
        ]),
        preferredFactTypes: ['WARNING', 'PATTERN', 'BENCHMARK'],
      },
      {
        id: 'ml-ops',
        name: 'AI/ML - MLOps',
        keywords: new Set([
          'mlops', 'ml-ops', 'model deployment', 'ml infrastructure',
          'ml lifecycle', 'model serving', 'pipeline', 'monitoring',
          'versioning', 'experiment tracking', 'model registry',
          'feature store', 'ml platform',
        ]),
        preferredFactTypes: ['TECHNIQUE', 'BENCHMARK', 'DEFINITION'],
      },
      {
        id: 'nlp',
        name: 'AI/ML - NLP',
        keywords: new Set([
          'nlp', 'natural language', 'language model', 'transformers',
          'bert', 'gpt', 'tokenization', 'embedding', 'text processing',
          'sentiment', 'named entity', 'parsing', 'corpus', 'vocab',
        ]),
        preferredFactTypes: ['DEFINITION', 'TECHNIQUE', 'BENCHMARK'],
      },
      {
        id: 'computer-vision',
        name: 'AI/ML - Computer Vision',
        keywords: new Set([
          'vision', 'cv', 'image processing', 'object detection', 'cnn',
          'convolutional', 'face recognition', 'segmentation', 'detection',
          'classification', 'yolo', 'opencv', 'image classification',
        ]),
        preferredFactTypes: ['DEFINITION', 'TECHNIQUE', 'BENCHMARK'],
      },
      {
        id: 'reinforcement-learning',
        name: 'AI/ML - Reinforcement Learning',
        keywords: new Set([
          'reinforcement learning', 'rl', 'reward', 'policy',
          'q-learning', 'actor-critic', 'markov decision', 'mdp',
          'game playing', 'exploration', 'exploitation', 'agent',
        ]),
        preferredFactTypes: ['DEFINITION', 'TECHNIQUE', 'BENCHMARK'],
      },
      {
        id: 'llm-applications',
        name: 'AI/ML - LLM Applications',
        keywords: new Set([
          'llm', 'large language model', 'gpt application', 'chatbot',
          'retrieval-augmented', 'rag', 'prompting', 'chain-of-thought',
          'prompt engineering', 'in-context learning', 'fine-tuning',
        ]),
        preferredFactTypes: ['TECHNIQUE', 'DEFINITION', 'BENCHMARK'],
      },

      // Infrastructure (5 domains)
      {
        id: 'cloud-infra',
        name: 'Infrastructure - Cloud',
        keywords: new Set([
          'cloud', 'aws', 'azure', 'gcp', 'cloud computing', 'scalability',
          'lambda', 'serverless', 'instance', 'load balancing', 'vpc',
          'region', 'availability zone', 'elasticity', 'compute',
        ]),
        preferredFactTypes: ['DEFINITION', 'TECHNIQUE', 'BENCHMARK'],
      },
      {
        id: 'devops',
        name: 'Infrastructure - DevOps',
        keywords: new Set([
          'devops', 'deployment', 'ci/cd', 'automation', 'infrastructure as code',
          'terraform', 'orchestration', 'container', 'docker', 'kubernetes',
          'provisioning', 'pipeline', 'release', 'jenkins', 'github actions',
        ]),
        preferredFactTypes: ['TECHNIQUE', 'DEFINITION', 'BENCHMARK'],
      },
      {
        id: 'databases',
        name: 'Infrastructure - Databases',
        keywords: new Set([
          'database', 'sql', 'nosql', 'postgres', 'mongodb', 'redis',
          'cache', 'query', 'schema', 'indexing', 'replication', 'sharding',
          'transaction', 'acid', 'consistency', 'data structure', 'db',
        ]),
        preferredFactTypes: ['DEFINITION', 'TECHNIQUE', 'BENCHMARK'],
      },
      {
        id: 'networking',
        name: 'Infrastructure - Networking',
        keywords: new Set([
          'network', 'dns', 'http', 'tcp/ip', 'protocol', 'latency',
          'bandwidth', 'cdn', 'websocket', 'firewall', 'port', 'socket',
          'routing', 'ip address', 'packet', 'connection',
        ]),
        preferredFactTypes: ['DEFINITION', 'TECHNIQUE', 'BENCHMARK'],
      },
      {
        id: 'security',
        name: 'Infrastructure - Security',
        keywords: new Set([
          'security', 'encryption', 'authentication', 'authorization',
          'oauth', 'jwt', 'tls', 'ssl', 'vulnerability', 'penetration',
          'credential', 'secret', 'hash', 'salt', 'attack', 'exploit',
          'secure', 'privacy',
        ]),
        preferredFactTypes: ['TECHNIQUE', 'WARNING', 'DEFINITION'],
      },

      // Languages (5 domains)
      {
        id: 'javascript',
        name: 'Languages - JavaScript',
        keywords: new Set([
          'javascript', 'js', 'node.js', 'npm', 'react', 'vue', 'angular',
          'typescript', 'async/await', 'promise', 'es6', 'callback',
          'event loop', 'closure', 'hoisting', 'prototype', 'jsx',
        ]),
        preferredFactTypes: ['DEFINITION', 'TECHNIQUE', 'BENCHMARK'],
      },
      {
        id: 'python',
        name: 'Languages - Python',
        keywords: new Set([
          'python', 'pip', 'django', 'flask', 'fastapi', 'numpy',
          'pandas', 'scikit-learn', 'asyncio', 'decorator', 'gil',
          'virtual environment', 'poetry', 'pydantic', 'pytest',
        ]),
        preferredFactTypes: ['DEFINITION', 'TECHNIQUE', 'BENCHMARK'],
      },
      {
        id: 'rust',
        name: 'Languages - Rust',
        keywords: new Set([
          'rust', 'cargo', 'ownership', 'borrow', 'lifetime', 'async',
          'tokio', 'webassembly', 'wasm', 'systems programming', 'unsafe',
          'trait', 'macro', 'pattern matching', 'clippy',
        ]),
        preferredFactTypes: ['DEFINITION', 'TECHNIQUE', 'BENCHMARK'],
      },
      {
        id: 'go',
        name: 'Languages - Go',
        keywords: new Set([
          'go', 'golang', 'goroutine', 'channel', 'concurrency', 'defer',
          'interface', 'package', 'microservice', 'mutex', 'select',
          'go routine', 'error handling', 'dependency injection',
        ]),
        preferredFactTypes: ['DEFINITION', 'TECHNIQUE', 'BENCHMARK'],
      },
      {
        id: 'other-languages',
        name: 'Languages - Other',
        keywords: new Set([
          'java', 'c++', 'c#', 'kotlin', 'swift', 'ruby', 'php',
          'scala', 'haskell', 'erlang', 'clojure', 'objective-c',
          'groovy', 'r programming', 'matlab', 'lua',
        ]),
        preferredFactTypes: ['DEFINITION', 'TECHNIQUE', 'BENCHMARK'],
      },

      // Web/Frontend (4 domains)
      {
        id: 'web-dev',
        name: 'Web/Frontend - Web Development',
        keywords: new Set([
          'web', 'http', 'rest', 'graphql', 'api', 'endpoint', 'cors',
          'web server', 'full-stack', 'web architecture', 'backend',
          'frontend', 'frontend-backend', 'mvc', 'api design',
        ]),
        preferredFactTypes: ['DEFINITION', 'TECHNIQUE', 'BENCHMARK'],
      },
      {
        id: 'frontend-frameworks',
        name: 'Web/Frontend - Frameworks',
        keywords: new Set([
          'frontend', 'ui', 'component', 'state management', 'redux',
          'vuex', 'hooks', 'lifecycle', 'virtual dom', 'render', 'fiber',
          'component composition', 'prop drilling', 'context api',
        ]),
        preferredFactTypes: ['DEFINITION', 'TECHNIQUE', 'BENCHMARK'],
      },
      {
        id: 'css-design',
        name: 'Web/Frontend - CSS & Design',
        keywords: new Set([
          'css', 'design', 'layout', 'flexbox', 'grid', 'responsive',
          'animation', 'sass', 'styled components', 'theme', 'cascade',
          'specificity', 'media query', 'transition', 'transform',
        ]),
        preferredFactTypes: ['DEFINITION', 'TECHNIQUE', 'BENCHMARK'],
      },
      {
        id: 'accessibility',
        name: 'Web/Frontend - Accessibility',
        keywords: new Set([
          'accessibility', 'a11y', 'wcag', 'screen reader', 'keyboard navigation',
          'aria', 'inclusive design', 'ada', 'accessible', 'contrast',
          'semantic html', 'alt text', 'focus management',
        ]),
        preferredFactTypes: ['DEFINITION', 'TECHNIQUE', 'WARNING'],
      },

      // Other (6 domains)
      {
        id: 'cryptography',
        name: 'Other - Cryptography',
        keywords: new Set([
          'cryptography', 'cipher', 'hash', 'sha', 'md5', 'rsa', 'ecdsa',
          'public key', 'private key', 'encryption algorithm', 'asymmetric',
          'symmetric', 'key exchange', 'digital signature', 'merkle',
        ]),
        preferredFactTypes: ['DEFINITION', 'TECHNIQUE', 'BENCHMARK'],
      },
      {
        id: 'performance',
        name: 'Other - Performance',
        keywords: new Set([
          'performance', 'optimization', 'profiling', 'latency',
          'throughput', 'memory', 'cpu', 'benchmarking', 'caching',
          'load time', 'render time', 'query optimization', 'jank',
        ]),
        preferredFactTypes: ['TECHNIQUE', 'BENCHMARK', 'PATTERN'],
      },
      {
        id: 'testing',
        name: 'Other - Testing',
        keywords: new Set([
          'testing', 'unit test', 'integration test', 'e2e', 'jest',
          'pytest', 'mocking', 'coverage', 'tdd', 'bdd', 'test driven',
          'assert', 'fixture', 'stub', 'spy',
        ]),
        preferredFactTypes: ['TECHNIQUE', 'DEFINITION', 'BENCHMARK'],
      },
      {
        id: 'documentation',
        name: 'Other - Documentation',
        keywords: new Set([
          'documentation', 'docs', 'readme', 'api docs', 'docstring',
          'markdown', 'technical writing', 'tutorial', 'guide', 'wiki',
          'handbook', 'runbook', 'changelog',
        ]),
        preferredFactTypes: ['DEFINITION', 'TECHNIQUE'],
      },
      {
        id: 'open-source',
        name: 'Other - Open Source',
        keywords: new Set([
          'open source', 'open source software', 'contribution', 'community',
          'license', 'github', 'pull request', 'fork', 'merge', 'commit',
          'open source project', 'oss', 'contributor',
        ]),
        preferredFactTypes: ['PATTERN', 'DEFINITION', 'TECHNIQUE'],
      },
      {
        id: 'general',
        name: 'Other - General',
        keywords: new Set([
          'general', 'misc', 'other', 'uncategorized', 'various',
        ]),
        preferredFactTypes: ['DEFINITION', 'TECHNIQUE', 'PATTERN', 'INSIGHT', 'QUOTE', 'WARNING', 'BENCHMARK'],
      },
    ];

    const domainMap = new Map<string, DomainDefinition>();
    domains.forEach((domain) => {
      domainMap.set(domain.id, domain);
    });

    return domainMap;
  }

  /**
   * Classify a fact into a domain using heuristic approach
   *
   * Algorithm:
   * 1. Extract keywords from fact content (lowercase split)
   * 2. Count keyword matches per domain
   * 3. Apply type hints (preferred fact types boost confidence)
   * 4. Score based on match quality
   * 5. Return top domain with confidence
   *
   * Confidence scoring:
   * - High (0.80+): 3+ keywords + type hint match
   * - Medium (0.60-0.79): 2 keywords OR type hint alone
   * - Low (0.30-0.59): 1 keyword or type mismatch
   * - Default (0.30): fallback to "general"
   *
   * @param fact The knowledge fact to classify
   * @returns Domain classification with confidence 0.0-1.0
   */
  classifyFact(fact: KnowledgeFact): DomainClassificationResult {
    const contentWords = this.tokenize(fact.content);

    // Score each domain
    const scores: Array<{ domain: string; score: number; matches: number; hasTypeMatch: boolean }> = [];

    for (const [domainId, domain] of this.domains) {
      if (domainId === 'general') continue; // Save general for fallback

      const matches = this.countKeywordMatches(contentWords, domain.keywords);
      const hasTypeMatch = domain.preferredFactTypes.includes(fact.type);

      if (matches > 0 || hasTypeMatch) {
        let score = 0;

        // Score based on keyword matches
        if (matches >= 3) {
          score += 0.6;
        } else if (matches === 2) {
          score += 0.4;
        } else if (matches === 1) {
          score += 0.2;
        }

        // Boost score for type match
        if (hasTypeMatch) {
          score += 0.3;
        }

        scores.push({ domain: domainId, score, matches, hasTypeMatch });
      }
    }

    // Find best domain
    if (scores.length === 0) {
      // No matches: return general domain
      return { domain: 'general', confidence: 0.3 };
    }

    // Sort by score, then by matches (tiebreaker)
    scores.sort((a, b) => b.score - a.score || b.matches - a.matches);
    const best = scores[0];

    // Convert score to confidence
    const confidence = this.scoreToConfidence(best.score, best.matches, best.hasTypeMatch);

    return { domain: best.domain, confidence };
  }

  /**
   * Tokenize fact content into lowercase words
   */
  private tokenize(content: string): Set<string> {
    return new Set(
      content
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 0)
    );
  }

  /**
   * Count keyword matches in content words
   */
  private countKeywordMatches(contentWords: Set<string>, keywords: Set<string>): number {
    let count = 0;
    for (const keyword of keywords) {
      // Check exact word match (case-insensitive already handled)
      if (contentWords.has(keyword)) {
        count++;
      } else if (keyword.includes('-')) {
        // For hyphenated keywords, check phrase match
        const phrase = keyword.replace('-', ' ');
        const phraseWords = phrase.split(' ');
        // All parts of the phrase must be present
        if (phraseWords.every((w) => contentWords.has(w))) {
          count++;
        }
      } else if (keyword.includes('/')) {
        // For slash-separated keywords, check phrase match
        const parts = keyword.split('/');
        // All parts of the slash keyword must be present
        if (parts.every((p) => contentWords.has(p))) {
          count += 0.5;
        }
      }
    }
    return Math.min(count, 10); // Cap at 10 to avoid overflow
  }

  /**
   * Convert raw score to confidence 0.0-1.0
   *
   * Confidence bands:
   * - score >= 0.9: 0.92 confidence (high)
   * - score >= 0.6: 0.80 confidence (medium-high)
   * - score >= 0.5: 0.70 confidence (medium)
   * - score >= 0.3: 0.50 confidence (medium-low)
   * - score < 0.3: 0.30 confidence (low/fallback)
   */
  private scoreToConfidence(score: number, matches: number, hasTypeMatch: boolean): number {
    if (score >= 0.9) {
      return 0.92;
    } else if (score >= 0.6) {
      return 0.80;
    } else if (score >= 0.5) {
      return 0.70;
    } else if (score >= 0.3) {
      return 0.50;
    } else {
      return 0.30;
    }
  }

  /**
   * Get all available domains
   */
  getAllDomains(): string[] {
    return Array.from(this.domains.keys());
  }

  /**
   * Get domain information
   */
  getDomain(domainId: string): DomainDefinition | undefined {
    return this.domains.get(domainId);
  }
}
