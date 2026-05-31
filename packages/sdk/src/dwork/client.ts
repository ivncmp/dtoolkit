import { HttpClient, enc, qs } from '../http.js';

import type {
  DWorkApiKeyCreateResponse,
  DWorkApiKeyListItem,
  DWorkDoc,
  DWorkGraph,
  DWorkGraphNode,
  DWorkGraphSearchResult,
  DWorkGraphStats,
  DWorkGraphSubgraph,
  DWorkGraphUploadResult,
  DWorkHealthResponse,
  DWorkOverview,
  DWorkProject,
  DWorkProjectSummary,
  DWorkSearchResult,
  DWorkSyncResult,
  DWorkTask,
} from './types.js';

export interface DWorkClientOptions {
  baseUrl: string;
  token: string;
  timeoutMs?: number;
}

export class DWorkClient {
  private readonly http: HttpClient;

  constructor(baseUrl: string, token: string);
  constructor(options: DWorkClientOptions);
  constructor(baseUrlOrOptions: string | DWorkClientOptions, token?: string) {
    if (typeof baseUrlOrOptions === 'string') {
      this.http = new HttpClient({
        baseUrl: baseUrlOrOptions,
        token: token ?? '',
      });
    } else {
      this.http = new HttpClient({
        baseUrl: baseUrlOrOptions.baseUrl,
        token: baseUrlOrOptions.token,
        timeoutMs: baseUrlOrOptions.timeoutMs,
      });
    }
  }

  // --- Health ---

  async health(): Promise<DWorkHealthResponse> {
    return this.http.get('/health');
  }

  // --- Projects ---

  async listProjects(status?: string): Promise<DWorkProjectSummary[]> {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    return this.http.get(`/projects${qs(params)}`);
  }

  async getProject(slug: string): Promise<DWorkProject> {
    return this.http.get(`/projects/${enc(slug)}`);
  }

  async createProject(project: {
    slug: string;
    name: string;
    description?: string;
    source_path?: string;
  }): Promise<DWorkProject> {
    return this.http.post('/projects', project);
  }

  async updateProject(
    slug: string,
    changes: { name?: string; description?: string; status?: string; source_path?: string },
  ): Promise<DWorkProject> {
    return this.http.patch(`/projects/${enc(slug)}`, changes);
  }

  async deleteProject(slug: string): Promise<{ deleted: boolean; slug: string }> {
    return this.http.del(`/projects/${enc(slug)}`);
  }

  // --- Tasks ---

  async listTasks(
    project: string,
    filters?: { status?: string; priority?: string },
  ): Promise<DWorkTask[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.priority) params.set('priority', filters.priority);
    return this.http.get(`/projects/${enc(project)}/tasks${qs(params)}`);
  }

  async addTask(
    project: string,
    task: {
      title: string;
      type?: string;
      priority?: string;
      status?: string;
      estimate?: string;
      deadline?: string;
      detail?: string;
      detail_doc?: { title: string; body: string; type: string };
    },
  ): Promise<DWorkTask> {
    return this.http.post(`/projects/${enc(project)}/tasks`, task);
  }

  async updateTask(
    id: string,
    changes: {
      title?: string;
      status?: string;
      priority?: string;
      type?: string;
      estimate?: string;
      deadline?: string;
      detail?: string;
      project?: string;
    },
  ): Promise<{ updated: boolean; id: string }> {
    return this.http.patch(`/tasks/${enc(id)}`, changes);
  }

  async deleteTask(id: string): Promise<{ deleted: boolean; id: string }> {
    return this.http.del(`/tasks/${enc(id)}`);
  }

  // --- Docs ---

  async listDocs(project: string, type?: string): Promise<DWorkDoc[]> {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    return this.http.get(`/projects/${enc(project)}/docs${qs(params)}`);
  }

  async getDoc(id: string): Promise<DWorkDoc> {
    return this.http.get(`/docs/${enc(id)}`);
  }

  async addDoc(
    project: string,
    doc: { title: string; body: string; type: string },
  ): Promise<DWorkDoc> {
    return this.http.post(`/projects/${enc(project)}/docs`, doc);
  }

  async updateDoc(
    id: string,
    changes: { title?: string; body?: string; type?: string },
  ): Promise<{ updated: boolean; id: string }> {
    return this.http.patch(`/docs/${enc(id)}`, changes);
  }

  async deleteDoc(id: string): Promise<{ deleted: boolean; id: string }> {
    return this.http.del(`/docs/${enc(id)}`);
  }

  // --- Search ---

  async search(
    query: string,
    options?: { project?: string; limit?: number },
  ): Promise<DWorkSearchResult[]> {
    return this.http.post('/search', { query, ...options });
  }

  // --- Overview ---

  async overview(): Promise<DWorkOverview> {
    return this.http.get('/overview');
  }

  async whatToDoNext(project?: string): Promise<DWorkTask[]> {
    const params = new URLSearchParams();
    if (project) params.set('project', project);
    return this.http.get(`/next${qs(params)}`);
  }

  // --- Sync ---

  async sync(project: string): Promise<DWorkSyncResult> {
    return this.http.post(`/sync/${enc(project)}`, {});
  }

  // --- API Keys ---

  async createApiKey(params: {
    userId: string;
    userName: string;
    permissions?: string;
  }): Promise<DWorkApiKeyCreateResponse> {
    return this.http.post('/keys', params);
  }

  async listApiKeys(): Promise<DWorkApiKeyListItem[]> {
    return this.http.get('/keys');
  }

  async revokeApiKey(id: string): Promise<{ id: string; revoked: boolean }> {
    return this.http.del(`/keys/${enc(id)}`);
  }

  // --- Graphs ---

  async listGraphs(): Promise<DWorkGraph[]> {
    return this.http.get('/graphs');
  }

  async getGraph(name: string): Promise<DWorkGraph> {
    return this.http.get(`/graphs/${enc(name)}`);
  }

  async deleteGraph(name: string): Promise<void> {
    await this.http.requestRaw('DELETE', `/graphs/${enc(name)}`);
  }

  async uploadGraph(
    name: string,
    dbBuffer: Uint8Array | ArrayBuffer,
  ): Promise<DWorkGraphUploadResult> {
    return this.http.postBinary(`/graphs/${enc(name)}/upload`, dbBuffer);
  }

  async linkGraphProjects(name: string, slugs: string[]): Promise<{ linked: string[] }> {
    return this.http.post(`/graphs/${enc(name)}/projects`, { slugs });
  }

  async unlinkGraphProject(name: string, slug: string): Promise<void> {
    await this.http.requestRaw('DELETE', `/graphs/${enc(name)}/projects/${enc(slug)}`);
  }

  async graphStats(name: string): Promise<DWorkGraphStats> {
    return this.http.get(`/graphs/${enc(name)}/stats`);
  }

  async searchGraphNodes(
    name: string,
    query: string,
    options?: { kind?: string; limit?: number },
  ): Promise<DWorkGraphSearchResult[]> {
    const params = new URLSearchParams({ q: query });
    if (options?.kind) params.set('kind', options.kind);
    if (options?.limit) params.set('limit', String(options.limit));
    return this.http.get(`/graphs/${enc(name)}/nodes${qs(params)}`);
  }

  async getGraphNode(name: string, nodeId: string): Promise<DWorkGraphNode> {
    return this.http.get(`/graphs/${enc(name)}/nodes/${enc(nodeId)}`);
  }

  async getGraphCallers(
    name: string,
    nodeId: string,
    depth?: number,
  ): Promise<
    Array<{ node: DWorkGraphNode; edge: { source: string; target: string; kind: string } }>
  > {
    const params = new URLSearchParams();
    if (depth) params.set('depth', String(depth));
    return this.http.get(`/graphs/${enc(name)}/nodes/${enc(nodeId)}/callers${qs(params)}`);
  }

  async getGraphImpact(name: string, nodeId: string, depth?: number): Promise<DWorkGraphSubgraph> {
    const params = new URLSearchParams();
    if (depth) params.set('depth', String(depth));
    return this.http.get(`/graphs/${enc(name)}/nodes/${enc(nodeId)}/impact${qs(params)}`);
  }

  async traceGraphPath(
    name: string,
    from: string,
    to: string,
  ): Promise<{
    path: Array<{
      node: DWorkGraphNode;
      edge: { source: string; target: string; kind: string } | null;
    }> | null;
  }> {
    const params = new URLSearchParams({ from, to });
    return this.http.get(`/graphs/${enc(name)}/trace${qs(params)}`);
  }

  async getGraphFiles(
    name: string,
  ): Promise<Array<{ path: string; language: string; nodeCount: number }>> {
    return this.http.get(`/graphs/${enc(name)}/files`);
  }

  async graphGetSubgraph(
    name: string,
    options?: { kind?: string; file?: string; limit?: number },
  ): Promise<DWorkGraphSubgraph> {
    const params = new URLSearchParams();
    if (options?.kind) params.set('kind', options.kind);
    if (options?.file) params.set('file', options.file);
    if (options?.limit) params.set('limit', String(options.limit));
    return this.http.get(`/graphs/${enc(name)}/graph${qs(params)}`);
  }

  async graphDeadCode(name: string, kinds?: string): Promise<DWorkGraphNode[]> {
    const params = new URLSearchParams();
    if (kinds) params.set('kinds', kinds);
    return this.http.get(`/graphs/${enc(name)}/deadcode${qs(params)}`);
  }

  async graphCircularDependencies(name: string): Promise<string[][]> {
    return this.http.get(`/graphs/${enc(name)}/circular`);
  }
}
