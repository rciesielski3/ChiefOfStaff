import { generateBrief, generatePlainTextBrief } from '../../src/business-logic/generate-brief';
import { ScoredArticle } from '../../src/business-logic/score-article';

describe('generateBrief', () => {
  /**
   * Test fixture: Mock scored articles for testing
   */
  const mockArticles: ScoredArticle[] = [
    {
      id: 'test-1',
      title: 'Playwright 1.48 ships with flaky test quarantine',
      summary: 'New feature helps identify and isolate flaky tests',
      url: 'https://example.com/playwright-1-48',
      source: 'Playwright Blog',
      category: 'release',
      publishedAt: new Date('2026-07-11T14:00:00Z').toISOString(),
      tags: ['playwright', 'testing', 'release'],
      score: 110,
      priority: 'CRITICAL',
      reason: ['playwright', 'release', 'testing']
    },
    {
      id: 'test-2',
      title: 'TypeScript 5.4 released with new performance improvements',
      summary: 'Major version bump includes compiler optimizations',
      url: 'https://example.com/ts-5-4',
      source: 'TypeScript Blog',
      category: 'release',
      publishedAt: new Date('2026-07-10T10:00:00Z').toISOString(),
      tags: ['typescript', 'release'],
      score: 85,
      priority: 'HIGH',
      reason: ['typescript', 'release']
    },
    {
      id: 'test-3',
      title: 'Security: Critical CVE in popular npm package',
      summary: 'Update recommended immediately for production systems',
      url: 'https://example.com/cve-2026-123',
      source: 'Security Weekly',
      category: 'news',
      publishedAt: new Date('2026-07-09T08:00:00Z').toISOString(),
      tags: ['security'],
      score: 120,
      priority: 'CRITICAL',
      reason: ['security', 'breaking']
    },
    {
      id: 'test-4',
      title: 'React 19 beta now available for testing',
      summary: 'New features and improved developer experience',
      url: 'https://example.com/react-19-beta',
      source: 'React Blog',
      category: 'article',
      publishedAt: new Date('2026-07-08T12:00:00Z').toISOString(),
      tags: ['react'],
      score: 65,
      priority: 'MEDIUM',
      reason: ['react']
    },
    {
      id: 'test-5',
      title: 'Docker desktop adds new networking features',
      summary: 'Improved performance for local development',
      url: 'https://example.com/docker-desktop',
      source: 'Docker Blog',
      category: 'article',
      publishedAt: new Date('2026-07-07T16:00:00Z').toISOString(),
      tags: ['docker', 'devops'],
      score: 45,
      priority: 'MEDIUM',
      reason: ['docker']
    }
  ];

  it('should select top N articles by score', () => {
    // Sort articles by score first (highest to lowest)
    const sorted = [...mockArticles].sort((a, b) => b.score - a.score);
    const brief = generateBrief(sorted, 2);

    // Should include top 2 articles (Security: 120, Playwright: 110)
    expect(brief).toContain('Security: Critical CVE');
    expect(brief).toContain('Playwright 1.48');

    // Should NOT include lower-scored articles
    expect(brief).not.toContain('TypeScript 5.4');
    expect(brief).not.toContain('React 19');
  });

  it('should format brief with date header', () => {
    const sorted = [...mockArticles].sort((a, b) => b.score - a.score);
    const brief = generateBrief(sorted, 1);

    // Should include today's date
    const today = new Date().toISOString().split('T')[0];
    expect(brief).toContain(`# Daily Brief — ${today}`);
  });

  it('should include article links in markdown', () => {
    const sorted = [...mockArticles].sort((a, b) => b.score - a.score);
    const brief = generateBrief(sorted, 1);

    // Should contain markdown link syntax (first article is Security)
    expect(brief).toContain('[Security: Critical CVE');
    expect(brief).toContain('https://example.com/cve-2026-123');
  });

  it('should include article summaries', () => {
    const sorted = [...mockArticles].sort((a, b) => b.score - a.score);
    const brief = generateBrief(sorted, 1);

    // Should include summary text (Security article)
    expect(brief).toContain('production systems');
  });

  it('should include score and source information', () => {
    const sorted = [...mockArticles].sort((a, b) => b.score - a.score);
    const brief = generateBrief(sorted, 1);

    // Should include score (first article is Security with 120)
    expect(brief).toContain('120');

    // Should include source
    expect(brief).toContain('Security Weekly');
  });

  it('should group articles by priority', () => {
    const sorted = [...mockArticles].sort((a, b) => b.score - a.score);
    const brief = generateBrief(sorted, 5);

    // Should have critical section header
    expect(brief).toContain('Critical');

    // Should have high section header
    expect(brief).toContain('High Priority');

    // Should have medium section header
    expect(brief).toContain('Medium');
  });

  it('should include tags if present', () => {
    const sorted = [...mockArticles].sort((a, b) => b.score - a.score);
    const brief = generateBrief(sorted, 1);

    // First article (Security) has tags
    expect(brief).toContain('Tags:');
    expect(brief).toContain('security');
  });

  it('should include footer with generation timestamp', () => {
    const brief = generateBrief(mockArticles, 1);

    // Should include footer message
    expect(brief).toContain('Generated automatically by PAIOS');
  });

  it('should handle empty article list', () => {
    const brief = generateBrief([], 5);

    // Should still have header and footer
    expect(brief).toContain('# Daily Brief');
    expect(brief).toContain('Generated automatically by PAIOS');
    expect(brief).toContain('0 stories selected from 0 total');
  });

  it('should request fewer articles than available', () => {
    const sorted = [...mockArticles].sort((a, b) => b.score - a.score);
    const brief = generateBrief(sorted, 2);
    const summary = generateBrief(sorted, 5);

    // Brief should be shorter when requesting fewer articles
    expect(brief.length).toBeLessThan(summary.length);
  });

  it('should include reason for scoring', () => {
    const sorted = [...mockArticles].sort((a, b) => b.score - a.score);
    const brief = generateBrief(sorted, 1);

    // Should include reason tags
    expect(brief).toContain('Reason:');
  });
});

describe('generatePlainTextBrief', () => {
  it('should remove markdown bold markers', () => {
    const markdown = '**Bold Text** here';
    const plain = generatePlainTextBrief(markdown);

    expect(plain).not.toContain('**');
    expect(plain).toContain('Bold Text');
  });

  it('should remove heading markers', () => {
    const markdown = '# Heading\n## Subheading\nText';
    const plain = generatePlainTextBrief(markdown);

    expect(plain).not.toMatch(/#+\s/);
    expect(plain).toContain('Heading');
  });

  it('should convert markdown links to plain text', () => {
    const markdown = '[Click here](https://example.com)';
    const plain = generatePlainTextBrief(markdown);

    expect(plain).not.toContain('[');
    expect(plain).not.toContain(']');
    expect(plain).toContain('Click here');
  });

  it('should remove code backticks', () => {
    const markdown = 'Use `npm install` command';
    const plain = generatePlainTextBrief(markdown);

    expect(plain).not.toContain('`');
    expect(plain).toContain('npm install');
  });

  it('should normalize line breaks', () => {
    const markdown = 'Line 1\n\n\n\nLine 2';
    const plain = generatePlainTextBrief(markdown);

    // Should not have more than 2 consecutive newlines
    expect(plain).not.toContain('\n\n\n');
  });

  it('should handle full brief conversion', () => {
    const markdown = `# Daily Brief — 2026-07-14

## 🔴 Critical

1. [**Security Update**](https://example.com)
   - Summary here`;

    const plain = generatePlainTextBrief(markdown);

    expect(plain).not.toContain('**');
    expect(plain).not.toContain('[');
    expect(plain).not.toContain('](');
    expect(plain).toContain('Security Update');
    expect(plain).toContain('Summary here');
  });
});
