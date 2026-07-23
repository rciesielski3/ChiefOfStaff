import { EmbeddingsService } from './embeddings';

export interface Fact {
  id: string;
  article_id: string;
  content: string;
  type: 'DEFINITION' | 'TECHNIQUE' | 'WARNING' | 'BENCHMARK' | 'QUOTE' | 'PATTERN';
  confidence: number;
  extracted_at: string;
  sensitivity: 'PUBLIC' | 'PRIVATE' | 'UNCERTAIN';
  replaces?: string;
  version: number;
  related_facts?: string[];
  confidence_updated_by?: string;
}

export interface EvolutionResult {
  action: 'deduplicate' | 'version' | 'relate' | 'new';
  fact?: Fact;
  skipReason?: string;
}

export class EvolutionEngine {
  private facts: Map<string, Fact> = new Map();
  private embeddingsService: EmbeddingsService;
  dedupCount = 0;
  versionCount = 0;
  relateCount = 0;

  constructor(embeddingsService: EmbeddingsService) {
    this.embeddingsService = embeddingsService;
  }

  processNewFact(newFact: Fact): EvolutionResult {
    const related = this.findRelatedFacts(newFact);

    if (related.length === 0) {
      this.facts.set(newFact.id, newFact);
      return { action: 'new', fact: newFact };
    }

    const topMatch = related[0];

    if (topMatch.similarity > 0.95) {
      this.dedupCount++;
      return {
        action: 'deduplicate',
        skipReason: `exact duplicate of fact ${topMatch.fact.id} (similarity: ${topMatch.similarity.toFixed(3)})`,
      };
    }

    if (topMatch.similarity > 0.85) {
      if (newFact.confidence > topMatch.fact.confidence) {
        this.versionCount++;
        const versionedFact: Fact = {
          ...newFact,
          version: topMatch.fact.version + 1,
          replaces: topMatch.fact.id,
          confidence_updated_by: 'new_evidence',
        };
        this.facts.set(versionedFact.id, versionedFact);
        return { action: 'version', fact: versionedFact };
      } else {
        this.dedupCount++;
        return {
          action: 'deduplicate',
          skipReason: `existing fact ${topMatch.fact.id} is more confident (${topMatch.fact.confidence} > ${newFact.confidence})`,
        };
      }
    }

    if (topMatch.similarity > 0.70) {
      this.relateCount++;
      const relatedFact: Fact = {
        ...newFact,
        related_facts: [topMatch.fact.id],
      };
      this.facts.set(newFact.id, relatedFact);
      return { action: 'relate', fact: relatedFact };
    }

    this.facts.set(newFact.id, newFact);
    return { action: 'new', fact: newFact };
  }

  private findRelatedFacts(
    fact: Fact
  ): { fact: Fact; similarity: number }[] {
    this.embeddingsService.embedFact({ id: fact.id, content: fact.content });
    const similarityResults = this.embeddingsService.similaritySearch(fact.id, 5);

    return similarityResults
      .map(({ related_fact_id, similarity_score }) => {
        const relatedFact = this.facts.get(related_fact_id);
        return relatedFact ? { fact: relatedFact, similarity: similarity_score } : null;
      })
      .filter((r): r is { fact: Fact; similarity: number } => r !== null)
      .sort((a, b) => b.similarity - a.similarity);
  }
}
