#!/usr/bin/env ts-node

import * as path from 'path';
import * as fs from 'fs';
import { Insight } from '../business-logic/insight';

/**
 * Report insights from generated_insights.ndjson
 *
 * Usage: npx ts-node src/cli/report-insights.ts [--json] [--count N]
 *
 * Outputs:
 * - Human-readable summary (default)
 * - JSON export (--json flag)
 * - Top N insights (--count flag)
 */

interface ReportOptions {
  json: boolean;
  count: number;
  file: string;
}

function parseArgs(): ReportOptions {
  return {
    json: process.argv.includes('--json'),
    count: process.argv.includes('--count')
      ? parseInt(process.argv[process.argv.indexOf('--count') + 1], 10)
      : 10,
    file: process.argv.includes('--file')
      ? process.argv[process.argv.indexOf('--file') + 1]
      : 'data/insights.ndjson'
  };
}

function formatInsightForHuman(insight: Insight): string {
  return `
## ${insight.title}

${insight.summary}

**Type:** ${insight.type}
**Confidence:** ${(insight.confidence * 100).toFixed(0)}%
**Domains:** ${insight.domains?.join(', ') || 'N/A'}
**Evidence:** ${insight.relatedFactIds?.length || 0} facts`;
}

async function main(): Promise<void> {
  const options = parseArgs();
  const projectRoot = path.resolve(__dirname, '../..');
  const filePath = path.join(projectRoot, options.file);

  if (!fs.existsSync(filePath)) {
    console.log(`No insights file found at ${filePath}`);
    process.exit(0);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  if (!content.trim()) {
    console.log('No insights generated yet');
    process.exit(0);
  }

  const insights: Insight[] = content
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line) as Insight);

  if (insights.length === 0) {
    console.log('No valid insights found');
    process.exit(0);
  }

  const topInsights = insights.slice(0, options.count);

  if (options.json) {
    console.log(JSON.stringify(topInsights, null, 2));
  } else {
    console.log(`\n# Daily Insights Summary\n`);
    console.log(`**Generated:** ${new Date().toISOString()}`);
    console.log(`**Total Insights:** ${insights.length}`);
    console.log(`**Showing:** Top ${Math.min(options.count, insights.length)}\n`);

    for (const insight of topInsights) {
      console.log(formatInsightForHuman(insight));
    }

    console.log(`\n---\n`);
    console.log(`**Confidence Distribution:**`);
    const byConfidence = {
      high: topInsights.filter(i => i.confidence >= 0.8).length,
      medium: topInsights.filter(i => i.confidence >= 0.6 && i.confidence < 0.8).length,
      low: topInsights.filter(i => i.confidence < 0.6).length
    };
    console.log(`- High (≥80%): ${byConfidence.high}`);
    console.log(`- Medium (60-80%): ${byConfidence.medium}`);
    console.log(`- Low (<60%): ${byConfidence.low}`);

    const typeDistribution: Record<string, number> = {};
    for (const insight of topInsights) {
      typeDistribution[insight.type] = (typeDistribution[insight.type] || 0) + 1;
    }
    console.log(`\n**Insight Types:**`);
    for (const [type, count] of Object.entries(typeDistribution)) {
      console.log(`- ${type}: ${count}`);
    }
  }

  process.exit(0);
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
