import { HttpClient, enc, qs } from "../http.js";

import type {
  ConnectResponse,
  ConversationSummary,
  ConversationWithMessages,
  Document,
  DocumentListItem,
  EntityRow,
  EntityWithFacts,
  FactRow,
  HealthResponse,
  MemorySummaryRow,
  Message,
  PendingMessages,
  SearchResult,
} from "./types.js";

export interface DBrainClientOptions {
  baseUrl: string;
  token: string;
}

export class DBrainClient {
  private readonly http: HttpClient;

  constructor(baseUrl: string, token: string);
  constructor(options: DBrainClientOptions);
  constructor(baseUrlOrOptions: string | DBrainClientOptions, token?: string) {
    if (typeof baseUrlOrOptions === "string") {
      this.http = new HttpClient({
        baseUrl: baseUrlOrOptions,
        token: token ?? "",
      });
    } else {
      this.http = new HttpClient({
        baseUrl: baseUrlOrOptions.baseUrl,
        token: baseUrlOrOptions.token,
      });
    }
  }

  // --- Health ---

  async health(): Promise<HealthResponse> {
    return this.http.get("/health");
  }

  async connect(): Promise<ConnectResponse> {
    return this.http.get("/connect");
  }

  // --- Entities ---

  async listEntities(filters?: {
    category?: string;
    type?: string;
  }): Promise<EntityRow[]> {
    const params = new URLSearchParams();
    if (filters?.category) params.set("category", filters.category);
    if (filters?.type) params.set("type", filters.type);
    return this.http.get(`/entities${qs(params)}`);
  }

  async getEntity(id: string): Promise<EntityWithFacts> {
    return this.http.get(`/entities/${enc(id)}`);
  }

  async createEntity(entity: {
    id: string;
    name: string;
    type: string;
    category: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ id: string; name: string; type: string; category: string }> {
    return this.http.post("/entities", entity);
  }

  async archiveEntity(id: string): Promise<{ id: string; status: string }> {
    return this.http.del(`/entities/${enc(id)}`);
  }

  // --- Facts ---

  async listFacts(
    entityId: string,
    filters?: { tier?: string },
  ): Promise<FactRow[]> {
    const params = new URLSearchParams();
    if (filters?.tier) params.set("tier", filters.tier);
    return this.http.get(`/entities/${enc(entityId)}/facts${qs(params)}`);
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
    return this.http.post(`/entities/${enc(entityId)}/facts`, fact);
  }

  async bumpFact(id: string): Promise<{ id: string; bumped: boolean }> {
    return this.http.patch(`/facts/${enc(id)}/access`);
  }

  // --- Search ---

  async search(
    query: string,
    options?: { limit?: number; entityId?: string; tier?: string },
  ): Promise<SearchResult[]> {
    return this.http.post("/search", { query, ...options });
  }

  async memorySummary(): Promise<MemorySummaryRow[]> {
    return this.http.get("/memory/summary");
  }

  // --- Conversations ---

  async listConversations(filters?: {
    source?: string;
    limit?: number;
  }): Promise<ConversationSummary[]> {
    const params = new URLSearchParams();
    if (filters?.source) params.set("source", filters.source);
    if (filters?.limit) params.set("limit", String(filters.limit));
    return this.http.get(`/conversations${qs(params)}`);
  }

  async getConversation(id: string): Promise<ConversationWithMessages> {
    return this.http.get(`/conversations/${enc(id)}`);
  }

  async startConversation(
    source: string,
    id?: string,
  ): Promise<{ id: string; source: string; started_at: string }> {
    return this.http.post("/conversations", {
      source,
      ...(id ? { id } : {}),
    });
  }

  async sendMessages(
    conversationId: string,
    messages: Array<{ role: string; content: string }>,
  ): Promise<Array<{ id: string; role: string; timestamp: string }>> {
    return this.http.post(
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
    return this.http.get(
      `/conversations/${enc(conversationId)}/messages${qs(params)}`,
    );
  }

  async pendingMessages(): Promise<PendingMessages> {
    return this.http.get("/conversations/pending");
  }

  // --- Workspace (Documents) ---

  async listDocuments(): Promise<DocumentListItem[]> {
    return this.http.get("/workspace");
  }

  async getDocument(key: string): Promise<Document> {
    return this.http.get(`/workspace/${enc(key)}`);
  }

  async putDocument(
    key: string,
    doc: { title: string; content: string },
  ): Promise<{ key: string; title: string; updated_at: string }> {
    return this.http.put(`/workspace/${enc(key)}`, doc);
  }

  async deleteDocument(
    key: string,
  ): Promise<{ key: string; deleted: boolean }> {
    return this.http.del(`/workspace/${enc(key)}`);
  }
}
