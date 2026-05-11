import type {
  HealthResponse,
  ConnectResponse,
  EntityRow,
  EntityWithFacts,
  FactRow,
  ConversationSummary,
  ConversationWithMessages,
  SearchResult,
  MemorySummaryRow,
  Document,
  DocumentListItem,
  PendingMessages,
  Message,
} from "./types.js";

export interface DBrainClientOptions {
  baseUrl: string;
  token: string;
}

export class DBrainClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(baseUrl: string, token: string);
  constructor(options: DBrainClientOptions);
  constructor(baseUrlOrOptions: string | DBrainClientOptions, token?: string) {
    if (typeof baseUrlOrOptions === "string") {
      this.baseUrl = baseUrlOrOptions.replace(/\/$/, "");
      this.token = token ?? "";
    } else {
      this.baseUrl = baseUrlOrOptions.baseUrl.replace(/\/$/, "");
      this.token = baseUrlOrOptions.token;
    }
  }

  // --- Health ---

  async health(): Promise<HealthResponse> {
    return this.get("/health");
  }

  async connect(): Promise<ConnectResponse> {
    return this.get("/connect");
  }

  // --- Entities ---

  async listEntities(filters?: {
    category?: string;
    type?: string;
  }): Promise<EntityRow[]> {
    const params = new URLSearchParams();
    if (filters?.category) params.set("category", filters.category);
    if (filters?.type) params.set("type", filters.type);
    return this.get(`/entities${qs(params)}`);
  }

  async getEntity(id: string): Promise<EntityWithFacts> {
    return this.get(`/entities/${enc(id)}`);
  }

  async createEntity(entity: {
    id: string;
    name: string;
    type: string;
    category: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ id: string; name: string; type: string; category: string }> {
    return this.post("/entities", entity);
  }

  async archiveEntity(id: string): Promise<{ id: string; status: string }> {
    return this.del(`/entities/${enc(id)}`);
  }

  // --- Facts ---

  async listFacts(
    entityId: string,
    filters?: { tier?: string },
  ): Promise<FactRow[]> {
    const params = new URLSearchParams();
    if (filters?.tier) params.set("tier", filters.tier);
    return this.get(`/entities/${enc(entityId)}/facts${qs(params)}`);
  }

  async addFact(
    entityId: string,
    fact: {
      id: string;
      fact: string;
      category?: string;
      timestamp?: string;
      source?: string;
      relatedEntities?: string[];
    },
  ): Promise<{ id: string; entityId: string; fact: string }> {
    return this.post(`/entities/${enc(entityId)}/facts`, fact);
  }

  async bumpFact(id: string): Promise<{ id: string; bumped: boolean }> {
    return this.patch(`/facts/${enc(id)}/access`);
  }

  // --- Search ---

  async search(
    query: string,
    options?: { limit?: number; entityId?: string; tier?: string },
  ): Promise<SearchResult[]> {
    return this.post("/search", { query, ...options });
  }

  async memorySummary(): Promise<MemorySummaryRow[]> {
    return this.get("/memory/summary");
  }

  // --- Conversations ---

  async listConversations(filters?: {
    source?: string;
    limit?: number;
  }): Promise<ConversationSummary[]> {
    const params = new URLSearchParams();
    if (filters?.source) params.set("source", filters.source);
    if (filters?.limit) params.set("limit", String(filters.limit));
    return this.get(`/conversations${qs(params)}`);
  }

  async getConversation(id: string): Promise<ConversationWithMessages> {
    return this.get(`/conversations/${enc(id)}`);
  }

  async startConversation(
    source: string,
    id?: string,
  ): Promise<{ id: string; source: string; started_at: string }> {
    return this.post("/conversations", { source, ...(id ? { id } : {}) });
  }

  async sendMessages(
    conversationId: string,
    messages: Array<{ role: string; content: string }>,
  ): Promise<Array<{ id: string; role: string; timestamp: string }>> {
    return this.post(
      `/conversations/${enc(conversationId)}/messages`,
      messages.length === 1 ? messages[0] : messages,
    );
  }

  async listMessages(
    conversationId: string,
    filters?: { since?: string; processed?: boolean },
  ): Promise<Message[]> {
    const params = new URLSearchParams();
    if (filters?.since) params.set("since", filters.since);
    if (filters?.processed !== undefined)
      params.set("processed", String(filters.processed));
    return this.get(`/conversations/${enc(conversationId)}/messages${qs(params)}`);
  }

  async pendingMessages(): Promise<PendingMessages> {
    return this.get("/conversations/pending");
  }

  // --- Workspace (Documents) ---

  async listDocuments(): Promise<DocumentListItem[]> {
    return this.get("/workspace");
  }

  async getDocument(key: string): Promise<Document> {
    return this.get(`/workspace/${enc(key)}`);
  }

  async putDocument(
    key: string,
    doc: { title: string; content: string },
  ): Promise<{ key: string; title: string; updated_at: string }> {
    return this.put(`/workspace/${enc(key)}`, doc);
  }

  async deleteDocument(key: string): Promise<{ key: string; deleted: boolean }> {
    return this.del(`/workspace/${enc(key)}`);
  }

  // --- HTTP helpers ---

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new DBrainError(res.status, text, path);
    }

    return res.json() as Promise<T>;
  }

  private get<T>(path: string): Promise<T> {
    return this.request("GET", path);
  }

  private post<T>(path: string, body: unknown): Promise<T> {
    return this.request("POST", path, body);
  }

  private put<T>(path: string, body: unknown): Promise<T> {
    return this.request("PUT", path, body);
  }

  private patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request("PATCH", path, body);
  }

  private del<T>(path: string): Promise<T> {
    return this.request("DELETE", path);
  }
}

export class DBrainError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    public readonly path: string,
  ) {
    super(`dbrain ${status} on ${path}: ${body}`);
    this.name = "DBrainError";
  }
}

function enc(s: string): string {
  return encodeURIComponent(s);
}

function qs(params: URLSearchParams): string {
  const str = params.toString();
  return str ? `?${str}` : "";
}
