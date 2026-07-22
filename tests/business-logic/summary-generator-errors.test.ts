import { SummaryGenerator } from '../../src/business-logic/summary-generator';
import { Article } from '../../src/business-logic/normalize-article';
import Anthropic from '@anthropic-ai/sdk';

jest.mock('@anthropic-ai/sdk');

describe('SummaryGenerator — Error Handling', () => {
  const mockApiKey = 'test-key';
  let generator: SummaryGenerator;
  let mockCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate = jest.fn();
    (Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(() => ({
      messages: { create: mockCreate }
    } as any));
    generator = new SummaryGenerator(mockApiKey);
  });

  it('should return empty string when API timeout occurs', async () => {
    const timeoutError = new Error('timeout');
    mockCreate.mockRejectedValue(timeoutError);

    const articles: Article[] = [
      {
        id: 'a1',
        title: 'Test Article',
        summary: 'Summary',
        url: 'https://example.com',
        source: 'Test',
        category: 'test',
        publishedAt: '2026-07-22T10:00:00Z',
        tags: []
      }
    ];

    const result = await generator.generateSummary(articles);
    expect(result).toBe('');
    expect(mockCreate).toHaveBeenCalled();
  });

  it('should return empty string on auth failure (403)', async () => {
    const authError = new Error('Unauthorized');
    mockCreate.mockRejectedValue(authError);

    const articles: Article[] = [
      {
        id: 'a1',
        title: 'Article for Auth Test',
        summary: 'Test',
        url: 'https://example.com',
        source: 'Test',
        category: 'test',
        publishedAt: '2026-07-22T10:00:00Z',
        tags: []
      }
    ];

    const result = await generator.generateSummary(articles);
    expect(result).toBe('');
  });

  it('should return empty string when content array is empty', async () => {
    mockCreate.mockResolvedValue({
      content: [] // Empty content array
    });

    const articles: Article[] = [
      {
        id: 'a1',
        title: 'Malformed Response Test',
        summary: 'Test',
        url: 'https://example.com',
        source: 'Test',
        category: 'test',
        publishedAt: '2026-07-22T10:00:00Z',
        tags: []
      }
    ];

    const result = await generator.generateSummary(articles);
    expect(result).toBe('');
  });
});
