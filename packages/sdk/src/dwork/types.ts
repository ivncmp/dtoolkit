export interface DWorkHealthResponse {
  status: string;
  version: string;
  projects: number;
  tasks: number;
  docs: number;
}

export interface DWorkProject {
  slug: string;
  name: string;
  description: string | null;
  status: string;
  path: string;
  source_path: string | null;
  created_at: string;
  updated_at: string;
  readme?: string;
  tech?: string;
  taskCounts?: Record<string, number>;
}

export interface DWorkProjectSummary {
  slug: string;
  name: string;
  description: string | null;
  status: string;
  taskCounts: Record<string, number>;
}

export interface DWorkTask {
  id: string;
  project_slug: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  estimate: string | null;
  deadline: string | null;
  source: string;
  detail_path: string | null;
  tags: string;
  line_number: number | null;
  created_at: string;
  updated_at: string;
}

export interface DWorkDoc {
  id: string;
  project_slug: string;
  title: string;
  type: string;
  file_path: string;
  body_hash: string | null;
  created_at: string;
  updated_at: string;
  content?: string;
}

export interface DWorkSearchResult {
  type: 'task' | 'doc';
  id: string;
  title: string;
  projectSlug: string;
  docType?: string;
  taskStatus?: string;
  taskPriority?: string;
  score: number;
}

export interface DWorkOverview {
  totalProjects: number;
  totalTasks: number;
  totalDocs: number;
  projects: Array<{
    slug: string;
    name: string;
    tasksByStatus: Record<string, number>;
    tasksByPriority: Record<string, number>;
    totalTasks: number;
    totalDocs: number;
  }>;
}

export interface DWorkSyncResult {
  success: boolean;
  message: string;
  updatedFiles?: string[];
}

export interface DWorkApiKeyCreateResponse {
  id: string;
  token: string;
  userId: string;
  userName: string;
  permissions: string;
}

export interface DWorkApiKeyListItem {
  id: string;
  tokenPreview: string;
  userId: string;
  userName: string;
  permissions: string;
  createdAt: string;
  lastUsed: string | null;
  status: string;
}
