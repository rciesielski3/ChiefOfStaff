import { SensitivityAssessor } from '../../src/services/sensitivity-assessor';

jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"sensitivity": "UNCERTAIN", "confidence": 0.5, "reason": "Claude assessment"}' }],
      }),
    },
  }));
});

describe('SensitivityAssessor', () => {
  let assessor: SensitivityAssessor;

  beforeAll(() => {
    assessor = new SensitivityAssessor();
  });

  test('PII patterns marked PRIVATE', async () => {
    const result = await assessor.assessFact({
      id: 'f1',
      content: 'John Doe (john.doe@example.com) works in DevOps',
      type: 'QUOTE',
    });
    expect(result.sensitivity).toBe('PRIVATE');
    expect(result.confidence).toBeGreaterThan(0.4);
    expect(result.reasons.some(r => r.includes('email'))).toBe(true);
  });

  test('Phone numbers marked PRIVATE', async () => {
    const result = await assessor.assessFact({
      id: 'f2',
      content: 'Call support at 555-123-4567 for help',
      type: 'QUOTE',
    });
    expect(result.sensitivity).toBe('PRIVATE');
    expect(result.reasons.some(r => r.includes('phone'))).toBe(true);
  });

  test('SSN marked PRIVATE', async () => {
    const result = await assessor.assessFact({
      id: 'f3',
      content: 'Employee 123-45-6789 completed training',
      type: 'QUOTE',
    });
    expect(result.sensitivity).toBe('PRIVATE');
  });

  test('Proprietary keywords marked PRIVATE', async () => {
    const result = await assessor.assessFact({
      id: 'f4',
      content: '[CONFIDENTIAL] Our pricing strategy is to undercut competitors',
      type: 'DEFINITION',
    });
    expect(result.sensitivity).toBe('PRIVATE');
    expect(result.reasons.some(r => r.includes('confidential'))).toBe(true);
  });

  test('Generic facts marked PUBLIC', async () => {
    const result = await assessor.assessFact({
      id: 'f5',
      content: 'Kubernetes is an open-source container orchestration platform',
      type: 'DEFINITION',
    });
    expect(result.sensitivity).toBe('PUBLIC');
  });

  test('zero false negatives on PII test set', async () => {
    const piiTestSet = [
      { id: 'pii1', content: 'contact alice@company.com for details', type: 'QUOTE' },
      { id: 'pii2', content: 'SSN: 987-65-4321', type: 'QUOTE' },
      { id: 'pii3', content: 'call (206) 555-0123 for support', type: 'QUOTE' },
      { id: 'pii4', content: 'internal memo - not for distribution', type: 'QUOTE' },
    ];

    const results = await Promise.all(piiTestSet.map(f => assessor.assessFact(f)));
    results.forEach(result => {
      expect(result.sensitivity).not.toBe('PUBLIC');
    });
  });
});
