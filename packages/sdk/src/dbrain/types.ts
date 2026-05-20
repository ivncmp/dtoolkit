export interface HealthResponse {
  status: string;
  name: string;
  version: string;
  entities: number;
  facts: number;
  documents: number;
  conversations: number;
  unprocessed: number;
  brainName?: string;
  brainType?: 'personal' | 'shared';
  connectedBrains?: number;
}

export interface ConnectResponse {
  mcp: {
    dbrain: {
      type: string;
      url: string;
      headers: Record<string, string>;
    };
  };
  permissions: string[];
  claudeMd: string;
}

export interface EntityRow {
  id: string;
  name: string;
  type: string;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
}

export interface FactRow {
  id: string;
  entity_id: string;
  fact: string;
  category: string;
  timestamp: string;
  status: string;
  superseded_by: string | null;
  related_entities: string[];
  last_accessed: string;
  access_count: number;
  tier: string;
  source: string | null;
  author_id: string | null;
  origin_brain: string | null;
}

export interface EntityWithFacts extends EntityRow {
  facts: FactRow[];
}

export interface ConversationSummary {
  id: string;
  source: string;
  started_at: string;
  ended_at: string | null;
  summary: string | null;
  message_count: number;
}

export interface Message {
  id: string;
  role: string;
  content: string;
  timestamp: string;
  processed: number;
}

export interface ConversationWithMessages {
  id: string;
  source: string;
  started_at: string;
  ended_at: string | null;
  summary: string | null;
  messages: Message[];
}

export interface SearchResult {
  fact: {
    id: string;
    entityId: string;
    fact: string;
    category: string;
    timestamp: string;
    status: string;
    lastAccessed: string;
    accessCount: number;
    tier: string;
    source: string | null;
    authorId: string | null;
    originBrain: string | null;
  };
  entity: {
    id: string;
    name: string;
    type: string;
    category: string;
  };
  score: number;
}

export interface FederatedSearchResponse {
  results: Array<SearchResult & { originBrain: string | null }>;
  federation: {
    local: number;
    remote: number;
    partial: boolean;
    sources: Array<{ name: string; count: number }>;
  };
}

export interface MemorySummaryRow {
  id: string;
  name: string;
  type: string;
  category: string;
  hot: number;
  warm: number;
  cold: number;
  total: number;
}

export interface Document {
  key: string;
  title: string;
  content: string;
  updated_at: string;
}

export interface DocumentListItem {
  key: string;
  title: string;
  updated_at: string;
}

export interface PendingMessages {
  total_unprocessed: number;
  conversations: Array<{
    id: string;
    source: string;
    started_at: string;
    unprocessed: number;
  }>;
}

export interface ConnectionStatus {
  name: string;
  url: string;
  online: boolean;
  brainName?: string;
  entities?: number;
  facts?: number;
}

export interface ShareResult {
  shared: boolean;
  targetBrain: string;
  remoteFact: { id: string; entityId: string; fact: string };
}

export interface ApiKeyCreateResponse {
  id: string;
  token: string;
  userId: string;
  userName: string;
  permissions: string;
}

export interface ApiKeyListItem {
  id: string;
  tokenPreview: string;
  userId: string;
  userName: string;
  permissions: string;
  createdAt: string;
  lastUsed: string | null;
  status: string;
}
