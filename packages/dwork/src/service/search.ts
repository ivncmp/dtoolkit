import type Database from 'better-sqlite3';

export interface SearchResult {
  type: 'doc' | 'task';
  id: string;
  title: string;
  projectSlug: string;
  docType?: string;
  taskStatus?: string;
  taskPriority?: string;
  score: number;
}

export function search(
  db: Database.Database,
  query: string,
  project?: string,
  limit = 20,
): SearchResult[] {
  const words = query.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const ftsQuery = words.join(' OR ');
  const results: SearchResult[] = [];

  let docSql = `
    SELECT d.id, d.title, d.project_slug, d.type, fts.rank
    FROM docs_fts fts
    JOIN docs d ON d.rowid = fts.rowid
    WHERE docs_fts MATCH ?
  `;
  const docParams: (string | number)[] = [ftsQuery];

  if (project) {
    docSql += ' AND d.project_slug = ?';
    docParams.push(project);
  }
  docSql += ' ORDER BY rank LIMIT ?';
  docParams.push(limit);

  const docRows = db.prepare(docSql).all(...docParams) as {
    id: string;
    title: string;
    project_slug: string;
    type: string;
    rank: number;
  }[];

  for (const row of docRows) {
    results.push({
      type: 'doc',
      id: row.id,
      title: row.title,
      projectSlug: row.project_slug,
      docType: row.type,
      score: -row.rank,
    });
  }

  let taskSql = `
    SELECT t.id, t.title, t.project_slug, t.status, t.priority, fts.rank
    FROM tasks_fts fts
    JOIN tasks t ON t.rowid = fts.rowid
    WHERE tasks_fts MATCH ?
  `;
  const taskParams: (string | number)[] = [ftsQuery];

  if (project) {
    taskSql += ' AND t.project_slug = ?';
    taskParams.push(project);
  }
  taskSql += ' ORDER BY rank LIMIT ?';
  taskParams.push(limit);

  const taskRows = db.prepare(taskSql).all(...taskParams) as {
    id: string;
    title: string;
    project_slug: string;
    status: string;
    priority: string;
    rank: number;
  }[];

  for (const row of taskRows) {
    results.push({
      type: 'task',
      id: row.id,
      title: row.title,
      projectSlug: row.project_slug,
      taskStatus: row.status,
      taskPriority: row.priority,
      score: -row.rank,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
