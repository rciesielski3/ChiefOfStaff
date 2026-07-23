import * as fs from 'fs';

/**
 * EmbeddingsService: Mock word-hash vector implementation for testing
 *
 * LIMITATION: This service uses word-based hashing to generate pseudo-vectors,
 * NOT real semantic embeddings. The current implementation:
 * - Generates 384-dimensional vectors based on word hash distributions
 * - Enables testing of similarity search logic and pattern detection
 * - Computes cosine similarity correctly for mock vectors
 *
 * PRODUCTION LIMITATION:
 * Real semantic embeddings (OpenAI, Anthropic Models, etc.) are required for
 * production use. The word-hash approach cannot capture semantic meaning and
 * will produce poor clustering for nuanced domain-specific documents.
 *
 * TODO (M6.5+): Replace generateMockVector() with real embedding model calls:
 * - OpenAI Embeddings API (text-embedding-3-small)
 * - Anthropic Embeddings (when available)
 * - Local embedding model (sentence-transformers)
 *
 * Current mock enables:
 * - Unit test validation of pattern detection logic
 * - Integration testing of the full pipeline
 * - Validation of insight synthesis and storage
 *
 * NOT validated for production:
 * - Semantic similarity accuracy
 * - Domain-specific pattern detection
 * - Real knowledge discovery
 */

interface EmbeddingCache {
  [factId: string]: {
    vector: number[];
    content: string;
  };
}

export class EmbeddingsService {
  private cache: EmbeddingCache = {};
  private model: any;

  async loadModel(): Promise<void> {
    this.model = { loaded: true };
  }

  embedFact(fact: { id: string; content: string }): { fact_id: string; vector: number[] } {
    const mockVector = this.generateMockVector(fact.content);
    this.cache[fact.id] = {
      vector: mockVector,
      content: fact.content,
    };
    return {
      fact_id: fact.id,
      vector: mockVector,
    };
  }

  similaritySearch(factId: string, topN: number = 5): { related_fact_id: string; similarity_score: number }[] {
    const targetVector = this.cache[factId]?.vector;
    if (!targetVector) return [];

    const scores = Object.entries(this.cache)
      .filter(([id]) => id !== factId)
      .map(([id, { vector }]) => ({
        related_fact_id: id,
        similarity_score: this.cosineSimilarity(targetVector, vector),
      }))
      .filter(score => score.similarity_score > 0.35) // Filter out weak similarities
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, topN);

    return scores;
  }

  saveCacheToNDJSON(filePath: string): void {
    const lines = Object.entries(this.cache).map(([id, data]) =>
      JSON.stringify({ fact_id: id, ...data })
    );
    fs.writeFileSync(filePath, lines.join('\n'));
  }

  loadCacheFromNDJSON(filePath: string): void {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    this.cache = {};
    lines.forEach(line => {
      const { fact_id, vector, content } = JSON.parse(line);
      this.cache[fact_id] = { vector, content };
    });
  }

  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    // Standard cosine similarity
    const dotProduct = vec1.reduce((sum, a, i) => sum + a * vec2[i], 0);
    const norm1 = Math.sqrt(vec1.reduce((sum, a) => sum + a * a, 0));
    const norm2 = Math.sqrt(vec2.reduce((sum, a) => sum + a * a, 0));
    const cosineSim = dotProduct / (norm1 * norm2);

    // The vector-based similarity is typically sufficient since vectors are
    // generated with word-based hashing that naturally produces high similarity
    // for content with shared words
    return cosineSim;
  }

  private generateMockVector(content: string): number[] {
    // Extract significant words to create semantic-aware vectors
    const words = content.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !this.isStopWord(w));
    const vector = Array(384).fill(0);

    if (words.length === 0) {
      return Array(384).fill(1 / Math.sqrt(384));
    }

    // Create a stable hash for each word and use it to determine vector dimensions
    words.forEach(word => {
      // Use a simple hash function that's consistent
      let wordHash = 0;
      for (let i = 0; i < word.length; i++) {
        wordHash = ((wordHash << 5) - wordHash) + word.charCodeAt(i);
        wordHash = wordHash & wordHash; // Convert to 32-bit integer
      }

      // Use absolute value to ensure consistent results
      wordHash = Math.abs(wordHash);

      // Each word activates specific dimensions based on its hash
      // Words that are the same will activate the exact same dimensions
      const baseDimensions = 50;
      for (let j = 0; j < baseDimensions; j++) {
        const dimension = (wordHash * 73 + j * 17) % 384;
        // Use consistent deterministic values based on word hash
        const value = 1.0 / Math.sqrt(baseDimensions);
        vector[dimension] += value;
      }
    });

    // Normalize to unit length
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (magnitude > 0.01) {
      return vector.map(v => v / magnitude);
    }

    return Array(384).fill(1 / Math.sqrt(384));
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'from', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'should', 'could', 'may', 'might', 'can', 'must', 'shall', 'this',
      'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
    ]);
    return stopWords.has(word);
  }
}
