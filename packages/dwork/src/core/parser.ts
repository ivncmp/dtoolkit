import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

export interface Frontmatter {
  [key: string]: unknown;
}

export interface ParsedFrontmatter {
  frontmatter: Frontmatter;
  body: string;
}

export interface ParsedTask {
  title: string;
  done: boolean;
  status: string;
  priority: string;
  metadata: Record<string, string>;
  lineNumber: number;
}

export function parseFrontmatter(content: string): ParsedFrontmatter {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }
  const frontmatter = (parseYaml(match[1]) as Frontmatter) || {};
  return { frontmatter, body: match[2] };
}

export function parseTaskMetadata(metaStr: string): Record<string, string> {
  const result: Record<string, string> = {};
  const pairs = metaStr.split(',').map((s) => s.trim());
  for (const pair of pairs) {
    const colonIdx = pair.indexOf(':');
    if (colonIdx === -1) continue;
    const key = pair.slice(0, colonIdx).trim();
    const value = pair.slice(colonIdx + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

const PRIORITY_SECTIONS = ['P0', 'P1', 'P2', 'P3', 'Done'] as const;
const TASK_RE = /^- \[([ x])\] (.+)$/;
const META_RE = /\{([^}]+)\}\s*$/;

export function parseBacklog(content: string, _projectSlug: string): ParsedTask[] {
  const { body } = parseFrontmatter(content);
  const lines = body.split('\n');
  const tasks: ParsedTask[] = [];
  let currentPriority = 'P2';
  let inDone = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const sectionMatch = trimmed.match(/^## (P[0-3]|Done)\s*$/);
    if (sectionMatch) {
      const section = sectionMatch[1];
      if (section === 'Done') {
        inDone = true;
        currentPriority = 'P2';
      } else {
        inDone = false;
        currentPriority = section;
      }
      continue;
    }

    const taskMatch = trimmed.match(TASK_RE);
    if (!taskMatch) continue;

    const done = taskMatch[1] === 'x';
    let titlePart = taskMatch[2];
    let metadata: Record<string, string> = {};

    const metaMatch = titlePart.match(META_RE);
    if (metaMatch) {
      metadata = parseTaskMetadata(metaMatch[1]);
      titlePart = titlePart.slice(0, metaMatch.index).trim();
    }

    let status: string;
    if (inDone || done) {
      status = 'done';
    } else if (metadata.status) {
      status = metadata.status;
    } else {
      status = 'todo';
    }

    tasks.push({
      title: titlePart,
      done: done || inDone,
      status,
      priority: currentPriority,
      metadata,
      lineNumber: i + 1,
    });
  }

  return tasks;
}

export function serializeBacklog(tasks: ParsedTask[], frontmatter: Frontmatter): string {
  const sections: Record<string, ParsedTask[]> = {
    P0: [],
    P1: [],
    P2: [],
    P3: [],
    Done: [],
  };

  for (const task of tasks) {
    if (task.status === 'done' || task.done) {
      sections.Done.push(task);
    } else {
      const key = PRIORITY_SECTIONS.includes(task.priority as (typeof PRIORITY_SECTIONS)[number])
        ? task.priority
        : 'P2';
      sections[key].push(task);
    }
  }

  const lines: string[] = [];
  lines.push('---');
  lines.push(stringifyYaml(frontmatter).trimEnd());
  lines.push('---');
  lines.push('');

  for (const section of PRIORITY_SECTIONS) {
    lines.push(`## ${section}`);
    const sectionTasks = sections[section];
    for (const task of sectionTasks) {
      const checkbox = task.done || task.status === 'done' ? '[x]' : '[ ]';
      const metaEntries: string[] = [];

      for (const [key, value] of Object.entries(task.metadata)) {
        if (key === 'status' && section === 'Done') continue;
        metaEntries.push(`${key}: ${value}`);
      }

      if (task.status !== 'todo' && task.status !== 'done' && !task.metadata.status) {
        metaEntries.unshift(`status: ${task.status}`);
      }

      const metaSuffix = metaEntries.length > 0 ? ` {${metaEntries.join(', ')}}` : '';
      lines.push(`- ${checkbox} ${task.title}${metaSuffix}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
