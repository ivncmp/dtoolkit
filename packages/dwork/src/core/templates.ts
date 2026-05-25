import { stringify as stringifyYaml } from 'yaml';

export function scaffoldReadme(slug: string, name: string, description?: string): string {
  const fm = { project: slug, type: 'readme' };
  return [
    '---',
    stringifyYaml(fm).trimEnd(),
    '---',
    '',
    `# ${name}`,
    '',
    description || 'Project description goes here.',
    '',
    '## Quick Start',
    '',
    '## Links',
    '',
  ].join('\n');
}

export function scaffoldTech(slug: string): string {
  const fm = { project: slug, type: 'tech' };
  return [
    '---',
    stringifyYaml(fm).trimEnd(),
    '---',
    '',
    '# Tech Stack',
    '',
    '## Stack',
    '',
    '| Layer | Technology |',
    '|-------|-----------|',
    '| Language | |',
    '| Framework | |',
    '| Database | |',
    '',
    '## Architecture',
    '',
    '## Development',
    '',
    '```bash',
    '# install',
    '# build',
    '# test',
    '```',
    '',
  ].join('\n');
}

export function scaffoldRoadmap(slug: string): string {
  const fm = { project: slug, type: 'roadmap' };
  return [
    '---',
    stringifyYaml(fm).trimEnd(),
    '---',
    '',
    '# Roadmap',
    '',
    '## Current',
    '',
    '## Next',
    '',
    '## Future',
    '',
  ].join('\n');
}

export function scaffoldBacklog(slug: string): string {
  const fm = { project: slug, type: 'backlog' };
  return [
    '---',
    stringifyYaml(fm).trimEnd(),
    '---',
    '',
    '## P0',
    '',
    '## P1',
    '',
    '## P2',
    '',
    '## P3',
    '',
    '## Done',
    '',
  ].join('\n');
}
