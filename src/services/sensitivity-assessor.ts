import Anthropic from '@anthropic-ai/sdk';

export interface SensitivityResult {
  sensitivity: 'PUBLIC' | 'PRIVATE' | 'UNCERTAIN';
  confidence: number;
  reasons: string[];
}

interface FactToAssess {
  id: string;
  content: string;
  type?: string;
}

export class SensitivityAssessor {
  private piiPatterns: { name: string; regex: RegExp }[] = [
    { name: 'email', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
    { name: 'phone', regex: /(?:\d{3}[-.]?\d{3}[-.]?\d{4}|\(\d{3}\)\s?\d{3}[-.]?\d{4})/g },
    { name: 'ssn', regex: /\b\d{3}-\d{2}-\d{4}\b/g },
    { name: 'credit_card', regex: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g },
  ];

  private proprietaryKeywords = [
    'confidential',
    'proprietary',
    'internal only',
    'not for distribution',
    'secret',
    'classified',
  ];

  private anthropic = new Anthropic();

  async assessFact(fact: FactToAssess): Promise<SensitivityResult> {
    const heuristicResult = this.heuristicCheck(fact.content);

    if (heuristicResult.confidence > 0.8) {
      return heuristicResult;
    }

    if (heuristicResult.sensitivity === 'UNCERTAIN') {
      return await this.claudeFallback(fact);
    }

    return heuristicResult;
  }

  private heuristicCheck(content: string): SensitivityResult {
    const reasons: string[] = [];
    let privateScore = 0;
    let piiFound = false;
    let keywordFound = false;

    this.piiPatterns.forEach(({ name, regex }) => {
      if (regex.test(content)) {
        reasons.push(`Found ${name}`);
        privateScore += 0.4;
        piiFound = true;
      }
    });

    const lowerContent = content.toLowerCase();
    this.proprietaryKeywords.forEach(keyword => {
      if (lowerContent.includes(keyword)) {
        reasons.push(`Contains proprietary keyword: "${keyword}"`);
        privateScore += 0.3;
        keywordFound = true;
      }
    });

    // Sensitivity-first: any PII pattern or proprietary keyword found → PRIVATE
    if (piiFound || keywordFound || privateScore > 0.5) {
      return {
        sensitivity: 'PRIVATE',
        confidence: Math.min(Math.max(privateScore, 0.7), 0.99),
        reasons,
      };
    }

    if (reasons.length === 0 && privateScore === 0) {
      return {
        sensitivity: 'PUBLIC',
        confidence: 0.95,
        reasons: ['No PII or proprietary markers detected'],
      };
    }

    return {
      sensitivity: 'UNCERTAIN',
      confidence: 0.5,
      reasons: reasons.length > 0 ? reasons : ['Ambiguous patterns'],
    };
  }

  private async claudeFallback(fact: FactToAssess): Promise<SensitivityResult> {
    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-opus-4-1',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: `Is this fact sensitive (contains PII, proprietary info, or personal data)?

Fact: "${fact.content}"

Answer ONLY with JSON: {"sensitivity": "PUBLIC" or "PRIVATE" or "UNCERTAIN", "confidence": 0.0-1.0, "reason": "brief reason"}`,
          },
        ],
      });

      const responseText =
        message.content[0].type === 'text' ? message.content[0].text : '{}';
      const parsed = JSON.parse(responseText);

      return {
        sensitivity: parsed.sensitivity || 'UNCERTAIN',
        confidence: parsed.confidence || 0.5,
        reasons: [parsed.reason || 'Claude assessment'],
      };
    } catch (error) {
      return {
        sensitivity: 'UNCERTAIN',
        confidence: 0.3,
        reasons: ['Claude fallback failed, defaulting to UNCERTAIN'],
      };
    }
  }
}
