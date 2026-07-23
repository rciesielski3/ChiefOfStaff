import { SummaryGenerator } from '../../src/business-logic/summary-generator';
import { Article } from '../../src/business-logic/normalize-article';
import Anthropic from '@anthropic-ai/sdk';

jest.mock('@anthropic-ai/sdk');

describe('SummaryGenerator', () => {
  const mockApiKey = 'test-api-key';
  let generator: SummaryGenerator;
  let mockCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate = jest.fn();
    (Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(() => ({
      messages: {
        create: mockCreate
      }
    } as any));
    generator = new SummaryGenerator(mockApiKey);
  });

  it('should generate a 1-2 sentence summary from articles (20-300 chars)', async () => {
    const mockSummary = 'This week featured releases in testing automation and container orchestration, alongside industry surveys on web development trends.';
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: mockSummary }]
    });

    const articles: Article[] = [
      {
        id: 'test-1',
        title: 'Playwright 1.50 released with new features',
        summary: 'New automation testing features',
        url: 'https://example.com/1',
        source: 'Playwright Blog',
        category: 'release',
        publishedAt: '2026-07-20T10:00:00Z',
        tags: ['playwright', 'testing', 'automation']
      },
      {
        id: 'test-2',
        title: 'Kubernetes 1.31 update: scaling improvements',
        summary: 'Container orchestration improvements',
        url: 'https://example.com/2',
        source: 'Kubernetes Blog',
        category: 'release',
        publishedAt: '2026-07-20T11:00:00Z',
        tags: ['kubernetes', 'devops']
      },
      {
        id: 'test-3',
        title: 'Survey: State of Web Development 2026',
        summary: 'Industry survey results',
        url: 'https://example.com/3',
        source: 'Developer News',
        category: 'news',
        publishedAt: '2026-07-20T12:00:00Z',
        tags: ['survey', 'web-development']
      }
    ];

    const summary = await generator.generateSummary(articles);

    // Should return a non-empty string
    expect(summary).toBeDefined();
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThanOrEqual(20);
    expect(summary.length).toBeLessThanOrEqual(300);

    // Should look like 1-2 sentences (check for period count)
    const sentenceCount = (summary.match(/\./g) || []).length;
    expect(sentenceCount).toBeGreaterThanOrEqual(1);
    expect(sentenceCount).toBeLessThanOrEqual(2);

    // Verify the API was called
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-opus-4-1-20250805',
        max_tokens: 150,
        messages: expect.any(Array)
      })
    );
  });

  it('should return empty string when articles array is empty', async () => {
    const articles: Article[] = [];

    const summary = await generator.generateSummary(articles);

    expect(summary).toBe('');
  });

  it('should mention key themes from articles in summary', async () => {
    const mockSummary = 'This week explored AI agents and LLM prompt engineering, with discussion of advanced coding patterns used in AI development.';
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: mockSummary }]
    });

    const articles: Article[] = [
      {
        id: 'ai-1',
        title: 'Building AI Agents with Claude and Node.js',
        summary: 'Learn how to build AI agents',
        url: 'https://example.com/ai-1',
        source: 'Tech Blog',
        category: 'article',
        publishedAt: '2026-07-20T10:00:00Z',
        tags: ['ai', 'llm', 'node.js', 'coding']
      },
      {
        id: 'ai-2',
        title: 'LLM Prompt Engineering Best Practices',
        summary: 'Optimize your LLM prompts',
        url: 'https://example.com/ai-2',
        source: 'AI Research',
        category: 'article',
        publishedAt: '2026-07-20T11:00:00Z',
        tags: ['ai', 'llm', 'machine-learning']
      },
      {
        id: 'ai-3',
        title: 'Advanced Coding Patterns in AI Development',
        summary: 'Patterns for AI development',
        url: 'https://example.com/ai-3',
        source: 'Developer Guide',
        category: 'article',
        publishedAt: '2026-07-20T12:00:00Z',
        tags: ['coding', 'ai', 'development']
      }
    ];

    const summary = await generator.generateSummary(articles);

    // Summary should mention key themes
    expect(summary).toBeDefined();
    expect(summary.length).toBeGreaterThan(0);

    // Should contain references to key themes like AI, agents, LLM, or coding
    const lowerSummary = summary.toLowerCase();
    const hasAITheme =
      lowerSummary.includes('ai') ||
      lowerSummary.includes('agent') ||
      lowerSummary.includes('llm') ||
      lowerSummary.includes('coding') ||
      lowerSummary.includes('prompt') ||
      lowerSummary.includes('develop');

    expect(hasAITheme).toBe(true);

    // Verify the API was called
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
