import { readFileSync } from 'fs';
import { join } from 'path';

// Guards the race fix: export must run after the Daily Brief PR is merged to main,
// not after the Daily Brief workflow itself (which only opens the PR).
describe('export-qa-news trigger', () => {
  const workflow = readFileSync(
    join(__dirname, '../../.github/workflows/export-qa-news.yml'),
    'utf8'
  );

  it('is triggered by the Merge Daily Brief PR workflow', () => {
    expect(workflow).toContain('workflows: ["Merge Daily Brief PR"]');
    expect(workflow).not.toContain('workflows: ["Daily Brief"]');
  });

  it('runs only when the merge workflow succeeded', () => {
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
  });
});
