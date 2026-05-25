import type Database from 'better-sqlite3';

export interface ProjectOverview {
  slug: string;
  name: string;
  status: string;
  tasksByStatus: Record<string, number>;
  tasksByPriority: Record<string, number>;
  totalTasks: number;
  totalDocs: number;
}

export interface Overview {
  projects: ProjectOverview[];
  totalProjects: number;
  totalTasks: number;
  totalDocs: number;
}

export function overview(db: Database.Database): Overview {
  const projects = db
    .prepare(
      "SELECT slug, name, status FROM projects WHERE status != 'archived' ORDER BY updated_at DESC",
    )
    .all() as { slug: string; name: string; status: string }[];

  let totalTasks = 0;
  let totalDocs = 0;

  const projectOverviews: ProjectOverview[] = projects.map((p) => {
    const statusCounts = db
      .prepare('SELECT status, COUNT(*) as count FROM tasks WHERE project_slug = ? GROUP BY status')
      .all(p.slug) as { status: string; count: number }[];

    const priorityCounts = db
      .prepare(
        'SELECT priority, COUNT(*) as count FROM tasks WHERE project_slug = ? GROUP BY priority',
      )
      .all(p.slug) as { priority: string; count: number }[];

    const { docCount } = db
      .prepare('SELECT COUNT(*) as docCount FROM docs WHERE project_slug = ?')
      .get(p.slug) as { docCount: number };

    const tasksByStatus: Record<string, number> = {};
    let projTasks = 0;
    for (const row of statusCounts) {
      tasksByStatus[row.status] = row.count;
      projTasks += row.count;
    }

    const tasksByPriority: Record<string, number> = {};
    for (const row of priorityCounts) {
      tasksByPriority[row.priority] = row.count;
    }

    totalTasks += projTasks;
    totalDocs += docCount;

    return {
      slug: p.slug,
      name: p.name,
      status: p.status,
      tasksByStatus,
      tasksByPriority,
      totalTasks: projTasks,
      totalDocs: docCount,
    };
  });

  return {
    projects: projectOverviews,
    totalProjects: projects.length,
    totalTasks,
    totalDocs,
  };
}
